// Posting to YouTube / TikTok from the browser. Two jobs:
//   1. /post: connect or disconnect the platforms for this browser's heistclips account.
//   2. /clip: after a render, add "Post to …" buttons under the download (app.js fires one
//      "hc:rendered" event with the file; everything else lives here).
// The account code (hc_…) is the same one the connector uses; opening /post?acct=<code> from
// Claude adopts that code in this browser, so both share credits and connections.
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
const ph = (ev, props) => { try { window.posthog && window.posthog.capture(ev, props); } catch (e) {} };
const params = new URLSearchParams(location.search);
const api = async (body) => (await fetch("/api/v1/post", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();
const LABEL = { youtube: "YouTube", tiktok: "TikTok" };

function deviceId() {
  let d = store.get("hc_device");
  if (!d) { d = crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now(); store.set("hc_device", d); }
  return d;
}

// This browser's account: the code in the link (from the connector) wins, else the saved one,
// else a new one. Linking tells the server which browser balance the account spends.
let statusMemo = null;
async function account(create = true) {
  const fromUrl = params.get("acct");
  let code = /^hc_[A-Za-z0-9_-]{32}$/.test(fromUrl || "") ? fromUrl : store.get("hc_acct");
  if (code) {
    const s = await api({ op: "link", account: code, d: deviceId(), k: store.get("hc_key") || "" });
    if (s.ok) { store.set("hc_acct", code); statusMemo = s; return s; }
    if (code === fromUrl) code = store.get("hc_acct"); // a bad link: fall back to our own
    else code = null;
    if (code && code !== fromUrl) { const s2 = await api({ op: "link", account: code, d: deviceId(), k: store.get("hc_key") || "" }); if (s2.ok) { statusMemo = s2; return s2; } }
  }
  if (!create) return null;
  const n = await api({ op: "new" });
  if (!n.ok) return null;
  store.set("hc_acct", n.account);
  statusMemo = await api({ op: "link", account: n.account, d: deviceId(), k: store.get("hc_key") || "" });
  return statusMemo;
}

// ---- /post ---------------------------------------------------------------------------------
async function managePage(root) {
  const msg = $("#postmsg");
  const paint = (s) => {
    $("#acctline").innerHTML = `${s.clips_left && s.clips_left.free != null ? `${s.clips_left.free} free clip${s.clips_left.free === 1 ? "" : "s"} left${s.clips_left.paid ? ` + ${s.clips_left.paid} paid` : ""} · ` : ""}Account code for Claude: <code class="copy">${esc(s.account)}</code>`;
    for (const p of ["youtube", "tiktok"]) {
      const row = $(`[data-provider="${p}"]`, root); if (!row) continue;
      const on = s[p] && s[p].connected;
      { const st = $("[data-state]", row); st.textContent = on ? (s[p].name ? `Connected as ${s[p].name}` : "Connected") : "Not connected";
        if (on && s[p].avatar) { const im = document.createElement("img"); im.src = s[p].avatar; im.alt = ""; im.width = 22; im.height = 22; im.referrerPolicy = "no-referrer"; im.style.cssText = "border-radius:50%;vertical-align:middle;margin-right:6px"; st.prepend(im); } }
      $("[data-state]", row).classList.toggle("paid", !!on);
      const c = $("[data-connect]", row), d = $("[data-disconnect]", row);
      if (c) c.textContent = on ? `Reconnect ${LABEL[p]}` : `Connect ${LABEL[p]}`;
      if (c) c.classList.toggle("ghost", !!on);
      if (d) d.hidden = !on;
    }
  };
  const s = await account();
  if (!s) { $("#acctline").textContent = "Couldn’t reach heistclips. Reload the page."; return; }
  paint(s);
  if (params.get("connected")) { msg.textContent = `${LABEL[params.get("connected")] || "It"} is connected. ${params.get("src") === "mcp" || params.get("acct") ? "Go back to Claude and ask it to post the clip." : "Go back to your clip and press Post."}`; ph("post_connected", { provider: params.get("connected") }); }
  if (params.get("err")) msg.textContent = params.get("err");
  root.addEventListener("click", async (e) => {
    const c = e.target.closest("[data-connect]");
    if (c) { ph("post_connect_click", { provider: c.dataset.connect }); location.href = `/api/v1/post?op=start&provider=${c.dataset.connect}&acct=${encodeURIComponent(s.account)}`; }
    const d = e.target.closest("[data-disconnect]");
    if (d) { const r = await api({ op: "disconnect", account: s.account, provider: d.dataset.disconnect }); if (r.ok) { paint(r); msg.textContent = `${LABEL[d.dataset.disconnect]} disconnected.`; } }
  });
}

// ---- /clip: post buttons after a render ------------------------------------------------------
async function upload(acct, blob, ext, onPct) {
  const st = await api({ op: "upload-start", account: acct });
  if (!st.ok) throw new Error(st.error || "upload refused");
  const size = st.part_bytes, n = Math.ceil(blob.size / size);
  if (n > 40) throw new Error("this clip is too large to post from the browser (140 MB limit)");
  for (let i = 0; i < n; i++) {
    const r = await fetch(`/api/v1/post?op=part&acct=${encodeURIComponent(acct)}&id=${st.id}&n=${i}&ext=${ext}`, { method: "PUT", headers: { "content-type": "application/octet-stream" }, body: blob.slice(i * size, (i + 1) * size) });
    const j = await r.json().catch(() => ({}));
    if (!j.ok) throw new Error(j.error || "upload failed");
    onPct(Math.round(((i + 1) / n) * 100));
  }
  return st.id;
}

let openMemo = null;
async function postBox(detail) {
  const { blob, ext, mount, caption } = detail;
  if (!mount || !blob) return;
  // Only offer a platform that is actually open; with none open the clip page stays as it was.
  if (!openMemo) openMemo = api({ op: "open" }).catch(() => ({}));
  const open = (await openMemo).open || {};
  const on = ["youtube", "tiktok"].filter((p) => open[p]);
  if (!on.length) return;
  const box = document.createElement("div");
  box.className = "postbox";
  box.innerHTML = `<label>Caption</label><textarea rows="2" maxlength="2200">${esc(caption || "")}</textarea>
<div class="actions">${on.map((p) => `<button class="btn sm" data-post="${p}">Post to ${LABEL[p]}</button>`).join("")}</div>
<p class="small" data-msg></p>`;
  mount.appendChild(box);
  const msg = $("[data-msg]", box);
  let uploadId = null;
  box.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-post]");
    if (!b) return;
    const p = b.dataset.post;
    ph("post_click", { provider: p });
    box.querySelectorAll("[data-post]").forEach((x) => (x.disabled = true));
    try {
      msg.textContent = "Checking your account…";
      const s = await account();
      if (!s) throw new Error("couldn’t reach heistclips");
      if (!s.open || !s.open[p]) { msg.textContent = `Posting to ${LABEL[p]} isn’t open yet: we’re waiting on ${LABEL[p]}’s developer approval. Download the clip and post it by hand for now.`; return; }
      if (!s[p] || !s[p].connected) { msg.innerHTML = `Connect ${LABEL[p]} first (one time): <a href="/post" target="_blank" rel="noopener">open the connect page</a>, then press Post again.`; return; }
      if (!uploadId) uploadId = await upload(s.account, blob, ext, (pct) => { msg.textContent = `Uploading ${pct}%…`; });
      msg.textContent = `Posting to ${LABEL[p]}…`;
      const r = await api({ op: "post", account: s.account, upload_id: uploadId, platform: p, caption: $("textarea", box).value });
      if (!r.ok) { msg.innerHTML = r.needs_connect ? `${esc(r.error)} <a href="/post" target="_blank" rel="noopener">Open the connect page</a>.` : esc(r.error); ph("post_fail", { provider: p }); return; }
      msg.innerHTML = `Posted to ${LABEL[p]}${r.url ? `: <a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.url)}</a>` : ""}. ${esc(r.note || "")}${r.studio ? ` <a href="${esc(r.studio)}" target="_blank" rel="noopener">Open in YouTube Studio</a>` : ""}`;
      ph("post_done", { provider: p, privacy: r.privacy });
    } catch (err) { msg.textContent = "Couldn’t post: " + err.message; ph("post_fail", { provider: p }); }
    finally { box.querySelectorAll("[data-post]").forEach((x) => (x.disabled = false)); }
  });
}

document.addEventListener("hc:rendered", (e) => postBox(e.detail || {}));
const root = $("#postpage");
if (root) managePage(root);
