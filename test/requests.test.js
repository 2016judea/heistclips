import test from "node:test";
import assert from "node:assert/strict";
import { streamLike, publicList } from "../lib/requests.js";
import { closeOut } from "../lib/render.js";

// Board item rmwmod40d was the VOD id "2932305259": people mistake the request box for search.
test("a stream pasted into the request box is recognised, a request is not", () => {
  assert.deepEqual(streamLike("2932305259"), { kind: "Twitch VOD", q: "2932305259" });
  assert.equal(streamLike("https://www.twitch.tv/videos/2932305259?t=1h2m").q, "2932305259");
  assert.equal(streamLike("twitch.tv/xqc").q, "xqc");
  assert.equal(streamLike("https://kick.com/xqc").q, "kick.com/xqc");
  assert.equal(streamLike("kick.com/xqc/videos/0a1b2c3d-1111-2222-3333-444455556666").q, "https://kick.com/video/0a1b2c3d-1111-2222-3333-444455556666");
  assert.equal(streamLike("0a1b2c3d-1111-2222-3333-444455556666").kind, "Kick VOD");
  for (const t of ["Spoiler filter", "Post clip directly to TikTok/YouTube from the connector", "Bessere Qualität", "sound mp4", "1080p60 export", "2026"]) assert.equal(streamLike(t), null, t);
});

test("board items carry response and shipped_at, and the page shows them", () => {
  const b = { items: [{ id: "x1", title: "Spoiler filter", detail: "", status: "shipped", by: "clipper", votes: 2, voters: ["a", "b"], created_at: "2026-11-16T00:00:00Z", response: "Toggle on /clip.", shipped_at: "2026-11-19T20:00:00Z" },
    { id: "x2", title: "Captions", detail: "", status: "requested", by: "clipper", votes: 1, voters: ["a"], created_at: "2026-11-17T00:00:00Z" }] };
  const [a, c] = publicList(b);
  assert.equal(a.response, "Toggle on /clip."); assert.equal(a.shipped_at, "2026-11-19T20:00:00Z");
  assert.equal(c.response, null); assert.equal(c.shipped_at, null);
  assert.match(closeOut(a), /Shipped Nov 19<\/b> — Toggle on \/clip\./);
  assert.equal(closeOut(c), "");
  assert.match(closeOut({ status: "building", response: "On it" }), /<b>Building<\/b> — On it/);
});
