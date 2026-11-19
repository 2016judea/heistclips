// "Never a dead end": who is live in GTA this second and saving their stream, one tap from a
// read. Asked of Twitch from the visitor's own browser, so it is current to the second.
import { hotStreams } from "./twitch.js";

const h = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (x) => (x >= 1e6 ? (x / 1e6).toFixed(1) + "M" : x >= 1e3 ? (x / 1e3).toFixed(x >= 1e4 ? 0 : 1) + "k" : String(x));
export const pageLang = () => (typeof document === "undefined" ? "en" : (document.documentElement.lang || "en").slice(0, 2));

export async function topLive(lang = pageLang()) {
  const list = await hotStreams({ lang: lang === "en" ? "" : lang });
  return list.find((x) => x.cuttable) || null;
}

export async function fillHot(el, { n = 6, exclude = "" } = {}) {
  if (!el) return 0;
  let list = [];
  try { list = (await hotStreams({ lang: pageLang() === "en" ? "" : pageLang() })).filter((x) => x.cuttable && x.login !== exclude).slice(0, n); } catch (e) {}
  el.innerHTML = list.length
    ? `<ul class="live">${list.map((x) => `<li><a href="/clip?q=${h(x.login)}" data-hot="${h(x.login)}"><img src="${h(x.avatar || "")}" alt="" width="36" height="36"><span><b>${h(x.name)}</b><small>${num(x.viewers)} watching · ${h(x.game)}</small></span></a></li>`).join("")}</ul>`
    : `<p class="small">Nobody is live in GTA with a saved stream this minute. <a href="/streamers">See recent streams</a>.</p>`;
  return list.length;
}
