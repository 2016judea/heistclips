// Per-clip credits. Free: FREE_CLIPS per browser. Paid: a Stripe Checkout Session id is the
// licence key; claiming it verifies the session with Stripe and records the pack once.
// Ledger rows live in Blob under keyed-hash paths (public store, unguessable names).
import { getJSON, putJSON, secretPath } from "../lib/store.js";
import { FREE_CLIPS } from "../lib/render.js";
import { grant } from "./stripe-webhook.js";

async function stripeSession(id) {
  const r = await fetch("https://api.stripe.com/v1/checkout/sessions/" + encodeURIComponent(id), { headers: { authorization: "Bearer " + process.env.STRIPE_SECRET_KEY } });
  return r.ok ? r.json() : null;
}

async function read(d, k) {
  const free = (d && (await getJSON(secretPath("credits/free", d), { fresh: true }).catch(() => null))) || { used: 0 };
  const paid = (k && (await getJSON(secretPath("credits/paid", k), { fresh: true }).catch(() => null))) || null;
  return { free, paid, state: { free_left: Math.max(0, FREE_CLIPS - (free.used || 0)), paid_left: paid ? Math.max(0, paid.granted - paid.used) : 0 } };
}

async function body(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = []; for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch (e) { return {}; }
}

export default async function handler(req, res) {
  res.setHeader("content-type", "application/json");
  res.setHeader("cache-control", "no-store");
  const u = new URL(req.url, "https://heistclips.com");
  if (req.method === "GET") {
    const { state } = await read(u.searchParams.get("d"), u.searchParams.get("k"));
    return res.end(JSON.stringify(state));
  }
  const b = await body(req);
  const d = String(b.d || "").slice(0, 80);
  if (!d) { res.statusCode = 400; return res.end(JSON.stringify({ error: "no device" })); }

  if (b.action === "claim") {
    const id = String(b.session || "");
    if (!/^cs_(live|test)_[A-Za-z0-9]+$/.test(id)) { res.statusCode = 400; return res.end(JSON.stringify({ error: "bad session" })); }
    const existing = await getJSON(secretPath("credits/paid", id), { fresh: true }).catch(() => null);
    if (existing) { const { state } = await read(d, id); return res.end(JSON.stringify({ key: id, ...state })); }
    const s = await stripeSession(id);
    if (!s || s.payment_status !== "paid") return res.end(JSON.stringify({ error: "payment not confirmed" }));
    const g = await grant(s, "claim");
    if (!g.granted && g.why !== "already granted") return res.end(JSON.stringify({ error: "payment not confirmed" }));
    const { state } = await read(d, id);
    return res.end(JSON.stringify({ key: id, ...state }));
  }

  if (b.action === "use") {
    const k = String(b.k || "");
    const { free, paid, state } = await read(d, k);
    if (state.free_left > 0) {
      free.used = (free.used || 0) + 1; free.last = new Date().toISOString();
      await putJSON(secretPath("credits/free", d), free, { maxAge: 0 });
      return res.end(JSON.stringify({ ok: true, free_left: state.free_left - 1, paid_left: state.paid_left }));
    }
    if (paid && state.paid_left > 0) {
      paid.used += 1; paid.last = new Date().toISOString();
      await putJSON(secretPath("credits/paid", k), paid, { maxAge: 0 });
      return res.end(JSON.stringify({ ok: true, free_left: 0, paid_left: state.paid_left - 1 }));
    }
    return res.end(JSON.stringify({ ok: false, need: "buy", ...state }));
  }
  res.statusCode = 400; res.end(JSON.stringify({ error: "unknown action" }));
}
