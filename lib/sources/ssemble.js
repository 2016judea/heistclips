// Ssemble Clip Rewards (ssemble.com/clip-rewards). robots.txt allows everything but /api/ and
// /register. The page server-renders its whole board as `liveCampaigns` in the Next.js flight
// payload: Ssemble's own campaigns plus mirrors of other marketplaces' (source "whop" = Content
// Rewards ids). We keep Ssemble's own rows as campaigns, and hand the mirrored Content Rewards ids
// to lib/crpages.js as extra pages to read (DATA_MODEL.md "Campaigns across marketplaces").
//
// Fills: rate, budget total and spent, platforms, clippers, views, the streamer's channel.
// Does not publish: cap per clip, floors, the brief, approved clips, a page per campaign.
import { flightText, objectsWithKey } from "../crpages.js";

export const NAME = "Ssemble";
export const BASE = "https://www.ssemble.com";
export const LIST = "/clip-rewards";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const num = (x) => (typeof x === "number" && isFinite(x) ? x : null);
const arr = (x) => (Array.isArray(x) ? x : []);

export function boardOf(html) {
  const holder = objectsWithKey(flightText(html), "liveCampaigns", (o) => Array.isArray(o.liveCampaigns))[0];
  return holder ? holder.liveCampaigns : [];
}

// One of Ssemble's own rows -> the generic shape lib/campaigns.js normalizeOther() reads.
// Creator names and avatars of clippers are never on this board; the streamer's avatar is dropped.
export function toCampaign(r) {
  const cents = (x) => (num(x) == null ? null : x / 100);
  return {
    marketplace: NAME,
    id: "ssemble:" + String(r.externalId),
    title: r.title || "",
    owner: r.creatorName || null,
    owner_verified: false,
    description: "",
    categories: r.category ? [r.category] : [],
    platforms: arr(r.socialPlatforms),
    payout_type: "cpm",
    rate_per_1k: cents(r.pricePerViewCents),
    cap_per_clip: null,
    min_payout: null,
    budget_total: cents(r.totalBudgetCents),
    budget_spent: cents(r.budgetSpentCents),
    clippers: num(r.creatorsCount),
    total_views: r.stats ? num(r.stats.viewCount) : null,
    approved_clips: null,
    launched_at: r.fundedAt || r.firstSeenAt || null,
    status: r.status || null,
    source_url: BASE + LIST,
    source_channels: r.channelUrl ? [r.channelUrl] : [],
    countries: arr(r.clipperCountries).filter((x) => typeof x === "string"),
  };
}

export function parseSsemble(html) {
  const board = boardOf(html);
  const own = board.filter((r) => r && r.source === "ssemble" && r.externalId && r.title).map(toCampaign);
  const mirrorIds = [...new Set(board.filter((r) => r && r.source === "whop" && UUID.test(String(r.externalId))).map((r) => r.externalId))];
  return { own, mirrorIds, rows: board.length };
}
