import test from "node:test";
import assert from "node:assert/strict";

process.env.HC_STORE = "memory"; // never the live blob store from a test
const { putJSON } = await import("../lib/store.js");
const { pitchPage, loadPitch, campaignsNaming, LAUNCH_URL } = await import("../lib/pitch.js");
const { default: handler } = await import("../api/page.js");

const camp = (o) => ({ id: "x", slug: "x", title: "T", owner: "O", description: "", platforms: ["tiktok"], categories: [], payout_type: "cpm", rate_per_1k: 1, budget_total: 1000, budget_left: 500, clippers_count: 3, expected_per_clip: null, is_gaming: true, ...o });
const SNAP = {
  generated_at: "2026-11-19T17:30:58.295Z",
  summary: { campaigns: 665, gta: 23, rate_per_1k_median: 1.25, earned_per_clip_median: 4.04 },
  streamers: [],
  campaigns: [
    camp({ id: "dd617572-f0f7-4754-8df5-4c0deb81763a", slug: "lauren", title: "$5,000 Lauren Hamden GTA 6 Clipping Campaign", owner: "Reach", rate_per_1k: 1.5, budget_total: 5000, clippers_count: 10, expected_per_clip: 6.69, description: "Content to clip: https://www.twitch.tv/laurenhamdenn" }),
    camp({ id: "1d2bcb00-c904-415f-aa82-f95b96baad86", slug: "kai", title: "Kai Cenat - $10,000 GTA 6 Pool Campaign", owner: "Clipped & Shipped", payout_type: "pool", rate_per_1k: null, budget_total: 10000, clippers_count: 66, expected_per_clip: 0 }),
  ],
};
const PITCH = { slug: "trymacs", name: "Trymacs", login: "trymacs", platform: "twitch", people: 12, exporters: 8, clips: 12, from: "2026-11-17", to: "2026-11-19", as_of: "2026-11-19" };

test("a pitch page states the stored counts, the dates, the comparables and one next step", () => {
  const html = pitchPage(SNAP, PITCH);
  assert.match(html, /<h1>12 clippers pulled Trymacs’s streams this week\. Nobody is paying them\.<\/h1>/);
  assert.match(html, /No campaign on Content Rewards names Trymacs today\. We checked all 665 live ones\./);
  assert.match(html, /<b>12<\/b><span>finished clips exported, by 8 people<\/span>/);
  assert.match(html, /This week on heistclips, Nov 17 to Nov 19\./);
  assert.match(html, /Lauren Hamden GTA 6 Clipping Campaign<\/b><\/a><span>\$1\.50 per 1,000 views, \$5,000 budget · 10 clippers, typical clip earned \$6\.69/);
  assert.match(html, /\$10,000 pool, split by views · 66 clippers<\/span>/);
  assert.equal(html.split(LAUNCH_URL).length - 1, 1, "exactly one launch button");
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.match(html, /\/_vercel\/insights\/script\.js/);
  assert.match(html, /posthog\.init/);
  assert.doesNotMatch(html.split('<section class="pitch">')[1].split("</section>")[0], /Rockstar|—/);
});

test("a streamer nobody has exported a clip of gets no clip count", () => {
  const html = pitchPage(SNAP, { ...PITCH, slug: "caseoh", name: "CaseOh", login: "caseoh_", people: 12, exporters: 0, clips: 0 });
  assert.doesNotMatch(html, /finished clip/);
  assert.match(html, /campaigns paying for clips of CaseOh/);
});

test("the nobody-pays line goes away the day a campaign names the streamer", () => {
  const snap = { ...SNAP, campaigns: [...SNAP.campaigns, camp({ slug: "try-gta", title: "Trymacs GTA Clipping" })] };
  assert.equal(campaignsNaming(snap, PITCH).length, 1);
  assert.equal(campaignsNaming(SNAP, PITCH).length, 0);
  assert.equal(campaignsNaming(SNAP, { name: "Lacy", login: "lacy" }).length, 0, "a name inside another word is not a match");
  const html = pitchPage(snap, PITCH);
  assert.doesNotMatch(html, /Nobody is paying them|No campaign on Content Rewards/);
  assert.match(html, /A campaign names Trymacs now: <a href="\/campaigns\/try-gta">/);
});

test("/for/<slug> serves the pitch when one is stored and the home page otherwise", async () => {
  await putJSON("snapshot/latest.json", SNAP);
  await putJSON("pitch/trymacs.json", PITCH);
  const get = async (url) => {
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(b) { this.body = b; } };
    await handler({ url }, res);
    return res;
  };
  const a = await get("/api/page?p=/for/trymacs");
  assert.equal(a.statusCode, 200);
  assert.match(a.body, /12 clippers pulled Trymacs/);
  const b = await get("/api/page?p=/for/reach");
  assert.equal(b.statusCode, 200);
  assert.match(b.body, /Clip GTA VI streams while they’re live\./);
  assert.equal(await loadPitch("../snapshot/latest"), null);
});
