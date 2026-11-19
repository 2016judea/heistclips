// Request board API (feature requests and bug reports). GET ?d=<browser id> lists (optionally
// ?kind=feature|bug); POST {action:"vote"|"submit"}; a submit with kind:"bug" is a bug report.
import { loadBoard, publicList, vote, submit, notify, KINDS } from "../lib/requests.js";
import { pickViewerLang, fromLabel } from "../lib/translate.js";
import { serverEvent } from "../lib/track.js";

const ipOf = (req) => String(req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "local").split(",")[0].trim();

// One event per bug report: where it came from, which step, which platform. Never its words.
export const BUG_STEPS = ["find_clip_moments", "cut_clip", "cut_clip_status", "post_clip", "posting_account", "my_clip_queue", "watch_streamer", "rank_clipping_campaigns", "clipping_campaign_details", "live_gta_streams", "render", "editor", "queue", "post", "pricing", "checkout"];
export const BUG_FAILURES = ["error_returned", "wrong_result", "empty_or_broken_file", "timeout", "other"];
export function bugEvent(item, via, failure) {
  const g = item.bug || {};
  const step = BUG_STEPS.find((s) => String(g.step || "").toLowerCase().includes(s)) || (g.step ? "other" : "none");
  return serverEvent("bug_report", { via, step, platform: g.platform || "none", failure: BUG_FAILURES.includes(failure) ? failure : "unspecified", has_stream: !!g.source, has_moment: g.start != null, has_error_text: !!g.error, lang: item.lang || "en" });
}

export default async function handler(req, res) {
  res.setHeader("content-type", "application/json");
  res.setHeader("cache-control", "no-store");
  const u = new URL(req.url, "https://heistclips.com");
  if (req.method === "GET") {
    // The viewer's language: ?lang= (the page passes its own locale), else the browser's.
    const lang = pickViewerLang(u.searchParams.get("lang"), req.headers["accept-language"]);
    const b = await loadBoard();
    const kind = u.searchParams.get("kind");
    const list = publicList(b, u.searchParams.get("d"), lang).filter((x) => !KINDS.includes(kind) || x.kind === kind);
    for (const x of list) if (x.original) x.tr_label = fromLabel(lang, x.original.lang);
    return res.end(JSON.stringify({ lang, requests: list }));
  }
  const chunks = []; for await (const c of req) chunks.push(c);
  let body = {}; try { body = req.body && typeof req.body === "object" ? req.body : JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch (e) {}
  const d = String(body.d || "").slice(0, 80);
  if (!d) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "no browser id" })); }
  if (body.action === "vote") return res.end(JSON.stringify(await vote(String(body.id || ""), d, ipOf(req))));
  if (body.action === "submit") {
    if (body.website) return res.end(JSON.stringify({ ok: true })); // honeypot
    const r = await submit(body, d, ipOf(req));
    if (r.ok && r.item) {
      r.mail = await notify(r.item, r.contact, "website", r.bug_private).catch((e) => ({ sent: false, why: String(e) }));
      if (r.item.kind === "bug") await bugEvent(r.item, "website", body.failure).catch(() => null);
    }
    delete r.contact; delete r.bug_private;
    return res.end(JSON.stringify(r));
  }
  res.statusCode = 400; res.end(JSON.stringify({ ok: false, error: "unknown action" }));
}
