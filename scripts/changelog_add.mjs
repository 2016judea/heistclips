// Announce a change on https://heistclips.com/whats-new, in the same commit that ships it:
//
//   node scripts/changelog_add.mjs <new|improved|fixed> "<title>" "<one or two sentences>" [--link=/clip] [--request=<board id>]
//
// Example:
//   node scripts/changelog_add.mjs fixed "Every MP4 has sound" "Every download carries the stream's sound. If it can't be captured, the render stops and tells you." --link=/clip --request=rmwml5082
//
// It puts the entry on top of lib/changelog.json (the page, the Atom feed, llms-full.txt, the
// "New" pill beside the logo and the link on the request board all read that file), translated
// once into German, French, Portuguese and Spanish. Then commit lib/changelog.json with your change.
//
// Write it for a clipper: what changed and why they care, 5th-grade words, no em dashes, never
// the word "Rockstar". Only announce what is live for everyone (nothing gated or in review).
//
//   --link=/clip            where to try it (a site path or a full URL)
//   --request=id[,id]       the board request(s) this answers; the board row links back here
//   --date=YYYY-MM-DD       the day it shipped (default: today, Central time)
//   --id=my-slug            the anchor (default: made from the title)
//   --dry                   print what would be added; write nothing, call nothing
//   --no-translate          English only (other languages read the English text)
//   --de-title= --de-body=  (and fr, pt, es) give a translation yourself instead of the model's
//
// Translation uses ANTHROPIC_API_KEY (environment, else the repo's .env) through
// lib/translate.js: one small call per entry, here only, never on a page view. With no key the
// entry is added in English and the script says so.
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
const { TYPES, FILE } = await import("../lib/changelog.js");
const { translateFields } = await import("../lib/translate.js");
const OTHER = ["de", "fr", "pt", "es"];

const args = process.argv.slice(2);
const flag = (k) => { const a = args.find((x) => x === "--" + k || x.startsWith("--" + k + "=")); return a === undefined ? undefined : a.includes("=") ? a.slice(a.indexOf("=") + 1) : true; };
const pos = args.filter((a) => !a.startsWith("--"));
const fail = (msg) => { console.error(msg + `\nusage: node scripts/changelog_add.mjs <${TYPES.join("|")}> "<title>" "<one or two sentences>" [--link=/clip] [--request=<board id>] [--date=YYYY-MM-DD] [--dry]`); process.exit(2); };

const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
const type = String(pos[0] || "").toLowerCase(), title = clean(pos[1]), body = clean(pos[2]);
if (!TYPES.includes(type)) fail("the first word is the type");
if (title.length < 6 || title.length > 90) fail("the title is one line, 6 to 90 characters (got " + title.length + ")");
if (body.length < 20 || body.length > 320) fail("the body is one or two plain sentences, 20 to 320 characters (got " + body.length + ")");
for (const s of [title, body]) {
  if (/[—–]/.test(s)) fail("no dashes as punctuation: use a comma, a colon or a full stop");
  if (/rockstar/i.test(s)) fail("never the word Rockstar");
}
const date = flag("date") || new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail("--date is YYYY-MM-DD");
const link = flag("link");
if (link !== undefined && !/^(\/[^\s]*|https:\/\/[^\s]+)$/.test(link)) fail("--link is a site path (/clip) or an https URL");
const request_ids = String(flag("request") || "").split(",").map((s) => s.trim()).filter(Boolean);
if (request_ids.some((id) => !/^[a-z0-9]{2,16}$/.test(id))) fail("--request takes board ids like rmwml5082");

const list = JSON.parse(fs.readFileSync(FILE, "utf8"));
const slug = (s) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").split("-").slice(0, 7).join("-").slice(0, 48).replace(/-$/, "");
let id = flag("id") ? slug(String(flag("id"))) : slug(title);
if (!id) fail("could not make an anchor from that title; pass --id=");
if (list.some((e) => e.id === id)) { if (flag("id")) fail("that --id is taken"); id += "-" + date.slice(5); }
if (list.some((e) => e.id === id)) fail("an entry with this title already exists for " + date);
if (list.some((e) => e.title.toLowerCase() === title.toLowerCase() && e.date === date)) fail("already announced today: " + title);

const dry = !!flag("dry");
const entry = { id, date, type, title, body };
if (link) entry.link = link;
if (request_ids.length) entry.request_ids = request_ids;
if (!dry) entry.at = new Date().toISOString();
entry.langs = {};
for (const l of OTHER) { const t = flag(l + "-title"), b = flag(l + "-body"); if (typeof t === "string" && typeof b === "string") entry.langs[l] = { title: clean(t), body: clean(b) }; }

const need = OTHER.filter((l) => !entry.langs[l]);
let note = "";
if (dry) note = need.length ? `(dry run: ${need.join(", ")} would be translated on a real run)` : "(dry run)";
else if (flag("no-translate")) note = "English only (--no-translate)";
else if (need.length && !process.env.ANTHROPIC_API_KEY) note = "ANTHROPIC_API_KEY missing: added in English only. Other languages read the English text.";
else if (need.length) {
  const t = await translateFields({ title, body }, { targets: need });
  for (const l of need) if (t && t.tr[l] && t.tr[l].title && t.tr[l].body) entry.langs[l] = { title: t.tr[l].title.replace(/\s*[—–]\s*/g, ", "), body: t.tr[l].body.replace(/\s*[—–]\s*/g, ", ") };
  const missing = OTHER.filter((l) => !entry.langs[l]);
  note = missing.length ? `translation failed for ${missing.join(", ")}: those read the English text. Run again with --${missing[0]}-title= --${missing[0]}-body= or edit lib/changelog.json.` : "translated: " + OTHER.join(", ");
}
if (!Object.keys(entry.langs).length) delete entry.langs;

console.log(dry ? "Would add to lib/changelog.json:" : "Added to lib/changelog.json:");
console.log(JSON.stringify(entry, null, 2));
if (note) console.log(note);
console.log(`It will read at https://heistclips.com/whats-new#${id} once this is committed and deployed.`);
if (!dry) {
  list.unshift(entry);
  fs.writeFileSync(FILE, JSON.stringify(list, null, 2) + "\n");
  console.log("Next: git add lib/changelog.json and commit it with your change.");
}
