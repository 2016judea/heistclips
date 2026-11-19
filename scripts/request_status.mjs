// Close out board items:
//   node scripts/request_status.mjs <id> <requested|building|shipped> "<response>" [<id> <status> "<response>" ...]
// Sets status, the public response line, and shipped_at (now, when it becomes shipped; cleared
// if it moves back). Never touches votes. Several items go in ONE call and ONE board write.
//
// Safe to run back to back: it waits until the board it reads is the newest one written
// (loadBoardSettled), because the public Blob URL can serve the previous copy for seconds and a
// write made from that copy undoes the one before it. It then reads its own write back.
//
// The response is translated once here (en, de, fr; lib/translate.js) when ANTHROPIC_API_KEY is
// set, so each viewer reads it in their language. Write it in one language, not "English / German".
//   --dry               print what would change, write nothing
//   --date=YYYY-MM-DD   use this shipped_at instead of now
//   --no-translate      store the response as written only
// Env: BLOB_READ_WRITE_TOKEN (and ANTHROPIC_API_KEY) from the environment, else the repo's .env.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
for (const f of [path.join(here, "../.env"), path.join(process.cwd(), ".env"), path.join(here, "../../../../.env")]) {
  if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}
const flags = process.argv.slice(2).filter((a) => a.startsWith("--"));
const pos = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const dry = flags.includes("--dry");
const dateFlag = (flags.find((f) => f.startsWith("--date=")) || "").slice(7);

const { loadBoard, loadBoardSettled, saveBoard, STATUSES } = await import("../lib/requests.js");
const { translateItem } = await import("../lib/translate.js");
const usage = () => { console.error(`usage: node scripts/request_status.mjs <id> <${STATUSES.join("|")}> "<response>" [<id> <status> "<response>" ...] [--dry] [--date=YYYY-MM-DD] [--no-translate]`); process.exit(2); };

// Triples; the response of the LAST one may be left off (status change only).
const jobs = [];
for (let i = 0; i < pos.length; i += 3) jobs.push({ id: pos[i], status: pos[i + 1], response: pos[i + 2] });
if (!jobs.length || jobs.some((j) => !j.id || !STATUSES.includes(j.status))) usage();
if (new Set(jobs.map((j) => j.id)).size !== jobs.length) { console.error("the same id is listed twice"); process.exit(2); }
if (!process.env.BLOB_READ_WRITE_TOKEN && !dry) { console.error("BLOB_READ_WRITE_TOKEN missing (env or .env)"); process.exit(2); }

const b = dry && !process.env.BLOB_READ_WRITE_TOKEN ? await loadBoard() : await loadBoardSettled();
const after = {};
for (const j of jobs) {
  const it = b.items.find((x) => x.id === j.id);
  if (!it) { console.error("no item " + j.id + " (nothing written)"); process.exit(1); }
  const before = { status: it.status, response: it.response || null, shipped_at: it.shipped_at || null };
  it.status = j.status;
  if (j.response !== undefined) {
    const next = String(j.response).replace(/\s+/g, " ").trim().slice(0, 400);
    if (next !== (it.response || "")) { delete it.response_tr; delete it.response_lang; }
    if (next) it.response = next; else delete it.response;
  }
  if (j.status === "shipped") it.shipped_at = dateFlag ? new Date(dateFlag + "T18:00:00Z").toISOString() : it.shipped_at || new Date().toISOString();
  else delete it.shipped_at;
  if (!dry && !flags.includes("--no-translate")) await translateItem(it);
  after[j.id] = { status: it.status, response: it.response || null, shipped_at: it.shipped_at || null };
  console.log(j.id, JSON.stringify(it.title), "\n  before", JSON.stringify(before), "\n  after ", JSON.stringify(after[j.id]), `\n  votes untouched: ${it.votes}`, it.response ? `\n  response in: ${Object.keys(it.response_tr || {}).join(", ") || "as written only"}` : "");
}
if (dry) { console.log("--dry: nothing written"); process.exit(0); }
// Translating took a moment: take the board again and lay only these items' close-out fields
// onto it, so a vote or a new request that arrived meanwhile is kept.
const fresh = await loadBoardSettled();
for (const j of jobs) {
  const it = b.items.find((x) => x.id === j.id), x = fresh.items.find((y) => y.id === j.id);
  if (!x) { console.error("item " + j.id + " disappeared; nothing written"); process.exit(1); }
  for (const k of ["status", "response", "response_lang", "response_tr", "shipped_at"]) { if (it[k] === undefined) delete x[k]; else x[k] = it[k]; }
}
const stamp = (await saveBoard(fresh)).written_at;
for (let i = 0; i < 30; i++) {
  await new Promise((r) => setTimeout(r, 1500));
  const back = await loadBoard();
  if (back.written_at === stamp && jobs.every((j) => { const x = back.items.find((y) => y.id === j.id); return x && x.status === after[j.id].status && (x.response || null) === after[j.id].response; })) {
    console.log(`written and read back (${jobs.length} item${jobs.length === 1 ? "" : "s"}, one write)`); process.exit(0);
  }
}
console.log("written, but the public copy still shows the old board after 45 s. The next run will wait for it; check /requests in a minute.");
