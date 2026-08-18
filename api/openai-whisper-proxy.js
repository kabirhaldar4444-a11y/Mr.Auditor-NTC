export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }

  const apiKey = req.headers['x-api-key'] || process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';

  if (!apiKey) {
    res.status(400).json({ error: { message: 'OpenAI API key is missing.' } });
    return;
  }

  try {
    // Robustly parse JSON body across all Vercel Node runtime representations (Object, String, Buffer, or Stream)
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
      res.status(400).json({ error: { message: 'Invalid or empty JSON body received.' } });
      return;
    }

    const { audio, filename, mimeType } = bodyData;

    if (!audio || !filename || !mimeType) {
      res.status(400).json({ error: { message: 'Missing audio, filename, or mimeType in request body.' } });
      return;
    }

    // Decode base64 audio to binary buffer
    const audioBuffer = Buffer.from(audio, 'base64');

    // Build multipart/form-data manually
    const boundary = `----WhisperBoundary${Date.now()}`;
    const CRLF = '\r\n';

    const textPart = (name, value) =>
      `--${boundary}${CRLF}Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}${value}${CRLF}`;

    const textFields = [
      textPart('model', 'whisper-1'),
      textPart('response_format', 'verbose_json'),
      textPart('timestamp_granularities[]', 'segment'),
    ];

    const textBuffer = Buffer.from(textFields.join(''), 'utf-8');
    const fileHeader = Buffer.from(
      `--${boundary}${CRLF}Content-Disposition: form-data; name="file"; filename="${filename || 'recording.mp3'}"${CRLF}Content-Type: ${mimeType || 'audio/mpeg'}${CRLF}${CRLF}`,
      'utf-8'
    );
    const fileFooter = Buffer.from(`${CRLF}--${boundary}--${CRLF}`, 'utf-8');

    const payloadBuffer = Buffer.concat([textBuffer, fileHeader, audioBuffer, fileFooter]);

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: payloadBuffer,
    });

    const resContentType = whisperRes.headers.get('content-type') || 'application/json';
    const text = await whisperRes.text();
    res.setHeader('Content-Type', resContentType);
    res.status(whisperRes.status).send(text);

  } catch (err) {
    console.error('openai-whisper-proxy error:', err);
    res.status(500).json({ error: { message: err.message || String(err) } });
  }
}
