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
