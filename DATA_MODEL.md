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

## Reality check (filled after the research)
_pending_
