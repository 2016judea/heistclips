import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { entries, latest, latestEntries, newMarker, shippedLink, boardAllLink, feedXml, llmsText, TYPES, FILE } from "../lib/changelog.js";
import { whatsNewPage, whatsNewFeed, WORDS, TOP } from "../lib/changelogpage.js";
import { localPage } from "../lib/pages_l10n.js";
import { layout, requestCard } from "../lib/render.js";
import { sitemapUrls } from "../api/page.js";

const LANGS = ["en", "de", "fr", "pt", "es"];

test("every entry is complete, in every language, in a clipper's words", () => {
  const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
  assert.ok(raw.length >= 10);
  assert.equal(new Set(raw.map((e) => e.id)).size, raw.length, "ids are unique");
  assert.equal(entries().length, raw.length, "no entry is dropped as malformed");
  for (const e of raw) {
    assert.match(e.id, /^[a-z0-9-]{3,60}$/, e.id);
    assert.match(e.date, /^\d{4}-\d{2}-\d{2}$/, e.id);
    assert.ok(TYPES.includes(e.type), e.id);
    const texts = [e.title, e.body, ...Object.values(e.langs || {}).flatMap((t) => [t.title, t.body])];
    for (const s of texts) {
      assert.ok(s && s.trim(), e.id);
      assert.doesNotMatch(s, /[—–]/, `${e.id}: no dashes as punctuation`);
      assert.doesNotMatch(s, /rockstar/i, e.id);
      assert.doesNotMatch(s, /tiktok/i, `${e.id}: TikTok posting is not open, do not announce it`);
    }
    assert.ok(e.title.length <= 90 && e.body.length <= 320, e.id);
    if (e.link) assert.match(e.link, /^(\/|https:\/\/)/, e.id);
  }
  // Newest day first.
  const dates = entries().map((e) => e.date);
  assert.deepEqual(dates, dates.slice().sort().reverse());
});

test("the page renders in all five languages: dated, tracked, newest day open, older days folded", () => {
  for (const lang of LANGS) {
    const html = lang === "en" ? whatsNewPage("en") : localPage(lang, "/whats-new", { snap: {}, query: new URLSearchParams("") });
    assert.match(html, new RegExp(`<html lang="${lang}">`), lang);
    assert.match(html, new RegExp(`<link rel="canonical" href="https://heistclips.com${lang === "en" ? "" : "/" + lang}/whats-new">`), lang);
    assert.equal((html.match(/hreflang=/g) || []).length >= 6, true, lang);
    assert.match(html, /\/_vercel\/insights\/script\.js/, lang);
    assert.match(html, /application\/atom\+xml/, lang);
    assert.match(html, /"@type":"Blog"/, lang);
    assert.match(html, /"@type":"ItemList"/, lang);
    assert.match(html, new RegExp(`href="${lang === "en" ? "" : "/" + lang}/requests"`), lang); // "Got an idea or a bug? Tell us"
    const main = html.slice(html.indexOf("<main"), html.indexOf("</main>"));
    const open = main.slice(0, main.indexOf("<details"));
    assert.equal((open.match(/<li id=/g) || []).length, Math.min(TOP, entries().filter((e) => e.date === latest().date).length), lang);
    assert.equal((main.match(/<li id=/g) || []).length, entries().length, lang);
    assert.doesNotMatch(main, /[—–]/, lang);
    assert.match(html, new RegExp(String(new Date(latest().date + "T12:00:00Z").getUTCFullYear())), lang); // dated title
    if (lang !== "en") for (const en of ["Try it", "You asked for this", "Fixed<", "Improved<", ">What’s new<"]) assert.equal(main.includes(en), false, `${lang}: "${en}"`);
  }
  const keys = (o, pre = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? keys(v, pre + k + ".") : [pre + k]));
  for (const l of LANGS) assert.deepEqual(keys(WORDS[l]).sort(), keys(WORDS.en).sort(), l);
});

test("the feed is well-formed Atom in each language", () => {
  for (const lang of LANGS) {
    const xml = whatsNewFeed(lang);
    assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<feed xmlns="http:\/\/www\.w3\.org\/2005\/Atom"/);
    assert.equal((xml.match(/<entry>/g) || []).length, Math.min(60, entries().length));
    assert.equal((xml.match(/<entry>/g) || []).length, (xml.match(/<\/entry>/g) || []).length);
    assert.doesNotMatch(xml.replace(/&(amp|lt|gt);/g, ""), /&/, "no bare ampersand");
    assert.match(xml, /<updated>\d{4}-\d{2}-\d{2}T[\d:.]+Z<\/updated>/);
  }
  assert.match(feedXml("de"), /https:\/\/heistclips\.com\/de\/whats-new#/);
});

test("every page carries the footer link and a New pill that starts hidden", () => {
  const html = layout({ title: "t", desc: "d", path: "/pricing", body: "<h1>x</h1>" });
  assert.match(html, /<a href="\/whats-new">What’s new<\/a>/);
  assert.match(html, new RegExp(`<a class="newpill" href="/whats-new" data-new="${latest().id}"[^>]* hidden>New</a>`));
  assert.match(html, /hc_new_seen/);
  const de = layout({ lang: "de", title: "t", desc: "d", path: "/pricing", body: "<h1>x</h1>" });
  assert.match(de, /<a href="\/de\/whats-new">Was ist neu<\/a>/);
  assert.match(de, /<a class="newpill" href="\/de\/whats-new"[^>]*>Neu<\/a>/);
  assert.equal(newMarker("en").includes("<dialog"), false);
});

test("a shipped request links to its entry, and the board links to everything shipped", () => {
  const e = entries().find((x) => (x.request_ids || []).length);
  const id = e.request_ids[0];
  // The newest entry naming a request wins.
  const want = entries().find((x) => (x.request_ids || []).includes(id));
  assert.equal(shippedLink({ id, status: "shipped" }), `<a class="reqlink" style="display:inline-block;padding:8px 0 2px" href="/whats-new#${want.id}">See it in What’s new →</a>`);
  assert.equal(shippedLink({ id, status: "building" }), "");
  assert.equal(shippedLink({ id: "nope", status: "shipped" }), "");
  assert.match(shippedLink({ id, status: "shipped" }, "fr"), /href="\/fr\/whats-new#/);
  assert.match(requestCard({ id, title: "x", detail: "", status: "shipped", by: "Requested by a clipper", votes: 1, response: "Done." }), /class="resp st-shipped">.*<\/p><a class="reqlink"/);
  assert.match(boardAllLink(), /href="\/whats-new">See everything we shipped →/);
  const board = [{ id, title: "x", detail: "", status: "shipped", by: "Requested by a clipper", votes: 1, voted: false, response: "Done." }];
  const es = localPage("es", "/requests", { snap: {}, query: new URLSearchParams(""), board });
  assert.match(es, /href="\/es\/whats-new#/);
  assert.match(es, /Ver todo lo que hemos lanzado/);
});

test("the sitemap, the connector export and llms-full carry it", () => {
  const urls = sitemapUrls({ campaigns: [], streamers: [] });
  for (const u of ["/whats-new", "/de/whats-new", "/fr/whats-new", "/pt/whats-new", "/es/whats-new"]) assert.ok(urls.includes(u), u);
  const got = latestEntries({ limit: 3, lang: "pt" });
  assert.equal(got.length, 3);
  assert.match(got[0].url, /^https:\/\/heistclips\.com\/pt\/whats-new#/);
  assert.equal(got[0].title, entries()[0].langs.pt.title);
  assert.equal(latestEntries({ since: "2999-01-01" }).length, 0);
  assert.match(llmsText(), /## What's new on heistclips/);
  assert.match(llmsText(), new RegExp(latest().date));
});
