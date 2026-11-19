// /for/<slug> pitch pages for streamers (or their management) whose streams clippers already
// pull into heistclips while no campaign pays for the clips. One screen, phone first.
//
// The numbers are stored per slug in the blob store (pitch/<slug>.json), not in this public
// repo: who we write to stays out of git (see .gitignore). Shape:
//   { slug, name, login, platform, people, exporters, clips, from, to, as_of, aliases: [] }
// people = browsers that opened the streamer's channel or one of their VODs in the clip tool;
// exporters/clips = how many of them finished an export, and how many clips. All from our own
// analytics, for the dates shown on the page. Nothing on the page is typed by hand.
import { getJSON } from "./store.js";
import { layout, esc, money } from "./render.js";

export const LAUNCH_URL = "https://contentrewards.com/launch-a-campaign";

// Campaigns shown as "what comparable campaigns pay", by Content Rewards id. Each row is read
// from the live snapshot and dropped if the campaign is gone, so the page never quotes a
// campaign that has closed.
const COMPARABLE_IDS = [
  "dd617572-f0f7-4754-8df5-4c0deb81763a", // Lauren Hamden GTA 6, pay per view
  "1d2bcb00-c904-415f-aa82-f95b96baad86", // Kai Cenat GTA 6 pool
  "a5c63fad-cd53-4b81-9305-4a2d1696872a", // Lacy GTA VI marathon pool
];

export async function loadPitch(slug) {
  if (!/^[a-z0-9_-]{2,64}$/.test(slug)) return null;
  try {
    const p = await getJSON("pitch/" + slug + ".json");
    return p && p.name && Number.isFinite(p.people) ? p : null;
  } catch (e) { return null; }
}

const words = (s) => String(s || "").toLowerCase();

// Live campaigns whose title, owner or brief names this streamer. Checked at render time, so
// the "nobody pays" line disappears the day a campaign for them opens.
export function campaignsNaming(snap, pitch) {
  const names = [pitch.login, pitch.name, ...(pitch.aliases || [])].filter(Boolean).map(words).filter((n) => n.length >= 3);
  return (snap.campaigns || []).filter((c) => {
    const text = words(`${c.title} ${c.owner || ""} ${c.description || ""}`);
    return names.some((n) => new RegExp("(^|[^a-z0-9_])" + n.replace(/[^a-z0-9_ ]/g, "") + "($|[^a-z0-9_])").test(text));
  });
}

const day = (iso) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function comparableRow(c) {
  const pay = c.payout_type === "pool"
    ? `${money(c.budget_total, 0)} pool, split by views`
    : `${money(c.rate_per_1k)} per 1,000 views, ${money(c.budget_total, 0)} budget`;
  const earned = c.expected_per_clip > 0 ? `, typical clip earned ${money(c.expected_per_clip)}` : "";
  return `<li><a href="/campaigns/${esc(c.slug)}"><b>${esc(c.title.replace(/^\$[\d,]+\s+/, ""))}</b></a><span>${esc(pay)} · ${plural(c.clippers_count, "clipper", "clippers")}${esc(earned)}</span></li>`;
}

const STYLE = `<style>
.pitch{padding-top:8px}
.pitch .eyebrow{font-size:13px;letter-spacing:.08em;text-transform:uppercase;opacity:.7;margin:0 0 10px}
.pitch h1{font-size:clamp(28px,7.4vw,46px);line-height:1.08;margin:0 0 14px}
.pitch .nums{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0 6px;padding:0;list-style:none}
.pitch .nums li{flex:1 1 96px;border:1px solid rgba(128,128,128,.35);border-radius:12px;padding:12px 14px}
.pitch .nums b{display:block;font-size:30px;line-height:1.1}
.pitch .nums span{font-size:13px;opacity:.75}
.pitch .when{font-size:13px;opacity:.7;margin:0 0 18px}
.pitch h2{font-size:18px;margin:26px 0 8px}
.pitch .comp{list-style:none;padding:0;margin:0}
.pitch .comp li{padding:10px 0;border-top:1px solid rgba(128,128,128,.25)}
.pitch .comp span{display:block;font-size:14px;opacity:.8;margin-top:2px}
.pitch .next{margin:26px 0 10px}
.pitch .next .btn{display:inline-block;min-height:48px;line-height:48px;padding:0 22px;text-decoration:none}
.pitch .how{font-size:13px;opacity:.7;margin-top:22px}
</style>`;

export function pitchPage(snap, pitch) {
  const naming = campaignsNaming(snap, pitch);
  const total = (snap.summary && snap.summary.campaigns) || (snap.campaigns || []).length;
  const comps = COMPARABLE_IDS.map((id) => (snap.campaigns || []).find((c) => c.id === id)).filter(Boolean);
  const who = esc(pitch.name);
  const q = pitch.platform === "kick" ? "kick.com/" + pitch.login : pitch.login;
  const span = pitch.from === pitch.to ? day(pitch.from) : `${day(pitch.from)} to ${day(pitch.to)}`;
  const paid = naming.length
    ? `<p class="lede">A campaign names ${who} now: <a href="/campaigns/${esc(naming[0].slug)}">${esc(naming[0].title)}</a>.</p>`
    : `<p class="lede">No campaign on Content Rewards names ${who} today. We checked all ${total} live ones.</p>`;
  const body = `
<section class="pitch">
<p class="eyebrow">For ${who}’s team</p>
<h1>${plural(pitch.people, "clipper", "clippers")} pulled ${who}’s streams this week.${naming.length ? "" : " Nobody is paying them."}</h1>
${paid}
<ul class="nums">
<li><b>${pitch.people}</b><span>opened ${who}’s streams in our clip tool</span></li>
${pitch.clips > 0 ? `<li><b>${pitch.clips}</b><span>finished ${pitch.clips === 1 ? "clip" : "clips"} exported, by ${plural(pitch.exporters, "person", "people")}</span></li>` : ""}
${naming.length ? "" : `<li><b>0</b><span>campaigns paying for ${pitch.clips > 0 ? "those clips" : "clips of " + who}</span></li>`}
</ul>
<p class="when">This week on heistclips, ${esc(span)}.</p>
${comps.length ? `<h2>What comparable campaigns pay</h2>
<ul class="comp">${comps.map(comparableRow).join("")}</ul>` : ""}
<div class="next">
<h2>The one next step</h2>
<p>Launch a campaign for ${who} on Content Rewards. heistclips ranks it for clippers within the hour, and they cut ${who}’s streams while they are still live.</p>
<p><a class="btn" href="${LAUNCH_URL}" rel="noopener" data-pitch="launch">Launch a campaign</a></p>
<p class="small"><a class="more" href="/clip?q=${encodeURIComponent(q)}&amp;src=pitch" data-pitch="tool">See ${who}’s stream in the clip tool →</a></p>
</div>
<p class="how">How we counted: browsers that opened ${who}’s channel or VODs in the heistclips clip tool, and the clips they exported, from our own analytics. Counted ${esc(day(pitch.as_of))}. Campaign figures are read from Content Rewards’ public directory and refresh every 30 minutes. heistclips is independent: we do not run campaigns and take no cut of one.</p>
</section>`;
  return layout({
    title: `${pitch.name}: ${pitch.people} clippers this week, no campaign | heistclips`,
    desc: `${pitch.people} people pulled ${pitch.name}'s streams into heistclips this week. What comparable clipping campaigns pay, and the one next step.`,
    path: "/for/" + pitch.slug, canonicalPath: "/for/" + pitch.slug, body, noindex: true, extraHead: STYLE,
  });
}
