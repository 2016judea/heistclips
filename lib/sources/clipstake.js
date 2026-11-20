// Clipstake (app.clipstake.com). robots.txt allows everything. /marketplace server-renders every
// campaign (active, paused and ended) with its numbers in the Next.js flight payload.
//
// Fills: rate per 1K, budget, spent, balance, platforms, views reached, geo pricing, status.
// Does not publish: cap per clip, floors, the brief, clippers or approved clips.
import { flightText, objectsWithKey } from "../crpages.js";

export const NAME = "Clipstake";
export const BASE = "https://app.clipstake.com";
export const LIST = "/marketplace";
const num = (x) => (typeof x === "number" && isFinite(x) ? x : null);
const PLAT = { twitter: "x" };

export function toCampaign(r) {
  return {
    marketplace: NAME,
    id: "clipstake:" + r.id,
    title: r.name || "",
    owner: r.brandName || null,
    owner_verified: false,
    description: "",
    categories: [r.contentType, r.category].filter((x) => typeof x === "string" && x && x !== "general"),
    platforms: (Array.isArray(r.platforms) ? r.platforms : []).map((p) => PLAT[p] || p),
    payout_type: "cpm",
    rate_per_1k: num(r.cpmDollars),
    cap_per_clip: null,
    min_payout: null,
    budget_total: num(r.budgetDollars),
    budget_spent: num(r.spentDollars),
    clippers: null,
    total_views: num(r.viewsReached),
    approved_clips: null,
    geo_priced: !!r.geoEnabled,
    approval_required: r.eligibility != null && r.eligibility !== "open",
    launched_at: r.createdAt || null,
    status: r.status || null,
    source_url: `${BASE}/marketplace/${encodeURIComponent(r.slug)}`,
    source_channels: [],
  };
}

export function parseClipstake(html) {
  const rows = objectsWithKey(flightText(html), "cpmDollars", (o) => typeof o.id === "string" && typeof o.slug === "string" && "budgetDollars" in o);
  return { all: rows.map(toCampaign), rows: rows.length };
}
