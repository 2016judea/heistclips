// Autopilot, the I/O part: watchlists, the per-channel scan, and the notifications.
// DATA_MODEL.md ("Autopilot") names the entities. Storage is Vercel Blob (lib/store.js):
//   watch/u/<keyed hash of the queue key>.json   one clipper's watchlist + item states (private:
//                                                unguessable path, the same pattern as credits)
//   watch/ch/<platform>_<login>.json             one watched channel's moments. Public stream
//                                                data only, shared by everyone who watches it,
//                                                so 100 people watching one streamer is one scan.
//   watch/index/<keyed hash>.json                the cron's cache of who watches what
import crypto from "node:crypto";
import { getJSON, putJSON, secretPath } from "./store.js";
import { getChannel, chatCurve, findPeaks, refinePeak, twitchClips, hooks } from "../public/js/twitch.js";
import { getKickChannel } from "../public/js/kick.js";
import { chanKey, parseChanKey } from "./autopilot.js";

export const MAX_CHANNELS = 12;          // per watchlist
export const KEEP_MOMENTS = 30;          // per channel
export const FIRST_SCAN_S = 6 * 3600;    // a first scan reads at most the last 6 h of the stream
export const RESCAN_MIN_S = 9 * 60;
export const MIN_RATIO = 2;              // chat at least 2x its normal speed, after the close re-read      // a channel is not re-read more often than this
const API = "https://blob.vercel-storage.com/";
const SITE = "https://heistclips.com";

// ---- identity ------------------------------------------------------------------------------
export const newKey = () => crypto.randomBytes(18).toString("base64url");
export const validKey = (k) => typeof k === "string" && /^[A-Za-z0-9_-]{20,40}$/.test(k);
export const userPath = (k) => secretPath("watch/u", k);
export const chanPath = (key) => { const { platform, login } = parseChanKey(key); return `watch/ch/${platform}_${login.replace(/[^a-z0-9_-]/g, "")}.json`; };

const warm = new Map(); // Blob reads lag writes by seconds; a warm instance remembers its own write.
export async function loadWatch(k) {
  if (!validKey(k)) return null;
  const w = warm.get(k);
  if (w && Date.now() - w.at < 30000) return structuredClone(w.data);
  return getJSON(userPath(k), { fresh: true }).catch(() => null);
}
export async function saveWatch(w) {
  w.updated_at = new Date().toISOString();
  warm.set(w.k, { at: Date.now(), data: structuredClone(w) });
  if (warm.size > 200) warm.delete(warm.keys().next().value);
  await putJSON(userPath(w.k), w, { maxAge: 0 });
  return w;
}
export function newWatch(device) {
  return { v: 1, k: newKey(), created_at: new Date().toISOString(), devices: device ? [String(device).slice(0, 80)] : [], channels: [], campaigns: [], items: {}, notify: { email: null, email_ok: false, push: [], last_sent: null, seen_at: null } };
}

// "kaicenat", "twitch.tv/kaicenat", "kick.com/xqc", "kick:xqc" -> a channel key, or null.
export function parseChannelInput(raw) {
  const s = String(raw || "").trim().toLowerCase();
  let m = s.match(/^(?:https?:\/\/)?(?:www\.)?kick\.com\/([a-z0-9_-]{2,40})\/?$/) || s.match(/^kick:([a-z0-9_-]{2,40})$/);
  if (m) return chanKey("kick", m[1]);
  m = s.match(/^(?:https?:\/\/)?(?:www\.|m\.)?twitch\.tv\/([a-z0-9_]{3,25})\/?$/) || s.match(/^(?:twitch:)?@?([a-z0-9_]{3,25})$/);
  if (m) return chanKey("twitch", m[1]);
  return null;
}

// ---- one channel's scan ----------------------------------------------------------------------
async function lookup(key) {
  const { platform, login } = parseChanKey(key);
  return platform === "kick" ? getKickChannel(login) : getChannel(login);
}

const overlap = (a, b) => a.vod_id === b.vod_id && a.t_start < b.t_end - 10 && a.t_end > b.t_start + 10;

function quoteOf(m) {
  const tally = new Map();
  for (const x of m.chat || []) {
    if (x.t < m.t_peak - 12 || x.t > m.t_peak + 10) continue;
    const k = x.text.trim().replace(/\s+/g, " ");
    if (k && k.length <= 40) tally.set(k, (tally.get(k) || 0) + 1);
  }
  return [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t, n]) => ({ t, n }));
}

// Read one stretch of one VOD and return the moments in it, shaped like findMoments' output.
async function scanStretch(vod, from, to, { k, first }) {
  const span = to - from;
  const kick = vod.platform === "kick";
  const step = kick ? Math.max(30, Math.ceil((span + 600) / 100)) : first ? (span > 4 * 3600 ? 20 : 10) : 10;
  const { samples } = await chatCurve(vod, { step, from: Math.max(0, from - 600), to });
  const peaks = findPeaks(samples, { k: kick ? Math.min(k, 4) : k, gap: kick ? Math.max(90, step * 1.5) : 90 }).filter((p) => p.t >= from - 20 && p.t <= to);
  const out = [];
  for (let i = 0; i < peaks.length; i += kick ? 1 : 3) {
    const batch = await Promise.all(peaks.slice(i, i + (kick ? 1 : 3)).map((p) => refinePeak({ ...vod, length: to + 45 }, p, kick ? { before: 50, after: 20 } : {}).catch(() => null)));
    for (const m of batch) if (m) out.push(m);
  }
  out.sort((a, b) => b.chat_ratio - a.chat_ratio);
  for (let i = out.length - 1; i >= 0; i--) if (out.some((b, j) => j < i && overlap(out[i], b))) out.splice(i, 1);
  return out;
}

// Scan a watched channel: find the stream to read (live one, else the newest saved), read only
// what has not been read, merge the new moments into the channel's file. Returns what changed.
export async function scanChannel(key, { force = false, now = Date.now() } = {}) {
  const prev = (await getJSON(chanPath(key), { fresh: true }).catch(() => null)) || { key, moments: [], vods: {} };
  if (!force && prev.scanned_at && now - Date.parse(prev.scanned_at) < RESCAN_MIN_S * 1000) return { key, skipped: "fresh", fresh: [], missing: !!prev.missing, is_live: !!prev.is_live, note: prev.note || null };
  const chan = await lookup(key);
  const { platform, login } = parseChanKey(key);
  const st = { ...prev, key, platform, login, scanned_at: new Date(now).toISOString() };
  if (!chan) { st.missing = true; await putJSON(chanPath(key), st, { maxAge: 30 }); return { key, missing: true, fresh: [] }; }
  st.missing = false; st.name = chan.name; st.avatar = chan.avatar; st.is_live = !!chan.is_live;
  st.stream = chan.stream ? { title: chan.stream.title, game: chan.stream.game, viewers: chan.stream.viewers } : null;
  const targets = [];
  if (chan.live_vod) targets.push(chan.live_vod);
  // A stream that ended since the last scan still has an unread tail.
  for (const v of chan.vods || []) if (!targets.some((t) => t.id === v.id) && (targets.length === 0 || (prev.vods[v.id] && prev.vods[v.id].status === "RECORDING"))) targets.push(v);
  if (chan.is_live && !chan.live_vod) st.note = "live, but this channel does not save streams, so there is no video to cut";
  else delete st.note;
  const fresh = [];
  let requests = 0;
  for (const vod of targets.slice(0, 2)) {
    if (platform !== "kick" && !vod.cdn) { st.note = "the newest stream's video is not public"; continue; }
    const live = vod.status === "RECORDING";
    const seen = prev.vods[vod.id];
    const to = Math.floor(live ? vod.length - 45 : vod.length); // chat needs time to react
    const from = seen ? seen.scanned_to : Math.max(0, to - FIRST_SCAN_S);
    st.vods = { ...st.vods, [vod.id]: { scanned_to: seen ? seen.scanned_to : from, length: vod.length, status: vod.status, title: vod.title, game: vod.game, created_at: vod.created_at } };
    if (to - from < 90) continue;
    let ms;
    try { ms = await scanStretch(vod, from, to, { k: seen ? 4 : 10, first: !seen }); }
    catch (e) { st.error = String(e.message || e).slice(0, 120); continue; }
    delete st.error;
    requests += Math.ceil((to - from + 600) / 10);
    st.vods[vod.id].scanned_to = to;
    const clips = platform !== "kick" && ms.length ? await twitchClips(login, vod.id) : [];
    for (const m of ms) {
      if (m.chat_ratio < MIN_RATIO) continue; // a queue is for clear spikes, not every ripple
      if ((prev.moments || []).some((o) => overlap(o, m)) || fresh.some((o) => overlap(o, m))) continue;
      const over = clips.filter((c) => c.t_start < m.t_end && c.t_end > m.t_start);
      m.twitch_clips = over.length;
      m.twitch_clip_views = over.reduce((a, c) => a + (c.views || 0), 0);
      m.hooks = hooks(m, chan.name);
      m.score = Math.round(m.chat_ratio * 10 * (1 + Math.min(5, m.clip_requests) * 0.4) * (1 + Math.log10(1 + m.twitch_clip_views) * 0.3)) / 10;
      m.id = `${vod.id}_${Math.round(m.t_start)}`;
      m.platform = platform;
      m.vod_title = vod.title; m.vod_created_at = vod.created_at;
      // The game at scan time for a live stream; the VOD's own game otherwise.
      m.game = (live && chan.stream && chan.stream.game) || vod.game || null;
      m.live = live;
      m.found_at = new Date(now).toISOString();
      m.quote = quoteOf(m);
      // The overlay needs chat across the whole clip, not its first second: thin a fast chat evenly.
      const every = Math.max(1, Math.ceil((m.chat || []).length / 150));
      m.chat = (m.chat || []).filter((_, i) => i % every === 0).slice(0, 150).map((x) => ({ t: x.t, text: String(x.text).slice(0, 120) }));
      fresh.push(m);
    }
  }
  // Keep the newest; drop anything from a stream older than 10 days (Twitch deletes VODs).
  const all = [...fresh, ...(prev.moments || [])].filter((m) => now - Date.parse(m.vod_created_at || m.found_at) < 10 * 86400000);
  all.sort((a, b) => Date.parse(b.found_at) - Date.parse(a.found_at) || b.score - a.score);
  st.moments = all.slice(0, KEEP_MOMENTS);
  const ids = new Set(Object.keys(st.vods)); // forget VODs no moment points at, except current targets
  for (const id of ids) if (!targets.some((t) => t.id === id) && !st.moments.some((m) => m.vod_id === id)) delete st.vods[id];
  await putJSON(chanPath(key), st, { maxAge: 30 });
  return { key, name: st.name, is_live: st.is_live, fresh, requests, note: st.note || null, error: st.error || null };
}

export async function loadChannel(key) {
  return getJSON(chanPath(key), { fresh: true }).catch(() => null);
}

// ---- the union of everyone's watchlists (cron only) -------------------------------------------
async function listBlobs(prefix) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const out = [];
  let cursor = "";
  for (let page = 0; page < 20; page++) {
    const r = await fetch(`${API}?prefix=${encodeURIComponent(prefix)}&limit=1000${cursor ? "&cursor=" + encodeURIComponent(cursor) : ""}`, { headers: { authorization: "Bearer " + token, "x-api-version": "10" } });
    if (!r.ok) throw new Error("blob list " + r.status);
    const d = await r.json();
    out.push(...(d.blobs || []));
    if (!d.hasMore || !d.cursor) break;
    cursor = d.cursor;
  }
  return out;
}

// Reads only the watchlists that changed since the last run. Returns [{path, k, channels, campaigns, notify, items}].
export async function allWatchlists() {
  const idxPath = secretPath("watch/index", "v1");
  const idx = (await getJSON(idxPath, { fresh: true }).catch(() => null)) || { users: {} };
  const blobs = await listBlobs("watch/u/");
  const next = {};
  let read = 0;
  for (const b of blobs) {
    const cached = idx.users[b.pathname];
    if (cached && cached.uploadedAt === b.uploadedAt) { next[b.pathname] = cached; continue; }
    const w = await getJSON(b.pathname, { fresh: true }).catch(() => null);
    read++;
    if (!w || !w.k) continue;
    next[b.pathname] = { uploadedAt: b.uploadedAt, k: w.k, channels: w.channels || [], campaigns: w.campaigns || [], notify: w.notify || {}, done: Object.keys(w.items || {}) };
  }
  idx.users = next;
  return { idx, idxPath, read, users: Object.entries(next).map(([path, u]) => ({ path, ...u })) };
}

// ---- notifications ---------------------------------------------------------------------------
const b64u = (buf) => Buffer.from(buf).toString("base64url");

// A push with no payload needs no encryption: only the VAPID signature (RFC 8292). The service
// worker (public/sw.js) asks the queue how many clips are new and writes the notification.
export async function sendPush(sub) {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return { ok: false, why: "push not configured" };
  let aud;
  try { aud = new URL(sub.endpoint).origin; } catch (e) { return { ok: false, gone: true, why: "bad endpoint" }; }
  if (!/^https:\/\/([a-z0-9-]+\.)*(googleapis\.com|mozilla\.com|windows\.com|push\.apple\.com|mozaws\.net)$/.test(aud)) return { ok: false, gone: true, why: "unknown push service" };
  const head = b64u(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const body = b64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 6 * 3600, sub: "mailto:aidan@brickandmortar.dev" }));
  const pub = Buffer.from(VAPID_PUBLIC_KEY, "base64url");
  const key = crypto.createPrivateKey({ format: "jwk", key: { kty: "EC", crv: "P-256", d: VAPID_PRIVATE_KEY, x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) } });
  const sig = crypto.sign("sha256", Buffer.from(head + "." + body), { key, dsaEncoding: "ieee-p1363" });
  const r = await fetch(sub.endpoint, { method: "POST", headers: { authorization: `vapid t=${head}.${body}.${b64u(sig)}, k=${VAPID_PUBLIC_KEY}`, ttl: "7200", urgency: "normal", "content-length": "0" } });
  return { ok: r.status >= 200 && r.status < 300, status: r.status, gone: r.status === 404 || r.status === 410 };
}

export const validEmail = (e) => typeof e === "string" && e.length <= 120 && /^[^\s@<>,;"']+@[^\s@<>,;"']+\.[a-z]{2,}$/i.test(e);
const escHtml = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export async function sendMail({ to, subject, text, html, tag }) {
  const { MAILGUN_API_KEY, MAILGUN_DOMAIN, MAILGUN_FROM } = process.env;
  if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) return { sent: false, why: "mail not configured" };
  const form = new URLSearchParams({ from: `heistclips <${MAILGUN_FROM || "hello@" + MAILGUN_DOMAIN}>`, to, subject, text, html, "o:tag": tag || "autopilot", "o:tracking": "no", "h:Reply-To": "aidan@brickandmortar.dev" });
  const r = await fetch(`https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`, { method: "POST", headers: { authorization: "Basic " + Buffer.from("api:" + MAILGUN_API_KEY).toString("base64") }, body: form });
  return { sent: r.ok, status: r.status };
}

export const emailToken = (k, email) => crypto.createHmac("sha256", process.env.CREDIT_SALT || process.env.BLOB_READ_WRITE_TOKEN || "dev").update(k + "|" + String(email).toLowerCase()).digest("hex").slice(0, 24);

// The one mail a person gets before they have confirmed: their own link, nothing else.
export function confirmMail(w, email) {
  const link = `${SITE}/queue?k=${w.k}&confirm=${emailToken(w.k, email)}`;
  return {
    to: email, tag: "autopilot-confirm", subject: "Your heistclips queue link",
    text: `You asked heistclips to email you when new clips are ready.\n\nOpen this link to confirm, and to get your queue on any device:\n${link}\n\nIf you did not ask for this, ignore this mail. Nothing else will be sent.\n\nheistclips.com`,
    html: `<p>You asked heistclips to email you when new clips are ready.</p><p><a href="${link}">Confirm, and open my queue</a></p><p>The same link opens your queue on any device. Keep it private.</p><p style="color:#777">If you did not ask for this, ignore this mail. Nothing else will be sent.</p>`,
  };
}

export function readyMail(w, items) {
  const link = `${SITE}/queue?k=${w.k}&from=mail`;
  const off = `${SITE}/queue?k=${w.k}&mail=off`;
  const names = [...new Set(items.map((i) => i.channel_name))];
  const paid = items.filter((i) => i.match);
  const lines = items.slice(0, 6).map((i) => `- ${i.channel_name}: ${i.hook}${i.match ? ` (${i.match.title}${i.match.expected_per_clip != null ? `, $${i.match.expected_per_clip} typical per clip` : ""})` : ""}`);
  return {
    to: w.notify.email, tag: "autopilot-ready",
    subject: `${items.length} new clip${items.length === 1 ? "" : "s"} ready: ${names.slice(0, 3).join(", ")}`,
    text: `${items.length} new clip${items.length === 1 ? " is" : "s are"} ready in your heistclips queue${paid.length ? `, ${paid.length} with a paying campaign` : ""}.\n\n${lines.join("\n")}\n\nOpen your queue: ${link}\n\nStop these emails: ${off}`,
    html: `<p><b>${items.length} new clip${items.length === 1 ? " is" : "s are"} ready</b>${paid.length ? `, ${paid.length} with a paying campaign` : ""}.</p><ul>${items.slice(0, 6).map((i) => `<li><b>${escHtml(i.channel_name)}</b>: ${escHtml(i.hook)}${i.match ? ` <span style="color:#555">(${escHtml(i.match.title)}${i.match.expected_per_clip != null ? `, $${i.match.expected_per_clip} typical per clip` : ""})</span>` : ""}</li>`).join("")}</ul><p><a href="${link}">Open my queue</a></p><p style="color:#777;font-size:12px"><a href="${off}" style="color:#777">Stop these emails</a></p>`,
  };
}
