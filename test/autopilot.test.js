import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { paysFor, lengthRule, matchOne, rankMatches, generalFits, isGeneralGta, buildQueue, caption } from "../lib/autopilot.js";
import { plan, MAX_CHANNELS_PER_RUN, MAX_KICK_PER_RUN } from "../api/autopilot.js";
import { parseChannelInput, validKey, newKey, validEmail, emailToken } from "../lib/watch.js";
import { queuePage } from "../lib/queuepage.js";

const camp = (o) => ({ id: "c-" + (o.title || "x").length + "-" + Math.random().toString(36).slice(2, 8), slug: "s", title: "", description: "", categories: [], requirements: [], platforms: ["tiktok"], budget_left: 1000, expected_per_clip: 1, rate_per_1k: 1, cap_per_clip: 100, is_gta: false, ...o });
const kai = { platform: "twitch", login: "kaicenat", name: "KaiCenat" };
const moment = (o) => ({ id: "v1_100", vod_id: "v1", t_start: 100, t_end: 138, t_peak: 124, chat_ratio: 4, event_type: "funny", clip_requests: 0, hooks: ["Wait for it…"], music_risk: { level: "low" }, game: "Grand Theft Auto VI", found_at: "2026-11-19T12:00:00Z", score: 40, ...o });

test("a campaign pays for a streamer by channel link or by name in its title", () => {
  assert.equal(paysFor(camp({ description: "Content to clip: https://www.twitch.tv/laurenhamdenn" }), { platform: "twitch", login: "laurenhamdenn" }), "handle");
  assert.equal(paysFor(camp({ description: "see twitch.tv/laurenhamdennfan" }), { platform: "twitch", login: "laurenhamdenn" }), null);
  assert.equal(paysFor(camp({ title: "Kai Cenat - $10,000 GTA 6 Pool Campaign" }), kai), "name");
  assert.equal(paysFor(camp({ title: "$5,000 Clix GTA VI Marathon Pool Campaign" }), { platform: "twitch", login: "clix", name: "Clix" }), "name");
  assert.equal(paysFor(camp({ title: "$25,000 Lacy 30 Day Campaign", categories: ["Streamer"] }), { platform: "twitch", login: "lacy", name: "Lacy" }), "name");
  assert.equal(paysFor(camp({ title: "N3on R3born x ClipFarm Ep 2." }), { platform: "kick", login: "n3on", name: "N3on" }), "name");
});

test("a short name that is someone else's first name is not a match (the 'harry' false tie)", () => {
  const harry = { platform: "kick", login: "harry", name: "Harry" };
  assert.equal(paysFor(camp({ title: "Harry Jowsey x Joe Gorga - Boyfriend Material", categories: ["Entertainment"] }), harry), null);
  assert.equal(paysFor(camp({ title: "Harry Jowsey x Joe Gorga - Boyfriend Material", categories: ["Streamer"] }), harry), null);
  assert.equal(paysFor(camp({ title: "Clipping Campaign for the best gaming clips" }), { platform: "twitch", login: "gaming", name: "Gaming" }), null);
  assert.equal(paysFor(camp({ title: "Lacy Peterson skincare", categories: ["Beauty"] }), { platform: "twitch", login: "lacy", name: "Lacy" }), null);
});

test("length rules are read only when they are unambiguous", () => {
  assert.deepEqual(lengthRule("Clips must be 15-60 seconds"), { min: 15, max: 60 });
  assert.deepEqual(lengthRule("under 60s please"), { min: 0, max: 60 });
  assert.deepEqual(lengthRule("at least 20 sec"), { min: 20, max: 600 });
  assert.equal(lengthRule("make it short and punchy"), null);
});

test("a GTA campaign does not fit a moment from another game, and unread rules become to-dos", () => {
  const c = camp({ title: "Kai Cenat - $10,000 GTA 6 Pool Campaign", description: "Clips 15-30 seconds. No music.", requirements: ["length rule", "audio rule"], approval_required: true });
  const ok = matchOne(moment({ t_end: 125 }), kai, c);
  assert.equal(ok.fits, true);
  assert.ok(ok.checks.includes("GTA stream"));
  assert.ok(ok.checks.some((x) => /25 s fits 15–30 s/.test(x)));
  assert.ok(ok.todo.includes("apply first") && ok.todo.includes("audio rule in the brief"));
  const long = matchOne(moment(), kai, c);
  assert.ok(long.todo.some((x) => /trim to 15–30 s/.test(x)));
  const jc = matchOne(moment({ game: "Just Chatting" }), kai, c);
  assert.equal(jc.fits, false);
  assert.equal(matchOne(moment(), kai, camp({ title: "Clix Pool" })), null, "a campaign for another streamer is no match");
  assert.equal(matchOne(moment(), kai, { ...c, budget_left: 0 }), null, "no budget, no match");
});

test("matches rank by fit, then typical pay per clip", () => {
  const r = rankMatches([{ fits: true, expected_per_clip: 1, budget_left: 1 }, { fits: false, expected_per_clip: 50, budget_left: 1 }, { fits: true, expected_per_clip: 6, budget_left: 1 }, { fits: true, expected_per_clip: null, cap_per_clip: 300, rate_per_1k: 1, budget_left: 1 }]);
  assert.deepEqual(r.map((x) => x.expected_per_clip), [6, 1, null, 50]);
});

test("general-fit campaigns are sound campaigns over GTA clips, never a streamer's own campaign", () => {
  const sound = camp({ title: "8lanco Sound Campaign", is_gta: true, description: "Make GTA VI edits. Official sound at 100% volume.", expected_per_clip: null, cap_per_clip: 200 });
  const streamer = camp({ title: "Boeshi GTA 6 Clipping", is_gta: true, description: "Clip Boeshi's funniest GTA 6 Twitch moments. twitch.tv/darealboeshi" });
  const story = camp({ title: "Gaming Storytelling", is_gta: true, description: "storytelling videos using gameplay footage" });
  assert.equal(isGeneralGta(sound), true);
  assert.equal(isGeneralGta(streamer), false);
  assert.equal(isGeneralGta(story), false);
  const g = generalFits(moment(), [sound, streamer, story]);
  assert.equal(g.length, 1);
  assert.equal(g[0].general, true);
  assert.ok(g[0].todo.includes("add their official sound to the clip"));
  assert.deepEqual(generalFits(moment({ game: "Just Chatting" }), [sound]), [], "only GTA gameplay gets a general fit");
});

test("the queue: paid clips first, skipped ones gone, no-campaign clips still shown with a general fit", () => {
  const kaiCamp = camp({ id: "kc", title: "Kai Cenat - $10,000 GTA 6 Pool Campaign", expected_per_clip: 3 });
  const sound = camp({ id: "snd", title: "Sound Campaign", is_gta: true, description: "Official sound over GTA 6 clips", expected_per_clip: 2 });
  const chans = [
    { key: "twitch:kaicenat", name: "KaiCenat", moments: [moment({ id: "a" }), moment({ id: "b", found_at: "2026-11-19T13:00:00Z" })] },
    { key: "twitch:caseoh_", name: "caseoh_", moments: [moment({ id: "c", found_at: "2026-11-19T14:00:00Z" }), moment({ id: "d", game: "Just Chatting" })] },
  ];
  const q = buildQueue({ campaigns: [], items: { a: { s: "skipped", at: "x" } } }, chans, [kaiCamp, sound]);
  assert.deepEqual(q.items.map((i) => i.id), ["b", "c", "d"]);
  assert.equal(q.done, 1);
  assert.equal(q.items[0].match.campaign_id, "kc");
  assert.equal(q.items[1].match, null);
  assert.equal(q.items[1].general[0].campaign_id, "snd");
  assert.match(q.items[1].no_match_why, /no live campaign names caseoh_/);
  assert.deepEqual(q.items[2].general, [], "a Just Chatting moment gets no GTA general fit");
  // A clipper who picked only some campaigns is told when an unpicked one pays more.
  const other = camp({ id: "k2", title: "KaiCenat x Brand", expected_per_clip: 9 });
  const q2 = buildQueue({ campaigns: ["kc"], items: {} }, [chans[0]], [kaiCamp, other]);
  assert.equal(q2.items[0].match.campaign_id, "kc");
  assert.equal(q2.items[0].better.campaign_id, "k2");
});

test("captions carry the hook and derived tags only", () => {
  assert.equal(caption(moment(), kai, null), "Wait for it… #kaicenat #gta6 #gtavi #clips #fyp");
});

test("THE CAP: a run reads at most 25 channels, 2 of them Kick; never-read first, then live, then stalest", () => {
  const now = Date.parse("2026-11-19T12:00:00Z");
  const iso = (minAgo) => new Date(now - minAgo * 60000).toISOString();
  const chans = [], state = {};
  for (let i = 0; i < 40; i++) { chans.push("twitch:t" + i); state["twitch:t" + i] = { scanned_at: iso(20 + i) }; }
  for (let i = 0; i < 5; i++) { chans.push("kick:k" + i); state["kick:k" + i] = { scanned_at: iso(500) }; }
  chans.push("twitch:new"); // never read
  state["twitch:live"] = { scanned_at: iso(11), is_live: true }; chans.push("twitch:live");
  state["twitch:fresh"] = { scanned_at: iso(3) }; chans.push("twitch:fresh");
  const p = plan(chans, state, now);
  assert.equal(p.length, MAX_CHANNELS_PER_RUN);
  assert.equal(p.filter((k) => k.startsWith("kick:")).length, MAX_KICK_PER_RUN);
  assert.equal(p[0], "twitch:new");
  assert.equal(p[1], "twitch:live");
  assert.ok(!p.includes("twitch:fresh"), "a channel read 3 minutes ago is not re-read");
  assert.equal(p[p.length - 1], "twitch:t" + (40 - 1 - (MAX_CHANNELS_PER_RUN - 2 - MAX_KICK_PER_RUN) + 1), "stalest Twitch channels fill the rest");
});

test("channel input and queue keys", () => {
  assert.equal(parseChannelInput("KaiCenat"), "twitch:kaicenat");
  assert.equal(parseChannelInput("https://www.twitch.tv/lacy/"), "twitch:lacy");
  assert.equal(parseChannelInput("kick.com/xQc"), "kick:xqc");
  assert.equal(parseChannelInput("https://youtube.com/@tomo"), null);
  assert.equal(parseChannelInput("twitch.tv/videos/123"), null);
  assert.ok(validKey(newKey()));
  assert.equal(validKey("../../etc"), false);
  assert.ok(validEmail("a@b.co") && !validEmail("a@b") && !validEmail("a b@c.com, d@e.com"));
  assert.notEqual(emailToken("k1", "a@b.co"), emailToken("k2", "a@b.co"));
});

test("/queue ships with Vercel analytics and PostHog, and the cron is scheduled", () => {
  const html = queuePage();
  assert.match(html, /\/_vercel\/insights\/script\.js/);
  assert.match(html, /bm-posthog:begin/);
  assert.match(html, /\/js\/queue\.js/);
  const v = JSON.parse(fs.readFileSync(new URL("../vercel.json", import.meta.url)));
  assert.ok(v.crons.some((c) => c.path === "/api/autopilot" && c.schedule === "*/10 * * * *"));
  const js = fs.readFileSync(new URL("../public/js/queue.js", import.meta.url), "utf8") + fs.readFileSync(new URL("../public/js/queuehand.js", import.meta.url), "utf8");
  for (const ev of ["watchlist_add", "queue_open", "queue_export"]) assert.ok(js.includes(`ph("${ev}"`), ev);
});

test("Paying right now: proven pay first, then budget; zero and new campaigns never lead; clippers shown", async () => {
  const { payingStreamers, nameCandidates } = await import("../lib/autopilot.js");
  const streamers = [
    { platform: "twitch", login: "lacy", name: "Lacy" }, { platform: "twitch", login: "laurenhamdenn", name: "laurenhamdenn" },
    { platform: "twitch", login: "kaicenat", name: "KaiCenat" }, { platform: "twitch", login: "nobody_here", name: "Nobody" }, { platform: "twitch", login: "kreekcraft", name: "KreekCraft" },
  ];
  const cs = [
    camp({ title: "$12,500 LACY GTA VI Marathon Pool Campaign", expected_per_clip: 0.81, budget_left: 6991, clippers_count: 696, rate_per_1k: null, cap_per_clip: null }),
    camp({ title: "$5,000 Lauren Hamden GTA 6 Clipping Campaign", description: "https://www.twitch.tv/laurenhamdenn", expected_per_clip: 6.69, budget_left: 4491, clippers_count: 10 }),
    camp({ title: "Kai Cenat - $10,000 GTA 6 Pool Campaign", expected_per_clip: 0, budget_left: 10000, clippers_count: 66, rate_per_1k: null, cap_per_clip: null }),
    camp({ title: "KreekCraft GTA 6 Clipping", expected_per_clip: null, budget_left: 6824, clippers_count: 0, cap_per_clip: 300 }),
  ];
  const rows = payingStreamers(streamers, cs);
  assert.deepEqual(rows.map((r) => r.key), ["twitch:laurenhamdenn", "twitch:lacy", "twitch:kaicenat", "twitch:kreekcraft"]);
  assert.equal(rows[0].best.clippers, 10);
  assert.equal(rows[1].best.clippers, 696);
  assert.equal(rows[2].best.pool, true);
  // The names worth trying on Twitch when a streamer campaign links no channel.
  assert.deepEqual(nameCandidates(camp({ title: "BrettLiftsXP GTA VI Clipping Campaign- $2 CPM", is_gta: true })), ["brettliftsxp"]);
  assert.ok(nameCandidates(camp({ title: "SypherPK $7,500 Clipping Campaign", categories: ["Streamer"] })).includes("sypherpk"));
  assert.deepEqual(nameCandidates(camp({ title: "Boeshi GTA 6 Clipping", is_gta: true, description: "twitch.tv/darealboeshi" })), [], "a linked channel needs no guess");
  assert.deepEqual(nameCandidates(camp({ title: "Jamieson (ARTIST) Promo", categories: ["Music"] })), [], "not a streamer campaign");
});

test("the local Blob stand-in never writes to the live store", async () => {
  const real = globalThis.fetch;
  const env = { ...process.env };
  const calls = [];
  globalThis.fetch = async (u) => { calls.push(String(u)); return new Response("{}", { status: 200 }); };
  try {
    const { installLocalBlob } = await import("../scripts/local_blob.mjs");
    const dir = installLocalBlob(fs.mkdtempSync(path.join(os.tmpdir(), "hc-blob-")));
    await fetch("https://blob.vercel-storage.com/?pathname=" + encodeURIComponent("requests/board.json"), { method: "PUT", headers: { authorization: "Bearer x" }, body: '{"a":1}' });
    assert.deepEqual(calls, [], "a PUT must not reach the network");
    assert.equal(fs.readFileSync(path.join(dir, "requests/board.json"), "utf8"), '{"a":1}');
    const r = await fetch(process.env.BLOB_BASE + "requests/board.json?v=1");
    assert.deepEqual(await r.json(), { a: 1 });
    assert.equal((await fetch(process.env.BLOB_BASE + "watch/u/nope.json")).status, 404);
    assert.equal((await fetch("https://api.mailgun.net/v3/x/messages", { method: "POST" })).status, 503);
    assert.deepEqual(calls, [], "nothing private falls through to live");
  } finally { globalThis.fetch = real; for (const k of ["BLOB_READ_WRITE_TOKEN", "BLOB_BASE", "CREDIT_SALT", "MAILGUN_API_KEY", "STRIPE_SECRET_KEY"]) { if (env[k] === undefined) delete process.env[k]; else process.env[k] = env[k]; } }
});
