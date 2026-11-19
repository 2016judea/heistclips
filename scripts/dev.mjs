// Local server that mimics vercel.json: public/ first, /api/<name>, /mcp, /tv/ proxy, else the page router.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(new URL("..", import.meta.url).pathname);
for (const line of fs.readFileSync(path.join(root, ".env"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
// Writes stay in memory unless --live-writes is passed: a local test must never reach the live
// board (one did, 2026-11-19). Analytics events are off locally too.
if (!process.argv.includes("--live-writes")) process.env.HC_STORE = "memory";
process.env.HC_NO_ANALYTICS = "1";
const TYPES = { ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".txt": "text/plain", ".json": "application/json" };
const port = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) || 3787);
http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  const file = path.join(root, "public", decodeURIComponent(u.pathname));
  if (u.pathname !== "/" && file.startsWith(path.join(root, "public")) && fs.existsSync(file) && fs.statSync(file).isFile()) {
    res.setHeader("content-type", TYPES[path.extname(file)] || "application/octet-stream");
    return fs.createReadStream(file).pipe(res);
  }
  let m;
  if ((m = u.pathname.match(/^\/tv\/([a-z0-9]+)\/(.*)$/))) {
    const r = await fetch(`https://${m[1]}.cloudfront.net/${m[2]}`);
    res.statusCode = r.status; res.setHeader("content-type", r.headers.get("content-type") || "application/octet-stream");
    return res.end(Buffer.from(await r.arrayBuffer()));
  }
  let name = "page";
  if (u.pathname === "/mcp") name = "mcp";
  else if ((m = u.pathname.match(/^\/api\/((?:v1\/)?[a-z-]+)$/))) name = m[1];
  else if (u.pathname === "/post") { name = "v1/post"; }
  else if ((m = u.pathname.match(/^\/(de|fr|pt|es)\/post$/))) { name = "v1/post"; req.url = `/api/v1/post?lang=${m[1]}${u.search ? "&" + u.search.slice(1) : ""}`; }
  else if ((m = u.pathname.match(/^\/oauth\/(youtube|tiktok)\/callback$/))) { name = "v1/post"; req.url = `/api/v1/post?op=callback&provider=${m[1]}&${u.search.slice(1)}`; }
  else req.url = "/api/page?p=" + encodeURIComponent(u.pathname) + (u.search ? "&" + u.search.slice(1) : "");
  try {
    const mod = await import(path.join(root, "api", name + ".js"));
    await mod.default(req, res);
  } catch (e) { console.error(e); res.statusCode = 500; res.end(String(e.stack)); }
}).listen(port, () => console.log("http://localhost:" + port + " (store: " + (process.env.HC_STORE || "LIVE") + ")"));
