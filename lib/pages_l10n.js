// The German and French pages. English stays in render.js and guides.js; this file renders the
// same pages from a words table (lib/l10n_de.js, lib/l10n_fr.js). Every number still comes from
// the live snapshot, exactly as on the English page. A path with no translation returns null
// and the router sends the visitor to the English page.
import { layout, esc, money, campaignList, clipPage, FREE_CLIPS, PACKS, SITE } from "./render.js";
import { GUIDES } from "./guides.js";
import { href, ctaBox } from "./i18n.js";
import de from "./l10n_de.js";
import fr from "./l10n_fr.js";

export const WORDS = { de, fr };

// The clip tool's script tag, read off the English page so both always load the same version.
const APP_SRC = () => (clipPage("").match(/\/js\/app\.js\?v=\d+/) || ["/js/app.js"])[0];

const num = (x) => (x == null ? "–" : x >= 1e6 ? (x / 1e6).toFixed(1) + "M" : x >= 1e3 ? (x / 1e3).toFixed(x >= 1e4 ? 0 : 1) + "k" : String(x));
const when = (iso, T) => new Date(iso).toLocaleString(T.locale, { timeZone: "UTC", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " UTC";
const updated = (snap, T) => `<p class="updated">${esc(T.updated(when(snap.generated_at, T), Math.max(0, Math.round((Date.now() - Date.parse(snap.generated_at)) / 60000))))}</p>`;

// Campaign rows are built once, in English, by render.js. Their fixed labels are swapped here;
// campaign titles and briefs are the campaign owner's words and stay as written.
export function rows(list, T, lang, start = 0) {
  let html = campaignList(list, start);
  for (const [re, to] of T.rows) html = html.replace(re, to);
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
${rows(pay, T, lang)}
<p><a class="more" href="${href(lang, "/gta-6-clipping-campaigns")}">${esc(H.all(s.campaigns))}</a></p>
</section>
<section class="ask"><h2>${esc(H.askH)}</h2><p>${esc(H.askP)} <a class="more" href="${href(lang, "/requests")}">${esc(H.askLink)}</a></p></section>
<section class="three">${H.three.map(([h, p]) => `<div><h3>${esc(h)}</h3><p>${esc(p)}</p></div>`).join("")}</section>
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
    extraHead: `<script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js" defer></script><script type="module" src="/js/l10n.js?v=2"></script><script type="module" src="${APP_SRC()}"></script>` });
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
<script type="module" src="/js/buy.js?v=5"></script>`;
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
    return `<li class="req" id="${esc(x.id)}" data-id="${esc(x.id)}">
<button class="vote${x.voted ? " on" : ""}" data-vote="${esc(x.id)}" aria-label="${esc(R.upvote)}"><span>▲</span><b>${x.votes}</b></button>
<div${seeded ? "" : ' dir="auto" data-notr'}><b>${esc(tr ? tr[0] : x.title)}</b>${x.detail ? `<p>${esc(tr ? tr[1] : x.detail)}</p>` : ""}<span class="meta"><em class="st st-${esc(x.status)}">${esc(R.status[x.status] || x.status)}</em> ${esc(seeded ? R.byUs : R.byClipper)}</span>${x.response || x.shipped_at ? `<p class="resp st-${esc(x.status)}" dir="auto"><b>${esc(R.lead[x.status] || R.lead.update)}${x.status === "shipped" && x.shipped_at ? " " + new Date(x.shipped_at).toLocaleDateString(T.locale, { month: "short", day: "numeric", timeZone: "America/Chicago" }) : ""}</b>${x.response ? " — " + esc(x.response) : ""}</p>` : ""}</div></li>`;
  };
  const body = `<h1>${esc(R.h1)}</h1>
<p class="lede">${esc(R.lede)}</p>
<p class="small">${esc(R.counts(counts.requested, counts.building, counts.shipped))}</p>
<form class="reqform" id="reqform" autocomplete="off">
<input name="title" maxlength="90" placeholder="${esc(R.ph)}" required aria-label="${esc(R.aria)}" dir="auto">
<details><summary class="small">${esc(R.more)}</summary>
<textarea name="detail" maxlength="400" rows="3" placeholder="${esc(R.detailPh)}" aria-label="Detail" dir="auto"></textarea>
<input name="contact" maxlength="120" placeholder="${esc(R.contactPh)}" aria-label="Contact"></details>
<input name="website" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true">
<button class="btn">${esc(R.btn)}</button><span class="small" id="reqmsg"></span></form>
<ol class="reqs-list" id="reqs">${list.map(card).join("")}</ol>
<p class="small">${esc(R.note)}</p>
<script type="module" src="/js/l10n.js?v=2"></script><script type="module" src="/js/requests.js?v=6"></script>`;
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
<nav class="tabs">${tabs}</nav>
${list.length ? rows(list.slice(0, 150), T, lang) : `<p>${esc(K.none)}</p>`}
${list.length > 150 ? `<p class="small">${esc(K.showing(list.length))}</p>` : ""}
<section class="method"><h2>${esc(K.methodH)}</h2>${K.method.map((p) => `<p>${p}</p>`).join("")}</section>`;
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
${gta.length ? rows(gta, T, lang) : `<p>${esc(R.none)}</p>`}
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
    gtaRows: () => { const l = snap.campaigns.filter((c) => c.is_gta); return l.length ? rows(l.slice(0, 10), T, lang) : `<p>${esc(T.rates.none)}</p>`; },
  };
  const r = g.page(n);
  const faq = r.faq || [];
  return layout({ lang, title: g.title(n), desc: g.desc(n), path: "/guides/" + slug, cta: ctaBox(lang, { src: "cta-guide" }),
    body: `<p class="crumbs"><a href="${href(lang, "/guides")}">${esc(T.guides.h1)}</a></p>` + r.body + faq.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join(""),
    jsonld: [{ "@context": "https://schema.org", "@type": "Article", inLanguage: lang, headline: g.name, url: `${SITE}${href(lang, "/guides/" + slug)}`, dateModified: snap.generated_at, author: { "@type": "Organization", name: "heistclips" } },
      faq.length ? { "@context": "https://schema.org", "@type": "FAQPage", inLanguage: lang, mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) } : null] });
}

// Render `path` (the English path) in `lang`, or null if that page has no translation.
export function localPage(lang, path, { snap, query, board, history }) {
  const T = WORDS[lang];
  if (!T) return null;
  if (path === "/") return home(snap, T, lang);
  if (path === "/clip") return clip(query.get("q") || "", T, lang);
  if (path === "/pricing") return pricing(T, lang);
  if (path === "/requests") return requests(board || [], T, lang);
  if (path === "/guides") return guidesIndex(T, lang);
  if (path === "/gta-6-clipping-campaigns") return ranker(snap, query.get("f") || "gaming", T, lang);
  if (path === "/gta-6-clipping-rates-today") return rates(snap, history, T, lang);
  const m = path.match(/^\/guides\/([a-z0-9-]+)$/);
  if (m) return guide(snap, m[1], T, lang);
  return null;
}
