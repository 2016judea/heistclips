// Server-side cut: a window of a Twitch or Kick VOD -> a 1080x1920 H.264/AAC MP4, with ffmpeg.
// The browser renderer (public/js/render.js) is the full editor; this is what the connector
// uses when nobody has the page open. Same three layouts and the same geometry, no chat overlay.
//
// HLS is read here, not by ffmpeg: we fetch the playlist, keep only the segments that cover the
// window, download them side by side, and hand ffmpeg a small local playlist of local files.
// That works the same for a finished VOD and a stream still recording (a playlist without
// ENDLIST makes ffmpeg treat it as live and refuse to seek), it fetches ~5 segments instead of
// walking a 28-hour list, and a stalled CDN read fails in seconds with a retry instead of
// hanging ffmpeg until its 240-second kill (the connector's failures of 2026-11-19: ffmpeg's
// own HLS reader has no read timeout).
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ffmpegStatic from "ffmpeg-static"; // a static import, so Vercel's file tracer ships the module

const here = path.dirname(fileURLToPath(import.meta.url));
export const FONT = path.join(here, "fonts", "Anton-Regular.ttf");
export const MAX_CLIP_S = 60;
export const MIN_CLIP_S = 5;
export const LAYOUTS = ["split", "fit", "crop"];
const W = 1080, H = 1920;
// The encode is ~97% of a cut's time on the function's CPU (measured 2026-11-19: a 30 s fit cut
// spent 0.3 s on playlists, 0.9 s downloading and 62 s encoding at "superfast"). "ultrafast"
// with CABAC and the deblocking filter switched back on encodes about 1.4x faster than
// "superfast" for nearly the same picture and size: against a slow CRF-10 reference of the same
// split cut, SSIM-Y 0.9907 at 5.1 Mbit/s versus 0.9915 at 4.8 for superfast (plain ultrafast:
// 0.9892 at 6.1).
export const X264_PRESET = "ultrafast", X264_PARAMS = "cabac=1:deblock=0,0";
const UA = "Mozilla/5.0 (compatible; heistclips/0.2; +https://heistclips.com/about)";

// On Vercel the binary arrives through "includeFiles" in vercel.json, next to the function.
export function ffmpegPath() {
  const tried = [process.env.FFMPEG_PATH, ffmpegStatic, path.join(process.cwd(), "node_modules/ffmpeg-static/ffmpeg"), path.join(here, "../node_modules/ffmpeg-static/ffmpeg")].filter(Boolean);
  for (const f of tried) if (fs.existsSync(f)) return f;
  throw new Error("ffmpeg binary not found (looked in " + tried.join(", ") + ")");
}

// Every failure carries a short code, so the connector's analytics can say why a cut failed.
const coded = (code, message, extra = {}) => Object.assign(new Error(message), { code, ...extra });

async function getText(url, timeoutMs = 8000) {
  const r = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(timeoutMs) });
  if (!r.ok) throw Object.assign(new Error("playlist " + r.status), { status: r.status });
  return r.text();
}

// Twitch rendition folders to try, best first for the layout. "fit" shows the whole frame
// 1080 px wide, so a 1280-wide 720p rendition already has more pixels than the picture uses
// and decodes in under half the time of the 1080p (or 1440p) source. "split" and "crop" zoom
// into part of the frame, so they keep the largest rendition up to 1080p. A folder that does
// not exist for this stream answers 403 and the next one is used.
export const TWITCH_QUALITIES = {
  fit: ["720p60", "720p30", "720p", "chunked", "480p30", "480p"],
  split: ["1080p60", "1080p30", "1080p", "chunked", "720p60", "720p30", "480p30"],
  crop: ["1080p60", "1080p30", "1080p", "chunked", "720p60", "720p30", "480p30"],
};

// Kick's master playlist gives each rendition's size: take the smallest one that still covers
// what the layout draws (1080 wide for fit, 1080 tall for split and crop), else the largest.
export function rankKickVariants(variants, layout = "fit") {
  const enough = (v) => (layout === "fit" ? v.w >= 1080 : v.h >= 1080);
  return [...variants].sort((a, b) => enough(b) - enough(a) || (enough(a) ? a.h - b.h : b.h - a.h));
}

// Media-playlist URLs to try, best first: [{ url, q }].
export async function playlistUrls(vod, layout = "fit", source = "") {
  if (vod.platform === "kick") {
    if (!vod.source) return [];
    const master = await getText(vod.source);
    if (!/#EXT-X-STREAM-INF/.test(master)) return [{ url: vod.source, q: "kick" }];
    const out = [];
    const lines = master.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/#EXT-X-STREAM-INF:.*?RESOLUTION=(\d+)x(\d+)/);
      if (m && lines[i + 1]) out.push({ w: Number(m[1]), h: Number(m[2]), q: "kick-" + m[2] + "p", url: new URL(lines[i + 1].trim(), vod.source).href });
    }
    return rankKickVariants(out, source === "best" ? "crop" : layout);
  }
  if (!vod.cdn) return [];
  const order = source === "best" ? ["chunked", ...TWITCH_QUALITIES.crop] : TWITCH_QUALITIES[layout] || TWITCH_QUALITIES.fit;
  return order.map((q) => ({ q, url: `https://${vod.cdn.host}.cloudfront.net/${vod.cdn.dir}/${q}/index-dvr.m3u8` }));
}

// Parse a media playlist into [{url, start, dur}] and pick what covers [t0, t1].
export function pickSegments(text, base, t0, t1) {
  const segs = [];
  let t = 0, dur = 0, map = null;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    let m;
    if ((m = line.match(/^#EXTINF:([\d.]+)/))) { dur = Number(m[1]); continue; }
    if ((m = line.match(/^#EXT-X-MAP:URI="([^"]+)"/))) { map = new URL(m[1], base).href; continue; }
    if (line.startsWith("#")) continue;
    // Twitch marks a deleted-audio segment "-unmuted.ts" in the list but serves it as "-muted.ts".
    segs.push({ url: new URL(line.replace(/-unmuted\.ts/, "-muted.ts"), base).href, start: t, dur });
    t += dur;
  }
  const keep = segs.filter((s) => s.start + s.dur > t0 - 0.5 && s.start < t1 + 0.5);
  return { segs: keep, total: t, map, offset: keep.length ? Math.max(0, t0 - keep[0].start) : 0 };
}

// One segment to a local file. A read that stalls is cut off and retried; a 403 on a
// "-muted.ts" name tries the plain name once (Twitch serves either, depending on the VOD's age).
export async function fetchTo(url, file, { timeoutMs = 20000, tries = 3, fetcher = fetch } = {}) {
  let last, swapped = false;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetcher(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(timeoutMs) });
      if (!r.ok) throw Object.assign(new Error("segment " + r.status), { status: r.status });
      const buf = Buffer.from(await r.arrayBuffer());
      await fs.promises.writeFile(file, buf);
      return buf.length;
    } catch (e) {
      last = e;
      if (e.status === 403 || e.status === 404) {
        if (!swapped && /-muted\.ts(\?|$)/.test(url)) { swapped = true; url = url.replace("-muted.ts", ".ts"); i--; continue; }
        break;
      }
    }
  }
  throw last;
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); } }));
  return out;
}

// drawtext reads the hook from a file, so no escaping of chat's punctuation is needed. Anton
// has no emoji; they are dropped rather than drawn as boxes.
export function hookLines(text, maxChars = 22) {
  const clean = String(text || "").replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "").replace(/\s+/g, " ").trim().slice(0, 90);
  if (!clean) return [];
  const lines = [];
  let cur = "";
  for (const w of clean.split(" ")) {
    const t = cur ? cur + " " + w : w;
    if (t.length > maxChars && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

// The filter graph for one layout. Geometry mirrors Clipper.draw() in public/js/render.js.
// Segments keep the stream's own clock (a segment 640 s in starts at pts 640 s, and Twitch's
// fMP4 lists do too), so the window is trimmed inside the graph after rebasing to zero. An
// input-side -ss/-t against those timestamps wrote a 225-byte file with no frames.
export function filterGraph({ layout = "fit", cam = "tr", camSize = 0.28, pan = 0, hookFiles = [], offset = 0, dur = 30, audio = true }) {
  pan = Math.max(-1, Math.min(1, Number(pan) || 0));
  camSize = Math.max(0.15, Math.min(0.45, Number(camSize) || 0.28));
  let g, hookY;
  if (layout === "crop") {
    g = `[vin]crop=ih*9/16:ih:(iw-ih*9/16)/2*(1+${pan}):0,scale=${W}:${H}[v0]`;
    hookY = 210;
  } else if (layout === "split") {
    const camH = Math.round(H * 0.38), gh = H - camH;
    const cx = cam[1] === "l" ? "0" : `iw-iw*${camSize}`, cy = cam[0] === "t" ? "0" : `ih-iw*${camSize}*9/16*1.25`;
    g = `[vin]split=2[a][b];` +
      `[a]crop=iw*${camSize}:iw*${camSize}*9/16*1.25:${cx}:${cy},scale=${W}:${camH}:force_original_aspect_ratio=increase,crop=${W}:${camH}[cam];` +
      `[b]crop=ih*${W}/${gh}:ih:(iw-ih*${W}/${gh})/2*(1+${pan}):0,scale=${W}:${gh}[game];` +
      `[cam][game]vstack=inputs=2,drawbox=x=0:y=${camH - 3}:w=${W}:h=6:color=black:t=fill[v0]`;
    hookY = 120;
  } else {
    g = `[vin]split=2[a][b];` +
      `[a]crop=ih*9/16:ih,scale=54:96,scale=${W}:${H}:flags=bilinear,eq=brightness=-0.25[bg];` +
      `[b]scale=${W}:-2[fg];[bg][fg]overlay=0:(H-h)/2[v0]`;
    hookY = 300;
  }
  const o = Number(offset).toFixed(3), d = Number(dur).toFixed(3);
  g = `[0:v:0]setpts=PTS-STARTPTS,trim=start=${o}:duration=${d},setpts=PTS-STARTPTS,fps=30[vin];` + g;
  if (audio) g += `;[0:a:0]asetpts=PTS-STARTPTS,atrim=start=${o}:duration=${d},asetpts=PTS-STARTPTS,aresample=async=1[aud]`;
  const size = hookFiles.length >= 3 ? 78 : 92, lh = Math.round(size * 1.12);
  let last = "v0";
  hookFiles.forEach((f, i) => {
    const next = "h" + i;
    g += `;[${last}]drawtext=fontfile='${FONT.replace(/'/g, "")}':textfile='${f}':fontsize=${size}:fontcolor=white:borderw=${Math.round(size * 0.1)}:bordercolor=black:x=(w-text_w)/2:y=${hookY + i * lh}[${next}]`;
    last = next;
  });
  return { graph: g + `;[${last}]format=yuv420p[v]`, out: "[v]", aout: audio ? "[aud]" : null };
}

function run(bin, args, { timeoutMs = 150000 } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => { err = (err + d).slice(-4000); });
    const timer = setTimeout(() => { p.kill("SIGKILL"); reject(coded("ffmpeg_timeout", "The encoder ran out of time on this window.")); }, timeoutMs);
    p.on("error", (e) => { clearTimeout(timer); reject(coded("ffmpeg_spawn", e.message)); });
    p.on("close", (code) => { clearTimeout(timer); code === 0 ? resolve(err) : reject(coded("ffmpeg", "ffmpeg exit " + code + ": " + err.split("\n").filter(Boolean).slice(-3).join(" | "))); });
  });
}

// One encode at a time per function instance. Vercel sends cuts that overlap to the same
// instance, and x264 already uses every core it is given, so two encodes side by side each run
// at half speed and both finish late. In turn, the first is done in its normal time and the
// second right after it: on 2026-11-19, three overlapping 38 s cuts each took 45 to 57 s to
// encode; alone the same cut takes about 14 s. A cut never waits more than MAX_TURN_WAIT_MS
// for its turn, so a stuck encode cannot hold the line.
export const MAX_TURN_WAIT_MS = 100000;
let turn = Promise.resolve();
export function inTurn(fn, maxWaitMs = MAX_TURN_WAIT_MS) {
  const before = turn;
  let release;
  turn = new Promise((r) => { release = r; });
  // The timer is cleared the moment the turn comes, so no timer outlives the wait.
  const waited = new Promise((r) => { const t = setTimeout(r, maxWaitMs); before.then(() => { clearTimeout(t); r(); }); });
  return waited.then(fn).finally(release);
}

// Cut [start, end] seconds of a VOD.
// Returns { dir, file, bytes, seconds, width, height, layout, source_quality, segments, ms, timing }
// where timing = { playlist_ms, download_ms, queue_ms, encode_ms, source_mb }. The caller deletes `dir`.
// `source: "best"` forces the largest rendition (used to compare quality); `x264` overrides
// encoder settings for a measurement run.
export async function cutClip(vod, { start, end, layout = "fit", cam = "tr", camSize = 0.28, pan = 0, hook = "", preset = X264_PRESET, source = "", x264 = {} } = {}) {
  start = Math.max(0, Number(start));
  end = Number(end);
  if (!isFinite(start) || !isFinite(end) || end - start < MIN_CLIP_S) throw coded("bad_window", `A clip needs at least ${MIN_CLIP_S} seconds (start and end are seconds into the stream).`);
  if (end - start > MAX_CLIP_S) throw coded("too_long", `A clip can be at most ${MAX_CLIP_S} seconds.`);
  if (!LAYOUTS.includes(layout)) layout = "fit";
  const t0 = Date.now();
  const timing = {};
  let urls;
  try { urls = await playlistUrls(vod, layout, source); }
  catch (e) { throw coded("playlist", "Could not read this stream's video (" + e.message + ")."); }
  if (!urls.length) throw coded("not_public", "This stream's video is not public (subscriber-only or deleted), so it cannot be cut.");
  // All candidate playlists at once; the first one in preference order that covers the window wins.
  const lists = await Promise.all(urls.map((u) => getText(u.url).then((text) => ({ text }), (err) => ({ err }))));
  let pick = null, quality = null, lastErr = null;
  for (let i = 0; i < urls.length && !pick; i++) {
    if (lists[i].err) { lastErr = lastErr && !lastErr.status ? lastErr : lists[i].err; continue; }
    const p = pickSegments(lists[i].text, urls[i].url, start, end);
    if (p.segs.length) { pick = p; quality = urls[i].q; }
    else lastErr = coded("past_end", `That window (${Math.round(start)}s-${Math.round(end)}s) is past the end of the recording (${Math.round(p.total)}s so far).`);
  }
  if (!pick) throw lastErr && !lastErr.status && lastErr.code ? lastErr : coded("playlist", "Could not read this stream's video" + (lastErr ? " (" + lastErr.message + ")" : "") + ".");
  timing.playlist_ms = Date.now() - t0;

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hc-cut-"));
  try {
    // Segments side by side (ffmpeg's HLS reader fetches one at a time, and never times out).
    const t1 = Date.now();
    const ext = (u) => (new URL(u).pathname.match(/\.(ts|mp4|m4s|m4v|aac)$/i) || [".ts"])[0].replace(/^(?!\.)/, ".");
    let sizes, mapFile = null;
    try {
      if (pick.map) { mapFile = "init" + ext(pick.map); await fetchTo(pick.map, path.join(dir, mapFile)); }
      sizes = await pool(pick.segs, 6, (s, i) => fetchTo(s.url, path.join(dir, "seg" + i + ext(s.url))));
    } catch (e) {
      throw coded(e.name === "TimeoutError" || e.name === "AbortError" ? "segment_timeout" : "segment", vod.status === "RECORDING"
        ? "The video for that window is not available yet (the stream is still recording it). Try again in a minute."
        : "The video for that window could not be downloaded (" + e.message + ").");
    }
    timing.download_ms = Date.now() - t1;
    timing.source_mb = Math.round(sizes.reduce((a, b) => a + b, 0) / 1e5) / 10;

    const list = ["#EXTM3U", "#EXT-X-VERSION:6", "#EXT-X-TARGETDURATION:" + Math.ceil(Math.max(...pick.segs.map((s) => s.dur))), "#EXT-X-PLAYLIST-TYPE:VOD"];
    if (mapFile) list.push(`#EXT-X-MAP:URI="${mapFile}"`);
    pick.segs.forEach((s, i) => list.push("#EXTINF:" + s.dur.toFixed(3) + ",", "seg" + i + ext(s.url)));
    list.push("#EXT-X-ENDLIST");
    const m3u8 = path.join(dir, "in.m3u8");
    fs.writeFileSync(m3u8, list.join("\n"));
    const hookFiles = hookLines(hook).map((ln, i) => { const f = path.join(dir, `hook${i}.txt`); fs.writeFileSync(f, ln); return f; });
    const file = path.join(dir, "clip.mp4");
    const dur = end - start;
    let t2 = Date.now();
    const encode = (audio) => {
      const { graph, out, aout } = filterGraph({ layout, cam, camSize, pan, hookFiles, offset: pick.offset, dur, audio });
      return run(ffmpegPath(), [
        "-hide_banner", "-loglevel", "error", "-y",
        "-protocol_whitelist", "file,crypto", "-allowed_extensions", "ALL",
        "-i", m3u8,
        "-filter_complex", graph, "-map", out, ...(aout ? ["-map", aout, "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2"] : ["-an"]),
        "-c:v", "libx264", "-preset", x264.preset || preset, "-crf", String(x264.crf || 22), "-maxrate", x264.maxrate || "9M", "-bufsize", "18M", "-profile:v", "high", "-g", "60",
        ...((x264.params === undefined ? (x264.preset ? "" : X264_PARAMS) : x264.params) ? ["-x264-params", x264.params === undefined ? X264_PARAMS : x264.params] : []),
        // No tool tags in the file: campaigns reject clips whose metadata names an editor.
        "-map_metadata", "-1", "-fflags", "+bitexact", "-flags:v", "+bitexact", "-flags:a", "+bitexact",
        "-movflags", "+faststart", file,
      ]);
    };
    const tq = Date.now();
    await inTurn(async () => {
      timing.queue_ms = Date.now() - tq; // time spent waiting for another cut's encode to finish
      t2 = Date.now();
      try { await encode(true); }
      catch (e) { if (!/matches no streams|Stream specifier/i.test(e.message)) throw e; await encode(false); } // a stream with no audio track
      timing.encode_ms = Date.now() - t2;
    });
    const bytes = fs.statSync(file).size;
    // An MP4 with no frames is a few hundred bytes and ffmpeg still exits 0. Never hand that out.
    if (bytes < 20000) throw coded("empty", "The cut came out empty (the video for that window is not available yet). Nothing was charged.");
    return { dir, file, bytes, seconds: dur, width: W, height: H, layout, source_quality: quality, segments: pick.segs.length, ms: Date.now() - t0, timing };
  } catch (e) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw e;
  }
}
