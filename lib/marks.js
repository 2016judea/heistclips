// Two marks keep our own clips out of public numbers. ANALYTICS.md ("Test and house clips")
// is the reference; this file is the whole mechanism.
//
// TEST: any request that carries the header `x-hc-test: 1` (the credits API, the cut
// endpoints, the queue cut, the connector at /mcp). The clip is cut and charged like any
// other, and it is counted nowhere: no trend record (lib/trend.js), no clip_made. This is the
// one way a test marks itself; scripts/test_cut.mjs is the helper that uses it.
// Why a header and not a user agent or an address: both were tried as after-the-fact filters on
// 2026-11-19 and neither could tell about 70 agent test clips from customers' clips.
//
// HOUSE: clips cut by our own accounts (the clip desk). HOUSE_ACCOUNTS in the environment is a
// comma-separated allow-list of account codes (hc_…) or browser device ids. A house clip is
// charged, sends clip_made and server_cut with `house: true`, and leaves no trend record, so
// our own channel never reads as customer demand on /most-clipped-streams.
export const TEST_HEADER = "x-hc-test";

export function isTest(req) {
  const h = req && req.headers ? req.headers[TEST_HEADER] : undefined;
  return String(Array.isArray(h) ? h[0] : h || "").trim() === "1";
}

const houseList = () => String(process.env.HOUSE_ACCOUNTS || "").split(/[\s,]+/).filter(Boolean);

// `id` is an account code, or the credits "d" (an unlinked account's is "acct:" + its code).
export function isHouse(id) {
  const s = String(id || "");
  if (!s) return false;
  const list = houseList();
  return list.includes(s) || (s.startsWith("acct:") && list.includes(s.slice(5)));
}
