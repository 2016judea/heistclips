// The connector's cut and find rules: charge once and only for a file, a job that can be asked
// for later, the rendition each layout reads, and inputs that used to fail in 50 ms.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.HC_STORE = "memory"; // never the live store
process.env.HC_NO_ANALYTICS = "1";
process.env.TOKEN_ENC_KEY = "ab".repeat(32);
const { cutJob, saveJob, loadJob, newJobId, JOB, jobAgeMs } = await import("../lib/cutjob.js");
const { rankKickVariants, playlistUrls, TWITCH_QUALITIES, fetchTo } = await import("../lib/cut.js");
const { resolveSource } = await import("../lib/momentsource.js");
const { findClipMoments } = await import("../lib/momentstool.js");
const { TOOLS, callTool } = await import("../api/mcp.js");

const VOD = { id: "v1", platform: "twitch", length: 5000, status: "RECORDED", channel: "x", channel_name: "X", title: "t", url: "https://www.twitch.tv/videos/v1" };
function deps(over = {}) {
  const calls = { cut: 0, commit: [], events: [], saved: [] };
  return { calls,
    resolveVod: async () => over.vod || VOD,
    cutClip: async () => { calls.cut++; if (over.cutFails) throw Object.assign(new Error("ffmpeg exit 1"), { code: "ffmpeg" }); const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cj-")); const file = path.join(dir, "o.mp4"); fs.writeFileSync(file, Buffer.alloc(4096)); return { dir, file, bytes: 4096, seconds: 30, ms: 5, source_quality: "720p60", timing: { playlist_ms: 1, download_ms: 2, encode_ms: 3 } }; },
    putFile: async () => { if (over.storeFails) throw new Error("blob put 500"); return {}; },
    creditCall: over.noCredits ? async (a) => (a === "start" ? { ok: false, free_left: 0, paid_left: 0 } : { ok: false }) : undefined,
    saveJob: async (id, r) => { calls.saved.push([id, r]); return saveJob(id, r); },
    serverEvent: async (name, p) => { calls.events.push([name, p]); },
  };
}
const clean = (d) => { const o = {}; for (const k in d) if (d[k] !== undefined && k !== "calls") o[k] = d[k]; return o; };

test("a finished cut is charged once, carries its timing, and its job can be read back with the account", async () => {
  const d = deps(), job = newJobId();
  assert.match(job, JOB); assert.ok(jobAgeMs(job) < 1000);
  const r = await cutJob({ source: "v1", start: 100, end: 130, job, hook: "secret words" }, clean(d));
  assert.equal(r.ok, true); assert.equal(r.charged, true); assert.equal(r.job, job);
  assert.deepEqual(Object.keys(r.timing).sort(), ["account_ms", "commit_ms", "download_ms", "encode_ms", "playlist_ms", "resolve_ms", "upload_ms"]);
  const back = await loadJob(job);
  assert.equal(back.clip_id, r.clip_id); assert.equal(back.account, r.account); assert.equal(back.download, r.download);
  // the stored copy never holds the account code in the clear
  const raw = JSON.stringify(await (await import("../lib/store.js")).getJSON(`cutjobs/${job}.json`));
  assert.ok(raw.includes(r.clip_id) && !raw.includes(r.account));
  const [name, ev] = d.calls.events[0];
  assert.equal(name, "server_cut"); assert.equal(ev.ok, true); assert.equal(ev.clip_secs, 30); assert.equal(ev.layout, "fit"); assert.equal(ev.platform, "twitch"); assert.equal(ev.encode_ms, 3);
  assert.ok(!JSON.stringify(ev).includes("secret words") && !JSON.stringify(ev).includes(r.account), "no hook text or account in analytics");
});

test("nothing is charged when the cut fails, the store fails, or there are no clips; each failure has a code and a saved job", async () => {
  for (const [over, err] of [[{ cutFails: true }, "ffmpeg"], [{ storeFails: true }, "store"], [{ noCredits: true }, "no_credits"]]) {
    const d = deps(over), job = newJobId();
    const r = await cutJob({ source: "v1", start: 100, end: 130, job }, clean(d));
    assert.equal(r.ok, false); assert.equal(r.err, err); assert.ok(!r.charged);
    assert.equal((await loadJob(job)).err, err);
    assert.equal(d.calls.events[0][1].err, err); assert.equal(d.calls.events[0][1].charged, false);
  }
  const r = await cutJob({ source: "v1", start: 10, end: 200 }, clean(deps()));
  assert.equal(r.err, "too_long");
  // a second over the cap is cut at the cap and says so; the clip is still made and charged once
  const d61 = deps(), t61 = await cutJob({ source: "v1", start: 100, end: 161 }, clean(d61));
  assert.equal(t61.ok, true); assert.match(t61.trimmed, /first 60 seconds/); assert.equal(d61.calls.cut, 1);
  // an exception names the step it happened in, and a charge that throws does not lose the clip
  const boom = await cutJob({ source: "v1", start: 100, end: 130 }, { ...clean(deps()), resolveVod: async () => { throw new Error("gql 502"); } });
  assert.equal(boom.ok, false); assert.equal(boom.err, "crash_resolve");
  let n = 0;
  const kept = await cutJob({ source: "v1", start: 100, end: 130 }, { ...clean(deps()), creditCall: async (a) => { if (a === "start") return { ok: true, ticket: "t" }; n++; throw new Error("blob list 500"); } });
  assert.equal(kept.ok, true); assert.equal(kept.charged, false); assert.equal(n, 1); assert.ok(kept.download);
  assert.equal(await loadJob("cjnope"), null);
});

test("fit reads a 720p rendition, split and crop the largest up to 1080p", async () => {
  const vod = { cdn: { host: "d1abc", dir: "x_y_1_2" } };
  assert.equal((await playlistUrls(vod, "fit"))[0].q, "720p60");
  assert.match((await playlistUrls(vod, "fit"))[0].url, /cloudfront\.net\/x_y_1_2\/720p60\/index-dvr\.m3u8$/);
  assert.equal((await playlistUrls(vod, "crop"))[0].q, "1080p60");
  assert.ok(TWITCH_QUALITIES.fit.includes("chunked") && TWITCH_QUALITIES.split.includes("chunked"), "the source stays as a fallback");
  const v = [{ w: 2560, h: 1440, q: "a" }, { w: 1920, h: 1080, q: "b" }, { w: 1280, h: 720, q: "c" }, { w: 852, h: 480, q: "d" }];
  assert.deepEqual(rankKickVariants(v, "fit").map((x) => x.q), ["c", "b", "a", "d"]);
  assert.deepEqual(rankKickVariants(v, "crop").map((x) => x.q), ["b", "a", "c", "d"]);
  assert.deepEqual(rankKickVariants(v.slice(2), "split").map((x) => x.q), ["c", "d"]);
});

test("a segment read that fails is retried, and a refused -muted name tries the plain one", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ft-"));
  let n = 0;
  const flaky = async () => { n++; if (n < 3) throw new Error("socket hang up"); return { ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer }; };
  assert.equal(await fetchTo("https://x/1.ts", path.join(dir, "a.ts"), { fetcher: flaky }), 3);
  const seen = [];
  const muted = async (u) => { seen.push(u); return u.includes("-muted") ? { ok: false, status: 403 } : { ok: true, arrayBuffer: async () => new Uint8Array(5).buffer }; };
  assert.equal(await fetchTo("https://x/7-muted.ts", path.join(dir, "b.ts"), { fetcher: muted }), 5);
  assert.deepEqual(seen, ["https://x/7-muted.ts", "https://x/7.ts"]);
  await assert.rejects(fetchTo("https://x/9.ts", path.join(dir, "c.ts"), { fetcher: async () => ({ ok: false, status: 403 }) }));
  fs.rmSync(dir, { recursive: true, force: true });
});

test("names with spaces, typos and clip links resolve; what cannot be read says why", async () => {
  const chan = (login, vods = [VOD]) => ({ login, name: login, is_live: false, live_vod: null, vods });
  const tw = {
    getChannel: async (l) => (l === "kaicenat" ? chan("kaicenat") : l === "ishowspeed" ? chan("ishowspeed") : l === "deadacct" ? chan("deadacct", []) : null),
    searchChannels: async (t) => (/speed/.test(t) ? [{ login: "ishowspeed", followers: 5e6, live: false }] : []),
    getClip: async (s) => (s === "GoodClip" ? { vod_id: "v1", t: 321, login: "kaicenat" } : s === "OrphanClip" ? { vod_id: null, login: "kaicenat" } : null),
    getVod: async (id) => (id === "v1" ? VOD : null),
    getKickChannel: async () => null, getKickVod: async () => null,
  };
  assert.equal((await resolveSource("kai cenat", tw)).vod.id, "v1");
  const typo = await resolveSource("ischowspeed", tw);
  assert.equal(typo.ok, true); assert.match(typo.note, /ishowspeed/);
  const clip = await resolveSource("https://clips.twitch.tv/GoodClip", tw);
  assert.equal(clip.focus_t, 321); assert.equal(clip.vod.id, "v1");
  assert.match((await resolveSource("https://www.twitch.tv/x/clip/OrphanClip", tw)).note, /deleted/);
  for (const [input, err] of [["https://youtu.be/abc", "youtube"], ["gta 6", "no_name"], ["", "bad_input"], ["https://clips.twitch.tv/GoneClip", "clip_missing"], ["nobodyhere", "no_channel"], ["deadacct", "no_vods"], ["kick.com/nobody", "kick_no_channel"], ["123456789", "vod_missing"]]) {
    const r = await resolveSource(input, tw);
    assert.equal(r.ok, false, input); assert.equal(r.err, err, input); assert.ok(r.message.length > 20);
  }
});

test("find_clip_moments: an unreadable source is a helpful result, and a finished stream is read once", async () => {
  let reads = 0;
  const moment = { t_start: 100, t_end: 130, chat_ratio: 4, event_type: "funny", clip_requests: 2, phrase: { text: "LUL" }, twitch_clips: 0, twitch_clip_views: 0, music_risk: { level: "low", why: "" }, hooks: ["a"], url: "u" };
  const d = { resolveSource: async (s) => (s === "yt" ? { ok: false, err: "youtube", message: "YouTube streams cannot be read yet.", suggest_live: true } : { ok: true, vod: { ...VOD, id: "cache-" + s }, note: "" }),
    liveGtaStreams: async () => [{ login: "a", name: "A", viewers: 5, game: "GTA" }], findMoments: async () => { reads++; return { moments: [structuredClone(moment)] }; } };
  const bad = await findClipMoments({ source: "yt" }, { deps: d });
  assert.equal(bad.out.found, false); assert.equal(bad.out.reason, "youtube"); assert.equal(bad.out.live_now[0].source, "a"); assert.equal(bad.log.err, "youtube");
  const a = await findClipMoments({ source: "one", limit: 5 }, { deps: d });
  const b = await findClipMoments({ source: "one", limit: 5 }, { deps: d });
  assert.equal(reads, 1); assert.equal(a.log.cache, "miss"); assert.notEqual(b.log.cache, "miss");
  assert.deepEqual(b.out.moments, a.out.moments); assert.equal(a.out.moments[0].t_start_s, 100);
  assert.ok(!JSON.stringify(a.log).includes("LUL"), "no chat text in analytics");
  await findClipMoments({ source: "one", limit: 12 }, { deps: d }); // more moments than were kept: read again
  assert.equal(reads, 2);
});

test("cut_clip_status is listed, read-only, and refuses anything that is not a job code", async () => {
  const t = TOOLS.find((x) => x.name === "cut_clip_status");
  assert.deepEqual(t.inputSchema.required, ["job"]); assert.equal(t.annotations.readOnlyHint, true);
  assert.match(TOOLS.find((x) => x.name === "cut_clip").description, /cut_clip_status/);
  const r = await callTool("cut_clip_status", { job: "https://example.com" });
  assert.equal(r.isError, true); assert.equal(r.log.err, "bad_job");
  assert.ok(!("log" in JSON.parse(JSON.stringify(r))), "analytics fields never reach the client");
});
