// Content Rewards, read only from pages its robots.txt allows (it disallows /api/, so we never
// touch /api/). Every live campaign is listed in /sitemap.xml as /c/campaigns/<id>; each of those
// pages is server-rendered with the full campaign object in its Next.js flight payload
// (self.__next_f) — the same shape the old feed returned, so normalize() is unchanged.
// The /c/discover pages carry fresher budget numbers and the current title: /clipping and /ugc
// are paged (?page=N, linked from each page), ~8 requests for nearly every listed campaign.
//
// The sitemap misses some open campaigns (2026-11-19: "GTA 6 x ARON ORLANDO MUSIC CLIPPING" was in
// neither it nor /c/discover). Extra ids come from CR's own GTA article and from boards that mirror
// CR (lib/sources/ssemble.js); their pages are read the same way and kept while they are active.
//
// Politeness: one request at a time, a pause between them, an identifying user agent, ~40 page
// loads per 30-minute run (more only while never-read campaigns are queued), and a doubling
// back-off on any 403/429/5xx.

const BASE = "https://contentrewards.com";
export const UA = "Mozilla/5.0 (compatible; heistclips/0.1; +https://heistclips.com/about)";
const DISCOVER = ["/c/discover", "/c/discover/clipping", "/c/discover/tiktok", "/c/discover/ugc"];
const PAGED = new Set(["/c/discover/clipping", "/c/discover/ugc"]);
const MAX_DISCOVER_PAGES = 8;
// CR's own articles that link live campaigns by id (the GTA one is updated as campaigns open).
export const ARTICLES = ["/articles/gta-6-clipping"];
// An extra (non-sitemap) id is kept this long after the last index that named it.
const EXTRA_TTL_MS = 3 * 864e5;
const NOT_LIVE = new Set(["ended", "paused", "draft", "cancelled", "canceled", "archived", "completed"]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class Blocked extends Error {}

export async function politeGet(path, { timeout = 20000 } = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(BASE + path, { headers: { "user-agent": UA, accept: "text/html,application/xml" }, signal: ctl.signal, redirect: "follow" });
    if (r.status === 403 || r.status === 429 || r.status >= 500) throw new Blocked(`${path} ${r.status}`);
    if (!r.ok) return null;
    return await r.text();
  } finally { clearTimeout(timer); }
}

// The RSC flight payload: every self.__next_f.push([1,"…"]) string, unescaped and joined.
export function flightText(html) {
  let out = "";
  const re = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;
  let m;
  while ((m = re.exec(html))) { try { out += JSON.parse('"' + m[1] + '"'); } catch (e) {} }
  return out;
}

// From index `start` (a "{"), return the balanced object text, string-aware; null if unbalanced.
function balanced(t, start) {
  let depth = 0, inStr = false;
  for (let i = start; i < t.length && i < start + 400000; i++) {
    const c = t[i];
    if (inStr) { if (c === "\\") i++; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) return t.slice(start, i + 1); }
  }
  return null;
}

// Every distinct object that carries `key` at its own top level.
export function objectsWithKey(t, key, test = () => true) {
  const out = new Map();
  const needle = `"${key}"`;
  let at = 0;
  while ((at = t.indexOf(needle, at)) >= 0) {
    for (let j = t.lastIndexOf("{", at), tries = 0; j >= 0 && tries < 60; j = t.lastIndexOf("{", j - 1), tries++) {
      const s = balanced(t, j);
      if (!s || j + s.length < at) continue;
      let o; try { o = JSON.parse(s); } catch (e) { continue; }
      if (o && typeof o === "object" && key in o) { if (test(o)) out.set(o.id || j, o); break; }
    }
    at += needle.length;
  }
  return [...out.values()];
}

// RSC dedupes repeated values into "$<row>:<path>" references, so one copy of the campaign can
// carry `categories: "$18:props:…"` while another copy has the real array. Merge every copy,
// preferring real values over references (categories went missing on 2026-11-16 without this).
const isRef = (v) => typeof v === "string" && /^\$[0-9a-z]+:/.test(v);
function mergeCopies(objs) {
  const out = {};
  for (const o of objs) for (const [k, v] of Object.entries(o)) {
    if (out[k] === undefined || isRef(out[k])) { if (!isRef(v) || out[k] === undefined) out[k] = v; }
    else if (k === "metrics" && v && typeof v === "object" && typeof out[k] === "object") out[k] = mergeCopies([out[k], v]);
  }
  return out;
}

export function campaignFromPage(html, id) {
  const t = flightText(html);
  let objs = objectsWithKey(t, "budgetCents", (o) => o.id && "payouts" in o);
  if (id) objs = objs.filter((o) => o.id === id);
  else if (objs.length) objs = objs.filter((o) => o.id === objs[0].id);
  // objectsWithKey keys by id, so also collect every other copy of this id.
  if (objs.length) {
    const cid = objs[0].id, more = [];
    let at = 0;
    while ((at = t.indexOf(`"id":"${cid}"`, at)) >= 0) {
      for (let j = t.lastIndexOf("{", at), tries = 0; j >= 0 && tries < 40; j = t.lastIndexOf("{", j - 1), tries++) {
        const sObj = balanced(t, j);
        if (!sObj || j + sObj.length < at) continue;
        try { const o = JSON.parse(sObj); if (o && o.id === cid && ("payouts" in o || "categories" in o)) more.push(o); } catch (e) { continue; }
        break;
      }
      at += 10;
    }
    objs = [...objs, ...more];
  }
  if (!objs.length) return null;
  const out = mergeCopies(objs);
  // The campaign's settings sit in a third copy with neither payouts nor categories: the
  // floors (minClipViews, a pool's minCreatorViews) and how many rules hide behind Join.
  const cfg = objectsWithKey(t, "configuration", (o) => o.id === out.id && o.configuration && typeof o.configuration === "object")[0];
  if (cfg) {
    out.configuration = cfg.configuration;
    if (cfg.briefCounts && typeof cfg.briefCounts === "object") out.briefCounts = cfg.briefCounts;
    if (cfg.metrics && cfg.metrics.poolSplit && typeof cfg.metrics.poolSplit === "object") out.metrics = { ...(out.metrics || {}), poolSplit: cfg.metrics.poolSplit };
  }
  return out;
}

// Discover pages carry campaign objects with *Raw budget fields at their top level (inside
// {campaign, metrics} cards on /c/discover, bare in initialResults on the category pages).
export function discoverCards(html) {
  const t = flightText(html);
  const metrics = new Map();
  for (const card of objectsWithKey(t, "campaign", (o) => o.campaign && o.campaign.id && o.metrics)) metrics.set(card.campaign.id, card.metrics);
  return objectsWithKey(t, "budgetTotalRaw", (o) => typeof o.id === "string" && o.id.length === 36)
    .map((c) => ({ campaign: c, metrics: metrics.get(c.id) || {} }));
}

// Keep what the ranker reads; drop clippers' names, avatars and ids (we never need them).
const arr = (x) => (Array.isArray(x) ? x : []);
const num = (x) => (typeof x === "number" ? x : null);

// The floors a clip must pass before it earns anything, from the campaign's settings block
// (lib/atsize.js). Null when the page had no settings block: then the floor is unknown.
export function settingsOf(raw) {
  const cfg = raw.configuration;
  if (!cfg || typeof cfg !== "object") return raw.settings && typeof raw.settings === "object" ? raw.settings : null;
  const bc = raw.briefCounts && typeof raw.briefCounts === "object" ? raw.briefCounts : {};
  const ps = raw.metrics && raw.metrics.poolSplit && typeof raw.metrics.poolSplit === "object" ? raw.metrics.poolSplit : null;
  return {
    minClipViews: num(cfg.minClipViews), minCreatorViews: num(cfg.minCreatorViews), maxSubmissionsPerUser: num(cfg.maxSubmissionsPerUser),
    hiddenRules: num(bc.contentRules), hiddenRequirements: num(bc.creatorRequirements), references: num(bc.references),
    poolShares: ps ? { creators: num(ps.creatorCount), top: arr(ps.topShareBps).filter((x) => typeof x === "number").slice(0, 10), other: num(ps.otherShareBps), final: !!ps.final } : null,
  };
}

export function slim(raw) {
  const m = raw.metrics && typeof raw.metrics === "object" ? raw.metrics : {};
  return {
    settings: settingsOf(raw),
    id: raw.id, name: raw.name, description: raw.description, categories: arr(raw.categories), platforms: arr(raw.platforms),
    payoutType: raw.payoutType, primaryPayoutCents: raw.primaryPayoutCents, geoPriced: raw.geoPriced,
    payouts: arr(raw.payouts).map((p) => ({ platform: p.platform, payoutType: p.payoutType, rateCents: p.rateCents, maxPayoutCents: p.maxPayoutCents, minPayoutCents: p.minPayoutCents })),
    budgetCents: raw.budgetCents, requiresApplication: raw.requiresApplication, status: raw.status,
    organizationName: raw.organizationName, organizationProfileHandle: raw.organizationProfileHandle, organizationVerified: raw.organizationVerified,
    createdAt: raw.createdAt, launchDate: raw.launchDate, listedAt: raw.listedAt, updatedAt: raw.updatedAt,
    metrics: {
      approvedSubmissionCount: num(m.approvedSubmissionCount), budgetSpentCents: num(m.budgetSpentCents), creatorCount: num(m.creatorCount),
      paidOutCents: num(m.paidOutCents), totalViews: num(m.totalViews), metricsUpdatedAt: m.metricsUpdatedAt,
      chartPoints: arr(m.chartPoints).slice(-14).map((p) => ({ bucket: p.bucket, totalViews: p.totalViews, approvedSubmissionCount: p.approvedSubmissionCount })),
      topEarners: arr(m.topEarners).map((e) => ({ earnedCents: e.earnedCents, approvedSubmissionCount: e.approvedSubmissionCount })),
      topClips: arr(m.topClips).map((c) => ({ totalViews: c.totalViews, platform: c.platform })),
    },
  };
}

// Fresher budget numbers from a discover card, folded into a cached campaign. The card also
// carries the current title: a campaign renamed to "… GTA 6 …" (PARKERRYT, DiegoLoveless on
// 2026-11-19) is GTA from this run on, and `_renamed` queues its page for a re-read.
// A GROUP card ({group: {campaignIds}}) carries one member's id but the group's title and total
// budget ("GTA 6", $15,000 over six campaigns on 2026-11-19): it says nothing about that one
// campaign, so it is skipped (it had been setting members' budgets to the group's total).
export function freshen(raw, card) {
  const c = card.campaign, m = card.metrics || {};
  if (c.group && typeof c.group === "object") return raw;
  const out = { ...raw, metrics: { ...raw.metrics } };
  if (typeof c.title === "string" && c.title.trim() && c.title !== raw.name) { out.name = c.title; out._renamed = true; }
  if (typeof c.budgetTotalRaw === "number") out.budgetCents = Math.round(c.budgetTotalRaw * 100);
  if (typeof c.budgetSpentRaw === "number") out.metrics.budgetSpentCents = Math.round(c.budgetSpentRaw * 100);
  if (typeof c.creatorCountRaw === "number") out.metrics.creatorCount = c.creatorCountRaw;
  for (const k of ["approvedSubmissionCount", "totalViews", "paidOutCents", "metricsUpdatedAt"]) if (m[k] != null) out.metrics[k] = m[k];
  if (Array.isArray(m.topEarners) && m.topEarners.length) out.metrics.topEarners = m.topEarners.map((e) => ({ earnedCents: e.earnedCents, approvedSubmissionCount: e.approvedSubmissionCount }));
  if (Array.isArray(m.chartPoints) && m.chartPoints.length) out.metrics.chartPoints = m.chartPoints.slice(-14).map((p) => ({ bucket: p.bucket, totalViews: p.totalViews, approvedSubmissionCount: p.approvedSubmissionCount }));
  out._fresh_at = new Date().toISOString();
  return out;
}

const STREAMY = /\bgta\b|grand theft auto|twitch|kick\.com|stream|marathon|gaming|fortnite|roblox|minecraft/i;
function settingsPriority(raw) {
  if (raw.payoutType === "pool") return 0;
  const cats = arr(raw.categories).map((c) => (c && (c.id || c.name)) || "").join(" ");
  return STREAMY.test(`${raw.name || ""} ${raw.description || ""} ${cats}`) ? 1 : 2;
}

const ID_RE = /\/c\/campaigns\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/g;
export const campaignIdsIn = (text) => [...new Set([...String(text || "").matchAll(ID_RE)].map((m) => m[1]))];

export async function liveIds() {
  const xml = await politeGet("/sitemap.xml");
  if (!xml) throw new Blocked("sitemap missing");
  return campaignIdsIn(xml);
}

// The next page of a paged discover list, as the page itself links it (href="<path>?page=N").
export function nextDiscoverPage(html, path, n) {
  return String(html || "").includes(`href="${path}?page=${n + 1}"`) ? `${path}?page=${n + 1}` : null;
}

// One refresh pass over the cache { campaigns: {id: {raw, fetched_at}}, extra: {id: last_seen},
// backoff_until, backoff_ms }. `extraIds`: CR ids other boards name (lib/sources/index.js).
// `maxPages` re-reads per run; `maxNew` more for ids never read yet (a backlog clears in a few runs).
export async function refreshCache(cache, { maxPages = 26, maxNew = 24, pauseMs = 700, extraIds = [], log = () => {} } = {}) {
  cache = cache || { campaigns: {} };
  cache.campaigns = cache.campaigns || {};
  cache.extra = cache.extra && typeof cache.extra === "object" ? cache.extra : {};
  const now = Date.now();
  if (cache.backoff_until && Date.parse(cache.backoff_until) > now) { log("backing off until " + cache.backoff_until); return { cache, fetched: 0, skipped: "backoff" }; }
  let fetched = 0, discover = 0, discoverPages = 0, renamed = 0;
  try {
    const ids = await liveIds();
    const inSitemap = new Set(ids);
    // Extra ids: CR's own articles, plus what other boards mirror. Seen now = stamped now.
    const seenNow = new Set(extraIds);
    for (const path of ARTICLES) {
      await sleep(pauseMs);
      const html = await politeGet(path).catch((e) => { if (e instanceof Blocked) throw e; return null; });
      for (const id of campaignIdsIn(html)) seenNow.add(id);
    }
    const stamp = new Date(now).toISOString();
    for (const id of seenNow) if (!inSitemap.has(id)) cache.extra[id] = stamp;
    for (const [id, at] of Object.entries(cache.extra)) if (inSitemap.has(id) || now - Date.parse(at) > EXTRA_TTL_MS) delete cache.extra[id];
    const extra = Object.keys(cache.extra);
    const live = new Set([...ids, ...extra]);
    for (const id of Object.keys(cache.campaigns)) if (!live.has(id)) delete cache.campaigns[id];
    for (const path of DISCOVER) {
      let p = path;
      for (let n = 1; p && n <= (PAGED.has(path) ? MAX_DISCOVER_PAGES : 1); n++) {
        await sleep(pauseMs);
        const html = await politeGet(p);
        discoverPages++;
        if (!html) break;
        const cards = discoverCards(html);
        for (const card of cards) {
          const g = card.campaign.group;
          if (g && typeof g === "object") {
            // Members whose cached budget is the group's total got it from this card before the
            // fix above: re-read their own pages (LACY, YourRAGE, Clix showed $15,000, 2026-11-19).
            const total = typeof card.campaign.budgetTotalRaw === "number" ? Math.round(card.campaign.budgetTotalRaw * 100) : null;
            const members = Array.isArray(g.campaignIds) ? g.campaignIds : [];
            if (members.length > 1) for (const gid of members) { const ge = cache.campaigns[gid]; if (ge && ge.raw && total != null && ge.raw.budgetCents === total) ge.raw._reread = true; }
            continue;
          }
          const e = cache.campaigns[card.campaign.id];
          if (e && e.raw) { e.raw = freshen(e.raw, card); discover++; if (e.raw._renamed) renamed++; }
        }
        p = cards.length ? nextDiscoverPage(html, path, n) : null;
      }
    }
    // Extras first: they are few, and the GTA article is where they come from.
    const missing = [...extra, ...ids].filter((id) => !cache.campaigns[id]);
    const renamedIds = Object.entries(cache.campaigns).filter(([, e]) => e.raw && (e.raw._renamed || e.raw._reread)).map(([id]) => id);
    // Pages read before 2026-11-19 lack the settings block (the floors): pools first, since their
    // bar lives nowhere else, then streamer and gaming campaigns, then the rest by age.
    const noSettings = Object.entries(cache.campaigns).filter(([, e]) => e.raw && !e.raw.settings).map(([id, e]) => [id, settingsPriority(e.raw)])
      .sort((a, b) => a[1] - b[1]).map(([id]) => id);
    const stale = Object.entries(cache.campaigns).sort((a, b) => Date.parse(a[1].fetched_at || 0) - Date.parse(b[1].fetched_at || 0)).map(([id]) => id);
    // Never-read ids get their own budget on top of the re-reads (the sitemap lists new
    // campaigns first, so a new launch is read on the next run even during a backlog).
    const fresh = missing.slice(0, maxNew);
    const rest = [...new Set([...renamedIds, ...missing.slice(maxNew), ...noSettings, ...stale])].slice(0, maxPages);
    const todo = [...fresh, ...rest];
    for (const id of todo) {
      await sleep(pauseMs);
      const html = await politeGet("/c/campaigns/" + id);
      fetched++;
      const raw = html && campaignFromPage(html, id);
      // A page read with no settings block is marked, so it is not fetched first forever.
      if (raw && raw.id === id) { const s = slim(raw); if (!s.settings) s.settings = { missing: true }; cache.campaigns[id] = { raw: s, fetched_at: new Date().toISOString() }; }
      else if (!cache.campaigns[id]) cache.campaigns[id] = { raw: null, fetched_at: new Date().toISOString() };
      else cache.campaigns[id].fetched_at = new Date().toISOString();
    }
    cache.backoff_ms = 0; cache.backoff_until = null;
    cache.last_ok = new Date().toISOString();
    return { cache, fetched, discover, discover_pages: discoverPages, renamed, live: ids.length, extra: extra.length, new_read: fresh.length };
  } catch (e) {
    if (!(e instanceof Blocked) && e.name !== "AbortError") throw e;
    cache.backoff_ms = Math.min(24 * 3600e3, (cache.backoff_ms || 30 * 60e3) * 2);
    cache.backoff_until = new Date(now + cache.backoff_ms).toISOString();
    log("blocked: " + e.message + "; backing off " + Math.round(cache.backoff_ms / 60e3) + " min");
    return { cache, fetched, discover, error: e.message };
  }
}

// Open campaigns only: a paused one takes no clips (TOMO GTA VI, 2026-11-19: paused, budget spent).
export function rawCampaigns(cache) {
  return Object.values((cache && cache.campaigns) || {}).map((e) => e.raw).filter((r) => r && !NOT_LIVE.has(String(r.status || "").toLowerCase()));
}
