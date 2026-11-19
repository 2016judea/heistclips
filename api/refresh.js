// Cron, every 30 min: refresh the campaign-page cache from pages Content Rewards' robots.txt
// allows (never /api/), rank, store, and tell IndexNow (Bing, which feeds ChatGPT search;
// Yandex; Seznam; Naver) which pages changed.
import { buildSnapshot } from "../lib/campaigns.js";
import { refreshCache, rawCampaigns } from "../lib/crpages.js";
import { liveGtaStreams, liveKick, handlesFromCampaigns, mergeStreamers } from "../lib/streamers.js";
import { putJSON, getJSON } from "../lib/store.js";
import { sitemapUrls } from "./page.js";
import { sweepOld } from "../lib/blobfiles.js";
import { archiveEnded } from "../lib/ended.js";
import { buildTrend } from "../lib/trend.js";

const SITE = "https://heistclips.com";
const HOST = "heistclips.com";
const INDEXNOW_KEY = "066cce158f4bc73e04afdcb48bb189f7";


export async function pingIndexNow(paths) {
  const urlList = [...new Set(paths)].slice(0, 10000).map((p) => SITE + p);
  if (!urlList.length) return { sent: 0 };
  const r = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: HOST, key: INDEXNOW_KEY, keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`, urlList }),
  });
  return { sent: urlList.length, status: r.status };
}

export default async function handler(req, res) {
  const auth = req.headers["authorization"] || "";
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) { res.statusCode = 401; return res.end("no"); }
  const t0 = Date.now();
  const cached = await getJSON("cr/pages.json", { fresh: true }).catch(() => null);
  const crawl = await refreshCache(cached, { maxPages: 26, pauseMs: 700 });
  await putJSON("cr/pages.json", crawl.cache, { maxAge: 60 });
  const prev = await getJSON("snapshot/latest.json", { fresh: true }).catch(() => null);
  const raw = rawCampaigns(crawl.cache);
  if (raw.length < 50 && prev) { // a broken crawl must not wipe the ranker
    res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify({ ok: false, kept_previous: true, crawl: { fetched: crawl.fetched, error: crawl.error, cached: raw.length } }));
  }
  const snap = buildSnapshot(raw);
  snap.source = "contentrewards.com public campaign pages (sitemap + /c/discover)";
  snap.crawl = { fetched: crawl.fetched, freshened: crawl.discover, live: crawl.live, error: crawl.error || null, backoff_until: crawl.cache.backoff_until || null };
  let live = [];
  try { live = [...(await liveGtaStreams(40)).map((s) => ({ ...s, platform: "twitch" })), ...(await liveKick())]; } catch (e) {}
  snap.streamers = mergeStreamers(prev && prev.streamers, live, handlesFromCampaigns(snap.campaigns), snap.generated_at);
  await putJSON("snapshot/latest.json", snap, { maxAge: 60 });

  // Campaigns that just left the snapshot keep their page (lib/ended.js).
  let ended = null;
  try { ended = await archiveEnded(prev, snap, new Set(raw.map((r) => r.id))); } catch (e) { ended = "error: " + e.message; }
  // Most-clipped streams, rebuilt once an hour (lib/trend.js).
  let trend = null;
  try {
    const last = await getJSON("trend/latest.json", { fresh: true }).catch(() => null);
    // ?trend=now rebuilds at once (after lib/trend_exclude.json changes).
    const force = new URL(req.url || "/", SITE).searchParams.get("trend") === "now";
    if (force || !last || Date.now() - Date.parse(last.generated_at) > 50 * 60 * 1000) { const t = await buildTrend(); trend = { clips: t.clips_counted, streams: t.streams.length, moments: t.moments.length }; }
  } catch (e) { trend = "error: " + e.message; }

  // Summary history for the rates page (last ~10 days at 30-min steps).
  let hist = (await getJSON("snapshot/history.json", { fresh: true }).catch(() => null)) || [];
  hist.push({ at: snap.generated_at, summary: snap.summary });
  hist = hist.slice(-500);
  await putJSON("snapshot/history.json", hist, { maxAge: 60 });

  // IndexNow: new pages always; the rolling pages at most every 6 hours; everything on first run.
  const nowPaths = sitemapUrls(snap);
  let paths;
  if (!prev) paths = nowPaths;
  else {
    const before = new Set(sitemapUrls(prev));
    paths = nowPaths.filter((p) => !before.has(p));
    const prevSent = Date.parse((prev.indexnow && prev.indexnow.rolling_at) || 0);
    if (Date.now() - prevSent > 6 * 3600 * 1000) paths.push("/", "/gta-6-clipping-campaigns", "/gta-6-clipping-rates-today", "/streamers", "/guides/how-much-does-gta-6-clipping-pay", "/most-clipped-streams", "/data");
  }
  let ping = { sent: 0 };
  if (process.env.INDEXNOW_OFF) { ping = { skipped: paths.length }; paths = []; }
  else try { ping = await pingIndexNow(paths); } catch (e) { ping = { error: String(e) }; }
  const rolling = paths.includes("/gta-6-clipping-rates-today") ? snap.generated_at : (prev && prev.indexnow && prev.indexnow.rolling_at) || null;
  if (rolling !== ((prev && prev.indexnow && prev.indexnow.rolling_at) || null)) {
    snap.indexnow = { rolling_at: rolling };
    await putJSON("snapshot/latest.json", snap, { maxAge: 60 });
  } else if (prev && prev.indexnow) {
    snap.indexnow = prev.indexnow;
    await putJSON("snapshot/latest.json", snap, { maxAge: 60 });
  }
  res.setHeader("content-type", "application/json");
  // Server-cut clips and upload parts are kept 72 hours (lib/blobfiles.js).
  let swept = null;
  try { swept = await sweepOld(); } catch (e) { swept = "error: " + e.message; }
  res.end(JSON.stringify({ ok: true, swept, ended, trend, ms: Date.now() - t0, campaigns: snap.campaigns.length, crawl: snap.crawl, gta: snap.summary.gta, streamers: snap.streamers.length, live_gta: live.length, indexnow: ping }));
}
