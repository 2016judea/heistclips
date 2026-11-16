// Clip entity: cut a moment to 9:16 in the browser. hls.js reads the VOD through heistclips'
// same-origin /tv/ proxy, a canvas draws the layout, hook and chat, and MediaRecorder encodes
// in real time on the visitor's own hardware. Nothing is uploaded; nothing costs us compute.

export const W = 1080, H = 1920;

export function pickMime() {
  const opts = ["video/mp4;codecs=avc1.640028,mp4a.40.2", "video/mp4;codecs=avc1.4d002a,mp4a.40.2", "video/mp4;codecs=avc1,mp4a", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  if (typeof MediaRecorder === "undefined") return null;
  return opts.find((t) => MediaRecorder.isTypeSupported(t)) || "";
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
    this.opts = { layout: "fit", hook: "", hookMode: "always", chat: true, cam: "tr", camSize: 0.28, pan: 0 };
    this.chat = []; this.audio = null; this.src = null; this.hls = null; this.loop = null;
  }

  async load(url, start) {
    this.url = url;
    if (this.hls) { this.hls.destroy(); this.hls = null; }
    const v = this.video;
    if (window.Hls && window.Hls.isSupported()) {
      const hls = new window.Hls({ maxBufferLength: 75, maxMaxBufferLength: 150, startPosition: Math.max(0, start), enableWorker: true, backBufferLength: 30 });
      this.hls = hls;
      await new Promise((ok, bad) => {
        hls.on(window.Hls.Events.MANIFEST_PARSED, (e, d) => {
          // A master playlist (Kick) has several renditions: take the sharpest up to 1080p.
          const lv = (d && d.levels) || [];
          if (lv.length > 1) { let best = 0; lv.forEach((l, i) => { if ((l.height || 0) <= 1080 && (l.height || 0) >= (lv[best].height || 0)) best = i; }); hls.currentLevel = best; }
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
  }

  seek(t) {
    const v = this.video;
    return new Promise((ok) => {
      const done = () => { v.removeEventListener("seeked", done); setTimeout(() => { this.draw(); ok(); }, 60); };
      v.addEventListener("seeked", done);
      v.currentTime = Math.max(0, t);
      setTimeout(done, 8000);
    });
  }

  bufferedTo(t) {
    const b = this.video.buffered, now = this.video.currentTime;
    for (let i = 0; i < b.length; i++) if (b.start(i) <= now + 0.5 && b.end(i) >= t - 0.3) return true;
    return false;
  }

  bufferedEnd() {
    const b = this.video.buffered, now = this.video.currentTime;
    for (let i = 0; i < b.length; i++) if (b.start(i) <= now + 0.5) return b.end(i);
    return now;
  }

  // ---- drawing --------------------------------------------------------------------------
  draw(tOverride) {
    const { ctx, video: v, opts: o } = this;
    const vw = v.videoWidth || 1920, vh = v.videoHeight || 1080;
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
    if (!v.videoWidth) return;
    if (o.layout === "crop") {
      const sw = vh * 9 / 16, sx = Math.max(0, Math.min(vw - sw, (vw - sw) / 2 + o.pan * (vw - sw) / 2));
      ctx.drawImage(v, sx, 0, sw, vh, 0, 0, W, H);
    } else if (o.layout === "split") {
      const camH = Math.round(H * 0.38);
      const cw = vw * o.camSize, ch = cw * 9 / 16 * 1.25;
      const cx = o.cam[1] === "l" ? 0 : vw - cw, cy = o.cam[0] === "t" ? 0 : vh - ch;
      coverDraw(ctx, v, cx, cy, cw, ch, 0, 0, W, camH);
      const gh = H - camH, gsw = vh * W / gh;
      const gsx = Math.max(0, Math.min(vw - gsw, (vw - gsw) / 2 + o.pan * (vw - gsw) / 2));
      ctx.drawImage(v, gsx, 0, gsw, vh, 0, camH, W, gh);
      ctx.fillStyle = "#000"; ctx.fillRect(0, camH - 3, W, 6);
    } else {
      this.sctx.drawImage(v, (vw - vh * 9 / 16) / 2, 0, vh * 9 / 16, vh, 0, 0, 54, 96);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "low";
      ctx.globalAlpha = 0.55; ctx.drawImage(this.small, 0, 0, W, H); ctx.globalAlpha = 1;
      const fh = W * vh / vw, fy = (H - fh) / 2;
      ctx.drawImage(v, 0, 0, vw, vh, 0, fy, W, fh);
    }
    const t = tOverride != null ? tOverride : v.currentTime;
    const showHook = o.hook && (o.hookMode === "always" || t - this.clipStart < 3.2);
    if (showHook) this.drawHook(o.hook, o.layout === "fit" ? 300 : o.layout === "split" ? 120 : 210);
    if (o.chat && this.chat.length) this.drawChat(t, o.layout === "split" ? H - 520 : H - 560);
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

  ensureAudio() {
    if (this.audio) return this.audio;
    const AC = window.AudioContext || window.webkitAudioContext;
    const ac = new AC();
    const src = ac.createMediaElementSource(this.video);
    const dest = ac.createMediaStreamDestination();
    src.connect(dest); src.connect(ac.destination);
    this.audio = { ac, dest };
    return this.audio;
  }

  async playWindow(start, end) {
    const v = this.video;
    this.clipStart = start;
    this.ensureAudio(); await this.audio.ac.resume();
    if (Math.abs(v.currentTime - start) > 0.3) await this.seek(start);
    this.startPreview();
    await v.play();
    const stopAt = () => new Promise((ok) => { const chk = () => { if (v.currentTime >= end || v.paused) { v.pause(); ok(); } else requestAnimationFrame(chk); }; chk(); });
    await stopAt();
    this.stopPreview(); this.draw();
  }

  // Record [start, end] in real time. onState(msg, frac) reports progress.
  async record(start, end, onState) {
    const v = this.video;
    this.clipStart = start;
    const mime = pickMime();
    if (mime === null) throw new Error("This browser cannot record video. Use Chrome, Edge or Safari on a computer.");
    this.ensureAudio(); await this.audio.ac.resume();
    await this.seek(start);
    // Pre-buffer the whole window so the recording never freezes on a stall.
    const t0 = Date.now();
    while (!this.bufferedTo(end) && Date.now() - t0 < 90000) {
      const got = this.bufferedEnd() - start;
      onState && onState("Loading the video…", Math.max(0, Math.min(1, got / (end - start))) * 0.3);
      if (this.hls) this.hls.startLoad(Math.max(0, start));
      await sleep(400);
    }
    const stream = new MediaStream([...this.canvas.captureStream(30).getVideoTracks(), ...this.audio.dest.stream.getAudioTracks()]);
    const rec = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: 8_000_000, audioBitsPerSecond: 160_000 });
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const stopped = new Promise((ok) => (rec.onstop = ok));
    const onWait = () => { if (rec.state === "recording") rec.pause(); };
    const onPlay = () => { if (rec.state === "paused") rec.resume(); };
    v.addEventListener("waiting", onWait); v.addEventListener("playing", onPlay);
    this.draw();
    rec.start(500);
    await v.play();
    await new Promise((ok) => {
      const tick = () => {
        this.draw();
        onState && onState("Recording…", 0.3 + 0.7 * Math.min(1, (v.currentTime - start) / (end - start)));
        if (v.currentTime >= end || v.ended) return ok();
        requestAnimationFrame(tick);
      };
      tick();
    });
    v.pause();
    v.removeEventListener("waiting", onWait); v.removeEventListener("playing", onPlay);
    rec.stop(); await stopped;
    const type = (mime || "video/webm").split(";")[0];
    return { blob: new Blob(chunks, { type }), ext: type.includes("mp4") ? "mp4" : "webm" };
  }

  destroy() { this.stopPreview(); if (this.hls) this.hls.destroy(); this.video.removeAttribute("src"); }
}

function coverDraw(ctx, img, sx, sy, sw, sh, dx, dy, dw, dh) {
  const sr = sw / sh, dr = dw / dh;
  if (sr > dr) { const nw = sh * dr; sx += (sw - nw) / 2; sw = nw; } else { const nh = sw / dr; sy += (sh - nh) / 2; sh = nh; }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
