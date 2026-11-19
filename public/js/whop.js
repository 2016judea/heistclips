// The Whop app view (inside Whop's iframe). Data arrives embedded; changes go to /api/whop.
const $ = (s, el = document) => el.querySelector(s);
const h = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ph = (ev, props) => { try { window.posthog && window.posthog.capture(ev, props); } catch (e) {} try { window.va && window.va("event", { name: ev, data: props }); } catch (e) {} };
const money = (x) => (x == null ? null : "$" + (x >= 100 ? Math.round(x).toLocaleString("en-US") : x.toFixed(2)));
const ago = (iso) => { const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000); return s < 90 ? "just now" : s < 5400 ? Math.round(s / 60) + " min ago" : s < 129600 ? Math.round(s / 3600) + " h ago" : Math.round(s / 86400) + " d ago"; };
let D = JSON.parse($("#w-data").textContent);
const app = $("#w-app");
const admin = D.level === "admin";
let editing = false, picked = null, results = [];

async function api(method, qs, body) {
  const r = await fetch(`/api/whop?id=${encodeURIComponent(D.id)}${qs || ""}`, { method, headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined, keepalive: true });
  return r.json().catch(() => ({ error: "bad answer" }));
}

function campaignCard(c) {
  const rules = [];
  if (c.approval_required) rules.push("apply first");
  if (c.length_rule) rules.push(`${c.length_rule.min}–${c.length_rule.max} s`);
  for (const r of c.requirements) if (r !== "length rule" || !c.length_rule) rules.push(r);
  const nums = [];
  if (c.rate_per_1k != null) nums.push([money(c.rate_per_1k), "per 1k views"]);
  else if (c.per_post != null) nums.push([money(c.per_post), "per post"]);
  else nums.push(["pool", "shared by views"]);
  if (c.cap_per_clip != null) nums.push([money(c.cap_per_clip), "max per clip"]);
  nums.push([money(c.budget_left), "budget left"]);
  if (c.expected_per_clip > 0) nums.push([money(c.expected_per_clip), "typical per clip"]);
  nums.push([String(c.clippers), "clippers"]);
  return `<section class="w-camp"><h1>${h(c.title)}</h1>
<div class="nums">${nums.map(([a, b]) => `<div><b>${h(a)}</b><span>${h(b)}</span></div>`).join("")}</div>
${rules.length ? `<div class="chips">${rules.map((r) => `<span class="chip risk-medium">${h(r)}</span>`).join("")}</div>` : ""}
<p class="small">Posts on ${h(c.platforms.join(", "))}. <a href="${h(c.source_url)}" target="_blank" rel="noopener">Read the full brief and submit clips</a></p></section>`;
}

function exportHref(i) {
  const [platform, login] = i.channel.split(":");
  const q = platform === "kick" ? `https://kick.com/${login}/videos/${i.vod_id}` : i.vod_id;
  return `/clip?q=${encodeURIComponent(q)}&qi=${encodeURIComponent(i.id)}&ch=${encodeURIComponent(i.channel)}${D.campaign ? "&c=" + encodeURIComponent(D.campaign.slug) : ""}`;
}

function itemLi(i) {
  const quote = (i.quote || []).map((q) => `“${h(q.t)}”${q.n > 1 ? " ×" + q.n : ""}`).join(" · ");
  const chips = [`<span class="chip hot">chat ${i.chat_ratio}× normal</span>`, `<span class="chip">${i.length_s} s</span>`];
  if (i.clip_requests) chips.push(`<span class="chip hot">${i.clip_requests} “clip it”</span>`);
  for (const c of i.checks) chips.push(`<span class="chip risk-low">✓ ${h(c)}</span>`);
  for (const c of i.todo) chips.push(`<span class="chip risk-medium">${h(c)}</span>`);
  if (!i.fits) chips.push(`<span class="chip risk-high">outside the campaign’s game</span>`);
  return `<li class="w-item" data-id="${h(i.id)}">
<div class="w-who">${i.avatar ? `<img src="${h(i.avatar)}" alt="">` : ""}<span><b>${h(i.channel_name)}</b> · ${h(i.game === "Grand Theft Auto VI" ? "GTA VI" : i.game || "stream")} · ${ago(i.found_at)}${i.live ? ' · <span class="w-live">LIVE</span>' : ""}</span></div>
<p class="w-hook">${h(i.hook)}</p>${quote ? `<p class="w-quote">${quote}</p>` : ""}
<div class="chips">${chips.join("")}</div>
<div class="w-act"><a class="btn" data-act="export" href="${h(exportHref(i))}">Export 9:16</a><button class="btn ghost" data-act="copy">Copy caption</button><button class="btn ghost" data-act="skip">Skip</button></div></li>`;
}

function setupCard() {
  const cur = picked || D.campaign;
  return `<section class="w-card" id="w-setup"><h2>${D.configured ? "Change the campaign" : "Set up: which campaign do your clippers clip for?"}</h2>
<label for="w-q">Find your campaign by name, or paste its Content Rewards link</label>
<input id="w-q" placeholder="e.g. Lauren Hamden, or contentrewards.com/c/campaigns/…" autocomplete="off" autocapitalize="off">
<ul class="w-res" id="w-res">${results.map((c) => `<li><button type="button" data-pick="${h(c.id)}" class="${cur && cur.id === c.id ? "on" : ""}"><b>${h(c.title)}</b><small>${h(c.owner || "")} · ${money(c.budget_left)} left · ${c.clippers} clippers</small></button></li>`).join("")}</ul>
<label for="w-ch">Twitch or Kick channels the campaign pays for (up to 6, separated by commas)</label>
<input id="w-ch" placeholder="e.g. laurenhamdenn, kick.com/xqc" autocapitalize="off" autocomplete="off" value="${h((picked ? picked.suggested_channels || [] : D.channels.map((c) => c.key)).map((k) => (k.startsWith("kick:") ? "kick.com/" + k.slice(5) : k.slice(7))).join(", "))}">
<p class="w-status" id="w-st" role="status">${cur ? "Campaign: " + h(cur.title) : ""}</p>
<div class="w-act"><button class="btn" id="w-save" ${cur ? "" : "disabled"}>Save</button>${D.configured ? `<button class="btn ghost" id="w-cancel">Cancel</button>` : ""}</div></section>`;
}

function render() {
  const parts = [];
  if (D.view === "dash") parts.push(`<p class="small">This sets the default for every heistclips page in your whop. Your clippers see the campaign, its rules, and a queue of ready clips from the channels you name.</p>`);
  if (D.campaign) parts.push(campaignCard(D.campaign));
  else if (D.campaign_missing) parts.push(`<div class="note">The campaign this was set up for is no longer live.${admin ? " Pick another below." : ""}</div>`);
  if (admin && (editing || !D.configured || D.campaign_missing)) parts.push(setupCard());
  else if (!D.configured) parts.push(`<div class="note">The owner of this whop hasn’t picked a campaign yet. You can still find moments in any stream below.</div>`);
  if (D.configured) {
    const notes = D.channels.filter((c) => c.missing || c.note).map((c) => `<li class="note"><b>${h(c.name)}</b>: ${h(c.missing ? "no channel with that name" : c.note)}</li>`).join("");
    parts.push(`<h2 class="w-h2">Clips ready${D.channels.length ? " from " + D.channels.map((c) => h(c.name) + (c.is_live ? ' <span class="w-live">LIVE</span>' : "")).join(", ") : ""}</h2>
<ol class="w-list" id="w-list">${D.items.map(itemLi).join("") + notes || `<li class="small">Nothing yet. New moments land here within about 10 minutes of chat spiking.</li>`}</ol>
${D.done ? `<p class="small">${D.done} already exported or skipped by you.</p>` : ""}`);
  }
  parts.push(`<section class="w-card"><h2>Find moments in any stream</h2><form class="w-find" action="/clip" method="get"><input name="q" placeholder="Twitch or Kick channel, or a VOD link" aria-label="Channel or VOD link" value="${h(D.channels[0] ? (D.channels[0].platform === "kick" ? "kick.com/" : "") + D.channels[0].login : "")}" autocapitalize="off"><button class="btn">Find</button></form></section>`);
  if (admin && D.configured && !editing && !D.campaign_missing) parts.push(`<p><button class="btn sm ghost" id="w-edit">Change campaign or channels</button></p>`);
  app.innerHTML = parts.join("\n");
  if ($("#w-q") && !results.length) search("");
}

let timer = null;
async function search(q) {
  const d = await api("GET", "&campaigns=" + encodeURIComponent(q));
  results = d.campaigns || [];
  const ul = $("#w-res");
  if (ul) ul.innerHTML = results.map((c) => `<li><button type="button" data-pick="${h(c.id)}" class="${picked && picked.id === c.id ? "on" : ""}"><b>${h(c.title)}</b><small>${h(c.owner || "")} · ${money(c.budget_left)} left · ${c.clippers} clippers</small></button></li>`).join("") || `<li class="small">No live campaign matches that.</li>`;
}

document.addEventListener("input", (e) => { if (e.target.id === "w-q") { clearTimeout(timer); const v = e.target.value; timer = setTimeout(() => search(v), 250); } });

document.addEventListener("click", async (e) => {
  const p = e.target.closest("[data-pick]");
  if (p) {
    picked = results.find((c) => c.id === p.dataset.pick);
    document.querySelectorAll("[data-pick]").forEach((b) => b.classList.toggle("on", b === p));
    $("#w-st").textContent = "Campaign: " + picked.title;
    if (!$("#w-ch").value.trim() && picked.suggested_channels.length) $("#w-ch").value = picked.suggested_channels.map((k) => (k.startsWith("kick:") ? "kick.com/" + k.slice(5) : k.slice(7))).join(", ");
    $("#w-save").disabled = false;
    return;
  }
  if (e.target.id === "w-edit") { editing = true; picked = null; return render(); }
  if (e.target.id === "w-cancel") { editing = false; return render(); }
  if (e.target.id === "w-save") {
    const c = picked || D.campaign;
    e.target.disabled = true;
    $("#w-st").textContent = "Saving, and reading the latest stream… about 15 seconds.";
    const d = await api("POST", "", { action: "config", campaign_id: c.id, channels: $("#w-ch").value });
    if (d.error) { $("#w-st").textContent = d.error; e.target.disabled = false; return; }
    ph("whop_setup_save", { view: D.view, channels: d.channels.length, items: d.items.length });
    D = { ...D, ...d }; editing = false; picked = null; return render();
  }
  const b = e.target.closest("[data-act]");
  if (!b) return;
  const li = b.closest(".w-item"); const item = D.items.find((x) => x.id === li.dataset.id);
  if (b.dataset.act === "copy") { try { await navigator.clipboard.writeText(item.caption); b.textContent = "Copied"; } catch (err) { b.textContent = item.caption; } ph("whop_copy_caption", {}); }
  if (b.dataset.act === "skip") { D.items = D.items.filter((x) => x !== item); li.remove(); api("POST", "", { action: "state", states: { [item.id]: "skipped" } }); ph("whop_skip", {}); }
  if (b.dataset.act === "export") { ph("whop_export_open", { channel: item.channel_name, live: item.live }); api("POST", "", { action: "state", states: { [item.id]: "exported" } }); }
});

render();
ph("whop_open", { view: D.view, role: D.level, configured: D.configured, items: D.items.length });
