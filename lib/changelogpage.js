// /whats-new in every language: a dated list of what shipped, newest first, grouped by day.
// The newest day shows its first TOP entries (the file's order is the order of use to a
// clipper); the rest of that day and every older day sit folded, one tap away. Data and the
// add-an-entry command are in lib/changelog.js. Its words live here, in all five languages, so
// the page is one file; test/changelog.test.js fails if a language lacks a word.
import { layout, esc, SITE } from "./render.js";
import { href } from "./i18n.js";
import { entries, localEntry, entryUrl, entryTime, feedPath, feedXml, PATH } from "./changelog.js";

export const TOP = 5;

export const WORDS = {
  en: {
    locale: "en-US",
    title: (d) => `What’s new on heistclips: fixes and new features, updated ${d}`,
    desc: "Every fix and new feature on heistclips, the Twitch and Kick clip maker, listed by date the day it ships.",
    h1: "What’s new", lede: "Every fix and new feature, the day it ships.",
    ask: "Got an idea or a bug? Tell us", feed: "Feed",
    types: { new: "New", improved: "Improved", fixed: "Fixed" },
    try: "Try it", asked: "You asked for this",
    more: (n) => `${n} more from this day`, count: (n) => (n === 1 ? "1 change" : `${n} changes`),
  },
  de: {
    locale: "de-DE",
    title: (d) => `Was ist neu bei heistclips: Fixes und neue Funktionen, Stand ${d}`,
    desc: "Jeder Fix und jede neue Funktion bei heistclips, dem Clip Maker für Twitch und Kick, nach Datum, am Tag, an dem sie live geht.",
    h1: "Was ist neu", lede: "Jeder Fix und jede neue Funktion, am Tag, an dem sie live geht.",
    ask: "Idee oder Bug? Sag es uns", feed: "Feed",
    types: { new: "Neu", improved: "Besser", fixed: "Behoben" },
    try: "Ausprobieren", asked: "Das habt ihr euch gewünscht",
    more: (n) => `${n} weitere von diesem Tag`, count: (n) => (n === 1 ? "1 Änderung" : `${n} Änderungen`),
  },
  fr: {
    locale: "fr-FR",
    title: (d) => `Nouveautés heistclips : correctifs et nouvelles fonctions, à jour au ${d}`,
    desc: "Chaque correctif et chaque nouvelle fonction de heistclips, le créateur de clips Twitch et Kick, par date, le jour de sa sortie.",
    h1: "Nouveautés", lede: "Chaque correctif et chaque nouvelle fonction, le jour de sa sortie.",
    ask: "Une idée ou un bug ? Dis-le-nous", feed: "Flux",
    types: { new: "Nouveau", improved: "Amélioré", fixed: "Corrigé" },
    try: "Essayer", asked: "Vous l’avez demandé",
    more: (n) => `${n} de plus ce jour-là`, count: (n) => (n === 1 ? "1 changement" : `${n} changements`),
  },
  pt: {
    locale: "pt-BR",
    title: (d) => `Novidades do heistclips: correções e funções novas, atualizado em ${d}`,
    desc: "Cada correção e cada função nova do heistclips, o criador de clipes da Twitch e da Kick, por data, no dia em que sai.",
    h1: "Novidades", lede: "Cada correção e cada função nova, no dia em que sai.",
    ask: "Tem uma ideia ou achou um bug? Conte pra gente", feed: "Feed",
    types: { new: "Novo", improved: "Melhorado", fixed: "Corrigido" },
    try: "Testar", asked: "Vocês pediram",
    more: (n) => `Mais ${n} deste dia`, count: (n) => (n === 1 ? "1 mudança" : `${n} mudanças`),
  },
  es: {
    locale: "es-ES",
    title: (d) => `Novedades de heistclips: arreglos y funciones nuevas, actualizado el ${d}`,
    desc: "Cada arreglo y cada función nueva de heistclips, el creador de clips de Twitch y Kick, por fecha, el día que sale.",
    h1: "Novedades", lede: "Cada arreglo y cada función nueva, el día que sale.",
    ask: "¿Tienes una idea o un bug? Cuéntanos", feed: "Feed",
    types: { new: "Nuevo", improved: "Mejorado", fixed: "Arreglado" },
    try: "Probar", asked: "Lo pediste tú",
    more: (n) => `${n} más de este día`, count: (n) => (n === 1 ? "1 cambio" : `${n} cambios`),
  },
};

// Scoped to this page, so the shared stylesheet (and its cache key) is left alone.
const CSS = `<style>
.wn-head{display:flex;flex-wrap:wrap;gap:0 16px;align-items:baseline;margin:0 0 10px}
.wn-head .lede{margin:0;flex:1 1 100%}
.wn-head a{font-size:14px;color:var(--mute);display:inline-block;padding:5px 0}
.wn-day{margin:0 0 18px}
.wn-date{display:flex;gap:10px;align-items:baseline;margin:0 0 8px;font-size:17px}
.wn-date small{font-weight:400;font-size:13px;color:var(--mute)}
.wn{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.wn li{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:10px 12px;scroll-margin-top:72px}
.wn li:target{border-color:var(--acc)}
.wn h3{margin:0;font-size:16px;line-height:1.3;letter-spacing:-.01em;font-weight:800}
.wn p{margin:.3em 0 0;font-size:14.5px;line-height:1.45;color:#cfcfd4}
.wn-t{display:inline-block;font-style:normal;font-size:11px;font-weight:800;letter-spacing:.03em;text-transform:uppercase;padding:3px 7px;border-radius:999px;margin:0 7px 0 0;vertical-align:2px;line-height:1.2}
.wn-new{background:#2a3410;color:var(--acc)}.wn-improved{background:#10283a;color:#8ecbff}.wn-fixed{background:#13301f;color:var(--ok)}
.wn-links{display:flex;flex-wrap:wrap;gap:4px 18px;margin-top:2px}
.wn-links a{font-size:14px;font-weight:700;padding:8px 0 2px;display:inline-block}
.wn-links a.asked{font-weight:400;color:var(--mute)}
details.wn-fold{margin-top:8px}
details.wn-fold>summary{cursor:pointer;list-style:none;display:flex;gap:10px;align-items:baseline;min-height:44px;padding:10px 12px;border:1px solid var(--line);border-radius:12px;font-weight:800;font-size:15px}
details.wn-fold>summary::-webkit-details-marker{display:none}
details.wn-fold>summary::after{content:"+";margin-left:auto;color:var(--mute);font-weight:400;font-size:18px;line-height:1}
details.wn-fold[open]>summary::after{content:"\\2212"}
details.wn-fold>summary small{font-weight:400;font-size:13px;color:var(--mute)}
details.wn-fold[open]>summary{margin-bottom:8px}
</style>`;

// Opens the fold an anchor points into (a link from the request board, the feed or a search
// result), and remembers that this browser has seen the newest entry.
const JS = (latestId) => `<script>(function(){function go(){var id=decodeURIComponent(location.hash.slice(1));if(!id)return;var el=document.getElementById(id);if(!el)return;for(var p=el.parentElement;p;p=p.parentElement){if(p.tagName==="DETAILS")p.open=true}el.scrollIntoView({block:"start"})}go();addEventListener("hashchange",go);try{localStorage.setItem("hc_new_seen",${JSON.stringify(latestId)})}catch(e){}document.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("[data-wn]");if(a){try{window.posthog&&posthog.capture("whatsnew_click",{entry:a.getAttribute("data-wn"),kind:a.getAttribute("data-kind")})}catch(x){}}})})()</script>`;

export function whatsNewPage(lang = "en") {
  const W = WORDS[lang] || WORDS.en;
  const list = entries().map((e) => localEntry(e, lang));
  if (!list.length) return null;
  const dayName = (d, long = true) => new Date(d + "T12:00:00Z").toLocaleDateString(W.locale, { timeZone: "UTC", month: long ? "long" : "short", day: "numeric", year: long ? undefined : "numeric" });
  const to = (link) => (link.startsWith("http") ? link : href(lang, link));
  const item = (e) => `<li id="${esc(e.id)}"><h3><em class="wn-t wn-${e.type}">${esc(W.types[e.type])}</em>${esc(e.title)}</h3><p>${esc(e.body)}</p>${e.link || (e.request_ids || []).length ? `<span class="wn-links">${e.link ? `<a href="${esc(to(e.link))}" data-wn="${esc(e.id)}" data-kind="try">${esc(W.try)} →</a>` : ""}${(e.request_ids || []).slice(0, 1).map((id) => `<a class="asked" href="${href(lang, "/requests")}#${esc(id)}" data-wn="${esc(e.id)}" data-kind="request">${esc(W.asked)} →</a>`).join("")}</span>` : ""}</li>`;
  const days = [];
  for (const e of list) { const d = days[days.length - 1]; if (d && d.date === e.date) d.items.push(e); else days.push({ date: e.date, items: [e] }); }
  const first = days[0], rest = first.items.slice(TOP);
  const body = `<h1>${esc(W.h1)}</h1>
<div class="wn-head"><p class="lede">${esc(W.lede)}</p><a href="${href(lang, "/requests")}">${esc(W.ask)} →</a><a href="${feedPath(lang)}">${esc(W.feed)}</a></div>
<section class="wn-day"><h2 class="wn-date"><time datetime="${first.date}">${esc(dayName(first.date))}</time><small>${esc(W.count(first.items.length))}</small></h2>
<ol class="wn">${first.items.slice(0, TOP).map(item).join("")}</ol>
${rest.length ? `<details class="wn-fold"><summary>${esc(W.more(rest.length))}</summary><ol class="wn">${rest.map(item).join("")}</ol></details>` : ""}</section>
${days.slice(1).map((d) => `<details class="wn-fold wn-day"><summary><time datetime="${d.date}">${esc(dayName(d.date))}</time><small>${esc(W.count(d.items.length))}</small></summary><ol class="wn">${d.items.map(item).join("")}</ol></details>`).join("\n")}
${JS(list[0].id)}`;
  const url = SITE + href(lang, PATH), updated = list.map(entryTime).sort().pop();
  return layout({ lang, title: W.title(dayName(list[0].date, false)), desc: W.desc, path: PATH, body,
    extraHead: `<link rel="alternate" type="application/atom+xml" title="${esc(W.h1)} · heistclips" href="${feedPath(lang)}">${CSS}`,
    jsonld: [{
      "@context": "https://schema.org", "@type": "Blog", name: `${W.h1} · heistclips`, description: W.desc, url, inLanguage: lang, dateModified: new Date(updated).toISOString(),
      publisher: { "@type": "Organization", name: "heistclips", url: SITE },
      blogPost: list.slice(0, 40).map((e) => ({ "@type": "BlogPosting", headline: e.title, articleBody: e.body, datePublished: new Date(entryTime(e)).toISOString(), url: entryUrl(e, lang), author: { "@type": "Organization", name: "heistclips" } })),
    }, {
      "@context": "https://schema.org", "@type": "ItemList", name: W.h1, itemListElement: list.slice(0, 40).map((e, i) => ({ "@type": "ListItem", position: i + 1, name: `${W.types[e.type]}: ${e.title}`, url: entryUrl(e, lang) })),
    }] });
}

// The feed with the type words of that language ("Fixed: …").
export const whatsNewFeed = (lang = "en") => feedXml(lang, (WORDS[lang] || WORDS.en).types);
