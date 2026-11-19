import test from "node:test";
import assert from "node:assert/strict";
import { parseRules, htmlToLines, classifyLine, loadRules } from "../lib/rules.js";
import { gameAt, gameFits, shortGame, isGta } from "../public/js/games.js";
import { buildCaption } from "../public/js/campaign.js";
import { persistentFace, boxAround, cornerFor } from "../public/js/facecam.js";
import { submitWindow } from "../lib/postjob.js";

// A reachclipping.com rules page as it reads on 2026-11-19 (Clix GTA VI marathon), trimmed.
const CLIX_PAGE = `<main><h1>$5,000 CLIX GTA VI Marathon Pool Campaign</h1><div>Min Views (MVR)</div><div>400,000</div>
<li>Content must be sourced from any stream, video or clip featuring Clix during his GTA marathon, beginning November 18th, 2026.</li>
<li>Submitted videos must feature Clix as the primary focus of the video.</li>
<li>Videos can only be posted on <b>TikTok</b>, <b>Instagram Reels</b>, <b>YouTube Shorts</b>, and <b>X</b>.</li>
<li>Your caption/text overlay must mention Clix's name</li><li>Your captions must use the hashtag: #Clix</li>
<li>Logos of any kind are <b>not allowed</b>.</li><li>Clips must be 15-60 seconds.</li>
<li>Submit Clix clips within 30 minutes of posting.</li><li>Tag @clixfn in every post.</li><li>Use #ad on every post.</li>
<li>Never repost a clip someone else made, ever, we check.</li></main>`;
const CAMP = { id: "985dc674-c75e", title: "$5,000 Clix GTA VI Marathon Pool Campaign", description: "Clip content from Clix's GTA 6 marathon!\n\nREAD THE RULES AND REQUIREMENTS HERE:\nhttps://reachclipping.com/ClixGTA", platforms: ["tiktok", "youtube"] };

test("rules: a linked rules page becomes checklist fields, read like a person would", async () => {
  const fetcher = async (url) => ({ ok: true, headers: { get: () => "text/html" }, text: async () => (url.includes("reachclipping") ? CLIX_PAGE : "") });
  const r = await loadRules(CAMP, { fetcher });
  const f = r.fields;
  assert.deepEqual(f.hashtags, ["#Clix"]);
  assert.deepEqual(f.mentions, ["@clixfn"]);
  assert.equal(f.nameInCaption, "Clix");
  assert.equal(f.disclosure, true);
  assert.deepEqual(f.length, { min: 15, max: 60 });
  assert.equal(f.game, "GTA VI");
  assert.equal(f.submitWithinMin, 30);
  assert.equal(f.minViews, 400000);
  assert.ok(r.docs[0].read);
  // A rule sentence the parser has no kind for is kept as "check the brief", never dropped.
  assert.ok(r.lines.some((l) => l.group === "check" && /primary focus/.test(l.text)));
  assert.ok(r.lines.some((l) => l.group === "check" && l.kind === "no_logos"));
});

test("rules: a page that cannot be read is a line saying so, not a silent pass", async () => {
  const r = await loadRules(CAMP, { fetcher: async () => ({ ok: false, status: 403, headers: { get: () => "text/html" } }) });
  const u = r.lines.find((l) => l.kind === "unread_doc");
  assert.ok(u && u.group === "check" && /403/.test(u.value));
  assert.equal(r.fields.hashtags.length, 0);
});

test("rules: lengths, games and tags in a description are read; vague text is not a rule", () => {
  assert.deepEqual(classifyLine("Clips must be under 60 seconds").value, { min: 0, max: 60 });
  assert.deepEqual(classifyLine("at least 20 sec long").value, { min: 20, max: 600 });
  assert.equal(classifyLine("Only GTA 6 gameplay, nothing else").kind, "game_only");
  assert.equal(classifyLine("Have fun and post often"), null);
  const r = parseRules({ id: "x", title: "Kai Cenat - $10,000 GTA 6 Pool Campaign", description: "Clip Kai Cenat's GTA 6 streams. You must not use bots or reposts." });
  assert.equal(r.fields.game, "GTA VI");
  assert.ok(r.lines.some((l) => l.kind === "no_manipulation"));
  assert.deepEqual(htmlToLines("<p>Use the <b>hashtag</b> #Kai</p><div>Next</div>"), ["Use the hashtag #Kai", "Next"]);
});

test("game per moment: the chapter at the moment's second, short names, GTA rules", () => {
  const ch = [{ start: 0, end: 685, game: "Just Chatting" }, { start: 685, end: 78603, game: "Grand Theft Auto VI" }, { start: 78603, end: Infinity, game: "Just Chatting" }];
  assert.equal(gameAt(ch, 300), "Just Chatting");
  assert.equal(gameAt(ch, 20000), "Grand Theft Auto VI");
  assert.equal(gameAt(ch, 999999), "Just Chatting");
  assert.equal(shortGame("Grand Theft Auto VI"), "GTA VI");
  assert.equal(shortGame("Grand Theft Auto: San Andreas"), "GTA San Andreas");
  assert.equal(shortGame("Just Chatting"), "Just Chatting");
  assert.equal(gameFits("GTA VI", "Grand Theft Auto VI").ok, true);
  assert.equal(gameFits("GTA VI", "Grand Theft Auto V").ok, false);
  assert.equal(gameFits("GTA VI", "Just Chatting").ok, false);
  assert.equal(gameFits("GTA", "Grand Theft Auto IV").ok, true);
  assert.equal(gameFits("GTA V", "Grand Theft Auto VI").ok, false);
  assert.equal(gameFits("GTA VI", null).ok, null); // unknown is never a pass
  assert.equal(gameFits(null, "Fortnite").ok, true);
  assert.ok(isGta("Grand Theft Auto V") && !isGta("Fortnite"));
});

test("caption: the campaign's tags, mention, name and #ad are added; each one can be taken out", () => {
  const f = { hashtags: ["#Clix"], mentions: ["@clixfn"], captionText: [], nameInCaption: "Clix", disclosure: true, cta: false };
  const on = buildCaption("He did NOT see that coming", f, new Set(), "twitch.tv/clix");
  assert.equal(on, "He did NOT see that coming\nClix\n#ad #Clix @clixfn");
  assert.equal(buildCaption("Clix did not expect this", f, new Set(["#ad"]), "twitch.tv/clix"), "Clix did not expect this\n#Clix @clixfn");
  assert.equal(buildCaption("hook", null, new Set()), "hook");
});

test("facecam: a face has to stay put across frames; the box and the server corner follow it", () => {
  const cam = { x: 0.12, y: 0.16, s: 0.08 }, npc = (i) => ({ x: 0.3 + i * 0.1, y: 0.5, s: 0.2 });
  const per = [0, 1, 2, 3, 4].map((i) => [cam, npc(i)].filter((_, k) => k || i !== 2));
  const f = persistentFace(per, 3);
  assert.ok(f && Math.abs(f.x - 0.12) < 0.01 && f.frames === 4);
  assert.equal(persistentFace([[npc(0)], [npc(1)], [npc(2)]], 3), null);
  const b = boxAround(f);
  assert.ok(b.x <= 0.12 && b.x + b.w >= 0.12 && b.y <= 0.16 && b.y + b.h >= 0.16 && Math.abs(b.w - 0.24) < 0.01);
  assert.equal(cornerFor(f), "tl");
  assert.equal(cornerFor({ x: 0.08, y: 0.54, s: 0.08 }), null); // Kai Cenat's mid-left webcam: no corner holds it
});

test("post_clip: the 30-minute submit window, with the campaign or the campaign list", () => {
  const at = Date.parse("2026-11-19T22:00:00Z");
  const w = submitWindow({ campaigns: [{ title: "$5,000 Clix GTA VI Marathon Pool Campaign", source_url: "https://contentrewards.com/c/campaigns/985dc674", slug: "clix" }], postedAt: at, privacy: "private" });
  assert.equal(w.within_minutes, 30);
  assert.equal(w.deadline, "2026-11-19T22:30:00.000Z");
  assert.equal(w.campaigns[0].submit_url, "https://contentrewards.com/c/campaigns/985dc674");
  assert.match(w.say, /within 30 minutes \(by 22:30 UTC\).*make it public first/);
  const none = submitWindow({ postedAt: at });
  assert.match(none.campaigns_list, /gta-6-clipping-campaigns$/);
  assert.ok(!none.campaigns);
});
