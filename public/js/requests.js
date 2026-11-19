// Board: vote (one per browser) and request. No account.
let d = null;
try { d = localStorage.getItem("hc_device"); if (!d) { d = crypto.randomUUID(); localStorage.setItem("hc_device", d); } } catch (e) { d = "anon-" + Math.random(); }
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ph = (e, p) => { try { window.posthog && window.posthog.capture(e, p); } catch (x) {} };

// The board in the viewer's language: an explicit ?lang= wins, then the page's own locale
// (/de, /fr), then the browser's. Each row is set to the stored translation the API returns for
// that language (nothing is translated here), whichever template drew the row: the English page
// (lib/render.js) or a /de or /fr page (lib/pages_l10n.js). A row the localized page translated
// by hand (a launch item, no data-notr) is left as it is.
const list = document.getElementById("reqs");
const qlang = new URLSearchParams(location.search).get("lang");
const pageLang = document.documentElement.lang || "en";
const want = (qlang || (pageLang !== "en" ? pageLang : (navigator.languages && navigator.languages[0]) || navigator.language || "en")).slice(0, 2).toLowerCase();
function localizeRow(li, x) {
  const div = li.querySelector(":scope > div");
  if (!div) return;
  const ours = !!li.querySelector(".rt");
  if (!ours && !div.hasAttribute("data-notr")) return; // hand-translated launch item
  const t = li.querySelector(".rt") || div.querySelector(":scope > b");
  let p = li.querySelector(".rd") || div.querySelector(":scope > p:not(.resp)");
  if (!t) return;
  t.classList.add("rt"); t.textContent = x.title;
  if (!p) { p = document.createElement("p"); t.after(p); }
  p.classList.add("rd"); p.textContent = x.detail || ""; p.hidden = !x.detail;
  const old = li.querySelector(".trnote"); if (old) old.remove();
  if (x.original && x.tr_label) {
    const n = document.createElement("span");
    n.className = "trnote";
    Object.assign(n.dataset, { tTitle: x.title, tDetail: x.detail || "", oTitle: x.original.title, oDetail: x.original.detail || "", show: x.tr_label.show, hide: x.tr_label.hide });
    n.innerHTML = `${esc(x.tr_label.from)} · <button type="button" class="linkbtn" data-orig>${esc(x.tr_label.show)}</button>`;
    p.after(n);
  }
  const resp = li.querySelector(".resp");
  if (resp && x.response) { const lead = resp.querySelector("b"); resp.textContent = " — " + x.response; if (lead) resp.prepend(lead); }
}
async function refresh() {
  const r = await fetch("/api/requests?d=" + encodeURIComponent(d) + "&lang=" + encodeURIComponent(want));
  const { requests, lang } = await r.json();
  const relabel = list && lang !== (list.dataset.lang || "none");
  for (const x of requests) {
    const b = document.querySelector(`[data-vote="${x.id}"]`);
    if (b) { b.classList.toggle("on", x.voted); b.querySelector("b").textContent = x.votes; }
    const li = document.getElementById(x.id);
    if (relabel && li) localizeRow(li, x);
  }
  if (relabel) { list.dataset.lang = lang; if (lang !== "en") ph("board_translated", { lang }); }
}
refresh();

// "show original" / "show translation" on a translated row.
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-orig]");
  if (!t) return;
  const note = t.closest(".trnote"), li = t.closest(".req");
  const toOrig = !note.classList.contains("orig");
  li.querySelector(".rt").textContent = toOrig ? note.dataset.oTitle : note.dataset.tTitle;
  const det = toOrig ? note.dataset.oDetail : note.dataset.tDetail;
  const p = li.querySelector(".rd"); p.textContent = det; p.hidden = !det;
  note.classList.toggle("orig", toOrig);
  t.textContent = toOrig ? note.dataset.hide : note.dataset.show;
});

document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-vote]");
  if (!b || b.classList.contains("on")) return;
  b.classList.add("on");
  const n = b.querySelector("b"); n.textContent = Number(n.textContent) + 1;
  ph("request_vote", { id: b.dataset.vote });
  const r = await fetch("/api/requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "vote", id: b.dataset.vote, d }) });
  const j = await r.json();
  if (j.ok) n.textContent = j.votes; else { b.classList.remove("on"); n.textContent = Number(n.textContent) - 1; alert(j.error); }
});

const f = document.getElementById("reqform");
f.addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = document.getElementById("reqmsg");
  const data = Object.fromEntries(new FormData(f));
  msg.textContent = "Sending…";
  const r = await fetch("/api/requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "submit", d, ...data, not_a_stream: f.dataset.force === "1" }) });
  const j = await r.json();
  if (j.stream) {
    // A stream pasted into the request box: send them to the clip tool instead of the board.
    ph("request_stream_redirect", { kind: j.kind });
    msg.innerHTML = `That’s a ${esc(j.kind)}, not a request. <a href="/clip?q=${encodeURIComponent(j.q)}">Find its moments in the clip tool →</a> <button type="button" class="linkbtn" id="fileanyway">It’s a request, file it</button>`;
    document.getElementById("fileanyway").onclick = () => { f.dataset.force = "1"; f.requestSubmit(); };
    return;
  }
  if (!j.ok) { msg.textContent = j.error; return; }
  delete f.dataset.force;
  ph("request_submit", { duplicate: !!j.duplicate });
  if (j.duplicate) { msg.textContent = "Already on the board, so we added nothing. Upvote it:"; location.hash = j.id; return; }
  msg.textContent = "Added. It’s on the board now.";
  const li = `<li class="req" id="${esc(j.item.id)}"><button class="vote on" data-vote="${esc(j.item.id)}"><span>▲</span><b>1</b></button><div><b class="rt">${esc(j.item.title)}</b>${j.item.detail ? `<p class="rd">${esc(j.item.detail)}</p>` : ""}<span class="meta"><em class="st st-requested">requested</em> Requested by a clipper</span></div></li>`;
  document.getElementById("reqs").insertAdjacentHTML("afterbegin", li);
  f.reset();
});
