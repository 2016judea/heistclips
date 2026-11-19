// The server cut of a queue item charges one clip exactly once, and never on a failure.
// Storage is the in-process store (HC_STORE=memory): nothing here touches the live store.
process.env.HC_STORE = "memory";
process.env.HC_NO_ANALYTICS = "1";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const W = await import("../lib/watch.js");
const { putJSON } = await import("../lib/store.js");
const { queueCut } = await import("../lib/queuecut.js");
const { queueTool } = await import("../lib/queuetool.js");
const { TOOLS } = await import("../api/mcp.js");

async function seed() {
  const w = W.newWatch("dev1");
  w.channels = ["twitch:teststreamer"];
  await W.saveWatch(w);
  await putJSON(W.chanPath("twitch:teststreamer"), { key: "twitch:teststreamer", login: "teststreamer", name: "TestStreamer", moments: [
    { id: "v9_100", vod_id: "v9", t_start: 100, t_end: 138, t_peak: 124, chat_ratio: 4, hooks: ["Wait for it…"], music_risk: { level: "low" }, game: "Grand Theft Auto VI", found_at: new Date().toISOString(), score: 9, platform: "twitch" }] });
  return w;
}

function deps(over = {}) {
  const calls = { start: 0, commit: [], cut: 0, stored: 0 };
  return { calls,
    creditCall: async (action, rec, extra) => { if (action === "start") { calls.start++; return over.noCredits ? { ok: false, need: "buy", free_left: 0, paid_left: 0 } : { ok: true, ticket: "t1", free_left: 3, paid_left: 0 }; } calls.commit.push({ rec, extra }); return { ok: true, free_left: 2, paid_left: 0 }; },
    getVod: async (id) => ({ id, channel: "teststreamer", channel_name: "TestStreamer", cdn: { host: "x", dir: "y" }, length: 9000 }),
    cutClip: async (vod, o) => { calls.cut++; calls.cutArgs = o; if (over.cutFails) throw new Error("ffmpeg exit 1"); const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qc-")); const file = path.join(dir, "o.mp4"); fs.writeFileSync(file, Buffer.alloc(2048)); return { file, dir, bytes: 2048, seconds: 38, ms: 5 }; },
    putFile: async () => { calls.stored++; if (over.storeFails) throw new Error("blob 500"); return {}; },
    listPaths: async () => new Array(over.cutsToday || 0).fill("x"),
  };
}

test("a finished server cut charges one clip, once, to this browser, and the queue keeps the file", async () => {
  const w = await seed(); const d = deps();
  const r = await queueCut({ k: w.k, d: "dev1", ch: "twitch:teststreamer", moment: "v9_100" }, d);
  assert.equal(r.ok, true);
  assert.match(r.download, /clips\/[0-9a-f]{40}\.mp4$/);
  assert.equal(d.calls.start, 1);
  assert.equal(d.calls.commit.length, 1);
  assert.deepEqual(d.calls.commit[0].rec, { d: "dev1", k: "" });
  assert.equal(d.calls.commit[0].extra.ticket, "t1");
  assert.equal(d.calls.commit[0].extra.bytes, 2048);
  assert.deepEqual([d.calls.cutArgs.start, d.calls.cutArgs.end, d.calls.cutArgs.hook], [100, 138, "Wait for it…"], "the window comes from the stored moment");
  const after = await W.loadWatch(w.k);
  assert.equal(after.items.v9_100.s, "exported");
  assert.equal(after.items.v9_100.file, r.download);
});

test("no charge when the cut fails, the file cannot be stored, or there are no clips left", async () => {
  const w = await seed();
  let d = deps({ cutFails: true });
  let r = await queueCut({ k: w.k, d: "dev1", ch: "twitch:teststreamer", moment: "v9_100" }, d);
  assert.equal(r.ok, false); assert.match(r.error, /Nothing was charged/); assert.equal(d.calls.commit.length, 0);
  d = deps({ storeFails: true });
  r = await queueCut({ k: w.k, d: "dev1", ch: "twitch:teststreamer", moment: "v9_100" }, d);
  assert.equal(r.ok, false); assert.equal(d.calls.commit.length, 0);
  d = deps({ noCredits: true });
  r = await queueCut({ k: w.k, d: "dev1", ch: "twitch:teststreamer", moment: "v9_100" }, d);
  assert.equal(r.need, "buy"); assert.equal(d.calls.cut, 0); assert.equal(d.calls.commit.length, 0);
});

test("only a clip from this queue's own watchlist can be cut, and the daily ceiling holds", async () => {
  const w = await seed();
  for (const args of [{ k: "A".repeat(24), ch: "twitch:teststreamer", moment: "v9_100" }, { k: w.k, ch: "twitch:someoneelse", moment: "v9_100" }, { k: w.k, ch: "twitch:teststreamer", moment: "v9_999" }]) {
    const d = deps(); const r = await queueCut({ d: "dev1", ...args }, d);
    assert.equal(r.ok, false); assert.equal(d.calls.start, 0); assert.equal(d.calls.cut, 0);
  }
  const d = deps({ cutsToday: 600 });
  const r = await queueCut({ k: w.k, d: "dev1", ch: "twitch:teststreamer", moment: "v9_100" }, d);
  assert.equal(r.busy, true); assert.equal(d.calls.start, 0);
});

test("connector: my_clip_queue reads a queue by its private link, with src=mcp links and cut_clip values", async () => {
  const w = await seed();
  const none = await queueTool("my_clip_queue", {});
  assert.equal(none.ok, false); assert.match(none.error, /watch_streamer/);
  assert.equal((await queueTool("my_clip_queue", { queue_link: "https://example.com/nope" })).ok, false);
  assert.equal((await queueTool("my_clip_queue", { account: "hc_" + "x".repeat(32) })).ok, false);
  const q = await queueTool("my_clip_queue", { queue_link: `https://heistclips.com/queue?k=${w.k}` });
  assert.equal(q.ok, true);
  assert.equal(q.ready_clips.length, 1);
  const c = q.ready_clips[0];
  assert.deepEqual(c.cut_with, { source: "https://www.twitch.tv/videos/v9", start: 100, end: 138, hook: "Wait for it…" });
  assert.match(c.open_in_editor, /src=mcp/); assert.match(q.queue, /src=mcp/);
  assert.match(c.no_campaign_why, /no live campaign names TestStreamer/);
  const names = TOOLS.map((t) => t.name);
  assert.ok(names.includes("my_clip_queue") && names.includes("watch_streamer"));
});

test("a test cut from the queue carries the mark to the charge; a customer's cut carries none (lib/marks.js)", async () => {
  const w = await seed();
  let d = deps();
  await queueCut({ k: w.k, d: "dev1", ch: "twitch:teststreamer", moment: "v9_100", qa: true }, d);
  assert.equal(d.calls.commit[0].extra.meta.qa, true);
  d = deps();
  await queueCut({ k: w.k, d: "dev1", ch: "twitch:teststreamer", moment: "v9_100" }, d);
  assert.equal("qa" in d.calls.commit[0].extra.meta, false);
  assert.deepEqual([d.calls.commit[0].extra.meta.channel, d.calls.commit[0].extra.meta.platform, d.calls.commit[0].extra.meta.secs > 0], ["teststreamer", "twitch", true], "clip_made gets the stream and the length");
});
