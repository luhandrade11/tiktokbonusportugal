export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()

  // WayMB exige sempre resposta 200 para confirmar recebimento
  if (req.method !== 'POST') return res.status(200).end()

  try {
    const { transactionId, id, status, amount, email } = req.body
    console.log('[webhook] WayMB notification:', {
      id: transactionId || id,
      status,
      amount,
      email,
    })
    // Aqui podes adicionar lógica extra: guardar no DB, enviar email, etc.
  } catch (err) {
    console.error('[webhook] Parse error:', err)
  }

  // Sempre retorna 200 conforme documentação WayMB
  return res.status(200).json({ received: true })
}
