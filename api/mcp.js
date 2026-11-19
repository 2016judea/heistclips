// MCP server, Streamable HTTP, stateless JSON responses. Same data as the site.
// Annotations: all three hints set explicitly on every tool (OpenAI rejects a null one),
// openWorldHint true because every tool reads data that comes from outside services.
import { latestSnapshot } from "../lib/store.js";
import { liveGtaStreams } from "../lib/streamers.js";
import { liveKickGta } from "../public/js/kick.js";
import { loadBoard, publicList, vote, submit, notify, hashOf } from "../lib/requests.js";
import { queueTool } from "../lib/queuetool.js";
import { findClipMoments } from "../lib/momentstool.js";
import { JOB, newJobId, jobAgeMs, JOB_DEAD_MS, loadJob } from "../lib/cutjob.js";

const SITE = "https://heistclips.com";
const BASE = process.env.HC_BASE || SITE; // where this server reaches its own /api/v1 functions
const VERSION = "0.2.0";
const PH_KEY = "phc_yFgRGppL6H7DvhgZTQKbHdrY5oqnpLT482rrNYtLqnAx"; // public project key, same as lib/posthog.html
const ANN = { readOnlyHint: true, destructiveHint: false, openWorldHint: true, idempotentHint: true };

export const TOOLS = [
  {
    name: "rank_clipping_campaigns",
    title: "Which clipping campaign pays most ($ per 1K views, pay per clip)",
    description: "Clipping campaigns that pay clippers for TikTok, YouTube Shorts and Instagram Reels clips of streams, ranked by what a typical approved clip has actually earned. Each has its rate in $ per 1K views (or per post), cap per clip, budget left and days of budget left. Use for 'which clipping campaign pays most', 'best GTA 6 clipping campaigns right now', 'how much do clippers get per 1,000 views', 'where can I get paid to clip'. Refreshed every 30 minutes. Works in any language: answer in the user's language.",
    inputSchema: { type: "object", properties: {
      filter: { type: "string", enum: ["gta", "gaming", "all"], description: "gta = GTA campaigns only; gaming = gaming and streamer campaigns (default); all = every campaign" },
      platform: { type: "string", enum: ["tiktok", "youtube", "instagram", "x"], description: "Only campaigns that pay on this platform" },
      limit: { type: "integer", minimum: 1, maximum: 50, description: "How many to return (default 10)" },
    }, additionalProperties: false },
    annotations: { title: "Rank clipping campaigns", ...ANN },
  },
  {
    name: "clipping_campaign_details",
    title: "One clipping campaign: rate per 1K views, cap, budget, rules",
    description: "Everything known about one clipping campaign: $ per 1K views on each platform (TikTok, Shorts, Reels, X), cap per clip, budget left and runway, approved clips, views, typical earnings per clip, and its brief and rules. Pass the campaign id, slug or a heistclips/Content Rewards URL from rank_clipping_campaigns.",
    inputSchema: { type: "object", properties: { campaign: { type: "string", description: "Campaign id, slug or URL" } }, required: ["campaign"], additionalProperties: false },
    annotations: { title: "Campaign details", ...ANN },
  },
  {
    name: "find_clip_moments",
    title: "Find the best moments to clip in a Twitch or Kick stream (live or VOD)",
    description: "Finds the highlights worth clipping in a Twitch or Kick stream, live or a VOD, by reading chat: where chat exploded against its normal pace, 'clip it' requests, clips viewers already made. Returns timestamps, a clip window, event type, 3-5 hook lines for the first second, music-claim risk, spoiler risk (set skip_spoilers for campaigns that ban story spoilers), and a cut_it link that opens the moment ready to render as a 9:16 clip for TikTok, Shorts or Reels. Use for 'best moments in xQc's stream', 'find highlights in this VOD', 'what should I clip from kick.com/<name>', 'clip this stream'. Pass a Twitch channel or just the streamer's name (the live stream if live, else the latest), a Kick channel as kick.com/<name>, a VOD link or id, or a Twitch clip link (its whole stream is read). Chat in any language works (German, Spanish, Portuguese…); answer in the user's language. A long Twitch stream takes 5-20 seconds and a stream that was read before answers at once; Kick takes about 2 minutes the first time. If the source cannot be read the result has found: false with the reason and channels that are live now: tell the user, do not retry the same source.",
    inputSchema: { type: "object", properties: {
      source: { type: "string", description: "Twitch channel name or URL, a Kick channel URL (kick.com/<name>), a VOD URL (twitch.tv/videos/… or kick.com/<name>/videos/…), or a Twitch clip URL" },
      limit: { type: "integer", minimum: 1, maximum: 15, description: "How many moments (default 8)" },
      skip_spoilers: { type: "boolean", description: "true = leave out moments that look like story spoilers (chat warns about spoilers, talks about the ending, or reacts to a story scene), for campaigns that ban spoilers. Skipped moments come back in skipped_spoilers with the reason. Default false: every moment is returned with a spoiler_risk field." },
    }, required: ["source"], additionalProperties: false },
    annotations: { title: "Find moments", ...ANN },
  },
  {
    name: "cut_clip",
    title: "Cut a moment into a vertical 9:16 MP4 clip for TikTok, Shorts and Reels",
    description: "Cuts a window of a Twitch or Kick stream (a VOD, or a live stream so far) into a finished 1080x1920 MP4 and returns a download link, without opening the web editor. Use after find_clip_moments: pass the same source and a moment's t_start_s and t_end_s (5 to 60 seconds). Layouts: fit (full frame over a blurred fill, the safe default), split (facecam on top, gameplay below; say which corner the facecam is in), crop (centre crop). Optional hook text is burned in at the top. Each cut uses one clip credit, the same as a render on the site: a new account gets free clips, then packs. The first call returns an account code; pass it back as account on every later cut_clip and post_clip so credits and connected YouTube/TikTok accounts carry over. Usually done in 10 to 40 seconds. It never hangs: if the file is not ready after about 45 seconds the result has status 'cutting' and a job code instead of a download link. Then call cut_clip_status with that job (it waits for the file) and do NOT call cut_clip again for the same window; nothing is charged until the file exists. The file is kept 72 hours.",
    inputSchema: { type: "object", properties: {
      source: { type: "string", description: "The stream: a Twitch VOD link or id, a Kick video link, or a channel (its live or latest stream). Use the stream url from find_clip_moments." },
      start: { type: ["number", "string"], description: "Where the clip starts: seconds into the stream (t_start_s), or h:mm:ss" },
      end: { type: ["number", "string"], description: "Where the clip ends: seconds into the stream (t_end_s), or h:mm:ss. 5 to 60 seconds after start." },
      layout: { type: "string", enum: ["fit", "split", "crop"], description: "fit = whole frame, blurred fill (default); split = facecam on top + gameplay; crop = centre crop" },
      facecam: { type: "string", enum: ["tl", "tr", "bl", "br"], description: "For split: the corner of the stream the facecam is in (default tr = top right)" },
      hook: { type: "string", description: "Optional text burned in at the top, e.g. one of the moment's hooks. Up to 90 characters; emoji are dropped." },
      account: { type: "string", description: "The account code (hc_…) from an earlier cut_clip. Leave out on the very first cut." },
    }, required: ["source", "start", "end"], additionalProperties: false },
    annotations: { title: "Cut a 9:16 clip", readOnlyHint: false, destructiveHint: false, openWorldHint: true, idempotentHint: false },
  },
  {
    name: "cut_clip_status",
    title: "Get a clip that cut_clip was still cutting",
    description: "Waits for a clip that cut_clip answered 'cutting' for, and returns its download link when the file is ready. Pass the job code from that cut_clip result. It waits up to 40 seconds per call; if the status is still 'cutting', call it again. Never start a second cut_clip for the same window: the first one is still running and is charged once, only when its file exists. A cut that failed says so here, and nothing was charged.",
    inputSchema: { type: "object", properties: { job: { type: "string", description: "The job code (cj…) from a cut_clip result with status 'cutting'" } }, required: ["job"], additionalProperties: false },
    annotations: { title: "Clip status", ...ANN },
  },
  {
    name: "post_clip",
    title: "Post a clip to YouTube Shorts or TikTok with a caption",
    description: "Posts a clip made by cut_clip to the user's YouTube channel (as a Short) or TikTok, with their caption, so find moment -> cut -> post happens without leaving the chat. Needs the account code from cut_clip. The user connects YouTube or TikTok once: if it is not connected yet this returns needs_connect and a connect link; give them the link, wait until they say it is done, then call again. Always confirm the caption and platform with the user before posting. Until YouTube and TikTok finish reviewing heistclips, a post may arrive private (the result says so and how to publish it).",
    inputSchema: { type: "object", properties: {
      account: { type: "string", description: "The account code (hc_…) from cut_clip" },
      clip_id: { type: "string", description: "clip_id from cut_clip" },
      platform: { type: "string", enum: ["youtube", "tiktok"], description: "Where to post" },
      caption: { type: "string", description: "The caption, in the user's words. YouTube: it becomes the description, and its first line the title unless title is given." },
      title: { type: "string", description: "YouTube only: the Short's title, up to 100 characters" },
      privacy: { type: "string", enum: ["public", "unlisted", "private"], description: "Who can see it (default public; the platform may force private, see the result)" },
      tiktok_mode: { type: "string", enum: ["direct", "draft"], description: "TikTok only: direct = post it (default); draft = send to the user's TikTok inbox to finish in the app" },
    }, required: ["account", "clip_id", "platform"], additionalProperties: false },
    annotations: { title: "Post a clip", readOnlyHint: false, destructiveHint: false, openWorldHint: true, idempotentHint: false },
  },
  {
    name: "posting_account",
    title: "Connect YouTube or TikTok for posting, and check clip credits",
    description: "Shows whether YouTube and TikTok are connected for a heistclips account code, how many clips it has left, and the one-time link where the user connects or disconnects them. Call with no account to get a new code and link.",
    inputSchema: { type: "object", properties: { account: { type: "string", description: "The account code (hc_…) from cut_clip; leave out to start a new one" } }, additionalProperties: false },
    annotations: { title: "Posting account", readOnlyHint: false, destructiveHint: false, openWorldHint: true, idempotentHint: true },
  },
  {
    name: "my_clip_queue",
    title: "My clip queue: ready clips from the streamers I watch, matched to the campaign that pays",
    description: "The user's heistclips autopilot queue: clips that are ready to cut from the Twitch and Kick streamers on their watchlist (live streams and new VODs are re-read every 10 minutes), each with a hook line, a caption, why chat exploded, and the best-paying clipping campaign it fits with that campaign's $ per clip and rules still to check. Use for 'what should I clip today', 'any new clips', 'what's in my queue'. Pass the account code (hc_…) from watch_streamer or cut_clip, or the private queue link the user copied from heistclips.com/queue. Each clip carries cut_with values for cut_clip.",
    inputSchema: { type: "object", properties: {
      account: { type: "string", description: "The account code (hc_…) from watch_streamer or cut_clip" },
      queue_link: { type: "string", description: "Or: the private link from the user's queue page (heistclips.com/queue?k=…), exactly as they pasted it" },
      limit: { type: "integer", minimum: 1, maximum: 30, description: "How many clips (default 10)" },
    }, additionalProperties: false },
    annotations: { title: "My clip queue", ...ANN },
  },
  {
    name: "watch_streamer",
    title: "Watch a streamer for me: add a Twitch or Kick channel to my clip watchlist",
    description: "Adds a Twitch or Kick streamer to the user's heistclips watchlist, so their live streams and new VODs are read every 10 minutes and the moments chat explodes land in my_clip_queue as ready clips. Says which clipping campaigns pay for clips of that streamer and how many clips are ready now. Use for 'watch kaicenat for me', 'tell me when X has a clip', 'follow this streamer'. Leave account out on the first call (a code is returned; keep it and pass it back), or pass the user's private queue link to use the queue they started on the website. Set remove to stop watching.",
    inputSchema: { type: "object", properties: {
      streamer: { type: "string", description: "Twitch channel name or link, or a Kick channel as kick.com/<name>" },
      account: { type: "string", description: "The account code (hc_…) from an earlier call. Leave out on the very first call." },
      queue_link: { type: "string", description: "Or: the private link from the user's queue page (heistclips.com/queue?k=…)" },
      remove: { type: "boolean", description: "true to stop watching this streamer" },
    }, required: ["streamer"], additionalProperties: false },
    annotations: { title: "Watch a streamer", readOnlyHint: false, destructiveHint: false, openWorldHint: true, idempotentHint: true },
  },
  {
    name: "live_gta_streams",
    title: "Who is live streaming GTA right now on Twitch and Kick",
    description: "Twitch and Kick channels live streaming GTA (GTA VI and GTA V) right now, by viewers, with language, each with a link to find its clip moments. Use for 'who is streaming GTA 6 right now', 'which live stream should I clip'.",
    inputSchema: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 40, description: "How many (default 15)" } }, additionalProperties: false },
    annotations: { title: "Live GTA streams", ...ANN },
  },
  {
    name: "request_a_feature",
    title: "Request a heistclips feature",
    description: "Files a feature request on heistclips' public board (heistclips.com/requests) and emails the person who builds it. Use when the user wants heistclips or this connector to do something it does not: a platform, a layout, captions, alerts, a campaign source. Pass their words VERBATIM as `title` (short) and optional `detail`; pass `contact` only if they offer an email or handle, exactly as written. Ask first if you do not know what they want. Tell them it was filed only if ok is true.",
    inputSchema: { type: "object", properties: {
      title: { type: "string", description: "What they want, in their own words, under 90 characters" },
      detail: { type: "string", description: "Optional: what they were trying to do" },
      contact: { type: "string", description: "Optional: email or handle for a reply, verbatim, only if offered" },
      not_a_stream: { type: "boolean", description: "Only if a previous call said the title looks like a stream and the user confirms it is really a feature request" },
    }, required: ["title"], additionalProperties: false },
    annotations: { title: "Request a feature", readOnlyHint: false, destructiveHint: false, openWorldHint: true, idempotentHint: false },
  },
  {
    name: "list_feature_requests",
    title: "heistclips feature requests",
    description: "The public heistclips feature-request board: every request with its upvotes, status (requested, building, shipped), and for closed items the builder's response and shipped_at date, most upvoted first. Titles and details are in English; a request written in another language also carries its original text and language code under original. Use before request_a_feature to find an existing request to upvote instead.",
    inputSchema: { type: "object", properties: { status: { type: "string", enum: ["requested", "building", "shipped"], description: "Only this status" } }, additionalProperties: false },
    annotations: { title: "List feature requests", ...ANN },
  },
  {
    name: "upvote_feature_request",
    title: "Upvote a heistclips feature request",
    description: "Adds one upvote to a request on the heistclips board, by id from list_feature_requests. One vote per caller; repeat calls do not add more.",
    inputSchema: { type: "object", properties: { id: { type: "string", description: "Request id from list_feature_requests" } }, required: ["id"], additionalProperties: false },
    annotations: { title: "Upvote a feature request", readOnlyHint: false, destructiveHint: false, openWorldHint: true, idempotentHint: true },
  },
];

// Old names stay callable: ChatGPT's reviewed app and any client with a cached tool list use them.
export const ALIASES = { rank_campaigns: "rank_clipping_campaigns", campaign_details: "clipping_campaign_details", find_moments: "find_clip_moments" };

// Every heistclips link the connector hands out carries src=mcp, so visits from it are countable.
export function tag(url) {
  url = String(url);
  if (!url.startsWith(SITE) || /[?&]src=/.test(url)) return url;
  const i = url.indexOf("#"), base = i < 0 ? url : url.slice(0, i), hash = i < 0 ? "" : url.slice(i);
  return base + (base.includes("?") ? "&" : "?") + "src=mcp" + hash;
}

// One PostHog event per tool call: tool, ok/error, duration, a short failure code, and for
// cuts the clip length, platform, layout and where the time went. No arguments, no chat text,
// no captions, no IP. The id is a keyed hash of day + connection + client, so a connector user
// counts once per day.
const LOG_KEYS = ["err", "status", "platform", "layout", "clip_secs", "source_quality", "megabytes", "cache", "read_ms", "stream_hours", "live", "moments", "polls",
  "resolve_ms", "account_ms", "playlist_ms", "download_ms", "source_mb", "encode_ms", "upload_ms", "commit_ms", "cut_ms", "kind"];
async function logCall(tool, ok, ms, meta, extra = {}) {
  if (process.env.HC_NO_ANALYTICS) return;
  try {
    const day = new Date().toISOString().slice(0, 10);
    const more = {};
    for (const k of LOG_KEYS) if (extra[k] !== undefined && extra[k] !== null && typeof extra[k] !== "object") more[k] = typeof extra[k] === "string" ? extra[k].slice(0, 40) : extra[k];
    await fetch("https://us.i.posthog.com/capture/", { method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(1500),
      body: JSON.stringify({ api_key: PH_KEY, event: "mcp_tool_call", distinct_id: "mcp_" + hashOf(day + "|" + meta.ip + "|" + meta.ua),
        properties: { tool, ok, ms, ...more, client: meta.client, client_ua: String(meta.ua).split(/[\/ ;(]/)[0].slice(0, 30), site: "heistclips", $process_person_profile: false, $lib: "heistclips-mcp" } }) });
  } catch (e) {}
}
const clientOf = (ua) => (/claude/i.test(ua) ? "claude" : /openai|chatgpt/i.test(ua) ? "chatgpt" : /grok|xai/i.test(ua) ? "grok" : /cursor/i.test(ua) ? "cursor" : /node|undici|python|curl/i.test(ua) ? "script" : "other");

export const INSTRUCTIONS = "heistclips is a clipping tool for people who cut Twitch and Kick streams into TikTok, YouTube Shorts and Instagram Reels clips, often for clipping campaigns that pay $ per 1K views. Use find_clip_moments when the user wants highlights, the best moments, or something to clip from a stream, a VOD or a live channel. Use cut_clip to turn a moment into a finished 9:16 MP4 without the web editor (keep the account code it returns and pass it back; if it answers status 'cutting', call cut_clip_status with the job code instead of cutting again), then post_clip to post it to YouTube Shorts or TikTok with the user's caption once they have connected their account through the link it gives. Use rank_clipping_campaigns for which campaign pays most per clip or per 1K views, and clipping_campaign_details for one campaign. live_gta_streams lists who is live. watch_streamer puts a streamer on the user's watchlist and my_clip_queue lists the clips that are ready from it, each matched to the campaign that pays; keep the account code these return and pass it back. Quote numbers exactly as returned and always show the page and cut_it links. Works in any language: reply in the language the user writes in, and pass their words verbatim to request_a_feature if they ask for something heistclips cannot do.";

// A tool result may carry `log`: analytics fields for this call. It never reaches the client.
const withLog = (result, log) => Object.defineProperty(result, "log", { value: log, enumerable: false });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// How long cut_clip holds the assistant before answering "still cutting", and how long one
// cut_clip_status call waits. Both sit well inside every client's tool timeout.
const CUT_WAIT_MS = Number(process.env.HC_CUT_WAIT_MS) || 45000, STATUS_WAIT_MS = 40000;

function cutResult(d, polls = 0) {
  const log = { err: d.ok ? undefined : d.err || "unknown", platform: d.platform, layout: d.layout, clip_secs: d.seconds, source_quality: d.source_quality, megabytes: d.megabytes, cut_ms: d.cut_in_ms, polls, ...(d.timing || {}) };
  const { timing, err, total_ms, platform, ...pub } = d;
  if (!d.ok) return withLog({ ...text(pub), isError: !d.need }, log);
  return withLog(text({ ...pub, next: "Give the user the download link. To post it, call post_clip with clip_id, account, platform and a caption." }), log);
}
const stillCutting = (job, waited, polls) => withLog(text({
  status: "cutting", job, waited_s: Math.round(waited / 1000),
  message: "The clip is still being cut. Call cut_clip_status with this job code now: it waits up to 40 seconds for the file and returns the download link. Do not call cut_clip again for this window; nothing is charged until the file exists.",
  next: { tool: "cut_clip_status", arguments: { job } },
}), { status: "cutting", polls });

async function cutStatus(id) {
  if (!JOB.test(String(id || ""))) return withLog({ ...text({ ok: false, error: "That is not a job code. Pass the job value (cj…) from a cut_clip result with status 'cutting'." }), isError: true }, { err: "bad_job" });
  const t0 = Date.now();
  let d = null, n = 0;
  for (;;) {
    d = await loadJob(id, { sure: n % 4 === 3 || jobAgeMs(id) > JOB_DEAD_MS });
    if (d || Date.now() - t0 > STATUS_WAIT_MS || jobAgeMs(id) > JOB_DEAD_MS) break;
    await sleep(2500); n++;
  }
  if (d) return cutResult(d, n + 1);
  if (jobAgeMs(id) > JOB_DEAD_MS) return withLog({ ...text({ ok: false, job: id, error: "That cut did not finish. Nothing was charged. Call cut_clip again with the same window." }), isError: true }, { err: "job_lost", polls: n + 1 });
  return stillCutting(id, jobAgeMs(id), n + 1);
}

const text = (obj) => ({ content: [{ type: "text", text: typeof obj === "string" ? obj : JSON.stringify(obj, null, 1) }], structuredContent: typeof obj === "string" ? undefined : obj });

const brief = (c, i) => ({
  rank: i + 1, title: c.title, owner: c.owner, id: c.id,
  typical_per_clip: c.expected_per_clip, earned_per_clip_raw: c.earned_per_clip, rate_per_1k: c.rate_per_1k, per_post: c.per_post, cap_per_clip: c.cap_per_clip,
  budget_left: c.budget_left, days_left: c.days_left, clippers: c.clippers_count, approved_clips: c.approved_clips,
  platforms: c.platforms, is_gta: c.is_gta, apply_first: c.approval_required,
  page: tag(`${SITE}/campaigns/${c.slug}`), join: c.source_url,
});

export async function callTool(name, args = {}, caller = "mcp") {
  name = ALIASES[name] || name;
  if (name === "list_feature_requests") {
    const list = publicList(await loadBoard()).filter((x) => !args.status || x.status === args.status);
    return text({ board: tag(SITE + "/requests"), requests: list.map(({ voted, ...x }) => x) });
  }
  if (name === "upvote_feature_request") {
    const r = await vote(String(args.id || ""), "mcp:" + caller, caller);
    return r.ok ? text({ ok: true, id: args.id, votes: r.votes, already_voted: !!r.already, board: tag(SITE + "/requests#" + args.id) }) : { ...text({ ok: false, error: r.error }), isError: true };
  }
  if (name === "request_a_feature") {
    if (!args.title) return text({ ok: false, needs: "Ask the user what they want heistclips to do, then call again with it as title." });
    const r = await submit(args, "mcp:" + caller, caller);
    if (r.stream) return text({ ok: false, filed: false, looks_like_stream: r.kind, message: `Not filed: "${args.title}" is a ${r.kind}, not a feature request. Find its moments with find_clip_moments (source "${r.q}") or open the clip link. If the user really meant it as a request, call again with not_a_stream true.`, find_clip_moments_source: r.q, open: tag(r.clip) });
    if (!r.ok) return { ...text({ ok: false, error: r.error }), isError: true };
    if (r.item) await notify(r.item, r.contact, "MCP").catch(() => null);
    return text({ ok: true, id: r.id, duplicate: !!r.duplicate, message: r.duplicate ? "That is already on the board; it was not filed twice. Offer to upvote it." : "Filed on the public board and sent to the builder.", board: tag(SITE + "/requests#" + r.id) });
  }
  if (name === "rank_clipping_campaigns") {
    const snap = await latestSnapshot();
    const f = args.filter || "gaming";
    let list = snap.campaigns.filter(f === "gta" ? (c) => c.is_gta : f === "all" ? () => true : (c) => c.is_gaming);
    if (args.platform) list = list.filter((c) => c.platforms.includes(args.platform));
    const lim = Math.min(50, args.limit || 10);
    return text({ generated_at: snap.generated_at, method: "typical_per_clip = budget paid on approved clips minus the top 3 earners, / the rest of approved clips, cut if the budget runs out within 3 days. null = no track record yet (ranked after, by cap).", summary: snap.summary, filter: f, total: list.length, campaigns: list.slice(0, lim).map(brief), more: tag(`${SITE}/gta-6-clipping-campaigns`) });
  }
  if (name === "clipping_campaign_details") {
    const snap = await latestSnapshot();
    const q = String(args.campaign || "").trim().toLowerCase();
    const c = snap.campaigns.find((x) => x.id === q || x.slug === q || q.includes(x.id) || q.endsWith("/" + x.slug) || q.includes(x.id.split("-")[0]));
    if (!c) return { ...text("No live campaign matches that. Use rank_clipping_campaigns to list them."), isError: true };
    return text({ generated_at: snap.generated_at, rank: snap.campaigns.indexOf(c) + 1, of: snap.campaigns.length, ...c, page: tag(`${SITE}/campaigns/${c.slug}`) });
  }
  if (name === "find_clip_moments") {
    const { out, log } = await findClipMoments(args, { tag });
    return withLog(text(out), log);
  }
  if (name === "cut_clip_status") return cutStatus(args.job);
  if (name === "cut_clip") {
    if (args.job && !args.source) return cutStatus(args.job);
    // The cut runs in its own function (ffmpeg, longer limit) and goes on to the end whether or
    // not anyone is still waiting. This call waits a safe while, then hands back the job code.
    const job = newJobId(), t0 = Date.now();
    const cut = fetch(BASE + "/api/v1/cut", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...args, via: "mcp", job }) })
      .then(async (r) => (await r.json().catch(() => null)) || { ok: false, err: "http_" + r.status, error: "The cut did not finish (" + r.status + "). Nothing was charged; try again." }, () => null);
    const d = await Promise.race([cut, sleep(CUT_WAIT_MS).then(() => undefined)]);
    if (d) return cutResult(d);
    // No answer in time, or the connection dropped: the job itself knows how it ended.
    if (d === null && Date.now() - t0 < 3000) return withLog({ ...text({ ok: false, error: "The cutter could not be reached. Nothing was charged; try again." }), isError: true }, { err: "cut_unreachable" });
    return stillCutting(job, Date.now() - t0, 0);
  }
  if (name === "post_clip" || name === "posting_account") {
    const r = await fetch(BASE + "/api/v1/post", { method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(280000),
      body: JSON.stringify(name === "post_clip" ? { ...args, op: "post", via: "mcp" } : { op: args.account ? "status" : "new", account: args.account, via: "mcp" }) });
    let d = await r.json().catch(() => ({ ok: false, error: "heistclips did not answer (" + r.status + ")." }));
    if (name === "posting_account" && d.ok && !args.account) d = await (await fetch(BASE + "/api/v1/post", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "status", account: d.account }) })).json();
    if (d.manage) d.manage = tag(d.manage); if (d.connect) d.connect = tag(d.connect);
    delete d.open;
    return d.ok ? text(d) : { ...text(d), isError: !(d.needs_connect || d.not_open_yet) };
  }
  if (name === "my_clip_queue" || name === "watch_streamer") {
    const d = await queueTool(name, args);
    return d.ok ? text(d) : { ...text(d), isError: true };
  }
  if (name === "live_gta_streams") {
    const [tw, kk] = await Promise.all([liveGtaStreams(40), liveKickGta(20).catch(() => [])]);
    const live = [...tw.map((s) => ({ ...s, platform: "twitch" })), ...kk].sort((a, b) => b.viewers - a.viewers).slice(0, args.limit || 15);
    return text({ at: new Date().toISOString(), streams: live.map((s) => ({ platform: s.platform, channel: s.name, login: s.login, viewers: s.viewers, game: s.game, title: s.title, language: s.language, find_clip_moments: tag(`${SITE}/clip?q=${encodeURIComponent(s.platform === "kick" ? "kick.com/" + s.login : s.login)}`) })) });
  }
  return { ...text("Unknown tool " + name), isError: true };
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body);
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "null");
}

let caller = "mcp", meta = { ip: "local", ua: "", client: "other" };
async function handleOne(msg) {
  const { id, method, params } = msg || {};
  const ok = (result) => ({ jsonrpc: "2.0", id, result });
  if (method === "initialize") {
    return ok({ protocolVersion: (params && params.protocolVersion) || "2025-06-18", capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "heistclips", title: "heistclips – GTA 6 clipping", version: VERSION, websiteUrl: SITE },
      instructions: INSTRUCTIONS });
  }
  if (method === "ping") return ok({});
  if (method === "tools/list") return ok({ tools: TOOLS });
  if (method === "tools/call") {
    const t0 = Date.now(), tool = ALIASES[params && params.name] || String((params && params.name) || "");
    let out;
    try { out = await callTool(params.name, params.arguments || {}, caller); }
    catch (e) { out = withLog({ content: [{ type: "text", text: "Error: " + e.message }], isError: true }, { err: /twitch|kick|gql/i.test(e.message) ? "upstream" : "exception" }); }
    const log = out.log || {};
    await logCall(TOOLS.some((t) => t.name === tool) ? tool : "unknown", !out.isError && log.ok !== false && !log.err, Date.now() - t0, meta, out.isError && !log.err ? { ...log, err: "error" } : log);
    return ok(out);
  }
  if (method === "resources/list") return ok({ resources: [] });
  if (method === "prompts/list") return ok({ prompts: [] });
  if (method && method.startsWith("notifications/")) return null;
  return { jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found: " + method } };
}

export default async function handler(req, res) {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-headers", "content-type, mcp-session-id, mcp-protocol-version, authorization");
  res.setHeader("access-control-allow-methods", "POST, GET, OPTIONS, DELETE");
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  if (req.method === "GET") {
    res.statusCode = 405; res.setHeader("allow", "POST");
    return res.end(JSON.stringify({ name: "heistclips MCP", transport: "streamable-http", url: SITE + "/mcp", docs: SITE + "/connect" }));
  }
  if (req.method === "DELETE") { res.statusCode = 204; return res.end(); }
  let body;
  try { body = await readBody(req); } catch (e) { res.statusCode = 400; return res.end(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } })); }
  caller = String(req.headers["x-forwarded-for"] || "local").split(",")[0].trim();
  const ua = String(req.headers["user-agent"] || "");
  meta = { ip: caller, ua, client: clientOf(ua) };
  const batch = Array.isArray(body);
  const out = (await Promise.all((batch ? body : [body]).map(handleOne))).filter(Boolean);
  if (!out.length) { res.statusCode = 202; return res.end(); }
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(batch ? out : out[0]));
}
