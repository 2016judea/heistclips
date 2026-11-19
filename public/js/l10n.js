// German, French, Portuguese and Spanish for everything the clip tool and the request board
// write into the page after load. The tool's code (app.js, live.js, post.js, requests.js) writes
// English; this module, loaded only on /de, /fr, /pt and /es pages, rewrites each piece of text
// as it appears. It lives apart from the tool so the people changing the tool never have to
// touch a translation: a line they add that is not listed here simply shows in English until
// someone adds one rule below.
//
// ADDING A LINE: one rule = [pattern for the English text, { de, fr, pt, es }]. A value is a
// string ($1, $2… are the pattern's groups) or a function of the match. Text is matched one
// text node at a time, so "<b>Name</b> is live." needs a rule for " is live." only.
//
// Never translated: chat lines, stream titles, hook text boxes, and what people post on the board.
const lang = (document.documentElement.lang || "en").slice(0, 2);
const ON = ["de", "fr", "pt", "es"].includes(lang);

const LEVEL = { low: { de: "niedrig", fr: "faible", pt: "baixo", es: "bajo" }, medium: { de: "mittel", fr: "moyen", pt: "médio", es: "medio" }, high: { de: "hoch", fr: "élevé", pt: "alto", es: "alto" } };
const lv = (x) => (LEVEL[x] ? LEVEL[x][lang] : x);
const WHY = [
  [/^Twitch muted this audio for licensed music; YouTube and TikTok will likely claim it too$/, { de: "Twitch hat hier den Ton wegen lizenzierter Musik stummgeschaltet; YouTube und TikTok werden das wahrscheinlich auch claimen", fr: "Twitch a coupé le son ici pour musique sous licence ; YouTube et TikTok vont probablement le réclamer aussi", pt: "a Twitch silenciou este áudio por música licenciada; YouTube e TikTok provavelmente vão reivindicar também", es: "Twitch silenció este audio por música con licencia; es probable que YouTube y TikTok también lo reclamen" }],
  [/^chat mentions music (\d+) times here; check for in-game radio$/, { de: "der Chat erwähnt hier $1-mal Musik; prüf, ob das Radio im Spiel läuft", fr: "le chat parle de musique $1 fois ici ; vérifie si la radio du jeu tourne", pt: "o chat fala de música $1 vezes aqui; veja se a rádio do jogo está tocando", es: "el chat menciona música $1 veces aquí; revisa si suena la radio del juego" }],
  [/^no muted audio and chat does not mention music$/, { de: "kein stummer Ton, und der Chat erwähnt keine Musik", fr: "pas de son coupé, et le chat ne parle pas de musique", pt: "nenhum áudio silenciado, e o chat não fala de música", es: "no hay audio silenciado y el chat no menciona música" }],
];
const why = (x) => { for (const r of WHY) if (r[0].test(x)) return x.replace(r[0], r[1][lang]); return x; };
const WATCH = { de: " Der Live-Chat wird weiter beobachtet.", fr: " On continue de suivre le chat en live.", pt: " O chat ao vivo continua sendo acompanhado.", es: " Seguimos atentos al chat en vivo." }[lang] || "";
const s = (n) => (n === "1" ? "" : "s");
// One builder per language where a string is not enough; `by` picks the current language's.
const by = (o) => (m) => o[lang](m);

const RULES = [
  // ---- looking up, reading
  [/^Looking up (.+)…$/, { de: "Suche $1…", fr: "Recherche de $1…", pt: "Procurando $1…", es: "Buscando $1…" }],
  [/^Reading chat( so far)?…( Kick limits.*)?$/, by({
    de: (m) => "Chat wird gelesen…" + (m[2] ? " Kick bremst das Lesen des Chats, das dauert rund 2 Minuten." : ""),
    fr: (m) => "Lecture du chat…" + (m[2] ? " Kick limite la vitesse de lecture du chat : compte environ 2 minutes." : ""),
    pt: (m) => "Lendo o chat…" + (m[2] ? " A Kick limita a velocidade de leitura do chat, então leva uns 2 minutos." : ""),
    es: (m) => "Leyendo el chat…" + (m[2] ? " Kick limita la velocidad de lectura del chat, así que tarda unos 2 minutos." : "") })],
  [/^Connecting to chat…$/, { de: "Verbinde mit dem Chat…", fr: "Connexion au chat…", pt: "Conectando ao chat…", es: "Conectando con el chat…" }],
  [/^Finding the biggest live GTA stream…$/, { de: "Suche den größten GTA-Livestream…", fr: "Recherche du plus gros live GTA…", pt: "Procurando a maior live de GTA no ar…", es: "Buscando el directo de GTA más grande…" }],
  [/^(\d+) moments? from ([\d:]+) of stream, in (\d+) s(\. Watching live chat for new ones\.|\.)?$/, by({
    de: (m) => `${m[1]} Momente aus ${m[2]} Stream, in ${m[3]} s.${/Watching/.test(m[4] || "") ? WATCH : ""}`,
    fr: (m) => `${m[1]} moments sur ${m[2]} de stream, en ${m[3]} s.${/Watching/.test(m[4] || "") ? WATCH : ""}`,
    pt: (m) => `${m[1]} momentos em ${m[2]} de live, em ${m[3]} s.${/Watching/.test(m[4] || "") ? WATCH : ""}`,
    es: (m) => `${m[1]} momentos en ${m[2]} de directo, en ${m[3]} s.${/Watching/.test(m[4] || "") ? WATCH : ""}` })],
  [/^(\d+) moments? from the last 2 hours\. Still reading the earlier ([\d:]+)…$/, { de: "$1 Momente aus den letzten 2 Stunden. Die früheren $2 werden noch gelesen…", fr: "$1 moments sur les 2 dernières heures. Lecture des $2 précédentes en cours…", pt: "$1 momentos das últimas 2 horas. Ainda lendo as $2 anteriores…", es: "$1 momentos de las últimas 2 horas. Aún leyendo las $2 anteriores…" }],
  [/^Chat stayed calm all stream, so these are its (\d+) best moments, not big spikes\.?( Watching live chat for new ones\.)?$/, by({
    de: (m) => `Der Chat blieb den ganzen Stream ruhig. Das sind seine ${m[1]} besten Momente, keine großen Ausschläge.${m[2] ? WATCH : ""}`,
    fr: (m) => `Le chat est resté calme tout le stream : voici ses ${m[1]} meilleurs moments, pas de gros pics.${m[2] ? WATCH : ""}`,
    pt: (m) => `O chat ficou calmo a live inteira: estes são os ${m[1]} melhores momentos, não grandes picos.${m[2] ? WATCH : ""}`,
    es: (m) => `El chat estuvo tranquilo todo el directo: estos son sus ${m[1]} mejores momentos, no grandes picos.${m[2] ? WATCH : ""}` })],
  [/^Chat barely moved in this stream, so there is no moment worth cutting\.( Watching live chat for new ones\.)?$/, by({
    de: (m) => "Der Chat hat sich in diesem Stream kaum bewegt, es gibt keinen Moment, der sich lohnt." + (m[1] ? WATCH : ""),
    fr: (m) => "Le chat a à peine bougé pendant ce stream : aucun moment ne vaut le coup." + (m[1] ? WATCH : ""),
    pt: (m) => "O chat quase não se mexeu nesta live, então não há momento que valha um corte." + (m[1] ? WATCH : ""),
    es: (m) => "El chat casi no se movió en este directo, así que no hay ningún momento que valga un clip." + (m[1] ? WATCH : "") })],
  [/^Nobody typed in chat during this stream, so there is nothing to find moments from\.( Watching live chat for new ones\.)?$/, by({
    de: (m) => "In diesem Stream hat niemand im Chat geschrieben, also gibt es nichts, woraus sich Momente finden lassen." + (m[1] ? WATCH : ""),
    fr: (m) => "Personne n’a écrit dans le chat pendant ce stream : il n’y a rien pour repérer des moments." + (m[1] ? WATCH : ""),
    pt: (m) => "Ninguém escreveu no chat durante esta live, então não há de onde tirar momentos." + (m[1] ? WATCH : ""),
    es: (m) => "Nadie escribió en el chat durante este directo, así que no hay de dónde sacar momentos." + (m[1] ? WATCH : "") })],
  [/^The last 2 hours$/, { de: "Die letzten 2 Stunden", fr: "Les 2 dernières heures", pt: "As últimas 2 horas", es: "Las últimas 2 horas" }],
  [/^Earlier in this stream$/, { de: "Früher in diesem Stream", fr: "Plus tôt dans ce stream", pt: "Mais cedo nesta live", es: "Antes en este directo" }],
  [/^Live moments$/, { de: "Live-Momente", fr: "Moments en live", pt: "Momentos ao vivo", es: "Momentos en vivo" }],
  // ---- never a dead end
  [/^Live in GTA right now\. Tap one to clip it\.$/, { de: "Gerade live in GTA. Tipp einen an, um ihn zu clippen.", fr: "En live sur GTA en ce moment. Touche-en un pour le clipper.", pt: "Ao vivo em GTA agora. Toque em uma para clipar.", es: "En vivo en GTA ahora mismo. Toca uno para clipearlo." }],
  [/^Finding who’s live…$/, { de: "Suche, wer live ist…", fr: "Recherche des lives…", pt: "Vendo quem está ao vivo…", es: "Buscando quién está en vivo…" }],
  [/^([\d.]+[kM]?) watching · (.+)$/, { de: "$1 schauen zu · $2", fr: "$1 spectateurs · $2", pt: "$1 assistindo · $2", es: "$1 viendo · $2" }],
  [/^Nobody is live in GTA with a saved stream this minute\.$/, { de: "Gerade ist in GTA niemand mit gespeichertem Stream live.", fr: "Personne n’est en live sur GTA avec un stream enregistré à cette minute.", pt: "Ninguém está ao vivo em GTA com a live salva neste minuto.", es: "Nadie está en vivo en GTA con el directo guardado en este minuto." }],
  [/^See recent streams$/, { de: "Letzte Streams ansehen", fr: "Voir les streams récents", pt: "Ver lives recentes", es: "Ver directos recientes" }],
  [/^Whose stream\? Type a streamer’s name or paste their link, or pick one below\.$/, { de: "Wessen Stream? Tipp den Namen eines Streamers ein, füg seinen Link ein oder such dir unten einen aus.", fr: "Le stream de qui ? Tape le nom d’un streamer, colle son lien, ou choisis-en un ci-dessous.", pt: "A live de quem? Digite o nome de um streamer, cole o link dele ou escolha uma abaixo.", es: "¿El directo de quién? Escribe el nombre de un streamer, pega su enlace o elige uno abajo." }],
  [/^YouTube streams can’t be read yet: heistclips reads Twitch and Kick\.$/, { de: "YouTube-Streams lassen sich noch nicht lesen: heistclips liest Twitch und Kick.", fr: "Les streams YouTube ne sont pas encore lisibles : heistclips lit Twitch et Kick.", pt: "Ainda não dá para ler lives do YouTube: o heistclips lê Twitch e Kick.", es: "Los directos de YouTube aún no se pueden leer: heistclips lee Twitch y Kick." }],
  [/^Vote for YouTube Live$/, { de: "Für YouTube Live abstimmen", fr: "Voter pour YouTube Live", pt: "Vote no YouTube Live", es: "Vota por YouTube Live" }],
  [/^, or clip one of these\.$/, { de: " oder clippe einen von diesen.", fr: ", ou clippe l’un de ceux-ci.", pt: ", ou clipe uma destas.", es: ", o clipea uno de estos." }],
  [/^That isn’t a Twitch or Kick channel or video\. Paste a link like these:$/, { de: "Das ist kein Kanal oder Video von Twitch oder Kick. Füg einen Link wie diese ein:", fr: "Ce n’est ni une chaîne ni une vidéo Twitch ou Kick. Colle un lien comme ceux-ci :", pt: "Isso não é um canal nem um vídeo da Twitch ou da Kick. Cole um link como estes:", es: "Eso no es un canal ni un video de Twitch o Kick. Pega un enlace como estos:" }],
  [/^No (Kick|Twitch) channel called$/, { de: "Kein $1-Kanal namens", fr: "Aucune chaîne $1 nommée", pt: "Nenhum canal da $1 chamado", es: "No hay ningún canal de $1 llamado" }],
  [/^has no saved Kick streams to read\.$/, { de: "hat keine gespeicherten Kick-Streams zum Lesen.", fr: "n’a aucun stream Kick enregistré à lire.", pt: "não tem lives salvas na Kick para ler.", es: "no tiene directos guardados en Kick para leer." }],
  [/^That Kick video doesn’t exist or isn’t public\.$/, { de: "Dieses Kick-Video gibt es nicht, oder es ist nicht öffentlich.", fr: "Cette vidéo Kick n’existe pas ou n’est pas publique.", pt: "Esse vídeo da Kick não existe ou não é público.", es: "Ese video de Kick no existe o no es público." }],
  [/^That VOD doesn’t exist or isn’t public\.$/, { de: "Dieses VOD gibt es nicht, oder es ist nicht öffentlich.", fr: "Cette VOD n’existe pas ou n’est pas publique.", pt: "Esse VOD não existe ou não é público.", es: "Ese VOD no existe o no es público." }],
  [/^That Twitch clip doesn’t exist any more\.$/, { de: "Diesen Twitch-Clip gibt es nicht mehr.", fr: "Ce clip Twitch n’existe plus.", pt: "Esse clipe da Twitch não existe mais.", es: "Ese clip de Twitch ya no existe." }],
  [/^Opened the stream that clip was cut from, at the same second\.$/, { de: "Der Stream, aus dem der Clip stammt, ist geöffnet, an derselben Sekunde.", fr: "Le stream d’où vient ce clip est ouvert, à la même seconde.", pt: "Abrimos a live de onde esse clipe saiu, no mesmo segundo.", es: "Abrimos el directo del que salió ese clip, en el mismo segundo." }],
  [/^The stream that clip came from has been deleted\.$/, { de: "Der Stream, aus dem der Clip stammt, wurde gelöscht.", fr: "Le stream d’où vient ce clip a été supprimé.", pt: "A live de onde esse clipe saiu foi apagada.", es: "El directo del que salió ese clip fue borrado." }],
  [/^The stream that clip came from has been deleted, so this is (.+)’s latest stream\.$/, { de: "Der Stream, aus dem der Clip stammt, wurde gelöscht. Das hier ist der letzte Stream von $1.", fr: "Le stream d’où vient ce clip a été supprimé : voici le dernier stream de $1.", pt: "A live de onde esse clipe saiu foi apagada, então esta é a última live de $1.", es: "El directo del que salió ese clip fue borrado, así que este es el último directo de $1." }],
  [/^Showing$/, { de: "Zeige", fr: "Voici", pt: "Mostrando", es: "Mostrando" }],
  [/^for “(.+)”\.$/, { de: "für „$1“.", fr: "pour « $1 ».", pt: "para “$1”.", es: "para «$1»." }],
  [/^is live, but Twitch isn’t saving this stream, so there’s no video to cut\.$/, { de: "ist live, aber Twitch speichert diesen Stream nicht, es gibt also kein Video zum Schneiden.", fr: "est en live, mais Twitch n’enregistre pas ce stream : il n’y a pas de vidéo à couper.", pt: "está ao vivo, mas a Twitch não está salvando esta live, então não há vídeo para cortar.", es: "está en vivo, pero Twitch no está guardando este directo, así que no hay video que cortar." }],
  [/^has no saved streams on Twitch\.( Did you mean)?$/, by({
    de: (m) => "hat auf Twitch keine gespeicherten Streams." + (m[1] ? " Meintest du" : ""),
    fr: (m) => "n’a aucun stream enregistré sur Twitch." + (m[1] ? " Tu voulais dire" : ""),
    pt: (m) => "não tem lives salvas na Twitch." + (m[1] ? " Você quis dizer" : ""),
    es: (m) => "no tiene directos guardados en Twitch." + (m[1] ? " ¿Quisiste decir" : "") })],
  [/^is live right now, but Twitch isn’t saving this stream, so there’s no video of it to cut\. These moments are from the last saved stream \((.+)\)\.$/, { de: "ist gerade live, aber Twitch speichert diesen Stream nicht, es gibt also kein Video davon. Diese Momente stammen aus dem letzten gespeicherten Stream ($1).", fr: "est en live en ce moment, mais Twitch n’enregistre pas ce stream : pas de vidéo à couper. Ces moments viennent du dernier stream enregistré ($1).", pt: "está ao vivo agora, mas a Twitch não está salvando esta live, então não há vídeo dela para cortar. Estes momentos são da última live salva ($1).", es: "está en vivo ahora, pero Twitch no está guardando este directo, así que no hay video suyo que cortar. Estos momentos son del último directo guardado ($1)." }],
  [/^Couldn’t reach (Twitch|Kick): (.*)\.$/, { de: "$1 ist nicht erreichbar: $2.", fr: "Impossible de joindre $1 : $2.", pt: "Não deu para falar com a $1: $2.", es: "No se pudo conectar con $1: $2." }],
  [/^Try again$/, { de: "Nochmal versuchen", fr: "Réessayer", pt: "Tentar de novo", es: "Reintentar" }],
  [/^This stream’s video isn’t public \(subscriber-only or deleted\), so it can’t be cut\.$/, { de: "Das Video dieses Streams ist nicht öffentlich (nur für Abonnenten oder gelöscht) und lässt sich deshalb nicht schneiden.", fr: "La vidéo de ce stream n’est pas publique (réservée aux abonnés ou supprimée) : impossible de la couper.", pt: "O vídeo desta live não é público (só para inscritos ou apagado), então não dá para cortar.", es: "El video de este directo no es público (solo para suscriptores o borrado), así que no se puede cortar." }],
  [/^(Twitch|Kick) stopped answering \((.*)\)\.$/, { de: "$1 antwortet nicht mehr ($2).", fr: "$1 ne répond plus ($2).", pt: "A $1 parou de responder ($2).", es: "$1 dejó de responder ($2)." }],
  [/^Try (.+)’s other streams:$/, { de: "Probier andere Streams von $1:", fr: "Essaie d’autres streams de $1 :", pt: "Tente outras lives de $1:", es: "Prueba otros directos de $1:" }],
  // ---- source card, credits
  [/^Other streams:$/, { de: "Andere Streams:", fr: "Autres streams :", pt: "Outras lives:", es: "Otros directos:" }],
  [/^Untitled stream$/, { de: "Stream ohne Titel", fr: "Stream sans titre", pt: "Live sem título", es: "Directo sin título" }],
  [/^(\d+) free clips? left(?: \+ (\d+) paid)?$/, by({
    de: (m) => `Noch ${m[1]} Gratis-Clip${s(m[1])}${m[2] ? ` + ${m[2]} gekauft` : ""}`,
    fr: (m) => `${m[1]} clip${s(m[1])} gratuit${s(m[1])} restant${s(m[1])}${m[2] ? ` + ${m[2]} payé${s(m[2])}` : ""}`,
    pt: (m) => `${m[1]} clipe${s(m[1])} grátis restante${s(m[1])}${m[2] ? ` + ${m[2]} pago${s(m[2])}` : ""}`,
    es: (m) => `Te queda${m[1] === "1" ? "" : "n"} ${m[1]} clip${s(m[1])} gratis${m[2] ? ` + ${m[2]} de pago` : ""}` })],
  [/^Payment received: (\d+) clips added\. They’re saved in this browser\.$/, { de: "Zahlung eingegangen: $1 Clips gutgeschrieben. Sie sind in diesem Browser gespeichert.", fr: "Paiement reçu : $1 clips ajoutés. Ils sont enregistrés dans ce navigateur.", pt: "Pagamento recebido: $1 clipes adicionados. Eles ficam salvos neste navegador.", es: "Pago recibido: $1 clips añadidos. Quedan guardados en este navegador." }],
  [/^We couldn’t confirm that payment yet \((.*)\)\. Refresh in a minute; if it persists email aidan@brickandmortar\.dev\.$/, { de: "Wir konnten die Zahlung noch nicht bestätigen ($1). Lade in einer Minute neu; wenn es dabei bleibt, schreib an aidan@brickandmortar.dev.", fr: "Paiement pas encore confirmé ($1). Recharge dans une minute ; si ça continue, écris à aidan@brickandmortar.dev.", pt: "Ainda não conseguimos confirmar esse pagamento ($1). Atualize a página em um minuto; se continuar, escreva para aidan@brickandmortar.dev.", es: "Aún no pudimos confirmar ese pago ($1). Recarga en un minuto; si sigue igual, escribe a aidan@brickandmortar.dev." }],
  // ---- a moment
  [/^chat ([\d.]+)× normal speed$/, { de: "Chat $1× schneller als normal", fr: "chat $1× plus rapide que la normale", pt: "chat $1× mais rápido que o normal", es: "chat $1× más rápido de lo normal" }],
  [/^small spike$/, { de: "kleiner Ausschlag", fr: "petit pic", pt: "pico pequeno", es: "pico pequeño" }],
  [/^the second you linked$/, { de: "die verlinkte Sekunde", fr: "la seconde de ton lien", pt: "o segundo do seu link", es: "el segundo de tu enlace" }],
  [/^funny$/, { de: "lustig", fr: "drôle", pt: "engraçado", es: "gracioso" }], [/^hype$/, { de: "Hype", fr: "hype", pt: "hype", es: "hype" }], [/^shock$/, { de: "Schock", fr: "choc", pt: "choque", es: "shock" }], [/^fail$/, { de: "Fail", fr: "fail", pt: "fail", es: "fail" }],
  [/^already clipped on Twitch (\d+)× \((\d+) views\)$/, { de: "schon $1× auf Twitch geclippt ($2 Views)", fr: "déjà clippé $1× sur Twitch ($2 vues)", pt: "já clipado $1× na Twitch ($2 views)", es: "ya clipeado $1× en Twitch ($2 vistas)" }],
  [/^music risk: (low|medium|high)$/, by({ de: (m) => "Musik-Risiko: " + lv(m[1]), fr: (m) => "risque musique : " + lv(m[1]), pt: (m) => "risco de música: " + lv(m[1]), es: (m) => "riesgo de música: " + lv(m[1]) })],
  [/^Music risk (medium|high): (.*)\.$/, by({ de: (m) => `Musik-Risiko ${lv(m[1])}: ${why(m[2])}.`, fr: (m) => `Risque musique ${lv(m[1])} : ${why(m[2])}.`, pt: (m) => `Risco de música ${lv(m[1])}: ${why(m[2])}.`, es: (m) => `Riesgo de música ${lv(m[1])}: ${why(m[2])}.` })],
  [/^possible spoiler$/, { de: "möglicher Spoiler", fr: "spoiler possible", pt: "possível spoiler", es: "posible spoiler" }],
  [/^live, (\d+) min ago$/, { de: "live, vor $1 Min.", fr: "live, il y a $1 min", pt: "ao vivo, há $1 min", es: "en vivo, hace $1 min" }],
  [/^just now$/, { de: "gerade eben", fr: "à l’instant", pt: "agora mesmo", es: "ahora mismo" }],
  [/^Cut this$/, { de: "Schneiden", fr: "Couper ce moment", pt: "Cortar este", es: "Cortar este" }],
  [/^Watch on (Twitch|Kick)$/, { de: "Auf $1 ansehen", fr: "Voir sur $1", pt: "Ver na $1", es: "Ver en $1" }],
  [/^✕ Skip$/, { de: "✕ Überspringen", fr: "✕ Passer", pt: "✕ Pular", es: "✕ Saltar" }],
  [/^Not a good pick$/, { de: "Kein guter Moment", fr: "Pas un bon moment", pt: "Não é um bom momento", es: "No es un buen momento" }],
  [/^Missing something\? Request it$/, { de: "Fehlt was? Wünsch es dir", fr: "Il manque un truc ? Demande-le", pt: "Faltou algo? Peça", es: "¿Falta algo? Pídelo" }],
  [/^Skip story spoilers$/, { de: "Story-Spoiler überspringen", fr: "Passer les spoilers de l’histoire", pt: "Pular spoilers da história", es: "Saltar spoilers de la historia" }],
  [/^\(for campaigns that ban them\)$/, { de: "(für Kampagnen, die sie verbieten)", fr: "(pour les campagnes qui les interdisent)", pt: "(para campanhas que proíbem)", es: "(para campañas que los prohíben)" }],
  [/^Skipped (\d+) moments? as possible spoilers$/, by({
    de: (m) => `${m[1]} Moment${m[1] === "1" ? "" : "e"} als mögliche Spoiler übersprungen`,
    fr: (m) => `${m[1]} moment${s(m[1])} passé${s(m[1])} : spoilers possibles`,
    pt: (m) => `${m[1]} momento${s(m[1])} pulado${s(m[1])} por possível spoiler`,
    es: (m) => `${m[1]} momento${s(m[1])} saltado${s(m[1])} por posible spoiler` })],
  [/^Show it anyway$/, { de: "Trotzdem zeigen", fr: "L’afficher quand même", pt: "Mostrar mesmo assim", es: "Mostrar igual" }],
  // ---- the editor
  [/^Loading video…$/, { de: "Video wird geladen…", fr: "Chargement de la vidéo…", pt: "Carregando o vídeo…", es: "Cargando el video…" }],
  [/^Layout$/, { de: "Layout", fr: "Mise en page", pt: "Layout", es: "Formato" }],
  [/^Facecam \+ gameplay$/, { de: "Facecam + Gameplay", fr: "Facecam + gameplay", pt: "Facecam + gameplay", es: "Facecam + gameplay" }],
  [/^Full frame, blurred fill$/, { de: "Ganzes Bild, unscharfer Rand", fr: "Image entière, fond flouté", pt: "Quadro inteiro, fundo desfocado", es: "Cuadro completo, fondo desenfocado" }],
  [/^Centre crop$/, { de: "Mittig zuschneiden", fr: "Recadrage centré", pt: "Recorte central", es: "Recorte centrado" }],
  [/^Where is the facecam\?$/, { de: "Wo ist die Facecam?", fr: "Où est la facecam ?", pt: "Onde está a facecam?", es: "¿Dónde está la facecam?" }],
  [/^Where is the facecam in the stream\? Drag the box onto it; drag the dot to resize\.$/, { de: "Wo ist die Facecam im Stream? Zieh den Rahmen darauf; am Punkt änderst du die Größe.", fr: "Où est la facecam dans le stream ? Fais glisser le cadre dessus ; tire le point pour le redimensionner.", pt: "Onde está a facecam na live? Arraste a caixa para cima dela; arraste o ponto para mudar o tamanho.", es: "¿Dónde está la facecam en el directo? Arrastra el recuadro encima; arrastra el punto para cambiar el tamaño." }],
  [/^↖ top left$/, { de: "↖ oben links", fr: "↖ en haut à gauche", pt: "↖ em cima à esquerda", es: "↖ arriba a la izquierda" }], [/^↗ top right$/, { de: "↗ oben rechts", fr: "↗ en haut à droite", pt: "↗ em cima à direita", es: "↗ arriba a la derecha" }], [/^↙ bottom left$/, { de: "↙ unten links", fr: "↙ en bas à gauche", pt: "↙ embaixo à esquerda", es: "↙ abajo a la izquierda" }], [/^↘ bottom right$/, { de: "↘ unten rechts", fr: "↘ en bas à droite", pt: "↘ embaixo à direita", es: "↘ abajo a la derecha" }],
  [/^Put the facecam$/, { de: "Facecam platzieren", fr: "Placer la facecam", pt: "Posição da facecam", es: "Colocar la facecam" }],
  [/^On top$/, { de: "Oben", fr: "En haut", pt: "Em cima", es: "Arriba" }], [/^At the bottom$/, { de: "Unten", fr: "En bas", pt: "Embaixo", es: "Abajo" }],
  [/^Facecam style$/, { de: "Facecam-Stil", fr: "Style de la facecam", pt: "Estilo da facecam", es: "Estilo de la facecam" }],
  [/^Panel$/, { de: "Panel", fr: "Bandeau", pt: "Painel", es: "Panel" }], [/^Rounded box$/, { de: "Abgerundet", fr: "Cadre arrondi", pt: "Caixa arredondada", es: "Recuadro redondeado" }], [/^Circle$/, { de: "Kreis", fr: "Cercle", pt: "Círculo", es: "Círculo" }],
  [/^No zoom$/, { de: "Kein Zoom", fr: "Sans zoom", pt: "Sem zoom", es: "Sin zoom" }],
  [/^Punch-in on the loudest second$/, { de: "Zoom auf die lauteste Sekunde", fr: "Zoom sur la seconde la plus forte", pt: "Zoom no segundo mais alto", es: "Zoom en el segundo más fuerte" }],
  [/^Funny facecam$/, { de: "Lustige Facecam", fr: "Facecam marrante", pt: "Facecam engraçada", es: "Facecam divertida" }],
  [/^Big head$/, { de: "Riesenkopf", fr: "Grosse tête", pt: "Cabeção", es: "Cabezón" }], [/^Fisheye$/, { de: "Fischauge", fr: "Fisheye", pt: "Olho de peixe", es: "Ojo de pez" }],
  [/^Shake when loud$/, { de: "Wackeln, wenn es laut wird", fr: "Tremble quand ça crie", pt: "Treme quando grita", es: "Tiembla cuando hay gritos" }],
  [/^Deep fried$/, { de: "Deep Fried", fr: "Deep fried", pt: "Deep fried", es: "Deep fried" }], [/^Jelly$/, { de: "Wackelpudding", fr: "Gelée", pt: "Gelatina", es: "Gelatina" }],
  [/^Finding the loudest second… (\d+)%$/, { de: "Suche die lauteste Sekunde… $1 %", fr: "Recherche de la seconde la plus forte… $1 %", pt: "Procurando o segundo mais alto… $1%", es: "Buscando el segundo más fuerte… $1 %" }],
  [/^Facecam size$/, { de: "Größe der Facecam", fr: "Taille de la facecam", pt: "Tamanho da facecam", es: "Tamaño de la facecam" }],
  [/^Pan gameplay$/, { de: "Gameplay verschieben", fr: "Décaler le gameplay", pt: "Mover o gameplay", es: "Mover el gameplay" }],
  [/^Hook \(first thing they read\)\. Edit any line\.$/, { de: "Hook (das Erste, was sie lesen). Jede Zeile lässt sich ändern.", fr: "Hook (la première chose qu’ils lisent). Tu peux modifier chaque ligne.", pt: "Gancho (a primeira coisa que eles leem). Dá para editar qualquer linha.", es: "Gancho (lo primero que leen). Puedes editar cualquier línea." }],
  [/^No hook$/, { de: "Kein Hook", fr: "Sans hook", pt: "Sem gancho", es: "Sin gancho" }],
  [/^Hook whole clip$/, { de: "Hook über den ganzen Clip", fr: "Hook sur tout le clip", pt: "Gancho no clipe inteiro", es: "Gancho en todo el clip" }],
  [/^First 3 s only$/, { de: "Nur die ersten 3 s", fr: "Les 3 premières secondes", pt: "Só os 3 primeiros s", es: "Solo los 3 primeros s" }],
  [/^Chat overlay$/, { de: "Chat-Overlay", fr: "Chat en surimpression", pt: "Chat por cima", es: "Chat superpuesto" }],
  [/^On$/, { de: "An", fr: "Oui", pt: "Ligado", es: "Sí" }], [/^Off$/, { de: "Aus", fr: "Non", pt: "Desligado", es: "No" }],
  [/^Clip window$/, { de: "Clip-Ausschnitt", fr: "Fenêtre du clip", pt: "Trecho do clipe", es: "Tramo del clip" }],
  [/^start \+5s$/, { de: "Start +5s", fr: "début +5s", pt: "início +5s", es: "inicio +5s" }], [/^end −5s$/, { de: "Ende −5s", fr: "fin −5s", pt: "fim −5s", es: "fin −5s" }],
  [/^▶ Preview$/, { de: "▶ Vorschau", fr: "▶ Aperçu", pt: "▶ Prévia", es: "▶ Vista previa" }],
  [/^Render 9:16 clip$/, { de: "9:16-Clip rendern", fr: "Lancer le rendu 9:16", pt: "Renderizar clipe 9:16", es: "Renderizar clip 9:16" }],
  [/^This browser can’t record video\. Open heistclips in Chrome, Edge or Safari on a computer\.$/, { de: "Dieser Browser kann kein Video aufnehmen. Öffne heistclips in Chrome, Edge oder Safari am Computer.", fr: "Ce navigateur ne peut pas enregistrer de vidéo. Ouvre heistclips dans Chrome, Edge ou Safari sur un ordinateur.", pt: "Este navegador não consegue gravar vídeo. Abra o heistclips no Chrome, Edge ou Safari em um computador.", es: "Este navegador no puede grabar video. Abre heistclips en Chrome, Edge o Safari en una computadora." }],
  [/^Want another layout, captions, or something else\?$/, { de: "Anderes Layout, Untertitel oder was ganz anderes?", fr: "Une autre mise en page, des sous-titres, autre chose ?", pt: "Quer outro layout, legendas ou outra coisa?", es: "¿Quieres otro formato, subtítulos u otra cosa?" }],
  [/^Request a feature$/, { de: "Feature wünschen", fr: "Demande une fonction", pt: "Peça uma função", es: "Pide una función" }],
  [/^— we build what clippers ask for\.$/, { de: "– wir bauen, was Clipper sich wünschen.", fr: ": on construit ce que les clippeurs demandent.", pt: "— a gente constrói o que os clipadores pedem.", es: "— construimos lo que piden los clippers." }],
  [/^(\d+)×(\d+) source · renders at 1080×1920$/, { de: "Quelle $1×$2 · gerendert wird in 1080×1920", fr: "Source $1×$2 · rendu en 1080×1920", pt: "Fonte $1×$2 · renderiza em 1080×1920", es: "Fuente $1×$2 · se renderiza a 1080×1920" }],
  [/^Couldn’t load the video: (.*?)( \(live moments need ~30 s before the video catches up; try again shortly\))?$/, by({
    de: (m) => `Das Video ließ sich nicht laden: ${m[1]}` + (m[2] ? " (Live-Momente brauchen ~30 s, bis das Video nachzieht; versuch es gleich nochmal)" : ""),
    fr: (m) => `Impossible de charger la vidéo : ${m[1]}` + (m[2] ? " (un moment en live a besoin d’environ 30 s avant que la vidéo suive ; réessaie dans un instant)" : ""),
    pt: (m) => `Não deu para carregar o vídeo: ${m[1]}` + (m[2] ? " (momento ao vivo precisa de uns 30 s até o vídeo alcançar; tente de novo já já)" : ""),
    es: (m) => `No se pudo cargar el video: ${m[1]}` + (m[2] ? " (un momento en vivo necesita unos 30 s hasta que el video lo alcance; inténtalo de nuevo en un momento)" : "") })],
  [/^Done\. Pick another hook and render again for a second, different post\.$/, { de: "Fertig. Nimm einen anderen Hook und render nochmal: das ist dein zweiter, anderer Post.", fr: "C’est prêt. Choisis un autre hook et relance le rendu pour un deuxième post, différent.", pt: "Pronto. Escolha outro gancho e renderize de novo para um segundo post, diferente.", es: "Listo. Elige otro gancho y renderiza otra vez para una segunda publicación, distinta." }],
  [/^Render failed: (.*?)\. Nothing was charged\.$/, { de: "Rendern fehlgeschlagen: $1. Es wurde nichts berechnet.", fr: "Le rendu a échoué : $1. Rien n’a été débité.", pt: "A renderização falhou: $1. Nada foi cobrado.", es: "El render falló: $1. No se cobró nada." }],
  [/^Render failed: (.*?)\.$/, { de: "Rendern fehlgeschlagen: $1.", fr: "Le rendu a échoué : $1.", pt: "A renderização falhou: $1.", es: "El render falló: $1." }],
  [/^Nothing was charged\.$/, { de: "Es wurde nichts berechnet.", fr: "Rien n’a été débité.", pt: "Nada foi cobrado.", es: "No se cobró nada." }],
  [/^Download (\w+) · (.*)$/, { de: "$1 herunterladen · $2", fr: "Télécharger le $1 · $2", pt: "Baixar $1 · $2", es: "Descargar $1 · $2" }],
  [/^Cut from the (.+) source\.$/, { de: "Geschnitten aus der $1-Quelle.", fr: "Coupé depuis la source $1.", pt: "Cortado da fonte $1.", es: "Cortado de la fuente $1." }],
  [/^WebM plays on TikTok and YouTube\. For Instagram, Safari or Chrome 126\+ export MP4\.$/, { de: "WebM läuft auf TikTok und YouTube. Für Instagram: Safari oder Chrome 126+ exportieren MP4.", fr: "Le WebM passe sur TikTok et YouTube. Pour Instagram, Safari ou Chrome 126+ exportent en MP4.", pt: "WebM roda no TikTok e no YouTube. Para o Instagram, o Safari ou o Chrome 126+ exportam MP4.", es: "WebM funciona en TikTok y YouTube. Para Instagram, Safari o Chrome 126+ exportan MP4." }],
  [/^No sound came through for this stretch(: Twitch muted it in the VOD \(licensed music\))?\.$/, by({
    de: (m) => "Für diese Stelle kam kein Ton an" + (m[1] ? ": Twitch hat sie im VOD stummgeschaltet (lizenzierte Musik)" : "") + ".",
    fr: (m) => "Aucun son n’est passé sur ce passage" + (m[1] ? " : Twitch l’a coupé dans la VOD (musique sous licence)" : "") + ".",
    pt: (m) => "Não veio som neste trecho" + (m[1] ? ": a Twitch silenciou no VOD (música licenciada)" : "") + ".",
    es: (m) => "No llegó sonido en este tramo" + (m[1] ? ": Twitch lo silenció en el VOD (música con licencia)" : "") + "." })],
  [/^This clip window is empty\. Use the ±5s buttons to set a start before the end\.$/, { de: "Dieser Clip-Ausschnitt ist leer. Setz mit den ±5s-Knöpfen den Start vor das Ende.", fr: "Cette fenêtre de clip est vide. Utilise les boutons ±5s pour placer le début avant la fin.", pt: "Este trecho está vazio. Use os botões de ±5s para deixar o início antes do fim.", es: "Este tramo está vacío. Usa los botones de ±5s para poner el inicio antes del fin." }],
  [/^Couldn’t reach heistclips to check your clips\. Check your connection and try again\.$/, { de: "heistclips ist nicht erreichbar, um deine Clips zu prüfen. Check deine Verbindung und versuch es nochmal.", fr: "Impossible de joindre heistclips pour vérifier tes clips. Vérifie ta connexion et réessaie.", pt: "Não deu para falar com o heistclips para conferir seus clipes. Veja sua conexão e tente de novo.", es: "No se pudo conectar con heistclips para revisar tus clips. Revisa tu conexión e inténtalo de nuevo." }],
  // ---- posting (post.js)
  [/^Post to (YouTube|TikTok)$/, { de: "Auf $1 posten", fr: "Poster sur $1", pt: "Postar no $1", es: "Publicar en $1" }],
  [/^Checking your account…$/, { de: "Dein Account wird geprüft…", fr: "Vérification de ton compte…", pt: "Conferindo sua conta…", es: "Revisando tu cuenta…" }],
  [/^Posting to (.+) isn’t open yet: we’re waiting on \1’s developer approval\. Download the clip and post it by hand for now\.$/, { de: "Posten auf $1 ist noch nicht offen: Wir warten auf die Entwickler-Freigabe von $1. Lad den Clip herunter und poste ihn vorerst von Hand.", fr: "Poster sur $1 n’est pas encore ouvert : on attend la validation développeur de $1. Télécharge le clip et poste-le à la main pour l’instant.", pt: "Postar no $1 ainda não está liberado: estamos esperando a aprovação de desenvolvedor do $1. Baixe o clipe e poste na mão por enquanto.", es: "Publicar en $1 aún no está abierto: esperamos la aprobación de desarrollador de $1. Descarga el clip y publícalo a mano por ahora." }],
  [/^Connect (.+) first \(one time\):$/, { de: "Verbinde zuerst $1 (einmalig):", fr: "Connecte d’abord $1 (une seule fois) :", pt: "Conecte o $1 primeiro (uma vez só):", es: "Conecta $1 primero (una sola vez):" }],
  [/^open the connect page$/, { de: "Verbindungsseite öffnen", fr: "ouvre la page de connexion", pt: "abra a página de conexão", es: "abre la página de conexión" }],
  [/^Open the connect page$/, { de: "Verbindungsseite öffnen", fr: "Ouvre la page de connexion", pt: "Abra a página de conexão", es: "Abre la página de conexión" }],
  [/^, then press Post again\.$/, { de: " und drück dann nochmal auf Posten.", fr: ", puis appuie de nouveau sur Poster.", pt: ", depois aperte Postar de novo.", es: ", luego pulsa Publicar otra vez." }],
  [/^Uploading (\d+)%…$/, { de: "Upload $1 %…", fr: "Envoi $1 %…", pt: "Enviando $1%…", es: "Subiendo $1 %…" }],
  [/^Posting to (.+)…$/, { de: "Wird auf $1 gepostet…", fr: "Publication sur $1…", pt: "Postando no $1…", es: "Publicando en $1…" }],
  [/^Couldn’t post: (.*)$/, { de: "Posten fehlgeschlagen: $1", fr: "Publication impossible : $1", pt: "Não deu para postar: $1", es: "No se pudo publicar: $1" }],
  // ---- live
  [/^Live, but couldn’t sync to the recording; moments from chat so far are below\.$/, { de: "Live, aber die Aufnahme ließ sich nicht synchronisieren; die Momente aus dem bisherigen Chat stehen unten.", fr: "En live, mais impossible de se caler sur l’enregistrement ; les moments du chat jusqu’ici sont ci-dessous.", pt: "Ao vivo, mas não deu para sincronizar com a gravação; os momentos do chat até agora estão abaixo.", es: "En vivo, pero no se pudo sincronizar con la grabación; abajo están los momentos del chat hasta ahora." }],
  [/^Watching live chat · ([\d.]+) msg\/s \(normal ([\d.]+)\) · a spike over ([\d.]+) becomes a moment$/, { de: "Live-Chat läuft mit · $1 Nachr./s (normal $2) · ab $3 wird ein Ausschlag zum Moment", fr: "Chat en live suivi · $1 msg/s (normale $2) · au-dessus de $3, un pic devient un moment", pt: "Acompanhando o chat ao vivo · $1 msg/s (normal $2) · um pico acima de $3 vira momento", es: "Siguiendo el chat en vivo · $1 msg/s (normal $2) · un pico por encima de $3 se vuelve un momento" }],
  [/^watching chat$/, { de: "Chat wird mitgelesen", fr: "chat suivi en direct", pt: "acompanhando o chat", es: "siguiendo el chat" }],
  [/^chat disconnected, reconnecting…$/, { de: "Chat getrennt, verbinde neu…", fr: "chat déconnecté, reconnexion…", pt: "chat caiu, reconectando…", es: "chat desconectado, reconectando…" }],
  [/^Kick chat paused \((.*)\), retrying…$/, { de: "Kick-Chat pausiert ($1), neuer Versuch…", fr: "Chat Kick en pause ($1), nouvel essai…", pt: "Chat da Kick em pausa ($1), tentando de novo…", es: "Chat de Kick en pausa ($1), reintentando…" }],
  // ---- the request board
  [/^Sending…$/, { de: "Wird gesendet…", fr: "Envoi…", pt: "Enviando…", es: "Enviando…" }],
  [/^Already on the board, so we added nothing\. Upvote it:$/, { de: "Steht schon auf dem Board, wir haben nichts hinzugefügt. Stimm dafür:", fr: "C’est déjà sur le tableau, on n’a rien ajouté. Vote pour :", pt: "Já está no mural, então não adicionamos nada. Vote nele:", es: "Ya está en el tablero, así que no añadimos nada. Vótalo:" }],
  [/^Added\. It’s on the board now\.$/, { de: "Eingetragen. Es steht jetzt auf dem Board.", fr: "Ajouté. C’est sur le tableau.", pt: "Adicionado. Já está no mural.", es: "Añadido. Ya está en el tablero." }],
  [/^That’s an? (.+), not a request\.$/, { de: "Das ist ein $1, kein Wunsch.", fr: "C’est un(e) $1, pas une demande.", pt: "Isso é um(a) $1, não um pedido.", es: "Eso es un $1, no una petición." }],
  [/^Find its moments in the clip tool →$/, { de: "Finde die Momente im Clip-Tool →", fr: "Trouve ses moments dans l’outil de clip →", pt: "Ache os momentos na ferramenta de clipes →", es: "Busca sus momentos en la herramienta de clips →" }],
  [/^It’s a request, file it$/, { de: "Doch, das ist ein Wunsch", fr: "Si, c’est une demande", pt: "É um pedido, sim", es: "Sí es una petición" }],
  [/^Say what you want in a few words\.$/, { de: "Sag in ein paar Worten, was du willst.", fr: "Dis ce que tu veux en quelques mots.", pt: "Diga o que você quer em poucas palavras.", es: "Di lo que quieres en pocas palabras." }],
  [/^No links, please\. Describe it in words\.$/, { de: "Bitte keine Links. Beschreib es in Worten.", fr: "Pas de liens, s’il te plaît. Décris-le avec des mots.", pt: "Sem links, por favor. Descreva com palavras.", es: "Sin enlaces, por favor. Descríbelo con palabras." }],
  [/^Keep it clean, please\.$/, { de: "Bitte sauber bleiben.", fr: "Reste correct, s’il te plaît.", pt: "Sem baixaria, por favor.", es: "Sin groserías, por favor." }],
  [/^That's three requests from this connection today\. Upvote the others instead\.$/, { de: "Das waren heute drei Wünsche von diesem Anschluss. Stimm lieber für die anderen ab.", fr: "Ça fait trois demandes depuis cette connexion aujourd’hui. Vote plutôt pour les autres.", pt: "Já foram três pedidos desta conexão hoje. Vote nos outros.", es: "Ya van tres peticiones desde esta conexión hoy. Mejor vota las otras." }],
  [/^requested$/, { de: "gewünscht", fr: "demandé", pt: "pedido", es: "pedido" }],
  [/^Requested by a clipper$/, { de: "Wunsch eines Clippers", fr: "Demandé par un clippeur", pt: "Pedido por um clipador", es: "Pedido por un clipper" }],
];

export function tr(text) {
  if (!ON || !text) return text;
  const m = String(text).match(/^(\s*)([\s\S]*?)(\s*)$/);
  const core = m[2];
  if (!core || core.length > 400) return text;
  for (const r of RULES) {
    const hit = core.match(r[0]);
    if (!hit) continue;
    const to = typeof r[1] === "function" ? r[1] : r[1][lang];
    if (to == null) return text;
    return m[1] + (typeof to === "function" ? to(hit) : core.replace(r[0], to)) + m[3];
  }
  return text;
}

// Links the tool writes to an English page that also exists in this language.
const LOCAL = /^\/(?:$|\?|clip(?:$|\?)|pricing(?:$|\?)|requests(?:$|[?#])|guides(?:$|\/|\?)|gta-6-clipping-(?:campaigns|rates-today)(?:$|\?))/;
const SKIP = "script,style,textarea,.quote,[data-notr],.src .t > b,.resp,code,pre";
const done = new WeakMap();

function textNode(n) {
  const p = n.parentElement;
  if (!p || p.closest(SKIP)) return;
  const v = n.nodeValue;
  if (done.get(n) === v) return;
  const t = tr(v);
  done.set(n, t);
  if (t !== v) n.nodeValue = t;
}

function el(e) {
  if (e.nodeType !== 1 || e.closest(SKIP)) return;
  for (const a of ["title", "placeholder", "aria-label"]) {
    const v = e.getAttribute && e.getAttribute(a);
    if (v) { const t = a === "title" ? why(tr(v)) : tr(v); if (t !== v) e.setAttribute(a, t); }
  }
  if (e.tagName === "A") {
    const h = e.getAttribute("href");
    if (h && LOCAL.test(h)) e.setAttribute("href", "/" + lang + (h === "/" ? "" : h));
  }
}

function walk(root) {
  if (root.nodeType === 3) return textNode(root);
  if (root.nodeType !== 1) return;
  el(root);
  root.querySelectorAll("*").forEach(el);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n; while ((n = w.nextNode())) textNode(n);
}

if (ON && typeof MutationObserver !== "undefined") {
  const scope = document.querySelector("main") || document.body;
  new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === "characterData") textNode(m.target);
      else m.addedNodes.forEach(walk);
    }
  }).observe(scope, { childList: true, subtree: true, characterData: true });
  // Only what scripts add later is English; the page itself arrives translated from the server.
  scope.querySelectorAll("#app, #reqmsg, .rnote, .note").forEach(walk);
}
