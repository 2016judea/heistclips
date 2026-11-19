// Per-clip credits. Free: FREE_CLIPS per browser. Paid: a Stripe Checkout Session id is the
// licence key; claiming it verifies the session with Stripe and records the pack once.
//
// A clip is charged only once a non-empty file exists: the browser asks for a ticket before it
// renders ("start", checks the balance, charges nothing) and spends it after ("commit", with
// the file's size; zero bytes charges nothing). Each spend is its own Blob file, counted with
// the Blob list API, because a read-modify-write counter on Blob's public URL lost increments:
// a re-read served the old count for 25 s+ and 12 browsers got 11-18 free clips (2026-11-19).
import crypto from "node:crypto";
import { getJSON, putJSON, secretPath, listPaths } from "../lib/store.js";
import { FREE_CLIPS } from "../lib/render.js";
import { grant } from "./stripe-webhook.js";
import { recordClip } from "../lib/trend.js";
import { clipMade } from "../lib/track.js";
import { isTest, isHouse } from "../lib/marks.js";

const TICKET_TTL_MS = 6 * 3600 * 1000;
const salt = () => process.env.CREDIT_SALT || process.env.BLOB_READ_WRITE_TOKEN || "dev";
const usesDir = (pool, id) => secretPath(`credits/${pool}-uses`, id).replace(/\.json$/, "/");

async function stripeSession(id) {
  const r = await fetch("https://api.stripe.com/v1/checkout/sessions/" + encodeURIComponent(id), { headers: { authorization: "Bearer " + process.env.STRIPE_SECRET_KEY } });
  return r.ok ? r.json() : null;
}

// Balance = allowance - (legacy counter, frozen since 2026-11-19) - (spends listed since).
export async function read(d, k) {
  const [legacyFree, paid, freeUses, paidUses] = await Promise.all([
    d ? getJSON(secretPath("credits/free", d), { fresh: true }).catch(() => null) : null,
    k ? getJSON(secretPath("credits/paid", k), { fresh: true }).catch(() => null) : null,
    d ? listPaths(usesDir("free", d)) : [],
    k ? listPaths(usesDir("paid", k)) : [],
  ]);
  const freeUsed = ((legacyFree && legacyFree.used) || 0) + freeUses.length;
  const paidUsed = paid ? (paid.used || 0) + paidUses.length : 0;
  return {
    paid, freeUses, paidUses,
    state: { free_left: Math.max(0, FREE_CLIPS - freeUsed), paid_left: paid ? Math.max(0, paid.granted - paidUsed) : 0 },
  };
}

const sign = (d, k, id) => crypto.createHmac("sha256", salt()).update(`ticket|${d}|${k}|${id}`).digest("hex").slice(0, 32);
export function makeTicket(d, k) {
  const id = Date.now().toString(36) + "-" + crypto.randomBytes(6).toString("hex");
  return id + "." + sign(d, k, id);
}
export function checkTicket(d, k, ticket) {
  const m = String(ticket || "").match(/^([a-z0-9]{6,12})-([0-9a-f]{12})\.([0-9a-f]{32})$/);
  if (!m) return null;
  const id = m[1] + "-" + m[2];
  const want = sign(d, k, id);
  if (!crypto.timingSafeEqual(Buffer.from(m[3]), Buffer.from(want))) return null;
  if (Date.now() - parseInt(m[1], 36) > TICKET_TTL_MS) return null;
  return id;
}

// Record one spend: free first, then paid. Idempotent per spend id.
async function spend(d, k, id, meta, houseAccount = false) {
  const { paid, freeUses, paidUses, state } = await read(d, k);
  const name = id + ".json";
  if (freeUses.some((p) => p.endsWith("/" + name)) || paidUses.some((p) => p.endsWith("/" + name))) return { ok: true, already: true, ...state };
  // The spend row keeps what was cut, never who: the analytics id and the test flag stay out of it.
  const { ph, qa, ...kept } = meta || {};
  const row = { at: new Date().toISOString(), ...kept };
  // One finished clip = one trend record (lib/trend.js) and one clip_made event (lib/track.js),
  // whichever path made it. Two exceptions (lib/marks.js): a test clip (header x-hc-test, here
  // as meta.qa) is charged like any other and counted nowhere; a house clip (HOUSE_ACCOUNTS)
  // sends clip_made with house: true and leaves no trend record.
  const house = houseAccount || isHouse(d);
  const count = async (charged, left) => { if (qa) return; await Promise.all([house ? null : recordClip(kept), clipMade(meta, { charged, ...left, d, house })]); };
  if (state.free_left > 0) {
    await putJSON(usesDir("free", d) + name, row, { maxAge: 60 });
    const left = { free_left: state.free_left - 1, paid_left: state.paid_left };
    await count("free", left);
    return { ok: true, ...left };
  }
  if (paid && state.paid_left > 0) {
    await putJSON(usesDir("paid", k) + name, row, { maxAge: 60 });
    const left = { free_left: 0, paid_left: state.paid_left - 1 };
    await count("paid", left);
    return { ok: true, ...left };
  }
  return { ok: false, need: "buy", ...state };
}

async function body(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = []; for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch (e) { return {}; }
}

const metaOf = (m) => {
  const x = m && typeof m === "object" ? m : {};
  const out = { vod: String(x.vod || "").slice(0, 40), t: Number(x.t) || 0, layout: String(x.layout || "").slice(0, 20), bytes: Number(x.bytes) || 0 };
  // Optional, for the clip_made event (lib/track.js): the stream, the clip's length, the path.
  if (x.channel) out.channel = String(x.channel).toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
  if (x.platform === "kick" || x.platform === "twitch") out.platform = x.platform;
  if (Number(x.secs) > 0) out.secs = Math.round(Number(x.secs));
  if (x.via === "web") out.via = "web";
  if (typeof x.ph === "string" && /^[A-Za-z0-9_-]{8,80}$/.test(x.ph)) out.ph = x.ph;
  if (x.qa === true) out.qa = true;
  return out;
};

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
  const k = String(b.k || "").slice(0, 200);
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

  // Before a render: is there a clip to spend? Charges nothing.
  if (b.action === "start") {
    const { state } = await read(d, k);
    if (state.free_left + state.paid_left <= 0) return res.end(JSON.stringify({ ok: false, need: "buy", ...state }));
    return res.end(JSON.stringify({ ok: true, ticket: makeTicket(d, k), ...state }));
  }

  // After a render: spend the clip only if the file has bytes in it.
  if (b.action === "commit") {
    const id = checkTicket(d, k, b.ticket);
    if (!id) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "bad ticket" })); }
    const bytes = Number(b.bytes) || 0;
    if (bytes <= 0) { const { state } = await read(d, k); return res.end(JSON.stringify({ ok: false, error: "empty file, not charged", ...state })); }
    return res.end(JSON.stringify(await spend(d, k, id, { ...metaOf(b.meta), bytes, ...(isTest(req) ? { qa: true } : {}) }, req.house === true)));
  }

  // Pages loaded before 2026-11-19 charge up front; kept so an open tab still works.
  if (b.action === "use") {
    return res.end(JSON.stringify(await spend(d, k, "u" + Date.now().toString(36) + "-" + crypto.randomBytes(6).toString("hex"), { ...metaOf(b.meta), ...(isTest(req) ? { qa: true } : {}) })));
  }
  res.statusCode = 400; res.end(JSON.stringify({ error: "unknown action" }));
}
