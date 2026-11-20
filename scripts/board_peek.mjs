// Print board items created after a time: node scripts/board_peek.mjs "$PWD" 2026-11-19T14:00:00Z  (heistclips-status skill)
import fs from "node:fs";
const root = process.argv[2];
for (const line of fs.readFileSync(root + "/.env", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const { loadBoard } = await import(root + "/lib/requests.js");
const b = await loadBoard();
const since = process.argv[3] || "2026-11-19T14:00:00Z";
console.log("items", b.items.length, "keys", Object.keys(b));
for (const it of b.items.filter((x) => (x.created_at || "") >= since))
  console.log(JSON.stringify({ id: it.id, kind: it.kind, title: it.title, status: it.status, created_at: it.created_at, via: it.via, hidden: it.hidden, priv: it.priv || it.private }).slice(0, 400));
for (const k of Object.keys(b)) if (k !== "items" && Array.isArray(b[k])) console.log(k, b[k].length, JSON.stringify(b[k].slice(-3)).slice(0, 600));
