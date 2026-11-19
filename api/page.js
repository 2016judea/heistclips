// One function renders every HTML page (and the sitemap/robots/llms.txt), off the latest snapshot.
import { latestSnapshot, getJSON } from "../lib/store.js";
import * as R from "../lib/render.js";
import { guidePage, guidesIndex, ratesPage, GUIDES } from "../lib/guides.js";
import { getChannel } from "../public/js/twitch.js";
import { loadBoard, publicList } from "../lib/requests.js";
import { splitLang, href, isLocal, LANGS } from "../lib/i18n.js";
import { localPage, notFoundPage } from "../lib/pages_l10n.js";
import { TR_LANGS } from "../lib/translate.js";
import { TOOLS as MCP_TOOLS } from "./mcp.js";
import { queuePage } from "../lib/queuepage.js";
import { loadPitch, pitchPage } from "../lib/pitch.js";
import * as S from "../lib/searchpages.js";
import { loadTrend } from "../lib/trend.js";
import { loadEnded, findEnded } from "../lib/ended.js";
import { campaignsFor } from "../lib/autopilot.js";
import * as NEW from "../lib/changelog.js";
import { whatsNewPage, whatsNewFeed } from "../lib/changelogpage.js";

const INDEXNOW_KEY = "066cce158f4bc73e04afdcb48bb189f7";
// Data files are meant to be fetched by other sites and by assistants.
const sendData = (res, body, type) => { res.setHeader("access-control-allow-origin", "*"); return send(res, 200, body, type, 600); };

function send(res, status, body, type = "text/html; charset=utf-8", maxAge = 300) {
  res.statusCode = status;
  res.setHeader("content-type", type);
  res.setHeader("cache-control", `public, max-age=60, s-maxage=${maxAge}, stale-while-revalidate=86400`);
  res.end(body);
}

// Canonical 200 pages only: no redirects and no ?f= filter views (those point their canonical at
// the unfiltered page). `trend` (optional) adds the streamers people clip who are not in the snapshot.
export function sitemapUrls(snap, trend = null) {
  const streamerPath = (s) => (s.platform === "kick" ? "/streamers/kick/" : "/streamers/") + s.login;
  const inSnap = (snap.streamers || []).filter((s) => s.platform === "twitch" ? /^[a-z0-9_]{3,25}$/.test(s.login) : /^[a-z0-9_-]{2,40}$/.test(s.login));
  const clipped = ((trend && trend.streams) || []).filter((s) => s.platform === "twitch" && /^[a-z0-9_]{3,25}$/.test(s.login)); // a Kick page needs its snapshot row
  const urls = ["/", "/clip", "/twitch-clip-maker", "/kick-clip-maker", "/most-clipped-streams", "/queue", "/requests", NEW.PATH, "/gta-6-clipping-campaigns", "/gta-6-clipping-rates-today", "/streamers", "/guides", "/data", "/pricing", "/connect", "/about", "/privacy", "/terms",
    ...GUIDES.map((g) => "/guides/" + g.slug),
    ...snap.campaigns.map((c) => "/campaigns/" + c.slug),
    ...new Set([...inSnap, ...clipped].map(streamerPath))];
  // Each translated page, in each language.
  const base = urls.filter((x) => !x.includes("?") && isLocal(x));
  for (const l of LANGS) if (l !== "en") for (const x of base) urls.push(href(l, x));
  return urls;
}

// The record behind /campaigns/<slug>: live, moved (a 301 to its current slug), ended, or none.
async function campaignCtx(snap, slug) {
  const c = snap.campaigns.find((x) => x.slug === slug) || snap.campaigns.find((x) => slug.endsWith("-" + x.id.split("-")[0]));
  if (c) return c.slug !== slug ? { redirect: c.slug } : { campaign: c };
  // Not live any more: the page stays, marked ended, with what pays now (lib/ended.js).
  const e = findEnded(await loadEnded().catch(() => ({})), slug);
  if (e && e.campaign.slug !== slug) return { redirect: e.campaign.slug };
  if (e) return { ended: e };
  // A campaign-shaped URL we hold no record of (it closed before 2026-11-19): still an answer, not indexed.
  if (/-[0-9a-f]{8}$/.test(slug)) return { ended: { slug } };
  return null;
}

// The streamer behind /streamers/<login>. Twitch: any real channel. Kick: channels in the snapshot
// (Kick throttles reads, so the page is built from the 30-minute snapshot row, not a live call).
async function streamerCtx(snap, kick, login) {
  if (!kick && !/^[a-z0-9_]{3,25}$/.test(login)) return null;
  const s = (snap.streamers || []).find((x) => x.login === login && (x.platform === "kick") === kick);
  let chan = null;
  if (!kick) { try { chan = await getChannel(login); } catch (e) {} }
  else if (s) chan = { name: s.name, avatar: s.avatar, is_live: !!s.live_now, stream: s.live_now ? { viewers: s.viewers_now, game: s.game, title: s.last_title } : null, vods: [] };
  if (!s && !chan) return null;
  const row = s || { login, name: chan.name, platform: "twitch" };
  const who = { platform: kick ? "kick" : "twitch", login, name: (chan && chan.name) || row.name || login };
  const ids = new Set((s && s.campaign_ids) || []);
  const camps = snap.campaigns.filter((c) => c.budget_left > 0 && (ids.has(c.id) || campaignsFor(who, [c]).length));
  return { row, chan, camps, trend: await loadTrend().catch(() => null) };
}

// Paths that are English on purpose (or are files, not pages): a /de/… request goes to the English one.
const ENGLISH_ONLY = /^\/(?:for\/|data\/|llms(?:-full)?\.txt$|sitemap\.xml$|robots\.txt$|\.well-known\/|post$|[0-9a-f]{32}\.txt$)/;

export default async function handler(req, res) {
  const u = new URL(req.url, "https://heistclips.com");
  const p = (u.searchParams.get("p") || u.pathname).replace(/\/+$/, "") || "/";
  try {
    if (p === "/robots.txt") {
      return send(res, 200, `User-agent: *\nAllow: /\nDisallow: /api/\n\n# AI search and assistants are welcome\nUser-agent: OAI-SearchBot\nAllow: /\nUser-agent: ChatGPT-User\nAllow: /\nUser-agent: GPTBot\nAllow: /\nUser-agent: xAI-Bot\nAllow: /\nUser-agent: GrokBot\nAllow: /\nUser-agent: Grok\nAllow: /\nUser-agent: ClaudeBot\nAllow: /\nUser-agent: Claude-SearchBot\nAllow: /\nUser-agent: Claude-User\nAllow: /\nUser-agent: PerplexityBot\nAllow: /\nUser-agent: Google-Extended\nAllow: /\nUser-agent: Bingbot\nAllow: /\n\nSitemap: ${R.SITE}/sitemap.xml\n`, "text/plain; charset=utf-8", 3600);
    }
    if (p === `/${INDEXNOW_KEY}.txt`) return send(res, 200, INDEXNOW_KEY, "text/plain; charset=utf-8", 86400);
    const snap = await latestSnapshot();
    if (!snap) return send(res, 503, R.layout({ title: "heistclips", desc: "Warming up", body: "<h1>Warming up.</h1><p>The first campaign refresh is running. Try again in a minute.</p>", noindex: true }), undefined, 10);

    if (p === "/sitemap.xml") {
      const lastmod = snap.generated_at;
      const [trend, ended] = await Promise.all([loadTrend().catch(() => null), loadEnded().catch(() => ({}))]);
      const fresh = sitemapUrls(snap, trend);
      const liveSlugs = new Set(snap.campaigns.map((c) => c.slug));
      // Ended campaigns stay listed, marked old and low priority, so their pages stay known without looking fresh.
      const old = Object.entries(ended || {}).filter(([slug, e]) => e.campaign && !liveSlugs.has(slug)).sort((a, b) => Date.parse(b[1].ended_at) - Date.parse(a[1].ended_at)).slice(0, 3000)
        .map(([slug, e]) => `<url><loc>${R.SITE}/campaigns/${slug}</loc><lastmod>${e.ended_at}</lastmod><priority>0.1</priority></url>`);
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...fresh.map((x) => `<url><loc>${R.SITE}${x.replace(/&/g, "&amp;")}</loc><lastmod>${lastmod}</lastmod></url>`), ...old].join("\n")}\n</urlset>`;
      return send(res, 200, xml, "application/xml; charset=utf-8", 600);
    }
    if (p === "/llms-full.txt") return sendData(res, S.llmsFull(snap, await loadTrend().catch(() => null), MCP_TOOLS, GUIDES) + NEW.llmsText(), "text/plain; charset=utf-8");
    if (p === S.RATES_CSV) return sendData(res, S.ratesCsv(snap), "text/csv; charset=utf-8");
    if (p === S.RATES_JSON) return sendData(res, S.ratesJson(snap), "application/json; charset=utf-8");
    if (p === S.TREND_JSON) return sendData(res, S.trendJson(await loadTrend()), "application/json; charset=utf-8");
    if (p === "/llms.txt") {
      const s = snap.summary;
      const top = snap.campaigns.filter((c) => c.is_gaming).slice(0, 10).map((c) => `- [${c.title}](${R.SITE}/campaigns/${c.slug}): ${c.expected_per_clip != null ? "$" + c.expected_per_clip + " typical per clip" : "new"}, $${c.rate_per_1k ?? c.per_post}/${c.per_post != null ? "post" : "1k views"}, cap $${c.cap_per_clip ?? "none"}, $${Math.round(c.budget_left)} left`).join("\n");
      return send(res, 200, `# heistclips\n\n> Clip maker for Twitch and Kick streams, built for GTA 6 clipping. Finds the moments chat exploded in a stream (live or VOD), cuts them to 9:16 with hook text in the browser, flags licensed-music risk, and ranks clipping campaigns by what a typical approved clip actually earns. ${R.FREE_CLIPS} clips free, then pay per exported clip, never per stream minute. No watermark.\n\nData updated ${snap.generated_at}: ${s.campaigns} live campaigns, ${s.gta} GTA; median $${s.rate_per_1k_median}/1k views; typical approved clip earns $${s.earned_per_clip_median}.\n\n## Pages\n- [Clip tool](${R.SITE}/clip): open on a streamer with ${R.SITE}/clip?q=<twitch login> or ?q=kick.com/<slug>\n- [Twitch clip maker](${R.SITE}/twitch-clip-maker)\n- [Kick clip maker](${R.SITE}/kick-clip-maker)\n- [Most clipped streams right now](${R.SITE}${S.TREND_PATH}): streams and moments clippers are cutting, updated hourly\n- [How to clip a streamer](${R.SITE}/streamers): one page per streamer at ${R.SITE}/streamers/<twitch login>\n- [Campaigns ranked by pay per clip](${R.SITE}/gta-6-clipping-campaigns)\n- [GTA 6 clipping rates today](${R.SITE}/gta-6-clipping-rates-today)\n- [Pricing](${R.SITE}/pricing)\n${NEW.llmsLine()}\n${GUIDES.map((g) => `- [${g.title}](${R.SITE}/guides/${g.slug})`).join("\n")}\n\n## Top gaming campaigns right now\n${top}\n\n## Data (free to quote, please link back)\n- [Everything in one text file](${R.SITE}/llms-full.txt)\n- [Campaign rates, CSV](${R.SITE}${S.RATES_CSV})\n- [Campaign rates, JSON with field notes](${R.SITE}${S.RATES_JSON})\n- [Most clipped streams, JSON](${R.SITE}${S.TREND_JSON})\n- [Field notes and licence](${R.SITE}${S.DATA_PATH})\n- JSON API: ${R.SITE}/api/campaigns?filter=gta|gaming|all\n\n## Connector (MCP)\n- [Add heistclips to ChatGPT, Claude or Grok](${R.SITE}/connect)\n- MCP server (streamable HTTP, no key): ${R.SITE}/mcp  (tools: ${MCP_TOOLS.map((t) => t.name).join(", ")})\n- Source: https://github.com/2016judea/heistclips\n`, "text/plain; charset=utf-8", 600);
    }

    // What's new: the Atom feed (one per language) and the English page; /de/whats-new etc. go through localPage.
    const feed = p.match(/^(?:\/(de|fr|pt|es))?\/whats-new\.xml$/);
    if (feed) return sendData(res, whatsNewFeed(feed[1] || "en"), "application/atom+xml; charset=utf-8");
    if (p === NEW.PATH) return send(res, 200, whatsNewPage("en"), undefined, 600);

    // /de/…, /fr/…, /pt/…, /es/…: the same page in that language where one exists, else the English page.
    const loc = splitLang(p);
    if (loc.lang !== "en") {
      const lp = loc.path, ctx = { snap, query: u.searchParams, tools: MCP_TOOLS };
      let lm;
      if (lp === "/requests") ctx.board = publicList(await loadBoard());
      if (lp === "/gta-6-clipping-rates-today") { try { ctx.history = (await getJSON("snapshot/history.json")) || []; } catch (e) {} }
      if (S.MAKERS[lp] || lp === S.TREND_PATH || lp === S.DATA_PATH) ctx.trend = await loadTrend().catch(() => null);
      if ((lm = lp.match(/^\/campaigns\/([a-z0-9-]+)$/))) {
        const r = await campaignCtx(snap, lm[1]);
        if (r && r.redirect) { res.statusCode = 301; res.setHeader("location", href(loc.lang, "/campaigns/" + r.redirect)); return res.end(); }
        if (r) { ctx.campaign = r.campaign; ctx.ended = r.ended; }
      }
      if ((lm = lp.match(/^\/streamers\/(kick\/)?([a-z0-9_-]{2,40})$/))) ctx.streamer = await streamerCtx(snap, !!lm[1], lm[2]);
      const html = localPage(loc.lang, lp, ctx);
      const slow = ["/clip", "/pricing", "/queue", "/connect", "/about", "/privacy", "/terms", "/guides"].includes(lp) || (ctx.ended && !ctx.campaign);
      if (html) return send(res, 200, html, undefined, lp === "/requests" ? 30 : slow ? 3600 : ctx.streamer || ctx.trend ? 600 : 300);
      if (ENGLISH_ONLY.test(lp)) {
        const q = new URLSearchParams(u.searchParams); q.delete("p");
        res.statusCode = 302; res.setHeader("location", lp + (q.toString() ? "?" + q : "")); return res.end();
      }
      return send(res, 404, notFoundPage(loc.lang), undefined, 60);
    }
    if (p === "/") return send(res, 200, R.homePage(snap));
    let fm;
    if ((fm = p.match(/^\/for\/([A-Za-z0-9_-]{2,64})$/i))) {
      // A slug with a stored pitch (a streamer clippers pull with no campaign paying) gets its
      // own page; every other slug keeps the home page, as the 11/16 links expect.
      const pitch = await loadPitch(fm[1].toLowerCase());
      if (pitch) return send(res, 200, pitchPage(snap, pitch), undefined, 300);
      return send(res, 200, R.homePage(snap, "/for/" + fm[1]), undefined, 300);
    }
    if (p === "/requests") {
      // Rendered in ?lang= when given (a /de or /fr path passes its own); otherwise English, and
      // the page's script re-reads the list in the browser's language. Never by Accept-Language
      // here: this HTML is cached by URL.
      const rl = TR_LANGS.includes(u.searchParams.get("lang")) ? u.searchParams.get("lang") : "en";
      return send(res, 200, R.requestsPage(publicList(await loadBoard(), null, rl), rl), undefined, 30);
    }
    if (p === "/.well-known/openai-apps-challenge") {
      if (!process.env.OPENAI_APPS_CHALLENGE) return send(res, 404, "not set", "text/plain", 10);
      return send(res, 200, process.env.OPENAI_APPS_CHALLENGE, "text/plain; charset=utf-8", 60);
    }
    if (p === "/clip") return send(res, 200, R.clipPage(u.searchParams.get("q") || ""), undefined, 3600);
    if (p === "/gta-6-clipping-campaigns") return send(res, 200, R.rankerPage(snap, u.searchParams.get("f") || "gaming"));
    if (p === "/gta-6-clipping-rates-today") {
      let hist = [];
      try { hist = (await getJSON("snapshot/history.json")) || []; } catch (e) {}
      return send(res, 200, ratesPage(snap, hist));
    }
    if (p === "/queue") return send(res, 200, queuePage(), undefined, 3600);
    if (p === "/pricing") return send(res, 200, R.pricingPage(), undefined, 3600);
    if (p === "/connect") return send(res, 200, R.connectPage(MCP_TOOLS), undefined, 3600);
    if (p === "/about") return send(res, 200, R.aboutPage(), undefined, 3600);
    if (p === "/privacy") return send(res, 200, R.privacyPage(), undefined, 3600);
    if (p === "/terms") return send(res, 200, R.termsPage(), undefined, 3600);
    if (p === "/guides") return send(res, 200, guidesIndex(snap), undefined, 3600);
    if (p === "/streamers") return send(res, 200, R.streamersIndex(snap));
    let m;
    if ((m = p.match(/^\/guides\/([a-z0-9-]+)$/))) {
      const html = guidePage(snap, m[1]);
      return html ? send(res, 200, html) : send(res, 404, R.notFound());
    }
    if ((m = p.match(/^\/campaigns\/([a-z0-9-]+)$/))) {
      const r = await campaignCtx(snap, m[1]);
      if (!r) return send(res, 404, R.notFound(), undefined, 60);
      if (r.redirect) { res.statusCode = 301; res.setHeader("location", "/campaigns/" + r.redirect); return res.end(); }
      if (r.ended) return send(res, 200, S.endedPage(snap, r.ended), undefined, 3600);
      return send(res, 200, R.campaignPage(snap, r.campaign));
    }
    if (S.MAKERS[p]) return send(res, 200, S.makerPage(p, await loadTrend().catch(() => null), "en"), undefined, 600);
    if (p === S.TREND_PATH) return send(res, 200, S.trendPage(await loadTrend(), "en"), undefined, 600);
    if (p === S.DATA_PATH) return send(res, 200, S.dataPage(snap, await loadTrend().catch(() => null)), undefined, 600);
    // "How to clip <streamer>" (streamerCtx above).
    if ((m = p.match(/^\/streamers\/(kick\/)?([a-z0-9_-]{2,40})$/))) {
      const w = await streamerCtx(snap, !!m[1], m[2]);
      if (!w) return send(res, 404, R.notFound(), undefined, 60);
      return send(res, 200, S.streamerHowTo(snap, w.row, w.chan, w.camps, w.trend), undefined, 600);
    }
    return send(res, 404, R.notFound(), undefined, 60);
  } catch (e) {
    console.error(e);
    return send(res, 500, R.layout({ title: "Error | heistclips", desc: "", noindex: true, body: "<h1>Something broke.</h1><p>Try again in a minute.</p>" }), undefined, 5);
  }
}
