export default async function handler(req, res) {
  // ⚠️ CRÍTICO: O 200 tem de ser enviado IMEDIATAMENTE
  // A WayMB marca a conta inativa se não receber 200 na hora
  res.status(200).json({ received: true })

  // Só depois processamos — mesmo que crache, o 200 já foi enviado
  try {
    let body = req.body
    // Parse manual caso Vercel não faça automaticamente
    if (!body || typeof body === 'string') {
      try { body = JSON.parse(body || '{}') } catch { body = {} }
    }

    const {
      transactionId,
      id,
      status,
      amount,
      currency,
      email,
      account_email,
      payer,
    } = body || {}

    const txId = transactionId || id || 'unknown'

    console.log('[webhook] WayMB notification recebida:', {
      id: txId,
      status,
      amount,
      currency,
      email: email || account_email,
    })

    switch (status) {
      case 'COMPLETED':
        console.log(`[webhook] ✅ Pagamento CONFIRMADO — ID: ${txId} — Valor: ${amount} ${currency || 'EUR'}`)
        break
      case 'DECLINED':
        console.log(`[webhook] ❌ Pagamento RECUSADO — ID: ${txId}`)
        break
      case 'PENDING':
        console.log(`[webhook] ⏳ Pagamento PENDENTE — ID: ${txId}`)
        break
      default:
        console.log(`[webhook] Status desconhecido: ${status} — ID: ${txId}`)
    }
  } catch (err) {
    // Nunca deixar o erro chegar ao cliente — o 200 já foi enviado
    console.error('[webhook] Erro ao processar (não afeta o 200):', err)
  }
}
