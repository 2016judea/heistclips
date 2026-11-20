// Designed outcomes are answers, not failures (2026-11-19, the Claude directory's stats page
// counted find_moments' "no saved stream" replies as 13.5% tool errors). They come back without
// isError and with a next step; genuine failures keep isError and the report_a_bug hint; every
// one keeps its `err` code for our own analytics.
import test from "node:test";
import assert from "node:assert/strict";

process.env.HC_STORE = "memory"; // never the live store
process.env.HC_NO_ANALYTICS = "1";
process.env.TOKEN_ENC_KEY = "ab".repeat(32);
const { findClipMoments, sourceNext } = await import("../lib/momentstool.js");
const { saveJob, newJobId } = await import("../lib/cutjob.js");
const { putJSON } = await import("../lib/store.js");
const { TOOLS, callTool, withBugHint, ANSWERS } = await import("../api/mcp.js");

const live = async () => [{ login: "kaicenat", name: "KaiCenat", viewers: 9, game: "GTA" }, { login: "other", name: "Other", viewers: 5, game: "GTA" }];

test("a live stream Twitch is not saving: an answer that offers watch_streamer for that streamer, and live_now leaves them out", async () => {
  const d = { resolveSource: async () => ({ ok: false, err: "live_no_vod", message: "KaiCenat is live, but Twitch is not saving this stream.", suggest_live: true, exclude: "kaicenat" }), liveGtaStreams: live };
  const r = await findClipMoments({ source: "kaicenat" }, { deps: d });
  assert.equal(r.out.found, false); assert.equal(r.log.err, "live_no_vod");
  assert.match(r.out.next, /watch_streamer/); assert.match(r.out.next, /"kaicenat"/);
  assert.deepEqual(r.out.live_now.map((x) => x.source), ["other"]);
});

test("every source outcome that is not a typo has its own next step; a typo asks which one they meant", async () => {
  for (const err of ["live_no_vod", "no_vods", "kick_no_vod", "youtube", "no_channel", "kick_no_channel", "kickvod_missing", "vod_missing", "clip_missing", "clip_no_vod", "no_name"]) {
    assert.ok(ANSWERS.has(err), err); assert.ok((sourceNext(err) || "").length > 30, err);
  }
  assert.match(sourceNext("youtube"), /request_a_feature/);
  const d = { resolveSource: async () => ({ ok: false, err: "no_vods", message: "x has no saved streams.", did_you_mean: ["ishowspeed"] }), liveGtaStreams: live };
  const r = await findClipMoments({ source: "ischowsped" }, { deps: d });
  assert.deepEqual(r.out.did_you_mean, ["ishowspeed"]); assert.match(r.out.next, /which of did_you_mean/);
  assert.equal("live_now" in r.out, false);
});

test("a cut refused for its window is an answer with the fix; a cut that broke stays an error with the bug hint", async () => {
  const long = newJobId();
  await saveJob(long, { ok: false, err: "too_long", error: "A clip can be at most 60 seconds; this window is 300. Pass a shorter window.", platform: "twitch" });
  const a = await callTool("cut_clip_status", { job: long });
  assert.equal(a.isError, false); assert.equal(a.log.err, "too_long");
  assert.match(a.structuredContent.next, /60 seconds or less/);
  const unsaved = newJobId();
  await saveJob(unsaved, { ok: false, err: "live_no_vod", error: "X is live, but Twitch is not saving this stream.", platform: "twitch" });
  const u = await callTool("cut_clip_status", { job: unsaved });
  assert.equal(u.isError, false); assert.match(u.structuredContent.next, /watch_streamer/);
  const broke = newJobId();
  await saveJob(broke, { ok: false, err: "ffmpeg", error: "Cut failed: ffmpeg exit 1. Nothing was charged.", platform: "twitch" });
  const b = withBugHint(await callTool("cut_clip_status", { job: broke }), "cut_clip_status", { job: broke });
  assert.equal(b.isError, true); assert.equal(b.log.err, "ffmpeg"); assert.ok(b.structuredContent.report_a_bug);
});

test("clipping_campaign_details: a title finds the campaign; an ended one is an answer pointing at the live list", async () => {
  await putJSON("snapshot/latest.json", { generated_at: "2026-11-19T00:00:00Z", campaigns: [{ id: "afeca1a0-1111", slug: "tokyo-girl-afeca1a0", title: "Tokyo Girl x GTA Clipping", budget_left: 100 }] });
  const hit = await callTool("clipping_campaign_details", { campaign: "Tokyo Girl" });
  assert.equal(hit.isError, undefined); assert.equal(hit.structuredContent.slug, "tokyo-girl-afeca1a0");
  const miss = await callTool("clipping_campaign_details", { campaign: "a campaign that ended" });
  assert.equal(miss.isError, undefined); assert.equal(miss.structuredContent.found, false); assert.equal(miss.log.err, "no_campaign");
  assert.match(miss.structuredContent.next, /rank_clipping_campaigns/);
});

test("watch_streamer and my_clip_queue failures carry a code; a mistyped name is an answer, a bad link an error", async () => {
  const q = await callTool("my_clip_queue", {});
  assert.equal(q.isError, false); assert.equal(q.log.err, "no_queue");
  const bad = await callTool("watch_streamer", { streamer: "kaicenat", queue_link: "https://example.com/nope" });
  assert.equal(bad.isError, true); assert.equal(bad.log.err, "bad_queue_link");
  assert.equal(withBugHint(bad, "watch_streamer", {}).structuredContent.report_a_bug, undefined, "a caller mistake is not offered as a bug");
});

test("annotations: a tool that makes a new account when called without one is not idempotent", () => {
  for (const n of ["posting_account", "watch_streamer", "cut_clip", "post_clip"]) assert.equal(TOOLS.find((t) => t.name === n).annotations.idempotentHint, false, n);
  for (const n of ["cut_clip", "post_clip"]) assert.equal(TOOLS.find((t) => t.name === n).annotations.readOnlyHint, false, n);
});
