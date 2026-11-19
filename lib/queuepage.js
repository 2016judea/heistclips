// /queue: the autopilot page. Server sends the shell; public/js/queue.js fills it from
// /api/queue. Styles live here so the shared stylesheet is untouched.
import { layout, FREE_CLIPS } from "./render.js";

const CSS = `<style>
.q-h1{font-size:clamp(30px,8vw,46px)}
.q-add{display:flex;gap:8px;margin:14px 0 6px}
.q-add input{flex:1 1 0;min-width:0;font-size:16px;padding:13px 14px;border-radius:12px;border:1px solid #3a3a44;background:#0f0f13;color:var(--ink)}
.q-add input:focus{outline:2px solid var(--acc);outline-offset:1px}
.q-sug{display:flex;gap:8px;overflow-x:auto;padding:6px 0 10px;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.q-sug::-webkit-scrollbar{display:none}
.q-sug button{flex:none;display:flex;gap:8px;align-items:center;font:inherit;font-size:14px;color:var(--ink);background:var(--panel);border:1px solid var(--line);border-radius:999px;padding:6px 12px 6px 6px;min-height:44px;cursor:pointer}
.q-sug button.on{border-color:var(--acc);background:#1c2409}
.q-sug img,.q-who img,.q-watch img{width:30px;height:30px;border-radius:50%;background:#222;flex:none;object-fit:cover}
.q-sug small{color:var(--acc);font-weight:700}
.q-watch{display:flex;gap:8px;overflow-x:auto;margin:0 0 4px;padding:0 0 4px;list-style:none;scrollbar-width:none}
.q-watch::-webkit-scrollbar{display:none}
.q-watch li{flex:none}
#q-root{display:flex;flex-direction:column}
#q-root.has #q-watch{order:1}#q-root.has #q-status{order:2}#q-root.has #q-list{order:3}#q-root.has #q-addh{order:4;display:block}#q-root.has #q-add{order:5}#q-root.has #q-more{order:7}#q-root.has #q-foot{order:8}
#q-addh{display:none;margin:18px 0 0;font-size:18px}
.q-watch li{display:flex;align-items:center;gap:8px;background:var(--panel);border:1px solid var(--line);border-radius:999px;padding:5px 6px 5px 6px;font-size:14px;min-height:44px}
.q-watch .dot{width:8px;height:8px;border-radius:50%;background:var(--bad);flex:none}
.q-watch button{font:inherit;background:none;border:0;color:var(--mute);cursor:pointer;min-width:40px;min-height:40px;border-radius:50%}
.q-watch button:hover{color:var(--bad)}
.q-pays{list-style:none;padding:0;margin:8px 0 4px;display:flex;flex-direction:column;gap:8px}
.q-pays li{display:grid;grid-template-columns:40px 1fr auto;gap:10px;align-items:center;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:10px 12px}
.q-pays img,.q-pays .ph{width:40px;height:40px;border-radius:50%;background:#222;object-fit:cover}
.q-pays .who{min-width:0;display:flex;flex-direction:column;align-items:flex-start;text-align:left}
.q-pays .ph{display:flex;align-items:center;justify-content:center;font-weight:900;color:var(--mute);text-transform:uppercase}
.q-pays .who b{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.q-pays .who span{color:var(--mute);font-size:13px}
.q-pays .amt{color:var(--acc);font-weight:800}
.q-pays .q-live{color:var(--bad);font-weight:800;font-size:11px;margin-left:6px}
#q-payh{font-size:18px;margin:18px 0 0}
#q-payh small{display:block;color:var(--mute);font-weight:400;font-size:13px;margin-top:2px}
#q-root.has #q-payh{order:6}#q-root.has #q-pays{order:6}#q-root.has #q-paymore{order:6}
.q-list{list-style:none;padding:0;margin:14px 0;display:flex;flex-direction:column;gap:12px}
.q-item{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:14px}
.q-item.q-paid{border-color:#3f4a1c}
.q-who{display:flex;align-items:center;gap:8px;font-size:14px;color:var(--mute)}
.q-who b{color:var(--ink)}
.q-who .q-live{color:var(--bad);font-weight:800;font-size:12px}
.q-hook{font-size:22px;font-weight:900;letter-spacing:-.02em;line-height:1.15;margin:10px 0 6px}
.q-quote{color:#b9b9c2;font-size:14px;margin:0 0 10px;overflow-wrap:anywhere}
.q-pay{border-top:1px solid var(--line);padding-top:10px;margin-top:6px;font-size:14px}
.q-pay b.big{font-size:20px;color:var(--acc);font-weight:900;margin-right:6px}
.q-pay .lab{display:block;color:var(--mute);font-size:12px;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px}
.q-pay ul{margin:6px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px}
.q-pay a{font-weight:700}
.q-todo{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
.q-act{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
.q-act .btn{flex:1 1 auto;text-align:center;padding-inline:12px}
.q-act .btn.ghost{flex:0 1 auto}
.q-card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:14px;margin:14px 0}
.q-card h2{margin:0 0 6px;font-size:18px}
.q-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.q-row input{flex:1 1 180px;min-width:0;font-size:16px;padding:11px 12px;border-radius:12px;border:1px solid #3a3a44;background:#0f0f13;color:var(--ink)}
.q-empty{color:#d4d4d8;padding:18px 4px}
.q-status{color:var(--mute);font-size:14px;min-height:22px;margin:6px 0}
.q-spin{display:inline-block;width:12px;height:12px;border:2px solid #444;border-top-color:var(--acc);border-radius:50%;animation:qsp .8s linear infinite;vertical-align:-1px;margin-right:6px}
@keyframes qsp{to{transform:rotate(360deg)}}
@media(min-width:700px){.q-hook{font-size:26px}}
</style>`;

export function queuePage() {
  const body = `
<div id="q-root">
<section id="q-start">
<h1 class="q-h1">Wake up to clips.</h1>
<p class="lede">Pick the streamers you clip. heistclips watches their streams, finds the moments chat exploded, and lines each one up with the campaign that pays most for it.</p>
</section>
<h2 id="q-addh">Watch another streamer</h2>
<form class="q-add" id="q-add" autocomplete="off">
<input id="q-in" name="ch" placeholder="Twitch or Kick channel" aria-label="Twitch or Kick channel to watch" autocapitalize="off" spellcheck="false" enterkeyhint="go">
<button class="btn" id="q-go">Watch</button>
</form>
<h2 id="q-payh" hidden>Paying right now<small>Streamers a live campaign pays you to clip, best pay first. Fewer clippers means less competition.</small></h2>
<ol class="q-pays" id="q-pays"></ol>
<div id="q-paymore"></div>
<p class="q-status" id="q-status" role="status"></p>
<ul class="q-watch" id="q-watch"></ul>
<ol class="q-list" id="q-list"></ol>
<div id="q-more"></div>
<p class="small" id="q-foot">Finding clips is free. A queued clip costs one clip only when you export it: ${FREE_CLIPS} free, then <a href="/pricing">packs</a>. Streams are re-read every 10 minutes.</p>
</div>
<noscript><p class="note">The queue needs JavaScript.</p></noscript>
<script type="module" src="/js/queue.js?v=2"></script>`;
  return layout({
    title: "Clip autopilot – a queue of ready GTA 6 clips, matched to the campaign that pays | heistclips",
    desc: "Pick the streamers you clip. heistclips watches their Twitch and Kick streams, finds the moments chat exploded, matches each to the best-paying campaign it fits, and fills a queue of clips ready to post.",
    path: "/queue", body, extraHead: CSS,
  });
}
