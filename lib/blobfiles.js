// Binary files in Vercel Blob (cut clips, browser uploads), over plain HTTP like lib/store.js.
// The store is public-read, so every file sits under a random 40-hex name nobody can guess.
// HC_STORE=memory (local dev) keeps files on local disk and never touches the live store.
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { BLOB_BASE } from "./store.js";

const API = "https://blob.vercel-storage.com/";
const MEM = process.env.HC_STORE === "memory";
const memDir = path.join(os.tmpdir(), "hc-dev-blob");
const token = () => { const t = process.env.BLOB_READ_WRITE_TOKEN; if (!t) throw new Error("BLOB_READ_WRITE_TOKEN missing"); return t; };

export const randomName = () => crypto.randomBytes(20).toString("hex");
export const CLIP_ID = /^[0-9a-f]{40}$/;
export const clipPath = (id, ext = "mp4") => `clips/${id}.${ext}`;
export const clipUrl = (id, ext = "mp4") => BLOB_BASE + clipPath(id, ext);

export async function putFile(pathname, body, contentType) {
  if (MEM) { const f = path.join(memDir, pathname); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, body); return { pathname, url: "file://" + f }; }
  const r = await fetch(API + "?pathname=" + encodeURIComponent(pathname), {
    method: "PUT",
    headers: { authorization: "Bearer " + token(), "x-api-version": "10", "x-add-random-suffix": "0", "x-allow-overwrite": "1", "x-content-type": contentType, "x-cache-control-max-age": "31536000" },
    body, duplex: "half",
  });
  if (!r.ok) throw new Error("blob put " + r.status + " " + (await r.text()).slice(0, 200));
  return r.json();
}

export async function getFile(pathname) {
  if (MEM) { const f = path.join(memDir, pathname); return fs.existsSync(f) ? fs.readFileSync(f) : null; }
  const r = await fetch(BLOB_BASE + pathname, { cache: "no-store" });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("blob get " + r.status);
  return Buffer.from(await r.arrayBuffer());
}

// [{pathname, url, size, uploadedAt}] under a prefix, straight from the Blob API.
export async function listFiles(prefix, max = 5000) {
  if (MEM) {
    const d = path.join(memDir, prefix);
    if (!fs.existsSync(d)) return [];
    return fs.readdirSync(d, { recursive: true }).filter((n) => fs.statSync(path.join(d, n)).isFile()).map((n) => { const st = fs.statSync(path.join(d, n)); return { pathname: prefix + n, url: "file://" + path.join(d, n), size: st.size, uploadedAt: st.mtime.toISOString() }; });
  }
  const out = [];
  let cursor = "";
  while (out.length < max) {
    const r = await fetch(API + "?prefix=" + encodeURIComponent(prefix) + "&limit=1000" + (cursor ? "&cursor=" + encodeURIComponent(cursor) : ""), { headers: { authorization: "Bearer " + token(), "x-api-version": "10" } });
    if (!r.ok) throw new Error("blob list " + r.status);
    const d = await r.json();
    out.push(...(d.blobs || []));
    if (!d.hasMore || !d.cursor) break;
    cursor = d.cursor;
  }
  return out;
}

export async function deleteFiles(urls) {
  if (!urls.length) return 0;
  if (MEM) { for (const u of urls) try { fs.rmSync(u.replace("file://", "")); } catch (e) {} return urls.length; }
  for (let i = 0; i < urls.length; i += 500) {
    const r = await fetch(API + "delete", { method: "POST", headers: { authorization: "Bearer " + token(), "x-api-version": "10", "content-type": "application/json" }, body: JSON.stringify({ urls: urls.slice(i, i + 500) }) });
    if (!r.ok) throw new Error("blob delete " + r.status);
  }
  return urls.length;
}

// Clips and upload parts are kept 72 hours: long enough to download or post, short enough that
// the store does not grow with every clip ever cut. Called from the 30-minute cron.
export const KEEP_HOURS = 72;
export async function sweepOld(prefixes = ["clips/", "uploads/"], hours = KEEP_HOURS) {
  const cut = Date.now() - hours * 3600 * 1000;
  let n = 0;
  for (const p of prefixes) {
    const old = (await listFiles(p)).filter((b) => Date.parse(b.uploadedAt) < cut);
    n += await deleteFiles(old.map((b) => b.url));
  }
  return n;
}
