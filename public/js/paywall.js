// What a clipper sees when the free clips run out: a button that goes straight to checkout and
// returns to this stream. (It was a text link to /pricing; one visitor hit it four times and
// never clicked through, 2026-11-19.)
import "./buy.js";
const lang = (document.documentElement.lang || "en").slice(0, 2);
const EN = { head: "That was your last free clip.", sub: "Pay per clip, never per minute. You come straight back to this moment.", buy: (n, p) => `${n} clips · $${p}`, more: "See pricing" };
const T = {
  en: EN,
  de: { head: "Das war dein letzter Gratis-Clip.", sub: "Du zahlst pro Clip, nie pro Minute. Danach landest du wieder genau bei diesem Moment.", buy: (n, p) => `${n} Clips · ${p} $`, more: "Preise ansehen" },
  fr: { head: "C’était ton dernier clip gratuit.", sub: "Tu paies au clip, jamais à la minute. Tu reviens direct sur ce moment.", buy: (n, p) => `${n} clips · ${p} $`, more: "Voir les tarifs" },
}[lang] || EN;
const PACKS = [["p50", 50, 5], ["p200", 200, 15]];

export function paywallHTML() {
  const pre = lang === "de" || lang === "fr" ? "/" + lang : "";
  return `<div class="note paywall"><b>${T.head}</b><p>${T.sub}</p>
<div class="actions">${PACKS.map(([id, n, p], i) => `<button class="btn buy${i ? " ghost" : ""}" data-pack="${id}">${T.buy(n, p)}</button>`).join("")}</div>
<p class="small buymsg"></p><a class="small" href="${pre}/pricing">${T.more}</a></div>`;
}
