// Hosted campaigns over HTTP (lib/hosted.js). One function, many ops:
//   owner (the /launch page):   start, check, twitch_start, twitch_callback, pitch, checkout, claim, dash, reject
//   clipper (the /earnings page): earnings, payout
//   cron:  track (Vercel cron, Bearer CRON_SECRET)
//   admin: payouts (the weekly CSV), paid (mark a line paid). Bearer CRON_SECRET; Aidan's only.
// No op pays anyone. Payouts are Aidan's, by hand, from the CSV.
import { getJSON, putJSON, listPaths } from "../lib/store.js";
import * as H from "../lib/hosted.js";
import { pitchFor } from "../lib/hostedpitch.js";
import { earningsOf } from "../lib/hostedtool.js";
import { getChannel, gql } from "../public/js/twitch.js";
import { ACCT, getAccount, seal, unseal, signState, readState } from "../lib/accounts.js";
import { BRAND_FILES } from "./checkout.js";
import { serverEvent } from "../lib/track.js";

const SITE = "https://heistclips.com";
const TWITCH_REDIRECT = SITE + "/oauth/twitch/callback";
export const twitchOAuthOn = () => !!(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET);

async function body(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  const chunks = []; for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch (e) { return {}; }
}
const json = (res, status, obj) => { res.statusCode = status; res.setHeader("content-type", "application/json"); res.setHeader("cache-control", "no-store"); res.end(JSON.stringify(obj)); };
const admin = (req) => { const s = process.env.CRON_SECRET; return !!s && (req.headers.authorization || "") === `Bearer ${s}`; };
const originOf = (req) => { const host = String(req.headers["x-forwarded-host"] || req.headers.host || ""); return /^heistclips-[a-z0-9-]+\.vercel\.app$/.test(host) || /^localhost(:\d+)?$/.test(host) ? (host.startsWith("localhost") ? "http://" : "https://") + host : SITE; };

// ---- the owner ------------------------------------------------------------------------------------
const LOGIN = /^[a-z0-9_]{3,25}$/;
const loginOf = (raw) => { const s = String(raw || "").trim().toLowerCase().replace(/^@/, ""); const m = s.match(/twitch\.tv\/([a-z0-9_]{3,25})/) || s.match(/^([a-z0-9_]{3,25})$/); return m ? m[1] : null; };
async function loadOwner(key) { return H.OWNER_KEY.test(String(key || "")) ? getJSON(H.P.owner(key), { fresh: true }).catch(() => null) : null; }
async function saveOwner(key, rec) { await putJSON(H.P.owner(key), { ...rec, updated: new Date().toISOString() }, { maxAge: 0 }); return rec; }

// The code may sit in the bio or in any panel's title, text or link.
export async function twitchProfileText(login, q = gql) {
  const d = await q(`query{ user(login:"${login}"){ id login displayName profileImageURL(width:70) description panels{ __typename ... on DefaultPanel{ title description linkURL } } } }`);
  const u = d && d.user;
  if (!u) return null;
  const panels = (u.panels || []).map((p) => [p.title, p.description, p.linkURL].filter(Boolean).join(" ")).join("\n");
  return { id: u.id, login: u.login, name: u.displayName, avatar: u.profileImageURL, text: `${u.description || ""}\n${panels}` };
}

async function ownerStart(b) {
  const login = loginOf(b.channel);
  if (!login) return [400, { ok: false, error: "Type your Twitch channel name, or paste twitch.tv/yourname." }];
  const ch = await getChannel(login).catch(() => null);
  if (!ch) return [404, { ok: false, error: `No Twitch channel is called ${login}.` }];
  const key = H.OWNER_KEY.test(String(b.k || "")) ? b.k : H.newOwnerKey();
  const rec = await loadOwner(key);
  const verified = !!(rec && rec.twitch && rec.twitch.login === ch.login);
  return [200, { ok: true, k: key, channel: { login: ch.login, name: ch.name, avatar: ch.avatar }, verified, code: H.ownerCode(key, ch.login), oauth: twitchOAuthOn() }];
}

async function ownerCheck(b) {
  const login = loginOf(b.channel);
  if (!H.OWNER_KEY.test(String(b.k || "")) || !login) return [400, { ok: false, error: "Start again from the channel name." }];
  const p = await twitchProfileText(login).catch(() => null);
  if (!p) return [502, { ok: false, error: "Twitch did not answer. Try again in a moment." }];
  const code = H.ownerCode(b.k, p.login);
  if (!H.hasCode(p.text, code)) return [200, { ok: true, verified: false, code, message: `${code} is not in ${p.name}'s bio or panels yet. Twitch can take a minute to show a new bio.` }];
  await saveOwner(b.k, { created: new Date().toISOString(), twitch: { id: p.id, login: p.login, name: p.name, avatar: p.avatar, via: "bio_code", at: new Date().toISOString() } });
  return [200, { ok: true, verified: true, via: "bio_code", channel: { login: p.login, name: p.name, avatar: p.avatar } }];
}

// ---- Twitch sign-in (dormant until TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET are set) -------------------
function twitchStart(req, res, u) {
  const k = u.searchParams.get("k");
  if (!twitchOAuthOn() || !H.OWNER_KEY.test(String(k || ""))) { res.statusCode = 302; res.setHeader("location", "/launch"); return res.end(); }
  const state = signState({ s: seal({ k }) });
  const q = new URLSearchParams({ client_id: process.env.TWITCH_CLIENT_ID, redirect_uri: TWITCH_REDIRECT, response_type: "code", scope: "", state, force_verify: "true" });
  res.statusCode = 302; res.setHeader("location", "https://id.twitch.tv/oauth2/authorize?" + q); res.end();
}
async function twitchCallback(req, res, u) {
  const back = (frag) => { res.statusCode = 302; res.setHeader("location", "/launch#" + frag); res.end(); };
  const st = readState(u.searchParams.get("state"));
  let k = null;
  try { k = st && unseal(st.s).k; } catch (e) {}
  if (!k || !H.OWNER_KEY.test(k) || !u.searchParams.get("code")) return back("tw=failed");
  try {
    const t = await fetch("https://id.twitch.tv/oauth2/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: process.env.TWITCH_CLIENT_ID, client_secret: process.env.TWITCH_CLIENT_SECRET, code: u.searchParams.get("code"), grant_type: "authorization_code", redirect_uri: TWITCH_REDIRECT }) }).then((r) => r.json());
    if (!t.access_token) return back("k=" + k + "&tw=failed");
    const me = await fetch("https://api.twitch.tv/helix/users", { headers: { authorization: "Bearer " + t.access_token, "client-id": process.env.TWITCH_CLIENT_ID } }).then((r) => r.json());
    const usr = me.data && me.data[0];
    // The token is used once, to learn who signed in, and never stored.
    fetch("https://id.twitch.tv/oauth2/revoke", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: process.env.TWITCH_CLIENT_ID, token: t.access_token }) }).catch(() => null);
    if (!usr) return back("k=" + k + "&tw=failed");
    await saveOwner(k, { created: new Date().toISOString(), twitch: { id: usr.id, login: usr.login, name: usr.display_name, avatar: usr.profile_image_url, via: "twitch_oauth", at: new Date().toISOString() } });
    return back("k=" + k + "&tw=ok&ch=" + usr.login);
  } catch (e) { return back("k=" + k + "&tw=failed"); }
}

// ---- checkout -----------------------------------------------------------------------------------
// Card (with Apple Pay and Google Pay) and Link only: they settle at once. A bank debit completes
// the session unpaid and pays days later, and stripe-router forwards only
// checkout.session.completed, so such a campaign would never be funded (seen on the live
// checkout 2026-11-20: "Bank, $5 back").
export function hostedSessionForm(c, { origin }) {
  const r = c.rules;
  const f = new URLSearchParams({
    mode: "payment",
    success_url: `${origin}/launch?paid={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/launch?cancelled=1`,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(Math.round(c.budget * 100)),
    "line_items[0][price_data][product_data][name]": `Clip budget: ${c.title}`,
    "line_items[0][price_data][product_data][description]": `Paid to clippers at $${r.rate_per_1k} per 1,000 verified views, up to $${r.cap_per_clip} a clip. Budget not earned is refunded on request.`,
    "line_items[1][quantity]": "1",
    "line_items[1][price_data][currency]": "usd",
    "line_items[1][price_data][unit_amount]": String(Math.round(c.fee * 100)),
    "line_items[1][price_data][product_data][name]": `heistclips fee (${c.fee_pct}%)`,
    "line_items[1][price_data][product_data][description]": "Verifying every clip and counting its views.",
    "metadata[product]": "heistclips",
    "metadata[kind]": "hosted",
    "metadata[campaign]": c.id,
    "metadata[fee_pct]": String(c.fee_pct),
    "payment_intent_data[statement_descriptor_suffix]": "HEISTCLIPS",
    "payment_intent_data[metadata][product]": "heistclips",
    "payment_intent_data[metadata][kind]": "hosted",
    "payment_intent_data[metadata][campaign]": c.id,
    locale: "auto",
    "payment_method_types[0]": "card",
    "payment_method_types[1]": "link",
    // Branded per session, as the clip packs are (api/checkout.js): the account is Brick & Mortar's.
    "branding_settings[display_name]": "heistclips",
    "branding_settings[background_color]": "#0b0b0d",
    "branding_settings[button_color]": "#c8ff3d",
    "branding_settings[border_style]": "rounded",
    "branding_settings[logo][type]": "file",
    "branding_settings[logo][file]": BRAND_FILES.logo,
    "branding_settings[icon][type]": "file",
    "branding_settings[icon][file]": BRAND_FILES.icon,
  });
  return f;
}

async function checkout(b, req) {
  const owner = await loadOwner(b.k);
  if (!owner || !owner.twitch) return [403, { ok: false, error: "Prove the channel is yours first." }];
  const v = H.validateRules(b);
  if (!v.ok) return [400, v];
  const ch = await getChannel(owner.twitch.login).catch(() => null);
  const is_gta = !!(ch && (ch.vods || []).slice(0, 3).some((x) => /grand theft auto/i.test(x.game || "")));
  const c = H.draftCampaign({ ownerKey: b.k, channel: { ...owner.twitch, avatar: owner.twitch.avatar || (ch && ch.avatar) }, rules: v.rules, is_gta });
  await putJSON(H.P.campaign(c.id), c, { maxAge: 0 });
  await putJSON(H.P.ownerCampaign(b.k, c.id), { at: c.created }, { maxAge: 0 });
  if (!process.env.STRIPE_SECRET_KEY) return [503, { ok: false, error: "Payments are not set up on this server." }];
  const post = (logo = true) => {
    const f = hostedSessionForm(c, { origin: originOf(req) });
    if (!logo) for (const k of [...f.keys()]) if (/^branding_settings\[(logo|icon)\]/.test(k)) f.delete(k);
    return fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { authorization: "Bearer " + process.env.STRIPE_SECRET_KEY, "content-type": "application/x-www-form-urlencoded" }, body: f });
  };
  // A test-mode key (previews, local) does not know the live logo files: retry without them
  // rather than show no checkout.
  let r = await post(), s = await r.json();
  if (!r.ok) { r = await post(false); s = await r.json(); }
  if (!r.ok) return [502, { ok: false, error: (s.error && s.error.message) || "Stripe did not answer." }];
  return [200, { ok: true, url: s.url, campaign: c.id, total: c.total, fee: c.fee, fee_pct: c.fee_pct }];
}

async function claim(b) {
  const id = String(b.session || "");
  if (!/^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(id)) return [400, { ok: false, error: "bad session" }];
  const r = await fetch("https://api.stripe.com/v1/checkout/sessions/" + encodeURIComponent(id), { headers: { authorization: "Bearer " + process.env.STRIPE_SECRET_KEY } });
  if (!r.ok) return [404, { ok: false, error: "Stripe has no such payment." }];
  const s = await r.json();
  const out = await H.fund(s, "claim");
  const cid = (s.metadata && s.metadata.campaign) || null;
  return [200, { ok: !!(out.funded || out.already), funded: !!(out.funded || out.already), campaign: cid, paid: s.payment_status === "paid" }];
}

// ---- the owner's dashboard ----------------------------------------------------------------------------
async function dash(k) {
  const owner = await loadOwner(k);
  if (!owner) return [404, { ok: false, error: "No dashboard for that key." }];
  const ids = (await listPaths(`hosted/oc/${H.ownerHash(k)}/`)).map((p) => p.split("/").pop().replace(/\.json$/, ""));
  const rej = new Set((await listPaths("hosted/rej/")).map((p) => p.split("/").pop().replace(/\.json$/, "")));
  const campaigns = (await Promise.all(ids.map(async (cid) => {
    const [c, f, st] = await Promise.all([H.loadCampaign(cid), H.loadFunded(cid), getJSON(H.P.state(cid), { fresh: true }).catch(() => null)]);
    if (!c) return null;
    if (!f) return { id: cid, title: c.title, status: "unpaid", budget: c.budget, fee: c.fee, total: c.total, rules: c.rules, created: c.created };
    const subs = st ? st.subs : (await H.subsOf(cid)).map((s) => ({ sid: s.id, platform: s.platform, url: s.url, posted_at: s.posted_at, submitted_at: s.submitted_at, views: null, earned: 0, suspect: null, checks: s.checks }));
    return {
      id: cid, title: c.title, slug: c.slug, page: `/campaigns/${c.slug}`, status: st && st.left <= 0 ? "budget spent" : "live", funded_at: f.at,
      budget: c.budget, fee: c.fee, total: c.total, rules: c.rules, earned: st ? st.earned : 0, left: st ? st.left : c.budget, views: st ? st.views : 0,
      clippers: st ? st.clippers : 0, suspect: st ? st.suspect : 0, read_at: st ? st.at : null,
      submissions: subs.map((s) => ({ ...s, acct: undefined, rejected: rej.has(s.sid) })).sort((a, b) => (b.submitted_at || "").localeCompare(a.submitted_at || "")),
    };
  }))).filter(Boolean).sort((a, b) => (b.funded_at || b.created || "").localeCompare(a.funded_at || a.created || ""));
  return [200, { ok: true, channel: owner.twitch || null, campaigns, fee_pct: H.feePct(), oauth: twitchOAuthOn() }];
}

async function reject(b) {
  const owner = await loadOwner(b.k);
  const c = owner && (await H.loadCampaign(b.campaign));
  if (!c || c.owner !== H.ownerHash(b.k) || !H.SUB_ID.test(String(b.sid || ""))) return [403, { ok: false, error: "Not your campaign." }];
  const sub = await getJSON(H.P.sub(c.id, b.sid), { fresh: true }).catch(() => null);
  if (!sub) return [404, { ok: false, error: "No such submission." }];
  await putJSON(H.P.rejected(b.sid), { at: new Date().toISOString(), reason: String(b.reason || "").slice(0, 200) }, { maxAge: 0 });
  await serverEvent("hosted_reject", { platform: sub.platform, $host: "heistclips.com" });
  return [200, { ok: true }];
}

// ---- the clipper's /earnings page ---------------------------------------------------------------------
async function clipperEarnings(b) {
  const code = String(b.a || "");
  if (!ACCT.test(code) || !(await getAccount(code))) return [404, { ok: false, error: "No heistclips account has that code." }];
  return [200, await earningsOf(code)];
}
const PAYTO = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i;
async function payoutSet(b) {
  const code = String(b.a || "");
  if (!ACCT.test(code) || !(await getAccount(code))) return [404, { ok: false, error: "No heistclips account has that code." }];
  const to = String(b.to || "").trim();
  if (!PAYTO.test(to)) return [400, { ok: false, error: "Type the email address of your PayPal account." }];
  await putJSON(H.P.payout(H.acctHash(code)), { sealed: seal({ to, method: "paypal", at: new Date().toISOString() }), at: new Date().toISOString() }, { maxAge: 0 });
  await serverEvent("payout_set", { method: "paypal", $host: "heistclips.com" });
  return [200, { ok: true }];
}

export default async function handler(req, res) {
  const u = new URL(req.url || "/", SITE);
  const op = u.searchParams.get("op") || "";
  try {
    if (op === "twitch_start") return twitchStart(req, res, u);
    if (op === "twitch_callback") return await twitchCallback(req, res, u);
    if (op === "track") {
      if (!admin(req)) return json(res, 401, { ok: false });
      return json(res, 200, { ok: true, ...(await H.track()) });
    }
    if (op === "payouts") {
      if (!admin(req)) return json(res, 401, { ok: false });
      const { csv, lines } = await H.payoutCsv({ week: u.searchParams.get("week"), unseal });
      if (u.searchParams.get("format") === "json") return json(res, 200, { ok: true, lines });
      res.statusCode = 200; res.setHeader("content-type", "text/csv; charset=utf-8"); res.setHeader("cache-control", "no-store");
      res.setHeader("content-disposition", `attachment; filename="heistclips-payouts-${u.searchParams.get("week") || "all"}.csv"`);
      return res.end(csv);
    }
    if (op === "dash") return json(res, ...(await dash(u.searchParams.get("k"))));
    if (req.method !== "POST") return json(res, 405, { ok: false });
    const b = await body(req);
    if (op === "paid") {
      if (!admin(req)) return json(res, 401, { ok: false });
      if (!/^\d{4}-W\d{2}$/.test(String(b.week || "")) || !/^[0-9a-f]{24}$/.test(String(b.acct || ""))) return json(res, 400, { ok: false });
      await putJSON(H.P.paid(b.week, b.acct), { at: new Date().toISOString(), note: String(b.note || "").slice(0, 120) }, { maxAge: 0 });
      return json(res, 200, { ok: true });
    }
    const ops = { start: ownerStart, check: ownerCheck, checkout: (x) => checkout(x, req), claim, reject, earnings: clipperEarnings, payout: payoutSet,
      pitch: async (x) => { const o = await loadOwner(x.k); if (!o || !o.twitch) return [403, { ok: false, error: "Prove the channel is yours first." }]; return [200, await pitchFor(o.twitch.login)]; } };
    if (!ops[op]) return json(res, 404, { ok: false, error: "unknown op" });
    return json(res, ...(await ops[op](b)));
  } catch (e) {
    console.error("hosted", op, e);
    return json(res, 500, { ok: false, error: "Something broke on our side. Try again in a minute." });
  }
}
