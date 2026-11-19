// The clip editor's campaign checklist (public/js/campaign.js).
//   GET /api/rules?ch=twitch:<login>&name=<display name>   campaigns that pay for this streamer's
//        clips, best paying first, then general GTA campaigns any GTA clip can go to
//   GET /api/rules?c=<slug or id>                           one campaign's rules as checklist lines
//        (lib/rules.js: its description and the rules pages it links to, read live)
// Public facts only. Nothing is written anywhere; the CDN keeps each answer for a while.
import { latestSnapshot } from "../lib/store.js";
import { campaignsFor, isGeneralGta, paysFor } from "../lib/autopilot.js";
import { loadRules } from "../lib/rules.js";

const pub = (c, pays) => ({
  id: c.id, slug: c.slug, title: c.title, owner: c.owner, source_url: c.source_url, page: "/campaigns/" + c.slug,
  pays_for: pays || null, expected_per_clip: c.expected_per_clip, cap_per_clip: c.cap_per_clip, rate_per_1k: c.rate_per_1k, per_post: c.per_post,
  budget_left: c.budget_left, is_gta: !!c.is_gta, platforms: c.platforms || [], approval_required: !!c.approval_required,
});
const value = (c) => (c.expected_per_clip == null ? -1 : c.expected_per_clip);

export default async function handler(req, res) {
  const u = new URL(req.url, "https://heistclips.com");
  const send = (obj, status = 200, maxAge = 300) => {
    res.statusCode = status;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("cache-control", status === 200 ? `public, s-maxage=${maxAge}, stale-while-revalidate=3600` : "no-store");
    res.end(JSON.stringify(obj));
  };
  const snap = await latestSnapshot().catch(() => null);
  if (!snap) return send({ ok: false, error: "warming up" }, 503);
  const live = snap.campaigns.filter((c) => c.budget_left > 0);

  const want = (u.searchParams.get("c") || "").trim().toLowerCase();
  if (want) {
    const c = live.find((x) => x.slug === want || x.id === want || x.id.startsWith(want)) || snap.campaigns.find((x) => x.slug === want || x.id === want);
    if (!c) return send({ ok: false, error: "No live campaign called that." }, 404);
    const rules = await loadRules(c);
    return send({ ok: true, campaign: pub(c), rules }, 200, 1800);
  }

  const key = u.searchParams.get("ch") || "";
  const [platform, login] = key.includes(":") ? key.split(":") : ["twitch", key];
  if (!/^[a-z0-9_-]{2,30}$/i.test(login || "")) return send({ ok: false, error: "Pass ch=twitch:<login> or c=<campaign>." }, 400);
  const chan = { platform: platform === "kick" ? "kick" : "twitch", login: login.toLowerCase(), name: (u.searchParams.get("name") || login).slice(0, 40) };
  const mine = campaignsFor(chan, live).sort((a, b) => value(b) - value(a) || (b.cap_per_clip || 0) - (a.cap_per_clip || 0)).slice(0, 6).map((c) => pub(c, paysFor(c, chan)));
  const general = live.filter(isGeneralGta).filter((c) => !mine.some((m) => m.id === c.id)).sort((a, b) => value(b) - value(a)).slice(0, 4).map((c) => pub(c, "general"));
  return send({ ok: true, channel: chan, campaigns: [...mine, ...general] });
}
