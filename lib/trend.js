// "What's being clipped right now": which streams and moments people on heistclips made the
// most clips from. The count is of clips, never of people.
//
// Privacy: one clip leaves one empty file whose NAME carries the stream id and the moment,
// rounded to 10 seconds. No browser id, no account, no IP, nothing about who made it. The file
// name is the whole record, so the hourly build needs only the Blob list API (which is current
// at once; a public read of an overwritten file can lag 25 s, see lib/store.js).
//
// History before this counter existed (2026-11-15 to 11-19) is lib/trend_seed.json: counts of
// the clip_render_done analytics event per stream, moment and day, pulled once from PostHog by
// scripts/trend_seed.mjs. Aggregates only.
//
// Our own clips are not demand. A test clip (header x-hc-test) and a house clip (HOUSE_ACCOUNTS)
// never leave a record: api/credits.js skips recordClip for both (lib/marks.js). Records written
// before that existed are listed in lib/trend_exclude.json and skipped by the build.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { putJSON, getJSON, listPaths } from "./store.js";
import { getVod } from "../public/js/twitch.js";
import { getKickVod } from "../public/js/kick.js";

export const WINDOW_DAYS = 3;      // today and the two days before it, UTC
export const STREAM_FLOOR = 3;     // a stream shows once 3 clips were made from it
export const MOMENT_FLOOR = 2;     // a moment shows once 2 clips were made of it
export const MOMENT_BUCKET_S = 30;
const TWITCH_VOD = /^\d{6,12}$/;
const KICK_VOD = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const day = (ms) => new Date(ms).toISOString().slice(0, 10);

const here = path.dirname(fileURLToPath(import.meta.url));
let SEED = null;
export function seed() {
  if (!SEED) { try { SEED = JSON.parse(fs.readFileSync(path.join(here, "trend_seed.json"), "utf8")); } catch (e) { SEED = { through: null, rows: [], vods: {} }; } }
  return SEED;
}

let EXCLUDE = null;
export function excluded() {
  if (!EXCLUDE) { try { EXCLUDE = new Set(JSON.parse(fs.readFileSync(path.join(here, "trend_exclude.json"), "utf8")).paths || []); } catch (e) { EXCLUDE = new Set(); } }
  return EXCLUDE;
}

// The file name for one clip. Null when the stream id is not one we know how to link to.
export function clipRecordPath(meta, now = Date.now()) {
  const vod = String((meta && meta.vod) || "").toLowerCase();
  if (!TWITCH_VOD.test(vod) && !KICK_VOD.test(vod)) return null;
  const t = Math.max(0, Math.round((Number(meta.t) || 0) / 10) * 10);
  return `trend/c/${day(now)}/${now.toString(36)}-${crypto.randomBytes(4).toString("hex")}~${vod}~${t}.json`;
}

// Called after a clip is charged (api/credits.js). Never throws: a failed count must not fail a clip.
export async function recordClip(meta, now = Date.now()) {
  try {
    const p = clipRecordPath(meta, now);
    if (!p) return false;
    await putJSON(p, {}, { maxAge: 31536000 });
    return true;
  } catch (e) { return false; }
}

export function parseRecordPath(p) {
  const m = String(p).match(/^trend\/c\/(\d{4}-\d{2}-\d{2})\/([a-z0-9]+)-[0-9a-f]{8}~([0-9a-f-]+)~(\d+)\.json$/);
  if (!m) return null;
  return { day: m[1], at: parseInt(m[2], 36), vod: m[3], t: Number(m[4]) };
}

// Pure: rows [{ vod, login, platform, t, day, n, at }] + what we know about each VOD -> the page data.
// A row with no `vod` is a clip made from a channel page (stream known, moment not).
export function aggregate(rows, vods = {}, now = Date.now()) {
  const days = Array.from({ length: WINDOW_DAYS }, (_, i) => day(now - i * 86400000));
  const today = days[0];
  const streams = new Map(), moments = new Map();
  let total = 0;
  for (const r of rows) {
    if (!days.includes(r.day) || !(r.n > 0)) continue;
    const v = r.vod ? vods[r.vod] : null;
    const login = (r.login || (v && v.login) || "").toLowerCase();
    if (!login) continue; // a stream we could not name is not shown
    const platform = r.platform || (v && v.platform) || "twitch";
    total += r.n;
    const sk = platform + ":" + login;
    const s = streams.get(sk) || { platform, login, name: (v && v.name) || login, clips: 0, clips_today: 0, last_day: r.day };
    if (v && v.name) s.name = v.name;
    s.clips += r.n; if (r.day === today) s.clips_today += r.n; if (r.day > s.last_day) s.last_day = r.day;
    streams.set(sk, s);
    if (r.vod && r.t > 0) {
      const b = Math.floor(r.t / MOMENT_BUCKET_S) * MOMENT_BUCKET_S;
      const mk = r.vod + ":" + b;
      const m = moments.get(mk) || { platform, login, name: s.name, vod: r.vod, t: r.t, bucket: b, clips: 0, clips_today: 0, title: (v && v.title) || "", game: (v && v.game) || "", by_t: {} };
      m.clips += r.n; if (r.day === today) m.clips_today += r.n;
      m.by_t[r.t] = (m.by_t[r.t] || 0) + r.n;
      moments.set(mk, m);
    }
  }
  const q = (s) => (s.platform === "kick" ? "kick.com/" + s.login : s.login);
  const streamList = [...streams.values()].filter((s) => s.clips >= STREAM_FLOOR).sort((a, b) => b.clips - a.clips || b.clips_today - a.clips_today || a.login.localeCompare(b.login))
    .map((s) => ({ ...s, clip_path: `/clip?q=${encodeURIComponent(q(s))}&src=trend` }));
  const momentList = [...moments.values()].filter((m) => m.clips >= MOMENT_FLOOR).sort((a, b) => b.clips - a.clips || b.clips_today - a.clips_today || a.bucket - b.bucket).slice(0, 40)
    .map(({ by_t, bucket, ...m }) => {
      const t = Number(Object.entries(by_t).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0]); // the start most people cut from
      const src = m.platform === "kick" ? `https://kick.com/${m.login}/videos/${m.vod}` : m.vod;
      return { ...m, t, clip_path: `/clip?q=${encodeURIComponent(src)}&t=${t}&src=trend` };
    });
  return {
    generated_at: new Date(now).toISOString(), window_days: WINDOW_DAYS, from: days[days.length - 1], to: today,
    clips_counted: total, floors: { stream: STREAM_FLOOR, moment: MOMENT_FLOOR },
    streams: streamList.slice(0, 40), moments: momentList,
  };
}

// Hourly, from the cron: list the clip files, name any VOD we have not seen, write trend/latest.json.
export async function buildTrend(now = Date.now(), { maxLookups = 30 } = {}) {
  const S = seed();
  const known = { ...(S.vods || {}), ...((await getJSON("trend/vods.json", { fresh: true }).catch(() => null)) || {}) };
  const through = S.through ? Date.parse(S.through) : 0;
  const rows = [...S.rows];
  const byKey = new Map(), skip = excluded();
  for (let i = 0; i < WINDOW_DAYS; i++) {
    for (const p of await listPaths(`trend/c/${day(now - i * 86400000)}/`)) {
      if (skip.has(p)) continue; // our own test and house clips from before they could mark themselves
      const r = parseRecordPath(p);
      if (!r || r.at <= through) continue; // the seed already covers clips up to `through`
      const k = r.day + "|" + r.vod + "|" + r.t;
      byKey.set(k, (byKey.get(k) || 0) + 1);
    }
  }
  for (const [k, n] of byKey) { const [d, vod, t] = k.split("|"); rows.push({ day: d, vod, t: Number(t), n }); }
  let looked = 0, learned = false;
  for (const r of rows) {
    if (!r.vod || known[r.vod] || looked >= maxLookups) continue;
    looked++;
    try {
      const v = KICK_VOD.test(r.vod) ? await getKickVod(r.vod) : await getVod(r.vod);
      known[r.vod] = v && v.channel ? { platform: KICK_VOD.test(r.vod) ? "kick" : "twitch", login: v.channel, name: v.channel_name || v.channel, title: v.title || "", game: v.game || "" } : { gone: true };
      learned = true;
    } catch (e) { /* try again next hour */ }
  }
  if (learned) await putJSON("trend/vods.json", known, { maxAge: 60 });
  const usable = Object.fromEntries(Object.entries(known).filter(([, v]) => v && !v.gone));
  const out = aggregate(rows, usable, now);
  await putJSON("trend/latest.json", out, { maxAge: 60 });
  return out;
}

// For pages: the stored build, or one made from the seed alone before the first cron run.
let memo = { at: 0, data: null };
export async function loadTrend() {
  if (memo.data && Date.now() - memo.at < 60000) return memo.data;
  let d = null;
  try { d = await getJSON("trend/latest.json"); } catch (e) {}
  if (!d) { const S = seed(); d = aggregate(S.rows, S.vods || {}); }
  memo = { at: Date.now(), data: d };
  return d;
}
