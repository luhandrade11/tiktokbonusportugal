export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const CLIENT_ID     = process.env.WAYMB_CLIENT_ID
  const CLIENT_SECRET = process.env.WAYMB_CLIENT_SECRET
  const ACCOUNT_EMAIL = process.env.WAYMB_ACCOUNT_EMAIL

  if (!CLIENT_ID || !CLIENT_SECRET || !ACCOUNT_EMAIL) {
    console.error('[create-transaction] ENV VARS em falta:', {
      WAYMB_CLIENT_ID: !!CLIENT_ID,
      WAYMB_CLIENT_SECRET: !!CLIENT_SECRET,
      WAYMB_ACCOUNT_EMAIL: !!ACCOUNT_EMAIL,
    })
    return res.status(500).json({
      error: 'Credenciais WayMB não configuradas. Verifica as variáveis de ambiente no Vercel Dashboard.',
    })
  }

  // ── Status check ──────────────────────────────────────────────────────────
  if (req.query.action === 'status') {
    const { id } = req.body
    if (!id) return res.status(400).json({ error: 'Missing transaction id' })

    try {
      const response = await fetch('https://api.waymb.com/transactions/info', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id }),
      })
      const data = await response.json()
      console.log('[status] WayMB response:', data)

      // Map WayMB statuses → frontend expectations
      const statusMap = {
        COMPLETED: 'paid',
        DECLINED:  'failed',
        PENDING:   'pending',
      }
      const normalizedStatus = statusMap[data.status] || 'pending'

      return res.status(200).json({ ...data, status: normalizedStatus })
    } catch (err) {
      console.error('[status] WayMB error:', err)
      return res.status(500).json({ error: 'Erro ao consultar status da transação.' })
    }
  }

  // ── Create transaction ────────────────────────────────────────────────────
  const { amount, method, payer, paymentDescription, currency } = req.body

  if (!amount || !method || !payer) {
    return res.status(400).json({ error: 'Campos obrigatórios em falta: amount, method, payer' })
  }

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : (process.env.BASE_URL || 'https://tiktokbonusportugal.vercel.app')

  const payerPayload = {
    name:     payer.name     || 'Cliente',
    email:    payer.email    || ACCOUNT_EMAIL,
    phone:    payer.phone    || '',
    document: payer.document || '000000000',
  }

  const body = {
    client_id:          CLIENT_ID,
    client_secret:      CLIENT_SECRET,
    account_email:      ACCOUNT_EMAIL,
    amount:             parseFloat(amount),
    method:             method,
    payer:              payerPayload,
    currency:           currency || 'EUR',
    paymentDescription: (paymentDescription || 'TikTok Bonus Portugal').slice(0, 50),
    callbackUrl:        `${baseUrl}/api/webhook`,
  }

  console.log('[create-transaction] Sending to WayMB:', {
    amount: body.amount,
    method: body.method,
    payer_name: body.payer.name,
    payer_phone: body.payer.phone,
  })

  try {
    const response = await fetch('https://api.waymb.com/transactions/create', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })
    const data = await response.json()
    console.log('[create-transaction] WayMB response:', data)

    if (!response.ok) {
      console.error('[create-transaction] WayMB error:', data)
      return res.status(response.status).json(data)
    }

    return res.status(200).json({
      ...data,
      id: data.transactionID || data.id || null,
    })
  } catch (err) {
    console.error('[create-transaction] Fetch error:', err)
    return res.status(500).json({ error: 'Erro interno ao criar transação.' })
  }
}
