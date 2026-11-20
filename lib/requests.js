// The public feature-request board. Hard rule: seeded items are labelled "Suggested by
// heistclips", every vote count starts at 0, and only real votes move it. A board with faked
// votes is a fabricated record, and the first clipper who notices kills the community it is for.
import crypto from "node:crypto";
import { getJSON, putJSON, listPaths } from "./store.js";
import { translateItem, localize, TR_DAILY_CAP } from "./translate.js";
import { getChannel, searchChannels } from "../public/js/twitch.js";

const BOARD = "requests/board.json";
export const STATUSES = ["requested", "building", "shipped"];
// An item is a feature request or a bug report. Items filed before 2026-11-19 carry no kind
// and are features.
export const KINDS = ["feature", "bug"];
export const kindOf = (x) => (x && x.kind === "bug" ? "bug" : "feature");

// Each seed comes from what clippers said on Reddit (2026-11-16 pull) or a DATA_MODEL gap.
export const SEED = [
  ["Clip streams while they're live", "Find and cut moments from a stream that is still going, not only after the VOD is done.", "shipped"],
  ["Facecam-over-gameplay vertical layout", "The stacked layout gaming clips actually use, as the default instead of a centre crop.", "shipped"],
  ["No watermark, no per-minute billing", "Pay per exported clip; never a watermark on the file.", "shipped"],
  ["Kick support", "Find and cut moments from Kick streams, live or saved.", "shipped"],
  ["Spoiler filter", "Skip moments that show story spoilers, for campaigns that ban them.", "requested"],
  ["Strip \"AI-generated\" metadata on export", "Exports should never be flagged as AI-made when the footage isn't.", "shipped"],
].map(([title, detail, status], i) => ({ id: "s" + String(i + 1).padStart(2, "0"), title, detail, status, by: "heistclips", votes: 0, voters: [], created_at: "2026-11-16T00:00:00Z" }));

const salt = () => process.env.CREDIT_SALT || process.env.BLOB_READ_WRITE_TOKEN || "dev";
export const hashOf = (s) => crypto.createHmac("sha256", salt()).update(String(s)).digest("hex").slice(0, 24);

export async function loadBoard() {
  let b = await getJSON(BOARD, { fresh: true }).catch(() => null);
  if (!b) { b = { items: SEED, limits: {} }; await putJSON(BOARD, b, { maxAge: 60 }); }
  return b;
}

// A board write that the next writer can wait for. The public Blob URL can serve the previous
// board for seconds after a write, so a second write made from that stale copy silently undoes
// the first (two close-outs run back to back lost one). Every saveBoard stamps written_at and
// drops a marker file; the Blob LIST API is current at once, so loadBoardSettled() can tell the
// newest write and re-read until the copy it holds is that one.
const REV = "requests/rev/";
export async function saveBoard(b) {
  const now = Date.now();
  b.written_at = new Date(now).toISOString();
  await putJSON(BOARD, b, { maxAge: 60 });
  await putJSON(`${REV}${now}.json`, { at: b.written_at }, { maxAge: 60 }).catch(() => null);
  return b;
}
export async function loadBoardSettled(maxWaitMs = 45000) {
  let newest = 0;
  try { newest = Math.max(0, ...(await listPaths(REV)).map((p) => Number((p.match(/(\d+)\.json$/) || [])[1]) || 0)); } catch (e) {}
  const t0 = Date.now();
  for (;;) {
    const b = await loadBoard();
    if (!newest || Date.parse(b.written_at || 0) >= newest) return b;
    if (Date.now() - t0 > maxWaitMs) throw new Error("the board's last write is not readable yet; try again in a minute");
    await new Promise((r) => setTimeout(r, 1500));
  }
}

// `lang` is the viewer's language: title, detail and response come back in it when a stored
// translation exists, with the original alongside (lib/translate.js).
export function publicList(b, voter, lang = "en") {
  const v = voter ? hashOf(voter) : null;
  return b.items
    .filter((x) => !x.hidden)
    .map((x) => { const L = localize(x, lang); return { id: x.id, kind: kindOf(x), title: L.title, detail: L.detail, status: x.status, by: x.by === "heistclips" ? "Suggested by heistclips" : "Requested by a clipper", votes: x.votes, voted: v ? x.voters.includes(v) : false, created_at: x.created_at, response: L.response, shipped_at: x.shipped_at || null, lang: L.lang, original: L.original }; })
    .sort((a, b) => b.votes - a.votes || (a.status === "shipped") - (b.status === "shipped") || a.id.localeCompare(b.id));
}

function bump(b, key, max) {
  const day = new Date().toISOString().slice(0, 10);
  if (!b.limits || b.limits.day !== day) b.limits = { day };
  b.limits[key] = (b.limits[key] || 0) + 1;
  return b.limits[key] <= max;
}

// For the public write paths: wait briefly for the newest board, but never fail a vote over it.
const loadForWrite = () => loadBoardSettled(8000).catch(() => loadBoard());

export async function vote(id, voter, ip) {
  const b = await loadForWrite();
  const item = b.items.find((x) => x.id === id && !x.hidden);
  if (!item) return { ok: false, error: "no such request" };
  const v = hashOf(voter);
  if (item.voters.includes(v)) return { ok: true, already: true, votes: item.votes };
  if (!bump(b, "v:" + hashOf(ip), 40)) return { ok: false, error: "too many votes from this connection today" };
  item.voters.push(v); item.votes = item.voters.length;
  await saveBoard(b);
  return { ok: true, votes: item.votes };
}

const LINK = /(https?:\/\/|www\.|\.(com|net|ru|xyz|io|gg|ly)\b)/i;
const BAD = /\b(fuck|shit|cunt|nigg|fag|porn|sex|casino|viagra|crypto ?airdrop)\w*/i;

// People paste a stream into the request box thinking it is search (board item rmwmod40d was
// "2932305259", the most-clipped VOD). Anything that IS a stream goes to /clip, not the board.
// Sync part: VOD ids (Twitch digits, Kick UUIDs) and Twitch/Kick links. Returns the /clip query.
export function streamLike(raw) {
  const s = String(raw || "").trim().replace(/^#/, "");
  let m;
  if ((m = s.match(/^(?:v)?(\d{8,12})$/i))) return { kind: "Twitch VOD", q: m[1] };
  if ((m = s.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i))) return { kind: "Kick VOD", q: "https://kick.com/video/" + m[1].toLowerCase() };
  if ((m = s.match(/(?:https?:\/\/)?(?:www\.|m\.)?twitch\.tv\/videos\/(\d{6,})/i))) return { kind: "Twitch VOD", q: m[1] };
  if ((m = s.match(/(?:https?:\/\/)?(?:www\.|m\.)?twitch\.tv\/([A-Za-z0-9_]{3,25})\b/i)) && !/^(videos|directory|settings|p)$/i.test(m[1])) return { kind: "Twitch channel", q: m[1].toLowerCase() };
  if ((m = s.match(/(?:https?:\/\/)?(?:www\.)?kick\.com\/(?:video\/|[A-Za-z0-9_-]+\/videos\/)([0-9a-f]{8}-[0-9a-f-]{27})/i))) return { kind: "Kick VOD", q: "https://kick.com/video/" + m[1].toLowerCase() };
  if ((m = s.match(/(?:https?:\/\/)?(?:www\.)?kick\.com\/([A-Za-z0-9_-]{2,40})\b/i))) return { kind: "Kick channel", q: "kick.com/" + m[1].toLowerCase() };
  return null;
}

// Async part, two shapes:
// 1. A single bare word that is a Twitch channel with saved streams or live now ("xqc",
//    "kaicenat"). A real one-word request ("captions") is rarely a channel with VODs.
// 2. A short sentence asking for a streamer's clips, often misspelled: board item rmwp8atut
//    (2026-11-20) was "clip ishwspped gta 6". The words left after the game and clip words go
//    through Twitch's own channel search, the lookup /clip already does (lib/momentsource.js);
//    it counts only if a big channel's login IS that name or a typo of it.
// A false hit costs one click: the form and request_a_feature both offer "file it anyway".
const NOT_A_NAME = /^(youtube|yt|tiktok|tt|instagram|insta|ig|reels?|shorts?|kick|facebook|fb|twitter|x|captions?|subtitles?|subs|text|facecam|cam|webcam|export|download|upload|audio|sound|music|mp4|mov|1080p?|720p|4k|60fps|fps|hd|quality|watermark|mobile|phone|android|iphone|ios|app|editor|edit|editing|template|font|zoom|crop|vertical|layout|split|screen|ai|free|price|pricing|credits?|language|translate|translation|feature|button|option|overlay|filter|spoilers?|transitions?|effects?|emojis?|memes?|batch|bulk|queue|schedule|tool|account|login)$/;
const ASK_WORDS = /^(clip|clips|cut|find|get|make|moments?|highlights?|best|of|from|for|me|please|pls|plz|the|a|an|stream|streams|vod|vods|gta|gta5|gta6|gtav|gtavi|grand|theft|auto|v|vi|5|6|live|latest|new|twitch|tv)$/;
export function askedName(raw) {
  const words = String(raw || "").toLowerCase().replace(/^@/, "").replace(/['’`´.]/g, "").split(/[^a-z0-9_]+/).filter(Boolean);
  if (words.length < 2 || words.length > 7) return null;
  const kept = words.filter((w) => !ASK_WORDS.test(w));
  // One or two words of name, and something that shows it is an ask (a clip verb or the game).
  if (!kept.length || kept.length > 2 || kept.length === words.length || kept.some((w) => NOT_A_NAME.test(w))) return null;
  const key = kept.join("");
  return key.length >= 3 && key.length <= 25 ? { text: kept.join(" "), key } : null;
}

// Edits (insert, delete, change, swap two neighbours) between two short strings.
function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[a.length][b.length];
}
// "ishwspped" -> ishowspeed is 2 edits; a 5-7 letter name gets 1, anything shorter must be exact.
export const nearName = (key, login) => {
  const l = String(login || "").toLowerCase();
  return editDistance(key, l) <= (key.length >= 8 ? 2 : key.length >= 5 ? 1 : 0);
};

export async function streamCheck(title, detail, deps = {}) {
  const tw = { getChannel, searchChannels, ...deps };
  const hit = streamLike(title);
  if (hit) return hit;
  if (detail) return null;
  const s = String(title || "").trim().replace(/^@/, "");
  const wait = (p) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), 4000))]);
  const usable = (c) => c && (c.is_live || c.vods.length);
  try {
    if (/^[A-Za-z0-9_]{3,25}$/.test(s) && !/^\d+$/.test(s)) {
      const c = await wait(tw.getChannel(s));
      return usable(c) ? { kind: "Twitch channel", q: c.login } : null;
    }
    const n = askedName(s);
    if (!n) return null;
    const hits = (await wait(tw.searchChannels(n.text))) || [];
    const h = hits.find((x) => (x.followers >= 10000 || x.live) && nearName(n.key, x.login));
    const c = h ? await wait(tw.getChannel(h.login)) : null;
    if (usable(c)) return { kind: "Twitch channel", q: c.login, name: c.name || c.login };
  } catch (e) {}
  return null;
}

export const clipUrl = (q, src) => "https://heistclips.com/clip?q=" + encodeURIComponent(q) + (src ? "&src=" + src : "");

// The structured half of a bug report. What is public (the board file is public-read) stays
// here: the stream, the moment, the step and the error text. The clip link, the account code
// and the contact are never stored; they go to the builder by email only.
const one = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);
const secs = (v) => { const n = Number(v); return isFinite(n) && n >= 0 && n < 4e5 ? Math.round(n) : null; };
export function bugFields(a = {}) {
  const src = one(a.source, 200), st = src ? streamLike(src) : null;
  const pub = {
    // A stream is kept as its /clip query; other text only if it is not a link to somewhere else.
    source: st ? st.q : LINK.test(src) ? "" : src.slice(0, 80),
    platform: st ? (/^Kick/.test(st.kind) ? "kick" : "twitch") : "",
    start: secs(a.moment_start != null ? a.moment_start : a.start), end: secs(a.moment_end != null ? a.moment_end : a.end),
    step: one(a.tool || a.step, 40).replace(/[^A-Za-z0-9_ .\/-]/g, ""), error: one(a.error_text || a.error, 300), client: one(a.client, 40).replace(/[^A-Za-z0-9_ .\/-]/g, ""),
    expected: one(a.expected, 300),
  };
  for (const k of Object.keys(pub)) if (pub[k] === "" || pub[k] === null) delete pub[k];
  const priv = { source_as_given: src, clip_id: one(a.clip_id, 80), account: one(a.account, 60) };
  return { pub, priv };
}

export async function submit({ title, detail, contact, not_a_stream, kind, ...rest }, voter, ip) {
  const bug = kind === "bug";
  title = String(title || "").replace(/\s+/g, " ").trim().slice(0, 90);
  // A bug's public text is what happened; what they expected is kept beside it.
  detail = String((bug ? rest.what_happened || detail : detail) || "").replace(/\s+/g, " ").trim().slice(0, 400);
  contact = String(contact || "").trim().slice(0, 120);
  const bf = bug ? bugFields(rest) : null;
  // A bug report names a stream on purpose (its source field, often its title too): the
  // "that is a stream, not a request" guard is for the feature box only.
  if (!not_a_stream && !bug) {
    const st = await streamCheck(title, detail);
    if (st) return { ok: false, stream: true, kind: st.kind, q: st.q, name: st.name, clip: clipUrl(st.q), error: `That looks like a ${st.kind}${st.name ? ` (${st.name})` : ""}, not a feature request, so it wasn't filed. Find its moments in the clip tool.` };
  }
  if (title.length < 6) return { ok: false, error: bug ? "Say what went wrong in a few words." : "Say what you want in a few words." };
  if (bug && detail.length < 10 && !(bf.pub.error || bf.pub.source)) return { ok: false, error: "Say what happened: what you did, and what heistclips did instead." };
  if (LINK.test(title) || LINK.test(detail) || (bug && LINK.test(bf.pub.expected || ""))) return { ok: false, error: bug ? "No links in the text, please. Put the stream in the stream field." : "No links, please. Describe it in words." };
  if (BAD.test(title) || BAD.test(detail) || (bug && BAD.test((bf.pub.expected || "") + " " + (bf.pub.error || "")))) return { ok: false, error: "Keep it clean, please." };
  const b = await loadForWrite();
  if (!bump(b, "s:" + hashOf(ip), 3)) return { ok: false, error: bug ? "That's three reports from this connection today. Email aidan@brickandmortar.dev for anything urgent." : "That's three requests from this connection today. Upvote the others instead." };
  const dup = b.items.find((x) => x.title.toLowerCase() === title.toLowerCase());
  if (dup) return { ok: true, id: dup.id, duplicate: true };
  // Two posts in the same millisecond must not share an id (the row's anchor and vote key).
  let id = "r" + Date.now().toString(36);
  while (b.items.some((x) => x.id === id)) id = "r" + (parseInt(id.slice(1), 36) + 1).toString(36);
  const v = hashOf(voter);
  const item = { id, title, detail, status: "requested", by: "clipper", votes: 1, voters: [v], created_at: new Date().toISOString() };
  if (bug) { item.kind = "bug"; item.bug = bf.pub; }
  // Translated once, here, and stored. Over the daily cap (or with no key) it is filed
  // untranslated and scripts/translate_board.mjs fills it in later.
  if (bump(b, "tx", TR_DAILY_CAP)) await translateItem(item).catch(() => 0);
  b.items.push(item);
  await saveBoard(b);
  return { ok: true, id, item, contact, bug_private: bf ? bf.priv : undefined };
}

// Set the kind of several items in ONE board write (a report filed as a feature before bugs
// had their own route). Returns the ids that changed.
export async function setKinds(map) {
  const b = await loadBoardSettled();
  const changed = [];
  for (const x of b.items) if (map[x.id] && KINDS.includes(map[x.id]) && kindOf(x) !== map[x.id]) { if (map[x.id] === "bug") x.kind = "bug"; else delete x.kind; changed.push(x.id); }
  if (changed.length) await saveBoard(b);
  return changed;
}

// Remove several items in ONE board write (test items filed against production).
export async function removeItems(ids) {
  const b = await loadBoardSettled();
  const before = b.items.length;
  b.items = b.items.filter((x) => !ids.includes(x.id));
  if (b.items.length !== before) await saveBoard(b);
  return before - b.items.length;
}

// One email to Aidan per new request, through the Mailgun account bricks already uses.
// The body of a bug email: English first, then every structured field on its own line, so a
// session can reproduce it without a conversation.
export function bugMailText(item, contact, via, priv = {}) {
  const en = item.lang && item.lang !== "en" && item.tr && item.tr.en && item.tr.en.title ? item.tr.en : null;
  const g = item.bug || {};
  const line = (k, v) => `${k}: ${v === undefined || v === null || v === "" ? "(not given)" : v}`;
  const moment = g.start != null || g.end != null ? `${g.start != null ? g.start : "?"}s to ${g.end != null ? g.end : "?"}s` : "";
  return [
    line("Title", en ? en.title : item.title),
    line("What happened", en ? en.detail || item.detail : item.detail),
    line("Expected", g.expected),
    line("Stream", g.source ? g.source + (priv.source_as_given && priv.source_as_given !== g.source ? `  (as given: ${priv.source_as_given})` : "") : priv.source_as_given),
    line("Platform", g.platform),
    line("Moment", moment),
    line("Tool or step", g.step),
    line("Error text", g.error),
    line("Clip id", priv.clip_id),
    line("Account code", priv.account),
    line("Client", g.client),
    line("Contact", contact),
    line("Via", via),
    line("Board", `https://heistclips.com/requests#${item.id}`),
    ...(g.source ? [line("Open it", clipUrl(g.source) + (g.start != null ? "&t=" + g.start : ""))] : []),
    ...(en ? ["", `(translated from ${item.lang}; the reporter's own words:)`, item.title, item.detail || "(no detail)"] : []),
  ].join("\n") + "\n";
}

export async function notify(item, contact, via, priv) {
  const { MAILGUN_API_KEY, MAILGUN_DOMAIN, MAILGUN_FROM } = process.env;
  if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) return { sent: false, why: "mail not configured" };
  // English first for the builder, the clipper's own words underneath.
  const en = item.lang && item.lang !== "en" && item.tr && item.tr.en && item.tr.en.title ? item.tr.en : null;
  const form = new URLSearchParams({
    from: `heistclips <${MAILGUN_FROM || "hello@" + MAILGUN_DOMAIN}>`,
    to: "aidan@brickandmortar.dev",
    subject: `heistclips ${kindOf(item) === "bug" ? "BUG" : "feature request"}: ${en ? en.title : item.title}`,
    text: kindOf(item) === "bug" ? bugMailText(item, contact, via, priv) : `${en ? `${en.title}\n\n${en.detail || "(no detail)"}\n\n(translated from ${item.lang}; original below)\n\n` : ""}${item.title}\n\n${item.detail || "(no detail)"}\n\nContact: ${contact || "(none given)"}\nVia: ${via}\nBoard: https://heistclips.com/requests#${item.id}\n`,
  });
  if (contact && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact)) form.set("h:Reply-To", contact);
  const r = await fetch(`https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`, { method: "POST", headers: { authorization: "Basic " + Buffer.from("api:" + MAILGUN_API_KEY).toString("base64") }, body: form });
  return { sent: r.ok, status: r.status };
}
