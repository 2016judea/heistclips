// find_clip_moments for the connector: resolve what they passed, read chat, shape the answer.
//
// A finished stream's chat never changes, so its moments are kept (Blob, under a keyed-hash
// path) and a second call for the same VOD answers without re-reading thousands of chat pages.
// A stream still recording is kept for a minute in this instance only: long enough for an
// assistant that asks twice, short enough that new moments show up.
import { findMoments, clock } from "../public/js/twitch.js";
import { markSpoilers } from "../public/js/spoilers.js";
import { liveGtaStreams } from "./streamers.js";
import { resolveSource } from "./momentsource.js";
import { getJSON, putJSON, secretPath } from "./store.js";

const SITE = "https://heistclips.com";
const CACHE_V = 1; // bump when the moment shape or the scoring changes
// The server reads Twitch chat with more requests in flight than a browser tab does.
// Measured 2026-11-19 on an 8.6-hour VOD (1,029 pages): 12 in flight 9.7 s, 32 in flight 3.7 s,
// none refused.
export const SERVER_CONCURRENCY = 32;
const cachePath = (vod) => secretPath("mcache", `v${CACHE_V}|${vod.platform || "twitch"}|${vod.id}`);
const warm = new Map(); // vod key -> { at, k, moments }

async function cached(vod, k) {
  const key = (vod.platform || "twitch") + ":" + vod.id;
  const w = warm.get(key);
  const live = vod.status === "RECORDING";
  if (w && w.k >= k && (!live || Date.now() - w.at < 60000)) return { moments: w.moments, cache: "warm" };
  if (live) return null;
  const d = await getJSON(cachePath(vod)).catch(() => null);
  // The stored length guards against a VOD cached while Twitch was still finalising it.
  if (d && d.k >= k && Math.abs((d.length || 0) - (vod.length || 0)) < 30) { warm.set(key, { at: Date.now(), k: d.k, moments: d.moments }); return { moments: d.moments, cache: "stored" }; }
  return null;
}

async function remember(vod, k, moments) {
  const key = (vod.platform || "twitch") + ":" + vod.id;
  if (warm.size > 200) warm.clear();
  warm.set(key, { at: Date.now(), k, moments });
  if (vod.status !== "RECORDING") await putJSON(cachePath(vod), { v: CACHE_V, at: new Date().toISOString(), k, length: vod.length, moments }, { maxAge: 300 }).catch(() => null);
}

// -> { out, log }: `out` is what the assistant reads, `log` the analytics fields (no chat text).
export async function findClipMoments(args = {}, { tag = (u) => u, deps = {} } = {}) {
  const t0 = Date.now();
  const limit = Math.max(1, Math.min(15, Number(args.limit) || 8));
  const src = await (deps.resolveSource || resolveSource)(args.source);
  if (!src.ok) {
    const out = { found: false, reason: src.err, message: src.message };
    if (src.suggest_live) {
      const live = await (deps.liveGtaStreams || liveGtaStreams)(8).catch(() => []);
      out.live_now = live.filter((s) => s.login !== src.exclude).slice(0, 6).map((s) => ({ channel: s.name, source: s.login, viewers: s.viewers, game: s.game }));
      if (out.live_now.length) out.next = "These channels are live with saved video right now: offer them, and call find_clip_moments with a source from this list if the user picks one.";
    }
    return { out, log: { err: src.err, ok: false } };
  }
  const { vod } = src;
  const k = Math.min(15, limit + 3);
  let hit = await cached(vod, k), moments, cache = "miss";
  const t1 = Date.now();
  if (hit) { moments = hit.moments; cache = hit.cache; }
  else {
    const r = await (deps.findMoments || findMoments)(vod, { k, concurrency: vod.platform === "kick" ? undefined : SERVER_CONCURRENCY });
    markSpoilers(vod, r.moments);
    moments = r.moments;
    await remember(vod, k, moments);
  }
  const read_ms = Date.now() - t1;
  const skipped = args.skip_spoilers ? moments.filter((m) => m.spoiler && m.spoiler.spoiler) : [];
  const kept = args.skip_spoilers ? moments.filter((m) => !(m.spoiler && m.spoiler.spoiler)) : moments;
  const source = vod.platform === "kick" ? vod.url : vod.id;
  const list = kept.slice(0, limit).map((m, i) => ({
    rank: i + 1, start: clock(m.t_start), end: clock(m.t_end), t_start_s: m.t_start, t_end_s: m.t_end,
    chat_speed_vs_normal: m.chat_ratio + "x", event_type: m.event_type, clip_requests_in_chat: m.clip_requests,
    top_chat_phrase: m.phrase && m.phrase.text, already_clipped_on_twitch: m.twitch_clips, twitch_clip_views: m.twitch_clip_views,
    music_risk: m.music_risk.level, music_note: m.music_risk.why, spoiler_risk: m.spoiler.level, spoiler_note: m.spoiler.reason, hooks: m.hooks,
    ...(m.quiet ? { quiet: true } : {}),
    watch: m.url, cut_it: tag(`${SITE}/clip?q=${encodeURIComponent(source)}&t=${m.t_start}`),
  }));
  const out = {
    stream: { platform: vod.platform || "twitch", channel: vod.channel_name, title: vod.title, game: vod.game, length: clock(vod.length), status: vod.status === "RECORDING" ? "live, still recording" : "finished", url: vod.url },
    ...(src.note ? { note_on_source: src.note } : {}),
    ...(src.focus_t != null ? { clip_at: clock(src.focus_t), clip_at_s: src.focus_t } : {}),
    moments: list, spoiler_filter: args.skip_spoilers ? "on" : "off",
    skipped_spoilers: skipped.map((m) => ({ start: clock(m.t_start), end: clock(m.t_end), reason: m.spoiler.reason, watch: m.url })),
    note: list.length ? "Cut any of these to 9:16 with cut_clip (source = stream.url, start = t_start_s, end = t_end_s), or open the cut_it link." + (list.some((m) => m.quiet) ? " Moments marked quiet are the best of a calm stream, not big spikes." : "") : "Chat was steady the whole stream; no clear spikes.",
  };
  return { out, log: { ok: true, platform: vod.platform || "twitch", cache, read_ms, stream_hours: Math.round((vod.length || 0) / 360) / 10, live: vod.status === "RECORDING", moments: list.length, total_ms: Date.now() - t0 } };
}
