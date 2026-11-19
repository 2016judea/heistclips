// The pages in every language but English. English stays in render.js and guides.js; this file
// renders the same pages from a words table (lib/l10n_<lang>.js). To add a page, see the three
// steps at the top of lib/i18n.js. Every number still comes from
// the live snapshot, exactly as on the English page. A path with no translation returns null
// and the router sends the visitor to the English page.
import { layout, esc, money, campaignList, clipPage, namedStreamer, clipHref, FREE_CLIPS, PACKS, SITE } from "./render.js";
import { GUIDES } from "./guides.js";
import { href, ctaBox, CHROME } from "./i18n.js";
import de from "./l10n_de.js";
import fr from "./l10n_fr.js";
import pt from "./l10n_pt.js";
import es from "./l10n_es.js";
import { MAKERS, TREND_PATH, DATA_PATH, RATES_CSV, RATES_JSON, TREND_JSON, RATE_FIELDS, makerPage, trendPage } from "./searchpages.js";
import { queuePage, CSS as QUEUE_CSS } from "./queuepage.js";
import { shippedLink, boardAllLink, PATH as NEW_PATH } from "./changelog.js";
import { whatsNewPage } from "./changelogpage.js";
import { youBlock, sizeBar, sizeSection, SIZE_JS } from "./sizeview.js";
import { paysAtSize } from "./campaigns.js";

export const WORDS = { de, fr, pt, es };

// The clip tool's script tag, read off the English page so both always load the same version.
const APP_SRC = () => (clipPage("").match(/\/js\/app\.js\?v=\d+/) || ["/js/app.js"])[0];
const QUEUE_SRC = () => (queuePage().match(/\/js\/queue\.js\?v=\d+/) || ["/js/queue.js"])[0];
const PLATFORM = { tiktok: "TikTok", youtube: "Shorts", instagram: "Reels", x: "X", twitter: "X", facebook: "Facebook", snapchat: "Snapchat" };
const B = (x) => `<b>${x}</b>`;

const num = (x) => (x == null ? "–" : x >= 1e6 ? (x / 1e6).toFixed(1) + "M" : x >= 1e3 ? (x / 1e3).toFixed(x >= 1e4 ? 0 : 1) + "k" : String(x));
const when = (iso, T) => new Date(iso).toLocaleString(T.locale, { timeZone: "UTC", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " UTC";
const updated = (snap, T) => `<p class="updated">${esc(T.updated(when(snap.generated_at, T), Math.max(0, Math.round((Date.now() - Date.parse(snap.generated_at)) / 60000))))}</p>`;

// Campaign rows are built once, in English, by render.js. Their fixed labels are swapped here;
// campaign titles and briefs are the campaign owner's words and stay as written.
export function rows(list, T, lang, start = 0, streamers = null) {
  let html = campaignList(list, start, streamers, T.size);
  for (const [re, to] of T.rows) html = html.replace(re, to);
  html = html.replace(/<em>([^<]+)<\/em>/g, (m, x) => (T.req[x] ? `<em>${esc(T.req[x])}</em>` : m)); // "length rule", "US audience"…
  html = html.replace(/href="\/clip\?q=/g, `href="${href(lang, "/clip")}?q=`);
  return html;
}

const form = (T, lang, q = "", autofocus = false) => `<form class="paste" action="${href(lang, "/clip")}" method="get">
<input name="q" value="${esc(q)}" placeholder="${esc(T.form.ph)}" aria-label="${esc(T.form.ph)}" ${autofocus ? "autofocus" : ""} autocomplete="off" autocapitalize="off" spellcheck="false">
<button>${esc(T.form.go)}</button></form>`;

function home(snap, T, lang) {
  const s = snap.summary, H = T.home;
  const pay = snap.campaigns.filter((c) => c.is_gaming).slice(0, 5);
  const live = (snap.streamers || []).filter((x) => x.live_now).sort((a, b) => b.viewers_now - a.viewers_now).slice(0, 8);
  const body = `
<section class="hero">
<h1>${esc(H.h1)}</h1>
<p class="lede">${esc(H.lede)}</p>
${form(T, lang)}
<p class="small">${H.small(FREE_CLIPS, money(PACKS[0].price / PACKS[0].clips))}</p>
</section>
${live.length ? `<section><h2>${esc(H.liveH)}</h2><ul class="live">${live.map((x) => `<li><a href="${href(lang, "/clip")}?q=${esc(x.platform === "kick" ? "kick.com/" + x.login : x.login)}"><img src="${esc(x.avatar || "")}" alt="" width="36" height="36" loading="lazy"><span><b>${esc(x.name || x.login)}</b><small>${esc(T.watching(num(x.viewers_now)))} · ${esc(x.game === "Grand Theft Auto VI" ? "GTA VI" : "GTA V")}${x.platform === "kick" ? " · Kick" : ""}</small></span></a></li>`).join("")}</ul></section>` : ""}
<section><h2>${esc(H.payH)}</h2>
<p class="small">${esc(H.paySmall(s.gta))}</p>
${rows(pay, T, lang, 0, snap.streamers)}
<p><a class="more" href="${href(lang, "/gta-6-clipping-campaigns")}">${esc(H.all(s.campaigns))}</a></p>
<p><a class="more" href="/most-clipped-streams">${esc(H.trend)}</a></p>
</section>
<section class="ask"><h2>${esc(H.askH)}</h2><p>${esc(H.askP)} <a class="more" href="${href(lang, "/requests")}">${esc(H.askLink)}</a></p></section>
<section class="three four">${H.three.map(([h, p]) => `<div><h3>${esc(h)}</h3><p>${esc(p)}</p></div>`).join("")}<div><h3>${esc(H.post.h)}</h3><p>${H.post.p}</p></div></section>
${updated(snap, T)}`;
  return layout({ lang, title: H.title, desc: H.desc, path: "/", body });
}

function clip(q, T, lang) {
  const C = T.clip;
  const body = `
<section class="tool">
<h1>${esc(C.h1)}</h1>
${form(T, lang, q, !q)}
<div id="app" data-q="${esc(q)}"><p class="small">${esc(C.hint)}</p></div>
</section>`;
  return layout({ lang, title: C.title, desc: C.desc, path: "/clip", body, wide: true,
    extraHead: `<script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js" defer></script>${L10N_JS}<script type="module" src="${APP_SRC()}"></script>` });
}

function pricing(T, lang) {
  const P = T.pricing;
  const body = `<h1>${esc(P.h1)}</h1>
<p class="lede">${esc(P.lede(FREE_CLIPS))}</p>
<div class="packs">
<div class="pack"><b>${esc(P.free)}</b><span class="price">$0</span><span>${esc(P.clips(FREE_CLIPS))}</span><a class="btn ghost" href="${href(lang, "/clip")}">${esc(P.start)}</a></div>
${PACKS.map((p) => `<div class="pack"><b>${esc(P.clips(p.clips))}</b><span class="price">$${p.price}</span><span>${esc(P.each(money(p.price / p.clips, 3).replace(/0$/, "")))}</span><button class="btn buy" data-pack="${p.id}">${esc(P.buy(p.clips))}</button></div>`).join("")}
</div>
<p class="small" id="buymsg"></p>
<p class="small">${esc(P.pay)}</p>
<h2>${esc(P.faqH)}</h2>
${P.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}
<script type="module" src="/js/buy.js?v=6"></script>`;
  return layout({ lang, title: P.title, desc: P.desc(FREE_CLIPS, PACKS), path: "/pricing", body,
    jsonld: [{ "@context": "https://schema.org", "@type": "FAQPage", inLanguage: lang, mainEntity: P.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) }] });
}

// The board itself is one board in every language: a post shows in the language it was written
// in. Only the frame around it, and the launch items heistclips itself seeded, are translated.
function requests(list, T, lang) {
  const R = T.requests;
  const counts = { requested: 0, building: 0, shipped: 0 };
  list.forEach((x) => counts[x.status]++);
  const card = (x) => {
    const seeded = x.by === "Suggested by heistclips";
    const tr = seeded && R.seeds[x.title];
    return `<li class="req" id="${esc(x.id)}" data-id="${esc(x.id)}" data-kind="${x.kind === "bug" ? "bug" : "feature"}">
<button class="vote${x.voted ? " on" : ""}" data-vote="${esc(x.id)}" aria-label="${esc(R.upvote)}"><span>▲</span><b>${x.votes}</b></button>
<div${seeded ? "" : ' dir="auto" data-notr'}><b>${esc(tr ? tr[0] : x.title)}</b>${x.detail ? `<p>${esc(tr ? tr[1] : x.detail)}</p>` : ""}<span class="meta">${x.kind === "bug" ? `<em class="st st-bug">${esc(R.bugTag)}</em> ` : ""}<em class="st st-${esc(x.status)}">${esc(R.status[x.status] || x.status)}</em> ${esc(seeded ? R.byUs : R.byClipper)}</span>${x.response || x.shipped_at ? `<p class="resp st-${esc(x.status)}" dir="auto"><b>${esc(R.lead[x.status] || R.lead.update)}${x.status === "shipped" && x.shipped_at ? " " + new Date(x.shipped_at).toLocaleDateString(T.locale, { month: "short", day: "numeric", timeZone: "America/Chicago" }) : ""}</b>${x.response ? " — " + esc(x.response) : ""}</p>` : ""}${shippedLink(x, lang)}</div></li>`;
  };
  const body = `<h1>${esc(R.h1)}</h1>
<p class="lede">${esc(R.lede)}</p>
<p class="small">${esc(R.counts(counts.requested, counts.building, counts.shipped))}</p>
${boardAllLink(lang)}
<form class="reqform" id="reqform" autocomplete="off" data-ok-bug="${esc(R.bugOk)}" data-bug-tag="${esc(R.bugTag)}">
<div class="reqkind" role="radiogroup"><label><input type="radio" name="kind" value="feature" checked> ${esc(R.kindFeature)}</label><label><input type="radio" name="kind" value="bug"> ${esc(R.kindBug)}</label></div>
<input name="title" maxlength="90" placeholder="${esc(R.ph)}" required aria-label="${esc(R.aria)}" dir="auto" data-ph-feature="${esc(R.ph)}" data-ph-bug="${esc(R.bugPh)}">
<div id="bugfields" hidden>
<input name="source" maxlength="200" placeholder="${esc(R.bugStreamPh)}" aria-label="${esc(R.bugStreamPh)}" autocapitalize="off" autocorrect="off" disabled>
<textarea name="what_happened" maxlength="400" rows="3" placeholder="${esc(R.bugWhatPh)}" aria-label="${esc(R.bugWhatPh)}" dir="auto" disabled></textarea>
<input name="expected" maxlength="300" placeholder="${esc(R.bugExpectPh)}" aria-label="${esc(R.bugExpectPh)}" dir="auto" disabled>
</div>
<details><summary class="small" data-feature="${esc(R.more)}" data-bug="${esc(R.moreBug)}">${esc(R.more)}</summary>
<textarea name="detail" maxlength="400" rows="3" placeholder="${esc(R.detailPh)}" aria-label="${esc(R.detailPh)}" dir="auto"></textarea>
<input name="contact" maxlength="120" placeholder="${esc(R.contactPh)}" aria-label="${esc(R.contactPh)}"></details>
<input name="website" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true">
<button class="btn" data-feature="${esc(R.btn)}" data-bug="${esc(R.bugBtn)}">${esc(R.btn)}</button><span class="small" id="reqmsg"></span></form>
<div class="reqfilter" id="reqfilter"><button type="button" class="on" data-kind="all">${esc(R.filterAll)}</button><button type="button" data-kind="feature">${esc(R.filterFeatures)}</button><button type="button" data-kind="bug">${esc(R.filterBugs)}</button></div>
<ol class="reqs-list" id="reqs">${list.map(card).join("")}</ol>
<p class="small">${esc(R.note)}</p>
${L10N_JS}<script type="module" src="/js/requests.js?v=8"></script>`;
  return layout({ lang, title: R.title, desc: R.desc, path: "/requests", body });
}

const FILTERS = { gta: (c) => c.is_gta, gaming: (c) => c.is_gaming, all: () => true };

function ranker(snap, f, T, lang) {
  const s = snap.summary, K = T.ranker;
  f = FILTERS[f] ? f : "gaming";
  const list = snap.campaigns.filter(FILTERS[f]);
  const base = href(lang, "/gta-6-clipping-campaigns");
  const tabs = [["gta", "GTA"], ["gaming", K.tabGaming], ["all", K.tabAll]].map(([k, l]) => `<a href="${base}${k === "gaming" ? "" : "?f=" + k}" class="${k === f ? "on" : ""}">${esc(l)} <small>${snap.campaigns.filter(FILTERS[k]).length}</small></a>`).join("");
  const body = `
<h1>${esc(K.h1)}</h1>
${updated(snap, T)}
<p class="lede">${K.lede(s.campaigns, s.with_track_record, money(s.earned_per_clip_median), money(s.earned_per_clip_p90), money(s.earned_per_clip_p10))}</p>
${list.length ? `<p class="lede you-lede">${esc(T.size.lede(paysAtSize(list.slice(0, 150)), Math.min(150, list.length)))}</p>` : ""}
<nav class="tabs">${tabs}</nav>
${list.length ? sizeBar(T.size) + rows(list.slice(0, 150), T, lang, 0, snap.streamers) : `<p>${esc(K.none)}</p>`}
${list.length > 150 ? `<p class="small">${esc(K.showing(list.length))}</p>` : ""}
<section class="method"><h2>${esc(K.methodH)}</h2>${[...K.method.slice(0, -1), T.size.method, ...K.method.slice(-1)].map((p) => `<p>${p}</p>`).join("")}</section>
${SIZE_JS}`;
  return layout({ lang, title: K.title(when(snap.generated_at, T).split(",")[0]), desc: K.desc(s.campaigns, s.gta, s.gaming), path: "/gta-6-clipping-campaigns", body, wide: true, cta: ctaBox(lang, { src: "cta-ranker" }) });
}

function rates(snap, history, T, lang) {
  const s = snap.summary, R = T.rates;
  const gta = snap.campaigns.filter((c) => c.is_gta);
  const hist = (history || []).slice(-48);
  const table = hist.length > 1 ? `<h2>${esc(R.histH(hist.length))}</h2><div class="tablewrap"><table><thead><tr>${R.th.map((x) => `<th>${esc(x)}</th>`).join("")}</tr></thead><tbody>${hist.slice().reverse().slice(0, 24).map((h) => `<tr><td>${esc(h.at.slice(5, 16).replace("T", " "))}</td><td>${h.summary.campaigns}</td><td>${h.summary.gta}</td><td>${money(h.summary.earned_per_clip_median)}</td><td>${money(h.summary.rate_per_1k_median)}</td><td>${money(h.summary.budget_left_total, 0)}</td></tr>`).join("")}</tbody></table></div>` : "";
  const body = `<h1>${esc(R.h1)}</h1>
${updated(snap, T)}
<div class="stats">
<div><b>${money(s.earned_per_clip_median)}</b><span>${esc(R.stat[0])}</span></div>
<div><b>${money(s.rate_per_1k_median)}</b><span>${esc(R.stat[1])}</span></div>
<div><b>${money(s.cap_median, 0)}</b><span>${esc(R.stat[2])}</span></div>
<div><b>${s.gta}</b><span>${esc(R.stat[3])}</span></div>
</div>
<p class="lede">${esc(R.lede(s.campaigns, money(s.budget_left_total, 0), money(s.earned_per_clip_p90), money(s.earned_per_clip_p10)))}</p>
<h2>${esc(R.gtaH)}</h2>
${gta.length ? `<p class="small you-lede">${esc(T.size.lede(paysAtSize(gta), gta.length))}</p>${sizeBar(T.size)}${rows(gta, T, lang, 0, snap.streamers)}${SIZE_JS}` : `<p>${esc(R.none)}</p>`}
<p><a class="more" href="${href(lang, "/gta-6-clipping-campaigns")}">${esc(R.all)}</a></p>
${table}`;
  return layout({ lang, title: R.title(money(s.rate_per_1k_median), money(s.earned_per_clip_median)), desc: R.desc(money(s.rate_per_1k_median), money(s.cap_median, 0), money(s.earned_per_clip_median), s.gta), path: "/gta-6-clipping-rates-today", body, cta: ctaBox(lang, { src: "cta-rates" }) });
}

function guidesIndex(T, lang) {
  const body = `<h1>${esc(T.guides.h1)}</h1><ul class="vods">${GUIDES.map((g) => `<li><a href="${href(lang, "/guides/" + g.slug)}"><b>${esc((T.guides.pages[g.slug] || {}).name || g.title)}</b></a></li>`).join("")}</ul>`;
  return layout({ lang, title: T.guides.title, desc: T.guides.desc, path: "/guides", body });
}

function guide(snap, slug, T, lang) {
  const g = T.guides.pages[slug];
  if (!g || !GUIDES.find((x) => x.slug === slug)) return null;
  const s = snap.summary;
  const n = {
    campaigns: s.campaigns, tracked: s.with_track_record, gta: s.gta,
    typical: money(s.earned_per_clip_median), p90: money(s.earned_per_clip_p90), p10: money(s.earned_per_clip_p10),
    rate: money(s.rate_per_1k_median || 1), cap: money(s.cap_median || 100, 0),
    capViews: Math.round((s.cap_median || 100) / (s.rate_per_1k_median || 1) * 1000).toLocaleString(T.locale),
    views: (s.views_per_clip_median || 0).toLocaleString(T.locale), budget: money(s.budget_left_total, 0), when: when(snap.generated_at, T),
    clip: href(lang, "/clip"), ranker: href(lang, "/gta-6-clipping-campaigns"),
    gtaRows: () => { const l = snap.campaigns.filter((c) => c.is_gta); return l.length ? rows(l.slice(0, 10), T, lang, 0, snap.streamers) : `<p>${esc(T.rates.none)}</p>`; },
  };
  const r = g.page(n);
  const faq = r.faq || [];
  return layout({ lang, title: g.title(n), desc: g.desc(n), path: "/guides/" + slug, cta: ctaBox(lang, { src: "cta-guide" }),
    body: `<p class="crumbs"><a href="${href(lang, "/guides")}">${esc(T.guides.h1)}</a></p>` + r.body + faq.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join(""),
    jsonld: [{ "@context": "https://schema.org", "@type": "Article", inLanguage: lang, headline: g.name, url: `${SITE}${href(lang, "/guides/" + slug)}`, dateModified: snap.generated_at, author: { "@type": "Organization", name: "heistclips" } },
      faq.length ? { "@context": "https://schema.org", "@type": "FAQPage", inLanguage: lang, mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) } : null] });
}

// ---- the pages added in the second pass (2026-11-19): campaign pages, streamers, data,
// autopilot, about, legal, connect, 404. Same rule as above: the markup mirrors the English page
// in render.js / searchpages.js / queuepage.js and only the words differ. What a campaign owner
// or a streamer wrote (titles, briefs, stream titles) stays as written.
const L10N_JS = `<script type="module" src="/js/l10n.js?v=10"></script>`;
const dayOf = (iso, T) => new Date(iso).toLocaleDateString(T.locale, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const big = (n, T) => Number(n || 0).toLocaleString(T.locale);
const clock = (t) => `${Math.floor(t / 3600)}:${String(Math.floor((t % 3600) / 60)).padStart(2, "0")}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
const cutStr = (str, n) => Array.from(String(str || "")).slice(0, n).join("");
const reqChips = (c, T) => [c.approval_required ? "apply first" : null, ...(c.requirements || [])].filter(Boolean).map((r) => `<em>${esc(T.req[r] || r)}</em>`).join("");

function campaign(snap, c, T, lang) {
  const C = T.campaign;
  const rank = snap.campaigns.indexOf(c) + 1;
  const plats = (c.payouts || []).map((p) => `<tr><td>${esc(PLATFORM[p.platform] || p.platform)}</td><td>${p.rate_per_1k != null ? money(p.rate_per_1k) : "–"}</td><td>${p.cap_per_clip != null ? money(p.cap_per_clip, 0) : esc(C.none)}</td><td>${p.min_payout != null ? money(p.min_payout) : "–"}</td></tr>`).join("");
  const d = c.description || "";
  const brief = d.length > 900 ? d.slice(0, 900) + "…" : d;
  const viewsFor = c.rate_per_1k ? Math.round((c.cap_per_clip || 0) / c.rate_per_1k * 1000) : null;
  const st = namedStreamer(c, snap.streamers);
  const pace = c.days_left != null ? (c.days_left < 3 ? C.hours(Math.max(1, Math.round(c.days_left * 24))) : C.days(Math.round(c.days_left))) : "";
  const facts = C.facts({
    clips: num(c.approved_clips), clippers: num(c.clippers_count), views: num(c.total_views), perClip: c.views_per_clip ? num(c.views_per_clip) : null,
    spent: money(c.budget_spent, 0), avg: c.avg_per_clip != null ? money(c.avg_per_clip) : null, earned: c.earned_per_clip != null ? money(c.earned_per_clip) : null,
    clips7: num(c.clips_7d), views7: num(c.views_7d), top: num(c.top_clip_views), apply: !!c.approval_required, geo: !!c.geo_priced,
  });
  const about = { title: c.title, owner: c.owner, rate: c.rate_per_1k != null ? money(c.rate_per_1k) : null, cap: c.cap_per_clip != null ? money(c.cap_per_clip, 0) : null, left: money(c.budget_left, 0), clippers: c.clippers_count };
  const body = `
<p class="crumbs"><a href="/gta-6-clipping-campaigns">${esc(C.crumb)}</a> › ${c.is_gta ? "GTA" : c.is_gaming ? "Gaming" : esc((c.categories || [])[0] || C.other)}</p>
<h1 data-notr>${esc(c.title)}</h1>
<p class="meta">${esc(C.meta((c.owner || "") + (c.owner_verified ? " ✓" : ""), rank, snap.campaigns.length))}</p>
<div class="stats">
<div><b>${c.expected_per_clip != null ? money(c.expected_per_clip) : esc(C.newB)}</b><span>${esc(c.expected_per_clip != null ? C.typical : C.noneYet)}</span></div>
${c.at_size ? `<div class="youstat">${youBlock(c, T.size)}</div>` : ""}
<div><b>${c.rate_per_1k != null ? money(c.rate_per_1k) : c.per_post != null ? money(c.per_post) : "–"}</b><span>${esc(c.per_post != null ? C.perPost : C.per1k)}</span></div>
<div><b>${c.cap_per_clip != null ? money(c.cap_per_clip, 0) : esc(C.none)}</b><span>${esc(C.max(viewsFor ? num(viewsFor) : null))}</span></div>
<div><b>${money(c.budget_left, 0)}</b><span>${esc(C.left(money(c.budget_total, 0)) + pace)}</span></div>
<div><b>${money(c.paid_out, 0)}</b><span>${esc(C.paid)}</span></div>
</div>
${(c.requirements || []).length || c.approval_required ? `<p class="meta reqs">${esc(C.watch)} ${reqChips(c, T)} <span class="small">${esc(C.fromBrief)}</span></p>` : ""}
<p class="actions"><a class="btn" href="${esc(c.source_url)}" rel="nofollow noopener" target="_blank">${esc(C.join)}</a> ${st ? `<a class="btn ghost" href="${esc(clipHref(st, "campaign"))}">${esc(CHROME[lang].cta.for(st.name || st.login))}</a>` : `<a class="btn ghost" href="/clip">${esc(C.cut)}</a>`}</p>
${c.at_size ? sizeSection(c, T.size, { bar: sizeBar(T.size, { sort: false }) }) + SIZE_JS : ""}
<h2>${esc(C.earnedH)}</h2>
<ul class="facts">${facts.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
<h2>${esc(C.rateH)}</h2>
<div class="tablewrap"><table><thead><tr>${C.th.map((x) => `<th>${esc(x)}</th>`).join("")}</tr></thead><tbody>${plats}</tbody></table></div>
<h2>${esc(C.briefH)}</h2>
<blockquote class="brief" data-notr dir="auto">${esc(brief).replace(/\n/g, "<br>")}</blockquote>
<p class="small">${esc(C.briefNote)}</p>
${updated(snap, T)}`;
  return layout({ lang, path: "/campaigns/" + c.slug, body, cta: ctaBox(lang, { src: "cta-campaign", streamer: st }),
    title: C.title(c.title, about.rate, c.expected_per_clip != null ? money(c.expected_per_clip) : null), desc: C.desc(about),
    jsonld: [{ "@context": "https://schema.org", "@type": "Dataset", inLanguage: lang, name: c.title, url: SITE + href(lang, "/campaigns/" + c.slug), dateModified: snap.generated_at, description: C.desc(about),
      isAccessibleForFree: true, license: "https://opensource.org/licenses/MIT", creator: { "@type": "Organization", name: "heistclips", url: SITE } }] });
}

// An ended campaign keeps its URL in every language (lib/ended.js). `e` may be { slug } alone.
function ended(snap, e, T, lang) {
  const E = T.ended, C = T.campaign, c = e.campaign || null;
  const alts = snap.campaigns.filter((x) => (c && c.is_gta ? x.is_gta : c && !c.is_gaming ? true : x.is_gaming || x.is_gta)).slice(0, 5);
  const list = alts.length >= 3 ? alts : snap.campaigns.slice(0, 5);
  const when = e.ended_at ? dayOf(e.ended_at, T) : null;
  const body = `
<p class="crumbs"><a href="/gta-6-clipping-campaigns">${esc(C.crumb)}</a> › ${esc(E.crumb)}</p>
<h1>${esc(c ? c.title : E.h1)}</h1>
<p class="meta"><b class="warn">${esc(E.endedOn(when))}</b> ${c ? esc(E.by(c.owner || "")) + " · " : ""}${esc(E.closed)}</p>
${c ? `<div class="stats">
<div><b>${c.earned_per_clip != null ? money(c.earned_per_clip) : "–"}</b><span>${esc(E.typical)}</span></div>
<div><b>${c.rate_per_1k != null ? money(c.rate_per_1k) : c.per_post != null ? money(c.per_post) : "–"}</b><span>${esc(c.per_post != null ? C.perPost : C.per1k)}</span></div>
<div><b>${c.cap_per_clip != null ? money(c.cap_per_clip, 0) : esc(C.none)}</b><span>${esc(C.max(null))}</span></div>
<div><b>${money(c.budget_spent, 0)}</b><span>${esc(E.earnedOf(money(c.budget_total, 0)))}</span></div>
<div><b>${big(c.approved_clips, T)}</b><span>${esc(E.approvedFrom(big(c.clippers_count, T)))}</span></div>
</div>
<p class="small">${esc(E.final(dayOf(e.last_seen || e.ended_at, T)))} ${esc(e.why === "budget" ? E.whyBudget : E.whyGone)}</p>` : `<p>${esc(E.noNumbers)}</p>`}
<h2>${esc(E.payingH)}</h2>
<p class="small">${esc(E.best(!!(c && c.is_gta)))}</p>
${rows(list, T, lang)}
<p><a class="more" href="/gta-6-clipping-campaigns">${esc(E.all(snap.summary.campaigns))}</a></p>`;
  return layout({ lang, path: "/campaigns/" + (c ? c.slug : e.slug), body, noindex: !c,
    title: E.title(c ? c.title : E.h1, when),
    desc: c ? E.desc({ title: c.title, owner: c.owner, when, rate: c.rate_per_1k != null ? money(c.rate_per_1k) : null, earned: c.earned_per_clip != null ? money(c.earned_per_clip) : null }) : E.descNone });
}

function streamers(snap, T, lang) {
  const X = T.streamers, list = snap.streamers || [];
  const live = list.filter((s) => s.live_now).sort((a, b) => b.viewers_now - a.viewers_now);
  const rest = list.filter((s) => !s.live_now).sort((a, b) => (b.peak_viewers || 0) - (a.peak_viewers || 0));
  const li = (s) => `<li><a href="${s.platform === "kick" ? "/streamers/kick/" + esc(s.login) : "/streamers/" + esc(s.login)}"><img src="${esc(s.avatar || "")}" alt="" width="36" height="36" loading="lazy"><span><b>${esc(s.name || s.login)}</b><small>${esc(s.live_now ? X.live(num(s.viewers_now)) : X.peak(num(s.peak_viewers)))}${s.platform === "kick" ? " · Kick" : ""}</small></span></a></li>`;
  const body = `<h1>${esc(X.h1)}</h1>
<p class="lede">${esc(X.lede)}</p>
${updated(snap, T)}
<h2>${esc(X.liveH)}</h2><ul class="live">${live.map(li).join("") || `<li>${esc(X.nobody)}</li>`}</ul>
<h2>${esc(X.recentH)}</h2><ul class="live">${rest.slice(0, 200).map(li).join("")}</ul>`;
  return layout({ lang, title: X.title, desc: X.desc, path: "/streamers", body });
}

// "How to clip <streamer>". `row` is the snapshot row (may be bare), `chan` the live channel read.
function streamer(snap, { row: s, chan, camps, trend }, T, lang) {
  const S = T.streamer, platform = s.platform === "kick" ? "kick" : "twitch", PN = platform === "kick" ? "Kick" : "Twitch";
  const name = (chan && chan.name) || s.name || s.login;
  const vods = (chan && chan.vods) || [];
  const live = !!(chan && chan.is_live);
  const game = (live && chan.stream && chan.stream.game) || (vods[0] && vods[0].game) || s.game || "";
  const lastTitle = (live && chan.stream && chan.stream.title) || (vods[0] && vods[0].title) || s.last_title || "";
  const q = platform === "kick" ? "kick.com/" + s.login : s.login;
  const path = (platform === "kick" ? "/streamers/kick/" : "/streamers/") + s.login;
  const mine = (x) => x.platform === platform && x.login === s.login;
  const tStream = ((trend && trend.streams) || []).find(mine);
  const hot = ((trend && trend.moments) || []).filter(mine).slice(0, 6);
  const best = camps.filter((c) => c.expected_per_clip != null).sort((a, b) => b.expected_per_clip - a.expected_per_clip)[0];
  const fallback = snap.campaigns.filter((c) => c.is_gta || c.is_gaming).slice(0, 3);
  const faq = S.faq({ name, url: "heistclips.com" + href(lang, path), free: FREE_CLIPS, n: camps.length, date: dayOf(snap.generated_at, T), best: best ? money(best.expected_per_clip) : null });
  const ph = T.search.box.ph(PN);
  const body = `
<p class="crumbs"><a href="/streamers">${esc(S.crumb)}</a> › ${esc(name)}</p>
<div class="who">${(chan && chan.avatar) || s.avatar ? `<img src="${esc((chan && chan.avatar) || s.avatar)}" alt="" width="56" height="56">` : ""}<div><h1>${esc(S.h1(name, platform === "kick"))}</h1>
<p class="meta">${live ? `<b class="livedot">LIVE</b> ${chan.stream && chan.stream.viewers != null ? esc(T.watching(big(chan.stream.viewers, T))) : ""}` : esc(S.offline)}${game ? ` · ${esc(game)}` : ""} · ${PN}</p></div></div>
<p class="lede">${esc(S.lede(name, live))}</p>
<section class="cta" data-cta="streamer">
<form class="paste" action="/clip" method="get"${platform === "kick" ? ` onsubmit="var i=this.q,v=i.value.trim();if(v&amp;&amp;!/[.\\/:]/.test(v))i.value='kick.com/'+v"` : ""}><input name="q" value="${esc(q)}" placeholder="${esc(ph)}" aria-label="${esc(ph)}" autocomplete="off" autocapitalize="off" spellcheck="false"><input type="hidden" name="src" value="streamer"><button>${esc(S.button(name))}</button></form>
<p class="small">${esc(T.search.box.fine)}</p>
</section>
<h2>${esc(S.whatH(name))}</h2>
<p>${game ? `${esc(live ? S.liveIn : S.lastIn)} <b>${esc(game)}</b>.` : esc(S.noStream)}${lastTitle ? ` ${esc(S.titleLine)} “${esc(cutStr(lastTitle, 140))}”.` : ""}${s.peak_viewers ? ` ${esc(S.peak(big(s.peak_viewers, T)))}` : ""}</p>
<h2>${esc(S.payH(name))}</h2>
<p>${camps.length ? esc(S.payYes(camps.length, name)) + " " + (best ? S.payBest(B(money(best.expected_per_clip))) : esc(S.payNoNumber)) : esc(S.payNo(name))}</p>
${rows(camps.length ? camps : fallback, T, lang)}
${hot.length ? `<h2>${esc(S.momentsH(name))}</h2><ol class="vods">${hot.map((m) => `<li><a href="${esc(m.clip_path)}"><b>${esc(S.into(clock(m.t)))}</b><small>${esc(T.search.clips(m.clips))}${m.title ? " · " + esc(cutStr(m.title, 70)) : ""}</small></a></li>`).join("")}</ol>` : tStream ? `<p class="small">${esc(S.madeFrom(T.search.clips(tStream.clips), name, trend.window_days))}</p>` : ""}
${vods.length ? `<h2>${esc(S.recentH)}</h2><ul class="vods">${vods.slice(0, 5).map((v) => `<li><a href="/clip?q=${encodeURIComponent(platform === "kick" ? v.url : v.id)}&amp;src=streamer-vod"><b>${esc(v.title || S.untitled)}</b><small>${esc(v.game || "")} · ${(Math.round(v.length / 360) / 10).toLocaleString(T.locale)} ${esc(S.h)} · ${esc(new Date(v.created_at).toLocaleDateString(T.locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }))}${v.status === "RECORDING" ? " · " + esc(S.recording) : ""}</small></a></li>`).join("")}</ul>` : ""}
<p class="small">${esc(S.fine(name))}</p>`;
  return layout({ lang, path, body, title: S.title(name, platform === "kick"), desc: S.desc(name, PN, camps.length),
    jsonld: [{ "@context": "https://schema.org", "@type": "FAQPage", inLanguage: lang, mainEntity: faq.map(([qq, a]) => ({ "@type": "Question", name: qq, acceptedAnswer: { "@type": "Answer", text: a } })) },
      { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: S.crumb, item: SITE + href(lang, "/streamers") }, { "@type": "ListItem", position: 2, name, item: SITE + href(lang, path) }] }] });
}

function data(snap, trend, T, lang) {
  const D = T.data, s = snap.summary;
  const stat = D.stat(s.with_track_record);
  const files = D.files(s.campaigns, trend ? { n: trend.clips_counted, days: trend.window_days } : null);
  const body = `<h1>${esc(D.h1)}</h1>
<p class="updated">${esc(D.updated(when(snap.generated_at, T)))}</p>
<p class="lede">${esc(D.lede(s.campaigns))}</p>
<div class="stats">
<div><b>${money(s.earned_per_clip_median)}</b><span>${esc(stat[0])}</span></div>
<div><b>${money(s.rate_per_1k_median)}</b><span>${esc(stat[1])}</span></div>
<div><b>${money(s.earned_per_clip_p90)}</b><span>${esc(stat[2])}</span></div>
<div><b>${money(s.budget_left_total, 0)}</b><span>${esc(stat[3])}</span></div>
</div>
<h2>${esc(D.filesH)}</h2>
<ul class="vods">
${[RATES_CSV, RATES_JSON, TREND_JSON].map((u, i) => `<li><a href="${u}"><b>${esc(files[i][0])}</b><small>${esc(files[i][1])}</small></a></li>`).join("\n")}
</ul>
<h2>${esc(D.licH)}</h2>
<p>${esc(D.licence)}</p>
<p class="small">${esc(D.note)}</p>
<h2>${esc(D.fieldsH)}</h2>
<div class="tablewrap"><table><thead><tr>${D.th.map((x) => `<th>${esc(x)}</th>`).join("")}</tr></thead><tbody>${RATE_FIELDS.map(([k, v]) => `<tr><td><code>${esc(k)}</code></td><td>${esc(D.fields[k] || v)}</td></tr>`).join("")}</tbody></table></div>
<h2>${esc(D.aiH)}</h2>
<p>${D.ai}</p>`;
  return layout({ lang, title: D.title(dayOf(snap.generated_at, T)), desc: D.desc(s.campaigns), path: DATA_PATH, body });
}

function queue(T, lang) {
  const Q = T.queue;
  const body = `
<div id="q-root">
<section id="q-start">
<h1 class="q-h1">${esc(Q.h1)}</h1>
<p class="lede">${esc(Q.lede)}</p>
</section>
<h2 id="q-addh">${esc(Q.addH)}</h2>
<form class="q-add" id="q-add" autocomplete="off">
<input id="q-in" name="ch" placeholder="${esc(Q.ph)}" aria-label="${esc(Q.aria)}" autocapitalize="off" spellcheck="false" enterkeyhint="go">
<button class="btn" id="q-go">${esc(Q.go)}</button>
</form>
<h2 id="q-payh" hidden>${esc(Q.payH)}<small>${esc(Q.paySmall)}</small></h2>
<div id="q-size" hidden>${sizeBar(T.size, { sort: false })}</div>
<ol class="q-pays" id="q-pays"></ol>
<div id="q-paymore"></div>
<p class="q-status" id="q-status" role="status"></p>
<ul class="q-watch" id="q-watch"></ul>
<ol class="q-list" id="q-list"></ol>
<div id="q-more"></div>
<p class="small" id="q-foot">${Q.foot(FREE_CLIPS)}</p>
</div>
<noscript><p class="note">${esc(Q.noscript)}</p></noscript>
${L10N_JS}${SIZE_JS}<script type="module" src="${QUEUE_SRC()}"></script>`;
  return layout({ lang, title: Q.title, desc: Q.desc, path: "/queue", body, extraHead: QUEUE_CSS });
}

// About, privacy, terms and connect are prose: each language carries its own body.
function prose(key, T, lang, extra = {}) {
  const P = T[key];
  return layout({ lang, title: P.title, desc: P.desc, path: "/" + key, body: P.body({ site: SITE, ...extra }) });
}

function connect(tools, T, lang) {
  const list = (tools || []).map((t) => `<li><b>${esc(t.name)}</b> – ${esc(T.connect.tools[t.name] || t.title)}.</li>`).join("\n");
  return prose("connect", T, lang, { tools: list });
}

// The 404 in the visitor's language (the router sends it for a /de/… path that is no page).
export function notFoundPage(lang) {
  const T = WORDS[lang];
  if (!T) return null;
  return localLinks(layout({ lang, title: T.notFound.title, desc: T.notFound.desc, path: "/404", noindex: true, body: `<h1>${esc(T.notFound.h1)}</h1><p><a href="/">${esc(T.notFound.back)}</a></p>` }), lang);
}

// The /post page's words, for api/v1/post.js (which owns that page's markup and logic).
export const postWords = (lang) => (WORDS[lang] ? WORDS[lang].post : null);

// Every link inside <main> that points at an English path with a translation goes to the
// translation. One pass here, so a page builder (or a campaign row built in English by
// render.js) never has to remember it.
export function localLinks(html, lang) {
  const a = html.indexOf("<main"), b = html.indexOf("</main>");
  if (a < 0 || b < 0) return html;
  const main = html.slice(a, b).replace(/(href|action)="(\/[^"?#]*)([?#][^"]*)?"/g, (m, attr, p, rest) => `${attr}="${href(lang, p)}${rest || ""}"`);
  return html.slice(0, a) + main + html.slice(b);
}

// Render `path` (the English path) in `lang`, or null if that page has no translation. Pages
// about one record get it from the router (api/page.js): `campaign` or `ended` for
// /campaigns/<slug>, `streamer` = { row, chan, camps, trend } for /streamers/…, `tools` for /connect.
export function localPage(lang, path, ctx) {
  const T = WORDS[lang];
  if (!T) return null;
  const html = build(lang, path, T, ctx);
  return html ? localLinks(html, lang) : null;
}

function build(lang, path, T, { snap, query, board, history, trend, campaign: camp, ended: gone, streamer: who, tools }) {
  if (path === "/") return home(snap, T, lang);
  if (path === "/clip") return clip(query.get("q") || "", T, lang);
  if (path === "/pricing") return pricing(T, lang);
  if (path === "/requests") return requests(board || [], T, lang);
  if (path === "/guides") return guidesIndex(T, lang);
  if (path === "/gta-6-clipping-campaigns") return ranker(snap, query.get("f") || "gaming", T, lang);
  if (path === "/gta-6-clipping-rates-today") return rates(snap, history, T, lang);
  if (MAKERS[path]) return makerPage(path, trend, lang, { locale: T.locale, ...T.search });
  if (path === NEW_PATH) return whatsNewPage(lang);
  if (path === TREND_PATH) return trend ? trendPage(trend, lang, { locale: T.locale, ...T.search }) : null;
  if (path === "/streamers") return streamers(snap, T, lang);
  if (path === DATA_PATH) return data(snap, trend, T, lang);
  if (path === "/queue") return queue(T, lang);
  if (path === "/about" || path === "/privacy" || path === "/terms") return prose(path.slice(1), T, lang);
  if (path === "/connect") return connect(tools, T, lang);
  if (/^\/campaigns\/[a-z0-9-]+$/.test(path)) return camp ? campaign(snap, camp, T, lang) : gone ? ended(snap, gone, T, lang) : null;
  if (/^\/streamers\/(kick\/)?[a-z0-9_-]+$/.test(path)) return who ? streamer(snap, who, T, lang) : null;
  const m = path.match(/^\/guides\/([a-z0-9-]+)$/);
  if (m) return guide(snap, m[1], T, lang);
  return null;
}
