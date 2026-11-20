// plan_my_clips, the connector tool: "I get about N views a clip; what should I clip today?"
// Takes the clipper's size (and optionally their streamers and platforms) and answers with only
// the campaigns that can actually pay at that size (lib/atsize.js), each with the best moments
// to clip right now (find_clip_moments' cached reader + the most-clipped data), the campaign's
// rule checklist, a caption carrying the tags it requires, and the exact cut_clip arguments and
// editor link. It reads; it never cuts or posts.
import { sizeOf, atSize, floorLine, SIZES } from "./atsize.js";
import { paysFor, chanKey } from "./autopilot.js";
import { checklist, captionFor } from "./briefrules.js";

const SITE = "https://heistclips.com";
const MOMENT_WAIT_MS = Number(process.env.HC_PLAN_WAIT_MS) || 25000;
const clock = (t) => `${Math.floor(t / 3600)}:${String(Math.floor((t % 3600) / 60)).padStart(2, "0")}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
// Rank arrays compared left to right: pays a typical clip, $, average, live now.
const cmp = (x, y) => { for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };

// "kaicenat", "twitch.tv/kaicenat", "https://kick.com/x" -> {platform, login}
export function parseStreamer(s) {
  const v = String(s || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");
  const k = v.match(/^kick\.com\/([a-z0-9_-]{2,40})/);
  if (k) return { platform: "kick", login: k[1] };
  const t = v.match(/^(?:twitch\.tv\/)?@?([a-z0-9_]{2,25})$/);
  return t ? { platform: "twitch", login: t[1] } : null;
}

const PLATS = ["tiktok", "youtube", "instagram", "x"];

// Which (campaign, streamer) pairs to consider. Named streamers: every live campaign that pays
// for their clips. None named: every streamer a live campaign names.
export function candidates(snap, { streamers = [], platforms = null } = {}) {
  const live = (snap.campaigns || []).filter((c) => c.budget_left > 0 && (!platforms || (c.platforms || []).some((p) => platforms.includes(p))));
  const known = new Map((snap.streamers || []).map((s) => [chanKey(s.platform, s.login), s]));
  const who = streamers.length ? streamers.map((x) => ({ ...x, ...(known.get(chanKey(x.platform, x.login)) || {}), platform: x.platform, login: x.login }))
    : [...known.values()];
  const pairs = [];
  for (const s of who) {
    const ids = new Set(s.campaign_ids || []);
    for (const c of live) if (ids.has(c.id) || paysFor(c, s)) pairs.push({ c, s });
  }
  return { pairs, live: live.length, asked: who };
}

// One moment as a ready step: why it is worth it, the hook, the cut_clip arguments, the editor.
function stepFor(m, source, need, tag, i = 0) {
  let start = m.t_start_s, end = m.t_end_s;
  const L = need.length;
  let trimmed = null;
  if (L && L.max && end - start > L.max) { start = Math.max(0, end - Math.min(60, L.max)); trimmed = `trimmed to ${end - start} s for the length rule`; }
  if (L && L.min && end - start < L.min) { end = start + Math.min(60, L.min); trimmed = `lengthened to ${end - start} s for the length rule`; }
  if (end - start > 60) start = end - 60;
  // The finder's first hook is often the same line for every moment of one kind: rotate, so three
  // clips of one stream do not open on the same words.
  const hooks = m.hooks || [];
  const hook = hooks.length ? hooks[i % hooks.length] : "";
  return {
    at: clock(start), why: `chat ran ${m.chat_speed_vs_normal} its normal speed${m.event_type ? ` (${m.event_type})` : ""}${m.top_chat_phrase ? `, chat typed "${String(m.top_chat_phrase).slice(0, 60)}"` : ""}${m.clip_requests_in_chat ? `, ${m.clip_requests_in_chat} asked for a clip` : ""}`,
    hook, other_hooks: hooks.filter((h) => h !== hook).slice(0, 2), music_risk: m.music_risk, spoiler_risk: m.spoiler_risk, ...(trimmed ? { note: trimmed } : {}),
    cut_clip: { source, start, end, layout: "fit", hook: hook.slice(0, 90) },
    open_in_editor: tag(`${SITE}/clip?q=${encodeURIComponent(source)}&t=${start}`),
    watch: m.watch,
  };
}

const memo = new Map(); // args -> { at, out }: an assistant that asks twice gets the same plan at once

// deps: { snapshot(), trend(), findClipMoments(args, {tag}) } (injected by api/mcp.js and tests).
export async function planMyClips(args = {}, { deps, tag = (u) => u } = {}) {
  const key = JSON.stringify(args);
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < 60000) return { out: hit.out, log: { ...hit.log, cache: "warm" } };
  const size = args.views_per_clip != null && Number(args.views_per_clip) > 0 ? sizeOf(Number(args.views_per_clip)) : sizeOf(args.account_size || "new");
  const platforms = Array.isArray(args.platforms) && args.platforms.length ? args.platforms.map((p) => String(p).toLowerCase()).filter((p) => PLATS.includes(p)) : null;
  const named = (Array.isArray(args.streamers) ? args.streamers : args.streamers ? [args.streamers] : []).slice(0, 10);
  const asked = named.map(parseStreamer).filter(Boolean);
  const limit = Math.max(1, Math.min(5, Number(args.limit) || 3));
  const perCampaign = Math.max(1, Math.min(5, Number(args.moments_per_campaign) || 3));
  const snap = await deps.snapshot();
  if (!snap) return { out: { ok: false, error: "Campaign data is warming up. Try again in a minute." }, log: { err: "no_snapshot" } };
  const { pairs } = candidates(snap, { streamers: asked, platforms });

  // Each streamer once, with the campaign that pays them best at this size.
  const best = new Map();
  for (const { c, s } of pairs) {
    const a = atSize(c, size, { platforms });
    const k = chanKey(s.platform, s.login);
    const rank = [a.usd > 0 ? 2 : a.usd == null ? 1 : 0, a.usd || 0, a.avg || 0, s.live_now ? 1 : 0];
    const cur = best.get(k);
    if (!cur || cmp(rank, cur.rank) > 0) best.set(k, { c, s, a, rank });
  }
  const all = [...best.values()].sort((x, y) => cmp(y.rank, x.rank));
  const canPay = all.filter((x) => x.a.usd > 0);
  const longShots = all.filter((x) => x.a.usd === 0 && x.a.chance > 0);
  // Long shots (pay only when a clip breaks out) are planned only when nothing pays a typical clip.
  // A few more than asked are read, so a stream with nothing to clip right now gives way to one
  // that has moments; the ones left over are still listed under also_pays_you.
  const pool = (canPay.length ? canPay : longShots).slice(0, limit + 3);

  const trend = await deps.trend().catch(() => null);
  const read = await Promise.all(pool.map(async ({ c, s, a }) => {
    const { items, need } = checklist(c);
    const source = s.platform === "kick" ? `kick.com/${s.login}` : s.login;
    const mine = ((trend && trend.moments) || []).filter((m) => m.platform === s.platform && m.login === s.login).slice(0, 3);
    let found = null, note = null;
    try {
      found = await Promise.race([deps.findClipMoments({ source, limit: perCampaign + 2, skip_spoilers: need.spoilersBanned }, { tag }).then((r) => r.out),
        new Promise((r) => setTimeout(() => r("timeout"), MOMENT_WAIT_MS))]);
    } catch (e) { found = null; note = "Could not read this stream's chat just now."; }
    if (found === "timeout") { found = null; note = `Still reading this stream's chat. Call find_clip_moments with source "${source}" in a moment.`; }
    else if (found && found.found === false) { note = found.message || "No stream to read for this streamer right now."; found = null; }
    const usable = ((found && found.moments) || []).filter((m) => m.music_risk !== "high").slice(0, perCampaign);
    const streamSource = found && found.stream ? (found.stream.platform === "kick" ? found.stream.url : found.stream.url || source) : source;
    const moments = usable.map((m, i) => stepFor(m, streamSource, need, tag, i));
    if (found && !moments.length && !note) note = (found.moments || []).length ? "Every moment found has licensed music in it (likely claimed): none is worth posting." : found.note || "No clear moments in this stream yet.";
    const cap = captionFor({ hook: (moments[0] && moments[0].hook) || "", streamer: { name: s.name || (found && found.stream && found.stream.channel) || s.login, login: s.login }, need, platform: s.platform });
    const floor = floorLine(c);
    return {
      campaign: {
        title: c.title, owner: c.owner, marketplace: c.marketplace || "Content Rewards", page: tag(`${SITE}/campaigns/${c.slug}`), join: c.source_url, join_on: c.marketplace || "Content Rewards",
        typical_per_clip: c.expected_per_clip, likely_per_clip_at_your_size: a.usd, clips_that_pay_anything: a.chance == null ? null : `${Math.round(a.chance * 20)} in 20`,
        best_platform: a.platform, rate_per_1k: c.rate_per_1k, cap_per_clip: c.cap_per_clip, budget_left: c.budget_left,
        floor: floor || "no floor: every view pays", ...(a.clips_to_qualify ? { clips_to_pass_the_pool_bar: a.clips_to_qualify } : {}),
      },
      pays_your_typical_clip: a.usd > 0,
      ...(a.usd > 0 ? {} : { long_shot: `Pays only when a clip breaks out: ${floor ? floor.toLowerCase() : "a floor applies"}; about ${Math.round(a.chance * 20)} in 20 of your clips get there.` }),
      streamer: { name: s.name || s.login, platform: s.platform, login: s.login, live_now: !!s.live_now, find_clip_moments_source: source },
      stream: found && found.stream ? { title: found.stream.title, game: found.stream.game, status: found.stream.status, url: found.stream.url } : null,
      moments, ...(note ? { moments_note: note } : {}),
      most_clipped_here: mine.map((m) => ({ at: clock(m.t), clips_made: m.clips, open_in_editor: tag(SITE + String(m.clip_path || "").replace("&src=trend", "")) })),
      rules: items,
      caption: cap.caption, tags: cap.tags,
    };
  }));
  const withMoments = read.filter((p) => p.moments.length || p.most_clipped_here.length);
  const plans = [...withMoments, ...read.filter((p) => !withMoments.includes(p))].slice(0, limit);
  // Campaigns that pay a typical clip but did not make the plan (nothing to clip on that stream now).
  const left = !canPay.length ? [] : [...read.filter((p) => !plans.includes(p)), ...canPay.slice(limit + 3)].slice(0, 8).map((p) => p.campaign && p.streamer
    ? { campaign: p.campaign.title, streamer: p.streamer.name, likely_per_clip_at_your_size: p.campaign.likely_per_clip_at_your_size, page: p.campaign.page, ...(p.moments_note ? { note: p.moments_note } : {}) }
    : { campaign: p.c.title, streamer: p.s.name || p.s.login, likely_per_clip_at_your_size: p.a.usd, page: tag(`${SITE}/campaigns/${p.c.slug}`) });
  const chosen = pool.filter((_, i) => plans.includes(read[i]));

  const cannot = all.filter((x) => !(x.a.usd > 0) && !chosen.includes(x)).slice(0, 8).map(({ c, s, a }) => ({
    campaign: c.title, streamer: s.name || s.login, page: tag(`${SITE}/campaigns/${c.slug}`),
    why: a.usd == null ? (a.why === "pool not priced yet" ? "pool has no views yet to price it" : "floor unknown, check the brief") : floorLine(c) || "pays nothing at your size",
  }));
  const label = size.long || size.label;
  const summary = !all.length
    ? (asked.length ? `No live campaign pays for clips of ${named.join(", ")} right now.` : "No live campaign names a streamer right now.")
    : canPay.length
      ? `${canPay.length} of ${all.length} streamer${all.length === 1 ? "" : "s"} with a live campaign can pay a typical clip at ${label}.`
      : `At ${label}, none of the ${all.length} streamer campaign${all.length === 1 ? "" : "s"} pays a typical clip: each has a floor above your views. ${longShots.length ? "The plan below is the long shots: they pay only when a clip breaks out." : ""}`.trim();
  const out = {
    your_size: { views_per_clip: size.median, label, sizes_you_can_pass: SIZES.map((x) => x.id) },
    summary,
    plan: plans,
    ...(left.length ? { also_pays_you: left } : {}),
    cannot_pay_you: cannot,
    how_likely_is_computed: "likely_per_clip_at_your_size = what your typical (median) clip earns after the campaign's floor (minimum payout per clip, minimum views per clip, a pool's total-views bar). Views assumed to spread like a channel's (log-normal, sigma 1.6). Floors are read from each campaign's own settings on Content Rewards.",
    next: plans.length ? "Nothing was cut or posted. To make a clip, call cut_clip with a moment's cut_clip arguments (keep the account code it returns), or give the user its open_in_editor link. Read the rules list to the user first: lines marked you or brief are theirs to check." : "Nothing to clip for money at this size right now. Offer find_clip_moments for practice clips, or a bigger size if the user's clips get more views.",
    more: tag(`${SITE}/gta-6-clipping-campaigns`),
  };
  const log = { moments: plans.reduce((n, p) => n + p.moments.length, 0), status: canPay.length ? "can_pay" : longShots.length ? "long_shots" : "none", kind: size.id };
  if (memo.size > 100) memo.clear();
  memo.set(key, { at: Date.now(), out, log });
  return { out, log };
}
