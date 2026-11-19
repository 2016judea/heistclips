// /queue: watchlist + the queue of ready clips. Talks to /api/queue. Identity is the queue
// key in localStorage (hc_queue); a private link (?k=) carries it to another device.
const $ = (s, el = document) => el.querySelector(s);
const h = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ph = (ev, props) => { try { window.posthog && window.posthog.capture(ev, props); } catch (e) {} try { window.va && window.va("event", { name: ev, data: props }); } catch (e) {} };
const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
const money = (x) => (x == null ? null : "$" + (x >= 100 ? Math.round(x).toLocaleString("en-US") : x.toFixed(2)));
const ago = (iso) => { const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000); return s < 90 ? "just now" : s < 5400 ? Math.round(s / 60) + " min ago" : s < 129600 ? Math.round(s / 3600) + " h ago" : Math.round(s / 86400) + " d ago"; };
const params = new URLSearchParams(location.search);

let device = store.get("hc_device");
if (!device) { device = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()); store.set("hc_device", device); }
let K = store.get("hc_queue");
let data = null;          // last /api/queue answer
let wanted = [];          // channel keys, the source of truth while editing
const states = {};        // item states changed this session, resent whole (a stale read cannot drop one)
let sug = [];

const status = (html) => { $("#q-status").innerHTML = html || ""; };

async function api(body) {
  const r = await fetch("/api/queue", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({ error: "bad answer" }));
  if (!r.ok && !d.error) d.error = "error " + r.status;
  return d;
}

function rememberKey(k) {
  K = k; store.set("hc_queue", k);
  // The service worker reads this to ask what is new when a push arrives.
  try { caches.open("hc").then((c) => c.put("/__queue_key", new Response(k))); } catch (e) {}
}

function payLine(i) {
  const m = i.match;
  if (m) {
    const pool = m.rate_per_1k == null && m.per_post == null; // a prize pool splits by views; there is no per-clip rate
    const amount = pool && !m.expected_per_clip ? `<b class="big">pool</b>${money(m.budget_left)} shared by views`
      : m.expected_per_clip != null ? `<b class="big">${money(m.expected_per_clip)}</b>typical per clip` : `<b class="big">new</b>${m.cap_per_clip != null ? "up to " + money(m.cap_per_clip) + " a clip" : "no payouts yet"}`;
    const rate = m.rate_per_1k != null ? ` · ${money(m.rate_per_1k)}/1k views` : "";
    const chips = [...m.checks.map((c) => `<span class="chip risk-low">✓ ${h(c)}</span>`), ...m.todo.map((c) => `<span class="chip risk-medium">${h(c)}</span>`)].join("");
    return `<div class="q-pay"><span class="lab">Pays for ${h(i.channel_name)} clips</span>${amount}${rate}<br><a href="/campaigns/${h(m.slug)}">${h(m.title)}</a> · ${money(m.budget_left)} left${chips ? `<div class="q-todo">${chips}</div>` : ""}${i.better ? `<p class="small">A campaign you haven’t picked pays more: <a href="/campaigns/${h(i.better.slug)}">${h(i.better.title)}</a>.</p>` : ""}</div>`;
  }
  const g = i.general || [];
  if (!g.length) return `<div class="q-pay"><span class="lab">No campaign yet</span>${h(i.no_match_why || "")}. <a href="/gta-6-clipping-campaigns">See what pays</a></div>`;
  return `<div class="q-pay"><span class="lab">General fit · not a ${h(i.channel_name)} campaign</span>${h(i.no_match_why || "")}. Any GTA VI gameplay clip can go to:<ul>${g.map((c) => `<li><a href="/campaigns/${h(c.slug)}">${h(c.title)}</a> · ${c.expected_per_clip != null ? money(c.expected_per_clip) + " typical per clip" : c.cap_per_clip != null ? "new, up to " + money(c.cap_per_clip) + " a clip" : "new"}<div class="q-todo">${c.todo.map((t) => `<span class="chip risk-medium">${h(t)}</span>`).join("")}</div></li>`).join("")}</ul></div>`;
}

function exportHref(i) {
  const [platform, login] = i.channel.split(":");
  const q = platform === "kick" ? `https://kick.com/${login}/videos/${i.vod_id}` : i.vod_id;
  return `/clip?q=${encodeURIComponent(q)}&qi=${encodeURIComponent(i.id)}&ch=${encodeURIComponent(i.channel)}${i.match ? "&c=" + encodeURIComponent(i.match.slug) : ""}`;
}

function itemLi(i) {
  const quote = (i.quote || []).map((q) => `“${h(q.t)}”${q.n > 1 ? " ×" + q.n : ""}`).join(" · ");
  const chips = [`<span class="chip hot">chat ${i.chat_ratio}× normal</span>`, `<span class="chip">${i.length_s} s</span>`];
  if (i.clip_requests) chips.push(`<span class="chip hot">${i.clip_requests} “clip it”</span>`);
  if (i.twitch_clips) chips.push(`<span class="chip">clipped on Twitch ${i.twitch_clips}×</span>`);
  if (i.music_risk && i.music_risk.level !== "low") chips.push(`<span class="chip risk-${h(i.music_risk.level)}">music risk: ${h(i.music_risk.level)}</span>`);
  return `<li class="q-item${i.match ? " q-paid" : ""}" data-id="${h(i.id)}">
<div class="q-who">${i.avatar ? `<img src="${h(i.avatar)}" alt="" loading="lazy">` : ""}<span><b>${h(i.channel_name)}</b> · ${h(i.game === "Grand Theft Auto VI" ? "GTA VI" : i.game || "stream")} · ${ago(i.found_at)}${i.live ? ' · <span class="q-live">LIVE</span>' : ""}</span></div>
<p class="q-hook">${h(i.hook)}</p>
${quote ? `<p class="q-quote">${quote}</p>` : ""}
<div class="chips">${chips.join("")}</div>
${payLine(i)}
<div class="q-act"><a class="btn" data-act="export" href="${h(exportHref(i))}">Export 9:16</a><button class="btn ghost" data-act="copy">Copy caption</button><button class="btn ghost" data-act="skip" aria-label="Skip this clip">Skip</button></div>
</li>`;
}

function render() {
  const has = wanted.length > 0;
  $("#q-start").hidden = has;
  $("#q-root").classList.toggle("has", has);
  document.title = has && data && data.items.length ? `(${data.items.length}) Your clip queue – heistclips` : document.title;
  const by = new Map(((data && data.watch.channels) || []).map((c) => [c.key, c]));
  $("#q-watch").innerHTML = wanted.map((key) => {
    const c = by.get(key) || { key, name: key.split(":")[1] };
    return `<li data-key="${h(key)}">${c.avatar ? `<img src="${h(c.avatar)}" alt="">` : ""}${c.is_live ? '<span class="dot" title="live now"></span>' : ""}<span><b>${h(c.name)}</b>${c.missing ? " · not found" : c.campaigns && c.campaigns.length ? ` · ${c.campaigns.length} campaign${c.campaigns.length === 1 ? "" : "s"}` : ""}</span><button data-act="unwatch" aria-label="Stop watching ${h(c.name)}">✕</button></li>`;
  }).join("");
  $("#q-sug").innerHTML = sug.filter((s) => !wanted.includes(s.key)).slice(0, 14).map((s) => `<button type="button" data-key="${h(s.key)}">${s.avatar ? `<img src="${h(s.avatar)}" alt="" loading="lazy">` : ""}<span>${h(s.name)}${s.best ? ` <small>${s.best.expected_per_clip ? money(s.best.expected_per_clip) + "/clip" : "pays"}</small>` : s.live ? " <small>live</small>" : ""}</span></button>`).join("");
  if (!has) { $("#q-list").innerHTML = ""; $("#q-more").innerHTML = ""; return; }
  const items = (data && data.items) || [];
  const notes = ((data && data.watch.channels) || []).filter((c) => c.note || c.missing).map((c) => `<li class="note"><b>${h(c.name)}</b>: ${h(c.missing ? "no channel with that name" : c.note)}</li>`).join("");
  $("#q-list").innerHTML = items.map(itemLi).join("") + notes || `<li class="q-empty">Nothing in the queue yet. Chat hasn’t spiked in the streams you watch, or they haven’t streamed lately. New moments land here within about 10 minutes of happening.</li>`;
  const w = data ? data.watch : {};
  const link = `${location.origin}/queue?k=${K}`;
  $("#q-more").innerHTML = `${data && data.done ? `<p class="small">${data.done} clip${data.done === 1 ? "" : "s"} already exported or skipped.</p>` : ""}
<div class="q-card"><h2>Tell me when clips are ready</h2>
<p class="small" id="q-nstat">${w.email_ok ? `Emailing ${h(w.email)}. ` : w.email ? `Check ${h(w.email)} for the link to confirm. ` : ""}${w.push ? "Notifications are on in " + w.push + " browser" + (w.push === 1 ? "" : "s") + "." : ""}</p>
<div class="q-row"><button class="btn sm" id="q-push">Turn on notifications</button></div>
<form class="q-row" id="q-mail"><input type="email" id="q-email" placeholder="or your email" aria-label="Email address" autocomplete="email"><button class="btn sm ghost">Email me</button></form></div>
<div class="q-card"><h2>Your queue on another device</h2><p class="small">This private link opens the same queue anywhere. Don’t share it.</p>
<div class="q-row"><input readonly id="q-link" value="${h(link)}" aria-label="Private link to this queue"><button class="btn sm ghost" id="q-copy">Copy link</button></div></div>`;
}

async function save(reason, addedKey) {
  status(addedKey ? `<span class="q-spin"></span>Reading ${h(addedKey.split(":")[1])}’s latest stream… about 15 seconds.` : `<span class="q-spin"></span>Saving…`);
  const d = await api({ action: "save", k: K || undefined, d: device, channels: wanted, paid_key: store.get("hc_key") || undefined });
  if (d.error) { status(h(d.error)); return; }
  rememberKey(d.k);
  if (d.paid_key && !store.get("hc_key")) store.set("hc_key", d.paid_key); // bought clips follow the queue
  data = d;
  wanted = d.watch.channels.map((c) => c.key);
  const scan = (d.scans || []).find((s) => s.key === addedKey);
  status(scan ? (scan.missing ? `No channel called ${h(addedKey.split(":")[1])}.` : scan.error ? "Couldn’t read that stream just now; it will be tried again in 10 minutes." : scan.note ? h(scan.note) + "." : (() => { const n = d.items.filter((i) => i.channel === addedKey).length; return n ? `${n} clip${n === 1 ? "" : "s"} ready from ${h(addedKey.split(":")[1])}.` : `No clear chat spikes in ${h(addedKey.split(":")[1])}’s latest stream. New ones land here within about 10 minutes.`; })()) : "");
  render();
}

async function load() {
  if (!K) return render();
  status(`<span class="q-spin"></span>Loading your queue…`);
  const r = await fetch(`/api/queue?k=${encodeURIComponent(K)}`);
  if (r.status === 404) { status("That queue link doesn’t exist any more. Start a new one below."); K = null; store.set("hc_queue", ""); return render(); }
  data = await r.json();
  wanted = data.watch.channels.map((c) => c.key);
  status("");
  render();
  ph("queue_open", { items: data.items.length, paid: data.items.filter((i) => i.match).length, channels: wanted.length, from: params.get("from") || "direct" });
  api({ action: "seen", k: K });
}

function parseChan(raw) {
  const s = String(raw || "").trim().toLowerCase();
  let m = s.match(/^(?:https?:\/\/)?(?:www\.)?kick\.com\/([a-z0-9_-]{2,40})\/?$/) || s.match(/^kick:([a-z0-9_-]{2,40})$/);
  if (m) return "kick:" + m[1];
  m = s.match(/^(?:https?:\/\/)?(?:www\.|m\.)?twitch\.tv\/([a-z0-9_]{3,25})\/?$/) || s.match(/^(?:twitch:)?@?([a-z0-9_]{3,25})$/);
  return m ? "twitch:" + m[1] : null;
}

async function watch(key, how) {
  if (!key) return status("Type a Twitch channel name, or a kick.com/… link.");
  if (wanted.includes(key)) return status("Already watching that one.");
  if (wanted.length >= 12) return status("That’s the limit: 12 streamers. Remove one first.");
  wanted.push(key);
  ph("watchlist_add", { platform: key.split(":")[0], channel: key.split(":")[1], how, n: wanted.length });
  render();
  await save("add", key);
}

$("#q-add").addEventListener("submit", (e) => { e.preventDefault(); const v = $("#q-in").value; $("#q-in").value = ""; watch(parseChan(v), "typed"); });
$("#q-sug").addEventListener("click", (e) => { const b = e.target.closest("button[data-key]"); if (b) watch(b.dataset.key, "suggested"); });

document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-act]");
  if (b) {
    const act = b.dataset.act;
    if (act === "unwatch") { const key = b.closest("li").dataset.key; wanted = wanted.filter((k) => k !== key); ph("watchlist_remove", {}); render(); return save("remove"); }
    const li = b.closest(".q-item"); const id = li && li.dataset.id; const item = data && data.items.find((x) => x.id === id);
    if (!item) return;
    if (act === "copy") { try { await navigator.clipboard.writeText(item.caption); b.textContent = "Copied"; } catch (err) { b.textContent = item.caption; } ph("queue_copy_caption", { paid: !!item.match }); }
    if (act === "skip") { states[id] = "skipped"; data.items = data.items.filter((x) => x.id !== id); data.done++; li.remove(); ph("queue_skip", { paid: !!item.match }); api({ action: "state", k: K, states }); }
    if (act === "export") ph("queue_export_open", { paid: !!item.match, live: !!item.live, channel: item.channel_name });
    return;
  }
  if (e.target.id === "q-copy") { const el = $("#q-link"); try { await navigator.clipboard.writeText(el.value); e.target.textContent = "Copied"; } catch (err) { el.select(); } ph("queue_link_copy", {}); }
  if (e.target.id === "q-push") enablePush(e.target);
});

document.addEventListener("submit", async (e) => {
  if (e.target.id !== "q-mail") return;
  e.preventDefault();
  const email = $("#q-email").value.trim();
  const d = await api({ action: "email", k: K, email });
  $("#q-nstat").textContent = d.ok ? `Sent. Open the link in the mail to ${d.email} to confirm.` : (d.error || d.why || "Couldn’t send that mail.");
  ph("queue_notify", { via: "email", ok: !!d.ok });
});

const b64ToBytes = (s) => { const p = "=".repeat((4 - (s.length % 4)) % 4); const raw = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(raw, (c) => c.charCodeAt(0)); };
async function enablePush(btn) {
  const say = (t) => { $("#q-nstat").textContent = t; };
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return say(/iphone|ipad/i.test(navigator.userAgent) ? "On iPhone, add heistclips to your Home Screen first (Share → Add to Home Screen), or use email below." : "This browser can’t show notifications. Use email below.");
  btn.disabled = true;
  try {
    const { key } = await (await fetch("/api/queue?vapid=1")).json();
    if (!key) return say("Notifications aren’t set up yet. Use email below.");
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return say("Notifications are blocked for this site in your browser settings.");
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    rememberKey(K);
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
    const d = await api({ action: "push", k: K, sub: { endpoint: sub.endpoint } });
    say(d.ok ? "Notifications are on. You’ll get one when new clips land." : (d.error || "Couldn’t turn notifications on."));
    ph("queue_notify", { via: "push", ok: !!d.ok });
  } catch (err) { say("Couldn’t turn notifications on: " + err.message); }
  finally { btn.disabled = false; }
}

(async () => {
  const pk = params.get("k");
  if (pk && /^[A-Za-z0-9_-]{20,40}$/.test(pk)) {
    rememberKey(pk);
    const conf = params.get("confirm");
    let msg = "";
    if (conf) { const d = await api({ action: "confirm", k: pk, token: conf }); msg = d.ok ? `Confirmed. New clips will be emailed to ${d.email}.` : (d.error || ""); ph("queue_email_confirm", { ok: !!d.ok }); }
    if (params.get("mail") === "off") { await api({ action: "mailoff", k: pk }); msg = "Emails are off."; }
    history.replaceState(null, "", "/queue"); // keep the secret out of the address bar and referrers
    await load();
    if (msg) status(h(msg));
  } else await load();
  try { sug = (await (await fetch("/api/queue?suggest=1")).json()).streamers || []; } catch (e) {}
  render();
  const add = params.get("add") && parseChan(params.get("add")); // "Watch this streamer for me" links
  if (add && !wanted.includes(add)) watch(add, "link");
})();
