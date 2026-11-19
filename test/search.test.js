import test from "node:test";
import assert from "node:assert/strict";
import { aggregate, clipRecordPath, parseRecordPath, STREAM_FLOOR, MOMENT_FLOOR } from "../lib/trend.js";
import { updateEnded, findEnded } from "../lib/ended.js";
import * as S from "../lib/searchpages.js";
import { SEARCH_EN } from "../lib/search_words.js";
import { WORDS, localPage } from "../lib/pages_l10n.js";
import { LANGS, isLocal } from "../lib/i18n.js";
import { sitemapUrls } from "../api/page.js";

const NOW = Date.parse("2026-11-19T18:00:00Z");
const camp = (id, over = {}) => ({ id: id + "-0000-0000-0000-000000000000", slug: "camp-" + id, title: "Camp " + id, owner: "Owner", description: "", categories: ["Gaming"], platforms: ["tiktok"], payouts: [], payout_type: "cpm",
  rate_per_1k: 2, per_post: null, cap_per_clip: 100, expected_per_clip: 3.5, earned_per_clip: 3.5, avg_per_clip: 4, budget_total: 1000, budget_spent: 400, budget_left: 600, days_left: 9, clippers_count: 12, approved_clips: 40,
  approval_required: false, requirements: [], paid_out: 0, is_gta: false, is_gaming: true, source_url: "https://contentrewards.com/c/campaigns/" + id, ...over });
const snap = { generated_at: "2026-11-19T17:00:00.000Z", summary: { campaigns: 2, gta: 1, gaming: 2, with_track_record: 2, earned_per_clip_median: 4.09, earned_per_clip_p90: 24.5, earned_per_clip_p10: 0.15, rate_per_1k_median: 1.1, cap_median: 200, budget_left_total: 1200 },
  campaigns: [camp("aaaaaaaa", { is_gta: true, title: "Kai Cenat GTA 6 pool" }), camp("bbbbbbbb", { title: "=SUM(A1), \"quoted\"" })],
  streamers: [{ login: "kaicenat", name: "KaiCenat", platform: "twitch", campaign_ids: [] }, { login: "adinross", name: "AdinRoss", platform: "kick", live_now: true, viewers_now: 900, game: "Grand Theft Auto VI", last_title: "gta" }] };
const rows = [
  { day: "2026-11-19", vod: "2932305259", t: 37340, n: 4 }, { day: "2026-11-18", vod: "2932305259", t: 37330, n: 1 }, { day: "2026-11-19", vod: "2932305259", t: 100, n: 1 },
  { day: "2026-11-19", platform: "twitch", login: "kaicenat", n: 2 }, { day: "2026-11-19", platform: "kick", login: "adinross", n: 2 },
  { day: "2026-11-10", platform: "twitch", login: "old", n: 50 }, { day: "2026-11-19", vod: "999999999", t: 50, n: 9 },
];
const vods = { 2932305259: { platform: "twitch", login: "kaicenat", name: "KaiCenat", title: "GTA", game: "Grand Theft Auto VI" } };
const trend = aggregate(rows, vods, NOW);

test("the clip counter's record is a stream and a 10-second bucket, nothing else", () => {
  const p = clipRecordPath({ vod: "2932305259", t: 37343.4, layout: "split", bytes: 9 }, NOW);
  assert.match(p, /^trend\/c\/2026-11-19\/[a-z0-9]+-[0-9a-f]{8}~2932305259~37340\.json$/);
  assert.deepEqual(parseRecordPath(p), { day: "2026-11-19", at: NOW, vod: "2932305259", t: 37340 });
  assert.equal(clipRecordPath({ vod: "../../x", t: 1 }, NOW), null);
  assert.equal(clipRecordPath({}, NOW), null);
});

test("most clipped: floors hide thin rows, old days and unnamed streams are left out, links open the tool", () => {
  assert.equal(trend.clips_counted, 10); // the 9 clips of an unknown VOD and the 50 from last week are not counted
  assert.deepEqual(trend.streams.map((s) => [s.login, s.clips, s.clips_today]), [["kaicenat", 8, 7]]); // adinross has 2 < floor
  assert.equal(STREAM_FLOOR, 3); assert.equal(MOMENT_FLOOR, 2);
  assert.equal(trend.moments.length, 1);
  assert.equal(trend.moments[0].clips, 5);
  assert.equal(trend.moments[0].clip_path, "/clip?q=2932305259&t=37340&src=trend");
  assert.equal(trend.streams[0].clip_path, "/clip?q=kaicenat&src=trend");
});

test("every search page: one h1, canonical, tracked, valid JSON-LD, no em dash, no brand name", () => {
  const pages = {
    "/twitch-clip-maker": S.makerPage("/twitch-clip-maker", trend), "/kick-clip-maker": S.makerPage("/kick-clip-maker", trend),
    "/most-clipped-streams": S.trendPage(trend), "/data": S.dataPage(snap, trend),
    "/streamers/kaicenat": S.streamerHowTo(snap, snap.streamers[0], { name: "KaiCenat", is_live: false, vods: [] }, [snap.campaigns[0]], trend),
    "/streamers/kick/adinross": S.streamerHowTo(snap, snap.streamers[1], null, [], trend),
    "/campaigns/camp-zzzzzzzz": S.endedPage(snap, { ended_at: "2026-11-19T12:00:00Z", last_seen: "2026-11-19T11:30:00Z", why: "budget", campaign: camp("zzzzzzzz") }),
  };
  const titles = new Set(), descs = new Set();
  for (const [p, html] of Object.entries(pages)) {
    assert.equal((html.match(/<h1/g) || []).length, 1, p);
    assert.match(html, new RegExp(`<link rel="canonical" href="https://heistclips.com${p}"`), p);
    assert.match(html, /\/_vercel\/insights\/script\.js/, p);
    assert.match(html, /posthog\.init/, p);
    for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) assert.ok(JSON.parse(m[1])["@type"], p);
    const main = html.slice(html.indexOf("<main"), html.indexOf("</main>"));
    assert.doesNotMatch(main, /—|Rockstar/, p);
    titles.add(html.match(/<title>([^<]*)/)[1]); descs.add(html.match(/name="description" content="([^"]*)/)[1]);
  }
  assert.equal(titles.size, 7); assert.equal(descs.size, 7);
  assert.match(pages["/streamers/kaicenat"], /name="q" value="kaicenat"/); // the clipper is pre-filled
  assert.match(pages["/streamers/kick/adinross"], /name="q" value="kick\.com\/adinross"/);
  assert.match(pages["/kick-clip-maker"], /onsubmit="[^"]*kick\.com\//); // a bare name typed on the Kick page is a Kick channel
  assert.doesNotMatch(pages["/twitch-clip-maker"], /onsubmit=/);
  assert.match(pages["/streamers/kaicenat"], /1 campaign pays for KaiCenat clips right now/);
  assert.match(pages["/streamers/kick/adinross"], /No campaign names AdinRoss right now/);
  assert.match(pages["/most-clipped-streams"], /"@type":"Dataset"/); assert.match(pages["/most-clipped-streams"], /"@type":"ItemList"/);
  assert.match(pages["/campaigns/camp-zzzzzzzz"], /Ended Nov 19, 2026/);
  assert.match(pages["/campaigns/camp-zzzzzzzz"], /camp-aaaaaaaa/); // live alternatives
  assert.doesNotMatch(pages["/campaigns/camp-zzzzzzzz"], /noindex/);
  assert.match(S.endedPage(snap, { slug: "gone-12345678" }), /noindex/); // no numbers held: answered, not indexed
});

test("the search pages exist in every site language, with reciprocal alternates", () => {
  const OTHER = LANGS.filter((x) => x !== "en");
  const keys = (o, pre = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? keys(v, pre + k + ".") : [pre + k]));
  const { locale, ...en } = SEARCH_EN;
  for (const l of OTHER) {
    assert.ok(WORDS[l] && WORDS[l].search, `add a "search" table to lib/l10n_${l}.js (same keys as lib/search_words.js)`);
    assert.deepEqual(keys(WORDS[l].search).sort(), keys(en).sort(), l);
  }
  for (const p of ["/twitch-clip-maker", "/kick-clip-maker", "/most-clipped-streams"]) {
    assert.ok(isLocal(p));
    for (const l of OTHER) {
      const html = localPage(l, p, { snap, query: new URLSearchParams(""), trend });
      assert.match(html, new RegExp(`<html lang="${l}">`));
      assert.match(html, new RegExp(`<link rel="canonical" href="https://heistclips.com/${l}${p}"`));
      assert.match(html, new RegExp(`hreflang="x-default" href="https://heistclips.com${p}"`));
      if (p !== "/most-clipped-streams") assert.match(html, new RegExp(`action="/${l}/clip"`));
      assert.doesNotMatch(html.slice(html.indexOf("<main"), html.indexOf("</main>")), /Find moments|How it works|clips free|—/);
    }
  }
});

test("data files: dated, licensed, one row per live campaign, and safe to open in a spreadsheet", () => {
  const csv = S.ratesCsv(snap).split("\n");
  assert.match(csv[0], /Data as of 2026-11-19T17:00:00.000Z/); assert.match(csv[1], /Licence: MIT/);
  assert.equal(csv[3], S.RATE_FIELDS.map((f) => f[0]).join(","));
  assert.equal(csv.filter((l) => l && !l.startsWith("#")).length, 3);
  assert.match(csv[5], /"'=SUM\(A1\), ""quoted"""/); // a formula-looking title is defused and quoted
  const j = JSON.parse(S.ratesJson(snap));
  assert.equal(j.campaigns.length, 2); assert.equal(j.as_of, snap.generated_at); assert.ok(j.licence && j.fields.expected_per_clip_usd);
  assert.equal(j.campaigns[0].page, "https://heistclips.com/campaigns/camp-aaaaaaaa");
  const t = JSON.parse(S.trendJson(trend));
  assert.equal(t.streams[0].clip_url, "https://heistclips.com/clip?q=kaicenat&src=trend"); assert.ok(t.notes.privacy);
  const full = S.llmsFull(snap, trend, [{ name: "find_clip_moments", title: "Find moments" }], [{ slug: "g", title: "G" }]);
  for (const need of ["/twitch-clip-maker", "/kick-clip-maker", "/most-clipped-streams", S.RATES_CSV, "/mcp", "KaiCenat (Twitch): 8 clips", "Data as of 2026-11-19"]) assert.ok(full.includes(need), need);
  assert.doesNotMatch(full, /—|Rockstar/);
});

test("a campaign that leaves the snapshot is archived with its last numbers, and comes back out if it returns", () => {
  const prev = { generated_at: "2026-11-19T16:30:00.000Z", campaigns: [...snap.campaigns, camp("cccccccc"), camp("dddddddd")] };
  const r = updateEnded({}, prev, snap, new Set(["dddddddd-0000-0000-0000-000000000000"]));
  assert.equal(r.added, 2);
  assert.equal(r.archive["camp-cccccccc"].why, "gone"); assert.equal(r.archive["camp-dddddddd"].why, "budget");
  assert.equal(r.archive["camp-cccccccc"].ended_at, snap.generated_at);
  assert.equal(r.archive["camp-cccccccc"].campaign.description, undefined); // the brief is the owner's words: not kept
  assert.equal(findEnded(r.archive, "old-title-cccccccc").campaign.slug, "camp-cccccccc");
  const back = updateEnded(r.archive, snap, { ...snap, campaigns: [...snap.campaigns, camp("cccccccc")] });
  assert.equal(back.revived, 1); assert.equal(back.archive["camp-cccccccc"], undefined); assert.ok(back.archive["camp-dddddddd"]);
});

test("sitemap: canonical pages only, the new pages in every language, no filter views", () => {
  const urls = sitemapUrls(snap, trend);
  assert.equal(urls.some((u) => u.includes("?")), false);
  assert.equal(new Set(urls).size, urls.length);
  for (const u of ["/twitch-clip-maker", "/de/kick-clip-maker", "/fr/most-clipped-streams", "/pt/twitch-clip-maker", "/es/most-clipped-streams", "/data", "/streamers/kaicenat", "/streamers/kick/adinross"]) assert.ok(urls.includes(u), u);
});
