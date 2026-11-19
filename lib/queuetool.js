// The connector's two queue tools (api/mcp.js lists and dispatches them).
// Who is asking: the connector has no cookie, so a clipper is the heistclips account code (hc_…)
// that cut_clip already hands out and the assistant passes back. The account record remembers
// its queue key. A clipper who started on the website can instead paste their private queue
// link once; holding that link is what proves the queue is theirs.
import { getAccount, createAccount, keep, newAccountsToday, NEW_ACCOUNTS_PER_DAY } from "./accounts.js";
import * as W from "./watch.js";
import { queueFor } from "../api/queue.js";

const SITE = "https://heistclips.com";
const fail = (error, extra = {}) => ({ ok: false, error, ...extra });
const keyFromLink = (s) => { const m = String(s || "").match(/(?:[?&]k=|^)([A-Za-z0-9_-]{20,40})(?:&|$)/); return m && W.validKey(m[1]) ? m[1] : null; };
const link = (k) => `${SITE}/queue?k=${k}&src=mcp`;

async function who(args, { create }) {
  let rec = args.account ? await getAccount(args.account) : null;
  if (args.account && !rec) return fail("That account code is not known. Leave it out to start a new one, or use the code from an earlier call.");
  const pasted = args.queue_link ? keyFromLink(args.queue_link) : null;
  if (args.queue_link && !pasted) return fail("That is not a heistclips queue link. It looks like heistclips.com/queue?k=… (Copy link on the queue page).");
  let w = null;
  if (pasted) { w = await W.loadWatch(pasted); if (!w) return fail("That queue link is not known."); }
  if (!w && rec && rec.queue) w = await W.loadWatch(rec.queue);
  if (!w && !create) return { rec, w: null };
  let fresh = false;
  if (!rec && create) {
    if ((await newAccountsToday()) >= NEW_ACCOUNTS_PER_DAY) return fail("Too many new connector accounts today. Start a queue at the link and paste its private link here.", { start: `${SITE}/queue?src=mcp` });
    rec = await createAccount("mcp"); fresh = true;
  }
  if (!w && create) { w = W.newWatch("acct:" + rec.code); w.source = "mcp"; await W.saveWatch(w); }
  if (rec && w && rec.queue !== w.k) { rec.queue = w.k; await keep(rec); } // remember it for next time
  return { rec, w, fresh };
}

const shape = (i) => ({
  streamer: i.channel_name, platform: i.platform, game: i.game, found: i.found_at, live_when_found: i.live,
  hook: i.hook, caption: i.caption, chat_speed_vs_normal: i.chat_ratio + "x", clip_requests_in_chat: i.clip_requests, length_s: i.length_s, music_risk: i.music_risk && i.music_risk.level,
  campaign: i.match ? { title: i.match.title, pays_as: i.match.rate_per_1k == null && i.match.per_post == null ? "prize pool shared by views (no per-clip rate)" : undefined, typical_per_clip: i.match.rate_per_1k == null && i.match.per_post == null && !i.match.expected_per_clip ? null : i.match.expected_per_clip, rate_per_1k: i.match.rate_per_1k, cap_per_clip: i.match.cap_per_clip, budget_left: i.match.budget_left, rules_checked: i.match.checks, still_to_do: i.match.todo, page: `${SITE}/campaigns/${i.match.slug}?src=mcp` } : null,
  no_campaign_why: i.match ? undefined : i.no_match_why,
  general_fit_not_a_streamer_campaign: i.match ? undefined : (i.general || []).map((g) => ({ title: g.title, typical_per_clip: g.expected_per_clip, cap_per_clip: g.cap_per_clip, still_to_do: g.todo, page: `${SITE}/campaigns/${g.slug}?src=mcp` })),
  // The same numbers cut_clip takes, so a clip can be cut without opening the page.
  cut_with: { source: i.platform === "kick" ? `https://kick.com/${i.channel.split(":")[1]}/videos/${i.vod_id}` : `https://www.twitch.tv/videos/${i.vod_id}`, start: Math.round(i.t_start), end: Math.round(i.t_end), hook: i.hook },
  open_in_editor: `${SITE}/clip?q=${encodeURIComponent(i.platform === "kick" ? `https://kick.com/${i.channel.split(":")[1]}/videos/${i.vod_id}` : i.vod_id)}&qi=${encodeURIComponent(i.id)}&ch=${encodeURIComponent(i.channel)}&src=mcp`,
  watch: i.watch_url,
});

export async function queueTool(name, args = {}) {
  if (name === "my_clip_queue") {
    const a = await who(args, { create: false });
    if (a.ok === false) return a;
    if (!a.w) return fail("No queue yet. Call watch_streamer with a Twitch or Kick channel to start one, or paste the private link from heistclips.com/queue as queue_link.", { start: `${SITE}/queue?src=mcp` });
    const q = await queueFor(a.w.k, { limit: Math.min(30, args.limit || 10) });
    return {
      ok: true, account: a.rec ? a.rec.code : undefined, queue: link(a.w.k),
      watching: q.watch.channels.map((c) => ({ streamer: c.name, platform: c.platform, live_now: c.is_live, paying_campaigns: c.campaigns.length, note: c.missing ? "no channel with that name" : c.note || undefined })),
      ready_clips: q.items.map(shape), already_exported_or_skipped: q.done,
      note: q.items.length ? "Each clip can be cut with cut_clip using its cut_with values, or opened in the editor. Streams are re-read every 10 minutes." : q.watch.channels.length ? "Nothing ready yet: chat has not spiked in the watched streams. New moments land within about 10 minutes of happening." : "Nobody is being watched yet. Call watch_streamer.",
    };
  }
  if (name === "watch_streamer") {
    const key = W.parseChannelInput(args.streamer);
    if (!key) return fail("Pass a Twitch channel name or link, or a Kick channel as kick.com/<name>.");
    const a = await who(args, { create: true });
    if (a.ok === false) return a;
    const w = a.w;
    if (args.remove) {
      w.channels = (w.channels || []).filter((c) => c !== key); await W.saveWatch(w);
      return { ok: true, account: a.rec ? a.rec.code : undefined, queue: link(w.k), removed: key.split(":")[1], watching: w.channels.map((c) => c.split(":")[1]) };
    }
    if (!(w.channels || []).includes(key)) {
      if ((w.channels || []).length >= W.MAX_CHANNELS) return fail(`A watchlist holds ${W.MAX_CHANNELS} streamers. Remove one first (remove: true).`, { watching: w.channels.map((c) => c.split(":")[1]) });
      w.channels = [...(w.channels || []), key]; await W.saveWatch(w);
    }
    let scan = null;
    try { scan = await W.scanChannel(key); } catch (e) { scan = { error: true }; }
    if (scan && scan.missing) { w.channels = w.channels.filter((c) => c !== key); await W.saveWatch(w); return fail(`No ${key.startsWith("kick:") ? "Kick" : "Twitch"} channel called ${key.split(":")[1]}.`, { account: a.rec ? a.rec.code : undefined }); }
    const q = await queueFor(w.k, { limit: 5 });
    const mine = q.watch.channels.find((c) => c.key === key) || {};
    return {
      ok: true, account: a.rec ? a.rec.code : undefined, new_account: !!a.fresh, queue: link(w.k),
      now_watching: mine.name || key.split(":")[1], live_now: !!mine.is_live, watching: q.watch.channels.map((c) => c.name),
      paying_campaigns: (mine.campaigns || []).map((c) => ({ title: c.title, typical_per_clip: c.expected_per_clip, budget_left: c.budget_left, page: `${SITE}/campaigns/${c.slug}?src=mcp` })),
      clips_ready_now: q.items.filter((i) => i.channel === key).length,
      note: (mine.campaigns || []).length ? "Call my_clip_queue to see the ready clips. Keep the account code and pass it back." : `No live campaign pays for ${mine.name || key.split(":")[1]} clips right now; moments are still queued. rank_clipping_campaigns shows who pays. Keep the account code and pass it back.`,
    };
  }
  return fail("unknown tool");
}
