// Posting a finished clip to YouTube or TikTok for the account that connected them.
// OAuth 2 (authorization code) for both; tokens are sealed (lib/accounts.js) inside the account
// record. A provider is "available" only when its client id and secret are in the environment,
// so the site and the connector say plainly when one is not open yet.
//
// What the platforms hold back until their own reviews pass (as of 2026-11-19):
//   YouTube - uploads from an API project that has not passed YouTube's API audit are locked to
//             private, whatever privacy is asked for, and the default quota is about 6 uploads
//             a day for the whole project. The OAuth screen shows "unverified app" and stops at
//             100 users until Google verifies the youtube.upload scope.
//   TikTok  - until the app passes TikTok's audit, direct posts are private (SELF_ONLY) and
//             only accounts on the app's sandbox list can connect. Drafts go to the user's
//             TikTok inbox to finish in the app.
import { seal, unseal, keep } from "./accounts.js";

const SITE = "https://heistclips.com";
export const PROVIDERS = {
  youtube: {
    label: "YouTube",
    id: () => process.env.GOOGLE_CLIENT_ID, secret: () => process.env.GOOGLE_CLIENT_SECRET,
    redirect: `${SITE}/oauth/youtube/callback`,
    scope: "https://www.googleapis.com/auth/youtube.upload",
    authUrl(state) {
      return "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({ client_id: this.id(), redirect_uri: this.redirect, response_type: "code", scope: this.scope, access_type: "offline", prompt: "consent", include_granted_scopes: "false", state });
    },
    async token(params) {
      const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: this.id(), client_secret: this.secret(), ...params }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.access_token) throw new Error("YouTube sign-in failed: " + (d.error_description || d.error || r.status));
      return d;
    },
    exchange(code) { return this.token({ grant_type: "authorization_code", code, redirect_uri: this.redirect }); },
    refresh(refresh_token) { return this.token({ grant_type: "refresh_token", refresh_token }); },
    async revoke(tok) { await fetch("https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(tok.refresh_token || tok.access_token), { method: "POST" }).catch(() => null); },
  },
  tiktok: {
    label: "TikTok",
    id: () => process.env.TIKTOK_CLIENT_KEY, secret: () => process.env.TIKTOK_CLIENT_SECRET,
    redirect: `${SITE}/oauth/tiktok/callback`,
    scope: "user.info.basic,video.upload,video.publish",
    authUrl(state) {
      return "https://www.tiktok.com/v2/auth/authorize/?" + new URLSearchParams({ client_key: this.id(), redirect_uri: this.redirect, response_type: "code", scope: this.scope, state });
    },
    async token(params) {
      const r = await fetch("https://open.tiktokapis.com/v2/oauth/token/", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_key: this.id(), client_secret: this.secret(), ...params }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.access_token) throw new Error("TikTok sign-in failed: " + (d.error_description || d.error || r.status));
      return d;
    },
    exchange(code) { return this.token({ grant_type: "authorization_code", code, redirect_uri: this.redirect }); },
    refresh(refresh_token) { return this.token({ grant_type: "refresh_token", refresh_token }); },
    async revoke(tok) { await fetch("https://open.tiktokapis.com/v2/oauth/revoke/", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_key: this.id(), client_secret: this.secret(), token: tok.access_token }) }).catch(() => null); },
  },
};
export const available = (p) => !!(PROVIDERS[p] && PROVIDERS[p].id() && PROVIDERS[p].secret());
export const availability = () => Object.fromEntries(Object.keys(PROVIDERS).map((p) => [p, available(p)]));

export function storeTokens(rec, provider, d, prev = {}) {
  const was = rec[provider] || {};
  rec[provider] = {
    name: d.name || was.name || undefined, avatar: d.avatar || was.avatar || undefined,
    connected_at: (rec[provider] && rec[provider].connected_at) || new Date().toISOString(),
    scope: d.scope || prev.scope || PROVIDERS[provider].scope, open_id: d.open_id || prev.open_id || undefined,
    sealed: seal({ access_token: d.access_token, refresh_token: d.refresh_token || prev.refresh_token || null, expires_at: Date.now() + (Number(d.expires_in) || 3600) * 1000 - 60000 }),
  };
  return rec;
}

// A usable access token for the account, refreshed (and saved) when it has run out.
export async function accessToken(rec, provider) {
  if (!rec[provider] || !rec[provider].sealed) throw Object.assign(new Error(`${PROVIDERS[provider].label} is not connected`), { needs_connect: true });
  const tok = unseal(rec[provider].sealed);
  if (tok.expires_at > Date.now()) return tok.access_token;
  if (!tok.refresh_token) throw Object.assign(new Error(`${PROVIDERS[provider].label} needs connecting again`), { needs_connect: true });
  let d;
  try { d = await PROVIDERS[provider].refresh(tok.refresh_token); }
  catch (e) { throw Object.assign(new Error(`${PROVIDERS[provider].label} needs connecting again (${e.message})`), { needs_connect: true }); }
  storeTokens(rec, provider, d, tok);
  await keep(rec);
  return d.access_token;
}

const cut = (s, n) => [...String(s || "")].slice(0, n).join("");

// ---- YouTube: resumable upload, videos.insert ---------------------------------------------------
export async function postYouTube(rec, file, mime, { caption = "", title = "", privacy = "private" } = {}) {
  const token = await accessToken(rec, "youtube");
  const want = ["public", "unlisted", "private"].includes(privacy) ? privacy : "private";
  const tags = /#shorts/i.test(caption + title) ? "" : " #Shorts";
  const body = {
    snippet: { title: cut((title || caption || "Clip").replace(/[<>]/g, "").split("\n")[0], 100 - tags.length) + tags, description: cut(String(caption).replace(/[<>]/g, ""), 4900), categoryId: "20" },
    status: { privacyStatus: want, selfDeclaredMadeForKids: false },
  };
  const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: { authorization: "Bearer " + token, "content-type": "application/json; charset=UTF-8", "x-upload-content-type": mime, "x-upload-content-length": String(file.length) },
    body: JSON.stringify(body),
  });
  if (!init.ok) throw new Error("YouTube refused the upload: " + ytError(await init.text(), init.status));
  const loc = init.headers.get("location");
  const up = await fetch(loc, { method: "PUT", headers: { "content-type": mime, "content-length": String(file.length) }, body: file });
  const d = await up.json().catch(() => ({}));
  if (!up.ok || !d.id) throw new Error("YouTube upload failed: " + ytError(JSON.stringify(d), up.status));
  const got = d.status && d.status.privacyStatus;
  return {
    platform: "youtube", id: d.id, url: `https://www.youtube.com/shorts/${d.id}`, studio: `https://studio.youtube.com/video/${d.id}/edit`,
    privacy: got || want, title: body.snippet.title,
    note: got && got !== want ? `YouTube set this to ${got}, not ${want}: uploads through a new app stay private until YouTube finishes reviewing heistclips. Open the Studio link to publish it.` : want === "private" ? "Posted as private. Open the Studio link to make it public." : undefined,
  };
}
function ytError(txt, status) {
  try { const e = JSON.parse(txt).error; const r = e.errors && e.errors[0] && e.errors[0].reason; return (r === "quotaExceeded" ? "heistclips has used today's YouTube upload quota; try again after midnight Pacific. " : r === "youtubeSignupRequired" ? "this Google account has no YouTube channel yet. " : "") + (e.message || status); } catch (x) { return String(status); }
}
export async function deleteYouTube(rec, id) {
  // Needs the full youtube scope; with youtube.upload alone YouTube answers 403. Used by tests.
  const token = await accessToken(rec, "youtube");
  const r = await fetch("https://www.googleapis.com/youtube/v3/videos?id=" + encodeURIComponent(id), { method: "DELETE", headers: { authorization: "Bearer " + token } });
  return r.status;
}

// ---- TikTok: Content Posting API, FILE_UPLOAD ----------------------------------------------------
// TikTok's chunk rules: a file up to 64 MB may go as one chunk; a larger one must be split into
// chunks of 5-64 MB, total_chunk_count = floor(size / chunk), and the last chunk carries the
// remainder (so it can be up to 2x chunk, under TikTok's 128 MB cap). One 96 MB chunk was refused
// with "The chunk size is invalid" (2026-11-19: 60 fps exports run ~2.5 MB a second).
const MB = 1024 * 1024;
export function tiktokChunks(size) {
  if (size <= 64 * MB) return { chunk: size, count: 1 };
  const chunk = 32 * MB;
  return { chunk, count: Math.floor(size / chunk) };
}
// mode "draft" -> the user's TikTok inbox (video.upload); "direct" -> posted (video.publish).
export async function postTikTok(rec, file, mime, { caption = "", mode = "draft", privacy = "SELF_ONLY" } = {}) {
  const token = await accessToken(rec, "tiktok");
  const H = { authorization: "Bearer " + token, "content-type": "application/json; charset=UTF-8" };
  const { chunk, count } = tiktokChunks(file.length);
  const source_info = { source: "FILE_UPLOAD", video_size: file.length, chunk_size: chunk, total_chunk_count: count };
  let url = "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/", payload = { source_info }, level = null, creator = null;
  if (mode === "direct") {
    const ci = await fetch("https://open.tiktokapis.com/v2/post/publish/creator_info/query/", { method: "POST", headers: H });
    const cd = await ci.json().catch(() => ({}));
    if (!ci.ok || (cd.error && cd.error.code !== "ok")) throw new Error("TikTok would not accept a post right now: " + ((cd.error && cd.error.message) || ci.status));
    creator = cd.data || {};
    const allowed = creator.privacy_level_options || ["SELF_ONLY"];
    level = allowed.includes(privacy) ? privacy : allowed.includes("SELF_ONLY") ? "SELF_ONLY" : allowed[0];
    url = "https://open.tiktokapis.com/v2/post/publish/video/init/";
    payload = { post_info: { title: cut(caption, 2200), privacy_level: level, disable_duet: !!creator.duet_disabled, disable_comment: !!creator.comment_disabled, disable_stitch: !!creator.stitch_disabled }, source_info };
  }
  const init = await fetch(url, { method: "POST", headers: H, body: JSON.stringify(payload) });
  const d = await init.json().catch(() => ({}));
  if (!init.ok || !d.data || !d.data.upload_url) {
    const code = d.error && d.error.code;
    if (code === "unaudited_client_can_only_post_to_private_accounts") throw new Error("TikTok is still reviewing heistclips. Until it finishes, TikTok only lets us post to private accounts: set your TikTok account to private (Settings, Privacy, Private account), post, then switch back. Or send it as a draft instead.");
    throw new Error("TikTok refused the upload: " + ((d.error && [code, d.error.message].filter(Boolean).join(": ")) || init.status));
  }
  for (let i = 0; i < count; i++) {
    const from = i * chunk, to = i === count - 1 ? file.length : from + chunk; // the last chunk carries the remainder
    const part = file.subarray(from, to);
    const up = await fetch(d.data.upload_url, { method: "PUT", headers: { "content-type": mime === "video/webm" ? "video/webm" : "video/mp4", "content-length": String(part.length), "content-range": `bytes ${from}-${to - 1}/${file.length}` }, body: part });
    if (!up.ok) throw new Error(`TikTok upload failed on part ${i + 1} of ${count}: ${up.status}`);
  }
  return {
    platform: "tiktok", id: d.data.publish_id, mode, privacy: level || undefined, account: creator && creator.creator_username,
    note: mode === "draft" ? "Sent to your TikTok inbox. Open TikTok, tap the notification, add the caption and post it." + (caption ? " TikTok does not take a caption on drafts; paste yours there." : "")
      : level === "SELF_ONLY" ? "Posted as private (only you). TikTok keeps posts from a new app private until it finishes reviewing heistclips; change who can see it in the TikTok app." : "Posted. TikTok takes a minute to process it.",
  };
}

// TikTok user.info.basic: the display name and avatar, shown on /post so the user can see which
// account is connected. Nothing else is read. Returns {} when TikTok will not say.
export async function tiktokProfile(access_token) {
  try {
    const r = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=display_name,avatar_url", { headers: { authorization: "Bearer " + access_token } });
    const d = await r.json().catch(() => ({}));
    const u = (d.data && d.data.user) || {};
    return { name: u.display_name ? String(u.display_name).slice(0, 80) : undefined, avatar: /^https:\/\//.test(u.avatar_url || "") ? u.avatar_url : undefined };
  } catch { return {}; }
}
