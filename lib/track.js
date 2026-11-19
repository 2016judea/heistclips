// Server-side analytics: one PostHog event, no person profile, no IP, no text a person typed.
// The project key is the public one the pages use (lib/posthog.html). ANALYTICS.md lists every
// event and its properties.
import crypto from "node:crypto";

const PH_KEY = "phc_yFgRGppL6H7DvhgZTQKbHdrY5oqnpLT482rrNYtLqnAx";

export async function serverEvent(event, properties = {}, distinctId = "") {
  if (process.env.HC_NO_ANALYTICS || process.env.HC_STORE === "memory") return;
  const props = {};
  for (const [k, v] of Object.entries(properties)) if (v !== undefined && v !== null) props[k] = v;
  try {
    await fetch("https://us.i.posthog.com/capture/", { method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(1500),
      body: JSON.stringify({ api_key: PH_KEY, event, distinct_id: distinctId || "srv_" + crypto.randomBytes(8).toString("hex"),
        properties: { ...props, site: "heistclips", $process_person_profile: false, $lib: "heistclips-server" } }) });
  } catch (e) {}
}

// ---- clip_made: the one count of finished clips ----------------------------------------------
// Fired from the single place every path spends a clip: spend() in api/credits.js (the browser's
// commit, the connector's cut, the queue's cut). So it cannot be blocked by an ad blocker and
// needs no page. It says what was made, never who: the id is the browser's own PostHog id when
// the page sent one (so the clip joins that visit), else a keyed hash of the device id.
//   layout "server-fit" | "server-split" … = the connector's cut_clip (lib/cutjob.js)
//   layout "queue-server"                  = a /queue export cut on the server (lib/queuecut.js)
//   via "web"                              = the clip page's server cut on a phone
//   anything else                          = rendered in the browser
const PH_ID = /^[A-Za-z0-9_-]{8,80}$/;
const hashOf = (s) => crypto.createHmac("sha256", process.env.CREDIT_SALT || "heistclips").update(String(s)).digest("hex").slice(0, 24);

export function clipPath(meta = {}) {
  const l = String(meta.layout || "");
  if (meta.via === "web") return "browser_server";
  if (l === "queue-server") return "queue";
  if (l.startsWith("server-")) return "connector";
  return "browser";
}

export function clipMadeProps(meta = {}, { charged, free_left, paid_left } = {}) {
  const vod = String(meta.vod || "");
  return {
    path: clipPath(meta), platform: meta.platform || (/^[0-9a-f]{8}-/.test(vod) ? "kick" : vod ? "twitch" : undefined), channel: meta.channel || undefined, vod_id: vod || undefined,
    t_start: meta.t || undefined, clip_secs: meta.secs || undefined, layout: String(meta.layout || "").replace(/^server-/, "") || undefined,
    mb: meta.bytes ? Math.round(meta.bytes / 1e5) / 10 : undefined, charged, free_left, paid_left, $host: "heistclips.com",
  };
}

export function clipMade(meta = {}, state = {}) {
  const id = typeof meta.ph === "string" && PH_ID.test(meta.ph) ? meta.ph : "srv_" + hashOf(state.d || "anon");
  return serverEvent("clip_made", clipMadeProps(meta, state), id);
}
