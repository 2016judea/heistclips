// What's new: every fix and improvement, announced the day it ships. The page is /whats-new
// (lib/changelogpage.js), the feed is /whats-new.xml, and the source of truth is
// lib/changelog.json, newest first, so shipping a change and announcing it are one commit:
//
//   node scripts/changelog_add.mjs <new|improved|fixed> "<title>" "<one or two sentences>" [--link=/clip] [--request=<board id>]
//
// (It lives in lib/ because that is the folder every function bundles; see vercel.json.)
// An entry: { id, date: "YYYY-MM-DD" (Central time), type, title, body, link?, request_ids?,
// at? (ISO time it was added), langs: { de|fr|pt|es: { title, body } } }. A language that is
// missing reads in English. Nothing here calls a model: translation happens once, in the script.
//
// This file must not import render.js (render.js imports it for the header marker).
//
// For the connector (api/mcp.js has its own owner): latestEntries({ limit, lang, since })
// returns plain objects with absolute URLs, ready to return from a tool.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { href, LANGS } from "./i18n.js";

const SITE = "https://heistclips.com";
export const PATH = "/whats-new";
export const FEED = "/whats-new.xml";
export const TYPES = ["new", "improved", "fixed"];
export const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "changelog.json");

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let ALL = null;
// Newest day first; inside a day the file's own order (the script puts a new entry on top).
export function entries() {
  if (!ALL) {
    let raw = [];
    try { raw = JSON.parse(fs.readFileSync(FILE, "utf8")); } catch (e) { raw = []; }
    ALL = raw.filter((e) => e && e.id && e.title && /^\d{4}-\d{2}-\d{2}$/.test(e.date || "") && TYPES.includes(e.type))
      .map((e, i) => ({ ...e, i })).sort((a, b) => b.date.localeCompare(a.date) || a.i - b.i);
  }
  return ALL;
}
export const latest = () => entries()[0] || null;
export const entryTime = (e) => e.at || e.date + "T18:00:00Z"; // noon Central when no time was stored

// One entry in one language (English when that language was never written).
export function localEntry(e, lang = "en") {
  const t = (lang !== "en" && e.langs && e.langs[lang]) || null;
  return { ...e, title: (t && t.title) || e.title, body: (t && t.body) || e.body, translated: !!(t && t.title) };
}
export const entryUrl = (e, lang = "en") => SITE + href(lang, PATH) + "#" + e.id;

// The latest entries as plain data, for a connector tool or anything else that wants them.
export function latestEntries({ limit = 10, lang = "en", since = null } = {}) {
  return entries().filter((e) => !since || e.date >= since).slice(0, Math.max(1, Math.min(100, limit))).map((e) => {
    const L = localEntry(e, lang);
    return { id: e.id, date: e.date, type: e.type, title: L.title, body: L.body, url: entryUrl(e, lang),
      try_it: e.link ? (e.link.startsWith("http") ? e.link : SITE + href(lang, e.link)) : null,
      requests: (e.request_ids || []).map((id) => SITE + href(lang, "/requests") + "#" + id) };
  });
}

// The few words that sit outside the page itself (the page's own words are in changelogpage.js).
export const CHROME_WORDS = {
  en: { pill: "New", pillAria: "What’s new: fixes and new features", boardAll: "See everything we shipped", boardOne: "See it in What’s new" },
  de: { pill: "Neu", pillAria: "Was ist neu: Fixes und neue Funktionen", boardAll: "Alles ansehen, was fertig ist", boardOne: "In „Was ist neu“ ansehen" },
  fr: { pill: "Nouveau", pillAria: "Nouveautés : correctifs et nouvelles fonctions", boardAll: "Voir tout ce qui est sorti", boardOne: "Voir dans les nouveautés" },
  pt: { pill: "Novo", pillAria: "Novidades: correções e novas funções", boardAll: "Ver tudo o que já lançamos", boardOne: "Ver nas novidades" },
  es: { pill: "Nuevo", pillAria: "Novedades: arreglos y funciones nuevas", boardAll: "Ver todo lo que hemos lanzado", boardOne: "Verlo en novedades" },
};
const CW = (lang) => CHROME_WORDS[lang] || CHROME_WORDS.en;

// The marker beside the logo: a short pill, hidden until the browser shows there is an entry it
// has not seen (localStorage hc_new_seen holds the id of the newest entry seen). No popup. A
// visit to /whats-new clears it. If storage is blocked it stays hidden: no nagging forever.
export function newMarker(lang = "en") {
  const e = latest();
  if (!e) return "";
  const W = CW(lang);
  return `<a class="newpill" href="${href(lang, PATH)}" data-new="${esc(e.id)}" aria-label="${esc(W.pillAria)}" hidden>${esc(W.pill)}</a><style>.newpill{flex:none;position:relative;font-size:11px;font-weight:800;line-height:1;letter-spacing:.02em;text-transform:uppercase;text-decoration:none;padding:4px 7px;border-radius:999px;background:var(--acc);color:var(--acc-ink);margin-left:-4px}.newpill::after{content:"";position:absolute;inset:-12px -6px}</style><script>(function(){try{var a=document.querySelector(".newpill"),id=a.getAttribute("data-new"),k="hc_new_seen";if(/^(\\/(de|fr|pt|es))?\\/whats-new\\/?$/.test(location.pathname)){localStorage.setItem(k,id);return}if(localStorage.getItem(k)!==id){a.hidden=false;a.addEventListener("click",function(){try{window.posthog&&posthog.capture("whatsnew_pill_click",{entry:id})}catch(e){}})}}catch(e){}})()</script>`;
}

// On the request board: a shipped request links to the entry that announces it.
const byRequest = () => { const m = {}; for (const e of entries().slice().reverse()) for (const id of e.request_ids || []) m[id] = e; return m; };
export function shippedLink(x, lang = "en") {
  if (!x || x.status !== "shipped") return "";
  const e = byRequest()[x.id];
  return e ? `<a class="reqlink" style="display:inline-block;padding:8px 0 2px" href="${href(lang, PATH)}#${esc(e.id)}">${esc(CW(lang).boardOne)} →</a>` : "";
}
export const boardAllLink = (lang = "en") => (latest() ? `<p><a class="more" href="${href(lang, PATH)}">${esc(CW(lang).boardAll)} →</a></p>` : "");

// Atom feed, one per language.
const FEED_WORDS = {
  en: ["What’s new on heistclips", "Every fix and new feature on heistclips, the day it ships."],
  de: ["Was ist neu bei heistclips", "Jeder Fix und jede neue Funktion bei heistclips, am Tag, an dem sie live geht."],
  fr: ["Nouveautés heistclips", "Chaque correctif et chaque nouvelle fonction de heistclips, le jour de sa sortie."],
  pt: ["Novidades do heistclips", "Cada correção e cada função nova do heistclips, no dia em que sai."],
  es: ["Novedades de heistclips", "Cada arreglo y cada función nueva de heistclips, el día que sale."],
};
export const feedPath = (lang = "en") => (lang === "en" || !LANGS.includes(lang) ? FEED : "/" + lang + FEED);
export function feedXml(lang = "en", typeWords = null) {
  const list = entries().slice(0, 60), [title, sub] = FEED_WORDS[lang] || FEED_WORDS.en;
  const x = (s) => String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const tw = typeWords || { new: "New", improved: "Improved", fixed: "Fixed" };
  const updated = list.length ? list.map(entryTime).sort().pop() : "2026-11-16T18:00:00Z";
  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${lang}">
<title>${x(title)}</title>
<subtitle>${x(sub)}</subtitle>
<id>${SITE}${feedPath(lang)}</id>
<link rel="self" type="application/atom+xml" href="${SITE}${feedPath(lang)}"/>
<link rel="alternate" type="text/html" hreflang="${lang}" href="${SITE}${href(lang, PATH)}"/>
<updated>${new Date(updated).toISOString()}</updated>
<author><name>heistclips</name><uri>${SITE}</uri></author>
${list.map((e) => { const L = localEntry(e, lang), url = entryUrl(e, lang); return `<entry>
<id>tag:heistclips.com,2026:whats-new/${x(e.id)}${lang === "en" ? "" : "/" + lang}</id>
<title>${x(tw[e.type] + ": " + L.title)}</title>
<link rel="alternate" type="text/html" href="${x(url)}"/>
<published>${new Date(entryTime(e)).toISOString()}</published>
<updated>${new Date(entryTime(e)).toISOString()}</updated>
<category term="${e.type}"/>
<summary>${x(L.body)}</summary>
</entry>`; }).join("\n")}
</feed>
`;
}

// Plain text for llms-full.txt, and one line for llms.txt.
export function llmsLine() {
  const e = latest();
  return e ? `- [What's new](${SITE}${PATH}): every fix and new feature by date, latest ${e.date}. Feed: ${SITE}${FEED}` : "";
}
export function llmsText(limit = 40) {
  const list = entries().slice(0, limit);
  if (!list.length) return "";
  return `\n## What's new on heistclips (fixes and features, newest first)\nPage: ${SITE}${PATH} · Atom feed: ${SITE}${FEED} · Also in German, French, Portuguese and Spanish at /de, /fr, /pt, /es.\n${list.map((e) => `- ${e.date} [${e.type}] ${e.title}. ${e.body}${e.link ? ` (${e.link.startsWith("http") ? e.link : SITE + e.link})` : ""}`).join("\n")}\n`;
}
