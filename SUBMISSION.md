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

> **2026-11-19: tools renamed (server 0.2.0).** `find_moments` → `find_clip_moments`, `rank_campaigns` →
> `rank_clipping_campaigns`, `campaign_details` → `clipping_campaign_details`. The old names are not listed
> but still answer (`ALIASES` in `api/mcp.js`), so the ChatGPT package reviewed on 0.1.0 keeps working.
> Every heistclips link a tool returns carries `src=mcp`, and each call logs a PostHog `mcp_tool_call`
> event (tool, ok, ms, client; no arguments). The tables below still use the 0.1.0 names where they
> describe what was filed.

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
- **ChatGPT, checked 2026-11-19 ~17:45 UTC:** still in review. Mail holds only "Submission
  Received" for heistclips (11-17 00:49 UTC, case C-Hzxr4MNBfB7l). The "Submission Rejected" mail
  of 11-17 19:42 UTC is for a different app (Appeal the Denial, asdk_app_6aea704f…), not this one.
- **ChatGPT:** filed 2026-11-17 00:48 UTC, 0.1.0 in review. **When the approval email comes, he
  clicks Publish** at platform.openai.com/plugins/manage/plugin_asdk_app_6afba27819348191bfed030276cf83be.
  Approval does not publish it. Leave Vercel env `OPENAI_APPS_CHALLENGE` set: OpenAI re-checks it.
- **Claude directory:** filed 2026-11-16, **Published** (Aidan; confirmed on claude.ai/directory/manage 11/19: "used a tool: 294 accounts").
- **Grok:** filed 2026-11-16 through xAI's form. A reply comes by email to aidan@brickandmortar.dev.

## Submissions (2026-11-16, "prepare for distribution")

| Where | Status | UTC | Listing / ID |
|---|---|---|---|
| Official MCP Registry | LISTED | 11-16 | `com.heistclips/heistclips` 0.1.0 |
| Claude Connectors Directory | **PUBLISHED** (Aidan, 11-16; 294 accounts used a tool as of 11-19) | 23:04 | claude.ai/directory/manage/heistclips · slug `heistclips` (permanent) |
| ChatGPT plugin directory | **SUBMITTED, 0.1.0 in review**; he clicks Publish after approval | 11-17 00:48 | plugin `plugin_asdk_app_6afba27819348191bfed030276cf83be` |
| xAI Connector Marketplace (Grok, Grok Bot, Cursor) | **SUBMITTED, pending review** | 21:10 | x.ai/bot/marketplace/submit-a-plugin · no ID shown · reply to aidan@brickandmortar.dev |
| Glama | **LISTED, claimed, health check passing** | 21:20 | https://glama.ai/mcp/connectors/com.heistclips/heistclips |
| mcp.so | **SUBMITTED free, queued for review** | 22:49 | submission `81b752a0-13b0-4fe5-a227-1cec259d8c49` · will be mcp.so/server/heistclips-gta-6-clipping (404 until approved) |
| Smithery | SKIPPED | — | closed to submissions 2026-10-31 (now a curated directory run by Arcade) |
| PulseMCP | SKIPPED | — | submissions paused since 2026-09-03; it picks up the registry entry automatically when it reopens |
| mcptop | SKIPPED | — | no submission path; it mirrors the ChatGPT, Claude and Cursor directories |

Nothing was paid, nothing was sent to a person, nothing was posted on his accounts.

**ChatGPT, what was filed (2026-11-17).** "Create plugin → With MCP" no longer exists. The portal
takes only a plugin ZIP (Agent Plugins format), the same flow `appeal-the-denial` used on 11-03.
- **Sign-in.** The platform account (aidanjude2016@gmail.com) signs in through Google only, and
  Google demands his passkey in a copied Chrome profile. The platform session is also a session
  cookie, so it never reaches a copy. After he signed in, the work ran in **his own Chrome**, through
  AppleScript `execute javascript` on a tab of its own.
- **Package** `heistclips` 0.1.0, publisher **Business — Brick and Mortar AI LLC**.
  - Copy: displayName "heistclips (GTA 6 clipping)". shortDescription "Clip moments and campaign
    pay", because the field has a 30-character cap. Long description is the kit's, minus "Free,",
    because pricing words fail OpenAI's metadata check (SBI kit §10).
  - Category Entertainment.
  - Links: website heistclips.com, support /requests (needs an HTTPS URL, not an email),
    privacy /privacy, terms /terms.
  - Starter prompts are the kit's, with `<streamer>` filled in as xrohat.
  - Logo and composer icons are rendered from /img/icon.svg.
  - Test cases: positive 1–5 above, plus the three negatives (YouTube Live, TikTok, release date).
  - No skills.
  - The builder (`build.py`) lived in the session scratchpad and is gone. To change anything,
    download the plugin.json from the portal, edit it, and **bump the version**.
- **Domain:** token in Vercel env `OPENAI_APPS_CHALLENGE` (all targets), production redeployed;
  `/.well-known/openai-apps-challenge` returns it as text/plain. Verified.
- **MCP:** connected, no auth. Scan found 7 tools with no MCP findings.
- **One non-blocking metadata finding:** "Review the plugin's privacy policy against the
  submission guidelines". The review note answers it.
- **Demo:** https://cf546sdmyewh8fpm.public.blob.vercel-storage.com/demo/chatgpt-review.mp4 (Vercel
  Blob, not in the repo).
  - 7 min 08 s, 1440×1000, one take of all 8 test cases, recorded headless with a CDP screencast.
  - The ChatGPT sidebar is hidden, so no personal chats show. The last answer says "Aidan" once.
  - Developer mode **works on his Free plan**: chatgpt.com/plugins → Add → Add custom MCP server.
    That added a dev plugin "heistclips" (no auth) to his ChatGPT.
- **Submitted** with the six attestations ticked, the same set as SBI and Appeal the Denial. One of
  them is "all necessary rights to any third-party content or API endpoints". The private review
  note says plainly that find_moments and live_gta_streams read public Twitch and Kick data
  anonymously, and that campaigns come from Content Rewards' public directory. If a rejection
  cites rights to third-party data, that is the soft spot.

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

## 2026-11-19 (evening, CT): directory errors read, fixed, tool list resynced

**What the directory showed** (claude.ai/directory/manage/heistclips, read 11-20 ~02:00 UTC; metrics lag up to 24 h):
- Overview: 663 accounts finished connecting, 294 used a tool, 3K tool calls, rank #1,979, health "Worth a look".
- Usage → Reliability, verbatim: "REQUEST ERRORS 2.4%", "TOOL ERRORS 7.1%", "4xx 0%", "5xx 2.4%",
  "Top error types · Last 30 days: Upstream HTTP error 504 UpstreamHttpError504". Rows: last day 2,553 calls,
  9.4% error rate, 2.1% request errors; 7 and 30 days 2,986 calls, 9.5%, 2.4%.
- Tools tab (our 11-16 list): find_moments 52 calls, "25% error rate, 13.5% tool errors"; campaign_details 23,
  rank_campaigns 21, live_gta_streams 13, all 0%. The 12 newer tools were not in the listing, so their calls
  had no row. Where it's used: Claude Code Remote 1.7K calls (p95 73,208 ms), Claude Code Desktop 644
  (17,561 ms), Claude.ai 351 (74,869 ms), Claude Desktop 310 (77,630 ms).

**What the 504s were.** Vercel's request log (`vercel.com/api/logs/request-logs?requestPath=/mcp`) has 95 504s
on /mcp, 11-17 05:02 to 11-19 17:07 UTC, all from `Claude-User`, all `FUNCTION_INVOCATION_TIMEOUT` ("Task timed
out after 120 seconds") on the 11-16 build, where `api/*.js` had `maxDuration: 120`. The proxy did not time
out: it waited for our 504. Since 17:15 UTC (300 s limit, then cut_clip's 45 s job cap at 19:54) there are
**zero** /mcp 504s in 9,582 requests, and 22 Claude-User calls that ran over 200 s (max 241 s) came back 200.
So the proxy's own limit is above 241 s. The cut_clip cap stays at 45 s plus cut_clip_status at 40 s; no new
cap was needed.

**What the tool errors were.** find_moments returned isError for "no saved stream", "live but not saved",
YouTube links and typos. PostHog `mcp_tool_call` since 21:00 UTC: no_vods 11, live_no_vod 10, youtube 6,
kickvod_missing 1 (already non-error in the current code), cut_clip no_credits 2, clipping_campaign_details
1 not-found, watch_streamer 1 bare error. The 6 post_clip "error"s were one burst through the proxy at
20:51:46–54 UTC, each /api/v1/post answering 200 in 0.4–1.8 s. Their cause cannot be read back: neither the
arguments nor the error text were logged. Every post failure now carries a code (bad_platform,
bad_account, bad_clip_id, clip_gone, needs_connect, not_open_yet, youtube_refused/tiktok_refused).

**Changed (commit cbd7c65, deploy READY, live tools/list = 16 tools):**
- Designed outcomes come back without isError and with a `next` step: live_no_vod, no_vods, kick_no_vod,
  youtube, no_channel, kick_no_channel, kickvod_missing, vod_missing, clip_missing, clip_no_vod, no_name,
  not_public, too_long, too_short, bad_window, past_end, no_campaign, clip_gone, no_queue. live_no_vod and
  no_vods offer watch_streamer for that streamer. `err` still goes to PostHog (`ANSWERS` in api/mcp.js).
- clipping_campaign_details also matches a title ("Tokyo Girl"), and an ended campaign points at the ranking.
- posting_account and watch_streamer: `idempotentHint` false (no account = a new account each call). cut_clip
  (spends a credit) and post_clip (publishes) were already readOnly false, idempotent false, openWorld true.
- Server instructions: a result with found: false or a next field is an answer; follow next.
- Genuine failures (encoder, store, a platform refusing an upload, exceptions) keep isError and the
  report_a_bug hint.

**Listing.** Full editor → Tools & prompts → **Sync from server** (16 tools, with the live annotation summary
attached for reviewers) → Save → "Changes saved." Review tab: "An edit is in review. The live listing stays as
it is until a reviewer approves the edit." Pending change = tool names only (removed campaign_details,
find_moments, rank_campaigns; added the 12 current names). The listing stayed **Published** throughout.
Use cases, data handling and testing answers are locked on a published server (mcp-review@anthropic.com).
- **Aidan:** when the approval comes, check the header; if it offers Publish for the edit, that click is his.
- Not changed: the one-liner and description still describe only moments + campaigns and end "Free, no
  account, no key", which predates cut_clip (free clips, then packs) and post_clip.
