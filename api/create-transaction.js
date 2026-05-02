export const config = { api: { bodyParser: true } }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Parse body manualmente caso o Vercel não faça automaticamente
  let body = req.body
  if (!body || typeof body === 'string') {
    try {
      body = JSON.parse(body || '{}')
    } catch (e) {
      // tentar ler o raw stream
      body = await new Promise((resolve) => {
        let raw = ''
        req.on('data', chunk => { raw += chunk })
        req.on('end', () => {
          try { resolve(JSON.parse(raw)) } catch { resolve({}) }
        })
      })
    }
  }

  const CLIENT_ID     = process.env.WAYMB_CLIENT_ID
  const CLIENT_SECRET = process.env.WAYMB_CLIENT_SECRET
  const ACCOUNT_EMAIL = process.env.WAYMB_ACCOUNT_EMAIL

  if (!CLIENT_ID || !CLIENT_SECRET || !ACCOUNT_EMAIL) {
    return res.status(500).json({
      error: 'Credenciais WayMB não configuradas. Adiciona as ENV VARS no Vercel Dashboard.',
    })
  }

  // ── Status check ──────────────────────────────────────────────────────────
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
      const statusMap = { COMPLETED: 'paid', DECLINED: 'failed', PENDING: 'pending' }
      return res.status(200).json({ ...data, status: statusMap[data.status] || 'pending' })
    } catch (err) {
      console.error('[status] error:', err)
      return res.status(500).json({ error: 'Erro ao consultar status.' })
    }
  }

  // ── Create transaction ────────────────────────────────────────────────────
  const { amount, method, payer, paymentDescription, currency } = body

  if (!amount || !method || !payer) {
    console.error('[create-transaction] body recebido:', JSON.stringify(body))
    return res.status(400).json({ error: 'Campos obrigatórios em falta: amount, method, payer' })
  }

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : (process.env.BASE_URL || 'https://acessoantecipadoseguro.vercel.app/')

  const payload = {
    client_id:          CLIENT_ID,
    client_secret:      CLIENT_SECRET,
    account_email:      ACCOUNT_EMAIL,
    amount:             parseFloat(amount),
    method:             method,
    payer: {
      name:     payer.name     || 'Cliente',
      email:    payer.email    || ACCOUNT_EMAIL,
      phone:    payer.phone    || '',
      document: payer.document || '000000000',
    },
    currency:           currency || 'EUR',
    paymentDescription: (paymentDescription || 'TikTok Bonus Portugal').slice(0, 50),
    callbackUrl:        `${baseUrl}/api/webhook`,
  }

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
