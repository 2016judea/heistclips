import test from "node:test";
import assert from "node:assert/strict";
import { scan, mask, flagged, keepClean } from "../public/js/wordguard.js";
import { topPhrase, hooks } from "../public/js/twitch.js";
import { hookLines } from "../lib/cut.js";

// Lines a hook could pick up from chat, in every language the site serves.
const CRUDE = ["what the fuuuck", "SH1T", "kick his a$$", "she's NAKED", "Hurensohn", "puta madre", "que porra é essa", "n1gga moment", "kys",
  "kill yourself", "Scheiße!", "enculé", "maricón", "chinga tu madre", "foda-se", "motherfucker", "go to the strip club", "„Fotze“ – der Chat, sofort"];
// Lines that look close and must pass.
const CLEAN = ["classic pass", "assassin creed", "rapper got cooked", "cannon fodder", "LSPD chase", "Scunthorpe", "cocktail bar", "Essex", "ele pede ajuda",
  "con el coche", "a bite", "Dickens", "skill issue", "cumulative", "therapist", "Chat went 4× faster here", "Wait for it…", "KEKW", "pussycat", "LMAOOO"];

test("the guard catches crude lines in en, de, fr, pt and es, through letter swaps and stretched letters", () => {
  for (const s of CRUDE) assert.ok(flagged(s), s);
});

test("the guard leaves near-misses alone: whole words only, no accent folding, no GTA words", () => {
  for (const s of CLEAN) assert.ok(!flagged(s), s + " -> " + JSON.stringify(scan(s)));
});

test("mask keeps the first letter and the rest of the line; the word cannot be read", () => {
  assert.equal(mask("what the fuck was that"), "what the f*** was that");
  assert.equal(mask("puta madre 😂"), "p*** madre 😂");
  assert.equal(mask("Wait for it…"), "Wait for it…");
  assert.equal(scan("ok bitch")[0].cat, "profanity");
  assert.equal(scan("n1gga")[0].cat, "slur");
});

test("a suggested line with a guarded word is dropped, never shown", () => {
  const { kept, dropped } = keepClean(["“puta madre” – chat, instantly", "Wait for it…"]);
  assert.deepEqual(kept, ["Wait for it…"]);
  assert.equal(dropped.length, 1);
});

test("chat's most-typed line never becomes a quote hook when it is crude, in any language", () => {
  const msgs = (s, n = 6) => Array.from({ length: n }, (_, i) => ({ t: i, text: s }));
  for (const s of ["puta madre", "Hurensohn", "kick his ass", "she's naked"]) {
    const p = topPhrase(msgs(s));
    assert.equal(p.words, false, s);
    const hs = hooks({ phrase: p, event_type: "funny", chat_ratio: 4 }, "kaicenat", "en");
    assert.ok(hs.every((x) => !flagged(x)), hs.join(" | "));
  }
  assert.equal(topPhrase(msgs("no way bro")).words, true);
});

test("the server cut's hook lines are built from the guarded text (lib/cut.js)", () => {
  assert.deepEqual(hookLines(mask("he said fuck it")), ["he said f*** it"]);
});
