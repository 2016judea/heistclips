// One server-side cut, start to finish: account -> credit check -> ffmpeg -> Blob -> charge.
// A clip is charged exactly like a browser render: "start" asks api/credits.js for a ticket
// (charging nothing), "commit" spends it only after a file with frames in it is stored.
//
// A cut can carry a job id. Then its result (finished or failed) is also written once to
// cutjobs/<job>.json, so a caller that stopped waiting can ask for it later: the connector
// answers "still cutting" inside a safe time instead of hanging, and cut_clip {job} picks the
// file up. The job never runs twice and the ticket commits once, so a clip is charged once.
import fs from "node:fs";
import crypto from "node:crypto";
import { clock } from "../public/js/twitch.js";
import { resolveSource } from "./momentsource.js";
import { cutClip, MAX_CLIP_S, MIN_CLIP_S, LAYOUTS } from "./cut.js";
import { putFile, randomName, clipPath, clipUrl, KEEP_HOURS } from "./blobfiles.js";
import { getAccount, createAccount, creditCall, newAccountsToday, NEW_ACCOUNTS_PER_DAY, seal, unseal } from "./accounts.js";
import { putJSON, getJSON, listPaths } from "./store.js";
import { serverEvent } from "./track.js";

const SITE = "https://heistclips.com";
// Every failure has a short `err` code for analytics; the sentence in `error` is for the person.
export const fail = (error, extra = {}) => ({ ok: false, error, ...extra });

// The same forgiving lookup find_clip_moments uses (a name with spaces, a clip link), so a
// source that found moments can always be cut.
export async function resolveVod(source) {
  const r = await resolveSource(source);
  return r.ok ? r.vod : fail(r.message + " Use the stream url that find_clip_moments returned. Nothing was charged.", { err: r.err });
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

// ---- jobs ------------------------------------------------------------------------------------
// The id carries its own start time, so "how long has this been cutting" needs no second file.
export const JOB = /^cj[0-9a-z]{8,9}_[0-9a-f]{32}$/;
export const newJobId = () => "cj" + Date.now().toString(36) + "_" + crypto.randomBytes(16).toString("hex");
export const jobAgeMs = (id) => Date.now() - parseInt(String(id).slice(2).split("_")[0], 36);
// A cut is killed by its own function limit long before this; past it the job is dead.
export const JOB_DEAD_MS = 330000;
const jobPath = (id) => `cutjobs/${id}.json`;

// Written once, never overwritten. The store is public-read, so the account code is sealed.
export async function saveJob(id, result) {
  const { account, manage, ...rest } = result;
  await putJSON(jobPath(id), { ...rest, sealed: account ? seal({ account, manage }) : undefined, job: id }, { maxAge: 60 });
}
// null = not finished yet. `sure` asks the Blob list API, which is current the moment a write
// returns; the public URL can answer 404 for a few seconds after (lib/store.js).
export async function loadJob(id, { sure = false } = {}) {
  if (!JOB.test(String(id || ""))) return null;
  let d = await getJSON(jobPath(id), { fresh: true }).catch(() => null);
  if (!d && sure && (await listPaths(jobPath(id)).catch(() => [])).length) {
    for (let i = 0; i < 6 && !d; i++) { await new Promise((r) => setTimeout(r, 1500)); d = await getJSON(jobPath(id), { fresh: true }).catch(() => null); }
  }
  if (!d) return null;
  const { sealed, ...rest } = d;
  let acct = {};
  try { if (sealed) acct = unseal(sealed); } catch (e) {}
  return { ...rest, ...acct };
}

// deps are injectable so the charge and job rules can be tested without ffmpeg or a network.
export async function cutJob(args = {}, deps = {}) {
  const job = JOB.test(String(args.job || "")) ? args.job : null;
  const t0 = Date.now();
  let out;
  const at = { stage: "start" }; // where an unexpected exception happened, for analytics and the log
  try { out = await runCut(args, deps, at); }
  catch (e) {
    // The first production crash (2026-11-19 20:02 UTC, after a 131 s cut) left no trace of
    // which step threw; now the step is in the code and the message is in the function log.
    console.error("cut crashed at " + at.stage + ":", e && e.stack || e);
    out = fail("Cut failed: " + e.message + ". Nothing was charged.", { err: e.code || "crash_" + at.stage });
  }
  out.total_ms = Date.now() - t0;
  if (job) { out.job = job; await (deps.saveJob || saveJob)(job, out).catch((e) => console.error("cut job not saved", e.message)); }
  // Analytics from the cut itself, so a cut nobody waited for is still counted. No hook text,
  // no stream title, no account: lengths, layout, where the time went, and the failure code.
  // HOOK: when the editor's server-side clip_made event lands (lib/…), call it here with
  // path = args.via === "queue" ? "queue" : "connector" and drop server_cut.
  await (deps.serverEvent || serverEvent)("server_cut", {
    ok: !!out.ok, err: out.ok ? undefined : out.err || "unknown", path: args.via === "queue" ? "queue" : "connector",
    clip_secs: out.seconds || Math.round((seconds(args.end) - seconds(args.start)) || 0) || undefined, platform: out.platform, layout: out.layout,
    source_quality: out.source_quality, megabytes: out.megabytes, total_ms: out.total_ms, ...(out.timing || {}), charged: out.ok ? !!out.charged : false,
  }).catch(() => null);
  return out;
}

// A window a little over the cap (an assistant that asked for 61 s) is cut at the cap and the
// result says so; anything longer is refused, since trimming it would drop most of the moment.
const TRIM_SLACK_S = 15;

async function runCut(args, deps, at = {}) {
  const cut = deps.cutClip || cutClip, credit = deps.creditCall || creditCall, store = deps.putFile || putFile, resolve = deps.resolveVod || resolveVod;
  const timing = {};
  const start = seconds(args.start);
  let end = seconds(args.end), trimmed = false;
  if (isFinite(start) && isFinite(end) && end - start > MAX_CLIP_S && end - start <= MAX_CLIP_S + TRIM_SLACK_S) { end = start + MAX_CLIP_S; trimmed = true; }
  if (!isFinite(start) || !isFinite(end)) return fail("Give start and end as seconds into the stream (t_start_s and t_end_s from find_clip_moments), or as h:mm:ss.", { err: "bad_time" });
  if (end - start < MIN_CLIP_S) return fail(`A clip needs at least ${MIN_CLIP_S} seconds.`, { err: "too_short" });
  if (end - start > MAX_CLIP_S) return fail(`A clip can be at most ${MAX_CLIP_S} seconds; this window is ${Math.round(end - start)}. Pass a shorter window.`, { err: "too_long" });
  let t = Date.now();
  at.stage = "resolve";
  const vod = await resolve(args.source);
  timing.resolve_ms = Date.now() - t;
  if (vod.ok === false) return vod;
  const platform = vod.platform || "twitch";
  if (vod.length && start >= vod.length) return fail(`The stream is only ${clock(vod.length)} long so far.`, { err: "past_end", platform });

  t = Date.now();
  at.stage = "account";
  let rec = args.account ? await (deps.getAccount || getAccount)(args.account) : null;
  if (args.account && !rec) return fail("That account code is not known. Leave it out to start a new one, or use the code from an earlier cut_clip.", { err: "bad_account", platform });
  let fresh = false;
  if (!rec) {
    if ((await (deps.newAccountsToday || newAccountsToday)()) >= NEW_ACCOUNTS_PER_DAY) return fail("Too many new connector accounts today. Open the link once in a browser and pass its account code.", { err: "account_cap", platform, open: `${SITE}/post?src=mcp` });
    rec = await (deps.createAccount || createAccount)(args.via || "mcp"); fresh = true;
  }
  const account = { account: rec.code, manage: `${SITE}/post?acct=${rec.code}&src=mcp` };

  const tk = await credit("start", rec);
  timing.account_ms = Date.now() - t;
  if (!tk.ok) return fail("No clips left on this account. Buy a pack, then open the manage link once in the same browser so the connector can use it.", { err: "no_credits", platform, need: "buy", buy: `${SITE}/pricing?src=mcp`, ...account, free_left: tk.free_left, paid_left: tk.paid_left });

  const layout = LAYOUTS.includes(args.layout) ? args.layout : "fit";
  at.stage = "cut";
  let out;
  try { out = await cut(vod, { start, end, layout, cam: /^[tb][lr]$/.test(args.facecam || "") ? args.facecam : "tr", hook: args.hook || "" }); }
  catch (e) { return fail(e.message + (/charged/.test(e.message) ? "" : " Nothing was charged."), { err: e.code || "cut", platform, layout, seconds: end - start, ...account }); }
  Object.assign(timing, out.timing || {});
  const id = randomName();
  t = Date.now();
  at.stage = "store";
  const meta = { id, at: new Date().toISOString(), account_hash: null, vod: vod.id, platform, channel: vod.channel_name, title: vod.title, game: vod.game, start, end, layout, hook: args.hook || "", bytes: out.bytes, seconds: out.seconds };
  try {
    await Promise.all([store(clipPath(id), fs.readFileSync(out.file), "video/mp4"), (deps.putJSON || putJSON)(clipMetaPath(id), meta, { maxAge: 60 }).catch(() => null)]);
  } catch (e) { return fail("The clip was cut but could not be stored (" + e.message + "). Nothing was charged.", { err: "store", platform, layout, seconds: end - start, ...account }); }
  finally { try { fs.rmSync(out.dir, { recursive: true, force: true }); } catch (e) {} }
  timing.upload_ms = Date.now() - t;
  t = Date.now();
  at.stage = "commit";
  // The file exists. If the charge itself throws, the person still gets their clip (uncharged)
  // rather than an error for a clip that was made.
  let c;
  try { c = await credit("commit", rec, { ticket: tk.ticket, bytes: out.bytes, meta: { vod: vod.id, t: Math.round(start), layout: "server-" + layout } }); }
  catch (e) { console.error("credit commit failed after a stored cut:", e && e.message); c = { ok: false }; }
  timing.commit_ms = Date.now() - t;
  return {
    ok: true, clip_id: id, download: clipUrl(id), format: "MP4, H.264 + AAC, 1080x1920 (9:16), 30 fps", seconds: out.seconds, megabytes: Math.round(out.bytes / 1e5) / 10,
    ...(trimmed ? { trimmed: `The window was longer than ${MAX_CLIP_S} seconds, the most one clip can be, so the clip is its first ${MAX_CLIP_S} seconds and ends at ${clock(end)}.` } : {}),
    layout, platform, hook_burned_in: !!(args.hook || "").trim(), cut_in_ms: out.ms, source_quality: out.source_quality, timing,
    stream: { platform, channel: vod.channel_name, title: vod.title, window: `${clock(start)} – ${clock(end)}` },
    charged: !!c.ok, clips_left: c.ok ? { free: c.free_left, paid: c.paid_left } : undefined,
    ...account, new_account: fresh,
    kept_for: `${KEEP_HOURS} hours`,
  };
}
