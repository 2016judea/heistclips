// Test clips and house clips stay out of public numbers (lib/marks.js, ANALYTICS.md).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

process.env.BLOB_READ_WRITE_TOKEN = "test-token";
process.env.CREDIT_SALT = "test-salt";
const HOUSE = "hc_" + "h".repeat(32);
process.env.HOUSE_ACCOUNTS = `hc_${"x".repeat(32)}, ${HOUSE}`;
const files = new Map(), events = [];
globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url);
  const json = (obj, status = 200) => ({ ok: status < 400, status, json: async () => obj, text: async () => JSON.stringify(obj) });
  if (u.host === "us.i.posthog.com") { events.push(JSON.parse(opts.body)); return json({}); }
  if (u.host === "blob.vercel-storage.com" && opts.method === "PUT") { files.set(u.searchParams.get("pathname"), opts.body); return json({}); }
  if (u.host === "blob.vercel-storage.com") return json({ blobs: [...files.keys()].filter((p) => p.startsWith(u.searchParams.get("prefix"))).map((pathname) => ({ pathname })), hasMore: false });
  if (u.host.endsWith(".public.blob.vercel-storage.com")) { const f = files.get(decodeURIComponent(u.pathname.slice(1))); return f ? json(JSON.parse(f)) : json({}, 404); }
  throw new Error("unexpected fetch " + url);
};

const { default: credits } = await import("../api/credits.js");
const { isTest, isHouse, TEST_HEADER } = await import("../lib/marks.js");
const { buildTrend, excluded, parseRecordPath } = await import("../lib/trend.js");

function call(payload, headers = {}) {
  return new Promise((ok) => {
    const res = { statusCode: 200, setHeader() {}, end(b) { ok(JSON.parse(b)); } };
    credits({ method: "POST", url: "/api/credits", body: payload, headers }, res);
  });
}
const meta = { vod: "2932305259", t: 37340, layout: "split", channel: "kaicenat", secs: 38 };
async function clip(d, headers = {}, m = meta) {
  const s = await call({ action: "start", d }, headers);
  return call({ action: "commit", d, ticket: s.ticket, bytes: 5_000_000, meta: m }, headers);
}
const trendFiles = () => [...files.keys()].filter((p) => p.startsWith("trend/c/"));
const made = () => events.filter((e) => e.event === "clip_made");

test("the test header is exactly x-hc-test: 1", () => {
  assert.equal(TEST_HEADER, "x-hc-test");
  assert.equal(isTest({ headers: { "x-hc-test": "1" } }), true);
  for (const h of [{}, { "x-hc-test": "0" }, { "x-hc-test": "" }, { "x-hc-test": "true" }]) assert.equal(isTest({ headers: h }), false);
  assert.equal(isTest({}), false);
});

test("a customer's clip is counted once in the trend and once as clip_made, with no house mark", async () => {
  const r = await clip("dev-customer");
  assert.equal(r.ok, true);
  assert.equal(trendFiles().length, 1);
  assert.equal(made().length, 1);
  assert.equal("house" in made()[0].properties, false);
});

test("a test clip is charged and counted nowhere", async () => {
  const before = [trendFiles().length, made().length];
  const r = await clip("dev-test", { "x-hc-test": "1" });
  assert.equal(r.ok, true);
  assert.equal(r.free_left, (await call({ action: "start", d: "dev-fresh" })).free_left - 1, "the clip was charged");
  assert.deepEqual([trendFiles().length, made().length], before);
  assert.equal([...files.entries()].some(([p, body]) => p.startsWith("credits/") && /"qa"/.test(body)), false, "the spend row does not keep the flag");
});

test("a house account's clip says house: true on clip_made and leaves no trend record", async () => {
  assert.equal(isHouse(HOUSE), true);
  assert.equal(isHouse("acct:" + HOUSE), true);
  assert.equal(isHouse("acct:hc_" + "z".repeat(32)), false);
  assert.equal(isHouse(""), false);
  const before = [trendFiles().length, made().length];
  const r = await clip("acct:" + HOUSE, {}, { ...meta, layout: "server-fit" });
  assert.equal(r.ok, true);
  assert.equal(trendFiles().length, before[0]);
  assert.equal(made().length, before[1] + 1);
  const p = made().at(-1).properties;
  assert.equal(p.house, true);
  assert.equal(p.path, "connector");
  assert.equal(JSON.stringify(made().at(-1)).includes(HOUSE), false, "the account code is never in an event");
});

test("a house account that was linked to a browser is still house: the account layer tells the charge", async () => {
  const { creditCall } = await import("../lib/accounts.js");
  const before = [trendFiles().length, made().length];
  const rec = { code: HOUSE, d: "some-browser-device", k: "" }; // linked: the spend is keyed by the browser, not the code
  const s = await creditCall("start", rec);
  const c = await creditCall("commit", rec, { ticket: s.ticket, bytes: 5_000_000, meta: { ...meta, layout: "server-split", via: "web" } });
  assert.equal(c.ok, true);
  assert.equal(trendFiles().length, before[0], "no trend record");
  assert.equal(made().at(-1).properties.house, true);
  assert.equal(made().at(-1).properties.path, "browser_server");
  // The same browser without the account is a customer's browser like any other.
  const plain = await clip("some-browser-device");
  assert.equal(plain.ok, true);
  assert.equal(trendFiles().length, before[0] + 1);
  assert.equal("house" in made().at(-1).properties, false);
  // and nothing in a request body can claim it
  const s2 = await call({ action: "start", d: "dev-liar", house: true });
  await call({ action: "commit", d: "dev-liar", house: true, ticket: s2.ticket, bytes: 5_000_000, meta: { ...meta, house: true } });
  assert.equal("house" in made().at(-1).properties, false);
});

test("with no HOUSE_ACCOUNTS nothing is house", () => {
  const keep = process.env.HOUSE_ACCOUNTS;
  delete process.env.HOUSE_ACCOUNTS;
  assert.equal(isHouse(HOUSE), false);
  process.env.HOUSE_ACCOUNTS = keep;
});

test("records on the exclude list are left out of the build, and the list holds only real record paths", async () => {
  const skip = excluded();
  assert.ok(skip.size >= 60);
  for (const p of skip) assert.ok(parseRecordPath(p), p);
  const doc = JSON.parse(fs.readFileSync(new URL("../lib/trend_exclude.json", import.meta.url), "utf8"));
  assert.equal(Object.values(doc.groups).reduce((a, g) => a + g.n, 0), doc.paths.length);
  // One excluded and one counted record of the same moment on the same day: only one is counted.
  const ex = [...skip][0], r = parseRecordPath(ex);
  files.clear();
  files.set(ex, "{}");
  files.set(ex.replace(/-[0-9a-f]{8}~/, "-00000000~"), "{}");
  files.set("trend/vods.json", JSON.stringify({ [r.vod]: { platform: "twitch", login: "someone", name: "Someone" } }));
  const now = Date.parse(r.day + "T23:00:00Z");
  const withBoth = await buildTrend(now, { maxLookups: 0 });
  files.delete(ex);
  const withOne = await buildTrend(now, { maxLookups: 0 });
  assert.equal(withBoth.clips_counted, withOne.clips_counted);
});
