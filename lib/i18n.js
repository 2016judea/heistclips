// Languages. English lives in render.js and guides.js as it always has; German and French
// are served at /de and /fr. This file holds what every page shares: which paths exist in each
// language, the header/footer words, and the paste-a-stream box that sits above the fold on the
// pages search engines and assistants cite.
//
// Why German and French first (PostHog, 2026-11-16 to 11-19): 34 of 107 people who made a clip
// were in Germany or France; France alone was 31 visitors and 86 clips.

export const LANGS = ["en", "de", "fr"];
// Off = no page links or redirects to /de and /fr (a kill switch if a translation ever breaks).
export const SWITCH_ON = true;
export const LANG_NAMES = { en: "English", de: "Deutsch", fr: "Français" };

// Paths that have a /de and /fr version. Everything else is English only and is linked plainly.
export function isLocal(path) {
  const p = String(path || "").split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  return ["/", "/clip", "/pricing", "/requests", "/guides", "/gta-6-clipping-campaigns", "/gta-6-clipping-rates-today"].includes(p) || /^\/guides\/[a-z0-9-]+$/.test(p);
}

// The URL of `path` in `lang`: "/pricing" -> "/de/pricing"; "/" -> "/de"; English-only paths unchanged.
export function href(lang, path) {
  if (lang === "en" || !LANGS.includes(lang) || !isLocal(path)) return path;
  return "/" + lang + (path === "/" ? "" : path.startsWith("/?") ? path.slice(1) : path);
}

// "/de/guides/x" -> { lang: "de", path: "/guides/x" }
export function splitLang(p) {
  const m = String(p).match(/^\/(de|fr)(\/.*)?$/);
  return m ? { lang: m[1], path: m[2] || "/" } : { lang: "en", path: p };
}

export const CHROME = {
  en: {
    nav: [["/clip", "Clip tool"], ["/queue", "Autopilot"], ["/gta-6-clipping-campaigns", "Campaigns"], ["/gta-6-clipping-rates-today", "Rates"], ["/requests", "Requests"], ["/guides", "Guides"], ["/pricing", "Pricing"]],
    foot: [["/clip", "Clip tool"], ["/gta-6-clipping-campaigns", "Campaigns"], ["/streamers", "Streamers"], ["/requests", "Request a feature"], ["/guides", "Guides"], ["/pricing", "Pricing"], ["/connect", "Use it in ChatGPT, Claude or Grok"], ["https://github.com/2016judea/heistclips", "GitHub"], ["/about", "About"], ["/privacy", "Privacy"], ["/terms", "Terms"]],
    cta: { head: "Clip a stream right now. 10 clips free.", ph: "Twitch or Kick channel", go: "Find moments", top: "Clip the top live GTA stream now", for: (n) => `Clip ${n}’s stream now`, fine: "No account. Chat finds the moment, your browser cuts it to 9:16." },
  },
  de: {
    nav: [["/clip", "Clip-Tool"], ["/queue", "Autopilot"], ["/gta-6-clipping-campaigns", "Kampagnen"], ["/gta-6-clipping-rates-today", "Raten"], ["/requests", "Wünsche"], ["/guides", "Guides"], ["/pricing", "Preise"]],
    foot: [["/clip", "Clip-Tool"], ["/gta-6-clipping-campaigns", "Kampagnen"], ["/streamers", "Streamer"], ["/requests", "Feature wünschen"], ["/guides", "Guides"], ["/pricing", "Preise"], ["/connect", "In ChatGPT, Claude oder Grok nutzen"], ["https://github.com/2016judea/heistclips", "GitHub"], ["/about", "Über uns"], ["/privacy", "Datenschutz"], ["/terms", "AGB"]],
    cta: { head: "Clip jetzt einen Stream. 10 Clips gratis.", ph: "Twitch- oder Kick-Kanal", go: "Momente finden", top: "Den größten GTA-Livestream jetzt clippen", for: (n) => `Stream von ${n} jetzt clippen`, fine: "Ohne Account. Der Chat findet den Moment, dein Browser schneidet ihn auf 9:16." },
    fine: "Kein Bezug zu Rockstar Games oder Take-Two Interactive. „GTA VI“ beschreibt nur, worum es in den Streams geht. Die Kampagnenzahlen stammen aus dem öffentlichen Verzeichnis von Content Rewards und verlinken dorthin. Stream-Daten kommen von den öffentlichen Seiten von Twitch.",
  },
  fr: {
    nav: [["/clip", "Outil de clip"], ["/queue", "Autopilot"], ["/gta-6-clipping-campaigns", "Campagnes"], ["/gta-6-clipping-rates-today", "Tarifs"], ["/requests", "Demandes"], ["/guides", "Guides"], ["/pricing", "Prix"]],
    foot: [["/clip", "Outil de clip"], ["/gta-6-clipping-campaigns", "Campagnes"], ["/streamers", "Streamers"], ["/requests", "Demander une fonction"], ["/guides", "Guides"], ["/pricing", "Prix"], ["/connect", "L’utiliser dans ChatGPT, Claude ou Grok"], ["https://github.com/2016judea/heistclips", "GitHub"], ["/about", "À propos"], ["/privacy", "Confidentialité"], ["/terms", "Conditions"]],
    cta: { head: "Clippe un stream tout de suite. 10 clips offerts.", ph: "Chaîne Twitch ou Kick", go: "Trouver", top: "Clipper le plus gros live GTA du moment", for: (n) => `Clipper le stream de ${n}`, fine: "Sans compte. Le chat repère le moment, ton navigateur le découpe en 9:16." },
    fine: "Sans lien avec Rockstar Games ni Take-Two Interactive. « GTA VI » sert seulement à décrire le sujet des streams. Les chiffres des campagnes viennent de l’annuaire public de Content Rewards, avec un lien vers chaque campagne. Les données de stream viennent des pages publiques de Twitch.",
  },
};

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// The paste box + one tap, for the pages people land on from ChatGPT and search. Measured
// 2026-11-19: 61 people arrived from ChatGPT citations on guide and campaign pages and 4 made a
// clip; of people who landed on a /clip link, 57% did. So the tool goes where they land.
// `streamer` (optional) makes the one tap about this page: { login, name, platform }.
export function ctaBox(lang = "en", { streamer = null, src = "cta" } = {}) {
  const c = (CHROME[lang] || CHROME.en).cta;
  const clip = href(lang, "/clip");
  const tap = streamer
    ? [`${clip}?q=${encodeURIComponent(streamer.platform === "kick" ? "kick.com/" + streamer.login : streamer.login)}&src=${src}-streamer`, c.for(streamer.name || streamer.login)]
    : [`${clip}?top=gta&src=${src}-top`, c.top];
  return `<section class="cta" data-cta="${esc(src)}">
<b class="cta-h">${esc(c.head)}</b>
<form class="paste" action="${clip}" method="get"><input name="q" placeholder="${esc(c.ph)}" aria-label="${esc(c.ph)}" autocomplete="off" autocapitalize="off" spellcheck="false"><input type="hidden" name="src" value="${esc(src)}"><button>${esc(c.go)}</button></form>
<a class="btn ghost tap" href="${esc(tap[0])}"><span class="pulse"></span>${esc(tap[1])}</a>
<p class="small">${esc(c.fine)}</p>
</section>`;
}

// <head> pieces: hreflang alternates, and the first-visit language pick.
export function headLinks(site, lang, path) {
  if (!SWITCH_ON || !isLocal(path)) return "";
  const alts = LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${site}${href(l, path)}">`).join("") + `<link rel="alternate" hreflang="x-default" href="${site}${path}">`;
  // English page, German or French browser, no choice made yet: go to their language. A click on
  // the switch stores the choice, so nobody is sent back against their will.
  const pick = lang === "en" ? `<script>(function(){try{var c=localStorage.getItem("hc_lang"),n=(navigator.language||"").slice(0,2).toLowerCase(),t=c||n;if((t==="de"||t==="fr")&&!/[?&]lang=en/.test(location.search)){location.replace("/"+t+(location.pathname==="/"?"":location.pathname)+location.search+location.hash)}}catch(e){}})()</script>` : "";
  return alts + pick;
}

export function langSwitch(lang, path) {
  if (!SWITCH_ON || !isLocal(path)) return "";
  return `<span class="langs" aria-label="Language">${LANGS.map((l) => `<a href="${href(l, path)}" data-lang="${l}" hreflang="${l}" title="${LANG_NAMES[l]}"${l === lang ? ' class="on" aria-current="true"' : ""}>${l.toUpperCase()}</a>`).join("")}</span><script>document.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("[data-lang]");if(a){try{localStorage.setItem("hc_lang",a.getAttribute("data-lang"))}catch(x){}}})</script>`;
}
