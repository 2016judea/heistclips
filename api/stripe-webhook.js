// checkout.session.completed -> grant the pack's credits, keyed by the session id (the licence
// key the buyer's browser claims on return). Idempotent with /api/credits claim: whichever
// arrives first writes the ledger row; the other finds it. Live events arrive via stripe-router.
import crypto from "node:crypto";
import { getJSON, putJSON, secretPath } from "../lib/store.js";
import { PACKS } from "../lib/render.js";

export const config = { api: { bodyParser: false } };

function verify(body, header, secrets) {
  const parts = Object.fromEntries(String(header || "").split(",").map((kv) => kv.split("=")).filter((x) => x.length === 2).map(([k, v]) => [k, v]));
  const sigs = String(header || "").split(",").filter((kv) => kv.startsWith("v1=")).map((kv) => kv.slice(3));
  const t = parts.t;
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - Number(t)) > 600) return false;
  return secrets.some((sec) => {
    const want = crypto.createHmac("sha256", sec).update(`${t}.${body}`).digest("hex");
    return sigs.some((s) => s.length === want.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(want)));
  });
}

export async function grant(session, via) {
  const pack = PACKS.find((p) => p.id === (session.metadata && session.metadata.pack));
  // stripe-router's probe (and every router product) expects this phrase for a session to skip.
  if (session.payment_status !== "paid" || !pack) return { granted: false, why: "not ours or not paid" };
  const path = secretPath("credits/paid", session.id);
  const existing = await getJSON(path, { fresh: true }).catch(() => null);
  if (existing) return { granted: false, why: "already granted", via: existing.via };
  await putJSON(path, { granted: pack.clips, used: 0, pack: pack.id, livemode: !!session.livemode, via, at: new Date().toISOString() }, { maxAge: 0 });
  return { granted: true, clips: pack.clips };
}

export default async function handler(req, res) {
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks).toString("utf8");
  const secrets = String(process.env.STRIPE_WEBHOOK_SECRET || "").split(",").map((s) => s.trim()).filter(Boolean);
  res.setHeader("content-type", "application/json");
  if (!secrets.length || !verify(body, req.headers["stripe-signature"], secrets)) { res.statusCode = 400; return res.end(JSON.stringify({ error: "bad signature" })); }
  const ev = JSON.parse(body);
  if (ev.type !== "checkout.session.completed") return res.end(JSON.stringify({ ignored: ev.type }));
  const s = ev.data.object;
  if (!s.metadata || s.metadata.product !== "heistclips") return res.end(JSON.stringify({ ignored: "not ours or not paid" }));
  const r = await grant(s, "webhook");
  res.end(JSON.stringify(r));
}
