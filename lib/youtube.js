// YouTube on the server: the YouTube Data API v3 with heistclips' key (env YOUTUBE_API_KEY,
// Google Cloud project "heistclips"), oEmbed, and plain watch links. Nothing else: YouTube's
// robots.txt disallows /youtubei/ and /live_chat, and its Terms bar downloading, so this file
// never reads video and never calls the routes the feasibility probe found
// (docs/youtube-feasibility-2026-11-19.md). Parsing, the noise filter and the clustering are in
// public/js/youtube.js, shared with the browser.
//
// THE QUOTA is the constraint: 10,000 units a day for the project, reset at midnight Pacific.
// Every call is written to an append-only ledger in Blob (one file per spend, the units in its
// name, summed from the list API, which is current at once). Live polling stops at LIVE_STOP of
// the day so lookups keep working; at the end everything says plainly that the limit is used up
// and when it comes back. A 403 quotaExceeded from YouTube marks the day as used up whatever the
// ledger says.
//
// LIVE CHAT: one shared poller per stream, however many people watch it. A cron (api/youtube.js,
// every minute) polls each stream someone has looked at in the last LOOK_MIN minutes, once a
// minute. Measured 2026-11-19 on TheBurntPeanut (102K watching): a cursor polled every 60 s got
// every message a 5 s cursor got (214 of 214, and 80 more after the 5 s one stopped), so a
// minute between polls loses nothing; it costs 60 calls a stream-hour instead of ~740.
import crypto from "node:crypto";
import { putJSON, getJSON, listPaths } from "./store.js";
import { listFiles, deleteFiles } from "./blobfiles.js";
import { commentMoments, momentsFromChat, isNoise, ytWatch } from "../public/js/youtube.js";
import { findPeaks, momentFromMessages, hooks, clock } from "../public/js/twitch.js";
import { markSpoilers } from "../public/js/spoilers.js";

const API = "https://www.googleapis.com/youtube/v3/";
const BLOB_API = "https://blob.vercel-storage.com/";
const MEM = process.env.HC_STORE === "memory" ? new Map() : null;

// Units per call. Google's published costs (developers.google.com/youtube/v3/determine_quota_cost):
// list calls 1, search 100. liveChatMessages.list: see LIVE_UNITS.
export const DAILY = Number(process.env.YT_DAILY_UNITS || 10000);
export const LIVE_UNITS = Number(process.env.YT_LIVE_UNITS || 5);
export const UNITS = { videos: 1, channels: 1, playlistItems: 1, commentThreads: 1, "liveChat/messages": LIVE_UNITS };
export const LIVE_STOP = 0.9;   // live polling stops at 90% of the day: lookups keep the last 10%
export const LOOK_MIN = 10;     // a stream is polled while someone looked at it in the last 10 min
export const LOOK_MIN_MCP = 30; // an assistant's call keeps it polled for 30 (it comes back later)
export const RAW_KEEP_S = 20 * 60; // raw chat kept per stream: enough to size any new spike
export const BIN_S = 20;
export const COMMENT_PAGES = Number(process.env.YT_COMMENT_PAGES || 10); // 100 comments a page, 1 unit each

export class QuotaOut extends Error { constructor() { super(quotaMessage()); this.code = "yt_quota"; } }

// ---- Pacific day -------------------------------------------------------------------------
const PT = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
export function pacific(now = Date.now()) {
  const p = Object.fromEntries(PT.formatToParts(new Date(now)).map((x) => [x.type, x.value]));
  const minsLeft = 24 * 60 - (Number(p.hour) * 60 + Number(p.minute));
  return { day: `${p.year}-${p.month}-${p.day}`, minsLeft };
}
export function quotaMessage(now = Date.now()) {
  const m = pacific(now).minsLeft, h = Math.floor(m / 60);
  return `YouTube's daily limit for heistclips is used up; it comes back at midnight Pacific (in ${h ? h + " h " : ""}${m % 60} min).`;
}

// ---- Blob helpers that this file needs and lib/store.js does not have ----------------------
// Create a file only if it does not exist yet: the lock that keeps one poller per stream.
async function putOnce(pathname, obj) {
  if (MEM) { if (MEM.has(pathname)) return false; MEM.set(pathname, JSON.stringify(obj)); return true; }
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN missing");
  const r = await fetch(BLOB_API + "?pathname=" + encodeURIComponent(pathname), {
    method: "PUT",
    headers: { authorization: "Bearer " + token, "x-api-version": "10", "x-add-random-suffix": "0", "x-allow-overwrite": "0", "x-content-type": "application/json", "x-cache-control-max-age": "60" },
    body: JSON.stringify(obj),
  });
  if (r.ok) return true;
  const t = await r.text();
  if (r.status === 400 || r.status === 409 || /already exists/i.test(t)) return false;
  throw new Error("blob put " + r.status + " " + t.slice(0, 120));
}
const list = (prefix) => (MEM ? Promise.resolve([...MEM.keys()].filter((k) => k.startsWith(prefix))) : listPaths(prefix));
const readNew = async (p) => (MEM && MEM.has(p) ? JSON.parse(MEM.get(p)) : getJSON(p)); // write-once paths are never stale
const write = (p, obj, o) => (MEM ? (MEM.set(p, JSON.stringify(obj)), Promise.resolve()) : putJSON(p, obj, o));
export const _mem = MEM; // tests

// ---- quota ledger --------------------------------------------------------------------------
const qDir = (day) => `yt/q/${day}/`;
let qMemo = { at: 0, day: "", units: 0, out: false, local: 0 };
export async function quotaState(now = Date.now(), { fresh = false } = {}) {
  const { day } = pacific(now);
  if (!fresh && qMemo.day === day && now - qMemo.at < 30000) return { day, units: qMemo.units + qMemo.local, out: qMemo.out };
  let names = [];
  try { names = await list(qDir(day)); } catch (e) { return { day, units: qMemo.day === day ? qMemo.units + qMemo.local : 0, out: qMemo.day === day && qMemo.out, err: true }; }
  let units = 0, out = false;
  for (const n of names) { const m = n.match(/_(\d+)u_/); if (m) units += Number(m[1]); if (/\/OUT_/.test(n)) out = true; }
  qMemo = { at: now, day, units, out, local: 0 };
  return { day, units, out };
}
async function spend(units, kind, now = Date.now()) {
  if (!units) return;
  const { day } = pacific(now);
  if (qMemo.day === day) qMemo.local += units;
  await putOnce(`${qDir(day)}${now}${crypto.randomBytes(3).toString("hex")}_${units}u_${kind}.json`, {}).catch(() => null);
}
async function markOut(now = Date.now()) {
  const { day } = pacific(now);
  qMemo = { ...qMemo, day, out: true };
  await putOnce(`${qDir(day)}OUT_${now}.json`, { at: new Date(now).toISOString() }).catch(() => null);
}

// One Data API call, counted. Throws QuotaOut when the day is used up (before calling, from the
// ledger, or after, from YouTube's own 403).
export async function ytApi(path, params, { reserve = 1, deps = {} } = {}) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw Object.assign(new Error("YouTube lookups are not set up on this server (no API key)."), { code: "yt_no_key" });
  const q = await quotaState();
  if (q.out || q.units >= DAILY * reserve) throw new QuotaOut();
  const u = new URL(API + path);
  for (const [k, v] of Object.entries(params)) if (v != null) u.searchParams.set(k, String(v));
  u.searchParams.set("key", key);
  const r = await (deps.fetch || fetch)(u, { signal: AbortSignal.timeout(15000) });
  const d = await r.json().catch(() => ({}));
  const reason = d && d.error && d.error.errors && d.error.errors[0] && d.error.errors[0].reason;
  // A refused call still costs its units (Google counts invalid requests too).
  await spend(UNITS[path] || 1, path.replace(/\W+/g, "-"));
  // Only the day's quota marks the day used up. A live-chat poll sent sooner than YouTube's
  // pollingIntervalMillis is refused with a 403 too ("sent too soon", seen 2026-11-19): that
  // one only means wait.
  if (r.status === 403 && /^(quotaExceeded|dailyLimitExceeded)$/.test(String(reason))) { await markOut(); throw new QuotaOut(); }
  if (!r.ok) throw Object.assign(new Error(`YouTube answered ${r.status}${reason ? " (" + reason + ")" : ""}`), { code: "yt_" + (reason || r.status), status: r.status });
  return d;
}

// ---- resolve ---------------------------------------------------------------------------------
export function isoSeconds(iso) {
  const m = String(iso || "").match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  return m ? Number(m[1] || 0) * 86400 + Number(m[2] || 0) * 3600 + Number(m[3] || 0) * 60 + Number(m[4] || 0) : 0;
}

export function shapeVideo(it, now = Date.now()) {
  const sn = it.snippet || {}, ls = it.liveStreamingDetails || {}, st = it.statistics || {};
  const live = sn.liveBroadcastContent === "live";
  const upcoming = sn.liveBroadcastContent === "upcoming";
  const start = Date.parse(ls.actualStartTime || "") || null;
  const length = live && start ? Math.max(0, Math.round((now - start) / 1000)) : isoSeconds(it.contentDetails && it.contentDetails.duration);
  const thumbs = sn.thumbnails || {};
  return {
    platform: "youtube", id: it.id, title: sn.title || "", channel: sn.channelId, channel_name: sn.channelTitle || "", channel_id: sn.channelId,
    length, status: live ? "RECORDING" : upcoming ? "UPCOMING" : "FINISHED", live, upcoming, was_stream: !!ls.actualStartTime,
    created_at: ls.actualStartTime || sn.publishedAt || null, start_ms: start, ended_at: ls.actualEndTime || null,
    chat_id: ls.activeLiveChatId || null, viewers: Number(ls.concurrentViewers) || 0,
    comment_count: st.commentCount != null ? Number(st.commentCount) : null, views: Number(st.viewCount) || 0,
    thumb: (thumbs.medium || thumbs.high || thumbs.default || {}).url || `https://i.ytimg.com/vi/${it.id}/mqdefault.jpg`,
    url: ytWatch(it.id), game: null, muted: [],
  };
}

const vmemo = new Map();
export async function ytVideos(ids, opts = {}) {
  const d = await ytApi("videos", { part: "snippet,contentDetails,liveStreamingDetails,statistics", id: ids.join(","), maxResults: 50 }, opts);
  return (d.items || []).map((it) => shapeVideo(it));
}
export async function ytVideo(id, opts = {}) {
  const w = vmemo.get(id);
  if (w && Date.now() - w.at < (w.v && w.v.live ? 60000 : 600000)) return w.v;
  const [v] = await ytVideos([id], opts);
  if (vmemo.size > 500) vmemo.clear();
  vmemo.set(id, { at: Date.now(), v: v || null });
  return v || null;
}

// "@tomovids" -> the channel's live stream if it is live, else its latest finished stream.
// 3 units: channels.list (forHandle), its uploads playlist, videos.list on the newest 15.
// (search.list would cost 100 units and has its own 100-a-day cap on this project.)
export async function ytChannelStreams(inp, opts = {}) {
  const ch = await ytApi("channels", { part: "id,snippet,contentDetails", ...(inp.channel ? { id: inp.channel } : { forHandle: "@" + inp.handle }) }, opts);
  const c = ch.items && ch.items[0];
  if (!c) return null;
  const uploads = c.contentDetails && c.contentDetails.relatedPlaylists && c.contentDetails.relatedPlaylists.uploads;
  const name = c.snippet && c.snippet.title, handle = c.snippet && c.snippet.customUrl;
  if (!uploads) return { channel_id: c.id, name, handle, live: null, streams: [] };
  const pl = await ytApi("playlistItems", { part: "contentDetails", playlistId: uploads, maxResults: 15 }, opts);
  const ids = (pl.items || []).map((i) => i.contentDetails && i.contentDetails.videoId).filter(Boolean);
  const vids = ids.length ? await ytVideos(ids, opts) : [];
  const live = vids.find((v) => v.live) || null;
  const streams = vids.filter((v) => v.was_stream && !v.live && !v.upcoming);
  return { channel_id: c.id, name, handle, live, streams, upcoming: vids.find((v) => v.upcoming) || null };
}

// Title and channel without a key or quota (oEmbed answers any origin, from any IP).
export async function oembed(id) {
  try {
    const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(ytWatch(id))}`, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) return null;
    const d = await r.json();
    return { title: d.title, channel_name: d.author_name, thumb: d.thumbnail_url };
  } catch (e) { return null; }
}

// ---- finished streams: viewers' timestamped comments ----------------------------------------
const cmPath = (id) => `yt/cm/${id}.json`;
export async function readComments(id, { pages = COMMENT_PAGES, deps = {} } = {}) {
  const out = [];
  let token = null, n = 0;
  for (; n < pages; n++) {
    let d;
    try { d = await ytApi("commentThreads", { part: "snippet", videoId: id, maxResults: 100, order: "relevance", textFormat: "plainText", ...(token ? { pageToken: token } : {}) }, { reserve: 0.99, deps }); }
    catch (e) { if (e.code === "yt_commentsDisabled" || e.status === 403 && !(e instanceof QuotaOut)) return { comments: out, pages: n, disabled: true }; throw e; }
    for (const it of d.items || []) {
      const s = it.snippet && it.snippet.topLevelComment && it.snippet.topLevelComment.snippet;
      if (s) out.push({ id: it.id, text: s.textOriginal || s.textDisplay || "", likes: s.likeCount || 0 });
    }
    token = d.nextPageToken;
    if (!token) { n++; break; }
  }
  return { comments: out, pages: n };
}

export async function finishedMoments(vod, { k = 10, deps = {} } = {}) {
  const hit = await getJSON(cmPath(vod.id)).catch(() => null);
  if (hit && Date.now() - Date.parse(hit.at) < 6 * 3600 * 1000 && hit.k >= k) return { ...hit, cache: "stored" };
  const r = await readComments(vod.id, { deps });
  const moments = commentMoments(vod, r.comments, { k });
  const withTs = r.comments.filter((c) => /\d:\d\d/.test(c.text)).length;
  const out = { at: new Date().toISOString(), k, moments, comments_read: r.comments.length, with_timestamps: withTs, pages: r.pages, disabled: !!r.disabled };
  await write(cmPath(vod.id), out, { maxAge: 300 }).catch(() => null);
  return { ...out, cache: "miss" };
}

// ---- live streams: the shared poller ---------------------------------------------------------
// Paths: yt/look/<id>/<until ms>.json (someone looked), yt/live/<id>/s<ms>.json (state after a
// poll, write-once), yt/live/<id>/c<minute>.json (the claim for that minute's poll).
const liveDir = (id) => `yt/live/${id}/`;
const lookDir = (id) => `yt/look/${id}/`;
const lookMemo = new Map();

export async function markLook(id, minutes = LOOK_MIN, now = Date.now()) {
  const last = lookMemo.get(id + minutes);
  if (last && now - last < 3 * 60000) return;
  lookMemo.set(id + minutes, now);
  await putOnce(`${lookDir(id)}${now + minutes * 60000}.json`, {}).catch(() => null);
}

export async function latestState(id) {
  const names = (await list(liveDir(id))).filter((n) => /\/s\d+\.json$/.test(n)).sort();
  if (!names.length) return null;
  return readNew(names[names.length - 1]);
}

const emptyState = (vod, now) => ({ v: 1, id: vod.id, chat_id: vod.chat_id, start_ms: vod.start_ms, title: vod.title, channel_name: vod.channel_name, channel_id: vod.channel_id || vod.channel || "",
  watched_from: now, next: null, next_at: 0, polls: 0, units: 0, ended: false, bins: {}, raw: [], moments: [], msgs: 0, noise: 0, last_t: 0 });

// Fold one page of live chat into the state, and freeze any spike whose reaction is over.
export function foldChat(state, items, { now = Date.now() } = {}) {
  const s = { ...state, bins: { ...state.bins }, raw: state.raw.slice(), moments: state.moments.slice() };
  const seen = new Set(s.raw.map((m) => m.id));
  for (const it of items) {
    const sn = it.snippet || {};
    if (sn.type && sn.type !== "textMessageEvent") continue;
    if (seen.has(it.id)) continue;
    const ts = Date.parse(sn.publishedAt || "");
    if (!Number.isFinite(ts) || !s.start_ms) continue;
    const t = Math.floor((ts - s.start_ms) / 1000);
    if (t < 0) continue;
    const text = String(sn.displayMessage || (sn.textMessageDetails && sn.textMessageDetails.messageText) || "").slice(0, 200);
    s.msgs++;
    if (isNoise(text)) { s.noise++; continue; }
    const b = Math.floor(t / BIN_S);
    s.bins[b] = (s.bins[b] || 0) + 1;
    s.raw.push({ id: it.id, t, text });
    if (t > s.last_t) s.last_t = t;
  }
  s.raw.sort((a, b) => a.t - b.t);
  s.raw = s.raw.filter((m) => m.t >= s.last_t - RAW_KEEP_S);
  return detect(s, now);
}

// Spikes against the stream's own pace, on 20-second bins (the same findPeaks a Twitch VOD gets).
// A spike becomes a moment once 45 s of chat after it are in (the reaction has finished), and is
// then frozen: later polls never move or drop it.
export function detect(s, now = Date.now()) {
  // The first page reaches back a minute or two and is partial, so the bins before reading began
  // are thin and the first full minute looked like a spike (IShowSpeed, 2026-11-19: three "moments"
  // in the first 3 minutes of watching). Measure only from reading start, with 4 minutes of pace.
  const from = s.start_ms ? Math.floor((s.watched_from - s.start_ms) / 1000) : 0;
  const keys = Object.keys(s.bins).map(Number).filter((b) => b * BIN_S >= from).sort((a, b) => a - b);
  if (keys.length < 6) return s;
  const raw0 = Math.max(from, s.raw.length ? s.raw[0].t : Infinity);
  const samples = [];
  for (let b = keys[0]; b <= keys[keys.length - 1]; b++) {
    const t = b * BIN_S;
    samples.push({ t: t + BIN_S / 2, rate: (s.bins[b] || 0) / BIN_S, msgs: t >= raw0 ? s.raw.filter((m) => m.t >= t && m.t < t + BIN_S) : [] });
  }
  const ready = (p) => p.t >= from + 240 && p.t >= raw0 + 90 && p.t <= s.last_t - 45 && p.t >= 180 && s.moments.every((m) => Math.abs(m.t_peak - p.t) >= 90);
  let peaks = findPeaks(samples, { k: 40, gap: 90 }).filter(ready);
  const real = s.moments.filter((m) => !m.quiet).length;
  if (!peaks.length && real < 3 && s.last_t - (s.raw[0] ? s.raw[0].t : s.last_t) >= 15 * 60 && !s.moments.some((m) => m.quiet && s.last_t - m.t_peak < 10 * 60)) {
    peaks = findPeaks(samples, { k: 5, gap: 90, minRatio: 1.25 }).filter(ready).slice(0, 1).map((p) => ({ ...p, soft: true }));
  }
  const v = { id: s.id, channel: s.channel_name, platform: "youtube", length: s.last_t, muted: [] };
  for (const p of peaks) {
    const m = momentFromMessages(v, s.raw, p);
    m.platform = "youtube"; m.signal = "live_chat"; m.url = ytWatch(s.id, m.t_start); m.found_at = now;
    m.chat = m.chat.slice(0, 150);
    if (p.soft) m.quiet = true;
    m.twitch_clips = 0; m.twitch_clip_views = 0;
    m.hooks = hooks(m, s.channel_name);
    m.score = Math.round(m.chat_ratio * 10 * (1 + Math.min(5, m.clip_requests) * 0.4)) / 10;
    if (s.moments.some((o) => o.t_start < m.t_end - 10 && o.t_end > m.t_start + 10)) continue;
    s.moments.push(m);
  }
  return s;
}

export function curveOf(s) {
  const keys = Object.keys(s.bins || {}).map(Number).sort((a, b) => a - b);
  return keys.length ? Array.from({ length: keys[keys.length - 1] - keys[0] + 1 }, (_, i) => [(keys[0] + i) * BIN_S + BIN_S / 2, Math.round(((s.bins[keys[0] + i] || 0) / BIN_S) * 100) / 100]) : [];
}

// One poll of one stream, if it is due and nobody else is doing it this minute.
// -> { polled, state, why }
export async function pollStream(vod, { now = Date.now(), force = false, deps = {} } = {}) {
  let s = await latestState(vod.id).catch(() => null);
  if (s && s.ended) return { polled: false, state: s, why: "ended" };
  if (s && !force && now < s.next_at) return { polled: false, state: s, why: "not_due" };
  const q = await quotaState(now);
  if (q.out || q.units >= DAILY * LIVE_STOP) return { polled: false, state: s, why: "quota" };
  const minute = Math.floor(now / 60000);
  if (!(await putOnce(`${liveDir(vod.id)}c${minute}.json`, { at: now }))) return { polled: false, state: s, why: "claimed" };
  if (!s) s = emptyState(vod, now);
  if (!s.chat_id) s.chat_id = vod.chat_id;
  if (!s.start_ms) s.start_ms = vod.start_ms;
  let d;
  try {
    d = await ytApi("liveChat/messages", { part: "snippet", liveChatId: s.chat_id, maxResults: 2000, ...(s.next ? { pageToken: s.next } : {}) }, { reserve: LIVE_STOP, deps });
  } catch (e) {
    if (e instanceof QuotaOut) return { polled: false, state: s, why: "quota" };
    // The chat closed: the stream ended (403 liveChatEnded) or the chat is gone (404).
    if (/liveChatEnded|liveChatNotFound|liveChatDisabled/.test(e.code) || e.status === 404) {
      s = { ...s, ended: true, ended_why: e.code };
      await putOnce(`${liveDir(vod.id)}s${now}.json`, s).catch(() => null);
      return { polled: true, state: s, why: "ended" };
    }
    throw e;
  }
  s = foldChat(s, d.items || [], { now });
  s.next = d.nextPageToken || s.next;
  // YouTube says how long to wait; we wait at least a minute (see the measurement at the top).
  s.next_at = now + Math.max(55000, Number(d.pollingIntervalMillis) || 0);
  s.polls++; s.units += LIVE_UNITS; s.polled_at = now;
  if (d.offlineAt) { s.ended = true; s.ended_why = "offline"; }
  await putOnce(`${liveDir(vod.id)}s${now}.json`, s);
  return { polled: true, state: s, why: "ok" };
}

// Which streams has anyone looked at recently? -> [videoId]
export async function watchedStreams(now = Date.now()) {
  const names = await list("yt/look/");
  const live = new Set();
  for (const n of names) { const m = n.match(/^yt\/look\/([A-Za-z0-9_-]{11})\/(\d+)\.json$/); if (m && Number(m[2]) >= now) live.add(m[1]); }
  return [...live];
}

// The cron: poll every watched live stream once, then sweep old markers. -> summary
export async function tick({ now = Date.now(), deps = {} } = {}) {
  const ids = await watchedStreams(now);
  const out = { watched: ids.length, polled: [], skipped: [] };
  if (ids.length) {
    const q = await quotaState(now, { fresh: true });
    out.quota = { day: q.day, units: q.units, out: q.out };
    // A stream already being read carries its chat id in its state, and the chat poll itself says
    // when it ends: only a stream with no state yet costs a videos.list.
    const states = await Promise.all(ids.slice(0, 50).map((id) => latestState(id).catch(() => null)));
    const vids = [], unknown = [];
    states.forEach((s, i) => {
      if (s && s.ended) out.skipped.push([ids[i], "ended"]);
      else if (s && s.chat_id && s.start_ms) vids.push({ platform: "youtube", id: ids[i], live: true, chat_id: s.chat_id, start_ms: s.start_ms, title: s.title, channel_name: s.channel_name });
      else unknown.push(ids[i]);
    });
    if (unknown.length) vids.push(...await ytVideos(unknown, { reserve: LIVE_STOP, deps }).catch((e) => { out.err = e.code || e.message; return []; }));
    for (const v of vids) {
      if (!v.live || !v.chat_id) { out.skipped.push([v.id, v.live ? "no_chat" : "not_live"]); continue; }
      try { const r = await pollStream(v, { now, deps }); (r.polled ? out.polled : out.skipped).push([v.id, r.why, r.state ? r.state.moments.length : 0]); }
      catch (e) { out.skipped.push([v.id, "error: " + String(e.message || e).slice(0, 80)]); }
    }
  }
  // Housekeeping: expired look markers, old claims, all but the newest few states.
  if (!MEM && now % (10 * 60000) < 60000) {
    try {
      const old = [];
      for (const b of await listFiles("yt/look/")) { const m = b.pathname.match(/\/(\d+)\.json$/); if (m && Number(m[1]) < now - 3600000) old.push(b.url); }
      const byStream = new Map();
      for (const b of await listFiles("yt/live/")) {
        if (/\/c\d+\.json$/.test(b.pathname) && Date.parse(b.uploadedAt) < now - 3600000) old.push(b.url);
        const m = b.pathname.match(/^yt\/live\/([^/]+)\/s(\d+)\.json$/);
        if (m) { if (!byStream.has(m[1])) byStream.set(m[1], []); byStream.get(m[1]).push(b); }
      }
      for (const arr of byStream.values()) { arr.sort((a, b) => a.pathname.localeCompare(b.pathname)); old.push(...arr.slice(0, -3).map((b) => b.url)); }
      out.swept = await deleteFiles(old.slice(0, 2000));
    } catch (e) { out.sweep_err = String(e.message || e).slice(0, 80); }
  }
  return out;
}

// ---- one answer for the page and the connector ------------------------------------------------
// resolve(raw) -> { ok, vod, chan, note } or { ok: false, err, message }
export async function resolveYouTube(inp, { deps = {} } = {}) {
  try {
    if (inp.kind === "ythandle") {
      const c = await ytChannelStreams(inp, { deps });
      if (!c) return { ok: false, err: "yt_no_channel", message: `No YouTube channel called @${inp.handle || inp.channel}.` };
      const vod = c.live || c.streams[0] || null;
      if (!vod) return { ok: false, err: "yt_no_streams", message: `${c.name} has no live or recent streams on YouTube${c.upcoming ? ` (one is scheduled: "${c.upcoming.title}")` : ""}.`, channel: c.name };
      return { ok: true, vod, chan: { name: c.name, handle: c.handle, others: c.streams.filter((v) => v.id !== vod.id).slice(0, 4).map((v) => ({ id: v.id, title: v.title, created_at: v.created_at, length: v.length })) }, note: c.live ? "" : `${c.name} is not live right now; this is their latest stream.` };
    }
    const vod = await ytVideo(inp.id, { deps });
    if (!vod) return { ok: false, err: "yt_missing", message: "That YouTube video does not exist or is private." };
    if (vod.upcoming) return { ok: false, err: "yt_upcoming", message: `"${vod.title}" has not started yet. Open it again once ${vod.channel_name} is live.`, vod };
    return { ok: true, vod, chan: null, note: "" };
  } catch (e) {
    if (e instanceof QuotaOut) return { ok: false, err: "yt_quota", message: e.message, quota: true };
    if (e.code === "yt_no_key") return { ok: false, err: "yt_no_key", message: e.message };
    return { ok: false, err: e.code || "yt_error", message: "YouTube did not answer: " + String(e.message || e).slice(0, 120) };
  }
}

// Moments for a resolved video. Live: what the shared poller has (it starts now if nobody was
// watching). Finished: moments from the live chat if we watched it live, plus viewers' timestamped
// comments. -> { status, signal, moments, curve, note, watching_since?, quota? }
export async function ytMoments(vod, { k = 12, look = LOOK_MIN, deps = {}, now = Date.now() } = {}) {
  if (vod.live) {
    await markLook(vod.id, look, now);
    let s = await latestState(vod.id).catch(() => null);
    let note = "";
    if (!s || now >= s.next_at + 5 * 60000) {
      try { const r = await pollStream(vod, { now, deps }); s = r.state || s; if (r.why === "quota") note = quotaMessage(now); }
      catch (e) { note = "YouTube's chat did not answer: " + String(e.message || e).slice(0, 100); }
    }
    const q = await quotaState(now);
    const quota = q.out || q.units >= DAILY * LIVE_STOP;
    const moments = s ? s.moments.slice().sort((a, b) => (a.quiet ? 1 : 0) - (b.quiet ? 1 : 0) || b.score - a.score).slice(0, k) : [];
    markSpoilers(vod, moments);
    const since = s ? Math.floor((s.watched_from - (vod.start_ms || s.watched_from)) / 1000) : null;
    return { status: "live", signal: "live_chat", moments, curve: s ? curveOf(s) : [], watching_since: since, msgs: s ? s.msgs : 0, noise: s ? s.noise : 0, polls: s ? s.polls : 0,
      quota: quota || undefined, note: note || (quota ? quotaMessage(now) : "") };
  }
  // Finished.
  const s = await latestState(vod.id).catch(() => null);
  const chatMoments = s ? s.moments : [];
  let cm = { moments: [], comments_read: 0, with_timestamps: 0 };
  let quota = false;
  try { cm = await finishedMoments(vod, { k, deps }); } catch (e) { if (e instanceof QuotaOut) quota = true; else cm.error = String(e.message || e).slice(0, 120); }
  const kept = chatMoments.slice();
  for (const m of cm.moments) if (kept.every((o) => !(o.t_start < m.t_end - 10 && o.t_end > m.t_start + 10))) kept.push(m);
  kept.sort((a, b) => (a.signal === "live_chat" ? 0 : 1) - (b.signal === "live_chat" ? 0 : 1) || (b.score || 0) - (a.score || 0));
  markSpoilers(vod, kept);
  return { status: "finished", signal: chatMoments.length ? (cm.moments.length ? "live_chat+comments" : "live_chat") : "comments", moments: kept.slice(0, k), curve: s ? curveOf(s) : [],
    comments_read: cm.comments_read, with_timestamps: cm.with_timestamps, comments_off: !!cm.disabled, quota: quota || undefined, note: quota ? quotaMessage(now) : "" };
}

// ---- the connector ----------------------------------------------------------------------------
const SITE = "https://heistclips.com";
const NO_SERVER_CUT = "YouTube does not allow downloading its videos, so heistclips cannot cut a YouTube stream on its server. cut_it opens the editor on heistclips.com, where the user picks their own copy of the video (the campaign's source file, or one they saved) and it is cut in their browser; the file never leaves their device.";
export const cutItLink = (id, t) => `${SITE}/clip?q=${encodeURIComponent(ytWatch(id))}&t=${Math.max(0, Math.floor(t))}`;

// find_clip_moments for a YouTube source -> { out, log }
export async function ytFindClipMoments(args, inp, { tag = (u) => u, limit = 8, t0 = Date.now(), deps = {} } = {}) {
  const r = await (deps.resolveYouTube || resolveYouTube)(inp);
  if (!r.ok) {
    const out = { found: false, reason: r.err, message: r.message };
    if (r.err === "yt_quota") out.next = "Tell the user plainly. Twitch and Kick streams still work: offer live_gta_streams.";
    else if (r.err === "yt_no_channel") out.next = "Ask the user for the exact channel link (youtube.com/@name), then call again.";
    else if (r.err === "yt_no_streams" || r.err === "yt_upcoming") out.next = "Tell the user; offer to read the stream once it is live, or a Twitch/Kick stream from live_gta_streams.";
    return { out, log: { ok: false, err: r.err, platform: "youtube" } };
  }
  const vod = r.vod;
  const d = await (deps.ytMoments || ytMoments)(vod, { k: Math.min(15, limit + 2), look: LOOK_MIN_MCP });
  const skipped = args.skip_spoilers ? d.moments.filter((m) => m.spoiler && m.spoiler.spoiler) : [];
  const kept = args.skip_spoilers ? d.moments.filter((m) => !(m.spoiler && m.spoiler.spoiler)) : d.moments;
  const list = kept.slice(0, limit).map((m, i) => ({
    rank: i + 1, start: clock(m.t_start), end: clock(m.t_end), t_start_s: m.t_start, t_end_s: m.t_end,
    why: m.signal === "comments" ? `${m.comments} viewers timestamped this in the comments${m.likes ? ` (${m.likes} likes)` : ""}` : `chat went ${m.chat_ratio}x its normal speed`,
    ...(m.signal === "comments" ? { top_comments: (m.quotes || []).map((q) => q.text) } : { chat_speed_vs_normal: m.chat_ratio + "x", clip_requests_in_chat: m.clip_requests, top_chat_phrase: m.phrase && m.phrase.text }),
    event_type: m.event_type, hooks: m.hooks, ...(m.quiet ? { quiet: true } : {}),
    watch: ytWatch(vod.id, m.t_start), cut_it: tag(cutItLink(vod.id, m.t_start)),
  }));
  const stream = { platform: "youtube", channel: vod.channel_name, title: vod.title, length: clock(vod.length), status: vod.live ? "live" : "finished", url: ytWatch(vod.id) };
  let note;
  if (d.quota && !list.length) note = d.note;
  else if (vod.live) note = (list.length ? `Moments from this stream's live chat since heistclips started reading it${d.watching_since != null ? ` (${clock(Math.max(0, d.watching_since))} into the stream)` : ""}. ` : `heistclips started reading this stream's live chat ${d.polls > 1 ? "a few minutes ago" : "just now"}; no spike yet. `)
    + `It keeps reading once a minute for the next ${LOOK_MIN_MCP} minutes: call again in a few minutes for new moments. YouTube does not let anyone read a live stream's earlier chat, so moments start from when reading began. ` + NO_SERVER_CUT;
  else if (list.length) note = `Moments from ${d.signal === "comments" ? "viewers' timestamped comments" : "live chat while heistclips watched it live, and viewers' timestamped comments"} (YouTube does not let anyone read a finished stream's chat). ` + NO_SERVER_CUT;
  else note = `Moments for finished YouTube streams come from viewers' timestamped comments, and this one has none to go on${d.comments_read ? ` (read ${d.comments_read} comments, ${d.with_timestamps} with a time)` : d.comments_off ? " (comments are off)" : ""}. YouTube does not let anyone read a finished stream's chat. Offer a live YouTube stream (its chat is read as it happens) or a Twitch/Kick stream from live_gta_streams.`;
  const out = { stream, ...(r.note ? { note_on_source: r.note } : {}), moments: list, spoiler_filter: args.skip_spoilers ? "on" : "off",
    skipped_spoilers: skipped.map((m) => ({ start: clock(m.t_start), end: clock(m.t_end), reason: m.spoiler.reason })), note,
    ...(d.quota ? { quota: quotaMessage() } : {}) };
  if (!list.length && !vod.live) out.found = false;
  return { out, log: { ok: true, platform: "youtube", live: !!vod.live, signal: d.signal, moments: list.length, quota: !!d.quota, comments_read: d.comments_read, msgs: d.msgs, total_ms: Date.now() - t0 } };
}

// cut_clip on a YouTube source: an answer with the two links, never a server cut.
export function ytCutAnswer(inp, args = {}, tag = (u) => u) {
  const t = Number(args.start) || inp.t || 0;
  return { ok: false, cut: false, reason: "youtube_no_server_cut", message: NO_SERVER_CUT, watch: inp.id ? ytWatch(inp.id, t) : null,
    cut_from_your_copy: inp.id ? tag(cutItLink(inp.id, t)) : null, next: "Give the user the cut_from_your_copy link: it opens this moment in the editor, ready for their own file. Nothing was charged." };
}
