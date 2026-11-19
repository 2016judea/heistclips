// Start a Stripe Checkout for a pack from any ".buy[data-pack]" button: the pricing page, and
// the paywall inside the clip tool. The buyer comes back to the stream they were cutting.
let device = null;
try { device = localStorage.getItem("hc_device"); if (!device) { device = crypto.randomUUID(); localStorage.setItem("hc_device", device); } } catch (e) {}
const lang = (document.documentElement.lang || "en").slice(0, 2);
const EN = ["Opening checkout…", "Checkout failed: ", "try again"];
const T = { en: EN, de: ["Checkout wird geöffnet…", "Checkout fehlgeschlagen: ", "bitte nochmal versuchen"], fr: ["Ouverture du paiement…", "Le paiement a échoué : ", "réessaie"], pt: ["Abrindo o pagamento…", "O pagamento falhou: ", "tente de novo"], es: ["Abriendo el pago…", "El pago falló: ", "inténtalo de nuevo"] }[lang] || EN;
const isClip = (p) => /^\/(?:(?:de|fr|pt|es)\/)?clip$/.test(p);

// Where to send them after paying: the clip page they are on, or the one they came from.
function backTo() {
  if (isClip(location.pathname)) return location.pathname + location.search;
  try {
    const r = new URL(document.referrer);
    if (r.origin === location.origin && isClip(r.pathname)) return r.pathname + r.search;
  } catch (e) {}
  return "";
}

document.addEventListener("click", async (e) => {
  const b = e.target.closest(".buy[data-pack]");
  if (!b || b.disabled) return;
  e.preventDefault();
  b.disabled = true;
  const msg = document.getElementById("buymsg") || b.parentElement.querySelector(".buymsg");
  if (msg) msg.textContent = T[0];
  // sendBeacon: the next line leaves the page, and a normal capture was being lost with it.
  try { window.posthog && window.posthog.capture("checkout_start", { pack: b.dataset.pack, from: isClip(location.pathname) ? "paywall" : "pricing", lang }, { transport: "sendBeacon" }); } catch (x) {}
  try {
    const r = await fetch("/api/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pack: b.dataset.pack, d: device, lang, back: backTo() }) });
    const d = await r.json();
    if (d.url) location.href = d.url; else { if (msg) msg.textContent = T[1] + (d.error || T[2]); b.disabled = false; }
  } catch (x) { if (msg) msg.textContent = T[1] + x.message; b.disabled = false; }
});
