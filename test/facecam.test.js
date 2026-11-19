import test from "node:test";
import assert from "node:assert/strict";
import { camPreset, clampBox, punchZoom, loudestSecond } from "../public/js/render.js";

const box = { x: 0.3, y: 0.3, w: 0.25, h: 0.3 };
const near = (a, b) => Math.abs(a - b) < 1e-9;

test("presets keep the box size and pin it to corners and the middle of each side", () => {
  assert.deepEqual(camPreset("tl", box), { x: 0, y: 0, w: 0.25, h: 0.3 });
  const br = camPreset("br", box); assert.ok(near(br.x, 0.75) && near(br.y, 0.7));
  const ml = camPreset("ml", box); assert.ok(near(ml.x, 0) && near(ml.y, 0.35));
  const mr = camPreset("mr", box); assert.ok(near(mr.x, 0.75) && near(mr.y, 0.35));
});

test("a dragged box never leaves the frame or collapses", () => {
  assert.deepEqual(clampBox({ x: 0.9, y: -0.2, w: 0.3, h: 0.3 }), { x: 0.7, y: 0, w: 0.3, h: 0.3 });
  const tiny = clampBox({ x: 0.5, y: 0.5, w: 0, h: -1 });
  assert.ok(tiny.w >= 0.06 && tiny.h >= 0.06);
});

test("punch-in zooms in at the loud second, holds, and comes back out", () => {
  assert.equal(punchZoom(-1), 1);
  assert.ok(punchZoom(-0.1) > 1 && punchZoom(-0.1) < 1.32);
  assert.ok(near(punchZoom(0.5), 1.32));
  assert.ok(punchZoom(1.2) < 1.32 && punchZoom(1.2) > 1);
  assert.equal(punchZoom(2), 1);
});

test("the loudest one-second stretch wins; silence gives no punch time", () => {
  const bins = new Map();
  for (let k = 0; k < 40; k++) bins.set(k, [k >= 20 && k < 24 ? 0.8 : 0.05, 1]);
  assert.equal(loudestSecond(bins, 100), 100 + (20 + 2) * 0.25);
  const quiet = new Map([[0, [0, 3]], [1, [0, 3]]]);
  assert.equal(loudestSecond(quiet, 0), null);
});

// ---- funny facecam (public/js/fx.js) ----
import { FX, Loud, shake, fxNeedsLoud } from "../public/js/fx.js";
import fs from "node:fs";

test("loud moments fire more than once per clip, and talking does not", () => {
  // 30 s at 60 fps: talking at 0.05, three shouts at 0.4 (5 s, 14 s, 22 s), half a second each.
  const level = (t) => ([5, 14, 22].some((s) => t >= s && t < s + 0.5) ? 0.4 : 0.05);
  const bins = new Map();
  for (let k = 0; k < 120; k++) bins.set(k, [level(k / 4), 1]);
  const run = (seeded) => {
    const L = new Loud(); if (seeded) L.seed(bins);
    let hits = 0, was = false, quietMax = 0;
    for (let i = 0; i < 1800; i++) { const t = i / 60, e = L.push(level(t), t); const on = e > 0.6; if (on && !was) hits++; was = on; if (t > 2 && t < 4.9) quietMax = Math.max(quietMax, e); }
    return { hits, quietMax };
  };
  assert.deepEqual(run(true), { hits: 3, quietMax: 0 });
  const live = run(false); // the preview, before anything has listened to the whole clip
  assert.equal(live.hits, 3); assert.equal(live.quietMax, 0);
});

test("shake is still when quiet, moves and zooms when loud, and is the same for the same frame", () => {
  const q = shake(3.2, 0); assert.ok(q.dx === 0 && q.dy === 0 && Math.abs(q.rot) === 0 && q.zoom === 1);
  const a = shake(3.2, 1), b = shake(3.2, 1), c = shake(3.25, 1);
  assert.deepEqual(a, b);
  assert.ok(Math.abs(a.zoom - 1.38) < 1e-9 && Math.abs(a.dx) <= 1 && Math.abs(a.dy) <= 1);
  assert.ok(a.dx !== c.dx);
});

test("every funny effect has a button, a shader branch and a saved-choice guard", () => {
  const app = fs.readFileSync(new URL("../public/js/app.js", import.meta.url), "utf8");
  const fx = fs.readFileSync(new URL("../public/js/fx.js", import.meta.url), "utf8");
  const l10n = fs.readFileSync(new URL("../public/js/l10n.js", import.meta.url), "utf8");
  const seg = app.match(/data-k="camFx">(.*?)<\/div>/)[1];
  const buttons = [...seg.matchAll(/data-v="(\w+)">([^<]+)</g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(buttons.map((b) => b[0]), FX);
  for (const [id, label] of buttons) {
    if (id !== "none") assert.match(fx, new RegExp(id + ": \\d"), id);
    assert.ok(l10n.includes("[/^" + label + "$/"), "no translation rule for: " + label);
  }
  assert.match(app, /cam_fx:/); // PostHog: which effect was rendered
  assert.equal(fxNeedsLoud("shake"), true); assert.equal(fxNeedsLoud("fried"), false);
});
