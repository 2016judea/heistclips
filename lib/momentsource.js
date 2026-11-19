// What stream did they mean? The same forgiving lookup the /clip page does (public/js/app.js
// start()), for the connector: a name typed with spaces or a typo goes through Twitch's own
// channel search, a Twitch clip link opens the stream it was cut from, and anything that cannot
// be read comes back as a plain reason with a short code instead of an exception.
//
// Measured 2026-11-19: 10 of 154 find_clip_moments calls failed in ~50 ms because every input
// that was not exactly a channel or VOD ("kai cenat", a clip link, a YouTube link, "gta 6")
// fell through to one error line.
import { getChannel, getVod, parseInput, searchChannels, getClip } from "../public/js/twitch.js";
import { getKickChannel, getKickVod } from "../public/js/kick.js";

const dead = (err, message, extra = {}) => ({ ok: false, err, message, ...extra });
const empty = (c) => !c || (!c.live_vod && !c.vods.length);

// -> { ok: true, vod, chan, note, focus_t } or { ok: false, err, message, suggest_live }
export async function resolveSource(raw, deps = {}) {
  const tw = { getChannel, getVod, searchChannels, getClip, ...deps };
  const kk = { getKickChannel, getKickVod, ...deps };
  let inp = parseInput(raw);
  if (inp.kind === "gta") return dead("no_name", "That names a game, not a stream. Ask whose stream they want, or offer one of the channels live right now.", { suggest_live: true });
  if (inp.kind === "unknown") {
    if (inp.site === "youtube") return dead("youtube", "YouTube streams cannot be read yet: heistclips reads Twitch and Kick. If the streamer also streams on Twitch or Kick, pass that channel. The user can vote for YouTube Live at https://heistclips.com/requests.", { suggest_live: true });
    return dead("bad_input", "That is not a Twitch or Kick channel or video. Pass a streamer's name, twitch.tv/<name>, kick.com/<name>, a twitch.tv/videos/… link or a Twitch clip link.", { suggest_live: !String(raw || "").trim() });
  }
  if (inp.kind === "kick") {
    const chan = await kk.getKickChannel(inp.login);
    if (!chan) return dead("kick_no_channel", `No Kick channel called ${inp.login}. If they stream on Twitch, pass the name without kick.com.`);
    const vod = chan.live_vod || chan.vods[0];
    if (!vod) return dead("kick_no_vod", `${chan.name} has no saved Kick streams to read${chan.is_live ? " (they are live, but Kick is not saving this stream)" : ""}.`, { suggest_live: true });
    return { ok: true, vod, chan, note: "" };
  }
  if (inp.kind === "kickvod") {
    const vod = await kk.getKickVod(inp.id);
    return vod ? { ok: true, vod, chan: null, note: "" } : dead("kickvod_missing", "That Kick video does not exist or is not public. Pass the channel (kick.com/<name>) to read its latest stream.");
  }
  let note = "", focus_t;
  if (inp.kind === "clip") {
    const c = await tw.getClip(inp.slug);
    if (!c) return dead("clip_missing", "That Twitch clip does not exist any more. Pass the streamer's channel to read their latest stream.");
    const vod = c.vod_id ? await tw.getVod(c.vod_id) : null;
    if (vod) return { ok: true, vod, chan: null, note: "This is the stream that clip was cut from; the clip starts at clip_at.", focus_t: c.t || 0 };
    if (!c.login) return dead("clip_no_vod", "The stream that clip came from has been deleted, so there is nothing to read.");
    note = `The stream that clip came from has been deleted, so this is ${c.login}'s latest stream. `;
    inp = { kind: "channel", login: c.login };
  }
  if (inp.kind === "channel" || inp.kind === "search") {
    let chan = inp.login ? await tw.getChannel(inp.login) : null;
    // Typed with spaces, extra words or a typo: ask Twitch's own search who they meant.
    if (!chan || (inp.kind === "search" && empty(chan))) {
      const hits = await tw.searchChannels(inp.text || inp.login);
      const hit = hits.find((x) => x.followers >= 10000 || x.live);
      const found = hit ? await tw.getChannel(hit.login) : null;
      if (found && (!empty(found) || found.is_live)) { note += `Read "${String(raw).trim().slice(0, 60)}" as the Twitch channel ${found.name}. `; chan = found; }
    }
    if (!chan) return dead("no_channel", `No Twitch channel called ${inp.text || inp.login}. If they stream on Kick, pass kick.com/<name>.`, { suggest_live: true });
    const vod = chan.live_vod || chan.vods[0];
    if (!vod) {
      // A dead account with a famous near-namesake is usually a typo ("ischowspeed").
      let meant = [];
      if (!chan.is_live) meant = (await tw.searchChannels(inp.text || inp.login)).filter((x) => x.login !== chan.login && x.followers >= 50000).slice(0, 3).map((x) => x.login);
      if (meant.length) return dead("no_vods", `${chan.name} has no saved streams on Twitch. Channels with a similar name: ${meant.join(", ")}. Ask the user which one they meant.`, { did_you_mean: meant });
      return dead(chan.is_live ? "live_no_vod" : "no_vods", chan.is_live
        ? `${chan.name} is live, but Twitch is not saving this stream, so there is no chat replay or video to read.`
        : `${chan.name} has no saved streams on Twitch.`, { suggest_live: true, exclude: chan.login });
    }
    if (chan.is_live && !chan.live_vod) note += `${chan.name} is live right now but Twitch is not saving this stream; these moments are from the last saved stream. `;
    return { ok: true, vod, chan, note: note.trim(), focus_t };
  }
  const vod = await tw.getVod(inp.id);
  return vod ? { ok: true, vod, chan: null, note: "" } : dead("vod_missing", "That VOD does not exist or is not public (deleted, or subscriber-only). Pass the channel name to read its latest saved stream.");
}
