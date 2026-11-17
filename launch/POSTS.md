# Launch posts: DRAFTS, Aidan posts them himself

Explainer register (`aidan-voice`). Every number comes from the live ranker's `rank_campaigns`
summary, read 2026-11-16 23:31 UTC: 747 campaigns, median approved clip $4.10, p10 $0.19,
p90 $23.75. Re-read those numbers before posting; they move every 30 minutes.

---

## r/whop

**Title:** Built a free campaign ranker + live stream clipper for GTA 6 launch week

GTA 6 drops Thursday. Every clipping campaign on Content Rewards is about to get flooded.

So I built heistclips.com. It does two things.

It ranks every live campaign — 747 right now — by what an approved clip actually pays. Not the CPM. The cap, the budget left, and what clippers have really been paid. The median clip earns $4.10. The bottom 10% earn $0.19. The top 10% clear $23. Same work.

And it watches Twitch and Kick chat while the stream is live. When chat spikes, that's the moment. It cuts a vertical clip around it — facecam over gameplay, hook on top, no watermark. Built for gameplay, not podcasts.

You pay per clip you export. Not per minute of footage.

There's a board where you can request features and upvote them. We build what clippers ask for.

What's the one thing your clipping tool gets wrong?

---

## Show HN

**Title:** Show HN: Heistclips – open-source stream clipper that finds chat-spike moments

**URL:** https://github.com/2016judea/heistclips

Most AI clippers find moments by transcribing the video. That works for podcasts. It doesn't work for games — the moment in a GTA stream is a car flying off a pier, and nobody says anything useful while it happens.

Chat does. Twitch and Kick chat is public, so heistclips counts messages per second, finds the spikes, and cuts only the minutes around them into a vertical clip. A seven-hour stream doesn't need seven hours of transcription.

It ships as an MCP server (https://heistclips.com/mcp), a CLI and a Claude Code skill. So an agent can ask "which clipping campaign pays most per clip right now" or "find the moments in <streamer>'s last stream".

The other half ranks 747 paid clipping campaigns by what an approved clip actually earns. The median is $4.10. The 10th percentile is $0.19.

Built it for the GTA 6 launch on Thursday.

---

## X

GTA 6 drops Thursday. Every clipper is about to fight over the same streams.

Built heistclips.com. It clips Twitch streams live, off chat spikes. Built for gameplay, not podcasts. Pay per clip, no watermark.

And a free campaign ranker. The median clip pays $4.13.

---

## Posted

Run 2026-11-16, Monday evening. Times are UTC. The numbers above were refreshed from the ranker
snapshot of 23:31 UTC (747 campaigns, median $4.10, p10 $0.19, p90 $23.75).

Three wording changes beyond the numbers and "Twitch and Kick chat", each needed for the post to go up or stay true:
- **Show HN title** was 84 characters, and HN caps titles at 80. "finds moments from chat spikes" became "finds chat-spike moments" (78).
- **X post** counted 288 by X's rules, because a bare domain is weighted as a 23-character link. "while they're live" became "live" (274).
- **Show HN body:** Kick chat is read over HTTP, not IRC, so "Twitch and Kick chat is public over IRC" dropped "over IRC".

| Platform | Account | Result | Time |
|---|---|---|---|
| r/whop | u/aidanjude (created today) | **Not posted.** Sidebar rule 7: "We are no longer allowing posts related to clipping or content rewards." | — |
| Show HN | 2016judea (Aidan, by hand) | https://news.ycombinator.com/item?id=50525493. Aidan posted it himself after sign-up hit a reCAPTCHA. At 00:21 the HN API showed the story as **dead**, meaning HN killed it and it isn't publicly visible. | 2026-11-17 00:09 |
| X | @_plumbbob_ (display name heistclips; created through X's Google sign-up) | https://x.com/_plumbbob_/status/2122484959634198900. The first attempt failed because X refused email sign-up. The median was re-read at post time from the 00:01 snapshot: $4.13, same length. | 2026-11-17 00:20 |

### Whop messages

Sent from the Whop account @aidanjude through each store's **Contact support** button, which goes to
that store's admin team as a support chat. One message per store, text as in `outreach/drafts/`,
numbers re-checked on each Content Rewards campaign page at 00:00 UTC (unchanged).

| Store | Sent | Where |
|---|---|---|
| ViewMaxer (whop.com/viewmaxer) | 2026-11-17 00:04 | Contact support → admin team chat |
| Hype Media (whop.com/hype-media-81c0) | 2026-11-17 00:05 | Contact support → admin team chat |
| Placements (whop.com/placements) | 2026-11-17 00:05 | Contact support → admin team chat |
