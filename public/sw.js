// heistclips service worker: only for "new clips are ready" notifications. A push arrives
// with no content; this asks the queue what is new and writes the notification from that.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

async function queueKey() {
  try { const c = await caches.open("hc"); const r = await c.match("/__queue_key"); return r ? (await r.text()).trim() : null; } catch (e) { return null; }
}

self.addEventListener("push", (e) => {
  e.waitUntil((async () => {
    let title = "New clips are ready", body = "Open your heistclips queue.";
    try {
      const k = await queueKey();
      if (k) {
        const d = await (await fetch("/api/queue?count=1&k=" + encodeURIComponent(k))).json();
        if (d.new) { title = `${d.new} new clip${d.new === 1 ? "" : "s"} ready`; body = `${(d.names || []).join(", ")}${d.paid ? ` · ${d.paid} with a paying campaign` : ""}`; }
        else if (d.open) body = `${d.open} clip${d.open === 1 ? "" : "s"} waiting in your queue.`;
      }
    } catch (err) {}
    await self.registration.showNotification(title, { body, icon: "/img/icon.svg", badge: "/img/icon.svg", tag: "hc-queue", renotify: true, data: { url: "/queue?from=push" } });
  })());
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) if (new URL(c.url).pathname === "/queue") { c.navigate("/queue?from=push"); return c.focus(); }
    return self.clients.openWindow("/queue?from=push");
  })());
});
