export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }

  const apiKey = req.headers['x-api-key'] || process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';

  try {
    // Accept base64-encoded audio JSON from frontend (avoids Vercel multipart handling issues)
    const { audio, filename, mimeType } = req.body;

    if (!audio || !filename || !mimeType) {
      res.status(400).json({ error: { message: 'Missing audio, filename, or mimeType in request body.' } });
      return;
    }

    // Decode base64 audio to binary buffer
    const audioBuffer = Buffer.from(audio, 'base64');

    // Build multipart/form-data manually (avoids needing form-data npm package)
    const boundary = `----WhisperBoundary${Date.now()}`;
    const CRLF = '\r\n';

    // Helper to build a multipart part for a text field
    const textPart = (name, value) =>
      `--${boundary}${CRLF}Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}${value}${CRLF}`;

    const textFields = [
      textPart('model', 'whisper-1'),
      textPart('response_format', 'verbose_json'),
      textPart('timestamp_granularities[]', 'segment'),
    ];

    const textBuffer = Buffer.from(textFields.join(''), 'utf-8');

    // File part header
    const fileHeader = Buffer.from(
      `--${boundary}${CRLF}Content-Disposition: form-data; name="file"; filename="${filename}"${CRLF}Content-Type: ${mimeType}${CRLF}${CRLF}`,
      'utf-8'
    );
    const fileFooter = Buffer.from(`${CRLF}--${boundary}--${CRLF}`, 'utf-8');

    // Concatenate all parts
    const body = Buffer.concat([textBuffer, fileHeader, audioBuffer, fileFooter]);

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length.toString(),
      },
      body,
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
