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

// Words people add around a name when they treat the box as search ("ishowspeed gta6 live").
const FILLER = /^(gta|gta5|gta6|gtav|gtavi|grand|theft|auto|v|vi|5|6|live|stream|streams|streaming|livestream|vod|vods|clip|clips|twitch|tv|the|latest|new|best|moments?)$/;
const RESERVED = new Set(["videos", "directory", "settings", "p", "search", "downloads", "subscriptions", "wallet", "drops", "inventory", "turbo", "jobs", "store", "friends", "following", "u"]);
const LOGIN = /^[A-Za-z0-9_]{3,25}$/;

// What did they paste? A VOD, a channel, a Twitch clip, a Kick link, or words to search for.
//   "https://www.twitch.tv/videos/123", "123456789"      -> vod
//   "twitch.tv/xqc", "xqc", "@xQc", "twitch.tv/xqc/videos" -> channel
//   "clips.twitch.tv/Slug", "twitch.tv/xqc/clip/Slug"     -> clip (resolved to its VOD and second)
//   "kai cenat", "ishowspeed gta6"                        -> search (login = the words joined)
//   "gta 6"                                               -> gta (no name in it: offer live streams)
// Measured 2026-11-19: the old last-token regex read "kai cenat" as the channel "cenat", a clip
// link as its last path word, and claude.ai/directory/heistclips as the channel "heistclips".
export function parseInput(raw) {
  const s = String(raw || "").trim();
  let k = s.match(/kick\.com\/(?:video\/|[A-Za-z0-9_-]+\/videos\/)([0-9a-f]{8}-[0-9a-f-]{27})/i);
  if (k) return { kind: "kickvod", id: k[1].toLowerCase() };
  k = s.match(/^(?:https?:\/\/)?(?:www\.)?kick\.com\/([A-Za-z0-9_-]{2,40})\/?(?:\?.*)?$/i) || s.match(/^kick:([A-Za-z0-9_-]{2,40})$/i);
  if (k) return { kind: "kick", login: k[1].toLowerCase() };
  if (/(?:youtube\.com|youtu\.be)\//i.test(s)) return { kind: "unknown", site: "youtube" };
  const c = s.match(/clips\.twitch\.tv\/([A-Za-z0-9_-]{4,})/i) || s.match(/twitch\.tv\/[A-Za-z0-9_]+\/clip\/([A-Za-z0-9_-]{4,})/i);
  if (c && c[1] !== "embed") return { kind: "clip", slug: c[1] };
  const m = s.match(/videos\/(\d{6,})/) || s.match(/^(\d{8,})$/) || s.match(/[?&]video=v?(\d{6,})/);
  if (m) return { kind: "vod", id: m[1] };
  const tw = s.match(/^(?:https?:\/\/)?(?:www\.|m\.|go\.)?twitch\.tv\/([^\s]*)$/i);
  if (tw) {
    const segs = tw[1].split(/[?#]/)[0].split("/").filter(Boolean);
    const login = ["popout", "moderator", "embed"].includes(segs[0]) ? segs[1] : segs[0];
    if (!login || RESERVED.has(login.toLowerCase()) || !LOGIN.test(login)) return { kind: "unknown", site: "twitch" };
    return { kind: "channel", login: login.toLowerCase() };
  }
  if (/^https?:\/\//i.test(s) || /^[\w-]+(\.[\w-]+)+\/\S*$/.test(s)) return { kind: "unknown", site: "other" };
  const words = s.toLowerCase().replace(/^@/, "").replace(/['’`´.]/g, "").split(/[^a-z0-9_]+/).filter(Boolean);
  if (!words.length) return { kind: "unknown" };
  const kept = words.filter((w) => !FILLER.test(w));
  if (!kept.length) return { kind: "gta" };
  if (kept.length === 1 && words.length === 1 && LOGIN.test(kept[0])) return { kind: "channel", login: kept[0] };
  const login = kept.join("").slice(0, 25);
  return { kind: "search", text: kept.join(" "), login: LOGIN.test(login) ? login : null };
}

// Twitch's own channel search, for names typed with spaces or typos ("ischowspeed").
export async function searchChannels(text, first = 5) {
  try {
    const d = await gql(`query{ searchFor(userQuery:${JSON.stringify(String(text).slice(0, 60))}, platform:"web", target:{index:CHANNEL}){ channels{ edges{ item{ ... on User { login displayName profileImageURL(width:70) followers{ totalCount } stream{ viewersCount } } } } } } }`);
    const edges = (d.searchFor && d.searchFor.channels && d.searchFor.channels.edges) || [];
    return edges.map((e) => e.item).filter((u) => u && u.login).slice(0, first).map((u) => ({ login: u.login, name: u.displayName, avatar: u.profileImageURL, followers: (u.followers && u.followers.totalCount) || 0, live: !!u.stream, viewers: (u.stream && u.stream.viewersCount) || 0 }));
  } catch (e) { return []; }
}

// A Twitch clip -> the VOD it was cut from and the second it starts at.
export async function getClip(slug) {
  const d = await gql(`query{ clip(slug:"${String(slug).replace(/[^A-Za-z0-9_-]/g, "")}"){ slug videoOffsetSeconds durationSeconds video{ id } broadcaster{ login } } }`);
  const c = d.clip;
  if (!c) return null;
  return { slug: c.slug, vod_id: c.video && c.video.id, t: c.videoOffsetSeconds, duration: c.durationSeconds, login: c.broadcaster && c.broadcaster.login };
}

// Who is live in GTA this second, biggest first. `cuttable` = Twitch is saving the stream, so
// there is video to cut from (some of the biggest streams are live with VODs switched off).
export async function hotStreams({ first = 14, lang = "" } = {}) {
  const out = [];
  for (const name of ["Grand Theft Auto VI", "Grand Theft Auto V"]) {
    try {
      const d = await gql(`query{ game(name:"${name}"){ streams(first:${first}){ edges{ node{ viewersCount title language archiveVideo{ id } broadcaster{ login displayName profileImageURL(width:70) } } } } } }`);
      for (const e of (d.game && d.game.streams && d.game.streams.edges) || []) {
        const n = e.node;
        if (!n.broadcaster) continue;
        out.push({ login: n.broadcaster.login, name: n.broadcaster.displayName, avatar: n.broadcaster.profileImageURL, viewers: n.viewersCount, title: n.title, language: String(n.language || "").toLowerCase(), game: name === "Grand Theft Auto VI" ? "GTA VI" : "GTA V", cuttable: !!n.archiveVideo });
      }
    } catch (e) { /* a game Twitch does not list yet is not an error */ }
    if (out.filter((x) => x.cuttable).length >= 6) break;
  }
  const mine = (x) => (lang && x.language === lang ? 1 : 0);
  return out.sort((a, b) => b.cuttable - a.cuttable || mine(b) - mine(a) || b.viewers - a.viewers);
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
  // A hook goes on someone's post in big letters: never chat's slurs or crude lines.
  if (/\b(fuck|shit|cunt|nigg|fag|retard|bussy|dick|pussy|cock|porn|sex|rape|kys|whore|slut|bitch)\w*/i.test(best.s)) return { text: best.s, n: best.n, words: false };
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

// Hook lines are burned into the clip, so they are written in the language the clipper posts
// in: the page's language (/de, /fr), or `lang` when a caller passes one.
const HOOKS = {
  en: { who: "he", quote: (p) => `“${p}” – chat, instantly`, ratio: (n) => `Chat went ${n}× faster here`, by: (w) => ({
    funny: [`${w} was NOT ready for this 😂`, "Chat could not breathe after this", `This is why everyone watches ${w}`],
    hype: [`${w} just pulled THIS off`, "The cleanest play you'll see today", "Chat went insane at this"],
    shock: ["Wait for it…", "Nobody saw this coming", `${w}'s reaction 💀`],
    fail: ["This went so wrong 💀", `${w} will never live this down`, "It all fell apart in 3 seconds"],
    reaction: ["Wait for it…", "Chat lost it at this moment", `${w} did not expect this`] }) },
  de: { who: "Er", quote: (p) => `„${p}“ – der Chat, sofort`, ratio: (n) => `Der Chat war hier ${n}× schneller`, by: (w) => ({
    funny: [`${w} war darauf NICHT vorbereitet 😂`, "Der Chat hat keine Luft mehr bekommen", `Genau deshalb schaut jeder ${w}`],
    hype: [`${w} hat DAS wirklich geschafft`, "Sauberer wird’s heute nicht mehr", "Der Chat ist komplett eskaliert"],
    shock: ["Warte ab…", "Damit hat keiner gerechnet", `Die Reaktion von ${w} 💀`],
    fail: ["Das ging so richtig schief 💀", `Das wird ${w} nie wieder los`, "In 3 Sekunden war alles vorbei"],
    reaction: ["Warte ab…", "In dem Moment ist der Chat ausgerastet", `Damit hat ${w} nicht gerechnet`] }) },
  fr: { who: "Il", quote: (p) => `« ${p} » – le chat, direct`, ratio: (n) => `Le chat allait ${n}× plus vite ici`, by: (w) => ({
    funny: [`${w} n’était PAS prêt pour ça 😂`, "Le chat n’arrivait plus à respirer", `Voilà pourquoi tout le monde regarde ${w}`],
    hype: [`${w} vient de réussir ÇA`, "Le move le plus propre de la journée", "Le chat a complètement pété un câble"],
    shock: ["Attends la fin…", "Personne ne l’a vu venir", `La réaction de ${w} 💀`],
    fail: ["Ça a tellement mal tourné 💀", `${w} ne s’en remettra jamais`, "Tout s’est effondré en 3 secondes"],
    reaction: ["Attends la fin…", "Le chat a explosé à ce moment-là", `${w} ne s’y attendait pas`] }) },
  pt: { who: "Ele", quote: (p) => `“${p}” – o chat, na hora`, ratio: (n) => `O chat ficou ${n}× mais rápido aqui`, by: (w) => ({
    funny: [`${w} NÃO estava pronto pra isso 😂`, "O chat ficou sem ar depois dessa", `É por isso que todo mundo assiste ${w}`],
    hype: [`${w} acabou de fazer ISSO`, "A jogada mais limpa que você vai ver hoje", "O chat foi à loucura com essa"],
    shock: ["Espera só…", "Ninguém viu essa chegando", `A reação de ${w} 💀`],
    fail: ["Isso deu muito errado 💀", `${w} nunca vai superar essa`, "Desabou tudo em 3 segundos"],
    reaction: ["Espera só…", "O chat surtou nesse momento", `${w} não esperava por essa`] }) },
  es: { who: "Él", quote: (p) => `«${p}» – el chat, al instante`, ratio: (n) => `El chat iba ${n}× más rápido aquí`, by: (w) => ({
    funny: [`${w} NO estaba listo para esto 😂`, "El chat se quedó sin aire con esto", `Por esto todo el mundo ve a ${w}`],
    hype: [`${w} acaba de lograr ESTO`, "La jugada más limpia que verás hoy", "El chat se volvió loco con esto"],
    shock: ["Espera…", "Nadie lo vio venir", `La reacción de ${w} 💀`],
    fail: ["Esto salió fatal 💀", `${w} nunca va a superar esto`, "Todo se vino abajo en 3 segundos"],
    reaction: ["Espera…", "El chat explotó en este momento", `${w} no se lo esperaba`] }) },
};

export function hooks(m, streamer, lang) {
  const l = lang || (typeof document !== "undefined" && document.documentElement ? (document.documentElement.lang || "en").slice(0, 2) : "en");
  const H = HOOKS[l] || HOOKS.en;
  const who = streamer || H.who;
  const ph = m.phrase && m.phrase.words && m.phrase.text.length <= 28 ? m.phrase.text : null;
  const out = [...(H.by(who)[m.event_type] || [])];
  if (ph) out.unshift(H.quote(ph));
  if (m.chat_ratio >= 3) out.push(H.ratio(Math.round(m.chat_ratio)));
  return [...new Set(out)].slice(0, 5);
}

// Whole pipeline for one VOD: curve -> peaks -> refined moments, plus Twitch's own clips.
// `from`/`to` read only part of the stream (the last hours of a marathon come back in seconds).
// When fewer than `fill` spikes clear the normal bar, the best of the smaller ones are added
// and marked `quiet`, so a calm stream still returns its best moments instead of nothing.
export async function findMoments(vod, { k = 10, step, onProgress, refine = true, from = 0, to, fill = 3 } = {}) {
  const end = to == null ? vod.length : Math.min(to, vod.length);
  const start = Math.max(0, Math.min(from, end));
  const span = end - start;
  // Kick throttles (see kick.js), so it samples coarser: at most ~150 windows a stream.
  const st = step || (vod.platform === "kick" ? Math.max(30, Math.ceil(span / 150)) : span > 12 * 3600 ? 60 : span > 6 * 3600 ? 30 : span > 2 * 3600 ? 20 : 10);
  const { samples, messages } = await chatCurve(vod, { step: st, from: start, to: end, onProgress });
  const kk = vod.platform === "kick" ? Math.min(k, 6) : k;
  const gap = vod.platform === "kick" ? Math.max(90, st * 1.5) : 90;
  let peaks = findPeaks(samples, { k: kk, gap });
  if (peaks.length < fill) {
    const soft = findPeaks(samples, { k: kk, gap, minRatio: 1.25 }).filter((p) => peaks.every((q) => Math.abs(q.t - p.t) >= gap)).slice(0, fill - peaks.length);
    peaks = peaks.concat(soft.map((p) => ({ ...p, soft: true })));
  }
  const moments = [];
  if (refine) {
    const refined = await pool(peaks, vod.platform === "kick" ? 1 : 3, (p) => refinePeak(vod, p, vod.platform === "kick" ? { before: 50, after: 20 } : {}));
    refined.forEach((m, i) => { if (m) { if (peaks[i].soft) m.quiet = true; moments.push(m); } });
  } else {
    for (const p of peaks) { const m = momentFromMessages(vod, messages, p); if (p.soft) m.quiet = true; moments.push(m); }
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
  moments.sort((a, b) => (a.quiet ? 1 : 0) - (b.quiet ? 1 : 0) || b.score - a.score);
  return { vod, curve: samples.map((s) => [Math.round(s.t), Math.round(s.rate * 100) / 100]), moments, twitch_clips: clips, messages: messages.length };
}
