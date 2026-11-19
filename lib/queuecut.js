// A queue item cut on the server, for a phone or any browser that cannot render. The window
// comes from the autopilot's own moment (never from the caller), the cut is lib/cut.js, and the
// charge is the same two steps a browser render makes through api/credits.js: "start" hands out
// a ticket and charges nothing; "commit" spends it once, only after the file is stored.
import fs from "node:fs";
import crypto from "node:crypto";
import { getVod } from "../public/js/twitch.js";
import { getKickVod } from "../public/js/kick.js";
import { cutClip, MAX_CLIP_S } from "./cut.js";
import { putFile, randomName, clipPath, clipUrl, KEEP_HOURS } from "./blobfiles.js";
import { creditCall } from "./accounts.js";
import { putJSON, listPaths } from "./store.js";
import * as W from "./watch.js";
import { serverEvent } from "./track.js";

// A ceiling on server cuts from the queue per day: each one is about a minute of a 3 GB
// function. Past it the page says to use the editor on a computer.
export const QUEUE_CUTS_PER_DAY = 600;
const dayDir = () => `qcut-day/${new Date().toISOString().slice(0, 10)}/`;
const fail = (error, extra = {}) => ({ ok: false, error, ...extra });

// deps are injectable so the charge rules can be tested without ffmpeg or a network.
export async function queueCut(args = {}, deps = {}) {
  const event = deps.serverEvent || serverEvent; // lengths, layout, timings and a failure code; never the hook or the stream
  const cut = deps.cutClip || cutClip, credit = deps.creditCall || creditCall, store = deps.putFile || putFile;
  const d = String(args.d || "").slice(0, 80);
  const paid = /^cs_(live|test)_[A-Za-z0-9]+$/.test(String(args.paid || "")) ? String(args.paid) : "";
  if (!d) return fail("no device");
  const w = await W.loadWatch(args.k);
  if (!w) return fail("That queue link is not known.");
  const key = W.parseChannelInput(args.ch);
  if (!key || !(w.channels || []).includes(key)) return fail("That streamer is not on your watchlist.");
  const ch = await W.loadChannel(key);
  const m = ch && (ch.moments || []).find((x) => x.id === args.moment);
  if (!m) return fail("That clip is no longer in the queue.");
  const start = m.t_start, end = Math.min(m.t_end, m.t_start + MAX_CLIP_S);
  if ((await (deps.listPaths || listPaths)(dayDir()).catch(() => [])).length >= QUEUE_CUTS_PER_DAY) return fail("The server cutter is full for today. Open this clip on a computer to cut it in the browser.", { busy: true });

  const rec = { d, k: paid }; // credits belong to this browser, exactly as on /clip
  const t = await credit("start", rec);
  if (!t.ok) return fail("You’ve used your free clips.", { need: "buy", free_left: t.free_left, paid_left: t.paid_left });

  const vod = key.startsWith("kick:") ? await getKickVodSafe(m.vod_id, deps) : await (deps.getVod || getVod)(m.vod_id).catch(() => null);
  if (!vod) return fail("That stream’s video is no longer public. Nothing was charged.");
  const hook = typeof args.hook === "string" && args.hook.trim() ? args.hook.slice(0, 90) : (m.hooks && m.hooks[0]) || "";
  let out;
  const layout = ["split", "fit", "crop"].includes(args.layout) ? args.layout : "fit", platform = vod.platform || "twitch", t0 = Date.now();
  try { out = await cut(vod, { start, end, layout, cam: /^[tb][lr]$/.test(args.facecam || "") ? args.facecam : "tr", hook }); }
  catch (e) {
    await event("server_cut", { ok: false, err: e.code || "cut", path: "queue", clip_secs: end - start, platform, layout, total_ms: Date.now() - t0, charged: false }).catch(() => null);
    return fail("The cut failed (" + String(e.message).slice(0, 120) + "). Nothing was charged.");
  }
  const id = randomName();
  try { await store(clipPath(id), fs.readFileSync(out.file), "video/mp4"); }
  catch (e) { return fail("The clip was cut but could not be stored. Nothing was charged."); }
  finally { try { fs.rmSync(out.dir, { recursive: true, force: true }); } catch (e) {} }
  await putJSON(`clips/${id}.json`, { id, at: new Date().toISOString(), via: "queue", vod: m.vod_id, platform: m.platform || "twitch", channel: ch.name, start, end, layout: "fit", hook, bytes: out.bytes, seconds: out.seconds }, { maxAge: 60 }).catch(() => null);
  await putJSON(dayDir() + crypto.randomBytes(8).toString("hex") + ".json", { at: Date.now() }, { maxAge: 60 }).catch(() => null);
  const c = await credit("commit", rec, { ticket: t.ticket, bytes: out.bytes, meta: { vod: m.vod_id, t: Math.round(start), layout: "queue-server" } });
  // HOOK: when the editor's server-side clip_made event lands, call it here with path "queue".
  await event("server_cut", { ok: true, path: "queue", clip_secs: out.seconds, platform, layout, source_quality: out.source_quality, megabytes: Math.round(out.bytes / 1e5) / 10, total_ms: Date.now() - t0, ...(out.timing || {}), charged: !!c.ok }).catch(() => null);
  // Remember the file on the queue, so a phone that slept through the cut still finds it.
  try {
    const fresh = (await W.loadWatch(w.k)) || w;
    fresh.items = fresh.items || {};
    fresh.items[m.id] = { s: "exported", at: new Date().toISOString(), file: clipUrl(id), hook, name: ch.name };
    await W.saveWatch(fresh);
  } catch (e) {}
  return { ok: true, clip_id: id, download: clipUrl(id), seconds: out.seconds, megabytes: Math.round(out.bytes / 1e5) / 10, cut_in_ms: out.ms, charged: !!c.ok, free_left: c.free_left, paid_left: c.paid_left, kept_hours: KEEP_HOURS,
    filename: `${ch.login || "clip"}-${Math.round(start)}s.mp4` };
}

async function getKickVodSafe(id, deps) { try { return await (deps.getKickVod || getKickVod)(id); } catch (e) { return null; } }
