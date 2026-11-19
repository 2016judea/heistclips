// A heistclips "account" is one random code (hc_…), made the first time the connector cuts a
// clip or someone opens /post. It is the only identity the connector has: MCP calls arrive
// from the assistant's servers, with no cookie and no per-user address. The code ties together
//   - the clip credits it spends (its own free clips, or the browser's once linked), and
//   - the YouTube / TikTok accounts it may post to (OAuth tokens, encrypted).
// The record lives in Blob under secretPath (a keyed hash of the code), and tokens inside it
// are AES-256-GCM encrypted with TOKEN_ENC_KEY, so the public store never holds a usable token.
import crypto from "node:crypto";
import { getJSON, putJSON, secretPath, listPaths } from "./store.js";
import { isHouse } from "./marks.js";
import { accountMarker } from "./callers.js";

export const ACCT = /^hc_[A-Za-z0-9_-]{32}$/;
export const newCode = () => "hc_" + crypto.randomBytes(24).toString("base64url");
const recPath = (code) => secretPath("acct", code);

export async function loadAccount(code) {
  if (!ACCT.test(String(code || ""))) return null;
  return getJSON(recPath(code), { fresh: true }).catch(() => null);
}

export async function saveAccount(rec) {
  rec.updated = new Date().toISOString();
  await putJSON(recPath(rec.code), rec, { maxAge: 0 });
  return rec;
}

// `caller` (lib/callers.js) files the day's marker under that caller's pool, which is what the
// per-caller limit counts. Check newAccountRefusal(caller) first; this never refuses.
export async function createAccount(via = "mcp", caller = null) {
  const rec = { code: newCode(), created: new Date().toISOString(), via, d: null, k: null, youtube: null, tiktok: null };
  await saveAccount(rec);
  await putJSON(accountMarker(caller, Date.parse(rec.created)), { via }, { maxAge: 60 }).catch(() => null);
  return rec;
}

// Blob reads lag writes by seconds, so a record just written is kept in hand for this instance.
const recent = new Map();
export async function getAccount(code) {
  const hit = recent.get(code);
  if (hit && Date.now() - hit.at < 60000) return hit.rec;
  return loadAccount(code);
}
export async function keep(rec) { recent.set(rec.code, { at: Date.now(), rec }); return saveAccount(rec); }

// What the credits API calls "d" and "k". Linked to a browser: that browser's own device id and
// paid key, so its free clips and packs are one balance on the site and in the connector.
// Not linked: the account is its own device and gets the same free clips a new browser gets.
export const creditIds = (rec) => ({ d: rec.d || "acct:" + rec.code, k: rec.k || "" });

// ---- token encryption ------------------------------------------------------------------------
function encKey() {
  const raw = process.env.TOKEN_ENC_KEY;
  if (raw && /^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, "hex");
  if (process.env.HC_STORE === "memory") return crypto.createHash("sha256").update("dev-only-key").digest();
  throw new Error("TOKEN_ENC_KEY missing");
}
export function seal(obj) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", encKey(), iv);
  const ct = Buffer.concat([c.update(JSON.stringify(obj), "utf8"), c.final()]);
  return "v1." + iv.toString("base64url") + "." + ct.toString("base64url") + "." + c.getAuthTag().toString("base64url");
}
export function unseal(s) {
  const [v, iv, ct, tag] = String(s || "").split(".");
  if (v !== "v1") throw new Error("bad sealed value");
  const d = crypto.createDecipheriv("aes-256-gcm", encKey(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8"));
}

// ---- signed OAuth state (no server session) ---------------------------------------------------
const stateKey = () => process.env.CREDIT_SALT || process.env.BLOB_READ_WRITE_TOKEN || "dev";
export function signState(obj, ttlMs = 15 * 60 * 1000) {
  const body = Buffer.from(JSON.stringify({ ...obj, exp: Date.now() + ttlMs, n: crypto.randomBytes(6).toString("hex") })).toString("base64url");
  return body + "." + crypto.createHmac("sha256", stateKey()).update("oauth|" + body).digest("base64url");
}
export function readState(s) {
  const [body, sig] = String(s || "").split(".");
  if (!body || !sig) return null;
  const want = crypto.createHmac("sha256", stateKey()).update("oauth|" + body).digest("base64url");
  if (sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
  try { const o = JSON.parse(Buffer.from(body, "base64url").toString("utf8")); return o.exp > Date.now() ? o : null; } catch (e) { return null; }
}

// ---- credits: the same handler the browser calls, called in-process ---------------------------
// "start" before the cut (is there a clip to spend? charges nothing), "commit" after, with the
// file's size. Nothing here knows how credits are counted; api/credits.js owns that.
export async function creditCall(action, rec, extra = {}) {
  const { default: handler } = await import("../api/credits.js");
  const { d, k } = creditIds(rec);
  let out = "";
  const res = { statusCode: 200, setHeader() {}, end(s) { out = s || ""; } };
  // `house` rides on the in-process request object, where no HTTP caller can set it. It has to
  // come from here: once a house account is opened in a browser it is linked to that browser, the
  // spend is then keyed by the browser's device id, and the charge can no longer tell whose it is.
  await handler({ method: "POST", url: "/api/credits", headers: {}, body: { action, d, k, ...extra }, house: isHouse(rec.code) }, res);
  try { return JSON.parse(out); } catch (e) { return { ok: false, error: "credits unavailable" }; }
}
export async function creditBalance(rec) {
  const { default: handler } = await import("../api/credits.js");
  const { d, k } = creditIds(rec);
  let out = "";
  const res = { statusCode: 200, setHeader() {}, end(s) { out = s || ""; } };
  await handler({ method: "GET", url: `/api/credits?d=${encodeURIComponent(d)}&k=${encodeURIComponent(k)}`, headers: {} }, res);
  try { return JSON.parse(out); } catch (e) { return {}; }
}

// A ceiling on accounts made per day by the connector. Each new account can spend a new
// browser's free clips on OUR ffmpeg time, so this bounds what a script minting accounts costs.
// Since 2026-11-19 the connector checks per caller and per pool instead (lib/callers.js
// newAccountRefusal); this count of every account is what a call with no caller is held to.
export const NEW_ACCOUNTS_PER_DAY = 400;
export async function newAccountsToday() {
  try { return (await listPaths(`acct-new/${new Date().toISOString().slice(0, 10)}/`)).length; } catch (e) { return 0; }
}
