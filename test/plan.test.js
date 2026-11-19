// plan_my_clips (lib/plan.js) and the rule checklist and caption it hands out (lib/briefrules.js).
import test from "node:test";
import assert from "node:assert/strict";
import { payAtSizes } from "../lib/atsize.js";
import { checklist, captionFor } from "../lib/briefrules.js";
import { planMyClips, parseStreamer } from "../lib/plan.js";
import { TOOLS, INSTRUCTIONS } from "../api/mcp.js";

// AsianJeff on 2026-11-19: $1 per 1K, $10 minimum payout, $300 cap. YourRAGE: a pool, 500 views a
// clip and 500,000 views in total before a clipper shares it (read off their campaign pages).
const cpm = { id: "bbd3a963-1", slug: "asianjeff-bbd3a963", title: "$2,500 AsianJeff Clipping Campaign", payout_type: "cpm", rate_per_1k: 1, cap_per_clip: 300, budget_left: 2000, budget_total: 2500, settings_read: true, min_clip_views: null, pool_total_views: null,
  platforms: ["tiktok", "instagram", "youtube"], payouts: ["tiktok", "instagram", "youtube"].map((p) => ({ platform: p, rate_per_1k: 1, cap_per_clip: 300, min_payout: 10 })), description: "Caption must include #asianjeff", is_gta: true, is_gaming: true };
const pool = { id: "be9b123e-1", slug: "yourrage-be9b123e", title: "YourRAGE $5,000 GTA 6 Pool Campaign", payout_type: "pool", rate_per_1k: null, budget_left: 5000, budget_total: 5000, settings_read: true, min_clip_views: 500, pool_total_views: 500000,
  total_views: 2_000_000, views_7d: 0, clips_7d: 0, days_left: null, platforms: ["tiktok", "youtube"], payouts: [], description: "", is_gta: true, is_gaming: true };

test("the checklist turns rules into steps and marks what it cannot read", () => {
  const c = { ...cpm, description: "Caption must include #asianjeff and tag @asianjeff.\nClips must be 15-45 seconds.\nNo spoilers of the story.\nThis is a paid partnership, disclose it.\nOur vibe is unmatched and must stay that way.", hidden_references: 2, approval_required: true };
  const { items, need } = checklist(c);
  const by = (r) => items.find((i) => i.rule === r);
  assert.ok(by("hashtag")); assert.equal(by("hashtag").status, "done");
  assert.deepEqual(need.hashtags, ["#asianjeff"]); assert.deepEqual(need.mentions, ["@asianjeff"]);
  assert.deepEqual(need.length, { min: 15, max: 45 });
  assert.equal(need.spoilersBanned, true); assert.equal(need.disclosure, true);
  assert.equal(by("hidden_rules").status, "brief");
  assert.equal(by("apply_first").status, "you");
  assert.ok(items.some((i) => i.status === "brief" && /vibe/.test(i.text))); // a rule-like line nobody parsed: check the brief
  const cap = captionFor({ hook: "AsianJeff was NOT ready", streamer: { name: "AsianJeff", login: "asianjeff" }, need });
  assert.match(cap.caption, /^AsianJeff was NOT ready\n/);
  assert.equal(cap.tags[0], "#ad");
  assert.ok(cap.tags.includes("#asianjeff") && cap.tags.includes("#gta6"));
  assert.match(cap.caption, /@asianjeff/);
  assert.match(cap.caption, /twitch\.tv\/asianjeff/);
});

test("plan_my_clips: only what can pay at your size, moments with cut_clip arguments, nothing cut", async () => {
  const camps = [cpm, pool, { ...cpm, id: "bob-1", slug: "bobby-bob", title: "BOBBY VAN RIPER GTA VI Clipping", rate_per_1k: 1.5, description: "https://www.twitch.tv/bobby_vanriper\nClips must be 15-30 seconds.",
    payouts: ["tiktok", "youtube"].map((p) => ({ platform: p, rate_per_1k: 1.5, cap_per_clip: 150, min_payout: 2.25 })) }].map((c) => ({ ...c, ...payAtSizes(c) }));
  const snap = { generated_at: "2026-11-19T20:00:00Z", campaigns: camps, streamers: [
    { platform: "twitch", login: "asianjeff", name: "AsianJeff", campaign_ids: ["bbd3a963-1"] },
    { platform: "twitch", login: "yourragegaming", name: "YourRAGE", campaign_ids: ["be9b123e-1"] },
    { platform: "twitch", login: "bobby_vanriper", name: "Bobby", campaign_ids: [] }] };
  const calls = [];
  const deps = {
    snapshot: async () => snap, trend: async () => ({ moments: [{ platform: "twitch", login: "bobby_vanriper", t: 3600, clips: 4, clip_path: "/clip?q=123&t=3600&src=trend" }] }),
    findClipMoments: async (a) => { calls.push(a); return { out: { stream: { platform: "twitch", url: "https://www.twitch.tv/videos/123", title: "GTA", game: "Grand Theft Auto VI", status: "finished" },
      moments: [{ t_start_s: 100, t_end_s: 138, chat_speed_vs_normal: "6x", event_type: "funny", hooks: ["He was NOT ready"], music_risk: "low", spoiler_risk: "none", watch: "w" }, { t_start_s: 500, t_end_s: 538, chat_speed_vs_normal: "4x", hooks: ["x"], music_risk: "high" }] } }; },
  };
  const { out, log } = await planMyClips({ views_per_clip: 5000 }, { deps, tag: (u) => u + "&src=mcp" });
  assert.equal(out.your_size.views_per_clip, 5000);
  assert.equal(out.plan.length, 1); // Bobby pays at 5K; AsianJeff (10K floor) is a long shot only if asked for more; YourRAGE needs 100 clips
  const p = out.plan[0];
  assert.equal(p.streamer.login, "bobby_vanriper");
  assert.equal(p.pays_your_typical_clip, true);
  assert.equal(p.campaign.likely_per_clip_at_your_size, 7.5);
  assert.equal(p.moments.length, 1); // the licensed-music moment is left out
  assert.deepEqual(p.moments[0].cut_clip, { source: "https://www.twitch.tv/videos/123", start: 108, end: 138, layout: "fit", hook: "He was NOT ready" }); // trimmed to the 30 s rule
  assert.match(p.moments[0].open_in_editor, /\/clip\?q=https%3A%2F%2Fwww\.twitch\.tv%2Fvideos%2F123&t=108&src=mcp$/);
  assert.equal(p.most_clipped_here[0].clips_made, 4);
  assert.ok(p.rules.some((r) => r.rule === "length"));
  assert.match(p.caption, /#gta6/);
  assert.ok(out.cannot_pay_you.some((x) => /500k views/.test(x.why)));
  assert.match(out.next, /Nothing was cut or posted/);
  assert.equal(log.status, "can_pay");
  // a new account: nothing pays a typical clip; the plan says so and lists the long shots
  const n = await planMyClips({ account_size: "new", limit: 2 }, { deps });
  assert.match(n.out.summary, /none of the/);
  assert.ok(n.out.plan.every((x) => x.pays_your_typical_clip === false && x.long_shot));
  // named streamers only
  const one = await planMyClips({ streamers: ["twitch.tv/AsianJeff"], views_per_clip: 50000 }, { deps });
  assert.deepEqual(one.out.plan.map((x) => x.streamer.login), ["asianjeff"]);
  assert.equal(parseStreamer("https://kick.com/Foo_Bar/").platform, "kick");
});

test("a stream with nothing to clip right now gives way to one with moments, and is still listed", async () => {
  const mk = (id, login, rate) => ({ ...cpm, id, slug: id, title: login + " campaign", description: "https://twitch.tv/" + login, rate_per_1k: rate, payouts: [{ platform: "tiktok", rate_per_1k: rate, cap_per_clip: 300, min_payout: 0.5 }] });
  const camps = [mk("a-1", "quiet", 3), mk("b-1", "loud", 1)].map((c) => ({ ...c, ...payAtSizes(c) }));
  const snap = { campaigns: camps, streamers: [{ platform: "twitch", login: "quiet" }, { platform: "twitch", login: "loud" }] };
  const deps = { snapshot: async () => snap, trend: async () => null,
    findClipMoments: async (a) => ({ out: { stream: { platform: "twitch", url: "https://www.twitch.tv/videos/9" }, note: "Chat was steady the whole stream; no clear spikes.",
      moments: a.source === "loud" ? [{ t_start_s: 10, t_end_s: 48, chat_speed_vs_normal: "5x", hooks: ["h"], music_risk: "low" }] : [] } }) };
  const { out } = await planMyClips({ views_per_clip: 5000, limit: 1 }, { deps });
  assert.deepEqual(out.plan.map((p) => p.streamer.login), ["loud"]);
  assert.equal(out.also_pays_you[0].streamer, "quiet");
  assert.match(out.also_pays_you[0].note, /steady/);
});

test("the connector lists plan_my_clips and the instructions point at it", () => {
  const t = TOOLS.find((x) => x.name === "plan_my_clips");
  assert.ok(t && t.annotations.readOnlyHint === true);
  assert.ok(t.inputSchema.properties.views_per_clip && t.inputSchema.properties.streamers);
  assert.match(INSTRUCTIONS, /plan_my_clips/);
});
