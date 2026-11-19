// Cron, every 10 min: read every watched channel once (however many people watch it), add
// the new moments to that channel's file, and tell the people who asked to be told.
//
// THE CAP, per run: at most MAX_CHANNELS_PER_RUN channels or BUDGET_MS of wall time, whichever
// comes first; at most 2 Kick channels (Kick throttles); a channel is not re-read within 9 min.
// Order: never-read first, then live, then stalest. A first read covers at most the last 6 h of
// the stream; later reads cover only the new minutes. What did not fit waits for the next run.
// Mail: one "clips ready" mail per person per 6 h and MAX_MAILS_PER_DAY in total (the Mailgun
// account is shared and capped at 100 sends a day).
import { latestSnapshot, getJSON, putJSON } from "../lib/store.js";
import { buildQueue, parseChanKey } from "../lib/autopilot.js";
import * as W from "../lib/watch.js";

export const MAX_CHANNELS_PER_RUN = 25;
export const BUDGET_MS = 85000;
export const MAX_KICK_PER_RUN = 2;
export const MAX_MAILS_PER_DAY = 30;
const MAIL_GAP_MS = 6 * 3600 * 1000;
const PUSH_GAP_MS = 20 * 60 * 1000;

// Which channels this run reads, in order. Pure, so the cap is testable.
export function plan(channels, state, now = Date.now()) {
  const due = channels.filter((key) => { const s = state[key]; return !s || !s.scanned_at || now - Date.parse(s.scanned_at) >= W.RESCAN_MIN_S * 1000; });
  const rank = (key) => { const s = state[key]; return !s || !s.scanned_at ? 0 : s.is_live ? 1 : 2; };
  due.sort((a, b) => rank(a) - rank(b) || (Date.parse((state[a] || {}).scanned_at || 0) - Date.parse((state[b] || {}).scanned_at || 0)));
  const out = []; let kick = 0;
  for (const key of due) {
    if (out.length >= MAX_CHANNELS_PER_RUN) break;
    if (parseChanKey(key).platform === "kick") { if (kick >= MAX_KICK_PER_RUN) continue; kick++; }
    out.push(key);
  }
  return out;
}

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret && (req.headers["authorization"] || "") !== `Bearer ${secret}`) { res.statusCode = 401; return res.end("no"); }
  const t0 = Date.now();
  const out = { ok: true, watchlists: 0, channels: 0, due: 0, scanned: 0, skipped_for_time: 0, new_moments: 0, pushes: 0, mails: 0, errors: [] };
  try {
    const { idx, idxPath, users, read } = await W.allWatchlists();
    out.watchlists = users.length; out.watchlists_read = read;
    const watchers = new Map();
    for (const u of users) for (const key of u.channels || []) { if (!watchers.has(key)) watchers.set(key, []); watchers.get(key).push(u); }
    out.channels = watchers.size;
    idx.channels = idx.channels || {};
    for (const key of Object.keys(idx.channels)) if (!watchers.has(key)) delete idx.channels[key]; // nobody watches it any more
    const todo = plan([...watchers.keys()], idx.channels, t0);
    out.due = todo.length;
    const freshBy = new Map();
    for (const key of todo) {
      const kick = parseChanKey(key).platform === "kick";
      if (Date.now() - t0 > BUDGET_MS - (kick ? 45000 : 25000)) { out.skipped_for_time++; continue; }
      try {
        const r = await W.scanChannel(key, { force: true });
        idx.channels[key] = { scanned_at: new Date().toISOString(), is_live: !!r.is_live, missing: !!r.missing };
        out.scanned++;
        if (r.fresh.length) { freshBy.set(key, r.fresh); out.new_moments += r.fresh.length; }
        if (r.error) out.errors.push(key + ": " + r.error);
      } catch (e) { out.errors.push(key + ": " + String(e.message || e).slice(0, 80)); idx.channels[key] = { ...(idx.channels[key] || {}), scanned_at: new Date().toISOString() }; }
    }

    // Tell the people who asked. A push carries no content (the browser asks the queue what is new).
    if (freshBy.size) {
      const snap = await latestSnapshot();
      const day = new Date().toISOString().slice(0, 10);
      idx.mail = idx.mail && idx.mail.day === day ? idx.mail : { day, sent: 0 };
      for (const u of users) {
        const n = u.notify || {};
        const mine = (u.channels || []).filter((key) => freshBy.has(key));
        if (!mine.length || (!(n.push || []).length && !(n.email && n.email_ok))) continue;
        if (Date.now() - t0 > BUDGET_MS + 20000) break;
        const w = await W.loadWatch(u.k);
        if (!w) continue;
        w.notify = w.notify || {};
        let dirty = false;
        if ((w.notify.push || []).length && Date.now() - (Date.parse(w.notify.last_push || 0) || 0) > PUSH_GAP_MS) {
          const keep = [];
          for (const sub of w.notify.push) { const r = await W.sendPush(sub).catch(() => ({ ok: false })); if (r.ok) out.pushes++; if (!r.gone) keep.push(sub); }
          w.notify.push = keep; w.notify.last_push = new Date().toISOString(); dirty = true;
        }
        if (w.notify.email && w.notify.email_ok && idx.mail.sent < MAX_MAILS_PER_DAY && Date.now() - (Date.parse(w.notify.last_mail || 0) || 0) > MAIL_GAP_MS) {
          const chans = await Promise.all(mine.map((key) => W.loadChannel(key)));
          const q = buildQueue(w, chans.map((c, i) => ({ ...(c || { key: mine[i] }), moments: freshBy.get(mine[i]) })), (snap && snap.campaigns) || []);
          if (q.items.length) {
            const r = await W.sendMail(W.readyMail(w, q.items)).catch(() => ({ sent: false }));
            if (r.sent) { out.mails++; idx.mail.sent++; w.notify.last_mail = new Date().toISOString(); dirty = true; }
          }
        }
        if (dirty) await W.saveWatch(w);
      }
    }
    await putJSON(idxPath, idx, { maxAge: 0 });
    // A public, count-only heartbeat (no keys, no emails) so the cap is observable.
    out.ms = Date.now() - t0;
    await putJSON("watch/status.json", { at: new Date().toISOString(), ...out, errors: out.errors.length }, { maxAge: 30 });
  } catch (e) { console.error(e); out.ok = false; out.error = String(e.message || e).slice(0, 200); }
  out.ms = Date.now() - t0;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(out));
}
