const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

// Module-level cookie cache — persists across warm Vercel invocations
let cachedCookie = '';

async function performLogin(username, password, portalUrl) {
  const portalOrigin = new URL(portalUrl).origin;
  console.log(`[audio-proxy] Logging into SlashRTC (${portalOrigin}) as ${username}...`);

  const loginForm = new URLSearchParams();
  loginForm.append('username', username);
  loginForm.append('password', password);

  const loginResponse = await fetch(`${portalOrigin}/index.php/login/validate`, {
    method: 'POST',
    body: loginForm,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': ua
    },
    redirect: 'manual'
  });

  const setCookies = loginResponse.headers.getSetCookie
    ? loginResponse.headers.getSetCookie()
    : (loginResponse.headers.get('set-cookie') ? [loginResponse.headers.get('set-cookie')] : []);

  const validCookies = setCookies.filter(c => c.startsWith('ci_session2=') && !c.includes('expires='));
  const finalCookie = validCookies[validCookies.length - 1];

  if (finalCookie) {
    cachedCookie = finalCookie.split(';')[0];
    console.log('[audio-proxy] SlashRTC session established.');
    return cachedCookie;
  } else {
    throw new Error('Could not obtain session cookie from SlashRTC login.');
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { url: audioUrl, username = 'SupportEngineer', password = 'Enginer#321', portalUrl = 'https://aramcoindia.slashrtc.in/index.php/report/dashboardView?1=1' } = req.query;

  if (!audioUrl) {
    res.status(400).send('Missing url parameter');
    return;
  }

  try {
    // Login if no cached session
    if (!cachedCookie) {
      await performLogin(username, password, portalUrl);
    }

    console.log(`[audio-proxy] Fetching: ${audioUrl}`);
    let audioResponse = await fetch(audioUrl, {
      headers: { 'Cookie': cachedCookie, 'User-Agent': ua }
    });

    // Detect HTML response (session expired / redirect to login page)
    const ct = (audioResponse.headers.get('content-type') || '').toLowerCase();
    const isHtml = ct.includes('text/html');
    const isRedirect = audioResponse.status === 302 || audioResponse.headers.get('refresh');

    if (isHtml || isRedirect) {
      console.log('[audio-proxy] Session expired. Re-logging in...');
      cachedCookie = '';
      await performLogin(username, password, portalUrl);

      audioResponse = await fetch(audioUrl, {
        headers: { 'Cookie': cachedCookie, 'User-Agent': ua }
      });
    }

    const finalCt = audioResponse.headers.get('content-type') || 'audio/x-wav';
    res.setHeader('Content-Type', finalCt);
    res.setHeader('Accept-Ranges', 'bytes');
    if (audioResponse.headers.get('content-length')) {
      res.setHeader('Content-Length', audioResponse.headers.get('content-length'));
    }

    // Stream audio body back to client
    const arrayBuffer = await audioResponse.arrayBuffer();
    res.status(200).send(Buffer.from(arrayBuffer));

  } catch (err) {
    console.error('[audio-proxy] Error:', err.message);
    res.status(500).send(`Audio proxy error: ${err.message}`);
  }
}
