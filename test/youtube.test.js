// YouTube: link parsing, the greeting/request filter, comment-timestamp moments, the live chat
// fold, and what happens when the day's API quota runs out. No network: fetch is stubbed.
import test from "node:test";
import assert from "node:assert/strict";

process.env.HC_STORE = "memory"; // never the live store
process.env.HC_NO_ANALYTICS = "1";
process.env.YOUTUBE_API_KEY = "test-key";
const { parseInput } = await import("../public/js/twitch.js");
const { noiseKind, isNoise, commentVotes, commentMoments, momentsFromChat, parseTs } = await import("../public/js/youtube.js");
const Y = await import("../lib/youtube.js");
const { findClipMoments } = await import("../lib/momentstool.js");
const { callTool } = await import("../api/mcp.js");

test("parseInput reads every YouTube link form, and a Short is not a stream", () => {
  assert.deepEqual(parseInput("https://www.youtube.com/watch?v=uDwiE9saR0c"), { kind: "youtube", id: "uDwiE9saR0c" });
  assert.deepEqual(parseInput("https://www.youtube.com/watch?v=uDwiE9saR0c&t=3600s"), { kind: "youtube", id: "uDwiE9saR0c", t: 3600 });
  assert.deepEqual(parseInput("youtu.be/uDwiE9saR0c?t=1h2m3s"), { kind: "youtube", id: "uDwiE9saR0c", t: 3723 });
  assert.deepEqual(parseInput("https://youtube.com/live/yX4DH_msPkI?si=abc"), { kind: "youtube", id: "yX4DH_msPkI" });
  assert.deepEqual(parseInput("https://m.youtube.com/watch?v=hwSg39yIBGU&feature=share"), { kind: "youtube", id: "hwSg39yIBGU" });
  assert.deepEqual(parseInput("https://www.youtube.com/embed/hwSg39yIBGU"), { kind: "youtube", id: "hwSg39yIBGU" });
  assert.deepEqual(parseInput("youtube.com/@Tomovids"), { kind: "ythandle", handle: "tomovids" });
  assert.deepEqual(parseInput("https://www.youtube.com/@KaiCenatLive/live"), { kind: "ythandle", handle: "kaicenatlive" });
  assert.deepEqual(parseInput("https://youtube.com/channel/UCWsDFcIhY2DBi3GB5uykGXA"), { kind: "ythandle", channel: "UCWsDFcIhY2DBi3GB5uykGXA" });
  assert.deepEqual(parseInput("https://youtube.com/shorts/abcdefghijk"), { kind: "unknown", site: "youtube_short" });
  assert.deepEqual(parseInput("https://youtube.com/results?search_query=gta"), { kind: "unknown", site: "youtube" });
  assert.deepEqual(parseInput("https://youtu.be/abc"), { kind: "unknown", site: "youtube" }); // not an 11-character id
  // Twitch and Kick are untouched, and a bare name is still a Twitch channel.
  assert.deepEqual(parseInput("kaicenat"), { kind: "channel", login: "kaicenat" });
  assert.equal(parseInput("https://notyoutube.com/watch?v=uDwiE9saR0c").kind, "unknown");
});

test("the noise filter drops greetings, roll calls, requests and emote-only spam, never reactions", () => {
  for (const s of ["hi", "HELLO", "hey guys", "yo", "good morning", "first", "W stream", "W streamer", "hello from india", "where are you from", "watching from brazil", "play as lucia", "pls go to the strip club", "can you say hi to me", "sub to my channel", ":hand-pink-waving::hand-pink-waving:", "❤️❤️❤️", "👋"])
    assert.ok(isNoise(s), `noise: ${s}`);
  for (const s of ["LMAOOO", "💀💀💀", "😂😂", "NOOOO", "bro what", "W", "no way", "CLIP IT", "high speed chase lol", "go to the strip club lol", "he crashed"])
    assert.ok(!isNoise(s), `kept: ${s}`);
  assert.equal(noiseKind("play as lucia"), "request");
  assert.equal(noiseKind("hello from india"), "roll_call");
});

test("comment timestamps: h:mm:ss and mm:ss, clock times skipped, chapter lists read line by line", () => {
  assert.equal(parseTs("2:41:31"), 9691);
  assert.equal(parseTs("41:31"), 2491);
  assert.equal(parseTs("1:61"), null);
  const v = commentVotes({ id: "a", text: "2:41:31 lmao the ATV\nstream starts at 3:00 pm\n1:05:10 - the cop chase", likes: 4 }, 20000);
  assert.deepEqual(v.map((x) => [x.t, x.label]), [[9691, "lmao the ATV"], [3910, "the cop chase"]]);
  assert.equal(commentVotes({ id: "b", text: "9:99:99 nope, 5:00:00 too late" }, 3600).length, 0); // past the end
  assert.equal(commentVotes({ id: "c", text: "[0:00] – [8:00]" }, 3600)[0].label, ""); // brackets alone are no label
});

test("comment moments: a crowd beats a lone comment, a long list counts half, '8:29' means 8 h 29 min near an 8:28:50 crowd", () => {
  const vod = { id: "qSyo5d-dVzA", length: 85542, channel_name: "IShowSpeed" };
  const crowd = Array.from({ length: 6 }, (_, i) => ({ id: "c" + i, text: `8:28:${50 + i} LMAO 😂`, likes: 10 * i }));
  const short = [{ id: "s1", text: "8:29 bro is cooked", likes: 2 }, { id: "s2", text: "8:29 💀", likes: 0 }];
  const lone = [{ id: "l1", text: "1:01:00 ok", likes: 0 }];
  const list = [{ id: "list", text: Array.from({ length: 8 }, (_, i) => `${i + 2}:00:00 chapter ${i}`).join("\n"), likes: 40 }];
  const ms = commentMoments(vod, [...crowd, ...short, ...lone, ...list], { k: 10 });
  assert.ok(ms.length >= 1);
  assert.equal(ms[0].t_peak >= 30530 && ms[0].t_peak <= 30560, true, "top moment is the 8:28:50 crowd");
  assert.equal(ms[0].comments, 8, "the two '8:29' comments joined the crowd as 8 h 29 min");
  assert.equal(ms[0].signal, "comments");
  assert.equal(ms[0].chat_ratio, null);
  assert.ok(ms[0].url.startsWith("https://www.youtube.com/watch?v=qSyo5d-dVzA&t="));
  assert.ok(!ms.some((m) => m.t_peak === 3660), "a lone comment with no likes is not a moment");
  // Nothing timestamped: nothing invented.
  assert.deepEqual(commentMoments(vod, [{ id: "x", text: "great stream" }]), []);
});

// Synthetic live chat: 0.5 msg/s of chatter with a greeting flood at minute 10, and a real
// reaction burst at minute 20.
function liveChat() {
  const msgs = []; let id = 0;
  for (let t = 0; t < 1800; t++) {
    if (t % 2 === 0) msgs.push({ id: String(id++), t, text: ["what car is that", "nice", "he is lost", "go left"][t % 4] });
    if (t >= 600 && t < 620) for (let k = 0; k < 6; k++) msgs.push({ id: String(id++), t, text: ["hi", "hello from india", "W stream", "first"][k % 4] });
    if (t >= 1200 && t < 1215) for (let k = 0; k < 6; k++) msgs.push({ id: String(id++), t, text: k % 2 ? "LMAOOO" : "💀💀💀" });
  }
  return msgs;
}

test("live chat moments: the reaction is found, the greeting flood is not", () => {
  const r = momentsFromChat({ id: "yX4DH_msPkI", channel_name: "Kai", length: 1800 }, liveChat(), { k: 5 });
  assert.ok(r.moments.length >= 1);
  const top = r.moments[0];
  assert.ok(top.t_peak >= 1195 && top.t_peak <= 1225, "top moment at the burst: " + top.t_peak);
  assert.equal(top.event_type, "funny");
  assert.ok(!r.moments.some((m) => m.t_peak >= 590 && m.t_peak <= 640 && !m.quiet), "no moment at the greeting flood");
  assert.ok(r.noise >= 120);
});

test("the shared poller folds pages into bins and freezes a spike once its reaction is over", () => {
  const start = Date.parse("2026-11-19T20:00:00Z");
  let s = { v: 1, id: "yX4DH_msPkI", chat_id: "c", start_ms: start, watched_from: start, next: null, next_at: 0, polls: 0, units: 0, ended: false, bins: {}, raw: [], moments: [], msgs: 0, noise: 0, last_t: 0 };
  const items = liveChat().map((m) => ({ id: "m" + m.id, snippet: { type: "textMessageEvent", publishedAt: new Date(start + m.t * 1000).toISOString(), displayMessage: m.text } }));
  // Fed a minute at a time, the way the cron reads it.
  for (let t = 0; t < 1800; t += 60) s = Y.foldChat(s, items.filter((x) => { const k = (Date.parse(x.snippet.publishedAt) - start) / 1000; return k >= t && k < t + 60; }));
  assert.equal(s.msgs, items.length);
  assert.ok(s.noise >= 120);
  const real = s.moments.filter((m) => !m.quiet);
  assert.ok(real.some((m) => m.t_peak >= 1195 && m.t_peak <= 1225), "the burst became a moment");
  assert.ok(!real.some((m) => m.t_peak >= 590 && m.t_peak <= 640), "the greeting flood did not");
  assert.ok(s.raw.length && s.raw[0].t >= s.last_t - Y.RAW_KEEP_S, "raw chat is kept for 20 minutes only");
  assert.ok(Y.curveOf(s).length > 50);
});

test("quota: a 403 quotaExceeded marks the day used up; nothing calls YouTube after; the answer says when it comes back", async () => {
  let calls = 0;
  const fetch403 = async () => { calls++; return { ok: false, status: 403, json: async () => ({ error: { errors: [{ reason: "quotaExceeded" }] } }) }; };
  await assert.rejects(Y.ytApi("videos", { id: "x" }, { deps: { fetch: fetch403 } }), (e) => e instanceof Y.QuotaOut && /midnight Pacific/.test(e.message));
  assert.equal(calls, 1);
  await assert.rejects(Y.ytApi("videos", { id: "y" }, { deps: { fetch: fetch403 } }), Y.QuotaOut);
  assert.equal(calls, 1, "the second call never reached YouTube");
  const q = await Y.quotaState(Date.now(), { fresh: true });
  assert.equal(q.out, true);
  // The connector says so plainly, as an answer with a next step.
  const r = await findClipMoments({ source: "https://www.youtube.com/watch?v=uDwiE9saR0c" });
  assert.equal(r.out.found, false); assert.equal(r.out.reason, "yt_quota"); assert.match(r.out.message, /daily limit/); assert.match(r.out.next, /Twitch and Kick/);
  // A "sent too soon" 403 on live chat is not the quota.
  for (const k of [...Y._mem.keys()]) if (k.startsWith("yt/q/")) Y._mem.delete(k);
  await Y.quotaState(Date.now(), { fresh: true });
  const tooSoon = async () => ({ ok: false, status: 403, json: async () => ({ error: { errors: [{ reason: "rateLimitExceeded" }] } }) });
  await assert.rejects(Y.ytApi("liveChat/messages", { liveChatId: "c" }, { deps: { fetch: tooSoon } }), (e) => !(e instanceof Y.QuotaOut));
  assert.equal((await Y.quotaState(Date.now(), { fresh: true })).out, false);
});

test("quota: live polling stops at 90% of the day, lookups keep the rest; every call is in the ledger", async () => {
  for (const k of [...Y._mem.keys()]) if (k.startsWith("yt/")) Y._mem.delete(k);
  const day = Y.pacific().day;
  const ok = async () => ({ ok: true, status: 200, json: async () => ({ items: [], pollingIntervalMillis: 5000, nextPageToken: "n1" }) });
  // One poll: 5 units in the ledger (measured: liveChatMessages.list = 5 units, refused calls too).
  await Y.quotaState(Date.now(), { fresh: true });
  const vod = { platform: "youtube", id: "yX4DH_msPkI", live: true, chat_id: "c", start_ms: Date.now() - 3600e3, title: "t", channel_name: "K" };
  const r1 = await Y.pollStream(vod, { deps: { fetch: ok } });
  assert.equal(r1.polled, true); assert.equal(r1.state.next, "n1");
  assert.equal((await Y.quotaState(Date.now(), { fresh: true })).units, Y.LIVE_UNITS);
  // A second poll inside YouTube's interval (and our one-minute floor) does not happen.
  assert.equal((await Y.pollStream(vod, { deps: { fetch: ok } })).why, "not_due");
  // Spend up to 90%: live polling stops, a lookup still runs.
  Y._mem.set(`yt/q/${day}/1_${Math.ceil(Y.DAILY * Y.LIVE_STOP)}u_test.json`, "{}");
  await Y.quotaState(Date.now(), { fresh: true });
  const r2 = await Y.pollStream(vod, { force: true, deps: { fetch: ok } });
  assert.equal(r2.polled, false); assert.equal(r2.why, "quota");
  const d = await Y.ytApi("videos", { id: "x" }, { deps: { fetch: ok } });
  assert.deepEqual(d.items, []);
});

test("cut_clip on a YouTube source answers with the watch link and the cut-from-your-copy link, never a server cut", async () => {
  const r = await callTool("cut_clip", { source: "https://www.youtube.com/watch?v=qSyo5d-dVzA", start: 30530, end: 30560 }, {});
  const d = JSON.parse(r.content[0].text);
  assert.equal(r.isError, undefined);
  assert.equal(d.cut, false); assert.equal(d.reason, "youtube_no_server_cut");
  assert.equal(d.watch, "https://www.youtube.com/watch?v=qSyo5d-dVzA&t=30530s");
  assert.match(d.cut_from_your_copy, /^https:\/\/heistclips\.com\/clip\?q=https%3A%2F%2Fwww\.youtube\.com%2Fwatch%3Fv%3DqSyo5d-dVzA&t=30530/);
  assert.match(d.message, /own copy/);
});
