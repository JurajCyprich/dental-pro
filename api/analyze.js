export const config = { runtime: 'edge' };

export default async function handler(req) {
  // Only allow POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Basic origin check (optional extra security)
  const origin = req.headers.get('origin') || '';
  
  try {
    const body = await req.json();
    
    // Validate that we got image data
    if (!body.imageBase64) {
      return new Response(JSON.stringify({ error: 'No image provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Call Anthropic API server-side — key never exposed to client
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 700,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: body.imageBase64
              }
            },
            {
              type: 'text',
              text: `Si zubný AI asistent. Pozri sa na túto fotku puse/zubov po čistení a vyhodnoť ju.

Odpovedz VÝHRADNE v JSON formáte bez akéhokoľvek textu navyše, takto:
{
  "score": <číslo 1-10, kde 10 = perfektne čisté>,
  "verdict": "<krátky verdikt 3-5 slov, napr. 'Výborne vyčistené!' alebo 'Potrebuje viac práce'>",
  "summary": "<1-2 vety celkové zhodnotenie>",
  "positives": "<čo vyzerá dobre, 1-2 vety>",
  "improvements": "<čo treba zlepšiť, 1-2 vety, ak je všetko OK napíš 'Pokračuj takto!'>",
  "tip": "<konkrétna rada do budúcna, 1 veta>",
  "tags": ["<tag1>","<tag2>","<tag3>"]
}

Ak fotka neobsahuje zuby alebo pusu, vráť score:0 a verdict:"Nie sú vidieť zuby".
Buď konkrétny, priateľský a motivujúci. Odpovedaj po slovensky.`
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return new Response(JSON.stringify({ error: 'AI chyba: ' + err }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    
    let result;
    try { result = JSON.parse(clean); }
    catch(e) { return new Response(JSON.stringify({ error: 'Neplatná odpoveď AI' }), { status: 500, headers: { 'Content-Type': 'application/json' } }); }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Neznáma chyba' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
