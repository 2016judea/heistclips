import test from "node:test";
import assert from "node:assert/strict";
import { parseInput, findPeaks, momentFromMessages, musicRisk, hooks, topPhrase } from "../public/js/twitch.js";

test("parseInput tells channels, VODs and Kick apart", () => {
  assert.deepEqual(parseInput("https://www.twitch.tv/videos/2929840281"), { kind: "vod", id: "2929840281" });
  assert.deepEqual(parseInput("twitch.tv/xQc"), { kind: "channel", login: "xqc" });
  assert.deepEqual(parseInput("xqc"), { kind: "channel", login: "xqc" });
  assert.equal(parseInput("https://kick.com/adinross").kind, "kick");
  assert.equal(parseInput("https://youtube.com/live/abc").kind, "unknown");
});

// Synthetic chat: 1 msg/s, then a 20-second burst at 12 msg/s starting at t=1000.
function chat() {
  const msgs = []; let id = 0;
  for (let t = 0; t < 2000; t++) {
    const n = t >= 1000 && t < 1020 ? 12 : 1;
    for (let k = 0; k < n; k++) msgs.push({ id: String(id++), t, text: t >= 1000 && t < 1020 ? (k % 3 ? "LMAOOO" : "clip it") : "hi" });
  }
  return msgs;
}

test("findPeaks finds the burst and only the burst", () => {
  const msgs = chat();
  const samples = [];
  for (let t = 0; t < 2000; t += 20) {
    const page = msgs.filter((m) => m.t >= t).slice(0, 60);
    const span = Math.max(1, page[page.length - 1].t - page[0].t);
    samples.push({ t: (page[0].t + page[page.length - 1].t) / 2, rate: (page.length - 1) / span, msgs: page });
  }
  const peaks = findPeaks(samples, { k: 5 });
  assert.ok(peaks.length >= 1);
  assert.ok(Math.abs(peaks[0].t - 1005) < 30, "peak near the burst, got " + peaks[0].t);
});

test("a moment starts before chat reacts and counts clip requests", () => {
  const vod = { id: "1", channel: "x", channel_name: "X", length: 2000, muted: [] };
  const m = momentFromMessages(vod, chat(), { t: 1008, base: 1 });
  assert.ok(m.t_start < 1000 && m.t_start > 960, "start " + m.t_start);
  assert.ok(m.t_end > 1000 && m.t_end <= 1030, "end " + m.t_end);
  assert.ok(m.chat_ratio >= 5);
  assert.ok(m.clip_requests > 0);
  assert.equal(m.event_type, "funny");
});

test("music risk is high only where Twitch muted the audio", () => {
  assert.equal(musicRisk({ muted: [{ start: 100, end: 400 }] }, 300, 340).level, "high");
  assert.equal(musicRisk({ muted: [{ start: 100, end: 200 }] }, 300, 340).level, "low");
  assert.equal(musicRisk({ muted: [] }, 300, 340, 3).level, "medium");
});

test("hooks: 3-5 distinct lines, no raw laugh spam", () => {
  const h = hooks({ event_type: "funny", chat_ratio: 6, phrase: topPhrase([{ text: "KKKKKKKK" }, { text: "KKKKKKKK" }]) }, "spkclb");
  assert.ok(h.length >= 3 && h.length <= 5);
  assert.ok(!h.some((x) => /KKKK/.test(x)));
});

test("parseInput reads Kick channels and Kick VOD links", async () => {
  assert.deepEqual(parseInput("https://kick.com/xqc"), { kind: "kick", login: "xqc" });
  assert.deepEqual(parseInput("kick.com/xqc/videos/381c9cde-9247-497f-854c-f498bc3a488e"), { kind: "kickvod", id: "381c9cde-9247-497f-854c-f498bc3a488e" });
  assert.deepEqual(parseInput("kick:Sxb"), { kind: "kick", login: "sxb" });
  const { kickRate } = await import("../public/js/kick.js");
  assert.equal(kickRate([{ t: 0 }, { t: 1 }]), 0.4); // under the 25 cap: count over the 5 s window
  assert.equal(kickRate(Array.from({ length: 25 }, (_, i) => ({ t: Math.floor(i / 12) }))), 12); // capped: count over span
});

test("crude chat lines never become a hook", () => {
  const h = hooks({ event_type: "funny", chat_ratio: 4, phrase: topPhrase([{ text: "willy bussy" }, { text: "willy bussy" }]) }, "xQc");
  assert.ok(!h.some((x) => /bussy/i.test(x)));
});
