import test from "node:test";
import assert from "node:assert/strict";
import { clipPath, clipMadeProps } from "../lib/track.js";

test("clip_made says which path made the clip", () => {
  assert.equal(clipPath({ layout: "split" }), "browser");
  assert.equal(clipPath({ layout: "server-fit" }), "connector");
  assert.equal(clipPath({ layout: "queue-server" }), "queue");
  assert.equal(clipPath({ layout: "server-split", via: "web" }), "browser_server");
});

test("clip_made carries the stream and the charge, and nothing about the person", () => {
  const p = clipMadeProps({ vod: "2932469290", t: 34069, layout: "server-fit", bytes: 27_000_000, channel: "zackrawrr", secs: 38, ph: "0199abcd-visitor-id" }, { charged: "free", free_left: 9, paid_left: 0, d: "device-123" });
  assert.deepEqual({ path: p.path, platform: p.platform, channel: p.channel, vod_id: p.vod_id, t_start: p.t_start, clip_secs: p.clip_secs, layout: p.layout, mb: p.mb, charged: p.charged, free_left: p.free_left },
    { path: "connector", platform: "twitch", channel: "zackrawrr", vod_id: "2932469290", t_start: 34069, clip_secs: 38, layout: "fit", mb: 27, charged: "free", free_left: 9 });
  assert.equal(JSON.stringify(p).includes("device-123"), false);
  assert.equal(JSON.stringify(p).includes("visitor-id"), false);
  assert.equal(clipMadeProps({ vod: "c2ed308d-dbd3-4d05-8cce-65f78ab8508b" }).platform, "kick");
});
