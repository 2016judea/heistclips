# Connector listing kit

Copy from here. Pattern and rejection history: `small-business-intelligence-mcp/SUBMISSION-KIT.md`.

| Field | Value |
|---|---|
| Name | heistclips (GTA 6 clipping) |
| Endpoint | `https://heistclips.com/mcp` · Streamable HTTP · auth none · no UI/CSP |
| Publisher | Brick and Mortar AI LLC, 1651 Eleanor Ave, Saint Paul, MN 55116 |
| Website / docs | https://heistclips.com/connect |
| Privacy / terms | https://heistclips.com/privacy · https://heistclips.com/terms |
| Support | aidan@brickandmortar.dev |
| Source | https://github.com/2016judea/heistclips |
| Icon | https://heistclips.com/img/icon.svg |
| MCP Registry | `com.heistclips/heistclips` 0.1.0 — LISTED 2026-11-16 (DNS auth; key in `~/.config/heistclips/`) |
| OpenAI domain challenge | set Vercel env `OPENAI_APPS_CHALLENGE` → served at `/.well-known/openai-apps-challenge` (404 until set) |

## One-liner (≤100)
Find clip-worthy moments in Twitch streams from chat spikes; rank clipping campaigns by pay per clip

## Description
For people who cut streams into Shorts, TikToks and Reels for money. Ask which clipping
campaign pays most per clip right now, or for the best moments in a streamer's live or latest
Twitch stream, and get the answer from live data: campaign rates, caps, budget runway and what
a typical approved clip has actually earned; moment timestamps with chat speed, hook lines and
a music-claim warning. Free, no account, no key.

## Annotations (all explicit booleans; `test/mcp.test.js` holds them)
| Tool | readOnly | destructive | openWorld | idempotent |
|---|---|---|---|---|
| rank_campaigns, campaign_details, find_moments, live_gta_streams, list_feature_requests | true | false | true | true |
| request_a_feature (writes a board row, emails the builder) | false | false | true | false |
| upvote_feature_request | false | false | true | true |

## Test cases (run against the live endpoint 2026-11-16)
1. "Which GTA 6 clipping campaign pays the most per clip right now?" → rank_campaigns {filter:"gta"}
2. "Find the best moments in xrohat's stream" → find_moments {source:"xrohat"} (30-h live stream: 3 moments in ~40 s)
3. "Tell me about the Tokyo Girl campaign" → campaign_details
4. "Who's streaming GTA right now?" → live_gta_streams
5. "What features are people asking heistclips for?" → list_feature_requests
6. "Find moments in kick.com/xqc's last stream" → find_moments {source:"kick.com/xqc"}
Negative: "Clip this YouTube Live stream" → find_moments says it takes Twitch or Kick; "Post my clip to TikTok" → no tool; "What's the GTA 6 release date?" → no tool.

## Starter prompts
- Which clipping campaign pays most per clip today?
- Find the moments chat lost it in <streamer>'s last stream
- Which GTA streamers are live right now?

## What needs Aidan (gates)
- **ChatGPT: NOT FILED. Blocked 2026-11-16 on his passkey** (see Submissions below). Once he is
  signed in to platform.openai.com: Create plugin → With MCP → Universal → endpoint above →
  auth none → Scan Tools (7) → domain token into Vercel env `OPENAI_APPS_CHALLENGE` → demo
  recording in Developer mode → submit → he clicks Publish after approval. Headless is signed
  out and Turnstile-walled.
- **Claude directory:** filed 2026-11-16, in review. Nothing to do.
- **Grok:** filed 2026-11-16 through xAI's form. A reply comes by email to aidan@brickandmortar.dev.

## Submissions (2026-11-16, "prepare for distribution")

| Where | Status | UTC | Listing / ID |
|---|---|---|---|
| Official MCP Registry | LISTED | 11-16 | `com.heistclips/heistclips` 0.1.0 |
| Claude Connectors Directory | **SUBMITTED, in review** ("can take a few weeks") | 23:04 | claude.ai/directory/manage/heistclips · slug `heistclips` (permanent) |
| ChatGPT plugin directory | **NOT SUBMITTED**: stopped at sign-in, needs his passkey | 22:50 | — |
| xAI Connector Marketplace (Grok, Grok Bot, Cursor) | **SUBMITTED, pending review** | 21:10 | x.ai/bot/marketplace/submit-a-plugin · no ID shown · reply to aidan@brickandmortar.dev |
| Glama | **LISTED, claimed, health check passing** | 21:20 | https://glama.ai/mcp/connectors/com.heistclips/heistclips |
| mcp.so | **SUBMITTED free, queued for review** | 22:49 | submission `81b752a0-13b0-4fe5-a227-1cec259d8c49` · will be mcp.so/server/heistclips-gta-6-clipping (404 until approved) |
| Smithery | SKIPPED | — | closed to submissions 2026-10-31 (now a curated directory run by Arcade) |
| PulseMCP | SKIPPED | — | submissions paused since 2026-09-03; it picks up the registry entry automatically when it reopens |
| mcptop | SKIPPED | — | no submission path; it mirrors the ChatGPT, Claude and Cursor directories |

Nothing was paid, nothing was sent to a person, nothing was posted on his accounts.

**ChatGPT, where it stopped.** The platform account (aidanjude2016@gmail.com) signs in through
Google only. "Continue with email" also goes to Google. In a copied Chrome session Google reads
"Signed out", and picking the account lands on `accounts.google.com/v3/signin/challenge/pk`
("Complete sign-in using your passkey"). Nothing was created on platform.openai.com. No domain
token exists yet, so `/.well-known/openai-apps-challenge` correctly still returns 404. The
chatgpt.com session does work in a copy, but the plan reads Free and Settings shows Plugins with
no Developer-mode switch, so the demo can't be recorded before the platform draft exists. When
filing: drop "Free," from the long description, because pricing words fail OpenAI's metadata
check (`small-business-intelligence-mcp/SUBMISSION-KIT.md` §10). Use the YouTube negative case
above, not the old Kick one.

**Claude, what was filed.** The portal makes you add the server as a custom connector first. It
now sits in his Claude Settings → Connectors as "heistclips (GTA 6 clipping)", uuid
`653125ff-5e22-4813-92f2-8cc299ea5645`. Tools synced: 7, none flagged. Name, one-liner and
description are verbatim from this kit. Categories: Media & Entertainment, Creative, Data &
Analytics. Author: Brick and Mortar AI LLC (https://heistclips.com). Docs /connect, support
aidan@brickandmortar.dev, privacy /privacy. Custom icon: /img/icon.svg, because `/favicon.ico`
404s and the preview showed a blank "H". Use cases come from test cases 1, 2 and 4.
Prerequisites: none. Read and write: the portal refuses "Read only" because two tools are
`readOnlyHint: false`. Company: Brick and Mortar AI LLC, https://brickandmortar.dev, Aidan Jude.
Data handling: "We own the API", no health data, no sponsored content. Reviewer notes say
plainly that find_moments and live_gta_streams read public Twitch data anonymously, and that
campaigns come from Content Rewards' public pages. The portal says third-party APIs "typically
block listing", so if a rejection cites API ownership, that is the reason. All 7 tools were run
live first. The two write tools were run on their guarded paths (unknown id, missing title), so
no test row reached the public board. Escalations: mcp-review@anthropic.com.

**Grok.** xAI's official form is free and needs no sign-in. It lists to Grok, Grok Bot and Cursor,
and submitting accepts the Cursor Marketplace Publisher Terms. A plain Chrome window is needed:
headless gets "Browser verification failed".

**Glama.** Claimed by a DNS TXT record, `_glama-claim.heistclips.com` (Vercel record
`rec_127d41aa4a3958ba50db6c91`). **Leave the record in place**: Glama re-checks it daily. Signed
in through the GitHub app "Glama AI" with `read:user user:email read:org`, revocable at
github.com/settings/applications. "Keep our description on registry updates" is on.

**mcp.so.** The form only shows a $39 button. An unpaid checkout is kept as a free submission
(`plan: free, paid: false, status: submitted`). Stripe was left unpaid.
