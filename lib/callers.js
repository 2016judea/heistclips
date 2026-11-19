// Who is calling the connector, and the two limits that stop one outside caller using up what
// everyone shares: new free accounts (each spends free clips on OUR ffmpeg time) and
// find_clip_moments reads (each reads Twitch from our servers, and a Twitch rate limit on us
// breaks finding moments for everyone).
//
// A caller is its address plus the first word of its user agent ("Clipbot", "node", "python").
// The exception is a hosted assistant: every claude.ai user's connector call arrives from
// Anthropic's shared servers with user agent "Claude-User", so a limit per address would hit all
// of them at once. Those callers share one pool of their own instead, which no outside caller
// can draw from. Why (2026-11-19): an outside bot ("Clipbot") made 1,404 calls in under three
// hours and took 58 free cuts across at least 6 new accounts; the only limit was 400 new accounts
// a day shared by every caller, so one bot could have taken all 400 and every Claude user would
// have got account_cap.
//
// Counts are append-only file lists in Blob (lib/store.js listPaths), the same as every counter
// here: the list is current the moment a write returns, a re-read file is not.
import crypto from "node:crypto";
import { putJSON, listPaths } from "./store.js";

export const NEW_ACCOUNTS_PER_CALLER = 3;    // a day, per address + user-agent family
export const NEW_ACCOUNTS_PER_POOL = 400;    // a day, each hosted assistant's pool, and all other callers together
export const FINDS_PER_HOUR = 120;           // find_clip_moments, per outside caller

// Hosted assistants that call from their maker's shared servers. Matched on the first word of
// the user agent only: Claude Desktop or Claude Code reach /mcp from the person's own machine
// and address, where a per-address limit is the right one.
const SHARED = { "claude-user": "claude", "openai-mcp": "chatgpt" };

export const uaFamily = (ua) => String(ua || "").split(/[\/ ;(]/)[0].slice(0, 30);

// An IPv6 caller can rotate through a whole /64 for free, so that is the unit.
export function ipBlock(ip) {
  const s = String(ip || "").trim().toLowerCase();
  if (!s.includes(":")) return s || "unknown";
  const [head, tail = ""] = s.split("::");
  const h = head ? head.split(":") : [], t = tail ? tail.split(":") : [];
  const full = s.includes("::") ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill("0"), ...t] : h;
  return full.slice(0, 4).map((x) => x.replace(/^0+(?=.)/, "")).join(":") + "::/64";
}

const salt = () => process.env.CREDIT_SALT || process.env.BLOB_READ_WRITE_TOKEN || "dev";
const mac = (s) => crypto.createHmac("sha256", salt()).update(s).digest("base64url");

// { pool: "claude" | "chatgpt" } for a hosted assistant, else { pool: "caller", key }.
// `shared: false` is for a request that did not come through /mcp: only the connector can be
// a hosted assistant, so a direct POST that says "Claude-User" is just another caller.
export function callerOf(ip, ua, { shared = true } = {}) {
  const pool = shared ? SHARED[uaFamily(ua).toLowerCase()] : null;
  if (pool) return { pool };
  return { pool: "caller", key: crypto.createHmac("sha256", salt()).update("caller|" + ipBlock(ip) + "|" + uaFamily(ua).toLowerCase()).digest("hex").slice(0, 24) };
}
export const isOutside = (c) => !!c && c.pool === "caller";

// The connector hands its caller to the cut function (a separate HTTP function) signed, so a
// direct POST to /api/v1/cut cannot claim to be Claude's pool.
export function sealCaller(c, ttlMs = 10 * 60 * 1000) {
  const body = Buffer.from(JSON.stringify({ pool: c.pool, key: c.key, exp: Date.now() + ttlMs })).toString("base64url");
  return body + "." + mac("caller|" + body);
}
export function openCaller(s) {
  const [body, sig] = String(s || "").split(".");
  if (!body || !sig) return null;
  const want = mac("caller|" + body);
  if (sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
  try {
    const o = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!(o.exp > Date.now()) || !["claude", "chatgpt", "caller"].includes(o.pool)) return null;
    return o.pool === "caller" ? (/^[0-9a-f]{24}$/.test(o.key || "") ? { pool: "caller", key: o.key } : null) : { pool: o.pool };
  } catch (e) { return null; }
}

// ---- new accounts ----------------------------------------------------------------------------
const day = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);
const nextMidnight = (now = Date.now()) => new Date(Date.parse(day(now)) + 86400000);
const rand = () => crypto.randomBytes(8).toString("hex") + ".json";
// Where createAccount drops its one-line marker. Accounts made with no caller (the browser's
// /post, via api/v1/post op:new) keep the old flat path.
export function accountMarker(caller, now = Date.now()) {
  if (!caller) return `acct-new/${day(now)}/${rand()}`;
  return caller.pool === "caller" ? `acct-new/${day(now)}/caller/${caller.key}/${rand()}` : `acct-new/${day(now)}/${caller.pool}/${rand()}`;
}
const count = async (prefix, list) => { try { return (await (list || listPaths)(prefix)).length; } catch (e) { return 0; } };

const SITE = "https://heistclips.com";
// null = a new account may be made for this caller; else why not, as { err, error, ...links }.
export async function newAccountRefusal(caller, { now = Date.now(), list } = {}) {
  const d = day(now);
  const full = { err: "account_cap", error: "Too many new connector accounts today. Open the link once in a browser and pass its account code.", open: `${SITE}/post?src=mcp` };
  if (!caller) return (await count(`acct-new/${d}/`, list)) >= NEW_ACCOUNTS_PER_POOL ? full : null; // the old rule, unchanged
  if (caller.pool !== "caller") return (await count(`acct-new/${d}/${caller.pool}/`, list)) >= NEW_ACCOUNTS_PER_POOL ? full : null;
  const [mine, all] = await Promise.all([count(`acct-new/${d}/caller/${caller.key}/`, list), count(`acct-new/${d}/caller/`, list)]);
  if (mine >= NEW_ACCOUNTS_PER_CALLER) {
    const at = nextMidnight(now);
    return {
      err: "caller_account_cap",
      error: `This caller has started ${NEW_ACCOUNTS_PER_CALLER} new accounts today, the most one caller gets. Pass the account code (hc_…) from an earlier cut_clip as account to keep using its clips, or buy a pack at ${SITE}/pricing?src=mcp and open that account's manage link once in the same browser. New accounts open again at ${at.toISOString().slice(11, 16)} UTC.`,
      need: "account_or_buy", buy: `${SITE}/pricing?src=mcp`, resets_at: at.toISOString(),
    };
  }
  return all >= NEW_ACCOUNTS_PER_POOL ? full : null;
}

// ---- find_clip_moments -----------------------------------------------------------------------
const hour = (now) => new Date(now).toISOString().slice(0, 13);
// { refused } when this caller is over its hour; else { counted }, the write that counts this
// call, to be awaited beside the find itself so it adds no wait. Hosted assistants and in-process
// calls (no caller) are not limited.
export async function findGate(caller, { now = Date.now(), list, put } = {}) {
  if (!caller || caller.pool !== "caller") return { counted: Promise.resolve() };
  const prefix = `rl/find/${hour(now)}/${caller.key}/`;
  const used = await count(prefix, list);
  if (used >= FINDS_PER_HOUR) {
    const at = new Date(Date.parse(hour(now) + ":00:00Z") + 3600000);
    const mins = Math.max(1, Math.ceil((at - now) / 60000));
    return { refused: {
      err: "rate_limited",
      error: `Too many find_clip_moments calls: ${FINDS_PER_HOUR} an hour per caller. Try again at ${at.toISOString().slice(11, 16)} UTC (in ${mins} minute${mins === 1 ? "" : "s"}). Every other tool still works meanwhile.`,
      resets_at: at.toISOString(), retry_after_s: Math.ceil((at - now) / 1000),
    } };
  }
  return { counted: (put || putJSON)(prefix + rand(), {}, { maxAge: 60 }).catch(() => null) };
}

// The line every outside caller sees on a tool result. Product copy; it contacts no one.
export const BUILDERS_LINE = "Building on heistclips at volume? Ask for an API key: call request_a_feature with what you are building and a contact.";
