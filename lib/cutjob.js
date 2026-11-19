// One server-side cut, start to finish: account -> credit check -> ffmpeg -> Blob -> charge.
// A clip is charged exactly like a browser render: "start" asks api/credits.js for a ticket
// (charging nothing), "commit" spends it only after a file with frames in it is stored.
import fs from "node:fs";
import { getChannel, getVod, parseInput, clock } from "../public/js/twitch.js";
import { getKickChannel, getKickVod } from "../public/js/kick.js";
import { cutClip, MAX_CLIP_S, MIN_CLIP_S, LAYOUTS } from "./cut.js";
import { putFile, randomName, clipPath, clipUrl, KEEP_HOURS } from "./blobfiles.js";
import { getAccount, createAccount, keep, creditCall, newAccountsToday, NEW_ACCOUNTS_PER_DAY } from "./accounts.js";
import { putJSON, getJSON } from "./store.js";

const SITE = "https://heistclips.com";
export const fail = (error, extra = {}) => ({ ok: false, error, ...extra });

export async function resolveVod(source) {
  const inp = parseInput(source);
  if (inp.kind === "vod") return (await getVod(inp.id)) || fail("That VOD does not exist or is not public.");
  if (inp.kind === "kickvod") return (await getKickVod(inp.id)) || fail("That Kick video does not exist or is not public.");
  if (inp.kind === "channel" || inp.kind === "kick") {
    const chan = inp.kind === "kick" ? await getKickChannel(inp.login) : await getChannel(inp.login);
    if (!chan) return fail(`No ${inp.kind === "kick" ? "Kick" : "Twitch"} channel called ${inp.login}.`);
    return chan.live_vod || chan.vods[0] || fail(`${chan.name} has no saved streams to cut from.`);
  }
  return fail("Pass a Twitch or Kick VOD link or id, or a channel (kick.com/<name> for Kick).");
}

// seconds, or "1:02:03" / "62:03" / "1h2m3s"
export function seconds(v) {
  if (typeof v === "number") return v;
  const s = String(v == null ? "" : v).trim();
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
  let m = s.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
  if (m) return (Number(m[1] || 0) * 3600) + Number(m[2]) * 60 + Number(m[3]);
  m = s.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
  if (m && (m[1] || m[2] || m[3])) return Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
  return NaN;
}

const clipMetaPath = (id) => `clips/${id}.json`;
export const clipMeta = (id) => getJSON(clipMetaPath(id), { fresh: true }).catch(() => null);

export async function cutJob(args = {}) {
  const start = seconds(args.start), end = seconds(args.end);
  if (!isFinite(start) || !isFinite(end)) return fail("Give start and end as seconds into the stream (t_start_s and t_end_s from find_clip_moments), or as h:mm:ss.");
  if (end - start < MIN_CLIP_S) return fail(`A clip needs at least ${MIN_CLIP_S} seconds.`);
  if (end - start > MAX_CLIP_S) return fail(`A clip can be at most ${MAX_CLIP_S} seconds; this window is ${Math.round(end - start)}.`);
  const vod = await resolveVod(args.source);
  if (vod.ok === false) return vod;
  if (vod.length && start >= vod.length) return fail(`The stream is only ${clock(vod.length)} long so far.`);

  let rec = args.account ? await getAccount(args.account) : null;
  if (args.account && !rec) return fail("That account code is not known. Leave it out to start a new one, or use the code from an earlier cut_clip.");
  let fresh = false;
  if (!rec) {
    if ((await newAccountsToday()) >= NEW_ACCOUNTS_PER_DAY) return fail("Too many new connector accounts today. Open the link once in a browser and pass its account code.", { open: `${SITE}/post?src=mcp` });
    rec = await createAccount(args.via || "mcp"); fresh = true;
  }
  const account = { account: rec.code, manage: `${SITE}/post?acct=${rec.code}&src=mcp` };

  const t = await creditCall("start", rec);
  if (!t.ok) return fail("No clips left on this account. Buy a pack, then open the manage link once in the same browser so the connector can use it.", { need: "buy", buy: `${SITE}/pricing?src=mcp`, ...account, free_left: t.free_left, paid_left: t.paid_left });

  const layout = LAYOUTS.includes(args.layout) ? args.layout : "fit";
  let cut;
  try { cut = await cutClip(vod, { start, end, layout, cam: /^[tb][lr]$/.test(args.facecam || "") ? args.facecam : "tr", hook: args.hook || "" }); }
  catch (e) { return fail(e.message + (/charged/.test(e.message) ? "" : " Nothing was charged."), account); }
  const id = randomName();
  try {
    await putFile(clipPath(id), fs.readFileSync(cut.file), "video/mp4");
  } catch (e) { return fail("The clip was cut but could not be stored (" + e.message + "). Nothing was charged.", account); }
  finally { fs.rmSync(cut.dir, { recursive: true, force: true }); }
  const meta = { id, at: new Date().toISOString(), account_hash: null, vod: vod.id, platform: vod.platform || "twitch", channel: vod.channel_name, title: vod.title, game: vod.game, start, end, layout, hook: args.hook || "", bytes: cut.bytes, seconds: cut.seconds };
  await putJSON(clipMetaPath(id), meta, { maxAge: 60 }).catch(() => null);
  const c = await creditCall("commit", rec, { ticket: t.ticket, bytes: cut.bytes, meta: { vod: vod.id, t: Math.round(start), layout: "server-" + layout } });
  return {
    ok: true, clip_id: id, download: clipUrl(id), format: "MP4, H.264 + AAC, 1080x1920 (9:16), 30 fps", seconds: cut.seconds, megabytes: Math.round(cut.bytes / 1e5) / 10,
    layout, hook_burned_in: !!(args.hook || "").trim(), cut_in_ms: cut.ms, source_quality: cut.source_quality,
    stream: { platform: vod.platform || "twitch", channel: vod.channel_name, title: vod.title, window: `${clock(start)} – ${clock(end)}` },
    charged: !!c.ok, clips_left: c.ok ? { free: c.free_left, paid: c.paid_left } : undefined,
    ...account, new_account: fresh,
    kept_for: `${KEEP_HOURS} hours`,
  };
}
