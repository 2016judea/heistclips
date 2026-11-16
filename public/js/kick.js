// Kick, read-only and anonymous. kick.com's robots.txt allows / (it blocks only AI-training
// crawlers), its channel/video/chat-history API answers heistclips.com's origin with CORS,
// and its VOD video (stream.kick.com) sends Access-Control-Allow-Origin: *, so the browser can
// read and cut Kick streams directly. Measured 2026-11-16.
//
// Chat: /api/v2/channels/<id>/messages?start_time=<ISO> returns up to 25 messages from that
// instant within ~5 s. Kick's live websocket is now behind an authenticated config endpoint
// (the old public Pusher key answers "not in this cluster"), so live mode polls this window.

const API = "https://kick.com/api";
const UA = "Mozilla/5.0 (compatible; heistclips/0.1; +https://heistclips.com/about)";
const isNode = typeof window === "undefined";

// Kick answers 429 above ~5 requests a second (measured 2026-11-16: 2 in flight = 60/60 OK,
// 6 in flight = 47/60 refused). Every call goes through one queue spaced 220 ms apart, and a
// 429 waits and retries.
let nextSlot = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function slot() {
  const now = Date.now();
  const at = Math.max(now, nextSlot);
  nextSlot = at + 220;
  if (at > now) await sleep(at - now);
}

async function kget(path) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await slot();
    const r = await fetch(API + path, { headers: isNode ? { "user-agent": UA, accept: "application/json" } : { accept: "application/json" } });
    if (r.status === 404) return null;
    if (r.status === 429) { nextSlot = Date.now() + 1500 * (attempt + 1); continue; }
    if (!r.ok) throw new Error("kick " + r.status);
    return r.json();
  }
  throw new Error("kick 429");
}

const ts = (s) => Date.parse(String(s).includes("T") ? s : String(s).replace(" ", "T") + "Z");

function shapeVod(v, chan) {
  const live = !!v.is_live;
  const start = ts(v.start_time);
  const uuid = (v.video && v.video.uuid) || v.uuid || String(v.id);
  return {
    platform: "kick", id: uuid, title: v.session_title || "", length: live ? Math.max(0, (Date.now() - start) / 1000) : Math.round((v.duration || 0) / 1000),
    status: live ? "RECORDING" : "RECORDED", created_at: new Date(start).toISOString(), start_ms: start,
    views: v.viewer_count, game: (v.categories && v.categories[0] && v.categories[0].name) || null,
    channel: chan.slug, channel_name: (chan.user && chan.user.username) || chan.slug, kick_channel_id: chan.id,
    avatar: chan.user && chan.user.profile_pic, thumb: v.thumbnail && (v.thumbnail.src || v.thumbnail.url),
    muted: [], source: v.source, url: `https://kick.com/${chan.slug}/videos/${uuid}`,
  };
}

export async function getKickChannel(slug) {
  const c = await kget(`/v2/channels/${encodeURIComponent(slug)}`);
  if (!c || !c.id) return null;
  let vids = [];
  try { vids = (await kget(`/v2/channels/${encodeURIComponent(slug)}/videos`)) || []; } catch (e) {}
  const vods = (Array.isArray(vids) ? vids : []).filter((v) => v.source).slice(0, 6).map((v) => shapeVod(v, c));
  const ls = c.livestream;
  return {
    platform: "kick", login: c.slug, name: (c.user && c.user.username) || c.slug, avatar: c.user && c.user.profile_pic,
    is_live: !!(ls && ls.is_live), stream: ls ? { started_at: ls.start_time, viewers: ls.viewer_count, title: ls.session_title, game: ls.categories && ls.categories[0] && ls.categories[0].name } : null,
    live_vod: vods.find((v) => v.status === "RECORDING") || null, vods,
  };
}

export async function getKickVod(uuid) {
  const v = await kget(`/v1/video/${encodeURIComponent(uuid)}`);
  if (!v || !v.livestream) return null;
  const ls = v.livestream, ch = ls.channel || {};
  const chan = { id: ch.id || ls.channel_id, slug: ch.slug, user: ch.user };
  return shapeVod({ ...ls, source: v.source || ls.source, video: { uuid: v.uuid } }, chan);
}

// Emotes arrive as "[emote:123:KEKW]"; chat reads them as the emote's name.
const clean = (s) => String(s || "").replace(/\[emote:\d+:([^\]]+)\]/g, "$1");

export async function kickCommentPage(vod, offset) {
  const at = new Date(vod.start_ms + Math.max(0, offset) * 1000).toISOString();
  const d = await kget(`/v2/channels/${vod.kick_channel_id}/messages?start_time=${encodeURIComponent(at)}`);
  const msgs = (d && d.data && d.data.messages) || [];
  return msgs.map((m) => ({ id: m.id, t: Math.round((ts(m.created_at) - vod.start_ms) / 1000), text: clean(m.content) }));
}

// A page holds at most 25 messages from `start_time`, inside ~5 s.
export function kickRate(page) {
  if (!page.length) return 0;
  if (page.length < 25) return page.length / 5;
  return (page.length - 1) / Math.max(1, page[page.length - 1].t - page[0].t);
}

// Live: poll the 5-second window that starts 10 s ago, every 2.5 s; hand each new message to `add`.
export function pollKickChat(vod, add, onStatus) {
  const seen = new Set();
  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    try {
      const at = new Date(Date.now() - 10000).toISOString();
      const d = await kget(`/v2/channels/${vod.kick_channel_id}/messages?start_time=${encodeURIComponent(at)}`);
      for (const m of (d && d.data && d.data.messages) || []) {
        if (seen.has(m.id)) continue;
        seen.add(m.id);
        add({ id: m.id, ts: ts(m.created_at), text: clean(m.content) });
      }
      if (seen.size > 50000) seen.clear();
      onStatus && onStatus("watching chat");
    } catch (e) { onStatus && onStatus("Kick chat paused (" + e.message + "), retrying…"); }
    setTimeout(tick, 2500);
  };
  tick();
  return () => { stopped = true; };
}

export async function liveKickGta(limit = 20) {
  const out = [];
  for (const sub of ["grand-theft-auto-vi", "grand-theft-auto-v"]) {
    try {
      const r = await fetch(`https://kick.com/stream/livestreams/en?page=1&limit=${limit}&subcategory=${sub}&sort=desc`, { headers: isNode ? { "user-agent": UA, accept: "application/json" } : {} });
      if (!r.ok) continue;
      const d = await r.json();
      for (const s of d.data || []) {
        const cats = (s.categories || []).map((c) => c.slug);
        if (!cats.includes(sub)) continue;
        out.push({ platform: "kick", login: s.channel.slug, name: (s.channel.user && s.channel.user.username) || s.channel.slug, avatar: s.channel.user && s.channel.user.profilepic,
          viewers: s.viewer_count, title: s.session_title, language: s.language, game: sub === "grand-theft-auto-vi" ? "Grand Theft Auto VI" : "Grand Theft Auto V" });
      }
    } catch (e) {}
  }
  return out;
}
