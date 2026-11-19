// The connector's two per-caller limits (lib/callers.js): 3 new free accounts a day per outside
// caller, 120 find_clip_moments an hour, and Claude's shared servers in a pool no outside caller
// can drain. Why: 2026-11-19, one bot (UA "Clipbot") took 58 free cuts across 6+ new accounts.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.HC_STORE = "memory"; // never the live store
process.env.HC_NO_ANALYTICS = "1";
process.env.TOKEN_ENC_KEY = "ab".repeat(32);
const C = await import("../lib/callers.js");
const { putJSON, listPaths } = await import("../lib/store.js");
const { cutJob } = await import("../lib/cutjob.js");
const { callTool, withBugHint, default: mcpHandler } = await import("../api/mcp.js");
const { default: cutHandler } = await import("../api/v1/cut.js");

const CLIPBOT = "Clipbot/1.0 (+https://example.test/bot)";
const CLAUDE = "Claude-User";

test("a caller is address + UA family; Claude's and ChatGPT's shared servers are pools, never an address", () => {
  const a = C.callerOf("203.0.113.5", CLIPBOT);
  assert.equal(a.pool, "caller"); assert.match(a.key, /^[0-9a-f]{24}$/);
  assert.deepEqual(C.callerOf("203.0.113.5", "Clipbot/2.3"), a, "a new version of the same bot is the same caller");
  assert.notDeepEqual(C.callerOf("203.0.113.6", CLIPBOT), a, "another address is another caller");
  assert.notDeepEqual(C.callerOf("203.0.113.5", "python-requests/2.31"), a, "another program on the address is another caller");
  assert.ok(!JSON.stringify(a).includes("203.0.113.5"), "the address is never stored");
  assert.deepEqual(C.callerOf("160.79.104.10", CLAUDE), { pool: "claude" });
  assert.deepEqual(C.callerOf("160.79.104.11", "Claude-User/1.0 (+https://claude.ai)"), { pool: "claude" });
  assert.deepEqual(C.callerOf("1.2.3.4", "openai-mcp/1.0.0"), { pool: "chatgpt" });
  assert.equal(C.callerOf("1.2.3.4", "claude-code/2.0").pool, "caller", "Claude Code calls from the person's own address");
  assert.equal(C.callerOf("1.2.3.4", CLAUDE, { shared: false }).pool, "caller", "only /mcp can be a hosted assistant");
  // an IPv6 caller cannot rotate inside its /64
  assert.equal(C.ipBlock("2001:db8:1:2::1"), C.ipBlock("2001:0db8:0001:0002:ffff:1:2:3"));
  assert.notEqual(C.ipBlock("2001:db8:1:2::1"), C.ipBlock("2001:db8:1:3::1"));
  assert.deepEqual(C.callerOf("2001:db8:1:2::1", CLIPBOT), C.callerOf("2001:db8:1:2:aaaa::9", CLIPBOT));
});

test("the caller the connector hands the cut function is signed: a forged or stale one is refused", () => {
  const out = C.openCaller(C.sealCaller({ pool: "claude" }));
  assert.deepEqual(out, { pool: "claude" });
  const c = C.callerOf("203.0.113.5", CLIPBOT);
  assert.deepEqual(C.openCaller(C.sealCaller(c)), c);
  const forged = Buffer.from(JSON.stringify({ pool: "claude", exp: Date.now() + 60000 })).toString("base64url") + ".bad";
  assert.equal(C.openCaller(forged), null);
  const [body, sig] = C.sealCaller(c).split(".");
  const swapped = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url")), pool: "claude" })).toString("base64url");
  assert.equal(C.openCaller(swapped + "." + sig), null);
  assert.equal(C.openCaller(C.sealCaller(c, -1000)), null);
  assert.equal(C.openCaller(undefined), null);
});

test("a direct POST to the cut function cannot claim Claude's pool; the connector's signed caller can", async () => {
  const run = async (body, ua) => {
    const req = { method: "POST", headers: { "x-forwarded-for": "198.51.100.7, 10.0.0.1", "user-agent": ua }, body };
    const res = { statusCode: 200, setHeader() {}, end() {} };
    await cutHandler(req, res);
    return req.body;
  };
  const direct = await run({ source: "v1", start: "x", end: "y", caller: { pool: "claude" } }, CLAUDE);
  assert.equal(direct.caller.pool, "caller");
  assert.deepEqual(direct.caller, C.callerOf("198.51.100.7", CLAUDE, { shared: false }));
  const signed = await run({ source: "v1", start: "x", end: "y", caller_token: C.sealCaller({ pool: "claude" }) }, "node");
  assert.deepEqual(signed.caller, { pool: "claude" }); assert.equal(signed.caller_token, undefined);
});

// cutJob with everything but the account and credit rules stubbed (as in connector.test.js).
const VOD = { id: "v1", platform: "twitch", length: 5000, channel: "x", channel_name: "X", title: "t" };
function deps() {
  const calls = { cut: 0 };
  return { calls, resolveVod: async () => VOD,
    cutClip: async () => { calls.cut++; const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cl-")); const file = path.join(dir, "o.mp4"); fs.writeFileSync(file, Buffer.alloc(2048)); return { dir, file, bytes: 2048, seconds: 30, ms: 5 }; },
    putFile: async () => ({}), serverEvent: async () => {}, saveJob: async () => {} };
}

test("an outside caller gets 3 new free accounts a day; the 4th cut is refused before any cutting, with a way on", async () => {
  const bot = C.callerOf("203.0.113.50", CLIPBOT);
  const made = [];
  for (let i = 0; i < 3; i++) {
    const r = await cutJob({ source: "v1", start: 100, end: 130, caller: bot }, deps());
    assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.new_account, true); made.push(r.account);
  }
  const d = deps();
  const fourth = await cutJob({ source: "v1", start: 100, end: 130, caller: bot }, d);
  assert.equal(fourth.ok, false); assert.equal(fourth.err, "caller_account_cap"); assert.equal(d.calls.cut, 0);
  assert.match(fourth.error, /account code/); assert.match(fourth.error, /pricing\?src=mcp/); assert.match(fourth.resets_at, /T00:00:00\.000Z$/);
  assert.equal(fourth.buy, "https://heistclips.com/pricing?src=mcp");
  // passing an account it already has still works: the free clips it was given are not touched
  const again = await cutJob({ source: "v1", start: 100, end: 130, caller: bot, account: made[0] }, deps());
  assert.equal(again.ok, true); assert.equal(again.new_account, false);
  // another caller, and Claude's pool, are untouched by this bot
  assert.equal((await cutJob({ source: "v1", start: 100, end: 130, caller: C.callerOf("203.0.113.51", CLIPBOT) }, deps())).ok, true);
  for (let i = 0; i < 4; i++) assert.equal((await cutJob({ source: "v1", start: 100, end: 130, caller: { pool: "claude" } }, deps())).ok, true);
  // in-process calls with no caller keep the old rule (every account today, 400)
  assert.equal(await C.newAccountRefusal(null), null);
});

test("no number of outside callers can use up Claude's pool, and each pool has its own ceiling", async () => {
  const many = (n) => async () => Array(n);
  assert.equal(await C.newAccountRefusal({ pool: "claude" }, { list: async (p) => (p.includes("/claude/") ? [] : Array(5000)) }), null);
  assert.equal((await C.newAccountRefusal({ pool: "claude" }, { list: many(C.NEW_ACCOUNTS_PER_POOL) })).err, "account_cap");
  // 400 new outside accounts in a day stop new outside accounts, from fresh callers too
  const fresh = C.callerOf("192.0.2.1", "node");
  assert.equal((await C.newAccountRefusal(fresh, { list: async (p) => (p.endsWith("/caller/") ? Array(400) : []) })).err, "account_cap");
  assert.equal(await C.newAccountRefusal(fresh, { list: async () => [] }), null);
});

test("watch_streamer and posting_account count new accounts against the same caller", async () => {
  const bot = C.callerOf("203.0.113.60", CLIPBOT);
  // three accounts already made by this caller today, by any tool
  for (let i = 0; i < 3; i++) await putJSON(C.accountMarker(bot), { via: "mcp" });
  const meta = { ip: "203.0.113.60", ua: CLIPBOT, client: "other", test: false, caller: bot };
  const w = await callTool("watch_streamer", { streamer: "somestreamer" }, "203.0.113.60", meta);
  assert.equal(w.isError, false); assert.equal(w.log.err, "caller_account_cap"); assert.match(w.structuredContent.error, /pricing\?src=mcp/);
  const p = await callTool("posting_account", {}, "203.0.113.60", meta);
  assert.equal(p.log.err, "caller_account_cap"); assert.equal(p.structuredContent.ok, false);
  assert.ok(!("err" in p.structuredContent), "the code is for analytics, the sentence is for the person");
});

test("find_clip_moments: 120 an hour per outside caller, then rate_limited with the reset time; Claude is never limited", async () => {
  const now = Date.parse("2026-11-19T21:46:30Z");
  const bot = C.callerOf("203.0.113.70", CLIPBOT);
  const written = [];
  const put = async (p) => { written.push(p); };
  const g = await C.findGate(bot, { now, list: async () => Array(119), put });
  assert.equal(g.refused, undefined); await g.counted;
  assert.equal(written.length, 1); assert.ok(written[0].startsWith(`rl/find/2026-11-19T21/${bot.key}/`));
  const no = await C.findGate(bot, { now, list: async () => Array(120), put });
  assert.equal(no.refused.err, "rate_limited"); assert.equal(no.refused.resets_at, "2026-11-19T22:00:00.000Z"); assert.equal(no.refused.retry_after_s, 810);
  assert.match(no.refused.error, /120 an hour/); assert.match(no.refused.error, /22:00 UTC \(in 14 minutes\)/);
  assert.equal(written.length, 1, "a refused call is not counted");
  for (const c of [{ pool: "claude" }, { pool: "chatgpt" }, null]) assert.equal((await C.findGate(c, { now, list: async () => Array(10000), put })).refused, undefined);
  // through the connector: an outside caller over its hour gets the error and Twitch is never read
  const meta = { ip: "203.0.113.70", ua: CLIPBOT, client: "other", test: false, caller: bot };
  const hr = new Date().toISOString().slice(0, 13);
  for (let i = 0; i < 120; i++) await putJSON(`rl/find/${hr}/${bot.key}/${i}.json`, {});
  const r = await callTool("find_clip_moments", { source: "nobody_at_all_zz" }, "203.0.113.70", meta);
  assert.equal(r.isError, true); assert.equal(r.log.err, "rate_limited"); assert.match(r.structuredContent.error, /UTC \(in \d+ minutes?\)/);
  assert.equal((await listPaths(`rl/find/${hr}/${bot.key}/`)).length, 120);
});

test("limit refusals are the caller's, not a bug: no report_a_bug hint", () => {
  for (const err of ["rate_limited", "caller_account_cap"]) {
    const out = Object.defineProperty({ content: [{ type: "text", text: "x" }], structuredContent: { ok: false, error: "x" }, isError: true }, "log", { value: { err } });
    assert.equal(withBugHint(out, "find_clip_moments").structuredContent.report_a_bug, undefined);
  }
});

test("outside callers see the API-key line and their full UA is logged; Claude-User sees nothing new", async () => {
  const sent = [], realFetch = globalThis.fetch;
  delete process.env.HC_NO_ANALYTICS;
  globalThis.fetch = async (url, o) => { sent.push({ url: String(url), body: JSON.parse(o.body) }); return { ok: true, json: async () => ({}) }; };
  const call = async (ua) => {
    let out = "";
    const req = { method: "POST", headers: { "user-agent": ua, "x-forwarded-for": "203.0.113.80" }, body: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "whats_new", arguments: { limit: 1 } } } };
    await mcpHandler(req, { statusCode: 200, setHeader() {}, end(s) { out = s; } });
    return JSON.parse(out).result;
  };
  try {
    const bot = await call(CLIPBOT);
    assert.equal(bot.structuredContent.building_on_heistclips, C.BUILDERS_LINE);
    assert.match(bot.content[0].text, /request_a_feature/);
    const claude = await call(CLAUDE);
    assert.equal(claude.structuredContent.building_on_heistclips, undefined);
    assert.ok(!claude.content[0].text.includes("API key"));
    const ev = sent.filter((s) => s.url.includes("posthog")).map((s) => s.body.properties);
    assert.equal(ev.length, 2);
    assert.equal(ev[0].client_ua_full, CLIPBOT); assert.equal(ev[0].client_ua, "Clipbot");
    assert.equal(ev[1].client_ua_full, "Claude-User");
    assert.ok(!JSON.stringify(ev).includes("203.0.113.80"), "never the address");
    assert.equal(C.BUILDERS_LINE.length < 140, true);
    sent.length = 0;
    await call(CLIPBOT + " " + "x".repeat(150));
    assert.equal(sent[0].body.properties.client_ua_full, (CLIPBOT + " " + "x".repeat(150)).slice(0, 100));
  } finally { globalThis.fetch = realFetch; process.env.HC_NO_ANALYTICS = "1"; }
});
