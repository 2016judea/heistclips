import test from "node:test";
import assert from "node:assert/strict";
import { TOOLS, ALIASES, tag, INSTRUCTIONS } from "../api/mcp.js";

// OpenAI rejected a past plugin for any annotation left null; every hint must be a boolean.
test("every tool sets readOnly, destructive and openWorld hints explicitly", () => {
  for (const t of TOOLS) for (const k of ["readOnlyHint", "destructiveHint", "openWorldHint", "idempotentHint"]) assert.equal(typeof t.annotations[k], "boolean", `${t.name}.${k}`);
});

test("only the board tools write, and none is destructive", () => {
  const writers = TOOLS.filter((t) => !t.annotations.readOnlyHint).map((t) => t.name).sort();
  assert.deepEqual(writers, ["request_a_feature", "upvote_feature_request"]);
  assert.ok(TOOLS.every((t) => t.annotations.destructiveHint === false));
});

test("old tool names still resolve to a listed tool", () => {
  const names = TOOLS.map((t) => t.name);
  for (const [old, now] of Object.entries(ALIASES)) { assert.ok(names.includes(now), now); assert.ok(!names.includes(old), old); }
});

test("heistclips links get src=mcp once, before any hash; other links are left alone", () => {
  assert.equal(tag("https://heistclips.com/clip?q=123&t=5"), "https://heistclips.com/clip?q=123&t=5&src=mcp");
  assert.equal(tag("https://heistclips.com/requests#s07"), "https://heistclips.com/requests?src=mcp#s07");
  assert.equal(tag(tag("https://heistclips.com/requests")), "https://heistclips.com/requests?src=mcp");
  assert.equal(tag("https://www.twitch.tv/videos/1?t=1h"), "https://www.twitch.tv/videos/1?t=1h");
});

test("descriptions carry the words clippers search for", () => {
  const all = (INSTRUCTIONS + " " + TOOLS.map((t) => t.title + " " + t.description).join(" ")).toLowerCase();
  for (const w of ["clip", "highlights", "twitch", "kick", "vod", "live", "shorts", "tiktok", "reels", "campaign", "per 1k views", "any language"]) assert.ok(all.includes(w), w);
  assert.ok(!/rockstar/i.test(all));
});
