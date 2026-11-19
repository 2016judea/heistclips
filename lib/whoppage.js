// HTML for the Whop app views (rendered inside Whop's iframe). A slim shell: no site nav, the
// shared stylesheet, Vercel analytics and PostHog like every other page. public/js/whop.js
// draws the view from the JSON embedded here.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { esc, FREE_CLIPS } from "./render.js";

const here = path.dirname(fileURLToPath(import.meta.url));
let POSTHOG = "";
try { POSTHOG = fs.readFileSync(path.join(here, "posthog.html"), "utf8"); } catch (e) { POSTHOG = ""; }

const CSS = `<style>
body{background:var(--bg)}
.w-wrap{max-width:760px;margin:0 auto;padding:18px 16px 40px}
.w-brand{font-weight:900;letter-spacing:-.02em;font-size:16px;color:var(--mute);margin-bottom:10px}.w-brand b{color:var(--acc)}
.w-camp{background:var(--panel);border:1px solid #3f4a1c;border-radius:16px;padding:14px;margin-bottom:14px}
.w-camp h1{font-size:22px;margin:0 0 4px;letter-spacing:-.02em;line-height:1.15}
.w-camp .nums{display:flex;gap:14px;flex-wrap:wrap;margin:8px 0 6px}
.w-camp .nums div{display:flex;flex-direction:column}.w-camp .nums b{font-size:20px;color:var(--acc);font-weight:900}.w-camp .nums span{color:var(--mute);font-size:12px}
.w-h2{font-size:18px;margin:18px 0 6px}
.w-list{list-style:none;padding:0;margin:8px 0;display:flex;flex-direction:column;gap:12px}
.w-item{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:14px}
.w-who{display:flex;align-items:center;gap:8px;font-size:14px;color:var(--mute)}.w-who b{color:var(--ink)}
.w-who img{width:30px;height:30px;border-radius:50%;background:#222;object-fit:cover}
.w-live{color:var(--bad);font-weight:800;font-size:12px}
.w-hook{font-size:22px;font-weight:900;letter-spacing:-.02em;line-height:1.15;margin:10px 0 6px}
.w-quote{color:#b9b9c2;font-size:14px;margin:0 0 8px;overflow-wrap:anywhere}
.w-act{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}.w-act .btn{flex:1 1 auto;text-align:center;padding-inline:12px}.w-act .btn.ghost{flex:0 1 auto}
.w-card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:14px;margin:14px 0}
.w-card h2{margin:0 0 6px;font-size:18px}
.w-card label{display:block;font-size:13px;color:var(--mute);margin:10px 0 4px}
.w-card input{width:100%;font-size:16px;padding:12px;border-radius:12px;border:1px solid #3a3a44;background:#0f0f13;color:var(--ink)}
.w-res{list-style:none;padding:0;margin:8px 0;display:flex;flex-direction:column;gap:6px}
.w-res button{width:100%;text-align:left;font:inherit;color:var(--ink);background:#0f0f13;border:1px solid var(--line);border-radius:12px;padding:10px 12px;cursor:pointer;min-height:48px}
.w-res button.on{border-color:var(--acc);background:#1c2409}.w-res small{display:block;color:var(--mute)}
.w-status{color:var(--mute);font-size:14px;min-height:20px;margin:8px 0}
.w-find{display:flex;gap:8px;margin-top:8px}.w-find input{flex:1 1 0;min-width:0;font-size:16px;padding:12px;border-radius:12px;border:1px solid #3a3a44;background:#0f0f13;color:var(--ink)}
</style>`;

function shell(title, body, data) {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="robots" content="noindex">
<meta name="theme-color" content="#0b0b0d">
<link rel="icon" href="/img/icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/site.css?v=5">
<script>window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)}</script><script defer src="/_vercel/insights/script.js"></script>
${POSTHOG}
${CSS}
</head><body>
<div class="w-wrap">
<div class="w-brand">heist<b>clips</b></div>
${body}
</div>
${data ? `<script id="w-data" type="application/json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script><script type="module" src="/js/whop.js?v=2"></script>` : ""}
</body></html>`;
}

export function whopPage({ view, data }) {
  return shell(view === "dash" ? "heistclips settings" : "heistclips", `<div id="w-app"><p class="small">Loading…</p></div>
<p class="small">Finding clips is free. Exporting a clip costs one clip: ${FREE_CLIPS} free per browser, then <a href="/pricing" target="_blank" rel="noopener">packs</a>.</p>`, { view, ...data });
}

// Opened outside Whop (no user token), or refused.
export function whopOutsidePage(why) {
  return shell("heistclips for Whop", `<h1>heistclips for Whop</h1>
<p class="lede">${esc(why || "This page is the heistclips app. It runs inside a Whop: a campaign owner installs it, and their clippers get a queue of ready clips for that campaign.")}</p>
<p><a class="btn" href="https://whop.com/apps/app_my7kSid9rb0xHU/install" target="_blank" rel="noopener">Install on your Whop</a> <a class="btn ghost" href="/queue">Use the queue without Whop</a></p>`, null);
}
