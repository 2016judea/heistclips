// Local server with LOCAL storage: `node scripts/dev_local.mjs [port] [dir]`. Same routing as
// scripts/dev.mjs, but every Blob write lands in a folder here (scripts/local_blob.mjs), mail
// and Stripe are blocked, and no .env is read. Use this one for anything that writes.
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { installLocalBlob } from "./local_blob.mjs";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const port = Number(process.argv[2] || 3788);
const dir = installLocalBlob(process.argv[3] || path.join(os.tmpdir(), "heistclips-local-blob"));
const TYPES = { ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".txt": "text/plain", ".json": "application/json" };
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
  else if ((m = u.pathname.match(/^\/api\/([a-z-]+)$/))) name = m[1];
  else if ((m = u.pathname.match(/^\/experiences\/([A-Za-z0-9_]+)/))) { name = "whop"; req.url = `/api/whop?view=exp&id=${m[1]}${u.search ? "&" + u.search.slice(1) : ""}`; }
  else if ((m = u.pathname.match(/^\/dashboard\/([A-Za-z0-9_]+)/))) { name = "whop"; req.url = `/api/whop?view=dash&id=${m[1]}${u.search ? "&" + u.search.slice(1) : ""}`; }
  else req.url = "/api/page?p=" + encodeURIComponent(u.pathname) + (u.search ? "&" + u.search.slice(1) : "");
  try {
    const mod = await import(path.join(root, "api", name + ".js"));
    await mod.default(req, res);
  } catch (e) { console.error(e); res.statusCode = 500; res.end(String(e.stack)); }
}).listen(port, () => console.log(`http://localhost:${port}  (storage: ${dir}, live store is never written)`));
