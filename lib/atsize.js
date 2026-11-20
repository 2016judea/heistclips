// Pay at your size: what one clip is likely to pay a clipper of a given size, after the
// campaign's floors. The ranker's "typical per clip" is what approved clips have earned, and
// those come mostly from established accounts. A new account with a few hundred views a clip
// earns nothing on most campaigns, because most have a floor:
//   - a minimum payout per clip ($10 at $1 per 1K = nothing under 10,000 views),
//   - a minimum of views per clip,
//   - a pool's total-views bar: your clips together must pass it before you share the pool.
// Every floor here is read off the campaign's own public settings on Content Rewards
// (lib/crpages.js keeps payouts[].minPayout, configuration.minClipViews and
// configuration.minCreatorViews). A floor we have not read is "unknown", never zero.
//
// The size model is the clip desk's (heistclips-desk desk/pick.js, EXPECTED.md, 2026-11-19):
// views per clip are log-normal around a median, sigma 1.6 (a wide spread: a few clips break
// out, most do not). Integrated on a fixed 20-point grid, so the numbers never move between runs.

export const SIGMA = 1.6;
export const SIZES = [
  { id: "new", median: 500, label: "New account", long: "a new account (about 500 views a clip)" },
  { id: "5k", median: 5000, label: "~5K views a clip", long: "about 5,000 views a clip" },
  { id: "50k", median: 50000, label: "~50K views a clip", long: "about 50,000 views a clip" },
];
// A pool counts as reachable at your size when about this many typical clips pass its bar.
export const POOL_MAX_CLIPS = 30;
// Pool rate when its views are known: budget / all the views it will share. Capped like the desk.
const POOL_RATE_CAP = 5;

// Standard normal quantiles at 2.5%..97.5% in 5% steps.
const Z = [-1.96, -1.44, -1.15, -0.93, -0.76, -0.6, -0.45, -0.32, -0.19, -0.06, 0.06, 0.19, 0.32, 0.45, 0.6, 0.76, 0.93, 1.15, 1.44, 1.96];

const r2 = (x) => Math.round(x * 100) / 100;

// A size from what the user said: a preset id, or their own typical views per clip.
export function sizeOf(x) {
  if (x && typeof x === "object" && x.median) return x;
  const preset = SIZES.find((s) => s.id === String(x || "").toLowerCase());
  if (preset) return preset;
  const n = Math.round(Number(String(x == null ? "" : x).replace(/[, _]/g, "").replace(/k$/i, "e3").replace(/m$/i, "e6")));
  if (Number.isFinite(n) && n >= 1) return { id: "custom", median: n, label: `~${n.toLocaleString("en-US")} views a clip`, long: `about ${n.toLocaleString("en-US")} views a clip` };
  return SIZES[0];
}

// The campaign's floors, from a normalized campaign (lib/campaigns.js). Per platform for a CPM
// campaign; per clip and per clipper for a pool.
export function floorsOf(c) {
  const read = !!c.settings_read; // configuration block read off the campaign page
  const minClip = Number.isFinite(c.min_clip_views) ? c.min_clip_views : null;
  if (c.payout_type === "pool") {
    if (!read) return { known: false, type: "pool", min_views_per_clip: null, pool_total_views: null, platforms: {} };
    return { known: true, type: "pool", min_views_per_clip: minClip || 0, pool_total_views: c.pool_total_views || 0, platforms: {} };
  }
  const platforms = {};
  let known = true;
  for (const p of c.payouts || []) {
    const rate = p.rate_per_1k != null ? p.rate_per_1k : c.rate_per_1k;
    if (c.payout_type === "cpm" && !(rate > 0)) continue; // this platform pays nothing per view
    if (c.payout_type === "cpm" && p.min_payout == null) { known = false; continue; }
    const byPay = c.payout_type === "cpm" && p.min_payout > 0 ? Math.ceil((p.min_payout / rate) * 1000 - 1e-9) : 0;
    platforms[p.platform] = { rate, cap: p.cap_per_clip != null ? p.cap_per_clip : c.cap_per_clip, min_payout: p.min_payout || 0, min_views: Math.max(byPay, minClip || 0) };
  }
  if (c.payout_type === "perPost" && !read) known = false;
  if (!Object.keys(platforms).length && c.payout_type === "cpm") known = false;
  const mins = Object.values(platforms).map((p) => p.min_views);
  return { known, type: c.payout_type, min_views_per_clip: mins.length ? Math.min(...mins) : null, pool_total_views: null, platforms };
}

// A pool's rate per 1K views: its budget over every view it is expected to share. Null when it
// has no views yet (then nothing can be said about one clip's share).
export function poolRate(c) {
  const weeks = Math.max(1, (c.days_left && c.days_left < 60 ? c.days_left : 28) / 7);
  const est = Math.max(c.total_views || 0, (c.views_7d || 0) * weeks, (c.clips_7d || 0) * (c.views_per_clip || 0) * weeks);
  if (!est) return null;
  return Math.min(POOL_RATE_CAP, ((c.budget_total || c.budget_left || 0) / est) * 1000);
}

function payAt(terms, views) {
  if (views < terms.min_views) return 0;
  if (terms.per_post != null) return terms.per_post;
  const pay = (terms.rate * views) / 1000;
  return terms.cap ? Math.min(terms.cap, pay) : pay;
}
function onGrid(terms, median) {
  let sum = 0, clear = 0;
  for (const z of Z) { const p = payAt(terms, median * Math.exp(SIGMA * z)); sum += p; if (p > 0) clear++; }
  return { avg: sum / Z.length, chance: clear / Z.length };
}

// One campaign at one size. usd = what your typical (median) clip pays; avg = the average over
// your spread of clips (the rare breakout included); chance = share of your clips that pay anything.
// usd null = cannot be said (floor unknown, or a pool with no views to price it).
export function atSize(c, size, { platforms = null } = {}) {
  const s = sizeOf(size);
  const f = floorsOf(c);
  const out = { size: s.id, median_views: s.median, usd: null, avg: null, chance: null, platform: null, clips_to_qualify: null, why: null };
  // budget_left null = the marketplace does not publish it (Vyro): unknown, not spent.
  if (c.budget_left != null && !(c.budget_left > 0)) return { ...out, usd: 0, avg: 0, chance: 0, why: "budget spent" };
  if (!f.known) return { ...out, why: "floor unknown" };
  if (c.payout_type === "pool") {
    const rate = poolRate(c);
    const need = f.pool_total_views > 0 ? Math.ceil(f.pool_total_views / s.median) : 0;
    out.clips_to_qualify = need || null;
    if (need > POOL_MAX_CLIPS) return { ...out, usd: 0, avg: 0, chance: 0, why: "pool bar out of reach" };
    if (rate == null) return { ...out, why: "pool not priced yet" };
    const terms = { rate, cap: null, min_views: f.min_views_per_clip || 0, per_post: null };
    const g = onGrid(terms, s.median);
    return { ...out, usd: r2(payAt(terms, s.median)), avg: r2(g.avg), chance: g.chance, why: payAt(terms, s.median) > 0 ? null : "under the floor" };
  }
  let best = null;
  for (const [plat, p] of Object.entries(f.platforms)) {
    if (platforms && platforms.length && !platforms.includes(plat)) continue;
    const terms = { rate: p.rate, cap: p.cap, min_views: p.min_views, per_post: c.payout_type === "perPost" ? c.per_post : null };
    const g = onGrid(terms, s.median);
    const cand = { usd: r2(payAt(terms, s.median)), avg: r2(g.avg), chance: g.chance, platform: plat, min_views: p.min_views };
    if (!best || cand.usd > best.usd || (cand.usd === best.usd && cand.avg > best.avg)) best = cand;
  }
  if (!best) return { ...out, usd: 0, avg: 0, chance: 0, why: platforms && platforms.length ? "does not pay on those platforms" : "pays on no platform" };
  return { ...out, usd: best.usd, avg: best.avg, chance: best.chance, platform: best.platform, why: best.usd > 0 ? null : "under the floor" };
}

const k = (n) => (n >= 1e6 ? +(n / 1e6).toFixed(1) + "M" : n >= 1e3 ? +(n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + "k" : String(n));

// A per-clip floor under 100 views stops no real clip (campaigns store 1 for "no minimum"), so it is not shown.
export const SHOWN_FLOOR = 100;

// The floor in one plain line (English; pages_l10n swaps it). Null when there is no floor.
export function floorLine(c) {
  const f = floorsOf(c);
  if (!f.known) return "Floor unknown, check the brief";
  if (f.type === "pool") {
    if (f.pool_total_views > 0) return `Pays nothing until your clips total ${k(f.pool_total_views)} views`;
    if (f.min_views_per_clip >= SHOWN_FLOOR) return `Pays nothing under ${k(f.min_views_per_clip)} views a clip`;
    return null;
  }
  if (f.min_views_per_clip >= SHOWN_FLOOR) return `Pays nothing under ${k(f.min_views_per_clip)} views a clip`;
  return null;
}

// Everything the pages, data files and connector need, stored on each campaign.
export function payAtSizes(c) {
  const f = floorsOf(c);
  const sizes = {};
  for (const s of SIZES) { const a = atSize(c, s); sizes[s.id] = { usd: a.usd, avg: a.avg, chance: a.chance, platform: a.platform, clips_to_qualify: a.clips_to_qualify }; }
  return {
    floor: { known: f.known, min_views_per_clip: f.min_views_per_clip, pool_total_views: f.pool_total_views, by_platform: Object.fromEntries(Object.entries(f.platforms).map(([p, x]) => [p, x.min_views])), line: floorLine(c) },
    at_size: sizes,
  };
}

// Sort for "Can pay me now": pays your typical clip, most first; then unknown; then nothing,
// by the average (a rare breakout still pays some of them).
export function canPayOrder(a, b, sizeId = "new") {
  const x = (a.at_size || {})[sizeId] || {}, y = (b.at_size || {})[sizeId] || {};
  const g = (v) => (v.usd > 0 ? 2 : v.usd == null ? 1 : 0);
  return g(y) - g(x) || (y.usd || 0) - (x.usd || 0) || (y.avg || 0) - (x.avg || 0) || (b.expected_per_clip || 0) - (a.expected_per_clip || 0);
}
