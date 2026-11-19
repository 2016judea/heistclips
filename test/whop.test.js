import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { verifyUserToken, watchKey } from "../lib/whop.js";
import { validKey } from "../lib/watch.js";
import { matchOne } from "../lib/autopilot.js";
import { whopPage, whopOutsidePage } from "../lib/whoppage.js";

const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "k1", alg: "ES256" };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
function token(claims, { key = privateKey, alg = "ES256", kid = "k1" } = {}) {
  const head = b64({ alg, kid, typ: "JWT" }), body = b64(claims);
  const sig = crypto.sign("sha256", Buffer.from(head + "." + body), { key, dsaEncoding: "ieee-p1363" }).toString("base64url");
  return `${head}.${body}.${sig}`;
}
const now = Date.parse("2026-11-19T18:00:00Z");
const good = { iss: "urn:whopcom:exp-proxy", aud: "app_test", sub: "user_1", exp: now / 1000 + 300 };
const opts = { appId: "app_test", keyset: [jwk], now };

test("a Whop user token signed by Whop for this app is accepted", async () => {
  assert.deepEqual(await verifyUserToken(token(good), opts), { userId: "user_1" });
});

test("a token for another app, from another issuer, expired, or re-signed is refused", async () => {
  await assert.rejects(verifyUserToken(token({ ...good, aud: "app_other" }), opts), /another app/);
  await assert.rejects(verifyUserToken(token({ ...good, aud: ["app_test"] }), opts), /another app/);
  await assert.rejects(verifyUserToken(token({ ...good, iss: "evil" }), opts), /issuer/);
  await assert.rejects(verifyUserToken(token({ ...good, exp: now / 1000 - 3600 }), opts), /expired/);
  const other = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" }).privateKey;
  await assert.rejects(verifyUserToken(token(good, { key: other }), opts), /signature/);
  const t = token(good).split(".");
  await assert.rejects(verifyUserToken(`${t[0]}.${b64({ ...good, sub: "user_admin" })}.${t[2]}`, opts), /signature/);
  await assert.rejects(verifyUserToken(`${b64({ alg: "none" })}.${b64(good)}.`, opts), /alg/);
  await assert.rejects(verifyUserToken("", opts), /no token/);
});

test("the owner's stated channel makes the campaign match exact, rules still checked", () => {
  const c = { id: "c1", slug: "s", title: "Lauren Hamden GTA 6 Clipping Campaign", description: "", requirements: [], budget_left: 100, platforms: [] };
  const m = { t_start: 0, t_end: 38, game: "Just Chatting", music_risk: { level: "low" } };
  assert.equal(matchOne(m, { platform: "twitch", login: "someoneelse", name: "x" }, c), null);
  const forced = matchOne(m, { platform: "twitch", login: "someoneelse", name: "x" }, c, { force: "owner" });
  assert.equal(forced.pays_for_streamer, "owner");
  assert.equal(forced.fits, false, "a GTA campaign still does not fit a Just Chatting moment");
});

test("the Whop pages carry analytics, are not indexed, and the routes exist", () => {
  const page = whopPage({ view: "exp", data: { id: "exp_x", level: "customer", configured: false, channels: [], items: [] } });
  for (const html of [page, whopOutsidePage()]) {
    assert.match(html, /\/_vercel\/insights\/script\.js/);
    assert.match(html, /bm-posthog:begin/);
    assert.match(html, /noindex/);
  }
  assert.ok(!/<\/script>.*<\/script><script id="w-data"/.test(page));
  assert.ok(validKey(watchKey("exp_abc123")));
  const v = JSON.parse(fs.readFileSync(new URL("../vercel.json", import.meta.url)));
  const src = v.rewrites.map((r) => r.source);
  const iExp = src.findIndex((s) => s.startsWith("/experiences/")), iAll = src.findIndex((s) => s.startsWith("/((?!api/)"));
  assert.ok(iExp >= 0 && iExp < iAll, "Whop routes come before the catch-all");
  assert.ok(src.some((s) => s.startsWith("/dashboard/")));
});
