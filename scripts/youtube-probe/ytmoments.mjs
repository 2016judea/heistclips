// Run heistclips' own peak finder (findPeaks + momentFromMessages, public/js/twitch.js,
// unchanged) over a real YouTube chat replay read through youtubei seek pages.
// Usage: node ytmoments.mjs <videoId> [step]
import { watchPage, replayPage } from "./ytchat.mjs";
import { findPeaks, momentFromMessages, clock } from "../../public/js/twitch.js";

const id = process.argv[2] || "uDwiE9saR0c";
const b = (s) => Buffer.from(decodeURIComponent(s).replace(/-/g, "+").replace(/_/g, "/"), "base64");
const toAll = (cont) => Buffer.from(b(cont).toString("hex").replace(/720c0804/, "720c0801"), "hex").toString("base64").replace(/\+/g, "-").replace(/\//g, "_");

async function pool(items, n, fn) {
  let i = 0; const out = new Array(items.length);
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; try { out[k] = await fn(items[k]); } catch (e) { out[k] = null; } } }));
  return out;
}

const t0 = Date.now();
const w = await watchPage(id);
const vd = w.pr.videoDetails;
const length = Number(vd.lengthSeconds);
const cont = toAll(w.cont);
const step = Number(process.argv[3]) || (length > 6 * 3600 ? 30 : length > 2 * 3600 ? 20 : 10);
const offsets = []; for (let t = 0; t < length; t += step) offsets.push(t);
let reqs = 0, fails = 0;
const pages = await pool(offsets, 12, async (o) => { reqs++; const p = await replayPage(cont, o * 1000); if (p.status !== 200) fails++; return p.msgs.filter((m) => m.t != null).map((m) => ({ ...m, t: Math.floor(m.t) })); });
const tRead = Date.now() - t0;
const seen = new Map(); const samples = [];
pages.forEach((p, i) => {
  if (!p || p.length < 2) { samples.push({ t: offsets[i], rate: 0, msgs: [] }); return; }
  for (const m of p) seen.set(m.id, m);
  // A seek page is ~100 messages around the offset: rate from the messages within +-step of it,
  // falling back to the whole page (the same n/span estimate Twitch pages use).
  const span = Math.max(1, p[p.length - 1].t - p[0].t);
  samples.push({ t: (p[0].t + p[p.length - 1].t) / 2, rate: (p.length - 1) / span, msgs: p });
});
samples.sort((a, b) => a.t - b.t);
const msgs = [...seen.values()].sort((a, b) => a.t - b.t);
const rates = samples.map((s) => s.rate).filter((r) => r > 0).sort((a, b) => a - b);
const q = (p) => rates[Math.floor(p * (rates.length - 1))];
console.log(JSON.stringify({ id, title: vd.title, author: vd.author, length, step, requests: reqs, non200: fails, read_ms: tRead, distinct_msgs: msgs.length, rate_p10: q(0.1)?.toFixed(2), rate_p50: q(0.5)?.toFixed(2), rate_p90: q(0.9)?.toFixed(2), rate_max: rates.at(-1)?.toFixed(2) }));

// Refine: contiguous messages from peak-90 to peak+40 by following the replay continuation.
async function window(from, to) {
  let p = await replayPage(cont, from * 1000), out = [], n = 0;
  while (p && n < 40) {
    out.push(...p.msgs.filter((m) => m.t != null).map((m) => ({ ...m, t: Math.floor(m.t) })));
    const last = p.msgs.at(-1)?.t;
    if (!p.next || last == null || last > to) break;
    p = await replayPage(p.next, 0); n++;
  }
  return out;
}
const FROM = Number(process.argv[4] || 0); const peaks = findPeaks(samples.filter((s) => s.t >= FROM), { k: 8, gap: 90 }).concat(findPeaks(samples.filter((s) => s.t >= FROM), { k: 8, gap: 90, minRatio: 1.25 })).filter((p, i, a) => a.findIndex((q) => Math.abs(q.t - p.t) < 90) === i).slice(0, 8);
const vod = { id, length, channel: vd.author, platform: "youtube", muted: [] };
for (const pk of peaks) {
  const win = await window(Math.max(0, pk.t - 95), pk.t + 45);
  const m = momentFromMessages(vod, win, pk);
  const sampleChat = m.chat.filter((c) => c.t >= m.t_peak - 6 && c.t <= m.t_peak + 6).slice(0, 8).map((c) => c.text.slice(0, 30)).join(" | ");
  console.log(`${clock(m.t_start)}-${clock(m.t_end)} peak ${clock(m.t_peak)} ratio ${m.chat_ratio}x rate ${m.chat_rate}/s base ${m.baseline} ${m.event_type} phrase=${m.phrase?.text ?? "-"} clip=${m.clip_requests} https://youtu.be/${id}?t=${Math.floor(m.t_start)}`);
  console.log(`    chat@peak: ${sampleChat}`);
}
console.log("total_ms", Date.now() - t0);
