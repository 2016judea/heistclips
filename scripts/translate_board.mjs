// Backfill translations for every board item that lacks one, in ONE board write.
//   node scripts/translate_board.mjs [--dry] [--force] [--only=id1,id2]
// Stores lang + tr{en,de,fr}{title,detail} and response_lang + response_tr on each item
// (lib/translate.js). Run it again after adding a language to TR_LANGS. Votes, statuses and
// shipped_at are never touched. Needs BLOB_READ_WRITE_TOKEN and ANTHROPIC_API_KEY (env or .env).
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
const flags = process.argv.slice(2);
const dry = flags.includes("--dry"), force = flags.includes("--force");
const only = ((flags.find((f) => f.startsWith("--only=")) || "").slice(7) || "").split(",").filter(Boolean);
if (!process.env.ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY missing (env or .env)"); process.exit(2); }

const { loadBoardSettled, saveBoard, loadBoard } = await import("../lib/requests.js");
const { translateItem, TR_LANGS } = await import("../lib/translate.js");
const b = await loadBoardSettled();
const votesBefore = JSON.stringify(b.items.map((x) => [x.id, x.votes, x.status, x.shipped_at || null]));
let calls = 0, changed = 0;
for (const it of b.items) {
  if (only.length && !only.includes(it.id)) continue;
  const was = JSON.stringify([it.tr, it.response_tr, it.response]);
  calls += await translateItem(it, { force });
  if (JSON.stringify([it.tr, it.response_tr, it.response]) !== was) {
    changed++;
    console.log(`${it.id} [${it.lang}] ${it.title}`);
    for (const l of TR_LANGS) if (l !== it.lang && it.tr && it.tr[l]) console.log(`   ${l}: ${it.tr[l].title}${it.tr[l].detail ? " | " + it.tr[l].detail.slice(0, 70) : ""}`);
    if (it.response) { console.log(`   response [${it.response_lang}]: ${it.response}`); for (const l of TR_LANGS) if (l !== it.response_lang && it.response_tr && it.response_tr[l]) console.log(`      ${l}: ${it.response_tr[l]}`); }
  }
}
if (JSON.stringify(b.items.map((x) => [x.id, x.votes, x.status, x.shipped_at || null])) !== votesBefore) { console.error("votes or statuses changed: refusing to write"); process.exit(1); }
const missing = b.items.filter((x) => (!only.length || only.includes(x.id)) && (!x.tr || (x.response && !x.response_tr))).map((x) => x.id);
console.log(`${changed} of ${b.items.length} items changed, ${calls} model calls${missing.length ? "; STILL UNTRANSLATED: " + missing.join(", ") : ""}`);
if (dry) { console.log("--dry: nothing written"); process.exit(0); }
if (!changed) process.exit(0);
// The model calls took a while: take the board again and lay only the translations onto it, so
// a vote or a new request that arrived meanwhile is kept.
const fresh = await loadBoardSettled();
for (const it of b.items) {
  const x = fresh.items.find((y) => y.id === it.id);
  if (!x) continue;
  for (const k of ["lang", "tr", "response_lang", "response_tr"]) if (it[k] !== undefined) x[k] = it[k];
  if (it.response && x.response && it.response !== x.response && / \/ /.test(x.response)) x.response = it.response; // the bilingual lines only
}
const stamp = (await saveBoard(fresh)).written_at;
for (let i = 0; i < 30; i++) {
  await new Promise((r) => setTimeout(r, 1500));
  if ((await loadBoard()).written_at === stamp) { console.log("written and read back (one write)"); process.exit(0); }
}
console.log("written; the public copy has not caught up after 45 s");
