// /launch: an owner proves their Twitch channel, sees their own pitch, sets the campaign, pays
// with Stripe Checkout, then watches it on the same page. Talks only to /api/hosted.
// The owner key (ho_…) is the dashboard's only key: kept in localStorage, and shown as a link
// they can save, because there is no password.
const $ = (id) => document.getElementById(id);
const root = $("ln");
const FEE = Number(root.dataset.fee) || 10;
const KEY = "hc_owner";
const ev = (name, props = {}) => { try { window.posthog && window.posthog.capture(name, { ...props, page: "launch" }); } catch (e) {} };
const store = { get() { try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; } }, set(v) { try { localStorage.setItem(KEY, v); } catch (e) {} } };
const api = async (op, body) => {
  const r = await fetch("/api/hosted?op=" + op, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {});
  const d = await r.json().catch(() => ({ ok: false, error: "No answer. Try again." }));
  return d;
};
const show = (id, on = true) => { $(id).hidden = !on; };
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (x) => "$" + Number(x || 0).toLocaleString("en-US", { minimumFractionDigits: x % 1 ? 2 : 0, maximumFractionDigits: 2 });
const num = (x) => Number(x || 0).toLocaleString("en-US");

let state = { k: "", channel: null };

// A key in the link (#k=…) wins: it is how an owner gets back from another device or from Twitch.
const hash = new URLSearchParams(location.hash.slice(1));
const q = new URLSearchParams(location.search);
if (/^ho_[A-Za-z0-9_-]{32}$/.test(hash.get("k") || "")) store.set(hash.get("k"));
state.k = store.get();
ev("launch_view", { has_key: !!state.k, back_from: q.get("paid") ? "stripe" : q.get("cancelled") ? "stripe_cancel" : hash.get("tw") ? "twitch" : undefined });

async function start(channel) {
  $("e-channel").textContent = "";
  const d = await api("start", { channel, k: state.k || undefined });
  if (!d.ok) { $("e-channel").textContent = d.error || "That did not work."; return; }
  state.k = d.k; store.set(d.k); state.channel = d.channel;
  try { localStorage.setItem(KEY + "_ch", d.channel.login); } catch (e) {}
  ev("launch_channel", { verified: d.verified, oauth: d.oauth });
  if (d.verified) return verified();
  $("p-avatar").src = d.channel.avatar || ""; $("p-name").textContent = d.channel.name;
  $("p-code").textContent = d.code;
  show("p-oauth", !!d.oauth);
  if (d.oauth) $("b-twitch").href = "/api/hosted?op=twitch_start&k=" + encodeURIComponent(d.k);
  show("s-prove"); $("s-prove").scrollIntoView({ behavior: "smooth", block: "start" });
  ev("launch_signin_start", { how: "code_shown" });
}

$("f-channel").addEventListener("submit", (e) => { e.preventDefault(); start($("i-channel").value); });
$("b-copy").addEventListener("click", () => { navigator.clipboard && navigator.clipboard.writeText($("p-code").textContent).then(() => { $("b-copy").textContent = "Copied"; }).catch(() => {}); });
$("b-twitch").addEventListener("click", () => ev("launch_signin_start", { how: "twitch_oauth" }));
$("b-check").addEventListener("click", async () => {
  $("b-check").disabled = true; $("e-prove").textContent = "";
  const d = await api("check", { k: state.k, channel: state.channel && state.channel.login });
  $("b-check").disabled = false;
  if (d.ok && d.verified) { ev("launch_verified", { via: "bio_code" }); return verified(); }
  ev("launch_check_miss");
  $("e-prove").textContent = d.message || d.error || "Not found yet.";
});

async function verified() {
  show("s-prove", false);
  show("s-pitch"); show("s-form");
  totals();
  const d = await api("pitch", { k: state.k });
  show("p-wait", false);
  if (!d.ok) { $("t-pitch").textContent = "Your channel is verified."; return; }
  if (!d.vods || !d.vods.length) { $("t-pitch").textContent = "Your channel is verified."; $("p-moments").innerHTML = `<li>${esc(d.note || "No saved streams to read.")}</li>`; return; }
  const last = d.vods.length === 1 ? "stream" : d.vods.length + " streams";
  $("t-pitch").textContent = d.clipped === d.flagged ? `Chat flagged ${d.flagged} moments in your last ${last}, and we found a clip of every one.` : `Chat flagged ${d.flagged} moments in your last ${last}. We found a clip of ${d.clipped}.`;
  $("p-nums").innerHTML = `<li><b>${d.flagged}</b><span>moments chat flagged</span></li><li><b>${d.clipped}</b><span>with a clip we found</span></li><li><b>${d.no_clip_found}</b><span>no clip found</span></li>`;
  show("p-nums"); show("p-how");
  $("p-moments").innerHTML = (d.top_unclipped || []).slice(0, 3).map((m) => `<li><b>${esc(m.start)}</b> · chat ${esc(m.chat)} normal speed${m.phrase ? ` · “${esc(m.phrase)}”` : ""} · <a href="${esc(m.watch)}" target="_blank" rel="noopener">watch</a></li>`).join("");
  ev("launch_pitch_shown", { flagged: d.flagged, clipped: d.clipped, no_clip_found: d.no_clip_found, vods: d.vods.length, heistclips_clips: d.heistclips_clips });
}

// ---- the form ----------------------------------------------------------------------------------
function formBody() {
  const f = $("f-camp"), fd = new FormData(f);
  return { budget: fd.get("budget"), rate_per_1k: fd.get("rate_per_1k"), floor_views: fd.get("floor_views"), cap_per_clip: fd.get("cap_per_clip"), platforms: fd.getAll("platforms"),
    min_secs: fd.get("min_secs"), max_secs: fd.get("max_secs"), facecam_required: fd.get("facecam_required") === "1", required_tags: fd.get("required_tags"), notes: fd.get("notes") };
}
function totals() {
  const b = formBody(), budget = Number(b.budget) || 0, rate = Number(b.rate_per_1k) || 0, cap = Number(b.cap_per_clip) || 0;
  const fee = Math.round(budget * FEE) / 100;
  const views = rate > 0 ? Math.round((budget / rate) * 1000) : 0, capViews = rate > 0 ? Math.round((cap / rate) * 1000) : 0;
  $("p-total").innerHTML = budget > 0 && rate > 0 ? `${money(budget)} pays for <b>${num(views)} views</b>. One clip earns at most ${money(cap)} (${num(capViews)} views).<br>You pay <b>${money(budget + fee)}</b>: ${money(budget)} budget + ${money(fee)} fee (${FEE}%).` : "";
  $("b-pay").textContent = budget > 0 ? `Pay ${money(budget + fee)} with Stripe` : "Pay with Stripe";
}
$("f-camp").addEventListener("input", totals);
$("f-camp").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("e-form").textContent = ""; $("b-pay").disabled = true;
  const b = formBody();
  ev("launch_checkout_start", { budget: Number(b.budget), rate_per_1k: Number(b.rate_per_1k), floor_views: Number(b.floor_views), cap_per_clip: Number(b.cap_per_clip), platforms: b.platforms.join(","), fee_pct: FEE }, );
  const d = await api("checkout", { k: state.k, ...b });
  if (d.ok && d.url) { try { window.posthog && window.posthog.capture("launch_checkout_open", { campaign: d.campaign }, { transport: "sendBeacon" }); } catch (x) {} location.href = d.url; return; }
  $("b-pay").disabled = false;
  $("e-form").textContent = d.error || "That did not work.";
  ev("launch_checkout_error", { field: d.field || undefined });
});

// ---- the dashboard -------------------------------------------------------------------------------
function subRow(c, s) {
  const plat = s.platform === "youtube" ? "YouTube" : "TikTok";
  const chk = s.checks || {};
  const owner = [chk.facecam === "owner checks" ? "check: facecam" : null, "check: it's your stream"].filter(Boolean).join(" · ");
  return `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${plat} clip</a>
<span>${s.views == null ? "views: first read soon" : num(s.views) + " views"}</span><span>${money(s.earned)} earned</span>
${s.suspect ? `<span class="flag">⚠ ${esc(s.suspect.reason)}</span>` : ""}
<span class="small">${esc(owner)}</span>
${s.rejected ? '<span class="flag">rejected</span>' : `<button class="btn ghost sm" data-reject="${esc(s.sid)}" data-campaign="${esc(c.id)}" type="button">Reject</button>`}</li>`;
}
function campCard(c) {
  if (c.status === "unpaid") return `<div class="camp"><h3>${esc(c.title)}</h3><p class="small">Not paid yet: ${money(c.total)} (${money(c.budget)} budget + ${money(c.fee)} fee). It goes live for clippers once paid.</p></div>`;
  const subs = c.submissions || [];
  return `<div class="camp"><h3><a href="${esc(c.page)}">${esc(c.title)}</a></h3>
<p class="small">${c.status === "live" ? '<span class="ok">Live for clippers</span>' : esc(c.status)} · ${money(c.rules.rate_per_1k)} per 1K views · cap ${money(c.rules.cap_per_clip)} · floor ${num(c.rules.floor_views)} views</p>
<ul class="nums"><li><b>${money(c.left)}</b><span>left of ${money(c.budget)}</span></li><li><b>${num(c.views)}</b><span>views counted</span></li><li><b>${subs.length}</b><span>clips submitted</span></li><li><b>${c.suspect || 0}</b><span>flagged for a look</span></li></ul>
${subs.length ? `<ul class="subs">${subs.map((s) => subRow(c, s)).join("")}</ul>` : `<p class="small">No clips yet. It is listed for clippers on the site and in the heistclips connector.</p>`}
${c.read_at ? `<p class="small">Views last read ${esc(new Date(c.read_at).toLocaleString())}.</p>` : ""}</div>`;
}
async function dashboard(focus) {
  const d = await api("dash&k=" + encodeURIComponent(state.k));
  if (!d.ok || !d.campaigns || !d.campaigns.length) return false;
  show("s-hero", false); show("s-prove", false); show("s-pitch", false); show("s-form", false); show("s-dash");
  $("t-dash").textContent = d.channel ? `${d.channel.name}'s campaigns` : "Your campaigns";
  $("d-list").innerHTML = d.campaigns.map(campCard).join("");
  $("d-keep").innerHTML = `Save this link to open your dashboard on another device: <b>${esc(location.origin)}/launch#k=${esc(state.k)}</b>`;
  if (focus) ev("launch_dash_view", { campaigns: d.campaigns.length });
  return true;
}
$("d-list").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-reject]");
  if (!b) return;
  if (b.dataset.sure !== "1") { b.dataset.sure = "1"; b.textContent = "Tap again to reject"; return; }
  b.disabled = true;
  const d = await api("reject", { k: state.k, campaign: b.dataset.campaign, sid: b.dataset.reject });
  if (d.ok) { b.outerHTML = '<span class="flag">rejected</span>'; ev("launch_reject"); } else { b.disabled = false; b.textContent = d.error || "Try again"; }
});
$("b-new").addEventListener("click", () => { show("s-dash", false); show("s-hero"); if (state.channel || state.k) start(state.channel ? state.channel.login : $("i-channel").value || ""); });

// ---- on load -------------------------------------------------------------------------------------
(async () => {
  const paid = q.get("paid");
  if (paid) {
    history.replaceState(null, "", "/launch");
    const d = await api("claim", { session: paid });
    if (d.funded) ev("launch_paid", { campaign: d.campaign });
  }
  if (hash.get("tw") === "ok") ev("launch_verified", { via: "twitch_oauth" });
  if (hash.get("tw") === "failed") $("e-channel").textContent = "Twitch sign-in did not finish. Use the code instead.";
  if (hash.toString()) history.replaceState(null, "", location.pathname + location.search);
  if (state.k && (await dashboard(true))) return;
  // Back from Twitch, or back later on the same browser: carry on from the channel they gave.
  let ch = hash.get("ch");
  if (!ch) { try { ch = localStorage.getItem(KEY + "_ch"); } catch (e) {} }
  if (state.k && ch) { $("i-channel").value = ch; return start(ch); }
})();
// A dashboard link (#k=…) pasted while the page is open changes only the fragment: reload on it.
addEventListener("hashchange", () => { if (/(^|&)k=ho_/.test(location.hash.slice(1))) location.reload(); });
