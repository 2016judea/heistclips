// POST /api/v1/cut  {source, start, end, layout?, facecam?, hook?, account?}
// The server-side cut the connector's cut_clip tool calls. It lives in its own function so only
// this one carries ffmpeg (about 75 MB) and the longer time limit; see "functions" in vercel.json.
import { cutJob } from "../../lib/cutjob.js";

async function body(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = []; for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch (e) { return {}; }
}

export default async function handler(req, res) {
  res.setHeader("content-type", "application/json");
  res.setHeader("cache-control", "no-store");
  if (req.method !== "POST") { res.statusCode = 405; return res.end(JSON.stringify({ ok: false, error: "POST only" })); }
  let out;
  try { out = await cutJob(await body(req)); }
  catch (e) { out = { ok: false, error: "Cut failed: " + e.message + ". Nothing was charged." }; }
  res.end(JSON.stringify(out));
}
