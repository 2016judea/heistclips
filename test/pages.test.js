import test from "node:test";
import assert from "node:assert/strict";
import { layout } from "../lib/render.js";
import { ctaBox, href, isLocal, splitLang } from "../lib/i18n.js";

test("the paste box sits straight after the h1 and every page keeps both trackers", () => {
  const html = layout({ title: "t", desc: "d", path: "/gta-6-clipping-rates-today", body: "<h1>Rates</h1><p>rest</p>", cta: ctaBox("en", { src: "cta-rates" }) });
  assert.match(html, /<h1>Rates<\/h1>\s*<section class="cta"/);
  assert.match(html, /action="\/clip"/);
  assert.match(html, /href="\/clip\?top=gta&amp;src=cta-rates-top"/);
  assert.match(html, /\/_vercel\/insights\/script\.js/);
  assert.match(html, /posthog\.init/);
});

test("a campaign that names a streamer offers that streamer in one tap", () => {
  const box = ctaBox("en", { src: "cta-campaign", streamer: { login: "tjr", name: "TJR", platform: "kick" } });
  assert.match(box, /href="\/clip\?q=kick\.com%2Ftjr&amp;src=cta-campaign-streamer"/);
  assert.match(box, /Clip TJR’s stream now/);
});

test("language paths", () => {
  assert.equal(href("de", "/"), "/de");
  assert.equal(href("fr", "/pricing"), "/fr/pricing");
  assert.equal(href("de", "/guides/how-to-clip-gta-6-streams"), "/de/guides/how-to-clip-gta-6-streams");
  assert.equal(href("de", "/about"), "/about"); // English only: never link to a page that does not exist
  assert.equal(href("en", "/pricing"), "/pricing");
  assert.deepEqual(splitLang("/de/clip"), { lang: "de", path: "/clip" });
  assert.deepEqual(splitLang("/fr"), { lang: "fr", path: "/" });
  assert.deepEqual(splitLang("/free"), { lang: "en", path: "/free" });
  assert.equal(isLocal("/campaigns/x"), false);
});

test("a ranker row for a campaign that names a streamer carries a one-tap to that stream", async () => {
  const { campaignList } = await import("../lib/render.js");
  const camp = (id, extra = {}) => ({ id, slug: "c-" + id, title: "C " + id, owner: "O", platforms: ["tiktok"], payouts: [], expected_per_clip: 3, rate_per_1k: 2, cap_per_clip: 100, budget_left: 800, days_left: 30, clippers_count: 2, paid_out: 0, requirements: [], ...extra });
  const streamers = [{ login: "clix", name: "Clix", platform: "twitch", campaign_ids: ["a"], live_now: false, peak_viewers: 9 }, { login: "tjr", name: "TJR", platform: "kick", campaign_ids: ["a"], live_now: true, peak_viewers: 2 }];
  const html = campaignList([camp("a"), camp("b")], 0, streamers);
  assert.equal((html.match(/class="btn sm tapclip"/g) || []).length, 1); // only the campaign that names someone
  assert.match(html, /href="\/clip\?q=kick\.com%2Ftjr&amp;src=row"/); // the live one wins
  assert.match(html, /Clip TJR’s stream now/);
  assert.doesNotMatch(campaignList([camp("a")]), /tapclip/); // callers that pass no streamers are unchanged
});
