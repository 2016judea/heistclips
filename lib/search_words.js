// English words for the search pages (lib/searchpages.js): the Twitch and Kick clip maker pages
// and "most clipped right now". The other languages carry the same keys under `search` in
// lib/l10n_<lang>.js, as lib/i18n.js describes; test/search.test.js fails if one is missing.
// Numbers never live in this file: prices and counts are passed in at render time.

export const SEARCH_EN = {
  locale: "en-US",
  box: { ph: (p) => `${p} channel or VOD link`, go: "Find moments", fine: "No account. No watermark. Your browser cuts the clip.", hot: "Being clipped right now" },
  clips: (n) => `${n} clip${n === 1 ? "" : "s"}`,
  maker: {
    twitch: {
      title: "Twitch clip maker: 9:16 clips with hooks, no watermark | heistclips",
      desc: (free, each) => `Paste a Twitch channel or VOD. heistclips finds the moments chat went wild and cuts them to 9:16 with a hook, in your browser. ${free} clips free, then from ${each} a clip. No watermark.`,
      h1: "Twitch clip maker",
      lede: "Paste a Twitch channel. We find the moments chat went wild. You get 9:16 clips with a hook, ready for TikTok, Shorts and Reels.",
      speed: "A 7-hour stream takes about 20 seconds to read.",
    },
    kick: {
      title: "Kick clip maker: 9:16 clips with hooks, no watermark | heistclips",
      desc: (free, each) => `Paste a Kick channel or video. heistclips finds the moments chat went wild and cuts them to 9:16 with a hook, in your browser. ${free} clips free, then from ${each} a clip. No watermark.`,
      h1: "Kick clip maker",
      lede: "Paste a Kick channel. We find the moments chat went wild. You get 9:16 clips with a hook, ready for TikTok, Shorts and Reels.",
      speed: "Kick limits how fast chat can be read, so a stream takes 1 to 2 minutes.",
    },
    howH: "How it works",
    how: (p) => [`Paste a ${p} channel or a link to a past stream. It can be live right now.`, "Pick a moment. Each one shows what chat typed, so you see why it was picked.", "Cut it. Your browser makes a 1080 × 1920 MP4 and saves it."],
    getH: "What you get",
    get: ["9:16 video with the facecam above or below the gameplay.", "3 to 5 hook lines for each moment, so every post is different.", "No watermark. No AI tags in the file.", "A warning when the music in that part can get your clip claimed."],
    costH: "What it costs",
    cost: (free, packs) => `${free} clips are free. After that, ${packs}. You pay for each clip you save. You never pay for minutes of stream. Finding moments is always free.`,
    pack: (n, price) => `${n} clips for ${price}`, or: " or ",
    other: (p) => `Clipping ${p} too? Use the ${p} clip maker.`,
    hotMore: "See everything being clipped right now",
    faqH: "Questions",
    faq: (p, other, free) => [
      [`Does the ${p} clip maker work on live streams?`, `Yes. Paste the channel while it is live. New moments show up as chat reacts, about a minute behind the stream.`],
      ["Is there a watermark?", "No. The file has no watermark and no AI tags."],
      ["Do I need an account?", `No. Paste a channel and start. The first ${free} clips are free.`],
      [`Does it work on ${other}?`, `Yes. Paste a ${other} channel in the same box.`],
      ["Is it only for GTA?", "No. It works on any stream with a busy chat: any game, IRL, or just chatting."],
    ],
  },
  trend: {
    title: (date) => `Most clipped streams right now (${date}) | heistclips`,
    desc: (n, days) => `The Twitch and Kick streams and moments clippers cut the most on heistclips in the last ${days} days: ${n} clips counted. Updated every hour. Tap one to clip it.`,
    h1: "What clippers are cutting right now",
    lede: (n, days) => `${n} clips were made on heistclips in the last ${days} days. These are the streams and moments they came from. Tap one to open it in the clip tool.`,
    updated: (when) => `Updated ${when} UTC · refreshes every hour`,
    streamsH: "Most clipped streams",
    momentsH: "Most clipped moments",
    today: (n) => `${n} today`,
    at: (name, clock) => `${name} at ${clock}`,
    none: "Not enough clips yet to rank anything. Check back in an hour.",
    howH: "How we count",
    how: (s, m) => [`One clip saved on heistclips is one count. We store the stream and the moment. We never store who made the clip.`, `A stream shows after ${s} clips. A moment shows after ${m}. Nothing here is made up or padded.`, "The same numbers are free to use as data."],
    data: "Download as JSON",
  },
};
