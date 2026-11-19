// Funny facecam effects (board request rmwm3rms3, "funny facecam"). Each one changes only the
// streamer's own facecam picture: the gameplay, hook and chat are drawn as before. The warps and
// the colour work run in one WebGL shader on a small canvas the size of the facecam frame, so a
// 60 fps export stays at 60 (a per-pixel warp in canvas 2D would not).
//
// Nothing here uses another person's face, a character or a meme image: every effect is a
// transform of the pixels already inside the facecam box.

export const FX = ["none", "bighead", "fisheye", "shake", "fried", "wobble"];
// Effects that react to how loud the clip is. They need the loudness of the whole clip window
// (a quick listen before recording) so "loud" means loud for this clip, from its first frame.
export const fxNeedsLoud = (fx) => fx === "shake" || fx === "wobble";
// Effects that move without sound, so the still preview has to keep drawing.
export const fxMoves = (fx) => fx === "shake" || fx === "wobble" || fx === "fried";

const clamp01 = (x) => Math.max(0, Math.min(1, x));

// Loudness -> "how excited is this moment", 0 to 1, many times per clip. Once the whole window
// has been heard, `lo` is the level only the loudest tenth of it passes and `hi` sits above its
// loudest quarter-second, so talking gives 0 and the shouts give the big hits. Measured on a 38 s
// talking clip (zackrawrr, 2026-11-19): 13 beats past 0.5, moving 26% of the time; a flat 1.5x
// the mean gave 24 beats, which read as a constant tremor.
export class Loud {
  constructor() { this.mean = 0; this.peak = 0; this.n = 0; this.seeded = false; this.env = 0; this.e = 0; this.last = null; }
  // Quarter-second loudness bins of the whole window (Clipper.findLoudest / playWindow).
  seed(bins) {
    const vals = [...bins.values()].filter((x) => x[1]).map((x) => x[0] / x[1]);
    if (vals.length < 4) return;
    vals.sort((a, b) => a - b);
    this.lo = vals[Math.floor(0.9 * (vals.length - 1))] + 0.002;
    this.peak = vals[vals.length - 1];
    this.seeded = true;
  }
  push(rms, t) {
    const dt = this.last == null || t < this.last ? 0.016 : Math.min(0.1, t - this.last);
    this.last = t;
    if (!this.seeded) { this.n++; this.mean += (rms - this.mean) / Math.min(this.n, 900); this.peak = Math.max(this.peak * 0.9997, rms); }
    // Fast up, slower down: a shout lands at once and rings out for about a third of a second.
    this.env = rms > this.env ? this.env + (rms - this.env) * Math.min(1, dt / 0.03) : this.env + (rms - this.env) * Math.min(1, dt / 0.3);
    const lo = this.seeded ? this.lo : this.mean * 1.45 + 0.003, hi = Math.max(this.peak * 1.25, lo * 1.5);
    this.e = this.n < 30 && !this.seeded ? 0 : clamp01((this.env - lo) / (hi - lo));
    return this.e;
  }
}

// Shake at time t (seconds) for excitement e: a few sines that never line up, so it reads as a
// hand shaking the camera and is the same in the preview and in the export.
export function shake(t, e) {
  const k = e * e * (3 - 2 * e); // quiet stays still; loud ramps in
  const n = (a, b, c) => Math.sin(t * a + c) * 0.6 + Math.sin(t * b + c * 2.3) * 0.4;
  return { dx: n(71, 113, 0.3) * k, dy: n(83, 127, 1.9) * k, rot: n(59, 97, 4.1) * k * 0.07, zoom: 1 + 0.38 * k };
}

const VERT = `attribute vec2 a; varying vec2 v; void main(){ v = vec2(a.x*.5+.5, .5-a.y*.5); gl_Position = vec4(a,0.,1.); }`;
const FRAG = `precision highp float;
varying vec2 v;
uniform sampler2D tex;
uniform vec4 src;      // facecam rect in the video, as texture coords (x, y, w, h)
uniform vec2 res;      // output size in pixels
uniform float pad;     // the canvas is the frame grown by this share on every side (big head)
uniform int fx;
uniform float t, e;
uniform vec4 shk;      // dx, dy (share of the frame), rotation, zoom
float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
vec3 cam(vec2 q){ return texture2D(tex, src.xy + clamp(q, 0., 1.)*src.zw).rgb; }
void main(){
  float asp = res.x/res.y;
  vec2 p = v*(1.+2.*pad) - pad;   // frame coords: 0..1 is the frame itself
  vec2 q = p;
  vec3 col;
  if (fx == 1) {                  // big head: the middle of the frame is blown up, the rest gives way
    vec2 c = vec2(.5, .47);
    float ry = .56, rx = min(.46, ry*.8/asp); ry = min(ry, rx*asp/.62);
    float s = length((p-c)/vec2(rx, ry));
    q = c + (p-c)*mix(1./1.75, 1., smoothstep(.7, 1.35, s));
    col = cam(q);
  } else if (fx == 2) {           // fisheye: a real lens curve, dark corners, a little colour split
    vec2 fc = vec2(.5, .46);
    vec2 d = (p-fc)*vec2(asp, 1.);
    float R = .5*length(vec2(asp, 1.)), rn = length(d)/R, th = 1.17;
    float k = rn > 0.0001 ? tan(rn*th)/tan(th)/rn : th/tan(th);
    vec2 u = d/vec2(asp, 1.);
    col = vec3(cam(fc + u*k*1.025).r, cam(fc + u*k).g, cam(fc + u*k*.975).b);
    col *= 1. - .88*smoothstep(.5, 1., rn);
  } else if (fx == 3) {           // shake: zoom in and rattle, driven from the sound
    vec2 d = (p-.5)*vec2(asp, 1.);
    float cs = cos(shk.z), sn = sin(shk.z);
    d = vec2(d.x*cs - d.y*sn, d.x*sn + d.y*cs)/shk.w;
    q = .5 + d/vec2(asp, 1.) + shk.xy;
    col = cam(q);
  } else if (fx == 5) {           // jelly: the picture wobbles, more when it gets loud
    float a = .024 + .036*e;
    vec2 z = .5 + (p-.5)*(1. - 2.4*a);
    q = z + a*vec2(sin(z.y*9. + t*5.2) + .5*sin(z.y*17. - t*7.1), cos(z.x*8. + t*4.4) + .5*cos(z.x*15. + t*6.3));
    col = cam(q);
  } else if (fx == 4) {           // deep fried: sharpen hard, crush the contrast, push the colour, add grain
    vec2 px = 1.6/res;
    col = cam(p);
    vec3 blur = (cam(p+vec2(px.x,0.)) + cam(p-vec2(px.x,0.)) + cam(p+vec2(0.,px.y)) + cam(p-vec2(0.,px.y)))*.25;
    col += (col-blur)*3.2;
    col = pow(max(col, 0.), vec3(.62))*1.12;   // lift it first: fried is bright, not murky
    col = (col-.5)*1.55 + .5;
    float l = dot(col, vec3(.299,.587,.114));
    col = mix(vec3(l), col, 2.2);
    col *= vec3(1.12, 1.02, .78);
    col = mix(col, floor(col*7.+.5)/7., .45);
    col += (hash(floor(v*res/2.) + floor(t*24.)*7.) - .5)*.2;
  } else col = cam(p);
  gl_FragColor = vec4(clamp(col, 0., 1.), 1.);
}`;
const FX_ID = { bighead: 1, fisheye: 2, shake: 3, fried: 4, wobble: 5 };
export const BIGHEAD_PAD = 0.14;

// The facecam, drawn through the shader. render() returns a canvas to drawImage, or null if this
// browser has no WebGL (then the facecam is drawn plain: a clip still renders, without the effect).
export class CamFx {
  constructor() {
    this.cv = document.createElement("canvas");
    const gl = (this.gl = this.cv.getContext("webgl", { alpha: false, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false }));
    if (!gl) return;
    const sh = (type, s) => { const x = gl.createShader(type); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
    try {
      const pr = gl.createProgram();
      gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
      gl.useProgram(pr);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(pr, "a"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      this.u = {}; for (const n of ["src", "res", "pad", "fx", "t", "e", "shk"]) this.u[n] = gl.getUniformLocation(pr, n);
    } catch (err) { this.gl = null; this.err = String(err.message || err); }
  }
  get ok() { return !!this.gl && !this.gl.isContextLost(); }
  // src: {x, y, w, h} in video pixels (already cropped to the frame's shape); w, h: frame size in px.
  render(video, vw, vh, src, w, h, fx, t, e, shk) {
    if (!this.ok || !FX_ID[fx]) return null;
    const gl = this.gl, pad = fx === "bighead" ? BIGHEAD_PAD : 0;
    const cw = Math.round(w * (1 + 2 * pad)), ch = Math.round(h * (1 + 2 * pad));
    if (this.cv.width !== cw || this.cv.height !== ch) { this.cv.width = cw; this.cv.height = ch; }
    gl.viewport(0, 0, cw, ch);
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video); } catch (err) { return null; }
    gl.uniform4f(this.u.src, src.x / vw, src.y / vh, src.w / vw, src.h / vh);
    gl.uniform2f(this.u.res, w, h); gl.uniform1f(this.u.pad, pad); gl.uniform1i(this.u.fx, FX_ID[fx]);
    gl.uniform1f(this.u.t, t % 1000); gl.uniform1f(this.u.e, e);
    gl.uniform4f(this.u.shk, shk ? shk.dx : 0, shk ? shk.dy : 0, shk ? shk.rot : 0, shk ? shk.zoom : 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return this.cv;
  }
}
