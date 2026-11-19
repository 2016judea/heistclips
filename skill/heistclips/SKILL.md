---
name: heistclips
description: Find the moments worth clipping in a Twitch stream (live or VOD) from chat spikes, cut them to 9:16 vertical clips with a hook line using local ffmpeg, and pick the clipping campaign that pays most per clip. Use for "clip this stream", "find the best moments in <streamer>'s stream", "make Shorts/TikToks from this VOD", "which clipping campaign pays most", "GTA 6 clips".
grounded: 2026-11-16 — built for the GTA VI launch week; moment finder measured at ~16 s for a 7-hour VOD.
---

# heistclips

Repo: https://github.com/2016judea/heistclips (MIT). Needs Node 20+ and ffmpeg on PATH.

## Find moments

    node cli/heistclips.mjs moments <channel|vod-url> --n 8 [--json]

Each moment: window (start–end), chat speed vs normal (×), event type, "clip it" count,
music risk, hook lines. A live channel is read from its in-progress VOD.

## Cut

    node cli/heistclips.mjs cut <vod> --start H:MM:SS --end H:MM:SS --layout split|fit|crop --cam tl|tr|bl|br --hook "text" --out clip.mp4
    node cli/heistclips.mjs auto <channel|vod> --n 3 --dir clips

Rules:
- **Skip moments with `music risk: high`.** Twitch muted that audio for licensed music; YouTube
  Content ID / TikTok will claim it and campaigns stop paying. `auto` skips them already.
- `split` (facecam over gameplay) is the gaming default; ask where the facecam is, or render
  one frame and look. `fit` (blurred fill) suits streams without a facecam.
- Render one file per hook for multiple posts. Identical uploads get matched and suppressed.

## Pick the campaign

    node cli/heistclips.mjs campaigns --filter gta|gaming|all

Ranked by what a typical approved clip has actually earned (top 3 earners excluded), cut if
the budget runs out within 3 days. Quote numbers exactly; link the campaign page.

## Without the CLI

MCP server: `https://heistclips.com/mcp` (tools: find_clip_moments, rank_clipping_campaigns,
clipping_campaign_details, live_gta_streams, list/upvote/request feature). Web app:
https://heistclips.com/clip renders in the browser.
