export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }

  const hardcodedKey = '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';
  const apiKey = req.headers['x-api-key'] || process.env.VITE_OPENAI_API_KEY || hardcodedKey;
  const contentType = req.headers['content-type'] || '';

  try {
    // Buffer the raw body (multipart/form-data from browser)
    const chunks = [];
    await new Promise((resolve, reject) => {
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', resolve);
      req.on('error', reject);
    });
    const bodyBuffer = Buffer.concat(chunks);

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': contentType  // forward multipart boundary from browser
      },
      body: bodyBuffer
    });

    const resContentType = whisperRes.headers.get('content-type') || 'application/json';
    const text = await whisperRes.text();
    res.setHeader('Content-Type', resContentType);
    res.status(whisperRes.status).send(text);
  } catch (err) {
    console.error('openai-whisper-proxy error:', err);
    res.status(500).json({ error: { message: err.message } });
  }
}
