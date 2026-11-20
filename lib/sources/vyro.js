// Vyro (vyro.com, a MrBeast company). robots.txt allows everything but /admin. Its open campaigns
// are listed in /sitemap/campaigns.xml; each /campaigns/<slug> page is server-rendered with the
// title, the brand, the platforms and the payout per 1M (or 1K) views.
//
// Fills: title, owner, verified, platforms, rate, how long ago it opened.
// Does not publish: budget (total or left), cap per clip, floors, clippers, the brief.
import { flightText } from "../crpages.js";

export const NAME = "Vyro";
export const BASE = "https://vyro.com";
export const SITEMAP = "/sitemap/campaigns.xml";

export function vyroSlugs(xml) {
  return [...new Set([...String(xml || "").matchAll(/<loc>https:\/\/vyro\.com\/campaigns\/([A-Za-z0-9_-]+)<\/loc>/g)].map((m) => m[1]))];
}

const str = (s) => { try { return JSON.parse('"' + s + '"'); } catch (e) { return null; } };
const first = (t, res) => { for (const re of res) { const m = t.match(re); if (m) return m; } return null; };

// "21h ago" / "3d ago" / "2w ago" -> ms, read at fetch time.
function agoMs(s) {
  const m = String(s || "").match(/^(\d+)\s*(m|min|h|d|w|mo|y)\b/);
  if (!m) return null;
  const n = +m[1], u = { m: 60e3, min: 60e3, h: 3600e3, d: 864e5, w: 6048e5, mo: 2592e6, y: 31536e6 }[m[2]];
  return n * u;
}

export function parseVyro(html, slug, now = Date.now()) {
  const t = flightText(html);
  // The page's own <title> ("Vyro | <name> Campaign"); the payload also carries a 404 template's h1.
  const tm = String(html).match(/<title>Vyro \| (.*?)(?: Campaign)?<\/title>/);
  let title = tm ? tm[1].replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"') : null;
  if (!title) {
    const h1 = [...t.matchAll(/\["\$","h1",null,\{"className":"[^"]*","children":"((?:[^"\\]|\\.)*)"\}\]/g)].map((m) => str(m[1])).filter((x) => x && !/not be found|not found|^404/i.test(x));
    title = h1[0] || null;
  }
  if (!title || /not be found|page not found/i.test(title)) return null;
  const ownerM = first(t, [/truncate text-lg font-semibold","children":"((?:[^"\\]|\\.)*)"/, /"alt":"((?:[^"\\]|\\.)*) logo","width":56/]);
  const owner = ownerM ? str(ownerM[1]) : null;
  const near = ownerM ? t.slice(ownerM.index, ownerM.index + 1500) : "";
  const platM = t.match(/"platforms":\[((?:"[a-z]+",?)*)\]/);
  const platforms = platM ? [...platM[1].matchAll(/"([a-z]+)"/g)].map((m) => (m[1] === "twitter" ? "x" : m[1])) : [];
  // Payout block: the amount, then its unit ("per 1M views" / "per 1K views").
  // (The first "Payout" label is a loading skeleton with no amount; take the one that has one.)
  let rate = null;
  for (let pay = t.indexOf('"children":"Payout"'); pay >= 0 && rate == null; pay = t.indexOf('"children":"Payout"', pay + 1)) {
    const seg = t.slice(pay, pay + 700);
    const amt = seg.match(/"children":"\$?\$([0-9][0-9.,]*)"/);
    const unit = seg.match(/"children":"per (1M|1K|1k|1,000|1,000,000) views"/i);
    if (amt && unit) {
      const v = Number(amt[1].replace(/,/g, ""));
      const per = /m|000,000/i.test(unit[1]) ? 1000 : 1;
      if (isFinite(v)) rate = Math.round((v / per) * 10000) / 10000;
    }
  }
  const ageM = t.match(/"children":"(\d+\s*(?:m|min|h|d|w|mo|y)) ago"/);
  const ms = ageM ? agoMs(ageM[1]) : null;
  const perPost = /"children":"Per (Post|Video)"/.test(t);
  return {
    marketplace: NAME,
    id: "vyro:" + slug,
    title,
    owner,
    owner_verified: /Verified icon/.test(near),
    description: "",
    categories: [],
    platforms,
    payout_type: perPost ? "perPost" : "cpm",
    rate_per_1k: perPost ? null : rate,
    cap_per_clip: null,
    min_payout: null,
    budget_total: null,
    budget_spent: null,
    clippers: null,
    total_views: null,
    approved_clips: null,
    launched_at: ms != null ? new Date(now - ms).toISOString() : null,
    status: "active", // listed in Vyro's own campaign sitemap
    source_url: `${BASE}/campaigns/${slug}`,
    source_channels: [],
  };
}
