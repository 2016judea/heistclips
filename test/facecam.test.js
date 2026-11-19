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
