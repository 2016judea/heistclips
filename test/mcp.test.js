import test from "node:test";
import assert from "node:assert/strict";
import { TOOLS } from "../api/mcp.js";

// OpenAI rejected a past plugin for any annotation left null; every hint must be a boolean.
test("every tool sets readOnly, destructive and openWorld hints explicitly", () => {
  for (const t of TOOLS) for (const k of ["readOnlyHint", "destructiveHint", "openWorldHint", "idempotentHint"]) assert.equal(typeof t.annotations[k], "boolean", `${t.name}.${k}`);
});

test("only the board tools write, and none is destructive", () => {
  const writers = TOOLS.filter((t) => !t.annotations.readOnlyHint).map((t) => t.name).sort();
  assert.deepEqual(writers, ["request_a_feature", "upvote_feature_request"]);
  assert.ok(TOOLS.every((t) => t.annotations.destructiveHint === false));
});
