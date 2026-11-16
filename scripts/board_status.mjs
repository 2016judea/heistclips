// Set a feature request's status on the public board: node scripts/board_status.mjs <id> requested|building|shipped
// Changes the status only; never touches votes.
import fs from "node:fs";
for (const line of fs.readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const [id, status] = process.argv.slice(2);
const { loadBoard, STATUSES } = await import("../lib/requests.js");
const { putJSON } = await import("../lib/store.js");
if (!STATUSES.includes(status)) throw new Error("status must be one of " + STATUSES);
const b = await loadBoard();
const it = b.items.find((x) => x.id === id);
if (!it) throw new Error("no item " + id);
it.status = status;
await putJSON("requests/board.json", b, { maxAge: 60 });
console.log(id, it.title, "->", status, "(votes untouched:", it.votes + ")");
