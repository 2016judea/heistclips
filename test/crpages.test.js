import test from "node:test";
import assert from "node:assert/strict";
import { flightText, campaignFromPage, discoverCards, slim, freshen } from "../lib/crpages.js";
import fs from "node:fs";

const camp = JSON.parse(fs.readFileSync(new URL("./fixtures/campaigns.json", import.meta.url)))[0];
// A page the way Next.js ships it: the payload split across self.__next_f.push string chunks.
const payload = `1f:["$","$L28",null,{"campaign":${JSON.stringify(camp)},"x":"$undefined"}]`;
const mid = Math.floor(payload.length / 2);
const page = `<html><script>self.__next_f.push([1,${JSON.stringify(payload.slice(0, mid))}])</script><script>self.__next_f.push([1,${JSON.stringify(payload.slice(mid))}])</script></html>`;

test("flight chunks are joined back into one payload", () => {
  assert.equal(flightText(page), payload);
});

test("a campaign page yields the full campaign object", () => {
  const c = campaignFromPage(page);
  assert.equal(c.id, camp.id);
  assert.ok(Array.isArray(c.payouts) && c.metrics);
});

test("slim keeps what the ranker needs and drops clipper identities", () => {
  const s = slim(campaignFromPage(page));
  assert.equal(s.budgetCents, camp.budgetCents);
  assert.ok(!JSON.stringify(s).includes("username"));
  assert.ok(!JSON.stringify(s).includes("avatarUrl"));
});

test("discover cards freshen budget numbers", () => {
  const card = { id: camp.id, budgetTotalRaw: 5000, budgetSpentRaw: 1234.5, creatorCountRaw: 77 };
  const html = `<script>self.__next_f.push([1,${JSON.stringify(`5:{"initialResults":[{"campaigns":[${JSON.stringify(card)}]}]}`)}])</script>`;
  const cards = discoverCards(html);
  assert.equal(cards.length, 1);
  const f = freshen(slim(camp), cards[0]);
  assert.equal(f.budgetCents, 500000);
  assert.equal(f.metrics.budgetSpentCents, 123450);
  assert.equal(f.metrics.creatorCount, 77);
});

test("nothing in the crawler reads contentrewards /api/", () => {
  const src = fs.readFileSync(new URL("../lib/crpages.js", import.meta.url), "utf8") + fs.readFileSync(new URL("../lib/campaigns.js", import.meta.url), "utf8");
  assert.ok(!/contentrewards\.com\/api\//.test(src));
  assert.ok(!/politeGet\(["'`]\/api\//.test(src));
});
