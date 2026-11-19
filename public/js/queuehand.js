// The /queue -> /clip hand-off. A clip opened from the queue (?qi=<moment id>&ch=<channel>)
// goes straight into the editor: the moment was already found by the autopilot scan, so the
// stream is not re-read. Rendering and the one-clip charge stay in app.js, unchanged.
const h = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export async function queueHandoff(vod, ph) {
  const params = new URLSearchParams(location.search);
  const qi = params.get("qi"), ch = params.get("ch");
  if (!qi || !ch) return null;
  let d;
  try {
    const r = await fetch(`/api/queue?moment=${encodeURIComponent(qi)}&ch=${encodeURIComponent(ch)}`);
    if (!r.ok) return null; // gone from the queue: fall back to reading the stream
    d = await r.json();
  } catch (e) { return null; }
  const m = d.moment;
  if (!m || String(m.vod_id) !== String(vod.id)) return null;
  m.from_queue = true;
  m.was_live = !!m.live;
  m.live = false; // app.js keeps "live" moments in a separate list fed by live chat; this one is already cut-ready
  for (const id of ["livebar", "livecurve", "curve"]) { const el = document.getElementById(id); if (el) el.remove(); }
  const camp = params.get("c");
  m.banner = `<span>From your <a href="/queue">queue</a>${camp ? ` · for <a href="/campaigns/${h(camp)}">this campaign</a>` : ""}. <a href="/clip?q=${encodeURIComponent(params.get("q") || vod.id)}">See every moment in this stream</a></span>`;
  // When the render lands (app.js adds the download link), mark the queue item exported.
  let done = false;
  const obs = new MutationObserver(() => {
    if (done || !document.querySelector("#dl a[download]")) return;
    done = true; obs.disconnect();
    ph("queue_export", { channel: m.channel, live: m.was_live, campaign: camp || null });
    let k = null; try { k = localStorage.getItem("hc_queue"); } catch (e) {}
    if (k) fetch("/api/queue", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "state", k, states: { [m.id]: "exported" } }) }).catch(() => {});
  });
  obs.observe(document.body, { childList: true, subtree: true });
  return m;
}
