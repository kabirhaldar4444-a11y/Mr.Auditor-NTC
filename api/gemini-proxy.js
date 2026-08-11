export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const apiKey = req.headers['x-api-key'] || process.env.VITE_OPENAI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    if (apiKey.startsWith('sk-')) {
      // OpenAI ChatGPT API Handler
      let promptText = '';
      let audioBase64 = null;
      let audioFormat = 'wav';

      const parts = body?.contents?.[0]?.parts || [];
      for (const part of parts) {
        if (part.text) {
          promptText += part.text + '\n';
        }
        if (part.inlineData) {
          audioBase64 = part.inlineData.data;
          if (part.inlineData.mimeType?.includes('mp3')) audioFormat = 'mp3';
        }
      }

      let openAiPayload;
      if (audioBase64) {
        openAiPayload = {
          model: 'gpt-4o-audio-preview',
          modalities: ['text'],
          audio: { format: audioFormat, voice: 'alloy' },
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: promptText + '\n\nIMPORTANT: Return ONLY raw valid JSON matching the requested schema.' },
                { type: 'input_audio', input_audio: { data: audioBase64, format: audioFormat } }
              ]
            }
          ]
        };
      } else {
        openAiPayload = {
          model: 'gpt-4o',
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'user',
              content: promptText + '\n\nIMPORTANT: Return ONLY raw valid JSON matching the requested schema.'
            }
          ]
        };
      }

      const openAiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(openAiPayload)
      });

      if (!openAiRes.ok) {
        const errText = await openAiRes.text();
        if (audioBase64) {
          console.warn("OpenAI Audio call failed, attempting text fallback:", errText);
          const fallbackPayload = {
            model: 'gpt-4o',
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'user',
                content: promptText
              }
            ]
          };
          const fbRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(fallbackPayload)
          });
          if (fbRes.ok) {
            const fbData = await fbRes.json();
            const fbText = fbData.choices?.[0]?.message?.content || '{}';
            return res.status(200).json({
              candidates: [{ content: { parts: [{ text: fbText }] } }]
            });
          }
        }
        res.setHeader('Content-Type', 'application/json');
        return res.status(openAiRes.status).send(errText);
      }

      const openAiData = await openAiRes.json();
      const openAiText = openAiData.choices?.[0]?.message?.content || '{}';

      return res.status(200).json({
        candidates: [
          {
            content: {
              parts: [{ text: openAiText }]
            }
          }
        ]
      });
    } else {
      // Google Gemini API Handler
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Referer': 'http://localhost:5173/'
        },
        body: JSON.stringify(body)
      });

      const status = response.status;
      const contentType = response.headers.get('content-type');
      const text = await response.text();
      
      res.setHeader('Content-Type', contentType || 'application/json');
      res.status(status).send(text);
    }
  } catch (error) {
    console.error("AI proxy failed:", error);
    res.status(500).send({ error: { message: error.message } });
  }
}

