# YouTube Live / VODs: can heistclips do what it does for Twitch and Kick?

> **Note, 2026-11-19 (later that night): what got built.** YouTube support shipped using only
> official, robots-allowed routes: the Data API v3 (key in Google Cloud project `heistclips`),
> oEmbed and plain watch links. Nothing below that uses `/youtubei/` (the chat replay, the live
> chat polling, the player) is used in production, and nothing downloads video. The probe
> scripts stay on branch `youtube-feasibility` for that reason. What shipped: live streams get
> moments from `liveChatMessages.list` (one shared poller per stream, once a minute), finished
> streams from viewers' timestamped comments (`commentThreads.list`), and the cut is made in the
> browser from the clipper's own copy. Measured that night: `liveChatMessages.list` costs **5
> units** per call, a refused "sent too soon" call included (40 calls moved the console's
> "Queries per day" by exactly 200); list calls cost 1; `search.list` has its own cap of **100 a
> day** on this project and is not used. A cursor polled every 60 s got every message a 5 s
> cursor got (214 of 214). Code: `lib/youtube.js`, `public/js/youtube.js`, `public/js/ytclip.js`,
> `api/youtube.js`; data model and reality check in `DATA_MODEL.md`.

Tested 2026-11-19 (evening, US Central) against real GTA VI YouTube streams. Every number below came
from a command run that night. Scripts that reproduce the chat side: `scripts/youtube-probe/`.

**Verdict: half of it.** Finding the moments works, from our own server, for finished streams. Cutting
the video does not work from Vercel or from the visitor's browser. YouTube walls every datacenter IP
we tried, binds each media URL to the IP that asked for it, and sends CORS only to youtube.com.
The only place the cut worked was a residential IP (this Mac).

| Step | Verdict | Deciding fact |
|---|---|---|
| 1. Resolve link → id, title, channel, length, live | WORKS WITH CAVEAT | Keyless from a home IP. From Vercel the page is bot-walled (no length, no live state). oEmbed works anywhere, including straight from the browser (CORS for heistclips.com). |
| 2a. Chat replay → moments (finished stream) | WORKS (server only) | youtubei replay is seekable by offset like Twitch. 200s from 4 Vercel IPs. Browser is CORS-blocked (403). |
| 2b. Live chat (stream in progress) | WORKS WITH CAVEAT (home IP only) | Polling gives only the last 26–185 s, with no history. From Vercel it returned 0 messages. |
| 3a. Cut from a Vercel function | **BLOCKED** | "Sign in to confirm you're not a bot" on 8 yt-dlp clients, 3 IPs, 2 regions (iad1, sfo1). The same for live. |
| 3b. Cut from this Mac (residential) | WORKS | 45 s of 1080p60 in 43.5 s with yt-dlp 2026.10.26 + node. Homebrew's yt-dlp 2026.07.04 got 403. |
| 3c. Cut in the visitor's browser | **BLOCKED** | googlevideo sends CORS to `https://www.youtube.com` only. URLs are IP-bound. Proxying through our origin hits wall 3a. |
| 3d. Live DVR window | WORKS (home IP) | The live HLS playlist holds 3,600 s. A 30 s cut from 20 min back took 2.1 s. |
| 4. Terms | (stated, not decided) | The ToS bars downloading and automated access without permission. robots.txt disallows `/youtubei/` and `/live_chat`. |

## Test streams

- **Tomo, "PLAYING GTA 6 (DAY 2)"**, `uDwiE9saR0c`: 5:49:31, ended 2026-11-19 21:35 UTC. This is the
  campaign streamer from "TOMO GTA VI Clipping".
- **Kai Cenat Live, "PLAYING GTA 6 FOR THE FIRST TIME (PART 2)"**, `H-4PyJlhI9g`: 11:54:59, 6.3M
  views. This is a simulcast of his Twitch stream (the Twitch logo is on screen), so heistclips can
  already clip the Twitch side.
- **Live:** Kai Cenat Live Part 4, `yX4DH_msPkI` (64K watching), and TheBurntPeanut, `YylVwL4UIFU`
  (95K watching).

## 1. Resolve

- From this Mac, `youtube.com/watch?v=…` holds `ytInitialPlayerResponse`: videoId, title, author,
  channelId, `lengthSeconds` (20970 for Tomo), `isLive`, and
  `microformat…liveBroadcastDetails.startTimestamp/endTimestamp`. No key needed.
- `youtube.com/@KaiCenatLive/live` serves the live watch page directly (`yX4DH_msPkI`,
  `isLive: true`, `lengthSeconds: "0"`, start time present). `/@Tomovids/live` served the channel
  page when he was offline. `/@handle/streams` lists past streams with length and age.
- **oEmbed** (`/oembed?url=…&format=json`) returns title, channel and thumbnail. It answers
  `Origin: https://heistclips.com` with `access-control-allow-origin: https://heistclips.com`, so the
  browser can call it directly. It does not return length or live state.
- **From Vercel** (egress 3.89.81.245): the watch page answers `LOGIN_REQUIRED` and has no
  `videoDetails` and no `microformat`, so length and live state are gone. oEmbed still worked (200).
  The `@handle/live` canonical was missing.
- **Data API key option.** The default quota is 10,000 units/day. `videos.list` costs 1 unit and
  returns duration, live state and `liveStreamingDetails`, so resolve costs about nothing. Live chat
  is a different story: `liveChatMessages.list` costs **5 units** per call. Polling every ~5 s is
  3,600 units per stream-hour, so the free quota covers **about 2.8 live stream-hours a day**
  across all users. It does not serve replays: an ended chat returns 403 `liveChatEnded`.
  ([quota costs](https://developers.google.com/youtube/v3/determine_quota_cost),
  [liveChatMessages.list](https://developers.google.com/youtube/v3/live/docs/liveChatMessages/list))

## 2. Chat → moments

**Replay (finished stream): works, and it seeks the way Twitch does.** The watch page's
`liveChatRenderer.continuations[0]` token goes to
`POST youtube.com/youtubei/v1/live_chat/get_live_chat_replay` with
`currentPlayerState.playerOffsetMs`. Each call returns about 100 messages around that offset, each
with `videoOffsetTimeMsec`. That is the same page-of-messages shape as Twitch's
`comments(contentOffsetSeconds:N)`, so `chatCurve`'s n/span rate estimate carries over unchanged.

- The default token is **Top chat** (filtered). One protobuf byte selects all chat: `720c0804` →
  `720c0801`, the same flag the "Live chat replay" menu entry carries. On Tomo, a page went from 95
  to 99 messages over the same span.
- Offsets are fractional. Floor them to whole seconds, or `momentFromMessages`' per-second histogram
  reads zero. Never seek to a negative offset (HTTP 400).
- **Kai Part 2 (11.9 h), from this Mac:** 1,430 seek requests, 0 failures, 17–58 s across two runs
  (12 in flight), 49,882 distinct messages. Chat rate p10/p50/p90/max = 0.29/0.81/2.59/17.25 msg/s.
  This is the YouTube side of a Twitch-first streamer, so it is much slower than his Twitch chat.
- **From Vercel:** the replay endpoint answered 200 with 83–101 actions per page on all four egress
  IPs. The bot wall on the watch page does not cover it. Moment-finding can therefore run in an
  `api/` function.
- **From the browser: blocked.** youtubei answers `Origin: https://heistclips.com` with 403, and the
  preflight is 403 too. Unlike Twitch's gql, chat reading costs function time.

**Moment quality** (the unchanged `findPeaks` + `momentFromMessages`, adapter in
`scripts/youtube-probe/ytmoments.mjs`):

- **Kai Part 2:** 8 picks. 5 read as real reactions, for example 1:08:39 ("LMAO, 💀, WHOAAAA") and
  2:12:28 ("lol, loooool"). 1 is a "where are you from" roll call at 6:43, and 1 is the stream-start
  flood. I checked one on screen: at 2:41:05–2:41:43 he mounts an ATV and crashes, and **WASTED**
  appears about 26 s into the window while chat says "U can't drive bruh / noooo / LOLL". The window
  lands on the event.
- **Tomo Day 2:** chat is slow (2,797 messages in 5.8 h, median 0.10 msg/s, p90 0.23). The raw
  top-3 were all greeting floods in the first 4 minutes. After skipping the first 5 minutes, 2 of 6
  picks were plausible ("That was crazy rip / LOL" at 50:21; "shoot ×5" at 1:59:38). The rest were
  "play as lucia" requests and hellos. **On a slow YouTube chat, chat speed alone finds little.** It
  needs a greeting/request filter and probably a second signal.

**Live chat:**

- From this Mac, `get_live_chat` (all-chat flag flipped at `82010c0804` → `82010c0801`) polls fine:
  0.9 msg/s on Kai (64K watching) and 2.6 msg/s on TheBurntPeanut (95K).
- The first batch reaches back only 26–185 s. `get_live_chat_replay` on a live stream returned 400.
  **There is no way to read the first 30 minutes of a live stream's chat until it ends.** Someone has
  to be listening from the start.
- From Vercel, the popout page had a continuation, but `get_live_chat` returned 200 with 0 messages
  (vs 63–65 from the Mac).

## 3. Cut (the crux)

**a. Vercel function: BLOCKED.**

- Throwaway project, since deleted. yt-dlp 2026.10.26 ran as a standalone binary, using the
  function's own node as the JS runtime.
- `Sign in to confirm you're not a bot` came back from every client: the default (tv samsung +
  visionos), android_vr, ios, mweb, web_safari, tv_simply and web_embedded. It held for the VOD and
  for the live stream. IPs: 3.235.100.105 and 54.242.215.99 (iad1), 54.219.195.18 (sfo1).
  `PO Token Providers: none`.
- The raw watch page answered `LOGIN_REQUIRED` with 0 formats.

**b. This Mac (residential, 97.116.x): WORKS.**

- `yt-dlp --js-runtimes node --download-sections "*4089-4134"` returned 45 s of 1920×1080 60 fps AV1
  plus Opus (7.65 MiB) in 43.5 s wall clock. The tv samsung and visionos clients did it with no PO
  token.
- The frame is real: GTA VI gameplay with Kai's facecam top-left.
- The installed Homebrew yt-dlp (2026.07.04) failed the same call with **403** from googlevideo.
  This path breaks whenever YouTube changes and yt-dlp hasn't caught up.

**c. Visitor's browser: BLOCKED.**

- **CORS.** googlevideo answers `Origin: https://www.youtube.com` with
  `access-control-allow-origin: https://www.youtube.com`. For `Origin: https://heistclips.com` it
  sends no ACAO header, a `Range` request is 403, and the preflight is 400.
- **IP binding.** A URL minted on this Mac returned 200 here and 403 from Vercel. The same held for
  live HLS segments (the live manifest itself was fetchable from Vercel, but its segments were not).
  So the visitor's browser would have to mint its own URL, and youtubei `/player` from a foreign
  origin is 403.
- **Proxy through our origin.** A same-origin rewrite (`/yt/:path*` → `www.youtube.com`) gave the
  same `LOGIN_REQUIRED` page. youtubei `/player` through it returned Google's 403 "Sorry…" page.
  The Twitch `/tv/` trick does not transfer.
- **Untested:** tab capture of an embedded player (`getDisplayMedia` + Region Capture) is
  desktop-Chrome only, needs a share prompt per clip, and records in real time.

**d. Live DVR: WORKS from a home IP.**

- The live HLS variant playlist is 720 × 5 s = **3,600 s** with `#EXT-X-PROGRAM-DATE-TIME`.
- A 6-segment sub-playlist starting exactly 20.0 min before the live edge cut to a 30 s 1080p H.264
  MP4 in 2.1 s.
- `--live-from-start` exposes DASH back to stream start, but yt-dlp refuses `--download-sections`
  on it ("This format cannot be partially downloaded").

**The only cut paths that work, and what they cost:**

- **A residential worker** (this Mac or similar): polls a job queue, runs yt-dlp + ffmpeg, uploads
  to Blob.
  - Proven above.
  - Ties clips to one home IP that YouTube can flag at volume. Every visit from that IP would then
    get the same "sign in" wall.
  - Needs yt-dlp kept current.
- **A paid residential proxy for the Vercel function:** a money gate, not tested.
  - Published pay-as-you-go rates run about $1–8/GB (e.g. DataImpulse $1/GB, Decodo $4/GB, Bright
    Data $8/GB, per [webscraping.ai](https://webscraping.ai/blog/cheapest-residential-proxies) and
    [dataimpulse.com](https://dataimpulse.com/blog/cheapest-proxies/), Nov 2026).
  - A 45 s 1080p60 section was 7.65 MiB, so roughly $0.01–0.06 per clip.
  - Whether a proxy pool gets past the wall is unmeasured.
- **The visitor brings the file.** This is the fallback the big tools give: Opus Clip's status page
  says "Please use local uploads, Google Drive, or other video links instead" during YouTube outages.

## 4. Terms (facts only)

- **YouTube's Terms of Service**, Permissions and Restrictions
  ([terms](https://www.youtube.com/static?template=terms)).
  - Users may not "access, reproduce, download, distribute, transmit, broadcast, display, sell,
    license, alter, modify or otherwise use any part of the Service or any Content except: (a) as
    expressly authorized by the Service; or (b) with prior written permission from YouTube".
  - Users also may not "access the Service using any automated means (such as robots, botnets or
    scrapers) except (a) in the case of public search engines, in accordance with YouTube's
    robots.txt file; or (b) with YouTube's prior written permission".
- **robots.txt** (read 2026-11-19) disallows `/youtubei/`, `/live_chat`, `/api/`, `/get_video` and
  `/results` for `User-agent: *`. Both the chat replay endpoint and the player endpoint sit under
  `/youtubei/`.
  - That differs from Kick, where heistclips relies on robots.txt allowing `/` (see
    `public/js/kick.js`).
- **Opus Clip** accepts YouTube links.
  - Its status page logged "We're currently experiencing issues with importing YouTube links" on
    2026-09-10 (1 h 43 min) and 2026-10-28 (44 min) ([status](https://status.opus.pro/history/1)).
  - Its help center says a stream still live "can't be uploaded"
    ([live streams](https://help.opus.pro/docs/article/uploading-live-streams)).
- **Klap** says a pasted YouTube link can be "your own video or a public one", that Klap "pulls the
  video directly", and that "the conversion happens in the cloud"
  ([klap.app](https://klap.app/tools/video-to-shorts-converter)).
- **Vizard's API** docs say live YouTube videos are not supported ([docs](https://docs.vizard.ai/docs/basic)).
- **Ssemble:** no public statement found on how it fetches YouTube links.
- **None** of the four says it has YouTube's written permission. The outages and Klap's wording are
  consistent with server-side downloading, but that is an inference, not a statement.

## Smallest slice that is buildable today

**YouTube moments for finished streams, with the cut left to the user's own file.**

1. **`parseInput`.** Accept `youtube.com/watch?v=`, `youtu.be/`, `/live/<id>` and `@handle`
   (resolve to `/streams`). Today it returns `{kind:"unknown", site:"youtube"}`.
2. **`lib/youtube.js`, server-side.**
   - Get the replay continuation from the watch page (this worked from Vercel). Flip it to all
     chat.
   - Add a `commentPage(vod, offset)` branch: seek, floor `t`, drop t<0. Then `chatCurve`,
     `findPeaks` and `momentFromMessages` run unchanged.
   - Get length from the last message of a seek to the end, or from `videos.list` (1 unit) if we
     take a free API key.
   - Title and channel come from oEmbed.
   - About 150 lines, mostly `scripts/youtube-probe/ytchat.mjs`.
3. **`api/` function + MCP `find_moments`.** Return moments with `youtu.be/<id>?t=<start>` links
   instead of cut links. A 12 h stream is ~1,430 requests and 17–58 s from one machine, inside the
   300 s limit.
4. **Greeting/request filter in `classify`** ("hi", "shoutout", "play as …", "where are you from").
   Without it, slow YouTube chats return hellos.
5. **Cut: "open your copy".** The editor takes a local file (or the campaign's Drive source), and the
   existing canvas cutter runs on it at the moment's timestamps.

**Estimate:** about 1 day for 1–4 plus tests. Step 5 depends on the editor accepting a local
`File`, which I did not check in this pass. Live YouTube (2b) needs a poller running from the
stream's start on a home IP or the Data API (5 units per poll), so it is a separate project. A
server-side YouTube cut needs either the residential worker or a paid proxy, both above.
