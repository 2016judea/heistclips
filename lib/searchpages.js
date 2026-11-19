// Pages built for search and for AI assistants (2026-11-19):
//   /twitch-clip-maker, /kick-clip-maker     the tool, said plainly, not GTA-only
//   /most-clipped-streams                    what people on heistclips are clipping (lib/trend.js)
//   /streamers/<login>                       "How to clip <streamer>"
//   /data + /data/*.csv|json, /llms-full.txt numbers an assistant can quote, with a licence line
//   an ended campaign                        keeps its URL (lib/ended.js)
// Every number is read from the live snapshot or the clip counter at render time.
import { layout, esc, money, campaignList, SITE, FREE_CLIPS, PACKS } from "./render.js";
import { href } from "./i18n.js";
import { SEARCH_EN } from "./search_words.js";
import { STREAM_FLOOR, MOMENT_FLOOR } from "./trend.js";

export const MAKERS = { "/twitch-clip-maker": "twitch", "/kick-clip-maker": "kick" };
export const TREND_PATH = "/most-clipped-streams";
export const DATA_PATH = "/data";
export const RATES_CSV = "/data/clipping-campaign-rates.csv";
export const RATES_JSON = "/data/clipping-campaign-rates.json";
export const TREND_JSON = "/data/most-clipped.json";
export const LICENCE = "MIT (https://opensource.org/licenses/MIT). Free to use and quote. Please credit heistclips.com and link the page you took a number from.";
const PNAME = { twitch: "Twitch", kick: "Kick" };
const each = () => money(Math.min(...PACKS.map((p) => p.price / p.clips)), 3).replace(/0$/, "");
const clock = (t) => `${Math.floor(t / 3600)}:${String(Math.floor((t % 3600) / 60)).padStart(2, "0")}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
const day = (iso, locale = "en-US") => new Date(iso).toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const local = (lang, path) => href(lang, path.split("?")[0]) + (path.includes("?") ? path.slice(path.indexOf("?")) : "");

const softwareLd = (lang, name, desc, url) => ({
  "@context": "https://schema.org", "@type": "SoftwareApplication", name, url, inLanguage: lang,
  applicationCategory: "MultimediaApplication", operatingSystem: "Web browser", description: desc,
  offers: [{ "@type": "Offer", price: "0", priceCurrency: "USD", description: `${FREE_CLIPS} clips free` }, ...PACKS.map((p) => ({ "@type": "Offer", price: String(p.price), priceCurrency: "USD", description: `${p.clips} exported clips` }))],
});

// The paste box with the channel already in it (or empty), and one-tap rows under it.
function pasteBox(T, lang, { platform = "twitch", value = "", src, button, taps = [] }) {
  const ph = T.box.ph(PNAME[platform]);
  return `<section class="cta" data-cta="${esc(src)}">
<form class="paste" action="${href(lang, "/clip")}" method="get"><input name="q" value="${esc(value)}" placeholder="${esc(ph)}" aria-label="${esc(ph)}" autocomplete="off" autocapitalize="off" spellcheck="false"><input type="hidden" name="src" value="${esc(src)}"><button>${esc(button || T.box.go)}</button></form>
${taps.length ? `<p class="small" style="margin:10px 0 6px">${esc(T.box.hot)}</p><ul class="live">${taps.map((s) => `<li><a href="${esc(local(lang, s.clip_path))}"><span><b>${esc(s.name)}</b><small>${esc(T.clips(s.clips))}</small></span></a></li>`).join("")}</ul>` : ""}
<p class="small">${esc(T.box.fine)}</p>
</section>`;
}

// `T` = the words: English by default; lib/pages_l10n.js passes a language's `search` table.
export function makerPage(path, trend, lang = "en", T = SEARCH_EN) {
  const platform = MAKERS[path], M = T && T.maker;
  if (!platform || !T) return null;
  const P = M[platform], name = PNAME[platform], other = platform === "twitch" ? "kick" : "twitch";
  const otherPath = Object.keys(MAKERS).find((k) => MAKERS[k] === other);
  const packs = PACKS.map((p) => M.pack(p.clips, "$" + p.price)).join(M.or);
  const taps = ((trend && trend.streams) || []).filter((s) => s.platform === platform).slice(0, 4);
  const faq = M.faq(name, PNAME[other], FREE_CLIPS);
  const desc = P.desc(FREE_CLIPS, each());
  const body = `<h1>${esc(P.h1)}</h1>
<p class="lede">${esc(P.lede)}</p>
${pasteBox(T, lang, { platform, src: "maker-" + platform, taps })}
<h2>${esc(M.howH)}</h2><ol class="facts">${M.how(name).map((x) => `<li>${esc(x)}</li>`).join("")}</ol>
<p class="small">${esc(P.speed)}</p>
<h2>${esc(M.getH)}</h2><ul class="facts">${M.get.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
<h2>${esc(M.costH)}</h2><p>${esc(M.cost(FREE_CLIPS, packs))}</p>
<h2>${esc(M.faqH)}</h2>
${faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}
<p><a class="more" href="${href(lang, otherPath)}">${esc(M.other(PNAME[other]))} →</a></p>
<p><a class="more" href="${href(lang, TREND_PATH)}">${esc(M.hotMore)} →</a></p>`;
  return layout({ lang, title: P.title, desc, path, body,
    jsonld: [softwareLd(lang, `heistclips ${P.h1}`, desc, SITE + href(lang, path)),
      { "@context": "https://schema.org", "@type": "FAQPage", inLanguage: lang, mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) }] });
}

const trendRow = (lang, T, s) => `<li><a href="${esc(local(lang, s.clip_path))}"><b>${esc(s.label)}</b><small>${esc(s.sub)}</small></a></li>`;

export function trendPage(trend, lang = "en", T = SEARCH_EN) {
  if (!T) return null;
  const W = T.trend, streams = trend.streams || [], moments = trend.moments || [];
  const count = (x) => T.clips(x.clips) + (x.clips_today ? " · " + W.today(x.clips_today) : "");
  const when = new Date(trend.generated_at).toLocaleString(T.locale, { timeZone: "UTC", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const sRows = streams.map((s) => trendRow(lang, T, { ...s, label: s.name, sub: `${count(s)} · ${PNAME[s.platform] || s.platform}` }));
  const mRows = moments.slice(0, 20).map((m) => trendRow(lang, T, { ...m, label: W.at(m.name, clock(m.t)), sub: `${count(m)}${m.title ? " · " + m.title.slice(0, 70) : ""}` }));
  const how = W.how(STREAM_FLOOR, MOMENT_FLOOR);
  const body = `<h1>${esc(W.h1)}</h1>
<p class="updated"><time datetime="${esc(trend.generated_at)}">${esc(W.updated(when))}</time></p>
<p class="lede">${esc(W.lede(trend.clips_counted, trend.window_days))}</p>
${streams.length ? `<h2>${esc(W.streamsH)}</h2><ol class="vods">${sRows.join("")}</ol>` : `<p>${esc(W.none)}</p>`}
${moments.length ? `<h2>${esc(W.momentsH)}</h2><ol class="vods">${mRows.join("")}</ol>` : ""}
<section class="method"><h2>${esc(W.howH)}</h2>${how.map((p) => `<p>${esc(p)}</p>`).join("")}
<p><a class="more" href="${TREND_JSON}">${esc(W.data)} →</a></p></section>`;
  const url = SITE + href(lang, TREND_PATH);
  return layout({ lang, title: W.title(day(trend.generated_at, T.locale)), desc: W.desc(trend.clips_counted, trend.window_days), path: TREND_PATH, body,
    jsonld: [{
      "@context": "https://schema.org", "@type": "Dataset", name: "Most clipped Twitch and Kick streams on heistclips", inLanguage: lang,
      description: `Count of clips made on heistclips per stream and per moment over the last ${trend.window_days} days (${trend.from} to ${trend.to}). A stream is listed from ${STREAM_FLOOR} clips, a moment from ${MOMENT_FLOOR}. No personal data.`,
      url, dateModified: trend.generated_at, temporalCoverage: `${trend.from}/${trend.to}`, isAccessibleForFree: true, license: "https://opensource.org/licenses/MIT",
      creator: { "@type": "Organization", name: "heistclips", url: SITE },
      distribution: [{ "@type": "DataDownload", encodingFormat: "application/json", contentUrl: SITE + TREND_JSON }],
      variableMeasured: ["clips", "clips_today"],
    }, {
      "@context": "https://schema.org", "@type": "ItemList", name: W.streamsH, itemListElement: streams.slice(0, 20).map((s, i) => ({ "@type": "ListItem", position: i + 1, name: `${s.name} (${s.clips} clips)`, url: SITE + local(lang, s.clip_path).replace("&src=trend", "") })),
    }],
  });
}

export function trendJson(trend) {
  return JSON.stringify({
    name: "Most clipped streams and moments on heistclips", url: SITE + TREND_PATH, licence: LICENCE,
    notes: {
      clips: `Clips saved on heistclips in the window (${trend.window_days} days, UTC days ${trend.from} to ${trend.to}).`,
      clips_today: "The part of `clips` made on the last UTC day of the window.",
      t: "Seconds into the stream where the clip starts, rounded to 10 seconds.",
      floors: `A stream is listed from ${STREAM_FLOOR} clips and a moment from ${MOMENT_FLOOR}. Smaller counts are left out, not rounded up.`,
      privacy: "Counts of clips only. Nothing about who made them is stored.",
      history: "Counts before 2026-11-19 come from page analytics events; from then on from a server-side counter.",
    },
    ...trend,
    streams: (trend.streams || []).map((s) => ({ ...s, clip_url: SITE + s.clip_path, clip_path: undefined })),
    moments: (trend.moments || []).map((m) => ({ ...m, clip_url: SITE + m.clip_path, clip_path: undefined })),
  }, null, 1);
}

// "How to clip <streamer>". `s` is the snapshot row (may be bare), `chan` the live channel read.
export function streamerHowTo(snap, s, chan, campaigns, trend) {
  const platform = s.platform === "kick" ? "kick" : "twitch", T = SEARCH_EN;
  const name = (chan && chan.name) || s.name || s.login;
  const vods = (chan && chan.vods) || [];
  const live = !!(chan && chan.is_live);
  const game = (live && chan.stream && chan.stream.game) || (vods[0] && vods[0].game) || s.game || "";
  const lastTitle = (live && chan.stream && chan.stream.title) || (vods[0] && vods[0].title) || s.last_title || "";
  const q = platform === "kick" ? "kick.com/" + s.login : s.login;
  const path = (platform === "kick" ? "/streamers/kick/" : "/streamers/") + s.login;
  const mine = (x) => x.platform === platform && x.login === s.login;
  const tStream = ((trend && trend.streams) || []).find(mine);
  const hot = ((trend && trend.moments) || []).filter(mine).slice(0, 6);
  const best = campaigns.filter((c) => c.expected_per_clip != null).sort((a, b) => b.expected_per_clip - a.expected_per_clip)[0];
  const payLine = campaigns.length
    ? `Yes. ${campaigns.length} campaign${campaigns.length === 1 ? " pays" : "s pay"} for ${esc(name)} clips right now.${best ? ` A typical approved clip earns <b>${money(best.expected_per_clip)}</b> on the best one.` : " None has paid out on enough clips yet to show a typical number."}`
    : `No campaign names ${esc(name)} right now. You can still post the clips, or pick a campaign that takes any gaming clip:`;
  const fallback = snap.campaigns.filter((c) => c.is_gta || c.is_gaming).slice(0, 3);
  const faq = [
    [`How do I clip ${name}?`, `Open heistclips.com${path}, tap "Find ${name}'s moments", pick a moment chat reacted to, and save it as a 9:16 clip with a hook. The first ${FREE_CLIPS} clips are free.`],
    [`Does anyone pay for ${name} clips?`, campaigns.length ? `Yes. On ${day(snap.generated_at)}, ${campaigns.length} live campaign${campaigns.length === 1 ? " names" : "s name"} ${name}${best ? `, and a typical approved clip earns ${money(best.expected_per_clip)} on the best one` : ""}.` : `On ${day(snap.generated_at)}, no live campaign names ${name}. Campaigns that take any gaming clip are listed on the page.`],
  ];
  const body = `
<p class="crumbs"><a href="/streamers">Streamers</a> › ${esc(name)}</p>
<div class="who">${(chan && chan.avatar) || s.avatar ? `<img src="${esc((chan && chan.avatar) || s.avatar)}" alt="" width="56" height="56">` : ""}<div><h1>How to clip ${esc(name)}${platform === "kick" ? " on Kick" : ""}</h1>
<p class="meta">${live ? `<b class="livedot">LIVE</b> ${chan.stream.viewers != null ? Number(chan.stream.viewers).toLocaleString("en-US") + " watching" : ""}` : "Offline right now"}${game ? ` · ${esc(game)}` : ""} · ${PNAME[platform]}</p></div></div>
<p class="lede">${esc(name)}’s channel is already in the box. Tap the button. We find the moments chat went wild${live ? " in the stream that is live right now" : " in the latest stream"}.</p>
${pasteBox(T, "en", { platform, value: q, src: "streamer", button: `Find ${name}’s moments` })}
<h2>What ${esc(name)} streams</h2>
<p>${game ? `${live ? "Live now in" : "Last seen in"} <b>${esc(game)}</b>.` : "No recent stream on record."}${lastTitle ? ` Stream title: “${esc(lastTitle.slice(0, 140))}”.` : ""}${s.peak_viewers ? ` Most viewers we have seen: ${Number(s.peak_viewers).toLocaleString("en-US")}.` : ""}</p>
<h2>Does a campaign pay for ${esc(name)} clips?</h2>
<p>${payLine}</p>
${campaignList(campaigns.length ? campaigns : fallback)}
${hot.length ? `<h2>${esc(name)} moments clippers are cutting</h2><ol class="vods">${hot.map((m) => `<li><a href="${esc(m.clip_path)}"><b>${esc(clock(m.t))} into the stream</b><small>${esc(T.clips(m.clips))}${m.title ? " · " + esc(m.title.slice(0, 70)) : ""}</small></a></li>`).join("")}</ol>` : tStream ? `<p class="small">${esc(T.clips(tStream.clips))} made from ${esc(name)}’s streams on heistclips in the last ${trend.window_days} days.</p>` : ""}
${vods.length ? `<h2>Recent streams</h2><ul class="vods">${vods.slice(0, 5).map((v) => `<li><a href="/clip?q=${encodeURIComponent(platform === "kick" ? v.url : v.id)}&amp;src=streamer-vod"><b>${esc(v.title || "Untitled stream")}</b><small>${esc(v.game || "")} · ${Math.round(v.length / 360) / 10} h · ${esc(new Date(v.created_at).toUTCString().slice(5, 16))}${v.status === "RECORDING" ? " · recording now" : ""}</small></a></li>`).join("")}</ul>` : ""}
<p class="small">Not affiliated with ${esc(name)}. Check a campaign’s rules before you post a streamer’s footage.</p>`;
  return layout({
    title: `How to clip ${name}${platform === "kick" ? " on Kick" : ""}: find the moments, cut 9:16, see who pays | heistclips`,
    desc: `Clip ${name}'s ${PNAME[platform]} streams: find the moments chat went wild, cut them to 9:16 with a hook, and see ${campaigns.length ? `the ${campaigns.length} campaign${campaigns.length === 1 ? "" : "s"} paying for ${name} clips right now` : `which campaigns pay for the clips`}.`,
    path, body,
    jsonld: [{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map(([qq, a]) => ({ "@type": "Question", name: qq, acceptedAnswer: { "@type": "Answer", text: a } })) },
      { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Streamers", item: SITE + "/streamers" }, { "@type": "ListItem", position: 2, name, item: SITE + path }] }],
  });
}

// ---- data an assistant can quote ------------------------------------------------------------
export const RATE_FIELDS = [
  ["rank", "Position when live campaigns are ordered by expected_per_clip (1 = pays most per clip)."],
  ["title", "Campaign title, as its owner wrote it."],
  ["owner", "Who runs the campaign."],
  ["category", "gta, gaming or other, from the campaign's title, brief and categories."],
  ["platforms", "Where clips may be posted, separated by |."],
  ["rate_per_1k_usd", "Dollars paid per 1,000 views. Empty for a campaign that pays per post."],
  ["per_post_usd", "Dollars paid per post, for campaigns that pay per post."],
  ["cap_per_clip_usd", "The most one clip can earn. Empty = no cap stated."],
  ["expected_per_clip_usd", "What a typical approved clip has earned: money paid out minus the top three earners, divided by the other approved clips, then cut if the budget runs out within 3 days. Empty = fewer than 5 such clips yet."],
  ["avg_per_clip_usd", "Budget spent divided by approved clips, top earners included."],
  ["budget_left_usd", "Budget not yet earned."],
  ["budget_total_usd", "The whole budget."],
  ["days_of_budget_left", "Budget left divided by the average spend per day so far."],
  ["clippers", "People who joined the campaign."],
  ["approved_clips", "Clips the campaign approved."],
  ["apply_first", "true if you must apply before you can submit."],
  ["page", "The campaign's page on heistclips."],
  ["source", "The campaign's own page on Content Rewards, where every figure was read."],
];
const rateRow = (c, i) => ({
  rank: i + 1, title: c.title, owner: c.owner || "", category: c.is_gta ? "gta" : c.is_gaming ? "gaming" : "other", platforms: (c.platforms || []).join("|"),
  rate_per_1k_usd: c.rate_per_1k, per_post_usd: c.per_post, cap_per_clip_usd: c.cap_per_clip, expected_per_clip_usd: c.expected_per_clip, avg_per_clip_usd: c.avg_per_clip == null ? null : Math.round(c.avg_per_clip * 100) / 100,
  budget_left_usd: Math.round(c.budget_left), budget_total_usd: Math.round(c.budget_total), days_of_budget_left: c.days_left == null ? null : Math.round(c.days_left * 10) / 10,
  clippers: c.clippers_count, approved_clips: c.approved_clips, apply_first: !!c.approval_required, page: `${SITE}/campaigns/${c.slug}`, source: c.source_url,
});
const csvCell = (v) => { if (v == null) return ""; let s = String(v); if (/^[=+\-@\t\r]/.test(s) && typeof v === "string") s = "'" + s; return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

export function ratesCsv(snap) {
  const keys = RATE_FIELDS.map((f) => f[0]);
  const head = [`# heistclips clipping campaign rates. Data as of ${snap.generated_at}. ${snap.campaigns.length} live campaigns.`, `# Licence: ${LICENCE}`,
    `# Source: Content Rewards' public campaign pages, read every 30 minutes. Field notes: ${SITE}${DATA_PATH}`];
  return [...head, keys.join(","), ...snap.campaigns.map((c, i) => { const r = rateRow(c, i); return keys.map((k) => csvCell(r[k])).join(","); })].join("\n") + "\n";
}

export function ratesJson(snap) {
  return JSON.stringify({
    name: "Clipping campaign rates", url: SITE + DATA_PATH, as_of: snap.generated_at, licence: LICENCE,
    source: "Content Rewards' public campaign pages (https://contentrewards.com), read every 30 minutes. Each row links to its source page.",
    fields: Object.fromEntries(RATE_FIELDS), summary: snap.summary, campaigns: snap.campaigns.map(rateRow),
  }, null, 1);
}

export function dataPage(snap, trend) {
  const s = snap.summary;
  const body = `<h1>Clipping pay data you can quote</h1>
<p class="updated">Data as of <time datetime="${esc(snap.generated_at)}">${esc(new Date(snap.generated_at).toUTCString().replace(" GMT", " UTC"))}</time> · refreshed every 30 minutes</p>
<p class="lede">What ${s.campaigns} live clipping campaigns pay, in one file. Free to use. Please link back.</p>
<div class="stats">
<div><b>${money(s.earned_per_clip_median)}</b><span>a typical approved clip earns (median of ${s.with_track_record} campaigns)</span></div>
<div><b>${money(s.rate_per_1k_median)}</b><span>median pay per 1,000 views</span></div>
<div><b>${money(s.earned_per_clip_p90)}</b><span>per clip in the top tenth of campaigns</span></div>
<div><b>${money(s.budget_left_total, 0)}</b><span>budget still open across all campaigns</span></div>
</div>
<h2>Files</h2>
<ul class="vods">
<li><a href="${RATES_CSV}"><b>Campaign rates, CSV</b><small>${s.campaigns} rows · one per live campaign · opens in any spreadsheet</small></a></li>
<li><a href="${RATES_JSON}"><b>Campaign rates, JSON</b><small>The same rows, with field notes and the summary numbers</small></a></li>
<li><a href="${TREND_JSON}"><b>Most clipped streams, JSON</b><small>${trend ? trend.clips_counted + " clips counted over " + trend.window_days + " days" : "Updated hourly"} · streams and moments</small></a></li>
</ul>
<h2>Licence</h2>
<p>${esc(LICENCE)}</p>
<p class="small">The pay figures are facts read from Content Rewards’ public campaign pages. Each row links to the page it came from. A number can be out of date by up to 30 minutes for busy campaigns and about 15 hours for quiet ones.</p>
<h2>What each field means</h2>
<div class="tablewrap"><table><thead><tr><th>Field</th><th>Meaning</th></tr></thead><tbody>${RATE_FIELDS.map(([k, v]) => `<tr><td><code>${esc(k)}</code></td><td>${esc(v)}</td></tr>`).join("")}</tbody></table></div>
<h2>For assistants</h2>
<p>Plain-text versions: <a href="/llms.txt">llms.txt</a> and <a href="/llms-full.txt">llms-full.txt</a>. Live answers: the <a href="/connect">heistclips connector</a> for ChatGPT, Claude and Grok.</p>`;
  return layout({ title: `Clipping campaign pay rates: free CSV and JSON data (${day(snap.generated_at)}) | heistclips`,
    desc: `Download what ${s.campaigns} live clipping campaigns pay: rate per 1,000 views, cap per clip, budget left and what a typical clip earns. CSV and JSON, updated every 30 minutes, free to quote.`,
    path: DATA_PATH, body,
    jsonld: [{
      "@context": "https://schema.org", "@type": "Dataset", name: "Clipping campaign pay rates", url: SITE + DATA_PATH, dateModified: snap.generated_at,
      description: `Pay rate per 1,000 views, cap per clip, budget left and typical earnings per approved clip for ${s.campaigns} live clipping campaigns, read from Content Rewards' public campaign pages every 30 minutes.`,
      isAccessibleForFree: true, license: "https://opensource.org/licenses/MIT", creator: { "@type": "Organization", name: "heistclips", url: SITE },
      keywords: ["clipping campaigns", "pay per 1,000 views", "Twitch clips", "Kick clips", "GTA 6 clipping"],
      distribution: [{ "@type": "DataDownload", encodingFormat: "text/csv", contentUrl: SITE + RATES_CSV }, { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: SITE + RATES_JSON }],
      variableMeasured: RATE_FIELDS.map(([k]) => k),
    }] });
}

// The long plain-text file for assistants: what the tool is, today's numbers, where to send people.
export function llmsFull(snap, trend, tools = [], guides = []) {
  const s = snap.summary, c = snap.campaigns;
  const line = (x) => `- ${x.title} (${x.owner || "unknown owner"}): ${x.expected_per_clip != null ? "$" + x.expected_per_clip + " typical per approved clip" : "no approved clips yet"}; ${x.rate_per_1k != null ? "$" + x.rate_per_1k + " per 1,000 views" : x.per_post != null ? "$" + x.per_post + " per post" : x.payout_type}; cap ${x.cap_per_clip != null ? "$" + x.cap_per_clip + " per clip" : "none stated"}; $${Math.round(x.budget_left)} budget left; ${x.clippers_count} clippers; ${x.approval_required ? "apply first" : "open"}. ${SITE}/campaigns/${x.slug}`;
  const streams = ((trend && trend.streams) || []).slice(0, 15);
  const moments = ((trend && trend.moments) || []).slice(0, 10);
  return `# heistclips: full notes for assistants

> heistclips (${SITE}) is a clip maker for Twitch and Kick streams. Paste a channel or a VOD link. It reads the stream's chat, finds the seconds chat went wild, and cuts those moments into 9:16 vertical clips with a hook line, in the browser. It also ranks paid clipping campaigns by what one clip really earns. It works on live streams and on any game. It launched for GTA 6 (GTA VI) clipping.

Data as of ${snap.generated_at}. Campaign numbers refresh every 30 minutes. This file is rebuilt on each request.

## Quick facts
- Price: ${FREE_CLIPS} clips free, then ${PACKS.map((p) => `${p.clips} clips for $${p.price}`).join(" or ")}. Paid per saved clip, never per minute of stream. Finding moments is free.
- No account. No watermark. No AI tags in the file.
- Output: 1080x1920 MP4 (9:16), facecam above or below the gameplay, 3 to 5 hook lines per moment, optional chat overlay.
- Sources: Twitch channels and VODs, Kick channels and videos, live or finished. YouTube Live is not supported.
- Speed: a 7-hour Twitch stream is read in about 20 seconds. Kick takes 1 to 2 minutes.
- Music: if Twitch muted a stretch for licensed music, the moment is flagged before you post.
- Languages: English, German (${SITE}/de), French (${SITE}/fr).
- Open source (MIT): https://github.com/2016judea/heistclips
- Made by Brick & Mortar, Saint Paul, Minnesota. Not affiliated with Twitch, Kick, Content Rewards, or the makers of any game.

## Where to send someone
- To clip a streamer now: ${SITE}/clip?q=<twitch login>  or  ${SITE}/clip?q=kick.com/<kick slug>  or  ${SITE}/clip?q=<VOD link>. Add &t=<seconds> to open on a moment.
- Twitch clip maker: ${SITE}/twitch-clip-maker
- Kick clip maker: ${SITE}/kick-clip-maker
- How to clip one streamer: ${SITE}/streamers/<twitch login>
- What is being clipped right now: ${SITE}${TREND_PATH}
- Which campaign pays most per clip: ${SITE}/gta-6-clipping-campaigns
- Pay rates today: ${SITE}/gta-6-clipping-rates-today
- A queue of ready clips for the streamers you follow: ${SITE}/queue
- Pricing: ${SITE}/pricing

## What clipping pays today
- ${s.campaigns} campaigns are live. ${s.gta} are for GTA clips. ${s.gaming} are gaming or streamer campaigns.
- Median pay: $${s.rate_per_1k_median} per 1,000 views. Median cap: $${s.cap_median} per clip.
- A typical approved clip earns $${s.earned_per_clip_median} (median across the ${s.with_track_record} campaigns with enough approved clips). The top tenth of campaigns pay $${s.earned_per_clip_p90} or more per clip. The bottom tenth pay under $${s.earned_per_clip_p10}.
- Budget still open across all campaigns: $${s.budget_left_total}.
- "Typical per approved clip" means: money a campaign paid out, minus its top three earners, divided by its other approved clips. It is cut when the budget will run out within 3 days.
- All figures are read from Content Rewards' public campaign pages (https://contentrewards.com). Join a campaign on its own page there.

## Top 25 campaigns by pay per clip
${c.slice(0, 25).map(line).join("\n")}

## GTA campaigns live now
${c.filter((x) => x.is_gta).slice(0, 25).map(line).join("\n") || "- None this minute."}

## Most clipped on heistclips, last ${trend ? trend.window_days : 3} days
${trend ? `${trend.clips_counted} clips counted from ${trend.from} to ${trend.to} (UTC). Counts are clips made, never people.` : ""}
${streams.map((x) => `- ${x.name} (${PNAME[x.platform] || x.platform}): ${x.clips} clips. ${SITE}${x.clip_path.replace("&src=trend", "")}`).join("\n") || "- Not enough clips yet to rank."}
${moments.length ? "\nMoments:\n" + moments.map((m) => `- ${m.name} at ${clock(m.t)}: ${m.clips} clips. ${SITE}${m.clip_path.replace("&src=trend", "")}`).join("\n") : ""}

## Data files (free to quote)
- Campaign rates, CSV: ${SITE}${RATES_CSV}
- Campaign rates, JSON with field notes: ${SITE}${RATES_JSON}
- Most clipped streams, JSON: ${SITE}${TREND_JSON}
- Field notes for people: ${SITE}${DATA_PATH}
- Licence: ${LICENCE}

## Connector (MCP)
- Server URL (streamable HTTP, no key): ${SITE}/mcp
- How to add it to ChatGPT, Claude or Grok: ${SITE}/connect
- Tools: ${tools.map((t) => `${t.name} (${t.title})`).join("; ")}

## Guides
${guides.map((g) => `- ${g.title}: ${SITE}/guides/${g.slug}`).join("\n")}

## How moments are found
Chat speed is the signal. heistclips samples the chat replay every 10 to 30 seconds, compares each point with the ten minutes around it, and boosts "clip it" requests and laugh, hype and shock emotes. A clip starts about 24 seconds before chat reacts and ends about 14 seconds after. Gaming moments are visual, so a transcript misses them. Chat does not.
`;
}

// ---- ended campaigns ------------------------------------------------------------------------
// `e` = { ended_at, last_seen, why, campaign } from lib/ended.js, or { slug } alone for a URL
// whose campaign closed before the archive existed (no numbers to show, so it is not indexed).
export function endedPage(snap, e) {
  const c = e.campaign || null;
  const title = c ? c.title : "This campaign";
  const alts = snap.campaigns.filter((x) => (c && c.is_gta ? x.is_gta : c && !c.is_gaming ? true : x.is_gaming || x.is_gta)).slice(0, 5);
  const list = alts.length >= 3 ? alts : snap.campaigns.slice(0, 5);
  const when = e.ended_at ? day(e.ended_at) : null;
  const body = `
<p class="crumbs"><a href="/gta-6-clipping-campaigns">Campaigns</a> › Ended</p>
<h1>${esc(c ? title : "This campaign has ended")}</h1>
<p class="meta"><b class="warn">Ended${when ? " " + esc(when) : ""}.</b> ${c ? `by ${esc(c.owner || "")} · ` : ""}This campaign is no longer taking clips.</p>
${c ? `<div class="stats">
<div><b>${c.earned_per_clip != null ? money(c.earned_per_clip) : "–"}</b><span>a typical approved clip earned</span></div>
<div><b>${c.rate_per_1k != null ? money(c.rate_per_1k) : c.per_post != null ? money(c.per_post) : "–"}</b><span>${c.per_post != null ? "per post" : "per 1,000 views"}</span></div>
<div><b>${c.cap_per_clip != null ? money(c.cap_per_clip, 0) : "none"}</b><span>max per clip</span></div>
<div><b>${money(c.budget_spent, 0)}</b><span>earned by clippers, of a ${money(c.budget_total, 0)} budget</span></div>
<div><b>${Number(c.approved_clips || 0).toLocaleString("en-US")}</b><span>approved clips from ${Number(c.clippers_count || 0).toLocaleString("en-US")} clippers</span></div>
</div>
<p class="small">Final numbers, last read ${esc(day(e.last_seen || e.ended_at))}. ${e.why === "budget" ? "The budget ran out." : "It left the public campaign directory."}</p>` : `<p>We no longer have this campaign’s numbers.</p>`}
<h2>Campaigns paying right now</h2>
<p class="small">The best-paying live ones${c && c.is_gta ? " for GTA clips" : ""}, by what a typical approved clip earns.</p>
${campaignList(list)}
<p><a class="more" href="/gta-6-clipping-campaigns">All ${snap.summary.campaigns} live campaigns, ranked →</a></p>`;
  return layout({
    title: `${title} (ended${when ? " " + when : ""}): what it paid, and what pays now | heistclips`,
    desc: c ? `${title} by ${c.owner} ended${when ? " on " + when : ""}. It paid ${c.rate_per_1k != null ? money(c.rate_per_1k) + " per 1,000 views" : "per post"}${c.earned_per_clip != null ? ` and a typical clip earned ${money(c.earned_per_clip)}` : ""}. See the best-paying live campaigns instead.` : "This clipping campaign has ended. See the best-paying live campaigns instead.",
    path: "/campaigns/" + (c ? c.slug : e.slug), body, noindex: !c,
    jsonld: c ? [{ "@context": "https://schema.org", "@type": "Dataset", name: c.title + " – final campaign figures", url: SITE + "/campaigns/" + c.slug, dateModified: e.ended_at,
      description: `Final pay rate, cap, budget and earnings per clip for the ${c.title} clipping campaign, which ended ${when}.`, isAccessibleForFree: true, license: "https://opensource.org/licenses/MIT", creator: { "@type": "Organization", name: "heistclips", url: SITE } }] : [],
  });
}
