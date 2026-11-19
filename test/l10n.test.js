import test from "node:test";
import assert from "node:assert/strict";
import { localPage, notFoundPage, localLinks, WORDS } from "../lib/pages_l10n.js";
import { GUIDES } from "../lib/guides.js";
import { layout } from "../lib/render.js";
import { isLocal } from "../lib/i18n.js";

const snap = {
  generated_at: "2026-11-19T17:00:00.000Z",
  summary: { campaigns: 2, gta: 1, gaming: 2, with_track_record: 1, earned_per_clip_median: 4.09, earned_per_clip_p90: 24.5, earned_per_clip_p10: 0.15, rate_per_1k_median: 1.1, cap_median: 200, views_per_clip_median: 3200, budget_left_total: 1710765 },
  campaigns: [{ id: "a-1", slug: "camp-a", title: "Camp A", owner: "Owner", is_gta: true, is_gaming: true, platforms: ["tiktok"], payouts: [{ platform: "tiktok", rate_per_1k: 2, cap_per_clip: 100, min_payout: null }], expected_per_clip: 3, rate_per_1k: 2, cap_per_clip: 100, budget_left: 868, budget_total: 1000, budget_spent: 132, days_left: 1.5, clippers_count: 21, approved_clips: 40, total_views: 66000, views_per_clip: 1650, avg_per_clip: 3.3, earned_per_clip: 3, clips_7d: 12, views_7d: 9000, top_clip_views: 21000, paid_out: 132, requirements: ["length rule", "US audience"], approval_required: true, geo_priced: true, source_url: "https://contentrewards.com/c/campaigns/a-1", categories: [], description: "Post the clip.\nKeep it under 60 s.",
    payout_type: "cpm", settings_read: true, hidden_references: 2, floor: { known: true, min_views_per_clip: 10000, pool_total_views: null, by_platform: { tiktok: 10000 } },
    at_size: { new: { usd: 0, avg: 0.5, chance: 0.05 }, "5k": { usd: 0, avg: 3, chance: 0.35 }, "50k": { usd: 100, avg: 90, chance: 0.85 } } },
    { id: "b-2", slug: "camp-b", title: "Camp B", owner: "Owner", is_gta: false, is_gaming: true, platforms: ["youtube"], payouts: [], expected_per_clip: null, rate_per_1k: 1, cap_per_clip: 50, budget_left: 500, days_left: 1, clippers_count: 3, paid_out: 0, requirements: [], description: "" }],
  streamers: [{ login: "trymacs", name: "Trymacs", platform: "twitch", live_now: true, viewers_now: 39901, game: "Grand Theft Auto VI" }],
};
const board = [{ id: "s01", title: "Kick support", detail: "Find and cut moments from Kick streams, live or saved.", status: "shipped", by: "Suggested by heistclips", votes: 2, voted: false },
  { id: "r1", title: "Bessere Qualität", detail: "", status: "building", by: "Requested by a clipper", votes: 4, voted: false, response: "On it." }];
const paths = ["/", "/clip", "/pricing", "/requests", "/guides", "/gta-6-clipping-campaigns", "/gta-6-clipping-rates-today", "/twitch-clip-maker", "/kick-clip-maker", "/most-clipped-streams", "/whats-new", ...GUIDES.map((g) => "/guides/" + g.slug),
  "/queue", "/streamers", "/data", "/connect", "/about", "/privacy", "/terms", "/campaigns/camp-a", "/campaigns/old-camp-0badc0de", "/campaigns/gone-0badc0de", "/streamers/trymacs", "/streamers/kick/tjr"];
// What the router looks up for a page about one record (api/page.js).
const endedRec = { ended_at: "2026-11-18T10:00:00.000Z", last_seen: "2026-11-18T09:30:00.000Z", why: "budget", campaign: { id: "0badc0de-1", slug: "old-camp-0badc0de", title: "Old Camp", owner: "Owner", rate_per_1k: 1, cap_per_clip: 50, budget_total: 500, budget_spent: 500, approved_clips: 1200, clippers_count: 30, earned_per_clip: 2.1, is_gta: true, is_gaming: true } };
const chan = { name: "Trymacs", avatar: "", is_live: true, stream: { viewers: 39901, game: "Grand Theft Auto VI", title: "GTA 6 TAG 1" }, vods: [{ id: "2932305259", title: "", game: "Grand Theft Auto VI", length: 14400, created_at: "2026-11-18T12:00:00Z", status: "RECORDING" }] };
const record = (p) => (p === "/campaigns/camp-a" ? { campaign: snap.campaigns[0] } : p === "/campaigns/old-camp-0badc0de" ? { ended: endedRec } : p === "/campaigns/gone-0badc0de" ? { ended: { slug: "gone-0badc0de" } }
  : p === "/streamers/trymacs" ? { streamer: { row: { ...snap.streamers[0], peak_viewers: 51000 }, chan, camps: [snap.campaigns[0]], trend } } : p === "/streamers/kick/tjr" ? { streamer: { row: { login: "tjr", name: "TJR", platform: "kick" }, chan: null, camps: [], trend: null } } : {});
const tools = [{ name: "rank_clipping_campaigns", title: "Which clipping campaign pays most" }, { name: "a_tool_added_later", title: "Shows in English until translated" }];
// English that must never show inside a translated page (frame, chrome and labels; not a campaign's own words).
const ENGLISH = ["typical per clip", "Find moments", "Updated ", "per 1,000 views", "Request it", "Buy 50 clips", "Suggested by heistclips", "apply first",
  "length rule", "US audience", "Campaigns", "approved clip", "The brief", "Watch for", "Join on", "Ended", "no longer", "How to clip", "Offline right now", "Recent streams", "recording now", "watching",
  "Live now", "Recently live", "Field", "Meaning", "Free to use", "Watch another", "Paying right now", "needs JavaScript", "Who runs it", "is a tool", "collects as little", "Server URL", "Nothing here", "Back to the clip tool", "Post it to YouTube",
  // pay at your size (lib/sizeview.js)
  "likely for a new account", "of your clips pays", "Pays nothing", "Your clips get", "Can pay me now", "Pays most per clip", "What a clip pays", "Floor unknown", "minimum payout", "rule file", "New account", "views a clip"];
const trend = { generated_at: "2026-11-19T17:00:00.000Z", window_days: 3, from: "2026-11-17", to: "2026-11-19", clips_counted: 9, streams: [{ platform: "twitch", login: "trymacs", name: "Trymacs", clips: 9, clips_today: 4, clip_path: "/clip?q=trymacs&src=trend" }], moments: [{ platform: "twitch", login: "trymacs", name: "Trymacs", vod: "2932305259", t: 3600, clips: 5, clips_today: 2, title: "GTA", clip_path: "/clip?q=2932305259&t=3600&src=trend" }] };

for (const lang of ["de", "fr", "pt", "es"]) {
  test(`every page renders in ${lang}, tracked, with its alternates, and no English left in the frame`, () => {
    for (const p of paths) {
      const html = localPage(lang, p, { snap, query: new URLSearchParams(""), board, history: [], trend, tools, ...record(p) });
      assert.ok(html, p);
      assert.match(html, new RegExp(`<html lang="${lang}">`), p);
      assert.match(html, /\/_vercel\/insights\/script\.js/, p);
      assert.match(html, /posthog\.init/, p);
      assert.equal((html.match(/hreflang=/g) || []).length >= 4, true, p);
      assert.match(html, new RegExp(`<link rel="canonical" href="https://heistclips.com/${lang}`), p);
      const main = html.slice(html.indexOf("<main"), html.indexOf("</main>"));
      for (const en of ENGLISH) assert.equal(main.replace(/<blockquote class="brief"[\s\S]*?<\/blockquote>/, "").replace(/Shows in English until translated/, "").includes(en), false, `${p}: "${en}"`);
      // every link inside the page that has a translation points at it
      for (const m of main.matchAll(/(?:href|action)="(\/[^"?#]*)/g)) assert.equal(isLocal(m[1]) && !m[1].startsWith("/" + lang), false, `${p}: link to English ${m[1]}`);
      assert.doesNotMatch(main, /Rockstar/, p);
      if (p !== "/requests") assert.doesNotMatch(main, /—/, p + ": em dash"); // the board joins status and reply with one
    }
    assert.equal(localPage(lang, "/for/xqc", { snap, query: new URLSearchParams("") }), null); // English only: the router redirects
    assert.equal(localPage(lang, "/campaigns/unknown", { snap, query: new URLSearchParams("") }), null); // no record: the router sends the 404
    const nf = notFoundPage(lang);
    assert.match(nf, new RegExp(`<html lang="${lang}">`)); assert.match(nf, /noindex/); assert.match(nf, new RegExp(`<a href="/${lang}">`));
    // legal pages keep every link the English page has, and say which version governs
    const priv = localPage(lang, "/privacy", { snap, query: new URLSearchParams("") }), terms = localPage(lang, "/terms", { snap, query: new URLSearchParams("") });
    for (const url of ["https://developers.google.com/terms/api-services-user-data-policy", "https://myaccount.google.com/permissions", "https://www.youtube.com/t/terms", "https://policies.google.com/privacy", `href="/${lang}/post"`, "https://heistclips.com/privacy?lang=en"]) assert.ok(priv.includes(url), "privacy: " + url);
    for (const url of ["https://www.youtube.com/t/terms", "https://policies.google.com/privacy", "https://security.google.com/settings/security/permissions", `href="/${lang}/post"`, "https://heistclips.com/terms?lang=en", "aidan@brickandmortar.dev"]) assert.ok(terms.includes(url), "terms: " + url);
    assert.equal((priv.match(/<li>/g) || []).length, 9); assert.equal((terms.match(/<li>/g) || []).length, 6);
    // the home page carries the fourth card, in the 2x2 block the English home uses
    const homeHtml = localPage(lang, "/", { snap, query: new URLSearchParams("") });
    assert.match(homeHtml, /<section class="three four">/); assert.equal((homeHtml.match(/<h3>/g) || []).length, 4);
    assert.match(homeHtml, new RegExp(`href="/${lang}/post"`));
    // a campaign's own words stay as written
    assert.match(localPage(lang, "/campaigns/camp-a", { snap, query: new URLSearchParams(""), campaign: snap.campaigns[0] }), /Post the clip\.<br>Keep it under 60 s\./);
  });
}

test("a post on the board shows as written; a launch item heistclips seeded is translated", () => {
  const de = localPage("de", "/requests", { snap, query: new URLSearchParams(""), board });
  assert.match(de, /Bessere Qualität/);
  assert.match(de, /Kick-Unterstützung/);
  assert.match(de, /In Arbeit<\/b> — On it\./);
  assert.match(localPage("pt", "/requests", { snap, query: new URLSearchParams(""), board }), /Suporte à Kick/);
});

test("every language carries the same set of words", () => {
  const keys = (o, pre = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof RegExp) ? keys(v, pre + k + ".") : [pre + k]));
  for (const l of ["fr", "pt", "es"]) assert.deepEqual(keys(WORDS[l]).sort(), keys(WORDS.de).sort(), l);
});

test("every rule for what the clip tool writes has all four languages", async () => {
  const src = (await import("node:fs")).readFileSync(new URL("../public/js/l10n.js", import.meta.url), "utf8");
  const rules = src.slice(src.indexOf("const RULES = ["), src.indexOf("export function tr("));
  const strings = (rules.match(/[^(]\{ de: /g) || []).length, builders = (rules.match(/by\(\{/g) || []).length;
  assert.ok(strings + builders > 120, "rules found: " + (strings + builders));
  for (const l of ["fr", "pt", "es"]) assert.equal((rules.match(new RegExp(`[ {,]${l}: `, "g")) || []).length, strings + builders, l);
});

test("English pages advertise the translations and pick the visitor's language once", () => {
  const html = layout({ title: "t", desc: "d", path: "/pricing", body: "<h1>x</h1>" });
  assert.match(html, /hreflang="de" href="https:\/\/heistclips\.com\/de\/pricing"/);
  assert.match(html, /hreflang="x-default" href="https:\/\/heistclips\.com\/pricing"/);
  assert.match(html, /localStorage\.getItem\("hc_lang"\)/);
  assert.match(html, /<select class="langs"/);
  assert.match(html, /class="langs-foot"/);
  assert.match(html, /hreflang="pt" href="https:\/\/heistclips\.com\/pt\/pricing"/);
  const pitch = layout({ title: "t", desc: "d", path: "/for/xqc", body: "<h1>x</h1>" });
  assert.doesNotMatch(pitch, /hreflang|class="langs/); // no translation: no switch, no redirect
});

test("the clip tool's words: German and French for what the tool writes, chat and unknown lines left alone", async () => {
  for (const [lang, want] of [["de", ["Noch 3 Gratis-Clips + 50 gekauft", "12 Momente aus 4:02:32 Stream, in 8 s. Der Live-Chat wird weiter beobachtet.", "Musik-Risiko: hoch"]], ["fr", ["3 clips gratuits restants + 50 payés", "12 moments sur 4:02:32 de stream, en 8 s. On continue de suivre le chat en live.", "risque musique : élevé"]],
    ["pt", ["3 clipes grátis restantes + 50 pagos", "12 momentos em 4:02:32 de live, em 8 s. O chat ao vivo continua sendo acompanhado.", "risco de música: alto"]], ["es", ["Te quedan 3 clips gratis + 50 de pago", "12 momentos en 4:02:32 de directo, en 8 s. Seguimos atentos al chat en vivo.", "riesgo de música: alto"]]]) {
    globalThis.document = { documentElement: { lang }, querySelector: () => null };
    const { tr } = await import("../public/js/l10n.js?" + lang);
    assert.equal(tr("3 free clips left + 50 paid"), want[0]);
    assert.equal(tr("12 moments from 4:02:32 of stream, in 8 s. Watching live chat for new ones."), want[1]);
    assert.equal(tr(" music risk: high "), " " + want[2] + " ");
    assert.equal(tr("some line nobody listed"), "some line nobody listed");
    delete globalThis.document;
  }
});

test("hook lines burned into the clip follow the page language", async () => {
  const { hooks } = await import("../public/js/twitch.js");
  const m = { event_type: "funny", chat_ratio: 5, phrase: null };
  assert.match(hooks(m, "Trymacs", "de")[0], /NICHT vorbereitet/);
  assert.match(hooks(m, "Squeezie", "fr")[0], /PAS prêt/);
  assert.match(hooks(m, "alanzoka", "pt")[0], /NÃO estava pronto/);
  assert.match(hooks(m, "IlloJuan", "es")[0], /NO estaba listo/);
  assert.match(hooks(m, "xQc")[0], /NOT ready/);
});

test("the /post page: same buttons and gates in every language, only the words change", async () => {
  process.env.HC_STORE = "memory";
  const { default: handler } = await import("../api/v1/post.js");
  const get = async (url) => { const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(b) { this.body = b; } }; await handler({ method: "GET", url, headers: {} }, res); return res.body; };
  const en = await get("/api/v1/post");
  const attrs = (html) => (html.match(/data-(?:connect|disconnect|closed|state|provider|open)(?:="[^"]*"|='[^']*')?(?: hidden)?/g) || []).join("|");
  assert.match(en, /<h1>Post clips to YouTube and TikTok<\/h1>/);
  for (const [lang, h1] of [["de", "Clips auf YouTube und TikTok posten"], ["fr", "Poste tes clips sur YouTube et TikTok"], ["pt", "Poste clipes no YouTube e no TikTok"], ["es", "Publica clips en YouTube y TikTok"]]) {
    const html = await get("/api/v1/post?lang=" + lang);
    assert.match(html, new RegExp(`<html lang="${lang}">`)); assert.ok(html.includes(`<h1>${h1}</h1>`), lang);
    assert.equal(attrs(html), attrs(en), lang);
    assert.match(html, new RegExp(`<link rel="canonical" href="https://heistclips.com/${lang}/post">`));
    assert.match(html, /\/js\/l10n\.js\?v=\d+"><\/script><script type="module" src="\/js\/post\.js/);
    assert.match(html, new RegExp(`href="/${lang}/privacy"`));
    const main = html.slice(html.indexOf("<main"), html.indexOf("</main>"));
    for (const x of ["Connect ", "Disconnect", "Not open yet", "How it works", "Loading"]) assert.equal(main.includes(x), false, lang + ": " + x);
  }
  assert.equal(await get("/api/v1/post?lang=xx"), en);
});

test("mail and push words exist in every language and keep the links", async () => {
  process.env.CREDIT_SALT = "t";
  const W = await import("../lib/watch.js");
  const w = { k: "kkkkkkkkkkkkkkkkkkkkkkkk", notify: { email: "a@b.co", lang: "de" } };
  const c = W.confirmMail(w, "a@b.co");
  assert.match(c.subject, /Warteschlange/); assert.match(c.text, /\/queue\?k=kkkk[^\s]*&confirm=/); assert.match(c.html, /Bestätigen/);
  const items = [{ channel_name: "Trymacs", hook: "ER WAR NICHT BEREIT", match: { title: "Camp A", expected_per_clip: 3 } }, { channel_name: "Trymacs", hook: "x", match: null }];
  const r = W.readyMail(w, items);
  assert.equal(r.subject, "2 neue Clips fertig: Trymacs"); assert.match(r.text, /mail=off/); assert.match(r.html, /typisch \$3 pro Clip/);
  const en = W.readyMail({ ...w, notify: { email: "a@b.co" } }, items);
  assert.equal(en.subject, "2 new clips ready: Trymacs"); assert.match(en.text, /\$3 typical per clip/);
  for (const l of ["fr", "pt", "es"]) { const m = W.readyMail({ ...w, notify: { email: "a@b.co", lang: l } }, items); assert.notEqual(m.subject, en.subject, l); assert.match(m.html, /mail=off/); }
});

test("the autopilot queue and the post page: what their scripts write, in all four languages", async () => {
  const want = {
    de: ["· $7,957 übrig · 1 Clipper", "Zahlt für Clips von threadguy", "✓ 38 s passt zu 15–60 s", "Noch 3 Gratis-Clips + 5 gekauft · Account-Code für Claude:", "YouTube neu verbinden", "· GTA VI · vor 5 Min. ·", "Mitte links"],
    fr: ["· $7,957 restants · 1 clippeur", "Paie pour les clips de threadguy", "✓ 38 s, dans les 15–60 s", "3 clips gratuits restants + 5 payés · Code de compte pour Claude :", "Reconnecter YouTube", "· GTA VI · il y a 5 min ·", "au milieu à gauche"],
    pt: ["· $7,957 restantes · 1 clipador", "Paga por clipes de threadguy", "✓ 38 s cabe em 15–60 s", "3 clipes grátis restantes + 5 pagos · Código da conta para o Claude:", "Reconectar YouTube", "· GTA VI · há 5 min ·", "no meio à esquerda"],
    es: ["· quedan $7,957 · 1 clipper", "Paga por clips de threadguy", "✓ 38 s entra en 15–60 s", "Te quedan 3 clips gratis + 5 de pago · Código de cuenta para Claude:", "Reconectar YouTube", "· GTA VI · hace 5 min ·", "en medio a la izquierda"],
  };
  const en = ["· $7,957 left · 1 clipper", "Pays for threadguy clips", "✓ 38 s fits 15–60 s", "3 free clips left + 5 paid · Account code for Claude:", "Reconnect YouTube", "· GTA VI · 5 min ago ·", "middle left"];
  for (const lang of Object.keys(want)) {
    globalThis.document = { documentElement: { lang }, querySelector: () => null };
    const { tr } = await import("../public/js/l10n.js?q" + lang);
    en.forEach((line, i) => assert.equal(tr(line), want[lang][i], lang));
    // a hook line, a chat quote or a campaign title that matches no rule is left exactly as written
    assert.equal(tr("threadguy just pulled THIS off"), "threadguy just pulled THIS off");
    delete globalThis.document;
  }
});

test("every connector tool listed on /connect has its line in every language", async () => {
  const { TOOLS } = await import("../api/mcp.js");
  for (const l of ["de", "fr", "pt", "es"]) for (const t of TOOLS) assert.ok(WORDS[l].connect.tools[t.name], l + ": " + t.name + " (add it under connect.tools in lib/l10n_" + l + ".js)");
});
