// /launch (an owner funds a hosted campaign, then watches it) and /earnings (a clipper sees what
// they earned and says where to send it). Both are one page each, phone first; the work is done
// by public/js/launch.js and public/js/earnings.js against api/hosted.js.
import { layout, esc } from "./render.js";
import { feePct, LIMITS, FRESH_HOURS, MARKET } from "./hosted.js";
import { quantiles } from "./campaigns.js";

const STYLE = `<style>
.ln section{margin:0 0 8px}
.ln h1{margin-bottom:.25em}
.ln .eyebrow{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--mute);margin:0 0 8px}
.ln .step{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:18px 16px;margin:14px 0}
.ln .step h2{margin:0 0 6px;font-size:20px}
.ln .who{display:flex;gap:12px;align-items:center;margin:4px 0 12px}
.ln .who img{width:44px;height:44px;border-radius:50%;background:#222}
.ln .code{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0}
.ln .code b{font:700 20px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.02em;background:#0f0f13;border:1px dashed #4a4a55;border-radius:10px;padding:10px 12px;user-select:all;overflow-wrap:anywhere}
.ln .nums{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin:12px 0;padding:0;list-style:none}
.ln #p-nums{grid-template-columns:repeat(3,minmax(0,1fr))}
.ln .nums li{border:1px solid var(--line);border-radius:12px;padding:12px}
.ln .nums b{display:block;font-size:28px;line-height:1.1;color:var(--acc);font-variant-numeric:tabular-nums}
.ln .nums span{font-size:13px;color:var(--mute)}
.ln .moments{list-style:none;padding:0;margin:8px 0 0;display:flex;flex-direction:column;gap:6px}
.ln .moments li{font-size:14px;border-top:1px solid var(--line);padding-top:6px;overflow-wrap:anywhere}
.ln form.f{display:grid;grid-template-columns:1fr 1fr;gap:12px 12px}
.ln form.f .full{grid-column:1/-1}
.ln label{display:flex;flex-direction:column;gap:4px;font-size:14px;color:#d4d4d8;font-weight:600}
.ln label small{font-weight:400;color:var(--mute)}
.ln input[type=text],.ln input[type=number],.ln input[type=email],.ln textarea{font:inherit;font-size:17px;padding:12px;border-radius:10px;border:1px solid #3a3a44;background:#0f0f13;color:var(--ink);width:100%;min-width:0}
.ln input:focus,.ln textarea:focus{outline:2px solid var(--acc);outline-offset:1px}
.ln .checks{display:flex;gap:16px;flex-wrap:wrap}
.ln .checks label{flex-direction:row;align-items:center;gap:8px;font-weight:600;min-height:44px}
.ln .checks input{width:22px;height:22px;accent-color:var(--acc)}
.ln .total{font-size:15px;color:#d4d4d8;margin:4px 0 0}
.ln .total b{color:var(--ink)}
.ln .err{color:var(--bad);font-weight:600;min-height:1.2em;margin:6px 0 0}
.ln .ok{color:var(--ok);font-weight:700}
.ln .wait{color:var(--mute)}
.ln .camp{display:block;background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:16px;margin:12px 0}
.ln .camp h3{margin:0 0 4px}
.ln .subs{list-style:none;padding:0;margin:10px 0 0}
.ln .subs li{border-top:1px solid var(--line);padding:10px 0;display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;font-size:14px}
.ln .subs a{overflow-wrap:anywhere}
.ln .flag{color:var(--warn);font-weight:700}
.ln .keep{font-size:13px;color:var(--mute);overflow-wrap:anywhere}
.ln .how{font-size:13px;color:var(--mute);margin-top:22px}
@media (max-width:520px){.ln form.f{grid-template-columns:1fr}}
</style>`;

// What live GTA campaigns pay per 1K views right now (the middle half), from the snapshot, so
// the owner sets a rate against the market instead of a number typed into this file.
export function marketRates(snap) {
  const xs = ((snap && snap.campaigns) || []).filter((c) => c.is_gta && c.marketplace !== MARKET && c.rate_per_1k > 0).map((c) => c.rate_per_1k);
  if (xs.length < 4) return null;
  const [p25, p50, p75] = quantiles(xs, [0.25, 0.5, 0.75]);
  return { n: xs.length, p25, p50, p75 };
}

export function launchPage(snap = null) {
  const fee = feePct();
  const mr = marketRates(snap);
  const [bLo] = LIMITS.budget;
  const body = `
<div class="ln" id="ln" data-fee="${fee}" data-min="${bLo}">
<section id="s-hero">
<p class="eyebrow">For streamers, managers and studios</p>
<h1>Pay clippers per view. We check every view.</h1>
<p class="lede">Fund a clipping campaign for your Twitch streams. Clippers cut, post and submit; heistclips checks each clip is real and theirs, and counts its views. ${fee}% fee. Nothing monthly.</p>
<form class="paste" id="f-channel" autocomplete="off">
<input name="channel" id="i-channel" placeholder="Your Twitch channel" aria-label="Your Twitch channel" autocapitalize="off" spellcheck="false" required>
<button>Continue</button>
</form>
<p class="err" id="e-channel" role="alert"></p>
</section>

<section class="step" id="s-prove" hidden>
<div class="who"><img id="p-avatar" alt="" width="44" height="44"><div><b id="p-name"></b><br><span class="small">Prove this channel is yours</span></div></div>
<p id="p-oauth" hidden><a class="btn" id="b-twitch" href="#">Sign in with Twitch</a> <span class="small">or use a code:</span></p>
<p>Put this code in your Twitch bio (Settings › Profile › Bio) or in any panel, save, then press Check. Take it out after.</p>
<div class="code"><b id="p-code"></b><button class="btn ghost sm" id="b-copy" type="button">Copy</button></div>
<p class="actions"><button class="btn" id="b-check" type="button">Check</button></p>
<p class="err" id="e-prove" role="alert"></p>
</section>

<section class="step" id="s-pitch" hidden>
<h2 id="t-pitch">Reading your last streams…</h2>
<p class="wait" id="p-wait">Reading chat from your last two streams. This takes 10 to 40 seconds.</p>
<ul class="nums" id="p-nums" hidden></ul>
<ul class="moments" id="p-moments"></ul>
<p class="small" id="p-how" hidden>Flagged: where chat ran far above its normal speed. A clip we found: one of your 100 most-viewed Twitch clips this week inside the moment, or a clip cut on heistclips. Clips made anywhere else are not visible to us. Only you see this.</p>
</section>

<section class="step" id="s-form" hidden>
<h2>Your campaign</h2>
<form class="f" id="f-camp" novalidate>
<label>Budget, paid to clippers<input type="number" name="budget" id="i-budget" min="${bLo}" step="1" value="500" inputmode="decimal" required><small>$${bLo} minimum</small></label>
<label>Rate per 1,000 views<input type="number" name="rate_per_1k" id="i-rate" min="0.1" step="0.05" value="1" inputmode="decimal" required><small>${mr ? `${mr.n} live GTA campaigns pay $${mr.p25} to $${mr.p75} (the middle half)` : "What a clip earns per 1,000 views"}</small></label>
<label>View floor<input type="number" name="floor_views" id="i-floor" min="0" step="100" value="1000" inputmode="numeric"><small>A clip earns nothing until it passes this</small></label>
<label>Cap per clip<input type="number" name="cap_per_clip" id="i-cap" min="1" step="1" value="50" inputmode="decimal" required><small>The most one clip can earn</small></label>
<div class="full"><span class="small">Platforms</span><div class="checks"><label><input type="checkbox" name="platforms" value="tiktok" checked> TikTok</label><label><input type="checkbox" name="platforms" value="youtube" checked> YouTube Shorts</label></div><small class="small">Instagram and X are not offered yet: their views can't be read without the clipper's login.</small></div>
<label>Shortest clip, seconds<input type="number" name="min_secs" id="i-min" min="5" max="180" placeholder="any" inputmode="numeric"></label>
<label>Longest clip, seconds<input type="number" name="max_secs" id="i-max" min="5" max="180" value="60" inputmode="numeric"></label>
<div class="full checks"><label><input type="checkbox" name="facecam_required" value="1"> Facecam must show</label></div>
<label class="full">Tags the caption must include<input type="text" name="required_tags" id="i-tags" placeholder="#yourname #gta6" autocapitalize="off" spellcheck="false"></label>
<label class="full">Anything else clippers should know<textarea name="notes" id="i-notes" rows="2" maxlength="400" placeholder="No spoilers past the story mission. No music over the clip."></textarea></label>
<p class="full total" id="p-total"></p>
<p class="full"><button class="btn" id="b-pay">Pay with Stripe</button></p>
<p class="full err" id="e-form" role="alert"></p>
<p class="full small">Clippers must post within ${FRESH_HOURS} hours from an account they proved is theirs. Views are read from each post's public page every 30 minutes; a sudden jump is flagged for you, never paid on its own. Budget not earned by clippers is refunded on request. You can reject any clip from your dashboard.</p>
</form>
</section>

<section id="s-dash" hidden>
<h2 id="t-dash">Your campaigns</h2>
<div id="d-list"></div>
<p class="keep" id="d-keep"></p>
<p class="actions"><button class="btn ghost" id="b-new" type="button">Start another campaign</button></p>
</section>

<p class="how">Campaigns hosted on heistclips are listed for clippers on the site and in the heistclips connector for ChatGPT and Claude, ranked only by what they pay a clip, the same as every other campaign. Nobody pays to rank higher.</p>
</div>
<script type="module" src="/js/launch.js?v=1"></script>`;
  return layout({
    title: "Launch a clipping campaign, pay per verified view | heistclips",
    desc: "Fund a clipping campaign for your Twitch streams. Clippers cut, post and submit; heistclips checks each clip and counts its views. " + fee + "% fee, nothing monthly.",
    path: "/launch", body, extraHead: STYLE,
  });
}

export function earningsPage() {
  const body = `
<div class="ln" id="en">
<p class="eyebrow">Clipper earnings</p>
<h1>Your clipping earnings</h1>
<p class="lede" id="e-lede">Earnings from campaigns hosted on heistclips, from the views each clip has had.</p>
<form class="paste" id="f-acct" autocomplete="off" hidden>
<input name="a" id="i-acct" placeholder="Your heistclips account code (hc_…)" aria-label="Account code" autocapitalize="off" spellcheck="false">
<button>Show</button>
</form>
<p class="err" id="e-acct" role="alert"></p>
<ul class="nums" id="e-nums" hidden></ul>
<div id="e-subs"></div>
<section class="step" id="s-pay" hidden>
<h2 id="t-pay">Where should we send your payouts?</h2>
<p class="small">Payouts go out weekly by PayPal. Type the email of your PayPal account. Only heistclips sees it.</p>
<form class="paste" id="f-pay" autocomplete="off"><input type="email" name="to" id="i-pay" placeholder="you@example.com" aria-label="PayPal email" required><button>Save</button></form>
<p class="err" id="e-pay" role="alert"></p>
</section>
<p class="how">Ask your assistant to check with my_earnings any time. Payouts are made here on heistclips.com, never in a chat.</p>
</div>
<script type="module" src="/js/earnings.js?v=1"></script>`;
  return layout({ title: "Your clipping earnings | heistclips", desc: "Views and earnings from campaigns hosted on heistclips.", path: "/earnings", body, extraHead: STYLE, noindex: true });
}

export const _esc = esc;
