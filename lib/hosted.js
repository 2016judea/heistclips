// Hosted campaigns (DATA_MODEL.md, "Hosted campaigns"): a streamer, manager or studio funds a
// clipping campaign on heistclips; clippers post from an account they verified and submit the
// post through the connector; a cron reads each post's public view count; the ledger turns views
// into earnings. NOTHING here moves money. Payouts are Aidan's, from the admin CSV (no Stripe
// Connect), and no connector tool pays anyone (Claude directory policy §4A).
//
// Storage is the public-read Blob store (lib/store.js), so:
//   - anything private sits under secretPath (a keyed hash) or a random 20-hex id;
//   - nothing is read-modify-written by two writers. Each fact is its own write-once file
//     (funded marker, submission, verified account, owner rejection, paid marker), listed through
//     the Blob API, which is current at once. A public read of an overwritten file can lag 25 s
//     (measured 2026-11-19), so the two files that ARE overwritten (a view curve, a campaign's
//     state) have exactly one writer: the tracker cron.
//   - no raw account code (hc_…) is ever written in a path or a public file: `acct` is a keyed hash.
import crypto from "node:crypto";
import { getJSON, putJSON, listPaths, secretPath } from "./store.js";
import { slugify, GTA_RE, requirementsOf, rank, summarize } from "./campaigns.js";
import { payAtSizes } from "./atsize.js";
import { serverEvent } from "./track.js";

export const MARKET = "heistclips";
export const LABEL = "hosted on heistclips";
export const PLATFORMS = ["tiktok", "youtube"]; // the two we can verify and count from public pages
export const FRESH_HOURS = 48;                  // a post must be this new when it is submitted
export const TRACK_DAYS = 30;                   // views are read for this long after posting
export const LIMITS = { budget: [100, 50000], rate: [0.1, 20], floor: [0, 1000000], cap: [1, 5000], secs: [5, 180] };
// Platform fee on top of the budget, percent. Default 10, Content Rewards' cut (2026-11-20).
export function feePct() {
  const v = Number(process.env.HOSTED_FEE_PCT);
  return process.env.HOSTED_FEE_PCT != null && process.env.HOSTED_FEE_PCT !== "" && Number.isFinite(v) && v >= 0 && v <= 50 ? v : 10;
}

const salt = () => process.env.CREDIT_SALT || process.env.BLOB_READ_WRITE_TOKEN || "dev";
const hmac = (s) => crypto.createHmac("sha256", salt()).update(String(s)).digest("hex");
export const acctHash = (code) => hmac("hosted-acct|" + code).slice(0, 24);
export const ownerHash = (key) => hmac("hosted-owner|" + key).slice(0, 24);
export const OWNER_KEY = /^ho_[A-Za-z0-9_-]{32}$/;
export const newOwnerKey = () => "ho_" + crypto.randomBytes(24).toString("base64url");
export const CAMPAIGN_ID = /^h[0-9a-f]{12}$/;
export const SUB_ID = /^[0-9a-f]{20}$/;
const rnd = (n) => crypto.randomBytes(n).toString("hex");
const cents = (usd) => Math.round(Number(usd) * 100);
const usd = (c) => Math.round(c) / 100;

// ---- paths ------------------------------------------------------------------------------------
export const P = {
  owner: (key) => secretPath("hosted/o", key),
  ownerCampaign: (key, cid) => `hosted/oc/${ownerHash(key)}/${cid}.json`,
  campaign: (cid) => `hosted/c/${cid}.json`,
  funded: (cid) => `hosted/f/${cid}.json`,
  fundedPrivate: (cid) => secretPath("hosted/fp", cid),
  sub: (cid, sid) => `hosted/sub/${cid}/${sid}.json`,
  acctSub: (ah, cid, sid) => `hosted/as/${ah}/${cid}~${sid}.json`,
  postSeen: (platform, id) => `hosted/u/${platform}-${String(id).replace(/[^A-Za-z0-9_-]/g, "")}.json`,
  social: (ah, platform, key) => `hosted/av/${ah}/${platform}-${hmac(platform + "|" + key).slice(0, 16)}.json`,
  views: (sid) => `hosted/v/${sid}.json`,
  rejected: (sid) => `hosted/rej/${sid}.json`,
  state: (cid) => `hosted/state/${cid}.json`,
  payout: (ah) => secretPath("hosted/pay", ah),
  paid: (week, ah) => `hosted/paid/${week}/${ah}.json`,
};

// ---- the owner's verification code ------------------------------------------------------------
// Derived, never stored: the same key and channel always give the same code, so checking it needs
// no pending record. Short enough for a Twitch bio, a TikTok bio (80 chars) or a panel title.
export const ownerCode = (key, login) => "heistclips-" + hmac("owner-code|" + key + "|" + String(login).toLowerCase()).slice(0, 6);
export const clipperCode = (code, platform, handleKey) => "hc-" + hmac("clipper-code|" + code + "|" + platform + "|" + handleKey).slice(0, 6);
export const hasCode = (text, code) => String(text || "").toLowerCase().includes(String(code).toLowerCase());

// ---- the owner's campaign settings --------------------------------------------------------------
const clamp = (x, [lo, hi]) => Math.min(hi, Math.max(lo, x));
const num = (x) => (x === "" || x == null ? NaN : Number(String(x).replace(/[$,\s]/g, "")));
export function parseTags(s) {
  return [...new Set(String(s || "").split(/[\s,]+/).map((t) => t.trim()).filter(Boolean).map((t) => (/^[#@]/.test(t) ? t : "#" + t).toLowerCase().replace(/[^#@a-z0-9_.]/g, "")).filter((t) => t.length > 1))].slice(0, 8);
}

// Raw form -> { ok, rules } or { ok:false, error } with the first thing to fix, in plain words.
export function validateRules(b = {}) {
  const budget = num(b.budget), rate = num(b.rate_per_1k), floor = b.floor_views === "" || b.floor_views == null ? 0 : num(b.floor_views), cap = num(b.cap_per_clip);
  const [bLo, bHi] = LIMITS.budget, [rLo, rHi] = LIMITS.rate, [cLo, cHi] = LIMITS.cap;
  if (!Number.isFinite(budget) || budget < bLo || budget > bHi) return { ok: false, field: "budget", error: `Budget is $${bLo} to $${bHi.toLocaleString("en-US")}.` };
  if (!Number.isFinite(rate) || rate < rLo || rate > rHi) return { ok: false, field: "rate_per_1k", error: `Rate is $${rLo} to $${rHi} per 1,000 views.` };
  if (!Number.isFinite(floor) || floor < 0 || floor > LIMITS.floor[1]) return { ok: false, field: "floor_views", error: "View floor is 0 or more views." };
  if (!Number.isFinite(cap) || cap < cLo || cap > cHi) return { ok: false, field: "cap_per_clip", error: `Cap per clip is $${cLo} to $${cHi.toLocaleString("en-US")}.` };
  if (cap > budget) return { ok: false, field: "cap_per_clip", error: "Cap per clip can't be more than the whole budget." };
  const platforms = (Array.isArray(b.platforms) ? b.platforms : String(b.platforms || "").split(",")).map((p) => String(p).trim().toLowerCase()).filter((p) => PLATFORMS.includes(p));
  if (!platforms.length) return { ok: false, field: "platforms", error: "Pick at least one platform: TikTok or YouTube Shorts." };
  const max_secs = b.max_secs === "" || b.max_secs == null ? null : clamp(Math.round(num(b.max_secs)), LIMITS.secs);
  const min_secs = b.min_secs === "" || b.min_secs == null ? null : clamp(Math.round(num(b.min_secs)), LIMITS.secs);
  if (max_secs != null && !Number.isFinite(max_secs)) return { ok: false, field: "max_secs", error: "Longest clip is a number of seconds." };
  if (min_secs != null && !Number.isFinite(min_secs)) return { ok: false, field: "min_secs", error: "Shortest clip is a number of seconds." };
  if (min_secs != null && max_secs != null && min_secs > max_secs) return { ok: false, field: "min_secs", error: "Shortest clip is longer than the longest." };
  const notes = String(b.notes || "").replace(/\s+/g, " ").trim().slice(0, 400);
  return {
    ok: true,
    rules: {
      budget: usd(cents(budget)), rate_per_1k: usd(cents(rate)), floor_views: Math.round(floor), cap_per_clip: usd(cents(cap)), platforms,
      min_secs, max_secs, facecam_required: b.facecam_required === true || b.facecam_required === "1" || b.facecam_required === "on",
      required_tags: parseTags(b.required_tags), notes,
    },
  };
}

export function fees(budget, pct = feePct()) {
  const b = cents(budget), f = Math.round((b * pct) / 100);
  return { budget: usd(b), fee_pct: pct, fee: usd(f), total: usd(b + f) };
}

// The brief clippers read, written from the settings so lib/rules.js reads the same rules.
export function briefOf(c) {
  const r = c.rules, who = c.channel.name || c.channel.login;
  const plat = r.platforms.map((p) => (p === "youtube" ? "YouTube Shorts" : "TikTok")).join(" or ");
  const lines = [
    `Clips of ${who}'s Twitch streams (twitch.tv/${c.channel.login}), posted on ${plat}.`,
    `Pays $${r.rate_per_1k} per 1,000 views${r.floor_views ? ` once a clip passes ${r.floor_views.toLocaleString("en-US")} views` : " from the first view"}, up to $${r.cap_per_clip} per clip.`,
    r.min_secs || r.max_secs ? `Length: ${r.min_secs ? r.min_secs + " seconds or longer" : ""}${r.min_secs && r.max_secs ? ", " : ""}${r.max_secs ? r.max_secs + " seconds or shorter" : ""}.` : null,
    r.facecam_required ? "Facecam must be visible." : null,
    r.required_tags.length ? `Caption must include: ${r.required_tags.join(" ")}` : null,
    r.notes ? r.notes : null,
    `Post from a TikTok or YouTube account you verified with heistclips, within ${FRESH_HOURS} hours, then submit the link with the heistclips connector (submit_clip). Views are counted from the post's public page; payouts are weekly, on heistclips.com.`,
  ];
  return lines.filter(Boolean).join("\n");
}

export function draftCampaign({ ownerKey, channel, rules, is_gta = false, now = Date.now() }) {
  const id = "h" + rnd(6);
  const title = `${channel.name || channel.login} clips`;
  const f = fees(rules.budget);
  return {
    id, slug: `${slugify(channel.name || channel.login)}-clips-${id}`, title, owner: ownerHash(ownerKey),
    channel: { platform: "twitch", login: channel.login, name: channel.name || channel.login, id: channel.id || null, avatar: channel.avatar || null },
    rules, ...f, is_gta: !!is_gta, created: new Date(now).toISOString(), version: 1,
  };
}

// ---- reads ----------------------------------------------------------------------------------------
const fileId = (p) => p.split("/").pop().replace(/\.json$/, "");
export async function loadCampaign(cid) {
  if (!CAMPAIGN_ID.test(String(cid || ""))) return null;
  return getJSON(P.campaign(cid), { fresh: true }).catch(() => null);
}
export async function loadFunded(cid) {
  if (!CAMPAIGN_ID.test(String(cid || ""))) return null;
  return getJSON(P.funded(cid), { fresh: true }).catch(() => null);
}
export async function fundedIds() { return (await listPaths("hosted/f/")).map(fileId).filter((x) => CAMPAIGN_ID.test(x)); }
export async function subsOf(cid) {
  const paths = await listPaths(`hosted/sub/${cid}/`);
  return (await Promise.all(paths.map((p) => getJSON(p, { fresh: true }).catch(() => null)))).filter(Boolean);
}
export async function rejectedSet(sids) {
  const all = new Set((await listPaths("hosted/rej/")).map(fileId));
  return new Set(sids.filter((s) => all.has(s)));
}
export async function socialsOf(code) {
  const ah = acctHash(code);
  const paths = await listPaths(`hosted/av/${ah}/`);
  return (await Promise.all(paths.map((p) => getJSON(p, { fresh: true }).catch(() => null)))).filter(Boolean);
}

// ---- funding ------------------------------------------------------------------------------------
// Called from the Stripe webhook and from the owner's return (claim): whichever is first writes
// the marker; the other finds it. `session` is a Checkout Session object.
export async function fund(session, via, { relist: doRelist = true, now = Date.now() } = {}) {
  const m = session.metadata || {};
  if (session.payment_status !== "paid" || m.kind !== "hosted" || !CAMPAIGN_ID.test(String(m.campaign || ""))) return { funded: false, why: "not ours or not paid" };
  const c = await loadCampaign(m.campaign);
  if (!c) return { funded: false, why: "no such campaign" };
  const had = await loadFunded(c.id);
  if (had) return { funded: false, already: true, campaign: c.id };
  const rec = { campaign: c.id, at: new Date(now).toISOString(), budget: c.budget, fee: c.fee, fee_pct: c.fee_pct, total: c.total, livemode: !!session.livemode, via, amount_paid: session.amount_total != null ? session.amount_total / 100 : null, currency: session.currency || "usd" };
  await putJSON(P.funded(c.id), rec, { maxAge: 0 });
  // Who paid stays out of the public path: email and session under a keyed one.
  await putJSON(P.fundedPrivate(c.id), { session: session.id, email: (session.customer_details && session.customer_details.email) || null, at: rec.at }, { maxAge: 0 }).catch(() => null);
  await serverEvent("hosted_campaign_paid", { budget: c.budget, fee: c.fee, fee_pct: c.fee_pct, livemode: !!session.livemode, via, $host: "heistclips.com" });
  if (doRelist) await relist().catch(() => null);
  return { funded: true, campaign: c.id, rec };
}

// ---- the campaign as the ranker sees it -------------------------------------------------------
// Same fields lib/campaigns.js normalize() gives every other marketplace, so rank(), plan_my_clips,
// the campaign page and the connector treat it the same way. It is ranked only by what it pays the
// clipper, exactly like the rest: never "sponsored", never boosted (Claude directory policy §4C).
export function toCampaign(c, funded, st = null, now = Date.now()) {
  const r = c.rules;
  const spent = st ? st.earned : 0;
  const budget_left = Math.max(0, usd(cents(c.budget) - cents(spent)));
  const launched = Date.parse(funded.at) || now;
  const days_live = Math.max(1, (now - launched) / 86400000);
  const burn = spent / days_live;
  const days_left = burn > 0 ? budget_left / burn : null;
  const counting = st ? st.counting : 0;
  const description = briefOf(c);
  const out = {
    id: c.id, marketplace: MARKET, hosted: true, hosted_label: LABEL, slug: c.slug, title: c.title,
    owner: c.channel.name, owner_handle: c.channel.login, owner_verified: true, description,
    categories: ["Gaming", "Twitch"], platforms: r.platforms, payout_type: "cpm", geo_priced: false,
    rate_per_1k: r.rate_per_1k, per_post: null, cap_per_clip: r.cap_per_clip,
    payouts: r.platforms.map((p) => ({ platform: p, type: "cpm", rate_per_1k: r.rate_per_1k, cap_per_clip: r.cap_per_clip, min_payout: 0 })),
    budget_total: c.budget, budget_spent: usd(cents(spent)), budget_left, burn_per_day: usd(cents(burn)),
    days_left: days_left == null ? null : Math.round(days_left * 10) / 10,
    clippers_count: st ? st.clippers : 0, approved_clips: counting, total_views: st ? st.views : 0,
    views_per_clip: counting ? Math.round((st.views || 0) / counting) : null, views_7d: null, clips_7d: null,
    top_clip_views: st ? st.top_views || 0 : 0,
    // A typical clip's pay needs a track record, as on Content Rewards: 5 clips past the top 3.
    earned_per_clip: st && st.typical != null ? st.typical : null, avg_per_clip: counting ? usd(cents(spent / counting)) : null,
    expected_per_clip: st && st.typical != null ? st.typical : null,
    approval_required: false,
    requirements: [...new Set([...requirementsOf(description), ...(r.required_tags.length ? ["tags/caption rule"] : []), ...(r.max_secs || r.min_secs ? ["length rule"] : []), ...(r.facecam_required ? ["facecam"] : [])])],
    paid_out: st ? st.paid || 0 : 0, hours_left: days_left == null ? null : Math.round(days_left * 24),
    is_gta: !!c.is_gta || GTA_RE.test(c.title), is_gaming: true,
    launched_at: new Date(launched).toISOString(), updated_at: st ? st.at : funded.at, metrics_at: st ? st.at : null,
    source_url: `https://heistclips.com/campaigns/${c.slug}`, source_channels: [`https://www.twitch.tv/${c.channel.login}`],
    settings_read: true, min_clip_views: r.floor_views || 0, pool_total_views: null, hidden_rules: 0, hidden_references: 0,
    rules: { ...r, fresh_hours: FRESH_HOURS }, submit_with: "submit_clip",
  };
  return Object.assign(out, payAtSizes(out));
}

// Every funded campaign as a ranker row (budget left 0 included: rank() drops it).
export async function hostedCampaigns(now = Date.now()) {
  const ids = await fundedIds();
  const rows = await Promise.all(ids.map(async (id) => {
    const [c, f, st] = await Promise.all([loadCampaign(id), loadFunded(id), getJSON(P.state(id), { fresh: true }).catch(() => null)]);
    return c && f ? toCampaign(c, f, st, now) : null;
  }));
  return rows.filter(Boolean);
}

// Put the current hosted rows into the live snapshot now, instead of waiting for the 30-minute
// refresh (which merges them too). Used after a campaign is funded and after each tracker run.
export async function relist(now = Date.now()) {
  const snap = await getJSON("snapshot/latest.json", { fresh: true });
  if (!snap || !Array.isArray(snap.campaigns)) return { relisted: false };
  const rows = await hostedCampaigns(now);
  const rest = snap.campaigns.filter((c) => c.marketplace !== MARKET);
  snap.campaigns = rank([...rest, ...rows]);
  snap.summary = summarize(snap.campaigns);
  await putJSON("snapshot/latest.json", snap, { maxAge: 60 });
  return { relisted: true, hosted: rows.length };
}

// ---- posts: parse, read, check ----------------------------------------------------------------
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// A pasted link -> { platform, id, handle? } or null. Short TikTok links are resolved by readPost.
export function parsePost(raw) {
  const s = String(raw || "").trim();
  let m;
  if ((m = s.match(/(?:youtube\.com\/(?:shorts\/|watch\?(?:[^#]*&)?v=|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/))) return { platform: "youtube", id: m[1], url: `https://www.youtube.com/shorts/${m[1]}` };
  if ((m = s.match(/tiktok\.com\/@([A-Za-z0-9._]{2,24})\/(?:video|photo)\/(\d{8,25})/))) return { platform: "tiktok", id: m[2], handle: m[1].toLowerCase(), url: `https://www.tiktok.com/@${m[1]}/video/${m[2]}` };
  if ((m = s.match(/(?:vm|vt)\.tiktok\.com\/([A-Za-z0-9]+)|tiktok\.com\/t\/([A-Za-z0-9]+)/))) return { platform: "tiktok", short: true, url: s.startsWith("http") ? s : "https://" + s.replace(/^\/+/, "") };
  return null;
}

// A handle the clipper typed -> the key we store it under. TikTok: the @name. YouTube: the @handle
// or a UC… channel id.
export function parseHandle(platform, raw) {
  const s = String(raw || "").trim();
  let m;
  if (platform === "tiktok") {
    m = s.match(/tiktok\.com\/@([A-Za-z0-9._]{2,24})/) || s.match(/^@?([A-Za-z0-9._]{2,24})$/);
    return m ? { platform, handle: m[1].toLowerCase(), key: m[1].toLowerCase() } : null;
  }
  if (platform === "youtube") {
    if ((m = s.match(/youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})/) || s.match(/^(UC[A-Za-z0-9_-]{22})$/))) return { platform, channel_id: m[1], key: m[1] };
    m = s.match(/youtube\.com\/@([A-Za-z0-9._-]{3,30})/) || s.match(/^@?([A-Za-z0-9._-]{3,30})$/);
    return m ? { platform, handle: m[1].toLowerCase(), key: "@" + m[1].toLowerCase() } : null;
  }
  return null;
}

async function getText(url, { redirect = "follow" } = {}) {
  const r = await fetch(url, { headers: { "user-agent": UA, "accept-language": "en-US,en" }, redirect, signal: AbortSignal.timeout(15000) });
  return { status: r.status, url: r.url, location: r.headers.get("location"), text: redirect === "manual" ? "" : await r.text() };
}

// TikTok's public pages carry everything in one JSON blob (read from Vercel iad1, 2026-11-20).
export function tiktokBlob(html) {
  const m = String(html).match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try { return JSON.parse(m[1]).__DEFAULT_SCOPE__ || null; } catch (e) { return null; }
}
export function tiktokPostOf(html) {
  const d = tiktokBlob(html);
  const it = d && d["webapp.video-detail"] && d["webapp.video-detail"].itemInfo && d["webapp.video-detail"].itemInfo.itemStruct;
  if (!it || !it.id) return null;
  const st = it.statsV2 || it.stats || {};
  const n = (x) => (x == null || x === "" ? null : Number(x));
  return {
    platform: "tiktok", id: String(it.id), author: String((it.author && it.author.uniqueId) || "").toLowerCase(),
    created_ms: Number(it.createTime) * 1000 || null, text: String(it.desc || ""), secs: n(it.video && it.video.duration),
    views: n(st.playCount), likes: n(st.diggCount), comments: n(st.commentCount),
  };
}
export function tiktokUserOf(html) {
  const d = tiktokBlob(html);
  const u = d && d["webapp.user-detail"] && d["webapp.user-detail"].userInfo && d["webapp.user-detail"].userInfo.user;
  return u && u.uniqueId ? { handle: String(u.uniqueId).toLowerCase(), bio: String(u.signature || ""), name: u.nickname || u.uniqueId, id: u.id } : null;
}

// One post's public facts. deps.fetchText / deps.ytApi let tests run without the network.
export async function readPost(p, deps = {}) {
  const fetchText = deps.fetchText || getText;
  if (p.platform === "tiktok") {
    let url = p.url;
    if (p.short) {
      const r = await fetchText(url, { redirect: "manual" });
      const loc = r.location || r.url || "";
      const q = parsePost(loc);
      if (!q || q.platform !== "tiktok" || q.short) return { ok: false, err: "post_unreadable", why: "That TikTok short link did not lead to a video." };
      p = q; url = q.url;
    }
    const r = await fetchText(url);
    const post = r.status === 200 ? tiktokPostOf(r.text) : null;
    if (!post) return { ok: false, err: "post_unreadable", why: r.status === 404 ? "TikTok says that video does not exist (deleted or private)." : "TikTok's page for that video did not show the post (private, deleted, or TikTok refused the read). Make sure it is public." };
    return { ok: true, post: { ...post, url } };
  }
  if (p.platform === "youtube") {
    const api = deps.ytApi || (await import("./youtube.js")).ytApi;
    const d = await api("videos", { part: "snippet,contentDetails,statistics", id: p.id, maxResults: 1 });
    const it = d.items && d.items[0];
    if (!it) return { ok: false, err: "post_unreadable", why: "YouTube has no public video with that link (private, deleted, or mistyped)." };
    return { ok: true, post: youtubePostOf(it, p.url) };
  }
  return { ok: false, err: "bad_link" };
}
export function youtubePostOf(it, url) {
  const sn = it.snippet || {}, st = it.statistics || {};
  const d = String((it.contentDetails && it.contentDetails.duration) || "").match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  const secs = d ? Number(d[1] || 0) * 86400 + Number(d[2] || 0) * 3600 + Number(d[3] || 0) * 60 + Number(d[4] || 0) : null;
  const n = (x) => (x == null ? null : Number(x));
  return {
    platform: "youtube", id: it.id, channel_id: sn.channelId, author: String(sn.channelTitle || ""), created_ms: Date.parse(sn.publishedAt) || null,
    text: `${sn.title || ""}\n${sn.description || ""}\n${(sn.tags || []).map((t) => "#" + t).join(" ")}`, secs,
    views: n(st.viewCount), likes: n(st.likeCount), comments: n(st.commentCount), url: url || `https://www.youtube.com/shorts/${it.id}`,
  };
}

// The public bio of a TikTok or YouTube account, for verify_account.
export async function readBio(h, deps = {}) {
  const fetchText = deps.fetchText || getText;
  if (h.platform === "tiktok") {
    const r = await fetchText(`https://www.tiktok.com/@${h.handle}`);
    const u = r.status === 200 ? tiktokUserOf(r.text) : null;
    return u ? { ok: true, handle: u.handle, bio: u.bio, name: u.name, key: u.handle } : { ok: false, err: "no_profile" };
  }
  if (h.platform === "youtube") {
    const api = deps.ytApi || (await import("./youtube.js")).ytApi;
    const d = await api("channels", { part: "snippet", ...(h.channel_id ? { id: h.channel_id } : { forHandle: "@" + h.handle }) });
    const c = d.items && d.items[0];
    if (!c) return { ok: false, err: "no_profile" };
    return { ok: true, channel_id: c.id, handle: String((c.snippet && c.snippet.customUrl) || "").replace(/^@/, "").toLowerCase() || null, bio: String((c.snippet && c.snippet.description) || ""), name: c.snippet && c.snippet.title, key: c.id };
  }
  return { ok: false, err: "bad_platform" };
}

// Is this post the verified account's? TikTok by handle, YouTube by channel id.
export function ownsPost(socials, post) {
  return socials.find((s) => s.platform === post.platform && (post.platform === "youtube" ? s.channel_id === post.channel_id : s.handle === post.author)) || null;
}

// Every rule a machine can check, in order. -> { ok, reasons:[{code, why, fix}], checks }
export function checkPost(c, funded, post, { now = Date.now() } = {}) {
  const r = c.rules, reasons = [], checks = {};
  const bad = (code, why, fix) => reasons.push({ code, why, fix });
  if (!r.platforms.includes(post.platform)) bad("wrong_platform", `This campaign pays on ${r.platforms.join(" and ")}, not ${post.platform}.`, `Post it on ${r.platforms.join(" or ")} and submit that link.`);
  checks.platform = r.platforms.includes(post.platform);
  const opened = Date.parse(funded.at) || 0;
  if (post.created_ms != null) {
    const ageH = (now - post.created_ms) / 3.6e6;
    checks.posted_hours_ago = Math.round(ageH * 10) / 10;
    if (post.created_ms < opened - 5 * 60000) bad("before_campaign", "It was posted before this campaign opened.", "Post a new clip and submit that.");
    else if (ageH > FRESH_HOURS) bad("not_fresh", `It was posted ${Math.round(ageH)} hours ago; this campaign takes posts up to ${FRESH_HOURS} hours old.`, "Submit right after you post.");
  }
  if (post.secs != null) {
    checks.secs = post.secs;
    if (r.max_secs && post.secs > r.max_secs + 1) bad("too_long", `It is ${post.secs} seconds; the longest this campaign takes is ${r.max_secs}.`, `Cut it to ${r.max_secs} seconds or less.`);
    if (r.min_secs && post.secs < r.min_secs - 1) bad("too_short", `It is ${post.secs} seconds; the shortest this campaign takes is ${r.min_secs}.`, `Make it at least ${r.min_secs} seconds.`);
  }
  const text = String(post.text || "").toLowerCase();
  const missing = r.required_tags.filter((t) => !new RegExp("(^|[^a-z0-9_])" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "($|[^a-z0-9_])").test(text));
  checks.tags_missing = missing;
  if (missing.length) bad("missing_tags", `The caption is missing ${missing.join(" ")}.`, `Edit the caption to include ${missing.join(" ")}, then submit again.`);
  return { ok: !reasons.length, reasons, checks };
}

// ---- view curve + suspect flag ----------------------------------------------------------------
// readings: [[at_ms, views, likes, comments]], oldest first.
export const SPIKE_MIN_VIEWS = 10000;  // a jump smaller than this is never flagged
export const SPIKE_X = 8;              // ... nor one under 8x the earlier pace
export const LOW_ENGAGEMENT = 0.001;   // likes + comments under 0.1% of views past 20,000
export function suspectOf(readings) {
  const rs = (readings || []).filter((x) => x && Number.isFinite(x[1]));
  for (let i = 2; i < rs.length; i++) {
    const rates = [];
    for (let j = 1; j < i; j++) { const dh = (rs[j][0] - rs[j - 1][0]) / 3.6e6; if (dh > 0) rates.push(Math.max(0, rs[j][1] - rs[j - 1][1]) / dh); }
    const dh = (rs[i][0] - rs[i - 1][0]) / 3.6e6, dv = rs[i][1] - rs[i - 1][1];
    if (dh <= 0 || !rates.length) continue;
    const med = rates.slice().sort((a, b) => a - b)[Math.floor(rates.length / 2)];
    const pace = dv / dh;
    if (dv >= SPIKE_MIN_VIEWS && pace >= SPIKE_X * Math.max(med, 200)) {
      return { at: new Date(rs[i][0]).toISOString(), reason: `+${dv.toLocaleString("en-US")} views in ${dh < 1 ? Math.round(dh * 60) + " min" : Math.round(dh * 10) / 10 + " h"}, ${Math.round(pace / Math.max(med, 1))}x its earlier pace` };
    }
  }
  const last = rs[rs.length - 1];
  if (last && last[1] >= 20000 && last[2] != null && last[3] != null && (last[2] + last[3]) / last[1] < LOW_ENGAGEMENT) {
    return { at: new Date(last[0]).toISOString(), reason: `${last[1].toLocaleString("en-US")} views but only ${(last[2] + last[3]).toLocaleString("en-US")} likes and comments` };
  }
  return null;
}

// ---- the ledger -------------------------------------------------------------------------------
// Replays every reading of every counting submission of one campaign in time order. A clip's
// target is rate x views / 1000 once it has passed the floor, capped per clip; each reading adds
// target minus what it already earned, while the budget lasts. Deterministic: the same readings
// always give the same lines, so nothing is stored but the readings.
export function ledger(c, subs, curves, rejected = new Set()) {
  const r = c.rules, floor = r.floor_views || 0, cap = cents(r.cap_per_clip);
  const ev = [];
  for (const s of subs) {
    if (rejected.has(s.id)) continue;
    for (const x of (curves[s.id] && curves[s.id].readings) || []) if (Number.isFinite(x[1])) ev.push({ at: x[0], sid: s.id, views: x[1] });
  }
  ev.sort((a, b) => a.at - b.at || (a.sid < b.sid ? -1 : 1));
  let left = cents(c.budget);
  const earned = {}, lines = [];
  for (const e of ev) {
    const target = e.views >= floor ? Math.min(cap, Math.floor((r.rate_per_1k * 100 * e.views) / 1000)) : 0;
    const inc = Math.min(Math.max(0, target - (earned[e.sid] || 0)), left);
    if (inc > 0) { earned[e.sid] = (earned[e.sid] || 0) + inc; left -= inc; lines.push({ sid: e.sid, at: e.at, cents: inc }); }
  }
  return { earned_cents: earned, left_cents: left, spent_cents: cents(c.budget) - left, lines };
}

export function isoWeek(ms) {
  const d = new Date(ms); d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const y = d.getUTCFullYear(), w = Math.ceil(((d - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
  return `${y}-W${String(w).padStart(2, "0")}`;
}

// Campaign state (one writer: the tracker) from its submissions, curves and rejections.
export function stateOf(c, subs, curves, rejected, now = Date.now()) {
  const L = ledger(c, subs, curves, rejected);
  const rows = subs.map((s) => {
    const cv = curves[s.id] || {}, rs = cv.readings || [], last = rs[rs.length - 1];
    return { sid: s.id, acct: s.acct, platform: s.platform, url: s.url, posted_at: s.posted_at, submitted_at: s.submitted_at,
      views: last ? last[1] : null, read_at: last ? new Date(last[0]).toISOString() : null, earned: usd(L.earned_cents[s.id] || 0),
      rejected: rejected.has(s.id), suspect: cv.suspect || null, checks: s.checks || {} };
  });
  const counting = rows.filter((x) => !x.rejected);
  const earnedClips = counting.map((x) => x.earned).sort((a, b) => b - a);
  // Typical pay per clip, as the ranker computes it for Content Rewards: top three earners out, 5+ clips left.
  const rest = earnedClips.slice(3);
  const typical = rest.length >= 5 ? usd(cents(rest.reduce((a, x) => a + x, 0) / rest.length)) : null;
  return {
    campaign: c.id, at: new Date(now).toISOString(), earned: usd(L.spent_cents), left: usd(L.left_cents), budget: c.budget,
    counting: counting.length, rejected: rows.length - counting.length, clippers: new Set(counting.map((x) => x.acct)).size,
    views: counting.reduce((a, x) => a + (x.views || 0), 0), top_views: Math.max(0, ...counting.map((x) => x.views || 0)),
    suspect: counting.filter((x) => x.suspect).length, typical, subs: rows,
    lines: L.lines.map((l) => ({ sid: l.sid, at: l.at, cents: l.cents })),
  };
}

// ---- payout lines -----------------------------------------------------------------------------
// From every campaign's state: what each clipper earned per ISO week. A line whose clips include
// a suspect one carries that amount as `held`, for Aidan to look at before paying.
export function payoutLines(states) {
  const out = new Map();
  for (const st of states) {
    const bySid = Object.fromEntries((st.subs || []).map((s) => [s.sid, s]));
    for (const l of st.lines || []) {
      const s = bySid[l.sid];
      if (!s || s.rejected) continue;
      const week = isoWeek(l.at), k = week + "|" + s.acct;
      const row = out.get(k) || { week, acct: s.acct, cents: 0, held_cents: 0, clips: new Set(), campaigns: new Set() };
      row.cents += l.cents; if (s.suspect) row.held_cents += l.cents;
      row.clips.add(l.sid); row.campaigns.add(st.campaign);
      out.set(k, row);
    }
  }
  return [...out.values()].map((r) => ({ week: r.week, acct: r.acct, amount: usd(r.cents), held: usd(r.held_cents), clips: r.clips.size, campaigns: [...r.campaigns] }))
    .sort((a, b) => (a.week < b.week ? -1 : a.week > b.week ? 1 : b.amount - a.amount));
}

export function csvOf(lines, extra = {}) {
  const q = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const head = ["week", "clipper", "payout_to", "amount_usd", "held_for_review_usd", "clips", "campaigns", "paid_at"];
  return [head.join(","), ...lines.map((l) => [l.week, l.acct, (extra.payTo && extra.payTo[l.acct]) || "", l.amount.toFixed(2), l.held.toFixed(2), l.clips, l.campaigns.join(" "), (extra.paid && extra.paid[l.week + "|" + l.acct]) || ""].map(q).join(","))].join("\n") + "\n";
}

// ---- the tracker ------------------------------------------------------------------------------
// Cron: read every live submission's public view count, keep the curve, flag spikes, write each
// campaign's state, put the rows into the snapshot. One writer for v/ and state/ files.
async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k).catch((e) => ({ error: String(e.message || e) })); } }));
  return out;
}

export async function track({ now = Date.now(), deps = {} } = {}) {
  const ids = await fundedIds();
  const report = { campaigns: 0, read: 0, failed: 0, suspect: 0, youtube_calls: 0 };
  const api = deps.ytApi || (await import("./youtube.js")).ytApi;
  for (const cid of ids) {
    const c = await loadCampaign(cid);
    if (!c) continue;
    report.campaigns++;
    const subs = await subsOf(cid);
    const rejected = await rejectedSet(subs.map((s) => s.id));
    const curves = {};
    await Promise.all(subs.map(async (s) => { curves[s.id] = (await getJSON(P.views(s.id), { fresh: true }).catch(() => null)) || { sid: s.id, readings: [] }; }));
    const live = subs.filter((s) => !rejected.has(s.id) && now - (Date.parse(s.posted_at) || now) < TRACK_DAYS * 86400000);
    const st0 = stateOf(c, subs, curves, rejected, now);
    const budgetOut = st0.left <= 0;
    const fresh = new Map(); // sid -> [views, likes, comments]
    if (!budgetOut) {
      const yt = live.filter((s) => s.platform === "youtube");
      for (let i = 0; i < yt.length; i += 50) {
        const batch = yt.slice(i, i + 50);
        try {
          const d = await api("videos", { part: "statistics", id: batch.map((s) => s.post_id).join(","), maxResults: 50 });
          report.youtube_calls++;
          for (const it of d.items || []) {
            const s = batch.find((x) => x.post_id === it.id), st = it.statistics || {};
            if (s && st.viewCount != null) fresh.set(s.id, [Number(st.viewCount), st.likeCount != null ? Number(st.likeCount) : null, st.commentCount != null ? Number(st.commentCount) : null]);
          }
        } catch (e) { report.failed += batch.length; }
      }
      const tt = live.filter((s) => s.platform === "tiktok");
      await pool(tt, 4, async (s) => {
        const r = await readPost({ platform: "tiktok", url: s.url }, deps);
        if (r.ok && r.post.views != null) fresh.set(s.id, [r.post.views, r.post.likes, r.post.comments]);
        else report.failed++;
      });
    }
    for (const s of live) {
      const v = fresh.get(s.id);
      if (!v) continue;
      const cv = curves[s.id];
      cv.readings.push([now, ...v]);
      if (cv.readings.length > 400) cv.readings = [cv.readings[0], ...cv.readings.slice(-399)];
      const sus = cv.suspect || suspectOf(cv.readings);
      if (sus && !cv.suspect) { cv.suspect = sus; report.suspect++; }
      await putJSON(P.views(s.id), cv, { maxAge: 0 });
      report.read++;
    }
    const st = stateOf(c, subs, curves, rejected, now);
    await putJSON(P.state(cid), st, { maxAge: 0 });
  }
  if (ids.length) await relist(now).catch(() => null);
  return report;
}

// The weekly CSV for Aidan: payout lines across every campaign, with where to send each and
// whether it is already marked paid. `unseal` decrypts the payout destination.
export async function payoutCsv({ week = null, unseal } = {}) {
  const ids = await fundedIds();
  const states = (await Promise.all(ids.map((id) => getJSON(P.state(id), { fresh: true }).catch(() => null)))).filter(Boolean);
  let lines = payoutLines(states);
  if (week) lines = lines.filter((l) => l.week === week);
  const payTo = {}, paid = {};
  const paidPaths = await listPaths("hosted/paid/");
  for (const p of paidPaths) { const m = p.match(/^hosted\/paid\/([^/]+)\/([0-9a-f]{24})\.json$/); if (m) paid[m[1] + "|" + m[2]] = "yes"; }
  for (const ah of new Set(lines.map((l) => l.acct))) {
    const rec = await getJSON(P.payout(ah), { fresh: true }).catch(() => null);
    if (rec && rec.sealed && unseal) { try { payTo[ah] = unseal(rec.sealed).to; } catch (e) { payTo[ah] = "(unreadable)"; } }
  }
  return { csv: csvOf(lines, { payTo, paid }), lines };
}
