// A campaign's rules as a checklist, and a caption that carries the tags they require. Read off
// the public brief only (what a clipper sees before joining). Every rule sentence the parser
// understands becomes a line with what to do; a sentence that reads like a rule but matches
// nothing is "check the brief", never a guess; rules that open only after joining are named as
// such. Ported from the clip desk (heistclips-desk desk/rules.js and desk/captions.js,
// 2026-11-19) and reworded for a clipper instead of our own channel.
import { lengthRule } from "./autopilot.js";

const RULE_LIKE = /\b(must|cannot|can ?not|can only|only|not allowed|never|always|at least|required?|requirements?|within \d+|minimum|subject to|no (logos?|watermarks?|music|ai)|don'?t|do not|banned|prohibited|strike)\b|#[A-Za-z]\w+|(^|\s)@[\w.]{3,}/i;

// [kind, test, status, what to do]. First match wins. Status: done (the plan already did it),
// fine (true of every heistclips cut), you (a person must do or decide it), brief (read the brief).
const TABLE = [
  ["ai_video", /creative ai videos|ai[- ]generated videos? (where|of|featuring)/i, "you", () => "Wants made-up AI videos about a product, not stream clips. A stream clip will not be approved here."],
  ["overlay", /(logo|watermark) and username on video|\b(add|include|put)\b[^.]{0,30}\b(logo|watermark)\b/i, "you", () => "Needs their logo or your username on the video; heistclips does not add one. Add it in your editor."],
  ["use_sound", /use (our|the|this) (sound|audio|song)|with (our|the) (sound|song)/i, "you", () => "Needs their sound on the clip: add it in the TikTok app when you post."],
  ["dedicated", /accounts? must be (branded|themed|dedicated)|not dedicated to[^.]*reject|dedicated accounts are required|dedicated[^.]{0,20}account|\d+\+? followers|follower (minimum|requirement)/i, "you", () => "Wants a dedicated or established account. Check yours qualifies before you post."],
  ["bio_link", /in (their|your) bios?/i, "you", () => "A link must be in your channel bio before a clip is paid."],
  ["discord", /discord[^.]{0,40}(required|requirement) for payouts?|(required|requirement)[^.]{0,30}payouts?[^.]{0,30}discord/i, "you", () => "Joining their Discord is required for payouts."],
  ["discord_optional", /join (the |our )?discord|discord\.gg/i, null, null],
  ["exact_caption", /"([^"]{6,140})"\s+in (every|the|your) caption/i, "done", (m) => `Caption must say "${m[1]}": it is in the caption below.`],
  ["name_in_caption", /caption[^.]*must mention ([A-Z][\w.' ]{1,30}?)(?:'s)? name/i, "done", (m) => `Caption must name ${m[1].trim()}: it does.`],
  ["disclosure", /#ad\b|#sponsored\b|paid partnership|disclos/i, "done", () => "Disclose it as an ad: #ad is first in the caption. Turn on the platform's paid-partnership label too if it asks."],
  ["hashtag", /hashtag|#[A-Za-z]\w+/i, "done", (m, line) => { const t = [...line.matchAll(/#[A-Za-z]\w+/g)].map((x) => x[0]); return t.length ? `Required tags ${t.join(" ")}: in the caption below.` : "A hashtag is required: the brief names it after you join. Check the brief."; }],
  ["mention", /\btag\b[^.]{0,20}@[\w.]+|always tag|(^|\s)@[\w.]{3,}/i, "done", (m, line) => `Tag ${[...line.matchAll(/@[\w.]{3,}/g)].map((x) => x[0].replace(/\.$/, "")).join(" ")}: in the caption below.`],
  ["platforms", /can only be posted on|post(ed)? (only )?on (tiktok|instagram|youtube)/i, "you", (m, line) => `Post only where it says: ${line.slice(0, 140)}`],
  ["min_views", /minimum view requirement[^.]*?\(([\d,]+) views\)|min(?:imum)? views[^\d]{0,20}([\d,]{4,})|minimum ([\d,]{4,}) views/i, "you", (m) => `The brief sets a minimum of ${(m[1] || m[2] || m[3])} views.`],
  ["scope_date", /\b(beginning|starting|from|after)\b[^.]{0,12}\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? \d+|\((\w+ \d{4}) onwards\)/i, "you", () => "Only certain streams or dates count: check the stream you clip is one of them."],
  ["own_streams", /must be (sourced )?from [^.]{0,40}(twitch )?(live)?streams?|must contain|only featuring/i, "fine", () => "Clip the named streamer's own stream: these moments are from it."],
  ["audience", /audience must|english[- ]speaking|tier[\s-]?1|\b(us|usa|united states)\b[^.]{0,40}\b(audience|viewers|views)\b|\b(audience|viewers)\b[^.]{0,40}\b(usa?|united states)\b/i, "you", () => "Only views from certain countries or languages count. Check your audience in your analytics."],
  ["no_ai", /ai[- ]generated[^.]*not allowed|no ai\b/i, "fine", () => "No AI-made video: a heistclips cut is the real stream."],
  ["no_logos", /logos?[^.]*not allowed|no (logos?|watermarks?)/i, "fine", () => "No watermark or logo: heistclips adds none."],
  ["no_repost", /bott?(ing|ed)|manipulat|repost|collab post/i, "you", () => "No bought views, reposts or collab posts."],
  ["tone", /negative light|hate farm|false narrative/i, "you", () => "Do not show the streamer in a bad light: pick a moment and title that are fair to them."],
  ["focus", /primary focus|must feature/i, "you", () => "The streamer must be the focus of the clip."],
  ["game", /must be ([A-Z][\w: ]{2,30}?) content|\bonly\b[^.]{0,20}\b(gta ?(vi|6)|marvel rivals|fortnite)\b/i, "done", (m) => `Only ${(m[1] || m[2]).trim()} content: the moments are from streams in that game.`],
  ["cta", /\bcta\b|call to action|drive viewers|directing viewers/i, "done", () => "A call to action is wanted: the caption sends viewers to the stream."],
  ["length", /\b(\d{1,3})\s?(?:-|to)\s?(\d{1,3})\s?(s|sec|seconds)\b|\b(under|max(?:imum)?|at least|min(?:imum)?)\s+(\d{1,3})\s?(s|sec|seconds)\b/i, "done", () => "Length rule: each cut below is trimmed to fit it."],
  ["spoilers", /spoiler/i, "done", () => "No story spoilers: moments that look like spoilers are left out."],
  ["music", /\b(copyrighted )?(music|songs?)\b/i, "done", () => "No licensed music: moments where Twitch muted music are left out; check music_risk on the rest."],
  ["pointer", /rules and requirements|read the rules|requirements are listed|full rules|^the math$|:$/i, null, null],
];

function classify(line) {
  for (const [kind, re, status, what] of TABLE) {
    const m = line.match(re);
    if (m) return { kind, status, text: what ? what(m, line) : null };
  }
  return null;
}

const sentences = (d) => String(d || "").split(/\n|(?<=[.!?])\s+(?=[A-Z"*])/).map((s) => s.replace(/https?:\/\/\S+/g, "").trim()).filter((s) => s.length >= 4 && s.length <= 400);

// c: a normalized campaign (lib/campaigns.js). Returns the checklist and what the caption needs.
export function checklist(c) {
  const items = [], seen = new Set();
  const add = (rule, status, text) => { const k = rule + "|" + text; if (seen.has(k)) return; seen.add(k); items.push({ rule, status, text }); };
  const need = { hashtags: [], mentions: [], captionText: [], nameInCaption: null, disclosure: false, length: lengthRule(c.description), spoilersBanned: /spoiler/i.test(c.description || ""), gtaOnly: !!c.is_gta };
  for (const s of sentences(c.description)) {
    const k = classify(s);
    // One sentence can ask for both ("include #x and tag @x"): read both out of either kind.
    if (k && (k.kind === "hashtag" || k.kind === "mention")) {
      need.hashtags.push(...[...s.matchAll(/#[A-Za-z]\w+/g)].map((x) => x[0]));
      need.mentions.push(...[...s.matchAll(/(?:^|\s)(@[\w.]{3,})/g)].map((x) => x[1].replace(/\.+$/, "")));
    }
    if (k && k.kind === "exact_caption") need.captionText.push(s.match(/"([^"]{6,140})"/)[1]);
    if (k && k.kind === "name_in_caption") need.nameInCaption = k.text.match(/name (.+?):/)[1];
    if (k && k.kind === "disclosure") need.disclosure = true;
    if (k && k.status) add(k.kind, k.status, k.text);
    else if (!k && RULE_LIKE.test(s)) add("unparsed", "brief", `Check the brief: "${s.slice(0, 160)}"`);
  }
  need.hashtags = [...new Set(need.hashtags.filter((h) => !/^#ad$/i.test(h)))];
  need.mentions = [...new Set(need.mentions)];
  // From the campaign's own record, not its words.
  if (c.is_gta && !items.some((i) => i.rule === "game")) add("game", "done", "GTA campaign: the moments are from GTA streams. Check the stream was GTA if a moment says otherwise.");
  if (c.approval_required) add("apply_first", "you", "Apply on Content Rewards and wait to be accepted before you post.");
  if (c.hidden_references > 0 || c.hidden_rules > 0) add("hidden_rules", "brief", `${c.hidden_references || c.hidden_rules} rule file${(c.hidden_references || c.hidden_rules) === 1 ? "" : "s"} open only after you join (often the required tag): check the brief.`);
  else if (c.hidden_references == null) add("hidden_rules", "brief", "Rules that open after you join were not read: check the brief.");
  if ((c.requirements || []).includes("tags/caption rule") && !need.hashtags.length && !need.mentions.length) add("tags", "brief", "The brief asks for tags we could not read: check the brief before you post.");
  add("platforms", "fine", `Pays on ${(c.platforms || []).join(", ")}.`);
  return { items, need };
}

const tagOf = (name) => "#" + String(name || "").replace(/[^A-Za-z0-9]/g, "");
const BANNED = /rockstar|take[- ]two/i;
const clean = (s, max) => { let t = String(s || "").replace(/[—–]/g, ", ").replace(/\s+/g, " ").trim(); if (t.length > max) t = t.slice(0, max - 1).replace(/\s+\S*$/, ""); return t; };

// One caption: the hook, where the clip is from, the text and tags the campaign requires, then
// tags platforms group by. Required tags are added by code, never left to whoever posts it.
export function captionFor({ hook, streamer, need, platform = "twitch" }) {
  const name = streamer.name || streamer.login;
  const watch = platform === "kick" ? `kick.com/${streamer.login}` : `twitch.tv/${streamer.login}`;
  const tags = [...(need.disclosure ? ["#ad"] : []), ...need.hashtags, tagOf(name), ...(need.gtaOnly ? ["#gta6", "#gtavi"] : []), "#clips"];
  const seen = new Set();
  const uniq = tags.filter((t) => { const k = t.toLowerCase(); if (t.length < 2 || seen.has(k)) return false; seen.add(k); return true; });
  let title = clean(BANNED.test(hook || "") ? "" : hook, 90) || `${name} on stream`;
  if (need.nameInCaption && !new RegExp(need.nameInCaption.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(title)) title = clean(`${need.nameInCaption}: ${title}`, 90);
  const lines = [title, `Clipped from ${name}'s stream. Watch live: ${watch}`, ...need.captionText, need.mentions.join(" "), uniq.join(" ")].filter(Boolean);
  return { caption: lines.join("\n"), tags: uniq };
}
