// Server-rendered HTML for every public page. Plain strings: fast, crawlable, no framework.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { CHROME, href, headLinks, langSwitch, langLinks, ctaBox } from "./i18n.js";
import { fromLabel } from "./translate.js";
import { newMarker, shippedLink, boardAllLink } from "./changelog.js";
import { SIZE_EN, youBlock, floorRow, sizeBar, sizeSection, SIZE_JS } from "./sizeview.js";
import { paysAtSize } from "./campaigns.js";

export const SITE = "https://heistclips.com";
export const FREE_CLIPS = 10;
export const PACKS = [
  { id: "p50", clips: 50, price: 5 },
  { id: "p200", clips: 200, price: 15 },
];

const here = path.dirname(fileURLToPath(import.meta.url));
let POSTHOG = "";
try { POSTHOG = fs.readFileSync(path.join(here, "posthog.html"), "utf8"); } catch (e) { POSTHOG = ""; }

export const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const money = (x, d = 2) => (x == null ? "–" : "$" + (x >= 1000 ? Math.round(x).toLocaleString("en-US") : x.toFixed(x >= 100 ? 0 : d)));
const num = (x) => (x == null ? "–" : x >= 1e6 ? (x / 1e6).toFixed(1) + "M" : x >= 1e3 ? (x / 1e3).toFixed(x >= 1e4 ? 0 : 1) + "k" : String(x));
const ago = (iso) => {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  return s < 90 ? "just now" : s < 5400 ? Math.round(s / 60) + " min ago" : s < 129600 ? Math.round(s / 3600) + " h ago" : Math.round(s / 86400) + " days ago";
};
const PLATFORM = { tiktok: "TikTok", youtube: "Shorts", instagram: "Reels", x: "X", twitter: "X", facebook: "Facebook", snapchat: "Snapchat" };

// `path` is always the English path; `lang` picks /de or /fr for the pages that have one
// (lib/i18n.js). `cta` is the paste-a-stream box, placed straight after the page's <h1>.
export function layout({ title, desc, path: p = "/", body, jsonld = [], noindex = false, extraHead = "", wide = false, canonicalPath, lang = "en", cta = "" }) {
  const C = CHROME[lang] || CHROME.en;
  const canonical = SITE + href(lang, canonicalPath || p);
  const a = ([to, label]) => `<a href="${to.startsWith("http") ? to : href(lang, to)}">${esc(label)}</a>`;
  if (cta) body = body.replace("</h1>", "</h1>\n" + cta);
  const ld = (Array.isArray(jsonld) ? jsonld : [jsonld]).filter(Boolean).map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, "\\u003c")}</script>`).join("\n");
  return `<!doctype html>
<html lang="${lang}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
${headLinks(SITE, lang, p)}
${noindex ? '<meta name="robots" content="noindex">' : ""}
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canonical}"><meta property="og:type" content="website"><meta property="og:site_name" content="heistclips">
<meta property="og:image" content="${SITE}/img/og.png"><meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0b0b0d">
<link rel="icon" href="/img/icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/site.css?v=17">
${ld}
<script>window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)}</script><script defer src="/_vercel/insights/script.js"></script>
${POSTHOG}
${extraHead}
</head><body>
<header class="top"><div class="wrap row">
<a class="logo" href="${href(lang, "/")}">heist<b>clips</b></a>${newMarker(lang)}
<nav>${C.nav.map(a).join("")}</nav>${langSwitch(lang, p)}
</div></header>
<main class="wrap${wide ? " wide" : ""}">
${body}
</main>
<footer class="foot"><div class="wrap">
<p>${C.foot.map(a).join(" · ")}</p>
${langLinks(lang, p)}
<p class="fine">${C.fine ? esc(C.fine) : "Not affiliated with Rockstar Games or Take-Two Interactive. “GTA VI” is used only to describe what the streams are about. Campaign figures come from the public campaign pages of Content Rewards, Ssemble, Vyro and Clipstake and link back to them. Stream data is read from Twitch’s and Kick’s public pages."}</p>
</div></footer>
</body></html>`;
}

export function runway(c) {
  if (c.days_left == null) return "";
  if (c.days_left < 3) return ` <b class="warn">(~${Math.max(1, Math.round(c.days_left * 24))} h of budget at this pace)</b>`;
  return ` (~${Math.round(c.days_left)} days)`;
}

// The streamer a campaign names (a Twitch or Kick link in its brief), live ones first. A row or
// page for that campaign offers their stream in one tap: /clip?q=<channel> reads the live stream
// if they are live and the latest saved one if not.
export function namedStreamer(c, streamers) {
  return (streamers || []).filter((x) => (x.campaign_ids || []).includes(c.id)).sort((x, y) => (y.live_now ? 1 : 0) - (x.live_now ? 1 : 0) || (y.peak_viewers || 0) - (x.peak_viewers || 0))[0] || null;
}
export const clipHref = (s, src) => `/clip?q=${encodeURIComponent(s.platform === "kick" ? "kick.com/" + s.login : s.login)}&src=${src}`;

// `W`: the "pay at your size" words (lib/sizeview.js); a translated page passes its own.
// A campaign on another marketplace (lib/sources/): its numbers are what that board publishes.
export const isOther = (c) => !!c.marketplace && c.marketplace !== "Content Rewards";
export const joinOn = (c) => c.marketplace || "Content Rewards";

function cardRow(c, i, streamers, W = SIZE_EN) {
  const st = streamers ? namedStreamer(c, streamers) : null;
  const plats = c.platforms.map((p) => PLATFORM[p] || p).join(" · ");
  const other = isOther(c);
  const exp = c.expected_per_clip != null
    ? `<b class="big">${money(c.expected_per_clip)}</b><span>typical per clip</span>`
    : other ? `<b class="big new">${c.rate_per_1k != null ? money(c.rate_per_1k) : "–"}</b><span>per 1K views</span>`
    : `<b class="big new">new</b><span>up to ${money(c.cap_per_clip, 0)} a clip</span>`;
  const left = c.budget_left != null ? `${money(c.budget_left, 0)} left${runway(c)}` : "budget left not public";
  return `<li class="camp${c.is_gta ? " gta" : ""}">
<span class="rank">${i + 1}</span>
<div class="cmain"><a href="/campaigns/${esc(c.slug)}"><b>${esc(c.title)}</b></a>
<span class="meta">${esc(c.owner || "")}${other ? ` · on <b>${esc(c.marketplace)}</b>` : ""}${c.is_gta ? ' · <em class="tag">GTA</em>' : c.is_gaming ? ' · <em class="tag g">gaming</em>' : ""} · ${esc(plats)}</span>
<span class="meta">${c.rate_per_1k != null ? money(c.rate_per_1k) + " / 1k views" : c.per_post != null ? money(c.per_post) + " per post" : esc(c.payout_type)}${c.cap_per_clip != null ? " · cap " + money(c.cap_per_clip, 0) : ""} · ${left}${c.clippers_count != null ? ` · ${c.clippers_count} clippers` : ""}${c.paid_out > 0 ? ` · <span class="paid">paid out ${money(c.paid_out, 0)}</span>` : ""}</span>
${(c.requirements || []).length || c.approval_required ? `<span class="meta reqs">${[c.approval_required ? "apply first" : null, ...(c.requirements || [])].filter(Boolean).map((r) => `<em>${esc(r)}</em>`).join("")}</span>` : ""}
${c.floor ? floorRow(c, W) : ""}
${st ? `<a class="btn sm tapclip" href="${esc(clipHref(st, "row"))}">${st.live_now ? '<span class="pulse"></span>' : "▶ "}Clip ${esc(st.name || st.login)}’s stream now</a>` : ""}</div>
<div class="cnum">${exp}${c.at_size ? youBlock(c, W) : ""}</div></li>`;
}

export function campaignList(list, start = 0, streamers = null, W = SIZE_EN) {
  return `<ol class="camps">${list.map((c, i) => cardRow(c, i + start, streamers, W)).join("")}</ol>`;
}

function updated(snap) {
  return `<p class="updated">Updated <time datetime="${esc(snap.generated_at)}">${esc(new Date(snap.generated_at).toUTCString().replace(" GMT", " UTC"))}</time> · ${ago(snap.generated_at)} · refreshes every 30 min</p>`;
}

const clipForm = (q = "", autofocus = false) => `<form class="paste" action="/clip" method="get">
<input name="q" value="${esc(q)}" placeholder="Twitch or Kick channel, or a VOD link" aria-label="Twitch or Kick channel, or VOD link" ${autofocus ? "autofocus" : ""} autocomplete="off" autocapitalize="off" spellcheck="false">
<button>Find moments</button></form>`;

const SOFTWARE = {
  "@context": "https://schema.org", "@type": "SoftwareApplication", name: "heistclips", url: SITE,
  applicationCategory: "MultimediaApplication", operatingSystem: "Web browser",
  description: "GTA 6 clipping tool: finds the moments Twitch or Kick chat explodes, cuts them to 9:16 with hook text in your browser, and ranks clipping campaigns by what one clip pays.",
  offers: [{ "@type": "Offer", price: "0", priceCurrency: "USD", description: `${FREE_CLIPS} clips free` }, ...PACKS.map((p) => ({ "@type": "Offer", price: String(p.price), priceCurrency: "USD", description: `${p.clips} exported clips` }))],
};

export function homePage(snap, forPath) {
  const s = snap.summary;
  const pay = snap.campaigns.filter((c) => c.is_gaming).slice(0, 5);
  const live = (snap.streamers || []).filter((x) => x.live_now).sort((a, b) => b.viewers_now - a.viewers_now).slice(0, 8);
  const body = `
<section class="hero">
<h1>Clip GTA VI streams while they’re live.</h1>
<p class="lede">Built for gameplay, not podcasts. Paste a Twitch or Kick channel: heistclips watches chat, flags the second it explodes, and cuts it to 9:16 (facecam over gameplay) with a hook, in your browser.</p>
${clipForm("", false)}
<p class="small"><b>${FREE_CLIPS} clips free.</b> Then ${money(PACKS[0].price / PACKS[0].clips)} a clip. No per-minute billing. No watermark. No AI tags in the file.</p>
</section>
${live.length ? `<section><h2>Live in GTA right now</h2><ul class="live">${live.map((x) => `<li><a href="/clip?q=${esc(x.platform === "kick" ? "kick.com/" + x.login : x.login)}"><img src="${esc(x.avatar || "")}" alt="" width="36" height="36" loading="lazy"><span><b>${esc(x.name || x.login)}</b><small>${num(x.viewers_now)} watching · ${esc(x.game === "Grand Theft Auto VI" ? "GTA VI" : "GTA V")}${x.platform === "kick" ? " · Kick" : ""}</small></span></a></li>`).join("")}</ul></section>` : ""}
<section><h2>Pays most per clip right now</h2>
<p class="small">Gaming and streamer campaigns, ranked by what a typical approved clip has actually earned. ${s.gta} GTA campaign${s.gta === 1 ? "" : "s"} live today; more open at launch.</p>
${campaignList(pay, 0, snap.streamers)}
<p><a class="more" href="/gta-6-clipping-campaigns">All ${s.campaigns} campaigns, ranked →</a></p>
<p><a class="more" href="/most-clipped-streams">What clippers are cutting right now →</a></p>
</section>
<section class="ask"><h2>Missing something?</h2><p>File a feature request — we build what clippers ask for. <a class="more" href="/requests">See what’s requested, building and shipped →</a></p></section>
<section class="three four">
<div><h3>Chat finds the moment</h3><p>Gaming moments are visual, so a transcript misses them. Chat doesn’t: every spike is a timestamp, shown with the lines chat typed so you can see why it was picked. Works on streams that are still live.</p></div>
<div><h3>Your browser cuts it</h3><p>Facecam over gameplay, blurred fill or centre crop; 3–5 hook lines so each post is different; chat overlay. Rendered on your machine, no watermark, downloaded straight away.</p></div>
<div><h3>Music gets flagged</h3><p>In-game radio is licensed music. If Twitch muted that stretch, we say so before you post it and lose the payout to a claim.</p></div>
<div><h3>Post it to YouTube</h3><p>Connect your YouTube channel once, then post the clip as a Short with your caption, from the clip tool or from Claude. <a href="/post">Connect YouTube →</a> Posting uses YouTube API Services; see our <a href="/privacy">Privacy</a> page.</p></div>
</section>
${updated(snap)}`;
  return layout({
    title: "GTA 6 clipping tool – find the moment, cut the clip, get paid | heistclips",
    desc: "Find the GTA 6 stream moments chat explodes over, cut them to 9:16 with hooks in your browser, and see which clipping campaigns pay most per clip right now.",
    path: forPath || "/", body, jsonld: [SOFTWARE], canonicalPath: "/", noindex: !!forPath,
  });
}

const FILTERS = { gta: (c) => c.is_gta, gaming: (c) => c.is_gaming, all: () => true };

export function rankerPage(snap, f = "gaming") {
  const s = snap.summary;
  f = FILTERS[f] ? f : "gaming";
  const list = snap.campaigns.filter(FILTERS[f]);
  const tabs = [["gta", "GTA"], ["gaming", "Gaming & streamers"], ["all", "Everything"]].map(([k, l]) => `<a href="/gta-6-clipping-campaigns${k === "gaming" ? "" : "?f=" + k}" class="${k === f ? "on" : ""}">${l} <small>${snap.campaigns.filter(FILTERS[k]).length}</small></a>`).join("");
  const body = `
<h1>GTA 6 clipping campaigns, ranked by what one clip pays</h1>
${updated(snap)}
<p class="lede">${s.campaigns} campaigns are paying clippers right now. Across the ${s.with_track_record} with a track record, a typical approved clip has earned <b>${money(s.earned_per_clip_median)}</b>; the top tenth pay <b>${money(s.earned_per_clip_p90)}+</b> and the bottom tenth under <b>${money(s.earned_per_clip_p10)}</b>. Same work, very different money.</p>
${list.length ? `<p class="lede you-lede">${esc(SIZE_EN.lede(paysAtSize(list.slice(0, 150)), Math.min(150, list.length)))}</p>` : ""}
<nav class="tabs">${tabs}</nav>
${list.length ? sizeBar(SIZE_EN) + campaignList(list.slice(0, 150), 0, snap.streamers) : `<p>No ${f === "gta" ? "GTA" : ""} campaigns are live this minute. They open in waves around launch; this page updates every 30 minutes.</p>`}
${list.length > 150 ? `<p class="small">Showing the top 150 of ${list.length}.</p>` : ""}
<p><a class="more" href="/most-clipped-streams">See which streams clippers are cutting right now →</a></p>
<section class="method"><h2>How the ranking works</h2>
<p><b>Typical per clip</b> = the money a campaign has paid out on approved clips, minus its top three earners, divided by the rest of its approved clips. That is what an ordinary clip has actually made, not what the best one made.</p>
<p>It is then cut if the budget is about to run out: a clip earns most of its views in its first three days, so a campaign with one day of money left pays a third. Campaigns with no approved clips yet sit after the proven ones, ordered by the most a single clip can earn.</p>
<p>${SIZE_EN.method}</p>
<p>Figures come from each marketplace’s public pages (Content Rewards, Ssemble, Vyro and Clipstake) and are refreshed every 30 minutes. Each campaign links to its own page there, where you join. Ssemble, Vyro and Clipstake do not publish approved clips, so their campaigns sit after the ones with a track record; a number a marketplace does not publish says “not public”.</p></section>
${SIZE_JS}`;
  return layout({
    title: `GTA 6 clipping campaigns ranked by pay per clip (${new Date(snap.generated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}) | heistclips`,
    desc: `${s.campaigns} live clipping campaigns ranked by what a typical approved clip actually earns. ${s.gta} GTA, ${s.gaming} gaming and streamer campaigns. Updated every 30 minutes.`,
    path: "/gta-6-clipping-campaigns", body, wide: true, // ?f= views share this canonical
    cta: ctaBox("en", { src: "cta-ranker" }),
    jsonld: [{
      "@context": "https://schema.org", "@type": "Dataset", name: "Live clipping campaigns ranked by pay per clip",
      description: "Every live campaign on the public boards of Content Rewards, Ssemble, Vyro and Clipstake, with rate per 1,000 views, cap per clip, budget left and the typical amount an approved clip has earned, where the marketplace publishes them.",
      url: SITE + "/gta-6-clipping-campaigns", dateModified: snap.generated_at, isAccessibleForFree: true, license: "https://opensource.org/licenses/MIT",
      creator: { "@type": "Organization", name: "heistclips", url: SITE },
      distribution: [{ "@type": "DataDownload", encodingFormat: "application/json", contentUrl: SITE + "/api/campaigns" }],
      variableMeasured: ["rate_per_1k", "cap_per_clip", "budget_left", "earned_per_clip", "expected_per_clip", "clippers_count"],
    }, {
      "@context": "https://schema.org", "@type": "ItemList", itemListElement: list.slice(0, 20).map((c, i) => ({ "@type": "ListItem", position: i + 1, url: SITE + "/campaigns/" + c.slug, name: c.title })),
    }],
  });
}

export function campaignPage(snap, c) {
  const rank = snap.campaigns.indexOf(c) + 1;
  const other = isOther(c), mk = joinOn(c);
  // A cap the marketplace does not publish is "not public"; on Content Rewards null means no cap.
  const capWord = other ? "not public" : "none";
  const plats = c.payouts.map((p) => `<tr><td>${esc(PLATFORM[p.platform] || p.platform)}</td><td>${p.rate_per_1k != null ? money(p.rate_per_1k) : "–"}</td><td>${p.cap_per_clip != null ? money(p.cap_per_clip, 0) : capWord}</td><td>${p.min_payout != null ? money(p.min_payout) : other ? "not public" : "–"}</td></tr>`).join("");
  const brief = c.description.length > 900 ? c.description.slice(0, 900) + "…" : c.description;
  const viewsFor = c.rate_per_1k ? Math.round((c.cap_per_clip || 0) / c.rate_per_1k * 1000) : null;
  const pace = c.days_left != null ? (c.days_left < 3 ? `, ~${Math.max(1, Math.round(c.days_left * 24))} hours at this pace` : `, ~${Math.round(c.days_left)} days at this pace`) : "";
  const facts = other ? [
    c.clippers_count != null || c.total_views != null ? `${c.clippers_count != null ? num(c.clippers_count) + " clippers have joined" : "Clippers not public"}${c.total_views != null ? `, ${num(c.total_views)} views counted so far` : ""}.` : null,
    c.budget_spent != null ? `${money(c.budget_spent, 0)} of the ${money(c.budget_total, 0)} budget used so far.` : `${mk} does not publish the budget.`,
    `${mk} does not publish approved clips or what one has earned, so this campaign is ranked after the ones with a track record.`,
    `${c.approval_required ? "You have to apply before you can submit." : "Open: no application needed."}${c.geo_priced ? " Rates vary by viewer country." : ""}`,
  ].filter(Boolean) : [
    `${num(c.approved_clips)} approved clips from ${num(c.clippers_count)} clippers, ${num(c.total_views)} views in total${c.views_per_clip ? ` (${num(c.views_per_clip)} per clip on average)` : ""}.`,
    `${money(c.budget_spent, 0)} of the budget earned so far${c.avg_per_clip != null ? `: ${money(c.avg_per_clip)} per approved clip on average, ${c.earned_per_clip != null ? money(c.earned_per_clip) + " once the top three earners are taken out" : "too few clips to separate out the top earners"}` : ""}.`,
    `Last 7 days: ${num(c.clips_7d)} clips approved, ${num(c.views_7d)} views. Best clip: ${num(c.top_clip_views)} views.`,
    `${c.approval_required ? "You have to apply before you can submit." : "Open: no application needed."}${c.geo_priced ? " Rates vary by viewer country." : ""}`,
  ];
  const body = `
<p class="crumbs"><a href="/gta-6-clipping-campaigns">Campaigns</a> › ${c.is_gta ? "GTA" : c.is_gaming ? "Gaming" : esc(c.categories[0] || "Campaign")}</p>
<h1>${esc(c.title)}</h1>
<p class="meta">by ${esc(c.owner)}${c.owner_verified ? " ✓" : ""}${other ? ` · on ${esc(mk)}` : ""} · #${rank} of ${snap.campaigns.length} by pay per clip</p>
<div class="stats">
<div><b>${c.expected_per_clip != null ? money(c.expected_per_clip) : other ? "–" : "new"}</b><span>${c.expected_per_clip != null ? "typical per approved clip" : other ? `per approved clip: not public on ${esc(mk)}` : "no approved clips yet"}</span></div>
${c.at_size ? `<div class="youstat">${youBlock(c, SIZE_EN)}</div>` : ""}
<div><b>${c.rate_per_1k != null ? money(c.rate_per_1k) : c.per_post != null ? money(c.per_post) : "–"}</b><span>${c.per_post != null ? "per post" : "per 1,000 views"}</span></div>
<div><b>${c.cap_per_clip != null ? money(c.cap_per_clip, 0) : capWord}</b><span>max per clip${viewsFor ? ` (hit at ${num(viewsFor)} views)` : ""}</span></div>
${c.budget_left != null ? `<div><b>${money(c.budget_left, 0)}</b><span>left of ${money(c.budget_total, 0)}${pace}</span></div>` : `<div><b>not public</b><span>budget left${c.budget_total != null ? ` of ${money(c.budget_total, 0)}` : ""}</span></div>`}
${c.paid_out != null ? `<div><b>${money(c.paid_out, 0)}</b><span>actually paid out to clippers so far</span></div>` : ""}
</div>
${(c.requirements || []).length || c.approval_required ? `<p class="meta reqs">Watch for: ${[c.approval_required ? "apply first" : null, ...(c.requirements || [])].filter(Boolean).map((r) => `<em>${esc(r)}</em>`).join("")} <span class="small">(read off the brief below)</span></p>` : ""}
<p class="actions"><a class="btn" href="${esc(c.source_url)}" rel="nofollow noopener" target="_blank">Join on ${esc(mk)}</a> ${(() => { const st = namedStreamer(c, snap.streamers); return st ? `<a class="btn ghost" href="${esc(clipHref(st, "campaign"))}">Clip ${esc(st.name || st.login)}’s stream now</a>` : `<a class="btn ghost" href="/clip">Cut clips for it</a>`; })()}</p>
${c.at_size ? sizeSection(c, SIZE_EN, { bar: sizeBar(SIZE_EN, { sort: false }) }) + SIZE_JS : ""}
<h2>What clips here have earned</h2>
<ul class="facts">
${facts.map((x) => `<li>${x}</li>`).join("\n")}
</ul>
<h2>Rate by platform</h2>
<div class="tablewrap"><table><thead><tr><th>Platform</th><th>Per 1k views</th><th>Cap per clip</th><th>Min payout</th></tr></thead><tbody>${plats}</tbody></table></div>
<h2>The brief</h2>
${brief ? `<blockquote class="brief">${esc(brief).replace(/\n/g, "<br>")}</blockquote>
<p class="small">From the campaign page on ${esc(mk)}. Read the full rules there before you post.</p>` : `<p>${esc(mk)} shows the brief only after you open the campaign there. Read the rules before you post.</p>`}
${updated(snap)}`;
  return layout({
    title: `${c.title} – ${c.rate_per_1k != null ? money(c.rate_per_1k) + "/1k" : "clipping campaign"}${c.expected_per_clip != null ? ", ~" + money(c.expected_per_clip) + " per clip" : ""}${other ? " on " + mk : ""} | heistclips`,
    desc: `${c.title} by ${c.owner}${other ? " on " + mk : ""}: ${c.rate_per_1k != null ? money(c.rate_per_1k) + " per 1,000 views" : ""}${c.cap_per_clip != null ? ", cap " + money(c.cap_per_clip, 0) + " per clip" : ""}${c.budget_left != null ? `, ${money(c.budget_left, 0)} budget left` : ""}${c.clippers_count != null ? `, ${c.clippers_count} clippers` : ""}. What a typical clip has earned, updated every 30 minutes.`,
    path: "/campaigns/" + c.slug, body, cta: ctaBox("en", { src: "cta-campaign", streamer: namedStreamer(c, snap.streamers) }),
    jsonld: [{ "@context": "https://schema.org", "@type": "Dataset", name: c.title + " – campaign figures", url: SITE + "/campaigns/" + c.slug, dateModified: snap.generated_at,
      description: `Pay rate, cap, budget and earnings per clip for the ${c.title} clipping campaign.`, isAccessibleForFree: true, license: "https://opensource.org/licenses/MIT", creator: { "@type": "Organization", name: "heistclips", url: SITE } }],
  });
}

// Streamers a live campaign pays for (snapshot campaign_ids: a linked channel or the channel its
// title names), live first, then most campaigns, then biggest. -> [{ s, n }]
export function paidStreamers(snap) {
  const liveIds = new Set((snap.campaigns || []).filter((c) => c.budget_left > 0).map((c) => c.id));
  return (snap.streamers || []).map((s) => ({ s, n: (s.campaign_ids || []).filter((id) => liveIds.has(id)).length })).filter((p) => p.n)
    .sort((a, b) => (b.s.live_now ? 1 : 0) - (a.s.live_now ? 1 : 0) || b.n - a.n || (b.s.followers || b.s.peak_viewers || 0) - (a.s.followers || a.s.peak_viewers || 0));
}

export function streamersIndex(snap) {
  const list = snap.streamers || [];
  const live = list.filter((s) => s.live_now).sort((a, b) => b.viewers_now - a.viewers_now);
  const paid = paidStreamers(snap);
  const paidKeys = new Set(paid.map((p) => p.s.platform + ":" + p.s.login));
  const rest = list.filter((s) => !s.live_now && !paidKeys.has(s.platform + ":" + s.login)).sort((a, b) => (b.peak_viewers || 0) - (a.peak_viewers || 0));
  const li = (s, n) => `<li><a href="${s.platform === "kick" ? "/streamers/kick/" + esc(s.login) : "/streamers/" + esc(s.login)}"><img${s.avatar ? ` src="${esc(s.avatar)}"` : ""} alt="" width="36" height="36" loading="lazy"><span><b>${esc(s.name || s.login)}</b><small>${n ? (n === 1 ? "1 campaign paying" : `${n} campaigns paying`) + (s.live_now ? " · live" : "") : s.live_now ? `live · ${num(s.viewers_now)} watching` : `peak ${num(s.peak_viewers)} seen`}${s.platform === "kick" ? " · Kick" : ""}</small></span></a></li>`;
  const body = `<h1>GTA streamers worth clipping</h1>
<p class="lede">Everyone we have seen streaming GTA on Twitch and Kick, live ones first. Each page finds the moments chat exploded in their latest stream.</p>
${updated(snap)}
<h2>Live now</h2><ul class="live">${live.map((s) => li(s)).join("") || "<li>Nobody live this minute.</li>"}</ul>
${paid.length ? `<h2>Campaigns pay to clip these</h2><ul class="live">${paid.map((p) => li(p.s, p.n)).join("")}</ul>` : ""}
<h2>Recently live</h2><ul class="live">${rest.slice(0, 200).map((s) => li(s)).join("")}</ul>`;
  return layout({ title: "GTA streamers to clip right now – live and recent | heistclips", desc: "Every GTA streamer live on Twitch or Kick right now and recently, with the moments chat exploded in their latest stream, ready to clip.", path: "/streamers", body });
}

// The streamer page ("How to clip <streamer>") lives in lib/searchpages.js.

export function clipPage(q) {
  const body = `
<section class="tool">
<h1>Find the moments. Cut the clip.</h1>
${clipForm(q, !q)}
<div id="app" data-q="${esc(q)}"><p class="small">Paste a Twitch or Kick channel (live or not) or a VOD link. It reads chat, not the video, so a 7-hour stream takes about 20 seconds.</p></div>
</section>`;
  return layout({
    title: "GTA 6 clip maker – find moments from Twitch or Kick chat, cut 9:16 in your browser | heistclips",
    desc: "Paste a Twitch or Kick channel or VOD. heistclips finds the moments chat exploded, flags licensed music, and cuts 9:16 clips with hook text right in your browser.",
    path: "/clip", body, jsonld: [SOFTWARE], wide: true,
    extraHead: `<script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js" defer></script><script type="module" src="/js/app.js?v=24"></script>`,
  });
}

export function pricingPage() {
  const faq = [
    ["Why per clip and not per minute?", "Clippers get paid per clip that performs. Tools that bill per minute of footage charge you for the seven hours of a stream you never post. Here the stream is read for free; you pay only for the clips you export."],
    ["What counts as a clip?", "One exported 9:16 video. Previews, moment-finding and re-reading a stream are free. Re-rendering the same moment with a different hook counts as a new clip."],
    ["Do credits expire?", "No."],
    ["Where does the video get made?", "On a computer, in your own browser. On a phone, in Safari, or when Claude or ChatGPT cuts it, our server cuts it straight from the stream. A video file of your own, like a YouTube copy, never leaves your device."],
    ["What shows on my card statement?", "BRICKANDMO* HEISTCLIPS. Brick & Mortar is the company that runs heistclips; the checkout page says heistclips."],
  ];
  const body = `<h1>Pay per clip. Never per minute.</h1>
<p class="lede">${FREE_CLIPS} clips free. Then buy a pack. Finding moments is always free.</p>
<div class="packs">
<div class="pack"><b>Free</b><span class="price">$0</span><span>${FREE_CLIPS} clips</span><a class="btn ghost" href="/clip">Start clipping</a></div>
${PACKS.map((p) => `<div class="pack"><b>${p.clips} clips</b><span class="price">$${p.price}</span><span>${money(p.price / p.clips, 3).replace(/0$/, "")} a clip</span><button class="btn buy" data-pack="${p.id}">Buy ${p.clips} clips</button></div>`).join("")}
</div>
<p class="small" id="buymsg"></p>
<h2>Questions</h2>
${faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}
<script type="module" src="/js/buy.js?v=6"></script>`;
  return layout({ title: "Pricing – pay per clip, never per stream minute | heistclips", desc: `${FREE_CLIPS} GTA 6 clips free, then ${PACKS.map((p) => `${p.clips} for $${p.price}`).join(" or ")}. Moment-finding is always free.`, path: "/pricing", body,
    jsonld: [{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) }, SOFTWARE] });
}

export function connectPage(tools = []) {
  const body = `<h1>Use heistclips inside ChatGPT, Claude or Grok</h1>
<p class="lede">Ask “which GTA clipping campaign pays most right now?” or “find the best moments in xQc’s last stream” and get the answer from live data.</p>
<p>Server URL: <code class="copy">${SITE}/mcp</code></p>
<h2>Claude</h2><p>Settings → Connectors → Add custom connector → paste the URL.</p>
<h2>ChatGPT</h2><p>Settings → Apps &amp; Connectors → Advanced → Developer mode on → Create → paste the URL, no authentication.</p>
<h2>Grok</h2><p>grok.com/connectors → Add → paste the URL.</p>
<h2>Claude Code, Codex, Cursor</h2><pre>claude mcp add --transport http heistclips ${SITE}/mcp</pre>
<h2>Tools</h2><ul class="facts">
${tools.map((t) => `<li><b>${esc(t.name)}</b> – ${esc(t.title)}.</li>`).join("\n")}</ul>
<p class="small">Works in any language. Links it returns open the clip tool on the exact moment.</p>`;
  return layout({ title: "heistclips MCP server – GTA 6 clipping data in ChatGPT, Claude and Grok", desc: "Connect heistclips to ChatGPT, Claude or Grok: find the best moments to clip in any Twitch or Kick stream, and rank clipping campaigns by $ per 1K views.", path: "/connect", body });
}

export function aboutPage() {
  const body = `<h1>About heistclips</h1>
<p>heistclips is a clipping tool for the people who cut other people’s streams into Shorts, TikToks and Reels for money. It does three things: finds the moments in a stream that chat reacted to, cuts them into vertical clips in your browser, and tells you which campaign will pay most for them.</p>
<p>It is open source (MIT): <a href="https://github.com/2016judea/heistclips">github.com/2016judea/heistclips</a>. The same engine runs locally as a command-line tool and as an MCP server for AI assistants.</p>
<h2>Where the numbers come from</h2>
<p>Campaign figures are read every 30 minutes from the public campaign pages of Content Rewards, Ssemble, Vyro and Clipstake, with a link back to each campaign. Clipster is not read: its campaign list is behind an API its robots.txt closes. Stream and chat data come from Twitch’s and Kick’s public pages, read anonymously. Nothing is bought, scraped from behind a login, or made up.</p>
<h2>Who runs it</h2>
<p>heistclips is made by Brick &amp; Mortar in Saint Paul, Minnesota. Card payments are processed by Stripe and show as BRICKANDMO* HEISTCLIPS. Support: aidan@brickandmortar.dev.</p>
<p class="small">Not affiliated with Rockstar Games, Take-Two Interactive, Twitch, Kick, Content Rewards, Ssemble, Vyro or Clipstake.</p>`;
  return layout({ title: "About heistclips", desc: "Who makes heistclips, where its campaign and stream data come from, and how it is paid for.", path: "/about", body });
}

export function notFound() {
  return layout({ title: "Not found | heistclips", desc: "Page not found.", path: "/404", noindex: true, body: `<h1>Nothing here.</h1><p><a href="/">Back to the clip tool</a></p>` });
}

// "Shipped Nov 19 — what we built." Dates in Central time (where heistclips is run).
export function closeOut(x) {
  if (!x.response && !x.shipped_at) return "";
  const day = x.shipped_at ? new Date(x.shipped_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" }) : "";
  const lead = x.status === "shipped" ? `Shipped${day ? " " + day : ""}` : x.status === "building" ? "Building" : "Update";
  return `<p class="resp st-${esc(x.status)}"><b>${esc(lead)}</b>${x.response ? " — " + esc(x.response) : ""}</p>`;
}

// One board row, in the viewer's language. A translated row carries its original in data
// attributes, and "show original" swaps the two in place (public/js/requests.js).
export function requestCard(x, lang = "en") {
  const o = x.original, L = o ? fromLabel(lang, o.lang) : null;
  const note = o ? `<span class="trnote" data-t-title="${esc(x.title)}" data-t-detail="${esc(x.detail || "")}" data-o-title="${esc(o.title)}" data-o-detail="${esc(o.detail || "")}" data-show="${esc(L.show)}" data-hide="${esc(L.hide)}">${esc(L.from)} · <button type="button" class="linkbtn" data-orig>${esc(L.show)}</button></span>` : "";
  return `<li class="req" id="${esc(x.id)}" data-id="${esc(x.id)}" data-kind="${x.kind === "bug" ? "bug" : "feature"}">
<button class="vote${x.voted ? " on" : ""}" data-vote="${esc(x.id)}" aria-label="Upvote"><span>▲</span><b>${x.votes}</b></button>
<div><b class="rt">${esc(x.title)}</b><p class="rd"${x.detail ? "" : " hidden"}>${esc(x.detail || "")}</p>${note}<span class="meta">${x.kind === "bug" ? '<em class="st st-bug">Bug</em> ' : ""}<em class="st st-${esc(x.status)}">${esc(x.status)}</em> ${esc(x.by)}</span>${closeOut(x)}${shippedLink(x)}</div></li>`;
}

export function requestsPage(list, lang = "en") {
  const counts = { requested: 0, building: 0, shipped: 0 };
  list.forEach((x) => counts[x.status]++);
  const card = (x) => requestCard(x, lang);
  const body = `<h1>What clippers asked for</h1>
<p class="lede">Upvote what you want next, or ask for something new. No account. We build what gets voted up, and shipped requests stay here as proof.</p>
<p class="small">${counts.requested} requested · ${counts.building} building · ${counts.shipped} shipped</p>
${boardAllLink()}
<form class="reqform" id="reqform" autocomplete="off" data-ok-bug="Reported. It’s on the board, and the builder has it." data-bug-tag="Bug">
<div class="reqkind" role="radiogroup"><label><input type="radio" name="kind" value="feature" checked> Request a feature</label><label><input type="radio" name="kind" value="bug"> Report a bug</label></div>
<input name="title" maxlength="90" placeholder="What should heistclips do? e.g. “Auto-detect where the facecam is”" required aria-label="Your request" dir="auto" data-ph-feature="What should heistclips do? e.g. “Auto-detect where the facecam is”" data-ph-bug="What went wrong? e.g. “The MP4 has no sound”">
<div id="bugfields" hidden>
<input name="source" maxlength="200" placeholder="Stream link or streamer’s name (optional)" aria-label="Stream link or streamer’s name (optional)" autocapitalize="off" autocorrect="off" disabled>
<textarea name="what_happened" maxlength="400" rows="3" placeholder="What happened? What did you click, and what did heistclips do?" aria-label="What happened? What did you click, and what did heistclips do?" dir="auto" disabled></textarea>
<input name="expected" maxlength="300" placeholder="What did you expect instead? (optional)" aria-label="What did you expect instead? (optional)" dir="auto" disabled>
</div>
<details><summary class="small" data-feature="Add detail or a way to reach you (optional)" data-bug="Add a way to reach you (optional)">Add detail or a way to reach you (optional)</summary>
<textarea name="detail" maxlength="400" rows="3" placeholder="What were you trying to do?" aria-label="Detail"></textarea>
<input name="contact" maxlength="120" placeholder="Email or @handle, only if you want a reply" aria-label="Contact" inputmode="email" autocapitalize="off" autocorrect="off"></details>
<input name="website" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true">
<button class="btn" data-feature="Request it" data-bug="Report it">Request it</button><span class="small" id="reqmsg"></span></form>
<div class="reqfilter" id="reqfilter"><button type="button" class="on" data-kind="all">All</button><button type="button" data-kind="feature">Features</button><button type="button" data-kind="bug">Bugs</button></div>
<ol class="reqs-list" id="reqs" data-lang="${esc(lang)}">${list.map(card).join("")}</ol>
<p class="small">Items marked “Suggested by heistclips” were added by us at launch from what clippers say on Reddit. Every count started at 0; only real votes move it, one per browser.</p>
<script type="module" src="/js/requests.js?v=8"></script>`;
  return layout({ title: "Feature requests – what clippers want next | heistclips", desc: "Upvote or request features for heistclips, the GTA 6 clipping tool. Requested, building and shipped, in public.", path: "/requests", body });
}

export function privacyPage() {
  const body = `<h1>Privacy</h1>
<p>heistclips collects as little as it can.</p>
<ul class="facts">
<li><b>Clips you render on the site stay with you.</b> They are cut in your browser from the stream’s public video. We do not receive them unless you press a Post button, which uploads that one clip so it can be sent to the platform you chose.</li>
<li><b>Clips cut or posted for you.</b> A clip cut through the connector’s cut_clip tool, or uploaded to be posted, is stored under a random link for up to 72 hours and then deleted.</li>
<li><b>YouTube and TikTok posting.</b> If you connect an account, we store the access tokens that platform issues, encrypted, and use them only to upload the clips you ask us to post. On YouTube we request the upload permission alone (youtube.upload): heistclips cannot read your channel, videos or Google account. heistclips’ use of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy" rel="noopener">Google API Services User Data Policy</a>, including the Limited Use requirements; it is never sold, used for advertising, or read by people. On TikTok we request your basic profile (display name) and permission to upload and publish videos. Disconnect on <a href="/post">the posting page</a> at any time and the tokens are revoked and deleted; you can also remove access in your <a href="https://myaccount.google.com/permissions" rel="noopener">Google Account</a> or TikTok settings. Posting through heistclips uses YouTube API Services, so the <a href="https://www.youtube.com/t/terms" rel="noopener">YouTube Terms of Service</a> and <a href="https://policies.google.com/privacy" rel="noopener">Google Privacy Policy</a> apply to what you post there.</li>
<li><b>A random browser id.</b> Your browser makes a random id to count free clips and votes. We store a keyed hash of it with a count, nothing else.</li>
<li><b>Purchases.</b> Card payments are handled by Stripe. We keep the Checkout Session id as your licence key and a count of clips used. We never see your card.</li>
<li><b>Feature requests.</b> What you type on the request board is public on that board, except the optional contact field, which only the builder sees, by email.</li>
<li><b>Autopilot queue.</b> If you use the queue we store the channels you watch and which clips you exported or skipped, under a secret link only you hold. An email address or a notification subscription is stored only if you give one, is used only to tell you clips are ready, and is removed when you turn it off.</li>
<li><b>Analytics.</b> Vercel Web Analytics (no cookies) and PostHog count page views and tool use so we can see what works.</li>
<li><b>MCP server.</b> Calls to heistclips.com/mcp are not tied to any person; cutting and posting use a random account code your assistant passes back. We log which tool was called, whether it worked and how long it took, never its arguments. Tool arguments are used to answer the call; feature requests filed through it are stored like the board above.</li>
</ul>
<p>Questions or deletion requests: aidan@brickandmortar.dev.</p>`;
  return layout({ title: "Privacy | heistclips", desc: "What heistclips collects (very little), and why.", path: "/privacy", body });
}

export function termsPage() {
  const body = `<h1>Terms</h1>
<ul class="facts">
<li>heistclips is a tool. You are responsible for what you clip and post, and for having the right to post it: follow each campaign’s rules, each platform’s rules and each streamer’s wishes.</li>
<li>Campaign figures are read from a public directory and can be wrong or out of date. Check the campaign’s own page before you rely on a number.</li>
<li>Credits are for exported clips, do not expire, and are not refundable once used. Unused packs can be refunded within 14 days: email aidan@brickandmortar.dev.</li>
<li>The service is provided as is, without warranty. The source code is MIT-licensed at github.com/2016judea/heistclips.</li>
<li>Posting to YouTube through heistclips uses YouTube API Services. By using that feature you agree to be bound by the <a href="https://www.youtube.com/t/terms" rel="noopener">YouTube Terms of Service</a>, and the <a href="https://policies.google.com/privacy" rel="noopener">Google Privacy Policy</a> applies. You can remove heistclips’ access at any time on <a href="/post">the posting page</a> or in your <a href="https://security.google.com/settings/security/permissions" rel="noopener">Google security settings</a>.</li>
<li>heistclips is not affiliated with Rockstar Games, Take-Two Interactive, Twitch, Kick, YouTube, TikTok, Content Rewards, Ssemble, Vyro or Clipstake.</li>
</ul>`;
  return layout({ title: "Terms | heistclips", desc: "The terms for using heistclips.", path: "/terms", body });
}
