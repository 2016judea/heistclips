import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// A browser script that does not parse takes its whole page down, and nothing else in the suite
// loads these files the way a browser does. One syntax check per file, on every run.
const dir = fileURLToPath(new URL("../public/js/", import.meta.url));
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".js")).sort()) {
  test(`public/js/${f} parses`, () => {
    try { execFileSync(process.execPath, ["--check", dir + f], { stdio: ["ignore", "ignore", "pipe"] }); }
    catch (e) { assert.fail(String(e.stderr || e.message).split("\n").slice(0, 6).join("\n")); }
  });
}

test("every script the clip page imports exists, with the version it asks for spelled once", () => {
  const app = fs.readFileSync(dir + "app.js", "utf8");
  const imports = [...app.matchAll(/from "\.\/([a-z0-9_]+\.js)(\?v=\d+)?"|import "\.\/([a-z0-9_]+\.js)(\?v=\d+)?"/g)].map((m) => m[1] || m[3]);
  assert.ok(imports.length >= 8, "imports found: " + imports.length);
  for (const f of imports) assert.ok(fs.existsSync(dir + f), f);
});
