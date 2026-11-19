// Is the facecam box on a face? The default box (top right) missed the webcam of all six GTA
// streamers checked on 2026-11-19 (Kai Cenat, xQc, CaseOh, Jynxzi, summit1g mid-left or top-left;
// Clix top-left), and a split clip whose top panel shows gameplay is a wasted clip.
//
// Free, in the browser: MediaPipe's face detector (BlazeFace short range, Apache-2.0; ~2.3 MB
// compressed from jsDelivr, the 230 KB model from /js/vendor/, fetched only when a check runs)
// on 5 frames 2 s apart. Measured on those six streams, 45 frames, the box cropped to 256 px:
//   - the true webcam box: a face scored 0.66 to 0.96 in 44 of 45 frames;
//   - the default box: never above 0.62 (game characters, trees);
//   so a frame counts at 0.64 or more, and a box is "on a face" when 3 of 5 frames count.
// pico.js was tried first: it missed Clix in his own box in 2 of 3 spots (glasses, headset,
// looking down) and was dropped. Desk precedent: desk/judge.js asked a paid vision model.
const MP = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21";
export const MIN_SCORE = 0.64;

let detP = null;
function detector() {
  if (!detP) detP = (async () => {
    const v = await import(MP + "/vision_bundle.mjs");
    const files = await v.FilesetResolver.forVisionTasks(MP + "/wasm");
    return v.FaceDetector.createFromOptions(files, { baseOptions: { modelAssetPath: "/js/vendor/blaze_face_short_range.tflite" }, runningMode: "IMAGE", minDetectionConfidence: 0.5 });
  })().catch((e) => { detP = null; throw e; });
  return detP;
}
const yieldNow = () => new Promise((ok) => setTimeout(ok, 0));

// Faces inside one box of one frame, in frame fractions: [{ x, y, s, score }] (centre, height).
function facesIn(det, frame, box, scratch) {
  const sw = frame.width * box.w, sh = frame.height * box.h;
  const H2 = 256, W2 = Math.max(32, Math.round(H2 * sw / sh));
  scratch.width = W2; scratch.height = H2;
  scratch.getContext("2d").drawImage(frame, frame.width * box.x, frame.height * box.y, sw, sh, 0, 0, W2, H2);
  return det.detect(scratch).detections.map((d) => {
    const b = d.boundingBox, score = (d.categories && d.categories[0] && d.categories[0].score) || 0;
    return { x: box.x + ((b.originX + b.width / 2) / W2) * box.w, y: box.y + ((b.originY + b.height / 2) / H2) * box.h, s: (b.height / H2) * box.h, score };
  }).filter((f) => f.score >= MIN_SCORE);
}

// Candidate webcam spots for the whole-frame search: a 5 x 5 grid of boxes about webcam size.
const GRID = [];
for (const y of [0, 0.16, 0.32, 0.48, 0.64]) for (const x of [0, 0.17, 0.34, 0.51, 0.68]) GRID.push({ x, y, w: 0.32, h: 0.36 });

// frames: canvases of the video (public/js/render.js grabFrames).
export class FaceCheck {
  constructor(frames) { this.frames = frames; this.full = undefined; this.c = document.createElement("canvas"); }

  // How many frames show a face inside the box (fractions of the source frame).
  async inBox(box) {
    const det = await detector();
    let hits = 0;
    for (const f of this.frames) { if (facesIn(det, f, box, this.c).length) hits++; await yieldNow(); }
    return hits;
  }
  onFace(hits) { return hits >= Math.min(3, Math.ceil(this.frames.length * 0.6)); }

  // The webcam's face in the whole frame: one that stays put across frames. null if none.
  async findFace() {
    if (this.full !== undefined) return this.full;
    const det = await detector();
    const per = [];
    for (const f of this.frames) {
      const found = [];
      for (const g of GRID) found.push(...facesIn(det, f, g, this.c));
      per.push(found);
      await yieldNow();
    }
    this.full = persistentFace(per, Math.min(3, this.frames.length));
    return this.full;
  }
}

// Detections per frame -> the face at (nearly) the same place and size in at least `need` frames.
export function persistentFace(per, need = 3) {
  const clusters = [];
  per.forEach((dets, i) => dets.forEach((d) => {
    const c = clusters.find((c) => Math.abs(c.x - d.x) < 0.04 && Math.abs(c.y - d.y) < 0.06 && Math.abs(c.s - d.s) / c.s < 0.4);
    if (c) { c.frames.add(i); c.n++; c.x += (d.x - c.x) / c.n; c.y += (d.y - c.y) / c.n; c.s += (d.s - c.s) / c.n; c.score = Math.max(c.score, d.score || 0); }
    else clusters.push({ x: d.x, y: d.y, s: d.s, score: d.score || 0, n: 1, frames: new Set([i]) });
  }));
  const best = clusters.filter((c) => c.frames.size >= need).sort((a, b) => b.frames.size - a.frames.size || b.score - a.score)[0];
  return best ? { x: best.x, y: best.y, s: best.s, frames: best.frames.size } : null;
}

// A facecam box around a face: about 3 face-heights tall, as wide as a 16:9 webcam that tall,
// the face a little above the middle. Fractions of the source frame (aspect = width / height).
export function boxAround(face, aspect = 16 / 9) {
  const h = Math.min(0.6, Math.max(0.12, face.s * 3));
  const w = Math.min(0.6, h * (16 / 9) / aspect); // = h on a 16:9 frame
  const x = Math.max(0, Math.min(1 - w, face.x - w / 2));
  const y = Math.max(0, Math.min(1 - h, face.y - h * 0.45));
  return { x, y, w, h };
}

// The server cut takes a corner (tl, tr, bl, br) with a 0.28 x 0.35 box. The corner whose box
// holds the face, or null when the face sits away from every corner (mid-left: use the full frame).
export function cornerFor(face) {
  const v = face.y - face.s / 2 >= 0 && face.y + face.s / 2 <= 0.35 ? "t" : face.y - face.s / 2 >= 0.65 ? "b" : null;
  const hz = face.x + face.s * 0.3 <= 0.28 ? "l" : face.x - face.s * 0.3 >= 0.72 ? "r" : null;
  return v && hz ? v + hz : null;
}
