import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRecordingStart } from "../public/js/live.js";

// Headers as Twitch served them on 2026-11-19 (kaicenat: v3 with PROGRAM-DATE-TIME; illojuan: v6 without).
const V3 = `#EXTM3U\n#EXT-X-VERSION:3\n#ID3-EQUIV-TDTG:2026-11-20T00:29:13\n#EXT-X-TWITCH-TOTAL-SECS:127760.000\n#EXT-X-PROGRAM-DATE-TIME:2026-11-18T12:59:53.334Z\n#EXTINF:10.000,\n0.ts\n`;
const V6 = `#EXTM3U\n#EXT-X-VERSION:6\n#ID3-EQUIV-TDTG:2026-11-20T00:29:06\n#EXT-X-PLAYLIST-TYPE:EVENT\n#EXT-X-TWITCH-TOTAL-SECS:31710.000\n#EXTINF:10.000,\n0.ts\n`;

test("PROGRAM-DATE-TIME wins when the playlist has it", () => {
  assert.equal(parseRecordingStart(V3).start, Date.parse("2026-11-18T12:59:53.334Z"));
});
test("no PROGRAM-DATE-TIME: playlist clock minus total seconds (illojuan, live, 2026-11-19)", () => {
  const { start } = parseRecordingStart(V6);
  // Twitch says the stream started 15:40:33Z; the playlist arithmetic gives 15:40:36Z.
  assert.ok(Math.abs(start - Date.parse("2026-11-19T15:40:33Z")) < 10_000, new Date(start).toISOString());
});
test("the two methods agree where both exist", () => {
  const noPdt = V3.replace(/#EXT-X-PROGRAM-DATE-TIME:.*\n/, "");
  assert.ok(Math.abs(parseRecordingStart(noPdt).start - parseRecordingStart(V3).start) < 2000);
});
test("nothing in the playlist: the VOD's createdAt", () => {
  assert.equal(parseRecordingStart("#EXTM3U\n", "2026-11-19T15:40:33Z").start, Date.parse("2026-11-19T15:40:33Z"));
  assert.equal(parseRecordingStart("#EXTM3U\n").start, null);
});
