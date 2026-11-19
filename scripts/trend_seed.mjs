// One-off seed for lib/trend.js: clips made before the server-side counter existed.
//
//   node scripts/trend_seed.mjs <raw.json>
//
// <raw.json> is { pulled_at, rows: [[page_url, "YYYY-MM-DD", count], ...] }: the count of
// clip_render_done analytics events per clip-tool URL and day (PostHog, host heistclips.com,
// since 2026-11-15). The query groups by URL and day only; no person field leaves PostHog.
// This script reads the stream and the moment out of each URL (?q= and ?t=), names each VOD's
// channel from Twitch or Kick, and writes lib/trend_seed.json.
import fs from "node:fs";
import path from "node:path";
import { parseInput, getVod } from "../public/js/twitch.js";
import { getKickVod } from "../public/js/kick.js";

const raw = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const rows = [], vods = {};
let skipped = 0;
for (const [url, day, n] of raw.rows) {
  let u; try { u = new URL(url); } catch (e) { skipped += n; continue; }
  const inp = parseInput(u.searchParams.get("q") || "");
  const t = Math.round((Number(u.searchParams.get("t")) || 0) / 10) * 10;
  if (inp.kind === "vod" || inp.kind === "kickvod") rows.push({ day, vod: inp.id, t, n });
  else if (inp.kind === "channel") rows.push({ day, platform: "twitch", login: inp.login, n });
  else if (inp.kind === "kick") rows.push({ day, platform: "kick", login: inp.login, n });
  else skipped += n; // a name typed with spaces, a clip link: the stream is not in the URL
}
for (const id of new Set(rows.filter((r) => r.vod).map((r) => r.vod))) {
  const kick = id.includes("-");
  try {
    const v = kick ? await getKickVod(id) : await getVod(id);
    if (v && v.channel) vods[id] = { platform: kick ? "kick" : "twitch", login: v.channel, name: v.channel_name || v.channel, title: v.title || "", game: v.game || "" };
    else console.log("gone:", id);
  } catch (e) { console.log("unreadable:", id, e.message); }
  await new Promise((r) => setTimeout(r, kick ? 700 : 60));
}
// Merge rows that now share a key.
const merged = new Map();
for (const r of rows) { const k = [r.day, r.vod || "", r.platform || "", r.login || "", r.t || 0].join("|"); const m = merged.get(k); if (m) m.n += r.n; else merged.set(k, { ...r }); }
const out = { through: raw.pulled_at, source: "PostHog clip_render_done per clip-tool URL and day, 2026-11-15 onward; aggregate counts only", rows: [...merged.values()].sort((a, b) => b.n - a.n), vods };
fs.writeFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), "../lib/trend_seed.json"), JSON.stringify(out, null, 1) + "\n");
console.log("rows", out.rows.length, "clips", out.rows.reduce((a, r) => a + r.n, 0), "skipped", skipped, "vods named", Object.keys(vods).length);
