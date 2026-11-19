// "Pay at your size" on the pages: the number on each campaign row, the size switch, and the
// table on a campaign page. The numbers come from lib/atsize.js (stored on each campaign as
// `floor` and `at_size`); this file only words them. English is SIZE_EN below; every other
// language passes its own `size` words from lib/l10n_<lang>.js, so nothing here is swapped by
// regex afterwards. public/js/size.js repaints the rows for the size a visitor picks.
import { SIZES } from "./atsize.js";

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (x) => (x == null ? "?" : "$" + (x >= 1000 ? Math.round(x).toLocaleString("en-US") : x.toFixed(x >= 100 ? 0 : 2)));
export const kviews = (n) => (n >= 1e6 ? +(n / 1e6).toFixed(1) + "M" : n >= 1e3 ? +(n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + "k" : String(n));
const PLATFORM = { tiktok: "TikTok", youtube: "Shorts", instagram: "Reels", x: "X", twitter: "X", facebook: "Facebook", snapchat: "Snapchat" };

export const SIZE_EN = {
  bar: "Your clips get", sortL: "Sort",
  sizes: { new: "New account", "5k": "~5K views", "50k": "~50K views" },
  sortTyp: "Pays most per clip", sortMe: "Can pay me now",
  likely: { new: "likely for a new account", "5k": "likely at ~5K views a clip", "50k": "likely at ~50K views a clip" },
  oneIn: (n) => `1 in ${n} of your clips pays`,
  unknown: "floor unknown",
  notPriced: "pool not priced yet",
  floorClip: (v) => `Pays nothing under ${v} views a clip`,
  floorPool: (v) => `Pays nothing until your clips total ${v} views`,
  floorUnknown: "Floor unknown, check the brief",
  noFloor: "No floor: every view pays",
  lede: (n, total) => `For a new account (about 500 views a clip), ${n === 0 ? "none" : n} of ${total === 1 ? "this campaign pays" : `these ${total} pay`} a typical clip anything: most pay nothing under a floor of views. Pick your size below to see what pays you.`,
  // campaign page
  h: "What a clip pays at your size",
  th: ["Your clips", "Likely per clip", "Clips that pay anything", "Clips to pass the bar"],
  rowName: { new: "New account (~500 views a clip)", "5k": "~5,000 views a clip", "50k": "~50,000 views a clip" },
  none: "none", oneInShort: (k, n) => `${k} in ${n}`, every: "all",
  payout: (min, rate, plats) => `${min} minimum payout at ${rate} per 1k views on ${plats}`,
  and: "and",
  perClipToo: (v) => `each clip needs ${v} views to count`,
  refs: (n) => `${n} more rule file${n === 1 ? "" : "s"} open after you join: read ${n === 1 ? "it" : "them"} for anything else.`,
  note: "Typical per clip, above, is what approved clips have earned, mostly by established accounts. Likely per clip is what your middle clip earns once the floor is applied, with your views spread the way a channel's views spread (a few break out, most do not). Floors are read from the campaign's own settings on Content Rewards.",
  method: "<b>Likely at your size</b> = what your typical clip earns after the campaign's floor: the minimum payout per clip (a $10 minimum at $1 per 1,000 views pays nothing under 10,000 views), a minimum of views per clip, or a pool's bar on the total views of your clips. A new account is taken as about 500 views a clip, spread the way views spread (a few clips break out, most do not); pick ~5K or ~50K if that is you. A pool counts as reachable when about 30 of your clips would pass its bar. Floors come from each campaign's own settings; one we have not read says “floor unknown”.",
};

const idx = (id) => SIZES.findIndex((s) => s.id === id);
const oneInN = (ch) => Math.max(2, Math.round(1 / ch));

// The number for one size, as the row shows it.
export function youText(a, sizeId, W = SIZE_EN) {
  const x = a || {};
  if (x.usd == null) return `<b>?</b><span>${esc(W.likely[sizeId])}</span>`;
  const extra = !(x.usd > 0) && x.chance > 0 ? ` · ${esc(W.oneIn(oneInN(x.chance)))}` : "";
  return `<b>${money(x.usd)}</b><span>${esc(W.likely[sizeId])}${extra}</span>`;
}

// On every campaign row: the new-account number, with every size's in data attributes.
export function youBlock(c, W = SIZE_EN) {
  const a = c.at_size || {};
  const col = (f) => SIZES.map((s) => f(a[s.id] || {})).join(",");
  return `<span class="you${a.new && a.new.usd === 0 ? " zero" : ""}" data-you="${col((x) => (x.usd == null ? "u" : x.usd))}" data-avg="${col((x) => (x.avg == null ? "" : x.avg))}" data-ch="${col((x) => (x.chance == null ? "" : x.chance))}">${youText(a.new, "new", W)}</span>`;
}

export function floorText(c, W = SIZE_EN) {
  const f = c.floor;
  if (!f) return null;
  if (!f.known) return W.floorUnknown;
  if (f.pool_total_views > 0) return W.floorPool(kviews(f.pool_total_views));
  if (f.min_views_per_clip >= 100) return W.floorClip(kviews(f.min_views_per_clip));
  return null;
}
export function floorRow(c, W = SIZE_EN) {
  const t = floorText(c, W);
  return t ? `<span class="meta floor${c.floor && !c.floor.known ? " unk" : ""}">${esc(t)}</span>` : "";
}

// The switch above a list. Hidden until public/js/size.js runs; the labels it writes ride along.
export function sizeBar(W = SIZE_EN, { sort = true } = {}) {
  const labels = { likely: W.likely, oneIn: W.oneIn("{n}"), floorClip: W.floorClip("{v}"), floorPool: W.floorPool("{v}"), floorUnknown: W.floorUnknown };
  return `<div class="sizebar" hidden data-l="${esc(JSON.stringify(labels))}">
<span class="lab">${esc(W.bar)}</span><span class="seg" role="group" aria-label="${esc(W.bar)}">${SIZES.map((s) => `<button type="button" data-size="${s.id}"${s.id === "new" ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"'}>${esc(W.sizes[s.id])}</button>`).join("")}</span>
${sort ? `<span class="lab">${esc(W.sortL)}</span><span class="seg" role="group" aria-label="${esc(W.sortL)}"><button type="button" data-sort="typ" class="on" aria-pressed="true">${esc(W.sortTyp)}</button><button type="button" data-sort="me" aria-pressed="false">${esc(W.sortMe)}</button></span>` : ""}
</div>`;
}
export const SIZE_JS = `<script type="module" src="/js/size.js?v=1"></script>`;

// Campaign page: all three sizes in one table, the floor in words, and where it came from.
export function sizeSection(c, W = SIZE_EN, { plat = PLATFORM, bar = "" } = {}) {
  const a = c.at_size || {}, f = c.floor || { known: false };
  const pool = c.payout_type === "pool";
  const cells = (x) => {
    const pay = x.usd == null ? esc(f.known ? W.notPriced : W.unknown) : money(x.usd);
    // The spread is a fixed 20-point grid (lib/atsize.js), so "7 in 20" is exact, not rounded.
    const ch = x.chance == null ? "–" : x.chance >= 0.999 ? esc(W.every) : x.chance > 0 ? esc(W.oneInShort(Math.round(x.chance * 20), 20)) : esc(W.none);
    return `<td>${pay}</td><td>${ch}</td>${pool ? `<td>${x.clips_to_qualify ? x.clips_to_qualify.toLocaleString("en-US") : "–"}</td>` : ""}`;
  };
  const detail = [];
  if (f.known && !pool) {
    const groups = new Map();
    for (const p of c.payouts || []) {
      const rate = p.rate_per_1k != null ? p.rate_per_1k : c.rate_per_1k;
      if (!(p.min_payout > 0) || !(rate > 0)) continue;
      const k = `${p.min_payout}|${rate}`;
      groups.set(k, [...(groups.get(k) || []), plat[p.platform] || p.platform]);
    }
    for (const [k, ps] of groups) { const [m, r] = k.split("|").map(Number); detail.push(W.payout(money(m), money(r), ps.length > 1 ? ps.slice(0, -1).join(", ") + " " + W.and + " " + ps[ps.length - 1] : ps[0])); }
  }
  if (f.known && pool && f.min_views_per_clip > 0 && f.pool_total_views > 0) detail.push(W.perClipToo(kviews(f.min_views_per_clip)));
  const line = floorText(c, W) || (f.known ? W.noFloor : W.floorUnknown);
  return `<h2>${esc(W.h)}</h2>
<p class="floorline"><b>${esc(line)}</b>${detail.length ? ` <span class="small">(${esc(detail.join("; "))})</span>` : ""}</p>
${bar}<div class="tablewrap"><table class="sizes"><thead><tr>${W.th.slice(0, pool ? 4 : 3).map((x) => `<th>${esc(x)}</th>`).join("")}</tr></thead><tbody>
${SIZES.map((s) => `<tr data-size="${s.id}"><td>${esc(W.rowName[s.id])}</td>${cells(a[s.id] || {})}</tr>`).join("\n")}
</tbody></table></div>
${c.hidden_references > 0 ? `<p class="small">${esc(W.refs(c.hidden_references))}</p>` : ""}
<p class="small">${esc(W.note)}</p>`;
}

export { idx as sizeIndex };
