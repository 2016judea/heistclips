// Live mode: read a channel's chat as it happens (anonymous, read-only Twitch IRC) and fire a
// moment the second chat speed jumps. The stream's in-progress VOD trails live by ~10 s
// (measured 2026-11-16), so a moment can be cut within a minute of it happening.
import { momentFromMessages, hooks } from "./twitch.js";
import { pollKickChat } from "./kick.js";

export class LiveChat {
  constructor(login, { vod, recordingStart, onRate, onMoment, onStatus }) {
    this.login = login; this.vod = vod; this.recordingStart = recordingStart;
    this.onRate = onRate; this.onMoment = onMoment; this.onStatus = onStatus;
    this.msgs = []; this.perSec = new Map(); this.lastSpike = 0; this.history = [];
    this.n = 0;
  }

  start() {
    if (this.vod.platform === "kick") {
      this.stopPoll = pollKickChat(this.vod, (m) => this.add(m), this.onStatus);
      this.timer = setInterval(() => this.tick(), 1000);
      return;
    }
    const ws = new WebSocket("wss://irc-ws.chat.twitch.tv:443");
    this.ws = ws;
    ws.onopen = () => {
      ws.send("CAP REQ :twitch.tv/tags");
      ws.send("PASS SCHMOOPIIE");
      ws.send("NICK justinfan" + Math.floor(10000 + Math.random() * 80000));
      ws.send("JOIN #" + this.login);
      this.onStatus && this.onStatus("watching chat");
    };
    ws.onmessage = (e) => {
      for (const line of String(e.data).split("\r\n")) {
        if (!line) continue;
        if (line.startsWith("PING")) { ws.send("PONG :tmi.twitch.tv"); continue; }
        const m = line.match(/^(?:@([^ ]+) )?:[^ ]+ PRIVMSG #[^ ]+ :(.*)$/);
        if (!m) continue;
        const tags = Object.fromEntries((m[1] || "").split(";").map((kv) => kv.split("=")));
        const ts = Number(tags["tmi-sent-ts"]) || Date.now();
        this.add({ id: tags.id || String(++this.n), ts, text: m[2] });
      }
    };
    ws.onclose = () => { this.onStatus && this.onStatus("chat disconnected, reconnecting…"); if (!this.stopped) setTimeout(() => this.start(), 3000); };
    this.timer = setInterval(() => this.tick(), 1000);
  }

  add(msg) {
    msg.t = (msg.ts - this.recordingStart) / 1000;
    this.msgs.push(msg);
    if (this.msgs.length > 20000) this.msgs.splice(0, 5000);
    const s = Math.floor(msg.ts / 1000);
    this.perSec.set(s, (this.perSec.get(s) || 0) + 1);
  }

  rate(endSec, span) {
    let n = 0;
    for (let k = endSec - span + 1; k <= endSec; k++) n += this.perSec.get(k) || 0;
    return n / span;
  }

  tick() {
    const now = Math.floor(Date.now() / 1000) - 1;
    const r5 = this.rate(now, 5);
    this.history.push(r5);
    if (this.history.length > 600) this.history.shift();
    const base = Math.max(0.1, median(this.history.slice(-300, -15)));
    this.onRate && this.onRate(r5, base, this.history);
    // A spike: 5-second chat speed at 2.5x the last five minutes, and at least 1 msg/s.
    if (this.history.length > 40 && r5 >= base * 2.5 && r5 >= 1 && Date.now() - this.lastSpike > 60000) {
      this.lastSpike = Date.now();
      setTimeout(() => this.emit(now, base), 12000); // let the reaction finish before sizing it
    }
  }

  emit(spikeSec, base) {
    const tPeak = (spikeSec * 1000 - this.recordingStart) / 1000;
    const vod = { ...this.vod, length: (Date.now() - this.recordingStart) / 1000, muted: [] };
    const m = momentFromMessages(vod, this.msgs.filter((x) => x.t > tPeak - 120 && x.t < tPeak + 40), { t: tPeak, base });
    m.live = true; m.found_at = Date.now();
    m.twitch_clips = 0; m.twitch_clip_views = 0;
    m.hooks = hooks(m, vod.channel_name);
    m.score = m.chat_ratio;
    this.onMoment && this.onMoment(m);
  }

  stop() { this.stopped = true; clearInterval(this.timer); if (this.ws) this.ws.close(); if (this.stopPoll) this.stopPoll(); }
}

function median(xs) {
  const s = xs.slice().sort((a, b) => a - b);
  if (!s.length) return 0;
  const k = Math.floor(s.length / 2);
  return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2;
}

// When did the recording start? The first PROGRAM-DATE-TIME in the VOD playlist.
export async function recordingStart(playlistUrl) {
  const r = await fetch(playlistUrl, { cache: "no-store" });
  const txt = await r.text();
  const m = txt.match(/#EXT-X-PROGRAM-DATE-TIME:([^\s]+)/);
  const total = txt.match(/#EXT-X-TWITCH-TOTAL-SECS:([\d.]+)/);
  return { start: m ? Date.parse(m[1]) : null, total: total ? Number(total[1]) : null };
}
