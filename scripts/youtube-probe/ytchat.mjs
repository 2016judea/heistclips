// YouTube chat replay, anonymous: the watch page's liveChatRenderer continuation, then
// youtubei/v1/live_chat/get_live_chat_replay with currentPlayerState.playerOffsetMs to SEEK.
// Question under test: can we sample a replay at arbitrary offsets the way Twitch's
// comments(contentOffsetSeconds:N) allows? Usage: node ytchat.mjs <videoId> [mode]
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const VER = "2.20261119.01.00";

export async function watchPage(id) {
  const r = await fetch(`https://www.youtube.com/watch?v=${id}`, { headers: { "user-agent": UA, "accept-language": "en-US,en" } });
  const html = await r.text();
  const grab = (name) => {
    const i = html.indexOf(name + " = ") >= 0 ? html.indexOf(name + " = ") + name.length + 3 : html.indexOf(name + "=") + name.length + 1;
    if (i < name.length + 1) return null;
    // brace-match
    let depth = 0, inStr = false, esc = false;
    for (let j = i; j < html.length; j++) {
      const c = html[j];
      if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
      if (c === '"') inStr = true; else if (c === "{") depth++; else if (c === "}") { depth--; if (!depth) return JSON.parse(html.slice(i, j + 1)); }
    }
    return null;
  };
  const pr = grab("var ytInitialPlayerResponse");
  const d = grab("var ytInitialData");
  const lcr = d?.contents?.twoColumnWatchNextResults?.conversationBar?.liveChatRenderer;
  // subMenu: [Top chat, Live chat]; "Live chat" (all messages) is the one Twitch-like speed needs.
  const items = lcr?.header?.liveChatHeaderRenderer?.viewSelector?.sortFilterSubMenuRenderer?.subMenuItems || [];
  const all = items.find((x) => /live chat/i.test(x.title) && !/top/i.test(x.title)) || items[1] || items[0];
  return {
    pr, isReplay: lcr?.isReplay, cont: lcr?.continuations?.[0]?.reloadContinuationData?.continuation, subCont: all?.continuation?.reloadContinuationData?.continuation,
    menu: items.map((x) => x.title),
    visitor: html.match(/"VISITOR_DATA":"([^"]+)"/)?.[1],
  };
}

function textOf(m) { return (m?.runs || []).map((r) => r.text ?? (r.emoji ? (r.emoji.shortcuts?.[0] || r.emoji.emojiId) : "")).join(""); }

export function parseActions(actions) {
  const out = [];
  for (const a of actions || []) {
    const rep = a.replayChatItemAction;
    const off = rep ? Number(rep.videoOffsetTimeMsec) : null;
    for (const b of rep ? rep.actions : [a]) {
      const it = b.addChatItemAction?.item;
      const r = it?.liveChatTextMessageRenderer || it?.liveChatPaidMessageRenderer;
      if (!r) continue;
      out.push({ id: r.id, t: off != null ? off / 1000 : null, us: Number(r.timestampUsec), text: textOf(r.message), paid: !!it.liveChatPaidMessageRenderer });
    }
  }
  return out;
}

export async function replayPage(cont, offsetMs, origin) {
  const body = { context: { client: { clientName: "WEB", clientVersion: VER, hl: "en", gl: "US" } }, continuation: cont, currentPlayerState: { playerOffsetMs: String(Math.floor(offsetMs)) } };
  const h = { "content-type": "application/json", "user-agent": UA };
  if (origin) h.origin = origin;
  const r = await fetch("https://www.youtube.com/youtubei/v1/live_chat/get_live_chat_replay?prettyPrint=false", { method: "POST", headers: h, body: JSON.stringify(body) });
  const j = await r.json().catch(() => null);
  const lc = j?.continuationContents?.liveChatContinuation;
  const next = lc?.continuations?.[0];
  return { status: r.status, acao: r.headers.get("access-control-allow-origin"), msgs: parseActions(lc?.actions), next: next?.liveChatReplayContinuationData?.continuation || next?.playerSeekContinuationData?.continuation, nextKind: next && Object.keys(next)[0] };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const id = process.argv[2] || "uDwiE9saR0c";
  const w = await watchPage(id);
  console.log("isReplay", w.isReplay, "menu", w.menu, "cont", !!w.cont);
  for (const off of [0, 3600_000, 7200_000, 14400_000, 20000_000]) {
    const t0 = Date.now();
    const p = await replayPage(w.cont, off);
    const ts = p.msgs.map((m) => m.t).filter((x) => x != null);
    console.log(`offset ${off / 1000}s -> ${p.status} ${p.msgs.length} msgs, t ${Math.min(...ts)}..${Math.max(...ts)} next=${p.nextKind} ${Date.now() - t0}ms`);
    if (off === 3600_000) console.log("  sample:", p.msgs.slice(0, 5).map((m) => `[${m.t}] ${m.text}`).join(" | "));
  }
  // Follow the replay continuation from 1h for 3 pages: contiguous?
  let p = await replayPage(w.cont, 3600_000);
  for (let i = 0; i < 3; i++) {
    const ts = p.msgs.map((m) => m.t);
    console.log(`follow ${i}: ${p.msgs.length} msgs ${Math.min(...ts)}..${Math.max(...ts)}`);
    p = await replayPage(p.next, 0);
  }
  // CORS: does youtubei answer a foreign Origin?
  const c = await replayPage(w.cont, 0, "https://heistclips.com");
  console.log("with Origin heistclips.com ->", c.status, "ACAO:", c.acao, "msgs", c.msgs.length);
}
