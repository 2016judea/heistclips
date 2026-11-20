// Posting: the /post page (connect YouTube / TikTok once), the OAuth round trip, and the post.
//   GET  /post[?acct=hc_…]                       the page
//   GET  /api/v1/post?op=start&provider=&acct=   -> 302 to YouTube / TikTok
//   GET  /oauth/<provider>/callback              -> stores sealed tokens, 302 back to /post
//   POST /api/v1/post {op: new|status|link|disconnect|post|upload-start}
//   PUT  /api/v1/post?op=part&acct=&id=&n=&ext=  one <=3.5 MB slice of a browser render
import * as R from "../../lib/render.js";
import { getAccount, createAccount, keep, signState, readState, ACCT } from "../../lib/accounts.js";
import { PROVIDERS, available, availability, storeTokens, tiktokProfile } from "../../lib/social.js";
import { postJob, accountStatus } from "../../lib/postjob.js";
import { putFile, randomName, CLIP_ID } from "../../lib/blobfiles.js";
import { postWords } from "../../lib/pages_l10n.js";
import { href } from "../../lib/i18n.js";

const json = (res, obj, status = 200) => { res.statusCode = status; res.setHeader("content-type", "application/json"); res.setHeader("cache-control", "no-store"); res.end(JSON.stringify(obj)); };
const go = (res, url) => { res.statusCode = 302; res.setHeader("location", url); res.setHeader("cache-control", "no-store"); res.end(); };

async function raw(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  const chunks = []; for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}
async function body(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  try { return JSON.parse((await raw(req)).toString("utf8") || "{}"); } catch (e) { return {}; }
}

// English words for the page; the other languages carry the same keys under `post` in
// lib/l10n_<lang>.js (lib/i18n.js). Markup, attributes and gating are the same in every language.
const EN = {
  title: "Post clips to YouTube and TikTok | heistclips",
  desc: "Connect YouTube or TikTok once, then post a 9:16 clip with its caption from heistclips or from Claude.",
  h1: "Post clips to YouTube and TikTok",
  lede: "Connect once. Then post a clip with its caption from the clip tool, or just ask in Claude: “cut that moment and post it to YouTube”.",
  loading: "Loading…", connect: (p) => `Connect ${p}`, disconnect: "Disconnect",
  closed: (p) => `Coming soon: waiting on ${p} to approve heistclips.`,
  how: {
    youtube: "Google is still reviewing heistclips. Posting to YouTube opens as soon as Google approves it. Until then, download the clip and upload it in YouTube yourself.",
    tiktok: "Posts to your profile, or to your TikTok inbox as a draft. Until TikTok finishes its review, posts arrive private.",
  },
  howH: "How it works",
  facts: [
    `heistclips asks only for permission to <b>upload videos</b> (TikTok also shares your display name). It cannot read your videos, messages or anything else. <a href="/privacy">Privacy</a>.`,
    `Disconnect here at any time, or from <a href="https://myaccount.google.com/permissions" rel="noopener">Google</a> or TikTok’s “Manage app permissions”.`,
    "This browser’s free clips and packs are shared with the connector once this page has been opened with its link.",
  ],
};

function page(lang = "en") {
  const W = postWords(lang) || EN;
  if (W === EN) lang = "en";
  const av = availability();
  const row = (p, how) => `<div class="pack postrow" data-provider="${p}"><b>${PROVIDERS[p].label}</b><span class="small" data-state>…</span>
<button class="btn" data-connect="${p}"${av[p] ? "" : " hidden"}>${W.connect(PROVIDERS[p].label)}</button><button class="linkbtn" data-disconnect="${p}" hidden>${W.disconnect}</button><span class="small" data-closed${av[p] ? " hidden" : ""}>${W.closed(PROVIDERS[p].label)}</span>
<span class="small">${how}</span></div>`;
  const b = `<h1>${W.h1}</h1>
<p class="lede">${W.lede}</p>
<div id="postpage" data-open='${JSON.stringify(av)}'>
<p class="small" id="acctline">${W.loading}</p>
<div class="packs">
${row("youtube", W.how.youtube)}
${row("tiktok", W.how.tiktok)}
</div>
<p class="small" id="postmsg"></p>
<h2>${W.howH}</h2>
<ul class="facts">
${W.facts.map((x) => `<li>${x.replace('href="/privacy"', `href="${href(lang, "/privacy")}"`)}</li>`).join("\n")}
</ul>
</div>
${lang === "en" ? "" : '<script type="module" src="/js/l10n.js?v=8"></script>'}<script type="module" src="/js/post.js?v=1"></script>`;
  return R.layout({ lang, title: W.title, desc: W.desc, path: "/post", body: b, noindex: false });
}

export default async function handler(req, res) {
  const u = new URL(req.url, "https://heistclips.com");
  const op = u.searchParams.get("op");
  try {
    if (req.method === "GET" && !op) { res.statusCode = 200; res.setHeader("content-type", "text/html; charset=utf-8"); res.setHeader("cache-control", "public, max-age=60, s-maxage=300"); return res.end(page(u.searchParams.get("lang") || "en")); } // /de/post arrives as ?lang=de (vercel.json)

    if (req.method === "GET" && op === "start") {
      const p = u.searchParams.get("provider"), acct = u.searchParams.get("acct");
      if (!PROVIDERS[p] || !available(p, acct)) return go(res, `/post?err=${encodeURIComponent("That platform is not open yet.")}`);
      const rec = await getAccount(acct);
      if (!rec) return go(res, `/post?err=${encodeURIComponent("Unknown account. Reload the page.")}`);
      return go(res, PROVIDERS[p].authUrl(signState({ a: rec.code, p })));
    }

    if (req.method === "GET" && op === "callback") {
      const p = u.searchParams.get("provider");
      const st = readState(u.searchParams.get("state"));
      if (!PROVIDERS[p] || !st || st.p !== p) return go(res, `/post?err=${encodeURIComponent("That sign-in link expired. Press Connect again.")}`);
      const back = `/post?acct=${st.a}`;
      if (u.searchParams.get("error") || !u.searchParams.get("code")) return go(res, `${back}&err=${encodeURIComponent(PROVIDERS[p].label + " was not connected (" + (u.searchParams.get("error_description") || u.searchParams.get("error") || "cancelled") + ").")}`);
      const rec = await getAccount(st.a);
      if (!rec) return go(res, `/post?err=${encodeURIComponent("Unknown account.")}`);
      let tok;
      try { tok = await PROVIDERS[p].exchange(u.searchParams.get("code")); }
      catch (e) { return go(res, `${back}&err=${encodeURIComponent(e.message)}`); }
      // Google lists what was actually ticked; without the upload scope nothing can be posted.
      if (p === "youtube" && tok.scope && !tok.scope.includes("youtube.upload")) return go(res, `${back}&err=${encodeURIComponent("YouTube was connected without the upload permission. Press Connect again and leave the box ticked.")}`);
      if (p === "tiktok") Object.assign(tok, await tiktokProfile(tok.access_token));
      storeTokens(rec, p, tok);
      await keep(rec);
      return go(res, `${back}&connected=${p}`);
    }

    if (req.method === "PUT" && op === "part") {
      const acct = u.searchParams.get("acct"), id = u.searchParams.get("id"), n = Number(u.searchParams.get("n")), ext = u.searchParams.get("ext") === "webm" ? "webm" : "mp4";
      if (!ACCT.test(acct || "") || !CLIP_ID.test(id || "") || !(n >= 0 && n < 40)) return json(res, { ok: false, error: "bad upload" }, 400);
      if (!(await getAccount(acct))) return json(res, { ok: false, error: "unknown account" }, 400);
      const buf = await raw(req);
      if (!buf.length || buf.length > 4.2e6) return json(res, { ok: false, error: "part too large" }, 413);
      await putFile(`uploads/${id}/${String(n).padStart(3, "0")}.${ext}.part`, buf, "application/octet-stream");
      return json(res, { ok: true, n, bytes: buf.length });
    }

    if (req.method !== "POST") return json(res, { ok: false, error: "unknown request" }, 400);
    const b = await body(req);
    if (b.op === "open") return json(res, { ok: true, open: availability(b.account) });
    if (b.op === "new") { const rec = await createAccount("web"); return json(res, { ok: true, account: rec.code }); }
    if (b.op === "status") return json(res, { ...(await accountStatus(b.account)), open: availability(b.account) });
    if (b.op === "link") {
      // Opening /post in a browser ties the account to that browser's clip balance.
      const rec = await getAccount(b.account);
      if (!rec) return json(res, { ok: false, error: "unknown account" });
      const d = String(b.d || "").slice(0, 80), k = String(b.k || "").slice(0, 200);
      if (d && (rec.d !== d || (k && rec.k !== k))) { rec.d = d; if (k) rec.k = k; await keep(rec); }
      return json(res, { ...(await accountStatus(rec.code)), open: availability(rec.code) });
    }
    if (b.op === "disconnect") {
      const rec = await getAccount(b.account);
      if (!rec || !PROVIDERS[b.provider]) return json(res, { ok: false, error: "unknown account" });
      if (rec[b.provider] && rec[b.provider].sealed) { try { await PROVIDERS[b.provider].revoke((await import("../../lib/accounts.js")).unseal(rec[b.provider].sealed)); } catch (e) {} }
      rec[b.provider] = null; await keep(rec);
      return json(res, { ...(await accountStatus(rec.code)), open: availability(rec.code) });
    }
    if (b.op === "upload-start") return json(res, (await getAccount(b.account)) ? { ok: true, id: randomName(), part_bytes: 3500000 } : { ok: false, error: "unknown account" });
    if (b.op === "post") return json(res, await postJob(b, b.via === "mcp" ? "mcp" : undefined));
    return json(res, { ok: false, error: "unknown op" }, 400);
  } catch (e) {
    return json(res, { ok: false, error: "Something went wrong: " + e.message }, 500);
  }
}
