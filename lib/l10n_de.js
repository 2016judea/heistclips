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
    [/>(<span class="pulse"><\/span>|▶ )Clip (.+?)’s stream now<\/a>/g, ">$1Stream von $2 jetzt clippen</a>"],
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
    trend: "Was Clipper gerade schneiden →",
    post: { h: "Direkt auf YouTube posten", p: `Verbinde einmal deinen YouTube-Kanal. Danach postest du den Clip als Short mit deiner Caption, aus dem Clip-Tool oder aus Claude. <a href="/post">YouTube verbinden →</a> Das Posten nutzt die YouTube API Services; mehr dazu auf unserer Seite zum <a href="/privacy">Datenschutz</a>.` },
    three: [
      ["Der Chat findet den Moment", "Gaming-Momente sind visuell, ein Transkript verpasst sie. Der Chat nicht: Jeder Ausschlag ist ein Zeitstempel, samt den Zeilen, die der Chat getippt hat, damit du siehst, warum er gewählt wurde. Geht auch bei Streams, die noch laufen."],
      ["Dein Browser schneidet", "Facecam über Gameplay, unscharfer Rand oder mittiger Zuschnitt; 3–5 Hooks, damit jeder Post anders ist; Chat als Overlay. Gerendert auf deinem Rechner, ohne Wasserzeichen, sofort als Datei."],
      ["Musik wird markiert", "Das Radio im Spiel ist lizenzierte Musik. Hat Twitch die Stelle stummgeschaltet, sagen wir es dir, bevor du postest und die Auszahlung an einen Claim verlierst."],
    ],
  },

  clip: {
    title: "GTA 6 Clip-Maker – Momente aus dem Twitch- oder Kick-Chat, 9:16 im Browser schneiden | heistclips",
    desc: "Twitch- oder Kick-Kanal oder VOD einfügen. heistclips findet die Momente, bei denen der Chat ausgerastet ist, markiert lizenzierte Musik und schneidet 9:16-Clips mit Hook direkt in deinem Browser.",
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
      ["Wo entsteht das Video?", "Am Computer in deinem eigenen Browser. Am Handy, in Safari oder wenn Claude oder ChatGPT schneidet, schneidet unser Server direkt aus dem Stream. Eine eigene Videodatei, etwa eine YouTube-Kopie, verlässt nie dein Gerät."],
      ["Was steht auf meiner Abrechnung?", "BRICKANDMO* HEISTCLIPS. Brick & Mortar ist die Firma hinter heistclips; auf der Bezahlseite steht heistclips."],
    ],
  },

  requests: {
    kindFeature: "Feature wünschen", kindBug: "Bug melden", bugPh: "Was ist schiefgelaufen? z. B. „Das MP4 hat keinen Ton“", bugAria: "Was ist schiefgelaufen", bugStreamPh: "Stream-Link oder Streamer-Name (optional)", bugWhatPh: "Was ist passiert? Was hast du geklickt, und was hat heistclips gemacht?", bugExpectPh: "Was hättest du stattdessen erwartet? (optional)", bugBtn: "Melden", bugOk: "Gemeldet. Es steht auf dem Board, und der Entwickler hat es.", bugTag: "Bug", filterAll: "Alle", filterFeatures: "Features", filterBugs: "Bugs", moreBug: "Kontakt hinzufügen (optional)",
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

  // Twitch/Kick clip maker and "most clipped right now" (lib/searchpages.js; English in lib/search_words.js).
  search: {
    box: { ph: (p) => `${p}-Kanal oder VOD-Link`, go: "Momente finden", fine: "Ohne Account. Ohne Wasserzeichen. Dein Browser schneidet den Clip.", hot: "Wird gerade geclippt" },
    clips: (n) => `${n} Clip${n === 1 ? "" : "s"}`,
    maker: {
      twitch: {
        title: "Twitch Clip Maker: 9:16-Clips mit Hook, ohne Wasserzeichen | heistclips",
        desc: (free, each) => `Twitch-Kanal oder VOD einfügen. heistclips findet die Momente, in denen der Chat ausrastet, und schneidet sie im Browser auf 9:16 mit Hook. ${free} Clips gratis, danach ab ${each} pro Clip. Kein Wasserzeichen.`,
        h1: "Twitch Clip Maker",
        lede: "Füge einen Twitch-Kanal ein. Wir finden die Momente, in denen der Chat ausrastet. Du bekommst 9:16-Clips mit Hook, fertig für TikTok, Shorts und Reels.",
        speed: "Ein 7-Stunden-Stream ist in etwa 20 Sekunden gelesen.",
      },
      kick: {
        title: "Kick Clip Maker: 9:16-Clips mit Hook, ohne Wasserzeichen | heistclips",
        desc: (free, each) => `Kick-Kanal oder Video einfügen. heistclips findet die Momente, in denen der Chat ausrastet, und schneidet sie im Browser auf 9:16 mit Hook. ${free} Clips gratis, danach ab ${each} pro Clip. Kein Wasserzeichen.`,
        h1: "Kick Clip Maker",
        lede: "Füge einen Kick-Kanal ein. Wir finden die Momente, in denen der Chat ausrastet. Du bekommst 9:16-Clips mit Hook, fertig für TikTok, Shorts und Reels.",
        speed: "Kick begrenzt, wie schnell der Chat gelesen werden kann. Ein Stream dauert darum 1 bis 2 Minuten.",
      },
      howH: "So geht es",
      how: (p) => [`Füge einen ${p}-Kanal oder den Link zu einem alten Stream ein. Er darf gerade live sein.`, "Such dir einen Moment aus. Bei jedem siehst du, was der Chat geschrieben hat.", "Schneide ihn. Dein Browser baut ein MP4 in 1080 × 1920 und speichert es."],
      getH: "Das bekommst du",
      get: ["9:16-Video mit der Facecam über oder unter dem Gameplay.", "3 bis 5 Hooks pro Moment, damit jeder Post anders ist.", "Kein Wasserzeichen. Kein KI-Tag in der Datei.", "Eine Warnung, wenn die Musik an der Stelle deinem Clip einen Claim einbringen kann."],
      costH: "Das kostet es",
      cost: (free, packs) => `${free} Clips sind gratis. Danach ${packs}. Du zahlst pro gespeichertem Clip. Du zahlst nie für Stream-Minuten. Momente finden ist immer gratis.`,
      pack: (n, price) => `${n} Clips für ${price}`, or: " oder ",
      other: (p) => `Du clippst auch ${p}? Nimm den ${p} Clip Maker.`,
      hotMore: "Alles sehen, was gerade geclippt wird",
      faqH: "Fragen",
      faq: (p, other, free) => [
        [`Geht der ${p} Clip Maker auch bei Livestreams?`, "Ja. Füge den Kanal ein, während er live ist. Neue Momente kommen, sobald der Chat reagiert, etwa eine Minute hinter dem Stream."],
        ["Gibt es ein Wasserzeichen?", "Nein. Die Datei hat kein Wasserzeichen und kein KI-Tag."],
        ["Brauche ich einen Account?", `Nein. Kanal einfügen und loslegen. Die ersten ${free} Clips sind gratis.`],
        [`Geht das auch mit ${other}?`, `Ja. Füge einen ${other}-Kanal in dasselbe Feld ein.`],
        ["Ist das nur für GTA?", "Nein. Es geht bei jedem Stream mit aktivem Chat: jedes Spiel, IRL oder Just Chatting."],
      ],
    },
    trend: {
      title: (date) => `Die meistgeclippten Streams gerade (${date}) | heistclips`,
      desc: (n, days) => `Die Twitch- und Kick-Streams und Momente, die Clipper in den letzten ${days} Tagen auf heistclips am meisten geschnitten haben: ${n} Clips gezählt. Stündlich aktualisiert.`,
      h1: "Was Clipper gerade schneiden",
      lede: (n, days) => `${n} Clips wurden in den letzten ${days} Tagen auf heistclips gemacht. Das sind die Streams und Momente dazu. Tippe einen an, um ihn im Clip-Tool zu öffnen.`,
      updated: (when) => `Stand ${when} UTC · wird jede Stunde aktualisiert`,
      streamsH: "Meistgeclippte Streams",
      momentsH: "Meistgeclippte Momente",
      today: (n) => `${n} heute`,
      at: (name, clock) => `${name} bei ${clock}`,
      none: "Noch zu wenige Clips für eine Rangliste. Schau in einer Stunde wieder rein.",
      howH: "So zählen wir",
      how: (s, m) => ["Ein auf heistclips gespeicherter Clip zählt einmal. Wir speichern den Stream und den Moment. Wir speichern nie, wer den Clip gemacht hat.", `Ein Stream erscheint ab ${s} Clips. Ein Moment ab ${m}. Hier ist nichts erfunden oder aufgefüllt.`, "Dieselben Zahlen gibt es frei als Daten."],
      data: "Als JSON laden",
    },
  },

  // Regel-Chips an Kampagnen (lib/campaigns.js liest sie auf Englisch aus dem Briefing).
  req: { "apply first": "erst bewerben", "US audience": "US-Publikum", "Tier 1 audience": "Tier-1-Publikum", English: "Englisch", "no watermark": "kein Wasserzeichen", "length rule": "Längen-Regel", "spoiler rule": "Spoiler-Regel", "audio rule": "Audio-Regel", "tags/caption rule": "Tag-/Caption-Regel" },

  campaign: {
    crumb: "Kampagnen", other: "Kampagne", newB: "neu", none: "keiner",
    meta: (owner, rank, n) => `von ${owner} · Platz ${rank} von ${n} nach Verdienst pro Clip`,
    typical: "typisch pro angenommenem Clip", noneYet: "noch keine angenommenen Clips",
    perPost: "pro Post", per1k: "pro 1.000 Views",
    max: (views) => `max. pro Clip${views ? ` (erreicht bei ${views} Views)` : ""}`,
    left: (total) => `übrig von ${total}`, hours: (n) => `, reicht bei dem Tempo noch ~${n} Std.`, days: (n) => `, reicht bei dem Tempo noch ~${n} Tage`,
    paid: "bisher wirklich an Clipper ausgezahlt",
    watch: "Achte auf:", fromBrief: "(aus dem Briefing unten gelesen)",
    join: "Bei Content Rewards beitreten", cut: "Clips dafür schneiden",
    earnedH: "Was Clips hier verdient haben",
    facts: (n) => [
      `${n.clips} angenommene Clips von ${n.clippers} Clippern, zusammen ${n.views} Views${n.perClip ? ` (im Schnitt ${n.perClip} pro Clip)` : ""}.`,
      `${n.spent} vom Budget sind schon verdient${n.avg ? `: im Schnitt ${n.avg} pro angenommenem Clip, ${n.earned ? `${n.earned}, wenn man die drei Top-Verdiener rausnimmt` : "zu wenige Clips, um die Top-Verdiener rauszurechnen"}` : ""}.`,
      `Letzte 7 Tage: ${n.clips7} Clips angenommen, ${n.views7} Views. Bester Clip: ${n.top} Views.`,
      (n.apply ? "Du musst dich bewerben, bevor du einreichen kannst." : "Offen: keine Bewerbung nötig.") + (n.geo ? " Die Raten hängen vom Land der Zuschauer ab." : ""),
    ],
    rateH: "Rate pro Plattform", th: ["Plattform", "Pro 1.000 Views", "Max. pro Clip", "Mindestauszahlung"],
    briefH: "Das Briefing", briefNote: "Von der Kampagnen-Seite bei Content Rewards. Lies dort die kompletten Regeln, bevor du postest.",
    title: (t, rate, typ) => `${t} – ${rate ? rate + "/1.000 Views" : "Clipping-Kampagne"}${typ ? `, ~${typ} pro Clip` : ""} | heistclips`,
    desc: (c) => `${c.title} von ${c.owner}: ${c.rate ? c.rate + " pro 1.000 Views" : ""}${c.cap ? `, max. ${c.cap} pro Clip` : ""}, ${c.left} Budget übrig, ${c.clippers} Clipper. Was ein typischer Clip verdient hat, alle 30 Minuten aktualisiert.`,
  },

  ended: {
    crumb: "Beendet", h1: "Diese Kampagne ist beendet",
    endedOn: (when) => (when ? `Beendet am ${when}.` : "Beendet."), by: (owner) => `von ${owner}`, closed: "Diese Kampagne nimmt keine Clips mehr an.",
    typical: "hat ein typischer angenommener Clip verdient",
    earnedOf: (total) => `von Clippern verdient, bei ${total} Budget`,
    approvedFrom: (clippers) => `angenommene Clips von ${clippers} Clippern`,
    final: (date) => `Endstand, zuletzt gelesen am ${date}.`, whyBudget: "Das Budget war aufgebraucht.", whyGone: "Sie steht nicht mehr im öffentlichen Kampagnen-Verzeichnis.",
    noNumbers: "Die Zahlen dieser Kampagne haben wir nicht mehr.",
    payingH: "Kampagnen, die gerade zahlen",
    best: (gta) => `Die bestzahlenden laufenden${gta ? " für GTA-Clips" : ""}, sortiert danach, was ein typischer angenommener Clip verdient.`,
    all: (n) => `Alle ${n} laufenden Kampagnen im Ranking →`,
    title: (t, when) => `${t} (beendet${when ? " am " + when : ""}): was sie gezahlt hat und was jetzt zahlt | heistclips`,
    desc: (c) => `${c.title} von ${c.owner} ist${c.when ? " seit dem " + c.when : ""} beendet. Gezahlt wurden ${c.rate ? c.rate + " pro 1.000 Views" : "feste Beträge pro Post"}${c.earned ? `, ein typischer Clip hat ${c.earned} verdient` : ""}. Sieh dir stattdessen die bestzahlenden laufenden Kampagnen an.`,
    descNone: "Diese Clipping-Kampagne ist beendet. Sieh dir stattdessen die bestzahlenden laufenden Kampagnen an.",
  },

  streamers: {
    title: "GTA-Streamer zum Clippen – live und zuletzt live | heistclips",
    desc: "Alle GTA-Streamer, die gerade oder vor Kurzem auf Twitch oder Kick live waren, mit den Momenten, bei denen der Chat im letzten Stream ausgerastet ist. Fertig zum Clippen.",
    h1: "GTA-Streamer, die sich zu clippen lohnen",
    lede: "Alle, die wir auf Twitch und Kick GTA streamen gesehen haben, wer live ist zuerst. Jede Seite findet die Momente, bei denen der Chat im letzten Stream ausgerastet ist.",
    liveH: "Jetzt live", recentH: "Zuletzt live", nobody: "Gerade ist niemand live.", paidH: "Dafür zahlen Kampagnen", paid: (n) => (n === 1 ? "1 Kampagne zahlt" : `${n} Kampagnen zahlen`),
    live: (n) => `live · ${n} schauen zu`, peak: (n) => `Spitze: ${n} Zuschauer`,
  },

  streamer: {
    crumb: "Streamer", offline: "Gerade offline", h: "Std.", recording: "läuft gerade", untitled: "Stream ohne Titel", recentH: "Letzte Streams",
    title: (name, kick) => `${name}${kick ? " auf Kick" : ""} clippen: Momente finden, 9:16 schneiden, sehen, wer zahlt | heistclips`,
    desc: (name, p, n) => `Clippe die ${p}-Streams von ${name}: Finde die Momente, bei denen der Chat ausgerastet ist, schneide sie auf 9:16 mit Hook und sieh, ${n ? (n === 1 ? `welche Kampagne gerade für Clips von ${name} zahlt` : `welche ${n} Kampagnen gerade für Clips von ${name} zahlen`) : "welche Kampagnen für die Clips zahlen"}.`,
    h1: (name, kick) => `So clippst du ${name}${kick ? " auf Kick" : ""}`,
    lede: (name, live) => `Der Kanal von ${name} steht schon im Feld. Tipp auf den Button. Wir finden die Momente, bei denen der Chat ausgerastet ist, ${live ? "im Stream, der gerade läuft" : "im letzten Stream"}.`,
    button: (name) => `Momente von ${name} finden`,
    whatH: (name) => `Was ${name} streamt`,
    liveIn: "Gerade live in", lastIn: "Zuletzt gesehen in", noStream: "Kein aktueller Stream bekannt.", titleLine: "Titel des Streams:",
    peak: (n) => `Meiste Zuschauer, die wir gesehen haben: ${n}.`,
    payH: (name) => `Zahlt eine Kampagne für Clips von ${name}?`,
    payYes: (n, name) => `Ja. Gerade ${n === 1 ? "zahlt 1 Kampagne" : `zahlen ${n} Kampagnen`} für Clips von ${name}.`,
    payBest: (amount) => `Bei der besten verdient ein typischer angenommener Clip ${amount}.`,
    payNoNumber: "Noch hat keine für genug Clips ausgezahlt, um eine typische Zahl zu zeigen.",
    payNo: (name) => `Gerade nennt keine Kampagne ${name}. Posten kannst du die Clips trotzdem. Oder du nimmst eine Kampagne, die jeden Gaming-Clip annimmt:`,
    momentsH: (name) => `Momente von ${name}, die Clipper gerade schneiden`,
    into: (clock) => `bei ${clock} im Stream`,
    madeFrom: (clips, name, days) => `${clips} aus den Streams von ${name} in den letzten ${days} Tagen auf heistclips.`,
    fine: (name) => `Kein Bezug zu ${name}. Lies die Regeln einer Kampagne, bevor du Material eines Streamers postest.`,
    faq: (n) => [
      [`Wie clippe ich ${n.name}?`, `Öffne ${n.url}, tipp auf „Momente von ${n.name} finden“, such dir einen Moment aus, auf den der Chat reagiert hat, und speichere ihn als 9:16-Clip mit Hook. Die ersten ${n.free} Clips sind gratis.`],
      [`Zahlt jemand für Clips von ${n.name}?`, n.n ? `Ja. Am ${n.date} ${n.n === 1 ? "nennt 1 laufende Kampagne" : `nennen ${n.n} laufende Kampagnen`} ${n.name}${n.best ? `, und bei der besten verdient ein typischer angenommener Clip ${n.best}` : ""}.` : `Am ${n.date} nennt keine laufende Kampagne ${n.name}. Kampagnen, die jeden Gaming-Clip annehmen, stehen auf der Seite.`],
    ],
  },

  data: {
    title: (date) => `Was Clipping-Kampagnen zahlen: kostenlose Daten als CSV und JSON (${date}) | heistclips`,
    desc: (n) => `Lade herunter, was ${n} laufende Clipping-Kampagnen zahlen: Rate pro 1.000 Views, Maximum pro Clip, Restbudget und was ein typischer Clip verdient. CSV und JSON, alle 30 Minuten aktualisiert, frei zitierbar.`,
    h1: "Clipping-Zahlen, die du zitieren darfst",
    updated: (when) => `Stand ${when} · wird alle 30 Minuten aktualisiert`,
    lede: (n) => `Was ${n} laufende Clipping-Kampagnen zahlen, in einer Datei. Kostenlos nutzbar. Bitte verlinke uns.`,
    stat: (n) => [`verdient ein typischer angenommener Clip (Median aus ${n} Kampagnen)`, "Median pro 1.000 Views", "pro Clip im besten Zehntel der Kampagnen", "Budget, das über alle Kampagnen noch offen ist"],
    filesH: "Dateien",
    files: (n, t) => [
      ["Kampagnen-Raten, CSV", `${n} Zeilen · eine pro laufender Kampagne · öffnet sich in jeder Tabellen-App`],
      ["Kampagnen-Raten, JSON", "Dieselben Zeilen, mit Feld-Erklärungen und den Gesamtzahlen"],
      ["Meistgeclippte Streams, JSON", `${t ? `${t.n} Clips in ${t.days} Tagen gezählt` : "Stündlich aktualisiert"} · Streams und Momente`],
    ],
    licH: "Lizenz",
    licence: "MIT (https://opensource.org/licenses/MIT). Frei nutzbar und zitierbar. Bitte nenne heistclips.com als Quelle und verlinke die Seite, von der die Zahl stammt.",
    note: "Die Zahlen sind Fakten von den öffentlichen Kampagnen-Seiten bei Content Rewards. Jede Zeile verlinkt auf ihre Quelle. Eine Zahl kann bei aktiven Kampagnen bis zu 30 Minuten alt sein, bei ruhigen etwa 15 Stunden. Die Dateien selbst sind auf Englisch.",
    fieldsH: "Was jedes Feld bedeutet", th: ["Feld", "Bedeutung"],
    fields: {
      rank: "Platz, wenn laufende Kampagnen nach expected_per_clip sortiert sind (1 = zahlt am meisten pro Clip).",
      title: "Titel der Kampagne, so wie ihr Besitzer ihn geschrieben hat.",
      owner: "Wer die Kampagne betreibt.",
      category: "gta, gaming oder other, abgeleitet aus Titel, Briefing und Kategorien der Kampagne.",
      platforms: "Wo Clips gepostet werden dürfen, getrennt durch |.",
      rate_per_1k_usd: "Dollar pro 1.000 Views. Leer bei Kampagnen, die pro Post zahlen.",
      per_post_usd: "Dollar pro Post, bei Kampagnen, die pro Post zahlen.",
      cap_per_clip_usd: "Das Meiste, was ein Clip verdienen kann. Leer = kein Maximum genannt.",
      expected_per_clip_usd: "Was ein typischer angenommener Clip verdient hat: ausgezahltes Geld minus der drei Top-Verdiener, geteilt durch die übrigen angenommenen Clips, gekürzt, wenn das Budget in 3 Tagen leer ist. Leer = noch weniger als 5 solche Clips.",
      avg_per_clip_usd: "Ausgegebenes Budget geteilt durch angenommene Clips, Top-Verdiener eingerechnet.",
      budget_left_usd: "Budget, das noch nicht verdient wurde.",
      budget_total_usd: "Das ganze Budget.",
      days_of_budget_left: "Restbudget geteilt durch die bisherigen Ausgaben pro Tag.",
      clippers: "Leute, die der Kampagne beigetreten sind.",
      approved_clips: "Clips, die die Kampagne angenommen hat.",
      apply_first: "true, wenn du dich bewerben musst, bevor du einreichen kannst.",
      min_views_per_clip: "Die wenigsten Views, die ein Clip braucht, bevor er überhaupt etwas verdient, auf der einfachsten Plattform der Kampagne: Mindestauszahlung geteilt durch die Rate ($10 bei $1 pro 1.000 Views = 10.000) oder die eigene Mindestzahl der Kampagne, je nachdem, was höher ist. Leer = noch nicht gelesen.",
      pool_total_views: "Nur Pools: so viele Views müssen deine Clips zusammen holen, bevor du überhaupt einen Anteil am Pool bekommst. Leer = kein Pool oder noch nicht gelesen.",
      floor_known: "true, wenn die Untergrenzen aus den Einstellungen der Kampagne gelesen wurden. false = unbekannt: Lies das Briefing, bevor du mit Geld rechnest.",
      likely_new_account_usd: "Was ein typischer Clip einem neuen Account (etwa 500 Views pro Clip) nach der Untergrenze bringt. 0 = zahlt bei dieser Größe nichts. Leer = Untergrenze unbekannt oder ein Pool ohne Views, der sich noch nicht beziffern lässt.",
      likely_5k_usd: "Dasselbe für einen Account mit etwa 5.000 Views pro Clip.",
      likely_50k_usd: "Dasselbe für einen Account mit etwa 50.000 Views pro Clip.",
      page: "Die Seite der Kampagne auf heistclips.",
      source: "Die eigene Seite der Kampagne bei Content Rewards, von der jede Zahl stammt.",
    },
    aiH: "Für KI-Assistenten",
    ai: `Als reiner Text (auf Englisch): <a href="/llms.txt">llms.txt</a> und <a href="/llms-full.txt">llms-full.txt</a>. Live-Antworten: der <a href="/connect">heistclips-Connector</a> für ChatGPT, Claude und Grok.`,
  },

  queue: {
    title: "Clip-Autopilot – eine Warteschlange fertiger GTA-6-Clips, passend zur Kampagne, die zahlt | heistclips",
    desc: "Wähl die Streamer, die du clippst. heistclips beobachtet ihre Streams auf Twitch und Kick, findet die Momente, bei denen der Chat ausrastet, ordnet jedem die bestzahlende passende Kampagne zu und füllt eine Warteschlange mit Clips, die du nur noch posten musst.",
    h1: "Wach auf, und die Clips sind da.",
    lede: "Wähl die Streamer, die du clippst. heistclips beobachtet ihre Streams, findet die Momente, bei denen der Chat ausrastet, und stellt zu jedem die Kampagne, die am meisten dafür zahlt.",
    addH: "Noch einen Streamer beobachten",
    ph: "Twitch- oder Kick-Kanal", aria: "Twitch- oder Kick-Kanal zum Beobachten", go: "Beobachten",
    payH: "Zahlt gerade", paySmall: "Streamer, für deren Clips eine laufende Kampagne zahlt, die beste zuerst. Weniger Clipper heißt weniger Konkurrenz.",
    foot: (free) => `Clips finden ist gratis. Ein Clip aus der Warteschlange kostet erst dann einen Clip, wenn du ihn exportierst: ${free} gratis, danach <a href="/pricing">Pakete</a>. Streams werden alle 10 Minuten neu gelesen.`,
    noscript: "Die Warteschlange braucht JavaScript.",
  },

  post: {
    title: "Clips auf YouTube und TikTok posten | heistclips",
    desc: "Verbinde einmal YouTube oder TikTok und poste dann einen 9:16-Clip mit Caption direkt aus heistclips oder aus Claude.",
    h1: "Clips auf YouTube und TikTok posten",
    lede: "Einmal verbinden. Danach postest du einen Clip mit Caption aus dem Clip-Tool oder sagst es einfach Claude: „Schneid den Moment und poste ihn auf YouTube“.",
    loading: "Lädt…", connect: (p) => `${p} verbinden`, disconnect: "Trennen",
    closed: (p) => `Noch nicht offen: Wir warten auf die Entwickler-Freigabe von ${p}.`,
    how: {
      youtube: "Google prüft heistclips noch. Beim Verbinden erscheint deshalb die Warnung „Google hat diese App nicht überprüft“. Verbinden kannst du trotzdem: Klick auf „Erweitert“ und dann auf „heistclips.com öffnen“. Wir fragen nur nach der Erlaubnis zum Hochladen. Bis die Prüfung durch ist, kommen Posts als privat an: Öffne YouTube Studio und veröffentliche sie dort.",
      tiktok: "Postet auf dein Profil oder als Entwurf in deinen TikTok-Posteingang. Bis TikTok seine Prüfung abgeschlossen hat, kommen Posts als privat an.",
    },
    howH: "So funktioniert es",
    facts: [
      `heistclips fragt nur nach der Erlaubnis, <b>Videos hochzuladen</b> (TikTok teilt außerdem deinen Anzeigenamen). Es kann weder deine Videos noch deine Nachrichten noch sonst etwas lesen. <a href="/privacy">Datenschutz</a>.`,
      `Trennen kannst du jederzeit hier, bei <a href="https://myaccount.google.com/permissions" rel="noopener">Google</a> oder bei TikTok unter „App-Berechtigungen verwalten“.`,
      "Die Gratis-Clips und Pakete dieses Browsers gelten auch für den Connector, sobald diese Seite einmal über seinen Link geöffnet wurde.",
    ],
  },

  about: {
    title: "Über heistclips",
    desc: "Wer heistclips macht, woher die Kampagnen- und Stream-Daten kommen und wie es sich finanziert.",
    body: (n) => `<h1>Über heistclips</h1>
<p>heistclips ist ein Clipping-Tool für Leute, die aus den Streams anderer Shorts, TikToks und Reels schneiden und damit Geld verdienen. Es macht drei Dinge: Es findet die Momente eines Streams, auf die der Chat reagiert hat, schneidet sie in deinem Browser zu Hochkant-Clips und sagt dir, welche Kampagne am meisten dafür zahlt.</p>
<p>Es ist Open Source (MIT): <a href="https://github.com/2016judea/heistclips">github.com/2016judea/heistclips</a>. Dieselbe Technik läuft lokal als Kommandozeilen-Tool und als MCP-Server für KI-Assistenten.</p>
<h2>Woher die Zahlen kommen</h2>
<p>Die Kampagnenzahlen werden alle 30 Minuten aus dem öffentlichen Kampagnen-Verzeichnis von Content Rewards gelesen, mit Link zu jeder Kampagne. Stream- und Chat-Daten kommen von den öffentlichen Seiten von Twitch und Kick und werden anonym gelesen. Nichts ist gekauft, hinter einem Login abgegriffen oder erfunden.</p>
<h2>Wer dahintersteht</h2>
<p>heistclips wird von Brick &amp; Mortar in Saint Paul, Minnesota gemacht. Kartenzahlungen laufen über Stripe und erscheinen als BRICKANDMO* HEISTCLIPS. Support: aidan@brickandmortar.dev.</p>
<p class="small">Kein Bezug zu Take-Two Interactive, zu den Machern von GTA, zu Twitch, Kick oder Content Rewards.</p>`,
  },

  privacy: {
    title: "Datenschutz | heistclips",
    desc: "Was heistclips erfasst (sehr wenig) und warum.",
    body: (n) => `<h1>Datenschutz</h1>
<p>heistclips erfasst so wenig wie möglich.</p>
<p class="small">Das ist eine Übersetzung. Weichen die Fassungen voneinander ab, gilt die <a href="${n.site}/privacy?lang=en">englische Fassung</a>.</p>
<ul class="facts">
<li><b>Clips, die du auf der Seite renderst, bleiben bei dir.</b> Sie werden in deinem Browser aus dem öffentlichen Video des Streams geschnitten. Wir erhalten sie nur, wenn du auf einen Posten-Button drückst. Dann wird genau dieser eine Clip hochgeladen, damit er an die Plattform geschickt werden kann, die du gewählt hast.</li>
<li><b>Clips, die für dich geschnitten oder gepostet werden.</b> Ein Clip, der über das Connector-Tool cut_clip geschnitten oder zum Posten hochgeladen wird, liegt bis zu 72 Stunden unter einem zufälligen Link und wird dann gelöscht.</li>
<li><b>Posten auf YouTube und TikTok.</b> Wenn du ein Konto verbindest, speichern wir die Zugriffstoken, die die Plattform ausstellt, verschlüsselt und nutzen sie nur, um die Clips hochzuladen, die du posten lässt. Bei YouTube fragen wir allein die Upload-Berechtigung an (youtube.upload): heistclips kann weder deinen Kanal noch deine Videos noch dein Google-Konto lesen. Die Nutzung von Informationen, die heistclips über Google-APIs erhält, hält sich an die <a href="https://developers.google.com/terms/api-services-user-data-policy" rel="noopener">Google API Services User Data Policy</a>, einschließlich der Anforderungen zur eingeschränkten Nutzung (Limited Use); sie werden nie verkauft, nie für Werbung genutzt und nie von Menschen gelesen. Bei TikTok fragen wir dein Basisprofil (Anzeigename) und die Berechtigung an, Videos hochzuladen und zu veröffentlichen. Trennen kannst du die Verbindung jederzeit auf <a href="/post">der Posting-Seite</a>; die Token werden dann widerrufen und gelöscht. Den Zugriff kannst du auch in deinem <a href="https://myaccount.google.com/permissions" rel="noopener">Google-Konto</a> oder in den TikTok-Einstellungen entfernen. Das Posten über heistclips nutzt die YouTube API Services; für das, was du dort postest, gelten deshalb die <a href="https://www.youtube.com/t/terms" rel="noopener">YouTube-Nutzungsbedingungen</a> und die <a href="https://policies.google.com/privacy" rel="noopener">Datenschutzerklärung von Google</a>.</li>
<li><b>Eine zufällige Browser-ID.</b> Dein Browser erzeugt eine zufällige ID, um Gratis-Clips und Stimmen zu zählen. Wir speichern einen mit einem geheimen Schlüssel gebildeten Hash davon und einen Zähler, sonst nichts.</li>
<li><b>Käufe.</b> Kartenzahlungen wickelt Stripe ab. Wir behalten die ID der Checkout-Session als deinen Lizenzschlüssel und einen Zähler der verbrauchten Clips. Deine Karte sehen wir nie.</li>
<li><b>Feature-Wünsche.</b> Was du auf dem Wunsch-Board schreibst, ist dort öffentlich. Ausnahme ist das freiwillige Kontaktfeld: Das sieht nur der Entwickler, per E-Mail.</li>
<li><b>Autopilot-Warteschlange.</b> Wenn du die Warteschlange nutzt, speichern wir die Kanäle, die du beobachtest, und welche Clips du exportiert oder übersprungen hast, unter einem geheimen Link, den nur du hast. Eine E-Mail-Adresse oder ein Benachrichtigungs-Abo wird nur gespeichert, wenn du es angibst, nur genutzt, um dir zu sagen, dass Clips fertig sind, und entfernt, wenn du es ausschaltest.</li>
<li><b>Statistik.</b> Vercel Web Analytics (ohne Cookies) und PostHog zählen Seitenaufrufe und die Nutzung des Tools, damit wir sehen, was funktioniert.</li>
<li><b>MCP-Server.</b> Aufrufe von heistclips.com/mcp sind keiner Person zugeordnet; Schneiden und Posten nutzen einen zufälligen Konto-Code, den dein Assistent zurückgibt. Wir protokollieren, welches Tool aufgerufen wurde, ob es geklappt hat und wie lange es gedauert hat, nie die Argumente. Die Argumente werden genutzt, um den Aufruf zu beantworten; Feature-Wünsche, die darüber kommen, werden wie beim Board oben gespeichert.</li>
</ul>
<p>Fragen oder Löschwünsche: aidan@brickandmortar.dev.</p>`,
  },

  terms: {
    title: "AGB | heistclips",
    desc: "Die Bedingungen für die Nutzung von heistclips.",
    body: (n) => `<h1>AGB</h1>
<p class="small">Das ist eine Übersetzung. Weichen die Fassungen voneinander ab, gilt die <a href="${n.site}/terms?lang=en">englische Fassung</a>.</p>
<ul class="facts">
<li>heistclips ist ein Werkzeug. Du bist verantwortlich für das, was du clippst und postest, und dafür, dass du es posten darfst: Halte dich an die Regeln jeder Kampagne, die Regeln jeder Plattform und die Wünsche jedes Streamers.</li>
<li>Die Kampagnenzahlen werden aus einem öffentlichen Verzeichnis gelesen und können falsch oder veraltet sein. Prüf die eigene Seite der Kampagne, bevor du dich auf eine Zahl verlässt.</li>
<li>Credits gelten für exportierte Clips, verfallen nicht und werden nach der Nutzung nicht erstattet. Ungenutzte Pakete können innerhalb von 14 Tagen erstattet werden: Schreib an aidan@brickandmortar.dev.</li>
<li>Der Dienst wird so bereitgestellt, wie er ist, ohne Gewährleistung. Der Quellcode steht unter MIT-Lizenz auf github.com/2016judea/heistclips.</li>
<li>Das Posten auf YouTube über heistclips nutzt die YouTube API Services. Wenn du diese Funktion nutzt, stimmst du zu, an die <a href="https://www.youtube.com/t/terms" rel="noopener">YouTube-Nutzungsbedingungen</a> gebunden zu sein, und es gilt die <a href="https://policies.google.com/privacy" rel="noopener">Datenschutzerklärung von Google</a>. Den Zugriff von heistclips kannst du jederzeit auf <a href="/post">der Posting-Seite</a> oder in deinen <a href="https://security.google.com/settings/security/permissions" rel="noopener">Google-Sicherheitseinstellungen</a> entfernen.</li>
<li>heistclips hat keinen Bezug zu Take-Two Interactive, zu den Machern von GTA, zu Twitch, Kick, YouTube, TikTok oder Content Rewards.</li>
</ul>`,
  },

  connect: {
    title: "heistclips MCP-Server – GTA-6-Clipping-Daten in ChatGPT, Claude und Grok",
    desc: "Verbinde heistclips mit ChatGPT, Claude oder Grok: Finde die besten Momente zum Clippen in jedem Twitch- oder Kick-Stream und sortiere Clipping-Kampagnen nach $ pro 1.000 Views.",
    tools: {
      rank_clipping_campaigns: "Welche Clipping-Kampagne am meisten zahlt ($ pro 1.000 Views, Verdienst pro Clip)",
      clipping_campaign_details: "Eine Clipping-Kampagne: Rate pro 1.000 Views, Maximum, Budget, Regeln",
      find_clip_moments: "Die besten Momente zum Clippen in einem Twitch- oder Kick-Stream finden (live oder VOD)",
      cut_clip: "Einen Moment als 9:16-MP4 für TikTok, Shorts und Reels schneiden",
      cut_clip_status: "Einen Clip abholen, den cut_clip noch geschnitten hat",
      post_clip: "Einen Clip mit Caption auf YouTube Shorts oder TikTok posten",
      posting_account: "YouTube oder TikTok zum Posten verbinden und Clip-Guthaben prüfen",
      my_clip_queue: "Meine Clip-Warteschlange: fertige Clips von meinen Streamern, passend zur Kampagne, die zahlt",
      watch_streamer: "Einen Streamer für mich beobachten: Twitch- oder Kick-Kanal auf meine Liste setzen",
      live_gta_streams: "Wer gerade auf Twitch und Kick GTA streamt",
      request_a_feature: "Ein Feature für heistclips wünschen",
      list_feature_requests: "Die Feature-Wünsche ansehen",
      upvote_feature_request: "Für einen Feature-Wunsch stimmen",
      cut_clip_status: "Einen Clip abholen, den cut_clip noch geschnitten hat",
      report_a_bug: "Einen Bug bei heistclips melden: etwas ging kaputt oder kam falsch raus",
      whats_new: "Was bei heistclips neu ist: letzte Fixes und Features",
      plan_my_clips: "Plan für meine Clips: welche Kampagnen bei meiner Größe zahlen, mit Momenten, Regeln und Caption",
    },
    body: (n) => `<h1>heistclips in ChatGPT, Claude oder Grok nutzen</h1>
<p class="lede">Frag „Welche GTA-Clipping-Kampagne zahlt gerade am meisten?“ oder „Finde die besten Momente im letzten Stream von Trymacs“ und bekomm die Antwort aus Live-Daten.</p>
<p>Server-URL: <code class="copy">${n.site}/mcp</code></p>
<h2>Claude</h2><p>Einstellungen → Connectors → Benutzerdefinierten Connector hinzufügen → URL einfügen.</p>
<h2>ChatGPT</h2><p>Einstellungen → Apps &amp; Connectors → Erweitert → Entwicklermodus an → Erstellen → URL einfügen, ohne Authentifizierung.</p>
<h2>Grok</h2><p>grok.com/connectors → Hinzufügen → URL einfügen.</p>
<h2>Claude Code, Codex, Cursor</h2><pre>claude mcp add --transport http heistclips ${n.site}/mcp</pre>
<h2>Tools</h2><ul class="facts">
${n.tools}</ul>
<p class="small">Funktioniert in jeder Sprache. Die Links in den Antworten öffnen das Clip-Tool genau am Moment. Die Menüs in Claude, ChatGPT und Grok können bei dir anders heißen.</p>`,
  },

  notFound: { title: "Nicht gefunden | heistclips", desc: "Seite nicht gefunden.", h1: "Hier ist nichts.", back: "Zurück zum Clip-Tool" },

  // E-Mails und Push-Texte der Autopilot-Warteschlange (lib/watch.js).
  // Verdienst bei deiner Größe (lib/sizeview.js): was ein Clip einem kleinen Account wirklich bringt.
  size: {
    bar: "Deine Clips holen", sortL: "Sortieren",
    sizes: { new: "Neuer Account", "5k": "~5K Views", "50k": "~50K Views" },
    sortTyp: "Zahlt am meisten pro Clip", sortMe: "Zahlt mir jetzt",
    likely: { new: "wahrscheinlich für einen neuen Account", "5k": "wahrscheinlich bei ~5K Views pro Clip", "50k": "wahrscheinlich bei ~50K Views pro Clip" },
    oneIn: (n) => `1 von ${n} deiner Clips zahlt`,
    unknown: "Untergrenze unbekannt",
    notPriced: "Pool noch ohne Preis",
    floorClip: (v) => `Zahlt nichts unter ${v} Views pro Clip`,
    floorPool: (v) => `Zahlt nichts, bis deine Clips zusammen ${v} Views haben`,
    floorUnknown: "Untergrenze unbekannt, lies das Briefing",
    noFloor: "Keine Untergrenze: Jeder View zahlt",
    lede: (n, total) => `Für einen neuen Account (etwa 500 Views pro Clip) ${n === 0 ? "zahlt keine" : n === 1 ? "zahlt eine" : `zahlen ${n}`} der ${total} Kampagnen hier für einen typischen Clip überhaupt etwas: Die meisten zahlen nichts unter einer Mindestzahl an Views. Wähl unten deine Größe, dann siehst du, was dir zahlt.`,
    h: "Was ein Clip bei deiner Größe bringt",
    th: ["Deine Clips", "Wahrscheinlich pro Clip", "Clips, die überhaupt zahlen", "Clips bis zur Hürde"],
    rowName: { new: "Neuer Account (~500 Views pro Clip)", "5k": "~5.000 Views pro Clip", "50k": "~50.000 Views pro Clip" },
    none: "keiner", oneInShort: (k, n) => `${k} von ${n}`, every: "alle",
    payout: (min, rate, plats) => `${min} Mindestauszahlung bei ${rate} pro 1.000 Views auf ${plats}`,
    and: "und",
    perClipToo: (v) => `jeder Clip braucht ${v} Views, um zu zählen`,
    refs: (n) => `${n === 1 ? "Eine weitere Regel-Datei öffnet" : `${n} weitere Regel-Dateien öffnen`} sich nach dem Beitritt: Lies sie für alles Weitere.`,
    note: "Der typische Verdienst pro Clip oben ist, was angenommene Clips verdient haben, meist von etablierten Accounts. Wahrscheinlich pro Clip ist, was dein mittlerer Clip nach der Untergrenze bringt, mit Views, die so streuen wie bei jedem Kanal (wenige Clips gehen durch die Decke, die meisten nicht). Die Untergrenzen stammen aus den Einstellungen der Kampagne bei Content Rewards.",
    method: "<b>Wahrscheinlich bei deiner Größe</b> = was dein typischer Clip nach der Untergrenze der Kampagne bringt: der Mindestauszahlung pro Clip ($10 Minimum bei $1 pro 1.000 Views zahlt nichts unter 10.000 Views), einer Mindestzahl an Views pro Clip oder der Hürde eines Pools für die Views all deiner Clips zusammen. Ein neuer Account wird mit etwa 500 Views pro Clip gerechnet, gestreut, wie Views eben streuen (wenige Clips gehen durch die Decke, die meisten nicht); wähl ~5K oder ~50K, wenn das eher du bist. Ein Pool gilt als erreichbar, wenn etwa 30 deiner Clips seine Hürde schaffen. Die Untergrenzen kommen aus den Einstellungen jeder Kampagne; eine, die wir noch nicht gelesen haben, steht als „Untergrenze unbekannt“ da.",
  },

  mail: {
    confirmSubject: "Dein Link zur heistclips-Warteschlange",
    confirmText: (link) => `Du wolltest von heistclips eine E-Mail bekommen, sobald neue Clips fertig sind.\n\nÖffne diesen Link zum Bestätigen. Er öffnet deine Warteschlange auch auf jedem anderen Gerät:\n${link}\n\nWenn das nicht von dir kam, ignorier diese Mail. Es kommt dann nichts weiter.\n\nheistclips.com`,
    confirmHtml: (link) => `<p>Du wolltest von heistclips eine E-Mail bekommen, sobald neue Clips fertig sind.</p><p><a href="${link}">Bestätigen und meine Warteschlange öffnen</a></p><p>Derselbe Link öffnet deine Warteschlange auf jedem Gerät. Gib ihn nicht weiter.</p><p style="color:#777">Wenn das nicht von dir kam, ignorier diese Mail. Es kommt dann nichts weiter.</p>`,
    readySubject: (n, names) => `${n} ${n === 1 ? "neuer Clip" : "neue Clips"} fertig: ${names}`,
    readyLead: (n, paid) => `${n === 1 ? "1 neuer Clip ist" : `${n} neue Clips sind`} fertig${paid ? `, ${paid} davon mit einer Kampagne, die zahlt` : ""}.`,
    typical: (amount) => `typisch ${amount} pro Clip`,
    open: "Meine Warteschlange öffnen", stop: "Diese E-Mails abbestellen",
  },
};
