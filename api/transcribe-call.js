import crypto from 'crypto';

const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';

// Module-level cookie cache — persists across warm Vercel invocations
let cachedCookie = '';

// RSA-encrypted login — matches what SlashRTC portal actually requires
async function performLogin(username, password, portalUrl) {
  const portalOrigin = new URL(portalUrl).origin;
  const loginPageUrl = `${portalOrigin}/index.php/login`;
  const validateUrl  = `${portalOrigin}/index.php/login/validate`;

  console.log(`[transcribe-call] RSA login for '${username}' at ${portalOrigin}...`);

  // Step 1: GET /login to obtain initial session cookie + RSA public key
  const initialRes = await fetch(loginPageUrl, { headers: { 'User-Agent': ua } });
  const html = await initialRes.text();

  const initialSetCookies = typeof initialRes.headers.getSetCookie === 'function'
    ? initialRes.headers.getSetCookie()
    : (initialRes.headers.get('set-cookie') ? [initialRes.headers.get('set-cookie')] : []);

  const ciCookieStr = initialSetCookies.find(c => c && c.includes('ci_session2='));
  const initialCookieHeader = ciCookieStr ? ciCookieStr.split(';')[0] : '';

  // Extract RSA public key and encrypt password
  const match = html.match(/-----BEGIN PUBLIC KEY-----[\s\S]*?-----END PUBLIC KEY-----/);
  let finalPassword = password;
  if (match) {
    const encryptedBuf = crypto.publicEncrypt(
      { key: match[0], padding: crypto.constants.RSA_PKCS1_PADDING },
      Buffer.from(password, 'utf8')
    );
    finalPassword = encryptedBuf.toString('base64');
    console.log('[transcribe-call] Password RSA-encrypted successfully.');
  } else {
    console.warn('[transcribe-call] RSA public key not found on login page — sending plain password.');
  }

  // Step 2: POST encrypted credentials
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
  if (
    loginText.includes('alerterror') ||
    loginText.includes('Incorrect') ||
    loginText.includes('Username or Password')
  ) {
    cachedCookie = '';
    throw new Error('SlashRTC login failed: Incorrect username or password.');
  }

  const authSetCookies = typeof loginResponse.headers.getSetCookie === 'function'
    ? loginResponse.headers.getSetCookie()
    : (loginResponse.headers.get('set-cookie') ? [loginResponse.headers.get('set-cookie')] : []);

  const validCookies = authSetCookies.filter(c => c && c.includes('ci_session2=') && !c.includes('expires='));
  const finalCookieHeader = validCookies.length > 0
    ? validCookies[validCookies.length - 1].split(';')[0]
    : initialCookieHeader;

  if (finalCookieHeader) {
    cachedCookie = finalCookieHeader;
    console.log('[transcribe-call] SlashRTC session established.');
    return cachedCookie;
  }

  throw new Error('Could not obtain session cookie from SlashRTC login.');
}

async function fetchAudioWithCookie(audioUrl, cookieHeader, portalUrl) {
  const portalOrigin = new URL(portalUrl).origin;
  return fetch(audioUrl, {
    headers: {
      'Cookie': cookieHeader,
      'User-Agent': ua,
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': `${portalOrigin}/index.php/site/viewcampaign`
    }
  });
}

function formatSecondsToMMSS(seconds) {
  if (seconds === null || seconds === undefined || isNaN(seconds)) return 'Unavailable';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') {
    res.status(405).json({ status: 'TRANSCRIPTION_FAILED', error: 'Method Not Allowed' });
    return;
  }

  const clientKey = (req.headers['x-api-key'] || '').trim();
  const apiKey = (clientKey && clientKey.startsWith('sk-'))
    ? clientKey
    : (process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || '');

  if (!apiKey) {
    res.status(500).json({ status: 'TRANSCRIPTION_FAILED', error: 'Server-side OPENAI_API_KEY is not configured.' });
    return;
  }

  // Parse request body
  let bodyData = {};
  try {
    if (typeof req.body === 'string') {
      bodyData = JSON.parse(req.body);
    } else if (req.body && typeof req.body === 'object') {
      bodyData = req.body;
    } else {
      // Stream fallback
      const chunks = [];
      for await (const chunk of req) { chunks.push(chunk); }
      const raw = Buffer.concat(chunks).toString('utf-8');
      try { bodyData = JSON.parse(raw); } catch (_) {}
    }
  } catch (_) {}

  const audioUrl     = bodyData.audioUrl || bodyData.url || '';
  const username     = bodyData.username || 'SupportEngineer';
  const password     = bodyData.password || 'Enginer#321';
  const portalUrl    = bodyData.portalUrl || 'https://aramcoindia.slashrtc.in/index.php/site/viewcampaign';
  const sessionCookie = bodyData.sessionCookie || '';

  if (!audioUrl) {
    res.status(400).json({ status: 'TRANSCRIPTION_FAILED', error: 'Missing required audioUrl parameter.' });
    return;
  }

  // Accept a pre-existing session cookie from the browser (overrides cached)
  if (sessionCookie && sessionCookie.trim()) {
    const trimmed = sessionCookie.trim();
    cachedCookie = trimmed.includes('=') ? trimmed : `ci_session2=${trimmed}`;
    console.log('[transcribe-call] Using session cookie from client.');
  }

  try {
    let audioResponse = null;

    // ── Fetch audio from SlashRTC ─────────────────────────────────────────────
    if (audioUrl.includes('slashrtc.in') || portalUrl) {

      // Try with cached cookie first
      if (cachedCookie) {
        console.log(`[transcribe-call] Attempting audio fetch with cached/client cookie...`);
        audioResponse = await fetchAudioWithCookie(audioUrl, cachedCookie, portalUrl);
        const ct = (audioResponse.headers.get('content-type') || '').toLowerCase();
        if (ct.includes('text/html') || !audioResponse.ok) {
          console.log('[transcribe-call] Cached cookie stale — re-logging in via RSA...');
          cachedCookie = '';
          audioResponse = null;
        }
      }

      // Login if no valid cookie
      if (!cachedCookie) {
        try {
          await performLogin(username, password, portalUrl);
        } catch (loginErr) {
          console.warn(`[transcribe-call] Login failed: ${loginErr.message}`);
          res.status(401).json({
            status: 'TRANSCRIPTION_FAILED',
            error: `SlashRTC login failed: ${loginErr.message}`
          });
          return;
        }
      }

      if (!audioResponse) {
        console.log(`[transcribe-call] Fetching audio: ${audioUrl}`);
        audioResponse = await fetchAudioWithCookie(audioUrl, cachedCookie, portalUrl);
      }

      // One re-login attempt if session expired mid-flight
      const ct2 = (audioResponse.headers.get('content-type') || '').toLowerCase();
      if (ct2.includes('text/html') || !audioResponse.ok) {
        console.log('[transcribe-call] Session expired mid-flight. Re-authenticating...');
        cachedCookie = '';
        try {
          await performLogin(username, password, portalUrl);
          audioResponse = await fetchAudioWithCookie(audioUrl, cachedCookie, portalUrl);
        } catch (reErr) {
          res.status(401).json({ status: 'TRANSCRIPTION_FAILED', error: `Re-login failed: ${reErr.message}` });
          return;
        }
      }

    } else {
      audioResponse = await fetch(audioUrl);
    }

    if (!audioResponse || !audioResponse.ok) {
      res.status(400).json({
        status: 'TRANSCRIPTION_FAILED',
        error: `Failed to download audio (HTTP ${audioResponse ? audioResponse.status : 'No Response'}).`
      });
      return;
    }

    const arrayBuffer = await audioResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate downloaded bytes
    if (!buffer || buffer.length < 1000) {
      res.status(400).json({
        status: 'TRANSCRIPTION_FAILED',
        error: 'Downloaded audio is empty or corrupted (< 1 KB). SlashRTC session may have expired.'
      });
      return;
    }

    // Detect if it's an HTML login redirect instead of audio
    if (buffer[0] === 0x3C) {
      cachedCookie = '';
      res.status(400).json({
        status: 'TRANSCRIPTION_FAILED',
        error: 'SlashRTC returned an HTML login page instead of audio. Credentials may be wrong.'
      });
      return;
    }

    // Detect audio format from magic bytes
    let ext = 'wav', mime = 'audio/wav';
    if (buffer[0]===0x52&&buffer[1]===0x49&&buffer[2]===0x46&&buffer[3]===0x46) { ext='wav'; mime='audio/wav'; }
    else if (buffer[0]===0x49&&buffer[1]===0x44&&buffer[2]===0x33)               { ext='mp3'; mime='audio/mpeg'; }
    else if (buffer[0]===0xFF&&(buffer[1]&0xE0)===0xE0)                          { ext='mp3'; mime='audio/mpeg'; }
    else if (buffer[0]===0x4F&&buffer[1]===0x67&&buffer[2]===0x67&&buffer[3]===0x53) { ext='ogg'; mime='audio/ogg'; }
    else if (buffer[4]===0x66&&buffer[5]===0x74&&buffer[6]===0x79&&buffer[7]===0x70) { ext='mp4'; mime='audio/mp4'; }
    else if (buffer[0]===0x1A&&buffer[1]===0x45&&buffer[2]===0xDF&&buffer[3]===0xA3) { ext='webm'; mime='audio/webm'; }

    console.log(`[transcribe-call] Audio: ${ext.toUpperCase()}, ${buffer.length} bytes → sending to OpenAI Whisper...`);

    // ── Build multipart payload manually (reliable across all Node runtimes) ──
    const boundary = `----WhisperBoundary${Date.now()}`;
    const CRLF = '\r\n';

    const textPart = (name, value) =>
      `--${boundary}${CRLF}Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}${value}${CRLF}`;

    const defaultPrompt = "This is an Indian telecalling screening conversation in Hindi, Hinglish, and English. The agent and candidate discuss job opportunities, candidate qualifications, interview process, salary, and company details. Common words: Hello, Haanji, Namaste, Sir, Madam, Interview, Call record, NTC, Details, Selection, Resume, Company, Location.";
    const whisperPrompt = bodyData.prompt || defaultPrompt;

    const textFields = [
      textPart('model', 'whisper-1'),
      textPart('response_format', 'verbose_json'),
      textPart('timestamp_granularities[]', 'segment'),
      textPart('prompt', whisperPrompt),
    ];

    if (bodyData.language && bodyData.language !== 'auto') {
      textFields.push(textPart('language', bodyData.language));
    }

    const textBuffer = Buffer.from(textFields.join(''), 'utf-8');
    const fileHeader = Buffer.from(
      `--${boundary}${CRLF}Content-Disposition: form-data; name="file"; filename="recording.${ext}"${CRLF}Content-Type: ${mime}${CRLF}${CRLF}`,
      'utf-8'
    );
    const fileFooter   = Buffer.from(`${CRLF}--${boundary}--${CRLF}`, 'utf-8');
    const payloadBuffer = Buffer.concat([textBuffer, fileHeader, buffer, fileFooter]);

    console.log(`[transcribe-call] Whisper payload: ${payloadBuffer.length} bytes with prompt biasing`);

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: payloadBuffer,
    });

    if (!whisperRes.ok) {
      const errText = await whisperRes.text();
      let errMsg = `OpenAI STT API Error (${whisperRes.status})`;
      try { errMsg = JSON.parse(errText).error?.message || errMsg; } catch (_) {}
      console.error(`[transcribe-call] Whisper error: ${errMsg}`);
      res.status(whisperRes.status).json({ status: 'TRANSCRIPTION_FAILED', error: errMsg });
      return;
    }

    const rawOpenAiResponse = await whisperRes.json();
    const fullText = (rawOpenAiResponse.text || '').trim();
    const detectedLanguage = rawOpenAiResponse.language || 'unknown';

    console.log(`[transcribe-call] Done. Language: ${detectedLanguage}. Chars: ${fullText.length}`);

    if (!fullText) {
      res.status(200).json({
        status: 'COMPLETED',
        rawOpenAiResponse,
        transcript: null,
        message: 'Audio contained no transcribable speech.'
      });
      return;
    }

    // Normalize segments + deduplicate hallucinated repetitions
    const rawSegments = rawOpenAiResponse.segments || [];
    let normalizedTranscript = [];

    if (rawSegments.length > 0) {
      const mapped = rawSegments.map(s => ({
        speaker: (s.speaker && s.speaker.trim()) ? s.speaker.trim() : 'Unknown',
        start:   typeof s.start === 'number' && !isNaN(s.start) ? s.start : null,
        end:     typeof s.end   === 'number' && !isNaN(s.end)   ? s.end   : null,
        time:    typeof s.start === 'number' && !isNaN(s.start) ? formatSecondsToMMSS(s.start) : 'Unavailable',
        text:    (s.text || '').trim()
      }));

      normalizedTranscript = mapped.filter((s, idx) => {
        if (!s.text) return false;
        if (idx === 0) return true;
        return s.text.toLowerCase() !== mapped[idx - 1].text.toLowerCase();
      });
    } else {
      normalizedTranscript = [{ speaker: 'Unknown', start: 0, end: null, time: '00:00', text: fullText }];
    }

    res.status(200).json({
      status: 'COMPLETED',
      modelUsed: 'whisper-1',
      detectedLanguage,
      transcriptionTimestamp: new Date().toISOString(),
      rawOpenAiResponse,
      transcript: normalizedTranscript
    });

  } catch (err) {
    console.error('[transcribe-call] Exception:', err.message);
    res.status(500).json({
      status: 'TRANSCRIPTION_FAILED',
      error: `Transcription exception: ${err.message}`
    });
  }
}
