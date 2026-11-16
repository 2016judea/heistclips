// One-time repair (2026-11-16): the first crawl stored RSC references instead of category arrays.
// Re-read only those campaign pages, one at a time, ~1 s apart.
import fs from "node:fs";
for (const line of fs.readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const cr = await import("../lib/crpages.js");
const { getJSON, putJSON } = await import("../lib/store.js");
const cache = await getJSON("cr/pages.json", { fresh: true });
const todo = Object.entries(cache.campaigns).filter(([, e]) => e.raw && !(e.raw.categories || []).length).map(([id]) => id);
console.log("to repair", todo.length);
let n = 0, fixed = 0;
for (const id of todo) {
  await new Promise((r) => setTimeout(r, 900));
  let html;
  try { html = await cr.politeGet("/c/campaigns/" + id); } catch (e) { console.log("blocked", e.message); break; }
  const raw = html && cr.campaignFromPage(html, id);
  if (raw && raw.id === id) { cache.campaigns[id] = { raw: cr.slim(raw), fetched_at: new Date().toISOString() }; if ((cache.campaigns[id].raw.categories || []).length) fixed++; }
  if (++n % 50 === 0) { await putJSON("cr/pages.json", cache, { maxAge: 60 }); console.log(new Date().toISOString().slice(11, 19), n, "fixed", fixed); }
}
await putJSON("cr/pages.json", cache, { maxAge: 60 });
console.log("done", n, "fixed", fixed);
