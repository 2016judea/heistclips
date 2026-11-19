// Pay at your size: floors read off a campaign's own settings, what a clip pays a small account,
// the words on the pages, the rule checklist and caption, and the plan_my_clips tool.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { atSize, floorsOf, floorLine, sizeOf, payAtSizes, canPayOrder } from "../lib/atsize.js";
import { normalize, buildSnapshot } from "../lib/campaigns.js";
import { campaignFromPage, slim, settingsOf, refreshCache } from "../lib/crpages.js";
import { youBlock, sizeSection, floorText, SIZE_EN } from "../lib/sizeview.js";
import { payingStreamers } from "../lib/autopilot.js";
import { rankerPage, campaignPage } from "../lib/render.js";
import { ratesCsv, ratesJson, llmsFull } from "../lib/searchpages.js";

const raw = JSON.parse(fs.readFileSync(new URL("./fixtures/campaigns.json", import.meta.url)))[0];
// AsianJeff on 2026-11-19: $1 per 1K, $10 minimum payout, $300 cap. YourRAGE: a pool, 500 views a
// clip and 500,000 views in total before a clipper shares it (read off their campaign pages).
const cpm = { id: "bbd3a963-1", slug: "asianjeff-bbd3a963", title: "$2,500 AsianJeff Clipping Campaign", payout_type: "cpm", rate_per_1k: 1, cap_per_clip: 300, budget_left: 2000, budget_total: 2500, settings_read: true, min_clip_views: null, pool_total_views: null,
  platforms: ["tiktok", "instagram", "youtube"], payouts: ["tiktok", "instagram", "youtube"].map((p) => ({ platform: p, rate_per_1k: 1, cap_per_clip: 300, min_payout: 10 })), description: "Caption must include #asianjeff", is_gta: true, is_gaming: true };
const pool = { id: "be9b123e-1", slug: "yourrage-be9b123e", title: "YourRAGE $5,000 GTA 6 Pool Campaign", payout_type: "pool", rate_per_1k: null, budget_left: 5000, budget_total: 5000, settings_read: true, min_clip_views: 500, pool_total_views: 500000,
  total_views: 2_000_000, views_7d: 0, clips_7d: 0, days_left: null, platforms: ["tiktok", "youtube"], payouts: [], description: "", is_gta: true, is_gaming: true };

test("a CPM floor is its minimum payout over its rate, per platform", () => {
  const f = floorsOf(cpm);
  assert.equal(f.known, true);
  assert.equal(f.min_views_per_clip, 10000);
  assert.equal(floorLine(cpm), "Pays nothing under 10k views a clip");
  const n = atSize(cpm, "new");
  assert.equal(n.usd, 0); // a 500-view clip earns nothing
  assert.equal(n.chance, 0.05); // 1 of the 20 grid points (the breakout) clears 10,000
  assert.equal(atSize(cpm, "5k").usd, 0);
  assert.equal(atSize(cpm, "50k").usd, 50); // 50,000 views at $1 per 1K, under the cap
  assert.equal(atSize(cpm, 400000).usd, 300); // the cap
});

test("a pool pays nothing until your clips pass its bar, and says how many clips that is", () => {
  const n = atSize(pool, "new");
  assert.equal(n.usd, 0); assert.equal(n.clips_to_qualify, 1000);
  const big = atSize(pool, "50k");
  assert.equal(big.clips_to_qualify, 10);
  assert.ok(big.usd > 0); // reachable in 10 clips, and the pool has views to price it
  assert.equal(floorLine(pool), "Pays nothing until your clips total 500k views");
  assert.equal(atSize({ ...pool, total_views: 0 }, "50k").usd, null); // no views yet: cannot be priced, never invented
});

test("a floor that was not read is unknown, never zero", () => {
  const unread = { ...pool, settings_read: false, min_clip_views: null, pool_total_views: null };
  assert.equal(floorsOf(unread).known, false);
  assert.equal(atSize(unread, "50k").usd, null);
  assert.equal(floorLine(unread), "Floor unknown, check the brief");
  const noMin = { ...cpm, payouts: cpm.payouts.map((p) => ({ ...p, min_payout: null })) };
  assert.equal(floorsOf(noMin).known, false);
});

test("sizes: presets, a number the user gives, and the can-pay-now order", () => {
  assert.equal(sizeOf("5k").median, 5000);
  assert.equal(sizeOf(800).median, 800);
  assert.equal(sizeOf("2.5k").median, 2500);
  assert.equal(sizeOf("nonsense").id, "new");
  const easy = { ...cpm, id: "e", payouts: cpm.payouts.map((p) => ({ ...p, min_payout: 0.5 })) }; // 500 views
  const list = [cpm, easy].map((c) => ({ ...c, ...payAtSizes(c) }));
  assert.equal(list.sort((a, b) => canPayOrder(a, b, "new"))[0].id, "e");
});

test("the campaign page's settings block is read, kept by slim, and turned into fields", () => {
  const cfg = { id: raw.id, configuration: { minClipViews: 500, minCreatorViews: 250000, payoutModel: [{ platform: "tiktok" }] }, briefCounts: { contentRules: 0, creatorRequirements: 1, references: 2 }, metrics: { poolSplit: { creatorCount: 12, topShareBps: [6000, 4000], otherShareBps: 0, final: false } }, type: "pool" };
  const payload = `1f:["$","$L28",null,{"campaign":${JSON.stringify(raw)}}]\n2:{"state":{"data":${JSON.stringify(cfg)}}}`;
  const page = `<script>self.__next_f.push([1,${JSON.stringify(payload)}])</script>`;
  const c = campaignFromPage(page, raw.id);
  assert.equal(c.configuration.minCreatorViews, 250000);
  const s = slim(c);
  assert.deepEqual([s.settings.minClipViews, s.settings.minCreatorViews, s.settings.references, s.settings.hiddenRequirements], [500, 250000, 2, 1]);
  assert.deepEqual(s.settings.poolShares.top, [6000, 4000]);
  const n = normalize({ ...s, payoutType: "pool" });
  assert.equal(n.pool_total_views, 250000); assert.equal(n.settings_read, true); assert.equal(n.hidden_references, 2);
  assert.ok(n.floor && n.at_size && n.at_size.new);
  // a page without one is unknown
  assert.equal(settingsOf(raw), null);
  assert.equal(normalize(raw).settings_read, false);
});

test("the crawler fetches pages that lack the settings block first, pools before the rest", async () => {
  const ids = ["11111111-1111-1111-1111-111111111111", "22222222-2222-2222-2222-222222222222", "33333333-3333-3333-3333-333333333333"];
  const now = new Date().toISOString();
  const cache = { campaigns: {
    [ids[0]]: { raw: { id: ids[0], name: "Some brand UGC", payoutType: "cpm", settings: { minClipViews: null } }, fetched_at: "2026-01-01T00:00:00Z" },
    [ids[1]]: { raw: { id: ids[1], name: "Lacy pool", payoutType: "pool" }, fetched_at: now },
    [ids[2]]: { raw: { id: ids[2], name: "GTA 6 clipping", payoutType: "cpm" }, fetched_at: now },
  } };
  const asked = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    asked.push(u.replace("https://contentrewards.com", ""));
    if (u.endsWith("/sitemap.xml")) return new Response(ids.map((i) => `<loc>https://contentrewards.com/c/campaigns/${i}</loc>`).join(""), { status: 200 });
    return new Response("<html></html>", { status: 200 });
  };
  try { await refreshCache(cache, { maxPages: 2, pauseMs: 0 }); } finally { globalThis.fetch = real; }
  const pages = asked.filter((p) => p.startsWith("/c/campaigns/"));
  assert.deepEqual(pages, ["/c/campaigns/" + ids[1], "/c/campaigns/" + ids[2]]);
});

test("rows carry every size's number; the campaign page words the floor and the odds", () => {
  const c = { ...cpm, ...payAtSizes(cpm) };
  const y = youBlock(c);
  assert.match(y, /data-you="0,0,50"/);
  assert.match(y, /likely for a new account · 1 in 20 of your clips pays/);
  assert.equal(floorText(c), "Pays nothing under 10k views a clip");
  const s = sizeSection(c);
  assert.match(s, /\$10\.00 minimum payout at \$1\.00 per 1k views on TikTok, Reels and Shorts/);
  assert.match(s, /1 in 20/); assert.match(s, /17 in 20/);
  const unk = { ...pool, settings_read: false, pool_total_views: null, min_clip_views: null };
  assert.match(sizeSection({ ...unk, ...payAtSizes(unk) }), /Floor unknown, check the brief/);
});

test("the ranker and a campaign page show likely-at-your-size next to typical, with the switch", () => {
  const snap = buildSnapshot([raw]);
  const html = rankerPage(snap, "all");
  assert.match(html, /class="sizebar" hidden/);
  assert.match(html, /data-sort="me"[^>]*>Can pay me now/);
  assert.match(html, /\/js\/size\.js\?v=\d+/);
  assert.match(html, /class="you[^"]*" data-you=/);
  assert.match(html, /For a new account \(about 500 views a clip\)/);
  const page = campaignPage(snap, snap.campaigns[0]);
  assert.match(page, /What a clip pays at your size/);
  assert.match(page, /class="youstat"/);
});

test("data files and llms-full carry the new fields and how they are computed", () => {
  const snap = buildSnapshot([raw]);
  const csv = ratesCsv(snap);
  for (const k of ["min_views_per_clip", "pool_total_views", "floor_known", "likely_new_account_usd", "likely_5k_usd", "likely_50k_usd"]) assert.ok(csv.split("\n").find((l) => l.startsWith("rank,")).includes(k), k);
  const j = JSON.parse(ratesJson(snap));
  assert.match(j.how_likely_is_computed, /sigma 1\.6/);
  assert.ok("likely_new_account_usd" in j.campaigns[0]);
  assert.ok(j.summary.pays_at_size && "new" in j.summary.pays_at_size);
  const txt = llmsFull(snap, null, [], []);
  assert.match(txt, /## Pay at your size/);
  assert.match(txt, /for a new account/);
});

test("Paying right now on /queue ranks by what pays a new account, and carries every size", () => {
  const camps = [{ ...cpm, expected_per_clip: 9 }, { ...cpm, id: "low", slug: "low", title: "Low floor", expected_per_clip: 1, description: "https://twitch.tv/bob", payouts: cpm.payouts.map((p) => ({ ...p, min_payout: 0.4 })) }].map((c) => ({ ...c, ...payAtSizes(c) }));
  camps[0].description = "https://twitch.tv/al";
  const rows = payingStreamers([{ platform: "twitch", login: "al" }, { platform: "twitch", login: "bob" }], camps);
  assert.equal(rows[0].key, "twitch:bob"); // pays a 500-view clip, though its typical is lower
  assert.ok(rows[0].you.new.usd > 0 && rows[1].you.new.usd === 0);
  assert.ok(rows[1].you["50k"].usd > 0);
  assert.equal(rows[1].you.new.floor.clip, 10000);
});

