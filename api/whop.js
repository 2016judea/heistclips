// The Whop app. /experiences/<exp_…> is what a campaign owner's clippers see inside their Whop:
// that owner's campaign, its rules, and a queue of ready clips from the channels the owner named.
// /dashboard/<biz_…> is the owner's setup. Auth and storage: lib/whop.js. The owner states which
// channels the campaign pays for, so here the campaign match is exact, not inferred.
import { latestSnapshot, getJSON, putJSON } from "../lib/store.js";
import { matchOne, parseChanKey, paysFor, caption, lengthRule } from "../lib/autopilot.js";
import * as W from "../lib/watch.js";
import * as WH from "../lib/whop.js";
import { whopPage, whopOutsidePage } from "../lib/whoppage.js";

const json = (res, status, obj) => { res.statusCode = status; res.setHeader("content-type", "application/json"); res.setHeader("cache-control", "no-store"); res.end(JSON.stringify(obj)); };
const html = (res, status, body) => { res.statusCode = status; res.setHeader("content-type", "text/html; charset=utf-8"); res.setHeader("cache-control", "private, no-store"); res.end(body); };

async function body(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = []; for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch (e) { return {}; }
}

const slimCampaign = (c) => c && ({ id: c.id, slug: c.slug, title: c.title, owner: c.owner, rate_per_1k: c.rate_per_1k, per_post: c.per_post, cap_per_clip: c.cap_per_clip, budget_left: c.budget_left, hours_left: c.hours_left,
  expected_per_clip: c.expected_per_clip, clippers: c.clippers_count, platforms: c.platforms, approval_required: c.approval_required, requirements: c.requirements || [], length_rule: lengthRule(c.description), source_url: c.source_url,
  brief: String(c.description || "").slice(0, 600) });

// The channels a campaign's own brief or title points at, as a starting suggestion for the owner.
function guessChannels(c, snap, named) {
  const out = [];
  for (const s of [...(snap.streamers || []), ...named]) if (paysFor(c, s)) out.push((s.platform === "kick" ? "kick:" : "twitch:") + s.login);
  return [...new Set(out)].slice(0, 6);
}

// Everything one view needs. `id` is exp_… or biz_…; `level` is admin | customer.
export async function viewData(id, userId, level, justSaved = null) {
  const snap = await latestSnapshot();
  const campaigns = (snap && snap.campaigns) || [];
  let cfg = justSaved || (await WH.loadCfg(id)); // Blob reads lag writes by seconds: never re-read what we just wrote
  let inherited = false;
  if (!cfg && id.startsWith("exp_")) { // fall back to the business default
    const exp = await WH.experience(id);
    const biz = exp && exp.company && exp.company.id;
    if (biz) { cfg = await WH.loadCfg(biz); inherited = !!cfg; }
  }
  const campaign = cfg && campaigns.find((c) => c.id === cfg.campaign_id);
  const chans = cfg ? await Promise.all((cfg.channels || []).map((key) => W.loadChannel(key))) : [];
  const st = userId ? ((await getJSON(WH.statePath(id, userId), { fresh: true }).catch(() => null)) || { items: {} }) : { items: {} };
  const items = [];
  (cfg ? cfg.channels : []).forEach((key, i) => {
    const ch = chans[i];
    if (!ch) return;
    const chan = { ...parseChanKey(key), name: ch.name };
    for (const m of ch.moments || []) {
      if (st.items[m.id]) continue;
      const match = campaign ? matchOne(m, chan, campaign, { force: "owner" }) : null;
      if (campaign && !match) continue; // budget spent
      items.push({ id: m.id, channel: key, channel_name: ch.name || chan.login, avatar: ch.avatar || null, vod_id: m.vod_id, game: m.game, t_start: m.t_start, t_end: m.t_end, length_s: Math.round(m.t_end - m.t_start),
        found_at: m.found_at, live: !!m.live, chat_ratio: m.chat_ratio, clip_requests: m.clip_requests, twitch_clips: m.twitch_clips || 0, music_risk: m.music_risk, score: m.score, quote: m.quote || [], hook: (m.hooks && m.hooks[0]) || "", caption: caption(m, chan, match),
        fits: match ? match.fits : true, checks: match ? match.checks : [], todo: match ? match.todo.filter((t) => t !== "apply first") : [] });
    }
  });
  items.sort((a, b) => (b.fits - a.fits) || (Date.parse(b.found_at) - Date.parse(a.found_at)) || (b.score - a.score));
  return {
    id, level, configured: !!cfg, inherited, campaign_missing: !!cfg && !campaign,
    campaign: slimCampaign(campaign),
    channels: (cfg ? cfg.channels : []).map((key, i) => ({ key, ...parseChanKey(key), name: (chans[i] && chans[i].name) || parseChanKey(key).login, avatar: chans[i] && chans[i].avatar, is_live: !!(chans[i] && chans[i].is_live), missing: !!(chans[i] && chans[i].missing), note: (chans[i] && (chans[i].note || chans[i].error)) || null, scanned_at: chans[i] && chans[i].scanned_at })),
    items: items.slice(0, 40), done: Object.keys(st.items).length,
  };
}

async function auth(req, id) {
  const token = req.headers["x-whop-user-token"];
  if (!token) return { outside: true };
  let userId;
  try { ({ userId } = await WH.verifyUserToken(String(token))); } catch (e) { return { error: "Whop sign-in could not be verified (" + e.message + ")." }; }
  let level;
  try { level = await WH.accessLevel(userId, id); } catch (e) { return { error: "Whop did not answer the access check. Try again." }; }
  return { userId, level };
}

export default async function handler(req, res) {
  const u = new URL(req.url, "https://heistclips.com");
  const id = String(u.searchParams.get("id") || "");
  if (!/^(exp|biz)_[A-Za-z0-9]{6,40}$/.test(id)) return html(res, 404, whopOutsidePage("That is not a Whop experience."));
  const view = id.startsWith("biz_") ? "dash" : "exp";
  try {
    const a = await auth(req, id);
    if (req.method === "GET" && !u.searchParams.get("data") && !u.searchParams.has("campaigns")) {
      if (a.outside) return html(res, 200, whopOutsidePage());
      if (a.error) return html(res, 401, whopOutsidePage(a.error));
      if (a.level === "no_access" || (view === "dash" && a.level !== "admin")) return html(res, 403, whopOutsidePage(view === "dash" ? "Only the team of this business can open its settings." : "You need a membership to this whop to use the clipper here."));
      return html(res, 200, whopPage({ view, data: await viewData(id, a.userId, a.level) }));
    }
    if (a.outside || a.error) return json(res, 401, { error: a.error || "open this inside Whop" });
    if (a.level === "no_access") return json(res, 403, { error: "no access" });

    if (req.method === "GET" && u.searchParams.has("campaigns")) { // owner's campaign search
      if (a.level !== "admin") return json(res, 403, { error: "admins only" });
      const q = String(u.searchParams.get("campaigns") || "").toLowerCase().trim();
      const snap = await latestSnapshot();
      const named = await W.namedStreamers();
      const live = ((snap && snap.campaigns) || []).filter((c) => c.budget_left > 0);
      const hit = (c) => !q || `${c.title} ${c.owner || ""} ${c.id}`.toLowerCase().includes(q) || (q.includes("contentrewards.com") && q.includes(c.id));
      const list = live.filter(hit).sort((x, y) => (y.is_gta - x.is_gta) || (y.budget_left - x.budget_left)).slice(0, 12);
      return json(res, 200, { campaigns: list.map((c) => ({ ...slimCampaign(c), brief: undefined, suggested_channels: guessChannels(c, snap, named) })) });
    }
    if (req.method === "GET") return json(res, 200, await viewData(id, a.userId, a.level));

    if (req.method !== "POST") return json(res, 405, { error: "method" });
    const b = await body(req);
    if (b.action === "config") {
      if (a.level !== "admin") return json(res, 403, { error: "Only the team of this business can change the campaign." });
      const snap = await latestSnapshot();
      const c = ((snap && snap.campaigns) || []).find((x) => x.id === b.campaign_id);
      if (!c) return json(res, 400, { error: "That campaign is not in the live list." });
      const want = [...new Set((Array.isArray(b.channels) ? b.channels : String(b.channels || "").split(/[\s,]+/)).map(W.parseChannelInput).filter(Boolean))].slice(0, 6);
      if (!want.length) return json(res, 400, { error: "Name at least one Twitch or Kick channel your clippers should clip." });
      const cfg = { v: 1, campaign_id: c.id, channels: want, updated_at: new Date().toISOString() };
      await WH.saveCfg(id, cfg);
      // Register the channels with the autopilot cron, and read new ones now.
      const k = WH.watchKey(id);
      const w = (await W.loadWatch(k)) || { ...W.newWatch(null), k, source: "whop" };
      const added = want.filter((x) => !(w.channels || []).includes(x));
      w.channels = want; await W.saveWatch(w);
      const scans = [];
      for (const key of added.slice(0, 2)) { try { const r = await W.scanChannel(key); scans.push({ key, fresh: r.fresh.length, missing: !!r.missing, note: r.note || r.error || null }); } catch (e) { scans.push({ key, error: true }); } }
      return json(res, 200, { ok: true, scans, ...(await viewData(id, a.userId, a.level, cfg)) });
    }
    if (b.action === "state") {
      const p = WH.statePath(id, a.userId);
      const st = (await getJSON(p, { fresh: true }).catch(() => null)) || { items: {} };
      for (const [mid, s] of Object.entries(b.states || {}).slice(0, 100)) if (/^[A-Za-z0-9_-]{4,80}$/.test(mid) && (s === "exported" || s === "skipped")) st.items[mid] = { s, at: new Date().toISOString() };
      const ids = Object.keys(st.items);
      if (ids.length > 400) for (const x of ids.slice(0, ids.length - 400)) delete st.items[x];
      await putJSON(p, st, { maxAge: 0 });
      return json(res, 200, { ok: true });
    }
    return json(res, 400, { error: "unknown action" });
  } catch (e) {
    console.error(e);
    return req.method === "GET" && !u.searchParams.get("data") ? html(res, 500, whopOutsidePage("Something broke. Reload in a minute.")) : json(res, 500, { error: "something broke; try again" });
  }
}
