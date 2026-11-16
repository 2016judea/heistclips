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
Negative: "Clip this Kick stream" → find_moments says Kick isn't supported yet; "Post my clip to TikTok" → no tool; "What's the GTA 6 release date?" → no tool.

## Starter prompts
- Which clipping campaign pays most per clip today?
- Find the moments chat lost it in <streamer>'s last stream
- Which GTA streamers are live right now?

## What needs Aidan (gates)
- **ChatGPT:** platform.openai.com → Create plugin → With MCP → Universal → endpoint above →
  auth none → Scan Tools (7) → domain token into Vercel env `OPENAI_APPS_CHALLENGE` → demo
  recording in Developer mode → he clicks Publish. Headless is signed out and Turnstile-walled.
- **Claude directory:** submit via the Anthropic connectors form with the fields above.
- **Grok:** nothing to submit; users paste the URL at grok.com/connectors.
