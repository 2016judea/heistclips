// Pricing page: start a Stripe Checkout for a pack.
let device = null;
try { device = localStorage.getItem("hc_device"); if (!device) { device = crypto.randomUUID(); localStorage.setItem("hc_device", device); } } catch (e) {}
document.querySelectorAll(".buy").forEach((b) => b.addEventListener("click", async () => {
  b.disabled = true;
  const msg = document.getElementById("buymsg");
  try { window.posthog && window.posthog.capture("checkout_start", { pack: b.dataset.pack }); } catch (e) {}
  try {
    const r = await fetch("/api/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pack: b.dataset.pack, d: device }) });
    const d = await r.json();
    if (d.url) location.href = d.url; else { msg.textContent = "Checkout failed: " + (d.error || "try again"); b.disabled = false; }
  } catch (e) { msg.textContent = "Checkout failed: " + e.message; b.disabled = false; }
}));
