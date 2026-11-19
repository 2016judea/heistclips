// Close out a board item: node scripts/request_status.mjs <id> <requested|building|shipped> "<response>"
// Sets status, the public response line, and shipped_at (now, when it becomes shipped; cleared
// if it moves back). Never touches votes. Writes through the Blob store with the env token:
// BLOB_READ_WRITE_TOKEN from the environment, else from the repo's .env (main checkout).
//   --dry      print what would change, write nothing
//   --date=YYYY-MM-DD   use this shipped_at instead of now
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
const [id, status, response] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const dry = flags.includes("--dry");
const dateFlag = (flags.find((f) => f.startsWith("--date=")) || "").slice(7);

const { loadBoard, STATUSES } = await import("../lib/requests.js");
const { putJSON, getJSON } = await import("../lib/store.js");
if (!id || !STATUSES.includes(status)) {
  console.error(`usage: node scripts/request_status.mjs <id> <${STATUSES.join("|")}> "<response>" [--dry] [--date=YYYY-MM-DD]`);
  process.exit(2);
}
if (!process.env.BLOB_READ_WRITE_TOKEN && !dry) { console.error("BLOB_READ_WRITE_TOKEN missing (env or .env)"); process.exit(2); }
const b = await loadBoard();
const it = b.items.find((x) => x.id === id);
if (!it) { console.error("no item " + id); process.exit(1); }
const before = { status: it.status, response: it.response || null, shipped_at: it.shipped_at || null };
it.status = status;
if (response !== undefined) it.response = String(response).replace(/\s+/g, " ").trim().slice(0, 400) || undefined;
if (status === "shipped") it.shipped_at = dateFlag ? new Date(dateFlag + "T18:00:00Z").toISOString() : it.shipped_at || new Date().toISOString();
else delete it.shipped_at;
if (!it.response) delete it.response;
const after = { status: it.status, response: it.response || null, shipped_at: it.shipped_at || null };
console.log(id, JSON.stringify(it.title), "\n  before", JSON.stringify(before), "\n  after ", JSON.stringify(after), `\n  votes untouched: ${it.votes}`);
if (dry) { console.log("--dry: nothing written"); process.exit(0); }
await putJSON("requests/board.json", b, { maxAge: 60 });
// Blob reads lag writes by a few seconds; read back until it shows.
for (let i = 0; i < 6; i++) {
  await new Promise((r) => setTimeout(r, 1500));
  const back = (await getJSON("requests/board.json", { fresh: true })).items.find((x) => x.id === id);
  if (back && back.status === status && (back.response || null) === after.response) { console.log("  written and read back"); process.exit(0); }
}
console.log("  written; read-back still shows the old value (Blob lag), check /requests in a minute");
