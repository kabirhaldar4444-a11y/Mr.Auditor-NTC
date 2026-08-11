export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }

  const apiKey = req.headers['x-api-key'] || process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    const contentType = openaiRes.headers.get('content-type') || 'application/json';
    const text = await openaiRes.text();
    res.setHeader('Content-Type', contentType);
    res.status(openaiRes.status).send(text);
  } catch (err) {
    console.error('openai-proxy error:', err);
    res.status(500).json({ error: { message: err.message } });
  }
}
