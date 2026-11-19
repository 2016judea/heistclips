// The clipper's side of autopilot: their watchlist and their queue of ready clips.
// Identity is a secret queue key (made on the first save, kept in the browser, carried in a
// private link) so the queue follows them across devices with no login. lib/watch.js stores,
// lib/autopilot.js decides. Exporting a queued clip is charged by /api/credits, unchanged.
import { latestSnapshot } from "../lib/store.js";
import { buildQueue, campaignsFor, parseChanKey, isGeneralGta, payingStreamers } from "../lib/autopilot.js";
import * as W from "../lib/watch.js";

const json = (res, status, obj) => { res.statusCode = status; res.setHeader("content-type", "application/json"); res.setHeader("cache-control", "no-store"); res.end(JSON.stringify(obj)); };

async function body(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = []; for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch (e) { return {}; }
}

const maskEmail = (e) => (e ? e.replace(/^(.).*(@.*)$/, "$1…$2") : null);

// What the page shows for one watchlist. Also the function a connector tool can call to let
// Claude read a queue: queueFor(queue_key) -> { watch, items, done, total }.
export async function queueFor(k, { limit = 60 } = {}) {
  const w = await W.loadWatch(k);
  if (!w) return null;
  const snap = await latestSnapshot();
  const campaigns = (snap && snap.campaigns) || [];
  const chans = await Promise.all((w.channels || []).map((key) => W.loadChannel(key)));
  const q = buildQueue(w, chans.map((c, i) => c || { key: w.channels[i], moments: [] }), campaigns, { limit });
  const channels = (w.channels || []).map((key, i) => {
    const c = chans[i] || {};
    const p = parseChanKey(key);
    const pays = campaignsFor({ ...p, name: c.name }, campaigns);
    return { key, ...p, name: c.name || p.login, avatar: c.avatar || null, is_live: !!c.is_live, scanned_at: c.scanned_at || null, missing: !!c.missing, note: c.note || c.error || null,
      moments: (c.moments || []).length, stream: c.stream || null,
      campaigns: pays.map((x) => ({ id: x.id, slug: x.slug, title: x.title, expected_per_clip: x.expected_per_clip, cap_per_clip: x.cap_per_clip, budget_left: x.budget_left })) };
  });
  return {
    watch: { channels, campaigns: w.campaigns || [], email: maskEmail(w.notify && w.notify.email), email_ok: !!(w.notify && w.notify.email_ok), push: ((w.notify && w.notify.push) || []).length, has_paid_key: !!w.paid_key },
    items: q.items, done: q.done, total: q.total, generated_at: new Date().toISOString(),
    files: Object.entries(w.items || {}).filter(([, v]) => v.file && Date.now() - Date.parse(v.at) < 72 * 3600 * 1000).sort((a, b) => (a[1].at < b[1].at ? 1 : -1)).slice(0, 12).map(([id, v]) => ({ id, url: v.file, at: v.at, hook: v.hook || "", name: v.name || "" })),
  };
}

// "Paying right now": every streamer a live campaign names (by channel link, by name in the
// title, or resolved from the title by the cron), best-paying first, with the clipper count.
async function suggestions() {
  const snap = await latestSnapshot();
  if (!snap) return { streamers: [], general: 0 };
  const named = await W.namedStreamers();
  const live = snap.campaigns.filter((c) => c.budget_left > 0);
  const rows = payingStreamers([...(snap.streamers || []), ...named], live);
  return { streamers: rows.slice(0, 40), general: live.filter(isGeneralGta).length, at: snap.generated_at };
}

export default async function handler(req, res) {
  const u = new URL(req.url, "https://heistclips.com");
  try {
    if (req.method === "GET") {
      if (u.searchParams.get("suggest")) { res.setHeader("cache-control", "public, max-age=60, s-maxage=300"); res.setHeader("content-type", "application/json"); return res.end(JSON.stringify(await suggestions())); }
      if (u.searchParams.get("vapid")) return json(res, 200, { key: process.env.VAPID_PUBLIC_KEY || null });
      // One moment, with its chat, for the /clip hand-off. Public stream data, no key needed.
      const mid = u.searchParams.get("moment");
      if (mid) {
        const key = W.parseChannelInput(u.searchParams.get("ch"));
        const c = key && (await W.loadChannel(key));
        const m = c && (c.moments || []).find((x) => x.id === mid);
        if (!m) return json(res, 404, { error: "that clip is no longer in the queue" });
        return json(res, 200, { moment: m, channel: { key, name: c.name, avatar: c.avatar } });
      }
      const k = u.searchParams.get("k");
      if (!W.validKey(k)) return json(res, 400, { error: "no queue key" });
      if (u.searchParams.get("count")) { // the service worker's question after a push
        const q = await queueFor(k, { limit: 200 });
        if (!q) return json(res, 404, { error: "unknown queue" });
        const w = await W.loadWatch(k);
        const since = Date.parse((w.notify && w.notify.seen_at) || 0) || 0;
        const fresh = q.items.filter((i) => Date.parse(i.found_at) > since);
        return json(res, 200, { new: fresh.length, open: q.items.length, names: [...new Set(fresh.map((i) => i.channel_name))].slice(0, 3), paid: fresh.filter((i) => i.match).length });
      }
      const q = await queueFor(k);
      if (!q) return json(res, 404, { error: "unknown queue" });
      return json(res, 200, q);
    }
    if (req.method !== "POST") return json(res, 405, { error: "method" });
    const b = await body(req);
    const act = String(b.action || "");

    // save: the whole watchlist at once (idempotent, so a stale read cannot drop a channel).
    if (act === "save") {
      let w = W.validKey(b.k) ? await W.loadWatch(b.k) : null;
      if (b.k && !w) return json(res, 404, { error: "unknown queue" });
      if (!w) w = W.newWatch(b.d);
      const want = [...new Set((Array.isArray(b.channels) ? b.channels : []).map(W.parseChannelInput).filter(Boolean))].slice(0, W.MAX_CHANNELS);
      const added = want.filter((c) => !(w.channels || []).includes(c));
      w.channels = want;
      if (Array.isArray(b.campaigns)) w.campaigns = b.campaigns.filter((x) => typeof x === "string" && /^[A-Za-z0-9_-]{6,60}$/.test(x)).slice(0, 40);
      if (b.d && !(w.devices || []).includes(b.d)) w.devices = [...(w.devices || []), String(b.d).slice(0, 80)].slice(-8);
      if (typeof b.paid_key === "string" && /^cs_(live|test)_[A-Za-z0-9]+$/.test(b.paid_key)) w.paid_key = b.paid_key;
      await W.saveWatch(w);
      // A channel nobody has watched before is read right now, so the first visit is not empty.
      const scans = [];
      for (const key of added.slice(0, 2)) {
        try { const r = await W.scanChannel(key); scans.push({ key, fresh: r.fresh.length, missing: !!r.missing, skipped: r.skipped || null, note: r.note || r.error || null }); }
        catch (e) { scans.push({ key, error: String(e.message || e).slice(0, 100) }); }
      }
      const gone = scans.filter((s) => s.missing).map((s) => s.key);
      if (gone.length) { w.channels = w.channels.filter((c) => !gone.includes(c)); await W.saveWatch(w); }
      const q = await queueFor(w.k);
      return json(res, 200, { k: w.k, paid_key: w.paid_key || null, scans, ...q });
    }

    const w = W.validKey(b.k) ? await W.loadWatch(b.k) : null;
    if (!w) return json(res, 404, { error: "unknown queue" });
    w.notify = w.notify || { push: [] };

    if (act === "state") { // {states: {moment_id: "exported"|"skipped"|"new"}}
      const now = new Date().toISOString();
      for (const [id, s] of Object.entries(b.states || {}).slice(0, 200)) {
        if (!/^[A-Za-z0-9_-]{4,80}$/.test(id)) continue;
        if (s === "new") delete w.items[id];
        else if (s === "exported" || s === "skipped") w.items[id] = { ...(w.items[id] && w.items[id].file ? w.items[id] : {}), s: w.items[id] && w.items[id].file ? "exported" : s, at: (w.items[id] && w.items[id].s === s && w.items[id].at) || now };
      }
      const ids = Object.keys(w.items); // bounded: forget the oldest decisions
      if (ids.length > 600) for (const id of ids.sort((a, c) => (w.items[a].at < w.items[c].at ? -1 : 1)).slice(0, ids.length - 600)) delete w.items[id];
      await W.saveWatch(w);
      return json(res, 200, { ok: true });
    }
    if (act === "seen") { w.notify.seen_at = new Date().toISOString(); await W.saveWatch(w); return json(res, 200, { ok: true }); }
    if (act === "email") {
      const email = String(b.email || "").trim();
      if (!email) { w.notify.email = null; w.notify.email_ok = false; await W.saveWatch(w); return json(res, 200, { ok: true, email: null }); }
      if (!W.validEmail(email)) return json(res, 400, { error: "that does not look like an email address" });
      const last = Date.parse(w.notify.confirm_sent_at || 0) || 0;
      if (Date.now() - last < 60000) return json(res, 429, { error: "a link was just sent; check your inbox" });
      if ((w.notify.confirm_sends || 0) >= 5) return json(res, 429, { error: "too many tries; email aidan@brickandmortar.dev" });
      w.notify.lang = W.MAIL_LANGS.includes(b.lang) ? b.lang : null; // the page's language: mail follows it
      w.notify.email = email; w.notify.email_ok = false; w.notify.confirm_sent_at = new Date().toISOString(); w.notify.confirm_sends = (w.notify.confirm_sends || 0) + 1;
      await W.saveWatch(w);
      const r = await W.sendMail(W.confirmMail(w, email));
      return json(res, 200, { ok: r.sent, email: maskEmail(email), why: r.sent ? null : (r.why || "mail failed " + r.status) });
    }
    if (act === "confirm") {
      if (!w.notify.email || b.token !== W.emailToken(w.k, w.notify.email)) return json(res, 400, { error: "that link is out of date" });
      w.notify.email_ok = true; await W.saveWatch(w);
      return json(res, 200, { ok: true, email: maskEmail(w.notify.email) });
    }
    if (act === "mailoff") { w.notify.email_ok = false; w.notify.email = null; await W.saveWatch(w); return json(res, 200, { ok: true }); }
    if (act === "push") {
      const s = b.sub || {};
      if (typeof s.endpoint !== "string" || !/^https:\/\//.test(s.endpoint) || s.endpoint.length > 600) return json(res, 400, { error: "bad subscription" });
      w.notify.push = [...(w.notify.push || []).filter((x) => x.endpoint !== s.endpoint), { endpoint: s.endpoint, at: new Date().toISOString() }].slice(-5);
      await W.saveWatch(w);
      return json(res, 200, { ok: true, push: w.notify.push.length });
    }
    if (act === "unpush") {
      w.notify.push = (w.notify.push || []).filter((x) => x.endpoint !== (b.sub && b.sub.endpoint));
      await W.saveWatch(w);
      return json(res, 200, { ok: true, push: w.notify.push.length });
    }
    return json(res, 400, { error: "unknown action" });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: "something broke; try again" });
  }
}
