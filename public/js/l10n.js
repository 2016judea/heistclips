// German, French, Portuguese and Spanish for everything the clip tool and the request board
// write into the page after load. The tool's code (app.js, live.js, post.js, requests.js) writes
// English; this module, loaded only on /de, /fr, /pt and /es pages (the clip tool, the request
// board, the autopilot queue and /post), rewrites each piece of text
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

// What a render is waiting for (the part after " · "), and why one failed. render.js writes these.
const sub = (table, x) => { for (const r of table) if (r[0].test(x)) return x.replace(r[0], r[1][lang]); return x; };
const MORE = [
  [/^(\d+) MB in$/, { de: "$1 MB geladen", fr: "$1 Mo reçus", pt: "$1 MB recebidos", es: "$1 MB recibidos" }],
  [/^no data from (Twitch|Kick) for (\d+) s, retry (\d) of 3$/, { de: "seit $2 s keine Daten von $1, Versuch $3 von 3", fr: "aucune donnée de $1 depuis $2 s, essai $3 sur 3", pt: "sem dados da $1 há $2 s, tentativa $3 de 3", es: "sin datos de $1 desde hace $2 s, intento $3 de 3" }],
  [/^no data from (Twitch|Kick) for (\d+) s$/, { de: "seit $2 s keine Daten von $1", fr: "aucune donnée de $1 depuis $2 s", pt: "sem dados da $1 há $2 s", es: "sin datos de $1 desde hace $2 s" }],
  [/^waiting for more video \((\d+) s\)$/, { de: "wartet auf mehr Video ($1 s)", fr: "en attente de la suite de la vidéo ($1 s)", pt: "esperando mais vídeo ($1 s)", es: "esperando más video ($1 s)" }],
];
const more = (x) => (x ? " · " + sub(MORE, x) : "");
const ERR = [
  [/^the clip window is empty \(its end is before its start\)\. Reset it with the buttons and render again$/, { de: "der Clip-Ausschnitt ist leer (das Ende liegt vor dem Start). Setz ihn mit den Knöpfen neu und render nochmal", fr: "la fenêtre du clip est vide (la fin est avant le début). Règle-la avec les boutons et relance le rendu", pt: "o trecho está vazio (o fim vem antes do início). Ajuste com os botões e renderize de novo", es: "el tramo está vacío (el final está antes del inicio). Ajústalo con los botones y renderiza otra vez" }],
  [/^This browser cannot record video\. Use Chrome, Edge or Safari on a computer\.?$/, { de: "Dieser Browser kann kein Video aufnehmen. Nimm Chrome, Edge oder Safari am Computer", fr: "Ce navigateur ne peut pas enregistrer de vidéo. Utilise Chrome, Edge ou Safari sur un ordinateur", pt: "Este navegador não grava vídeo. Use Chrome, Edge ou Safari no computador", es: "Este navegador no puede grabar video. Usa Chrome, Edge o Safari en un ordenador" }],
  [/^the browser blocked the sound, so the clip would be silent\. Click Render again$/, { de: "der Browser hat den Ton blockiert, der Clip wäre stumm. Klick nochmal auf Rendern", fr: "le navigateur a bloqué le son, le clip serait muet. Relance le rendu", pt: "o navegador bloqueou o som, então o clipe ficaria mudo. Clique em Renderizar de novo", es: "el navegador bloqueó el sonido, así que el clip saldría mudo. Pulsa Renderizar otra vez" }],
  [/^that part of the stream isn't in the video$/, { de: "dieser Teil des Streams ist nicht im Video", fr: "cette partie du stream n’est pas dans la vidéo", pt: "essa parte da live não está no vídeo", es: "esa parte del directo no está en el video" }],
  [/^that moment isn't in Twitch's recording yet \(it's (\d+) s ahead of it\)\. Try again in a minute$/, { de: "dieser Moment ist noch nicht in der Twitch-Aufnahme (er liegt $1 s davor). Versuch es in einer Minute nochmal", fr: "ce moment n’est pas encore dans l’enregistrement de Twitch (il a $1 s d’avance). Réessaie dans une minute", pt: "esse momento ainda não está na gravação da Twitch (está $1 s à frente). Tente de novo em um minuto", es: "ese momento todavía no está en la grabación de Twitch (va $1 s por delante). Inténtalo otra vez en un minuto" }],
  [/^(Twitch|Kick) refused part of this video \((.*)\)\. Try a different clip window$/, { de: "$1 hat einen Teil dieses Videos verweigert ($2). Versuch einen anderen Clip-Ausschnitt", fr: "$1 a refusé une partie de cette vidéo ($2). Essaie une autre fenêtre de clip", pt: "a $1 recusou parte deste vídeo ($2). Tente outro trecho", es: "$1 rechazó parte de este video ($2). Prueba con otro tramo" }],
  [/^the video stopped arriving from (Twitch|Kick)\. Check your connection and render again$/, { de: "von $1 kam kein Video mehr an. Check deine Verbindung und render nochmal", fr: "la vidéo a cessé d’arriver depuis $1. Vérifie ta connexion et relance le rendu", pt: "o vídeo parou de chegar da $1. Confira sua conexão e renderize de novo", es: "el video dejó de llegar desde $1. Revisa tu conexión y renderiza otra vez" }],
  [/^the video stopped arriving part-way through the recording\. Check your connection and render again$/, { de: "mitten in der Aufnahme kam kein Video mehr an. Check deine Verbindung und render nochmal", fr: "la vidéo a cessé d’arriver en plein enregistrement. Vérifie ta connexion et relance le rendu", pt: "o vídeo parou de chegar no meio da gravação. Confira sua conexão e renderize de novo", es: "el video dejó de llegar a mitad de la grabación. Revisa tu conexión y renderiza otra vez" }],
  [/^the recording came out empty$/, { de: "die Aufnahme war leer", fr: "l’enregistrement est sorti vide", pt: "a gravação saiu vazia", es: "la grabación salió vacía" }],
  [/^the browser's video encoder stopped$/, { de: "der Video-Encoder des Browsers hat aufgehört", fr: "l’encodeur vidéo du navigateur s’est arrêté", pt: "o codificador de vídeo do navegador parou", es: "el codificador de video del navegador se detuvo" }],
];
const err = (x) => sub(ERR, x);

// "5 min ago" as the queue and the board write it.
const AGO = { min: { de: "vor $1 Min.", fr: "il y a $1 min", pt: "há $1 min", es: "hace $1 min" }, h: { de: "vor $1 Std.", fr: "il y a $1 h", pt: "há $1 h", es: "hace $1 h" }, d: { de: "vor $1 T.", fr: "il y a $1 j", pt: "há $1 d", es: "hace $1 d" } };
const JUST = { de: "gerade eben", fr: "à l’instant", pt: "agora mesmo", es: "ahora mismo" };
const ago = (x) => { const m = String(x).match(/^(\d+) (min|h|d) ago$/); return m ? AGO[m[2]][lang].replace("$1", m[1]) : x === "just now" ? JUST[lang] : x; };
const OR = { de: " oder ", fr: " ou ", pt: " ou ", es: " o " };
// What the autopilot says about a clip and a campaign (lib/autopilot.js, lib/watch.js write these in English).
const CHIP = [
  [/^GTA stream$/, { de: "GTA-Stream", fr: "stream GTA", pt: "live de GTA", es: "directo de GTA" }],
  [/^campaign is for GTA; this stream was (.+)$/, { de: "Kampagne ist für GTA; dieser Stream war $1", fr: "campagne pour GTA ; ce stream était sur $1", pt: "a campanha é de GTA; esta live era de $1", es: "la campaña es de GTA; este directo era de $1" }],
  [/^campaign is for GTA: check the stream was GTA$/, { de: "Kampagne ist für GTA: prüf, ob der Stream GTA war", fr: "campagne pour GTA : vérifie que le stream était sur GTA", pt: "a campanha é de GTA: confira se a live era de GTA", es: "la campaña es de GTA: revisa que el directo fuera de GTA" }],
  [/^(\d+) s fits (\d+)–(\d+) s$/, { de: "$1 s passt zu $2–$3 s", fr: "$1 s, dans les $2–$3 s", pt: "$1 s cabe em $2–$3 s", es: "$1 s entra en $2–$3 s" }],
  [/^trim to (\d+)–(\d+) s \(this cut is (\d+) s\)$/, { de: "auf $1–$2 s kürzen (dieser Schnitt hat $3 s)", fr: "raccourcir à $1–$2 s (ce clip fait $3 s)", pt: "cortar para $1–$2 s (este corte tem $3 s)", es: "recortar a $1–$2 s (este corte dura $3 s)" }],
  [/^trim to (\d+)–(\d+) s$/, { de: "auf $1–$2 s kürzen", fr: "raccourcir à $1–$2 s", pt: "cortar para $1–$2 s", es: "recortar a $1–$2 s" }],
  [/^length rule in the brief$/, { de: "Längen-Regel im Briefing", fr: "règle de durée dans le brief", pt: "regra de duração no briefing", es: "regla de duración en el brief" }],
  [/^licensed music here: likely claimed$/, { de: "lizenzierte Musik: Claim wahrscheinlich", fr: "musique sous licence ici : réclamation probable", pt: "música licenciada aqui: provável reivindicação", es: "música con licencia aquí: reclamo probable" }],
  [/^audio rule in the brief$/, { de: "Audio-Regel im Briefing", fr: "règle audio dans le brief", pt: "regra de áudio no briefing", es: "regla de audio en el brief" }],
  [/^required tags in the brief$/, { de: "Pflicht-Tags im Briefing", fr: "tags obligatoires dans le brief", pt: "tags obrigatórias no briefing", es: "etiquetas obligatorias en el brief" }],
  [/^spoiler rule in the brief$/, { de: "Spoiler-Regel im Briefing", fr: "règle spoilers dans le brief", pt: "regra de spoiler no briefing", es: "regla de spoilers en el brief" }],
  [/^add their official sound to the clip$/, { de: "ihren offiziellen Sound in den Clip packen", fr: "ajouter leur son officiel au clip", pt: "colocar o som oficial deles no clipe", es: "agregar su sonido oficial al clip" }],
  [/^read the brief$/, { de: "Briefing lesen", fr: "lire le brief", pt: "ler o briefing", es: "leer el brief" }],
  [/^apply first$/, { de: "erst bewerben", fr: "candidature d’abord", pt: "inscreva-se antes", es: "postúlate primero" }],
  [/^US audience$/, { de: "US-Publikum", fr: "audience US", pt: "público dos EUA", es: "audiencia de EE. UU." }],
  [/^Tier 1 audience$/, { de: "Tier-1-Publikum", fr: "audience Tier 1", pt: "público Tier 1", es: "audiencia Tier 1" }],
  [/^English$/, { de: "Englisch", fr: "anglais", pt: "inglês", es: "inglés" }],
  [/^no watermark$/, { de: "kein Wasserzeichen", fr: "sans filigrane", pt: "sem marca d’água", es: "sin marca de agua" }],
  [/^length rule$/, { de: "Längen-Regel", fr: "règle de durée", pt: "regra de duração", es: "regla de duración" }],
  [/^spoiler rule$/, { de: "Spoiler-Regel", fr: "règle spoilers", pt: "regra de spoiler", es: "regla de spoilers" }],
  [/^audio rule$/, { de: "Audio-Regel", fr: "règle audio", pt: "regra de áudio", es: "regla de audio" }],
  [/^tags\/caption rule$/, { de: "Tag-/Caption-Regel", fr: "règle tags/légende", pt: "regra de tags/legenda", es: "regla de etiquetas/descripción" }],
  [/^no channel with that name$/, { de: "kein Kanal mit diesem Namen", fr: "aucune chaîne à ce nom", pt: "nenhum canal com esse nome", es: "no hay ningún canal con ese nombre" }],
  [/^live, but this channel does not save streams, so there is no video to cut$/, { de: "live, aber dieser Kanal speichert keine Streams, es gibt also kein Video zum Schneiden", fr: "en live, mais cette chaîne n’enregistre pas ses streams : pas de vidéo à couper", pt: "ao vivo, mas este canal não salva as lives, então não há vídeo para cortar", es: "en vivo, pero este canal no guarda sus directos, así que no hay video que cortar" }],
  [/^the newest stream's video is not public$/, { de: "das Video des neuesten Streams ist nicht öffentlich", fr: "la vidéo du dernier stream n’est pas publique", pt: "o vídeo da live mais recente não é público", es: "el video del directo más reciente no es público" }],
  [/^none of your campaigns fits this clip$/, { de: "keine deiner Kampagnen passt zu diesem Clip", fr: "aucune de tes campagnes ne correspond à ce clip", pt: "nenhuma das suas campanhas combina com este clipe", es: "ninguna de tus campañas encaja con este clip" }],
  [/^no live campaign names (.+)$/, { de: "keine laufende Kampagne nennt $1", fr: "aucune campagne en cours ne cite $1", pt: "nenhuma campanha ativa cita $1", es: "ninguna campaña activa nombra a $1" }],
  // messages api/queue.js sends back
  [/^that does not look like an email address$/, { de: "Das sieht nicht nach einer E-Mail-Adresse aus.", fr: "Ça ne ressemble pas à une adresse e-mail.", pt: "Isso não parece um endereço de e-mail.", es: "Eso no parece una dirección de correo." }],
  [/^a link was just sent; check your inbox$/, { de: "Gerade wurde ein Link verschickt. Schau in dein Postfach.", fr: "Un lien vient d’être envoyé. Regarde ta boîte mail.", pt: "Acabamos de enviar um link. Olhe sua caixa de entrada.", es: "Se acaba de enviar un enlace. Revisa tu correo." }],
  [/^too many tries; email aidan@brickandmortar\.dev$/, { de: "Zu viele Versuche. Schreib an aidan@brickandmortar.dev.", fr: "Trop d’essais. Écris à aidan@brickandmortar.dev.", pt: "Tentativas demais. Escreva para aidan@brickandmortar.dev.", es: "Demasiados intentos. Escribe a aidan@brickandmortar.dev." }],
  [/^that link is out of date$/, { de: "Dieser Link ist veraltet.", fr: "Ce lien n’est plus valable.", pt: "Esse link está vencido.", es: "Ese enlace ya no sirve." }],
  [/^unknown queue$/, { de: "Diese Warteschlange gibt es nicht.", fr: "Cette file n’existe pas.", pt: "Essa fila não existe.", es: "Esa cola no existe." }],
  [/^something broke; try again$/, { de: "Da ist was kaputtgegangen. Versuch es nochmal.", fr: "Quelque chose a cassé. Réessaie.", pt: "Algo quebrou. Tente de novo.", es: "Algo se rompió. Inténtalo de nuevo." }],
  [/^The cut failed\. Nothing was charged\.$/, { de: "Der Schnitt ist fehlgeschlagen. Es wurde nichts berechnet.", fr: "La coupe a échoué. Rien n’a été débité.", pt: "O corte falhou. Nada foi cobrado.", es: "El corte falló. No se cobró nada." }],
  [/^The connection dropped\. If the clip finished it will be under “Your cut clips” when you reload\. Nothing is charged for a clip that didn’t finish\.$/, { de: "Die Verbindung ist abgebrochen. Wenn der Clip fertig wurde, steht er nach dem Neuladen unter „Deine geschnittenen Clips“. Für einen Clip, der nicht fertig wurde, wird nichts berechnet.", fr: "La connexion a coupé. Si le clip est terminé, il sera sous « Tes clips coupés » après rechargement. Rien n’est débité pour un clip qui n’a pas abouti.", pt: "A conexão caiu. Se o clipe terminou, ele vai estar em “Seus clipes cortados” quando você recarregar. Nada é cobrado por um clipe que não terminou.", es: "Se cayó la conexión. Si el clip terminó, estará en «Tus clips cortados» cuando recargues. No se cobra nada por un clip que no terminó." }],
];
const chip = (x) => sub(CHIP, x);
// What a post came back with (lib/social.js) and why /post sent you back (api/v1/post.js).
const NOTE = [
  [/^YouTube set this to (\w+), not (\w+): uploads through a new app stay private until YouTube finishes reviewing heistclips\. Open the Studio link to publish it\.$/, { de: "YouTube hat das auf „$1“ gesetzt statt auf „$2“: Uploads über eine neue App bleiben privat, bis YouTube die Prüfung von heistclips abgeschlossen hat. Öffne den Studio-Link, um es zu veröffentlichen.", fr: "YouTube l’a mis en « $1 » au lieu de « $2 » : les envois via une nouvelle application restent privés tant que YouTube n’a pas fini d’examiner heistclips. Ouvre le lien Studio pour le publier.", pt: "O YouTube deixou como “$1”, não “$2”: envios por um app novo ficam privados até o YouTube terminar de analisar o heistclips. Abra o link do Studio para publicar.", es: "YouTube lo dejó como «$1», no «$2»: las subidas desde una app nueva quedan privadas hasta que YouTube termine de revisar heistclips. Abre el enlace de Studio para publicarlo." }],
  [/^Posted as private\. Open the Studio link to make it public\.$/, { de: "Als privat gepostet. Öffne den Studio-Link, um es öffentlich zu machen.", fr: "Posté en privé. Ouvre le lien Studio pour le rendre public.", pt: "Postado como privado. Abra o link do Studio para deixar público.", es: "Publicado como privado. Abre el enlace de Studio para hacerlo público." }],
  [/^Sent to your TikTok inbox\. Open TikTok, tap the notification, add the caption and post it\.( TikTok does not take a caption on drafts; paste yours there\.)?$/, { de: "An deinen TikTok-Posteingang geschickt. Öffne TikTok, tipp auf die Benachrichtigung, füg die Caption ein und poste. Bei Entwürfen übernimmt TikTok keine Caption.", fr: "Envoyé dans ta boîte de réception TikTok. Ouvre TikTok, touche la notification, ajoute la légende et poste. TikTok ne reprend pas la légende sur les brouillons.", pt: "Enviado para sua caixa de entrada do TikTok. Abra o TikTok, toque na notificação, coloque a legenda e poste. O TikTok não aceita legenda em rascunhos.", es: "Enviado a tu bandeja de entrada de TikTok. Abre TikTok, toca la notificación, agrega la descripción y publícalo. TikTok no acepta descripción en borradores." }],
  [/^Posted as private \(only you\)\. TikTok keeps posts from a new app private until it finishes reviewing heistclips; change who can see it in the TikTok app\.$/, { de: "Als privat gepostet (nur du). TikTok hält Posts aus einer neuen App privat, bis die Prüfung von heistclips durch ist; wer es sehen kann, änderst du in der TikTok-App.", fr: "Posté en privé (toi seulement). TikTok garde privés les posts d’une nouvelle application tant qu’il n’a pas fini d’examiner heistclips ; change qui peut le voir dans l’appli TikTok.", pt: "Postado como privado (só você). O TikTok mantém privados os posts de um app novo até terminar de analisar o heistclips; mude quem pode ver no app do TikTok.", es: "Publicado como privado (solo tú). TikTok mantiene privadas las publicaciones de una app nueva hasta que termine de revisar heistclips; cambia quién puede verlo en la app de TikTok." }],
  [/^Posted\. TikTok takes a minute to process it\.$/, { de: "Gepostet. TikTok braucht eine Minute, um es zu verarbeiten.", fr: "Posté. TikTok met une minute à le traiter.", pt: "Postado. O TikTok leva um minuto para processar.", es: "Publicado. TikTok tarda un minuto en procesarlo." }],
  [/^TikTok is still reviewing heistclips\. Until it finishes, TikTok only lets us post to private accounts: set your TikTok account to private \(Settings, Privacy, Private account\), post, then switch back\. Or send it as a draft instead\.$/, { de: "TikTok prüft heistclips noch. Bis dahin dürfen wir nur auf private Konten posten: Stell dein TikTok-Konto auf privat (Einstellungen, Datenschutz, Privates Konto), poste und stell es dann zurück. Oder schick es als Entwurf.", fr: "TikTok examine encore heistclips. D’ici là, TikTok ne nous laisse poster que sur des comptes privés : passe ton compte TikTok en privé (Paramètres, Confidentialité, Compte privé), poste, puis remets-le comme avant. Ou envoie-le en brouillon.", pt: "O TikTok ainda está analisando o heistclips. Até terminar, só podemos postar em contas privadas: deixe sua conta do TikTok privada (Configurações, Privacidade, Conta privada), poste e depois volte ao normal. Ou envie como rascunho.", es: "TikTok todavía está revisando heistclips. Hasta que termine, solo nos deja publicar en cuentas privadas: pon tu cuenta de TikTok en privado (Configuración, Privacidad, Cuenta privada), publica y luego vuelve a cambiarla. O envíalo como borrador." }],
  [/^(YouTube|TikTok) is not connected to this account yet\. .*$/, { de: "$1 ist mit diesem Account noch nicht verbunden.", fr: "$1 n’est pas encore connecté à ce compte.", pt: "O $1 ainda não está conectado a esta conta.", es: "$1 aún no está conectado a esta cuenta." }],
  [/^(YouTube|TikTok) needs connecting again(?: \(.*\))?\. Ask the user to open the connect link and connect again\.$/, { de: "$1 muss neu verbunden werden.", fr: "$1 doit être reconnecté.", pt: "O $1 precisa ser conectado de novo.", es: "Hay que volver a conectar $1." }],
  [/^That clip is not on file \(clips are kept 72 hours\)\. .*$/, { de: "Dieser Clip liegt nicht mehr vor (Clips bleiben 72 Stunden). Render ihn nochmal.", fr: "Ce clip n’est plus disponible (les clips sont gardés 72 heures). Relance le rendu.", pt: "Esse clipe não está mais guardado (os clipes ficam 72 horas). Renderize de novo.", es: "Ese clip ya no está guardado (los clips se guardan 72 horas). Renderízalo otra vez." }],
  [/^(YouTube|TikTok) refused the upload: (.*)$/, { de: "$1 hat den Upload abgelehnt: $2", fr: "$1 a refusé l’envoi : $2", pt: "O $1 recusou o envio: $2", es: "$1 rechazó la subida: $2" }],
  [/^YouTube upload failed: (.*)$/, { de: "YouTube-Upload fehlgeschlagen: $1", fr: "L’envoi vers YouTube a échoué : $1", pt: "O envio para o YouTube falhou: $1", es: "La subida a YouTube falló: $1" }],
  [/^TikTok would not accept a post right now: (.*)$/, { de: "TikTok nimmt gerade keinen Post an: $1", fr: "TikTok n’accepte pas de post pour l’instant : $1", pt: "O TikTok não está aceitando post agora: $1", es: "TikTok no acepta una publicación en este momento: $1" }],
  [/^this clip is too large to post from the browser \(140 MB limit\)$/, { de: "dieser Clip ist zu groß, um ihn aus dem Browser zu posten (Limit 140 MB)", fr: "ce clip est trop lourd pour être posté depuis le navigateur (limite de 140 Mo)", pt: "este clipe é grande demais para postar pelo navegador (limite de 140 MB)", es: "este clip es demasiado grande para publicarlo desde el navegador (límite de 140 MB)" }],
  [/^couldn’t reach heistclips$/, { de: "heistclips ist nicht erreichbar", fr: "impossible de joindre heistclips", pt: "não deu para falar com o heistclips", es: "no se pudo conectar con heistclips" }],
  [/^upload (refused|failed)$/, { de: "Upload fehlgeschlagen", fr: "l’envoi a échoué", pt: "o envio falhou", es: "la subida falló" }],
];
const note = (x) => sub(NOTE, x);
// Why a moment was flagged as a spoiler (public/js/spoilers.js).
const SPOIL = {
  "warns about spoilers": { de: "der Chat warnt vor Spoilern", fr: "le chat prévient qu’il y a des spoilers", pt: "o chat avisa que tem spoiler", es: "el chat avisa de spoilers" },
  "is talking about the ending": { de: "der Chat redet über das Ende", fr: "le chat parle de la fin", pt: "o chat está falando do final", es: "el chat está hablando del final" },
  "is reacting to a story scene": { de: "der Chat reagiert auf eine Story-Szene", fr: "le chat réagit à une scène de l’histoire", pt: "o chat está reagindo a uma cena da história", es: "el chat está reaccionando a una escena de la historia" },
};

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
  [/^Loading video… \(slow connection\)$/, { de: "Video wird geladen… (langsame Verbindung)", fr: "Chargement de la vidéo… (connexion lente)", pt: "Carregando o vídeo… (conexão lenta)", es: "Cargando el video… (conexión lenta)" }],
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
  [/^Loading the video… (\d+)%(?: · (.*))?$/, by({ de: (m) => `Video wird geladen… ${m[1]} %` + more(m[2]), fr: (m) => `Chargement de la vidéo… ${m[1]} %` + more(m[2]), pt: (m) => `Carregando o vídeo… ${m[1]}%` + more(m[2]), es: (m) => `Cargando el video… ${m[1]} %` + more(m[2]) })],
  [/^Recording… (\d+)%(?: · (.*))?$/, by({ de: (m) => `Aufnahme läuft… ${m[1]} %` + more(m[2]), fr: (m) => `Enregistrement… ${m[1]} %` + more(m[2]), pt: (m) => `Gravando… ${m[1]}%` + more(m[2]), es: (m) => `Grabando… ${m[1]} %` + more(m[2]) })],
  [/^Waiting for the live video to catch up \((\d+) s to go\)… 0%$/, { de: "Warte, bis das Live-Video nachzieht (noch $1 s)…", fr: "On attend que la vidéo du live rattrape (encore $1 s)…", pt: "Esperando o vídeo ao vivo alcançar (faltam $1 s)…", es: "Esperando a que el video en vivo alcance (faltan $1 s)…" }],
  [/^Paused: keep this tab open while it records$/, { de: "Pausiert: Lass diesen Tab offen, solange aufgenommen wird", fr: "En pause : garde cet onglet ouvert pendant l’enregistrement", pt: "Pausado: deixe esta aba aberta enquanto grava", es: "En pausa: deja esta pestaña abierta mientras graba" }],
  [/^Cancel$/, { de: "Abbrechen", fr: "Annuler", pt: "Cancelar", es: "Cancelar" }],
  [/^Cancelled\. Nothing was charged\.$/, { de: "Abgebrochen. Es wurde nichts berechnet.", fr: "Annulé. Rien n’a été débité.", pt: "Cancelado. Nada foi cobrado.", es: "Cancelado. No se cobró nada." }],
  [/^Finding the loudest second… (\d+)%$/, { de: "Suche die lauteste Sekunde… $1 %", fr: "Recherche de la seconde la plus forte… $1 %", pt: "Procurando o segundo mais alto… $1%", es: "Buscando el segundo más fuerte… $1 %" }],
  [/^Big head and Fisheye blow up the middle of the box\. Drag the box so the face is in the middle\.$/, { de: "Riesenkopf und Fischauge vergrößern die Mitte des Rahmens. Zieh den Rahmen so, dass das Gesicht in der Mitte ist.", fr: "Grosse tête et Fisheye grossissent le milieu du cadre. Place le cadre pour que le visage soit au milieu.", pt: "Cabeção e Olho de peixe aumentam o meio da caixa. Arraste a caixa para o rosto ficar no meio.", es: "Cabezón y Ojo de pez agrandan el centro del recuadro. Arrastra el recuadro para que la cara quede en el centro." }],
  [/^This one came out at (\d+) fps, not 60: the computer was busy while it recorded\. Render it again, or turn the funny facecam off for a smooth 60\.$/, { de: "Dieser Clip hat $1 fps statt 60: Der Computer war beim Aufnehmen beschäftigt. Render ihn nochmal oder schalte die lustige Facecam aus, dann sind es glatte 60.", fr: "Ce clip est sorti à $1 fps au lieu de 60 : l’ordinateur était occupé pendant l’enregistrement. Relance le rendu, ou coupe la facecam marrante pour un 60 fluide.", pt: "Este clipe saiu a $1 fps, não 60: o computador estava ocupado durante a gravação. Renderize de novo ou desligue a facecam engraçada para 60 fps lisos.", es: "Este clip salió a $1 fps, no a 60: el ordenador estaba ocupado al grabar. Renderízalo otra vez o apaga la facecam divertida para 60 fluidos." }],
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
  [/^— we build what clippers ask for\.$/, { de: "– wir bauen, was Clipper sich wünschen.", fr: ": on construit ce que les clippeurs demandent.", pt: "e a gente constrói o que os clipadores pedem.", es: "y construimos lo que piden los clippers." }],
  [/^(\d+)×(\d+) source · renders at 1080×1920$/, { de: "Quelle $1×$2 · gerendert wird in 1080×1920", fr: "Source $1×$2 · rendu en 1080×1920", pt: "Fonte $1×$2 · renderiza em 1080×1920", es: "Fuente $1×$2 · se renderiza a 1080×1920" }],
  [/^Couldn’t load the video: (.*?)( \(live moments need ~30 s before the video catches up; try again shortly\))?$/, by({
    de: (m) => `Das Video ließ sich nicht laden: ${m[1]}` + (m[2] ? " (Live-Momente brauchen ~30 s, bis das Video nachzieht; versuch es gleich nochmal)" : ""),
    fr: (m) => `Impossible de charger la vidéo : ${m[1]}` + (m[2] ? " (un moment en live a besoin d’environ 30 s avant que la vidéo suive ; réessaie dans un instant)" : ""),
    pt: (m) => `Não deu para carregar o vídeo: ${m[1]}` + (m[2] ? " (momento ao vivo precisa de uns 30 s até o vídeo alcançar; tente de novo já já)" : ""),
    es: (m) => `No se pudo cargar el video: ${m[1]}` + (m[2] ? " (un momento en vivo necesita unos 30 s hasta que el video lo alcance; inténtalo de nuevo en un momento)" : "") })],
  [/^Done\. Pick another hook and render again for a second, different post\.$/, { de: "Fertig. Nimm einen anderen Hook und render nochmal: das ist dein zweiter, anderer Post.", fr: "C’est prêt. Choisis un autre hook et relance le rendu pour un deuxième post, différent.", pt: "Pronto. Escolha outro gancho e renderize de novo para um segundo post, diferente.", es: "Listo. Elige otro gancho y renderiza otra vez para una segunda publicación, distinta." }],
  [/^Render failed: (.*?)\. Nothing was charged\.$/, by({ de: (m) => `Rendern fehlgeschlagen: ${err(m[1])}. Es wurde nichts berechnet.`, fr: (m) => `Le rendu a échoué : ${err(m[1])}. Rien n’a été débité.`, pt: (m) => `A renderização falhou: ${err(m[1])}. Nada foi cobrado.`, es: (m) => `El render falló: ${err(m[1])}. No se cobró nada.` })],
  [/^Render failed: (.*?)\.$/, by({ de: (m) => `Rendern fehlgeschlagen: ${err(m[1])}.`, fr: (m) => `Le rendu a échoué : ${err(m[1])}.`, pt: (m) => `A renderização falhou: ${err(m[1])}.`, es: (m) => `El render falló: ${err(m[1])}.` })],
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
  [/^Couldn’t post: (.*)$/, by({ de: (m) => "Posten fehlgeschlagen: " + note(m[1]), fr: (m) => "Publication impossible : " + note(m[1]), pt: (m) => "Não deu para postar: " + note(m[1]), es: (m) => "No se pudo publicar: " + note(m[1]) })],
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
  // ---- posting: the /post page and what comes back after a post (post.js)
  [/^Caption$/, { de: "Caption", fr: "Légende", pt: "Legenda", es: "Descripción" }],
  [/^(?:(\d+) free clips? left(?: \+ (\d+) paid)? · )?Account code for Claude:$/, by({
    de: (m) => (m[1] ? `Noch ${m[1]} Gratis-Clip${s(m[1])}${m[2] ? ` + ${m[2]} gekauft` : ""} · ` : "") + "Account-Code für Claude:",
    fr: (m) => (m[1] ? `${m[1]} clip${s(m[1])} gratuit${s(m[1])} restant${s(m[1])}${m[2] ? ` + ${m[2]} payé${s(m[2])}` : ""} · ` : "") + "Code de compte pour Claude :",
    pt: (m) => (m[1] ? `${m[1]} clipe${s(m[1])} grátis restante${s(m[1])}${m[2] ? ` + ${m[2]} pago${s(m[2])}` : ""} · ` : "") + "Código da conta para o Claude:",
    es: (m) => (m[1] ? `Te queda${m[1] === "1" ? "" : "n"} ${m[1]} clip${s(m[1])} gratis${m[2] ? ` + ${m[2]} de pago` : ""} · ` : "") + "Código de cuenta para Claude:" })],
  [/^Connected as (.+)$/, { de: "Verbunden als $1", fr: "Connecté en tant que $1", pt: "Conectado como $1", es: "Conectado como $1" }],
  [/^Connected$/, { de: "Verbunden", fr: "Connecté", pt: "Conectado", es: "Conectado" }],
  [/^Not connected$/, { de: "Nicht verbunden", fr: "Non connecté", pt: "Não conectado", es: "Sin conectar" }],
  [/^Connect (YouTube|TikTok)$/, { de: "$1 verbinden", fr: "Connecter $1", pt: "Conectar $1", es: "Conectar $1" }],
  [/^Reconnect (YouTube|TikTok)$/, { de: "$1 neu verbinden", fr: "Reconnecter $1", pt: "Reconectar $1", es: "Reconectar $1" }],
  [/^Couldn’t reach heistclips\. Reload the page\.$/, { de: "heistclips ist nicht erreichbar. Lade die Seite neu.", fr: "Impossible de joindre heistclips. Recharge la page.", pt: "Não deu para falar com o heistclips. Recarregue a página.", es: "No se pudo conectar con heistclips. Recarga la página." }],
  [/^(YouTube|TikTok|It) is connected\. Go back to (Claude and ask it to post the clip|your clip and press Post)\.$/, by({
    de: (m) => `${m[1] === "It" ? "Dein Konto" : m[1]} ist verbunden. ` + (m[2][0] === "C" ? "Geh zurück zu Claude und sag ihm, es soll den Clip posten." : "Geh zurück zu deinem Clip und drück auf Posten."),
    fr: (m) => `${m[1] === "It" ? "Ton compte" : m[1]} est connecté. ` + (m[2][0] === "C" ? "Retourne dans Claude et demande-lui de poster le clip." : "Retourne à ton clip et appuie sur Poster."),
    pt: (m) => `${m[1] === "It" ? "Conta conectada" : m[1] + " conectado"}. ` + (m[2][0] === "C" ? "Volte ao Claude e peça para ele postar o clipe." : "Volte ao seu clipe e aperte Postar."),
    es: (m) => `${m[1] === "It" ? "Tu cuenta" : m[1]} quedó conectado. `.replace("cuenta quedó conectado", "cuenta quedó conectada") + (m[2][0] === "C" ? "Vuelve a Claude y pídele que publique el clip." : "Vuelve a tu clip y pulsa Publicar.") })],
  [/^(YouTube|TikTok) disconnected\.$/, { de: "$1 getrennt.", fr: "$1 déconnecté.", pt: "$1 desconectado.", es: "$1 desconectado." }],
  [/^That platform is not open yet\.$/, { de: "Diese Plattform ist noch nicht offen.", fr: "Cette plateforme n’est pas encore ouverte.", pt: "Essa plataforma ainda não está liberada.", es: "Esa plataforma aún no está abierta." }],
  [/^Unknown account\.( Reload the page\.)?$/, by({ de: (m) => "Unbekannter Account." + (m[1] ? " Lade die Seite neu." : ""), fr: (m) => "Compte inconnu." + (m[1] ? " Recharge la page." : ""), pt: (m) => "Conta desconhecida." + (m[1] ? " Recarregue a página." : ""), es: (m) => "Cuenta desconocida." + (m[1] ? " Recarga la página." : "") })],
  [/^That sign-in link expired\. Press Connect again\.$/, { de: "Der Anmelde-Link ist abgelaufen. Drück nochmal auf Verbinden.", fr: "Ce lien de connexion a expiré. Appuie de nouveau sur Connecter.", pt: "Esse link de login expirou. Aperte Conectar de novo.", es: "Ese enlace de inicio de sesión caducó. Pulsa Conectar otra vez." }],
  [/^(YouTube|TikTok) was not connected \((.*)\)\.$/, { de: "$1 wurde nicht verbunden ($2).", fr: "$1 n’a pas été connecté ($2).", pt: "O $1 não foi conectado ($2).", es: "$1 no se conectó ($2)." }],
  [/^YouTube was connected without the upload permission\. Press Connect again and leave the box ticked\.$/, { de: "YouTube wurde ohne die Upload-Erlaubnis verbunden. Drück nochmal auf Verbinden und lass das Häkchen gesetzt.", fr: "YouTube a été connecté sans l’autorisation d’envoi. Appuie de nouveau sur Connecter et laisse la case cochée.", pt: "O YouTube foi conectado sem a permissão de envio. Aperte Conectar de novo e deixe a caixa marcada.", es: "YouTube se conectó sin el permiso de subida. Pulsa Conectar otra vez y deja la casilla marcada." }],
  [/^Posted to (YouTube|TikTok):$/, { de: "Auf $1 gepostet:", fr: "Posté sur $1 :", pt: "Postado no $1:", es: "Publicado en $1:" }],
  [/^Posted to (YouTube|TikTok)\.(?: (.+))?$/, by({ de: (m) => `Auf ${m[1]} gepostet.` + (m[2] ? " " + note(m[2]) : ""), fr: (m) => `Posté sur ${m[1]}.` + (m[2] ? " " + note(m[2]) : ""), pt: (m) => `Postado no ${m[1]}.` + (m[2] ? " " + note(m[2]) : ""), es: (m) => `Publicado en ${m[1]}.` + (m[2] ? " " + note(m[2]) : "") })],
  [/^\. (.+)$/, by({ de: (m) => ". " + note(m[1]), fr: (m) => ". " + note(m[1]), pt: (m) => ". " + note(m[1]), es: (m) => ". " + note(m[1]) })],
  [/^Open in YouTube Studio$/, { de: "In YouTube Studio öffnen", fr: "Ouvrir dans YouTube Studio", pt: "Abrir no YouTube Studio", es: "Abrir en YouTube Studio" }],
  [/^((?:YouTube|TikTok) (?:is not connected|needs connecting again|refused the upload|upload failed).*|TikTok (?:is still reviewing|would not accept).*|That clip is not on file.*)$/, by({ de: (m) => note(m[1]), fr: (m) => note(m[1]), pt: (m) => note(m[1]), es: (m) => note(m[1]) })],
  // ---- the autopilot queue (queue.js, queuehand.js)
  [/^\((\d+)\) Your clip queue – heistclips$/, { de: "($1) Deine Clip-Warteschlange – heistclips", fr: "($1) Ta file de clips – heistclips", pt: "($1) Sua fila de clipes – heistclips", es: "($1) Tu cola de clips – heistclips" }],
  [/^Pays for (.+) clips$/, { de: "Zahlt für Clips von $1", fr: "Paie pour les clips de $1", pt: "Paga por clipes de $1", es: "Paga por clips de $1" }],
  [/^No campaign yet$/, { de: "Noch keine Kampagne", fr: "Pas encore de campagne", pt: "Nenhuma campanha ainda", es: "Aún sin campaña" }],
  [/^General fit · not a (.+) campaign$/, { de: "Passt allgemein · keine Kampagne für $1", fr: "Convient en général · pas une campagne $1", pt: "Encaixe geral · não é campanha de $1", es: "Encaje general · no es una campaña de $1" }],
  [/^pool$/, { de: "Pool", fr: "cagnotte", pt: "prêmio", es: "bolsa" }],
  [/^new$/, { de: "neu", fr: "nouveau", pt: "nova", es: "nueva" }],
  [/^prize pool$/, { de: "Preispool", fr: "cagnotte à partager", pt: "prêmio a dividir", es: "bolsa de premios" }],
  [/^(?:(\$[\d,.]+) shared by views|(typical per clip)|up to (\$[\d,.]+) a clip|(no payouts yet))(?: · (\$[\d,.]+)\/1k views)?$/, by({
    de: (m) => (m[1] ? `${m[1]}, geteilt nach Views` : m[2] ? "typisch pro Clip" : m[3] ? `bis ${m[3]} pro Clip` : "noch keine Auszahlungen") + (m[5] ? ` · ${m[5]}/1.000 Views` : ""),
    fr: (m) => (m[1] ? `${m[1]} à partager selon les vues` : m[2] ? "typique par clip" : m[3] ? `jusqu’à ${m[3]} par clip` : "aucun paiement pour l’instant") + (m[5] ? ` · ${m[5]}/1 000 vues` : ""),
    pt: (m) => (m[1] ? `${m[1]} divididos por views` : m[2] ? "típico por clipe" : m[3] ? `até ${m[3]} por clipe` : "nenhum pagamento ainda") + (m[5] ? ` · ${m[5]}/1.000 views` : ""),
    es: (m) => (m[1] ? `${m[1]} repartidos por vistas` : m[2] ? "típico por clip" : m[3] ? `hasta ${m[3]} por clip` : "aún sin pagos") + (m[5] ? ` · ${m[5]}/1.000 vistas` : "") })],
  [/^· (\$[\d,.]+) left$/, { de: "· $1 übrig", fr: "· $1 restants", pt: "· $1 restantes", es: "· quedan $1" }],
  [/^· (\$[\d,.]+) left · ([\d,.]+) clippers?$/, by({ de: (m) => `· ${m[1]} übrig · ${m[2]} Clipper`, fr: (m) => `· ${m[1]} restants · ${m[2]} clippeur${s(m[2])}`, pt: (m) => `· ${m[1]} restantes · ${m[2]} clipador${m[2] === "1" ? "" : "es"}`, es: (m) => `· quedan ${m[1]} · ${m[2]} clipper${s(m[2])}` })],
  [/^(\$[\d,.]+) typical per clip$/, { de: "typisch $1 pro Clip", fr: "$1 par clip en général", pt: "$1 por clipe, em geral", es: "$1 por clip, normalmente" }],
  [/^· (\$[\d,.]+) typical per clip$/, { de: "· typisch $1 pro Clip", fr: "· $1 par clip en général", pt: "· $1 por clipe, em geral", es: "· $1 por clip, normalmente" }],
  [/^(· )?new, up to (\$[\d,.]+) a clip$/, { de: "$1neu, bis $2 pro Clip", fr: "$1nouveau, jusqu’à $2 par clip", pt: "$1nova, até $2 por clipe", es: "$1nueva, hasta $2 por clip" }],
  [/^· new$/, { de: "· neu", fr: "· nouveau", pt: "· nova", es: "· nueva" }],
  [/^✓ (.+)$/, by({ de: (m) => "✓ " + chip(m[1]), fr: (m) => "✓ " + chip(m[1]), pt: (m) => "✓ " + chip(m[1]), es: (m) => "✓ " + chip(m[1]) })],
  [/^(GTA stream|campaign is for GTA.*|\d+ s fits .*|trim to .*|(?:length|audio|spoiler) rule in the brief|licensed music here: likely claimed|required tags in the brief|add their official sound to the clip|read the brief|apply first|US audience|Tier 1 audience|English|no watermark|length rule|spoiler rule|audio rule|tags\/caption rule)$/, by({ de: (m) => chip(m[1]), fr: (m) => chip(m[1]), pt: (m) => chip(m[1]), es: (m) => chip(m[1]) })],
  [/^A campaign you haven’t picked pays more:$/, { de: "Eine Kampagne, die du nicht gewählt hast, zahlt mehr:", fr: "Une campagne que tu n’as pas choisie paie plus :", pt: "Uma campanha que você não escolheu paga mais:", es: "Una campaña que no elegiste paga más:" }],
  [/^(none of your campaigns fits this clip|no live campaign names .+?)\.( Any GTA VI gameplay clip can go to:)?$/, by({
    de: (m) => chip(m[1]).replace(/^k/, "K") + "." + (m[2] ? " Jeder Gameplay-Clip aus GTA VI passt zu:" : ""),
    fr: (m) => chip(m[1]).replace(/^a/, "A") + "." + (m[2] ? " N’importe quel clip de gameplay GTA VI peut aller sur :" : ""),
    pt: (m) => chip(m[1]).replace(/^n/, "N") + "." + (m[2] ? " Qualquer clipe de gameplay de GTA VI pode ir para:" : ""),
    es: (m) => chip(m[1]).replace(/^n/, "N") + "." + (m[2] ? " Cualquier clip de gameplay de GTA VI puede ir a:" : "") })],
  [/^See what pays$/, { de: "Sieh, was zahlt", fr: "Voir ce qui paie", pt: "Ver o que paga", es: "Ver qué paga" }],
  [/^Cutting this clip on our server… (\d+) s \(takes about a minute; keep this page open\)$/, { de: "Der Clip wird auf unserem Server geschnitten… $1 s (dauert etwa eine Minute; lass die Seite offen)", fr: "Découpe du clip sur notre serveur… $1 s (compte environ une minute ; garde cette page ouverte)", pt: "Cortando este clipe no nosso servidor… $1 s (leva cerca de um minuto; deixe esta página aberta)", es: "Cortando este clip en nuestro servidor… $1 s (tarda cerca de un minuto; deja esta página abierta)" }],
  [/^You’ve used your free clips\.$/, { de: "Deine Gratis-Clips sind aufgebraucht.", fr: "Tu as utilisé tes clips gratuits.", pt: "Você já usou seus clipes grátis.", es: "Ya usaste tus clips gratis." }],
  [/^Buy a pack$/, { de: "Kauf ein Paket", fr: "Prends un pack", pt: "Compre um pacote", es: "Compra un paquete" }],
  [/^\(50 clips for \$5\) and come straight back\.$/, { de: "(50 Clips für $5) und komm direkt zurück.", fr: "(50 clips pour 5 $) et reviens direct ici.", pt: "(50 clipes por US$ 5) e volte direto para cá.", es: "(50 clips por 5 USD) y vuelve directo aquí." }],
  [/^(The cut failed\. Nothing was charged\.|The connection dropped\. .*|something broke; try again|unknown queue|that link is out of date|too many tries; .*|a link was just sent; .*|that does not look like an email address)$/, by({ de: (m) => chip(m[1]), fr: (m) => chip(m[1]), pt: (m) => chip(m[1]), es: (m) => chip(m[1]) })],
  [/^Download MP4 \(([\d.]+) MB\)$/, { de: "MP4 herunterladen ($1 MB)", fr: "Télécharger le MP4 ($1 Mo)", pt: "Baixar MP4 ($1 MB)", es: "Descargar MP4 ($1 MB)" }],
  [/^1080×1920, (\d+) s\. (?:(\d+) free clips? left(?: \+ (\d+) paid)?\. )?On iPhone: press and hold the video, then Save\.$/, by({
    de: (m) => `1080×1920, ${m[1]} s. ${m[2] ? `Noch ${m[2]} Gratis-Clip${s(m[2])}${m[3] ? ` + ${m[3]} gekauft` : ""}. ` : ""}Auf dem iPhone: Video gedrückt halten, dann Sichern.`,
    fr: (m) => `1080×1920, ${m[1]} s. ${m[2] ? `${m[2]} clip${s(m[2])} gratuit${s(m[2])} restant${s(m[2])}${m[3] ? ` + ${m[3]} payé${s(m[3])}` : ""}. ` : ""}Sur iPhone : appui long sur la vidéo, puis Enregistrer.`,
    pt: (m) => `1080×1920, ${m[1]} s. ${m[2] ? `${m[2]} clipe${s(m[2])} grátis restante${s(m[2])}${m[3] ? ` + ${m[3]} pago${s(m[3])}` : ""}. ` : ""}No iPhone: toque e segure o vídeo, depois Salvar.`,
    es: (m) => `1080×1920, ${m[1]} s. ${m[2] ? `Te queda${m[2] === "1" ? "" : "n"} ${m[2]} clip${s(m[2])} gratis${m[3] ? ` + ${m[3]} de pago` : ""}. ` : ""}En iPhone: mantén pulsado el video y luego Guardar.` })],
  [/^chat ([\d.]+)× normal$/, { de: "Chat $1× so schnell wie sonst", fr: "chat $1× la normale", pt: "chat $1× o normal", es: "chat $1× lo normal" }],
  [/^(\d+) “clip it”$/, { de: "$1× „clip it“", fr: "$1 « clip it »", pt: "$1 “clip it”", es: "$1 «clip it»" }],
  [/^clipped on Twitch (\d+)×$/, { de: "$1× auf Twitch geclippt", fr: "clippé $1× sur Twitch", pt: "clipado $1× na Twitch", es: "clipeado $1× en Twitch" }],
  [/^· (.+) · (just now|\d+ (?:min|h|d) ago)( ·)?$/, by({
    de: (m) => `· ${m[1] === "stream" ? "Stream" : m[1]} · ${ago(m[2])}${m[3] || ""}`, fr: (m) => `· ${m[1]} · ${ago(m[2])}${m[3] || ""}`,
    pt: (m) => `· ${m[1] === "stream" ? "live" : m[1]} · ${ago(m[2])}${m[3] || ""}`, es: (m) => `· ${m[1] === "stream" ? "directo" : m[1]} · ${ago(m[2])}${m[3] || ""}` })],
  [/^(\d+ (?:min|h|d) ago)$/, by({ de: (m) => ago(m[1]), fr: (m) => ago(m[1]), pt: (m) => ago(m[1]), es: (m) => ago(m[1]) })],
  [/^Export 9:16$/, { de: "9:16 exportieren", fr: "Exporter en 9:16", pt: "Exportar 9:16", es: "Exportar 9:16" }],
  [/^Copy caption$/, { de: "Caption kopieren", fr: "Copier la légende", pt: "Copiar legenda", es: "Copiar descripción" }],
  [/^Copied$/, { de: "Kopiert", fr: "Copié", pt: "Copiado", es: "Copiado" }],
  [/^Skip$/, { de: "Überspringen", fr: "Passer", pt: "Pular", es: "Saltar" }],
  [/^Skip this clip$/, { de: "Diesen Clip überspringen", fr: "Passer ce clip", pt: "Pular este clipe", es: "Saltar este clip" }],
  [/^No editor: cut it for me \(about a minute\)$/, { de: "Ohne Editor: schneid ihn für mich (etwa eine Minute)", fr: "Sans éditeur : coupe-le pour moi (environ une minute)", pt: "Sem editor: corte para mim (cerca de um minuto)", es: "Sin editor: córtalo por mí (cerca de un minuto)" }],
  [/^Watch$/, { de: "Beobachten", fr: "Suivre", pt: "Acompanhar", es: "Seguir" }],
  [/^Watch (.+)$/, { de: "$1 beobachten", fr: "Suivre $1", pt: "Acompanhar $1", es: "Seguir a $1" }],
  [/^Stop watching (.+)$/, { de: "$1 nicht mehr beobachten", fr: "Ne plus suivre $1", pt: "Parar de acompanhar $1", es: "Dejar de seguir a $1" }],
  [/^live now$/, { de: "jetzt live", fr: "en live", pt: "ao vivo agora", es: "en vivo ahora" }],
  [/^Show all (\d+)$/, { de: "Alle $1 zeigen", fr: "Afficher les $1", pt: "Mostrar todos os $1", es: "Mostrar los $1" }],
  [/^No campaign pays for (.+) clips right now\.( Closest that pay:)?$/, by({
    de: (m) => `Gerade zahlt keine Kampagne für Clips von ${m[1].replace(/ or /g, OR.de)}.` + (m[2] ? " Am nächsten dran, mit Bezahlung:" : ""),
    fr: (m) => `Aucune campagne ne paie pour les clips de ${m[1].replace(/ or /g, OR.fr)} en ce moment.` + (m[2] ? " Les plus proches qui paient :" : ""),
    pt: (m) => `Nenhuma campanha paga por clipes de ${m[1].replace(/ or /g, OR.pt)} agora.` + (m[2] ? " As mais próximas que pagam:" : ""),
    es: (m) => `Ninguna campaña paga por clips de ${m[1].replace(/ or /g, OR.es)} ahora mismo.` + (m[2] ? " Las más cercanas que pagan:" : "") })],
  [/^· not found$/, { de: "· nicht gefunden", fr: "· introuvable", pt: "· não encontrado", es: "· no encontrado" }],
  [/^· (\d+) campaigns?$/, by({ de: (m) => `· ${m[1]} Kampagne${m[1] === "1" ? "" : "n"}`, fr: (m) => `· ${m[1]} campagne${s(m[1])}`, pt: (m) => `· ${m[1]} campanha${s(m[1])}`, es: (m) => `· ${m[1]} campaña${s(m[1])}` })],
  [/^: (no channel with that name|live, but this channel does not save streams, so there is no video to cut|the newest stream's video is not public)$/, by({ de: (m) => ": " + chip(m[1]), fr: (m) => " : " + chip(m[1]), pt: (m) => ": " + chip(m[1]), es: (m) => ": " + chip(m[1]) })],
  [/^Nothing in the queue yet\. Chat hasn’t spiked in the streams you watch, or they haven’t streamed lately\. New moments land here within about 10 minutes of happening\.$/, { de: "Noch nichts in der Warteschlange. In den Streams, die du beobachtest, ist der Chat nicht ausgerastet, oder sie haben länger nicht gestreamt. Neue Momente landen hier etwa 10 Minuten, nachdem sie passiert sind.", fr: "Rien dans la file pour l’instant. Le chat n’a pas explosé dans les streams que tu suis, ou ils n’ont pas streamé récemment. Les nouveaux moments arrivent ici dans les 10 minutes environ.", pt: "Nada na fila ainda. O chat não explodiu nas lives que você acompanha, ou eles não fizeram live ultimamente. Momentos novos chegam aqui uns 10 minutos depois de acontecer.", es: "Aún no hay nada en la cola. El chat no explotó en los directos que sigues, o no han transmitido últimamente. Los momentos nuevos llegan aquí unos 10 minutos después de pasar." }],
  [/^Your cut clips$/, { de: "Deine geschnittenen Clips", fr: "Tes clips coupés", pt: "Seus clipes cortados", es: "Tus clips cortados" }],
  [/^Kept for 72 hours\.$/, { de: "Bleiben 72 Stunden hier.", fr: "Gardés 72 heures.", pt: "Ficam guardados por 72 horas.", es: "Se guardan 72 horas." }],
  [/^(\d+) clips? already exported or skipped\.$/, by({ de: (m) => `${m[1]} Clip${s(m[1])} schon exportiert oder übersprungen.`, fr: (m) => `${m[1]} clip${s(m[1])} déjà exporté${s(m[1])} ou passé${s(m[1])}.`, pt: (m) => `${m[1]} clipe${s(m[1])} já exportado${s(m[1])} ou pulado${s(m[1])}.`, es: (m) => `${m[1]} clip${s(m[1])} ya exportado${s(m[1])} o saltado${s(m[1])}.` })],
  [/^Tell me when clips are ready$/, { de: "Sag mir Bescheid, wenn Clips fertig sind", fr: "Préviens-moi quand des clips sont prêts", pt: "Me avise quando houver clipes prontos", es: "Avísame cuando haya clips listos" }],
  [/^(?:Emailing (\S+)\. ?|Check (\S+) for the link to confirm\. ?)?(?:Notifications are on in (\d+) browsers?\.)?$/, by({
    de: (m) => (m[1] ? `E-Mails gehen an ${m[1]}. ` : m[2] ? `Schau bei ${m[2]} nach dem Link zum Bestätigen. ` : "") + (m[3] ? `Benachrichtigungen sind in ${m[3]} Browser${m[3] === "1" ? "" : "n"} an.` : ""),
    fr: (m) => (m[1] ? `E-mails envoyés à ${m[1]}. ` : m[2] ? `Regarde ${m[2]} : le lien pour confirmer y est. ` : "") + (m[3] ? `Notifications activées dans ${m[3]} navigateur${s(m[3])}.` : ""),
    pt: (m) => (m[1] ? `Enviando e-mails para ${m[1]}. ` : m[2] ? `Olhe ${m[2]} e abra o link para confirmar. ` : "") + (m[3] ? `Notificações ligadas em ${m[3]} navegador${m[3] === "1" ? "" : "es"}.` : ""),
    es: (m) => (m[1] ? `Enviando correos a ${m[1]}. ` : m[2] ? `Revisa ${m[2]} y abre el enlace para confirmar. ` : "") + (m[3] ? `Notificaciones activadas en ${m[3]} navegador${m[3] === "1" ? "" : "es"}.` : "") })],
  [/^Turn on notifications$/, { de: "Benachrichtigungen einschalten", fr: "Activer les notifications", pt: "Ligar notificações", es: "Activar notificaciones" }],
  [/^or your email$/, { de: "oder deine E-Mail", fr: "ou ton e-mail", pt: "ou seu e-mail", es: "o tu correo" }],
  [/^Email address$/, { de: "E-Mail-Adresse", fr: "Adresse e-mail", pt: "Endereço de e-mail", es: "Dirección de correo" }],
  [/^Email me$/, { de: "Per E-Mail", fr: "M’écrire", pt: "Me avise por e-mail", es: "Avísame por correo" }],
  [/^Your queue on another device$/, { de: "Deine Warteschlange auf einem anderen Gerät", fr: "Ta file sur un autre appareil", pt: "Sua fila em outro aparelho", es: "Tu cola en otro dispositivo" }],
  [/^This private link opens the same queue anywhere\. Don’t share it\.$/, { de: "Dieser private Link öffnet dieselbe Warteschlange überall. Gib ihn nicht weiter.", fr: "Ce lien privé ouvre la même file partout. Ne le partage pas.", pt: "Este link privado abre a mesma fila em qualquer lugar. Não compartilhe.", es: "Este enlace privado abre la misma cola en cualquier lugar. No lo compartas." }],
  [/^Private link to this queue$/, { de: "Privater Link zu dieser Warteschlange", fr: "Lien privé vers cette file", pt: "Link privado desta fila", es: "Enlace privado a esta cola" }],
  [/^Copy link$/, { de: "Link kopieren", fr: "Copier le lien", pt: "Copiar link", es: "Copiar enlace" }],
  [/^Reading (.+)’s latest stream… about 15 seconds\.$/, { de: "Der letzte Stream von $1 wird gelesen… etwa 15 Sekunden.", fr: "Lecture du dernier stream de $1… environ 15 secondes.", pt: "Lendo a última live de $1… uns 15 segundos.", es: "Leyendo el último directo de $1… unos 15 segundos." }],
  [/^Saving…$/, { de: "Wird gespeichert…", fr: "Enregistrement…", pt: "Salvando…", es: "Guardando…" }],
  [/^No channel called (.+)\.$/, { de: "Kein Kanal namens $1.", fr: "Aucune chaîne nommée $1.", pt: "Nenhum canal chamado $1.", es: "No hay ningún canal llamado $1." }],
  [/^Couldn’t read that stream just now; it will be tried again in 10 minutes\.$/, { de: "Der Stream ließ sich gerade nicht lesen; in 10 Minuten wird es nochmal versucht.", fr: "Impossible de lire ce stream pour l’instant ; nouvel essai dans 10 minutes.", pt: "Não deu para ler essa live agora; vamos tentar de novo em 10 minutos.", es: "No se pudo leer ese directo ahora; se volverá a intentar en 10 minutos." }],
  [/^(live, but this channel does not save streams, so there is no video to cut|the newest stream's video is not public)\.$/, by({ de: (m) => chip(m[1]).replace(/^./, (c) => c.toUpperCase()) + ".", fr: (m) => chip(m[1]).replace(/^./, (c) => c.toUpperCase()) + ".", pt: (m) => chip(m[1]).replace(/^./, (c) => c.toUpperCase()) + ".", es: (m) => chip(m[1]).replace(/^./, (c) => c.toUpperCase()) + "." })],
  [/^(\d+) clips? ready from (.+)\.$/, by({ de: (m) => `${m[1]} Clip${s(m[1])} von ${m[2]} fertig.`, fr: (m) => `${m[1]} clip${s(m[1])} prêt${s(m[1])} pour ${m[2]}.`, pt: (m) => `${m[1]} clipe${s(m[1])} pronto${s(m[1])} de ${m[2]}.`, es: (m) => `${m[1]} clip${s(m[1])} listo${s(m[1])} de ${m[2]}.` })],
  [/^No clear chat spikes in (.+)’s latest stream\. New ones land here within about 10 minutes\.$/, { de: "Im letzten Stream von $1 gab es keine klaren Chat-Ausschläge. Neue landen hier in etwa 10 Minuten.", fr: "Pas de pic net dans le chat du dernier stream de $1. Les nouveaux arrivent ici dans les 10 minutes environ.", pt: "Nenhum pico claro no chat da última live de $1. Os novos chegam aqui em uns 10 minutos.", es: "No hubo picos claros de chat en el último directo de $1. Los nuevos llegan aquí en unos 10 minutos." }],
  [/^Loading your queue…$/, { de: "Deine Warteschlange wird geladen…", fr: "Chargement de ta file…", pt: "Carregando sua fila…", es: "Cargando tu cola…" }],
  [/^That queue link doesn’t exist any more\. Start a new one below\.$/, { de: "Diesen Warteschlangen-Link gibt es nicht mehr. Fang unten eine neue an.", fr: "Ce lien de file n’existe plus. Commences-en une nouvelle ci-dessous.", pt: "Esse link de fila não existe mais. Comece uma nova abaixo.", es: "Ese enlace de cola ya no existe. Empieza una nueva abajo." }],
  [/^Type a Twitch channel name, or a kick\.com\/… link\.$/, { de: "Tipp einen Twitch-Kanalnamen ein oder einen kick.com/…-Link.", fr: "Tape le nom d’une chaîne Twitch, ou un lien kick.com/…", pt: "Digite o nome de um canal da Twitch ou um link kick.com/…", es: "Escribe el nombre de un canal de Twitch o un enlace kick.com/…" }],
  [/^Already watching that one\.$/, { de: "Den beobachtest du schon.", fr: "Tu le suis déjà.", pt: "Você já acompanha esse.", es: "Ya sigues a ese." }],
  [/^That’s the limit: 12 streamers\. Remove one first\.$/, { de: "Das ist das Limit: 12 Streamer. Nimm erst einen raus.", fr: "C’est la limite : 12 streamers. Retires-en un d’abord.", pt: "Esse é o limite: 12 streamers. Tire um antes.", es: "Ese es el límite: 12 streamers. Quita uno primero." }],
  [/^Sent\. Open the link in the mail to (\S+) to confirm\.$/, { de: "Verschickt. Öffne den Link in der Mail an $1 zum Bestätigen.", fr: "Envoyé. Ouvre le lien dans le mail envoyé à $1 pour confirmer.", pt: "Enviado. Abra o link no e-mail enviado para $1 para confirmar.", es: "Enviado. Abre el enlace del correo enviado a $1 para confirmar." }],
  [/^Couldn’t send that mail\.$/, { de: "Die Mail ließ sich nicht verschicken.", fr: "Impossible d’envoyer ce mail.", pt: "Não deu para enviar esse e-mail.", es: "No se pudo enviar ese correo." }],
  [/^On iPhone, add heistclips to your Home Screen first \(Share → Add to Home Screen\), or use email below\.$/, { de: "Auf dem iPhone: Leg heistclips erst auf den Home-Bildschirm (Teilen → Zum Home-Bildschirm) oder nimm unten die E-Mail.", fr: "Sur iPhone, ajoute d’abord heistclips à l’écran d’accueil (Partager → Sur l’écran d’accueil), ou utilise l’e-mail ci-dessous.", pt: "No iPhone, coloque o heistclips na Tela de Início antes (Compartilhar → Adicionar à Tela de Início) ou use o e-mail abaixo.", es: "En iPhone, primero agrega heistclips a la pantalla de inicio (Compartir → Agregar a inicio), o usa el correo de abajo." }],
  [/^This browser can’t show notifications\. Use email below\.$/, { de: "Dieser Browser kann keine Benachrichtigungen zeigen. Nimm unten die E-Mail.", fr: "Ce navigateur ne peut pas afficher de notifications. Utilise l’e-mail ci-dessous.", pt: "Este navegador não mostra notificações. Use o e-mail abaixo.", es: "Este navegador no puede mostrar notificaciones. Usa el correo de abajo." }],
  [/^Notifications aren’t set up yet\. Use email below\.$/, { de: "Benachrichtigungen sind noch nicht eingerichtet. Nimm unten die E-Mail.", fr: "Les notifications ne sont pas encore en place. Utilise l’e-mail ci-dessous.", pt: "As notificações ainda não estão prontas. Use o e-mail abaixo.", es: "Las notificaciones aún no están listas. Usa el correo de abajo." }],
  [/^Notifications are blocked for this site in your browser settings\.$/, { de: "Benachrichtigungen sind für diese Seite in deinen Browser-Einstellungen blockiert.", fr: "Les notifications sont bloquées pour ce site dans les réglages de ton navigateur.", pt: "As notificações deste site estão bloqueadas nas configurações do seu navegador.", es: "Las notificaciones de este sitio están bloqueadas en la configuración de tu navegador." }],
  [/^Notifications are on\. You’ll get one when new clips land\.$/, { de: "Benachrichtigungen sind an. Du bekommst eine, sobald neue Clips da sind.", fr: "Notifications activées. Tu en recevras une quand de nouveaux clips arrivent.", pt: "Notificações ligadas. Você recebe uma quando chegarem clipes novos.", es: "Notificaciones activadas. Recibirás una cuando lleguen clips nuevos." }],
  [/^Couldn’t turn notifications on(?:: (.*)|\.)$/, by({ de: (m) => "Benachrichtigungen ließen sich nicht einschalten" + (m[1] ? ": " + m[1] : "."), fr: (m) => "Impossible d’activer les notifications" + (m[1] ? " : " + m[1] : "."), pt: (m) => "Não deu para ligar as notificações" + (m[1] ? ": " + m[1] : "."), es: (m) => "No se pudieron activar las notificaciones" + (m[1] ? ": " + m[1] : ".") })],
  [/^Confirmed\. New clips will be emailed to (\S+)\.$/, { de: "Bestätigt. Neue Clips kommen per E-Mail an $1.", fr: "Confirmé. Les nouveaux clips seront envoyés par e-mail à $1.", pt: "Confirmado. Os clipes novos vão por e-mail para $1.", es: "Confirmado. Los clips nuevos llegarán por correo a $1." }],
  [/^Emails are off\.$/, { de: "E-Mails sind aus.", fr: "E-mails désactivés.", pt: "E-mails desligados.", es: "Correos desactivados." }],
  [/^From your$/, { de: "Aus deiner", fr: "Depuis ta", pt: "Da sua", es: "De tu" }],
  [/^queue$/, { de: "Warteschlange", fr: "file", pt: "fila", es: "cola" }],
  [/^· for$/, { de: "· für", fr: "· pour", pt: "· para", es: "· para" }],
  [/^this campaign$/, { de: "diese Kampagne", fr: "cette campagne", pt: "esta campanha", es: "esta campaña" }],
  [/^See every moment in this stream$/, { de: "Alle Momente in diesem Stream ansehen", fr: "Voir tous les moments de ce stream", pt: "Ver todos os momentos desta live", es: "Ver todos los momentos de este directo" }],
  // ---- editor leftovers found by driving it: the facecam position picker and the spoiler reason
  [/^(top|middle|bottom) (left|right)$/, by({
    de: (m) => ({ top: "oben", middle: "Mitte", bottom: "unten" })[m[1]] + " " + (m[2] === "left" ? "links" : "rechts"),
    fr: (m) => ({ top: "en haut", middle: "au milieu", bottom: "en bas" })[m[1]] + " à " + (m[2] === "left" ? "gauche" : "droite"),
    pt: (m) => ({ top: "em cima", middle: "no meio", bottom: "embaixo" })[m[1]] + " à " + (m[2] === "left" ? "esquerda" : "direita"),
    es: (m) => ({ top: "arriba", middle: "en medio", bottom: "abajo" })[m[1]] + " a la " + (m[2] === "left" ? "izquierda" : "derecha") })],
  [/^chat (warns about spoilers|is talking about the ending|is reacting to a story scene): (\d+) lines?( \(.*\))?(; the title marks this as a story stream)?$/, by({
    de: (m) => `${SPOIL[m[1]].de}: ${m[2]} Zeile${m[2] === "1" ? "" : "n"}${m[3] || ""}${m[4] ? "; der Titel kennzeichnet das als Story-Stream" : ""}`,
    fr: (m) => `${SPOIL[m[1]].fr} : ${m[2]} ligne${s(m[2])}${m[3] || ""}${m[4] ? " ; le titre indique un stream sur l’histoire" : ""}`,
    pt: (m) => `${SPOIL[m[1]].pt}: ${m[2]} linha${s(m[2])}${m[3] || ""}${m[4] ? "; o título indica que é uma live de história" : ""}`,
    es: (m) => `${SPOIL[m[1]].es}: ${m[2]} línea${s(m[2])}${m[3] || ""}${m[4] ? "; el título indica que es un directo de historia" : ""}` })],
  [/^● New moment – heistclips$/, { de: "● Neuer Moment – heistclips", fr: "● Nouveau moment – heistclips", pt: "● Momento novo – heistclips", es: "● Momento nuevo – heistclips" }],
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
const LOCAL = /^\/(?:$|\?|(?:clip|pricing|requests|guides|queue|post|streamers|data|connect|about|privacy|terms|most-clipped-streams|twitch-clip-maker|kick-clip-maker|gta-6-clipping-campaigns|gta-6-clipping-rates-today)(?:$|[?#])|(?:guides|campaigns)\/[a-z0-9-]+(?:$|[?#])|streamers\/(?:kick\/)?[a-z0-9_-]+(?:$|[?#]))/;
const SKIP = "script,style,textarea,.quote,[data-notr],.src .t > b,.resp,code,pre,.q-hook,.q-quote,.q-files a";
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
  // The queue puts its count in the tab title.
  const title = document.querySelector("title");
  if (title) new MutationObserver(() => { const t = tr(document.title); if (t !== document.title) document.title = t; }).observe(title, { childList: true, characterData: true, subtree: true });
  // Only what scripts add later is English; the page itself arrives translated from the server.
  scope.querySelectorAll("#app, #reqmsg, .rnote, .note").forEach(walk);
}
