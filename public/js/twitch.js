// Twitch, read-only and anonymous. Runs in the browser and in Node (the MCP server) unchanged.
// Source and Moment entities in DATA_MODEL.md. gql.twitch.tv answers any origin (CORS *), so
// moment-finding costs us nothing per stream hour: the visitor's browser does the reading.

import { kickCommentPage, kickRate } from "./kick.js";

const GQL = "https://gql.twitch.tv/gql";
const CID = "kimne78kx3ncx6brgo4mv6wki5h1ko"; // Twitch's own public web client id

export async function gql(query) {
  const r = await fetch(GQL, { method: "POST", headers: { "Client-Id": CID, "content-type": "text/plain" }, body: JSON.stringify({ query }) });
  if (!r.ok) throw new Error("twitch gql " + r.status);
  const d = await r.json();
  if (d.errors && !d.data) throw new Error("twitch gql: " + d.errors.map((e) => e.message).join("; "));
  return d.data;
}

const esc = (s) => String(s).replace(/[^A-Za-z0-9_]/g, "");

// "https://www.twitch.tv/videos/123", "twitch.tv/xqc", "xqc", "123456789" -> what it is.
export function parseInput(raw) {
  const s = String(raw || "").trim();
  let k = s.match(/kick\.com\/(?:video\/|[A-Za-z0-9_-]+\/videos\/)([0-9a-f]{8}-[0-9a-f-]{27})/i);
  if (k) return { kind: "kickvod", id: k[1].toLowerCase() };
  k = s.match(/^(?:https?:\/\/)?(?:www\.)?kick\.com\/([A-Za-z0-9_-]{2,40})\/?(?:\?.*)?$/i) || s.match(/^kick:([A-Za-z0-9_-]{2,40})$/i);
  if (k) return { kind: "kick", login: k[1].toLowerCase() };
  let m = s.match(/videos\/(\d{6,})/) || s.match(/^(\d{8,})$/);
  if (m) return { kind: "vod", id: m[1] };
  m = s.match(/(?:twitch\.tv\/)?@?([A-Za-z0-9_]{3,25})\/?(?:\?.*)?$/);
  if (m && !/kick\.com|youtube|youtu\.be/.test(s)) return { kind: "channel", login: m[1].toLowerCase() };
  return { kind: "unknown" };
}

const VOD_FIELDS = `id title lengthSeconds status broadcastType createdAt publishedAt viewCount
  game { name } owner { login displayName profileImageURL(width:70) }
  muteInfo { mutedSegmentConnection { nodes { duration offset } } }
  previewThumbnailURL(width:640,height:360) seekPreviewsURL`;

export async function getChannel(login) {
  const d = await gql(`query{ user(login:"${esc(login)}"){ id login displayName profileImageURL(width:70) description
    stream{ id createdAt viewersCount title game{ name } archiveVideo{ ${VOD_FIELDS} } }
    videos(first:5, type:ARCHIVE, sort:TIME){ edges{ node{ ${VOD_FIELDS} } } } } }`);
  const u = d.user;
  if (!u) return null;
  const vods = (u.videos && u.videos.edges || []).map((e) => shapeVod(e.node));
  const stream = u.stream ? { id: u.stream.id, started_at: u.stream.createdAt, viewers: u.stream.viewersCount, title: u.stream.title, game: u.stream.game && u.stream.game.name } : null;
  let live_vod = u.stream && u.stream.archiveVideo ? shapeVod(u.stream.archiveVideo) : null;
  if (!live_vod && stream) live_vod = vods.find((v) => v.status === "RECORDING") || null;
  return { login: u.login, name: u.displayName, avatar: u.profileImageURL, is_live: !!stream, stream, live_vod, vods };
}

export async function getVod(id) {
  const d = await gql(`query{ video(id:"${esc(id)}"){ ${VOD_FIELDS} } }`);
  return d.video ? shapeVod(d.video) : null;
}

function shapeVod(v) {
  const muted = (v.muteInfo && v.muteInfo.mutedSegmentConnection && v.muteInfo.mutedSegmentConnection.nodes) || [];
  let cdn = null;
  const m = (v.seekPreviewsURL || "").match(/^https:\/\/([a-z0-9]+)\.cloudfront\.net\/([^/]+)\/storyboards\//);
  if (m) cdn = { host: m[1], dir: m[2] };
  return {
    id: v.id, title: v.title, length: v.lengthSeconds, status: v.status, created_at: v.createdAt,
    views: v.viewCount, game: v.game && v.game.name,
    channel: v.owner && v.owner.login, channel_name: v.owner && v.owner.displayName, avatar: v.owner && v.owner.profileImageURL,
    thumb: v.previewThumbnailURL, muted: muted.map((x) => ({ start: x.offset, end: x.offset + x.duration })),
    cdn, url: `https://www.twitch.tv/videos/${v.id}`,
  };
}

// Same-origin path to a VOD rendition, through heistclips' /tv/ rewrite to Twitch's VOD CDN
// (the CDN sends no CORS header, and a canvas can only read same-origin video).
export function playlistPath(vod, quality = "chunked") {
  if (vod.platform === "kick") return vod.source || null; // stream.kick.com sends CORS *
  if (!vod.cdn) return null;
  return `/tv/${vod.cdn.host}/${vod.cdn.dir}/${quality}/index-dvr.m3u8`;
}

export function twitchTime(t) {
  t = Math.max(0, Math.floor(t));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return `${h}h${m}m${s}s`;
}

export function clock(t) {
  t = Math.max(0, Math.floor(t));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s).padStart(2, "0");
}

// ---- chat replay -------------------------------------------------------------------------

async function commentPage(vod, offset) {
  if (vod.platform === "kick") return kickCommentPage(vod, offset);
  const vodId = vod.id;
  const d = await gql(`query{ video(id:"${esc(vodId)}"){ comments(contentOffsetSeconds:${Math.max(0, Math.floor(offset))}){
    edges{ node{ id contentOffsetSeconds message{ fragments{ text emote{ emoteID } } } } } } } }`);
  const edges = (d.video && d.video.comments && d.video.comments.edges) || [];
  return edges.map((e) => ({ id: e.node.id, t: e.node.contentOffsetSeconds, text: (e.node.message && e.node.message.fragments || []).map((f) => f.text).join("") }));
}

async function pool(items, n, fn, onEach) {
  let i = 0, done = 0;
  const out = new Array(items.length);
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const k = i++;
      try { out[k] = await fn(items[k]); } catch (e) { out[k] = null; }
      done++;
      if (onEach) onEach(done, items.length);
    }
  }));
  return out;
}

// What chat is saying, by kind. Emotes are the words chat actually uses.
const LEX = {
  funny: /\b(lul|lulw|kekw|omegalul|icant|lmao+|lmfao|xd+|haha+|jaja+|k{4,}|lol+|kek|pepelaugh|lolw)\b|😂|🤣|💀/i,
  hype: /\b(pog|pogchamp|poggers|pogu|letsgo+|lets go+|w+|gg+|clutch|insane|goat|sheesh|ez)\b|🔥|🐐/i,
  shock: /\b(what+|wtf|no way|nah+|omg|monkas|monkaw|d:|holy|bro what|wait)\b|\?{2,}|😱|😳/i,
  fail: /\b(l+|f+|rip|sadge|unlucky|bruh|ff)\b/i,
  clip: /\b(clip+(ed| it| that)?|clipped)\b|📎|✂️/i,
  music: /\b(song|music|banger|radio|playlist|shazam|track)\b|🎵|🎶/i,
};

export function classify(msgs) {
  const n = { funny: 0, hype: 0, shock: 0, fail: 0, clip: 0, music: 0 };
  for (const m of msgs) for (const k in LEX) if (LEX[k].test(m.text)) n[k]++;
  const kinds = ["funny", "hype", "shock", "fail"].sort((a, b) => n[b] - n[a]);
  return { counts: n, type: n[kinds[0]] >= Math.max(2, msgs.length * 0.08) ? kinds[0] : "reaction" };
}

const EMOTE_WORDS = { kekw: "😂", lul: "😂", lulw: "😂", omegalul: "😂", icant: "😂", pog: "🤯", pogchamp: "🤯", poggers: "🤯", pogu: "🤯", monkas: "😰", sadge: "😢", "d:": "😱" };

export function topPhrase(msgs) {
  const tally = new Map();
  for (const m of msgs) {
    let s = m.text.trim().replace(/\s+/g, " ");
    if (!s || s.length > 40 || /https?:/.test(s) || /^@/.test(s)) continue;
    const key = s.toLowerCase().replace(/(.)\1{2,}/g, "$1$1").replace(/[!.]+$/, "");
    if (key.length < 2) continue;
    tally.set(key, (tally.get(key) || { n: 0, s }));
    tally.get(key).n++;
  }
  const best = [...tally.values()].sort((a, b) => b.n - a.n)[0];
  if (!best || best.n < 2) return null;
  const w = best.s.toLowerCase();
  if (EMOTE_WORDS[w]) return { text: EMOTE_WORDS[w], n: best.n, emote: best.s, words: false };
  if (/^(k{3,}|(ha){2,}h?|(ja){2,}j?|(he){3,}|lo+l+|lmf?a+o+|x+d+|w{2,}|l{2,}|\?+|!+)$/i.test(w)) return { text: best.s, n: best.n, words: false };
  const emoteName = /^\S+$/.test(best.s) && /[a-z][A-Z]/.test(best.s);
  return { text: best.s, n: best.n, words: /\p{L}{3,}/u.test(best.s) && !emoteName };
}

function median(xs) {
  const s = xs.filter((x) => isFinite(x)).sort((a, b) => a - b);
  if (!s.length) return 0;
  const k = Math.floor(s.length / 2);
  return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2;
}

// Sample the replay every `step` seconds: each page is ~60 messages, so the time one page
// spans is the inverse of chat speed at that point. A 7-hour VOD at 20 s is ~1,260 small
// requests, ~20 s in a browser at 12 in flight (measured 2026-11-16: 60 pages in 1.0 s).
export async function chatCurve(vod, { step = 20, from = 0, to = vod.length, concurrency = 12, onProgress } = {}) {
  const offsets = [];
  for (let t = from; t < to; t += step) offsets.push(t);
  const pages = await pool(offsets, vod.platform === "kick" ? Math.min(6, concurrency) : concurrency, (o) => commentPage(vod, o), onProgress);
  const samples = [];
  const seen = new Map();
  pages.forEach((p, i) => {
    if (!p || p.length < (vod.platform === "kick" ? 1 : 2)) { samples.push({ t: offsets[i], rate: 0, msgs: [] }); return; }
    for (const m of p) seen.set(m.id, m);
    const span = Math.max(1, p[p.length - 1].t - p[0].t);
    const rate = vod.platform === "kick" ? kickRate(p) : (p.length - 1) / span;
    samples.push({ t: (p[0].t + p[p.length - 1].t) / 2, rate, msgs: p });
  });
  samples.sort((a, b) => a.t - b.t);
  return { samples, messages: [...seen.values()].sort((a, b) => a.t - b.t) };
}

// Peaks of chat speed against the local baseline (median over +-10 min).
export function findPeaks(samples, { k = 12, minRatio = 1.8, gap = 90 } = {}) {
  const scored = samples.map((s) => {
    const near = samples.filter((o) => Math.abs(o.t - s.t) <= 600 && Math.abs(o.t - s.t) > 60).map((o) => o.rate);
    const base = Math.max(0.2, median(near));
    const c = classify(s.msgs);
    const ratio = s.rate / base;
    const score = ratio * (1 + 0.6 * Math.min(5, c.counts.clip)) * (1 + Math.min(1, (c.counts.funny + c.counts.hype + c.counts.shock) / Math.max(1, s.msgs.length)));
    return { ...s, base, ratio, score, kind: c };
  });
  const cands = scored.filter((s) => s.ratio >= minRatio && s.rate >= 0.2).sort((a, b) => b.score - a.score);
  const picked = [];
  for (const c of cands) {
    if (picked.every((p) => Math.abs(p.t - c.t) >= gap)) picked.push(c);
    if (picked.length >= k) break;
  }
  return picked;
}

// Look closely at one peak: exact per-second chat counts, the onset, and the clip window.
export async function refinePeak(vod, peak, { before = 75, after = 30 } = {}) {
  const offs = [];
  const stepR = vod.platform === "kick" ? 5 : 6; // Kick pages are 5-second windows: tile them
  for (let t = Math.max(0, peak.t - before); t <= Math.min(vod.length, peak.t + after); t += stepR) offs.push(t);
  const pages = await pool(offs, vod.platform === "kick" ? 4 : 8, (o) => commentPage(vod, o));
  const byId = new Map();
  for (const p of pages) if (p) for (const m of p) byId.set(m.id, m);
  const msgs = [...byId.values()].sort((a, b) => a.t - b.t);
  return momentFromMessages(vod, msgs, peak);
}

export function momentFromMessages(vod, msgs, peak) {
  const lo = Math.floor(peak.t - 90), hi = Math.ceil(peak.t + 40);
  const hist = new Map();
  for (const m of msgs) if (m.t >= lo && m.t <= hi) hist.set(m.t, (hist.get(m.t) || 0) + 1);
  // 5-second rolling rate, and the baseline from the quiet stretch before.
  const rate = (t) => { let n = 0; for (let k = t - 4; k <= t; k++) n += hist.get(k) || 0; return n / 5; };
  let peakT = peak.t, peakR = 0;
  for (let t = lo + 5; t <= hi; t++) { const r = rate(t); if (r > peakR) { peakR = r; peakT = t; } }
  const pre = []; for (let t = lo; t < peakT - 30; t += 5) pre.push(rate(t));
  const base = Math.max(0.2, median(pre), peak.base || 0);
  let onset = peakT;
  for (let t = peakT; t > peakT - 45; t--) { if (rate(t) <= base * 1.5) { onset = t; break; } onset = t; }
  // Chat reacts 5-10 s after the thing happens; start with the build-up, end on the reaction.
  const start = Math.max(0, onset - 24), end = Math.min(vod.length || onset + 14, onset + 14);
  const win = msgs.filter((m) => m.t >= onset - 2 && m.t <= onset + 20);
  const kind = classify(win);
  const phrase = topPhrase(win);
  const music = musicRisk(vod, start, end, kind.counts.music);
  return {
    vod_id: vod.id, channel: vod.channel, t_peak: peakT, t_start: start, t_end: end,
    chat_ratio: Math.round((peakR / base) * 10) / 10, chat_rate: Math.round(peakR * 10) / 10, baseline: Math.round(base * 100) / 100,
    event_type: kind.type, signals: kind.counts, phrase,
    clip_requests: kind.counts.clip,
    music_risk: music,
    chat: msgs.filter((m) => m.t >= start && m.t <= end + 6).slice(0, 400),
    url: vod.platform === "kick" ? `${vod.url}?t=${Math.floor(start)}` : `https://www.twitch.tv/videos/${vod.id}?t=${twitchTime(start)}`,
  };
}

export function musicRisk(vod, start, end, chatMentions = 0) {
  const hit = (vod.muted || []).find((s) => s.start < end && s.end > start);
  if (hit) return { level: "high", why: "Twitch muted this audio for licensed music; YouTube and TikTok will likely claim it too" };
  if (chatMentions >= 2) return { level: "medium", why: `chat mentions music ${chatMentions} times here; check for in-game radio` };
  return { level: "low", why: "no muted audio and chat does not mention music" };
}

// Clips Twitch viewers already made of this VOD: a moment someone already clipped is proven
// to travel, and also already taken.
export async function twitchClips(login, vodId) {
  try {
    const d = await gql(`query{ user(login:"${esc(login)}"){ clips(first:100, criteria:{period:LAST_WEEK, sort:VIEWS_DESC}){ edges{ node{
      title viewCount durationSeconds videoOffsetSeconds createdAt slug video{ id } } } } } }`);
    const edges = (d.user && d.user.clips && d.user.clips.edges) || [];
    return edges.map((e) => e.node).filter((c) => !vodId || (c.video && c.video.id === vodId)).map((c) => ({
      title: c.title, views: c.viewCount, duration: c.durationSeconds, t_start: c.videoOffsetSeconds,
      t_end: (c.videoOffsetSeconds || 0) + c.durationSeconds, url: `https://clips.twitch.tv/${c.slug}`, created_at: c.createdAt,
    }));
  } catch (e) { return []; }
}

export function hooks(m, streamer) {
  const who = streamer || "he";
  const ph = m.phrase && m.phrase.words && m.phrase.text.length <= 28 ? m.phrase.text : null;
  const by = {
    funny: [`${who} was NOT ready for this 😂`, "Chat could not breathe after this", `This is why everyone watches ${who}`],
    hype: [`${who} just pulled THIS off`, "The cleanest play you'll see today", "Chat went insane at this"],
    shock: ["Wait for it…", "Nobody saw this coming", `${who}'s reaction 💀`],
    fail: ["This went so wrong 💀", `${who} will never live this down`, "It all fell apart in 3 seconds"],
    reaction: ["Wait for it…", "Chat lost it at this moment", `${who} did not expect this`],
  }[m.event_type] || [];
  const out = [...by];
  if (ph) out.unshift(`“${ph}” – chat, instantly`);
  if (m.chat_ratio >= 3) out.push(`Chat went ${Math.round(m.chat_ratio)}× faster here`);
  return [...new Set(out)].slice(0, 5);
}

// Whole pipeline for one VOD: curve -> peaks -> refined moments, plus Twitch's own clips.
export async function findMoments(vod, { k = 10, step, onProgress, refine = true } = {}) {
  // Kick throttles (see kick.js), so it samples coarser: at most ~150 windows a stream.
  const st = step || (vod.platform === "kick" ? Math.max(30, Math.ceil(vod.length / 150)) : vod.length > 12 * 3600 ? 60 : vod.length > 6 * 3600 ? 30 : vod.length > 2 * 3600 ? 20 : 10);
  const { samples, messages } = await chatCurve(vod, { step: st, onProgress });
  const peaks = findPeaks(samples, { k: vod.platform === "kick" ? Math.min(k, 6) : k, gap: vod.platform === "kick" ? Math.max(90, st * 1.5) : 90 });
  const moments = [];
  if (refine) {
    const refined = await pool(peaks, vod.platform === "kick" ? 1 : 3, (p) => refinePeak(vod, p, vod.platform === "kick" ? { before: 50, after: 20 } : {}));
    for (const m of refined) if (m) moments.push(m);
  } else {
    for (const p of peaks) moments.push(momentFromMessages(vod, messages, p));
  }
  // Two peaks that refine onto the same stretch are one moment; keep the stronger.
  moments.sort((a, b) => b.chat_ratio - a.chat_ratio);
  for (let i = moments.length - 1; i >= 0; i--) {
    const a = moments[i];
    if (moments.some((b, j) => j < i && b.t_start < a.t_end - 10 && b.t_end > a.t_start + 10)) moments.splice(i, 1);
  }
  const clips = vod.channel && vod.platform !== "kick" ? await twitchClips(vod.channel, vod.id) : [];
  for (const m of moments) {
    const overlapping = clips.filter((c) => c.t_start < m.t_end && c.t_end > m.t_start);
    m.twitch_clips = overlapping.length;
    m.twitch_clip_views = overlapping.reduce((a, c) => a + (c.views || 0), 0);
    m.hooks = hooks(m, vod.channel_name);
    m.score = Math.round(m.chat_ratio * 10 * (1 + Math.min(5, m.clip_requests) * 0.4) * (1 + Math.log10(1 + m.twitch_clip_views) * 0.3)) / 10;
  }
  moments.sort((a, b) => b.score - a.score);
  return { vod, curve: samples.map((s) => [Math.round(s.t), Math.round(s.rate * 100) / 100]), moments, twitch_clips: clips };
}
