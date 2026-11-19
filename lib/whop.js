// heistclips as a Whop app. Whop renders the app in an iframe behind its proxy, which adds a
// short-lived ES256 JWT in x-whop-user-token to every same-origin request. We verify it against
// Whop's JWKS (issuer urn:whopcom:exp-proxy, audience our app id), then ask Whop what that user
// may see. Docs: docs.whop.com/developer/guides/authentication (read 2026-11-19).
import crypto from "node:crypto";
import { getJSON, putJSON, secretPath } from "./store.js";

export const APP_ID = () => process.env.WHOP_APP_ID || "app_my7kSid9rb0xHU";
const JWKS_URL = "https://api.whop.com/.well-known/jwks.json";
const API = "https://api.whop.com/api/v1";
let jwks = { at: 0, keys: [] };

async function keys(force) {
  if (!force && jwks.keys.length && Date.now() - jwks.at < 12 * 3600 * 1000) return jwks.keys;
  const r = await fetch(JWKS_URL, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error("jwks " + r.status);
  jwks = { at: Date.now(), keys: (await r.json()).keys || [] };
  return jwks.keys;
}

const dec = (s) => JSON.parse(Buffer.from(s, "base64url").toString("utf8"));

// Returns { userId } or throws. `keyset` and `now` are injectable for tests.
export async function verifyUserToken(token, { appId = APP_ID(), keyset, now = Date.now() } = {}) {
  if (!token || typeof token !== "string") throw new Error("no token");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("malformed token");
  const head = dec(parts[0]), body = dec(parts[1]);
  if (head.alg !== "ES256") throw new Error("wrong alg");
  const check = (ks) => {
    for (const jwk of ks.filter((k) => !head.kid || k.kid === head.kid)) {
      try {
        const key = crypto.createPublicKey({ format: "jwk", key: jwk });
        if (crypto.verify("sha256", Buffer.from(parts[0] + "." + parts[1]), { key, dsaEncoding: "ieee-p1363" }, Buffer.from(parts[2], "base64url"))) return true;
      } catch (e) { /* try the next key */ }
    }
    return false;
  };
  let ok = check(keyset || (await keys(false)));
  if (!ok && !keyset) ok = check(await keys(true)); // key rotation
  if (!ok) throw new Error("bad signature");
  if (body.iss !== "urn:whopcom:exp-proxy") throw new Error("wrong issuer");
  if (typeof body.aud !== "string" || body.aud !== appId) throw new Error("token is for another app");
  if (!body.exp || body.exp * 1000 < now - 30000) throw new Error("expired");
  if (!body.sub) throw new Error("no subject");
  return { userId: body.sub };
}

async function whop(path) {
  const r = await fetch(API + path, { headers: { authorization: "Bearer " + process.env.WHOP_API_KEY, accept: "application/json" } });
  if (!r.ok) throw new Error("whop " + r.status);
  return r.json();
}

// "admin" (team member of the business), "customer" (has a membership), or "no_access".
export async function accessLevel(userId, resourceId) {
  const d = await whop(`/users/${encodeURIComponent(userId)}/access/${encodeURIComponent(resourceId)}`);
  return d.has_access ? d.access_level : "no_access";
}

export async function experience(id) {
  try { return await whop(`/experiences/${encodeURIComponent(id)}`); } catch (e) { return null; }
}

// ---- what an owner configured --------------------------------------------------------------
// One record per experience (and one per business, as the default for its experiences), under
// keyed-hash paths. It holds a campaign id and channel names: nothing personal.
export const cfgPath = (id) => secretPath("whop/cfg", id);
export const loadCfg = (id) => getJSON(cfgPath(id), { fresh: true }).catch(() => null);
export const saveCfg = (id, cfg) => putJSON(cfgPath(id), cfg, { maxAge: 0 });

// The watchlist key the cron scans this installation's channels under (lib/watch.js).
export const watchKey = (id) => crypto.createHmac("sha256", process.env.CREDIT_SALT || process.env.BLOB_READ_WRITE_TOKEN || "dev").update("whop|" + id).digest("base64url").slice(0, 24);

// Which clips one member already dealt with, per experience.
export const statePath = (expId, userId) => secretPath("whop/st", expId + "|" + userId);
