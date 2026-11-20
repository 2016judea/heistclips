# DATA_MODEL.md — idealized, written before looking at any data

*Business rule 5, step zero (`~/.claude/BUSINESS.md`). Written 2026-11-16 from the thesis
alone, before the Reddit pull or any source was read. Reality check is the section at the
bottom; it gets filled after, field by field.*

## Thesis

Aidan, 2026-11-16: GTA VI launches **2026-11-19** and a wave of young clippers will cut
other people's GTA VI streams into Shorts/TikToks/Reels for money. Build the tool they
use, be good at what the incumbents (OpusClip, Klap, Vizard, Submagic, Zoupyu…) are bad
at, and be what they find when they search "GTA VI clipping tool" — on Google and inside
ChatGPT / Grok.

A clipper's income is `Σ over clips of min(views × rate_per_1k / 1000, cap_per_clip)`,
paid only while a campaign's budget lasts, divided by the hours it took. YouTube's own
Shorts ad share is a rounding error next to it (gaming Shorts RPM ≈ $0.01–$0.10/1k). The
ideal tool does every *reasoning* step between "a paid-for streamer goes live" and "the
clip is posted where it pays most, and the views are claimed" (rule 3: build the step,
not the report).

## Entities

### Campaign — who is paying for what, right now
| field | question it answers |
|---|---|
| id, owner (streamer/brand), title | whose clips am I making |
| source_channels (twitch/kick/youtube handles) | which streams count for this money |
| game_tags | is this a GTA VI campaign |
| platforms_accepted (tiktok/yt/ig/x) | where must I post |
| rate_per_1k, cap_per_clip, min_views | what one clip can earn, max |
| budget_total, budget_left, burn_per_day | how long until this money is gone |
| clippers_count, top_clip_views_7d | how crowded is it; what does "good" look like |
| approval_required, rules (watermark, length, spoilers, audio) | will my clip be rejected |
| **expected_$_per_clip** (derived) | **the one number: which campaign is worth my next hour** |

### Source — a live stream or VOD
| field | question |
|---|---|
| platform, channel, url, is_live, started_at, viewers | what's live right now |
| campaign_ids | does anyone pay me to clip this |

### Moment — a span inside a source worth clipping
| field | question |
|---|---|
| source_id, t_start, t_end, first_seen_at | where exactly, and how fresh |
| chat_velocity_z, audio_peak, transcript, event_type (chase, crash, glitch, reaction) | why it will travel |
| others_posted_count | has someone already beaten me to it |
| score | which moment first |

### Clip — a postable vertical cut
| field | question |
|---|---|
| moment_id, length_s, 9:16 frame, captions | is it ready |
| hook_variants[] (first-second text) | which opening to test (3–5 per moment) |
| music_risk (licensed radio track detected) | will Content ID claim / demonetize it |
| spoiler_flag, watermark_ok | will the campaign reject it |

### Post — a clip on a platform
| field | question |
|---|---|
| clip_id, platform, account, url, posted_at | where it lives |
| views @1h/24h/48h, approved_views, earnings | what it made; which hook won |
| campaign_id, submitted_at | did I claim the money |

### Clipper — the user
| field | question |
|---|---|
| platform accounts, campaigns joined | where I post / who pays me |
| earnings, hours → **$ per hour** | is this worth my time, and what do I change |

### Track — licensed music in the game (GTA VI radio)
| field | question |
|---|---|
| title, artist, station, fingerprint | does this clip contain a claimable song |

## Joins
Campaign ↔ Source by channel handle. Source → Moment → Clip → Post → Campaign (submission).
Moment ↔ Post across all clippers = competition on that moment. Clip ↔ Track = music risk.

## Reality check (filled 2026-11-16, field by field, against live sources)

Legend: **fills** = a source exists and the field ships · **partial** = shipped from a proxy,
named as one · **not built** = a source exists, v0 didn't wire it · **can't fill** = no source.

### Campaign — fills
Source: Content Rewards' **public pages only** (changed 2026-11-16 the same evening: their
robots.txt disallows `/api/`, and the call was to respect it). `/sitemap.xml` lists every live
campaign as `/c/campaigns/<id>`; each page is server-rendered with the full campaign object in
its Next.js flight payload — every field the old feed had, including cap per clip, per-platform
rates, budget, approved clips, top-earner totals and daily chart points. The four
`/c/discover*` pages refresh budget/creator numbers for ~237 campaigns per run. Each 30-min
run reads the sitemap, the four discover pages and the ~26 stalest campaign pages, one at a
time with a pause, honest user agent, doubling back-off on 403/429/5xx; a campaign page is
re-read at least every ~15 h, the discover-covered ones every 30 min. Clipper names, avatars and
ids in those pages are dropped before storage. **No ranker field is lost by leaving `/api/`.**

| field | status |
|---|---|
| id, owner, title, platforms_accepted, approval_required | fills |
| rate_per_1k, cap_per_clip | fills (per platform) |
| min_views | **can't fill**: feed has min *payout* per clip, not min views; shipped as min payout |
| budget_total, budget_left | fills |
| burn_per_day | fills (derived: spent / days live) → runway in hours when < 3 days |
| clippers_count, top_clip_views_7d | fills (creatorCount; 7-day views from chartPoints) |
| source_channels | **partial**: only when the brief names a twitch.tv/kick.com handle — 13 of 796 campaigns |
| game_tags | **partial**: no structured game field; GTA = regex over title+brief (2 live GTA campaigns on 11/16) |
| rules (watermark, length, spoilers, audio, geo) | **partial**: free text only; keyword-flagged as requirement tags |
| expected_$_per_clip | fills, better than planned: realized $ per approved clip (top-3 earners excluded) × runway. Spread across 483 campaigns with a record: p10 $0.24 → p90 $25.42 per clip (100×), so the ranking has an answer |
| paid_out (added after the Reddit pull: "payers that never paid") | fills |

### Source — fills for Twitch, can't fill for Kick yet
Twitch GQL (`gql.twitch.tv`, CORS `*`, anonymous) gives channel, live state, viewers, VODs,
and the in-progress VOD of a live stream (3 of 4 live GTA channels checked had one; the 4th
saves no VODs → can't be cut). In-progress VOD trails live by ~10 s (measured).
Kick: **fills** (2026-11-16): `kick.com/api/v2/channels/<slug>` (+`/videos`) give live state and
VODs, including the in-progress one; VOD video on stream.kick.com sends CORS `*`; chat replay
is `/api/v2/channels/<id>/messages?start_time=` (≤25 messages per ~5-s window). Kick's robots.txt
allows `/` (it blocks only AI-training crawlers). Its API refuses >~5 req/s, so Kick reads
coarser and slower (~1–2 min a stream). Live Kick chat: the public Pusher key now answers "not in
this cluster" and the new realtime config is behind a security policy, so live mode polls the
history window ~10 s behind live. YouTube Live: **not built**. campaign_ids: partial, via handles above.

### Moment — mostly fills
| field | status |
|---|---|
| t_start, t_end, first_seen_at | fills (first_seen only in live mode) |
| chat_velocity_z | fills, as ratio to the local ±10-min median (16 s for a 7-h VOD) |
| event_type | fills from a chat lexicon (laugh/hype/shock/fail emotes, multi-language laughs) |
| audio_peak | **not built**: needs the audio decoded; the browser only touches video at render time |
| transcript | deliberately not built: transcript-first is what clippers say incumbents get wrong for gameplay |
| others_posted_count | **partial**: Twitch-native clips overlapping the window (count + views). Other clippers' TikTok/Shorts posts: **can't fill** (no public search API) |
| score | fills |

### Clip — mostly fills
| field | status |
|---|---|
| 9:16 frame, length | fills: browser render 1080×1920 H.264/AAC MP4, 30 fps (verified with ffprobe on a real render) |
| hook_variants | fills: 3–5 per moment from chat's own top phrase + event templates |
| captions | **not built**: speech captions need ASR; shipped chat overlay + hook instead |
| music_risk | **partial**: high = Twitch muted that stretch (Audible Magic) — VODs only; live = chat mentions only. Track fingerprinting: **can't fill** before launch (no GTA VI radio fingerprints) |
| spoiler_flag | **not built** |
| watermark_ok | fills (never watermarked; no C2PA/AI tags — checked the file) |

### Post — not built
Every field needs the clipper's own TikTok/YouTube/Instagram OAuth (upload + view APIs) and
Content Rewards has no public submission API. Buildable per-user; nothing public fills it.

### Clipper — not built
No accounts in v0 (a random browser id holds credits). Earnings/$-per-hour needs Post.

### Track — can't fill
GTA VI's radio tracklist and fingerprints don't exist publicly before launch. Twitch's own
mute is the proxy (see music_risk).

### Call
Not abandoning. The chain that decides money — Campaign → Source → Moment → Clip — fills, and
its one derived number has a 100× spread. Post and Clipper are scope, not reality: they fill
once a clipper connects their accounts, which is the v1 step. The true can't-fills are other
clippers' posts, min_views, structured rules and GTA VI track fingerprints; each ships as a
named proxy above, never as the real thing.

---

# Autopilot — ideal model (written 2026-11-19, before any of it was checked)

*Same rule, step zero. Written from the need alone; the reality check below it was filled
afterwards.*

## Need

72 of 107 clip-makers came back for more and 12 made 10+ clips (PostHog, 11/16–11/19). The
work they repeat is: open the tool, paste the same streamers, wait, pick, decide which
campaign the clip is for, write a hook. Autopilot does every one of those steps while they
are away. They open a list of clips that are ready to post, each already tied to the
campaign that pays most for it.

## Entities

### Clipper identity — who this queue belongs to, with no login wall
| field | question it answers |
|---|---|
| queue_key (secret, in a private link) | is this the same person on their phone and their laptop |
| device_ids[] | which browsers hold this queue (credits stay per browser, as today) |
| email (optional, confirmed) | where do we tell them clips are ready; how do they get the link back |
| push_subscriptions[] | which of their browsers can be pinged |
| paid_key (optional) | do their bought clips follow them to the next device |

### Watchlist — what they asked us to watch
| field | question |
|---|---|
| channels[] (platform, login) | whose streams do I clip |
| campaign_ids[] or "auto" | which campaigns am I in (auto = any campaign that pays for a streamer I watch) |
| platforms_i_post_on[] | which of a campaign's accepted platforms count for me |
| notify (push / email / off), quiet hours | when may you interrupt me |

### Watched stream — one row per channel, however many people watch it
| field | question |
|---|---|
| platform, login, name, avatar | who |
| watchers_count | is anyone still asking for this (0 = stop scanning) |
| is_live, current_vod_id, game, title | what is happening now |
| scanned_to (per VOD), scanned_at | how far have we read; how stale is the queue |
| next_scan_at | when is it this channel's turn again |

### Moment — as in the first model, plus what a queue needs
| field | question |
|---|---|
| id, vod_id, t_start, t_end, t_peak, found_at | where exactly, and how fresh |
| chat_ratio, event_type, clip_requests, phrase | why it will travel |
| twitch_clips, twitch_clip_views | is it proven; is it taken |
| music_risk | will it be claimed |
| game_at_that_moment | does the campaign's game rule hold |
| length_s | does the campaign's length rule hold |
| hooks[], caption | what goes on the post |

### Campaign match — moment × campaign: does this clip earn from that campaign
| field | question |
|---|---|
| campaign_id | which campaign |
| pays_for_streamer (named by handle / by name / not named) | does this campaign pay for clips of this streamer at all |
| game_ok, length_ok, audio_ok, platform_ok, language_ok, geo_ok | does the clip pass each rule |
| apply_first, tags_required[], watermark rule | what must I do before/when posting |
| budget_left, runway_h | will the money still be there when the views land |
| expected_$ (typical per approved clip × runway) | **the one number: which campaign this clip should go to** |
| why (plain sentence) | can I trust the pick |

### Queue item — one ready clip for one clipper
| field | question |
|---|---|
| moment_id, best_match, other_matches[] | what, and for whom |
| hook, caption (with the campaign's required tags) | what do I paste |
| state (new / exported / posted / skipped), seen_at | what have I already dealt with |
| file (a finished 9:16 MP4) | can I post it from my phone without rendering |
| export_cost (1 clip, only on export) | what does it cost me |

### Delivery — telling them
| field | question |
|---|---|
| channel (push / email), sent_at, items[] | what did we tell them and when |
| opened_at, exported_after | did the ping lead to a clip |

## Joins
Watchlist.channels ↔ Watched stream (many clippers, one scan). Watched stream → Moment.
Moment × Campaign (through streamer, game, rules) → Campaign match. Watchlist × Moment ×
best Campaign match → Queue item. Queue item → Delivery. Queue item → Clip → (Post, later).

## Autopilot reality check (filled 2026-11-19, against production data)

### Clipper identity — fills
queue_key: a random 144-bit key made on the first save, kept in the browser, carried in a
private link; the record sits under a keyed-hash Blob path. device_ids, optional email (double
opt-in: the first mail is only their own link), push subscriptions (endpoint only; pushes carry
no content), paid_key (a bought pack follows the queue to the next device): all fill.

### Watchlist — mostly fills
channels: fills (Twitch and Kick; YouTube Live **can't fill**, no reader yet).
campaign_ids / auto: fills (auto is the default; the API accepts a chosen set, the page does
not offer the picker yet). platforms_i_post_on: **not built**. quiet hours: **not built**
(pushes are spaced 20 min apart, mails 6 h).

### Watched stream — fills
One file per channel, one scan however many watch it. A first read covers at most the last
6 h of the newest stream (measured: ~10 s, ~2,200 chat pages for KaiCenat's 28-hour stream);
later reads cover only new minutes (measured: 5 channels in 8.4 s). next_scan_at is the
cron's order (never-read, live, stalest), not a stored field.

### Moment — fills, with one proxy
game_at_that_moment: **partial**. A live scan records the game on stream at scan time (10-min
resolution); a finished VOD carries one game for the whole VOD.

### Campaign match — the weak joint, named as one
| field | status |
|---|---|
| pays_for_streamer | **partial, and it decides everything**: only 31 campaign–streamer ties exist across 613 live campaigns (by a twitch.tv/kick.com link in the brief, or the streamer's name in the title), covering 22 streamers. KaiCenat and IShowSpeed have one each; alanzoka and caseoh_ have none. Campaigns whose streamer is only on YouTube cannot be tied. |
| game_ok | fills for GTA campaigns (title says GTA, stream game is or is not GTA) |
| length_ok | **partial**: 19 of 613 briefs carry a length rule we can parse; the rest is "length rule in the brief" |
| audio_ok, tags_required, spoiler, watermark | **partial**: keyword flags only, shown as to-dos, never as passed. Most rules live behind a link in the brief (reachclipping.com/…), which we do not read |
| platform_ok, language_ok, geo_ok | **not built** (no platforms on the watchlist yet) |
| expected_$ | fills where the campaign has a record; a prize pool with no payouts yet shows as a pool, not as $0 |
| general fit (added) | 6 live "use our sound over GTA clips" campaigns accept any GTA gameplay clip. Offered only when no campaign names the streamer, always labelled general, with "add their sound" as a to-do (the renderer does not add music) |

### Queue item — fills except the file
state, hook, caption (hook + derived tags; a campaign's required tags are a to-do): fill.
file: **not built here**. Export opens /clip on the moment with no re-read (measured: editor
open in 0.9 s, a 38-s clip rendered in ~41 s on a desktop Chrome). A phone cannot render in
most mobile browsers; the finished-MP4 file waits on the server-side cut.

### Delivery — partial
push and email send; sent_at is kept per person. opened_at / exported_after come from
PostHog (`queue_open` with `from`, `queue_export`), not from the store.

### Call
Not abandoning, and not hiding the gap: the queue is fully useful alone for the moments, hooks
and one-tap export, and the campaign match is real for the 22 streamers a campaign names. The
honest limit is that Content Rewards campaigns mostly do not say which channel they pay for.
The Whop app closes that from the other side: there the campaign owner states the channel.

---

# Most clipped right now — ideal model (written 2026-11-19, before the data was checked)

## Need

ChatGPT sent 66 people in four days; 39 landed on the campaign ranker and none made a clip. A
person asking an assistant "what should I clip right now" needs an answer that is a stream and
a second, not a list of campaigns. The ideal page answers: which streams and which moments are
clippers cutting this hour, and opens the tool on that exact moment.

## Entities

### Clip event — one clip made
| field | question it answers |
|---|---|
| at | how fresh is this |
| platform, channel | whose stream |
| vod_id, t_start, t_end | which moment, exactly |
| campaign_id | was it made for a paying campaign |
| posted_url, views | did it travel |

### Hot stream / hot moment (derived)
| field | question |
|---|---|
| clips in the last hour / day / 3 days | what is hot now, and is it rising |
| distinct clippers | is it one person or a crowd |
| best paying campaign for it | is it worth my next ten minutes |

## Reality check (filled 2026-11-19)

| field | status |
|---|---|
| at | fills from 11-19 on (the counter file's name carries the time). Before that: **partial**, by UTC day only, from page analytics (457 `clip_render_done` events, 11-15 to 11-19) |
| vod_id, t_start | fills. Stored rounded to 10 s; moments are grouped in 30-s buckets |
| platform, channel | fills for a clip made on a VOD link (the VOD is named from Twitch or Kick once, then cached). A deleted VOD cannot be named and is left out (3 of 34 VODs in the seed) |
| t_end | **not built**: the charge record carries the start only |
| campaign_id | **not built**: the tool does not ask which campaign a clip is for. The streamer page joins the stream to campaigns that name the streamer instead |
| posted_url, views | **can't fill** without the clipper's own accounts (same gap as Post in the first model) |
| distinct clippers | **deliberately not kept**. The record has no browser id, so it cannot be computed. The page says "clips", never "clippers" |
| last hour / rising | **partial**: 3-day total and today's count. Hourly resolution exists from 11-19 on but is not shown until a day of it has built up |
| spread | fills: 21 streams pass the 3-clip floor, from 202 clips (KaiCenat) down to 3; 40 moments pass the 2-clip floor |

### Call
Build. The one number the page depends on, clips per stream, has a 67x spread across 21
streams, so the ranking has an answer. The honest limits: it counts clips made on heistclips
only (not all clipping everywhere), and it cannot say how many people made them.

### Expected numbers, written before any result (read them on 2026-11-26)
Base rates on record, 11-15 to 11-19: of 61 people who arrived from ChatGPT on guide and
campaign pages, 4 made a clip (6.5%); of the 39 who landed on the ranker, 0 did; of people who
landed on a `/clip` link, 57% did. The new pages carry `src=` on every link into the tool
(`trend`, `streamer`, `streamer-vod`, `maker-twitch`, `maker-kick`), so the read is: `/clip`
pageviews by `src`, and `clip_render_done` after them, in PostHog. Expected if these pages do
nothing new: the 6.5% of the old landing pages.

---

# Pay at your size — ideal model (written 2026-11-19, before the floors were checked)

## Need

Running our own clipping channel showed the ranker's "typical per clip" is what established
clippers earn. A new account with a few hundred views a clip earns $0 on most campaigns,
because most pay nothing below a floor. The ideal answer to "what can I earn" is per clipper:
given my views per clip, which campaigns pay me, how much, and what must I do to get paid.

## Entities

### Clipper size
| field | question it answers |
|---|---|
| views per clip (median, spread), per platform | what does my ordinary clip get, and how often does one break out |

### Campaign floor
| field | question it answers |
|---|---|
| min payout per clip, per platform (with the rate) | how many views before a clip earns its first cent |
| min views per clip | same, stated directly |
| pool total-views bar | how many views my clips need together before I share a pool |
| rules hidden until joined | could a rule I cannot see add another floor |
| approval rate | how many of my clips get approved at all |
| audience-country rule | do views from my audience count |

### Likely pay (derived)
| field | question |
|---|---|
| likely $ per clip at my size | what my typical clip earns here |
| share of my clips that pay anything | is this a living or a lottery |
| clips to pass a pool's bar | can I reach it at all |

## Reality check (filled 2026-11-19, against 11 campaign pages and the live snapshot)

| field | status |
|---|---|
| views per clip | **can't fill per clipper**: we never see their accounts. Proxy: three preset sizes (500 = the clip desk's prior for a new channel, EXPECTED.md; 5,000; 50,000) or the number the user gives the connector; spread assumed log-normal, sigma 1.6 (the desk's assumption, not measured on other clippers) |
| min payout + rate | fills for every CPM campaign (618 of 618 in the snapshot carry `minPayout` per platform) |
| min views per clip, pool bar | fills from each page's `configuration` block (`minClipViews`, `minCreatorViews`), public, but only for pages read since this change: the crawler re-reads pools first, then streamer and gaming campaigns (~26 pages per 30-minute run). Until read: "floor unknown, check the brief" |
| hidden rules | **partial**: the page says how many rule files open after joining (`briefCounts`), not what they say. Named on the campaign page; never assumed to be empty |
| approval rate | **can't fill**: not public |
| audience-country rule | **partial**: `geo_priced` and a brief that mentions it; the share of a clipper's views that count is theirs to know |
| spread | fills: per-clip floors run p10 1,000, median 1,500, p90 10,000 views. At 500 views a clip, 0 of 23 GTA and 0 of 92 gaming campaigns pay a typical clip; at 5,000 views, 12 GTA and 65 gaming do |

### Call
Build. The floors are public settings, not guesses, and they split the list completely by size,
which is the whole point. Named limits: no approval rate, the spread is an assumption, and rules
behind Join stay "check the brief".

# Streamer join — which channel a campaign pays for (2026-11-19)

Written from the need before looking: a clipper on a campaign card wants the stream to clip.

| entity / field | question it answers |
|---|---|
| Campaign → Channel (platform, login) | whose streams earn from this campaign |
| how joined (link in brief / name in title, exact / search / hand-checked) | how sure are we |
| channel followers, last GTA stream | is this the streamer, or a namesake |
| not streamable (YouTube only, a character, a song) | why no channel, said out loud |

## Reality check (live, 2026-11-19 evening)

| field | status |
|---|---|
| link in brief | fills for 13 of ~800 campaigns (twitch.tv / kick.com URLs) |
| name in title | fills: 18 names across 23 paying GTA campaigns; the rules alone (exists, ≥1,000 followers, GTA in 30 days, unambiguous) joined 13 channels, the same set the hand check found |
| slug differs from name | fills by search: Kick `api/search` (GATTOUZ → gattouz0), Twitch `searchFor` (PARKERRYT → realparkerr, whose socials link parkerr_yt) |
| last GTA stream | Twitch: live game, lastBroadcast, last 10 VODs. Kick: live category + VOD dates (`recent_categories` alone carries no date) |
| not streamable | named, not derivable: Dylan Page (YouTube), Tomo (YouTube), Benji Ramos (Lysium's RP character), Tokyo Girl (a song) are hand-listed in `NAME_OVERRIDES` |
| directory depth | Twitch: 100 per game, the anonymous API refuses page 2. Kick: 32 a page, pages on (4 + 2 read) |

Code: `lib/streamers.js` (`titleNames`, `acceptAccounts`, `resolveCampaignNames`), cache `streamers/names.json` (public channel data + a per-name report).

---

# Campaigns across marketplaces — ideal model (written 2026-11-19, before the sources were read)

## Need

Aidan, 2026-11-19: "are there any other streamers or campaigns we are missing?" A clipper
does not care which marketplace pays. The ranker should hold every campaign that pays for GTA
clips, wherever it runs, in one list, and say where to join each one. A campaign we never
see is money the clipper never hears about; a dead campaign we list as live is a wasted hour.

## Entities

### Marketplace
| field | question it answers |
|---|---|
| name, home url | where do I sign up |
| live list (every open campaign, public) | did we see all of them, and is this one still open |
| how often the list changes | how fresh is "live" |

### Campaign (the Campaign entity above, plus where it lives)
| field | question it answers |
|---|---|
| marketplace, id on it, join url | where do I join this one |
| status (open, paused, ended) | can I still earn from it today |
| title, owner, brief | whose clips, what do they want |
| rate per 1K, per platform; cap per clip; min payout or min views | what one clip can earn, and from what size |
| budget total, budget spent → **budget left** | is there money left for my clip |
| clippers, approved clips, views | how crowded; what an ordinary clip earned |
| source channels | which streams count |
| game tags | is it GTA |

## Joins
Marketplace → Campaign (one live list per marketplace). Campaign ↔ Source by channel handle,
as before. The same campaign listed on two marketplaces (a mirror) is one campaign, on the
marketplace that runs it.

## Reality check (filled 2026-11-19 evening, each source read once by hand)

| marketplace | live list | per-campaign fields | call |
|---|---|---|---|
| **Content Rewards** | **partial**: `/sitemap.xml` (764 campaigns) misses some open ones. "GTA 6 x ARON ORLANDO MUSIC CLIPPING" (launched 11/19, open, $1,000) is in neither the sitemap nor any `/c/discover` page (469 clipping cards over 5 pages, all in the sitemap). CR's own article `/articles/gta-6-clipping` links it. Ssemble's board mirrors 168 CR campaigns by id; 16 of them were open and missing from the sitemap (read 2026-11-19 evening). | fills (the Campaign reality check above) | read the sitemap, every page of `/c/discover/clipping` and `/ugc` (`?page=N`, linked from the page itself), CR's GTA article and Ssemble's mirror ids; read any page they name; keep it while it says `active` |
| Ssemble | fills: `/clip-rewards` server-renders `liveCampaigns` (200 rows: 31 its own, 168 CR mirrors, 1 PromoteFun) | rate, budget total, budget spent, platforms, clippers, views, the streamer's channel, first seen. **No** cap, floor, brief, per-campaign page | add (own rows only) |
| Vyro | fills: `/sitemap/campaigns.xml` (7 at 18:40, 8 by 20:50) | title, owner, rate per 1M, platforms, pay type. **No** budget at all, cap, floor, clippers | add; budget shown as not public |
| Clipstake | fills: `/marketplace` server-renders every campaign (34: 13 active, 17 paused, 4 ended) with status | rate, budget, spent, balance, platforms, views, geo pricing. **No** cap, floor, clippers | add (active rows only) |
| **Clipster** | **can't fill**: the list loads from `/api`, which its robots.txt disallows | its public page (`/discover?openedCampaignId=`) shows title, rate and total budget only, with **no status and no budget left**: a campaign with $0 left renders the same as a live one | skip |

Field by field for the new sources: `budget_left` fills for Ssemble and Clipstake, **can't fill**
for Vyro (shown "not public", never 0); `cap_per_clip` and the floor **can't fill** for any of
the three (floor shows "unknown, check the brief", as for an unread CR page); `expected_per_clip`
needs approved clips, which none of them publish, so they rank after the proven CR campaigns,
as brand-new CR campaigns already do. Clipper names and avatars are not stored.

What else the check found: "TOMO GTA VI Clipping" is out of the sitemap because it is
**paused with its $1,000 spent**, so it rightly does not rank. "GTA VI | PARKERRYT STREAM" and
"DiegoLoveless GTA 6 Clipping" were in our cache under their old non-GTA names: discover cards
carry the current title, so a rename now lands within one run. But a **group** card ("GTA 6", six
campaigns) carries one member's id with the group's title and total: it had set LACY, YourRAGE
and Clix to a $15,000 budget each in the live snapshot. Group cards are now skipped and their
tainted members re-read. The 103 sitemap ids missing from
the snapshot were never read yet (older September campaigns, 26 pages a run shared with
re-reads); new ids now get their own budget. "Miami Crime RP" is a Roblox game, not GTA RP, so
it stays out; FiveM (GTA V roleplay servers) now counts as GTA.

### Call
Build for Content Rewards (discovery), Ssemble, Vyro and Clipstake. Skip Clipster: no public
list, and its public page cannot say whether money is left, so it would list spent campaigns as
live. Named limits: Vyro's budget is not public; no new source publishes a floor or a cap.

---

# YouTube streams — ideal model (written 2026-11-19 night, before the API was read)

## Need

Aidan, 2026-11-19: "build it". Campaigns pay for YouTube streamers (Tomo, Dylan Page's 120-hour
marathon, Vyro's "GTA VI YouTube Livestream"), and 12 lookups in 3 days failed on a YouTube link.
A clipper pasting a YouTube stream wants the same answer a Twitch stream gets: where the moments
are, and a 9:16 file of one of them. Only official, robots-allowed routes: the Data API v3,
oEmbed and plain watch links.

## Entities

### YouTube source — one video (a live stream, or a finished one)
| field | question it answers |
|---|---|
| video id, watch url | what am I clipping, where do I watch it |
| title, channel name, channel id, handle | whose stream is this |
| length, started at, ended at | how long; what second of the stream is "now" |
| live state (live / upcoming / finished / not a stream) | can moments come from live chat, or only afterwards |
| active live chat id | where live chat is read |
| thumbnail | the card |
| channel → current live, latest finished streams | "@tomovids" → which stream did they mean |

### Moment (the Moment entity above, plus where it came from)
| field | question it answers |
|---|---|
| t_peak, t_start, t_end (stream seconds) | where to cut |
| signal: live chat speed / viewers' timestamped comments | why we think it is a moment, said honestly |
| chat ratio, top phrase, event type (live) or n comments, likes, the best comment (finished) | how strong; what happened |
| greetings and requests filtered out | is it a reaction, not a roll call |
| watch link at the second (`watch?v=ID&t=Ns`) | check it before cutting |

### Shared live poller — one per live stream, however many people watch it
| field | question it answers |
|---|---|
| video id, live chat id, next page token, polling interval YouTube asks for | where to read next, and how soon we may |
| last looked at (site visitor or connector call) | is anyone still watching; stop when not |
| messages (stream second, text; no author) for the last hours | the rate curve and the moments |

### Quota — the Data API's daily budget
| field | question it answers |
|---|---|
| units spent today (Pacific day), per call kind | how many stream-hours are left today |
| exhausted flag + reset time (midnight Pacific) | what to tell people when it runs out |

### Local copy — the clipper's own file of the stream
| field | question it answers |
|---|---|
| file (stays on their device; never uploaded) | what the editor cuts from |
| offset (the stream second their file starts at) | where the moment is in their file |
| file length | is the moment in it at all |

## Joins
YouTube source → Moments (by video id). Source → shared poller (one per live video). Moment +
local copy (+ offset) → the editor's window in file seconds. Campaign `source_channels` (YouTube
handles) → YouTube channel → its live or latest stream.

## Reality check (filled 2026-11-19 night, against the live Data API with our key)

| field | status |
|---|---|
| video id, title, channel, length, live state, started/ended, thumbnail | **fills**: `videos.list` (1 unit) with `liveStreamingDetails`; a live stream's length is now minus `actualStartTime` |
| active live chat id | **fills** for a live stream (`activeLiveChatId`); gone once it ends |
| @handle → current live / latest finished | **fills** for 3 units: `channels.list forHandle` → uploads playlist (a stream in progress IS in it, checked on IShowSpeed) → `videos.list`. `search.list` is out: it has its own **100 a day** cap on this project |
| live chat messages, no author | **fills with an API key** (no OAuth): `liveChatMessages.list`, first page reaches back ~1-2 min of text (plus older gift events). **5 units** a call, refused calls too (measured: 40 calls = 200 units) |
| live chat history before anyone looked | **can't fill**: the API has no history. Moments start when reading starts; said on the page and to the assistant |
| finished stream's chat | **can't fill**: the API has no replay (`liveChatEnded`), and the replay route the probe found is robots-disallowed. Replaced by the one official signal: viewers' timestamped comments |
| timestamped comments → moments | **fills for big streams, thin for small ones**: IShowSpeed's 23.8 h GTA stream: 224 of 1,000 comments carry a time, top moment 42 comments / 856 likes at 8:28:50. Kai Cenat Part 1: 57 of 396, mostly one viewer's chapter list. TheBurntPeanut: 30 of 477, 1 moment. Tomo Day 2: 9 comments, 0 times: the honest "none to go on" message |
| moment signal said out loud | fills: `signal` = `live_chat` or `comments`, shown as "chat N× normal speed" or "N viewers timestamped this" |
| greetings/requests filtered | fills: `public/js/youtube.js` `noiseKind`; 7.6% of IShowSpeed's (363 of 4,802) and 6.3% (220 of 3,509) of TheBurntPeanut's live messages were noise (14 min, 2026-11-19) |
| poller: one per stream, stop when nobody looks | fills: look markers (10 min site, 30 min connector), a per-minute claim file, a per-minute cron |
| quota spent today, exhausted, reset | fills: append-only ledger in Blob summed by list; YouTube's own `quotaExceeded` marks the day; reset = midnight Pacific |
| local copy: file, offset, length | fills: a blob: URL in the browser, never uploaded; the length from the file's metadata |
| campaign `source_channels` → YouTube channel page | **not built**: a streamer page reads live state keylessly from Twitch/Kick; a YouTube one costs a `videos.list` per check. Left for later, named here |

### Call
Build. The model fills except the two chat-history fields, which no official route can fill;
the comment signal stands in for a finished stream and the page says which signal each moment
came from. Quota math: a live stream polled once a minute = 60 calls × 5 = **300 units an
hour**; live polling stops at 9,000 of the 10,000, so **~30 stream-hours a day** (e.g. 6
streams watched for 5 hours), lookups and comment reads (1 unit each, ≤10 a finished stream)
keep the last 1,000.

# Hosted campaigns — ideal model (written 2026-11-20, before any source was checked)

## Need

Aidan, 2026-11-20: the connector brings clippers (294 Claude accounts in 30 days; 114 of them made
489 clips) but clippers barely pay (10 hit the free wall, 3 opened checkout, 0 paid). The money in
clipping sits with whoever funds a campaign, and those owners have almost no way to check the
views they pay for. So: a streamer, manager or studio funds a campaign **on heistclips**; clippers
find it, cut it, post it themselves and submit it from inside Claude; we verify each clip, count
its views and pay clippers weekly on the site. The step we take over for the owner is "is this
clip real, mine, within my rules, and how many real views did it get". For the clipper it is
"submit, and know what I earned" without leaving the chat.

## Entities

### Owner — who funds a campaign
| field | question it answers |
|---|---|
| owner key (random, kept in their browser) | who may see this dashboard, with no password |
| twitch channel: id, login, display name | whose streams are clipped |
| proof: how ownership was shown (Twitch sign-in, or a code in their bio/panel), when | is this really their channel (nobody funds a campaign for someone else's stream) |
| email (from Checkout) | who to tell when the budget runs low; who gets a refund |
| campaigns | what they have running |

### HostedCampaign
| field | question it answers |
|---|---|
| id, slug, title, channel | what clippers are cutting, and the page they land on |
| budget (clipper money), fee %, fee $, total charged | what the owner paid and what clippers can earn in all |
| rate per 1K views, view floor, cap per clip | what one clip earns, and from when |
| platforms | where a clip counts |
| rules: min/max length, facecam required, required tags, notes | will this clip be accepted |
| status (draft, funded, ended), funded at, Stripe session | is it live, and is the money real |
| earned so far, budget left (derived) | how much is left for the next clip |
| suspect views (derived) | which views should the owner look at before paying |

### ClipperAccount — one verified social account
| field | question it answers |
|---|---|
| heistclips account code (hc_…) | whose earnings these are (the connector's only identity) |
| platform, handle, channel id (YouTube) | which posts count as theirs |
| verification code, where it was found (bio), when | did they prove they control it |
| payout destination (e.g. PayPal email), encrypted | where Aidan sends the money |

### Submission
| field | question it answers |
|---|---|
| id, campaign, clipper account, platform, post URL, post id | which post, for which campaign, by whom |
| posted at, submitted at | is it fresh (posted after the campaign opened, recently) |
| author of the post | is it posted from the verified account |
| length, caption tags present | does it keep the campaign's rules |
| facecam, right streamer, music | rules a machine cannot read reliably: the owner reviews these |
| status (counting, rejected by owner) + reason | does it earn |

### ViewReading
| field | question it answers |
|---|---|
| submission, read at, views (public count), source | the view curve |
| likes, comments at the same moment | do the views look like people (views with no engagement) |
| viewer country | which views a geo-priced campaign pays for |
| suspect flag + reason (sudden spike) | which jumps the owner should look at, without auto-rejecting |

### Earning / PayoutLine
| field | question it answers |
|---|---|
| submission, increment, at (from each reading) | when each dollar was earned |
| budget cap applied | did the budget run out first |
| week, clipper account, amount, suspect amount | what Aidan pays whom this week |
| paid at | what is still owed |

## Joins
Owner → HostedCampaign (owner key hash). HostedCampaign ← Submission (campaign id). Submission →
ClipperAccount (account code + platform/handle, checked at submit). Submission ← ViewReading
(submission id). Earnings replay every reading of a campaign in time order against its budget;
PayoutLine = earnings grouped by ISO week and clipper account. HostedCampaign → the Campaign
entity above (`marketplace: "heistclips"`), so ranking and plan_my_clips treat it like any other.

## Reality check (filled 2026-11-20, each source read live)

| field | status |
|---|---|
| Twitch channel id/login/name | **fills**: anonymous GQL `user(login)` (already used site-wide) |
| ownership by Twitch sign-in | **fills once a Twitch app is registered** (client id + secret, redirect `https://heistclips.com/oauth/twitch/callback`). Code ships dormant until the env is set |
| ownership by bio/panel code | **fills**: GQL `user{description panels{... on DefaultPanel{title description linkURL}}}` read anonymously (yourragegaming: bio + 12 panels, 2026-11-20) |
| pitch: moments chat flagged in their recent VODs | **fills**: `findClipMoments` on their latest VODs (the finder behind /clip) |
| pitch: how many of those were clipped | **fills for heistclips clips only**: the per-clip trend records (`trend/c/<day>/…~vod~t`), by VOD and 30 s bucket. Clips made elsewhere are not counted; the page says so |
| owner email | **fills** from Checkout (`customer_details.email`), kept with the funding record in a keyed path |
| budget, fee, total charged, funded at | **fills**: Stripe Checkout line items + the paid session (webhook via stripe-router, and claim on return) |
| rate, floor, cap, platforms, length, required tags | **fills**: the owner types them |
| facecam required | **fills as a rule, can't be checked by machine** in this slice: shown to the owner on each submission as "check" |
| TikTok: post author, created at, caption, length, play count | **fills from Vercel**: the public video page's `__UNIVERSAL_DATA_FOR_REHYDRATION__` (`author.uniqueId`, `createTime`, `desc`, `video.duration`, `stats.playCount`); read from a throwaway Vercel function in iad1, 2026-11-20, 4 of 4 reads 200 |
| TikTok: bio for verification | **fills from Vercel**: same blob, `userInfo.user.signature` (2 of 2 profiles) |
| YouTube: channel, published at, title+description, length, view count | **fills**: Data API `videos.list` part=snippet,statistics,contentDetails, 1 unit per 50 videos (the watch page is bot-walled from Vercel, measured 11/19) |
| YouTube: channel description for verification | **fills**: `channels.list forHandle` part=snippet, 1 unit |
| Instagram Reels / X | **can't fill**: no public read of a post's author and views without a login. Left out of the platforms an owner can pick, said on the page |
| likes/comments beside views | **fills** (TikTok `diggCount`/`commentCount`, YouTube `likeCount`/`commentCount`); stored with each reading |
| viewer country, bot score | **can't fill**: neither platform publishes a post's audience without the creator's login. Named here; the spike flag is the only bot signal in this slice |
| payout destination | **fills** when the clipper types it on /earnings; sealed with TOKEN_ENC_KEY |
| paying the clipper | **not built by design**: Aidan pays from the CSV. No Stripe Connect, and no tool moves money (Claude directory policy §4A) |

### Call
Build. Every field fills except viewer country / bot score (no public source) and Instagram/X
(no public author or views); the slice offers TikTok and YouTube Shorts only, and the owner sees
a curve plus a spike flag rather than a bot score. Twitch sign-in waits on a registered app; the
bio code covers it until then.

### Expected numbers, written before any result (read them on 2026-12-04)

Base rate for owners: 7 streamer pitches sent 2026-11-19, no campaign funded on heistclips ever.
- **Funded campaigns by 2026-12-04: 0 to 1.** One is a good result; two or more says owners want
  this and the pitch should go wider.
- **Fee revenue: $0** most likely; one campaign at the $100 minimum budget is $10, a $1,000 one
  is $100 (10% default, `HOSTED_FEE_PCT`).
- **/launch visitors: 0 to 15**, nearly all from the pitches (no link from the home page yet).
- **Clipper side, only if a campaign funds:** 3 to 15 verified accounts and 5 to 30 submissions
  in its first week (base: 114 connector accounts made clips over 30 days, 12 of 107 web makers
  made 10+ clips in two days). With no funded campaign, verify_account/submit_clip calls ≈ 0.
- A submission rejected for "not your account" or "not fresh" above 30% of tries says the tool
  description is unclear, not that clippers cheat.
