// Public JSON: the ranked campaign list. GET /api/campaigns?filter=gta|gaming|all&limit=50
import { latestSnapshot } from "../lib/store.js";

export default async function handler(req, res) {
  const u = new URL(req.url, "https://heistclips.com");
  const f = u.searchParams.get("filter") || "all";
  const limit = Math.min(1000, Number(u.searchParams.get("limit")) || 1000);
  const snap = await latestSnapshot();
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("cache-control", "public, s-maxage=300, stale-while-revalidate=3600");
  if (!snap) { res.statusCode = 503; return res.end(JSON.stringify({ error: "warming up" })); }
  const pick = { gta: (c) => c.is_gta, gaming: (c) => c.is_gaming, all: () => true }[f] || (() => true);
  const campaigns = snap.campaigns.filter(pick).slice(0, limit).map((c, i) => ({ rank: i + 1, ...c, url: "https://heistclips.com/campaigns/" + c.slug }));
  res.end(JSON.stringify({ generated_at: snap.generated_at, source: snap.source, summary: snap.summary, filter: f, campaigns }));
}
