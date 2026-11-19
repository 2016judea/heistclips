// The clip tool: paste -> moments (with why) -> cut -> download.
import { parseInput, getChannel, getVod, findMoments, playlistPath, clock, twitchTime, searchChannels, getClip, refinePeak, hooks } from "./twitch.js";
import { Clipper, pickMime, camPreset, clampBox, CAM_DEFAULT } from "./render.js?v=15";
import { FX } from "./fx.js?v=3";
import { LiveChat, recordingStart } from "./live.js";
import { getKickChannel, getKickVod } from "./kick.js";
import { paywallHTML } from "./paywall.js";
import { markSpoilers, spoilerCheck } from "./spoilers.js";
import "./post.js?v=1"; // Post to YouTube / TikTok buttons; listens for hc:rendered
import { fillHot, topLive } from "./hot.js";
import { queueHandoff } from "./queuehand.js";
import { serverCut, SERVER_MAX_S } from "./servercut.js?v=1";

const $ = (s, el = document) => el.querySelector(s);
const h = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const app = $("#app");
const params = new URLSearchParams(location.search);
// Analytics (ANALYTICS.md lists every event). Each one carries the page language, how the visitor
// arrived (src=mcp|queue|for…, else "direct") and, once a stream is open, which stream. No chat
// text, no names of people, nothing typed into a field.
const lang = (document.documentElement.lang || "en").slice(0, 2);
let ENTRY = params.get("src");
try { if (ENTRY) sessionStorage.setItem("hc_entry", ENTRY); else ENTRY = sessionStorage.getItem("hc_entry"); } catch (e) {}
ENTRY = String(ENTRY || "direct").replace(/[^a-z0-9_-]/gi, "").slice(0, 20) || "direct";
const phBase = () => {
  let v = null; try { v = current.vod; } catch (e) {}
  return { lang, entry: ENTRY, ...(v ? { platform: v.platform || "twitch", channel: v.channel, vod_id: String(v.id), is_live: v.status === "RECORDING" } : {}) };
};
const ph = (ev, props, opt) => {
  try { window.posthog && window.posthog.capture(ev, { ...phBase(), ...props }, opt); } catch (e) {}
  try { window.va && window.va("event", { name: ev, data: props }); } catch (e) {}
};
const phId = () => { try { return (window.posthog && window.posthog.get_distinct_id && window.posthog.get_distinct_id()) || ""; } catch (e) { return ""; } };
// First touch, kept on every later event of this browser and on the person: where they came from.
try {
  const once = {};
  if (params.get("src")) once.first_src = ENTRY;
  const us = params.get("utm_source"); if (us) once.first_utm_source = us.replace(/[^\w.-]/g, "").slice(0, 40);
  if (document.referrer && !document.referrer.includes(location.host)) once.first_referrer_host = new URL(document.referrer).host.slice(0, 60);
  if (!once.first_src && !once.first_utm_source && !once.first_referrer_host) once.first_src = "direct";
  if (window.posthog) { window.posthog.register_once(once); if (params.get("src") || us) window.posthog.setPersonProperties(undefined, once); }
} catch (e) {}
// A short, stable code for a failure, so failures can be counted without reading messages.
const errCode = (msg) => { const x = String(msg || "");
  return /refused part/.test(x) ? "cdn_refused" : /stopped arriving from/.test(x) ? "no_data" : /part-way/.test(x) ? "record_stall" : /blocked the sound/.test(x) ? "audio_blocked"
    : /came out empty|window is empty/.test(x) ? "empty" : /encoder/.test(x) ? "encoder" : /abort|interrupt/i.test(x) ? "play_aborted" : /isn't in/.test(x) ? "not_in_video" : /cannot record/.test(x) ? "no_recorder"
    : /No clips left|free clips/.test(x) ? "no_credit" : /server|Cut failed|cut failed/.test(x) ? "server_cut" : /fetch|network|Load failed/i.test(x) ? "network" : "other"; };

// ---- who renders where ------------------------------------------------------------------
// iPhone and iPad Safari record a SILENT file: Web Audio hears nothing from a streamed video
// there (measured in real Mobile Safari, iOS 27 simulator, 2026-11-19: oscillator peak 1.0, the
// stream's audio 0.0, by hls.js and by native HLS). And phones finish 42% of the renders they
// start (Android Chrome 20 of 48, iOS Safari 0 of 5, 11/16-11/19) against 80%+ on a computer.
// So a phone gets the clip cut on our server (the connector's cutter, /api/v1/cut): about a
// minute, with sound. Android can still choose to render on the phone.
const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const PHONE = !!(window.matchMedia && matchMedia("(pointer: coarse)").matches) && Math.min(innerWidth, (window.screen && screen.width) || innerWidth) < 700;
const LOCAL_MAX_S = 180, MIN_S = 5;
// Bitrate: the default lands near 12 Mbps (YouTube's own figure for a 1080p60 upload; TikTok and
// Shorts re-encode anyway), "Max" near 20. A recorder is asked for target / ratio, where ratio is
// what this browser actually wrote per bit asked last time (Chrome on a Mac writes about 2x at
// 60 fps, Windows about 1x), so it corrects itself after one render.
const TARGET_BPS = { std: 12e6, max: 20e6 };
const brKey = (fps) => "hc_brr" + (fps >= 45 ? 60 : 30);
function bitrateAsk(q, fps) {
  let r = Number(store.get(brKey(fps)));
  if (!(r > 0)) r = /Mac/.test(navigator.platform || "") && /Chrome\//.test(navigator.userAgent) && fps >= 45 ? 2 : 1;
  return Math.round(TARGET_BPS[q] / Math.max(0.5, Math.min(4, r)));
}
const parseClock = (v) => { const x = String(v).trim(); if (/^\d+(\.\d+)?$/.test(x)) return Number(x); const m = x.match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})$/); return m ? Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) : NaN; };
if (!document.getElementById("edcss")) document.head.insertAdjacentHTML("beforeend", `<style id="edcss">
.moment{scroll-margin-top:72px}
.go{display:flex;flex-direction:column;gap:8px}
.go .actions{margin:0}.go #rec{flex:1;min-height:52px;font-size:17px}
.opts{border:0;padding:0;margin:0;min-width:0;display:flex;flex-direction:column;gap:12px}
.opts[disabled]{opacity:.45}
details.more{border:1px solid var(--line);border-radius:12px;padding:10px 12px}
details.more>summary{cursor:pointer;font-size:14px;font-weight:600}
details.more[open]>summary{margin-bottom:10px}
.tl{position:relative;height:56px;border-radius:10px;background:#1c1c24;border:1px solid var(--line);overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none}
.tl canvas{width:100%;height:100%;display:block}
.tl-sel{position:absolute;top:0;bottom:0;background:rgba(200,255,61,.16);border-left:3px solid #c8ff3d;border-right:3px solid #c8ff3d;cursor:grab;touch-action:none}
.tl-h{position:absolute;top:0;bottom:0;width:28px;cursor:ew-resize;touch-action:none}
.tl-h[data-h=s]{left:-15px}.tl-h[data-h=e]{right:-15px}
.tl-h::after{content:"";position:absolute;left:50%;top:50%;width:6px;height:26px;margin:-13px 0 0 -3px;border-radius:3px;background:#c8ff3d}
.tin{width:92px;min-height:40px;text-align:center;font-size:16px;font-variant-numeric:tabular-nums;background:#141418;color:inherit;border:1px solid var(--line);border-radius:8px}
.nudge{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:6px}
.nudge span{font-size:13px;color:var(--mute);width:38px}
.nudge button{min-width:46px;min-height:40px;padding:0 8px;touch-action:manipulation}
#est{margin:0}
@media (max-width:720px){.stage{max-width:210px;margin:0 auto}}
</style>`);


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

// Two names within two keystrokes of each other ("ischowspeed" / "ishowspeed").
function near(a, b) {
  if (Math.abs(a.length - b.length) > 2) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length] <= 2;
}

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
    : `That isn’t a Twitch or Kick channel or video. Paste a link like these: <b>twitch.tv/kaicenat</b> · <b>kick.com/adinross</b> · <b>twitch.tv/videos/…</b>`);
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
          const hit = (await searchChannels(inp.text || inp.login)).find((x) => x.login !== chan.login && x.followers >= 50000 && near(x.login, chan.login));
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
  // Facecam choices are remembered per channel; layout, hook mode, chat and quality for everyone.
  const camKey = `hc_cam:${current.vod.platform || "twitch"}:${current.vod.channel}`;
  let camSaved = null; try { camSaved = JSON.parse(store.get(camKey) || "null"); } catch (e) {}
  let pref = {}; try { pref = JSON.parse(store.get("hc_ed") || "{}") || {}; } catch (e) {}
  const canLocal = mime !== null && !IOS;
  let serverMode = mime === null || IOS || (PHONE && pref.phoneLocal !== true);
  const win = { s: m.t_start, e: m.t_end };
  const mprops = () => ({ t_start: Math.round(win.s), clip_secs: Math.round(win.e - win.s) });
  ph("moment_cut_open", { rank: i + 1, live: !!m.live, ...mprops(), server_mode: serverMode });
  ed.innerHTML = `<div class="editor">
<div><div class="stage"><canvas></canvas></div><p class="small" id="vstat">Loading video…</p></div>
<div class="ctrls">
<div class="go">
<div class="actions"><button class="btn" id="rec" ${mime === null && !serverMode ? "disabled" : ""}>Render 9:16 clip</button><button class="btn ghost" id="pv">▶ Preview</button></div>
<p class="small" id="est"></p>
<p class="small" id="srvnote" hidden></p>
<p class="credit">${creditText()}</p>
${m.music_risk.level !== "low" ? `<div class="note">Music risk ${m.music_risk.level}: ${h(m.music_risk.why)}.</div>` : ""}
<div class="dl" id="dl"></div>
</div>
<fieldset class="opts" id="opts">
<div><label>Hook (first thing they read). Edit any line.</label><div class="hooks">${m.hooks.map((t, k) => `<label><input type="radio" name="hk" value="${k}" ${k === 0 ? "checked" : ""}><input type="text" value="${h(t)}" data-hook="${k}"></label>`).join("")}<label><input type="radio" name="hk" value="none"><span>No hook</span></label></div>
<div class="seg" data-k="hookMode" style="margin-top:6px"><button data-v="always">Hook whole clip</button><button data-v="first">First 3 s only</button></div></div>
<div><label>Clip window</label>
<div class="tl" id="tl"><canvas width="640" height="56"></canvas><div class="tl-sel" id="tlsel"><i class="tl-h" data-h="s"></i><i class="tl-h" data-h="e"></i></div></div>
<div class="range" style="margin-top:8px"><input class="tin" id="tis" inputmode="numeric" autocomplete="off" aria-label="Clip start"><span>–</span><input class="tin" id="tie" inputmode="numeric" autocomplete="off" aria-label="Clip end"><b id="win"></b></div>
<div class="nudge"><span>Start</span>${[-15, -5, -1, 1, 5, 15].map((d) => `<button type="button" class="btn sm ghost" data-nudge="s" data-d="${d}">${d > 0 ? "+" : "−"}${Math.abs(d)}s</button>`).join("")}</div>
<div class="nudge"><span>End</span>${[-15, -5, -1, 1, 5, 15].map((d) => `<button type="button" class="btn sm ghost" data-nudge="e" data-d="${d}">${d > 0 ? "+" : "−"}${Math.abs(d)}s</button>`).join("")}</div></div>
<div><label>Layout</label><div class="seg" data-k="layout"><button data-v="split">Facecam + gameplay</button><button data-v="fit">Full frame, blurred fill</button><button data-v="crop">Centre crop</button></div></div>
<div id="chatrow"><label>Chat overlay</label><div class="seg" data-k="chat"><button data-v="1">On</button><button data-v="0">Off</button></div></div>
<details id="camrow" class="more" ${camSaved ? "" : "open"}><summary>Facecam: position, style, effects</summary><label>Where is the facecam in the stream? Drag the box onto it; drag the dot to resize.</label>
<div class="campick"><canvas width="320" height="180"></canvas><div class="cambox" id="cambox"><i class="camgrip"></i></div></div>
<div class="seg camquick" data-k="campreset"><button data-v="tl" title="top left">↖</button><button data-v="ml" title="middle left">←</button><button data-v="bl" title="bottom left">↙</button><button data-v="tr" title="top right">↗</button><button data-v="mr" title="middle right">→</button><button data-v="br" title="bottom right">↘</button></div>
<label style="margin-top:10px">Put the facecam</label><div class="seg" data-k="camOut"><button data-v="top">On top</button><button data-v="bottom">At the bottom</button></div>
<label style="margin-top:10px">Facecam style</label><div class="seg" data-k="camStyle"><button data-v="split">Panel</button><button data-v="rounded">Rounded box</button><button data-v="circle">Circle</button></div>
<div class="seg" data-k="punch" style="margin-top:6px"><button data-v="0">No zoom</button><button data-v="1">Punch-in on the loudest second</button></div>
<label style="margin-top:10px">Funny facecam</label><div class="seg" data-k="camFx"><button data-v="none">Off</button><button data-v="bighead">Big head</button><button data-v="fisheye">Fisheye</button><button data-v="shake">Shake when loud</button><button data-v="fried">Deep fried</button><button data-v="wobble">Jelly</button></div>
<p class="small" id="fxhint" hidden>Big head and Fisheye blow up the middle of the box. Drag the box so the face is in the middle.</p></details>
<details class="more" id="morerow"><summary>More: pan, quality</summary>
<div><label>Pan gameplay</label><input type="range" min="-1" max="1" step="0.05" value="0" data-k="pan"></div>
<div id="qualrow" style="margin-top:10px"><label>Quality</label><div class="seg" data-k="quality"><button data-v="std">Standard · about 12 Mbps</button><button data-v="max">Max · about 20 Mbps</button></div></div>
</details>
</fieldset>
<p class="reqlink">Want another layout, captions, or something else? <a href="/requests">Request a feature</a> — we build what clippers ask for.</p>
</div></div>`;
  li.scrollIntoView({ behavior: "smooth", block: "start" });
  const cv = $("canvas", ed);
  const cl = new Clipper(cv);
  current.clipper = cl;
  cl.opts.layout = ["split", "fit", "crop"].includes(pref.layout) ? pref.layout : "split";
  cl.opts.hookMode = pref.hookMode === "first" ? "first" : "always";
  cl.opts.chat = pref.chat !== false;
  cl.opts.quality = pref.quality === "max" ? "max" : "std";
  cl.opts.hook = pref.hook === "none" ? "" : m.hooks[0] || "";
  if (pref.hook === "none") ed.querySelector('input[name="hk"][value="none"]').checked = true;
  const savePref = () => { const sel = ed.querySelector('input[name="hk"]:checked'); pref = { ...pref, layout: cl.opts.layout, hookMode: cl.opts.hookMode, chat: !!cl.opts.chat, quality: cl.opts.quality, hook: sel && sel.value === "none" ? "none" : "on" }; store.set("hc_ed", JSON.stringify(pref)); };
  cl.chat = (m.chat || []).map((x) => ({ t: x.t, text: x.text }));
  const vstat = $("#vstat", ed);
  try { const saved = camSaved; if (saved && saved.cam) Object.assign(cl.opts, { cam: clampBox(saved.cam), camOut: saved.camOut || "top", camStyle: saved.camStyle || "split", punch: !!saved.punch, camFx: FX.includes(saved.camFx) ? saved.camFx : "none" }); } catch (e) {}
  cl.opts.punchFallback = m.t_peak;
  const saveCam = () => store.set(camKey, JSON.stringify({ cam: cl.opts.cam, camOut: cl.opts.camOut, camStyle: cl.opts.camStyle, punch: cl.opts.punch, camFx: cl.opts.camFx }));
  const segOn = (k, v) => ed.querySelectorAll(`.seg[data-k="${k}"] button`).forEach((x) => x.classList.toggle("on", x.dataset.v === v));
  const syncSegs = () => { segOn("camOut", cl.opts.camOut); segOn("camStyle", cl.opts.camStyle); segOn("punch", cl.opts.punch ? "1" : "0"); segOn("camFx", cl.opts.camFx); segOn("layout", cl.opts.layout); segOn("hookMode", cl.opts.hookMode); segOn("chat", cl.opts.chat ? "1" : "0"); segOn("quality", cl.opts.quality); };
  const pick = $(".campick", ed), pcv = $("canvas", pick), pctx = pcv.getContext("2d"), box = $("#cambox", ed);
  const placeBox = () => { const b = cl.opts.cam; Object.assign(box.style, { left: b.x * 100 + "%", top: b.y * 100 + "%", width: b.w * 100 + "%", height: b.h * 100 + "%" }); };
  let lastThumb = 0;
  cl.onDraw = () => { const now = performance.now(); if (now - lastThumb < 120 || !cl.video.videoWidth) return; lastThumb = now; pctx.drawImage(cl.video, 0, 0, pcv.width, pcv.height); };
  let drag = null;
  box.addEventListener("pointerdown", (e) => {
    e.preventDefault(); box.setPointerCapture(e.pointerId);
    drag = { mode: e.target.classList.contains("camgrip") ? "size" : "move", x: e.clientX, y: e.clientY, b: { ...cl.opts.cam } };
  });
  box.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const r = pick.getBoundingClientRect(), dx = (e.clientX - drag.x) / r.width, dy = (e.clientY - drag.y) / r.height;
    cl.opts.cam = clampBox(drag.mode === "move" ? { ...drag.b, x: drag.b.x + dx, y: drag.b.y + dy } : { ...drag.b, w: drag.b.w + dx, h: drag.b.h + dy });
    placeBox(); cl.draw();
  });
  const endDrag = () => { if (drag) { drag = null; saveCam(); ph("facecam_box", { w: Math.round(cl.opts.cam.w * 100), h: Math.round(cl.opts.cam.h * 100) }); } };
  box.addEventListener("pointerup", endDrag); box.addEventListener("pointercancel", endDrag);
  const syncCam = () => { $("#camrow", ed).hidden = cl.opts.layout !== "split" || serverMode; $("#fxhint", ed).hidden = !(cl.opts.camFx === "bighead" || cl.opts.camFx === "fisheye"); };
  ed.addEventListener("click", (e) => {
    const b = e.target.closest(".seg button");
    if (b) {
      const k = b.parentElement.dataset.k;
      if (k === "campreset") { cl.opts.cam = camPreset(b.dataset.v, cl.opts.cam || CAM_DEFAULT); placeBox(); saveCam(); cl.draw(); ph("facecam_preset", { p: b.dataset.v }); return; }
      b.parentElement.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      cl.opts[k] = k === "chat" || k === "punch" ? b.dataset.v === "1" : b.dataset.v;
      if (k === "camOut" || k === "camStyle" || k === "punch" || k === "camFx") { saveCam(); ph("facecam_" + k, { v: b.dataset.v }); }
      if (k === "layout" || k === "hookMode" || k === "chat" || k === "quality") { savePref(); ph("editor_option", { k, v: b.dataset.v }); }
      syncCam(); cl.draw(); cl.fxPreview(); showEst();
    }
  });
  // Clip window (rage clicks 11/16-11/19: about 180 of 309 were on the old ±5 s buttons, people
  // hammering them to move a long way). Now: drag either edge or the whole window on a strip that
  // shows chat speed around the moment, type a time, or step 1, 5 or 15 s; a held button repeats.
  const tl = $("#tl", ed), tlc = $("canvas", tl), sel = $("#tlsel", ed), tis = $("#tis", ed), tie = $("#tie", ed);
  const maxLen = () => (serverMode ? SERVER_MAX_S : LOCAL_MAX_S);
  // A still-live VOD keeps growing, so the length read when the page opened is no limit
  // (clamping to it put the end before the start: a 0-byte file, 2026-11-18).
  const maxEnd = () => (current.vod.status === "RECORDING" ? Infinity : current.vod.length || Infinity);
  let span = null, seekT = 0;
  const reSpan = () => { const pad = Math.max(45, (win.e - win.s) * 0.9); const a = Math.max(0, win.s - pad); span = { a, b: Math.min(maxEnd(), Math.max(win.e + pad, a + 60)) }; drawStrip(); };
  function drawStrip() {
    const c = tlc.getContext("2d"), W2 = tlc.width, H2 = tlc.height, n = 80, bins = new Array(n).fill(0);
    for (const x of m.chat || []) { const k = Math.floor(((x.t - span.a) / (span.b - span.a)) * n); if (k >= 0 && k < n) bins[k]++; }
    const mx = Math.max(1, ...bins);
    c.clearRect(0, 0, W2, H2); c.fillStyle = "#3a3a44";
    bins.forEach((v, k) => { const hh = Math.max(2, (v / mx) * (H2 - 8)); c.fillRect((k / n) * W2 + 1, H2 - hh, W2 / n - 2, hh); });
    if (m.t_peak >= span.a && m.t_peak <= span.b) { c.fillStyle = "#ff4d5e"; c.fillRect(((m.t_peak - span.a) / (span.b - span.a)) * W2 - 1, 0, 2, H2); }
  }
  const showEst = () => {
    const secs = Math.round(win.e - win.s), el = $("#est", ed);
    if (el) el.textContent = serverMode ? `${secs} s clip · 1080×1920 · 30 fps · about ${Math.max(1, Math.round(secs * 0.75))} MB` : `${secs} s clip · 1080×1920 · about ${Math.round((secs * (TARGET_BPS[cl.opts.quality] + 192000)) / 8e6)} MB`;
  };
  function setWin(ns, ne, moved) {
    ns = Math.round(ns); ne = Math.round(ne);
    if (moved === "s") ns = Math.max(0, Math.min(ns, ne - MIN_S)); else if (moved === "e") ne = Math.min(maxEnd(), Math.max(ne, ns + MIN_S));
    else { const len = ne - ns; ns = Math.max(0, Math.min(ns, maxEnd() - len)); ne = ns + len; }
    if (ne - ns > maxLen()) { if (moved === "s") ns = ne - maxLen(); else ne = ns + maxLen(); }
    if (ns === win.s && ne === win.e) return paintWin();
    const edge = moved === "e" && ne !== win.e ? "e" : "s";
    win.s = ns; win.e = ne;
    if (win.s < span.a || win.e > span.b) reSpan();
    paintWin();
    cl.punchWin = null;
    // show the frame at the edge that moved; one seek after the last change, not one per step
    clearTimeout(seekT); seekT = setTimeout(() => { cl.clipStart = win.s; cl.seek(edge === "e" ? Math.max(win.s, win.e - 0.2) : win.s); }, 140);
  }
  function paintWin() {
    const f = (t) => ((t - span.a) / (span.b - span.a)) * 100;
    sel.style.left = f(win.s) + "%"; sel.style.width = f(win.e) - f(win.s) + "%";
    if (document.activeElement !== tis) tis.value = clock(win.s);
    if (document.activeElement !== tie) tie.value = clock(win.e);
    $("#win", ed).textContent = `${Math.round(win.e - win.s)} s`;
    showEst();
  }
  let tdrag = null;
  tl.addEventListener("pointerdown", (e) => {
    if (opts.disabled) return;
    const hd = e.target.closest(".tl-h"), inSel = e.target.closest(".tl-sel");
    const r = tl.getBoundingClientRect(), at = span.a + ((e.clientX - r.left) / r.width) * (span.b - span.a);
    // a tap outside the window moves the nearer edge there
    const mode = hd ? hd.dataset.h : inSel ? "move" : Math.abs(at - win.s) < Math.abs(at - win.e) ? "s" : "e";
    if (!hd && !inSel) setWin(mode === "s" ? at : win.s, mode === "e" ? at : win.e, mode);
    tdrag = { mode, x: e.clientX, s: win.s, e: win.e, w: r.width };
    try { tl.setPointerCapture(e.pointerId); } catch (x) {}
    e.preventDefault();
  });
  tl.addEventListener("pointermove", (e) => {
    if (!tdrag) return;
    const dt = ((e.clientX - tdrag.x) / tdrag.w) * (span.b - span.a);
    if (tdrag.mode === "s") setWin(tdrag.s + dt, win.e, "s"); else if (tdrag.mode === "e") setWin(win.s, tdrag.e + dt, "e"); else setWin(tdrag.s + dt, tdrag.e + dt, "move");
  });
  const tEnd = () => { if (tdrag) { ph("clip_window", { how: "drag_" + tdrag.mode, ...mprops() }); tdrag = null; reSpan(); paintWin(); } };
  tl.addEventListener("pointerup", tEnd); tl.addEventListener("pointercancel", tEnd);
  for (const [inp, which] of [[tis, "s"], [tie, "e"]]) {
    const take = () => { const v = parseClock(inp.value); if (isFinite(v)) { setWin(which === "s" ? v : win.s, which === "e" ? v : win.e, which); ph("clip_window", { how: "typed_" + which, ...mprops() }); } inp.value = clock(which === "s" ? win.s : win.e); };
    inp.addEventListener("change", take);
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); inp.blur(); } });
  }
  // One step per press, at once; hold to repeat. A press is never lost to a busy editor: while a
  // render runs the whole option block is disabled and looks it.
  let rep = null, lastPress = 0;
  const step = (b) => { const d = Number(b.dataset.d); if (b.dataset.nudge === "s") setWin(win.s + d, win.e, "s"); else setWin(win.s, win.e + d, "e"); };
  const stopRep = (e) => { if (rep) { clearTimeout(rep.t); clearInterval(rep.i); ph("clip_window", { how: "step", d: Number(rep.b.dataset.d), edge: rep.b.dataset.nudge, presses: rep.n, ...mprops() }); rep = null; } };
  ed.addEventListener("pointerdown", (e) => {
    const b = e.target.closest("[data-nudge]"); if (!b || b.disabled || opts.disabled) return;
    lastPress = Date.now(); stopRep(); step(b);
    rep = { b, n: 1, t: setTimeout(() => { rep.i = setInterval(() => { step(b); rep.n++; }, 110); }, 380) };
  });
  for (const ev of ["pointerup", "pointercancel", "pointerleave"]) ed.addEventListener(ev, stopRep, true);
  ed.addEventListener("click", (e) => { // keyboard and assistive presses arrive as a click with no pointer
    const b = e.target.closest("[data-nudge]"); if (!b || Date.now() - lastPress < 600) return;
    step(b);
  });
  // Editing a hook line selects it. It used to leave the old line selected, so the preview did
  // not change and people clicked the field again and again (45 rage clicks on these inputs).
  ed.addEventListener("focusin", (e) => { const k = e.target.dataset && e.target.dataset.hook; if (k == null) return; const r = ed.querySelector(`input[name="hk"][value="${k}"]`); if (r && !r.checked) { r.checked = true; r.dispatchEvent(new Event("input", { bubbles: true })); } });
  ed.addEventListener("change", (e) => { if (e.target.name === "hk") { savePref(); ph("editor_option", { k: "hook", v: e.target.value === "none" ? "none" : "line" + e.target.value }); } });
  ed.addEventListener("input", (e) => {
    const k = e.target.dataset.k;
    if (k) { cl.opts[k] = Number(e.target.value); cl.draw(); }
    const sel = ed.querySelector('input[name="hk"]:checked');
    cl.opts.hook = !sel || sel.value === "none" ? "" : ed.querySelector(`[data-hook="${sel.value}"]`).value;
    cl.draw();
  });
  const opts = $("#opts", ed);
  // Phone / no recorder: the server cuts it. It has no chat overlay, facecam styles or pan, so
  // those rows go, and the preview shows what the server will make.
  function applyMode() {
    const note = $("#srvnote", ed);
    for (const id of ["chatrow", "morerow"]) { const el = ed.querySelector("#" + id); if (el) el.hidden = serverMode; }
    const hm = ed.querySelector('.seg[data-k="hookMode"]'); if (hm) hm.style.display = serverMode ? "none" : ""; // .seg is display:flex, which beats [hidden]
    if (serverMode) {
      Object.assign(cl.opts, { chat: false, camOut: "top", camStyle: "split", punch: false, camFx: "none", pan: 0, hookMode: "always" });
      const c = cl.opts.cam || CAM_DEFAULT, corner = (c.y + c.h / 2 < 0.5 ? "t" : "b") + (c.x + c.w / 2 < 0.5 ? "l" : "r");
      cl.opts.cam = camPreset(corner, { w: 0.28, h: 0.35 }); cl.srvCorner = corner;
      note.hidden = false;
      note.innerHTML = `On a phone your clip is cut on our server: about a minute, with sound.` + (canLocal ? ` <button type="button" class="linkbtn" id="uselocal">Render on this phone instead</button>` : "");
      if (win.e - win.s > SERVER_MAX_S) setWin(win.s, win.s + SERVER_MAX_S, "e");
    } else if (PHONE && canLocal) { note.hidden = false; note.innerHTML = `Rendering on this phone: keep this tab open and the screen on. <button type="button" class="linkbtn" id="useserver">Cut it on our server instead</button>`; }
    else note.hidden = true;
    const corners = ed.querySelector('.seg[data-k="srvcam"]');
    if (serverMode && !corners) $("#chatrow", ed).insertAdjacentHTML("afterend", `<div id="srvcamrow"><label>Which corner is the facecam in?</label><div class="seg" data-k="srvcam"><button data-v="tl">↖</button><button data-v="tr">↗</button><button data-v="bl">↙</button><button data-v="br">↘</button></div></div>`);
    const row = ed.querySelector("#srvcamrow"); if (row) { row.hidden = !serverMode || cl.opts.layout !== "split"; segOn("srvcam", cl.srvCorner || "tr"); }
    syncCam(); syncSegs(); showEst(); cl.draw();
  }
  ed.addEventListener("click", (e) => {
    if (e.target.id === "uselocal" || e.target.id === "useserver") { serverMode = e.target.id === "useserver"; pref.phoneLocal = !serverMode; savePref(); ph("render_mode", { server: serverMode }); if (!serverMode && camSaved && camSaved.cam) cl.opts.cam = clampBox(camSaved.cam); applyMode(); placeBox(); }
    const c = e.target.closest('.seg[data-k="srvcam"] button');
    if (c) { cl.srvCorner = c.dataset.v; cl.opts.cam = camPreset(c.dataset.v, { w: 0.28, h: 0.35 }); cl.opts.srvcam = undefined; segOn("srvcam", c.dataset.v); saveCam(); cl.draw(); }
    if (e.target.closest('.seg[data-k="layout"] button')) { const row = ed.querySelector("#srvcamrow"); if (row) row.hidden = !serverMode || cl.opts.layout !== "split"; }
  });
  reSpan(); paintWin();
  syncCam(); syncSegs(); placeBox(); cl.fxPreview(); applyMode();
  // On a slow connection the first picture can arrive after load() returns: say so, not "0×0".
  const showSource = () => {
    if (cl.video.videoWidth) { delete vstat.dataset.wait; vstat.textContent = `${cl.video.videoWidth}×${cl.video.videoHeight} source · renders at 1080×1920`; return; }
    vstat.dataset.wait = "1"; vstat.textContent = "Loading video… (slow connection)";
    cl.video.addEventListener("loadeddata", () => { if (vstat.dataset.wait) { showSource(); cl.draw(); } }, { once: true });
  };
  const url = playlistPath(current.vod, "chunked");
  try {
    if (current.vod.platform === "kick" && m.live) current.vod.length = (Date.now() - current.vod.start_ms) / 1000;
    await cl.load(url, win.s);
    if (current.vod.status === "RECORDING") current.vod.length = Math.max(current.vod.length || 0, cl.availableEnd());
    showSource();
  } catch (e) {
    // "chunked" is Twitch's source rendition; fall back to the next sharpest one that loads.
    try {
      if (current.vod.platform === "kick") throw e;
      let ok = false;
      for (const q of ["1080p60", "720p60"]) { try { await cl.load(playlistPath(current.vod, q), win.s); ok = true; break; } catch (e3) {} }
      if (!ok) throw e;
      showSource();
    }
    catch (e2) { vstat.textContent = "Couldn’t load the video: " + e.message + (m.live ? " (live moments need ~30 s before the video catches up; try again shortly)" : ""); return; }
  }
  $("#pv", ed).onclick = async () => { ph("clip_preview", { layout: cl.opts.layout }); $("#pv", ed).disabled = true; try { await cl.playWindow(win.s, win.e); } finally { $("#pv", ed).disabled = false; } };
  // ---- render ---------------------------------------------------------------------------
  const say = (html) => ($("#dl", ed).querySelector(".rnote") || $("#dl", ed).insertAdjacentElement("afterbegin", Object.assign(document.createElement("div"), { className: "note rnote" }))).innerHTML = html;
  const showPaywall = () => { $("#dl", ed).innerHTML = paywallHTML(); ph("paywall_hit", {}); ph("paywall_shown", { free_left: 0, paid_left: credits.paid_left || 0, where: "render" }); };
  // What the visitor gets, however it was made: a player, a download, and on a phone the share
  // sheet (the way a clip reaches Photos, TikTok or Shorts there).
  function showClip({ blob, url, ext, fps, mbps, source, sound, end, server }) {
    const href = blob ? URL.createObjectURL(blob) : url;
    const name = `${current.vod.channel}-${twitchTime(win.s)}-${cl.opts.layout}.${ext}`;
    const mb = blob ? blob.size / 1e6 : 0;
    let file = null;
    try { if (blob && typeof File !== "undefined" && navigator.canShare) { const f = new File([blob], name, { type: blob.type || "video/mp4" }); if (navigator.canShare({ files: [f] })) file = f; } } catch (e) {}
    const muted = current.vod.muted && current.vod.muted.some((x) => x.start < end && x.end > win.s);
    $("#dl", ed).insertAdjacentHTML("afterbegin", `<div><video src="${href}#t=0.1" preload="metadata" controls playsinline></video><a class="btn" data-dl href="${href}" download="${h(name)}">Download ${ext.toUpperCase()} · 1080×1920 · ${fps} fps${mbps ? ` · ${mbps} Mbps` : ""}${mb ? ` (${mb.toFixed(1)} MB)` : ""}</a>${file ? `<button type="button" class="btn ghost" data-share>Save or share</button>` : ""}<p class="small">${server ? "Cut on our server from" : "Cut from"} the ${h(source)} source.</p>${!server && cl.opts.layout === "split" && cl.opts.camFx !== "none" && fps > 33 && fps < 55 ? `<p class="small">This one came out at ${fps} fps, not 60: the computer was busy while it recorded. Render it again, or turn the funny facecam off for a smooth 60.</p>` : ""}${ext === "webm" ? `<p class="small">WebM plays on TikTok and YouTube. For Instagram, Safari or Chrome 126+ export MP4.</p>` : ""}${sound !== false ? "" : `<p class="small">No sound came through for this stretch${muted ? ": Twitch muted it in the VOD (licensed music)" : ""}.</p>`}</div>`);
    const mount = $("#dl", ed).firstElementChild;
    mount.querySelector("[data-dl]").addEventListener("click", () => ph("clip_download", { ...mprops(), ext, mb: Math.round(mb * 10) / 10, path: server ? "browser_server" : "browser" }));
    const sh = mount.querySelector("[data-share]");
    if (sh) sh.addEventListener("click", async () => { ph("clip_share", { ...mprops(), path: server ? "browser_server" : "browser" }); try { await navigator.share({ files: [file] }); } catch (e) {} });
    if (blob) document.dispatchEvent(new CustomEvent("hc:rendered", { detail: { blob, ext, mount, caption: cl.opts.hook || "" } }));
    return { mb, mount };
  }
  // A clip that came out silent where the stream has sound (seen on Safari): offer the server's
  // cut, which always carries the audio.
  const offerServer = (mount) => {
    if (win.e - win.s > SERVER_MAX_S) return;
    mount.insertAdjacentHTML("beforeend", `<p class="small">Your browser recorded this without sound. <button type="button" class="linkbtn" data-srvcut>Cut it on our server with sound</button> (about a minute, uses one clip).</p>`);
    mount.querySelector("[data-srvcut]").addEventListener("click", () => { serverMode = true; applyMode(); $("#rec", ed).click(); });
  };
  let lock = null;
  const awake = async (on) => { try { if (on && navigator.wakeLock) lock = await navigator.wakeLock.request("screen"); else if (!on && lock) { await lock.release(); lock = null; } } catch (e) {} };

  $("#rec", ed).onclick = async () => {
    const btn = $("#rec", ed);
    // While a render runs the same button is its way out.
    if (btn.dataset.busy === "local") { btn.disabled = true; cl.cancel(); ph("clip_render_cancel", { phase: cl.phase || "", ...mprops() }); return; }
    if (btn.dataset.busy) return;
    btn.disabled = true;
    if (!serverMode) { try { cl.ensureAudio(); cl.audio.ac.resume().catch(() => {}); } catch (e) {} } // sound starts only inside a click
    const lenNow = Math.round(win.e - win.s);
    if (!(lenNow >= 2)) { btn.disabled = false; say("This clip window is empty. Set a start before the end."); return; }
    const label = btn.textContent, t0 = performance.now();
    const common = () => ({ ...mprops(), layout: cl.opts.layout, hook: !!cl.opts.hook, chat: !!cl.opts.chat, path: serverMode ? "browser_server" : "browser", quality: serverMode ? "server" : cl.opts.quality, free_left: credits.free_left, paid_left: credits.paid_left || 0 });
    // Leaving mid-render, or a phase that stops moving, is counted: 21% of renders used to end
    // with no event at all (610 started, 478 finished, 5 failed, 11/16-11/19).
    let phase = serverMode ? "server" : "load", pct = -1, pctAt = performance.now(), gone = false, running = true;
    const stalled = {};
    const onGone = (e) => { if (!running || gone || (e.type === "visibilitychange" && !document.hidden)) return; gone = true; ph("clip_render_abandon", { ...common(), phase, percent: pct, secs: Math.round((performance.now() - t0) / 1000), how: e.type }, { transport: "sendBeacon" }); };
    const progress = (now, percent) => {
      phase = now;
      if (percent !== pct) { pct = percent; pctAt = performance.now(); }
      else if (performance.now() - pctAt > 20000 && !stalled[phase]) { stalled[phase] = 1; ph("clip_render_stall", { ...common(), phase, percent: pct }); }
    };
    window.addEventListener("pagehide", onGone); document.addEventListener("visibilitychange", onGone);
    const done = () => { running = false; window.removeEventListener("pagehide", onGone); document.removeEventListener("visibilitychange", onGone); awake(false); delete btn.dataset.busy; btn.textContent = label; btn.disabled = false; $("#pv", ed).disabled = false; opts.disabled = false; };
    const failed = (msg) => {
      vstat.textContent = "Render failed: " + msg + ". Nothing was charged.";
      say("Render failed: " + h(msg) + ". <b>Nothing was charged.</b>");
      ph("clip_render_fail", { ...common(), phase, code: errCode(msg), err: String(msg).slice(0, 80), vod_live: current.vod.status === "RECORDING", len: lenNow, secs: Math.round((performance.now() - t0) / 1000) });
    };
    const old = $("#dl", ed).querySelector(".rnote"); if (old) old.remove();

    if (serverMode) {
      // The server cuts it (public/js/servercut.js); nothing is recorded in this browser.
      btn.dataset.busy = "server"; btn.textContent = "Cutting…"; $("#pv", ed).disabled = true; opts.disabled = true; awake(true);
      ph("clip_render_start", { ...common(), len: lenNow, live: !!m.live, vod_live: current.vod.status === "RECORDING" });
      const tick = setInterval(() => { const sx = Math.round((performance.now() - t0) / 1000); vstat.textContent = `Cutting your clip on our server… ${sx} s (about a minute; keep this page open)`; progress("server", sx < 240 ? sx : 240); }, 1000);
      try {
        const d = await serverCut({ vod: current.vod, start: win.s, end: win.e, layout: cl.opts.layout, corner: cl.srvCorner || "tr", hook: cl.opts.hook || "", device });
        clearInterval(tick);
        if (!d.ok) {
          if (d.need === "buy") showPaywall();
          else failed(String(d.error || "the server cut failed").replace(/\s*Nothing was charged\.?$/, "").replace(/\.$/, ""));
          return;
        }
        const cutMs = Math.round(performance.now() - t0);
        phase = "fetch"; vstat.textContent = "Fetching your clip…";
        let blob = null; try { const fr = await fetch(d.download); if (fr.ok) blob = await fr.blob(); } catch (e) {}
        const shown = showClip({ blob, url: d.download, ext: "mp4", fps: 30, mbps: d.megabytes && d.seconds ? Math.round((d.megabytes * 8 / d.seconds) * 10) / 10 : 0, source: d.source_quality || "stream", sound: true, end: win.e, server: true });
        vstat.textContent = "Done. Pick another hook and render again for a second, different post.";
        await loadCredits();
        ph("clip_render_done", { ...common(), free_left: credits.free_left, render_ms: Math.round(performance.now() - t0), load_ms: 0, record_ms: cutMs, mb: d.megabytes || Math.round(shown.mb * 10) / 10, ext: "mp4", fps: 30, source: d.source_quality || "", charged: !!d.charged, sound: true, vod_live: current.vod.status === "RECORDING" });
      } catch (e) { clearInterval(tick); failed(/Load failed|Failed to fetch|NetworkError/i.test(e.message) ? "the connection dropped while the server was cutting. Keep this page open and render again" : e.message); }
      finally { clearInterval(tick); done(); }
      return;
    }

    const t = await creditCall("start", {}).catch(() => ({ ok: false, error: "offline" }));
    if (!t.ok) {
      done();
      if (t.need === "buy") showPaywall();
      else say("Couldn’t reach heistclips to check your clips. Check your connection and try again.");
      return;
    }
    ph("clip_render_start", { cam_fx: cl.opts.layout === "split" ? cl.opts.camFx : null, ...common(), len: lenNow, live: !!m.live, vod_live: current.vod.status === "RECORDING" });
    btn.dataset.busy = "local"; btn.textContent = "Cancel"; btn.disabled = false; $("#pv", ed).disabled = true; opts.disabled = true; awake(true);
    const asked = bitrateAsk(cl.opts.quality, Number(store.get("hc_fps:" + current.vod.channel)) || 60);
    cl.videoBitrate = asked;
    try {
      const out = await cl.record(win.s, win.e, (msg, f, more) => { vstat.textContent = (f == null ? msg : `${msg} ${Math.round(f * 100)}%`) + (more ? ` · ${more}` : ""); progress(cl.phase || "load", f == null ? pct : Math.round(f * 100)); });
      phase = "commit";
      const c = await creditCall("commit", { ticket: t.ticket, bytes: out.blob.size, meta: { vod: current.vod.id, t: Math.round(win.s), layout: cl.opts.layout, channel: current.vod.channel, platform: current.vod.platform || "twitch", secs: lenNow, ph: phId() } }).catch(() => ({}));
      const shown = showClip({ blob: out.blob, ext: out.ext, fps: out.fps, mbps: out.mbps, source: out.source, sound: out.sound, end: out.end });
      const mutedHere = current.vod.muted && current.vod.muted.some((x) => x.start < out.end && x.end > win.s);
      if (!out.sound && !mutedHere) offerServer(shown.mount);
      // Learn what this browser writes per bit asked, for the size of the next render.
      try { const got = out.mbps * 1e6 - 192000; if (got > 1e6 && out.fps) { store.set(brKey(out.fps), String(Math.round((got / asked) * 100) / 100)); store.set("hc_fps:" + current.vod.channel, String(out.fps >= 45 ? 60 : 30)); } } catch (e) {}
      vstat.textContent = "Done. Pick another hook and render again for a second, different post.";
      ph("clip_render_done", { cam_fx: cl.opts.layout === "split" ? cl.opts.camFx : null, fx_loud_beats: cl.opts.layout === "split" && (cl.opts.camFx === "shake" || cl.opts.camFx === "wobble") ? out.fxHits : null, ...common(), free_left: c.free_left != null ? c.free_left : credits.free_left, render_ms: Math.round(performance.now() - t0), load_ms: out.load_ms, record_ms: out.record_ms, effect: cl.opts.layout === "split" ? cl.opts.camFx : "none", source_height: cl.video.videoHeight, mbps_asked: Math.round(asked / 1e5) / 10, cam_style: cl.opts.layout === "split" ? cl.opts.camStyle : null, cam_out: cl.opts.camOut, punch_at: cl.opts.punch && cl.punchAt != null ? Math.round((cl.punchAt - win.s) * 10) / 10 : null, mb: Math.round(shown.mb * 10) / 10, ext: out.ext, fps: out.fps, mbps: out.mbps, source: out.source, charged: !!c.ok, sound: out.sound, vod_live: current.vod.status === "RECORDING" });
    } catch (e) {
      phase = cl.phase || phase;
      if (e.cancelled) { vstat.textContent = "Cancelled. Nothing was charged."; cl.seek(win.s); }
      else failed(e.message);
    } finally { done(); }
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
