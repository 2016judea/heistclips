import test from "node:test";
import assert from "node:assert/strict";
import { spoilerCheck, markSpoilers, storyStream } from "../public/js/spoilers.js";

const chat = (lines) => ({ chat: lines.map((text, i) => ({ t: i, text })) });
const noise = ["LUL", "KEKW", "W", "no way", "clip it", "OMEGALUL", "what", "bro", "lmao", "POG"];

test("ordinary hype chat is not a spoiler", () => {
  const s = spoilerCheck({ title: "chill stream" }, chat([...noise, ...noise, "that twist though"]));
  assert.equal(s.spoiler, false); assert.equal(s.level, "none");
});

test("chat warning about spoilers flags the moment, with the reason and a quote", () => {
  const s = spoilerCheck({ title: "GTA VI" }, chat([...noise, "SPOILER", "no spoilers pls", "dont spoil it"]));
  assert.equal(s.spoiler, true); assert.equal(s.kind, "warn"); assert.match(s.reason, /chat warns about spoilers: 3 lines \(“SPOILER”\)/);
});

test("ending talk flags; a story-run title lowers the bar", () => {
  assert.equal(spoilerCheck({ title: "GTA" }, chat([...noise, "this is the final mission", "ending already??"])).kind, "end");
  const one = chat([...noise, "spoiler!!"]);
  assert.equal(spoilerCheck({ title: "ranked grind" }, one).spoiler, false);
  assert.equal(spoilerCheck({ title: "GTA VI story playthrough NO SPOILERS" }, one).spoiler, true);
  assert.equal(storyStream({ title: "PLAYING GTA 6 FOR THE FIRST TIME" }), true);
});

test("other languages: German, Spanish, Portuguese", () => {
  assert.equal(spoilerCheck({ title: "x" }, chat([...noise, "keine spoiler bitte", "SPOILER"])).spoiler, true);
  assert.equal(spoilerCheck({ title: "x" }, chat([...noise, "es el final del juego", "los creditos ya"])).kind, "end");
  assert.equal(spoilerCheck({ title: "historia completa" }, chat([...noise, "ele morreu??", "que traição"])).kind, "story");
});

test("markSpoilers annotates every moment and counts the flagged ones", () => {
  const ms = [chat(noise), chat([...noise, "SPOILER", "spoilers!!"])];
  assert.equal(markSpoilers({ title: "x" }, ms), 1);
  assert.equal(ms[0].spoiler.spoiler, false); assert.equal(ms[1].spoiler.spoiler, true);
});
