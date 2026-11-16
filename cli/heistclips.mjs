#!/usr/bin/env node
// heistclips CLI: the local, open-source clipper. Finds the moments a Twitch stream's chat
// exploded over and cuts them to 9:16 with local ffmpeg. No account, no upload, no API key.
//
//   heistclips moments <twitch-channel|kick.com/name|vod-url> [--n 8] [--json]
//   heistclips cut <vod-url|vod-id> --start 1:02:03 --end 1:02:40 [--layout split|fit|crop] [--cam tr] [--hook "text"] [--out clip.mp4]
//   heistclips auto <channel|vod> [--n 3] [--layout split] [--dir ./clips]      find + cut the top N, one file per hook
//   heistclips campaigns [--filter gta|gaming|all] [--n 10]                     who pays most per clip right now
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { parseInput, getChannel, getVod, findMoments, clock } from "../public/js/twitch.js";
import { getKickChannel, getKickVod } from "../public/js/kick.js";

const argv = process.argv.slice(2);
const cmd = argv[0];
const pos = argv.filter((a, i) => i > 0 && !a.startsWith("--") && !(argv[i - 1] || "").startsWith("--"));
const opt = (k, d) => { const i = argv.indexOf("--" + k); return i >= 0 ? (argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : true) : d; };
const secs = (s) => String(s).split(":").reduce((a, x) => a * 60 + Number(x), 0);
const log = (...a) => process.stderr.write(a.join(" ") + "\n");

async function resolveVod(src) {
  const inp = parseInput(src);
  if (inp.kind === "vod") return getVod(inp.id);
  if (inp.kind === "channel") {
    const c = await getChannel(inp.login);
    if (!c) throw new Error("no Twitch channel " + inp.login);
    return c.live_vod || c.vods[0];
  }
  if (inp.kind === "kick") {
    const c = await getKickChannel(inp.login);
    if (!c) throw new Error("no Kick channel " + inp.login);
    return c.live_vod || c.vods[0];
  }
  if (inp.kind === "kickvod") return getKickVod(inp.id);
  throw new Error("pass a Twitch or Kick channel, or a VOD link");
}

async function moments(src, n) {
  const vod = await resolveVod(src);
  if (!vod) throw new Error("no saved stream to read");
  log(`reading chat: ${vod.channel_name} – ${vod.title} (${clock(vod.length)})`);
  const r = await findMoments(vod, { k: n + 3, onProgress: (d, t) => { if (d % 200 === 0 || d === t) log(`  ${d}/${t} chat pages`); } });
  return { vod, moments: r.moments.slice(0, n) };
}

// ---- cutting ------------------------------------------------------------------------------
async function playlist(vod, quality = "chunked") {
  let url;
  if (vod.platform === "kick") {
    const master = await (await fetch(vod.source)).text();
    const v = master.split("\n").find((l) => l && !l.startsWith("#"));
    url = new URL(v, vod.source).href;
  } else {
    if (!vod.cdn) throw new Error("this VOD's video is not public");
    url = `https://${vod.cdn.host}.cloudfront.net/${vod.cdn.dir}/${quality}/index-dvr.m3u8`;
  }
  const base = url.slice(0, url.lastIndexOf("/") + 1);
  const r = await fetch(url);
  if (!r.ok) throw new Error("playlist " + r.status);
  const lines = (await r.text()).split("\n");
  const segs = []; let t = 0, dur = 0;
  for (const ln of lines) {
    if (ln.startsWith("#EXTINF:")) dur = parseFloat(ln.slice(8));
    else if (ln && !ln.startsWith("#")) { segs.push({ url: base + ln.trim(), start: t, dur }); t += dur; }
  }
  return segs;
}

function fontFile() {
  for (const f of ["/System/Library/Fonts/Supplemental/Arial Black.ttf", "/System/Library/Fonts/Supplemental/Impact.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf", "C:/Windows/Fonts/ariblk.ttf"]) if (fs.existsSync(f)) return f;
  return null;
}

function wrapHook(text, max = 22) {
  const words = String(text).split(/\s+/); const lines = []; let cur = "";
  for (const w of words) { if ((cur + " " + w).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = (cur + " " + w).trim(); }
  if (cur) lines.push(cur);
  return lines.slice(0, 3).join("\n");
}

export async function cut(vod, start, end, { layout = "split", cam = "tr", camSize = 0.28, hook = "", out }) {
  const segs = (await playlist(vod)).filter((s) => s.start + s.dur > start && s.start < end);
  if (!segs.length) throw new Error("that window is outside the stream");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "heistclips-"));
  const list = [];
  for (const [i, s] of segs.entries()) {
    const r = await fetch(s.url);
    if (!r.ok) throw new Error("segment " + r.status);
    const f = path.join(tmp, `s${i}.ts`);
    fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
    list.push(`file '${f}'`);
  }
  fs.writeFileSync(path.join(tmp, "list.txt"), list.join("\n"));
  const ss = start - segs[0].start, d = end - start;
  const cx = cam[1] === "l" ? "0" : `iw-iw*${camSize}`, cy = cam[0] === "t" ? "0" : `ih-iw*${camSize}*0.703`;
  const graphs = {
    crop: `[0:v]crop=ih*9/16:ih,scale=1080:1920,setsar=1[v]`,
    fit: `[0:v]split[a][b];[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=30:4,eq=brightness=-0.2[bg];[b]scale=1080:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1[v]`,
    split: `[0:v]split[a][b];[a]crop=iw*${camSize}:iw*${camSize}*0.703:${cx}:${cy},scale=1080:730:force_original_aspect_ratio=increase,crop=1080:730[c];[b]crop=ih*1080/1190:ih,scale=1080:1190[g];[c][g]vstack,setsar=1[v]`,
  };
  let g = graphs[layout] || graphs.split;
  const font = fontFile();
  const hasText = /\bdrawtext\b/.test(spawnSync("ffmpeg", ["-hide_banner", "-filters"], { encoding: "utf8" }).stdout || "");
  if (hook && !hasText) log("note: this ffmpeg has no drawtext filter (built without freetype), so the hook is not burned in. Hook: " + hook);
  if (hook && font && hasText) {
    fs.writeFileSync(path.join(tmp, "hook.txt"), wrapHook(hook));
    const y = layout === "fit" ? 300 : layout === "split" ? 110 : 200;
    g = g.replace(/\[v\]$/, `[pre];[pre]drawtext=fontfile='${font}':textfile='${path.join(tmp, "hook.txt")}':fontsize=80:fontcolor=white:borderw=12:bordercolor=black:line_spacing=10:x=(w-text_w)/2:y=${y}[v]`);
  }
  out = out || `${vod.channel}-${Math.floor(start)}-${layout}.mp4`;
  const args = ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", path.join(tmp, "list.txt"), "-ss", String(ss), "-t", String(d),
    "-filter_complex", g, "-map", "[v]", "-map", "0:a?", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-r", "30", "-c:a", "aac", "-b:a", "160k",
    "-map_metadata", "-1", "-movflags", "+faststart", out];
  const r = spawnSync("ffmpeg", args, { stdio: ["ignore", "inherit", "inherit"] });
  fs.rmSync(tmp, { recursive: true, force: true });
  if (r.status !== 0) throw new Error("ffmpeg failed (is ffmpeg installed?)");
  return out;
}

async function main() {
  if (!cmd || cmd === "help" || cmd === "--help") {
    console.log(fs.readFileSync(new URL(import.meta.url)).toString().split("\n").slice(1, 9).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
    return;
  }
  if (cmd === "moments") {
    const r = await moments(pos[0], Number(opt("n", 8)));
    if (opt("json")) return console.log(JSON.stringify(r.moments.map(({ chat, ...m }) => m), null, 1));
    for (const [i, m] of r.moments.entries()) {
      console.log(`${i + 1}. ${clock(m.t_start)}–${clock(m.t_end)}  chat ${m.chat_ratio}x  ${m.event_type}  music:${m.music_risk.level}  ${m.phrase ? "“" + m.phrase.text + "”" : ""}`);
      console.log(`   hook: ${m.hooks[0]}   watch: ${m.url}`);
    }
    return;
  }
  if (cmd === "cut") {
    const vod = await resolveVod(pos[0]);
    const out = await cut(vod, secs(opt("start")), secs(opt("end")), { layout: opt("layout", "split"), cam: opt("cam", "tr"), hook: opt("hook", ""), out: opt("out") });
    return console.log(out);
  }
  if (cmd === "auto") {
    const n = Number(opt("n", 3)), dir = opt("dir", "clips");
    fs.mkdirSync(dir, { recursive: true });
    const r = await moments(pos[0], n);
    for (const [i, m] of r.moments.entries()) {
      if (m.music_risk.level === "high") { log(`skip #${i + 1}: ${m.music_risk.why}`); continue; }
      const out = path.join(dir, `${r.vod.channel}-${i + 1}-${Math.floor(m.t_start)}.mp4`);
      log(`cutting #${i + 1} ${clock(m.t_start)}–${clock(m.t_end)} …`);
      await cut(r.vod, m.t_start, m.t_end, { layout: opt("layout", "split"), cam: opt("cam", "tr"), hook: m.hooks[0], out });
      console.log(out);
    }
    return;
  }
  if (cmd === "campaigns") {
    const r = await fetch(`https://heistclips.com/api/campaigns?filter=${opt("filter", "gaming")}&limit=${opt("n", 10)}`);
    const d = await r.json();
    for (const c of d.campaigns) console.log(`${c.rank}. ${c.expected_per_clip != null ? "$" + c.expected_per_clip.toFixed(2) + "/clip" : "new"}  ${c.title}  ($${c.rate_per_1k ?? c.per_post}/${c.per_post != null ? "post" : "1k"}, cap $${c.cap_per_clip ?? "–"}, $${Math.round(c.budget_left)} left)  ${c.url}`);
    return;
  }
  throw new Error("unknown command " + cmd);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith("heistclips.mjs")) main().catch((e) => { log("error:", e.message); process.exit(1); });
