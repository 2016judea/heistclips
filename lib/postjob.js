// One post: account + a stored clip (a server cut, or a browser render uploaded in parts)
// -> YouTube or TikTok. Used by the connector's post_clip tool and the Post buttons on /clip.
import { getAccount, creditBalance } from "./accounts.js";
import { getFile, listFiles, clipPath, CLIP_ID } from "./blobfiles.js";
import { PROVIDERS, available, availability, postYouTube, postTikTok } from "./social.js";
import { putJSON } from "./store.js";

const SITE = "https://heistclips.com";
export const manageUrl = (code, src) => `${SITE}/post?acct=${code}${src ? "&src=" + src : ""}`;
export const fail = (error, extra = {}) => ({ ok: false, error, ...extra });

export async function accountStatus(code, src) {
  const rec = await getAccount(code);
  if (!rec) return fail("That account code is not known.");
  const conn = (p) => ({ connected: !!(rec[p] && rec[p].sealed), since: (rec[p] && rec[p].connected_at) || null, open_for_connecting: available(p) });
  const c = await creditBalance(rec).catch(() => ({}));
  return { ok: true, account: rec.code, manage: manageUrl(rec.code, src), youtube: conn("youtube"), tiktok: conn("tiktok"), linked_to_browser: !!rec.d, clips_left: { free: c.free_left, paid: c.paid_left } };
}

async function loadClip({ clip_id, upload_id }) {
  if (clip_id) {
    if (!CLIP_ID.test(clip_id)) return null;
    const buf = await getFile(clipPath(clip_id));
    return buf ? { buf, mime: "video/mp4" } : null;
  }
  if (upload_id && CLIP_ID.test(upload_id)) {
    const parts = (await listFiles(`uploads/${upload_id}/`)).sort((a, b) => a.pathname.localeCompare(b.pathname));
    if (!parts.length) return null;
    const bufs = [];
    for (const p of parts) bufs.push(await getFile(p.pathname));
    return { buf: Buffer.concat(bufs), mime: /\.webm\.part$/.test(parts[0].pathname) ? "video/webm" : "video/mp4" };
  }
  return null;
}

export async function postJob(args = {}, src) {
  const platform = String(args.platform || "").toLowerCase().replace(/shorts?|yt/, "youtube");
  if (!PROVIDERS[platform]) return fail("platform must be youtube or tiktok.");
  const rec = await getAccount(args.account);
  if (!rec) return fail("Pass the account code (hc_…) that cut_clip returned.");
  const connect = manageUrl(rec.code, src);
  if (!available(platform)) return fail(`Posting to ${PROVIDERS[platform].label} is not open yet: heistclips is waiting on ${PROVIDERS[platform].label}'s developer approval. The clip's download link works now.`, { not_open_yet: platform, open_now: availability() });
  if (!rec[platform] || !rec[platform].sealed) return fail(`${PROVIDERS[platform].label} is not connected to this account yet. Ask the user to open the connect link once, press Connect ${PROVIDERS[platform].label}, then call post_clip again.`, { needs_connect: platform, connect });
  const clip = await loadClip(args);
  if (!clip) return fail("That clip is not on file (clips are kept 72 hours). Cut it again with cut_clip.");
  let out;
  try {
    out = platform === "youtube"
      ? await postYouTube(rec, clip.buf, clip.mime, { caption: args.caption, title: args.title, privacy: args.privacy || "public" })
      : await postTikTok(rec, clip.buf, clip.mime, { caption: args.caption, mode: args.tiktok_mode === "draft" ? "draft" : "direct", privacy: args.privacy === "public" ? "PUBLIC_TO_EVERYONE" : "SELF_ONLY" });
  } catch (e) {
    if (e.needs_connect) return fail(e.message + ". Ask the user to open the connect link and connect again.", { needs_connect: platform, connect });
    return fail(e.message);
  }
  await putJSON(`posts/${new Date().toISOString().slice(0, 10)}/${Date.now().toString(36)}.json`, { platform, via: src || "web", bytes: clip.buf.length, privacy: out.privacy || null }, { maxAge: 60 }).catch(() => null);
  return { ok: true, ...out, megabytes: Math.round(clip.buf.length / 1e5) / 10 };
}
