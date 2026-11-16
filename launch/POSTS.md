# Launch posts: DRAFTS, Aidan posts them himself

Explainer register (`aidan-voice`). Every number comes from the live ranker's `rank_campaigns`
summary, read 2026-11-16 21:00 UTC: 745 campaigns, median approved clip $4.13, p10 $0.19,
p90 $22.81. Re-read those numbers before posting; they move every 30 minutes.

---

## r/whop

**Title:** Built a free campaign ranker + live stream clipper for GTA 6 launch week

GTA 6 drops Thursday. Every clipping campaign on Content Rewards is about to get flooded.

So I built heistclips.com. It does two things.

It ranks every live campaign — 745 right now — by what an approved clip actually pays. Not the CPM. The cap, the budget left, and what clippers have really been paid. The median clip earns $4.13. The bottom 10% earn $0.19. The top 10% clear $22. Same work.

And it watches Twitch chat while the stream is live. When chat spikes, that's the moment. It cuts a vertical clip around it — facecam over gameplay, hook on top, no watermark. Built for gameplay, not podcasts.

You pay per clip you export. Not per minute of footage.

There's a board where you can request features and upvote them. We build what clippers ask for.

What's the one thing your clipping tool gets wrong?

---

## Show HN

**Title:** Show HN: Heistclips – open-source stream clipper that finds moments from chat spikes

**URL:** https://github.com/2016judea/heistclips

Most AI clippers find moments by transcribing the video. That works for podcasts. It doesn't work for games — the moment in a GTA stream is a car flying off a pier, and nobody says anything useful while it happens.

Chat does. Twitch chat is public over IRC, so heistclips counts messages per second, finds the spikes, and cuts only the minutes around them into a vertical clip. A seven-hour stream doesn't need seven hours of transcription.

It ships as an MCP server (https://heistclips.com/mcp), a CLI and a Claude Code skill. So an agent can ask "which clipping campaign pays most per clip right now" or "find the moments in <streamer>'s last stream".

The other half ranks 745 paid clipping campaigns by what an approved clip actually earns. The median is $4.13. The 10th percentile is $0.19.

Built it for the GTA 6 launch on Thursday.

---

## X

GTA 6 drops Thursday. Every clipper is about to fight over the same streams.

Built heistclips.com. It clips Twitch streams while they're live, off chat spikes. Built for gameplay, not podcasts. Pay per clip, no watermark.

And a free campaign ranker. The median clip pays $4.13.
