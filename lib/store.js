// Vercel Blob over plain HTTP (no SDK). The store is public-read, so anything private is
// written under an unguessable path (a keyed hash), never a predictable one.
import crypto from "node:crypto";

const API = "https://blob.vercel-storage.com/";
export const BLOB_BASE = process.env.BLOB_BASE || "https://cf546sdmyewh8fpm.public.blob.vercel-storage.com/";

// HC_STORE=memory (the default in scripts/dev.mjs): writes stay in this process and reads see
// them first, so a local server can never write the live board or a live credit ledger.
const MEM = process.env.HC_STORE === "memory" ? new Map() : null;
export const storeMode = () => (MEM ? "memory" : "live");

export async function putJSON(pathname, obj, { maxAge = 60 } = {}) {
  if (MEM) { MEM.set(pathname, JSON.stringify(obj)); return { pathname, url: BLOB_BASE + pathname, memory: true }; }
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN missing");
  const r = await fetch(API + "?pathname=" + encodeURIComponent(pathname), {
    method: "PUT",
    headers: {
      authorization: "Bearer " + token,
      "x-api-version": "10",
      "x-add-random-suffix": "0",
      "x-allow-overwrite": "1",
      "x-content-type": "application/json",
      "x-cache-control-max-age": String(maxAge),
    },
    body: JSON.stringify(obj),
  });
  if (!r.ok) throw new Error("blob put " + r.status + " " + (await r.text()).slice(0, 200));
  return r.json();
}

export async function getJSON(pathname, { fresh = false } = {}) {
  if (MEM && MEM.has(pathname)) return JSON.parse(MEM.get(pathname));
  const url = BLOB_BASE + pathname + (fresh ? (pathname.includes("?") ? "&" : "?") + "v=" + Date.now() : "");
  const r = await fetch(url, { cache: "no-store" });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("blob get " + r.status);
  return r.json();
}

export function secretPath(prefix, id) {
  const salt = process.env.CREDIT_SALT || process.env.BLOB_READ_WRITE_TOKEN || "dev";
  const h = crypto.createHmac("sha256", salt).update(String(id)).digest("hex").slice(0, 40);
  return `${prefix}/${h}.json`;
}

// The latest campaign snapshot, memoised per warm function instance for 60 s.
let memo = { at: 0, data: null };
export async function latestSnapshot() {
  if (memo.data && Date.now() - memo.at < 60000) return memo.data;
  const d = await getJSON("snapshot/latest.json");
  if (d) memo = { at: Date.now(), data: d };
  return d || memo.data;
}
