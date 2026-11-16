// One-time fill of the campaign-page cache (cr/pages.json): every campaign page in Content
// Rewards' sitemap, one at a time, ~1 s apart. After this the 30-min cron keeps it fresh.
import fs from "node:fs";
for (const line of fs.readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const { refreshCache } = await import("../lib/crpages.js");
const { getJSON, putJSON } = await import("../lib/store.js");
let cache = (await getJSON("cr/pages.json", { fresh: true }).catch(() => null)) || { campaigns: {} };
for (let round = 0; round < 60; round++) {
  const r = await refreshCache(cache, { maxPages: 40, pauseMs: 900, log: console.log });
  cache = r.cache;
  const have = Object.values(cache.campaigns).filter((e) => e.raw).length;
  console.log(new Date().toISOString().slice(11, 19), "round", round, "fetched", r.fetched, "have", have, "of", r.live, r.error || "");
  await putJSON("cr/pages.json", cache, { maxAge: 60 });
  if (r.error) break;
  const missing = Object.values(cache.campaigns).filter((e) => !e.fetched_at).length;
  if (have + 5 >= (r.live || 0)) break;
}
