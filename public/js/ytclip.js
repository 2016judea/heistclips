// The /clip page for a YouTube stream: moments from our server (official routes only, see
// lib/youtube.js), and the cut made from the clipper's OWN copy of the video, in this browser.
// YouTube doesn't let sites download its videos, so heistclips never fetches one: the clipper
// picks their file, it plays from a blob: URL (same-origin, so the canvas renderer and Web Audio
// read it like a stream), and the editor jumps to the moment. The file is never uploaded.
//
// app.js calls ytOpen() from start(), ytGate() and ytRow() from openEditor(), and ytShift() to
// move a moment into the file's own seconds when the file starts later than the stream did.
import { clock, hooks } from "./twitch.js";
import { markSpoilers } from "./spoilers.js";
import { ytWatch } from "./youtube.js";

const $ = (s, el = document) => el.querySelector(s);
const h = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const parseClock = (v) => { const x = String(v).trim(); if (/^\d+(\.\d+)?$/.test(x)) return Number(x); const m = x.match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})$/); return m ? Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) : NaN; };
const POLL_MS = 60000;
let poll = 0;

if (typeof document !== "undefined" && !document.getElementById("ytcss")) document.head.insertAdjacentHTML("beforeend", `<style id="ytcss">
.ytpick{display:flex;flex-direction:column;gap:10px}
.ytpick .filebtn{position:relative;overflow:hidden;align-self:flex-start}
.ytpick .filebtn input{position:absolute;inset:0;opacity:0;cursor:pointer;font-size:0}
.ytoff{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:14px}
.ytrow{border:1px solid var(--line);border-radius:12px;padding:10px 12px;font-size:14px;display:flex;flex-direction:column;gap:8px;min-width:0}
.ytrow .name{overflow-wrap:anywhere}
.ytwarn{color:#ffd08a}
</style>`);

// ---- the moments page -------------------------------------------------------------------------
// A: what app.js lends: say, dead, ph, current, renderMoments, momentLi, openEditor, drawCurve,
//    creditText, spoilToggle, jumpT
export async function ytOpen(raw, inp, A) {
  clearInterval(poll);
  A.say(`<div class="status">Looking up that YouTube ${inp.kind === "ythandle" ? "channel" : "stream"}…</div>`);
  A.ph("clip_lookup", { kind: inp.kind, platform: "youtube" });
  let r;
  try { r = await (await fetch("/api/youtube?q=" + encodeURIComponent(raw))).json(); }
  catch (e) { return A.dead("youtube_error", `Couldn’t reach heistclips to look that up. <a href="${h(location.href)}">Try again</a>.`); }
  if (!r.ok) {
    if (r.err === "yt_quota") { A.ph("yt_quota_out", { where: "lookup", platform: "youtube" }); return A.dead("yt_quota", `${h(r.message)} Twitch and Kick streams still work.`); }
    return A.dead(r.err || "yt_error", `${h(r.message || "That YouTube link couldn’t be read.")}`);
  }
  const vod = r.vod, live = vod.live;
  const jumpT = r.t != null ? r.t : A.jumpT;
  A.current.vod = vod; A.current.chan = null; A.current.moments = []; A.current.chapters = [];
  const others = (r.chan && r.chan.others) || [];
  const note = r.note ? `<div class="note">${h(r.note)}</div>` : "";
  A.say(note + `<div class="src"><img src="${h(vod.thumb || "")}" alt="" onerror="this.style.visibility='hidden'">
<div class="t"><b>${h(vod.title || "Untitled stream")}</b>
<span class="small">YouTube · ${h(vod.channel_name)} · ${clock(vod.length)}${live ? ' · <b class="livedot">LIVE</b>' : ""}</span>
${others.length ? `<span class="small">Other streams: ${others.map((v) => `<a href="/clip?q=${encodeURIComponent(ytWatch(v.id))}">${h(new Date(v.created_at).toUTCString().slice(5, 11))}</a>`).join(" · ")}</span>` : ""}</div></div>
${live ? `<div class="livebar" id="livebar"><span class="pulse"></span><span id="livetxt">Reading live chat…</span></div>` : ""}
<div class="status" id="st"><span id="stt">${live ? "Reading live chat…" : "Reading viewers’ timestamped comments…"}</span></div>
<canvas class="curve" id="curve" width="900" height="70" hidden></canvas>
<p class="small"><span class="credit">${A.creditText()}</span></p>
<p class="small" id="ythow">To cut a moment you need your own copy of this video (the campaign’s source file, or one you saved): YouTube doesn’t let sites download its videos. Pick the file and it’s cut right here in your browser. It never leaves your device.</p>
${A.spoilToggle()}
<div id="skipped"></div>
<ol class="moments" id="moments"></ol>`);
  const t0 = performance.now();
  let first = true, shown = new Set();
  const load = async () => {
    let d;
    try { d = await (await fetch(`/api/youtube?op=moments&id=${encodeURIComponent(vod.id)}${first ? "&first=1" : ""}`)).json(); }
    catch (e) { if (first) $("#stt").textContent = "Couldn’t reach heistclips. Retrying in a minute…"; return; }
    if (A.current.vod !== vod) return clearInterval(poll);
    if (!d.ok) { $("#stt").innerHTML = h(d.message || "YouTube didn’t answer."); if (d.err === "yt_quota") A.ph("yt_quota_out", { where: "moments", platform: "youtube" }); return; }
    if (d.vod) Object.assign(vod, { length: d.vod.length, live: d.vod.live, status: d.vod.status, viewers: d.vod.viewers });
    if (d.quota && first) A.ph("yt_quota_out", { where: "moments", platform: "youtube", live: d.status === "live" });
    const fresh = d.moments.filter((m) => !shown.has(m.signal + ":" + m.t_peak));
    for (const m of fresh) shown.add(m.signal + ":" + m.t_peak);
    markSpoilers(vod, fresh);
    // The curve spans the minutes heistclips has read, not the whole stream (on a 9-hour stream
    // the first 8 minutes of reading were a sliver at the right edge, 2026-11-19).
    if (d.curve && d.curve.length > 2) {
      const cv = $("#curve"), a = d.curve[0][0], b = d.curve[d.curve.length - 1][0] + 10;
      if (cv) { cv.hidden = false; A.drawCurve(cv, d.curve.map(([t, r]) => [t - a, r]), Math.max(60, b - a), d.moments.filter((m) => m.t_peak >= a).map((m) => ({ t_peak: m.t_peak - a }))); }
    }
    if (first) {
      A.current.moments = fresh;
      A.renderMoments();
      A.ph("clip_moments", { platform: "youtube", n: fresh.length, secs: Math.round((performance.now() - t0) / 1000), live: d.status === "live", len: vod.length, signal: d.signal, comments_read: d.comments_read, with_timestamps: d.with_timestamps, msgs: d.msgs, quota: !!d.quota });
      if (!fresh.length && d.status !== "live") {
        A.ph("clip_dead", { why: d.quota ? "yt_quota" : d.comments_off ? "yt_comments_off" : "yt_no_comment_moments", platform: "youtube" });
        $("#ythow").hidden = true;
        $("#moments").innerHTML = `<li class="note">${d.quota ? h(d.note) : `Moments for finished YouTube streams come from viewers’ timestamped comments (like “2:41:31 lmao”), and this one has none to go on${d.comments_read ? ` (read ${d.comments_read} comments)` : d.comments_off ? " (its comments are off)" : ""}. YouTube doesn’t let anyone read a finished stream’s chat. Paste a live YouTube stream and heistclips reads its chat as it happens.`} <a href="${h(ytWatch(vod.id))}" target="_blank" rel="noopener">Watch it on YouTube</a>.</li>`;
      }
    } else if (fresh.length) {
      // Never redraw the list (it would close an open editor): add new rows on top.
      const ol = $("#moments");
      for (const m of fresh) { A.current.moments.push(m); ol.insertAdjacentHTML("afterbegin", A.momentLi(m, A.current.moments.length - 1)); }
      document.title = "● New moment – heistclips";
      A.ph("live_moment", { platform: "youtube", n: fresh.length });
    }
    const n = A.current.moments.filter((m) => !m.hidden).length;
    if (d.status === "live") {
      const since = d.watching_since != null ? clock(Math.max(0, d.watching_since)) : null;
      $("#livetxt").textContent = d.quota ? d.note : `Watching live chat${since ? ` since ${since} into the stream` : ""} · ${d.msgs || 0} messages read · checked every minute`;
      $("#stt").textContent = n ? `${n} moment${n === 1 ? "" : "s"} from live chat so far. New ones appear here as chat spikes.` : "No spikes yet. A moment needs a few minutes of chat to measure against; keep this tab open and they appear here.";
    } else if (n) {
      const src = d.signal === "comments" ? "viewers’ timestamped comments" : d.signal === "live_chat" ? "live chat while heistclips watched" : "live chat while heistclips watched, and viewers’ timestamped comments";
      $("#stt").textContent = `${n} moment${n === 1 ? "" : "s"} from ${src}${d.comments_read ? ` (${d.with_timestamps} of ${d.comments_read} comments carry a time)` : ""}.`;
    } else if (d.status !== "live") $("#stt").textContent = "No moments for this stream.";
    if (first && jumpT != null && jumpT >= 0) openAt(jumpT, vod, A);
    first = false;
  };
  await load();
  if (live) poll = setInterval(() => { if (!document.hidden) load(); }, POLL_MS);
}

// A link with &t= (from the assistant, or a shared moment): open the editor at that second.
function openAt(t, vod, A) {
  let idx = A.current.moments.findIndex((x) => Math.abs(x.t_start - t) < 30);
  if (idx < 0) {
    const m = { platform: "youtube", vod_id: vod.id, t_peak: t, t_start: Math.max(0, t - 4), t_end: t + 34, asked: true, chat: [], chat_ratio: null, event_type: "reaction",
      signals: {}, phrase: null, clip_requests: 0, music_risk: { level: "low", why: "YouTube does not mark muted music; check for in-game radio" }, url: ytWatch(vod.id, Math.max(0, t - 4)) };
    m.hooks = hooks(m, vod.channel_name);
    A.current.moments.push(m); idx = A.current.moments.length - 1;
    const ol = $("#moments"); if (ol) ol.insertAdjacentHTML("afterbegin", A.momentLi(m, idx));
  }
  A.openEditor(idx);
}

// ---- the editor -------------------------------------------------------------------------------
// The editor works in the FILE's seconds. A file that starts at stream second `off` shows the
// moment at t - off (its chat overlay moves with it).
export function ytShift(m, vod) {
  const off = (vod && vod.platform === "youtube" && vod.localUrl && vod.fileOffset) || 0;
  if (!off) return m;
  const s = (t) => (t == null ? t : t - off);
  return { ...m, t_start: Math.max(0, s(m.t_start)), t_end: s(m.t_end), t_peak: s(m.t_peak), chat: (m.chat || []).map((x) => ({ ...x, t: x.t - off })), shifted: off };
}

const fits = (m, vod) => {
  const off = vod.fileOffset || 0, len = vod.fileLength || 0;
  return m.t_end - off > 2 && m.t_start - off < len - 2;
};

// No file yet (or the file doesn't reach the moment): show the picker instead of the editor.
// -> true when the picker is showing (openEditor stops there).
export function ytGate(ed, vod, m, reopen, ph) {
  if (vod.localUrl && fits(m, vod)) return false;
  const off = vod.fileOffset || 0;
  const miss = vod.localUrl && !fits(m, vod);
  ed.innerHTML = `<div class="editor ytpick"><div class="note ytpick">
<b>Cut from your own copy of this video</b>
<span>YouTube doesn’t let sites download its videos, so heistclips can’t fetch this one. Pick your copy of the stream (an MP4 or WebM) and it’s cut right here: same 9:16 editor, hooks and facecam. The file never leaves your device.</span>
${miss ? `<span class="ytwarn">Your file (${h(vod.fileName)}) is ${clock(vod.fileLength)} long and starts at ${clock(off)} of the stream, so it doesn’t reach this moment (${clock(m.t_start)}). Pick another file, or set where yours starts.</span>` : ""}
<label class="btn filebtn">${vod.localUrl ? "Pick another file" : "Choose your video file"}<input type="file" accept="video/*,.mp4,.webm,.mov,.mkv" data-ytfile></label>
<span class="ytoff">My file starts at <input class="tin" data-ytoff value="${h(clock(off))}" inputmode="numeric" aria-label="Where your file starts in the stream"> of the stream <span class="small">(0:00 if it’s the whole stream)</span></span>
<a class="btn ghost sm" href="${h(ytWatch(vod.id, m.t_start))}" target="_blank" rel="noopener" style="align-self:flex-start">Watch this moment on YouTube</a>
</div></div>`;
  ph("yt_cut_open", { need_file: !vod.localUrl, miss: !!miss, t_start: Math.round(m.t_start) });
  const offIn = $("[data-ytoff]", ed);
  offIn.addEventListener("change", () => { const v = parseClock(offIn.value); if (isFinite(v) && v >= 0 && v !== (vod.fileOffset || 0)) { vod.fileOffset = v; ph("yt_offset", { offset: Math.round(v), where: "picker" }); if (vod.localUrl) reopen(); } offIn.value = clock(vod.fileOffset || 0); });
  $("[data-ytfile]", ed).addEventListener("change", (e) => takeFile(e.target.files && e.target.files[0], vod, m, reopen, ph, ed));
  return true;
}

async function takeFile(file, vod, m, reopen, ph, ed) {
  if (!file) return;
  const url = URL.createObjectURL(file);
  const len = await new Promise((ok) => {
    const v = document.createElement("video");
    v.preload = "metadata"; v.muted = true;
    v.onloadedmetadata = () => ok(isFinite(v.duration) ? v.duration : 0);
    v.onerror = () => ok(-1);
    v.src = url;
    setTimeout(() => ok(0), 15000);
  });
  if (len < 0) {
    URL.revokeObjectURL(url);
    ph("yt_file_pick", { ok: false, why: "unplayable", mb: Math.round(file.size / 1e6), type: String(file.type || "").slice(0, 20) });
    const n = ed.querySelector(".ytpick .note, .note.ytpick");
    if (n) n.insertAdjacentHTML("beforeend", `<span class="ytwarn">This browser can’t play that file (${h(file.type || file.name.split(".").pop())}). Try an MP4 or WebM.</span>`);
    return;
  }
  if (vod.localUrl) URL.revokeObjectURL(vod.localUrl);
  Object.assign(vod, { localUrl: url, fileName: file.name, fileLength: len, fileSize: file.size });
  ph("yt_file_pick", { ok: true, mb: Math.round(file.size / 1e6), secs: Math.round(len), offset: Math.round(vod.fileOffset || 0), fits: fits(m, vod) });
  reopen();
}

// Above the open editor: which file, where it starts, and a way to change either.
export function ytRow(ed, vod, reopen, ph) {
  const ctrls = $(".ctrls", ed);
  if (!ctrls || $(".ytrow", ed)) return;
  ctrls.insertAdjacentHTML("afterbegin", `<div class="ytrow"><span>Cutting from your file <b class="name">${h(vod.fileName)}</b> (${clock(vod.fileLength)}). Nothing is uploaded.</span>
<span class="ytoff">It starts at <input class="tin" data-ytoff2 value="${h(clock(vod.fileOffset || 0))}" inputmode="numeric" aria-label="Where your file starts in the stream"> of the stream
<button type="button" class="btn sm ghost" data-ytstep="-5">−5s</button><button type="button" class="btn sm ghost" data-ytstep="5">+5s</button></span>
<label class="btn sm ghost filebtn" style="align-self:flex-start;position:relative;overflow:hidden">Use another file<input type="file" accept="video/*,.mp4,.webm,.mov,.mkv" data-ytfile2 style="position:absolute;inset:0;opacity:0;font-size:0"></label></div>`);
  const inp = $("[data-ytoff2]", ed);
  const set = (v, how) => { if (!(isFinite(v) && v >= 0) || v === (vod.fileOffset || 0)) { inp.value = clock(vod.fileOffset || 0); return; } vod.fileOffset = v; ph("yt_offset", { offset: Math.round(v), where: how }); reopen(); };
  inp.addEventListener("change", () => set(parseClock(inp.value), "typed"));
  ed.querySelectorAll("[data-ytstep]").forEach((b) => b.addEventListener("click", () => set(Math.max(0, (vod.fileOffset || 0) + Number(b.dataset.ytstep)), "step")));
  $("[data-ytfile2]", ed).addEventListener("change", (e) => takeFile(e.target.files && e.target.files[0], vod, {}, reopen, ph, ed));
}
