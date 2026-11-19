// Deutsch. Geschrieben, wie Clipper reden (du, Clips, Hook, Chat rastet aus), nicht wörtlich
// aus dem Englischen. Zahlen kommen immer aus dem Live-Snapshot, nie aus diesem Text.
const B = (s) => `<b>${s}</b>`;

export default {
  locale: "de-DE",
  updated: (when, min) => `Stand ${when} · ${min < 2 ? "gerade eben" : min < 90 ? `vor ${min} Min.` : `vor ${Math.round(min / 60)} Std.`} · wird alle 30 Minuten aktualisiert`,
  watching: (n) => `${n} schauen zu`,
  form: { ph: "Twitch- oder Kick-Kanal oder VOD-Link", go: "Momente finden" },
  // Feste Beschriftungen in den Kampagnenzeilen (die Zeilen selbst baut render.js auf Englisch).
  rows: [
    [/<span>typical per clip<\/span>/g, "<span>typisch pro Clip</span>"],
    [/<b class="big new">new<\/b><span>up to ([^<]+) a clip<\/span>/g, '<b class="big new">neu</b><span>bis $1 pro Clip</span>'],
    [/ \/ 1k views/g, " / 1.000 Views"], [/ per post/g, " pro Post"], [/ · cap /g, " · max. "], [/ left( \(| <b| ·)/g, " übrig$1"],
    [/\(~(\d+) days\)/g, "(~$1 Tage)"], [/\(~(\d+) h of budget at this pace\)/g, "(Budget reicht noch ~$1 Std.)"],
    [/ (\d[\d,.k]*) clippers/g, " $1 Clipper"], [/paid out /g, "ausgezahlt: "], [/<em>apply first<\/em>/g, "<em>erst bewerben</em>"], [/class="tag g">gaming</g, 'class="tag g">Gaming<'],
  ],

  home: {
    title: "GTA 6 Clipping-Tool – Moment finden, Clip schneiden, Geld verdienen | heistclips",
    desc: "Finde die Momente, bei denen der Chat in GTA-6-Streams ausrastet, schneide sie im Browser auf 9:16 mit Hook und sieh, welche Clipping-Kampagne gerade am meisten pro Clip zahlt.",
    h1: "Clippe GTA-VI-Streams, während sie live sind.",
    lede: "Gebaut für Gameplay, nicht für Podcasts. Kanal von Twitch oder Kick einfügen: heistclips liest den Chat mit, markiert die Sekunde, in der er ausrastet, und schneidet sie in deinem Browser auf 9:16 (Facecam über Gameplay), mit Hook.",
    small: (n, each) => `<b>${n} Clips gratis.</b> Danach ${each} pro Clip. Keine Abrechnung pro Minute. Kein Wasserzeichen. Kein KI-Tag in der Datei.`,
    liveH: "Gerade live in GTA",
    payH: "Zahlt gerade am meisten pro Clip",
    paySmall: (gta) => `Gaming- und Streamer-Kampagnen, sortiert danach, was ein typischer angenommener Clip wirklich verdient hat. Heute ${gta === 1 ? "läuft 1 GTA-Kampagne" : `laufen ${gta} GTA-Kampagnen`}.`,
    all: (n) => `Alle ${n} Kampagnen im Ranking →`,
    askH: "Fehlt dir was?",
    askP: "Schreib einen Feature-Wunsch. Wir bauen, was Clipper sich wünschen.",
    askLink: "Was gewünscht, in Arbeit und fertig ist →",
    three: [
      ["Der Chat findet den Moment", "Gaming-Momente sind visuell, ein Transkript verpasst sie. Der Chat nicht: Jeder Ausschlag ist ein Zeitstempel, samt den Zeilen, die der Chat getippt hat, damit du siehst, warum er gewählt wurde. Geht auch bei Streams, die noch laufen."],
      ["Dein Browser schneidet", "Facecam über Gameplay, unscharfer Rand oder mittiger Zuschnitt; 3–5 Hooks, damit jeder Post anders ist; Chat als Overlay. Gerendert auf deinem Rechner, ohne Wasserzeichen, sofort als Datei."],
      ["Musik wird markiert", "Das Radio im Spiel ist lizenzierte Musik. Hat Twitch die Stelle stummgeschaltet, sagen wir es dir, bevor du postest und die Auszahlung an einen Claim verlierst."],
    ],
  },

  clip: {
    title: "GTA 6 Clip-Maker – Momente aus dem Twitch-Chat, 9:16 im Browser schneiden | heistclips",
    desc: "Twitch-Kanal oder VOD einfügen. heistclips findet die Momente, bei denen der Chat ausgerastet ist, markiert lizenzierte Musik und schneidet 9:16-Clips mit Hook direkt in deinem Browser.",
    h1: "Momente finden. Clip schneiden.",
    hint: "Füg einen Twitch- oder Kick-Kanal ein (live oder nicht) oder einen VOD-Link. Gelesen wird der Chat, nicht das Video. Ein 7-Stunden-Stream dauert deshalb rund 20 Sekunden.",
  },

  pricing: {
    title: "Preise – du zahlst pro Clip, nie pro Stream-Minute | heistclips",
    desc: (n, packs) => `${n} GTA-6-Clips gratis, danach ${packs.map((p) => `${p.clips} für $${p.price}`).join(" oder ")}. Momente finden kostet nie etwas.`,
    h1: "Zahl pro Clip. Nie pro Minute.",
    lede: (n) => `${n} Clips gratis. Danach kaufst du ein Paket. Momente finden ist immer kostenlos.`,
    free: "Gratis", clips: (n) => `${n} Clips`, start: "Los clippen", each: (c) => `${c} pro Clip`, buy: (n) => `${n} Clips kaufen`,
    pay: "Bezahlt wird über Stripe: Karte, Apple Pay, Google Pay oder Link. Die Preise stehen hier in US-Dollar; Stripe zeigt dir den Betrag vor dem Zahlen in deiner Währung.",
    faqH: "Fragen",
    faq: [
      ["Warum pro Clip und nicht pro Minute?", "Clipper werden pro Clip bezahlt, der läuft. Tools, die pro Minute Material abrechnen, lassen dich für die sieben Stunden Stream zahlen, die du nie postest. Hier wird der Stream gratis gelesen; du zahlst nur für Clips, die du exportierst."],
      ["Was zählt als Clip?", "Ein exportiertes 9:16-Video. Vorschau, Momente finden und einen Stream nochmal lesen sind gratis. Denselben Moment mit anderem Hook neu rendern zählt als neuer Clip."],
      ["Verfallen Credits?", "Nein."],
      ["Wo entsteht das Video?", "In deinem eigenen Browser, auf deinem eigenen Rechner. Zu uns wird nichts hochgeladen."],
      ["Was steht auf meiner Abrechnung?", "BRICKANDMORTAR.DEV, die Firma hinter heistclips."],
    ],
  },

  requests: {
    title: "Feature-Wünsche – was Clipper als Nächstes wollen | heistclips",
    desc: "Stimm für Features ab oder wünsch dir neue für heistclips, das GTA-6-Clipping-Tool. Gewünscht, in Arbeit und fertig, alles öffentlich.",
    h1: "Was Clipper sich gewünscht haben",
    lede: "Stimm für das ab, was du als Nächstes willst, oder wünsch dir was Neues. Ohne Account, in jeder Sprache. Wir bauen, was Stimmen bekommt, und fertige Wünsche bleiben hier als Beleg stehen.",
    counts: (r, b, s) => `${r} gewünscht · ${b} in Arbeit · ${s} fertig`,
    ph: "Was soll heistclips können? z. B. „Facecam automatisch erkennen“", aria: "Dein Wunsch",
    more: "Details oder Kontakt hinzufügen (optional)", detailPh: "Was wolltest du gerade machen?", contactPh: "E-Mail oder @Handle, nur wenn du eine Antwort willst",
    btn: "Wünschen", upvote: "Dafür stimmen",
    note: "Einträge mit „Vorschlag von heistclips“ haben wir zum Start selbst eingetragen, nach dem, was Clipper auf Reddit schreiben. Jeder Zähler begann bei 0; nur echte Stimmen bewegen ihn, eine pro Browser.",
    status: { requested: "gewünscht", building: "in Arbeit", shipped: "fertig" },
    lead: { shipped: "Fertig", building: "In Arbeit", update: "Update" },
    byUs: "Vorschlag von heistclips", byClipper: "Wunsch eines Clippers",
    seeds: {
      "Clip streams while they're live": ["Streams clippen, während sie live sind", "Momente finden und schneiden, während der Stream noch läuft, nicht erst, wenn das VOD fertig ist."],
      "Facecam-over-gameplay vertical layout": ["Hochformat mit Facecam über Gameplay", "Das gestapelte Layout, das Gaming-Clips wirklich nutzen, als Standard statt mittigem Zuschnitt."],
      "No watermark, no per-minute billing": ["Kein Wasserzeichen, keine Abrechnung pro Minute", "Bezahlt wird pro exportiertem Clip; nie ein Wasserzeichen in der Datei."],
      "Warn me before a campaign's budget runs out": ["Warn mich, bevor das Budget einer Kampagne leer ist", "Hinweis, wenn eine Kampagne, für die ich clippe, nur noch Stunden statt Tage Budget hat."],
      "Mute or swap licensed in-game radio": ["Lizenziertes Radio im Spiel stummschalten oder ersetzen", "Damit Clips keinen Content-ID-Claim bekommen und auf TikTok nicht stummgeschaltet werden."],
      "Kick support": ["Kick-Unterstützung", "Momente aus Kick-Streams finden und schneiden, live oder gespeichert."],
      "Spoiler filter": ["Spoiler-Filter", "Momente mit Story-Spoilern überspringen, für Kampagnen, die sie verbieten."],
      "Strip \"AI-generated\" metadata on export": ["„KI-generiert“-Metadaten beim Export entfernen", "Exporte sollen nie als KI-gemacht markiert werden, wenn das Material es nicht ist."],
      "Track which hook variant won": ["Zeigen, welcher Hook gewonnen hat", "Sag mir, welcher Hook in der ersten Sekunde über alle meine Posts die meisten Views geholt hat."],
      "Earnings tracker across campaigns": ["Verdienst-Tracker über alle Kampagnen", "Meine $ pro Stunde über jede Kampagne, für die ich clippe."],
      "Posting-cadence guard for new accounts": ["Post-Limit-Warnung für neue Accounts", "Warn mich, bevor ich so viel poste, dass ein neuer Account einen Shadowban kassiert."],
      "Discord bot for my clipping team": ["Discord-Bot für mein Clipping-Team", "Neue Momente direkt in den Discord-Channel unseres Teams, sobald sie passieren."],
      "YouTube Live support": ["YouTube-Live-Unterstützung", "Dieselbe Momentsuche für Streams auf YouTube Live."],
    },
  },

  ranker: {
    title: (date) => `GTA 6 Clipping-Kampagnen nach Verdienst pro Clip (${date}) | heistclips`,
    desc: (n, gta, gaming) => `${n} laufende Clipping-Kampagnen, sortiert danach, was ein typischer angenommener Clip wirklich verdient. ${gta} GTA-, ${gaming} Gaming- und Streamer-Kampagnen. Alle 30 Minuten aktualisiert.`,
    h1: "GTA 6 Clipping-Kampagnen, sortiert nach dem, was ein Clip bringt",
    lede: (n, tracked, typ, p90, p10) => `${n} Kampagnen zahlen gerade Clipper. Bei den ${tracked} mit Vorgeschichte hat ein typischer angenommener Clip ${B(typ)} verdient; das beste Zehntel zahlt ${B(p90 + "+")}, das schlechteste unter ${B(p10)}. Gleiche Arbeit, völlig anderes Geld.`,
    tabGaming: "Gaming & Streamer", tabAll: "Alle",
    none: "In dieser Minute läuft hier keine Kampagne. Rund um den Launch gehen sie in Wellen auf; die Seite aktualisiert sich alle 30 Minuten.",
    showing: (n) => `Zu sehen sind die besten 150 von ${n}.`,
    methodH: "So entsteht das Ranking",
    method: [
      "<b>Typisch pro Clip</b> = das Geld, das eine Kampagne für angenommene Clips ausgezahlt hat, minus ihrer drei Top-Verdiener, geteilt durch den Rest der angenommenen Clips. Also das, was ein normaler Clip wirklich gebracht hat, nicht der beste.",
      "Der Wert wird gekürzt, wenn das Budget gleich leer ist: Ein Clip holt die meisten Views in den ersten drei Tagen, eine Kampagne mit einem Tag Restgeld zahlt also nur ein Drittel. Kampagnen ohne angenommene Clips stehen hinter den bewährten, sortiert nach dem Maximum pro Clip.",
      "Die Zahlen stammen aus dem öffentlichen Verzeichnis von Content Rewards und werden alle 30 Minuten aktualisiert. Jede Kampagne verlinkt auf ihre eigene Seite dort; da trittst du bei.",
    ],
  },

  rates: {
    title: (rate, typ) => `GTA 6 Clipping-Raten heute – ${rate} pro 1.000 Views im Median, ${typ} pro Clip | heistclips`,
    desc: (rate, cap, typ, gta) => `GTA 6 Clipping-Raten live: im Median ${rate} pro 1.000 Views, Deckel ${cap}, ein typischer Clip verdient ${typ}. ${gta} GTA-Kampagnen laufen. Alle 30 Minuten aktualisiert.`,
    h1: "GTA 6 Clipping-Raten heute",
    stat: ["verdient ein typischer angenommener Clip", "Median pro 1.000 Views", "Median-Deckel pro Clip", "GTA-Kampagnen laufen"],
    lede: (n, budget, p90, p10) => `${n} Kampagnen zahlen gerade Clipper, zusammen sind noch ${budget} Budget übrig. Das beste Zehntel zahlt ${p90}+ pro angenommenem Clip, das schlechteste unter ${p10}.`,
    gtaH: "GTA-Kampagnen",
    none: "Gerade läuft keine. Rund um den Launch gehen sie in Wellen auf.",
    all: "Alle Kampagnen im Ranking →",
    histH: (n) => `Die letzten ${n} Aktualisierungen`,
    th: ["UTC", "Kampagnen", "GTA", "Typisch/Clip", "Median-Rate", "Budget übrig"],
  },

  guides: {
    title: "GTA 6 Clipping-Guides | heistclips",
    desc: "Was GTA-6-Clipping zahlt, wie Musik-Claims laufen, Shorts-Geld gegen Kampagnen und wie du einen Stream schnell clippst.",
    h1: "Guides",
    pages: {
      "how-much-does-gta-6-clipping-pay": {
        name: "Wie viel zahlt GTA-6-Clipping?",
        title: () => "Wie viel zahlt GTA-6-Clipping? Live-Raten pro Clip | heistclips",
        desc: (n) => `Ein typischer angenommener Clip verdient ${n.typical}; Top-Kampagnen zahlen ${n.p90}+. Raten, Deckel und Budgets live, alle 30 Minuten aktualisiert.`,
        page: (n) => ({
          body: `<h1>Wie viel zahlt GTA-6-Clipping?</h1>
<p class="updated">Die Zahlen auf dieser Seite sind live, gelesen aus ${n.campaigns} Kampagnen, Stand ${n.when}.</p>
<p class="lede">Ein typischer angenommener Clip verdient <b>${n.typical}</b>. Das bestzahlende Zehntel der Kampagnen zahlt für denselben Clip <b>${n.p90}+</b>. Welche Kampagne du nimmst, zählt mehr als die Qualität des Clips.</p>
<h2>Die Formel</h2>
<p>Verdienst pro Clip = Views × Rate pro 1.000 Views, bis zum Deckel, solange Budget da ist.</p>
<ul class="facts">
<li>Median-Rate: <b>${n.rate}</b> pro 1.000 Views.</li>
<li>Median-Deckel: <b>${n.cap}</b> pro Clip, erreicht bei ${n.capViews} Views.</li>
<li>Median-Views pro angenommenem Clip: <b>${n.views}</b>.</li>
<li>Restbudget über alle Kampagnen: <b>${n.budget}</b>.</li>
</ul>
<h2>Warum die meisten Clips weniger bringen, als die Rate verspricht</h2>
<p>Drei Dinge fressen das Geld: ein Clip, der nie angenommen wird; ein Budget, das leer ist, bevor deine Views kommen; und eine Kampagne, die so voll ist, dass jeder Moment schon gepostet wurde. Das Ranking auf <a href="${n.ranker}">der Kampagnen-Seite</a> rechnet mit dem, was Clips wirklich verdient haben. Die drei stecken also schon in der Zahl.</p>
<h2>GTA-Kampagnen, die gerade laufen</h2>
${n.gtaRows()}`,
          faq: [
            ["Wie viel zahlt GTA-6-Clipping?", `Aktuell zahlt die Median-Kampagne ${n.rate} pro 1.000 Views bei einem Deckel von ${n.cap} pro Clip. Über ${n.tracked} Kampagnen mit Vorgeschichte hat ein typischer angenommener Clip ${n.typical} verdient; das beste Zehntel zahlt ${n.p90} oder mehr pro Clip.`],
            ["Wie wird der Verdienst berechnet?", `Views des Clips × Rate pro 1.000 Views, bis zum Deckel pro Clip, solange die Kampagne Budget hat. Bei ${n.rate} pro 1.000 Views braucht ein Clip ${n.capViews} Views für einen Deckel von ${n.cap}.`],
            ["Zählen alle Views?", "Nur Views auf Clips, die die Kampagne annimmt. Die meisten Kampagnen lehnen gebottete Views, Reposts und Clips ab, die gegen ihre Regeln verstoßen. Das Geld stoppt auch, wenn das Budget leer ist, selbst wenn dein Clip weiter Views holt."],
          ],
        }),
      },
      "gta-6-music-copyright-claims": {
        name: "GTA-6-Clips und Musik-Claims: Warum das Radio die Auszahlung killt",
        title: () => "GTA-6-Clips und Musik-Copyright-Claims – Finger weg vom Radio | heistclips",
        desc: () => "Das Radio im Spiel ist lizenzierte Musik. Wie Content ID und TikTok-Claims die Auszahlung killen und wie du einen riskanten Moment erkennst, bevor du postest.",
        page: (n) => ({
          body: `<h1>GTA-6-Clips und Musik-Claims</h1>
<p class="lede">Der schnellste Weg, die Auszahlung für einen Clip zu verlieren, ist ein Song im Autoradio. Check den Ton, bevor du postest.</p>
<h2>Warum das passiert</h2>
<p>Die Radiosender in GTA spielen echte, lizenzierte Songs. Ein Streamer, der mit laufendem Radio fährt, sendet diese Songs mit. Twitch schaltet sie im gespeicherten Stream stumm, wenn die Erkennung anschlägt, und YouTube und TikTok lassen bei jedem Upload ihre eigene Erkennung laufen.</p>
<h2>Was es dich kostet</h2>
<ul class="facts"><li>YouTube: Ein Content-ID-Claim kann das Geld des Clips ans Label leiten oder den Clip sperren.</li><li>TikTok: Der Ton kann stummgeschaltet werden, und ein Reaction-Clip ohne Ton ist tot.</li><li>Kampagnen: Viele lehnen Clips mit Claim oder ohne Ton ab, die Views werden dann nie bezahlt.</li></ul>
<h2>So markiert heistclips das</h2>
<p>Jeder gefundene Moment wird mit den Stellen abgeglichen, die Twitch in diesem Stream wegen Musik stummgeschaltet hat. Überschneidet er sich mit einer, steht dort <b>Musik-Risiko: hoch</b>. Redet der Chat über einen Song, steht dort <b>mittel</b>. Nimm Momente mit niedrigem Risiko oder schneide den Clip auf den Teil ohne Radio.</p>
<p><a class="btn" href="${n.clip}">Stream prüfen</a></p>`,
          faq: [
            ["Kann ich GTA-Radiomusik in Clips verwenden?", "Nicht sicher. Die Songs im Radio sind lizenzierte kommerzielle Musik. Twitch schaltet sie in gespeicherten Streams stumm, und YouTube Content ID und die Erkennung von TikTok können einen Clip damit claimen oder stummschalten."],
            ["Was passiert, wenn mein Clip einen Musik-Claim bekommt?", "Auf YouTube kann der Rechteinhaber die Einnahmen nehmen oder das Video sperren; auf TikTok kann der Ton stummgeschaltet werden. Viele Clipping-Kampagnen lehnen Clips mit Claim oder ohne Ton ab oder zahlen nicht weiter."],
            ["Woran erkenne ich, ob ein Moment lizenzierte Musik hat?", "heistclips prüft, ob Twitch diese Stelle im Stream stummgeschaltet hat. Twitch tut das, wenn die Erkennung lizenzierte Musik hört; eine stumme Stelle ist also eine deutliche Warnung. Markiert werden auch Momente, in denen der Chat über einen Song redet."],
          ],
        }),
      },
      "shorts-money-vs-clipping-campaigns": {
        name: "YouTube-Shorts-Geld gegen Clipping-Kampagnen",
        title: () => "YouTube-Shorts-Geld gegen Clipping-Kampagnen für GTA-6-Clips | heistclips",
        desc: (n) => `Shorts zahlt aus einem gemeinsamen Topf; Kampagnen zahlen eine feste Rate pro View (heute im Median ${n.rate} pro 1.000). Was für Clips aus GTA-6-Streams wirklich zahlt.`,
        page: (n) => ({
          body: `<h1>YouTube-Shorts-Geld gegen Clipping-Kampagnen</h1>
<p class="lede">Shorts zahlt aus einem gemeinsamen Topf. Eine Kampagne zahlt eine feste Rate pro View. Für einen Clip aus dem Stream von jemand anderem ist die Kampagne meistens das einzige Geld, das es gibt.</p>
<h2>So zahlt Shorts</h2>
<p>YouTube sammelt die Werbeeinnahmen aus dem Shorts-Feed, legt einen Teil für Musiklizenzen zur Seite und zahlt Creatorn im Partnerprogramm 45 % vom Rest, verteilt nach Views. Dafür musst du erst im Partnerprogramm sein, und ein Clip aus dem Stream eines anderen kann als wiederverwendeter Inhalt abgelehnt werden.</p>
<h2>So zahlen Kampagnen</h2>
<p>Ein Streamer oder eine Marke stellt ein Budget und zahlt eine feste Rate pro 1.000 Views auf angenommene Clips: ${n.rate} ist heute der Median, gedeckelt bei ${n.cap} pro Clip. Du brauchst keinen monetarisierten Kanal; du brauchst Views und einen angenommenen Clip.</p>
<h2>Was du tun solltest</h2>
<p>Poste den Clip dort, wo die Kampagne zahlt (die meisten zahlen auf TikTok, Shorts und Reels gleichzeitig), und reich ihn ein. Alles, was Shorts obendrauf legt, ist Bonus.</p>
<p><a class="btn" href="${n.ranker}">Was Kampagnen heute zahlen</a></p>`,
        }),
      },
      "how-to-clip-gta-6-streams": {
        name: "GTA-6-Streams clippen, und zwar schnell",
        title: () => "GTA-6-Streams schnell clippen – vom Live-Moment zum geposteten Clip | heistclips",
        desc: () => "Sechs Schritte vom laufenden GTA-6-Stream zum geposteten, bezahlten Clip: Kampagne wählen, Chat-Spike finden, Musik prüfen, 9:16 mit Hook schneiden, als Erster posten.",
        page: (n) => ({
          body: `<h1>GTA-6-Streams clippen, und zwar schnell</h1>
<p class="lede">In der Launch-Woche gewinnt der erste Clip eines Moments, nicht der beste. Das hier ist der kürzeste Weg vom Livestream zum geposteten Clip.</p>
<ol class="steps">
<li><b>Erst das Geld aussuchen</b><p>Öffne die Kampagnen-Seite und nimm eine Kampagne, die für den Streamer zahlt, den du clippen willst, mit Budget für mindestens drei weitere Tage.</p></li>
<li><b>Kanal einfügen</b><p>Füg den Twitch-Kanal des Streamers bei heistclips ein. Ist er live, wird der Chat mitgelesen, während er passiert; wenn nicht, wird der letzte Stream gelesen.</p></li>
<li><b>Den größten Ausschlag nehmen</b><p>Momente sind danach sortiert, wie viel schneller der Chat war als sonst, wie viele „clip it“ getippt haben und ob Zuschauer die Stelle schon auf Twitch geclippt haben.</p></li>
<li><b>Musik-Markierung checken</b><p>Lass Momente mit hohem Musik-Risiko aus oder schneide das Radio raus.</p></li>
<li><b>Mit Hook schneiden</b><p>Layout wählen, einen Hook für die erste Sekunde wählen oder selbst schreiben, rendern. Der Clip entsteht in deinem Browser und landet als Videodatei bei dir.</p></li>
<li><b>Posten und einreichen</b><p>Poste auf jeder Plattform, auf der die Kampagne zahlt, und reich die Links auf der Kampagnen-Seite ein. Sei schnell: Der erste Upload eines Moments holt die Views.</p></li>
</ol>
<p><a class="btn" href="${n.clip}">Clip-Tool öffnen</a></p>`,
        }),
      },
      "reused-content-shadowbans-posting-cadence": {
        name: "Wiederverwendete Inhalte, Shadowbans und wie oft du Clips posten solltest",
        title: () => "Wiederverwendete Inhalte, Shadowbans und Post-Rhythmus für Clip-Accounts | heistclips",
        desc: () => "Warum Clip-Kanäle wegen wiederverwendeter Inhalte demonetarisiert werden, wie viele Clips ein neuer Account vor dem Shadowban posten kann und wie jeder Upload anders wird.",
        page: (n) => ({
          body: `<h1>Wiederverwendete Inhalte, Shadowbans und wie oft du postest</h1>
<p class="lede">Clipping-Geld kommt von Kampagnen, nicht von der Plattform. Schütz den Account, der es verdient.</p>
<h2>Wiederverwendete Inhalte</h2>
<p>Das YouTube-Partnerprogramm kann einen Kanal ablehnen oder demonetarisieren, der nur Material von anderen neu hochlädt. Das betrifft den Werbeanteil von YouTube, nicht die Auszahlung einer Kampagne. Wenn du für Kampagnen clippst, ist die Kampagne das Einkommen; Shorts-Einnahmen sind Bonus.</p>
<h2>Shadowbans bei neuen Accounts</h2>
<p>Das Muster, von dem Clipper berichten: Ein neuer Account postet am ersten Tag 10 Clips, und die Views fallen auf null. Nutz den Account erst ein paar Tage ganz normal, poste dann drei bis fünf am Tag und steigere dich von dort.</p>
<h2>Mach jeden Post anders</h2>
<p>Plattformen erkennen identische Uploads. Ändere pro Post die erste Sekunde (den Hook), den Schnitt und das Layout. heistclips schreibt 3–5 Hooks pro Moment und rendert jeden als eigene Datei, ohne Wasserzeichen und ohne KI-Tag in der Datei.</p>
<p><a class="btn" href="${n.clip}">Moment schneiden</a></p>`,
          faq: [
            ["Warum hat YouTube meinen Clip-Kanal wegen wiederverwendeter Inhalte demonetarisiert?", "Das YouTube-Partnerprogramm zahlt nicht für Inhalte, die das Video von jemand anderem wiederholen, ohne etwas Eigenes hinzuzufügen. Ein Clip-Kanal, der nur Stream-Material neu hochlädt, kann nach dieser Regel abgelehnt oder demonetarisiert werden. Kampagnen-Auszahlungen laufen getrennt davon: Eine Kampagne zahlt pro View auf angenommene Clips, egal ob dein Kanal monetarisiert ist."],
            ["Wie viele Clips am Tag kann ich mit einem neuen Account posten?", "Clipper berichten von Shadowbans, wenn ein ganz neuer Account mehr als drei- bis fünfmal am Tag postet. Wärm den Account ein paar Tage mit normaler Nutzung auf, poste dann eine Handvoll am Tag und steigere langsam."],
            ["Fällt es auf, wenn ich denselben Clip auf mehreren Accounts poste?", "Identische Uploads sind für Plattformen leicht zu erkennen. Ändere jedes Mal etwas Echtes: den Hook in der ersten Sekunde, den Schnitt, das Layout. Deshalb gibt heistclips jedem Moment 3 bis 5 verschiedene Hooks."],
          ],
        }),
      },
    },
  },
};
