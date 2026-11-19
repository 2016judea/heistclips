import test from "node:test";
import assert from "node:assert/strict";
import { localize, pickViewerLang, fromLabel, TR_LANGS } from "../lib/translate.js";
import { publicList } from "../lib/requests.js";
import { requestCard } from "../lib/render.js";

const de = { id: "r1", title: "Bessere Qualität", detail: "", status: "building", by: "clipper", votes: 4, voters: [], created_at: "2026-11-18T00:00:00Z",
  lang: "de", tr: { en: { title: "Better quality" }, de: { title: "Bessere Qualität" }, fr: { title: "Meilleure qualité" } },
  response: "Working on it now.", response_lang: "en", response_tr: { en: "Working on it now.", de: "Wir arbeiten gerade daran.", fr: "On s’en occupe." } };
const plain = { id: "r2", title: "sound mp4", detail: "", status: "requested", by: "clipper", votes: 2, voters: [], created_at: "2026-11-18T00:00:00Z" };

test("the viewer's language comes from the first candidate that names one we serve", () => {
  assert.equal(pickViewerLang("de"), "de");
  assert.equal(pickViewerLang(null, "fr-FR,fr;q=0.9,en;q=0.8"), "fr");
  assert.equal(pickViewerLang(null, "es-ES,es;q=0.9,de;q=0.5"), "en"); // Spanish is not served yet: English, not their third choice
  assert.equal(pickViewerLang("xx", "de-AT"), "de"); // a ?lang= we do not serve falls through to the browser
  assert.equal(pickViewerLang(), "en");
  assert.deepEqual(TR_LANGS.slice(0, 3), ["en", "de", "fr"]);
});

test("a German request reads in English for an English viewer, with the original kept", () => {
  const en = localize(de, "en");
  assert.equal(en.title, "Better quality"); assert.equal(en.translated, true);
  assert.deepEqual(en.original, { lang: "de", title: "Bessere Qualität", detail: "" });
  assert.equal(en.response, "Working on it now.");
  const g = localize(de, "de");
  assert.equal(g.title, "Bessere Qualität"); assert.equal(g.translated, false); assert.equal(g.original, null);
  assert.equal(g.response, "Wir arbeiten gerade daran.");
  assert.equal(localize(de, "fr").title, "Meilleure qualité");
  assert.equal(localize(plain, "de").title, "sound mp4"); // not backfilled yet: shown as written
});

test("the board list and the connector get English plus the original; votes and status ride along untouched", () => {
  const [a, b] = publicList({ items: [de, plain] }, null, "en");
  assert.equal(a.title, "Better quality"); assert.equal(a.original.title, "Bessere Qualität"); assert.equal(a.lang, "de");
  assert.equal(a.votes, 4); assert.equal(a.status, "building");
  assert.equal(b.original, null);
});

test("a translated row says where it came from and carries both texts for the toggle", () => {
  const [row] = publicList({ items: [de] }, null, "en");
  const html = requestCard(row, "en");
  assert.match(html, /Translated from German · <button[^>]*data-orig[^>]*>show original<\/button>/);
  assert.match(html, /data-o-title="Bessere Qualität"/); assert.match(html, /data-t-title="Better quality"/);
  assert.match(html, /<b class="rt">Better quality<\/b>/);
  const [g] = publicList({ items: [de] }, null, "de");
  assert.ok(!requestCard(g, "de").includes("trnote"));
  assert.equal(fromLabel("de", "en").from, "Übersetzt aus dem Englischen");
  assert.equal(fromLabel("fr", "de").from, "Traduit de l’allemand");
  assert.equal(fromLabel("en", "xx").from, "Translated from XX");
});
