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

// Board item rmwp8atut (2026-11-20) was "clip ishwspped gta 6": an ask for a streamer's clips,
// misspelled. It goes to /clip as IShowSpeed; real requests that mention clips or GTA still file.
test("a sentence asking for a streamer's clips goes to /clip, typos included", async () => {
  const { streamCheck, askedName, nearName } = await import("../lib/requests.js");
  const chan = (login, name, vods = [{}]) => ({ login, name, is_live: false, vods });
  const deps = {
    getChannel: async (l) => (l === "ishowspeed" ? chan("ishowspeed", "IShowSpeed") : l === "kaicenat" ? chan("kaicenat", "KaiCenat") : l === "youtube" ? chan("youtube", "YouTube") : l === "tinyguy" ? chan("tinyguy", "tinyguy") : null),
    searchChannels: async (t) => (/^ishwspped$|^ishowspeed$|speed/.test(t) ? [{ login: "ishowspeed", followers: 5e6, live: true }]
      : /kai/.test(t) ? [{ login: "kaicenat", followers: 1e7, live: false }]
      : /youtube/.test(t) ? [{ login: "youtube", followers: 2e6, live: false }]
      : /tiny/.test(t) ? [{ login: "tinyguy", followers: 40, live: false }]
      : /spoiler/.test(t) ? [{ login: "spoilerking", followers: 50000, live: true }] : []),
  };
  assert.deepEqual(await streamCheck("clip ishwspped gta 6", "", deps), { kind: "Twitch channel", q: "ishowspeed", name: "IShowSpeed" });
  assert.equal((await streamCheck("ishowspeed gta 6 clips", "", deps)).q, "ishowspeed");
  assert.equal((await streamCheck("kai cenat gta 6", "", deps)).q, "kaicenat");
  assert.equal((await streamCheck("xqc", "", { getChannel: async () => chan("xqc", "xQc"), searchChannels: async () => [] })).q, "xqc");
  // Real requests, including ones already on the board, are not streams.
  for (const t of ["Clip YouTube streams", "Spoiler filter", "clip spoiler filter", "Post clip directly to TikTok/YouTube from the connector", "Facecam-over-gameplay vertical layout", "clip with captions", "gta 6 clips"])
    assert.equal(await streamCheck(t, "", deps), null, t);
  assert.equal(await streamCheck("clip tinyguy gta 6", "", deps), null, "a 40-follower channel is not who they meant");
  assert.equal(await streamCheck("clip ishwspped gta 6", "with subtitles please", deps), null, "a detail line means they wrote a request");
  assert.equal(askedName("clip ishwspped gta 6").key, "ishwspped");
  assert.equal(askedName("ishwspped"), null);
  assert.equal(nearName("ishwspped", "ishowspeed"), true);
  assert.equal(nearName("xqc", "xqcow"), false);
  assert.equal(nearName("kaicenat", "kaicenat"), true);
  assert.equal(nearName("spoiler", "spoilerking"), false);
});
