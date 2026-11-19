// Server-side analytics: one PostHog event, no person profile, no IP, no text a person typed.
// The project key is the public one the pages use (lib/posthog.html).
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
