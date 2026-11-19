// The public feature-request board. Hard rule: seeded items are labelled "Suggested by
// heistclips", every vote count starts at 0, and only real votes move it. A board with faked
// votes is a fabricated record, and the first clipper who notices kills the community it is for.
import crypto from "node:crypto";
import { getJSON, putJSON, listPaths } from "./store.js";
import { translateItem, localize, TR_DAILY_CAP } from "./translate.js";
import { getChannel } from "../public/js/twitch.js";

const BOARD = "requests/board.json";
export const STATUSES = ["requested", "building", "shipped"];

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
    .map((x) => { const L = localize(x, lang); return { id: x.id, title: L.title, detail: L.detail, status: x.status, by: x.by === "heistclips" ? "Suggested by heistclips" : "Requested by a clipper", votes: x.votes, voted: v ? x.voters.includes(v) : false, created_at: x.created_at, response: L.response, shipped_at: x.shipped_at || null, lang: L.lang, original: L.original }; })
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

// Async part: a single bare word that is a Twitch channel with saved streams or live now
// ("xqc", "kaicenat"). A real one-word request ("captions") is rarely a channel with VODs.
export async function streamCheck(title, detail) {
  const hit = streamLike(title);
  if (hit) return hit;
  const s = String(title || "").trim().replace(/^@/, "");
  if (detail || !/^[A-Za-z0-9_]{3,25}$/.test(s) || /^\d+$/.test(s)) return null;
  try {
    const c = await Promise.race([getChannel(s), new Promise((r) => setTimeout(() => r(null), 4000))]);
    if (c && (c.is_live || c.vods.length)) return { kind: "Twitch channel", q: c.login };
  } catch (e) {}
  return null;
}

export const clipUrl = (q, src) => "https://heistclips.com/clip?q=" + encodeURIComponent(q) + (src ? "&src=" + src : "");

export async function submit({ title, detail, contact, not_a_stream }, voter, ip) {
  title = String(title || "").replace(/\s+/g, " ").trim().slice(0, 90);
  detail = String(detail || "").replace(/\s+/g, " ").trim().slice(0, 400);
  contact = String(contact || "").trim().slice(0, 120);
  if (!not_a_stream) {
    const st = await streamCheck(title, detail);
    if (st) return { ok: false, stream: true, kind: st.kind, q: st.q, clip: clipUrl(st.q), error: `That looks like a ${st.kind}, not a feature request, so it wasn't filed. Find its moments in the clip tool.` };
  }
  if (title.length < 6) return { ok: false, error: "Say what you want in a few words." };
  if (LINK.test(title) || LINK.test(detail)) return { ok: false, error: "No links, please. Describe it in words." };
  if (BAD.test(title) || BAD.test(detail)) return { ok: false, error: "Keep it clean, please." };
  const b = await loadForWrite();
  if (!bump(b, "s:" + hashOf(ip), 3)) return { ok: false, error: "That's three requests from this connection today. Upvote the others instead." };
  const dup = b.items.find((x) => x.title.toLowerCase() === title.toLowerCase());
  if (dup) return { ok: true, id: dup.id, duplicate: true };
  const id = "r" + Date.now().toString(36);
  const v = hashOf(voter);
  const item = { id, title, detail, status: "requested", by: "clipper", votes: 1, voters: [v], created_at: new Date().toISOString() };
  // Translated once, here, and stored. Over the daily cap (or with no key) it is filed
  // untranslated and scripts/translate_board.mjs fills it in later.
  if (bump(b, "tx", TR_DAILY_CAP)) await translateItem(item).catch(() => 0);
  b.items.push(item);
  await saveBoard(b);
  return { ok: true, id, item, contact };
}

// One email to Aidan per new request, through the Mailgun account bricks already uses.
export async function notify(item, contact, via) {
  const { MAILGUN_API_KEY, MAILGUN_DOMAIN, MAILGUN_FROM } = process.env;
  if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) return { sent: false, why: "mail not configured" };
  // English first for the builder, the clipper's own words underneath.
  const en = item.lang && item.lang !== "en" && item.tr && item.tr.en && item.tr.en.title ? item.tr.en : null;
  const form = new URLSearchParams({
    from: `heistclips <${MAILGUN_FROM || "hello@" + MAILGUN_DOMAIN}>`,
    to: "aidan@brickandmortar.dev",
    subject: `heistclips feature request: ${en ? en.title : item.title}`,
    text: `${en ? `${en.title}\n\n${en.detail || "(no detail)"}\n\n(translated from ${item.lang}; original below)\n\n` : ""}${item.title}\n\n${item.detail || "(no detail)"}\n\nContact: ${contact || "(none given)"}\nVia: ${via}\nBoard: https://heistclips.com/requests#${item.id}\n`,
  });
  if (contact && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact)) form.set("h:Reply-To", contact);
  const r = await fetch(`https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`, { method: "POST", headers: { authorization: "Basic " + Buffer.from("api:" + MAILGUN_API_KEY).toString("base64") }, body: form });
  return { sent: r.ok, status: r.status };
}
