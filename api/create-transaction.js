export const config = { api: { bodyParser: true } }

// Gera um email único por pagador — WayMB exige email mas o formulário não o pede
function generatePayerEmail(name, phone) {
  // Normaliza nome: remove espaços/acentos, lowercase
  var namePart = (name || 'cliente')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // remove acentos
    .replace(/[^a-z0-9]/g, '')                            // só letras/números
    .slice(0, 20) || 'cliente'

  // Últimos 4 dígitos do telefone
  var phonePart = (phone || '').replace(/\D/g, '').slice(-4) || '0000'

  // Hash curto baseado em nome+telefone+data para ser único mas estável por pessoa
  var seed = namePart + phonePart
  var hash = 0
  for (var i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i)
    hash = hash & hash // converte para int32
  }
  var hashStr = Math.abs(hash).toString(36).slice(0, 6)

  return namePart + phonePart + hashStr + '@pagador.pt'
}

// =========================================================================
// TIKTOK EVENTS API (SERVER-SIDE TRACKING)
// =========================================================================
async function sendTikTokServerEvent(transactionData, req, id) {
  const PIXEL_CODE = 'D7SPA7RC77U471PH6490';
  const ACCESS_TOKEN = '646c7e475de6485bb16457367498ca1427f0c7ed';

  // Usa o valor retornado pela WayMB, ou fallback para o valor padrão
  const amount = transactionData.amount || 12.97; 
  const currency = transactionData.currency || 'EUR';
  
  // Pegar IP e User Agent para melhorar a correspondência do TikTok
  const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
  const userAgent = req.headers['user-agent'] || '';

  const payload = {
    pixel_code: PIXEL_CODE,
    data: [
      {
        event: 'CompletePayment',
        event_id: id, // ID da transação usado para DEDUPLICAÇÃO com o frontend
        event_time: Math.floor(Date.now() / 1000), // Timestamp em segundos
        context: {
          ip: clientIp,
          user_agent: userAgent,
          page: {
            url: req.headers.referer || 'https://acessoantecipadooficial.vercel.app/checkout.html'
          }
        },
        properties: {
          contents: [{
            content_name: 'TikTok - Front Checkout MB Way',
            quantity: 1,
            price: amount
          }],
          value: amount,
          currency: currency
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
    console.log('[TikTok CAPI] Evento enviado:', ttResponse.message);
  } catch (error) {
    console.error('[TikTok CAPI] Erro ao enviar evento:', error);
  }
}
// =========================================================================


export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Parse body robusto — funciona em qualquer configuração Vercel
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

  const CLIENT_ID     = process.env.WAYMB_CLIENT_ID
  const CLIENT_SECRET = process.env.WAYMB_CLIENT_SECRET
  const ACCOUNT_EMAIL = process.env.WAYMB_ACCOUNT_EMAIL

  if (!CLIENT_ID || !CLIENT_SECRET || !ACCOUNT_EMAIL) {
    return res.status(500).json({
      error: 'Credenciais WayMB não configuradas. Adiciona WAYMB_CLIENT_ID, WAYMB_CLIENT_SECRET e WAYMB_ACCOUNT_EMAIL no Vercel Dashboard → Settings → Environment Variables.',
    })
  }

  // ── URL base: SEMPRE usar BASE_URL fixo (nunca VERCEL_URL que muda por deploy) ──
  const baseUrl = (process.env.BASE_URL || '').replace(/\/$/, '')
    || 'https://acessoantecipadooficial.vercel.app'

  // ── Status check ────────────────────────────────────────────────────────
  if (req.query.action === 'status') {
    const { id } = body
    if (!id) return res.status(400).json({ error: 'Missing transaction id' })

    try {
      const response = await fetch('https://api.waymb.com/transactions/info', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id }),
      })
      const data = await response.json()
      console.log('[status] WayMB:', data.status, '— ID:', id)

      // Normalizar status para o que o frontend espera
      const statusMap = {
        COMPLETED: 'paid',
        PAID:      'paid',
        APPROVED:  'paid',
        CONFIRMED: 'paid',
        DECLINED:  'failed',
        FAILED:    'failed',
        PENDING:   'pending',
      }
      const normalized = statusMap[(data.status || '').toUpperCase()] || 'pending'

      // ====================================================================
      // DISPARO TIKTOK: Se o pagamento foi confirmado, envia via Servidor
      // ====================================================================
      if (normalized === 'paid') {
        // Dispara assincronamente (sem o await) para não prender a resposta ao usuário
        sendTikTokServerEvent(data, req, id).catch(err => console.error(err));
      }

      return res.status(200).json({ ...data, status: normalized })
    } catch (err) {
      console.error('[status] error:', err)
      return res.status(500).json({ error: 'Erro ao consultar status.' })
    }
  }

  // ── Create transaction ─────────────────────────────────────────────────
  const { amount, method, payer, paymentDescription, currency } = body

  if (!amount || !method || !payer) {
    console.error('[create-transaction] body recebido:', JSON.stringify(body))
    return res.status(400).json({
      error: `Campos obrigatórios em falta: ${[
        !amount && 'amount',
        !method && 'method',
        !payer  && 'payer',
      ].filter(Boolean).join(', ')}`,
    })
  }

  const payload = {
    client_id:          CLIENT_ID,
    client_secret:      CLIENT_SECRET,
    account_email:      ACCOUNT_EMAIL,
    amount:             parseFloat(amount),
    method:             method,
    payer: {
      name:     (payer.name     || 'Cliente').trim(),
      email:    payer.email ? payer.email.trim() : generatePayerEmail(payer.name, payer.phone),
      phone:    (payer.phone    || '').trim(),
      document: (payer.document || '000000000').trim(),
    },
    currency:           currency || 'EUR',
    paymentDescription: (paymentDescription || 'TikTok Bonus Portugal').slice(0, 50),
    callbackUrl: `${baseUrl}/api/webhook`,
  }

  console.log('[create-transaction] →', {
    amount: payload.amount,
    method: payload.method,
    payer_name:  payload.payer.name,
    payer_phone: payload.payer.phone,
    callbackUrl: payload.callbackUrl,
  })

  try {
    const response = await fetch('https://api.waymb.com/transactions/create', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
    const data = await response.json()
    console.log('[create-transaction] WayMB response:', JSON.stringify(data))

    if (!response.ok) {
      return res.status(response.status).json(data)
    }

    return res.status(200).json({
      ...data,
      id: data.transactionID || data.id || null,
    })
  } catch (err) {
    console.error('[create-transaction] fetch error:', err)
    return res.status(500).json({ error: 'Erro interno ao criar transação.' })
  }
}
