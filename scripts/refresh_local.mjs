// Run the cron once from this machine (fills the Blob snapshot). INDEXNOW_OFF=1 skips the ping.
import fs from "node:fs";
for (const line of fs.readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const { default: handler } = await import("../api/refresh.js");
const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(b) { console.log(b); }, statusCode: 200 };
await handler({ headers: {}, url: "/api/refresh" }, res);
