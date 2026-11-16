import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { Readable } from "node:stream";

process.env.STRIPE_WEBHOOK_SECRET = "whsec_other, whsec_test123";
const { default: handler } = await import("../api/stripe-webhook.js");

function call(body, sig) {
  const req = Readable.from([Buffer.from(body)]);
  req.headers = { "stripe-signature": sig };
  return new Promise((ok) => {
    const res = { statusCode: 200, setHeader() {}, end(b) { ok({ status: this.statusCode, body: JSON.parse(b) }); } };
    handler(req, res);
  });
}
const sign = (body, secret, t = Math.floor(Date.now() / 1000)) => `t=${t},v1=${crypto.createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;
const ev = JSON.stringify({ type: "checkout.session.completed", data: { object: { id: "cs_test_x", payment_status: "paid", metadata: { product: "someone-else", pack: "p50" } } } });

test("a correctly signed event is accepted, with any of the comma-separated secrets", async () => {
  const r = await call(ev, sign(ev, "whsec_test123"));
  assert.equal(r.status, 200);
  assert.equal(r.body.ignored, "not heistclips");
});

test("a bad or stale signature is refused", async () => {
  assert.equal((await call(ev, sign(ev, "whsec_wrong"))).status, 400);
  assert.equal((await call(ev, sign(ev, "whsec_test123", 1000))).status, 400);
});
