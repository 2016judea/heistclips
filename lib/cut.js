// Server-side cut: a window of a Twitch or Kick VOD -> a 1080x1920 H.264/AAC MP4, with ffmpeg.
// The browser renderer (public/js/render.js) is the full editor; this is what the connector
// uses when nobody has the page open. Same three layouts and the same geometry, no chat overlay.
//
// HLS is read here, not by ffmpeg: we fetch the playlist, keep only the segments that cover the
// window, and hand ffmpeg a small local playlist. That works the same for a finished VOD and a
// stream still recording (a playlist without ENDLIST makes ffmpeg treat it as live and refuse
// to seek), and it downloads ~5 segments instead of walking a 28-hour list.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ffmpegStatic from "ffmpeg-static"; // a static import, so Vercel's file tracer ships the module

const here = path.dirname(fileURLToPath(import.meta.url));
export const FONT = path.join(here, "fonts", "Anton-Regular.ttf");
// Production takes about twice the clip's length to cut (38 s clip: 68 s, 2026-11-19), and an
// assistant waits about two minutes for a tool, so a server cut stops at 60 s.
export const MAX_CLIP_S = 60;
export const MIN_CLIP_S = 5;
export const LAYOUTS = ["split", "fit", "crop"];
const W = 1080, H = 1920;
const UA = "Mozilla/5.0 (compatible; heistclips/0.2; +https://heistclips.com/about)";

// On Vercel the binary arrives through "includeFiles" in vercel.json, next to the function.
export function ffmpegPath() {
  const tried = [process.env.FFMPEG_PATH, ffmpegStatic, path.join(process.cwd(), "node_modules/ffmpeg-static/ffmpeg"), path.join(here, "../node_modules/ffmpeg-static/ffmpeg")].filter(Boolean);
  for (const f of tried) if (fs.existsSync(f)) return f;
  throw new Error("ffmpeg binary not found (looked in " + tried.join(", ") + ")");
}

async function getText(url) {
  const r = await fetch(url, { headers: { "user-agent": UA } });
  if (!r.ok) throw Object.assign(new Error("playlist " + r.status), { status: r.status });
  return r.text();
}

// Media-playlist URLs to try, best first.
export async function playlistUrls(vod) {
  if (vod.platform === "kick") {
    if (!vod.source) return [];
    const master = await getText(vod.source);
    if (!/#EXT-X-STREAM-INF/.test(master)) return [vod.source];
    const out = [];
    const lines = master.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/#EXT-X-STREAM-INF:.*?RESOLUTION=(\d+)x(\d+)/);
      if (m && lines[i + 1]) out.push({ h: Number(m[2]), url: new URL(lines[i + 1].trim(), vod.source).href });
    }
    // 1080 first, then down; anything above 1080 is wasted on a 1080-wide clip.
    return out.sort((a, b) => (a.h > 1080) - (b.h > 1080) || b.h - a.h).map((x) => x.url);
  }
  if (!vod.cdn) return [];
  return ["chunked", "720p60", "720p30", "480p30"].map((q) => `https://${vod.cdn.host}.cloudfront.net/${vod.cdn.dir}/${q}/index-dvr.m3u8`);
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

function run(bin, args, { timeoutMs = 240000 } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => { err = (err + d).slice(-4000); });
    const timer = setTimeout(() => { p.kill("SIGKILL"); reject(new Error("ffmpeg timed out")); }, timeoutMs);
    p.on("error", (e) => { clearTimeout(timer); reject(e); });
    p.on("close", (code) => { clearTimeout(timer); code === 0 ? resolve(err) : reject(new Error("ffmpeg exit " + code + ": " + err.split("\n").filter(Boolean).slice(-3).join(" | "))); });
  });
}

// Cut [start, end] seconds of a VOD. Returns { file, bytes, seconds, width, height, source_quality, ms }.
// The caller deletes `dir` when done.
export async function cutClip(vod, { start, end, layout = "fit", cam = "tr", camSize = 0.28, pan = 0, hook = "", preset = "superfast" } = {}) {
  start = Math.max(0, Number(start));
  end = Number(end);
  if (!isFinite(start) || !isFinite(end) || end - start < MIN_CLIP_S) throw new Error(`A clip needs at least ${MIN_CLIP_S} seconds (start and end are seconds into the stream).`);
  if (end - start > MAX_CLIP_S) throw new Error(`A clip can be at most ${MAX_CLIP_S} seconds.`);
  if (!LAYOUTS.includes(layout)) layout = "fit";
  const t0 = Date.now();
  const urls = await playlistUrls(vod);
  if (!urls.length) throw new Error("This stream's video is not public (subscriber-only or deleted), so it cannot be cut.");
  let pick = null, quality = null, lastErr = null;
  for (const u of urls) {
    try {
      const p = pickSegments(await getText(u), u, start, end);
      if (p.segs.length) { pick = p; quality = vod.platform === "kick" ? "kick" : u.split("/").slice(-2)[0]; break; }
      lastErr = new Error(`That window (${Math.round(start)}s-${Math.round(end)}s) is past the end of the recording (${Math.round(p.total)}s so far).`);
    } catch (e) { lastErr = e; }
  }
  if (!pick) throw lastErr && !lastErr.status ? lastErr : new Error("Could not read this stream's video" + (lastErr ? " (" + lastErr.message + ")" : "") + ".");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hc-cut-"));
  try {
    const list = ["#EXTM3U", "#EXT-X-VERSION:6", "#EXT-X-TARGETDURATION:" + Math.ceil(Math.max(...pick.segs.map((s) => s.dur))), "#EXT-X-PLAYLIST-TYPE:VOD"];
    if (pick.map) list.push(`#EXT-X-MAP:URI="${pick.map}"`);
    for (const s of pick.segs) list.push("#EXTINF:" + s.dur.toFixed(3) + ",", s.url);
    list.push("#EXT-X-ENDLIST");
    const m3u8 = path.join(dir, "in.m3u8");
    fs.writeFileSync(m3u8, list.join("\n"));
    const hookFiles = hookLines(hook).map((ln, i) => { const f = path.join(dir, `hook${i}.txt`); fs.writeFileSync(f, ln); return f; });
    const file = path.join(dir, "clip.mp4");
    const dur = end - start;
    const encode = (audio) => {
      const { graph, out, aout } = filterGraph({ layout, cam, camSize, pan, hookFiles, offset: pick.offset, dur, audio });
      return run(ffmpegPath(), [
        "-hide_banner", "-loglevel", "error", "-y",
        "-protocol_whitelist", "file,http,https,tcp,tls,crypto", "-allowed_extensions", "ALL",
        "-i", m3u8,
        "-filter_complex", graph, "-map", out, ...(aout ? ["-map", aout, "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2"] : ["-an"]),
        "-c:v", "libx264", "-preset", preset, "-crf", "22", "-maxrate", "9M", "-bufsize", "18M", "-profile:v", "high", "-g", "60",
        // No tool tags in the file: campaigns reject clips whose metadata names an editor.
        "-map_metadata", "-1", "-fflags", "+bitexact", "-flags:v", "+bitexact", "-flags:a", "+bitexact",
        "-movflags", "+faststart", file,
      ]);
    };
    try { await encode(true); }
    catch (e) { if (!/matches no streams|Stream specifier/i.test(e.message)) throw e; await encode(false); } // a stream with no audio track
    const bytes = fs.statSync(file).size;
    // An MP4 with no frames is a few hundred bytes and ffmpeg still exits 0. Never hand that out.
    if (bytes < 20000) throw new Error("The cut came out empty (the video for that window is not available yet). Nothing was charged.");
    return { dir, file, bytes, seconds: dur, width: W, height: H, layout, source_quality: quality, segments: pick.segs.length, ms: Date.now() - t0 };
  } catch (e) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw e;
  }
}
