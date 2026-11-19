// Board: vote (one per browser) and request. No account.
let d = null;
try { d = localStorage.getItem("hc_device"); if (!d) { d = crypto.randomUUID(); localStorage.setItem("hc_device", d); } } catch (e) { d = "anon-" + Math.random(); }
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ph = (e, p) => { try { window.posthog && window.posthog.capture(e, p); } catch (x) {} };

async function refresh() {
  const r = await fetch("/api/requests?d=" + encodeURIComponent(d));
  const { requests } = await r.json();
  for (const x of requests) {
    const b = document.querySelector(`[data-vote="${x.id}"]`);
    if (b) { b.classList.toggle("on", x.voted); b.querySelector("b").textContent = x.votes; }
  }
}
refresh();

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
  const li = `<li class="req" id="${esc(j.item.id)}"><button class="vote on" data-vote="${esc(j.item.id)}"><span>▲</span><b>1</b></button><div><b>${esc(j.item.title)}</b>${j.item.detail ? `<p>${esc(j.item.detail)}</p>` : ""}<span class="meta"><em class="st st-requested">requested</em> Requested by a clipper</span></div></li>`;
  document.getElementById("reqs").insertAdjacentHTML("afterbegin", li);
  f.reset();
});
