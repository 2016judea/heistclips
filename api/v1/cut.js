// POST /api/v1/cut  {source, start, end, layout?, facecam?, hook?, account?, job?}
// The server-side cut the connector's cut_clip tool calls. It lives in its own function so only
// this one carries ffmpeg (about 75 MB) and the longer time limit; see "functions" in vercel.json.
//
// The cut is handed to waitUntil, so it runs to the end (file stored, clip charged, job result
// written) even when the caller has stopped waiting: the connector answers "still cutting"
// after a safe time and reads the job's result later.
import os from "node:os";
import crypto from "node:crypto";
import fs from "node:fs";
import { waitUntil } from "@vercel/functions";
import { cutJob, resolveVod } from "../../lib/cutjob.js";
import { cutClip } from "../../lib/cut.js";

const INSTANCE = crypto.randomBytes(3).toString("hex"); // which warm instance answered (bench runs only)

async function body(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = []; for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch (e) { return {}; }
}

// A measurement run for whoever holds HC_BENCH_KEY: cut, time each stage, store and charge
// nothing. This is how encoder settings are compared on the real function's CPU.
async function bench(b) {
  const vod = await resolveVod(b.source);
  if (vod.ok === false) return vod;
  const t0 = Date.now();
  const out = await cutClip(vod, { start: Number(b.start), end: Number(b.end), layout: b.layout, hook: b.hook || "", source: b.variant || "", x264: b.x264 || {} });
  fs.rmSync(out.dir, { recursive: true, force: true });
  return { ok: true, bench: true, ms: Date.now() - t0, seconds: out.seconds, megabytes: Math.round(out.bytes / 1e5) / 10, kbps: Math.round(out.bytes * 8 / out.seconds / 1000), source_quality: out.source_quality, segments: out.segments, timing: out.timing,
    instance: INSTANCE,
    cpu: { n: os.availableParallelism(), model: (os.cpus()[0] || {}).model, mem_gb: Math.round(os.totalmem() / 1e8) / 10 } };
}

export default async function handler(req, res) {
  res.setHeader("content-type", "application/json");
  res.setHeader("cache-control", "no-store");
  if (req.method !== "POST") { res.statusCode = 405; return res.end(JSON.stringify({ ok: false, error: "POST only" })); }
  const b = await body(req);
  let out;
  if (b.bench) {
    if (!process.env.HC_BENCH_KEY || b.bench !== process.env.HC_BENCH_KEY) { res.statusCode = 403; return res.end(JSON.stringify({ ok: false, error: "no" })); }
    try { out = await bench(b); } catch (e) { out = { ok: false, err: e.code || "crash", error: e.message }; }
    return res.end(JSON.stringify(out));
  }
  const work = cutJob(b).catch((e) => ({ ok: false, err: "crash", error: "Cut failed: " + e.message + ". Nothing was charged." }));
  try { waitUntil(work); } catch (e) { /* outside Vercel (local dev) there is nothing to keep alive */ }
  out = await work;
  try { res.end(JSON.stringify(out)); } catch (e) { /* the caller left; the job result is already saved */ }
}
