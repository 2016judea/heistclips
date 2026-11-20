// The owner's pitch on /launch: from their own last streams, the moments chat flagged and how
// many of them anyone clipped. Shown only to the owner, after they proved the channel is theirs:
// showing a streamer data about their own channel is fine under Twitch's terms; it is never sold
// or shown to anyone else (Twitch Developer Agreement §VI.C).
//
// Flagged = the chat-spike finder behind /clip and find_clip_moments (lib/momentstool.js).
// Clipped = a viewer's Twitch clip inside the moment, plus clips made on
// heistclips from that VOD within 30 s of the moment (the per-clip records behind
// /most-clipped-streams, lib/trend.js). Twitch's anonymous read lists only the channel's 100 most-viewed
// clips of the week (lib twitchClips; video.clips stops after the stream's first hour, 2026-11-20),
// so a moment without one is "no clip found", never "never clipped". The page says what was counted.
import { getChannel } from "../public/js/twitch.js";
import { findClipMoments } from "./momentstool.js";
import { listPaths } from "./store.js";
import { parseRecordPath, seed } from "./trend.js";

export const PITCH_VODS = 2;
export const NEAR_S = 30;
const day = (ms) => new Date(ms).toISOString().slice(0, 10);

// heistclips clips per VOD: [{ vod, t }] from the trend records and the seed, for the days the
// VODs could have been clipped (their start to today, at most 14 days).
export async function heistclipsClips(vodIds, sinceMs, now = Date.now(), list = listPaths) {
  const want = new Set(vodIds.map(String));
  const out = [];
  for (const r of seed().rows || []) if (want.has(String(r.vod)) && r.t > 0) for (let i = 0; i < (r.n || 1); i++) out.push({ vod: String(r.vod), t: r.t });
  const from = Math.max(sinceMs, now - 14 * 86400000);
  for (let d = Date.parse(day(from)); d <= now; d += 86400000) {
    for (const p of await list(`trend/c/${day(d)}/`).catch(() => [])) {
      const r = parseRecordPath(p);
      if (r && want.has(r.vod)) out.push({ vod: r.vod, t: r.t });
    }
  }
  return out;
}

// Pure: moments per VOD + clip records -> the pitch numbers.
export function pitchNumbers(perVod, clips) {
  let flagged = 0, clipped = 0, onHeist = 0;
  const unclipped = [];
  const vods = perVod.map(({ vod, moments }) => {
    let f = 0, c = 0;
    for (const m of moments) {
      f++;
      const near = clips.filter((x) => x.vod === String(vod.id) && x.t >= m.t_start_s - NEAR_S && x.t <= m.t_end_s + NEAR_S).length;
      const tw = Number(m.already_clipped_on_twitch) || 0;
      onHeist += near;
      if (near > 0 || tw > 0) c++;
      else unclipped.push({ vod: vod.id, title: vod.title, start: m.start, t_start_s: m.t_start_s, chat: m.chat_speed_vs_normal, phrase: m.top_chat_phrase || null, watch: m.watch });
    }
    flagged += f; clipped += c;
    return { id: vod.id, title: vod.title, date: vod.created_at, length_s: vod.length, flagged: f, clipped: c };
  });
  unclipped.sort((a, b) => parseFloat(b.chat) - parseFloat(a.chat));
  return { flagged, clipped, no_clip_found: flagged - clipped, heistclips_clips: onHeist, vods, top_unclipped: unclipped.slice(0, 5) };
}

export async function pitchFor(login, { deps = {}, now = Date.now() } = {}) {
  const ch = await (deps.getChannel || getChannel)(login);
  if (!ch) return { ok: false, error: "That Twitch channel was not found." };
  const vods = (ch.vods || []).filter((v) => v.length > 600).slice(0, PITCH_VODS);
  if (!vods.length) return { ok: true, channel: ch.login, flagged: 0, clipped: 0, no_clip_found: 0, heistclips_clips: 0, vods: [], top_unclipped: [], note: "No saved streams to read: Twitch keeps past broadcasts only when they are switched on (Settings > Stream > Store past broadcasts)." };
  const find = deps.findClipMoments || findClipMoments;
  const perVod = await Promise.all(vods.map(async (v) => {
    const r = await find({ source: v.id, limit: 15 }).catch(() => null);
    return { vod: v, moments: (r && r.out && r.out.moments) || [] };
  }));
  const since = Math.min(...vods.map((v) => Date.parse(v.created_at) || now));
  const clips = await heistclipsClips(vods.map((v) => v.id), since, now, deps.listPaths);
  const games = [...new Set(vods.map((v) => v.game).filter(Boolean))];
  return { ok: true, channel: ch.login, name: ch.name, games, ...pitchNumbers(perVod, clips) };
}
