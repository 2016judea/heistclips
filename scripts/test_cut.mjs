// The test helper for anything that makes a clip on production. Every request it sends carries
// `x-hc-test: 1` (lib/marks.js): the clip is cut and charged, and counted nowhere (no trend
// record, no clip_made). Use it instead of a bare call; ANALYTICS.md, "Test and house clips".
//
//   node scripts/test_cut.mjs [source] [start_s] [end_s] [layout]
//     one marked cut through the connector. With no source, the first live GTA stream.
//     With BLOB_READ_WRITE_TOKEN in the environment it also proves no trend record was left.
//
//   import { TEST_HEADERS, mcp } from "./scripts/test_cut.mjs";
//     mcp("cut_clip", {...})                     a connector call, marked
//     fetch(url, { headers: TEST_HEADERS })      the credits API or a cut endpoint, marked
//     context.setExtraHTTPHeaders(TEST_HEADERS)  a Playwright browser: every render it commits is marked
import { fileURLToPath } from "node:url";

export const TEST_HEADERS = { "x-hc-test": "1" };
const BASE = process.env.HC_BASE || "https://heistclips.com";

export async function mcp(tool, args = {}, { base = BASE, timeoutMs = 120000 } = {}) {
  const r = await fetch(base + "/mcp", { method: "POST", signal: AbortSignal.timeout(timeoutMs),
    headers: { "content-type": "application/json", accept: "application/json", "user-agent": "heistclips-test/1 (node)", ...TEST_HEADERS },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: tool, arguments: args } }) });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return d.result.structuredContent || d.result;
}

async function trendRecords(day) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;
  const r = await fetch("https://blob.vercel-storage.com/?prefix=" + encodeURIComponent(`trend/c/${day}/`) + "&limit=1000", { headers: { authorization: "Bearer " + token, "x-api-version": "10" } });
  const d = await r.json();
  if (d.hasMore) return null; // more than one page: this small check does not page
  return (d.blobs || []).map((b) => b.pathname);
}

async function main() {
  let [source, start, end, layout] = process.argv.slice(2);
  if (!source) {
    const live = await mcp("live_gta_streams", {});
    const s = (live.streams || live.live || [])[0];
    if (!s) throw new Error("no live stream to cut; pass a source");
    source = s.url || s.login || s.channel;
  }
  start = Number(start) || 600; end = Number(end) || start + 10;
  const day = new Date().toISOString().slice(0, 10);
  const before = await trendRecords(day);
  let out = await mcp("cut_clip", { source, start, end, layout: layout || "fit", ...(process.env.HC_ACCOUNT ? { account: process.env.HC_ACCOUNT } : {}) });
  while (out.status === "cutting") out = await mcp("cut_clip_status", { job: out.job });
  const { account, manage, ...shown } = out; // an account code is a secret: never printed
  console.log(JSON.stringify(shown, null, 1));
  if (!out.ok) process.exit(1);
  if (!before) { console.log("trend check skipped (no BLOB_READ_WRITE_TOKEN, or more than 1,000 records today)"); return; }
  await new Promise((r) => setTimeout(r, 3000));
  const after = await trendRecords(day);
  const mine = (after || []).filter((p) => !before.includes(p) && p.includes("~" + Math.round(start / 10) * 10 + ".json"));
  console.log(mine.length ? "FAIL: this test cut left a trend record: " + mine.join(", ") : `ok: charged ${out.charged}, no trend record for this cut (${before.length} records before, ${after.length} after)`);
  if (mine.length) process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(e.message); process.exit(1); });
