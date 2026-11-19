// Languages. English lives in render.js and guides.js as it always has; German, French,
// Portuguese (Brazil) and Spanish are served at /de, /fr, /pt and /es. This file holds what every
// page shares: the languages, which paths exist in them, the header/footer words, and the
// paste-a-stream box that sits above the fold on the pages search engines and assistants cite.
//
// Why these (PostHog, 2026-11-16 to 11-19): 34 of 107 people who made a clip were in Germany or
// France (France alone: 31 visitors, 86 clips); Brazilian and Spanish-speaking streamers
// (alanzoka, IlloJuan, auronplay) are among the most-pulled channels. India is the second
// country and reads English.
//
// HOW A NEW PAGE GETS TRANSLATED (three steps, all in lib/):
//   1. Add its English path to LOCAL_PATHS (or a pattern to LOCAL_PATTERNS) below. That alone
//      gives it hreflang links, the language switch, the first-visit language pick and a
//      sitemap entry per language.
//   2. In pages_l10n.js, add one line to localPage() that returns the page for (lang, path),
//      built with layout({ lang, path: "<the English path>", ... }).
//   3. Put its words under one key in every lib/l10n_<lang>.js. test/l10n.test.js fails if a
//      language is missing a key or a page, so nothing ships half-translated.
// Until step 2 exists for a path, never do step 1: the router answers /de/<path> with a
// redirect to the English page, and the switch must not advertise a page that redirects.
// Text a script writes after load is translated by public/js/l10n.js (one rule per line).

export const LANGS = ["en", "de", "fr", "pt", "es"];
export const LANG_NAMES = { en: "English", de: "Deutsch", fr: "Français", pt: "Português", es: "Español" };
// Off = no page links or redirects to the translations (a kill switch if one ever breaks).
export const SWITCH_ON = true;
const OTHER = LANGS.filter((l) => l !== "en");

// Paths that exist in every language. Everything else is English only and is linked plainly.
export const LOCAL_PATHS = ["/", "/clip", "/pricing", "/requests", "/guides", "/gta-6-clipping-campaigns", "/gta-6-clipping-rates-today", "/twitch-clip-maker", "/kick-clip-maker", "/most-clipped-streams"];
export const LOCAL_PATTERNS = [/^\/guides\/[a-z0-9-]+$/];
export function isLocal(path) {
  const p = String(path || "").split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  return LOCAL_PATHS.includes(p) || LOCAL_PATTERNS.some((re) => re.test(p));
}

// The URL of `path` in `lang`: "/pricing" -> "/de/pricing"; "/" -> "/de"; English-only paths unchanged.
export function href(lang, path) {
  if (lang === "en" || !LANGS.includes(lang) || !isLocal(path)) return path;
  return "/" + lang + (path === "/" ? "" : path.startsWith("/?") ? path.slice(1) : path);
}

// "/de/guides/x" -> { lang: "de", path: "/guides/x" }
export function splitLang(p) {
  const m = String(p).match(new RegExp(`^/(${OTHER.join("|")})(/.*)?$`));
  return m ? { lang: m[1], path: m[2] || "/" } : { lang: "en", path: p };
}

export const CHROME = {
  en: {
    nav: [["/clip", "Clip tool"], ["/queue", "Autopilot"], ["/gta-6-clipping-campaigns", "Campaigns"], ["/gta-6-clipping-rates-today", "Rates"], ["/requests", "Requests"], ["/guides", "Guides"], ["/pricing", "Pricing"]],
    foot: [["/clip", "Clip tool"], ["/gta-6-clipping-campaigns", "Campaigns"], ["/streamers", "Streamers"], ["/most-clipped-streams", "Most clipped now"], ["/twitch-clip-maker", "Twitch clip maker"], ["/kick-clip-maker", "Kick clip maker"], ["/data", "Data"], ["/requests", "Request a feature"], ["/guides", "Guides"], ["/pricing", "Pricing"], ["/connect", "Use it in ChatGPT, Claude or Grok"], ["https://github.com/2016judea/heistclips", "GitHub"], ["/about", "About"], ["/privacy", "Privacy"], ["/terms", "Terms"]],
    cta: { head: "Clip a stream right now. 10 clips free.", ph: "Twitch or Kick channel", go: "Find moments", top: "Clip the top live GTA stream now", for: (n) => `Clip ${n}’s stream now`, fine: "No account. Chat finds the moment, your browser cuts it to 9:16." },
  },
  de: {
    nav: [["/clip", "Clip-Tool"], ["/queue", "Autopilot"], ["/gta-6-clipping-campaigns", "Kampagnen"], ["/gta-6-clipping-rates-today", "Raten"], ["/requests", "Wünsche"], ["/guides", "Guides"], ["/pricing", "Preise"]],
    foot: [["/clip", "Clip-Tool"], ["/gta-6-clipping-campaigns", "Kampagnen"], ["/streamers", "Streamer"], ["/most-clipped-streams", "Meistgeclippt"], ["/twitch-clip-maker", "Twitch Clip Maker"], ["/kick-clip-maker", "Kick Clip Maker"], ["/data", "Daten"], ["/requests", "Feature wünschen"], ["/guides", "Guides"], ["/pricing", "Preise"], ["/connect", "In ChatGPT, Claude oder Grok nutzen"], ["https://github.com/2016judea/heistclips", "GitHub"], ["/about", "Über uns"], ["/privacy", "Datenschutz"], ["/terms", "AGB"]],
    cta: { head: "Clip jetzt einen Stream. 10 Clips gratis.", ph: "Twitch- oder Kick-Kanal", go: "Momente finden", top: "Den größten GTA-Livestream jetzt clippen", for: (n) => `Stream von ${n} jetzt clippen`, fine: "Ohne Account. Der Chat findet den Moment, dein Browser schneidet ihn auf 9:16." },
    fine: "Kein Bezug zu Rockstar Games oder Take-Two Interactive. „GTA VI“ beschreibt nur, worum es in den Streams geht. Die Kampagnenzahlen stammen aus dem öffentlichen Verzeichnis von Content Rewards und verlinken dorthin. Stream-Daten kommen von den öffentlichen Seiten von Twitch und Kick.",
  },
  fr: {
    nav: [["/clip", "Outil de clip"], ["/queue", "Autopilot"], ["/gta-6-clipping-campaigns", "Campagnes"], ["/gta-6-clipping-rates-today", "Tarifs"], ["/requests", "Demandes"], ["/guides", "Guides"], ["/pricing", "Prix"]],
    foot: [["/clip", "Outil de clip"], ["/gta-6-clipping-campaigns", "Campagnes"], ["/streamers", "Streamers"], ["/most-clipped-streams", "Les plus clippés"], ["/twitch-clip-maker", "Créateur de clips Twitch"], ["/kick-clip-maker", "Créateur de clips Kick"], ["/data", "Données"], ["/requests", "Demander une fonction"], ["/guides", "Guides"], ["/pricing", "Prix"], ["/connect", "L’utiliser dans ChatGPT, Claude ou Grok"], ["https://github.com/2016judea/heistclips", "GitHub"], ["/about", "À propos"], ["/privacy", "Confidentialité"], ["/terms", "Conditions"]],
    cta: { head: "Clippe un stream tout de suite. 10 clips offerts.", ph: "Chaîne Twitch ou Kick", go: "Trouver", top: "Clipper le plus gros live GTA du moment", for: (n) => `Clipper le stream de ${n}`, fine: "Sans compte. Le chat repère le moment, ton navigateur le découpe en 9:16." },
    fine: "Sans lien avec Rockstar Games ni Take-Two Interactive. « GTA VI » sert seulement à décrire le sujet des streams. Les chiffres des campagnes viennent de l’annuaire public de Content Rewards, avec un lien vers chaque campagne. Les données de stream viennent des pages publiques de Twitch et de Kick.",
  },
  pt: {
    nav: [["/clip", "Clipar"], ["/queue", "Autopilot"], ["/gta-6-clipping-campaigns", "Campanhas"], ["/gta-6-clipping-rates-today", "Valores"], ["/requests", "Pedidos"], ["/guides", "Guias"], ["/pricing", "Preços"]],
    foot: [["/clip", "Ferramenta de clipes"], ["/gta-6-clipping-campaigns", "Campanhas"], ["/streamers", "Streamers"], ["/most-clipped-streams", "Mais clipados"], ["/twitch-clip-maker", "Criador de clipes da Twitch"], ["/kick-clip-maker", "Criador de clipes da Kick"], ["/data", "Dados"], ["/requests", "Pedir uma função"], ["/guides", "Guias"], ["/pricing", "Preços"], ["/connect", "Usar no ChatGPT, Claude ou Grok"], ["https://github.com/2016judea/heistclips", "GitHub"], ["/about", "Sobre"], ["/privacy", "Privacidade"], ["/terms", "Termos"]],
    cta: { head: "Clipe uma live agora. 10 clipes grátis.", ph: "Canal da Twitch ou Kick", go: "Achar", top: "Clipar a maior live de GTA agora", for: (n) => `Clipar a live de ${n} agora`, fine: "Sem conta. O chat acha o momento, seu navegador corta em 9:16." },
    fine: "Sem vínculo com a Rockstar Games nem com a Take-Two Interactive. “GTA VI” é usado só para descrever do que tratam as lives. Os números das campanhas vêm do diretório público da Content Rewards, com link para cada campanha. Os dados das lives vêm das páginas públicas da Twitch e da Kick.",
  },
  es: {
    nav: [["/clip", "Clipear"], ["/queue", "Autopilot"], ["/gta-6-clipping-campaigns", "Campañas"], ["/gta-6-clipping-rates-today", "Tarifas"], ["/requests", "Peticiones"], ["/guides", "Guías"], ["/pricing", "Precios"]],
    foot: [["/clip", "Herramienta de clips"], ["/gta-6-clipping-campaigns", "Campañas"], ["/streamers", "Streamers"], ["/most-clipped-streams", "Lo más clipeado"], ["/twitch-clip-maker", "Creador de clips de Twitch"], ["/kick-clip-maker", "Creador de clips de Kick"], ["/data", "Datos"], ["/requests", "Pedir una función"], ["/guides", "Guías"], ["/pricing", "Precios"], ["/connect", "Usarlo en ChatGPT, Claude o Grok"], ["https://github.com/2016judea/heistclips", "GitHub"], ["/about", "Acerca de"], ["/privacy", "Privacidad"], ["/terms", "Términos"]],
    cta: { head: "Clipea un directo ahora. 10 clips gratis.", ph: "Canal de Twitch o Kick", go: "Buscar", top: "Clipear el directo de GTA más grande ahora", for: (n) => `Clipear el directo de ${n} ahora`, fine: "Sin cuenta. El chat encuentra el momento, tu navegador lo corta en 9:16." },
    fine: "Sin relación con Rockstar Games ni con Take-Two Interactive. «GTA VI» se usa solo para describir de qué tratan los directos. Las cifras de las campañas salen del directorio público de Content Rewards, con enlace a cada campaña. Los datos de los directos salen de las páginas públicas de Twitch y de Kick.",
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
  // English page, a browser set to one of the other languages, no choice made yet: go there. A click on
  // the switch stores the choice, so nobody is sent back against their will.
  const pick = lang === "en" ? `<script>(function(){try{var c=localStorage.getItem("hc_lang"),n=(navigator.language||"").slice(0,2).toLowerCase(),t=c||n;if(${JSON.stringify(OTHER)}.indexOf(t)>-1&&!/[?&]lang=en/.test(location.search)){location.replace("/"+t+(location.pathname==="/"?"":location.pathname)+location.search+location.hash)}}catch(e){}})()</script>` : "";
  return alts + pick;
}

// The switch in the header (a compact menu: five codes do not fit beside the nav on a phone) and
// the same choice as plain links in the footer. Either one stores the choice, so the first-visit
// pick never sends anyone back against their will.
export function langSwitch(lang, path) {
  if (!SWITCH_ON || !isLocal(path)) return "";
  return `<select class="langs" aria-label="Language" onchange="try{localStorage.setItem('hc_lang',this.value)}catch(e){}location.href=this.options[this.selectedIndex].getAttribute('data-href')+location.search">${LANGS.map((l) => `<option value="${l}" data-href="${href(l, path)}"${l === lang ? " selected" : ""}>${l.toUpperCase()}</option>`).join("")}</select>`;
}

export function langLinks(lang, path) {
  if (!SWITCH_ON || !isLocal(path)) return "";
  return `<p class="langs-foot">${LANGS.map((l) => `<a href="${href(l, path)}" data-lang="${l}" hreflang="${l}"${l === lang ? ' aria-current="true"' : ""}>${LANG_NAMES[l]}</a>`).join(" · ")}</p><script>document.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("[data-lang]");if(a){try{localStorage.setItem("hc_lang",a.getAttribute("data-lang"))}catch(x){}}})</script>`;
}
