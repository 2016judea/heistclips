import test from "node:test";
import assert from "node:assert/strict";
import { backPath, sessionForm } from "../api/checkout.js";

const pack = { id: "p50", clips: 50, price: 5 };

test("a buyer only ever returns to our own clip tool", () => {
  assert.equal(backPath("/clip?q=kaicenat&t=120", "en"), "/clip?q=kaicenat&t=120");
  assert.equal(backPath("/de/clip?q=trymacs", "de"), "/de/clip?q=trymacs");
  assert.equal(backPath("/clip?q=x&paid=cs_live_old", "en"), "/clip?q=x");
  assert.equal(backPath("https://evil.example/clip", "en"), "/clip");
  assert.equal(backPath("//evil.example/clip", "fr"), "/fr/clip");
  assert.equal(backPath("/pricing", "de"), "/de/clip");
  assert.equal(backPath("", "en"), "/clip");
  assert.equal(backPath("/pt/clip?q=alanzoka", "pt"), "/pt/clip?q=alanzoka");
  assert.equal(backPath("/xx/clip", "es"), "/es/clip");
});

test("checkout keeps the price, speaks the buyer's language and comes back to the stream", () => {
  const f = sessionForm(pack, { origin: "https://heistclips.com", lang: "de", back: "/de/clip?q=trymacs", device: "d1", pmc: "pmc_x" });
  assert.equal(f.get("line_items[0][price_data][unit_amount]"), "500");
  assert.equal(f.get("line_items[0][price_data][currency]"), "usd");
  assert.equal(f.get("locale"), "de");
  assert.equal(f.get("adaptive_pricing[enabled]"), "true");
  assert.equal(f.get("payment_method_configuration"), "pmc_x");
  assert.equal(f.get("success_url"), "https://heistclips.com/de/clip?q=trymacs&paid={CHECKOUT_SESSION_ID}");
  assert.equal(f.get("cancel_url"), "https://heistclips.com/de/clip?q=trymacs");
  assert.equal(f.get("allow_promotion_codes"), null); // no codes exist; the box only invites a hunt for one
  const en = sessionForm(pack, { origin: "https://heistclips.com", lang: "", back: "", device: "d1", pmc: null });
  assert.equal(en.get("locale"), "auto");
  assert.equal(sessionForm(pack, { origin: "https://heistclips.com", lang: "pt", back: "", device: "d", pmc: null }).get("locale"), "pt-BR");
  assert.equal(sessionForm(pack, { origin: "https://heistclips.com", lang: "es", back: "", device: "d", pmc: null }).get("cancel_url"), "https://heistclips.com/es/pricing");
  assert.equal(en.get("success_url"), "https://heistclips.com/clip?paid={CHECKOUT_SESSION_ID}");
  assert.equal(en.get("cancel_url"), "https://heistclips.com/pricing");
  assert.equal(en.get("payment_method_configuration"), null);
});

test("checkout is branded heistclips, not the Brick & Mortar account it runs on", async () => {
  const { sessionForm, BRAND_FILES } = await import("../api/checkout.js");
  const f = sessionForm({ id: "p50", clips: 50, price: 5 }, { origin: "https://heistclips.com", lang: "en" });
  assert.equal(f.get("branding_settings[display_name]"), "heistclips");
  assert.equal(f.get("branding_settings[logo][file]"), BRAND_FILES.logo);
  assert.equal(f.get("branding_settings[icon][file]"), BRAND_FILES.icon);
  assert.equal(f.get("payment_intent_data[statement_descriptor_suffix]"), "HEISTCLIPS");
});
