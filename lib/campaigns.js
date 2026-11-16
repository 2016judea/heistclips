// Campaign entity (DATA_MODEL.md): who is paying for clips right now, and what one clip is worth.
// Source: Content Rewards' public campaign pages (lib/crpages.js), never its /api/.
// Every number here is either read off that feed or derived from it in this file; nothing is guessed.

// Raw campaign objects come from lib/crpages.js (public pages only; robots.txt disallows /api/).
export const GTA_RE = /\bgta\s?(6|vi|v|5|online|rp)\b|grand theft auto|vice city|leonida|\bnopixel\b|\bgta\b/i;
const GAMING_CATS = new Set(["gaming", "streamer", "twitch", "kick", "roblox", "fortnite", "minecraft", "esports", "games", "gamer"]);

// RSC escapes a string that starts with "$" as "$$" (a $8,000 campaign arrives as "$$8,000").
const unRsc = (v) => (typeof v === "string" && v.startsWith("$$") ? v.slice(1) : v);

const cents = (v) => (typeof v === "number" ? v / 100 : null);

export function slugify(s) {
  return String(s || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

// One campaign -> the fields DATA_MODEL.md's Campaign entity asks for.
export function normalize(c, now = Date.now()) {
  const m = c.metrics || {};
  const payouts = (c.payouts || []).map((p) => ({
    platform: p.platform,
    type: p.payoutType,
    rate_per_1k: cents(p.rateCents),
    cap_per_clip: cents(p.maxPayoutCents),
    min_payout: cents(p.minPayoutCents),
  }));
  const rate = cents(c.primaryPayoutCents);
  const caps = payouts.map((p) => p.cap_per_clip).filter((x) => x != null);
  const cap = caps.length ? Math.max(...caps) : null;
  const budget_total = cents(c.budgetCents) || 0;
  const spent = cents(m.budgetSpentCents) || 0;
  const budget_left = Math.max(0, budget_total - spent);
  const approved = m.approvedSubmissionCount || 0;
  const top = (m.topEarners || []).filter((e) => e && e.earnedCents != null);
  const topEarned = top.reduce((a, e) => a + e.earnedCents / 100, 0);
  const topClips = top.reduce((a, e) => a + (e.approvedSubmissionCount || 0), 0);
  // Typical $ per approved clip, with the top three earners taken out so one viral clipper
  // does not set the number a new clipper should expect. Needs at least 5 other clips.
  const restClips = approved - topClips;
  const earned_per_clip = restClips >= 5 ? Math.max(0, (spent - topEarned) / restClips) : null;
  const avg_per_clip = approved > 0 ? spent / approved : null;
  const launched = Date.parse(c.launchDate || c.listedAt || c.createdAt) || now;
  const days_live = Math.max(1, (now - launched) / 86400000);
  const burn_per_day = spent / days_live;
  const days_left = burn_per_day > 0 ? budget_left / burn_per_day : null;
  // A clip earns most of its views in its first ~3 days; money that runs out sooner pays less.
  const runway = days_left == null ? 1 : Math.min(1, days_left / 3);
  const expected_per_clip = earned_per_clip == null ? null : earned_per_clip * runway;
  const views_per_clip = approved > 0 ? Math.round((m.totalViews || 0) / approved) : null;
  const pts = m.chartPoints || [];
  const views_7d = pts.slice(-7).reduce((a, p) => a + (p.totalViews || 0), 0);
  const clips_7d = pts.slice(-7).reduce((a, p) => a + (p.approvedSubmissionCount || 0), 0);
  const top_clip_views = Math.max(0, ...(m.topClips || []).map((t) => t.totalViews || 0));
  const cats = (c.categories || []).map((x) => x.name);
  const text = `${unRsc(c.name)} ${unRsc(c.description) || ""}`;
  const is_gta = GTA_RE.test(text);
  const is_gaming = is_gta || (c.categories || []).some((x) => GAMING_CATS.has(String(x.id).toLowerCase()) || GAMING_CATS.has(String(x.name).toLowerCase()));
  const shortId = c.id.split("-")[0];
  const d = (c.description || "");
  const requirements = [];
  if (/\b(us|usa|united states|american)\b[^.\n]{0,40}\b(audience|viewers|views)\b|\b(audience|viewers|views)\b[^.\n]{0,40}\b(us|usa|united states)\b/i.test(d)) requirements.push("US audience");
  if (/tier[\s-]?1/i.test(d)) requirements.push("Tier 1 audience");
  if (/\b(english)\b/i.test(d)) requirements.push("English");
  if (/no (watermark|logo)/i.test(d)) requirements.push("no watermark");
  if (/\b(\d{2,3})\s?(s|sec|seconds)\b/i.test(d)) requirements.push("length rule");
  if (/\b(spoiler)/i.test(d)) requirements.push("spoiler rule");
  if (/\b(music|song|sound)\b/i.test(d)) requirements.push("audio rule");
  if (/\b(hashtag|#\w+|tag @|@\w+)/i.test(d)) requirements.push("tags/caption rule");
  return {
    id: c.id,
    slug: `${slugify(unRsc(c.name)) || "campaign"}-${shortId}`,
    title: unRsc(c.name),
    owner: unRsc(c.organizationName),
    owner_handle: c.organizationProfileHandle,
    owner_verified: !!c.organizationVerified,
    description: (unRsc(c.description) || "").trim(),
    categories: cats,
    platforms: c.platforms || [],
    payout_type: c.payoutType,
    geo_priced: !!c.geoPriced,
    rate_per_1k: c.payoutType === "cpm" ? rate : null,
    per_post: c.payoutType === "perPost" ? rate : null,
    cap_per_clip: cap,
    payouts,
    budget_total,
    budget_spent: round2(spent),
    budget_left: round2(budget_left),
    burn_per_day: round2(burn_per_day),
    days_left: days_left == null ? null : Math.round(days_left * 10) / 10,
    clippers_count: m.creatorCount || 0,
    approved_clips: approved,
    total_views: m.totalViews || 0,
    views_per_clip,
    views_7d,
    clips_7d,
    top_clip_views,
    earned_per_clip: earned_per_clip == null ? null : round2(earned_per_clip),
    avg_per_clip: avg_per_clip == null ? null : round2(avg_per_clip),
    expected_per_clip: expected_per_clip == null ? null : round2(expected_per_clip),
    approval_required: !!c.requiresApplication,
    requirements,
    paid_out: cents(m.paidOutCents) || 0,
    hours_left: days_left == null ? null : Math.round(days_left * 24),
    is_gta,
    is_gaming,
    launched_at: new Date(launched).toISOString(),
    updated_at: c.updatedAt || null,
    metrics_at: m.metricsUpdatedAt || null,
    source_url: `https://contentrewards.com/c/campaigns/${c.id}`,
  };
}

function round2(x) {
  return Math.round(x * 100) / 100;
}

// Rank: campaigns with a track record by expected $ per clip; brand-new ones (no clips yet)
// after them, by the most one clip can earn (the cap) — they are a bet, not a number.
export function rank(list) {
  const proven = list.filter((c) => c.expected_per_clip != null && c.budget_left > 0);
  const fresh = list.filter((c) => c.expected_per_clip == null && c.budget_left > 0);
  proven.sort((a, b) => b.expected_per_clip - a.expected_per_clip);
  fresh.sort((a, b) => (b.cap_per_clip || 0) * (b.rate_per_1k || 0) - (a.cap_per_clip || 0) * (a.rate_per_1k || 0) || b.budget_left - a.budget_left);
  return [...proven, ...fresh];
}

export function quantiles(xs, qs) {
  const s = xs.filter((x) => x != null && isFinite(x)).sort((a, b) => a - b);
  if (!s.length) return qs.map(() => null);
  return qs.map((q) => {
    const i = (s.length - 1) * q;
    const lo = Math.floor(i), hi = Math.ceil(i);
    return round2(s[lo] + (s[hi] - s[lo]) * (i - lo));
  });
}

export function summarize(list) {
  const pick = (f) => list.map(f);
  const [p10, p50, p90] = quantiles(pick((c) => c.earned_per_clip), [0.1, 0.5, 0.9]);
  const [r50] = quantiles(pick((c) => c.rate_per_1k), [0.5]);
  const [cap50] = quantiles(pick((c) => c.cap_per_clip), [0.5]);
  const [v50] = quantiles(pick((c) => c.views_per_clip), [0.5]);
  return {
    campaigns: list.length,
    gta: list.filter((c) => c.is_gta).length,
    gaming: list.filter((c) => c.is_gaming).length,
    with_track_record: list.filter((c) => c.earned_per_clip != null).length,
    earned_per_clip_p10: p10,
    earned_per_clip_median: p50,
    earned_per_clip_p90: p90,
    rate_per_1k_median: r50,
    cap_median: cap50,
    views_per_clip_median: v50,
    budget_left_total: Math.round(list.reduce((a, c) => a + c.budget_left, 0)),
  };
}

export function buildSnapshot(raw, now = Date.now()) {
  const list = rank(raw.map((c) => normalize(c, now)));
  return {
    generated_at: new Date(now).toISOString(),
    source: "contentrewards.com public discover feed",
    summary: summarize(list),
    campaigns: list,
  };
}
