# Analytics: what heistclips records

PostHog project (key in `lib/posthog.html`), every event tagged `site: heistclips`. Vercel Web
Analytics counts page views. No chat text, no hook text, no stream title, no email, no IP is put
in an event. Property names are snake_case and stay stable: add a property, never rename one.

Read them with `~/.claude/skills/site-analytics` or a HogQL query; filter `properties.$host like
'%heistclips%'`.

## On every browser event from the clip tool (`public/js/app.js`)

| Property | Values |
|---|---|
| `lang` | page language: `en`, `de`, `fr`, `pt`, `es` |
| `entry` | the `src` URL parameter the visit arrived with (`mcp`, `queue`, `for`, …), kept for the tab; `direct` when there was none |
| `platform`, `channel`, `vod_id`, `is_live` | the stream that is open (from the moment a stream is open) |
| `first_src`, `first_utm_source`, `first_referrer_host` | first touch, registered once per browser and set once on the person when the visit carried `src` or `utm_source` |

Events about one moment also carry `t_start` (the clip's first second in the stream) and
`clip_secs`.

## The clip funnel

| Event | When | Properties beyond the common ones |
|---|---|---|
| `clip_lookup` | a name, link or id was submitted | `kind` |
| `clip_first_moments` | first moments on screen for a long live stream | `n`, `secs` |
| `clip_moments` | moments found | `n`, `secs`, `live`, `len`, `quiet`, `msgs`, `spoilers`, `spoiler_filter` |
| `clip_dead` | no moments could be shown | `why` |
| `clip_corrected` / `clip_live_unsaved` / `clip_top_live` | a typed name was matched, a live stream is not saved, the top live stream was opened | |
| `moment_cut_open` | "Cut this" | `rank`, `live`, `t_start`, `clip_secs`, `server_mode` |
| `moment_skip`, `spoiler_filter`, `live_moment` | list actions | |
| `editor_option` | a layout, hook mode, chat, quality or hook choice | `k`, `v` |
| `facecam_box`, `facecam_preset`, `facecam_camOut`, `facecam_camStyle`, `facecam_punch`, `facecam_camFx` | facecam choices | |
| `clip_window` | the clip window was changed | `how` (`drag_s`, `drag_e`, `drag_move`, `typed_s`, `typed_e`, `step`), `d`, `edge`, `presses` |
| `render_mode` | a phone switched between the server cut and rendering on the phone | `server` |
| `clip_preview` | Preview | `layout` |
| `clip_render_start` | Render pressed and a clip is available | `path` (`browser` or `browser_server`), `layout`, `hook` (bool), `chat` (bool), `quality` (`std`, `max`, `server`), `free_left`, `paid_left`, `len`, `cam_fx` |
| `clip_render_done` | a file exists | everything on start, plus `render_ms`, `load_ms`, `record_ms`, `fps`, `mbps`, `mbps_asked`, `mb`, `ext`, `source`, `source_height`, `cam_style`, `cam_out`, `effect`, `punch_at`, `sound`, `charged`, `free_left` after the charge |
| `clip_render_fail` | a render ended with an error | `phase` (`load`, `loudest`, `record`, `commit`, `server`, `fetch`), `code` (`cdn_refused`, `no_data`, `record_stall`, `audio_blocked`, `empty`, `encoder`, `play_aborted`, `not_in_video`, `no_recorder`, `no_credit`, `server_cut`, `network`, `other`), `err` (first 80 characters of our own message), `secs` |
| `clip_render_cancel` | Cancel during a render | `phase` |
| `clip_render_stall` | a phase showed the same percentage for 20 s (once per phase) | `phase`, `percent` |
| `clip_render_abandon` | the page was hidden or left while a render ran (sent with sendBeacon, once) | `phase`, `percent`, `secs`, `how` (`pagehide`, `visibilitychange`) |
| `clip_download` | the Download button was pressed | `ext`, `mb`, `path` |
| `clip_share` | "Save or share" was pressed (phones) | `path` |
| `paywall_shown` | the buy buttons were shown in the editor (`paywall_hit` is the same moment, kept for history) | `free_left` (0), `paid_left`, `where` |
| `checkout_start`, `purchase_claimed` | `public/js/buy.js`, and the return from Stripe | `pack`, `from`, `ok` |

`started = done + fail + cancel + abandon` should now hold. Before 2026-11-19, 21% of renders
ended with no event (610 started, 478 done, 5 failed).

## Server events (`lib/track.js`; cannot be blocked in a browser)

| Event | Fired from | Properties |
|---|---|---|
| `clip_made` | `spend()` in `api/credits.js`: the one place every path spends a clip. **The one true count of clips.** | `path` (`browser`, `browser_server`, `connector`, `queue`), `platform`, `channel`, `vod_id`, `t_start`, `clip_secs`, `layout`, `mb`, `charged` (`free` or `paid`), `free_left`, `paid_left`, `house` (`true` on a clip cut by one of our own accounts, absent otherwise) |
| `purchase` | `grant()` in `api/stripe-webhook.js`, once per paid Checkout session | `pack`, `clips`, `amount`, `currency`, `country`, `livemode`, `via` (`webhook` or `claim`) |
| `server_cut` | `lib/cutjob.js`, `lib/queuecut.js`: every server cut, finished or failed, whether or not the caller was still waiting. The cutter's timings, not a count of clips (that is `clip_made`). | `ok`, `err` (`too_long`, `past_end`, `no_credits`, `segment`, `segment_timeout`, `ffmpeg`, `ffmpeg_timeout`, `empty`, `store`, `crash_<step>`, a source code such as `vod_missing`), `path` (`connector`, `browser_server`, `queue`), `clip_secs`, `platform`, `layout`, `source_quality` (the rendition read: `720p60`, `1080p60`, `chunked`, `kick-720p`…), `megabytes`, `charged`, and the time split in ms: `resolve_ms`, `account_ms`, `playlist_ms`, `download_ms`, `source_mb`, `queue_ms` (waiting for another cut's encode on the same instance), `encode_ms`, `upload_ms`, `commit_ms`, `total_ms`, `house` (`true` for our own accounts), `test` (`true` for a marked test cut) |
| `mcp_tool_call` | `api/mcp.js`, one per connector tool call | `tool`, `ok`, `ms`, `client`, `client_ua`, `test` (`true` when the call carried the test header), `err` (short code; never the message), `status` (`cutting` when cut_clip handed back a job), `polls`; for `cut_clip` / `cut_clip_status` also `clip_secs`, `platform`, `layout`, `source_quality`, `megabytes`, `cut_ms` and the same time split as `server_cut`; for `find_clip_moments` also `platform`, `cache` (`miss`, `warm`, `stored`), `read_ms`, `stream_hours`, `live`, `moments`. No arguments, chat text or captions. |
| `bug_report` | `api/requests.js` (`bugEvent`), one per bug filed from the site or the connector | `via` (`website`, `mcp`), `step` (a tool or page step from a fixed list, else `other`), `platform`, `failure` (`error_returned`, `wrong_result`, `empty_or_broken_file`, `timeout`, `other`, `unspecified`), `has_stream`, `has_moment`, `has_error_text`, `lang`. Never the report's words. |

`clip_made.path` is read from what the spender sends: `layout: "queue-server"` is the queue,
`layout: "server-…"` is the connector, `via: "web"` is the clip page's phone cut, anything else
a browser render. `channel` and `clip_secs` are there when the spender sends them in the commit's
`meta` (the browser does; `lib/cutjob.js` sends `vod`, `t` and `layout` today). The distinct id is
the browser's PostHog id when the page sent one, else a keyed hash of the device id; no person
profile is created.

`client` and `client_ua` on `mcp_tool_call` are wrong for calls that took more than a moment
(every `cut_clip`) before 2026-11-19 22:00 UTC: the caller was kept in a variable shared by all
requests on an instance, so a 30 s cut was logged with whoever called last. Do not split cuts
by client before that time.

## Test and house clips (`lib/marks.js`)

Public numbers (`/most-clipped-streams`, `/data/most-clipped.json`, the count of `clip_made`)
are customers' clips only. Two marks keep ours out.

**A test marks itself with one header: `x-hc-test: 1`.** It works on every path that can make a
clip: `POST /api/credits` (a browser render's commit), `POST /api/v1/cut` (the phone and Safari
server cut), `POST /api/v1/qcut` (a queue cut) and `POST /mcp` (the connector). The clip is cut
and charged like any other, so the charge path is still tested, and it is counted nowhere: no
trend record, no `clip_made`. `server_cut` and `mcp_tool_call` are still sent, with
`test: true`, because they are timings and not counts.

| From | How |
|---|---|
| a script | `import { TEST_HEADERS, mcp } from "./scripts/test_cut.mjs"`, or `node scripts/test_cut.mjs <source> <start> <end>` for one marked cut that also checks no trend record was left |
| a Playwright browser | `context.setExtraHTTPHeaders({ "x-hc-test": "1" })` before the page loads, plus `posthog.register({ qa_test: true })` for the browser's own events (below) |
| curl | `-H 'x-hc-test: 1'` |

There is no other way and none is needed: not a user agent, not an address, not a body field.
On 2026-11-19 build agents made about 70 unmarked test clips on production; telling them from
customers' clips afterwards took the spend ledger and PostHog, and the result is the
list in `lib/trend_exclude.json` (records the trend build skips; nothing was deleted).

**A house clip is one cut by our own account** (the clip desk that posts to our own channel).
`HOUSE_ACCOUNTS` in the environment is a comma-separated list of account codes (`hc_…`) or
browser device ids. A house clip is charged, sends `clip_made` and `server_cut` with
`house: true`, and leaves no trend record. An account code covers every server cut made with it
(the connector, the phone and Safari cut), whether or not the account has since been linked to a
browser. A render done in a browser carries no account: list that browser's device id if a house
browser ever renders. Count customers' clips with
`event = 'clip_made' and properties.house is null`. An account code is a secret: it is in the
environment only, never in this repo and never in an event.

## Checking that an event arrives

PostHog's snippet does not load when `navigator.webdriver` is true, so a plain headless run sends
nothing. To see real events: a headless Chrome started with
`--disable-blink-features=AutomationControlled`, then `posthog.register({ qa_test: true })` in the
page so the test's events can be filtered out, or the iOS simulator's Safari. A run that renders or
cuts a clip also sends the test header (above), so the clip itself is not counted.
