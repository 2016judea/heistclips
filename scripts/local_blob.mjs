// A local stand-in for Vercel Blob, for tests and local servers. Import it BEFORE anything
// that touches lib/store.js. Every write goes to a folder on this machine; the live store is
// never written (on 2026-11-19 a local test post reached the public request board). Reads of
// the campaign snapshot fall through to the live store, read-only, so pages have real data.
import fs from "node:fs";
import path from "node:path";

export function installLocalBlob(dir) {
  fs.mkdirSync(dir, { recursive: true });
  process.env.BLOB_READ_WRITE_TOKEN = "local-only";
  process.env.BLOB_BASE = "https://local.blob.invalid/";
  process.env.CREDIT_SALT = process.env.CREDIT_SALT || "local-salt";
  delete process.env.MAILGUN_API_KEY; // a local run never sends mail
  delete process.env.STRIPE_SECRET_KEY;
  const LIVE = "https://cf546sdmyewh8fpm.public.blob.vercel-storage.com/";
  const real = globalThis.fetch;
  const file = (p) => path.join(dir, p.replace(/[^A-Za-z0-9_./-]/g, "_"));
  const reply = (status, obj) => new Response(typeof obj === "string" ? obj : JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
  globalThis.fetch = async (input, init = {}) => {
    const url = String(typeof input === "string" ? input : input.url);
    if (url.startsWith("https://blob.vercel-storage.com")) {
      const u = new URL(url);
      if ((init.method || "GET") === "PUT") {
        const p = u.searchParams.get("pathname");
        fs.mkdirSync(path.dirname(file(p)), { recursive: true });
        fs.writeFileSync(file(p), typeof init.body === "string" ? init.body : Buffer.from(await new Response(init.body).arrayBuffer()));
        return reply(200, { pathname: p, url: process.env.BLOB_BASE + p });
      }
      const prefix = u.searchParams.get("prefix") || "";
      const blobs = [];
      const walk = (d) => { for (const f of fs.existsSync(d) ? fs.readdirSync(d) : []) { const full = path.join(d, f); if (fs.statSync(full).isDirectory()) walk(full); else { const rel = path.relative(dir, full); if (rel.startsWith(prefix)) blobs.push({ pathname: rel, uploadedAt: fs.statSync(full).mtime.toISOString(), size: fs.statSync(full).size }); } } };
      walk(dir);
      return reply(200, { blobs, hasMore: false });
    }
    if (url.startsWith(process.env.BLOB_BASE)) {
      const p = url.slice(process.env.BLOB_BASE.length).split("?")[0];
      if (fs.existsSync(file(p))) return reply(200, fs.readFileSync(file(p), "utf8"));
      if (/^(snapshot|cr)\//.test(p)) return real(LIVE + p, { cache: "no-store" }); // read-only
      return reply(404, { error: "not found" });
    }
    if (/api\.mailgun\.net|api\.stripe\.com/.test(url)) return reply(503, { error: "blocked in a local run" });
    return real(input, init);
  };
  return dir;
}
