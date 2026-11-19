// heistclips service worker: only for "new clips are ready" notifications. A push arrives
// with no content; this asks the queue what is new and writes the notification from that.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

async function cached(path) {
  try { const c = await caches.open("hc"); const r = await c.match(path); return r ? (await r.text()).trim() : null; } catch (e) { return null; }
}
const queueKey = () => cached("/__queue_key");

// The notification's words. English is the default; the page that turned notifications on
// stores its language beside the queue key (public/js/queue.js).
const s = (n) => (n === 1 ? "" : "s");
const WORDS = {
  en: { title: "New clips are ready", open: "Open your heistclips queue.", fresh: (n) => `${n} new clip${s(n)} ready`, paid: (n) => `${n} with a paying campaign`, waiting: (n) => `${n} clip${s(n)} waiting in your queue.` },
  de: { title: "Neue Clips sind fertig", open: "Öffne deine heistclips-Warteschlange.", fresh: (n) => (n === 1 ? "1 neuer Clip fertig" : `${n} neue Clips fertig`), paid: (n) => `${n} mit einer Kampagne, die zahlt`, waiting: (n) => (n === 1 ? "1 Clip wartet in deiner Warteschlange." : `${n} Clips warten in deiner Warteschlange.`) },
  fr: { title: "De nouveaux clips sont prêts", open: "Ouvre ta file heistclips.", fresh: (n) => (n === 1 ? "1 nouveau clip prêt" : `${n} nouveaux clips prêts`), paid: (n) => `${n} avec une campagne qui paie`, waiting: (n) => (n === 1 ? "1 clip attend dans ta file." : `${n} clips attendent dans ta file.`) },
  pt: { title: "Tem clipe novo pronto", open: "Abra sua fila no heistclips.", fresh: (n) => (n === 1 ? "1 clipe novo pronto" : `${n} clipes novos prontos`), paid: (n) => `${n} com campanha pagando`, waiting: (n) => (n === 1 ? "1 clipe esperando na sua fila." : `${n} clipes esperando na sua fila.`) },
  es: { title: "Hay clips nuevos listos", open: "Abre tu cola de heistclips.", fresh: (n) => (n === 1 ? "1 clip nuevo listo" : `${n} clips nuevos listos`), paid: (n) => `${n} con una campaña que paga`, waiting: (n) => (n === 1 ? "1 clip espera en tu cola." : `${n} clips esperan en tu cola.`) },
};

self.addEventListener("push", (e) => {
  e.waitUntil((async () => {
    const lang = await cached("/__queue_lang"), T = WORDS[lang] || WORDS.en;
    const url = (WORDS[lang] && lang !== "en" ? "/" + lang : "") + "/queue?from=push";
    let title = T.title, body = T.open;
    try {
      const k = await queueKey();
      if (k) {
        const d = await (await fetch("/api/queue?count=1&k=" + encodeURIComponent(k))).json();
        if (d.new) { title = T.fresh(d.new); body = `${(d.names || []).join(", ")}${d.paid ? " · " + T.paid(d.paid) : ""}`; }
        else if (d.open) body = T.waiting(d.open);
      }
    } catch (err) {}
    await self.registration.showNotification(title, { body, icon: "/img/icon.svg", badge: "/img/icon.svg", tag: "hc-queue", renotify: true, data: { url } });
  })());
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const url = (e.notification.data && e.notification.data.url) || "/queue?from=push";
    for (const c of all) if (/^\/(?:(?:de|fr|pt|es)\/)?queue$/.test(new URL(c.url).pathname)) { c.navigate(url); return c.focus(); }
    return self.clients.openWindow(url);
  })());
});
