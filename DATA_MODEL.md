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
Source: Content Rewards' public discover feed (`/api/campaign/campaigns/discover`, 50/page,
796–811 live campaigns, all read in ~8 s). Their Creator Terms (rev. 2026-11-13) carry no
scraping clause; their robots.txt disallows `/api/`. We read it every 30 min with an honest
user agent, link every campaign back to its own page, and republish facts, not their copy.
**Risk Aidan should know: robots.txt asks crawlers to stay out of `/api/`.**

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
Kick: **not built** (its API is Cloudflare-walled to curl and the public API wants an OAuth
app). YouTube Live: **not built**. campaign_ids: partial, via handles above.

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
