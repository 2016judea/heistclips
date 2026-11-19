// Guides: short, honest, and every number is read from the live snapshot at render time.
import { layout, money, esc, campaignList, SITE } from "./render.js";
import { ctaBox } from "./i18n.js";

const faqLd = (faq) => ({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) });
const article = (slug, title, snap) => ({ "@context": "https://schema.org", "@type": "Article", headline: title, url: `${SITE}/guides/${slug}`, dateModified: snap.generated_at, author: { "@type": "Organization", name: "heistclips" } });

export const GUIDES = [
  { slug: "how-much-does-gta-6-clipping-pay", title: "How much does GTA 6 clipping pay?", page: payGuide },
  { slug: "gta-6-music-copyright-claims", title: "GTA 6 clips and music claims: why radio kills the payout", page: musicGuide },
  { slug: "shorts-money-vs-clipping-campaigns", title: "YouTube Shorts money vs clipping campaigns", page: shortsGuide },
  { slug: "how-to-clip-gta-6-streams", title: "How to clip GTA 6 streams, fast", page: howtoGuide },
  { slug: "reused-content-shadowbans-posting-cadence", title: "Reused content, shadowbans and how often to post clips", page: reusedGuide },
];

function reusedGuide(snap) {
  const faq = [
    ["Why did YouTube demonetize my clip channel for reused content?", "YouTube's Partner Program does not pay for content that repeats someone else's video without adding something of your own. A clip channel that only reposts stream footage can be refused or demonetized under that policy. Campaign payouts are separate from YouTube's: a campaign pays per view on approved clips whether or not your channel is monetized."],
    ["How many clips a day can I post on a new account?", "Clippers report getting shadowbanned when a brand-new account posts more than three to five times a day. Warm the account up with a few days of normal use, then post a handful a day and raise it slowly."],
    ["Does posting the same clip on several accounts get flagged?", "Identical uploads are easy for platforms to match. Change something real each time: the hook in the first second, the cut, the layout. heistclips gives every moment 3 to 5 different hooks for that reason."],
  ];
  const body = `<h1>Reused content, shadowbans and how often to post</h1>
<p class="lede">Clipping money comes from campaigns, not from the platform. Protect the account that earns it.</p>
<h2>Reused content</h2>
<p>YouTube’s Partner Program can refuse or demonetize a channel that only reposts other people’s footage. That affects YouTube’s own ad share, not a campaign’s payout. If you clip for campaigns, the campaign is the income; treat Shorts revenue as a bonus.</p>
<h2>Shadowbans on new accounts</h2>
<p>The pattern clippers report: a new account posts 10 clips on day one and its views fall to zero. Use the account normally for a few days first, then post three to five a day and build from there.</p>
<h2>Make every post different</h2>
<p>Platforms match identical uploads. Change the first second (the hook), the cut and the layout per post. heistclips writes 3–5 hooks per moment and renders each one as its own file, with no watermark and no AI-generated tag in the file.</p>
<p><a class="btn" href="/clip">Cut a moment</a></p>
${faq.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join("")}`;
  return { title: "Reused content, shadowbans and posting cadence for clip accounts | heistclips", desc: "Why clip channels get demonetized for reused content, how many clips a new account can post before a shadowban, and how to make each upload different.", body, jsonld: [faqLd(faq)] };
}

export function guidesIndex(snap) {
  const body = `<h1>Guides</h1><ul class="vods">${GUIDES.map((g) => `<li><a href="/guides/${g.slug}"><b>${esc(g.title)}</b></a></li>`).join("")}</ul>`;
  return layout({ title: "GTA 6 clipping guides | heistclips", desc: "What GTA 6 clipping pays, how music claims work, Shorts money vs campaigns, and how to clip a stream fast.", path: "/guides", body });
}

function payGuide(snap) {
  const s = snap.summary;
  const gta = snap.campaigns.filter((c) => c.is_gta);
  const ex = { rate: s.rate_per_1k_median || 1, cap: s.cap_median || 100 };
  const capViews = Math.round(ex.cap / ex.rate * 1000);
  const faq = [
    ["How much does GTA 6 clipping pay?", `Right now the median campaign pays ${money(ex.rate)} per 1,000 views with a cap of ${money(ex.cap, 0)} per clip. Across ${s.with_track_record} campaigns with a track record, a typical approved clip has earned ${money(s.earned_per_clip_median)}; the top tenth of campaigns pay ${money(s.earned_per_clip_p90)} or more per clip.`],
    ["How is clipping pay calculated?", `Views on the clip × the rate per 1,000 views, up to the cap per clip, for as long as the campaign has budget. At ${money(ex.rate)}/1k a clip needs ${capViews.toLocaleString("en-US")} views to hit a ${money(ex.cap, 0)} cap.`],
    ["Do all views count?", "Only views on clips the campaign approves, and most campaigns reject botted views, reposts and clips that break their rules. Money also stops when the budget runs out, even if your clip keeps getting views."],
  ];
  const body = `<h1>How much does GTA 6 clipping pay?</h1>
<p class="updated">Numbers on this page are live, read from ${s.campaigns} campaigns at ${esc(new Date(snap.generated_at).toUTCString())}.</p>
<p class="lede">A typical approved clip earns <b>${money(s.earned_per_clip_median)}</b>. The best-paying tenth of campaigns pay <b>${money(s.earned_per_clip_p90)}+</b> for the same clip. Which campaign you pick matters more than how good the clip is.</p>
<h2>The formula</h2>
<p>Pay per clip = views × rate per 1,000 views, up to the cap, while budget lasts.</p>
<ul class="facts">
<li>Median rate: <b>${money(ex.rate)}</b> per 1,000 views.</li>
<li>Median cap: <b>${money(ex.cap, 0)}</b> per clip, reached at ${capViews.toLocaleString("en-US")} views.</li>
<li>Median views per approved clip: <b>${(s.views_per_clip_median || 0).toLocaleString("en-US")}</b>.</li>
<li>Budget left across every campaign: <b>${money(s.budget_left_total, 0)}</b>.</li>
</ul>
<h2>Why most clips earn less than the rate suggests</h2>
<p>Three things eat the money: a clip that never gets approved, a budget that runs out before your views come in, and a campaign so crowded that every moment is already posted. The ranking on <a href="/gta-6-clipping-campaigns">the campaigns page</a> uses what clips have actually earned, so those three are already in the number.</p>
<h2>GTA campaigns live right now</h2>
${gta.length ? campaignList(gta.slice(0, 10)) : "<p>None this minute. They open in waves around launch.</p>"}
${faq.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join("")}`;
  return { title: "How much does GTA 6 clipping pay? Live rates per clip | heistclips", desc: `A typical approved clip earns ${money(s.earned_per_clip_median)}; top campaigns pay ${money(s.earned_per_clip_p90)}+. Live clipping rates, caps and budgets, updated every 30 minutes.`, body, jsonld: [faqLd(faq)] };
}

function musicGuide(snap) {
  const faq = [
    ["Can I use GTA radio music in clips?", "Not safely. The songs on in-game radio are licensed commercial music. Twitch mutes them in saved streams, and YouTube Content ID and TikTok's matching can claim or mute a clip that carries them."],
    ["What happens if my clip gets a music claim?", "On YouTube the claimant can take the revenue or block the video; on TikTok the sound can be muted. Many clipping campaigns reject or stop paying on clips with claims or muted audio."],
    ["How do I know if a moment has licensed music?", "heistclips checks whether Twitch muted that stretch of the stream. Twitch mutes audio when its matcher hears licensed music, so a muted stretch is a strong warning. It also flags moments where chat is talking about a song."],
  ];
  const body = `<h1>GTA 6 clips and music claims</h1>
<p class="lede">The fastest way to lose a clip’s payout is a song on the car radio. Check the audio before you post.</p>
<h2>Why it happens</h2>
<p>GTA’s radio stations play real, licensed songs. A streamer driving with the radio on is broadcasting those songs. Twitch mutes them in the saved stream when its matcher catches them, and YouTube and TikTok run their own matchers on every upload.</p>
<h2>What it costs you</h2>
<ul class="facts"><li>YouTube: a Content ID claim can send the clip’s money to the label or block it.</li><li>TikTok: the sound can be muted, which kills a reaction clip.</li><li>Campaigns: many reject claimed or muted clips, so the views never get paid.</li></ul>
<h2>How heistclips flags it</h2>
<p>Every moment it finds is checked against the stretches Twitch muted for music in that stream. If the moment overlaps one, it is marked <b>high music risk</b>. If chat is talking about a song, it is marked <b>medium</b>. Pick moments marked low, or cut the clip to the part without the radio.</p>
<p><a class="btn" href="/clip">Check a stream</a></p>
${faq.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join("")}`;
  return { title: "GTA 6 clips and music copyright claims – avoid the radio | heistclips", desc: "In-game radio is licensed music. How Content ID and TikTok claims kill clip payouts, and how to spot a risky moment before you post.", body, jsonld: [faqLd(faq)] };
}

function shortsGuide(snap) {
  const s = snap.summary;
  const body = `<h1>YouTube Shorts money vs clipping campaigns</h1>
<p class="lede">Shorts pays from a shared pool. A campaign pays a fixed rate per view. For a clip of someone else’s stream, the campaign is usually the only money there is.</p>
<h2>How Shorts pays</h2>
<p>YouTube pools ad revenue from the Shorts feed, sets part of it aside for music licensing, and pays creators in the Partner Program 45% of what is left, split by views. You need to be in the Partner Program first, and a clip of another creator’s stream can be refused as reused content.</p>
<h2>How campaigns pay</h2>
<p>A streamer or brand puts up a budget and pays a fixed rate per 1,000 views on approved clips: ${money(s.rate_per_1k_median)} is the median today, capped at ${money(s.cap_median, 0)} per clip. You do not need a monetized channel; you need views and an approved clip.</p>
<h2>What to do</h2>
<p>Post the clip where the campaign pays (most pay on TikTok, Shorts and Reels at once) and claim it. Anything Shorts adds on top is a bonus.</p>
<p><a class="btn" href="/gta-6-clipping-campaigns">See what campaigns pay today</a></p>`;
  return { title: "YouTube Shorts money vs clipping campaigns for GTA 6 clips | heistclips", desc: `Shorts pays from a shared pool; campaigns pay a fixed rate per view (median ${money(s.rate_per_1k_median)}/1k today). Which one pays for GTA 6 stream clips.`, body, jsonld: [] };
}

function howtoGuide(snap) {
  const steps = [
    ["Pick the money first", "Open the campaigns page and pick a campaign that pays for the streamer you will clip, with budget for at least three more days."],
    ["Paste the channel", "Paste the streamer’s Twitch channel into heistclips. If they are live, it watches chat as it happens; if not, it reads their latest stream."],
    ["Take the biggest spike", "Moments are ranked by how much faster chat went than normal, how many people typed “clip it”, and whether Twitch viewers already clipped it."],
    ["Check the music flag", "Skip moments marked high music risk, or trim the radio out."],
    ["Cut it with a hook", "Pick a layout, pick or write a hook for the first second, and render. The clip is made in your browser and downloads as a video file."],
    ["Post and claim", "Post to every platform the campaign pays on and submit the links on the campaign page. Post fast: the first upload of a moment gets the views."],
  ];
  const body = `<h1>How to clip GTA 6 streams, fast</h1>
<p class="lede">Launch week rewards the first clip of a moment, not the best one. This is the shortest path from a live stream to a posted clip.</p>
<ol class="steps">${steps.map(([h, p]) => `<li><b>${esc(h)}</b><p>${esc(p)}</p></li>`).join("")}</ol>
<p><a class="btn" href="/clip">Open the clip tool</a></p>`;
  return { title: "How to clip GTA 6 streams fast – live moments to posted clips | heistclips", desc: "Six steps from a live GTA 6 stream to a posted, paid clip: pick the campaign, find the chat spike, check music, cut 9:16 with a hook, post first.", body,
    jsonld: [{ "@context": "https://schema.org", "@type": "HowTo", name: "How to clip GTA 6 streams", step: steps.map(([h, p], i) => ({ "@type": "HowToStep", position: i + 1, name: h, text: p })) }] };
}

export function guidePage(snap, slug) {
  const g = GUIDES.find((x) => x.slug === slug);
  if (!g) return null;
  const r = g.page(snap);
  return layout({ title: r.title, desc: r.desc, path: "/guides/" + slug, cta: ctaBox("en", { src: "cta-guide" }), body: `<p class="crumbs"><a href="/guides">Guides</a></p>` + r.body, jsonld: [article(slug, g.title, snap), ...r.jsonld] });
}

export function ratesPage(snap, history = []) {
  const s = snap.summary;
  const gta = snap.campaigns.filter((c) => c.is_gta);
  const hist = history.slice(-48);
  const rows = hist.length > 1 ? `<h2>Last ${hist.length} refreshes</h2><div class="tablewrap"><table><thead><tr><th>UTC</th><th>Campaigns</th><th>GTA</th><th>Typical/clip</th><th>Median rate</th><th>Budget left</th></tr></thead><tbody>${hist.slice().reverse().slice(0, 24).map((h) => `<tr><td>${esc(h.at.slice(5, 16).replace("T", " "))}</td><td>${h.summary.campaigns}</td><td>${h.summary.gta}</td><td>${money(h.summary.earned_per_clip_median)}</td><td>${money(h.summary.rate_per_1k_median)}</td><td>${money(h.summary.budget_left_total, 0)}</td></tr>`).join("")}</tbody></table></div>` : "";
  const body = `<h1>GTA 6 clipping rates today</h1>
<p class="updated">Updated <time datetime="${esc(snap.generated_at)}">${esc(new Date(snap.generated_at).toUTCString())}</time>. Refreshes every 30 minutes.</p>
<div class="stats">
<div><b>${money(s.earned_per_clip_median)}</b><span>typical approved clip earns</span></div>
<div><b>${money(s.rate_per_1k_median)}</b><span>median rate per 1,000 views</span></div>
<div><b>${money(s.cap_median, 0)}</b><span>median cap per clip</span></div>
<div><b>${s.gta}</b><span>GTA campaigns live</span></div>
</div>
<p class="lede">${s.campaigns} campaigns are paying clippers, with ${money(s.budget_left_total, 0)} of budget left between them. The best-paying tenth pay ${money(s.earned_per_clip_p90)}+ per approved clip; the bottom tenth under ${money(s.earned_per_clip_p10)}.</p>
<h2>GTA campaigns</h2>
${gta.length ? campaignList(gta) : "<p>None live this minute. They open in waves around launch.</p>"}
<p><a class="more" href="/gta-6-clipping-campaigns">Every campaign, ranked →</a></p>
${rows}`;
  return layout({ title: `GTA 6 clipping rates today – ${money(s.rate_per_1k_median)}/1k median, ${money(s.earned_per_clip_median)} per clip | heistclips`,
    desc: `Live GTA 6 clipping rates: median ${money(s.rate_per_1k_median)} per 1,000 views, ${money(s.cap_median, 0)} cap, a typical clip earns ${money(s.earned_per_clip_median)}. ${s.gta} GTA campaigns live. Updated every 30 minutes.`,
    path: "/gta-6-clipping-rates-today", body, cta: ctaBox("en", { src: "cta-rates" }),
    jsonld: [{ "@context": "https://schema.org", "@type": "Dataset", name: "GTA 6 clipping rates today", url: SITE + "/gta-6-clipping-rates-today", dateModified: snap.generated_at, description: "Median rate per 1,000 views, cap per clip and typical earnings per approved clip across live clipping campaigns.", isAccessibleForFree: true, license: "https://opensource.org/licenses/MIT", creator: { "@type": "Organization", name: "heistclips", url: SITE },
      distribution: [{ "@type": "DataDownload", encodingFormat: "application/json", contentUrl: SITE + "/api/campaigns" }] }] });
}
