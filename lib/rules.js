// Campaign rules -> checklist lines for the clip editor. Ported from the private desk
// (heistclips-desk/desk/rules.js, 2026-11-19), where it ran our own clipping channel.
//
// Every rule sentence in the campaign's description, and in the rules pages it links to (a
// reachclipping.com page, a link-shared Google Doc), becomes one line with its verbatim text. A
// line the parser understands gets a kind; a line that reads like a rule but matches nothing is
// kept as "unparsed" so the editor shows it as "check the brief". Nothing is ever reported as
// passed because the parser missed it. Public pages only, read with a normal browser user agent.
import crypto from "node:crypto";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";
const INLINE = "a|b|strong|em|i|u|span|code|mark|small|sup|sub|font|label";

export function htmlToLines(html) {
  let t = String(html || "").replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ");
  t = t.replace(new RegExp(`</?(?:${INLINE})(?:\\s[^>]*)?>`, "gi"), "");
  t = t.replace(/<[^>]+>/g, "\n");
  t = t.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#x27;|&#39;|&rsquo;/g, "'").replace(/&quot;|&ldquo;|&rdquo;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  return t.split("\n").map((l) => l.replace(/\s+/g, " ").replace(/\s+([,.])/g, "$1").trim()).filter(Boolean);
}

const PROFILE_HOST = /(^|\.)(twitch\.tv|youtube\.com|youtu\.be|instagram\.com|tiktok\.com|kick\.com|x\.com|twitter\.com|whop\.com|discord\.gg|discord\.com)$/i;
export function ruleLinks(text) {
  const out = [];
  for (const m of String(text || "").matchAll(/https?:\/\/[^\s)>"']+/g)) {
    const url = m[0].replace(/[.,]+$/, "");
    let host; try { host = new URL(url).hostname; } catch { continue; }
    if (PROFILE_HOST.test(host)) continue;
    out.push(url);
  }
  return [...new Set(out)];
}

const RULE_LIKE = /\b(must|cannot|can ?not|can only|only|not allowed|never|always|at least|required?|requirements?|within \d+|minimum|subject to|no (logos?|watermarks?|music|ai)|don'?t|do not|banned|prohibited|strike)\b|#[A-Za-z]\w+|(^|\s)@[\w.]{3,}/i;
const NAV = /^(join campaign|join discord|back|discover|solutions|resources|sign in|create account|open menu|skip to content|guidelines|requirements|rules|final rules|how to earn|get paid|account creation|targeting usa|videos|cannot|not allowed|platforms|audience|creator|live)$/i;

// kind, test, group, value. First match wins. Groups:
//   caption  heistclips adds it to the caption (removable)
//   auto     checked against the clip (length against the window, game against the moment)
//   info     a fact about the campaign, nothing to do
//   check    the clipper checks it; shown with its own words
const TABLE = [
  ["exact_caption", /"([^"]{6,140})"\s+in (every|the|your) caption/i, "caption", (m) => m[1]],
  ["name_in_caption", /caption[^.]*must mention ([A-Z][\w.' ]{1,30}?)(?:'s)? name/i, "caption", (m) => m[1].trim()],
  ["disclosure", /#ad\b|#sponsored\b|paid partnership|disclos/i, "caption", () => "#ad"],
  ["hashtag", /hashtag|#[A-Za-z]\w+/i, "caption", (m, line) => [...line.matchAll(/#[A-Za-z]\w+/g)].map((x) => x[0])],
  ["mention", /\btag\b[^.]{0,20}@[\w.]+|always tag|(^|\s)@[\w.]{3,}/i, "caption", (m, line) => [...line.matchAll(/@[\w.]{3,}/g)].map((x) => x[0].replace(/\.$/, ""))],
  ["submit_deadline", /submit[^.]*within\s+(\d+)\s*(minutes?|mins?|hours?)/i, "info", (m) => Number(m[1]) * (/hour/i.test(m[2]) ? 60 : 1)],
  ["platforms", /can only be posted on|post(ed)? (only )?on (tiktok|instagram|youtube)/i, "info", (m, line) => ["tiktok", "instagram", "youtube", "x"].filter((p) => new RegExp(p === "x" ? "\\bx\\b|twitter" : p, "i").test(line))],
  ["min_views", /minimum view requirement[^.]*?\(([\d,]+) views\)|min(?:imum)? views[^\d]{0,20}([\d,]{4,})|minimum ([\d,]{4,}) views/i, "info", (m) => Number((m[1] || m[2] || m[3]).replace(/,/g, ""))],
  ["pool_terms", /total view requirement|share of (the total |approved )?(qualified )?views|standard 3-day hold|only approved views count|no fixed rate|no individual payout cap|effective cpm|post early|volume and quality|pool (is closed|closes)|pending clips are reviewed|revenue share/i, "info", () => null],
  ["pointer", /rules and requirements|payout queues|to help meet|read the rules|requirements are listed|how pool campaigns work|if your approved clips|track it live|you can watch your share|^the math$|always with$|:$/i, "info", () => null],
  ["discord_optional", /join (the |our )?discord|discord\.gg/i, "info", () => null],
  ["length", /\b(\d{1,3})\s?(?:-|–|to)\s?(\d{1,3})\s?(s|sec|secs|seconds)\b|\b(under|max(?:imum)?|no (?:longer|more) than|up to|less than|at least|min(?:imum)?|longer than)\s+(\d{1,3})\s?(s|sec|secs|seconds)\b/i, "auto",
    (m) => (m[1] ? { min: Number(m[1]), max: Number(m[2]) } : /under|max|no |up to|less/i.test(m[4]) ? { min: 0, max: Number(m[5]) } : { min: Number(m[5]), max: 600 })],
  ["game_only", /must be ([A-Z][\w: ]{2,30}?) content|\bonly\b[^.]{0,20}\b(gta ?(vi|6|v|5)|grand theft auto (vi|6|v)|marvel rivals|fortnite)\b/i, "auto", (m) => (m[1] || m[2]).trim()],
  ["cta", /\bcta\b|call to action|drive viewers|directing viewers/i, "caption", () => "cta"],
  ["spoilers", /spoiler/i, "check", () => null],
  ["music", /\b(copyrighted )?(music|songs?)\b/i, "check", () => null],
  ["no_logos", /logos?[^.]*not allowed|no (logos?|watermarks?)|logos of any kind/i, "check", () => null],
  ["tone", /negative light|hate farm|false narrative|drama bait/i, "check", () => null],
  ["primary_focus", /primary focus|must feature/i, "check", () => null],
  ["audience", /audience must|english[- ]speaking|tier[\s-]?1|\b(us|usa|united states)\b[^.]{0,40}\b(audience|viewers|views)\b|\b(audience|viewers)\b[^.]{0,40}\b(usa?|united states)\b/i, "check", () => null],
  ["niche", /\bniche\b/i, "check", () => null],
  ["dedicated_account", /dedicated[^.]{0,20}account|\d+\+? followers|follower (minimum|requirement)|accounts? (required|recommended)/i, "check", () => null],
  ["no_ai", /ai[- ]generated[^.]*not allowed|no ai\b|ai-generated videos/i, "check", () => null],
  ["no_manipulation", /bott?(ing|ed)|manipulat|repost|collab post/i, "check", () => null],
  ["scope_date", /\b(beginning|starting|from|after)\b[^.]{0,12}\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? \d+|\((\w+ \d{4}) onwards\)|recent streams only|old clips/i, "check", () => null],
  ["approval", /pre-?approval|requires? (an )?application|apply first/i, "check", () => null],
  ["use_sound", /use (our|the|this) (sound|audio|song)|with (our|the) (sound|song)|official (sound|audio)/i, "check", () => null],
  ["overlay_required", /(logo|watermark) and username on video|\b(add|include|put)\b[^.]{0,30}\b(logo|watermark)\b/i, "check", () => null],
  ["bio_link", /in (their|your) bios?/i, "check", () => null],
  ["discord", /discord[^.]{0,40}(required|requirement) for payouts?|(required|requirement)[^.]{0,30}payouts?[^.]{0,30}discord/i, "check", () => null],
  ["strike", /one strike|removes you from|\bban\b/i, "check", () => null],
  ["read_all", /read every section|review these requirements|meet every (quality )?standard|read the full brief/i, "info", () => null],
  ["locations", /tag (us )?locations/i, "info", () => null],
  ["rules_elsewhere", /rules here|requirement doc|full rules|full brief|see (the )?guidelines/i, "check", () => null],
];

export function classifyLine(line) {
  for (const [kind, re, group, val] of TABLE) {
    const m = line.match(re);
    if (m) return { kind, group, value: val ? val(m, line) : null };
  }
  return null;
}

const lineId = (campaignId, text) => crypto.createHash("sha1").update(campaignId + "|" + text).digest("hex").slice(0, 10);
const SPLIT = /\n|(?<=[.!?])\s+(?=[A-Z"*])/;

// A rules page often breaks one sentence over several tags ("Videos | cannot | portray Clix in a
// negative light."). Glue short fragments to the next line until a sentence ends.
function sentences(lines) {
  const out = [];
  let buf = "";
  for (const raw of lines) {
    const l = raw.trim();
    if (!l) continue;
    if (NAV.test(l) && !buf) { out.push(l); continue; }
    buf = buf ? (/^[,.;:!?)]/.test(l) ? buf + l : buf + " " + l) : l;
    if (/[.!?:]$/.test(buf) || buf.length > 220 || (!/^[a-z,]/.test(l) && /^[A-Z#@$]/.test(buf) && /[a-z0-9)"']$/.test(buf) && buf.split(" ").length > 6)) { out.push(buf); buf = ""; }
  }
  if (buf) out.push(buf);
  return out;
}

// docs: [{url, lines[] | null, error}]
export function parseRules(campaign, { docs = [] } = {}) {
  const lines = [];
  const seen = new Set();
  const add = (source, text, c) => {
    const key = text.toLowerCase();
    if (seen.has(key)) return; seen.add(key);
    lines.push({ id: lineId(campaign.id, text), source, text, ...c });
  };
  const feed = (source, arr) => {
    for (const raw of arr) {
      const line = raw.trim();
      if (!line || line.length < 4 || line.length > 400 || NAV.test(line)) continue;
      const stripped = line.replace(/https?:\/\/\S+/g, "").trim();
      if (!stripped) continue;
      const c = classifyLine(stripped);
      if (c) add(source, line, c);
      // A line can also fix the game ("GTA 6 marathon"), on top of whatever else it says.
      const g = stripped.match(/\b(gta ?(?:vi|6)|marvel rivals|fortnite)\b[^.]{0,20}\b(playthrough|marathon|clipping|content|moments|pool|streams?)\b/i);
      if (g && c?.kind !== "game_only") add(source, `${line} [game]`, { kind: "game_only", group: "auto", value: /gta/i.test(g[1]) ? "GTA VI" : g[1] });
      else if (!c && RULE_LIKE.test(stripped)) add(source, line, { kind: "unparsed", group: "check", value: null });
    }
  };
  feed("title", [campaign.title || ""]);
  feed("description", (campaign.description || "").split(SPLIT));
  for (const d of docs) {
    if (d.lines) feed(d.url, sentences(d.lines));
    else add(d.url, `Rules document: ${d.url}`, { kind: "unread_doc", group: "check", value: d.error || "could not be read" });
  }
  if (campaign.approval_required) add("campaign", "This campaign reviews applications before you may post", { kind: "approval", group: "check", value: null });

  const f = { hashtags: [], mentions: [], captionText: [], nameInCaption: null, minViews: 0, submitWithinMin: null, disclosure: false, cta: false, length: null, game: null, platforms: campaign.platforms || [] };
  for (const l of lines) {
    if (l.kind === "hashtag") f.hashtags.push(...(l.value || []));
    if (l.kind === "mention") f.mentions.push(...(l.value || []));
    if (l.kind === "exact_caption") f.captionText.push(l.value);
    if (l.kind === "name_in_caption") f.nameInCaption = l.value;
    if (l.kind === "min_views") f.minViews = Math.max(f.minViews, l.value || 0);
    if (l.kind === "submit_deadline") f.submitWithinMin = f.submitWithinMin == null ? l.value : Math.min(f.submitWithinMin, l.value);
    if (l.kind === "disclosure") f.disclosure = true;
    if (l.kind === "cta") f.cta = true;
    if (l.kind === "length" && !f.length) f.length = l.value;
    if (l.kind === "game_only" && !f.game) f.game = l.value;
  }
  // A title that names GTA makes it a GTA campaign even when no line says "only".
  if (!f.game && /\bgta\s?(6|vi)\b|grand theft auto (vi|6)/i.test(campaign.title || "")) f.game = "GTA VI";
  else if (!f.game && /\bgta\b|grand theft auto/i.test(campaign.title || "")) f.game = "GTA";
  f.hashtags = [...new Set(f.hashtags.filter((h) => !/^#ad$/i.test(h)))];
  f.mentions = [...new Set(f.mentions)];
  f.captionText = [...new Set(f.captionText)];
  return { campaign_id: campaign.id, lines, fields: f };
}

export async function fetchText(url, { fetcher = fetch } = {}) {
  const r = await fetcher(url, { headers: { "user-agent": UA, accept: "text/html,text/plain" }, redirect: "follow", signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const type = r.headers.get("content-type") || "";
  if (!/text\/(html|plain)/.test(type)) throw new Error("not a page");
  return { type, text: await r.text() };
}

// The description plus every rules page it links to (one level; a Google Doc shared by link is
// read as plain text). A page that cannot be read becomes a line saying so, never a silent gap.
export async function loadRules(campaign, { fetcher = fetch } = {}) {
  const docs = [];
  const links = ruleLinks(campaign.description || "").map((u) => u.replace(/\?source=copy_link$/, "")).slice(0, 4);
  await Promise.all(links.map(async (url) => {
    const gdoc = url.match(/docs\.google\.com\/document\/d\/([\w-]+)/);
    try {
      if (gdoc) {
        const { text } = await fetchText(`https://docs.google.com/document/d/${gdoc[1]}/export?format=txt`, { fetcher });
        docs.push({ url, lines: text.split(/\n/).map((l) => l.replace(/^[\s*﻿•-]+/, "").trim()).filter(Boolean) });
      } else if (/docs\.google\.com|notion\.(so|site|com)/i.test(url)) docs.push({ url, lines: null, error: "needs a browser to read" });
      else docs.push({ url, lines: htmlToLines((await fetchText(url, { fetcher })).text) });
    } catch (e) { docs.push({ url, lines: null, error: String(e.message || e) }); }
  }));
  return { ...parseRules(campaign, { docs }), docs: docs.map((d) => ({ url: d.url, read: !!d.lines, error: d.error || null })) };
}

export const descHash = (c) => crypto.createHash("sha1").update(String(c.title || "") + "|" + String(c.description || "")).digest("hex").slice(0, 12);
