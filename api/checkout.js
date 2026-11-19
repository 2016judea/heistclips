// Stripe Checkout for a credit pack (Brick & Mortar account). Inline price_data, no dashboard
// objects needed. Success returns to the clip page the buyer left (or /clip) with
// ?paid=<session id>, which claims the credits.
import { PACKS } from "../lib/render.js";

// A payment-method configuration that belongs to heistclips alone, so turning a method on here
// never changes checkout for the account's other products. It adds Google Pay (off in the
// account default until 2026-11-19) and carries every local method the account is approved for.
// If Stripe refuses it (a test-mode key on a preview, a deleted config) we retry without it:
// a checkout on the account default beats no checkout.
const PMC = process.env.STRIPE_PMC || "pmc_1UdYSABzD4mN8eODaB1CkgfW";
const NAMES = {
  en: (n) => [`heistclips – ${n} clips`, `${n} exported 9:16 clips. No expiry, no watermark.`],
  de: (n) => [`heistclips – ${n} Clips`, `${n} exportierte 9:16-Clips. Kein Ablaufdatum, kein Wasserzeichen.`],
  fr: (n) => [`heistclips – ${n} clips`, `${n} clips 9:16 exportés. Sans date limite, sans filigrane.`],
};

// Only ever send a buyer back to our own clip tool, never to a URL the request made up.
export function backPath(raw, lang) {
  const s = String(raw || "");
  const m = s.match(/^\/(?:(de|fr)\/)?clip(\?[^#\s]{0,400})?$/);
  if (!m) return (lang === "de" || lang === "fr" ? "/" + lang : "") + "/clip";
  const q = new URLSearchParams((m[2] || "").slice(1));
  q.delete("paid");
  const qs = q.toString();
  return s.split("?")[0] + (qs ? "?" + qs : "");
}

export function sessionForm(pack, { origin, lang, back, device, pmc }) {
  const l = NAMES[lang] ? lang : "en";
  const [name, desc] = NAMES[l](pack.clips);
  const ret = backPath(back, l);
  const f = new URLSearchParams({
    mode: "payment",
    success_url: `${origin}${ret}${ret.includes("?") ? "&" : "?"}paid={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}${back && ret !== "/clip" ? ret : (l === "en" ? "" : "/" + l) + "/pricing"}`,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(pack.price * 100),
    "line_items[0][price_data][product_data][name]": name,
    "line_items[0][price_data][product_data][description]": desc,
    "metadata[pack]": pack.id,
    "metadata[product]": "heistclips",
    "metadata[device]": String(device || "").slice(0, 80),
    "metadata[lang]": l,
    "payment_intent_data[statement_descriptor_suffix]": "HEISTCLIPS",
    "payment_intent_data[metadata][product]": "heistclips",
    // The page in the buyer's own language, the price in their own currency.
    locale: l === "en" ? "auto" : l,
    "adaptive_pricing[enabled]": "true",
  });
  if (pmc) f.set("payment_method_configuration", pmc);
  return f;
}

export default async function handler(req, res) {
  res.setHeader("content-type", "application/json");
  if (req.method !== "POST") { res.statusCode = 405; return res.end("{}"); }
  const chunks = []; for await (const c of req) chunks.push(c);
  let b = {}; try { b = typeof req.body === "object" && req.body ? req.body : JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch (e) {}
  const pack = PACKS.find((p) => p.id === b.pack);
  if (!pack) { res.statusCode = 400; return res.end(JSON.stringify({ error: "unknown pack" })); }
  // Previews of this project return to themselves (so a test-mode session is claimed with the
  // test key); everything else returns to the live site.
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "");
  const origin = /^heistclips-[a-z0-9-]+\.vercel\.app$/.test(host) ? "https://" + host : "https://heistclips.com";
  const opts = { origin, lang: String(b.lang || "").slice(0, 2).toLowerCase(), back: b.back, device: b.d };
  const post = (pmc) => fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { authorization: "Bearer " + process.env.STRIPE_SECRET_KEY, "content-type": "application/x-www-form-urlencoded" }, body: sessionForm(pack, { ...opts, pmc }) });
  let r = await post(PMC);
  let s = await r.json();
  if (!r.ok && PMC) { console.error("checkout: retrying on the account default:", s.error && s.error.message); r = await post(null); s = await r.json(); }
  if (!r.ok) { res.statusCode = 502; return res.end(JSON.stringify({ error: (s.error && s.error.message) || "stripe error" })); }
  res.end(JSON.stringify({ url: s.url }));
}
