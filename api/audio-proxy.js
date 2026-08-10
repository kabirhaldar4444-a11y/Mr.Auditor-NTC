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

  // Support node fetch headers
  const setCookies = typeof loginResponse.headers.getSetCookie === 'function'
    ? loginResponse.headers.getSetCookie()
    : loginResponse.headers.get('set-cookie')
      ? [loginResponse.headers.get('set-cookie')]
      : [];
  
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

export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Parse query parameters
  // Vercel serverless requests have query params attached to req.query
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const audioUrl = urlObj.searchParams.get('url') || req.query?.url;
  const usernameParam = urlObj.searchParams.get('username') || req.query?.username || 'SupportEngineer';
  const passwordParam = urlObj.searchParams.get('password') || req.query?.password || 'Enginer#321';
  const portalUrlParam = urlObj.searchParams.get('portalUrl') || req.query?.portalUrl || 'https://aramcoindia.slashrtc.in/index.php/report/dashboardView?1=1';

  if (!audioUrl) {
    res.status(400).send('Missing url parameter');
    return;
  }

  try {
    if (!cachedCookie) {
      await performLogin(usernameParam, passwordParam, portalUrlParam);
    }

    console.log(`Proxying audio request for: ${audioUrl}`);
    let audioResponse = await fetch(audioUrl, {
      headers: {
        'Cookie': cachedCookie,
        'User-Agent': ua
      }
    });

    const isHtml = (audioResponse.headers.get('content-type') || '').includes('text/html');
    const isRedirect = audioResponse.headers.get('refresh') || audioResponse.status === 302;
    
    if (isHtml || isRedirect) {
      console.log("Session expired or redirected. Re-logging in...");
      await performLogin(usernameParam, passwordParam, portalUrlParam);
      
      audioResponse = await fetch(audioUrl, {
        headers: {
          'Cookie': cachedCookie,
          'User-Agent': ua
        }
      });
    }

    // Set headers for response streaming
    res.setHeader('Content-Type', audioResponse.headers.get('Content-Type') || 'audio/x-wav');
    if (audioResponse.headers.get('Content-Length')) {
      res.setHeader('Content-Length', audioResponse.headers.get('Content-Length'));
    }
    res.setHeader('Accept-Ranges', 'bytes');

    // Send the arrayBuffer back
    const buffer = await audioResponse.arrayBuffer();
    res.status(200).send(Buffer.from(buffer));

  } catch (error) {
    console.error("Audio proxy failed:", error);
    res.status(500).send(`Proxy Error: ${error.message}`);
  }
}
