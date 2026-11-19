import test from "node:test";
import assert from "node:assert/strict";
import { localPage, WORDS } from "../lib/pages_l10n.js";
import { GUIDES } from "../lib/guides.js";
import { layout } from "../lib/render.js";

const snap = {
  generated_at: "2026-11-19T17:00:00.000Z",
  summary: { campaigns: 2, gta: 1, gaming: 2, with_track_record: 1, earned_per_clip_median: 4.09, earned_per_clip_p90: 24.5, earned_per_clip_p10: 0.15, rate_per_1k_median: 1.1, cap_median: 200, views_per_clip_median: 3200, budget_left_total: 1710765 },
  campaigns: [{ id: "a-1", slug: "camp-a", title: "Camp A", owner: "Owner", is_gta: true, is_gaming: true, platforms: ["tiktok"], payouts: [], expected_per_clip: 3, rate_per_1k: 2, cap_per_clip: 100, budget_left: 868, days_left: 189, clippers_count: 21, paid_out: 132, requirements: [], approval_required: true, description: "" },
    { id: "b-2", slug: "camp-b", title: "Camp B", owner: "Owner", is_gta: false, is_gaming: true, platforms: ["youtube"], payouts: [], expected_per_clip: null, rate_per_1k: 1, cap_per_clip: 50, budget_left: 500, days_left: 1, clippers_count: 3, paid_out: 0, requirements: [], description: "" }],
  streamers: [{ login: "trymacs", name: "Trymacs", platform: "twitch", live_now: true, viewers_now: 39901, game: "Grand Theft Auto VI" }],
};
const board = [{ id: "s01", title: "Kick support", detail: "Find and cut moments from Kick streams, live or saved.", status: "shipped", by: "Suggested by heistclips", votes: 2, voted: false },
  { id: "r1", title: "Bessere Qualität", detail: "", status: "building", by: "Requested by a clipper", votes: 4, voted: false, response: "On it." }];
const paths = ["/", "/clip", "/pricing", "/requests", "/guides", "/gta-6-clipping-campaigns", "/gta-6-clipping-rates-today", "/twitch-clip-maker", "/kick-clip-maker", "/most-clipped-streams", ...GUIDES.map((g) => "/guides/" + g.slug)];
const trend = { generated_at: "2026-11-19T17:00:00.000Z", window_days: 3, from: "2026-11-17", to: "2026-11-19", clips_counted: 9, streams: [{ platform: "twitch", login: "trymacs", name: "Trymacs", clips: 9, clips_today: 4, clip_path: "/clip?q=trymacs&src=trend" }], moments: [{ platform: "twitch", login: "trymacs", name: "Trymacs", vod: "2932305259", t: 3600, clips: 5, clips_today: 2, title: "GTA", clip_path: "/clip?q=2932305259&t=3600&src=trend" }] };

for (const lang of ["de", "fr", "pt", "es"]) {
  test(`every page renders in ${lang}, tracked, with its alternates, and no English left in the frame`, () => {
    for (const p of paths) {
      const html = localPage(lang, p, { snap, query: new URLSearchParams(""), board, history: [], trend });
      assert.ok(html, p);
      assert.match(html, new RegExp(`<html lang="${lang}">`), p);
      assert.match(html, /\/_vercel\/insights\/script\.js/, p);
      assert.match(html, /posthog\.init/, p);
      assert.equal((html.match(/hreflang=/g) || []).length >= 4, true, p);
      assert.match(html, new RegExp(`<link rel="canonical" href="https://heistclips.com/${lang}`), p);
      const main = html.slice(html.indexOf("<main"), html.indexOf("</main>"));
      for (const en of ["typical per clip", "Find moments", "Updated ", "per 1,000 views", "Request it", "Buy 50 clips", "Suggested by heistclips", "apply first"]) assert.equal(main.includes(en), false, `${p}: "${en}"`);
    }
    assert.equal(localPage(lang, "/about", { snap, query: new URLSearchParams("") }), null); // English only: the router redirects
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
  const about = layout({ title: "t", desc: "d", path: "/about", body: "<h1>x</h1>" });
  assert.doesNotMatch(about, /hreflang|class="langs/); // no translation: no switch, no redirect
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
