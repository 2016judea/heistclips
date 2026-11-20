// The clip page's server cut: for a phone, or any browser that cannot record a clip with sound.
// It calls the same cutter the connector's cut_clip uses (POST /api/v1/cut, lib/cutjob.js), with
// the heistclips code this browser already has for posting (public/js/post.js), so the clip is
// taken from this browser's own balance. Returns the cutter's JSON: { ok, download, seconds,
// megabytes, source_quality, charged, clips_left } or { ok:false, error, need }.
const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
const post = (path, body) => fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

// The code is made once per browser and linked to its clip balance, exactly as /post does.
async function code(device) {
  const api = async (b) => (await post("/api/v1/post", b)).json();
  const link = (c) => api({ op: "link", account: c, d: device, k: store.get("hc_key") || "" });
  const have = store.get("hc_acct");
  if (have && (await link(have)).ok) return have;
  const n = await api({ op: "new" });
  if (!n.ok) throw new Error("couldn’t reach heistclips");
  store.set("hc_acct", n.account);
  await link(n.account);
  return n.account;
}

export const SERVER_MAX_S = 60;

// box: the facecam box drawn in the editor ({ x, y, w, h }, fractions of the stream frame); the
// server cuts exactly that box (lib/cut.js camBox). corner is the fallback when there is none.
export async function serverCut({ vod, start, end, layout, corner, box, hook, hookTyped, device }) {
  const source = vod.platform === "kick" ? `https://kick.com/video/${vod.id}` : String(vod.id);
  const r = await post("/api/v1/cut", { source, start: Math.round(start), end: Math.round(end), layout, facecam: corner || "tr", ...(box ? { facecam_box: [box.x, box.y, box.w, box.h] } : {}), hook: hook || "", hook_typed: !!hookTyped, account: await code(device), via: "web" });
  return r.json().catch(() => ({ ok: false, error: "The server did not answer (" + r.status + "). Nothing was charged." }));
}
