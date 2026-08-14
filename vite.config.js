import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import crypto from 'crypto'

let cachedCookie = '';
const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';

async function performLogin(username, password, portalUrl) {
  const portalOrigin = new URL(portalUrl).origin;
  const loginPageUrl = `${portalOrigin}/index.php/login`;
  const validateUrl = `${portalOrigin}/index.php/login/validate`;

  console.log(`[vite-proxy] Initiating RSA-encrypted SlashRTC login for user '${username}' at ${portalOrigin}...`);

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
    console.log('[vite-proxy] Password encrypted with RSA public key successfully.');
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
    console.log('[vite-proxy] SlashRTC session established automatically!');
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

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'slashrtc-audio-proxy',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url.startsWith('/api/transcribe-call')) {
            try {
              const transcribeCallModule = await import('./api/transcribe-call.js');
              let bodyText = '';
              req.on('data', chunk => { bodyText += chunk; });
              req.on('end', async () => {
                let parsedBody = {};
                try { parsedBody = JSON.parse(bodyText); } catch (_) {}
                req.body = parsedBody;
                
                // Polyfill status method for Express-like response
                res.status = (code) => {
                  res.statusCode = code;
                  return {
                    json: (data) => {
                      res.setHeader('Content-Type', 'application/json');
                      res.end(JSON.stringify(data));
                    },
                    send: (data) => {
                      if (typeof data === 'object') {
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify(data));
                      } else {
                        res.end(data);
                      }
                    }
                  };
                };

                await transcribeCallModule.default(req, res);
              });
            } catch (err) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ status: 'TRANSCRIPTION_FAILED', error: err.message }));
            }
            return;
          }

          if (req.url.startsWith('/api/openai-proxy')) {
            try {
              let bodyText = '';
              req.on('data', chunk => { bodyText += chunk; });
              req.on('end', async () => {
                const openaiKey = req.headers['x-api-key'] || '';
                const url = `https://api.openai.com/v1/chat/completions`;
                
                const openaiResponse = await fetch(url, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${openaiKey}`
                  },
                  body: bodyText
                });

                res.setHeader('Content-Type', openaiResponse.headers.get('content-type') || 'application/json');
                res.statusCode = openaiResponse.status;
                const resText = await openaiResponse.text();
                res.end(resText);
              });
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: { message: err.message } }));
            }
            return;
          }

          if (req.url.startsWith('/api/openai-whisper-proxy')) {
            try {
              let chunks = [];
              req.on('data', chunk => chunks.push(chunk));
              req.on('end', async () => {
                const openaiKey = req.headers['x-api-key'] || '';
                const bodyBuffer = Buffer.concat(chunks);
                const contentType = req.headers['content-type'] || 'multipart/form-data';

                const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${openaiKey}`,
                    'Content-Type': contentType
                  },
                  body: bodyBuffer
                });

                res.setHeader('Content-Type', whisperResponse.headers.get('content-type') || 'application/json');
                res.statusCode = whisperResponse.status;
                const resText = await whisperResponse.text();
                res.end(resText);
              });
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: { message: err.message } }));
            }
            return;
          }


          if (req.url.startsWith('/api/audio-proxy')) {
            const urlObj = new URL(req.url, `http://${req.headers.host}`);
            const audioUrl = urlObj.searchParams.get('url');
            const usernameParam = urlObj.searchParams.get('username') || 'SupportEngineer';
            const passwordParam = urlObj.searchParams.get('password') || 'Enginer#321';
            const portalUrlParam = urlObj.searchParams.get('portalUrl') || 'https://aramcoindia.slashrtc.in/index.php/report/dashboardView?1=1';
            const sessionCookieParam = urlObj.searchParams.get('sessionCookie') || '';
            
            if (!audioUrl) {
              res.statusCode = 400;
              res.end('Missing url parameter');
              return;
            }

            if (sessionCookieParam && sessionCookieParam.trim()) {
              const trimmed = sessionCookieParam.trim();
              cachedCookie = trimmed.includes('=') ? trimmed : `ci_session2=${trimmed}`;
            }

            try {
              let audioResponse = null;

              if (!cachedCookie) {
                try {
                  await performLogin(usernameParam, passwordParam, portalUrlParam);
                } catch (loginErr) {
                  console.warn(`[vite-proxy] Login failed: ${loginErr.message}`);
                }
              }

              if (cachedCookie) {
                console.log(`[vite-proxy] Fetching audio via AJAX with SlashRTC session cookie: ${audioUrl}`);
                audioResponse = await fetchAudioWithCookie(audioUrl, cachedCookie, portalUrlParam);
              }

              let ct = (audioResponse ? (audioResponse.headers.get('content-type') || '') : '').toLowerCase();
              let isHtml = ct.includes('text/html');

              if (!audioResponse || !audioResponse.ok || isHtml) {
                console.log("[vite-proxy] Session expired or returned HTML. Re-logging in automatically...");
                cachedCookie = '';
                try {
                  await performLogin(usernameParam, passwordParam, portalUrlParam);
                  audioResponse = await fetchAudioWithCookie(audioUrl, cachedCookie, portalUrlParam);
                } catch (reloginErr) {
                  console.warn(`[vite-proxy] Re-login failed: ${reloginErr.message}`);
                }
              }

              if (!audioResponse || !audioResponse.ok) {
                res.statusCode = 401;
                res.end(`SlashRTC Auth Error: SlashRTC login failed for '${usernameParam}' at ${portalUrlParam}. Check Username & Password in Settings.`);
                return;
              }

              const arrayBuffer = await audioResponse.arrayBuffer();
              const buffer = Buffer.from(arrayBuffer);

              if (buffer.length < 100) {
                console.log("[vite-proxy] Buffer < 100 bytes (session expired). Re-authenticating via RSA...");
                cachedCookie = '';
                try {
                  await performLogin(usernameParam, passwordParam, portalUrlParam);
                  const retryRes = await fetchAudioWithCookie(audioUrl, cachedCookie, portalUrlParam);
                  const retryBuf = Buffer.from(await retryRes.arrayBuffer());
                  if (retryBuf.length >= 100) {
                    const finalCt = retryRes.headers.get('content-type') || 'audio/mpeg';
                    res.setHeader('Content-Type', finalCt);
                    res.setHeader('Content-Length', retryBuf.length);
                    res.end(retryBuf);
                    return;
                  }
                } catch (_) {}

                res.statusCode = 401;
                res.end("SlashRTC Auth Error: Unable to fetch audio recording from SlashRTC.");
                return;
              }

              const finalCt = audioResponse.headers.get('content-type') || 'audio/mpeg';
              res.setHeader('Content-Type', finalCt);
              res.setHeader('Content-Length', buffer.length);
              res.setHeader('Accept-Ranges', 'bytes');
              res.end(buffer);

            } catch (error) {
              console.error("Audio proxy failed:", error);
              res.statusCode = 500;
              res.end(`Proxy Error: ${error.message}`);
            }
            return;
          }
          next();
        });
      }
    }
  ],
})
