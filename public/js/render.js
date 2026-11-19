// Clip entity: cut a moment to 9:16 in the browser. hls.js reads the VOD through heistclips'
// same-origin /tv/ proxy, a canvas draws the layout, hook and chat, and MediaRecorder encodes
// in real time on the visitor's own hardware. Nothing is uploaded; nothing costs us compute.

import { CamFx, Loud, shake, fxNeedsLoud, fxMoves, BIGHEAD_PAD } from "./fx.js?v=3";

export const W = 1080, H = 1920;

// ---- facecam (board requests rmwnmbvuw, rmwm7a4ji, rmwm3rms3) --------------------------------
// The facecam is a box in the SOURCE frame, as fractions of its width and height, placed by
// dragging or by a preset; the output puts it on top or at the bottom, as a full-width panel,
// a rounded box or a circle, with an optional punch-in zoom on the loudest second.
export const CAM_DEFAULT = { x: 0.74, y: 0, w: 0.26, h: 0.29 };
export function camPreset(p, box = CAM_DEFAULT) {
  const w = Math.min(1, box.w), h = Math.min(1, box.h);
  const x = p[1] === "l" ? 0 : 1 - w;
  const y = p[0] === "t" ? 0 : p[0] === "b" ? 1 - h : (1 - h) / 2;
  return { x, y, w, h };
}
export function clampBox(b) {
  const w = Math.max(0.06, Math.min(1, b.w)), h = Math.max(0.06, Math.min(1, b.h));
  return { x: Math.max(0, Math.min(1 - w, b.x)), y: Math.max(0, Math.min(1 - h, b.y)), w, h };
}
// Zoom over time around the loudest moment: in over 0.25 s, hold 0.9 s, out over 0.5 s.
export function punchZoom(dt, amount = 0.32) {
  const ease = (x) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);
  if (dt < -0.25 || dt > 1.4) return 1;
  if (dt < 0) return 1 + amount * ease((dt + 0.25) / 0.25);
  if (dt <= 0.9) return 1 + amount;
  return 1 + amount * (1 - ease((dt - 0.9) / 0.5));
}
// Quarter-second loudness bins -> centre of the loudest one-second stretch, or null if silent.
export function loudestSecond(bins, start) {
  let best = null, bestV = 0;
  const avg = (k) => { const e = bins.get(k); return e && e[1] ? e[0] / e[1] : 0; };
  for (const k of bins.keys()) { const v = avg(k) + avg(k + 1) + avg(k + 2) + avg(k + 3); if (v > bestV) { bestV = v; best = k; } }
  return bestV > 0.004 ? start + (best + 2) * 0.25 : null;
}

export function pickMime() {
  const opts = ["video/mp4;codecs=avc1.640028,mp4a.40.2", "video/mp4;codecs=avc1.4d002a,mp4a.40.2", "video/mp4;codecs=avc1,mp4a", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  if (typeof MediaRecorder === "undefined") return null;
  return opts.find((t) => MediaRecorder.isTypeSupported(t)) || "";
}

// Twitch lists a segment whose audio it deleted for licensed music as "N-unmuted.ts", a file its
// CDN answers 403 for; the one it serves is "N-muted.ts". Read as listed, a window that touched a
// muted stretch stopped loading at that segment: "Loading the video… 21%" for two minutes, then a
// recording that froze (zackrawrr 2932469290, 378 of 3,901 segments, 2026-11-19). lib/cut.js
// already did this for the server cut.
export function fixMutedPlaylist(text) { return String(text).replace(/-unmuted\.ts/g, "-muted.ts"); }

// End of the buffered run that holds `now`. A hole up to `gap` s is hopped (hls.js skips those in
// playback), and a run left behind by an earlier seek is not counted.
export function runEnd(ranges, now, gap = 0.5) {
  let end = null;
  for (const [s, e] of ranges) {
    if (end == null) { if (s <= now + 0.5 && e >= now - 0.1) end = e; }
    else if (s <= end + gap) end = Math.max(end, e);
    else break;
  }
  return end == null ? now : end;
}

export class Clipper {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    canvas.width = W; canvas.height = H;
    this.video = document.createElement("video");
    this.video.playsInline = true; this.video.crossOrigin = "anonymous"; this.video.preload = "auto";
    this.small = document.createElement("canvas"); this.small.width = 54; this.small.height = 96;
    this.sctx = this.small.getContext("2d");
    this.opts = { layout: "fit", hook: "", hookMode: "always", chat: true, cam: { ...CAM_DEFAULT }, camOut: "top", camStyle: "split", punch: false, camFx: "none", pan: 0 };
    this.loud = new Loud(); this.fx = null; this.fxDemo = 0;
    this.punchAt = null; this.onDraw = null;
    this.chat = []; this.audio = null; this.src = null; this.hls = null; this.loop = null;
  }

  async load(url, start) {
    this.url = url;
    if (this.hls) { this.hls.destroy(); this.hls = null; }
    const v = this.video;
    if (window.Hls && window.Hls.isSupported()) {
      const Base = window.Hls.DefaultConfig.loader;
      class PlaylistLoader extends Base {
        load(context, config, callbacks) {
          const ok = callbacks.onSuccess;
          callbacks.onSuccess = (resp, ...rest) => { if (typeof resp.data === "string") resp.data = fixMutedPlaylist(resp.data); ok(resp, ...rest); };
          super.load(context, config, callbacks);
        }
      }
      const hls = new window.Hls({ maxBufferLength: 50, maxMaxBufferLength: 60, startPosition: Math.max(0, start), enableWorker: true, backBufferLength: 60, pLoader: PlaylistLoader });
      this.hls = hls;
      // What the loader is doing, so a wait can say what it is waiting for (record()).
      const net = (this.net = { bytes: 0, frag: null, fatal: null, full: false });
      const E = window.Hls.Events;
      hls.on(E.FRAG_LOADING, (e, d) => { net.frag = d.frag; });
      hls.on(E.FRAG_LOADED, (e, d) => { net.bytes += (d.frag.stats && d.frag.stats.total) || 0; net.frag = null; });
      hls.on(E.ERROR, (e, d) => { if (d.fatal) net.fatal = d.details || "error"; if (d.details === "bufferFullError") net.full = true; });
      await new Promise((ok, bad) => {
        hls.on(window.Hls.Events.MANIFEST_PARSED, (e, d) => {
          // A master playlist (Kick) has several renditions: take the sharpest up to 1440p.
          const lv = (d && d.levels) || [];
          if (lv.length > 1) { let best = 0; lv.forEach((l, i) => { if ((l.height || 0) <= 1440 && (l.height || 0) >= (lv[best].height || 0)) best = i; }); hls.currentLevel = best; }
          ok();
        });
        hls.on(window.Hls.Events.ERROR, (e, d) => { if (d.fatal) bad(new Error("video: " + d.details)); });
        hls.loadSource(url); hls.attachMedia(v);
      });
    } else if (v.canPlayType("application/vnd.apple.mpegurl")) {
      v.src = url;
      await new Promise((ok, bad) => { v.onloadedmetadata = ok; v.onerror = () => bad(new Error("video failed to load")); });
    } else throw new Error("This browser cannot play the stream video.");
    await this.seek(start);
    if (this.net && this.net.fatal && !v.videoWidth) throw new Error("video: " + this.net.fatal);
    if (v.videoWidth && this.blank()) await this.prime(start);
  }

  // Safari rejects play() with "The operation was aborted." and Chrome with "interrupted by a new
  // load request" when the loader touches the element as playback starts (4 of 41 Safari renders
  // and one Android render failed on exactly these, 11/16-11/19). The next try goes through.
  async playSafe() {
    for (let i = 0; ; i++) {
      try { await this.video.play(); return; }
      catch (e) { if (i >= 3 || !/abort|interrupt/i.test(String(e && e.name) + " " + String(e && e.message))) throw e; await sleep(400); }
    }
  }

  // iOS Safari shows no picture until the video has played: the editor's canvas stayed black.
  // If the first draw is blank, play a few muted frames and come back.
  blank() {
    const v = this.video;
    if (!v.videoWidth) return true;
    try {
      this.sctx.drawImage(v, 0, 0, 54, 96);
      const d = this.sctx.getImageData(0, 0, 54, 96).data;
      let sum = 0; for (let i = 0; i < d.length; i += 16) sum += d[i] + d[i + 1] + d[i + 2];
      return sum < 200;
    } catch (e) { return false; }
  }
  async prime(start) {
    const v = this.video, was = v.muted;
    v.muted = true;
    try { await Promise.race([v.play(), sleep(2500)]); await sleep(250); } catch (e) {}
    v.pause(); v.muted = was;
    await this.seek(start);
  }

  ranges() { const b = this.video.buffered, out = []; for (let i = 0; i < b.length; i++) out.push([b.start(i), b.end(i)]); return out; }
  loadedBytes() { const n = this.net; return n ? n.bytes + ((n.frag && n.frag.stats && n.frag.stats.loaded) || 0) : 0; }
  cancel() { this.cancelled = true; }
  checkCancel() { if (this.cancelled) throw Object.assign(new Error("cancelled"), { cancelled: true }); }

  seek(t) {
    const v = this.video;
    return new Promise((ok) => {
      const done = () => { v.removeEventListener("seeked", done); setTimeout(() => { this.draw(); ok(); }, 60); };
      v.addEventListener("seeked", done);
      v.currentTime = Math.max(0, t);
      setTimeout(done, 8000);
    });
  }

  bufferedTo(t) { return this.bufferedEnd() >= t - 0.3; }

  // A Twitch VOD of a stream that is still going is a growing (EVENT) playlist: hls.js treats it
  // as live and keeps reloading it, and the media only reaches as far as Twitch has written.
  isLive() {
    const h = this.hls, lv = h && h.levels && h.levels[h.currentLevel >= 0 ? h.currentLevel : 0];
    if (lv && lv.details) return !!lv.details.live;
    return this.video.duration === Infinity;
  }

  availableEnd() {
    const v = this.video;
    if (isFinite(v.duration) && v.duration > 0) return v.duration;
    return v.seekable.length ? v.seekable.end(v.seekable.length - 1) : 0;
  }

  bufferedEnd() { return runEnd(this.ranges(), this.video.currentTime); }

  // ---- drawing --------------------------------------------------------------------------
  draw(tOverride) {
    const { ctx, video: v, opts: o } = this;
    const vw = v.videoWidth || 1920, vh = v.videoHeight || 1080;
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
    if (!v.videoWidth) return;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    if (o.layout === "crop") {
      const sw = vh * 9 / 16, sx = Math.max(0, Math.min(vw - sw, (vw - sw) / 2 + o.pan * (vw - sw) / 2));
      ctx.drawImage(v, sx, 0, sw, vh, 0, 0, W, H);
    } else if (o.layout === "split") {
      this.slots = this.drawCam(v, vw, vh, tOverride != null ? tOverride : v.currentTime);
    } else {
      this.sctx.drawImage(v, (vw - vh * 9 / 16) / 2, 0, vh * 9 / 16, vh, 0, 0, 54, 96);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "low";
      ctx.globalAlpha = 0.55; ctx.drawImage(this.small, 0, 0, W, H); ctx.globalAlpha = 1;
      ctx.imageSmoothingQuality = "high";
      const fh = W * vh / vw, fy = (H - fh) / 2;
      ctx.drawImage(v, 0, 0, vw, vh, 0, fy, W, fh);
    }
    const t = tOverride != null ? tOverride : v.currentTime;
    const showHook = o.hook && (o.hookMode === "always" || t - this.clipStart < 3.2);
    const sl = o.layout === "split" && this.slots ? this.slots : null;
    if (showHook) this.drawHook(o.hook, sl ? sl.hook : o.layout === "fit" ? 300 : 210);
    if (o.chat && this.chat.length) this.drawChat(t, sl ? sl.chat : H - 560);
    if (this.onDraw) this.onDraw();
  }

  // Source rect of the facecam at time t, punch-in applied.
  camRect(vw, vh, t) {
    const b = clampBox(this.opts.cam || CAM_DEFAULT);
    let x = b.x * vw, y = b.y * vh, w = b.w * vw, h = b.h * vh;
    const z = this.opts.punch && this.punchAt != null ? punchZoom(t - this.punchAt) : 1;
    if (z > 1) { const nw = w / z, nh = h / z; x += (w - nw) / 2; y += (h - nh) / 2; w = nw; h = nh; }
    return { x, y, w, h, aspect: (b.w * vw) / (b.h * vh) };
  }

  // Gameplay fills [y, y+gh) of the output: a centre crop of the source, moved by Pan.
  drawGame(v, vw, vh, y, gh) {
    const gsw = Math.min(vw, vh * W / gh), gsh = gsw * gh / W;
    const gsx = Math.max(0, Math.min(vw - gsw, (vw - gsw) / 2 + this.opts.pan * (vw - gsw) / 2));
    this.ctx.drawImage(v, gsx, (vh - gsh) / 2, gsw, gsh, 0, y, W, gh);
  }

  // Facecam + gameplay. Returns where the hook and chat go so they never sit on the face.
  drawCam(v, vw, vh, t) {
    const { ctx } = this, o = this.opts;
    const r = this.camRect(vw, vh, t);
    const top = o.camOut !== "bottom";
    if (o.camStyle === "rounded" || o.camStyle === "circle") {
      this.drawGame(v, vw, vh, 0, H);
      let x, y, w, h;
      if (o.camStyle === "circle") { w = h = Math.round(W * 0.52); }
      else { w = Math.round(W * 0.66); h = Math.round(Math.max(W * 0.3, Math.min(H * 0.32, w / r.aspect))); }
      x = Math.round((W - w) / 2); y = top ? 90 : H - h - 90;
      const f = this.fxState(t);
      const shape = (inset) => { ctx.beginPath(); if (o.camStyle === "circle") ctx.arc(x + w / 2, y + h / 2, w / 2 - inset, 0, Math.PI * 2); else roundRect(ctx, x + inset, y + inset, w - 2 * inset, h - 2 * inset, 44 - inset); };
      ctx.save();
      // Shake moves the whole floating frame, not only the picture inside it.
      if (f.shk) { ctx.translate(x + w / 2 + f.shk.dx * 26, y + h / 2 + f.shk.dy * 26); ctx.rotate(f.shk.rot * 0.6); ctx.translate(-(x + w / 2), -(y + h / 2)); }
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,.55)"; ctx.shadowBlur = 36; ctx.fillStyle = "#000";
      shape(0);
      ctx.fill(); ctx.shadowBlur = 0; ctx.clip();
      const pop = this.paintCam(v, vw, vh, r, x, y, w, h, f, () => { if (o.camStyle === "circle") { ctx.moveTo(x + w - 8, y + h / 2); ctx.arc(x + w / 2, y + h / 2, w / 2 - 8, 0, Math.PI * 2); } else if (ctx.roundRect) ctx.roundRect(x + 8, y + 8, w - 16, h - 16, 36); else ctx.rect(x + 8, y + 8, w - 16, h - 16); });
      ctx.restore();
      ctx.save(); ctx.lineWidth = 8; ctx.strokeStyle = "rgba(255,255,255,.92)";
      shape(4);
      ctx.stroke(); ctx.restore();
      if (pop) pop(true);
      ctx.restore();
      return top ? { hook: y + h + 50, chat: H - 560 } : { hook: 170, chat: y - 400 };
    }
    // Panel: the facecam is a full-width band, as tall as its own shape needs (a quarter to half the frame).
    const camH = Math.round(Math.max(H * 0.25, Math.min(H * 0.5, W / r.aspect)));
    const camY = top ? 0 : H - camH;
    this.drawGame(v, vw, vh, top ? camH : 0, H - camH);
    ctx.save(); ctx.beginPath(); ctx.rect(0, camY, W, camH); ctx.clip();
    const pop = this.paintCam(v, vw, vh, r, 0, camY, W, camH, this.fxState(t), () => ctx.rect(0, camY, W, camH));
    ctx.restore();
    ctx.fillStyle = "#000"; ctx.fillRect(0, (top ? camH : camY) - 3, W, 6);
    if (pop) pop(false);
    return top ? { hook: 120, chat: H - 520 } : { hook: 140, chat: camY - 400 };
  }

  // ---- funny facecam (public/js/fx.js) ----------------------------------------------------
  // What the effect needs for this frame: its clock, how loud the moment is, and the shake.
  fxState(t) {
    const fx = this.opts.camFx || "none", v = this.video;
    if (fx === "none") return { fx };
    const still = v.paused || v.playbackRate !== 1;
    const now = performance.now();
    let e = 0;
    if (!still && this.audio && fxNeedsLoud(fx)) {
      const lv = this.audio.level, buf = this.lbuf || (this.lbuf = new Float32Array(lv.fftSize));
      lv.getFloatTimeDomainData(buf);
      let sum = 0; for (let i = 0; i < buf.length; i += 4) sum += buf[i] * buf[i];
      e = this.loud.push(Math.sqrt(sum / (buf.length / 4)), t);
      if (e > 0.5 && !this.fxHot) this.fxHits++; // loud beats in this render, for analytics
      this.fxHot = e > 0.5;
    } else if (still && now < this.fxDemo) {
      // A still preview has no sound: act out one loud beat so a click on the effect shows it.
      const x = 1 - (this.fxDemo - now) / 1600;
      e = Math.pow(Math.sin(Math.PI * Math.min(1, x * 1.15)), 2);
    }
    const clock = still ? now / 1000 : t;
    return { fx, t: clock, e, shk: fx === "shake" ? shake(clock, e) : null };
  }

  // Draw the facecam into (x, y, w, h); the caller has set the clip. Returns a function that
  // draws what sticks out past the frame (big head), or null.
  paintCam(v, vw, vh, r, x, y, w, h, f, addFrame) {
    const { ctx } = this;
    const s = coverRect(r.x, r.y, r.w, r.h, w, h);
    let cv = null;
    if (f.fx !== "none") {
      if (!this.fx) this.fx = new CamFx();
      cv = this.fx.render(v, vw, vh, s, w, h, f.fx, f.t, f.e, f.shk && { dx: f.shk.dx * 0.03, dy: f.shk.dy * 0.03, rot: f.shk.rot, zoom: f.shk.zoom });
    }
    if (!cv) { ctx.drawImage(v, s.x, s.y, s.w, s.h, x, y, w, h); return null; }
    if (f.fx !== "bighead") { ctx.drawImage(cv, x, y, w, h); return null; }
    const px = w * BIGHEAD_PAD, py = h * BIGHEAD_PAD;
    // One draw for the whole big head (frame and the part sticking out), after the ring: drawing
    // it twice a frame is what left some 1440p exports near 50 fps on a busy laptop (2026-11-19).
    // The head bulges out of its frame: the same oval the shader blows up, drawn over the border.
    const asp = w / h;
    let ry = 0.56, rx = Math.min(0.46, (ry * 0.8) / asp); ry = Math.min(ry, (rx * asp) / 0.62);
    const ex = x + w * 0.5, ey = y + h * 0.47;
    const oval = (grow) => { ctx.beginPath(); ctx.ellipse(ex, ey, rx * w + grow, ry * h + grow, 0, 0, Math.PI * 2); };
    return (ring) => {
      ctx.save(); ctx.beginPath(); addFrame(); ctx.moveTo(ex + rx * w, ey); ctx.ellipse(ex, ey, rx * w, ry * h, 0, 0, Math.PI * 2); ctx.clip();
      ctx.drawImage(cv, x - px, y - py, w + 2 * px, h + 2 * py); ctx.restore();
      if (!ring) return;
      // White edge on the part outside the frame only, so it reads as one sticker with the ring.
      ctx.save();
      ctx.beginPath(); ctx.rect(-200, -200, W + 400, H + 400);
      if (this.opts.camStyle === "circle") { ctx.moveTo(x + w, y + h / 2); ctx.arc(x + w / 2, y + h / 2, w / 2 - 1, 0, Math.PI * 2); } else ctx.rect(x + 1, y + 1, w - 2, h - 2);
      ctx.clip("evenodd");
      ctx.lineWidth = 8; ctx.strokeStyle = "rgba(255,255,255,.92)"; oval(-4); ctx.stroke();
      ctx.restore();
    };
  }

  // Keep a still preview moving while a moving effect is on (grain, jelly, the loud beat).
  fxPreview() {
    cancelAnimationFrame(this.fxLoop);
    const tick = () => {
      if (!fxMoves(this.opts.camFx) || this.opts.layout !== "split" || !this.canvas.isConnected) return;
      if (this.video.paused && !document.hidden) this.draw();
      this.fxLoop = requestAnimationFrame(tick);
    };
    this.fxDemo = performance.now() + 1600;
    tick();
  }

  drawHook(text, yTop) {
    const { ctx } = this;
    ctx.save();
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    let size = 92;
    let lines;
    for (; size >= 54; size -= 6) {
      ctx.font = `900 ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
      lines = wrap(ctx, text, 940);
      if (lines.length <= 3) break;
    }
    const lh = size * 1.12;
    ctx.lineJoin = "round"; ctx.lineWidth = size * 0.2; ctx.strokeStyle = "#000"; ctx.fillStyle = "#fff";
    lines.forEach((ln, i) => { ctx.strokeText(ln, W / 2, yTop + i * lh); ctx.fillText(ln, W / 2, yTop + i * lh); });
    ctx.restore();
  }

  drawChat(t, y) {
    const { ctx } = this;
    const shown = this.chat.filter((m) => m.t <= t).slice(-6);
    if (!shown.length) return;
    ctx.save();
    ctx.font = `700 38px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    ctx.textBaseline = "top"; ctx.textAlign = "left";
    const x = 70, lh = 56, boxH = shown.length * lh + 28;
    ctx.fillStyle = "rgba(0,0,0,.55)";
    roundRect(ctx, x - 24, y + (6 - shown.length) * lh, W - 2 * (x - 24), boxH, 26); ctx.fill();
    shown.forEach((m, i) => {
      const yy = y + (6 - shown.length) * lh + 14 + i * lh;
      const cps = [...m.text];
      let s = cps.length > 30 ? cps.slice(0, 29).join("") + "…" : m.text;
      ctx.fillStyle = "#fff"; ctx.fillText(s, x, yy);
    });
    ctx.restore();
  }

  startPreview() {
    cancelAnimationFrame(this.loop);
    const tick = () => { this.draw(); this.loop = requestAnimationFrame(tick); };
    tick();
  }
  stopPreview() { cancelAnimationFrame(this.loop); }

  // The stream's sound reaches the recording through Web Audio. Create it inside the click
  // (browsers only start sound on a user gesture), then resumeAudio() before recording.
  ensureAudio() {
    if (this.audio) return this.audio;
    const AC = window.AudioContext || window.webkitAudioContext;
    const ac = new AC();
    const src = ac.createMediaElementSource(this.video);
    const dest = ac.createMediaStreamDestination();
    const level = ac.createAnalyser(); level.fftSize = 2048;
    const monitor = ac.createGain();
    src.connect(dest); src.connect(level); src.connect(monitor); monitor.connect(ac.destination);
    this.audio = { ac, dest, level, monitor };
    return this.audio;
  }

  async resumeAudio() {
    const ac = this.ensureAudio().ac;
    if (ac.state !== "running") await Promise.race([ac.resume().catch(() => {}), sleep(3000)]);
    if (ac.state !== "running") throw new Error("the browser blocked the sound, so the clip would be silent. Click Render again");
  }

  async playWindow(start, end) {
    const v = this.video;
    this.clipStart = start;
    this.ensureAudio(); await this.resumeAudio().catch(() => {});
    if (Math.abs(v.currentTime - start) > 0.3) await this.seek(start);
    this.startPreview();
    await this.playSafe();
    const bins = new Map(), lv = this.audio && this.audio.level, buf = lv && new Float32Array(lv.fftSize);
    const stopAt = () => new Promise((ok) => { const chk = () => {
      if (lv) sampleLevel(lv, buf, bins, Math.floor((v.currentTime - start) * 4));
      if (v.currentTime >= end || v.paused) { v.pause(); ok(); } else requestAnimationFrame(chk); }; chk(); });
    await stopAt();
    if (lv && v.currentTime >= end - 0.5) { this.punchAt = loudestSecond(bins, start); this.punchWin = start + "-" + end; this.loud.seed(bins); }
    this.stopPreview(); this.draw();
  }

  // Punch-in needs the loudest second before recording: play the window muted at 4x and listen.
  async findLoudest(start, end, onState) {
    const v = this.video, a = this.ensureAudio();
    const bins = new Map(), buf = new Float32Array(a.level.fftSize);
    a.monitor.gain.value = 0;
    try {
      await this.seek(start);
      v.playbackRate = 4;
      await this.playSafe();
      const t0 = performance.now();
      await new Promise((ok) => {
        const chk = () => {
          sampleLevel(a.level, buf, bins, Math.floor((v.currentTime - start) * 4));
          onState && onState("Finding the loudest second…", 0.3 * Math.min(1, (v.currentTime - start) / (end - start)));
          if (this.cancelled || v.currentTime >= end || v.ended || performance.now() - t0 > ((end - start) / 4) * 1000 + 20000) return ok();
          requestAnimationFrame(chk);
        };
        chk();
      });
    } finally { v.pause(); v.playbackRate = 1; a.monitor.gain.value = 1; }
    this.checkCancel();
    this.loud.seed(bins);
    return loudestSecond(bins, start);
  }

  // Record [start, end] in real time. onState(msg, frac, detail) reports progress; detail says
  // what a wait is waiting for. Throws, before anything is recorded where it can, instead of
  // handing back an empty file. cancel() stops it at the next step (the error has .cancelled).
  async record(start, end, onState) {
    const v = this.video;
    this.cancelled = false;
    // phase and the two timings are for analytics (ANALYTICS.md): where a render is, how long each part took
    this.phase = "load"; const tLoad = performance.now();
    if (!(end - start >= 2)) throw new Error("the clip window is empty (its end is before its start). Reset it with the buttons and render again");
    this.clipStart = start;
    const mime = pickMime();
    if (mime === null) throw new Error("This browser cannot record video. Use Chrome, Edge or Safari on a computer.");
    this.ensureAudio();
    await this.resumeAudio();
    // A still-live VOD: wait for Twitch to write the window into the recording.
    const tw = Date.now();
    while (this.availableEnd() < end - 0.25) {
      const behind = end - this.availableEnd();
      if (!this.isLive()) { if (this.availableEnd() - start >= 2) { end = this.availableEnd(); break; } throw new Error("that part of the stream isn't in the video"); }
      if (Date.now() - tw > 90000) throw new Error(`that moment isn't in Twitch's recording yet (it's ${Math.ceil(behind)} s ahead of it). Try again in a minute`);
      onState && onState(`Waiting for the live video to catch up (${Math.ceil(behind)} s to go)…`, 0);
      await sleep(1000);
      this.checkCancel();
    }
    await this.seek(start);
    // Pre-buffer the whole window so the recording never freezes on a stall. Never restart the
    // loader while it is working: hls.startLoad() aborts the segment in flight, and calling it
    // every 400 ms meant a 10 s segment that takes longer than that never arrived (2026-11-19).
    //
    // The buffer is sized in seconds here, to the window plus a margin. hls.js's byte figure
    // (maxBufferSize) only ever RAISES the buffer above maxBufferLength, never caps it below, so
    // it is left alone: lifting it to 600 MB (a wrong guess at the 21% stall, 2026-11-19) made a
    // 20 Mbps Kick source hold up to 300 MB.
    if (this.hls) {
      const c = this.hls.config;
      c.maxBufferLength = Math.max(c.maxBufferLength, end - start + 12);
      c.maxMaxBufferLength = Math.max(c.maxMaxBufferLength, c.maxBufferLength);
      c.backBufferLength = Math.max(c.backBufferLength, end - start + 15);
    }
    // No fixed time limit: while bytes arrive the wait goes on and says so; when they stop it
    // says that, restarts the loader up to three times, then fails with the reason. It used to
    // give up silently after 120 s and record a window that was not there.
    const site = /kick/i.test(String(this.url)) ? "Kick" : "Twitch";
    let seen = -1, seenBytes = -1, moved = Date.now(), restarts = 0;
    while (!this.bufferedTo(end)) {
      this.checkCancel();
      const got = this.bufferedEnd(), bytes = this.loadedBytes(), idle = Date.now() - moved;
      // The browser's own buffer is full (a long window of a very high bitrate source): start
      // with what is in; the recorder holds whenever playback has to wait for more.
      if (this.net && this.net.full && got - v.currentTime >= Math.min(15, end - start)) break;
      // Safari (iPhone, iPad and Mac from 17.1) buffers through ManagedMediaSource and stops asking
      // for more once it holds about 30 s, however long the window is: real Mobile Safari sat on
      // "Loading the video… 24%" (measured in the iOS 27 simulator, 2026-11-19). With 8 s or more
      // in hand and nothing arriving for 2.5 s, start; playback pulls the rest as it goes.
      if (idle > 2500 && !(this.net && this.net.fatal) && got - v.currentTime >= Math.min(8, end - start)) break;
      if (got > seen + 0.05 || bytes > seenBytes) { seen = Math.max(seen, got); seenBytes = bytes; moved = Date.now(); }
      else if ((this.net && this.net.fatal) || idle > 20000) {
        if (restarts >= 3) throw new Error(this.net && this.net.fatal ? `${site} refused part of this video (${this.net.fatal}). Try a different clip window` : `the video stopped arriving from ${site}. Check your connection and render again`);
        restarts++;
        if (this.net) this.net.fatal = null;
        if (this.hls) this.hls.startLoad(Math.max(0, v.currentTime));
        moved = Date.now(); seenBytes = this.loadedBytes();
      }
      const detail = idle > 4000 || restarts ? `no data from ${site} for ${Math.round(idle / 1000)} s` + (restarts ? `, retry ${restarts} of 3` : "") : bytes ? `${Math.round(bytes / 1e6)} MB in` : "";
      onState && onState("Loading the video…", Math.max(0, Math.min(1, (got - start) / (end - start))) * 0.3, detail);
      await sleep(400);
    }
    if (this.opts.layout === "split" && (this.opts.punch || fxNeedsLoud(this.opts.camFx)) && this.punchWin !== start + "-" + end) {
      this.phase = "loudest";
      this.punchAt = (await this.findLoudest(start, end, onState)) ?? this.opts.punchFallback ?? null;
      this.punchWin = start + "-" + end;
      await this.seek(start);
    }
    // Quality (board request "Bessere Qualität"): one canvas frame per new SOURCE frame, so a 60 fps
    // stream exports at 60 and a 30 fps one at 30, at 10 Mbps requested (was a fixed 30 fps at 8).
    const stream = new MediaStream([...this.canvas.captureStream(60).getVideoTracks(), ...this.audio.dest.stream.getAudioTracks()]);
    const vbps = this.videoBitrate || 10_000_000; // Chrome on a Mac lands near 2x this at 60 fps (measured), Windows near 1x
    const rvfc = typeof v.requestVideoFrameCallback === "function";
    let frames = 0, recording = true;
    const onFrame = () => { if (!recording) return; this.draw(); frames++; v.requestVideoFrameCallback(onFrame); };
    const rec = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: vbps, audioBitsPerSecond: 192_000, ...(this.bitrateMode ? { videoBitrateMode: this.bitrateMode } : {}) });
    const chunks = [];
    let failed = null, loudest = 0;
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onerror = (e) => { failed = (e && e.error) || new Error("the browser's video encoder stopped"); };
    const stopped = new Promise((ok) => (rec.onstop = ok));
    const onWait = () => { if (rec.state === "recording") rec.pause(); };
    const onPlay = () => { if (rec.state === "paused" && !document.hidden) rec.resume(); };
    // A hidden tab stops drawing frames: hold the video and the recording until it's back.
    let lastT = -1, lastMove = performance.now();
    const onVis = () => {
      lastMove = performance.now();
      if (document.hidden) { v.pause(); if (rec.state === "recording") rec.pause(); onState && onState("Paused: keep this tab open while it records", null); }
      else if (rec.state === "paused") { v.play().catch(() => {}); }
    };
    v.addEventListener("waiting", onWait); v.addEventListener("playing", onPlay); document.addEventListener("visibilitychange", onVis);
    const lv = this.audio.level, buf = new Float32Array(lv.fftSize);
    this.fxHits = 0; this.fxHot = false;
    this.draw();
    rec.start(500);
    const tRec = performance.now();
    this.phase = "record";
    if (rvfc) v.requestVideoFrameCallback(onFrame);
    try {
      await this.playSafe();
      await new Promise((ok) => {
        const tick = () => {
          if (failed) return ok();
          if (!rvfc) { this.draw(); frames++; }
          lv.getFloatTimeDomainData(buf);
          for (let i = 0; i < buf.length; i += 8) loudest = Math.max(loudest, Math.abs(buf[i]));
          // The picture has to keep moving: a recording that waits on video says so, and one that
          // has waited 25 s fails with the reason (it used to sit at one percentage for good).
          const now = performance.now();
          if (v.currentTime > lastT + 0.01) { lastT = v.currentTime; lastMove = now; }
          const held = document.hidden ? 0 : now - lastMove;
          if (this.cancelled) { failed = Object.assign(new Error("cancelled"), { cancelled: true }); return ok(); }
          if (held > 25000) { failed = new Error("the video stopped arriving part-way through the recording. Check your connection and render again"); return ok(); }
          if (!document.hidden) onState && onState("Recording…", 0.3 + 0.7 * Math.min(1, (v.currentTime - start) / (end - start)), held > 2000 ? `waiting for more video (${Math.round(held / 1000)} s)` : "");
          if (v.currentTime >= end || v.ended) return ok();
          requestAnimationFrame(tick);
        };
        tick();
      });
    } finally {
      recording = false;
      v.pause();
      v.removeEventListener("waiting", onWait); v.removeEventListener("playing", onPlay); document.removeEventListener("visibilitychange", onVis);
      if (rec.state !== "inactive") rec.stop();
      await stopped;
    }
    const type = (mime || "video/webm").split(";")[0];
    const blob = new Blob(chunks, { type });
    if (failed) throw failed instanceof Error ? failed : new Error(failed.message || String(failed));
    if (!blob.size) throw new Error("the recording came out empty");
    const secs = end - start;
    const fps = Math.min(60, Math.round(frames / Math.max(1, secs)));
    return { blob, load_ms: Math.round(tRec - tLoad), record_ms: Math.round(performance.now() - tRec), fxHits: this.fxHits, ext: type.includes("mp4") ? "mp4" : "webm", secs, end, fps, mbps: Math.round((blob.size * 8) / secs / 1e5) / 10, sound: loudest > 0.001, source: `${v.videoWidth}×${v.videoHeight}` };
  }

  destroy() { this.stopPreview(); cancelAnimationFrame(this.fxLoop); if (this.hls) this.hls.destroy(); this.video.removeAttribute("src"); }
}

// The part of the source rect that fills a dw x dh frame without stretching (centre crop).
export function coverRect(sx, sy, sw, sh, dw, dh) {
  const sr = sw / sh, dr = dw / dh;
  if (sr > dr) { const nw = sh * dr; sx += (sw - nw) / 2; sw = nw; } else { const nh = sw / dr; sy += (sh - nh) / 2; sh = nh; }
  return { x: sx, y: sy, w: sw, h: sh };
}

function wrap(ctx, text, max) {
  const words = String(text).split(/\s+/), lines = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (ctx.measureText(t).width > max && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function sampleLevel(an, buf, bins, k) {
  an.getFloatTimeDomainData(buf);
  let sum = 0; for (let i = 0; i < buf.length; i += 4) sum += buf[i] * buf[i];
  const e = bins.get(k) || [0, 0]; e[0] += Math.sqrt(sum / (buf.length / 4)); e[1]++; bins.set(k, e);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
