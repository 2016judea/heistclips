import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fixMutedPlaylist, runEnd } from "../public/js/render.js";
import { pickSegments } from "../lib/cut.js";

// zackrawrr 2932469290 (2026-11-19): a window that ran into a stretch Twitch had muted sat on
// "Loading the video… 21%". The playlist names those segments "-unmuted.ts", which the CDN refuses.
test("a muted Twitch segment is asked for by the name the CDN serves", () => {
  const list = "#EXTM3U\n#EXTINF:10.000,\n701.ts\n#EXTINF:10.000,\n702-unmuted.ts\n#EXTINF:10.000,\n703-unmuted.ts\n#EXTINF:10.000,\n704.ts\n";
  const fixed = fixMutedPlaylist(list);
  assert.equal(fixed.includes("-unmuted.ts"), false);
  assert.deepEqual(fixed.split("\n").filter((l) => l.endsWith(".ts")), ["701.ts", "702-muted.ts", "703-muted.ts", "704.ts"]);
  // the server cut reads the same list the same way
  assert.deepEqual(pickSegments(list, "https://x.cloudfront.net/d/chunked/index-dvr.m3u8", 12, 28).segs.map((s) => s.url.split("/").pop()), ["702-muted.ts", "703-muted.ts"]);
});

test("the renderer's playlist loader applies the muted-segment fix", () => {
  const src = fs.readFileSync(new URL("../public/js/render.js", import.meta.url), "utf8");
  assert.match(src, /pLoader: PlaylistLoader/);
  assert.match(src, /resp\.data = fixMutedPlaylist\(resp\.data\)/);
});

test("buffered progress follows the run that holds the playhead", () => {
  assert.equal(runEnd([[100, 130]], 103), 130);
  // a run left behind by an earlier seek is not the progress of this one
  assert.equal(runEnd([[100, 200], [4990, 5050]], 5000), 5050);
  // a hole hls.js hops in playback does not end the run; a real gap does
  assert.equal(runEnd([[100, 110], [110.2, 140]], 103), 140);
  assert.equal(runEnd([[100, 110], [118, 140]], 103), 110);
  // nothing buffered at the playhead yet
  assert.equal(runEnd([], 50), 50);
  assert.equal(runEnd([[60, 70]], 50), 50);
});

test("no wait in the renderer has a silent time limit, and every wait can be cancelled", () => {
  const src = fs.readFileSync(new URL("../public/js/render.js", import.meta.url), "utf8");
  assert.equal(/Date\.now\(\) - t0 < 120000/.test(src), false, "the 120 s give-up-and-record-anyway is gone");
  assert.equal(/maxBufferSize\s*=/.test(src), false, "the byte cap is not touched");
  const loop = src.slice(src.indexOf("while (!this.bufferedTo(end))"), src.indexOf("captureStream"));
  assert.match(loop, /this\.checkCancel\(\)/);
  assert.match(loop, /throw new Error/);
});
