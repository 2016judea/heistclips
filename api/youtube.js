// YouTube for the /clip page (and the cron that keeps live chat read). Official routes only:
// lib/youtube.js says which, and why.
//
//   GET /api/youtube?q=<link or @handle>   -> { ok, vod, chan, note } | { ok: false, err, message }
//   GET /api/youtube?op=moments&id=<video> -> { ok, vod, status, signal, moments, curve, note, quota? }
//   GET /api/youtube?op=tick  (cron, Bearer CRON_SECRET, every minute) -> poll every watched live stream
import { parseInput } from "../public/js/twitch.js";
import { resolveYouTube, ytVideo, ytMoments, tick, quotaState, quotaMessage, latestState, DAILY, LIVE_UNITS } from "../lib/youtube.js";
import { ytWatch } from "../public/js/youtube.js";
import { serverEvent } from "../lib/track.js";
import { isTest } from "../lib/marks.js";

const ID = /^[A-Za-z0-9_-]{11}$/;
const send = (res, code, obj, maxAge = 0) => {
  res.statusCode = code;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", maxAge ? `public, max-age=0, s-maxage=${maxAge}` : "no-store");
  res.end(JSON.stringify(obj));
};

export default async function handler(req, res) {
  const u = new URL(req.url, "https://heistclips.com");
  const op = u.searchParams.get("op") || "resolve";
  try {
    if (op === "tick") {
      const secret = process.env.CRON_SECRET;
      if (secret && (req.headers.authorization || "") !== `Bearer ${secret}`) return send(res, 401, { ok: false });
      const r = await tick();
      if (r.polled.length || r.err) console.log("yt tick", JSON.stringify(r));
      return send(res, 200, { ok: true, ...r });
    }
    if (op === "quota") {
      const q = await quotaState(Date.now(), { fresh: true });
      return send(res, 200, { ok: true, day: q.day, units: q.units, daily: DAILY, live_units_per_poll: LIVE_UNITS, out: q.out || q.units >= DAILY, message: q.out || q.units >= DAILY ? quotaMessage() : "" });
    }
    if (op === "moments") {
      const id = u.searchParams.get("id") || "";
      if (!ID.test(id)) return send(res, 400, { ok: false, err: "bad_id", message: "That is not a YouTube video id." });
      // A live stream the poller read in the last 3 minutes needs no lookup (no quota).
      const s = await latestState(id).catch(() => null);
      const now = Date.now();
      const vod = s && !s.ended && s.polled_at && now - s.polled_at < 180000 && s.start_ms
        ? { platform: "youtube", id, title: s.title, channel: s.channel_id || "", channel_name: s.channel_name, length: Math.round((now - s.start_ms) / 1000), status: "RECORDING", live: true,
          start_ms: s.start_ms, chat_id: s.chat_id, created_at: new Date(s.start_ms).toISOString(), url: ytWatch(id), thumb: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`, muted: [], game: null }
        : await ytVideo(id).catch((e) => ({ err: e }));
      if (!vod || vod.err) {
        const quota = vod && vod.err && vod.err.code === "yt_quota";
        return send(res, quota ? 200 : 404, { ok: false, err: quota ? "yt_quota" : "yt_missing", message: quota ? quotaMessage() : "That YouTube video does not exist or is private.", quota: quota || undefined });
      }
      const k = Math.max(1, Math.min(15, Number(u.searchParams.get("k")) || 12));
      const r = await ytMoments(vod, { k });
      if (!isTest(req) && u.searchParams.get("first") === "1") serverEvent("yt_moments_server", { platform: "youtube", status: r.status, signal: r.signal, n: r.moments.length, quota: !!r.quota, comments_read: r.comments_read, msgs: r.msgs }).catch(() => {});
      return send(res, 200, { ok: true, vod, ...r });
    }
    // resolve
    const q = String(u.searchParams.get("q") || "").slice(0, 300);
    const inp = parseInput(q);
    if (inp.kind !== "youtube" && inp.kind !== "ythandle") return send(res, 400, { ok: false, err: inp.site === "youtube_short" ? "yt_short" : "not_youtube", message: inp.site === "youtube_short" ? "That is a YouTube Short, not a stream. Paste the stream's link (youtube.com/watch?v=… or youtube.com/@name)." : "That is not a YouTube link." });
    const r = await resolveYouTube(inp);
    return send(res, 200, { ...r, ...(inp.t != null ? { t: inp.t } : {}) });
  } catch (e) {
    console.error("youtube", op, e);
    return send(res, 500, { ok: false, err: "server", message: "Something went wrong reading YouTube: " + String(e.message || e).slice(0, 120) });
  }
}
