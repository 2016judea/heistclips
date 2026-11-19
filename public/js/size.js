// "Pay at your size": the size switch above campaign lists (ranker, rates, a campaign page, the
// queue's "Paying right now"). The server writes every size's number into each row
// (lib/sizeview.js youBlock: data-you, data-avg, data-ch, one value per size, "u" = unknown);
// this repaints the rows for the size picked, re-ranks them when "Can pay me now" is on, and
// remembers both choices in this browser. Words come from the bar's data-l, already translated.
const SIZES = ["new", "5k", "50k"];
const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
const ph = (ev, props) => { try { window.posthog && window.posthog.capture(ev, props); } catch (e) {} try { window.va && window.va("event", { name: ev, data: props }); } catch (e) {} };
const money = (x) => "$" + (x >= 1000 ? Math.round(x).toLocaleString("en-US") : x.toFixed(x >= 100 ? 0 : 2));
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const bars = [...document.querySelectorAll(".sizebar")];
let L = null;
try { L = JSON.parse(bars[0].dataset.l); } catch (e) {}
const canSort = bars.some((b) => b.querySelector("[data-sort]"));
let size = SIZES.includes(store.get("hc_size")) ? store.get("hc_size") : "new";
let sort = canSort && store.get("hc_sort") === "me" ? "me" : "typ";

for (const ol of document.querySelectorAll("ol.camps")) [...ol.children].forEach((li, i) => { li.dataset.i = i; });

const col = (el, attr) => String(el.dataset[attr] || "").split(",")[SIZES.indexOf(size)];
function val(el) {
  const u = col(el, "you");
  return { usd: u === "u" || u === "" || u == null ? null : Number(u), avg: Number(col(el, "avg")) || 0, ch: Number(col(el, "ch")) || 0 };
}

export function label(v) {
  if (!L) return "";
  const lab = esc(L.likely[size]);
  if (v.usd == null) return `<b>?</b><span>${lab}</span>`;
  const extra = !(v.usd > 0) && v.ch > 0 ? " · " + esc(L.oneIn.replace("{n}", Math.max(2, Math.round(1 / v.ch)))) : "";
  return `<b>${money(v.usd)}</b><span>${lab}${extra}</span>`;
}

// Higher first: pays a typical clip, then unknown, then nothing (by the average, then as listed).
function key(li) {
  const el = li.querySelector(".you");
  if (!el) return [-1, 0, 0];
  const v = val(el);
  return [v.usd > 0 ? 2 : v.usd == null ? 1 : 0, v.usd || 0, v.avg];
}

function paint() {
  for (const b of bars) {
    b.hidden = false;
    for (const x of b.querySelectorAll("[data-size]")) { const on = x.dataset.size === size; x.classList.toggle("on", on); x.setAttribute("aria-pressed", on); }
    for (const x of b.querySelectorAll("[data-sort]")) { const on = x.dataset.sort === sort; x.classList.toggle("on", on); x.setAttribute("aria-pressed", on); }
  }
  for (const el of document.querySelectorAll(".you[data-you]")) { const v = val(el); el.innerHTML = label(v); el.classList.toggle("zero", v.usd === 0); }
  for (const tr of document.querySelectorAll("table.sizes tr[data-size]")) tr.classList.toggle("on", tr.dataset.size === size);
  if (canSort) {
    for (const ol of document.querySelectorAll("ol.camps")) {
      const lis = [...ol.children];
      lis.sort((a, b) => {
        if (sort === "me") { const x = key(a), y = key(b); for (let i = 0; i < 3; i++) if (y[i] !== x[i]) return y[i] - x[i]; }
        return a.dataset.i - b.dataset.i;
      });
      lis.forEach((li, i) => { ol.appendChild(li); const r = li.querySelector(".rank"); if (r) r.textContent = i + 1; });
    }
  }
  document.dispatchEvent(new CustomEvent("hc:size", { detail: { size, sort, labels: L } }));
}

document.addEventListener("click", (e) => {
  const s = e.target.closest(".sizebar [data-size]"), o = e.target.closest(".sizebar [data-sort]");
  if (s) { size = s.dataset.size; if (canSort) sort = "me"; }
  else if (o) sort = o.dataset.sort;
  else return;
  store.set("hc_size", size); store.set("hc_sort", sort);
  paint();
  ph("pay_size", { size, sort, path: location.pathname });
});

if (bars.length) paint();
