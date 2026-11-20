import test from "node:test";
import assert from "node:assert/strict";

process.env.HC_STORE = "memory"; // never the live store
process.env.TOKEN_ENC_KEY = "ab".repeat(32);
const { seal, unseal, signState, readState, createAccount, getAccount, keep, creditIds, ACCT, creditCall } = await import("../lib/accounts.js");
const { pickSegments, filterGraph, hookLines } = await import("../lib/cut.js");
const { seconds } = await import("../lib/cutjob.js");
const { storeTokens, accessToken, available, COMING_SOON } = await import("../lib/social.js");
const { postJob } = await import("../lib/postjob.js");

test("OAuth tokens are sealed: the stored value never contains the token, and a wrong key cannot open it", () => {
  const s = seal({ access_token: "ya29.SECRET", refresh_token: "1//REFRESH" });
  assert.ok(!s.includes("SECRET") && !s.includes("REFRESH"));
  assert.equal(unseal(s).refresh_token, "1//REFRESH");
  const parts = s.split("."); parts[2] = parts[2].slice(0, -2) + (parts[2].endsWith("AA") ? "BB" : "AA");
  assert.throws(() => unseal(parts.join(".")));
  process.env.TOKEN_ENC_KEY = "cd".repeat(32);
  assert.throws(() => unseal(s));
  process.env.TOKEN_ENC_KEY = "ab".repeat(32);
});

test("OAuth state is signed and expires", () => {
  const st = signState({ a: "hc_x", p: "youtube" });
  assert.equal(readState(st).p, "youtube");
  assert.equal(readState(st.slice(0, -3) + "abc"), null);
  assert.equal(readState(signState({ a: "x" }, -1000)), null);
  assert.equal(readState("garbage"), null);
});

test("an account is an unguessable code; unlinked it spends its own clips, linked the browser's", async () => {
  const rec = await createAccount("test");
  assert.match(rec.code, ACCT);
  assert.deepEqual(creditIds(rec), { d: "acct:" + rec.code, k: "" });
  rec.d = "browser-device"; rec.k = "cs_test_abc"; await keep(rec);
  assert.deepEqual(creditIds(await getAccount(rec.code)), { d: "browser-device", k: "cs_test_abc" });
  assert.equal(await getAccount("hc_nope"), null);
});

test("a server cut is charged through the credits API: ticket first, spent only with bytes", async () => {
  const rec = await createAccount("test");
  const t = await creditCall("start", rec);
  assert.equal(t.ok, true); assert.ok(t.ticket);
  const empty = await creditCall("commit", rec, { ticket: t.ticket, bytes: 0 });
  assert.equal(empty.ok, false);
  const c = await creditCall("commit", rec, { ticket: t.ticket, bytes: 5e6, meta: { vod: "1", t: 2, layout: "server-fit" } });
  assert.equal(c.ok, true); assert.equal(c.free_left, t.free_left - 1);
  const again = await creditCall("commit", rec, { ticket: t.ticket, bytes: 5e6 });
  assert.equal(again.already, true);
});

test("post_clip says plainly when a platform is not open or not connected, and never posts", async () => {
  const rec = await createAccount("test");
  delete process.env.GOOGLE_CLIENT_ID;
  let r = await postJob({ account: rec.code, clip_id: "a".repeat(40), platform: "youtube", caption: "x" });
  assert.equal(r.ok, false); assert.equal(r.not_open_yet, "youtube");
  process.env.GOOGLE_CLIENT_ID = "id"; process.env.GOOGLE_CLIENT_SECRET = "secret";
  // YouTube is "coming soon" until Google verifies the app: closed even with credentials set.
  assert.equal(available("youtube"), false);
  r = await postJob({ account: rec.code, clip_id: "a".repeat(40), platform: "youtube", caption: "x" });
  assert.equal(r.not_open_yet, "youtube"); assert.match(r.error, /coming soon/);
  COMING_SOON.delete("youtube");
  assert.equal(available("youtube"), true);
  r = await postJob({ account: rec.code, clip_id: "a".repeat(40), platform: "youtube", caption: "x" }, "mcp");
  assert.equal(r.needs_connect, "youtube"); assert.match(r.connect, /\/post\?acct=hc_.*&src=mcp$/);
  storeTokens(rec, "youtube", { access_token: "tok", refresh_token: "ref", expires_in: 3600 }); await keep(rec);
  assert.ok(!JSON.stringify(rec).includes("ref\""));
  assert.equal(await accessToken(rec, "youtube"), "tok");
  r = await postJob({ account: rec.code, clip_id: "a".repeat(40), platform: "youtube", caption: "x" });
  assert.match(r.error, /not on file/);
  assert.equal((await postJob({ account: rec.code, clip_id: "x", platform: "vimeo" })).ok, false);
  delete process.env.GOOGLE_CLIENT_ID; delete process.env.GOOGLE_CLIENT_SECRET;
  COMING_SOON.add("youtube");
});

test("the playlist is cut down to the segments that cover the window", () => {
  const pl = "#EXTM3U\n#EXT-X-MAP:URI=\"init-0.mp4\"\n" + Array.from({ length: 100 }, (_, i) => `#EXTINF:10.000,\n${i}${i === 64 ? "-unmuted" : ""}.ts`).join("\n");
  const p = pickSegments(pl, "https://cdn.example/x/chunked/index-dvr.m3u8", 641, 661);
  assert.deepEqual(p.segs.map((s) => s.start), [640, 650, 660]);
  assert.equal(p.offset, 1); assert.equal(p.total, 1000);
  assert.equal(p.segs[0].url, "https://cdn.example/x/chunked/64-muted.ts");
  assert.equal(p.map, "https://cdn.example/x/chunked/init-0.mp4");
  assert.equal(pickSegments(pl, "https://cdn.example/x/i.m3u8", 2000, 2020).segs.length, 0);
});

test("every layout trims inside the graph and ends in a 30 fps yuv420p stream", () => {
  for (const layout of ["fit", "split", "crop"]) {
    const { graph, out, aout } = filterGraph({ layout, offset: 1.5, dur: 30, hookFiles: ["/tmp/h0.txt"] });
    assert.match(graph, /trim=start=1\.500:duration=30\.000/); assert.match(graph, /fps=30/); assert.match(graph, /format=yuv420p\[v\]$/);
    assert.match(graph, /drawtext/); assert.equal(out, "[v]"); assert.equal(aout, "[aud]");
  }
  assert.equal(filterGraph({ layout: "fit", audio: false }).aout, null);
});

test("hook lines wrap to at most three and drop emoji; times parse from seconds or h:mm:ss", () => {
  assert.deepEqual(hookLines("Chat could not breathe after this 😂"), ["Chat could not breathe", "after this"]);
  assert.equal(hookLines("").length, 0);
  assert.ok(hookLines("a ".repeat(200)).length <= 3);
  assert.equal(seconds(3506), 3506); assert.equal(seconds("58:26"), 3506); assert.equal(seconds("1:02:03"), 3723); assert.equal(seconds("0h58m26s"), 3506);
  assert.ok(Number.isNaN(seconds("soon")));
});

test("TikTok chunks follow its size rules", async () => {
  const { tiktokChunks } = await import("../lib/social.js");
  const MB = 1024 * 1024;
  assert.deepEqual(tiktokChunks(3 * MB), { chunk: 3 * MB, count: 1 });
  assert.deepEqual(tiktokChunks(64 * MB), { chunk: 64 * MB, count: 1 });
  for (const size of [65 * MB, 96.2 * MB | 0, 200 * MB, 500 * MB + 7]) {
    const { chunk, count } = tiktokChunks(size);
    assert.ok(chunk >= 5 * MB && chunk <= 64 * MB);
    assert.equal(count, Math.floor(size / chunk));
    const last = size - chunk * (count - 1);
    assert.ok(last >= chunk && last <= 128 * MB, "last chunk " + last);
  }
});
