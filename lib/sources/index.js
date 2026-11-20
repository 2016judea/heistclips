// Campaigns on marketplaces other than Content Rewards (DATA_MODEL.md "Campaigns across
// marketplaces"). Each source reads only public pages its robots.txt allows, one request at a
// time per host, with the crawler's user agent and a doubling back-off per host on 403/429/5xx.
//
//   Ssemble    /clip-rewards (1 page: the whole board)                   lib/sources/ssemble.js
//   Clipstake  /marketplace (1 page: every campaign with its status)     lib/sources/clipstake.js
//   Vyro       /sitemap/campaigns.xml + each campaign page (re-read 6 h) lib/sources/vyro.js
//   Clipster   skipped: its list loads from /api (robots-disallowed) and its public campaign
//              page has no status or budget left, so a spent campaign would show as live.
//
// The cache (Blob mk/pages.json) keeps each source's last good read, so one failed fetch leaves
// that marketplace's campaigns in place instead of dropping them.
import { UA, Blocked } from "../crpages.js";
import * as ssemble from "./ssemble.js";
import * as clipstake from "./clipstake.js";
import * as vyro from "./vyro.js";

export const MARKETPLACES = [ssemble.NAME, vyro.NAME, clipstake.NAME];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const VYRO_REREAD_MS = 6 * 3600e3;
const LIVE = new Set(["active", "live", "open"]);

export async function politeFetch(url, { timeout = 20000 } = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(url, { headers: { "user-agent": UA, accept: "text/html,application/xml" }, signal: ctl.signal, redirect: "follow" });
    if (r.status === 403 || r.status === 429 || r.status >= 500) throw new Blocked(`${url} ${r.status}`);
    if (!r.ok) return null;
    return await r.text();
  } finally { clearTimeout(timer); }
}

// Run one source under its own back-off. `fn(entry)` mutates the entry and returns a note.
async function guarded(cache, name, fn, log) {
  const e = (cache.sources[name] = cache.sources[name] || {});
  const now = Date.now();
  if (e.backoff_until && Date.parse(e.backoff_until) > now) return { name, skipped: "backoff" };
  try {
    const note = await fn(e);
    e.backoff_ms = 0; e.backoff_until = null; e.error = null; e.ok_at = new Date().toISOString();
    return { name, ...note };
  } catch (err) {
    if (!(err instanceof Blocked) && err.name !== "AbortError") { e.error = String(err.message || err); log(name + ": " + e.error); return { name, error: e.error }; }
    e.backoff_ms = Math.min(24 * 3600e3, (e.backoff_ms || 30 * 60e3) * 2);
    e.backoff_until = new Date(now + e.backoff_ms).toISOString();
    e.error = err.message;
    log(name + " blocked: " + err.message);
    return { name, error: err.message, backoff_until: e.backoff_until };
  }
}

export async function refreshMarketplaces(cache, { pauseMs = 700, log = () => {}, fetchText = politeFetch, maxVyroPages = 10 } = {}) {
  cache = cache && typeof cache === "object" ? cache : {};
  cache.sources = cache.sources || {};
  const runs = await Promise.all([
    guarded(cache, ssemble.NAME, async (e) => {
      const html = await fetchText(ssemble.BASE + ssemble.LIST);
      if (!html) throw new Error("no page");
      const { own, mirrorIds, rows } = ssemble.parseSsemble(html);
      if (!rows) throw new Error("board not found in page");
      e.items = own; e.mirror_ids = mirrorIds; e.fetched_at = new Date().toISOString();
      return { campaigns: own.length, mirrors: mirrorIds.length };
    }, log),
    guarded(cache, clipstake.NAME, async (e) => {
      const html = await fetchText(clipstake.BASE + clipstake.LIST);
      if (!html) throw new Error("no page");
      const { all, rows } = clipstake.parseClipstake(html);
      if (!rows) throw new Error("no campaigns in page");
      e.items = all; e.fetched_at = new Date().toISOString();
      return { campaigns: all.length };
    }, log),
    guarded(cache, vyro.NAME, async (e) => {
      const xml = await fetchText(vyro.BASE + vyro.SITEMAP);
      if (!xml) throw new Error("no campaign sitemap");
      const slugs = vyro.vyroSlugs(xml);
      e.pages = e.pages || {};
      for (const s of Object.keys(e.pages)) if (!slugs.includes(s)) delete e.pages[s];
      const now = Date.now();
      const todo = slugs.filter((s) => !e.pages[s] || now - Date.parse(e.pages[s].fetched_at || 0) > VYRO_REREAD_MS).slice(0, maxVyroPages);
      for (const s of todo) {
        await sleep(pauseMs);
        const html = await fetchText(`${vyro.BASE}/campaigns/${s}`);
        const item = html ? vyro.parseVyro(html, s) : null;
        if (item) e.pages[s] = { item, fetched_at: new Date().toISOString() };
        else if (!html) delete e.pages[s];
      }
      e.items = slugs.map((s) => e.pages[s] && e.pages[s].item).filter(Boolean);
      e.fetched_at = new Date().toISOString();
      return { campaigns: e.items.length, read: todo.length };
    }, log),
  ]);
  return { cache, runs };
}

// Every open campaign from every source, in the generic shape lib/campaigns.js normalizeOther() reads.
export function otherCampaigns(cache) {
  const out = [];
  for (const name of MARKETPLACES) {
    const e = cache && cache.sources && cache.sources[name];
    for (const c of (e && e.items) || []) if (c && c.title && (c.status == null || LIVE.has(String(c.status).toLowerCase()))) out.push(c);
  }
  return out;
}

// Content Rewards ids that other boards mirror (fed to lib/crpages.js as extra pages to read).
export function mirroredCrIds(cache) {
  const e = cache && cache.sources && cache.sources[ssemble.NAME];
  return (e && Array.isArray(e.mirror_ids) && e.mirror_ids) || [];
}
