export const config = { api: { bodyParser: true } }

// =========================================================================
// TIKTOK EVENTS API (SERVER-SIDE TRACKING)
// =========================================================================
async function sendTikTokTrackingEvent(body, req) {
  const PIXEL_CODE = 'D7SPA7RC77U471PH6490';
  const ACCESS_TOKEN = '646c7e475de6485bb16457367498ca1427f0c7ed';

  // Mapeia o status do seu sistema para os Eventos Padrão do TikTok
  let eventName = '';
  if (body.status === 'waiting_payment') {
    eventName = 'InitiateCheckout'; // Cliente gerou o MB Way
  } else if (body.status === 'paid') {
    eventName = 'CompletePayment'; // Cliente pagou
  } else {
    eventName = 'ClickButton'; // Fallback para outros status
  }

  const amount = parseFloat(body.amount) || 12.97;
  const eventId = body.transaction_id || `trk-${Date.now()}`;
  
  // Captura de IP e User-Agent para melhorar a qualidade da correspondência do TikTok
  const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
  const userAgent = req.headers['user-agent'] || '';

  // Captura do link atual com as UTMs
  const pageUrl = req.headers.referer || 'https://acessoantecipadooficial.vercel.app/checkout.html';

  const payload = {
    pixel_code: PIXEL_CODE,
    data: [
      {
        event: eventName,
        event_id: eventId, // ID para Deduplicação
        event_time: Math.floor(Date.now() / 1000),
        context: {
          ip: clientIp,
          user_agent: userAgent,
          page: {
            url: pageUrl
          }
        },
        properties: {
          contents: [{
            content_name: body.product_name || 'TikTok - Front Checkout',
            content_id: body.product_id || 'front-checkout',
            quantity: 1,
            price: amount
          }],
          value: amount,
          currency: 'EUR'
        }
      }
    ]
  };

  try {
    const res = await fetch('https://business-api.tiktok.com/open_api/v1.3/pixel/track/', {
      method: 'POST',
      headers: {
        'Access-Token': ACCESS_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const ttResponse = await res.json();
    console.log(`[TikTok Tracking] Evento ${eventName} enviado:`, ttResponse.message);
  } catch (error) {
    console.error(`[TikTok Tracking] Erro ao enviar evento ${eventName}:`, error);
  }
}
// =========================================================================

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Parse body robusto para a Vercel
  let body = req.body
  if (!body || typeof body === 'string') {
    try {
      body = JSON.parse(body || '{}')
    } catch {
      body = await new Promise((resolve) => {
        let raw = ''
        req.on('data', chunk => { raw += chunk.toString() })
        req.on('end', () => {
          try { resolve(JSON.parse(raw)) } catch { resolve({}) }
        })
        req.on('error', () => resolve({}))
      })
    }
  }
  if (!body || typeof body !== 'object') body = {}

  try { 
    console.log('[tracking recebido]', JSON.stringify(body));
    
    // Dispara para o TikTok de forma assíncrona para não atrasar a resposta do frontend
    sendTikTokTrackingEvent(body, req).catch(err => console.error(err));

  } catch (e) {
    console.error('[tracking erro]', e);
  }

  return res.status(200).json({ ok: true })
}
