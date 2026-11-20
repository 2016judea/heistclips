// The connector's side of hosted campaigns (lib/hosted.js): verify_account, submit_clip,
// my_earnings. Every outcome a clipper can fix (no bio code yet, a missing tag, a stale post) is
// an ANSWER with `next`, not an error: the Claude directory counts isError results as failures.
// No tool here moves money (directory policy §4A): payouts are made on heistclips.com, weekly.
import crypto from "node:crypto";
import { getJSON, putJSON, listPaths } from "./store.js";
import { ACCT, getAccount } from "./accounts.js";
import { serverEvent } from "./track.js";
import * as H from "./hosted.js";

const SITE = "https://heistclips.com";
const PH = (props) => ({ ...props, $host: "heistclips.com" });

export const VERIFY_HOW = {
  tiktok: "TikTok app: Profile > Edit profile > Bio. Paste the code anywhere in the bio and save. You can delete it once you are verified.",
  youtube: "YouTube Studio: Customisation > Basic info > Description (or youtube.com > Your channel > Customise channel). Paste the code anywhere in the description and publish. You can delete it once you are verified.",
};

const findCampaign = (snap, q) => {
  const s = String(q || "").trim().toLowerCase();
  if (!s || !snap) return null;
  return snap.campaigns.find((x) => x.id === s || x.slug === s || s.endsWith("/" + x.slug) || s.includes(x.id)) || null;
};

// account (hc_…) -> its record, or an answer telling the assistant what to do.
async function accountOr(args) {
  const code = String(args.account || "").trim();
  if (!ACCT.test(code)) return { answer: { ok: false, need: "account", message: "Pass the user's heistclips account code (hc_…). They get one from verify_account (leave account out on the very first call), cut_clip or posting_account.", next: "Call verify_account without account to start one." }, err: "bad_account" };
  const rec = await getAccount(code);
  if (!rec) return { answer: { ok: false, message: "No heistclips account has that code. Check it was copied exactly, or start a new one with verify_account (leave account out).", next: "Ask the user for their exact account code." }, err: "bad_account" };
  return { rec, code };
}

// ---- verify_account ------------------------------------------------------------------------------
export async function verifyAccount(args = {}, { newAccount, deps = {} } = {}) {
  const platform = String(args.platform || "").toLowerCase();
  if (!H.PLATFORMS.includes(platform)) return { out: { ok: false, message: "Hosted campaigns count TikTok and YouTube Shorts. Pass platform tiktok or youtube.", next: "Ask which account they post from." }, log: { err: "bad_platform" } };
  const h = H.parseHandle(platform, args.handle);
  if (!h) return { out: { ok: false, message: `That does not look like a ${platform === "tiktok" ? "TikTok @name" : "YouTube @handle or channel link"}.`, next: "Ask for the account's @name or profile link exactly." }, log: { err: "bad_handle", platform } };
  let code = String(args.account || "").trim(), created = false;
  if (!code) {
    const made = await newAccount();
    if (made.refused) return { out: { ok: false, ...made.refused }, log: { err: made.err || "account_refused", platform } };
    code = made.code; created = true;
  } else {
    const a = await accountOr({ account: code });
    if (a.answer) return { out: a.answer, log: { err: a.err, platform } };
  }
  const ah = H.acctHash(code);
  const bio = await H.readBio(h, deps).catch((e) => ({ ok: false, err: e.code === "yt_quota" ? "yt_quota" : "read_failed", message: e.message }));
  if (!bio.ok) {
    const why = bio.err === "no_profile" ? `No public ${platform === "tiktok" ? "TikTok" : "YouTube"} account was found for ${args.handle}.` : bio.err === "yt_quota" ? "YouTube's daily lookup limit for heistclips is used up; it resets at midnight Pacific." : "The profile could not be read just now.";
    return { out: { ok: false, verified: false, account: code, message: why, next: bio.err === "no_profile" ? "Ask the user for the exact @name (it is in their profile link)." : "Try again in a few minutes." }, log: { err: bio.err || "no_profile", platform } };
  }
  const key = platform === "youtube" ? bio.channel_id : bio.handle;
  const vcode = H.clipperCode(code, platform, key);
  const label = platform === "tiktok" ? "@" + bio.handle : bio.handle ? "@" + bio.handle : bio.name;
  if (!H.hasCode(bio.bio, vcode)) {
    await serverEvent("clipper_verify", PH({ result: "started", platform, new_account: created || undefined }), "acct_" + ah);
    return {
      out: {
        ok: true, verified: false, account: code, platform, profile: label, code: vcode,
        message: `To prove ${label} is theirs, the user puts ${vcode} anywhere in the ${platform === "tiktok" ? "TikTok bio" : "YouTube channel description"}, saves it, then asks you to check again (call verify_account again with the same account, platform and handle).`,
        how: VERIFY_HOW[platform],
        keep: created ? "This is a new heistclips account. Give the user the account code and tell them to keep it: their submissions and earnings live under it." : undefined,
        next: "Wait until the user says the code is saved, then call verify_account again with the same arguments.",
      }, log: { status: "code_given", platform },
    };
  }
  const rec = { platform, handle: bio.handle || null, channel_id: bio.channel_id || null, name: bio.name || null, key, verified_at: new Date().toISOString(), how: "bio_code" };
  await putJSON(H.P.social(ah, platform, key), rec, { maxAge: 0 });
  await serverEvent("clipper_verify", PH({ result: "passed", platform }), "acct_" + ah);
  return {
    out: {
      ok: true, verified: true, account: code, platform, profile: label,
      message: `${label} is verified for this heistclips account. Posts from it can be submitted to campaigns hosted on heistclips with submit_clip. The code can come out of the bio now.`,
      keep: "Keep the account code: submissions and earnings are under it.",
      next: "To find a campaign to clip for, call rank_clipping_campaigns or plan_my_clips; campaigns marked hosted on heistclips take submit_clip.",
    }, log: { status: "verified", platform },
  };
}

// ---- submit_clip ---------------------------------------------------------------------------------
export async function submitClip(args = {}, { snapshot, deps = {}, now = Date.now() } = {}) {
  const fail = (reason, out, extra = {}) => { serverEvent("clipper_submit", PH({ ok: false, reason, platform: extra.platform, campaign: extra.campaign })).catch(() => null); return { out: { ok: false, accepted: false, ...out }, log: { err: reason, platform: extra.platform } }; };
  const a = await accountOr(args);
  if (a.answer) return fail(a.err, a.answer);
  const snap = await snapshot();
  const row = findCampaign(snap, args.campaign);
  let cid = row && row.hosted ? row.id : null;
  if (!cid && H.CAMPAIGN_ID.test(String(args.campaign || "").trim())) cid = String(args.campaign).trim();
  if (!cid) {
    if (row) return fail("not_hosted", { message: `${row.title} runs on ${row.marketplace || "Content Rewards"}, not on heistclips, so it is submitted there: ${row.source_url}`, join: row.source_url, next: "Give the user that link. submit_clip takes only campaigns hosted on heistclips." });
    return fail("no_campaign", { message: "No live campaign hosted on heistclips matches that.", next: "Call rank_clipping_campaigns and pick a row with hosted: \"hosted on heistclips\", then pass its id." });
  }
  const [c, funded] = await Promise.all([H.loadCampaign(cid), H.loadFunded(cid)]);
  if (!c || !funded) return fail("no_campaign", { message: "That campaign is not open: it was never funded or it is gone.", next: "Call rank_clipping_campaigns for live ones." });
  const st = await getJSON(H.P.state(cid), { fresh: true }).catch(() => null);
  if (st && st.left <= 0) return fail("budget_out", { message: `${c.title} has paid out its whole budget; it takes no more clips.`, next: "Pick another campaign from rank_clipping_campaigns." }, { campaign: cid });
  const p = H.parsePost(args.url);
  if (!p) return fail("bad_link", { message: "That is not a TikTok or YouTube post link. Pass the link of the posted clip, e.g. tiktok.com/@name/video/… or youtube.com/shorts/…", next: "Ask the user for the post's link." }, { campaign: cid });
  const read = await H.readPost(p, deps).catch((e) => ({ ok: false, err: e.code === "yt_quota" ? "yt_quota" : "post_unreadable", why: e.message }));
  if (!read.ok) return fail(read.err || "post_unreadable", { message: read.why || "The post could not be read.", next: read.err === "yt_quota" ? "Try again after midnight Pacific." : "Check the post is public and the link is right, then submit again." }, { platform: p.platform, campaign: cid });
  const post = read.post;
  const socials = await H.socialsOf(a.code);
  const mine = H.ownsPost(socials, post);
  if (!mine) {
    const have = socials.filter((s) => s.platform === post.platform).map((s) => (s.handle ? "@" + s.handle : s.name)).join(", ");
    return fail("not_verified", { message: `This ${post.platform === "tiktok" ? "TikTok" : "YouTube"} post is from ${post.platform === "tiktok" ? "@" + post.author : post.author || "a channel"}, which is not verified on this heistclips account${have ? ` (verified: ${have})` : ""}.`, next: `Call verify_account with platform ${post.platform} and the account that posted it, then submit again.` }, { platform: post.platform, campaign: cid });
  }
  const chk = H.checkPost(c, funded, post, { now });
  if (!chk.ok) return fail(chk.reasons[0].code, { message: chk.reasons.map((r) => r.why).join(" "), fix: chk.reasons.map((r) => r.fix), checks: chk.checks, next: "Tell the user what to fix; once fixed, call submit_clip again with the same link." }, { platform: post.platform, campaign: cid });
  const seenPath = H.P.postSeen(post.platform, post.id);
  const seen = await getJSON(seenPath, { fresh: true }).catch(() => null);
  if (seen) return fail("duplicate", { message: seen.acct === H.acctHash(a.code) ? "This post is already submitted; its views are being counted." : "This post was already submitted by another heistclips account.", next: "Call my_earnings to see it." }, { platform: post.platform, campaign: cid });
  const sid = crypto.randomBytes(10).toString("hex"), ah = H.acctHash(a.code), at = new Date(now).toISOString();
  const sub = {
    id: sid, campaign: cid, acct: ah, platform: post.platform, post_id: post.id, url: post.url, author: post.platform === "tiktok" ? post.author : post.channel_id,
    posted_at: post.created_ms ? new Date(post.created_ms).toISOString() : at, submitted_at: at, secs: post.secs,
    checks: { ...chk.checks, facecam: c.rules.facecam_required ? "owner checks" : "not required", streamer: "owner checks" },
  };
  await putJSON(seenPath, { campaign: cid, acct: ah, at }, { maxAge: 0 });
  await putJSON(H.P.sub(cid, sid), sub, { maxAge: 0 });
  await putJSON(H.P.acctSub(ah, cid, sid), { at }, { maxAge: 0 });
  if (post.views != null) await putJSON(H.P.views(sid), { sid, readings: [[now, post.views, post.likes, post.comments]] }, { maxAge: 0 });
  await serverEvent("clipper_submit", PH({ ok: true, platform: post.platform, campaign: cid }), "acct_" + ah);
  const r = c.rules;
  return {
    out: {
      ok: true, accepted: true, submission: sid, campaign: c.title, platform: post.platform, url: post.url, views_now: post.views,
      pays: `$${r.rate_per_1k} per 1,000 views${r.floor_views ? ` once it passes ${r.floor_views.toLocaleString("en-US")} views` : ""}, up to $${r.cap_per_clip} for this clip, while the budget lasts.`,
      counting: `Views are read from the post's public page every 30 minutes for ${H.TRACK_DAYS} days. A sudden jump is flagged for review, not paid automatically.`,
      owner_checks: [c.rules.facecam_required ? "facecam visible" : null, "it is a clip of " + c.channel.name].filter(Boolean),
      payouts: "Weekly, sent by heistclips from heistclips.com. Nothing is paid in this chat.",
      next: "Call my_earnings with the account code to see views and earnings.",
    }, log: { status: "accepted", platform: post.platform },
  };
}

// ---- my_earnings (read-only) -------------------------------------------------------------------
export async function myEarnings(args = {}, { tag = (u) => u } = {}) {
  const a = await accountOr(args);
  if (a.answer) return { out: a.answer, log: { err: a.err } };
  const out = await earningsOf(a.code);
  out.payout_page = tag(`${SITE}/earnings#a=${a.code}`);
  out.next = out.payout_set ? "Show the user their earnings. Payouts go out weekly from heistclips.com." : "Show the user their earnings. To get paid they add where to send the money on payout_page (once).";
  return { out, log: { status: out.submissions.length ? "has_subs" : "none" } };
}

// Shared by my_earnings and the /earnings page.
export async function earningsOf(code) {
  const ah = H.acctHash(code);
  const [socials, subPaths, payRec] = await Promise.all([H.socialsOf(code), listPaths(`hosted/as/${ah}/`), getJSON(H.P.payout(ah), { fresh: true }).catch(() => null)]);
  const byCampaign = new Map();
  for (const p of subPaths) { const m = p.match(/\/(h[0-9a-f]{12})~([0-9a-f]{20})\.json$/); if (m) byCampaign.set(m[1], [...(byCampaign.get(m[1]) || []), m[2]]); }
  const subs = [], states = [];
  for (const [cid, sids] of byCampaign) {
    const [c, st] = await Promise.all([H.loadCampaign(cid), getJSON(H.P.state(cid), { fresh: true }).catch(() => null)]);
    if (st) states.push(st);
    for (const sid of sids) {
      const row = st && (st.subs || []).find((x) => x.sid === sid);
      const sub = row ? null : await getJSON(H.P.sub(cid, sid), { fresh: true }).catch(() => null);
      subs.push({ campaign: c ? c.title : cid, url: row ? row.url : sub && sub.url, platform: row ? row.platform : sub && sub.platform, views: row ? row.views : null, earned: row ? row.earned : 0,
        status: row && row.rejected ? "rejected by the campaign owner" : row && row.suspect ? "views under review: " + row.suspect.reason : "counting", submitted_at: row ? row.submitted_at : sub && sub.submitted_at });
    }
  }
  const lines = H.payoutLines(states).filter((l) => l.acct === ah);
  const paidSet = new Set((await listPaths(`hosted/paid/`)).filter((p) => p.endsWith(`/${ah}.json`)).map((p) => p.split("/")[2]));
  const earned = lines.reduce((x, l) => x + l.amount, 0), paid = lines.filter((l) => paidSet.has(l.week)).reduce((x, l) => x + l.amount, 0);
  return {
    ok: true, verified_accounts: socials.map((s) => ({ platform: s.platform, profile: s.handle ? "@" + s.handle : s.name, verified_at: s.verified_at })),
    submissions: subs, total_earned: Math.round(earned * 100) / 100, paid: Math.round(paid * 100) / 100, owed: Math.round((earned - paid) * 100) / 100,
    weeks: lines.map((l) => ({ week: l.week, amount: l.amount, held_for_review: l.held || undefined, paid: paidSet.has(l.week) })),
    payout_set: !!(payRec && payRec.sealed),
    note: subs.length ? "Earnings follow the latest view count read (every 30 minutes). A campaign stops paying when its budget runs out." : "No submissions yet. Verify an account with verify_account, post a clip for a campaign hosted on heistclips, and submit it with submit_clip.",
  };
}
