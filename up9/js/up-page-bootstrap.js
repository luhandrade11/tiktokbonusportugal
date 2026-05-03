(function () {
  function ptFmt(n) {
    var x = Number(n);
    if (!Number.isFinite(x)) x = 0;
    return x.toFixed(2).replace(".", ",");
  }

  var m = window.__UP_META__ || {};
  var stage = m.stage || "up1";

  if (typeof window.getCentralPrice !== "function") {
    return;
  }

  window.__UP_AMOUNT__ = window.getCentralPrice(stage, 0);
  window.__UP_FMT__ = ptFmt(window.__UP_AMOUNT__);
  window.__LEAD_BALANCE_FMT__ = ptFmt(window.getCentralAmount("lead_balance", 2800));

  if (stage === "up3") {
    window.__UP_FEE_3 = window.__UP_AMOUNT__;
  }

  window.__UP_NEXT__ = (m.nextBase || "../") + (window.location.search || "");

  function paintUp6() {
    var p = window.CENTRAL_PRICES || {};
    var upAmount = window.__UP_AMOUNT__;
    var fee_raw = [
      Number(p.up1) || 0,
      Number(p.up2) || 0,
      Number(p.up3) || 0,
      Number(p.up4) || 0,
      Number(p.up5) || 0,
      Math.round(Number(p.up5) * 1.28 * 100) / 100,
    ];
    var fee_raw_total = fee_raw.reduce(function (a, b) {
      return a + b;
    }, 0);
    var scale = fee_raw_total > 0 ? upAmount / fee_raw_total : 1;
    var fee_scaled = [];
    var acc = 0;
    for (var i = 0; i < 5; i++) {
      fee_scaled[i] = Math.round(fee_raw[i] * scale * 100) / 100;
      acc += fee_scaled[i];
    }
    fee_scaled[5] = Math.round((upAmount - acc) * 100) / 100;
    document.querySelectorAll(".js-up6-fee").forEach(function (el) {
      var idx = parseInt(el.getAttribute("data-i") || "0", 10);
      el.textContent = ptFmt(fee_scaled[idx] != null ? fee_scaled[idx] : 0);
    });
    document.querySelectorAll(".js-up6-fee-total").forEach(function (el) {
      el.textContent = ptFmt(upAmount);
    });
  }

  function paint() {
    document.querySelectorAll(".js-up-fmt").forEach(function (el) {
      el.textContent = window.__UP_FMT__;
    });
    document.querySelectorAll(".js-lead-balance-fmt").forEach(function (el) {
      el.textContent = window.__LEAD_BALANCE_FMT__;
    });
    if (stage === "up6") paintUp6();
    if (typeof window.loadUpsellValue === "function") {
      try {
        window.loadUpsellValue();
      } catch (e) {}
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", paint);
  } else {
    paint();
  }
})();
