# heistclips

**Live:** https://heistclips.com

The open-source, local OpusClip alternative, built for agents and for gameplay.

Paste a Twitch or Kick channel. heistclips reads its chat, finds the seconds chat exploded, and cuts
them to 9:16 (facecam over gameplay) with a hook line, on your own machine. It works on
streams that are **still live**. Then it tells you which clipping campaign pays most for the
clip.

- **Built for gameplay, not podcasts.** Transcript-based clippers miss gaming moments, which
  are visual. Chat doesn't: every spike is a timestamp, and each pick shows the lines chat
  typed so you can see why it was picked.
- **Free to find, local to cut.** Moment-finding reads public chat replay (~20 s for a 7-hour
  stream). Cutting happens in your browser (canvas + MediaRecorder) or with your local
  ffmpeg. Nothing is uploaded. No per-minute billing, no watermark, no AI tags in the file.
- **Music-claim warning.** If Twitch muted a stretch for licensed music (GTA radio), the
  moment is flagged before you post it and lose the payout.
- **Campaign ranker.** Every live clipping campaign ranked by what a typical approved clip has
  *actually earned*, with budget runway, so you clip for the one that pays.
- **Never a dead end.** A name typed with spaces, a clip link, a stream that isn't saved, a
  silent chat: each gets a plain answer and the live GTA streams you can clip right now.
- **English, Deutsch, Français.** The tool, pricing, guides and board are at `/de` and `/fr`
  (`lib/l10n_de.js`, `lib/l10n_fr.js`, `public/js/l10n.js`); hook lines follow the language.

## Autopilot: a queue of ready clips

`/queue`: pick the streamers you clip. Every 10 minutes heistclips reads each watched channel
once (however many people watch it), keeps the moments where chat ran at least 2× its normal
speed, and matches each to the best-paying live campaign that names that streamer and whose
readable rules it passes. Where no campaign names the streamer, a GTA clip is offered the
open "use our sound" campaigns, labelled as a general fit. The page opens on "Paying right now": every streamer a live campaign names, best pay first,
with the clipper count beside it. No login: a secret link carries the
queue between devices. A queued clip costs one clip only when exported. Optional web push or
email when new clips land.

| Path | What |
|---|---|
| `lib/autopilot.js` | Campaign match, general fit, the queue. Pure, tested. |
| `lib/watch.js` | Watchlists, the per-channel incremental scan, push and mail. |
| `api/queue.js` | The clipper's API. `queueFor(key)` is the function a connector tool calls. |
| `api/autopilot.js` | The cron, and its cap: 25 channels or 85 s a run, 2 Kick channels, 30 mails a day. |
| `scripts/dev_local.mjs` | Local server whose storage is a local folder. Use it for anything that writes. |

## Whop app

heistclips installs into a Whop (app `app_my7kSid9rb0xHU`, in app-store review since 2026-11-19;
install link: https://whop.com/apps/app_my7kSid9rb0xHU/install). The campaign owner picks their
Content Rewards campaign and names the channels it pays for; their clippers open heistclips
inside the whop and get that campaign's pay, rules and a queue of ready clips, plus the moment
finder. Whop's `x-whop-user-token` is verified against its JWKS and access is checked with
Whop on every request; only the business's team can change the campaign.

| Path | What |
|---|---|
| `api/whop.js` | `/experiences/<exp_…>` (members) and `/dashboard/<biz_…>` (owner default), and their API. |
| `lib/whop.js` | Token verification, access check, per-installation config. |
| `lib/whoppage.js`, `public/js/whop.js` | The view inside Whop's iframe. |

Env: `WHOP_APP_ID`, `WHOP_API_KEY`.

## Use it from an agent

**MCP server** (no key, no account): `https://heistclips.com/mcp`

```bash
claude mcp add --transport http heistclips https://heistclips.com/mcp
```

Tools: `find_clip_moments`, `cut_clip`, `post_clip`, `posting_account`, `rank_clipping_campaigns`,
`clipping_campaign_details`, `live_gta_streams`, `list_feature_requests`, `upvote_feature_request`,
`request_a_feature`. Works as a ChatGPT
connector (developer mode), a Claude custom connector, and a Grok connector
(grok.com/connectors).

**Claude Code / Codex skill:** copy `skill/heistclips/` into `~/.claude/skills/` (or your
agent's skills folder). It teaches the agent to find moments and cut clips with the CLI.

### Cut and post without the editor

`cut_clip` cuts a 5-60 s window on the server (ffmpeg in `api/v1/cut.js`) and returns an MP4
link kept for 72 hours; it spends one clip credit through `api/credits.js`, like a browser
render. `post_clip` posts that file to YouTube or TikTok for an account that connected them at
`/post`. A platform is offered only when its OAuth client is in the environment:

| Platform | Env vars | Redirect URI to register | Scopes |
|---|---|---|---|
| YouTube | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | `https://heistclips.com/oauth/youtube/callback` | `youtube.upload` |
| TikTok | `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` | `https://heistclips.com/oauth/tiktok/callback` | `user.info.basic`, `video.upload`, `video.publish` |

Tokens are AES-256-GCM sealed with `TOKEN_ENC_KEY` inside the account record, which sits under a
keyed-hash Blob path (`lib/accounts.js`). Until each platform's own review passes, posts arrive
private; `lib/social.js` says what is held back.

## CLI (local, needs Node 20+ and ffmpeg)

```bash
git clone https://github.com/2016judea/heistclips && cd heistclips
node cli/heistclips.mjs moments xqc                 # the moments chat exploded in xQc's live/latest Twitch stream
node cli/heistclips.mjs moments kick.com/xqc        # same, on Kick
node cli/heistclips.mjs auto xqc --n 3              # find + cut the top 3 to clips/*.mp4 (9:16, hook burned in)
node cli/heistclips.mjs cut https://www.twitch.tv/videos/2929840281 --start 4:07:16 --end 4:07:54 --layout split --cam tr --hook "Wait for it"
node cli/heistclips.mjs campaigns --filter gta      # who pays most per clip right now
```

## How moments are found

Twitch's chat replay is paged ~60 messages at a time, so the time one page spans is the
inverse of chat speed at that point. heistclips samples the replay every 10–30 s, scores each
point against the median of the surrounding ten minutes, boosts "clip it" requests and
laugh/hype/shock emotes, then re-reads the top peaks at 6-second resolution to find the
onset. The clip window starts ~24 s before chat reacts and ends ~14 s after. Live streams use
anonymous read-only IRC and fire a moment when 5-second chat speed hits 2.5× the last five
minutes; the stream's in-progress VOD trails live by ~10 s, so it can be cut within a minute.

## Repo map

| Path | What |
|---|---|
| `public/js/twitch.js` | Twitch reading + moment finding. Runs in the browser and in Node unchanged. |
| `public/js/render.js` | Browser 9:16 renderer (hls.js → canvas → MediaRecorder). |
| `public/js/live.js` | Live chat watcher. |
| `cli/heistclips.mjs` | Local CLI with ffmpeg. |
| `lib/campaigns.js` | Campaign feed → ranked list. |
| `api/` | Vercel functions: pages, `/mcp`, credits, checkout, the request board, the 30-min refresh. |
| `DATA_MODEL.md` | The ideal data model this was built against, and which fields reality fills. |

Tests: `npm test` (offline).

## Data and licence

Code: MIT. Campaign figures are read from Content Rewards' public campaign pages (their
sitemap and discover pages; never `/api/`, which their robots.txt disallows) and link back to
each campaign. Stream and chat data come from Twitch's public endpoints, read
anonymously. Not affiliated with Rockstar Games, Take-Two Interactive, Twitch or Content
Rewards; "GTA VI" is used descriptively.
