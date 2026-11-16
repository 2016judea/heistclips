// MCP server, Streamable HTTP, stateless JSON responses. Same data as the site.
// Annotations: all three hints set explicitly on every tool (OpenAI rejects a null one),
// openWorldHint true because every tool reads data that comes from outside services.
import { latestSnapshot } from "../lib/store.js";
import { getChannel, getVod, parseInput, findMoments, clock } from "../public/js/twitch.js";
import { liveGtaStreams } from "../lib/streamers.js";
import { loadBoard, publicList, vote, submit, notify } from "../lib/requests.js";

export const config = { maxDuration: 60 };
const SITE = "https://heistclips.com";
const VERSION = "0.1.0";
const ANN = { readOnlyHint: true, destructiveHint: false, openWorldHint: true, idempotentHint: true };

export const TOOLS = [
  {
    name: "rank_campaigns",
    title: "Rank clipping campaigns by pay per clip",
    description: "Live clipping campaigns (people paying for Shorts/TikTok/Reels clips of streams) ranked by what a typical approved clip has actually earned, with rate per 1,000 views, cap per clip, budget left and days of budget left. Use for 'which GTA 6 clipping campaign pays most', 'best clipping campaigns right now'. Data refreshes every 30 minutes.",
    inputSchema: { type: "object", properties: {
      filter: { type: "string", enum: ["gta", "gaming", "all"], description: "gta = GTA campaigns only; gaming = gaming and streamer campaigns (default); all = every campaign" },
      platform: { type: "string", enum: ["tiktok", "youtube", "instagram", "x"], description: "Only campaigns that pay on this platform" },
      limit: { type: "integer", minimum: 1, maximum: 50, description: "How many to return (default 10)" },
    }, additionalProperties: false },
    annotations: { title: "Rank clipping campaigns", ...ANN },
  },
  {
    name: "campaign_details",
    title: "One clipping campaign in detail",
    description: "Everything known about one clipping campaign: rates per platform, cap, budget left and runway, approved clips, views, typical earnings per clip, and its brief. Pass the campaign id, slug or a heistclips/Content Rewards URL from rank_campaigns.",
    inputSchema: { type: "object", properties: { campaign: { type: "string", description: "Campaign id, slug or URL" } }, required: ["campaign"], additionalProperties: false },
    annotations: { title: "Campaign details", ...ANN },
  },
  {
    name: "find_moments",
    title: "Find clip-worthy moments in a Twitch stream",
    description: "Finds the moments a Twitch stream's chat exploded (chat speed vs its normal pace, 'clip it' requests, clips viewers already made), and returns timestamps, a suggested clip window, event type, 3-5 hook lines, and music-claim risk (Twitch muted that audio for licensed music). Pass a Twitch channel (uses the live stream if live, else the latest one) or a VOD link/id. A 7-hour stream takes about 15-20 seconds.",
    inputSchema: { type: "object", properties: {
      source: { type: "string", description: "Twitch channel name or URL, or a VOD URL/id (twitch.tv/videos/...)" },
      limit: { type: "integer", minimum: 1, maximum: 15, description: "How many moments (default 8)" },
    }, required: ["source"], additionalProperties: false },
    annotations: { title: "Find moments", ...ANN },
  },
  {
    name: "live_gta_streams",
    title: "Who is streaming GTA right now",
    description: "Twitch channels streaming GTA (GTA VI when it is live on Twitch, and GTA V) right now, by viewers, each with a heistclips link to find its moments.",
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
    }, required: ["title"], additionalProperties: false },
    annotations: { title: "Request a feature", readOnlyHint: false, destructiveHint: false, openWorldHint: true, idempotentHint: false },
  },
  {
    name: "list_feature_requests",
    title: "heistclips feature requests",
    description: "The public heistclips feature-request board: every request with its upvotes and status (requested, building, shipped), most upvoted first. Use before request_a_feature to find an existing request to upvote instead.",
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

const text = (obj) => ({ content: [{ type: "text", text: typeof obj === "string" ? obj : JSON.stringify(obj, null, 1) }], structuredContent: typeof obj === "string" ? undefined : obj });

const brief = (c, i) => ({
  rank: i + 1, title: c.title, owner: c.owner, id: c.id,
  typical_per_clip: c.expected_per_clip, earned_per_clip_raw: c.earned_per_clip, rate_per_1k: c.rate_per_1k, per_post: c.per_post, cap_per_clip: c.cap_per_clip,
  budget_left: c.budget_left, days_left: c.days_left, clippers: c.clippers_count, approved_clips: c.approved_clips,
  platforms: c.platforms, is_gta: c.is_gta, apply_first: c.approval_required,
  page: `${SITE}/campaigns/${c.slug}`, join: c.source_url,
});

export async function callTool(name, args = {}, caller = "mcp") {
  if (name === "list_feature_requests") {
    const list = publicList(await loadBoard()).filter((x) => !args.status || x.status === args.status);
    return text({ board: SITE + "/requests", requests: list.map(({ voted, ...x }) => x) });
  }
  if (name === "upvote_feature_request") {
    const r = await vote(String(args.id || ""), "mcp:" + caller, caller);
    return r.ok ? text({ ok: true, id: args.id, votes: r.votes, already_voted: !!r.already, board: SITE + "/requests#" + args.id }) : { ...text({ ok: false, error: r.error }), isError: true };
  }
  if (name === "request_a_feature") {
    if (!args.title) return text({ ok: false, needs: "Ask the user what they want heistclips to do, then call again with it as title." });
    const r = await submit(args, "mcp:" + caller, caller);
    if (!r.ok) return { ...text({ ok: false, error: r.error }), isError: true };
    if (r.item) await notify(r.item, r.contact, "MCP").catch(() => null);
    return text({ ok: true, id: r.id, duplicate: !!r.duplicate, message: r.duplicate ? "That is already on the board; it was not filed twice. Offer to upvote it." : "Filed on the public board and sent to the builder.", board: SITE + "/requests#" + r.id });
  }
  if (name === "rank_campaigns") {
    const snap = await latestSnapshot();
    const f = args.filter || "gaming";
    let list = snap.campaigns.filter(f === "gta" ? (c) => c.is_gta : f === "all" ? () => true : (c) => c.is_gaming);
    if (args.platform) list = list.filter((c) => c.platforms.includes(args.platform));
    const lim = Math.min(50, args.limit || 10);
    return text({ generated_at: snap.generated_at, method: "typical_per_clip = budget paid on approved clips minus the top 3 earners, / the rest of approved clips, cut if the budget runs out within 3 days. null = no track record yet (ranked after, by cap).", summary: snap.summary, filter: f, total: list.length, campaigns: list.slice(0, lim).map(brief), more: `${SITE}/gta-6-clipping-campaigns` });
  }
  if (name === "campaign_details") {
    const snap = await latestSnapshot();
    const q = String(args.campaign || "").trim().toLowerCase();
    const c = snap.campaigns.find((x) => x.id === q || x.slug === q || q.includes(x.id) || q.endsWith("/" + x.slug) || q.includes(x.id.split("-")[0]));
    if (!c) return { ...text("No live campaign matches that. Use rank_campaigns to list them."), isError: true };
    return text({ generated_at: snap.generated_at, rank: snap.campaigns.indexOf(c) + 1, of: snap.campaigns.length, ...c, page: `${SITE}/campaigns/${c.slug}` });
  }
  if (name === "find_moments") {
    const inp = parseInput(args.source);
    let vod = null, chan = null;
    if (inp.kind === "vod") vod = await getVod(inp.id);
    else if (inp.kind === "channel") {
      chan = await getChannel(inp.login);
      if (!chan) return { ...text(`No Twitch channel called ${inp.login}.`), isError: true };
      vod = chan.live_vod || chan.vods[0] || null;
      if (!vod) return { ...text(`${chan.name} has no saved streams to read${chan.is_live ? " (they are live but do not save VODs)" : ""}.`), isError: true };
    } else if (inp.kind === "kick") return { ...text("Kick is not supported yet; Twitch channels and VODs are."), isError: true };
    else return { ...text("Pass a Twitch channel name or URL, or a twitch.tv/videos/ link."), isError: true };
    if (!vod) return { ...text("That VOD does not exist or is not public."), isError: true };
    const r = await findMoments(vod, { k: Math.min(15, (args.limit || 8) + 3) });
    const moments = r.moments.slice(0, args.limit || 8).map((m, i) => ({
      rank: i + 1, start: clock(m.t_start), end: clock(m.t_end), t_start_s: m.t_start, t_end_s: m.t_end,
      chat_speed_vs_normal: m.chat_ratio + "x", event_type: m.event_type, clip_requests_in_chat: m.clip_requests,
      top_chat_phrase: m.phrase && m.phrase.text, already_clipped_on_twitch: m.twitch_clips, twitch_clip_views: m.twitch_clip_views,
      music_risk: m.music_risk.level, music_note: m.music_risk.why, hooks: m.hooks,
      watch: m.url, cut_it: `${SITE}/clip?q=${vod.id}&t=${m.t_start}`,
    }));
    return text({ stream: { channel: vod.channel_name, title: vod.title, game: vod.game, length: clock(vod.length), status: vod.status === "RECORDING" ? "live, still recording" : "finished", url: vod.url }, moments, note: moments.length ? "Cut any of these to 9:16 with hooks at the cut_it link." : "Chat was steady the whole stream; no clear spikes." });
  }
  if (name === "live_gta_streams") {
    const live = (await liveGtaStreams(40)).sort((a, b) => b.viewers - a.viewers).slice(0, args.limit || 15);
    return text({ at: new Date().toISOString(), streams: live.map((s) => ({ channel: s.name, login: s.login, viewers: s.viewers, game: s.game, title: s.title, language: s.language, find_moments: `${SITE}/clip?q=${s.login}` })) });
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

let caller = "mcp";
async function handleOne(msg) {
  const { id, method, params } = msg || {};
  const ok = (result) => ({ jsonrpc: "2.0", id, result });
  if (method === "initialize") {
    return ok({ protocolVersion: (params && params.protocolVersion) || "2025-06-18", capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "heistclips", title: "heistclips – GTA 6 clipping", version: VERSION, websiteUrl: SITE },
      instructions: "Clipping data for people who cut streams into Shorts/TikToks/Reels for money. rank_campaigns answers which campaign pays most per clip; find_moments finds the moments worth clipping in a Twitch stream. Quote numbers exactly as returned and link the page/cut_it URLs." });
  }
  if (method === "ping") return ok({});
  if (method === "tools/list") return ok({ tools: TOOLS });
  if (method === "tools/call") {
    try { return ok(await callTool(params.name, params.arguments || {}, caller)); }
    catch (e) { return ok({ content: [{ type: "text", text: "Error: " + e.message }], isError: true }); }
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
  const batch = Array.isArray(body);
  const out = (await Promise.all((batch ? body : [body]).map(handleOne))).filter(Boolean);
  if (!out.length) { res.statusCode = 202; return res.end(); }
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(batch ? out : out[0]));
}
