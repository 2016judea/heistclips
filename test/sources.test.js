// Campaigns across marketplaces (DATA_MODEL.md "Campaigns across marketplaces"): the Ssemble,
// Clipstake and Vyro parsers on pages saved 2026-11-19 (trimmed to real rows), Content Rewards
// discovery beyond the sitemap, and how a campaign with unpublished numbers is shown.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseSsemble } from "../lib/sources/ssemble.js";
import { parseClipstake } from "../lib/sources/clipstake.js";
import { parseVyro, vyroSlugs } from "../lib/sources/vyro.js";
import { refreshMarketplaces, otherCampaigns, mirroredCrIds } from "../lib/sources/index.js";
import { campaignIdsIn, nextDiscoverPage, freshen, slim, rawCampaigns, refreshCache, Blocked } from "../lib/crpages.js";
import { normalizeOther, buildSnapshot, GTA_RE, rank } from "../lib/campaigns.js";
import { campaignPage, campaignList } from "../lib/render.js";

const fx = (f) => fs.readFileSync(new URL("./fixtures/" + f, import.meta.url), "utf8");
const NOW = Date.parse("2026-11-20T02:00:00Z");
const TOMO = "df6de26f-86ec-4782-b818-1fc8053b99a4";
const ARON = "dc311e70-9c0e-42d6-a219-3d08a388c6e8";

test("Ssemble: its own campaigns become campaigns; Content Rewards mirrors become ids to read", () => {
  const { own, mirrorIds, rows } = parseSsemble(fx("ssemble_clip_rewards.html"));
  assert.equal(rows, 4);
  assert.equal(own.length, 2); // the CR mirror and the PromoteFun row are not Ssemble's
  assert.deepEqual(mirrorIds, [TOMO]);
  const speed = own.find((c) => /iShowSpeed/.test(c.title));
  assert.equal(speed.rate_per_1k, 1);
  assert.equal(speed.budget_total, 100);
  assert.equal(speed.budget_spent, 42.23);
  assert.equal(speed.clippers, 1563);
  assert.deepEqual(speed.source_channels, ["https://www.youtube.com/@speeduniverse"]);
  const n = normalizeOther(speed, NOW);
  assert.equal(n.marketplace, "Ssemble");
  assert.equal(n.is_gta, true);
  assert.equal(n.budget_left, 57.77);
  assert.equal(n.cap_per_clip, null); // not published, never guessed
  assert.equal(n.floor.known, false);
  assert.equal(n.at_size.new.usd, null);
  assert.match(n.slug, /-ssemble-/);
  assert.ok(!JSON.stringify(n).includes("yt3.ggpht.com"), "no avatar kept");
});

test("Clipstake: every row parses; only active ones are listed", () => {
  const { all } = parseClipstake(fx("clipstake_marketplace.html"));
  assert.deepEqual(all.map((c) => c.status), ["active", "paused", "ended"]);
  const listed = otherCampaigns({ sources: { Clipstake: { items: all } } });
  assert.equal(listed.length, 1);
  const n = normalizeOther(listed[0], NOW);
  assert.equal(n.title, "DonBet Logo Campaign (GTA6)");
  assert.equal(n.is_gta, true);
  assert.equal(n.rate_per_1k, 0.2);
  assert.equal(n.budget_left, 4500);
  assert.deepEqual(n.platforms, ["instagram"]);
  assert.equal(n.source_url, "https://app.clipstake.com/marketplace/donbet-donbet-logo-campaign-gta6");
});

test("Vyro: the campaign sitemap lists open campaigns; a page gives title, brand, rate and platforms", () => {
  const slugs = vyroSlugs(fx("vyro_campaigns_sitemap.xml"));
  assert.equal(slugs.length, 7);
  assert.ok(slugs.includes("gta-vi-youtube-livestream-ElB0CABa"));
  const v = parseVyro(fx("vyro_campaign_gta.html"), "gta-vi-youtube-livestream-ElB0CABa", NOW);
  assert.equal(v.title, "GTA VI YouTube Livestream"); // not the 404 template's h1 in the same payload
  assert.equal(v.owner, "YouTube");
  assert.equal(v.owner_verified, true);
  assert.equal(v.rate_per_1k, 3); // "$3,000 per 1M views"
  assert.deepEqual(v.platforms, ["tiktok", "instagram"]);
  const n = normalizeOther(v, NOW);
  assert.equal(n.budget_left, null); // Vyro publishes no budget: unknown, not spent
  assert.equal(n.at_size.new.usd, null);
  assert.equal(rank([n]).length, 1, "an unknown budget stays listed");
});

test("Content Rewards discovery: the GTA article names campaigns the sitemap misses", () => {
  const ids = campaignIdsIn(fx("cr_gta_article.html"));
  assert.ok(ids.includes(ARON) && ids.includes(TOMO));
  assert.equal(nextDiscoverPage('<a href="/c/discover/clipping?page=3">', "/c/discover/clipping", 2), "/c/discover/clipping?page=3");
  assert.equal(nextDiscoverPage("<a href=\"/c/discover\">", "/c/discover/clipping", 5), null);
});

test("a discover card's new title renames the cached campaign and queues its page", () => {
  const camp = JSON.parse(fx("campaigns.json"))[0];
  const f = freshen(slim({ ...camp, name: "PARKERRYT" }), { campaign: { id: camp.id, title: "GTA VI | PARKERRYT STREAM" }, metrics: {} });
  assert.equal(f.name, "GTA VI | PARKERRYT STREAM");
  assert.equal(f._renamed, true);
  assert.equal(freshen(slim(camp), { campaign: { id: camp.id, title: camp.name }, metrics: {} })._renamed, undefined);
});

test("a group card (one member's id, the group's title and budget) never touches that campaign", () => {
  const camp = JSON.parse(fx("campaigns.json"))[0];
  const raw = slim(camp);
  const card = { campaign: { id: camp.id, title: "GTA 6", budgetTotalRaw: 15000, group: { campaignIds: [camp.id, "x"], name: "GTA 6" } }, metrics: {} };
  assert.equal(freshen(raw, card), raw);
});

test("GTA: FiveM roleplay counts, a Roblox crime RP does not; paused campaigns are not listed", () => {
  assert.ok(GTA_RE.test("FiveM server clipping, our RP streamers"));
  assert.ok(!GTA_RE.test("Miami Crime RP, an open world crime game on Roblox"));
  const cache = { campaigns: { a: { raw: { id: "a", status: "active" } }, b: { raw: { id: "b", status: "paused" } }, c: { raw: { id: "c", status: "ended" } } } };
  assert.deepEqual(rawCampaigns(cache).map((r) => r.id), ["a"]);
});

// A fake contentrewards.com: the sitemap lists one campaign; the article names two more, one
// open (read and listed) and one paused (read, not listed).
function fakeCr(camp) {
  const pageFor = (c) => {
    const payload = `1f:["$","$L28",null,{"campaign":${JSON.stringify(c)}}]`;
    return `<script>self.__next_f.push([1,${JSON.stringify(payload)}])</script>`;
  };
  const listed = { ...camp };
  const aron = { ...camp, id: ARON, name: "GTA 6 x ARON ORLANDO MUSIC CLIPPING" };
  const tomo = { ...camp, id: TOMO, name: "TOMO GTA VI Clipping", status: "paused" };
  const seen = [];
  const fetchImpl = async (url) => {
    const p = new URL(url).pathname + new URL(url).search;
    seen.push(p);
    if (p === "/sitemap.xml") return new Response(`<urlset><url><loc>https://contentrewards.com/c/campaigns/${listed.id}</loc></url></urlset>`);
    if (p === "/articles/gta-6-clipping") return new Response(fx("cr_gta_article.html"));
    const m = p.match(/^\/c\/campaigns\/(.+)$/);
    if (m) { const c = [listed, aron, tomo].find((x) => x.id === m[1]); return c ? new Response(pageFor(c)) : new Response("", { status: 404 }); }
    return new Response("<html></html>"); // discover pages with no cards
  };
  return { fetchImpl, seen };
}

test("refreshCache reads campaigns outside the sitemap and keeps only the open ones", async () => {
  const camp = JSON.parse(fx("campaigns.json"))[0];
  const { fetchImpl, seen } = fakeCr(camp);
  const real = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    const r = await refreshCache({ campaigns: {} }, { maxPages: 1, maxNew: 5, pauseMs: 0 });
    assert.equal(r.error, undefined);
    assert.ok(seen.includes("/c/campaigns/" + ARON) && seen.includes("/c/campaigns/" + TOMO));
    const ids = rawCampaigns(r.cache).map((x) => x.id);
    assert.ok(ids.includes(camp.id) && ids.includes(ARON));
    assert.ok(!ids.includes(TOMO), "paused, budget spent");
    assert.ok(r.cache.extra[ARON], "kept as an extra id");
    assert.ok(!seen.some((p) => p.startsWith("/api/")));
  } finally { globalThis.fetch = real; }
});

test("refreshMarketplaces: one request per board, Vyro pages read, a blocked board keeps its last read", async () => {
  const pages = {
    "https://www.ssemble.com/clip-rewards": fx("ssemble_clip_rewards.html"),
    "https://app.clipstake.com/marketplace": fx("clipstake_marketplace.html"),
    "https://vyro.com/sitemap/campaigns.xml": `<urlset><url><loc>https://vyro.com/campaigns/gta-vi-youtube-livestream-ElB0CABa</loc></url></urlset>`,
    "https://vyro.com/campaigns/gta-vi-youtube-livestream-ElB0CABa": fx("vyro_campaign_gta.html"),
  };
  const asked = [];
  const ok = async (u) => { asked.push(u); return pages[u] || null; };
  const { cache, runs } = await refreshMarketplaces({}, { pauseMs: 0, fetchText: ok });
  assert.ok(runs.every((r) => !r.error), JSON.stringify(runs));
  assert.equal(asked.length, 4);
  assert.ok(asked.every((u) => !/\/api\//.test(u) && !/clipster/.test(u)));
  const list = otherCampaigns(cache);
  assert.deepEqual([...new Set(list.map((c) => c.marketplace))].sort(), ["Clipstake", "Ssemble", "Vyro"]);
  assert.deepEqual(mirroredCrIds(cache), [TOMO]);
  // Next run: Ssemble answers 429. Its campaigns stay; it backs off.
  const blocked = async (u) => { if (u.includes("ssemble")) throw new Blocked(u + " 429"); return pages[u] || null; };
  const again = await refreshMarketplaces(cache, { pauseMs: 0, fetchText: blocked });
  assert.ok(again.cache.sources.Ssemble.backoff_until);
  assert.equal(otherCampaigns(again.cache).filter((c) => c.marketplace === "Ssemble").length, 2);
});

test("the snapshot counts GTA campaigns by marketplace and pages say where to join", () => {
  const camp = JSON.parse(fx("campaigns.json"))[0];
  const others = [...parseSsemble(fx("ssemble_clip_rewards.html")).own, ...parseClipstake(fx("clipstake_marketplace.html")).all.filter((c) => c.status === "active"),
    parseVyro(fx("vyro_campaign_gta.html"), "gta-vi-youtube-livestream-ElB0CABa", NOW)];
  const snap = buildSnapshot([camp], NOW, others);
  assert.deepEqual(snap.summary.gta_by_marketplace, { "Content Rewards": 1, Ssemble: 1, Clipstake: 1, Vyro: 1 });
  const cr = snap.campaigns.find((c) => c.marketplace === "Content Rewards");
  assert.equal(snap.campaigns[0], cr, "a campaign with a track record ranks first");
  const vy = snap.campaigns.find((c) => c.marketplace === "Vyro");
  const html = campaignPage({ ...snap, streamers: [] }, vy);
  assert.match(html, /Join on Vyro/);
  assert.match(html, /<b>not public<\/b><span>budget left/);
  assert.ok(!/actually paid out/.test(html));
  const row = campaignList([vy]);
  assert.match(row, /on <b>Vyro<\/b>/);
  assert.match(row, /budget left not public/);
  assert.ok(!/null/.test(row));
  assert.match(campaignPage({ ...snap, streamers: [] }, cr), /Join on Content Rewards/);
});
