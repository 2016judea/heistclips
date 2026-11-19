// One function renders every HTML page (and the sitemap/robots/llms.txt), off the latest snapshot.
import { latestSnapshot, getJSON } from "../lib/store.js";
import * as R from "../lib/render.js";
import { guidePage, guidesIndex, ratesPage, GUIDES } from "../lib/guides.js";
import { getChannel } from "../public/js/twitch.js";
import { loadBoard, publicList } from "../lib/requests.js";
import { splitLang, href, isLocal } from "../lib/i18n.js";
import { localPage } from "../lib/pages_l10n.js";
import { TOOLS as MCP_TOOLS } from "./mcp.js";
import { queuePage } from "../lib/queuepage.js";
import { loadPitch, pitchPage } from "../lib/pitch.js";

const INDEXNOW_KEY = "066cce158f4bc73e04afdcb48bb189f7";

function send(res, status, body, type = "text/html; charset=utf-8", maxAge = 300) {
  res.statusCode = status;
  res.setHeader("content-type", type);
  res.setHeader("cache-control", `public, max-age=60, s-maxage=${maxAge}, stale-while-revalidate=86400`);
  res.end(body);
}

export function sitemapUrls(snap) {
  const urls = ["/", "/clip", "/queue", "/requests", "/gta-6-clipping-campaigns", "/gta-6-clipping-campaigns?f=gta", "/gta-6-clipping-campaigns?f=all", "/gta-6-clipping-rates-today", "/streamers", "/guides", "/pricing", "/connect", "/about", "/privacy", "/terms",
    ...GUIDES.map((g) => "/guides/" + g.slug),
    ...snap.campaigns.map((c) => "/campaigns/" + c.slug),
    ...(snap.streamers || []).filter((s) => s.platform === "twitch").map((s) => "/streamers/" + s.login)];
  // Each translated page, in each language.
  for (const l of ["de", "fr"]) for (const x of urls.slice()) if (!x.includes("?") && isLocal(x) && !x.startsWith("/" + l)) urls.push(href(l, x));
  return urls;
}

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
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls(snap).map((x) => `<url><loc>${R.SITE}${x.replace(/&/g, "&amp;")}</loc><lastmod>${lastmod}</lastmod></url>`).join("\n")}\n</urlset>`;
      return send(res, 200, xml, "application/xml; charset=utf-8", 600);
    }
    if (p === "/llms.txt") {
      const s = snap.summary;
      const top = snap.campaigns.filter((c) => c.is_gaming).slice(0, 10).map((c) => `- [${c.title}](${R.SITE}/campaigns/${c.slug}): ${c.expected_per_clip != null ? "$" + c.expected_per_clip + " typical per clip" : "new"}, $${c.rate_per_1k ?? c.per_post}/${c.per_post != null ? "post" : "1k views"}, cap $${c.cap_per_clip ?? "none"}, $${Math.round(c.budget_left)} left`).join("\n");
      return send(res, 200, `# heistclips\n\n> GTA 6 clipping tool. Finds the moments Twitch chat exploded in a stream (live or VOD), cuts them to 9:16 with hook text in the browser, flags licensed-music risk, and ranks clipping campaigns by what a typical approved clip actually earns. ${R.FREE_CLIPS} clips free, then pay per exported clip, never per stream minute.\n\nData updated ${snap.generated_at}: ${s.campaigns} live campaigns, ${s.gta} GTA; median $${s.rate_per_1k_median}/1k views; typical approved clip earns $${s.earned_per_clip_median}.\n\n## Pages\n- [Clip tool](${R.SITE}/clip)\n- [Campaigns ranked by pay per clip](${R.SITE}/gta-6-clipping-campaigns)\n- [GTA 6 clipping rates today](${R.SITE}/gta-6-clipping-rates-today)\n- [Pricing](${R.SITE}/pricing)\n${GUIDES.map((g) => `- [${g.title}](${R.SITE}/guides/${g.slug})`).join("\n")}\n\n## Top gaming campaigns right now\n${top}\n\n## API and MCP\n- JSON: ${R.SITE}/api/campaigns?filter=gta|gaming|all\n- MCP server (streamable HTTP): ${R.SITE}/mcp  (tools: ${MCP_TOOLS.map((t) => t.name).join(", ")})\n- Source: https://github.com/2016judea/heistclips\n`, "text/plain; charset=utf-8", 600);
    }

    // /de/… and /fr/…: the same page in German or French where one exists, else the English page.
    const loc = splitLang(p);
    if (loc.lang !== "en") {
      let board, history;
      if (loc.path === "/requests") board = publicList(await loadBoard());
      if (loc.path === "/gta-6-clipping-rates-today") { try { history = (await getJSON("snapshot/history.json")) || []; } catch (e) {} }
      const html = localPage(loc.lang, loc.path, { snap, query: u.searchParams, board, history });
      if (html) return send(res, 200, html, undefined, loc.path === "/requests" ? 30 : loc.path === "/clip" || loc.path === "/pricing" ? 3600 : 300);
      const q = new URLSearchParams(u.searchParams); q.delete("p");
      res.statusCode = 302; res.setHeader("location", loc.path + (q.toString() ? "?" + q : "")); return res.end();
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
    if (p === "/requests") return send(res, 200, R.requestsPage(publicList(await loadBoard())), undefined, 30);
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
      const c = snap.campaigns.find((x) => x.slug === m[1]) || snap.campaigns.find((x) => m[1].endsWith("-" + x.id.split("-")[0]));
      if (!c) return send(res, 404, R.notFound(), undefined, 60);
      if (c.slug !== m[1]) { res.statusCode = 301; res.setHeader("location", "/campaigns/" + c.slug); return res.end(); }
      return send(res, 200, R.campaignPage(snap, c));
    }
    if ((m = p.match(/^\/streamers\/([a-z0-9_]{3,25})$/))) {
      const login = m[1];
      const s = (snap.streamers || []).find((x) => x.login === login && x.platform === "twitch");
      let chan = null;
      try { chan = await getChannel(login); } catch (e) {}
      if (!s && !chan) return send(res, 404, R.notFound(), undefined, 60);
      const camps = snap.campaigns.filter((c) => s && (s.campaign_ids || []).includes(c.id));
      return send(res, 200, R.streamerPage(snap, s || { login, name: chan.name }, chan, camps), undefined, 600);
    }
    return send(res, 404, R.notFound(), undefined, 60);
  } catch (e) {
    console.error(e);
    return send(res, 500, R.layout({ title: "Error | heistclips", desc: "", noindex: true, body: "<h1>Something broke.</h1><p>Try again in a minute.</p>" }), undefined, 5);
  }
}
