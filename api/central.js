;(function(){
var PRICES={"front":12.97,"up1":7.2,"up2":6.47,"up3":11.88,"up4":5.7,"up5":9.3,"up6":13.43,"up7":6.8,"up8":14.73,"up9":28.55};
var AMOUNTS={"lead_balance":2800};
var REDIRECTS={"up1_entry":"/up1/"};
window.CENTRAL_PRICES=PRICES;
window.CENTRAL_AMOUNTS=AMOUNTS;
window.CENTRAL_REDIRECTS=REDIRECTS;
window.getCentralPrice=function(key,fallback){
if(!Object.prototype.hasOwnProperty.call(PRICES,key)) return fallback;
var n=Number(PRICES[key]);
return Number.isFinite(n)?n:fallback;
};
window.getCentralAmount=function(key,fallback){
if(!Object.prototype.hasOwnProperty.call(AMOUNTS,key)) return fallback;
var n=Number(AMOUNTS[key]);
return Number.isFinite(n)?n:fallback;
};
window.getCentralRedirect=function(key,fallback){
if(!Object.prototype.hasOwnProperty.call(REDIRECTS,key)) return fallback;
return String(REDIRECTS[key]||fallback||'');
};
})();
