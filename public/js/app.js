// The clip tool: paste -> moments (with why) -> cut -> download.
import { parseInput, getChannel, getVod, findMoments, playlistPath, clock, twitchTime, searchChannels, getClip, refinePeak, hooks } from "./twitch.js";
import { Clipper, pickMime } from "./render.js?v=8";
import { LiveChat, recordingStart } from "./live.js";
import { getKickChannel, getKickVod } from "./kick.js";
import { paywallHTML } from "./paywall.js";
import { markSpoilers, spoilerCheck } from "./spoilers.js";
import "./post.js?v=1"; // Post to YouTube / TikTok buttons; listens for hc:rendered
import { fillHot, topLive } from "./hot.js";
import { queueHandoff } from "./queuehand.js";

const $ = (s, el = document) => el.querySelector(s);
const h = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const app = $("#app");
const params = new URLSearchParams(location.search);
const ph = (ev, props) => { try { window.posthog && window.posthog.capture(ev, props); } catch (e) {} try { window.va && window.va("event", { name: ev, data: props }); } catch (e) {} };

// ---- credits -------------------------------------------------------------------------------
const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
let device = store.get("hc_device");
if (!device) { device = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()); store.set("hc_device", device); }
let credits = { free_left: null, paid_left: null };

async function loadCredits() {
  try {
    const r = await fetch(`/api/credits?d=${encodeURIComponent(device)}&k=${encodeURIComponent(store.get("hc_key") || "")}`);
    credits = await r.json();
  } catch (e) {}
  document.querySelectorAll(".credit").forEach((el) => (el.textContent = creditText()));
}
const creditText = () => credits.free_left == null ? "" : `${credits.free_left} free clip${credits.free_left === 1 ? "" : "s"} left${credits.paid_left ? ` + ${credits.paid_left} paid` : ""}`;

// A clip is charged only after the file exists and has bytes in it: "start" checks the balance
// and hands back a ticket, "commit" spends it. A failed or empty render costs nothing.
async function creditCall(action, extra) {
  const r = await fetch("/api/credits", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, d: device, k: store.get("hc_key") || "", ...extra }) });
  const d = await r.json();
  if (d.free_left != null) credits = { free_left: d.free_left, paid_left: d.paid_left };
  document.querySelectorAll(".credit").forEach((el) => (el.textContent = creditText()));
  return d;
}

async function claimPurchase(session) {
  const r = await fetch("/api/credits", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "claim", d: device, session }) });
  const d = await r.json();
  if (d.key) { store.set("hc_key", d.key); credits = d; }
  return d;
}

// ---- spoiler filter (public/js/spoilers.js) ---------------------------------------------------
if (params.get("spoilers") === "skip") store.set("hc_nospoil", "1");
const skipSpoilers = () => store.get("hc_nospoil") === "1";
const spoilToggle = () => `<label class="spoiltoggle"><input type="checkbox" id="nospoil" ${skipSpoilers() ? "checked" : ""}> <span>Skip story spoilers <span class="small">(for campaigns that ban them)</span></span></label>`;
function renderSkipped() {
  const el = $("#skipped");
  if (!el) return;
  const sk = current.moments.map((m, i) => [m, i]).filter(([m]) => !m.live && !m.hidden && m.spoiler && m.spoiler.spoiler && !m.unskipped);
  el.innerHTML = skipSpoilers() && sk.length ? `<details class="skipped" open><summary>Skipped ${sk.length} moment${sk.length === 1 ? "" : "s"} as possible spoilers</summary><ul>${sk.map(([m, i]) => `<li><b>${clock(m.t_start)} – ${clock(m.t_end)}</b> <span class="small">${h(m.spoiler.reason)}</span> <button class="linkbtn" data-unskip="${i}">Show it anyway</button></li>`).join("")}</ul></details>` : "";
}
document.addEventListener("change", (e) => {
  if (e.target.id !== "nospoil") return;
  store.set("hc_nospoil", e.target.checked ? "1" : "0");
  ph("spoiler_filter", { on: e.target.checked, flagged: current.moments.filter((m) => m.spoiler && m.spoiler.spoiler).length });
  renderMoments();
});
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-unskip]");
  if (!b) return;
  current.moments[Number(b.dataset.unskip)].unskipped = true;
  renderMoments();
});

// ---- flow ----------------------------------------------------------------------------------
let current = { vod: null, chan: null, moments: [], clipper: null, live: null };

let jumpT = Number(params.get("t")) || 0;

// Never a dead end: say plainly what went wrong, then put live streams one tap away.
function dead(why, html, exclude) {
  ph("clip_dead", { why });
  say(`<div class="note">${html}</div><h3 class="hot-h">Live in GTA right now. Tap one to clip it.</h3><div id="hot"><p class="small">Finding who’s live…</p></div>`);
  fillHot($("#hot"), { exclude });
}

async function start(q) {
  let inp = parseInput(q);
  if (inp.kind === "gta") return dead("no_name", `Whose stream? Type a streamer’s name or paste their link, or pick one below.`);
  if (inp.kind === "unknown") return dead("bad_input_" + (inp.site || "text"), inp.site === "youtube"
    ? `YouTube streams can’t be read yet: heistclips reads Twitch and Kick. <a href="/requests">Vote for YouTube Live</a>, or clip one of these.`
    : `That isn’t a Twitch or Kick channel or video. Paste something like <b>twitch.tv/kaicenat</b>, <b>kick.com/adinross</b> or <b>twitch.tv/videos/…</b>`);
  say(`<div class="status">Looking up ${h(inp.text || inp.login || inp.id || "that clip")}…</div>`);
  ph("clip_lookup", { kind: inp.kind });
  try {
    if (inp.kind === "kick") {
      const chan = await getKickChannel(inp.login);
      if (!chan) return dead("kick_no_channel", `No Kick channel called <b>${h(inp.login)}</b>.`);
      current.chan = chan;
      const vod = chan.live_vod || chan.vods[0];
      if (!vod) return dead("kick_no_vod", `<b>${h(chan.name)}</b> has no saved Kick streams to read.`);
      return analyse(vod, chan);
    }
    if (inp.kind === "kickvod") {
      const vod = await getKickVod(inp.id);
      if (!vod) return dead("kickvod_missing", `That Kick video doesn’t exist or isn’t public.`);
      return analyse(vod, null);
    }
    let note = "";
    if (inp.kind === "clip") {
      const c = await getClip(inp.slug);
      if (!c) return dead("clip_missing", `That Twitch clip doesn’t exist any more.`);
      const vod = c.vod_id ? await getVod(c.vod_id) : null;
      if (vod) { jumpT = c.t || 0; return analyse(vod, null, `Opened the stream that clip was cut from, at the same second.`); }
      if (!c.login) return dead("clip_no_vod", `The stream that clip came from has been deleted.`);
      note = `The stream that clip came from has been deleted, so this is ${h(c.login)}’s latest stream. `;
      inp = { kind: "channel", login: c.login };
    }
    if (inp.kind === "channel" || inp.kind === "search") {
      let chan = inp.login ? await getChannel(inp.login) : null;
      const empty = (c) => !c || (!c.live_vod && !c.vods.length);
      // Typed with spaces, extra words or a typo: ask Twitch's own search who they meant.
      if (!chan || (inp.kind === "search" && empty(chan))) {
        const hits = await searchChannels(inp.text || inp.login);
        const hit = hits.find((x) => x.followers >= 10000 || x.live);
        const found = hit ? await getChannel(hit.login) : null;
        if (found && (!empty(found) || found.is_live)) { note += `Showing <b>${h(found.name)}</b> for “${h(q)}”. `; chan = found; ph("clip_corrected", { kind: inp.kind }); }
      }
      if (!chan) return dead("no_channel", `No Twitch channel called <b>${h(inp.text || inp.login)}</b>.`);
      current.chan = chan;
      const vod = chan.live_vod || chan.vods[0];
      if (!vod) {
        // A dead account with a famous near-namesake is usually a typo ("ischowspeed").
        let meant = "";
        if (!chan.is_live) {
          const hit = (await searchChannels(inp.text || inp.login)).find((x) => x.login !== chan.login && x.followers >= 50000);
          if (hit) meant = ` Did you mean <a href="/clip?q=${h(hit.login)}"><b>${h(hit.name)}</b></a>?`;
        }
        return dead(chan.is_live ? "live_no_vod" : "no_vods", (chan.is_live
          ? `<b>${h(chan.name)}</b> is live, but Twitch isn’t saving this stream, so there’s no video to cut.`
          : `<b>${h(chan.name)}</b> has no saved streams on Twitch.`) + meant, chan.login);
      }
      if (chan.is_live && !chan.live_vod) { note += `<b>${h(chan.name)}</b> is live right now, but Twitch isn’t saving this stream, so there’s no video of it to cut. These moments are from the last saved stream (${h(new Date(vod.created_at).toUTCString().slice(5, 11))}).`; ph("clip_live_unsaved", {}); }
      return analyse(vod, chan, note);
    }
    const vod = await getVod(inp.id);
    if (!vod) return dead("vod_missing", `That VOD doesn’t exist or isn’t public.`);
    return analyse(vod, null);
  } catch (e) {
    dead("twitch_error", `Couldn’t reach ${inp.kind && inp.kind.startsWith("kick") ? "Kick" : "Twitch"}: ${h(e.message)}. <a href="${h(location.href)}">Try again</a>.`);
  }
}

function say(html) { app.innerHTML = html; }

function sourceCard(vod, chan) {
  const live = vod.status === "RECORDING";
  const others = chan ? chan.vods.filter((v) => v.id !== vod.id).slice(0, 4) : [];
  const thumb = live && vod.platform !== "kick" ? `https://static-cdn.jtvnw.net/previews-ttv/live_user_${vod.channel}-640x360.jpg` : vod.thumb;
  return `<div class="src"><img src="${h(thumb || "")}" alt="" onerror="this.style.visibility='hidden'">
<div class="t"><b>${h(vod.title || "Untitled stream")}</b>
<span class="small">${vod.platform === "kick" ? "Kick · " : ""}${h(vod.channel_name)} · ${h(vod.game || "")} · ${clock(vod.length)}${live ? ' · <b class="livedot">LIVE</b>' : ""}</span>
${others.length ? `<span class="small">Other streams: ${others.map((v) => `<a href="/clip?q=${encodeURIComponent(v.platform === "kick" ? v.url : v.id)}">${h(new Date(v.created_at).toUTCString().slice(5, 11))}</a>`).join(" · ")}</span>` : ""}</div></div>`;
}

async function analyse(vod, chan, note = "") {
  current.vod = vod;
  const noteHtml = note ? `<div class="note">${note}</div>` : "";
  if (!playlistPath(vod)) {
    ph("clip_dead", { why: "vod_private" });
    say(noteHtml + sourceCard(vod, chan) + `<div class="note">This stream’s video isn’t public (subscriber-only or deleted), so it can’t be cut.</div><h3 class="hot-h">Live in GTA right now. Tap one to clip it.</h3><div id="hot"></div>`);
    return fillHot($("#hot"), { exclude: vod.channel });
  }
  const live = vod.status === "RECORDING";
  say(noteHtml + sourceCard(vod, chan) +
    (live ? `<div class="livebar" id="livebar"><span class="pulse"></span><span id="livetxt">Connecting to chat…</span></div><canvas class="curve" id="livecurve" width="900" height="70"></canvas>` : "") +
    `<div class="status" id="st"><span id="stt">Reading chat${live ? " so far" : ""}…${vod.platform === "kick" ? " Kick limits how fast chat can be read, so this takes about 2 minutes." : ""}</span><span class="bar"><i id="pb"></i></span><span id="pt"></span></div>
<canvas class="curve" id="curve" width="900" height="70"></canvas>
<p class="small"><span class="credit">${creditText()}</span></p>
${spoilToggle()}
<div id="skipped"></div>
<ol class="moments" id="moments"></ol>`);
  const qm = await queueHandoff(vod, ph); // opened from /queue: the moment is already found
  if (qm) { current.moments = [qm]; $("#st").innerHTML = qm.banner; renderMoments(); return openEditor(0); }
  if (live) startLive(vod);
  const t0 = performance.now();
  const secs = () => Math.round((performance.now() - t0) / 1000);
  const onProgress = (d, n) => { const pb = $("#pb"); if (pb) { pb.style.width = (100 * d / n) + "%"; $("#pt").textContent = `${d}/${n}`; } };
  // A marathon that is still live takes 20-40 s to read end to end, and the newest moments are
  // the ones a clipper wants. Read the last two hours first (a few seconds), show those, then
  // read the rest underneath without moving what is already on screen.
  let quick = null;
  if (live && vod.platform !== "kick" && vod.length > 3 * 3600) {
    try {
      const r = await findMoments(vod, { k: 6, from: vod.length - 2 * 3600, fill: 0, onProgress });
      if (current.vod !== vod) return;
      if (r.moments.length) {
        quick = r.moments;
        markSpoilers(vod, quick);
        ph("clip_first_moments", { n: quick.length, secs: secs() });
        current.moments = [...quick, ...current.moments.filter((m) => m.live)];
        $("#moments").insertAdjacentHTML("beforebegin", `<h3 id="recent-h">The last 2 hours</h3>`);
        renderMoments();
        const lo = $("#livemoments");
        if (lo) lo.innerHTML = current.moments.map((m, i) => (m.live ? momentLi(m, i) : "")).reverse().join("");
        $("#stt").textContent = `${quick.length} moments from the last 2 hours. Still reading the earlier ${clock(vod.length - 2 * 3600)}…`;
        $("#pb").style.width = "0";
      }
    } catch (e) { /* the full read below reports any failure */ }
  }
  let res;
  try {
    res = await findMoments(vod, { k: 12, onProgress });
  } catch (e) {
    if (current.vod !== vod) return;
    ph("clip_dead", { why: "read_failed" });
    $("#st").innerHTML = `<span>${vod.platform === "kick" ? "Kick" : "Twitch"} stopped answering (${h(e.message)}). <a href="${h(location.href)}">Try again</a>${quick ? "" : ", or clip one of these"}.</span>`;
    if (!quick) { $("#moments").insertAdjacentHTML("afterend", `<div id="hot"></div>`); fillHot($("#hot"), { exclude: vod.channel }); }
    return;
  }
  if (current.vod !== vod) return;
  const flagged = markSpoilers(vod, res.moments);
  const nQuiet = res.moments.filter((m) => m.quiet).length;
  ph("clip_moments", { spoilers: flagged, spoiler_filter: skipSpoilers(), n: res.moments.length + (quick ? quick.filter((q) => !res.moments.some((m) => m.t_start < q.t_end && m.t_end > q.t_start)).length : 0), secs: secs(), live, len: vod.length, quiet: nQuiet, msgs: res.messages });
  drawCurve($("#curve"), res.curve, vod.length, res.moments);
  if (quick) {
    const rest = res.moments.filter((m) => !quick.some((q) => m.t_start < q.t_end && m.t_end > q.t_start));
    const base = current.moments.length;
    current.moments.push(...rest);
    rest.forEach((m) => (m.later = true));
    if (rest.length) $("#moments").insertAdjacentHTML("afterend", `<h3>Earlier in this stream</h3><ol class="moments" id="moments2">${rest.map((m, i) => momentRow(m, base + i)).join("")}</ol>`);
    renderSkipped();
    $("#st").innerHTML = `<span>${quick.length + rest.length} moments from ${clock(vod.length)} of stream, in ${secs()} s. Watching live chat for new ones.</span>`;
  } else {
    $("#st").innerHTML = res.moments.length
      ? `<span>${nQuiet === res.moments.length ? `Chat stayed calm all stream, so these are its ${res.moments.length} best moments, not big spikes.` : `${res.moments.length} moments from ${clock(vod.length)} of stream, in ${secs()} s`}${live ? ". Watching live chat for new ones." : nQuiet === res.moments.length ? "" : "."}</span>`
      : `<span>${res.messages ? "Chat barely moved in this stream, so there is no moment worth cutting." : "Nobody typed in chat during this stream, so there is nothing to find moments from."}${live ? " Watching live chat for new ones." : ""}</span>`;
    const liveOnes = current.moments.filter((m) => m.live);
    current.moments = [...res.moments, ...liveOnes];
    renderMoments();
    const lo = $("#livemoments");
    if (lo) lo.innerHTML = current.moments.map((m, i) => (m.live ? momentLi(m, i) : "")).reverse().join("");
    if (!res.moments.length) {
      ph("clip_dead", { why: res.messages ? "flat_chat" : "no_chat" });
      const others = chan ? chan.vods.filter((v) => v.id !== vod.id).slice(0, 3) : [];
      $("#moments").innerHTML = (others.length ? `<li class="note">Try ${h(vod.channel_name)}’s other streams: ${others.map((v) => `<a href="/clip?q=${encodeURIComponent(v.platform === "kick" ? v.url : v.id)}">${h(new Date(v.created_at).toUTCString().slice(5, 11))} · ${clock(v.length)}</a>`).join(" · ")}</li>` : "") +
        `<li><h3 class="hot-h">Live in GTA right now. Tap one to clip it.</h3><div id="hot"></div></li>`;
      fillHot($("#hot"), { exclude: vod.channel });
    }
  }
  if (jumpT) {
    let idx = current.moments.findIndex((x) => !x.live && Math.abs(x.t_start - jumpT) < 30);
    if (idx < 0 && jumpT < vod.length) {
      // They asked for an exact second (a Twitch clip link, or a link from the assistant): build that moment.
      try {
        const m = await refinePeak(vod, { t: jumpT + 20, base: 0 });
        m.t_start = Math.max(0, jumpT - 4); m.t_end = Math.min(vod.length, m.t_start + 38);
        m.twitch_clips = 0; m.twitch_clip_views = 0; m.hooks = hooks(m, vod.channel_name); m.score = m.chat_ratio; m.asked = true;
        idx = current.moments.length; current.moments.push(m);
        $("#moments").insertAdjacentHTML("afterbegin", momentLi(m, idx));
      } catch (e) {}
    }
    if (idx >= 0) openEditor(idx);
  }
}

function drawCurve(cv, curve, len, moments) {
  const ctx = cv.getContext("2d"), W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  const max = Math.max(0.5, ...curve.map((p) => p[1]));
  ctx.strokeStyle = "#c8ff3d"; ctx.lineWidth = 1.5; ctx.beginPath();
  curve.forEach(([t, r], i) => { const x = (t / len) * W, y = H - 4 - (r / max) * (H - 10); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  ctx.stroke();
  ctx.fillStyle = "#ff4d5e";
  for (const m of moments) { const x = (m.t_peak / len) * W; ctx.fillRect(x - 1, 0, 2, H); }
}

function chips(m) {
  const c = [];
  if (!m.asked) c.push(`<span class="chip${m.quiet ? "" : " hot"}">chat ${m.chat_ratio}× normal speed</span>`);
  if (m.quiet) c.push(`<span class="chip">small spike</span>`);
  if (m.asked) c.push(`<span class="chip hot">the second you linked</span>`);
  if (m.event_type !== "reaction") c.push(`<span class="chip">${h(m.event_type)}</span>`);
  if (m.clip_requests) c.push(`<span class="chip hot">${m.clip_requests} “clip it”</span>`);
  if (m.twitch_clips) c.push(`<span class="chip">already clipped on Twitch ${m.twitch_clips}× (${m.twitch_clip_views} views)</span>`);
  c.push(`<span class="chip risk-${m.music_risk.level}" title="${h(m.music_risk.why)}">music risk: ${m.music_risk.level}</span>`);
  if (m.spoiler && m.spoiler.spoiler) c.push(`<span class="chip risk-high" title="${h(m.spoiler.reason)}">possible spoiler</span>`);
  if (m.live) c.push(`<span class="chip hot">live, ${Math.max(0, Math.round((Date.now() - m.found_at) / 60000))} min ago</span>`);
  return c.join("");
}

function topLines(m) {
  const tally = new Map();
  for (const x of m.chat || []) {
    if (x.t < m.t_peak - 12 || x.t > m.t_peak + 10) continue;
    const k = x.text.trim().replace(/\s+/g, " ");
    if (!k) continue;
    tally.set(k, (tally.get(k) || 0) + 1);
  }
  return [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t, n]) => `“${h([...t].length > 28 ? [...t].slice(0, 27).join("") + "…" : t)}”${n > 1 ? ` ×${n}` : ""}`).join(" · ");
}

function momentLi(m, i) {
  const vod = current.vod;
  return `<li class="moment${m.live ? " fresh" : ""}" data-i="${i}">
<div class="mhead"><b>${clock(m.t_start)} – ${clock(m.t_end)}</b><span class="small">${m.live ? "just now" : "#" + (i + 1)}</span></div>
<div class="chips">${chips(m)}</div>
<div class="quote">${topLines(m) || "&nbsp;"}</div>
<div class="actions"><button class="btn sm" data-act="cut">Cut this</button><a class="btn sm ghost" href="${h(m.url)}" target="_blank" rel="noopener">Watch on ${vod.platform === "kick" ? "Kick" : "Twitch"}</a><button class="btn sm ghost" data-act="hide" title="Not a good pick">✕ Skip</button><a class="reqlink" href="/requests">Missing something? Request it</a></div>
<div class="ed"></div></li>`;
}

// One row, or nothing if it is live (listed separately), hidden, or skipped as a spoiler.
function momentRow(m, i) {
  return m.live || m.hidden || (skipSpoilers() && m.spoiler && m.spoiler.spoiler && !m.unskipped) ? "" : momentLi(m, i);
}

function renderMoments() {
  const ol = $("#moments");
  if (!ol) return;
  renderSkipped();
  ol.innerHTML = current.moments.map((m, i) => (m.later ? "" : momentRow(m, i))).join("");
  const ol2 = $("#moments2");
  if (ol2) ol2.innerHTML = current.moments.map((m, i) => (m.later ? momentRow(m, i) : "")).join("");
}

document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]");
  if (!b) return;
  const li = b.closest(".moment");
  const i = li ? Number(li.dataset.i) : -1;
  if (b.dataset.act === "hide") { current.moments[i].hidden = true; ph("moment_skip", { rank: i + 1 }); li.remove(); }
  if (b.dataset.act === "cut") openEditor(i);
});

// ---- editor ---------------------------------------------------------------------------------
async function openEditor(i) {
  const m = current.moments[i];
  const li = document.querySelector(`.moment[data-i="${i}"]`);
  if (!li) return;
  document.querySelectorAll(".moment .ed").forEach((x) => (x.innerHTML = ""));
  if (current.clipper) { current.clipper.destroy(); current.clipper = null; }
  const ed = $(".ed", li);
  const mime = pickMime();
  ph("moment_cut_open", { rank: i + 1, live: !!m.live });
  ed.innerHTML = `<div class="editor">
<div><div class="stage"><canvas></canvas></div><p class="small" id="vstat">Loading video…</p></div>
<div class="ctrls">
<div><label>Layout</label><div class="seg" data-k="layout"><button data-v="split" class="on">Facecam + gameplay</button><button data-v="fit">Full frame, blurred fill</button><button data-v="crop">Centre crop</button></div></div>
<div id="camrow"><label>Where is the facecam?</label><div class="seg" data-k="cam"><button data-v="tl">↖ top left</button><button data-v="tr" class="on">↗ top right</button><button data-v="bl">↙ bottom left</button><button data-v="br">↘ bottom right</button></div>
<label style="margin-top:8px">Facecam size</label><input type="range" min="0.15" max="0.45" step="0.01" value="0.28" data-k="camSize"></div>
<div><label>Pan gameplay</label><input type="range" min="-1" max="1" step="0.05" value="0" data-k="pan"></div>
<div><label>Hook (first thing they read). Edit any line.</label><div class="hooks">${m.hooks.map((t, k) => `<label><input type="radio" name="hk" value="${k}" ${k === 0 ? "checked" : ""}><input type="text" value="${h(t)}" data-hook="${k}"></label>`).join("")}<label><input type="radio" name="hk" value="none"><span>No hook</span></label></div>
<div class="seg" data-k="hookMode" style="margin-top:6px"><button data-v="always" class="on">Hook whole clip</button><button data-v="first">First 3 s only</button></div></div>
<div><label>Chat overlay</label><div class="seg" data-k="chat"><button data-v="1" class="on">On</button><button data-v="0">Off</button></div></div>
<div><label>Clip window</label><div class="range"><button class="btn sm ghost" data-nudge="s-">−5s</button><span id="win">${clock(m.t_start)} – ${clock(m.t_end)}</span><button class="btn sm ghost" data-nudge="e+">+5s</button></div>
<div class="range" style="margin-top:6px"><button class="btn sm ghost" data-nudge="s+">start +5s</button><button class="btn sm ghost" data-nudge="e-">end −5s</button></div></div>
${m.music_risk.level !== "low" ? `<div class="note">Music risk ${m.music_risk.level}: ${h(m.music_risk.why)}.</div>` : ""}
<div class="actions"><button class="btn ghost" id="pv">▶ Preview</button><button class="btn" id="rec" ${mime === null ? "disabled" : ""}>Render 9:16 clip</button></div>
<p class="credit">${creditText()}</p>
${mime === null ? `<p class="note">This browser can’t record video. Open heistclips in Chrome, Edge or Safari on a computer.</p>` : ""}
<div class="dl" id="dl"></div>
<p class="reqlink">Want another layout, captions, or something else? <a href="/requests">Request a feature</a> — we build what clippers ask for.</p>
</div></div>`;
  li.scrollIntoView({ behavior: "smooth", block: "start" });
  const cv = $("canvas", ed);
  const cl = new Clipper(cv);
  current.clipper = cl;
  cl.opts.layout = "split";
  cl.opts.hook = m.hooks[0] || "";
  cl.chat = (m.chat || []).map((x) => ({ t: x.t, text: x.text }));
  const win = { s: m.t_start, e: m.t_end };
  const vstat = $("#vstat", ed);
  const syncCam = () => ($("#camrow", ed).hidden = cl.opts.layout !== "split");
  ed.addEventListener("click", (e) => {
    const b = e.target.closest(".seg button");
    if (b) {
      const k = b.parentElement.dataset.k;
      b.parentElement.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      cl.opts[k] = k === "chat" ? b.dataset.v === "1" : b.dataset.v;
      syncCam(); cl.draw();
    }
    const n = e.target.closest("[data-nudge]");
    if (n) {
      const v = n.dataset.nudge;
      // A still-live VOD keeps growing, so the length read when the page opened is no limit
      // (clamping to it put the end before the start: a 0-byte file, 2026-11-18).
      const maxEnd = current.vod.status === "RECORDING" ? Infinity : current.vod.length || Infinity;
      if (v === "s-") win.s = Math.max(0, win.s - 5);
      if (v === "s+") win.s = Math.max(win.s, Math.min(win.e - 5, win.s + 5));
      if (v === "e+") win.e = Math.max(win.e, Math.min(maxEnd, win.e + 5));
      if (v === "e-") win.e = Math.min(win.e, Math.max(win.s + 5, win.e - 5));
      $("#win", ed).textContent = `${clock(win.s)} – ${clock(win.e)} (${Math.round(win.e - win.s)} s)`;
      cl.seek(win.s);
    }
  });
  ed.addEventListener("input", (e) => {
    const k = e.target.dataset.k;
    if (k) { cl.opts[k] = Number(e.target.value); cl.draw(); }
    const sel = ed.querySelector('input[name="hk"]:checked');
    cl.opts.hook = !sel || sel.value === "none" ? "" : ed.querySelector(`[data-hook="${sel.value}"]`).value;
    cl.draw();
  });
  syncCam();
  const url = playlistPath(current.vod, "chunked");
  try {
    if (current.vod.platform === "kick" && m.live) current.vod.length = (Date.now() - current.vod.start_ms) / 1000;
    await cl.load(url, win.s);
    if (current.vod.status === "RECORDING") current.vod.length = Math.max(current.vod.length || 0, cl.availableEnd());
    vstat.textContent = `${cl.video.videoWidth}×${cl.video.videoHeight} source · renders at 1080×1920`;
  } catch (e) {
    // "chunked" is Twitch's source rendition; fall back to the next sharpest one that loads.
    try {
      if (current.vod.platform === "kick") throw e;
      let ok = false;
      for (const q of ["1080p60", "720p60"]) { try { await cl.load(playlistPath(current.vod, q), win.s); ok = true; break; } catch (e3) {} }
      if (!ok) throw e;
      vstat.textContent = `${cl.video.videoWidth}×${cl.video.videoHeight} source · renders at 1080×1920`;
    }
    catch (e2) { vstat.textContent = "Couldn’t load the video: " + e.message + (m.live ? " (live moments need ~30 s before the video catches up; try again shortly)" : ""); return; }
  }
  $("#pv", ed).onclick = async () => { ph("clip_preview", { layout: cl.opts.layout }); $("#pv", ed).disabled = true; try { await cl.playWindow(win.s, win.e); } finally { $("#pv", ed).disabled = false; } };
  $("#rec", ed).onclick = async () => {
    const btn = $("#rec", ed);
    btn.disabled = true;
    try { cl.ensureAudio(); cl.audio.ac.resume().catch(() => {}); } catch (e) {} // sound starts only inside a click
    const say = (html) => ($("#dl", ed).querySelector(".rnote") || $("#dl", ed).insertAdjacentElement("afterbegin", Object.assign(document.createElement("div"), { className: "note rnote" }))).innerHTML = html;
    const lenNow = Math.round(win.e - win.s);
    if (!(lenNow >= 2)) { btn.disabled = false; say("This clip window is empty. Use the ±5s buttons to set a start before the end."); return; }
    const t = await creditCall("start", {}).catch(() => ({ ok: false, error: "offline" }));
    if (!t.ok) {
      btn.disabled = false;
      if (t.need === "buy") { $("#dl", ed).innerHTML = paywallHTML(); ph("paywall_hit", {}); }
      else say("Couldn’t reach heistclips to check your clips. Check your connection and try again.");
      return;
    }
    ph("clip_render_start", { layout: cl.opts.layout, hook: !!cl.opts.hook, chat: cl.opts.chat, len: lenNow, live: !!m.live, vod_live: current.vod.status === "RECORDING" });
    const old = $("#dl", ed).querySelector(".rnote"); if (old) old.remove();
    try {
      const out = await cl.record(win.s, win.e, (msg, f) => { vstat.textContent = f == null ? msg : `${msg} ${Math.round(f * 100)}%`; });
      const c = await creditCall("commit", { ticket: t.ticket, bytes: out.blob.size, meta: { vod: current.vod.id, t: Math.round(win.s), layout: cl.opts.layout } }).catch(() => ({}));
      const href = URL.createObjectURL(out.blob);
      const name = `${current.vod.channel}-${twitchTime(win.s)}-${cl.opts.layout}.${out.ext}`;
      const mb = out.blob.size / 1e6;
      $("#dl", ed).insertAdjacentHTML("afterbegin", `<div><video src="${href}" controls playsinline></video><a class="btn" href="${href}" download="${h(name)}">Download ${out.ext.toUpperCase()} · 1080×1920 · ${out.fps} fps · ${out.mbps} Mbps (${mb.toFixed(1)} MB)</a><p class="small">Cut from the ${h(out.source)} source.</p>${out.ext === "webm" ? `<p class="small">WebM plays on TikTok and YouTube. For Instagram, Safari or Chrome 126+ export MP4.</p>` : ""}${out.sound ? "" : `<p class="small">No sound came through for this stretch${current.vod.muted && current.vod.muted.some((x) => x.start < out.end && x.end > win.s) ? ": Twitch muted it in the VOD (licensed music)" : ""}.</p>`}</div>`);
      document.dispatchEvent(new CustomEvent("hc:rendered", { detail: { blob: out.blob, ext: out.ext, mount: $("#dl", ed).firstElementChild, caption: cl.opts.hook || "" } }));
      vstat.textContent = "Done. Pick another hook and render again for a second, different post.";
      ph("clip_render_done", { mb: Math.round(mb * 10) / 10, ext: out.ext, fps: out.fps, mbps: out.mbps, source: out.source, charged: !!c.ok, sound: out.sound, vod_live: current.vod.status === "RECORDING" });
    } catch (e) {
      vstat.textContent = "Render failed: " + e.message + ". Nothing was charged.";
      say("Render failed: " + h(e.message) + ". <b>Nothing was charged.</b>");
      ph("clip_render_fail", { err: String(e.message).slice(0, 80), vod_live: current.vod.status === "RECORDING", len: lenNow });
    } finally { btn.disabled = false; }
  };
}

// ---- live -----------------------------------------------------------------------------------
async function startLive(vod) {
  const url = playlistPath(vod, "chunked");
  let rs;
  if (vod.platform === "kick") rs = { start: vod.start_ms };
  else try { rs = await recordingStart(url); } catch (e) { rs = {}; }
  if (!rs.start) { $("#livetxt").textContent = "Live, but couldn’t sync to the recording; moments from chat so far are below."; return; }
  const lc = new LiveChat(vod.channel, {
    vod, recordingStart: rs.start,
    onStatus: (s) => { const el = $("#livetxt"); if (el) el.textContent = s; },
    onRate: (r, base, hist) => {
      const el = $("#livetxt"); if (el) el.textContent = `Watching live chat · ${r.toFixed(1)} msg/s (normal ${base.toFixed(1)}) · a spike over ${(base * 2.5).toFixed(1)} becomes a moment`;
      const cv = $("#livecurve"); if (!cv) return;
      const ctx = cv.getContext("2d"), W = cv.width, H = cv.height, max = Math.max(1, ...hist, base * 3);
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = "#555"; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(0, H - 4 - base * 2.5 / max * (H - 10)); ctx.lineTo(W, H - 4 - base * 2.5 / max * (H - 10)); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = "#ff4d5e"; ctx.lineWidth = 1.5; ctx.beginPath();
      hist.forEach((v, i) => { const x = W - (hist.length - 1 - i) * (W / 600), y = H - 4 - (v / max) * (H - 10); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.stroke();
    },
    onMoment: (m) => {
      m.spoiler = spoilerCheck(vod, m);
      current.moments.push(m);
      let ol = $("#livemoments");
      if (!ol) { $("#moments").insertAdjacentHTML("beforebegin", `<h3>Live moments</h3><ol class="moments" id="livemoments"></ol><h3>Earlier in this stream</h3>`); ol = $("#livemoments"); }
      ol.insertAdjacentHTML("afterbegin", momentLi(m, current.moments.length - 1));
      document.title = "● New moment – heistclips";
      ph("live_moment", { ratio: m.chat_ratio });
    },
  });
  lc.start();
  current.live = lc;
}

// ---- boot -----------------------------------------------------------------------------------
(async () => {
  loadCredits();
  const paid = params.get("paid");
  if (paid) {
    const d = await claimPurchase(paid);
    app.insertAdjacentHTML("beforebegin", d.key ? `<div class="note">Payment received: ${d.paid_left} clips added. They’re saved in this browser.</div>` : `<div class="note">We couldn’t confirm that payment yet (${h(d.error || "")}). Refresh in a minute; if it persists email aidan@brickandmortar.dev.</div>`);
    ph("purchase_claimed", { ok: !!d.key });
  }
  const q = app.dataset.q || params.get("q");
  if (q) return start(q);
  // "Clip the top live GTA stream now": one tap from a guide or campaign page.
  if (params.get("top")) {
    say(`<div class="status">Finding the biggest live GTA stream…</div>`);
    const top = await topLive().catch(() => null);
    if (!top) return dead("no_live", `Nobody is live in GTA with a saved stream this minute.`);
    ph("clip_top_live", { viewers: top.viewers });
    try { history.replaceState(null, "", location.pathname + "?q=" + encodeURIComponent(top.login)); const inp = document.querySelector(".paste input[name=q]"); if (inp) inp.value = top.login; } catch (e) {}
    start(top.login);
  }
})();
