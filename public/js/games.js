// Which game was on screen at each moment. A stream's category is only what it was set to at one
// point: on 2026-11-19, 4 of 5 recent xqc VODs and 5 of 5 Kai Cenat VODs ran more than one game
// (Kai Cenat's live VOD said "Just Chatting" while 21 of its 33 hours were GTA VI). Twitch keeps
// a chapter per game change, readable anonymously; Kick has one category per stream, so a Kick
// moment takes the stream's category.
import { gql } from "./twitch.js";

const esc = (s) => String(s).replace(/[^0-9]/g, "");

// [{ start, end, game }] in seconds; the last chapter of a stream still going ends at Infinity.
export async function vodChapters(vod) {
  if (!vod || vod.platform === "kick") return vod && vod.game ? [{ start: 0, end: Infinity, game: vod.game }] : [];
  const d = await gql(`query{ video(id:"${esc(vod.id)}"){ game{ name } moments(momentRequestType: VIDEO_CHAPTER_MARKERS, first:100){ edges{ node{ positionMilliseconds durationMilliseconds description details{ ... on GameChangeMomentDetails { game{ name displayName } } } } } } } }`);
  const v = d && d.video;
  if (!v) return [];
  const edges = (v.moments && v.moments.edges) || [];
  const live = vod.status === "RECORDING";
  const out = edges.map((e, i) => {
    const n = e.node, start = (n.positionMilliseconds || 0) / 1000, dur = (n.durationMilliseconds || 0) / 1000;
    const last = i === edges.length - 1;
    return { start, end: last && (live || !dur) ? Infinity : start + dur, game: (n.details && n.details.game && (n.details.game.name || n.details.game.displayName)) || n.description || "" };
  }).filter((c) => c.game);
  if (!out.length && (v.game || vod.game)) out.push({ start: 0, end: Infinity, game: (v.game && v.game.name) || vod.game });
  return out;
}

export function gameAt(chapters, t) {
  if (!chapters || !chapters.length) return null;
  const c = chapters.find((x) => t >= x.start && t < x.end);
  return c ? c.game : t >= chapters[chapters.length - 1].start ? chapters[chapters.length - 1].game : chapters[0].game;
}

export const isGta = (g) => /grand theft auto|\bgta\b/i.test(g || "");
export const isGta6 = (g) => /grand theft auto (vi|6)\b|\bgta ?(vi|6)\b/i.test(g || "");

// "Grand Theft Auto VI" -> "GTA VI"; anything else as Twitch names it.
export function shortGame(g) {
  const s = String(g || "");
  const m = s.match(/^grand theft auto:?\s*(.*)$/i);
  if (!m) return s;
  return m[1] ? "GTA " + m[1].replace(/^san andreas$/i, "San Andreas") : "GTA";
}

// Does this moment's game meet a campaign's game rule? want: "GTA VI", "GTA", "Fortnite"… or null.
// Returns { ok: true|false|null, game } — null when the game of the moment is not known.
export function gameFits(want, game) {
  if (!want) return { ok: true, game };
  if (!game) return { ok: null, game };
  if (/^gta$/i.test(want)) return { ok: isGta(game), game };
  if (/gta ?(vi|6)|grand theft auto (vi|6)/i.test(want)) return { ok: isGta6(game), game };
  if (/gta ?(v|5)\b|grand theft auto v\b/i.test(want)) return { ok: /grand theft auto v\b(?!i)|gta ?(v|5)\b(?!i)/i.test(game), game };
  return { ok: new RegExp(String(want).replace(/[.*+?^${}()|[\]\\]/g, "").replace(/\s+/g, ".?"), "i").test(game), game };
}
