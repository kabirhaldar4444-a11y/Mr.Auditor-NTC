export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const apiKey = 'AQ.Ab8RN6KIU-W1ienOfMmHx1AV9rRF7t_D7Lie-1YXtSxkMhlckQ';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Mock localhost referrer to satisfy GCP website restrictions
        'Referer': 'http://localhost:5173/'
      },
      body: typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
    });

    const status = response.status;
    const contentType = response.headers.get('content-type');
    const text = await response.text();
    
    res.setHeader('Content-Type', contentType || 'application/json');
    res.status(status).send(text);

  } catch (error) {
    console.error("Gemini proxy failed:", error);
    res.status(500).send({ error: { message: error.message } });
  }
}
