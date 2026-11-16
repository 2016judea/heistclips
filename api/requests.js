// Feature-request board API. GET ?d=<browser id> lists; POST {action:"vote"|"submit"}.
import { loadBoard, publicList, vote, submit, notify } from "../lib/requests.js";

const ipOf = (req) => String(req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "local").split(",")[0].trim();

export default async function handler(req, res) {
  res.setHeader("content-type", "application/json");
  res.setHeader("cache-control", "no-store");
  const u = new URL(req.url, "https://heistclips.com");
  if (req.method === "GET") {
    const b = await loadBoard();
    return res.end(JSON.stringify({ requests: publicList(b, u.searchParams.get("d")) }));
  }
  const chunks = []; for await (const c of req) chunks.push(c);
  let body = {}; try { body = req.body && typeof req.body === "object" ? req.body : JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch (e) {}
  const d = String(body.d || "").slice(0, 80);
  if (!d) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "no browser id" })); }
  if (body.action === "vote") return res.end(JSON.stringify(await vote(String(body.id || ""), d, ipOf(req))));
  if (body.action === "submit") {
    if (body.website) return res.end(JSON.stringify({ ok: true })); // honeypot
    const r = await submit(body, d, ipOf(req));
    if (r.ok && r.item) r.mail = await notify(r.item, r.contact, "website").catch((e) => ({ sent: false, why: String(e) }));
    delete r.contact;
    return res.end(JSON.stringify(r));
  }
  res.statusCode = 400; res.end(JSON.stringify({ ok: false, error: "unknown action" }));
}
