// Autopilot, the pure part (no I/O): which campaign a moment should be clipped for, and the
// queue a clipper sees. Entities are in DATA_MODEL.md ("Autopilot"). Every number comes from
// the campaign snapshot or the moment; nothing here is guessed, and a rule we cannot read is
// reported as "check the brief", never as passed.

const norm = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "");
const words = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();

export const chanKey = (platform, login) => `${platform === "kick" ? "kick" : "twitch"}:${String(login || "").toLowerCase()}`;
export function parseChanKey(key) {
  const [platform, login] = String(key).split(":");
  return { platform, login };
}

// Words that are a streamer's handle but also plain campaign vocabulary: never match on these.
const COMMON = new Set(["clip", "clips", "clipping", "gaming", "stream", "streamer", "live", "game", "games", "official", "reach", "kick", "twitch", "music", "artist", "promo", "campaign", "pool", "marathon"]);

// Does this campaign pay for clips of this streamer? "handle": the brief links their channel.
// "name": their name is in the campaign's title. null: the campaign does not name them.
export function paysFor(campaign, chan) {
  const login = String(chan.login || "").toLowerCase();
  const d = String(campaign.description || "").toLowerCase();
  const host = chan.platform === "kick" ? "kick.com/" : "twitch.tv/";
  const at = d.indexOf(host + login);
  if (at >= 0 && !/[a-z0-9_]/.test(d[at + host.length + login.length] || "")) return "handle";
  const title = norm(campaign.title), titleW = " " + words(campaign.title) + " ";
  for (const cand of new Set([login.replace(/_+$/g, "").replace(/^_+/g, ""), norm(chan.name)])) {
    const c = norm(cand);
    if (c.length < 4 || COMMON.has(c)) continue;
    // Whole-word match for short names ("clix", "lacy"); a run-together match for long ones
    // ("Kai Cenat" names kaicenat).
    if (titleW.includes(" " + c + " ")) return "name";
    if (c.length >= 7 && title.includes(c)) return "name";
  }
  return null;
}

// Does the campaign name some OTHER streamer's channel? Then it is not a general campaign.
const namesAChannel = (c) => /(twitch\.tv|kick\.com)\/[a-z0-9_-]{3,}/i.test(c.description || "");

// "15-60 seconds", "under 60s", "at least 20 sec" -> {min, max}. Anything else: null (unknown).
export function lengthRule(description) {
  const d = String(description || "");
  let m = d.match(/\b(\d{1,3})\s?(?:-|–|to)\s?(\d{1,3})\s?(?:s|sec|secs|seconds)\b/i);
  if (m) return { min: Number(m[1]), max: Number(m[2]) };
  m = d.match(/\b(?:under|max(?:imum)?|no (?:longer|more) than|up to|less than)\s+(\d{1,3})\s?(?:s|sec|secs|seconds)\b/i);
  if (m) return { min: 0, max: Number(m[1]) };
  m = d.match(/\b(?:at least|min(?:imum)?|over|longer than|more than)\s+(\d{1,3})\s?(?:s|sec|secs|seconds)\b/i);
  if (m) return { min: Number(m[1]), max: 600 };
  return null;
}

const GTA_GAME = /grand theft auto|gta/i;
const GTA_TITLE = /\bgta\s?(6|vi|v|5)?\b|grand theft auto/i;

// One moment against one campaign. Returns null when the campaign does not pay for this
// streamer; otherwise the match with every rule we could read and its verdict.
export function matchOne(moment, chan, c) {
  const pays = paysFor(c, chan);
  if (!pays) return null;
  if (!(c.budget_left > 0)) return null;
  const checks = [];
  const todo = [];
  let ok = true;
  if (GTA_TITLE.test(c.title || "")) {
    const game = moment.game || "";
    if (!game) todo.push("campaign is for GTA: check the stream was GTA");
    else if (GTA_GAME.test(game)) checks.push("GTA stream");
    else { ok = false; checks.push(`campaign is for GTA; this stream was ${game}`); }
  }
  const len = Math.round(moment.t_end - moment.t_start);
  const lr = lengthRule(c.description);
  if (lr) {
    if (len >= lr.min && len <= lr.max) checks.push(`${len} s fits ${lr.min}–${lr.max} s`);
    else todo.push(`trim to ${lr.min}–${lr.max} s (this cut is ${len} s)`);
  } else if ((c.requirements || []).includes("length rule")) todo.push("length rule in the brief");
  if (moment.music_risk && moment.music_risk.level === "high") todo.push("licensed music here: likely claimed");
  for (const r of c.requirements || []) {
    if (r === "length rule") continue;
    if (r === "audio rule") todo.push("audio rule in the brief");
    else if (r === "tags/caption rule") todo.push("required tags in the brief");
    else if (r === "spoiler rule") todo.push("spoiler rule in the brief");
    else todo.push(r);
  }
  if (c.approval_required) todo.push("apply first");
  return {
    campaign_id: c.id, slug: c.slug, title: c.title, owner: c.owner, source_url: c.source_url,
    pays_for_streamer: pays, fits: ok, checks, todo,
    expected_per_clip: c.expected_per_clip, rate_per_1k: c.rate_per_1k, per_post: c.per_post, cap_per_clip: c.cap_per_clip,
    budget_left: c.budget_left, hours_left: c.hours_left, platforms: c.platforms || [],
  };
}

// Best first: fits before does-not-fit, a track record before none, then typical $ per clip,
// then the most one clip can earn.
export function rankMatches(ms) {
  const v = (m) => (m.expected_per_clip == null ? -1 : m.expected_per_clip);
  return ms.slice().sort((a, b) => (b.fits - a.fits) || (v(b) - v(a)) || ((b.cap_per_clip || 0) * (b.rate_per_1k || 0) - (a.cap_per_clip || 0) * (a.rate_per_1k || 0)) || (b.budget_left - a.budget_left));
}

// Every live campaign that pays for clips of this streamer.
export function campaignsFor(chan, campaigns) {
  return campaigns.filter((c) => c.budget_left > 0 && paysFor(c, chan));
}

// The post text: the hook, then tags the platforms group by. Tags a campaign demands are in
// its brief (free text); we only add ones we can derive.
export function caption(moment, chan, match) {
  const tag = (s) => "#" + norm(s);
  const tags = new Set();
  if (chan.name || chan.login) tags.add(tag(chan.name || chan.login));
  if (GTA_GAME.test(moment.game || "")) { tags.add("#gta6"); tags.add("#gtavi"); }
  else if (moment.game) tags.add(tag(moment.game));
  tags.add("#clips"); tags.add("#fyp");
  const hook = (moment.hooks && moment.hooks[0]) || "";
  return `${hook} ${[...tags].filter((t) => t.length > 1).slice(0, 6).join(" ")}`.trim();
}

// The queue for one watchlist. `channels` is [{key, name, avatar, moments[]}] (one file per
// watched channel), `watch` is the clipper's own record.
export function buildQueue(watch, channels, campaigns, { limit = 60 } = {}) {
  const chosen = watch.campaigns && watch.campaigns.length ? new Set(watch.campaigns) : null;
  const state = watch.items || {};
  const items = [];
  for (const ch of channels) {
    if (!ch) continue;
    const chan = { ...parseChanKey(ch.key), name: ch.name };
    const pool = campaignsFor(chan, campaigns);
    for (const m of ch.moments || []) {
      const all = rankMatches(pool.map((c) => matchOne(m, chan, c)).filter(Boolean));
      const mine = chosen ? all.filter((x) => chosen.has(x.campaign_id)) : all;
      const best = mine.find((x) => x.fits) || null;
      // A better-paying campaign they have not picked is worth one line, not a second list.
      const better = chosen && all.find((x) => x.fits && !chosen.has(x.campaign_id) && (x.expected_per_clip || 0) > ((best && best.expected_per_clip) || 0));
      const st = state[m.id] || {};
      items.push({
        id: m.id, channel: ch.key, channel_name: ch.name || chan.login, avatar: ch.avatar || null, platform: chan.platform,
        vod_id: m.vod_id, vod_title: m.vod_title, game: m.game, t_start: m.t_start, t_end: m.t_end, length_s: Math.round(m.t_end - m.t_start),
        found_at: m.found_at, live: !!m.live, chat_ratio: m.chat_ratio, event_type: m.event_type, clip_requests: m.clip_requests,
        twitch_clips: m.twitch_clips || 0, twitch_clip_views: m.twitch_clip_views || 0, music_risk: m.music_risk, score: m.score,
        quote: m.quote || null, hooks: m.hooks || [], hook: (m.hooks && m.hooks[0]) || "",
        caption: caption(m, chan, best), watch_url: m.url,
        match: best, better: better || null, no_match_why: best ? null : (pool.length ? "none of your campaigns fits this clip" : `no live campaign names ${ch.name || chan.login}`),
        state: st.s || "new", state_at: st.at || null,
      });
    }
  }
  const pay = (i) => (i.match && i.match.expected_per_clip != null ? i.match.expected_per_clip : i.match ? 0 : -1);
  // Paid clips first, freshest first inside each day, strongest moment as the tiebreak.
  items.sort((a, b) => ((pay(b) >= 0) - (pay(a) >= 0)) || (Date.parse(b.found_at || 0) - Date.parse(a.found_at || 0)) || (b.score - a.score));
  const open = items.filter((i) => i.state === "new");
  return { items: open.slice(0, limit), done: items.filter((i) => i.state !== "new").length, total: items.length };
}
