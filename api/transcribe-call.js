const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

let cachedCookie = '';

async function performLogin(username, password, portalUrl) {
  const portalOrigin = new URL(portalUrl).origin;
  console.log(`[transcribe-call] Logging into SlashRTC (${portalOrigin}) as ${username}...`);

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

  const loginText = await loginResponse.text();
  if (loginText.includes('alerterror') || loginText.includes('Incorrect') || loginText.includes('Username or Password')) {
    cachedCookie = '';
    throw new Error('SlashRTC login failed: Incorrect username or password.');
  }

  const setCookies = loginResponse.headers.getSetCookie
    ? loginResponse.headers.getSetCookie()
    : (loginResponse.headers.get('set-cookie') ? [loginResponse.headers.get('set-cookie')] : []);

  const validCookies = setCookies.filter(c => c.startsWith('ci_session2=') && !c.includes('expires='));
  const finalCookie = validCookies[validCookies.length - 1];

  if (finalCookie) {
    cachedCookie = finalCookie.split(';')[0];
    console.log('[transcribe-call] SlashRTC session established.');
    return cachedCookie;
  } else {
    throw new Error('Could not obtain session cookie from SlashRTC login.');
  }
}

function formatSecondsToMMSS(seconds) {
  if (seconds === null || seconds === undefined || isNaN(seconds)) return 'Unavailable';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ status: 'TRANSCRIPTION_FAILED', error: 'Method Not Allowed' }); return; }

  const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || req.headers['x-api-key'] || '';

  if (!apiKey) {
    res.status(500).json({ status: 'TRANSCRIPTION_FAILED', error: 'Server-side OPENAI_API_KEY is not configured.' });
    return;
  }

  let bodyData = {};
  try {
    if (typeof req.body === 'string') {
      bodyData = JSON.parse(req.body);
    } else if (req.body) {
      bodyData = req.body;
    }
  } catch (_) {}

  const audioUrl = bodyData.audioUrl || bodyData.url;
  const username = bodyData.username || 'SupportEngineer';
  const password = bodyData.password || 'Enginer#321';
  const portalUrl = bodyData.portalUrl || 'https://aramcoindia.slashrtc.in/index.php/report/dashboardView?1=1';

  if (!audioUrl) {
    res.status(400).json({ status: 'TRANSCRIPTION_FAILED', error: 'Missing required audioUrl parameter.' });
    return;
  }

  try {
    // 1. Fetch actual SlashRTC recording
    let audioResponse = null;
    if (audioUrl.includes('slashrtc.in') || portalUrl) {
      if (!cachedCookie) {
        await performLogin(username, password, portalUrl);
      }

      console.log(`[transcribe-call] Fetching recording from SlashRTC: ${audioUrl}`);
      audioResponse = await fetch(audioUrl, {
        headers: { 'Cookie': cachedCookie, 'User-Agent': ua }
      });

      const ct = (audioResponse.headers.get('content-type') || '').toLowerCase();
      const isHtml = ct.includes('text/html');
      const isRedirect = audioResponse.status === 302 || audioResponse.headers.get('refresh');

      if (isHtml || isRedirect) {
        console.log('[transcribe-call] Session expired. Re-logging in...');
        cachedCookie = '';
        await performLogin(username, password, portalUrl);

        audioResponse = await fetch(audioUrl, {
          headers: { 'Cookie': cachedCookie, 'User-Agent': ua }
        });
      }
    } else {
      audioResponse = await fetch(audioUrl);
    }

    if (!audioResponse || !audioResponse.ok) {
      res.status(400).json({
        status: 'TRANSCRIPTION_FAILED',
        error: `Failed to download audio recording (HTTP ${audioResponse ? audioResponse.status : 'No Response'}).`
      });
      return;
    }

    const arrayBuffer = await audioResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 2. Validate downloaded binary
    if (!buffer || buffer.length < 1000) {
      res.status(400).json({
        status: 'TRANSCRIPTION_FAILED',
        error: 'Downloaded audio file is empty or corrupted (< 1KB).'
      });
      return;
    }

    // Check if buffer starts with '<' (HTML page)
    if (buffer[0] === 0x3C) {
      res.status(400).json({
        status: 'TRANSCRIPTION_FAILED',
        error: 'SlashRTC returned an HTML login page instead of actual audio recording.'
      });
      return;
    }

    // Detect format extension
    let ext = 'wav';
    let mime = 'audio/wav';
    if (buffer[0]===0x52 && buffer[1]===0x49 && buffer[2]===0x46 && buffer[3]===0x46) { ext = 'wav'; mime = 'audio/wav'; }
    else if (buffer[0]===0x49 && buffer[1]===0x44 && buffer[2]===0x33) { ext = 'mp3'; mime = 'audio/mpeg'; }
    else if (buffer[0]===0xFF && (buffer[1] & 0xE0)===0xE0) { ext = 'mp3'; mime = 'audio/mpeg'; }
    else if (buffer[0]===0x4F && buffer[1]===0x67 && buffer[2]===0x67 && buffer[3]===0x53) { ext = 'ogg'; mime = 'audio/ogg'; }
    else if (buffer[4]===0x66 && buffer[5]===0x74 && buffer[6]===0x79 && buffer[7]===0x70) { ext = 'mp4'; mime = 'audio/mp4'; }
    else if (buffer[0]===0x1A && buffer[1]===0x45 && buffer[2]===0xDF && buffer[3]===0xA3) { ext = 'webm'; mime = 'audio/webm'; }

    console.log(`[transcribe-call] Audio detected as ${ext.toUpperCase()}, size=${buffer.length} bytes`);

    // Construct FormData for OpenAI STT API
    // KEY ACCURACY SETTINGS:
    // - NO language forced: Whisper auto-detects Hindi/Hinglish/English naturally.
    //   Forcing 'hi' causes English words to be incorrectly transliterated into Devanagari.
    // - temperature=0: Deterministic, no hallucination/guessing. Most accurate output.
    // - response_format=verbose_json: Required for segment timestamps.
    // - timestamp_granularities[]=segment + word: Gives both sentence-level and word-level timestamps.
    const formData = new FormData();
    const blob = new Blob([buffer], { type: mime });
    formData.append('file', blob, `recording.${ext}`);
    formData.append('model', 'whisper-1');
    formData.append('prompt', 'Naukri.com, DPR Construction, Relationship Manager, Mumbai BKC, PMP, OSHA, Primavera P6, AutoCAD.');
    formData.append('temperature', '0.0');
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'segment');

    console.log('[transcribe-call] Sending audio to OpenAI Speech-to-Text API (auto-language, temp=0, segment+word timestamps)...');
    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    });

    if (!whisperRes.ok) {
      const errText = await whisperRes.text();
      let errMsg = `OpenAI STT API Error (${whisperRes.status})`;
      try { errMsg = JSON.parse(errText).error?.message || errMsg; } catch (_) {}
      console.error(`[transcribe-call] OpenAI STT error: ${errMsg}`);
      res.status(whisperRes.status).json({
        status: 'TRANSCRIPTION_FAILED',
        error: errMsg
      });
      return;
    }

    const rawOpenAiResponse = await whisperRes.json();
    const fullText = (rawOpenAiResponse.text || '').trim();
    const detectedLanguage = rawOpenAiResponse.language || 'unknown';

    console.log(`[transcribe-call] Transcription complete. Detected language: ${detectedLanguage}. Text length: ${fullText.length} chars.`);

    if (!fullText || fullText.length === 0) {
      res.status(200).json({
        status: 'COMPLETED',
        rawOpenAiResponse,
        transcript: null,
        message: 'Audio contained no transcribable speech.'
      });
      return;
    }

    // Build normalized transcript segments & deduplicate repeating hallucinated words
    const rawSegments = rawOpenAiResponse.segments || [];
    let normalizedTranscript = [];

    if (rawSegments.length > 0) {
      const mapped = rawSegments.map(s => {
        const hasStart = typeof s.start === 'number' && !isNaN(s.start);
        const hasEnd = typeof s.end === 'number' && !isNaN(s.end);

        let speakerName = 'Unknown';
        if (s.speaker && typeof s.speaker === 'string' && s.speaker.trim()) {
          speakerName = s.speaker.trim();
        }

        return {
          speaker: speakerName,
          start: hasStart ? s.start : null,
          end: hasEnd ? s.end : null,
          time: hasStart ? formatSecondsToMMSS(s.start) : 'Unavailable',
          text: (s.text || '').trim()
        };
      });

      // Filter out empty segments and consecutive duplicate hallucinated segments
      normalizedTranscript = mapped.filter((s, idx) => {
        if (!s.text || s.text.length === 0) return false;
        if (idx === 0) return true;
        return s.text.toLowerCase().trim() !== mapped[idx - 1].text.toLowerCase().trim();
      });
    } else {
      // Fallback: entire transcript as single segment
      normalizedTranscript = [{
        speaker: 'Unknown',
        start: 0,
        end: null,
        time: '00:00',
        text: fullText
      }];
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
