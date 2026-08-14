import crypto from 'crypto';

const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';

// Module-level cookie cache — persists across warm Vercel invocations
let cachedCookie = '';

async function performLogin(username, password, portalUrl) {
  const portalOrigin = new URL(portalUrl).origin;
  const loginPageUrl = `${portalOrigin}/index.php/login`;
  const validateUrl = `${portalOrigin}/index.php/login/validate`;

  console.log(`[audio-proxy] Initiating RSA-encrypted SlashRTC login for '${username}' at ${portalOrigin}...`);

  // Step 1: Initial GET to /login page to receive initial session cookie & RSA public key
  const initialRes = await fetch(loginPageUrl, {
    headers: { 'User-Agent': ua }
  });
  const html = await initialRes.text();

  const initialSetCookies = typeof initialRes.headers.getSetCookie === 'function'
    ? initialRes.headers.getSetCookie()
    : (initialRes.headers.get('set-cookie') ? [initialRes.headers.get('set-cookie')] : []);

  const ciCookieStr = initialSetCookies.find(c => c && c.includes('ci_session2='));
  const initialCookieHeader = ciCookieStr ? ciCookieStr.split(';')[0] : '';

  // Extract RSA public key from login page HTML
  const match = html.match(/-----BEGIN PUBLIC KEY-----[\s\S]*?-----END PUBLIC KEY-----/);
  let finalPassword = password;
  if (match) {
    const publicKeyPem = match[0];
    const encryptedBuf = crypto.publicEncrypt(
      { key: publicKeyPem, padding: crypto.constants.RSA_PKCS1_PADDING },
      Buffer.from(password, 'utf8')
    );
    finalPassword = encryptedBuf.toString('base64');
    console.log('[audio-proxy] Password encrypted with RSA public key successfully.');
  }

  // Step 2: POST credentials with RSA encrypted password
  const loginForm = new URLSearchParams();
  loginForm.append('username', username);
  loginForm.append('password', finalPassword);

  const loginResponse = await fetch(validateUrl, {
    method: 'POST',
    body: loginForm,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': ua,
      'Cookie': initialCookieHeader,
      'Referer': loginPageUrl,
      'Origin': portalOrigin
    },
    redirect: 'manual'
  });

  const loginText = await loginResponse.text();
  if (loginText.includes('alerterror') || loginText.includes('Incorrect') || loginText.includes('Username or Password')) {
    cachedCookie = '';
    throw new Error('SlashRTC login failed: Incorrect username or password.');
  }

  const authSetCookies = typeof loginResponse.headers.getSetCookie === 'function'
    ? loginResponse.headers.getSetCookie()
    : (loginResponse.headers.get('set-cookie') ? [loginResponse.headers.get('set-cookie')] : []);

  const validCookies = authSetCookies.filter(c => c && c.includes('ci_session2=') && !c.includes('expires='));
  const finalCookieHeader = validCookies.length > 0 ? validCookies[validCookies.length - 1].split(';')[0] : initialCookieHeader;

  if (finalCookieHeader) {
    cachedCookie = finalCookieHeader;
    console.log('[audio-proxy] SlashRTC session established automatically!');
    return cachedCookie;
  } else {
    throw new Error('Could not obtain session cookie from SlashRTC login.');
  }
}

async function fetchAudioWithCookie(audioUrl, cookieHeader, portalUrl) {
  const portalOrigin = new URL(portalUrl).origin;
  return await fetch(audioUrl, {
    headers: {
      'Cookie': cookieHeader,
      'User-Agent': ua,
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': `${portalOrigin}/index.php/site/viewcampaign`
    }
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { url: audioUrl, username = 'SupportEngineer', password = 'Enginer#321', portalUrl = 'https://aramcoindia.slashrtc.in/index.php/site/viewcampaign', sessionCookie = '' } = req.query;

  if (!audioUrl) {
    res.status(400).send('Missing url parameter');
    return;
  }

  if (sessionCookie && sessionCookie.trim()) {
    const trimmed = sessionCookie.trim();
    cachedCookie = trimmed.includes('=') ? trimmed : `ci_session2=${trimmed}`;
  }

  try {
    let audioResponse = null;

    // Automated Login if no cached session
    if (!cachedCookie) {
      try {
        await performLogin(username, password, portalUrl);
      } catch (loginErr) {
        console.warn(`[audio-proxy] Automated login failed: ${loginErr.message}`);
      }
    }

    if (cachedCookie) {
      console.log(`[audio-proxy] Fetching audio via AJAX with SlashRTC session cookie: ${audioUrl}`);
      audioResponse = await fetchAudioWithCookie(audioUrl, cachedCookie, portalUrl);
    }

    // Detect HTML response / expired session
    let ct = (audioResponse ? (audioResponse.headers.get('content-type') || '') : '').toLowerCase();
    let isHtml = ct.includes('text/html');

    if (!audioResponse || !audioResponse.ok || isHtml) {
      console.log('[audio-proxy] Session expired or returned HTML. Re-running automated RSA login...');
      cachedCookie = '';
      try {
        await performLogin(username, password, portalUrl);
        audioResponse = await fetchAudioWithCookie(audioUrl, cachedCookie, portalUrl);
      } catch (reloginErr) {
        console.warn(`[audio-proxy] Re-login failed: ${reloginErr.message}`);
      }
    }

    if (!audioResponse || !audioResponse.ok) {
      res.status(401).send(`SlashRTC Auth Error: SlashRTC login failed for '${username}' at ${portalUrl}. Check Username & Password in Settings.`);
      return;
    }

    const arrayBuffer = await audioResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length < 100) {
      // Re-try login once more if session expired mid-flight
      console.log('[audio-proxy] Buffer < 100 bytes (session expired). Re-authenticating via RSA...');
      cachedCookie = '';
      try {
        await performLogin(username, password, portalUrl);
        const retryRes = await fetchAudioWithCookie(audioUrl, cachedCookie, portalUrl);
        const retryBuf = Buffer.from(await retryRes.arrayBuffer());
        if (retryBuf.length >= 100) {
          const finalCt = retryRes.headers.get('content-type') || 'audio/mpeg';
          res.setHeader('Content-Type', finalCt);
          res.setHeader('Content-Length', retryBuf.length);
          res.status(200).send(retryBuf);
          return;
        }
      } catch (_) {}

      res.status(401).send(`SlashRTC Auth Error: Unable to fetch audio recording from SlashRTC.`);
      return;
    }

    const finalCt = audioResponse.headers.get('content-type') || 'audio/mpeg';
    res.setHeader('Content-Type', finalCt);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Accept-Ranges', 'bytes');
    res.status(200).send(buffer);

  } catch (err) {
    console.error('[audio-proxy] Error:', err.message);
    res.status(500).send(`Audio proxy error: ${err.message}`);
  }
}
