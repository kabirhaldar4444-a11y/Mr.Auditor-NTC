export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: { message: 'Method Not Allowed' } }); return; }

  const clientKey = (req.headers['x-api-key'] || '').trim();
  const apiKey = (clientKey && clientKey.startsWith('sk-'))
    ? clientKey
    : (process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || '');

  if (!apiKey) {
    res.status(400).json({ error: { message: 'OpenAI API key is missing. Please provide x-api-key header or set OPENAI_API_KEY in Vercel environment variables.' } });
    return;
  }

  try {
    // 1. Safely extract body across all Vercel Node runtime environments
    let bodyData = req.body;
    if (typeof bodyData === 'string') {
      try { bodyData = JSON.parse(bodyData); } catch (_) {}
    } else if (Buffer.isBuffer(bodyData)) {
      try { bodyData = JSON.parse(bodyData.toString('utf-8')); } catch (_) {}
    }

    if (!bodyData || typeof bodyData !== 'object') {
      try {
        const chunks = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        const raw = Buffer.concat(chunks).toString('utf-8');
        bodyData = JSON.parse(raw);
      } catch (_) {}
    }

    if (!bodyData || typeof bodyData !== 'object') {
      res.status(400).json({ error: { message: 'Invalid or empty JSON body received by server.' } });
      return;
    }

    const { audio, filename, mimeType, language, prompt } = bodyData;

    if (!audio || !filename || !mimeType) {
      res.status(400).json({ error: { message: 'Missing audio (base64), filename, or mimeType in request body.' } });
      return;
    }

    // 2. Decode base64 audio string to Node Buffer
    const audioBuffer = Buffer.from(audio, 'base64');

    // 3. Use global Blob and FormData (supported in Node 18+ without needing File constructor)
    const audioBlob = new Blob([audioBuffer], { type: mimeType || 'audio/mpeg' });
    const defaultPrompt = "This is an Indian telecalling screening conversation in Hindi, Hinglish, and English. The agent and candidate discuss job opportunities, candidate qualifications, interview process, salary, and company details. Common words: Hello, Haanji, Namaste, Sir, Madam, Interview, Call record, NTC, Details, Selection, Resume, Company, Location.";

    const formData = new FormData();
    formData.append('file', audioBlob, filename || 'recording.mp3');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'segment');
    formData.append('prompt', prompt || defaultPrompt);
    if (language && language !== 'auto') {
      formData.append('language', language);
    }

    console.log(`[openai-whisper-proxy] Forwarding ${audioBuffer.length} bytes to OpenAI Whisper API...`);

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    });

    const resContentType = whisperRes.headers.get('content-type') || 'application/json';
    const responseText = await whisperRes.text();

    res.setHeader('Content-Type', resContentType);
    res.status(whisperRes.status).send(responseText);

  } catch (err) {
    console.error('openai-whisper-proxy error:', err);
    res.status(500).json({ error: { message: err.message || 'Internal Proxy Exception', details: String(err) } });
  }
}
