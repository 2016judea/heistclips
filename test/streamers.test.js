import test from "node:test";
import assert from "node:assert/strict";
import { titleNames, needsName, handleGuesses, fuzzyLogin, acceptAccounts, resolveCampaignNames, linkedStreamers, mergeStreamers, nameKey, MAX_STREAMERS } from "../lib/streamers.js";
import { paysFor } from "../lib/autopilot.js";
import { streamersIndex, paidStreamers } from "../lib/render.js";

const NOW = Date.parse("2026-11-20T01:00:00Z");
const camp = (o) => ({ id: "c-" + Math.random().toString(36).slice(2, 8), title: "", description: "", categories: [], is_gta: true, budget_left: 1000, ...o });

// Real titles from the 2026-11-19 snapshot.
test("the names a campaign title gives", () => {
  assert.deepEqual(titleNames(camp({ title: "KreekCraft GTA 6 Clipping" })), ["KreekCraft"]);
  assert.deepEqual(titleNames(camp({ title: "BenDaDonnn x Puffco GTA 6" })), ["BenDaDonnn", "Puffco"]);
  assert.deepEqual(titleNames(camp({ title: "BrettLiftsXP GTA VI Clipping Campaign- $2 CPM" })), ["BrettLiftsXP"]);
  assert.deepEqual(titleNames(camp({ title: "Dasgasd3m x RUCKUS | GTA 6" })), ["Dasgasd3m", "RUCKUS"]);
  assert.deepEqual(titleNames(camp({ title: "GATTOUZ × GTA VI × 1WIN" })), ["GATTOUZ", "1WIN"]);
  assert.deepEqual(titleNames(camp({ title: "GTA VI | PARKERRYT STREAM" })), ["PARKERRYT"]);
  assert.deepEqual(titleNames(camp({ title: "DiegoLoveless GTA 6 Clipping" })), ["DiegoLoveless"]);
  assert.deepEqual(titleNames(camp({ title: "$5,000 Dylan Page GTA VI Marathon Campaign" })), ["Dylan Page"]);
  assert.deepEqual(titleNames(camp({ title: "Kai Cenat - $10,000 GTA 6 Pool Campaign" })), ["Kai Cenat"]);
  assert.deepEqual(titleNames(camp({ title: "$12,500 LACY GTA VI Marathon Pool Campaign" })), ["LACY"]);
  assert.deepEqual(titleNames(camp({ title: "YourRAGE $5,000 GTA 6 Pool Campaign" })), ["YourRAGE"]);
  assert.deepEqual(titleNames(camp({ title: "Lysium/Benji Ramos Clips" })), ["Lysium", "Benji Ramos"]);
  assert.deepEqual(titleNames(camp({ title: "$7,500 LUXDROP Logo Clipping Campaign" })), ["LUXDROP"]);
  assert.deepEqual(titleNames(camp({ title: "iShowSpeed Plays GTA 6 Clipping | $1 CPM" })), ["iShowSpeed"]);
  assert.deepEqual(titleNames(camp({ title: "DonBet Logo Campaign (GTA6)" })), ["DonBet"]);
  assert.deepEqual(titleNames(camp({ title: "Gaming Storytelling " })), [], "all campaign vocabulary");
  assert.deepEqual(titleNames(camp({ title: "Things I Could've Said | Audio Only Campaign | Gaming", categories: ["Gaming"] })), [], "a sound campaign names a song");
  assert.deepEqual(titleNames(camp({ title: "GTA 6 Clipping Campaign - Tokyo Girl", categories: ["Music"] })), []);
  assert.deepEqual(titleNames(camp({ title: "DENIAL - HOSTILE", categories: ["Sound Campaign", "Music"] })), []);
});

test("only paying GTA campaigns with no linked channel and no 'any GTA clip' brief are resolved by name", () => {
  assert.equal(needsName(camp({ title: "KreekCraft GTA 6 Clipping" })), true);
  assert.equal(needsName(camp({ title: "$2,500 AsianJeff Clipping Campaign", description: "⬇️ https://www.twitch.tv/asianjeff" })), false, "the link already joins it");
  assert.equal(needsName(camp({ title: "KreekCraft GTA 6 Clipping", budget_left: 0 })), false);
  assert.equal(needsName(camp({ title: "SypherPK $7,500 Clipping Campaign", is_gta: false, categories: ["Streamer"] })), false);
});

test("handles to try, and which search results count as the same name", () => {
  assert.deepEqual(handleGuesses("KreekCraft"), { twitch: ["kreekcraft"], kick: ["kreekcraft"] });
  assert.deepEqual(handleGuesses("Kai Cenat"), { twitch: ["kaicenat", "kai_cenat"], kick: ["kaicenat", "kai-cenat", "kai_cenat"] });
  assert.equal(fuzzyLogin("GATTOUZ", "gattouz0"), true);
  assert.equal(fuzzyLogin("PARKERRYT", "realparkerr"), true);
  assert.equal(fuzzyLogin("GATTOUZ", "gatto"), false);
  assert.equal(fuzzyLogin("GATTOUZ", "gattouzirl"), false);
  assert.equal(fuzzyLogin("KreekCraft", "kreekcraftclips"), false);
  assert.equal(fuzzyLogin("KreekCraft", "kreekcraft"), false, "an exact login is the exact path, not a search guess");
  assert.equal(nameKey("BenDaDonnn"), "bendadonnn");
});

// Accounts as lookupName returns them (numbers measured 2026-11-19).
const tw = (login, followers, gta_at, o = {}) => ({ platform: "twitch", login, name: login, followers, gta_at, gta_live: false, via: "exact", ...o });
const kk = (login, followers, gta_at, o = {}) => ({ platform: "kick", login, name: login, followers, gta_at, gta_live: false, gta_cat: !!gta_at, vods: gta_at ? 8 : 0, via: "exact", ...o });

test("a channel joins only if it is real, big enough, and streamed GTA lately", () => {
  const c = camp({ title: "Sample x Brand GTA 6" });
  assert.deepEqual(acceptAccounts("Sample", [tw("sample", 589052, "2026-11-19T15:08:34Z"), kk("sample", 503, null)], c, NOW).hits.map((h) => h.platform + ":" + h.login), ["twitch:sample"]);
  assert.deepEqual(acceptAccounts("Brand", [tw("brand", 48, "2026-09-08T03:39:34Z")], c, NOW).hits, [], "48 followers is a namesake");
  assert.match(acceptAccounts("Brand", [tw("brand", 48, null)], c, NOW).why, /small namesakes/);
  const old = acceptAccounts("Oldie", [tw("oldie", 17142, "2026-06-01T14:09:39Z")], c, NOW);
  assert.deepEqual(old.hits, []);
  assert.match(old.why, /not streamed GTA/);
  assert.equal(acceptAccounts("Oldie", [tw("oldie", 17142, "2026-06-01T14:09:39Z")], camp({ description: "Clip his Twitch streams" }), NOW).hits.length, 1, "a brief that names the platform is enough");
  assert.equal(acceptAccounts("Live", [tw("live1", 5000, null, { gta_live: true })], c, NOW).hits.length, 1);
  assert.equal(acceptAccounts("Cat", [kk("cat", 5000, null, { gta_cat: true, vods: 0 })], c, NOW).hits.length, 1, "Kick lists GTA among recent categories and keeps no VODs");
  // Search: the slug differs from the name. One passing result joins; two is ambiguous.
  const g = [tw("gattouz", 2, null), tw("gattouz0", 8717, "2023-01-23T00:17:31Z", { via: "search" }), kk("gattouz0", 131422, "2026-11-19T20:00:00Z", { via: "search" })];
  assert.deepEqual(acceptAccounts("Gattouzz", g.map((a) => ({ ...a, login: a.login.replace("gattouz", "gattouzz") })), c, NOW).hits.map((h) => h.platform + ":" + h.login), ["kick:gattouzz0"]);
  const two = [kk("namez1", 5000, "2026-11-19T00:00:00Z", { via: "search" }), kk("namez2", 9000, "2026-11-18T00:00:00Z", { via: "search" })];
  assert.match(acceptAccounts("Namez", two, c, NOW).why, /ambiguous/);
  assert.match(acceptAccounts("Nobody", [], c, NOW).why, /no Twitch or Kick channel/);
});

test("hand-checked names win over the rules", () => {
  const c = camp({ title: "GATTOUZ × GTA VI × 1WIN" });
  assert.deepEqual(acceptAccounts("GATTOUZ", [], c, NOW).hits.map((h) => [h.platform, h.login, h.via]), [["kick", "gattouz0", "override"]]);
  const dp = acceptAccounts("Dylan Page", [tw("dylanpage", 1, null)], camp({ title: "$5,000 Dylan Page GTA VI Marathon Campaign" }), NOW);
  assert.deepEqual(dp.hits, []);
  assert.match(dp.why, /not a Twitch or Kick channel/);
  const bd = acceptAccounts("BenDaDonnn", [tw("bendadonnn", 644738, "2026-11-19T00:00:00Z", { name: "bendadonnn", avatar: "a.png" })], camp({ title: "BenDaDonnn x Puffco GTA 6" }), NOW);
  assert.deepEqual(bd.hits.map((h) => h.platform + ":" + h.login), ["twitch:bendadonnn", "kick:bendadonnn"]);
  assert.equal(bd.hits[0].avatar, "a.png", "the looked-up profile fills the row");
});

test("resolveCampaignNames caches lookups, retries failures, and joins each channel to its campaigns", async () => {
  const kreek = camp({ id: "kreek", title: "KreekCraft GTA 6 Clipping" });
  const sample = camp({ id: "smp", title: "Samplestreamer x Brandco GTA 6" });
  const music = camp({ id: "mus", title: "GTA 6 Clipping Campaign - Tokyo Girl", categories: ["Music"] });
  const calls = [];
  const facts = {
    KreekCraft: [tw("kreekcraft", 589052, "2026-11-19T15:08:34Z", { via: "override" })],
    Samplestreamer: [tw("samplestreamer", 4624, "2026-11-19T23:16:32Z"), kk("samplestreamer", 9, "2026-11-19T00:00:00Z")],
    Brandco: [kk("brandco", 2, null)],
  };
  let stored = null;
  const deps = { now: NOW, load: async () => stored, save: async (s) => { stored = JSON.parse(JSON.stringify(s)); }, lookup: async (n) => { calls.push(n); if (n === "Brandco" && calls.filter((x) => x === n).length === 1) throw new Error("kick 429"); return facts[n]; } };
  const r1 = await resolveCampaignNames([kreek, sample, music], deps);
  assert.deepEqual(calls.sort(), ["Brandco", "KreekCraft", "Samplestreamer"]);
  assert.equal(r1.failed, 1);
  assert.deepEqual(r1.streamers.map((s) => [s.platform, s.login, s.campaign_ids]).sort(), [["twitch", "kreekcraft", ["kreek"]], ["twitch", "samplestreamer", ["smp"]]]);
  assert.equal(stored.names.brandco, undefined, "a failed lookup is not cached as 'no channel'");
  assert.ok(stored.report.some((x) => x.name === "Brandco" && /not looked up yet/.test(x.why)));
  calls.length = 0;
  const r2 = await resolveCampaignNames([kreek, sample, music], { ...deps, now: NOW + 3600e3 });
  assert.deepEqual(calls, ["Brandco"], "only the failed name is asked again within a day");
  assert.equal(r2.streamers.length, 2);
  calls.length = 0;
  await resolveCampaignNames([kreek], { ...deps, now: NOW + 2 * 3600e3 });
  assert.deepEqual(calls, []);
  assert.deepEqual(Object.keys(stored.names), ["kreekcraft"], "names no campaign uses any more are dropped");
  calls.length = 0;
  await resolveCampaignNames([kreek, sample], { ...deps, now: NOW + 30 * 3600e3, max: 1 });
  assert.equal(calls.length, 1, "at most `max` fresh lookups a run");
});

test("linkedStreamers merges brief links with resolved names", async () => {
  const linked = camp({ id: "lnk", title: "Boeshi GTA 6 Clipping", description: "Drive viewers to twitch.tv/darealboeshi." });
  const named = camp({ id: "nm", title: "KreekCraft GTA 6 Clipping" });
  const out = await linkedStreamers([linked, named], { now: NOW, load: async () => null, save: async () => {}, lookup: async () => [tw("kreekcraft", 589052, "2026-11-19T15:08:34Z", { name: "KreekCraft", avatar: "k.png" })] });
  assert.deepEqual(out.map((s) => [s.platform, s.login, s.campaign_ids]), [["twitch", "darealboeshi", ["lnk"]], ["twitch", "kreekcraft", ["nm"]]]);
  const failing = await linkedStreamers([linked], { load: async () => { throw new Error("blob down"); }, save: async () => { throw new Error("blob down"); }, lookup: async () => [] });
  assert.equal(failing.length, 1, "a Blob outage still leaves the linked channels");
});

test("the cap keeps every paid streamer and everyone live, and a joined row gets its name and avatar", () => {
  const prev = Array.from({ length: MAX_STREAMERS }, (_, i) => ({ login: "old" + i, platform: "twitch", peak_viewers: 100000 - i, campaign_ids: [] }));
  const live = [{ login: "smallgta", platform: "twitch", name: "SmallGTA", viewers: 29 }];
  const linked = [{ login: "gattouz0", platform: "kick", name: "Gattouz0", avatar: "g.png", followers: 131422, via: "search", campaign_ids: ["c1"] }];
  const out = mergeStreamers(prev, live, linked, "2026-11-20T01:00:00Z");
  assert.equal(out.length, MAX_STREAMERS);
  assert.deepEqual(out.slice(0, 2).map((s) => s.login), ["gattouz0", "smallgta"]);
  assert.equal(out[0].name, "Gattouz0");
  assert.equal(out[0].avatar, "g.png");
  assert.equal(out[0].joined_by, "search");
  assert.ok(!out.some((s) => s.login === "old" + (MAX_STREAMERS - 1)), "the smallest old peak is the one cut");
  const again = mergeStreamers(out, [{ login: "gattouz0", platform: "kick", name: "GATTOUZ0", avatar: "new.png", viewers: 9000 }], linked, "2026-11-20T01:30:00Z");
  assert.equal(again[0].avatar, "new.png", "a live read is fresher than the lookup");
});

test("a snapshot row joined to a campaign is paid by it, and /streamers lists it", () => {
  const c = camp({ id: "gz", title: "GATTOUZ × GTA VI × 1WIN" });
  const row = { platform: "kick", login: "gattouz0", name: "Gattouz0", campaign_ids: ["gz"], live_now: false, peak_viewers: 0 };
  assert.equal(paysFor(c, { platform: "kick", login: "gattouz0", name: "Gattouz0" }), null, "no title match finds it");
  assert.equal(paysFor(c, row), "name");
  const snap = { generated_at: "2026-11-20T01:00:00Z", campaigns: [c, camp({ id: "done", budget_left: 0 })], streamers: [row, { platform: "twitch", login: "x", campaign_ids: ["done"], peak_viewers: 5 }] };
  assert.deepEqual(paidStreamers(snap).map((p) => [p.s.login, p.n]), [["gattouz0", 1]]);
  const html = streamersIndex(snap);
  assert.match(html, /Campaigns pay to clip these<\/h2><ul class="live"><li><a href="\/streamers\/kick\/gattouz0">/);
  assert.match(html, /1 campaign paying · Kick/);
});
