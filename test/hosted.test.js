// Hosted campaigns (lib/hosted.js, lib/hostedtool.js): rules, post checks, the view curve's
// suspect flag, the ledger, ranking, and one campaign end to end in the memory store.
import test from "node:test";
import assert from "node:assert/strict";
process.env.HC_STORE = "memory";
process.env.HC_NO_ANALYTICS = "1";
const H = await import("../lib/hosted.js");
const T = await import("../lib/hostedtool.js");
const { putJSON, getJSON } = await import("../lib/store.js");
const { createAccount } = await import("../lib/accounts.js");
const { rank, normalize } = await import("../lib/campaigns.js");
const { TOOLS } = await import("../api/mcp.js");

const HOUR = 3600000, NOW = Date.parse("2026-11-20T18:00:00Z");
const RULES = { budget: 100, rate_per_1k: 2, floor_views: 1000, cap_per_clip: 30, platforms: ["tiktok", "youtube"], min_secs: null, max_secs: 60, facecam_required: true, required_tags: ["#yourrage"], notes: "" };

test("rules: limits answer in plain words, tags normalise, fee defaults to 10%", () => {
  assert.equal(H.validateRules({ budget: 50, rate_per_1k: 1, cap_per_clip: 10, platforms: ["tiktok"] }).field, "budget");
  assert.equal(H.validateRules({ budget: 500, rate_per_1k: 1, cap_per_clip: 600, platforms: ["tiktok"] }).field, "cap_per_clip");
  assert.equal(H.validateRules({ budget: 500, rate_per_1k: 1, cap_per_clip: 20, platforms: ["instagram"] }).field, "platforms");
  const ok = H.validateRules({ budget: "$1,000", rate_per_1k: "1.5", floor_views: "", cap_per_clip: 40, platforms: ["tiktok", "x"], max_secs: 45, required_tags: "YourRage, @night #GTA6", facecam_required: "1" });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.rules.required_tags, ["#yourrage", "@night", "#gta6"]);
  assert.deepEqual(ok.rules.platforms, ["tiktok"]);
  assert.equal(ok.rules.floor_views, 0);
  assert.equal(ok.rules.budget, 1000);
  delete process.env.HOSTED_FEE_PCT;
  assert.deepEqual(H.fees(1000), { budget: 1000, fee_pct: 10, fee: 100, total: 1100 });
  process.env.HOSTED_FEE_PCT = "15";
  assert.equal(H.fees(200).fee, 30);
  delete process.env.HOSTED_FEE_PCT;
});

test("links and handles parse; codes are stable and short", () => {
  assert.deepEqual(H.parsePost("https://www.youtube.com/shorts/_o8yOFDjJUs?feature=share"), { platform: "youtube", id: "_o8yOFDjJUs", url: "https://www.youtube.com/shorts/_o8yOFDjJUs" });
  assert.equal(H.parsePost("https://youtu.be/_o8yOFDjJUs").id, "_o8yOFDjJUs");
  const tt = H.parsePost("https://www.tiktok.com/@HeistClips_/video/7709993425952623885?is_from_webapp=1");
  assert.equal(tt.handle, "heistclips_"); assert.equal(tt.id, "7709993425952623885");
  assert.equal(H.parsePost("https://vm.tiktok.com/ZMabc123/").short, true);
  assert.equal(H.parsePost("https://twitch.tv/videos/1"), null);
  assert.deepEqual(H.parseHandle("tiktok", "https://www.tiktok.com/@Some.One_"), { platform: "tiktok", handle: "some.one_", key: "some.one_" });
  assert.equal(H.parseHandle("youtube", "youtube.com/@HeistClipsDotCom").key, "@heistclipsdotcom");
  assert.equal(H.parseHandle("youtube", "UCeI-oiyvJlp7QLargQZYoqQ").channel_id, "UCeI-oiyvJlp7QLargQZYoqQ");
  const c = H.clipperCode("hc_x", "tiktok", "a");
  assert.match(c, /^hc-[0-9a-f]{6}$/); assert.equal(c, H.clipperCode("hc_x", "tiktok", "a")); assert.notEqual(c, H.clipperCode("hc_y", "tiktok", "a"));
  assert.ok(H.hasCode("clips daily • HC-" + c.slice(3).toUpperCase(), c));
});

const ttHtml = (item, user) => `<html><script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${JSON.stringify({ __DEFAULT_SCOPE__: { ...(item ? { "webapp.video-detail": { itemInfo: { itemStruct: item } } } : {}), ...(user ? { "webapp.user-detail": { userInfo: { user } } } : {}) } })}</script></html>`;

test("TikTok's page blob gives the post and the bio", () => {
  const p = H.tiktokPostOf(ttHtml({ id: "77", author: { uniqueId: "Clipper1" }, createTime: "1795122744", desc: "lol #yourrage", video: { duration: 38 }, statsV2: { playCount: "5", diggCount: "1", commentCount: "0" } }));
  assert.deepEqual({ author: p.author, secs: p.secs, views: p.views, created: p.created_ms }, { author: "clipper1", secs: 38, views: 5, created: 1795122744000 });
  assert.equal(H.tiktokUserOf(ttHtml(null, { uniqueId: "Clipper1", signature: "hc-abc123", nickname: "C" })).bio, "hc-abc123");
  assert.equal(H.tiktokPostOf("<html>login wall</html>"), null);
});

test("post checks: platform, freshness, length, tags — each with a fix", () => {
  const c = { rules: RULES }, funded = { at: new Date(NOW - 10 * HOUR).toISOString() };
  const post = { platform: "tiktok", created_ms: NOW - 2 * HOUR, secs: 40, text: "insane moment #YourRage #fyp" };
  assert.equal(H.checkPost(c, funded, post, { now: NOW }).ok, true);
  assert.equal(H.checkPost(c, funded, { ...post, created_ms: NOW - 11 * HOUR }, { now: NOW }).reasons[0].code, "before_campaign");
  assert.equal(H.checkPost(c, { at: new Date(NOW - 100 * HOUR).toISOString() }, { ...post, created_ms: NOW - 60 * HOUR }, { now: NOW }).reasons[0].code, "not_fresh");
  assert.equal(H.checkPost(c, funded, { ...post, secs: 75 }, { now: NOW }).reasons[0].code, "too_long");
  const miss = H.checkPost(c, funded, { ...post, text: "#yourragegaming clip" }, { now: NOW });
  assert.equal(miss.reasons[0].code, "missing_tags"); assert.match(miss.reasons[0].fix, /#yourrage/);
  assert.equal(H.checkPost({ rules: { ...RULES, platforms: ["youtube"] } }, funded, post, { now: NOW }).reasons[0].code, "wrong_platform");
});

test("suspect: a sudden jump is flagged, a steady climb is not, nor a small one", () => {
  const steady = [0, 1, 2, 3, 4].map((i) => [NOW + i * HOUR, 2000 * (i + 1), 100 * (i + 1), 10]);
  assert.equal(H.suspectOf(steady), null);
  const spike = [...steady, [NOW + 5 * HOUR, 10000 + 60000, 600, 12]];
  assert.match(H.suspectOf(spike).reason, /\+60,000 views/);
  const small = [...steady, [NOW + 5 * HOUR, 10000 + 9000, 600, 12]];
  assert.equal(H.suspectOf(small), null);
  assert.match(H.suspectOf([[NOW, 30000, 5, 1]]).reason, /only 6 likes and comments/);
});

test("ledger: floor, cap per clip, budget runs out in time order, rejected clips earn nothing", () => {
  const c = { budget: 80, rules: { ...RULES, rate_per_1k: 2, floor_views: 1000, cap_per_clip: 30 } };
  const subs = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  const curves = {
    a: { readings: [[NOW, 500], [NOW + HOUR, 5000]] },        // under the floor ($0), then $10
    b: { readings: [[NOW + 2 * HOUR, 100000]] },               // $200 target, capped at $30
    c: { readings: [[NOW + 3 * HOUR, 12000]] },                // $24
    d: { readings: [[NOW + 4 * HOUR, 40000]] },                // $30 capped, but only $16 left
  };
  const L = H.ledger(c, subs, curves);
  assert.deepEqual(L.earned_cents, { a: 1000, b: 3000, c: 2400, d: 1600 });
  assert.equal(L.left_cents, 0);
  const R = H.ledger(c, subs, curves, new Set(["b"]));
  assert.deepEqual(R.earned_cents, { a: 1000, c: 2400, d: 3000 });
  assert.equal(R.left_cents, 1600);
});

test("payout lines: per ISO week and clipper, suspect money held", () => {
  const st = { campaign: "h000000000001", subs: [{ sid: "a", acct: "x" }, { sid: "b", acct: "x", suspect: { reason: "jump" } }, { sid: "c", acct: "y" }],
    lines: [{ sid: "a", at: Date.parse("2026-11-16T12:00:00Z"), cents: 500 }, { sid: "b", at: Date.parse("2026-11-17T12:00:00Z"), cents: 700 }, { sid: "c", at: Date.parse("2026-11-24T12:00:00Z"), cents: 100 }] };
  const L = H.payoutLines([st]);
  assert.deepEqual(L.map((l) => [l.week, l.acct, l.amount, l.held]), [["2026-W47", "x", 12, 7], ["2026-W48", "y", 1, 0]]);
  assert.match(H.csvOf(L, { payTo: { x: "x@example.com" } }), /2026-W47,x,x@example.com,12.00,7.00,2,h000000000001,/);
});

test("ranked only by what it pays: a hosted campaign is never lifted above a better-paying one", () => {
  const draft = H.draftCampaign({ ownerKey: H.newOwnerKey(), channel: { login: "somestreamer", name: "SomeStreamer" }, rules: { ...RULES, rate_per_1k: 0.5, cap_per_clip: 5 }, now: NOW });
  const hosted = H.toCampaign(draft, { at: new Date(NOW).toISOString() }, null, NOW);
  assert.equal(hosted.marketplace, "heistclips"); assert.equal(hosted.hosted_label, "hosted on heistclips");
  assert.equal(hosted.floor.known, true);
  assert.ok(!JSON.stringify(hosted).toLowerCase().includes("sponsor"));
  const cr = { id: "dd617572-f0f7-4754-8df5-4c0deb81763a", name: "Bigger pay", budgetCents: 500000, primaryPayoutCents: 200, payoutType: "cpm", platforms: ["tiktok"], payouts: [{ platform: "tiktok", payoutType: "cpm", rateCents: 200, maxPayoutCents: 10000, minPayoutCents: 0 }], metrics: {}, launchDate: new Date(NOW).toISOString() };
  const ranked = rank([hosted, normalize(cr, NOW)]);
  assert.deepEqual(ranked.map((c) => c.marketplace), ["Content Rewards", "heistclips"]);
});

test("the new tools: titles, hints, and none moves money", () => {
  const byName = Object.fromEntries(TOOLS.map((t) => [t.name, t]));
  for (const n of ["verify_account", "submit_clip", "my_earnings"]) { assert.ok(byName[n] && byName[n].title, n); assert.equal(byName[n].annotations.destructiveHint, false); }
  assert.equal(byName.my_earnings.annotations.readOnlyHint, true);
  const all = TOOLS.map((t) => t.name + " " + t.description).join(" ");
  assert.ok(!/withdraw|send money|transfer|cash out|pay ?out to/i.test(TOOLS.filter((t) => ["verify_account", "submit_clip", "my_earnings"].includes(t.name)).map((t) => t.description).join(" ")));
  assert.match(all, /never through the chat|never moves money/i);
});

test("end to end in memory: fund, verify, submit, track, earn, export", async () => {
  await putJSON("snapshot/latest.json", { generated_at: new Date(NOW).toISOString(), campaigns: [], summary: {} });
  const ownerKey = H.newOwnerKey();
  const c = H.draftCampaign({ ownerKey, channel: { login: "yourragegaming", name: "YourRAGE" }, rules: RULES, now: NOW - 5 * HOUR });
  await putJSON(H.P.campaign(c.id), c);
  const session = { id: "cs_test_x", payment_status: "paid", livemode: false, amount_total: 11000, currency: "usd", metadata: { product: "heistclips", kind: "hosted", campaign: c.id }, customer_details: { email: "owner@example.com" } };
  const f1 = await H.fund(session, "webhook", { now: NOW - 4 * HOUR });
  assert.equal(f1.funded, true);
  assert.equal((await H.fund(session, "claim")).already, true);
  const snap = await getJSON("snapshot/latest.json");
  assert.equal(snap.campaigns[0].id, c.id);
  assert.equal(snap.campaigns[0].budget_left, 100);
  assert.equal(JSON.stringify(await getJSON(H.P.funded(c.id))).includes("owner@example.com"), false, "no email in the guessable path");

  // verify_account: first call hands out a code (and a new account), second confirms from the bio.
  let bio = "just clips";
  const deps = { fetchText: async (url) => url.includes("/video/") ? { status: 200, text: ttHtml({ id: "7709993425952623885", author: { uniqueId: "clipper1" }, createTime: String(Math.floor((NOW - HOUR) / 1000)), desc: "chat lost it #yourrage", video: { duration: 30 }, statsV2: { playCount: "800", diggCount: "40", commentCount: "3" } }) } : { status: 200, text: ttHtml(null, { uniqueId: "clipper1", signature: bio, nickname: "Clipper" }) } };
  const newAccount = async () => ({ code: (await createAccount("mcp")).code });
  const v1 = await T.verifyAccount({ platform: "tiktok", handle: "@clipper1" }, { newAccount, deps });
  assert.equal(v1.out.verified, false); assert.match(v1.out.code, /^hc-/); assert.match(v1.out.account, /^hc_/);
  const account = v1.out.account;
  // Before verifying, the post is refused as not theirs, with the next step.
  const snapFn = async () => getJSON("snapshot/latest.json");
  const early = await T.submitClip({ account, campaign: c.id, url: "https://www.tiktok.com/@clipper1/video/7709993425952623885" }, { snapshot: snapFn, deps, now: NOW });
  assert.equal(early.out.accepted, false); assert.equal(early.log.err, "not_verified"); assert.match(early.out.next, /verify_account/);
  bio = "clips daily " + v1.out.code;
  const v2 = await T.verifyAccount({ platform: "tiktok", handle: "clipper1", account }, { newAccount, deps });
  assert.equal(v2.out.verified, true);

  const ok = await T.submitClip({ account, campaign: c.slug, url: "https://www.tiktok.com/@clipper1/video/7709993425952623885" }, { snapshot: snapFn, deps, now: NOW });
  assert.equal(ok.out.accepted, true, JSON.stringify(ok.out));
  const dup = await T.submitClip({ account, campaign: c.id, url: "https://www.tiktok.com/@clipper1/video/7709993425952623885" }, { snapshot: snapFn, deps, now: NOW });
  assert.equal(dup.log.err, "duplicate");

  // Two tracker runs: 800 -> 20,000 views. $2/1K past a 1,000 floor, $30 cap: $30 earned.
  let views = 5000;
  const trackDeps = { fetchText: async () => ({ status: 200, text: ttHtml({ id: "7709993425952623885", author: { uniqueId: "clipper1" }, createTime: "1", desc: "", video: { duration: 30 }, statsV2: { playCount: String(views), diggCount: "200", commentCount: "9" } }) }), ytApi: async () => ({ items: [] }) };
  await H.track({ now: NOW + HOUR, deps: trackDeps });
  views = 20000;
  const rep = await H.track({ now: NOW + 2 * HOUR, deps: trackDeps });
  assert.equal(rep.read, 1);
  const st = await getJSON(H.P.state(c.id));
  assert.equal(st.earned, 30); assert.equal(st.left, 70); assert.equal(st.counting, 1);

  const me = await T.myEarnings({ account });
  assert.equal(me.out.total_earned, 30); assert.equal(me.out.owed, 30); assert.equal(me.out.payout_set, false);
  assert.match(me.out.payout_page, /\/earnings#a=hc_/);
  assert.equal(me.out.verified_accounts[0].profile, "@clipper1");

  const csv = await H.payoutCsv({ unseal: () => ({ to: "clipper@example.com" }) });
  assert.equal(csv.lines.length, 1); assert.equal(csv.lines[0].amount, 30);

  // A campaign hosted elsewhere is answered with where to submit, not an error.
  await putJSON("snapshot/latest.json", { ...(await getJSON("snapshot/latest.json")), campaigns: [...(await getJSON("snapshot/latest.json")).campaigns, { id: "cr-1", slug: "other-1", title: "Other", marketplace: "Content Rewards", source_url: "https://contentrewards.com/c/campaigns/cr-1" }] });
  const other = await T.submitClip({ account, campaign: "other-1", url: "https://www.tiktok.com/@clipper1/video/1" }, { snapshot: snapFn, deps, now: NOW });
  assert.equal(other.log.err, "not_hosted"); assert.match(other.out.message, /contentrewards\.com/);
});

test("hosted Checkout: budget and fee as two lines, branded, on the heistclips payment-method config", async () => {
  const { hostedSessionForm } = await import("../api/hosted.js");
  const c = H.draftCampaign({ ownerKey: H.newOwnerKey(), channel: { login: "somestreamer", name: "SomeStreamer" }, rules: { ...RULES, budget: 250 }, now: NOW });
  const f = hostedSessionForm(c, { origin: "https://heistclips.com", pmc: "pmc_x" });
  assert.equal(f.get("line_items[0][price_data][unit_amount]"), "25000");
  assert.equal(f.get("line_items[1][price_data][unit_amount]"), "2500");
  assert.equal(f.get("metadata[kind]"), "hosted"); assert.equal(f.get("metadata[product]"), "heistclips"); assert.equal(f.get("metadata[campaign]"), c.id);
  assert.equal(f.get("branding_settings[display_name]"), "heistclips");
  // The config holds only methods that settle at checkout (card, Link incl. its instant bank, Klarna,
  // Cash App, Amazon Pay; read off two live sessions 2026-11-20), so a paid session funds at once.
  assert.equal(f.get("payment_method_configuration"), "pmc_x");
});
