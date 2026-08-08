import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

let cachedCookie = '';
const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function performLogin(username, password, portalUrl) {
  const portalOrigin = new URL(portalUrl).origin;
  console.log(`Logging into SlashRTC portal (${portalOrigin}) as ${username}...`);
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

  const setCookies = loginResponse.headers.getSetCookie();
  const validCookies = setCookies.filter(c => c.startsWith('ci_session2=') && !c.includes('expires='));
  const finalCookie = validCookies[validCookies.length - 1];
  
  if (finalCookie) {
    cachedCookie = finalCookie.split(';')[0];
    console.log("SlashRTC session established successfully!");
    return cachedCookie;
  } else {
    throw new Error("Could not find session cookie in login response");
  }
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
          if (req.url.startsWith('/api/audio-proxy')) {
            const urlObj = new URL(req.url, `http://${req.headers.host}`);
            const audioUrl = urlObj.searchParams.get('url');
            const usernameParam = urlObj.searchParams.get('username') || 'SupportEngineer';
            const passwordParam = urlObj.searchParams.get('password') || 'Enginer#321';
            const portalUrlParam = urlObj.searchParams.get('portalUrl') || 'https://aramcoindia.slashrtc.in/index.php/report/dashboardView?1=1';
            
            if (!audioUrl) {
              res.statusCode = 400;
              res.end('Missing url parameter');
              return;
            }

            try {
              // 1. Perform login in background if we don't have cookies yet
              if (!cachedCookie) {
                await performLogin(usernameParam, passwordParam, portalUrlParam);
              }

              // 2. Fetch the audio file using the session cookies
              console.log(`Proxying audio request for: ${audioUrl}`);
              let audioResponse = await fetch(audioUrl, {
                headers: {
                  'Cookie': cachedCookie,
                  'User-Agent': ua
                }
              });

              // Check if session expired or redirect is issued
              const isHtml = (audioResponse.headers.get('content-type') || '').includes('text/html');
              const isRedirect = audioResponse.headers.get('refresh') || audioResponse.status === 302;
              
              if (isHtml || isRedirect) {
                console.log("Session expired or redirected. Re-logging in...");
                await performLogin(usernameParam, passwordParam, portalUrlParam);
                
                // Retry request
                audioResponse = await fetch(audioUrl, {
                  headers: {
                    'Cookie': cachedCookie,
                    'User-Agent': ua
                  }
                });
              }

              // Forward response headers
              res.setHeader('Content-Type', audioResponse.headers.get('Content-Type') || 'audio/x-wav');
              if (audioResponse.headers.get('Content-Length')) {
                res.setHeader('Content-Length', audioResponse.headers.get('Content-Length'));
              }
              res.setHeader('Accept-Ranges', 'bytes');

              // Stream response body back to browser
              if (audioResponse.body) {
                const reader = audioResponse.body.getReader();
                const stream = async () => {
                  while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    res.write(value);
                  }
                  res.end();
                };
                await stream();
              } else {
                res.end();
              }

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

