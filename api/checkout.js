// Stripe Checkout for a credit pack (Brick & Mortar account). Inline price_data, no dashboard
// objects needed. Success returns to /clip?paid=<session id>, which claims the credits.
import { PACKS } from "../lib/render.js";

export default async function handler(req, res) {
  res.setHeader("content-type", "application/json");
  if (req.method !== "POST") { res.statusCode = 405; return res.end("{}"); }
  const chunks = []; for await (const c of req) chunks.push(c);
  let b = {}; try { b = typeof req.body === "object" && req.body ? req.body : JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch (e) {}
  const pack = PACKS.find((p) => p.id === b.pack);
  if (!pack) { res.statusCode = 400; return res.end(JSON.stringify({ error: "unknown pack" })); }
  const origin = "https://heistclips.com";
  const f = new URLSearchParams({
    mode: "payment",
    success_url: `${origin}/clip?paid={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/pricing`,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(pack.price * 100),
    "line_items[0][price_data][product_data][name]": `heistclips – ${pack.clips} clips`,
    "line_items[0][price_data][product_data][description]": `${pack.clips} exported 9:16 clips. No expiry, no watermark.`,
    "metadata[pack]": pack.id,
    "metadata[product]": "heistclips",
    "metadata[device]": String(b.d || "").slice(0, 80),
    "payment_intent_data[statement_descriptor_suffix]": "HEISTCLIPS",
    "payment_intent_data[metadata][product]": "heistclips",
    allow_promotion_codes: "true",
  });
  const r = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { authorization: "Bearer " + process.env.STRIPE_SECRET_KEY, "content-type": "application/x-www-form-urlencoded" }, body: f });
  const s = await r.json();
  if (!r.ok) { res.statusCode = 502; return res.end(JSON.stringify({ error: (s.error && s.error.message) || "stripe error" })); }
  res.end(JSON.stringify({ url: s.url }));
}
