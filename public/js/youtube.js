// YouTube, by official routes only. Runs in the browser and in Node (the server) unchanged.
//
// What heistclips may read (docs/youtube-feasibility-2026-11-19.md): the YouTube Data API v3,
// oEmbed and plain watch links. YouTube's robots.txt disallows /youtubei/ and /live_chat, so the
// chat-replay route the feasibility probe found is never used, and nothing here downloads video.
// The key lives on our server (lib/youtube.js); this file only parses, filters and clusters.
//
// Moments come from two official signals:
//   live stream     -> its live chat (liveChatMessages.list), read by one shared poller per stream
//   finished stream -> viewers' timestamped comments ("2:41:31 lmao"), clustered here
// The cut is made from the clipper's own copy of the video, in their browser (public/js/app.js).

import { findPeaks, momentFromMessages, classify, hooks, clock } from "./twitch.js";

const ID = /^[A-Za-z0-9_-]{11}$/;
const HANDLE = /^@?[A-Za-z0-9._-]{3,30}$/;

export const ytWatch = (id, t) => `https://www.youtube.com/watch?v=${id}${t ? `&t=${Math.max(0, Math.floor(t))}s` : ""}`;

// "1h2m3s", "3723", "3723s", "1:02:03" -> seconds
function tParam(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (/^\d+s?$/.test(s)) return Number(s.replace(/s$/, ""));
  const m = s.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (m && (m[1] || m[2] || m[3])) return Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
  const c = parseTs(s);
  return c == null ? null : c;
}

// What YouTube link did they paste? null if it is not YouTube at all.
//   youtube.com/watch?v=ID, youtu.be/ID, /live/ID, /embed/ID     -> { kind: "youtube", id, t? }
//   youtube.com/@handle (also /@handle/live, /streams, /videos)  -> { kind: "ythandle", handle }
//   youtube.com/channel/UC…                                      -> { kind: "ythandle", channel }
//   youtube.com/shorts/ID                                        -> unknown (a Short is not a stream)
export function ytParse(raw) {
  const s = String(raw || "").trim();
  if (!/(?:^|[/.])(?:youtube\.com|youtu\.be)(?:[/?#:]|$)/i.test(s)) return null;
  let u;
  try { u = new URL(/^https?:\/\//i.test(s) ? s : "https://" + s.replace(/^\/+/, "")); } catch (e) { return { kind: "unknown", site: "youtube" }; }
  const host = u.hostname.toLowerCase().replace(/^(?:www|m|music|gaming)\./, "");
  const segs = u.pathname.split("/").filter(Boolean);
  const t = tParam(u.searchParams.get("t") || u.searchParams.get("start") || (u.hash.match(/t=([^&]+)/) || [])[1]);
  const vid = (id) => (ID.test(id || "") ? { kind: "youtube", id, ...(t != null ? { t } : {}) } : { kind: "unknown", site: "youtube" });
  if (host === "youtu.be") return vid(segs[0]);
  if (host !== "youtube.com") return { kind: "unknown", site: "youtube" };
  if (segs[0] === "watch" || (!segs.length && u.searchParams.get("v"))) return vid(u.searchParams.get("v"));
  if (["live", "embed", "v", "e"].includes(segs[0])) return vid(segs[1]);
  if (segs[0] === "shorts") return { kind: "unknown", site: "youtube_short" };
  if (segs[0] && segs[0].startsWith("@") && HANDLE.test(segs[0])) return { kind: "ythandle", handle: segs[0].slice(1).toLowerCase() };
  if (segs[0] === "channel" && /^UC[A-Za-z0-9_-]{22}$/.test(segs[1] || "")) return { kind: "ythandle", channel: segs[1] };
  if ((segs[0] === "c" || segs[0] === "user") && HANDLE.test(segs[1] || "")) return { kind: "ythandle", handle: segs[1].toLowerCase() };
  return { kind: "unknown", site: "youtube" };
}

// ---- noise: what a slow chat is mostly made of ----------------------------------------------
// On Tomo's Day 2 stream the raw top 3 spikes were all greeting floods, and 4 of 6 picks after
// minute 5 were "play as lucia" requests and hellos (feasibility doc, 2026-11-19). A YouTube chat
// is slower than the same streamer's Twitch chat, so these get filtered before the peak finder
// counts speed. Reactions ("LMAO", "💀", "NOOO") are never noise.
const GREET = /^(?:hi+|hii+|hey+|hello+|helo|hallo|hola|ola|oi+|yo+|sup|wassup|whats ?up|wsg|salut|bonjour|servus|moin|gm|good (?:morning|evening|night|afternoon)|morning|evening|greetings|namaste|salam|bonsoir|buenas|buenos dias|bom dia|boa noite|boa tarde)\b/i;
const FIRST = /^(?:first|1st|frist|early|im early|i'?m early|early gang|here early|here before)\b/i;
const WSTREAM = /^(?:w|big w|dub|ww+|massive w)\s+(?:stream|streamer|streams|chat|content|vid|video|day \d+|live)\b/i;
const LOVE = /^(?:love (?:you|u|ya|ur|your|the)|ily+|i love (?:you|u|ur|your|this)|❤+|<3+)\b/i;
const ROLL = /\b(?:where (?:are|r) (?:you|u|ya|yall|y'all) from|anyone from|who(?:'?s| is) (?:here )?from|watching from|greetings from|hi from|hello from|love from|from (?:india|brazil|brasil|pakistan|nigeria|mexico|uk|usa|canada|germany|france|spain|portugal|philippines|indonesia|egypt|morocco|algeria|turkey|kenya|ghana)\b)/i;
const SHOUT = /^(?:shout ?out|s\/o|say (?:hi|hello)|can (?:you|u) say (?:hi|hello)|notice me|pin (?:me|this|my)|heart (?:me|my|this)|reply)\b/i;
const ASK = /^(?:pls |please |plz |yo |bro |bruh |hey |can (?:you|u) |could (?:you|u) |will (?:you|u) |you should |u should |go |let'?s )?(?:play|try|go to|do|get|buy|steal|drive|use|switch|turn on|join|read|check|look at|say|show|change|put|rob|go back|explore|visit|find|unlock|equip)\b(?!.*\b(?:lol|lmao|lmfao|haha|wtf|omg|bro what|no way)\b)/i;
const SPAM = /\b(?:subscribe|sub to|check (?:out )?my|my channel|follow me|free (?:robux|vbucks|v-bucks|codes?)|giveaway|telegram|whatsapp)\b|https?:\/\//i;
const EMOTE = /^(?::[a-z0-9_-]+:\s*)+$/i; // YouTube's own :hand-pink-waving: style emotes, nothing else
const SOFT_EMOJI = /^[\s\u{1F44B}\u{2764}\u{FE0F}\u{1F499}\u{1F49A}\u{1F49B}\u{1F49C}\u{1F5A4}\u{1F90D}\u{1F90E}\u{1F9E1}\u{1F496}\u{1F497}\u{1F498}\u{1F495}\u{1F64F}\u{1F44D}\u{1F44F}\u{1F60A}\u{1F970}\u{1F60D}\u{1F618}\u{1F3FB}-\u{1F3FF}]+$/u;

export function noiseKind(text) {
  const s = String(text || "").trim();
  if (!s) return "empty";
  if (SPAM.test(s)) return "spam";
  if (EMOTE.test(s)) return "emote_only";
  if (SOFT_EMOJI.test(s)) return "emote_only";
  if (ROLL.test(s)) return "roll_call";
  if (s.length <= 40 && GREET.test(s)) return "greeting";
  if (s.length <= 30 && FIRST.test(s)) return "first";
  if (WSTREAM.test(s) || LOVE.test(s)) return "greeting";
  if (SHOUT.test(s)) return "shoutout";
  if (ASK.test(s)) return "request";
  return null;
}
export const isNoise = (text) => noiseKind(text) !== null;

// ---- finished streams: viewers' timestamped comments ----------------------------------------
const TS = /(?:^|[^\d:])((?:\d{1,2}:)?\d{1,3}:\d{2})(?![\d:])/g;
export function parseTs(s) {
  const p = String(s).split(":").map(Number);
  if (p.some((x) => !Number.isFinite(x))) return null;
  if (p.length === 3) { if (p[1] > 59 || p[2] > 59) return null; return p[0] * 3600 + p[1] * 60 + p[2]; }
  if (p.length === 2) { if (p[1] > 59) return null; return p[0] * 60 + p[1]; }
  return null;
}

// One comment -> the seconds it points at, each with the words on the same line.
// "3:00 pm" and "at 5:30 EST" are clock times, not stream times.
export function commentVotes(c, length) {
  const text = String((c && c.text) || "");
  const votes = [];
  for (const line of text.split(/\n+/)) {
    for (const m of line.matchAll(TS)) {
      const sec = parseTs(m[1]);
      if (sec == null || (length && sec > length + 5)) continue;
      const after = line.slice(m.index + m[0].length, m.index + m[0].length + 6);
      if (/^\s*(?:am|pm|a\.m|p\.m|est|edt|pst|pdt|cst|cet|utc|gmt|bst)\b/i.test(after)) continue;
      let label = line.replace(TS, " ").replace(/[[\]{}()]/g, " ").replace(/^[\s\-–—:|•·.,>~]+|[\s\-–—:|•·~]+$/g, "").replace(/\s+/g, " ").trim();
      if (!/[\p{L}\p{Extended_Pictographic}]/u.test(label)) label = "";
      votes.push({ t: sec, label, likes: Number((c && c.likes) || 0), id: c && c.id, parts: m[1].split(":").length });
    }
  }
  return votes;
}

function median(xs) {
  const s = xs.slice().sort((a, b) => a - b);
  if (!s.length) return 0;
  const k = Math.floor(s.length / 2);
  return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2;
}

// Comments -> moments. Votes within `win` seconds of a cluster's first vote are one moment. A
// comment that lists many timestamps (a viewer's chapter list) counts half per line, so one
// long list cannot outvote a crowd. A moment needs two different comments, or one with 3+ likes.
export function commentMoments(vod, comments, { k = 10, win = 45, skipStart = 60 } = {}) {
  const length = vod.length || 0;
  let votes = [];
  for (const c of comments) {
    const v = commentVotes(c, length);
    for (const x of v) votes.push({ ...x, w: (1 + Math.log10(1 + x.likes)) / (v.length > 3 ? 2 : 1) });
  }
  // On a long stream "8:29" often means 8 h 29 min, not 8 min 29 s: IShowSpeed's 23-hour stream
  // had a crowd at 8:28:50 and a second one at "8:29" (2026-11-19). A two-part stamp is read as
  // hours:minutes when a three-part stamp sits within 2 minutes of that reading.
  const long = votes.filter((v) => v.parts === 3).map((v) => v.t);
  votes = votes.map((v) => {
    if (v.parts !== 2) return v;
    const hm = Math.floor(v.t / 60) * 3600 + (v.t % 60) * 60;
    return hm !== v.t && hm <= length && long.some((t) => Math.abs(t - hm) <= 120) ? { ...v, t: hm } : v;
  }).filter((v) => v.t >= skipStart); // the first minute is the intro and its song ("which song??")
  votes.sort((a, b) => a.t - b.t);
  const clusters = [];
  for (const v of votes) {
    const c = clusters[clusters.length - 1];
    if (c && v.t - c.t0 <= win) c.votes.push(v); else clusters.push({ t0: v.t, votes: [v] });
  }
  const scored = clusters.map((c) => {
    const ids = new Set(c.votes.map((v) => v.id));
    const likes = c.votes.reduce((a, v) => a + v.likes, 0);
    return { ...c, n: ids.size, likes, score: c.votes.reduce((a, v) => a + v.w, 0) + 0.5 * (ids.size - 1) };
  }).filter((c) => c.n >= 2 || c.likes >= 3 || c.votes.some((v) => v.likes >= 3));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k).map((c) => {
    const t = Math.round(median(c.votes.map((v) => v.t)));
    const labelled = c.votes.filter((v) => v.label && v.label.length >= 2).sort((a, b) => b.likes - a.likes);
    const best = labelled[0];
    const quote = best ? (best.label.length > 90 ? best.label.slice(0, 89) + "…" : best.label) : "";
    const kind = classify(labelled.map((v) => ({ text: v.label })));
    const m = {
      platform: "youtube", vod_id: vod.id, channel: vod.channel, signal: "comments",
      t_peak: t, t_start: Math.max(0, t - 5), t_end: length ? Math.min(length, t + 30) : t + 30,
      comments: c.n, likes: c.likes, quote, quotes: labelled.slice(0, 3).map((v) => ({ text: v.label, likes: v.likes })),
      chat_ratio: null, event_type: kind.type, signals: kind.counts, phrase: quote ? { text: quote, n: c.n, words: false } : null,
      clip_requests: 0, music_risk: { level: "low", why: "YouTube does not mark muted music; check for in-game radio" },
      chat: [], url: ytWatch(vod.id, Math.max(0, t - 5)),
    };
    m.hooks = hooks(m, vod.channel_name);
    m.score = Math.round(c.score * 10) / 10;
    return m;
  }).sort((a, b) => b.score - a.score);
}

// ---- live streams: the chat a shared poller gathered ----------------------------------------
// msgs: [{ id, t (stream second, whole), text }] for as long as someone has been watching.
// The same spike finder as a Twitch VOD (findPeaks + momentFromMessages), on 20-second bins of
// the chat with greetings, requests and spam taken out first.
export function momentsFromChat(vod, msgs, { k = 12, step = 20, fill = 3, skipStart = 180 } = {}) {
  const clean = msgs.filter((m) => !isNoise(m.text)).map((m) => ({ ...m, t: Math.floor(m.t) })).sort((a, b) => a.t - b.t);
  if (clean.length < 8) return { moments: [], curve: [], kept: clean.length, noise: msgs.length - clean.length };
  const t0 = clean[0].t, t1 = clean[clean.length - 1].t;
  const samples = [];
  let i = 0;
  for (let t = t0; t <= t1; t += step) {
    const bin = [];
    while (i < clean.length && clean[i].t < t + step) bin.push(clean[i++]);
    samples.push({ t: t + step / 2, rate: bin.length / step, msgs: bin });
  }
  const gap = 90;
  let peaks = findPeaks(samples, { k, gap }).filter((p) => p.t >= skipStart);
  if (peaks.length < fill) {
    const soft = findPeaks(samples, { k, gap, minRatio: 1.25 }).filter((p) => p.t >= skipStart && peaks.every((q) => Math.abs(q.t - p.t) >= gap)).slice(0, fill - peaks.length);
    peaks = peaks.concat(soft.map((p) => ({ ...p, soft: true })));
  }
  const v = { ...vod, platform: "youtube", muted: [] };
  const moments = peaks.map((p) => {
    const m = momentFromMessages(v, clean, p);
    m.platform = "youtube"; m.signal = "live_chat"; m.url = ytWatch(vod.id, m.t_start);
    if (p.soft) m.quiet = true;
    return m;
  });
  moments.sort((a, b) => b.chat_ratio - a.chat_ratio);
  for (let j = moments.length - 1; j >= 0; j--) {
    const a = moments[j];
    if (moments.some((b, x) => x < j && b.t_start < a.t_end - 10 && b.t_end > a.t_start + 10)) moments.splice(j, 1);
  }
  for (const m of moments) {
    m.twitch_clips = 0; m.twitch_clip_views = 0;
    m.hooks = hooks(m, vod.channel_name);
    m.score = Math.round(m.chat_ratio * 10 * (1 + Math.min(5, m.clip_requests) * 0.4)) / 10;
  }
  moments.sort((a, b) => (a.quiet ? 1 : 0) - (b.quiet ? 1 : 0) || b.score - a.score);
  return { moments, curve: samples.map((s) => [Math.round(s.t), Math.round(s.rate * 100) / 100]), kept: clean.length, noise: msgs.length - clean.length };
}

export const ytClock = clock;
