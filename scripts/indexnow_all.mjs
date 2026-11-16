// Ping IndexNow with every URL in the live sitemap (run once at launch, or after a big change).
const xml = await (await fetch("https://heistclips.com/sitemap.xml")).text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, "&"));
const r = await fetch("https://api.indexnow.org/indexnow", { method: "POST", headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: "heistclips.com", key: "066cce158f4bc73e04afdcb48bb189f7", keyLocation: "https://heistclips.com/066cce158f4bc73e04afdcb48bb189f7.txt", urlList: urls }) });
console.log(urls.length, "urls ->", r.status, await r.text());
