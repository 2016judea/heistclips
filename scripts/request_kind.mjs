// Board housekeeping, each in ONE board write:
//   node scripts/request_kind.mjs <id> <feature|bug> [<id> <feature|bug> ...]   set an item's kind
//   node scripts/request_kind.mjs --remove=<id>[,<id>...]                        delete items (test posts)
// A bug filed through the feature box before bugs had their own route is re-tagged here; test
// items filed against production are removed here. Votes and text are never touched.
// Waits for the newest board before writing (lib/requests.js loadBoardSettled) and reads its
// own write back.
//   --dry   print what would change, write nothing
// Env: BLOB_READ_WRITE_TOKEN from the environment, else the repo's .env.
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
const remove = ((flags.find((f) => f.startsWith("--remove=")) || "").slice(9)).split(",").map((s) => s.trim()).filter(Boolean);
const { loadBoardSettled, setKinds, removeItems, KINDS, kindOf } = await import("../lib/requests.js");

const map = {};
for (let i = 0; i < pos.length; i += 2) map[pos[i]] = pos[i + 1];
if ((!remove.length && !pos.length) || (remove.length && pos.length) || Object.values(map).some((k) => !KINDS.includes(k))) {
  console.error(`usage: node scripts/request_kind.mjs <id> <${KINDS.join("|")}> [...]   or   --remove=<id>[,<id>...]   [--dry]`); process.exit(2);
}
const b = await loadBoardSettled();
const ids = remove.length ? remove : Object.keys(map);
const missing = ids.filter((id) => !b.items.some((x) => x.id === id));
if (missing.length) { console.error("not on the board: " + missing.join(", ")); process.exit(1); }
for (const id of ids) { const x = b.items.find((y) => y.id === id); console.log(`${id}  ${kindOf(x)}${remove.length ? "  -> REMOVE" : "  -> " + map[id]}  "${x.title}"`); }
if (dry) { console.log("dry run: nothing written"); process.exit(0); }
if (remove.length) console.log("removed", await removeItems(remove), "item(s) in one write");
else console.log("changed", (await setKinds(map)).join(", ") || "nothing (already set)", "in one write");
const after = await loadBoardSettled();
for (const id of ids) { const x = after.items.find((y) => y.id === id); console.log("  now:", id, x ? kindOf(x) : "gone"); }
