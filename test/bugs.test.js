// Bug reports have their own route: a kind on the board, their own tool and form, an email a
// session can reproduce from, and nothing private in the public board file.
import test from "node:test";
import assert from "node:assert/strict";

process.env.HC_STORE = "memory"; // never the live store
process.env.HC_NO_ANALYTICS = "1";
delete process.env.ANTHROPIC_API_KEY; delete process.env.MAILGUN_API_KEY;
const { submit, loadBoard, publicList, bugMailText, bugFields, setKinds, removeItems, kindOf } = await import("../lib/requests.js");
const { TOOLS, callTool, withBugHint, INSTRUCTIONS } = await import("../api/mcp.js");
const { requestsPage } = await import("../lib/render.js");
const { localPage } = await import("../lib/pages_l10n.js");

const BUG = { kind: "bug", title: "Leeres Video nach dem Rendern", what_happened: "Ich habe auf Rendern geklickt und das MP4 war schwarz.", expected: "Ein Clip mit Bild und Ton", source: "https://www.twitch.tv/videos/2932866051", moment_start: 6000, moment_end: 6030, tool: "cut_clip", error_text: "ffmpeg timed out", clip_id: "a".repeat(40), account: "hc_" + "x".repeat(32), client: "Claude", contact: "me@example.com" };

test("a bug report is filed as a bug even though it names a stream, and keeps private fields off the board", async () => {
  const r = await submit(BUG, "voter-1", "ip-1");
  assert.equal(r.ok, true); assert.equal(r.item.kind, "bug");
  assert.deepEqual(r.item.bug, { source: "2932866051", platform: "twitch", start: 6000, end: 6030, step: "cut_clip", error: "ffmpeg timed out", client: "Claude", expected: "Ein Clip mit Bild und Ton" });
  const stored = JSON.stringify(await loadBoard());
  for (const secret of [BUG.clip_id, BUG.account, BUG.contact]) assert.ok(!stored.includes(secret), "not in the public board file");
  assert.equal(r.bug_private.account, BUG.account); assert.equal(r.bug_private.clip_id, BUG.clip_id);
  const row = publicList(await loadBoard()).find((x) => x.id === r.id);
  assert.equal(row.kind, "bug"); assert.equal(row.detail, BUG.what_happened); assert.ok(!("bug" in row));
  // a bug whose title IS a stream id is still a bug report, not a redirect to /clip
  const t = await submit({ kind: "bug", title: "2932866051", what_happened: "find_clip_moments returned no moments for this one", source: "2932866051" }, "voter-2", "ip-2");
  assert.equal(t.ok, true); assert.equal(t.item.kind, "bug");
  // the feature box keeps its guard
  const f = await submit({ title: "2932866051" }, "voter-3", "ip-3");
  assert.equal(f.ok, false); assert.equal(f.stream, true);
});

test("a bug needs words, takes no links in its text, and shares the three-a-day limit", async () => {
  assert.equal((await submit({ kind: "bug", title: "Broken thing here" }, "v", "ip-9")).ok, false);
  assert.match((await submit({ kind: "bug", title: "Broken thing here", what_happened: "see https://evil.example/x for the details" }, "v", "ip-9")).error, /links/i);
  assert.equal(bugFields({ source: "https://evil.example/x" }).pub.source, undefined);
  for (let i = 0; i < 3; i++) assert.equal((await submit({ kind: i % 2 ? "bug" : "feature", title: "Limit check number " + i, what_happened: "it broke when I clicked render" }, "v", "ip-lim")).ok, true);
  assert.match((await submit({ kind: "bug", title: "Limit check number 4", what_happened: "it broke when I clicked render" }, "v", "ip-lim")).error, /three reports/);
});

test("the bug email has every structured field on its own line, English first", () => {
  const item = { id: "rabc", kind: "bug", title: BUG.title, detail: BUG.what_happened, lang: "de", tr: { en: { title: "Empty video after rendering", detail: "I clicked render and the MP4 was black." } }, bug: bugFields(BUG).pub };
  const lines = bugMailText(item, BUG.contact, "MCP (claude)", bugFields(BUG).priv).split("\n");
  assert.equal(lines[0], "Title: Empty video after rendering");
  for (const want of ["What happened: I clicked render and the MP4 was black.", "Expected: Ein Clip mit Bild und Ton", "Platform: twitch", "Moment: 6000s to 6030s", "Tool or step: cut_clip", "Error text: ffmpeg timed out", "Clip id: " + BUG.clip_id, "Account code: " + BUG.account, "Client: Claude", "Contact: me@example.com", "Via: MCP (claude)", "Board: https://heistclips.com/requests#rabc", "Open it: https://heistclips.com/clip?q=2932866051&t=6000"]) assert.ok(lines.includes(want), want);
  assert.ok(lines.some((l) => l.startsWith("Stream: 2932866051")));
  assert.ok(lines.includes(BUG.title), "the reporter's own words are underneath");
  assert.ok(bugMailText({ id: "r1", kind: "bug", title: "x", detail: "" }, "", "website").includes("Stream: (not given)"));
});

test("kinds can be set and test items removed in one write each; old items are features", async () => {
  const a = await submit({ title: "A plain old feature wish" }, "v", "ip-a"), b = await submit({ title: "Another plain feature wish" }, "v", "ip-b");
  assert.equal(kindOf((await loadBoard()).items.find((x) => x.id === a.id)), "feature");
  assert.deepEqual((await setKinds({ [a.id]: "bug", [b.id]: "bug", nope: "bug" })).sort(), [a.id, b.id].sort());
  assert.equal(publicList(await loadBoard()).filter((x) => [a.id, b.id].includes(x.id)).every((x) => x.kind === "bug"), true);
  assert.equal(await removeItems([a.id, b.id]), 2);
  assert.equal((await loadBoard()).items.some((x) => x.id === a.id), false);
});

test("connector: report_a_bug files a bug, the board tool filters by kind, and a failed tool points at it", async () => {
  const t = TOOLS.find((x) => x.name === "report_a_bug");
  assert.deepEqual(t.inputSchema.required, ["title"]);
  for (const k of ["what_happened", "expected", "source", "moment_start", "moment_end", "tool", "error_text", "clip_id", "account", "client", "contact"]) assert.ok(t.inputSchema.properties[k], k);
  assert.match(t.description, /never on your own/i); assert.match(INSTRUCTIONS, /report_a_bug/); assert.match(INSTRUCTIONS, /whats_new/);
  const r = await callTool("report_a_bug", { title: "Clip came out silent again", what_happened: "cut_clip gave me an MP4 with no sound", source: "kick.com/adinross", tool: "cut_clip" }, "ip-mcp");
  assert.equal(r.structuredContent.ok, true); assert.equal(r.structuredContent.kind, "bug");
  const bugs = (await callTool("list_feature_requests", { kind: "bug" })).structuredContent.requests;
  assert.ok(bugs.length && bugs.every((x) => x.kind === "bug"));
  assert.ok((await callTool("list_feature_requests", { kind: "feature" })).structuredContent.requests.every((x) => x.kind === "feature"));
  // the hint: prefilled from the failed call, and absent on the board tools themselves
  const failed = { content: [{ type: "text", text: "x" }], structuredContent: { ok: false, error: "ffmpeg exit 1. Nothing was charged.", account: "hc_abc" }, isError: true };
  const h = withBugHint(failed, "cut_clip", { source: "2932866051", start: 100, end: 130 }).structuredContent.report_a_bug;
  assert.match(h.hint, /Never file it without asking/);
  assert.deepEqual(h.prefill, { title: "", tool: "cut_clip", error_text: "ffmpeg exit 1. Nothing was charged.", failure: "error_returned", source: "2932866051", moment_start: 100, moment_end: 130, account: "hc_abc" });
  assert.equal(withBugHint(failed, "report_a_bug", {}), failed);
  const refused = Object.defineProperty({ ...failed }, "log", { value: { err: "too_long" }, enumerable: false });
  assert.equal(withBugHint(refused, "cut_clip", {}).structuredContent.report_a_bug, undefined, "a window we refused is not a bug");
  assert.equal(withBugHint({ content: [], structuredContent: { found: false } }, "find_clip_moments", {}).structuredContent.report_a_bug, undefined);
  const news = (await callTool("whats_new", { limit: 3 })).structuredContent;
  assert.ok(news.entries.length >= 1 && news.entries.length <= 3 && news.entries[0].title && /src=mcp/.test(news.entries[0].url));
});

test("/requests shows the Bug tag, the filter and the bug form in every language", async () => {
  const list = [{ id: "r1", kind: "bug", title: "No sound", detail: "d", status: "requested", by: "Requested by a clipper", votes: 1 }, { id: "r2", kind: "feature", title: "Captions", detail: "", status: "requested", by: "Requested by a clipper", votes: 2 }];
  const pages = { en: requestsPage(list, "en") };
  for (const lang of ["de", "fr", "pt", "es"]) pages[lang] = await localPage(lang, "/requests", { board: list });
  for (const [lang, html] of Object.entries(pages)) {
    assert.ok(html, lang);
    assert.match(html, /id="r1"[^>]*data-kind="bug"/, lang); assert.match(html, /id="r2"[^>]*data-kind="feature"/, lang);
    assert.equal((html.match(/class="st st-bug"/g) || []).length, 1, lang + ": one Bug tag, on the bug");
    for (const need of ['name="kind" value="bug"', 'name="what_happened"', 'name="expected"', 'name="source"', 'id="reqfilter"', 'data-kind="bug"', "data-ph-bug=", "requests.js?v=8"]) assert.ok(html.includes(need), lang + " " + need);
  }
  assert.ok(pages.de.includes("Bug melden") && pages.fr.includes("Signaler un bug") && pages.pt.includes("Reportar um bug") && pages.es.includes("Reportar un bug"));
});
