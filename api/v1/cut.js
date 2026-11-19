// POST /api/v1/cut  {source, start, end, layout?, facecam?, hook?, account?, job?}
// The server-side cut the connector's cut_clip tool calls. It lives in its own function so only
// this one carries ffmpeg (about 75 MB) and the longer time limit; see "functions" in vercel.json.
//
// The cut is handed to waitUntil, so it runs to the end (file stored, clip charged, job result
// written) even when the caller has stopped waiting: the connector answers "still cutting"
// after a safe time and reads the job's result later.
import { waitUntil } from "@vercel/functions";
import { cutJob } from "../../lib/cutjob.js";
import { isTest } from "../../lib/marks.js";
import { callerOf, openCaller } from "../../lib/callers.js";

async function body(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = []; for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch (e) { return {}; }
}

export default async function handler(req, res) {
  res.setHeader("content-type", "application/json");
  res.setHeader("cache-control", "no-store");
  if (req.method !== "POST") { res.statusCode = 405; return res.end(JSON.stringify({ ok: false, error: "POST only" })); }
  const b = await body(req);
  if (isTest(req)) b.qa = true; // a test cut: charged, counted nowhere (lib/marks.js)
  // Who a new account is counted against (lib/callers.js): the connector signs its caller; any
  // other request is the address and user agent it came from, and never a hosted assistant.
  b.caller = openCaller(b.caller_token) || callerOf(String(req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "").split(",")[0].trim(), req.headers["user-agent"], { shared: false });
  delete b.caller_token;
  let out;
  const work = cutJob(b).catch((e) => ({ ok: false, err: "crash", error: "Cut failed: " + e.message + ". Nothing was charged." }));
  try { waitUntil(work); } catch (e) { /* outside Vercel (local dev) there is nothing to keep alive */ }
  out = await work;
  try { res.end(JSON.stringify(out)); } catch (e) { /* the caller left; the job result is already saved */ }
}
