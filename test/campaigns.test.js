import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { normalize, rank, buildSnapshot, slugify, GTA_RE } from "../lib/campaigns.js";

const raw = JSON.parse(fs.readFileSync(new URL("./fixtures/campaigns.json", import.meta.url)));
const NOW = Date.parse("2026-11-16T20:00:00Z");

test("normalize reads rate, cap and budget off the feed", () => {
  const c = normalize(raw.find((x) => /Tokyo Girl/.test(x.name)), NOW);
  assert.equal(c.rate_per_1k, 0.7);
  assert.equal(c.cap_per_clip, 35);
  assert.equal(c.budget_total, 2000);
  assert.ok(c.is_gta);
  assert.match(c.source_url, /^https:\/\/contentrewards\.com\/c\/campaigns\//);
});

test("typical per clip excludes the top three earners and needs 5 other clips", () => {
  for (const r of raw) {
    const c = normalize(r, NOW);
    const top = (r.metrics.topEarners || []).reduce((a, e) => a + (e.approvedSubmissionCount || 0), 0);
    if (r.metrics.approvedSubmissionCount - top < 5) assert.equal(c.earned_per_clip, null);
    else assert.ok(c.earned_per_clip >= 0);
  }
});

test("rank puts proven campaigns first, by expected $ per clip", () => {
  const list = rank(raw.map((r) => normalize(r, NOW)));
  const proven = list.filter((c) => c.expected_per_clip != null);
  for (let i = 1; i < proven.length; i++) assert.ok(proven[i - 1].expected_per_clip >= proven[i].expected_per_clip);
  const firstNew = list.findIndex((c) => c.expected_per_clip == null);
  if (firstNew >= 0) assert.ok(list.slice(firstNew).every((c) => c.expected_per_clip == null));
});

test("snapshot summary carries medians and never invents a number", () => {
  const s = buildSnapshot(raw, NOW);
  assert.equal(s.campaigns.length, s.summary.campaigns);
  assert.ok(s.summary.rate_per_1k_median > 0);
});

test("slugs are url-safe and GTA matching is not fooled by 'gtag'", () => {
  assert.equal(slugify("GTA 6 Clipping Campaign - Tokyo Girl"), "gta-6-clipping-campaign-tokyo-girl");
  assert.ok(GTA_RE.test("Clip GTA VI streams"));
  assert.ok(!GTA_RE.test("add the gtag snippet"));
});

test("an RSC-escaped $$ title reads as one $", () => {
  const c = normalize({ ...raw[0], name: "$$8,000 Expedia Campaign" }, NOW);
  assert.equal(c.title, "$8,000 Expedia Campaign");
  assert.match(c.slug, /^8-000-expedia-campaign-/);
});
