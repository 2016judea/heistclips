// Ended campaigns keep their URL. When a campaign leaves the live snapshot (it left Content
// Rewards' directory, or its budget ran out), its last known numbers are kept here so
// /campaigns/<slug> can say "ended <date>", show what it paid, and point at what pays now,
// instead of a 404 on a link ChatGPT or Google already holds.
//
// Stored at campaigns/ended.json as { [slug]: { ended_at, last_seen, why, campaign } }.
// A campaign that comes back is taken out again, so one bad crawl heals on the next run.
import { getJSON, putJSON } from "./store.js";

export const ENDED_PATH = "campaigns/ended.json";
const MAX = 4000;
const KEEP = ["id", "slug", "title", "owner", "owner_verified", "categories", "platforms", "payout_type", "rate_per_1k", "per_post", "cap_per_clip",
  "budget_total", "budget_spent", "budget_left", "clippers_count", "approved_clips", "total_views", "views_per_clip", "earned_per_clip", "avg_per_clip",
  "expected_per_clip", "approval_required", "paid_out", "is_gta", "is_gaming", "launched_at", "source_url"];
const slim = (c) => Object.fromEntries(KEEP.filter((k) => c[k] !== undefined).map((k) => [k, c[k]]));

// Pure. prev/snap are snapshots; `listedIds` = ids Content Rewards still lists (so a campaign
// that is listed but no longer ranked ended because its budget is spent).
export function updateEnded(archive, prev, snap, listedIds = new Set()) {
  const out = { ...(archive || {}) };
  const liveIds = new Set(snap.campaigns.map((c) => c.id));
  let added = 0, revived = 0;
  for (const [slug, e] of Object.entries(out)) if (e.campaign && liveIds.has(e.campaign.id)) { delete out[slug]; revived++; }
  for (const c of (prev && prev.campaigns) || []) {
    if (liveIds.has(c.id) || !c.slug) continue;
    out[c.slug] = { ended_at: snap.generated_at, last_seen: prev.generated_at, why: listedIds.has(c.id) ? "budget" : "gone", campaign: slim(c) };
    added++;
  }
  const keys = Object.keys(out);
  if (keys.length > MAX) for (const k of keys.sort((a, b) => Date.parse(out[a].ended_at) - Date.parse(out[b].ended_at)).slice(0, keys.length - MAX)) delete out[k];
  return { archive: out, added, revived };
}

export async function archiveEnded(prev, snap, listedIds) {
  if (!prev) return { added: 0, revived: 0 };
  const cur = (await getJSON(ENDED_PATH, { fresh: true }).catch(() => null)) || {};
  const r = updateEnded(cur, prev, snap, listedIds);
  if (r.added || r.revived) await putJSON(ENDED_PATH, r.archive, { maxAge: 60 });
  return { added: r.added, revived: r.revived, total: Object.keys(r.archive).length };
}

let memo = { at: 0, data: null };
export async function loadEnded() {
  if (memo.data && Date.now() - memo.at < 120000) return memo.data;
  let d = null;
  try { d = await getJSON(ENDED_PATH); } catch (e) {}
  memo = { at: Date.now(), data: d || memo.data || {} };
  return memo.data;
}

// The archive entry for a requested slug: exact, or the same campaign under an older title.
export function findEnded(archive, slug) {
  if (archive[slug]) return archive[slug];
  const id8 = (slug.match(/-([0-9a-f]{8})$/) || [])[1];
  if (!id8) return null;
  return Object.values(archive).find((e) => e.campaign && e.campaign.id.startsWith(id8)) || null;
}
