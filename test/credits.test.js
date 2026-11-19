// Credits against a fake Blob store whose public URL always serves the FIRST copy of a file
// (the stale read that leaked free clips), while the list API is current.
import test from "node:test";
import assert from "node:assert/strict";

process.env.BLOB_READ_WRITE_TOKEN = "test-token";
process.env.CREDIT_SALT = "test-salt";
const files = new Map(); // pathname -> [first body, latest body]
globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url);
  const json = (obj, status = 200) => ({ ok: status < 400, status, json: async () => obj, text: async () => JSON.stringify(obj) });
  if (u.host === "blob.vercel-storage.com" && opts.method === "PUT") {
    const p = u.searchParams.get("pathname");
    const prev = files.get(p);
    files.set(p, [prev ? prev[0] : opts.body, opts.body]);
    return json({ pathname: p });
  }
  if (u.host === "blob.vercel-storage.com") {
    const pre = u.searchParams.get("prefix");
    return json({ blobs: [...files.keys()].filter((p) => p.startsWith(pre)).map((pathname) => ({ pathname })), hasMore: false });
  }
  if (u.host.endsWith(".public.blob.vercel-storage.com")) {
    const f = files.get(decodeURIComponent(u.pathname.slice(1)));
    return f ? json(JSON.parse(f[0])) : json({}, 404); // stale: first copy forever
  }
  throw new Error("unexpected fetch " + url);
};

const { default: handler } = await import("../api/credits.js");
const { secretPath } = await import("../lib/store.js");
const { FREE_CLIPS } = await import("../lib/render.js");

function call(method, payload) {
  const req = method === "GET" ? { method, url: "/api/credits?" + new URLSearchParams(payload) } : { method, url: "/api/credits", body: payload };
  return new Promise((ok) => {
    const res = { statusCode: 200, setHeader() {}, end(b) { ok({ status: this.statusCode, ...JSON.parse(b) }); } };
    handler(req, res);
  });
}
const render = async (d, bytes = 1000, k = "") => {
  const s = await call("POST", { action: "start", d, k });
  if (!s.ok) return s;
  return call("POST", { action: "commit", d, k, ticket: s.ticket, bytes });
};

test("a browser gets exactly FREE_CLIPS clips even when Blob serves stale reads", async () => {
  const d = "dev-a";
  for (let i = 0; i < FREE_CLIPS; i++) assert.equal((await render(d)).ok, true, "render " + (i + 1));
  const s = await call("POST", { action: "start", d });
  assert.equal(s.ok, false);
  assert.equal(s.need, "buy");
  assert.equal((await call("GET", { d })).free_left, 0);
});

test("an empty file is never charged", async () => {
  const d = "dev-b";
  const s = await call("POST", { action: "start", d });
  assert.equal(s.ok, true);
  assert.equal(s.free_left, FREE_CLIPS, "start charges nothing");
  const c = await call("POST", { action: "commit", d, ticket: s.ticket, bytes: 0 });
  assert.equal(c.ok, false);
  assert.equal(c.free_left, FREE_CLIPS);
});

test("committing the same ticket twice charges once; a forged or foreign ticket charges nothing", async () => {
  const d = "dev-c";
  const s = await call("POST", { action: "start", d });
  await call("POST", { action: "commit", d, ticket: s.ticket, bytes: 5 });
  const again = await call("POST", { action: "commit", d, ticket: s.ticket, bytes: 5 });
  assert.equal(again.already, true);
  assert.equal((await call("GET", { d })).free_left, FREE_CLIPS - 1);
  assert.equal((await call("POST", { action: "commit", d: "dev-other", ticket: s.ticket, bytes: 5 })).status, 400);
  assert.equal((await call("POST", { action: "commit", d, ticket: s.ticket.replace(/.$/, (c) => (c === "0" ? "1" : "0")), bytes: 5 })).status, 400);
});

test("legacy counters still count, then paid credits are spent after free ones", async () => {
  const d = "dev-d", k = "cs_test_abc";
  files.set(secretPath("credits/free", d), [JSON.stringify({ used: FREE_CLIPS - 1 }), JSON.stringify({ used: FREE_CLIPS - 1 })]);
  files.set(secretPath("credits/paid", k), [JSON.stringify({ granted: 2, used: 1 }), JSON.stringify({ granted: 2, used: 1 })]);
  assert.deepEqual(await call("GET", { d, k }), { status: 200, free_left: 1, paid_left: 1 });
  assert.equal((await render(d, 10, k)).paid_left, 1, "free first");
  const r = await render(d, 10, k);
  assert.deepEqual([r.ok, r.free_left, r.paid_left], [true, 0, 0]);
  assert.equal((await call("POST", { action: "start", d, k })).ok, false);
});

test("an old open tab's up-front 'use' still charges, from the same ledger", async () => {
  const d = "dev-e";
  const u = await call("POST", { action: "use", d });
  assert.equal(u.ok, true);
  assert.equal((await call("GET", { d })).free_left, FREE_CLIPS - 1);
});
