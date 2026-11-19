// POST /api/v1/qcut {k, d, paid?, ch, moment, hook?}: cut one queue item on the server.
// Lives under api/v1 so it gets the ffmpeg binary and the long limit (vercel.json "functions").
import { queueCut } from "../../lib/queuecut.js";
import { isTest } from "../../lib/marks.js";

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
  try { const b = await body(req); out = await queueCut(isTest(req) ? { ...b, qa: true } : b); } // x-hc-test: lib/marks.js
  catch (e) { console.error(e); out = { ok: false, error: "The cut failed. Nothing was charged." }; }
  res.end(JSON.stringify(out));
}
