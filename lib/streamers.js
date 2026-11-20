// Which streamers get a page: whoever is live in GTA right now (accumulated across refreshes),
// any Twitch/Kick handle a paying campaign links in its brief, and the channel a GTA campaign
// names only in its title ("KreekCraft GTA 6 Clipping"), resolved against Twitch and Kick.
import { gql } from "../public/js/twitch.js";
import { getJSON, putJSON } from "./store.js";
import { chanKey, isGeneralGta } from "./autopilot.js";

export const GTA_GAMES = ["Grand Theft Auto VI", "Grand Theft Auto V"];
const KICK_API = "https://kick.com/api";
const UA = "Mozilla/5.0 (compatible; heistclips/0.1; +https://heistclips.com/about)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Twitch's anonymous GQL caps `streams(first:)` at 100 and refuses the next page ("failed
// integrity check", measured 2026-11-19), so 100 per game is as deep as the directory reads.
// At 40 the cut-off was ~5,600 viewers; at 100 it is ~1,900 (GTA VI, 2026-11-19 evening).
export async function liveGtaStreams(first = 100) {
  const out = [];
  for (const name of GTA_GAMES) {
    try {
      const d = await gql(`query{ game(name:"${name}"){ name viewersCount streams(first:${Math.min(100, first)}){ edges{ node{ viewersCount title language
        broadcaster{ login displayName profileImageURL(width:70) } } } } } }`);
      const g = d.game;
      if (!g) continue;
      for (const e of g.streams.edges) {
        const n = e.node;
        if (!n.broadcaster) continue;
        out.push({ login: n.broadcaster.login, name: n.broadcaster.displayName, avatar: n.broadcaster.profileImageURL, viewers: n.viewersCount, title: n.title, language: n.language, game: g.name });
      }
    } catch (e) { /* a missing game (GTA VI before launch) is not an error */ }
  }
  return out;
}

// Kick's directory pages: 32 streams a page whatever `limit` asks for, and it pages on (8 pages
// of GTA VI on 2026-11-19, page 4 ending ~1,300 viewers, page 8 ~490). Four pages of GTA VI and
// two of GTA V is about Twitch's depth, six requests a refresh, well inside Kick's throttle.
export const KICK_PAGES = { "grand-theft-auto-vi": 4, "grand-theft-auto-v": 2 };
let kickNext = 0;
async function kickGet(path) {
  const wait = kickNext - Date.now();
  if (wait > 0) await sleep(wait);
  kickNext = Date.now() + 700; // Kick refuses >~5 req/s and 429s a sustained 1.6/s after ~250
  const r = await fetch((path.startsWith("http") ? "" : KICK_API) + path, { headers: { "user-agent": UA, accept: "application/json" } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("kick " + r.status);
  return r.json();
}

export async function liveKick(pages = KICK_PAGES) {
  const out = [];
  const seen = new Set();
  for (const [sub, n] of Object.entries(pages)) {
    for (let page = 1; page <= n; page++) {
      let d;
      try { d = await kickGet(`https://kick.com/stream/livestreams/en?page=${page}&limit=32&subcategory=${sub}&sort=desc`); } catch (e) { break; }
      const rows = ((d && d.data) || []).filter((s) => (s.categories || []).some((c) => c.slug === sub));
      for (const s of rows) {
        if (!s.channel || seen.has(s.channel.slug)) continue;
        seen.add(s.channel.slug);
        out.push({ platform: "kick", login: s.channel.slug, name: (s.channel.user && s.channel.user.username) || s.channel.slug, avatar: s.channel.user && s.channel.user.profilepic,
          viewers: s.viewer_count, title: s.session_title, language: s.language, game: sub === "grand-theft-auto-vi" ? "Grand Theft Auto VI" : "Grand Theft Auto V" });
      }
      if (rows.length < 32 || !(d && d.next_page_url)) break;
    }
  }
  return out;
}

export function handlesFromCampaigns(campaigns) {
  const map = new Map();
  for (const c of campaigns) {
    const text = c.description || "";
    for (const m of text.matchAll(/twitch\.tv\/([A-Za-z0-9_]{3,25})/g)) {
      const login = m[1].toLowerCase();
      if (["videos", "directory", "settings", "p"].includes(login)) continue;
      if (!map.has(login)) map.set(login, { login, platform: "twitch", campaign_ids: [] });
      map.get(login).campaign_ids.push(c.id);
    }
    for (const m of text.matchAll(/kick\.com\/([A-Za-z0-9_-]{3,25})/g)) {
      const login = m[1].toLowerCase();
      const key = "kick:" + login;
      if (!map.has(key)) map.set(key, { login, platform: "kick", campaign_ids: [] });
      map.get(key).campaign_ids.push(c.id);
    }
  }
  return [...map.values()];
}

// ---- the streamer a GTA campaign names only in its title ---------------------------------------
// 2026-11-19: 13 of ~800 campaigns link a channel. "KreekCraft GTA 6 Clipping" ($6.8K left),
// "BenDaDonnn x Puffco GTA 6" ($10K), "GATTOUZ × GTA VI × 1WIN" ($10K) name theirs only in the
// title, so their streamers had no page and the ranker could not point to them. The title gives
// candidate names; Twitch and Kick say which is a real channel; a channel is joined only when it
// exists, has real followers, and streamed GTA in the last 30 days (or the brief names the
// platform). Lookups are cached in Blob so a refresh re-asks a name once a day.

export const NAMES_PATH = "streamers/names.json";
export const MIN_FOLLOWERS = 1000;
export const GTA_DAYS = 30;
const TTL_MS = 24 * 3600 * 1000;

// Hand-checked 2026-11-19. A list = the channels this name means (looked up for name and avatar,
// never second-guessed). [] = named, but not a Twitch or Kick channel: not looked up.
export const NAME_OVERRIDES = {
  kreekcraft: [{ platform: "twitch", login: "kreekcraft" }], // 589K, GTA VI today; kick.com/kreekcraft is a 503-follower namesake
  bendadonnn: [{ platform: "twitch", login: "bendadonnn" }, { platform: "kick", login: "bendadonnn" }], // streams both, GTA VI on each
  brettliftsxp: [{ platform: "twitch", login: "brettliftsxp" }], // kick.com/brettliftsxp has 9 followers
  dasgasd3m: [{ platform: "kick", login: "dasgasd3m" }], // Kick only ("Dom" in the brief), 62K
  gattouz: [{ platform: "kick", login: "gattouz0" }], // slug differs from the name; brief: "live on Kick"; owner gattouz0-clipping
  parkerryt: [{ platform: "twitch", login: "realparkerr" }], // RealParkerr's Twitch links x.com/YtParkerr and instagram parkerr_yt
  lysium: [{ platform: "twitch", login: "lysium" }, { platform: "kick", login: "lysium" }], // brief: "Lysium as Benji Ramos in NoPixel"
  benjiramos: [], // Lysium's GTA RP character, not a channel
  dylanpage: [], // the marathon is on YouTube ("live on YouTube"); twitch.tv/dylanpage has 1 follower
  tomo: [], // YouTube @Tomovids
  boeshi: [], // the campaign links twitch.tv/darealboeshi, which already joins it
  tokyogirl: [], // a song ("Tokyo Girl by Passive")
};

// Words in a campaign title that are never the streamer's name.
const NOISE = new Set(["gta", "gta5", "gta6", "gtav", "gtavi", "vi", "v", "grand", "theft", "auto", "clipping", "clip", "clips", "clipper", "clippers",
  "campaign", "campaigns", "pool", "marathon", "official", "dedicated", "stream", "streams", "streamer", "streaming", "livestream", "live", "cpm", "rpm",
  "day", "days", "week", "weekly", "month", "promo", "artist", "music", "sound", "audio", "song", "new", "team", "community", "viral", "logo", "ugc",
  "gaming", "game", "games", "storytelling", "content", "highlights", "highlight", "moments", "funny", "best", "edit", "edits", "shorts", "short",
  "tiktok", "youtube", "reels", "twitch", "kick", "playthrough", "series", "episode", "ep", "part", "and", "the", "with", "for", "of", "in", "on", "x",
  "vs", "only", "channel", "creator", "creators", "program", "contest", "challenge", "rewards", "reward", "event", "launch", "release", "first", "full",
  "budget", "per", "views", "view", "k", "paid", "pays", "get", "plays", "play", "playing", "presents"]);

export const nameKey = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "");

// The names a campaign title gives, best first: the words around "GTA", either side of an
// "x"/"×", after a "$N,NNN". "Dasgasd3m x RUCKUS | GTA 6" -> ["Dasgasd3m", "RUCKUS"]; brands
// survive this step and fail the channel check. Music and sound campaigns name songs, not people.
export function titleNames(c) {
  const title = String((c && c.title) || "");
  if (/music|sound|audio/i.test(((c && c.categories) || []).join(" ")) || /\b(sound|audio)\s+(campaign|only)\b/i.test(title)) return [];
  const out = [];
  const add = (run) => {
    if (run.length < 1 || run.length > 3) return; // four words is a phrase ("Things I Could've Said"), not a name
    const name = run.join(" ");
    if (nameKey(name).length >= 3 && !out.some((x) => nameKey(x) === nameKey(name))) out.push(name);
  };
  for (const seg of title.split(/\s+[x×]\s+|[|/:()[\],•×–—]|\s-\s?|-\s/i)) {
    let run = [];
    for (const tok of seg.trim().split(/\s+/)) {
      const w = tok.replace(/^[^\p{L}\p{N}_]+|[^\p{L}\p{N}_]+$/gu, "").replace(/['’]s$/i, "");
      if (!w || tok.startsWith("$") || /^[\d.,]+[km]?$/i.test(w) || NOISE.has(w.toLowerCase())) { add(run); run = []; continue; }
      run.push(w);
    }
    add(run);
  }
  return out;
}

// Which GTA campaigns need their streamer found by name: paying, not a general "any GTA clip"
// campaign, and not already linking a channel (handlesFromCampaigns joins those).
export const needsName = (c) => !!c.is_gta && c.budget_left > 0 && !/(twitch\.tv|kick\.com)\//i.test(c.description || "") && !isGeneralGta(c);

// Exact handles to try for a name: run together, and with the space as _ (Twitch) or - (Kick).
export function handleGuesses(name) {
  const w = String(name).toLowerCase().normalize("NFKD").replace(/[^a-z0-9_ ]+/g, "").trim().split(/\s+/).filter(Boolean);
  const joined = w.join("");
  const twitch = new Set([joined]), kick = new Set([joined]);
  if (w.length > 1) { twitch.add(w.join("_")); kick.add(w.join("-")); kick.add(w.join("_")); }
  return { twitch: [...twitch].filter((x) => /^[a-z0-9_]{3,25}$/.test(x)), kick: [...kick].filter((x) => /^[a-z0-9_-]{3,25}$/.test(x)) };
}

// A search result is the named streamer only if its login is the name with a common wrapper:
// "gattouz" -> gattouz0, "PARKERRYT" -> realparkerr. "kreekcraftclips" or "gatto" are not.
export function fuzzyLogin(name, login) {
  const n = nameKey(name), l = nameKey(login);
  if (!n || !l) return false;
  for (const base of new Set([n, n.replace(/(yt|tv|ttv|live)$/, "")])) {
    if (base.length < 4) continue;
    const m = l.match(new RegExp(`^(real|its|the|iam|im)?${base}(\\d{1,3}|tv|ttv|yt|live|official)?$`));
    if (m && l !== n) return true;
  }
  return false;
}

const isGta = (game) => /grand theft auto|^gta|grand-theft-auto/i.test(String(game || ""));
export function gtaRecent(acct, now = Date.now()) {
  if (acct.gta_live) return true;
  if (acct.gta_at && now - Date.parse(acct.gta_at) < GTA_DAYS * 86400000) return true;
  return !!acct.gta_cat && !acct.vods; // Kick lists GTA among recent categories but keeps no VODs to date it
}
const mentionsPlatform = (c, platform) => new RegExp(`\\b${platform}\\b`, "i").test(String(c.description || ""));

// Pure: which of the looked-up accounts this campaign pays for. -> { hits, why }
export function acceptAccounts(name, accounts, campaign, now = Date.now()) {
  const key = nameKey(name);
  const accts = accounts || [];
  if (Object.prototype.hasOwnProperty.call(NAME_OVERRIDES, key)) {
    const o = NAME_OVERRIDES[key];
    if (!o.length) return { hits: [], why: "named, but not a Twitch or Kick channel (hand-checked)" };
    return { hits: o.map((x) => ({ ...(accts.find((a) => a.platform === x.platform && a.login === x.login) || {}), ...x, via: "override" })), why: "hand-checked" };
  }
  const ok = (a) => (a.followers || 0) >= MIN_FOLLOWERS && (gtaRecent(a, now) || mentionsPlatform(campaign, a.platform));
  const pick = (list) => {
    const out = [];
    for (const platform of ["twitch", "kick"]) {
      const logins = [...new Set(list.filter((a) => a.platform === platform).map((a) => a.login))];
      if (logins.length === 1) out.push(list.find((a) => a.platform === platform));
    }
    return out;
  };
  const exact = accts.filter((a) => a.via === "exact" && ok(a));
  if (exact.length) return { hits: pick(exact), why: "exact name" + (pick(exact).length < new Set(exact.map((a) => a.platform)).size ? " (an ambiguous platform was left out)" : "") };
  const fuzzy = accts.filter((a) => a.via === "search" && fuzzyLogin(name, a.login) && ok(a));
  const logins = [...new Set(fuzzy.map((a) => a.platform + ":" + a.login))];
  if (logins.length === 1) return { hits: fuzzy.slice(0, 1), why: "search" };
  if (logins.length > 1) return { hits: [], why: "ambiguous: " + logins.join(", ") };
  if (!accts.length) return { hits: [], why: "no Twitch or Kick channel by that name" };
  const best = accts.slice().sort((a, b) => (b.followers || 0) - (a.followers || 0))[0];
  return { hits: [], why: (best.followers || 0) < MIN_FOLLOWERS ? `only small namesakes (${best.platform}:${best.login}, ${best.followers || 0} followers)` : `${best.platform}:${best.login} has not streamed GTA in ${GTA_DAYS} days` };
}

// ---- lookups (I/O) ---
const TW_FIELDS = `login displayName profileImageURL(width:70) followers{ totalCount } stream{ game{ name } }
  lastBroadcast{ startedAt game{ name } } videos(first:10, sort:TIME){ edges{ node{ createdAt game{ name } } } }`;
async function twitchUsers(logins, via) {
  const ls = [...new Set(logins)].filter((l) => /^[a-z0-9_]{3,25}$/.test(l)).slice(0, 10);
  if (!ls.length) return [];
  const d = await gql(`query{ ${ls.map((l, i) => `u${i}:user(login:"${l}"){ ${TW_FIELDS} }`).join(" ")} }`);
  const out = [];
  for (let i = 0; i < ls.length; i++) {
    const u = d[`u${i}`];
    if (!u) continue;
    const dates = [];
    if (u.lastBroadcast && isGta(u.lastBroadcast.game && u.lastBroadcast.game.name)) dates.push(u.lastBroadcast.startedAt);
    for (const e of (u.videos && u.videos.edges) || []) if (isGta(e.node.game && e.node.game.name)) dates.push(e.node.createdAt);
    out.push({ platform: "twitch", login: u.login, name: u.displayName, avatar: u.profileImageURL, followers: (u.followers && u.followers.totalCount) || 0,
      gta_live: !!(u.stream && isGta(u.stream.game && u.stream.game.name)), gta_at: dates.filter(Boolean).sort().pop() || null, via });
  }
  return out;
}
async function twitchSearch(name) {
  const d = await gql(`query{ searchFor(userQuery:${JSON.stringify(String(name).slice(0, 60))}, platform:"web", target:{index:CHANNEL}){ channels{ edges{ item{ ... on User { login followers{ totalCount } } } } } } }`);
  return ((d.searchFor && d.searchFor.channels && d.searchFor.channels.edges) || []).map((e) => e.item).filter((u) => u && u.login)
    .map((u) => ({ login: u.login, followers: (u.followers && u.followers.totalCount) || 0 }));
}
async function kickChannel(slug, via) {
  if (!/^[a-z0-9_-]{3,25}$/.test(slug)) return null;
  const c = await kickGet(`/v2/channels/${slug}`);
  if (!c || !c.slug) return null;
  const ls = c.livestream;
  const cats = (c.recent_categories || []).map((x) => x.slug);
  const a = { platform: "kick", login: c.slug, name: (c.user && c.user.username) || c.slug, avatar: (c.user && c.user.profile_pic) || null, followers: Number(c.followers_count) || 0,
    gta_live: !!(ls && ls.is_live && (ls.categories || []).some((x) => isGta(x.slug))), gta_cat: cats.some(isGta), gta_at: null, vods: 0, via };
  if (a.followers >= MIN_FOLLOWERS && (a.gta_cat || a.gta_live)) {
    const vids = (await kickGet(`/v2/channels/${slug}/videos`).catch(() => [])) || [];
    a.vods = Array.isArray(vids) ? vids.length : 0;
    const when = (s) => Date.parse(String(s).includes("T") ? s : String(s).replace(" ", "T") + "Z"); // Kick: "2026-11-19 03:12:00", UTC
    a.gta_at = (Array.isArray(vids) ? vids : []).filter((v) => (v.categories || []).some((x) => isGta(x.slug))).map((v) => when(v.start_time))
      .filter((t) => Number.isFinite(t)).sort((x, y) => x - y).map((t) => new Date(t).toISOString()).pop() || null;
  }
  return a;
}
async function kickSearch(name) {
  const d = await kickGet(`/search?searched_word=${encodeURIComponent(String(name).slice(0, 40))}`);
  return ((d && d.channels) || []).map((c) => ({ login: c.slug, followers: Number(c.followers_count || c.followersCount) || 0 })).filter((c) => c.login);
}

// Every Twitch/Kick account a name could mean, with the facts acceptAccounts needs.
export async function lookupName(name) {
  const key = nameKey(name);
  if (Object.prototype.hasOwnProperty.call(NAME_OVERRIDES, key)) {
    const o = NAME_OVERRIDES[key];
    const out = await twitchUsers(o.filter((x) => x.platform === "twitch").map((x) => x.login), "override");
    for (const x of o.filter((y) => y.platform === "kick")) { const a = await kickChannel(x.login, "override"); if (a) out.push(a); }
    return out;
  }
  const g = handleGuesses(name);
  const out = await twitchUsers(g.twitch, "exact");
  for (const slug of g.kick) { const a = await kickChannel(slug, "exact"); if (a && !out.some((b) => b.platform === "kick" && b.login === a.login)) out.push(a); }
  const strong = (a) => a.followers >= MIN_FOLLOWERS && gtaRecent(a);
  if (!out.some(strong)) { // the slug may differ from the name (GATTOUZ is kick.com/gattouz0)
    const tw = (await twitchSearch(name).catch(() => [])).filter((u) => fuzzyLogin(name, u.login) && u.followers >= MIN_FOLLOWERS);
    out.push(...(await twitchUsers(tw.map((u) => u.login), "search")));
    const ks = (await kickSearch(name).catch(() => [])).filter((u) => fuzzyLogin(name, u.login) && u.followers >= MIN_FOLLOWERS).slice(0, 3);
    for (const u of ks) { const a = await kickChannel(u.login, "search"); if (a) out.push(a); }
  }
  return out;
}

// Resolve every GTA campaign's title names, at most `max` fresh lookups a run, cached in Blob.
// -> { streamers: [{platform, login, name, avatar, followers, via, campaign_ids}], report, looked }
export async function resolveCampaignNames(campaigns, { now = Date.now(), max = 10, load = () => getJSON(NAMES_PATH, { fresh: true }), save = (s) => putJSON(NAMES_PATH, s, { maxAge: 60 }), lookup = lookupName } = {}) {
  const store = (await load().catch(() => null)) || {};
  store.names = store.names || {};
  const wanted = new Map();
  for (const c of campaigns || []) {
    if (!needsName(c)) continue;
    for (const name of titleNames(c)) {
      const key = nameKey(name);
      if (!wanted.has(key)) wanted.set(key, { name, campaigns: [] });
      wanted.get(key).campaigns.push(c);
    }
  }
  let looked = 0, failed = 0;
  for (const [key, w] of wanted) {
    const e = store.names[key];
    if (e && now - Date.parse(e.at) < TTL_MS) continue;
    if (looked >= max) continue;
    looked++;
    try { store.names[key] = { at: new Date(now).toISOString(), name: w.name, accounts: await lookup(w.name) }; }
    catch (err) { failed++; } // a failed lookup (a Kick 429) is retried next run, never cached as "no channel"
  }
  for (const key of Object.keys(store.names)) if (!wanted.has(key)) delete store.names[key];
  const joined = new Map();
  const report = [];
  for (const [key, w] of wanted) {
    for (const c of w.campaigns) {
      const e = store.names[key];
      if (!e) { report.push({ campaign: c.title, name: w.name, joined: [], why: "not looked up yet" }); continue; }
      const { hits, why } = acceptAccounts(w.name, e.accounts, c, now);
      report.push({ campaign: c.title, name: w.name, joined: hits.map((h) => chanKey(h.platform, h.login)), why });
      for (const h of hits) {
        const k = chanKey(h.platform, h.login);
        if (!joined.has(k)) joined.set(k, { platform: h.platform, login: h.login, name: h.name || null, avatar: h.avatar || null, followers: h.followers || null, via: h.via, campaign_ids: [] });
        if (!joined.get(k).campaign_ids.includes(c.id)) joined.get(k).campaign_ids.push(c.id);
      }
    }
  }
  store.at = new Date(now).toISOString();
  store.report = report;
  try { await save(store); } catch (e) { /* the joins still apply this run */ }
  return { streamers: [...joined.values()], report, looked, failed };
}

// What refresh joins to the live list: channels a brief links, plus channels a title names.
export async function linkedStreamers(campaigns, opts = {}) {
  const out = new Map(handlesFromCampaigns(campaigns).map((h) => [chanKey(h.platform, h.login), h]));
  let named = [];
  try { named = (await resolveCampaignNames(campaigns, opts)).streamers; } catch (e) { /* links alone still join */ }
  for (const n of named) {
    const k = chanKey(n.platform, n.login);
    const cur = out.get(k);
    if (!cur) { out.set(k, n); continue; }
    out.set(k, { ...n, ...cur, campaign_ids: [...new Set([...(cur.campaign_ids || []), ...n.campaign_ids])] });
  }
  return [...out.values()];
}

// The snapshot's streamer list. Order decides what the cap keeps: channels a campaign pays for
// first (never evicted), then everyone live this refresh (a 30-viewer stream at rank 100 must
// not be cut the same run it is read), then the biggest peaks seen.
export const MAX_STREAMERS = 800;
export function mergeStreamers(prev, live, linked, now = new Date().toISOString()) {
  prev = prev || []; live = live || []; linked = linked || [];
  const by = new Map(prev.map((s) => [s.platform === "kick" ? "kick:" + s.login : s.login, { ...s, live_now: false, viewers_now: 0 }]));
  for (const s of live) {
    const key = s.platform === "kick" ? "kick:" + s.login : s.login;
    const cur = by.get(key) || { login: s.login, platform: s.platform || "twitch", first_seen: now, peak_viewers: 0, campaign_ids: [] };
    by.set(key, { ...cur, name: s.name, avatar: s.avatar, language: s.language, game: s.game, last_title: s.title, last_seen: now,
      live_now: true, viewers_now: s.viewers, peak_viewers: Math.max(cur.peak_viewers || 0, s.viewers) });
  }
  for (const l of linked) {
    const key = l.platform === "kick" ? "kick:" + l.login : l.login;
    const cur = by.get(key) || { login: l.login, platform: l.platform, first_seen: now, peak_viewers: 0 };
    const row = { ...cur, campaign_ids: l.campaign_ids };
    if (l.name && !cur.name) row.name = l.name;
    if (l.avatar && !cur.avatar) row.avatar = l.avatar;
    if (l.followers) row.followers = l.followers;
    if (l.via) row.joined_by = l.via; else delete row.joined_by;
    by.set(key, row);
  }
  const paid = (s) => ((s.campaign_ids || []).length ? 1 : 0);
  return [...by.values()]
    .sort((a, b) => paid(b) - paid(a) || (b.live_now ? 1 : 0) - (a.live_now ? 1 : 0) || (b.campaign_ids || []).length - (a.campaign_ids || []).length || (b.peak_viewers || 0) - (a.peak_viewers || 0))
    .slice(0, MAX_STREAMERS);
}
