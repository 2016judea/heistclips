// German and French for everything the clip tool and the request board write into the page
// after load. The tool's code (app.js, live.js, requests.js) writes English; this module, loaded
// only on /de and /fr pages, rewrites each piece of text as it appears. It lives apart from the
// tool so that the people changing the tool never have to touch a translation, and a line they
// add that is not listed here simply shows in English until it is.
//
// Never translated: chat lines, stream titles, hook text boxes, and what people post on the board.
const lang = (document.documentElement.lang || "en").slice(0, 2);
const L = lang === "de" ? 1 : lang === "fr" ? 2 : 0;

const LEVEL = { low: ["niedrig", "faible"], medium: ["mittel", "moyen"], high: ["hoch", "élevé"] };
const lv = (x) => (LEVEL[x] ? LEVEL[x][L - 1] : x);
const WHY = [
  [/^Twitch muted this audio for licensed music; YouTube and TikTok will likely claim it too$/, "Twitch hat hier den Ton wegen lizenzierter Musik stummgeschaltet; YouTube und TikTok werden das wahrscheinlich auch claimen", "Twitch a coupé le son ici pour musique sous licence ; YouTube et TikTok vont probablement le réclamer aussi"],
  [/^chat mentions music (\d+) times here; check for in-game radio$/, "der Chat erwähnt hier $1-mal Musik; prüf, ob das Radio im Spiel läuft", "le chat parle de musique $1 fois ici ; vérifie si la radio du jeu tourne"],
  [/^no muted audio and chat does not mention music$/, "kein stummer Ton, und der Chat erwähnt keine Musik", "pas de son coupé, et le chat ne parle pas de musique"],
];
const why = (s) => { for (const r of WHY) if (r[0].test(s)) return s.replace(r[0], r[L]); return s; };
const live = (m, de, fr) => (m ? (L === 1 ? de : fr) : "");
const WATCH = ["", " Der Live-Chat wird weiter beobachtet.", " On continue de suivre le chat en live."];

// [pattern, German, French]. A string uses $1, $2…; a function gets the match.
const RULES = [
  // ---- looking up, reading
  [/^Looking up (.+)…$/, "Suche $1…", "Recherche de $1…"],
  [/^Reading chat( so far)?…( Kick limits.*)?$/, (m) => "Chat wird gelesen…" + (m[2] ? " Kick bremst das Lesen des Chats, das dauert rund 2 Minuten." : ""), (m) => "Lecture du chat…" + (m[2] ? " Kick limite la vitesse de lecture du chat : compte environ 2 minutes." : "")],
  [/^Connecting to chat…$/, "Verbinde mit dem Chat…", "Connexion au chat…"],
  [/^Finding the biggest live GTA stream…$/, "Suche den größten GTA-Livestream…", "Recherche du plus gros live GTA…"],
  [/^(\d+) moments? from ([\d:]+) of stream, in (\d+) s(\. Watching live chat for new ones\.|\.)?$/, (m) => `${m[1]} Momente aus ${m[2]} Stream, in ${m[3]} s.${/Watching/.test(m[4] || "") ? WATCH[1] : ""}`, (m) => `${m[1]} moments sur ${m[2]} de stream, en ${m[3]} s.${/Watching/.test(m[4] || "") ? WATCH[2] : ""}`],
  [/^(\d+) moments? from the last 2 hours\. Still reading the earlier ([\d:]+)…$/, "$1 Momente aus den letzten 2 Stunden. Die früheren $2 werden noch gelesen…", "$1 moments sur les 2 dernières heures. Lecture des $2 précédentes en cours…"],
  [/^Chat stayed calm all stream, so these are its (\d+) best moments, not big spikes\.?( Watching live chat for new ones\.)?$/, (m) => `Der Chat blieb den ganzen Stream ruhig. Das sind seine ${m[1]} besten Momente, keine großen Ausschläge.${m[2] ? WATCH[1] : ""}`, (m) => `Le chat est resté calme tout le stream : voici ses ${m[1]} meilleurs moments, pas de gros pics.${m[2] ? WATCH[2] : ""}`],
  [/^Chat barely moved in this stream, so there is no moment worth cutting\.( Watching live chat for new ones\.)?$/, (m) => "Der Chat hat sich in diesem Stream kaum bewegt, es gibt keinen Moment, der sich lohnt." + (m[1] ? WATCH[1] : ""), (m) => "Le chat a à peine bougé pendant ce stream : aucun moment ne vaut le coup." + (m[1] ? WATCH[2] : "")],
  [/^Nobody typed in chat during this stream, so there is nothing to find moments from\.( Watching live chat for new ones\.)?$/, (m) => "In diesem Stream hat niemand im Chat geschrieben, also gibt es nichts, woraus sich Momente finden lassen." + (m[1] ? WATCH[1] : ""), (m) => "Personne n’a écrit dans le chat pendant ce stream : il n’y a rien pour repérer des moments." + (m[1] ? WATCH[2] : "")],
  [/^The last 2 hours$/, "Die letzten 2 Stunden", "Les 2 dernières heures"],
  [/^Earlier in this stream$/, "Früher in diesem Stream", "Plus tôt dans ce stream"],
  [/^Live moments$/, "Live-Momente", "Moments en live"],
  // ---- never a dead end
  [/^Live in GTA right now\. Tap one to clip it\.$/, "Gerade live in GTA. Tipp einen an, um ihn zu clippen.", "En live sur GTA en ce moment. Touche-en un pour le clipper."],
  [/^Finding who’s live…$/, "Suche, wer live ist…", "Recherche des lives…"],
  [/^([\d.]+[kM]?) watching · (.+)$/, "$1 schauen zu · $2", "$1 spectateurs · $2"],
  [/^Nobody is live in GTA with a saved stream this minute\.$/, "Gerade ist in GTA niemand mit gespeichertem Stream live.", "Personne n’est en live sur GTA avec un stream enregistré à cette minute."],
  [/^See recent streams$/, "Letzte Streams ansehen", "Voir les streams récents"],
  [/^Whose stream\? Type a streamer’s name or paste their link, or pick one below\.$/, "Wessen Stream? Tipp den Namen eines Streamers ein, füg seinen Link ein oder such dir unten einen aus.", "Le stream de qui ? Tape le nom d’un streamer, colle son lien, ou choisis-en un ci-dessous."],
  [/^YouTube streams can’t be read yet: heistclips reads Twitch and Kick\.$/, "YouTube-Streams lassen sich noch nicht lesen: heistclips liest Twitch und Kick.", "Les streams YouTube ne sont pas encore lisibles : heistclips lit Twitch et Kick."],
  [/^Vote for YouTube Live$/, "Für YouTube Live abstimmen", "Voter pour YouTube Live"],
  [/^, or clip one of these\.$/, " oder clippe einen von diesen.", ", ou clippe l’un de ceux-ci."],
  [/^That isn’t a Twitch or Kick channel or video\. Paste a link like these:$/, "Das ist kein Kanal oder Video von Twitch oder Kick. Füg einen Link wie diese ein:", "Ce n’est ni une chaîne ni une vidéo Twitch ou Kick. Colle un lien comme ceux-ci :"],
  [/^No (Kick|Twitch) channel called$/, "Kein $1-Kanal namens", "Aucune chaîne $1 nommée"],
  [/^has no saved Kick streams to read\.$/, "hat keine gespeicherten Kick-Streams zum Lesen.", "n’a aucun stream Kick enregistré à lire."],
  [/^That Kick video doesn’t exist or isn’t public\.$/, "Dieses Kick-Video gibt es nicht, oder es ist nicht öffentlich.", "Cette vidéo Kick n’existe pas ou n’est pas publique."],
  [/^That VOD doesn’t exist or isn’t public\.$/, "Dieses VOD gibt es nicht, oder es ist nicht öffentlich.", "Cette VOD n’existe pas ou n’est pas publique."],
  [/^That Twitch clip doesn’t exist any more\.$/, "Diesen Twitch-Clip gibt es nicht mehr.", "Ce clip Twitch n’existe plus."],
  [/^Opened the stream that clip was cut from, at the same second\.$/, "Der Stream, aus dem der Clip stammt, ist geöffnet, an derselben Sekunde.", "Le stream d’où vient ce clip est ouvert, à la même seconde."],
  [/^The stream that clip came from has been deleted\.$/, "Der Stream, aus dem der Clip stammt, wurde gelöscht.", "Le stream d’où vient ce clip a été supprimé."],
  [/^The stream that clip came from has been deleted, so this is (.+)’s latest stream\.$/, "Der Stream, aus dem der Clip stammt, wurde gelöscht. Das hier ist der letzte Stream von $1.", "Le stream d’où vient ce clip a été supprimé : voici le dernier stream de $1."],
  [/^Showing$/, "Zeige", "Voici"],
  [/^for “(.+)”\.$/, "für „$1“.", "pour « $1 »."],
  [/^is live, but Twitch isn’t saving this stream, so there’s no video to cut\.$/, "ist live, aber Twitch speichert diesen Stream nicht, es gibt also kein Video zum Schneiden.", "est en live, mais Twitch n’enregistre pas ce stream : il n’y a pas de vidéo à couper."],
  [/^has no saved streams on Twitch\.( Did you mean)?$/, (m) => "hat auf Twitch keine gespeicherten Streams." + (m[1] ? " Meintest du" : ""), (m) => "n’a aucun stream enregistré sur Twitch." + (m[1] ? " Tu voulais dire" : "")],
  [/^is live right now, but Twitch isn’t saving this stream, so there’s no video of it to cut\. These moments are from the last saved stream \((.+)\)\.$/, "ist gerade live, aber Twitch speichert diesen Stream nicht, es gibt also kein Video davon. Diese Momente stammen aus dem letzten gespeicherten Stream ($1).", "est en live en ce moment, mais Twitch n’enregistre pas ce stream : pas de vidéo à couper. Ces moments viennent du dernier stream enregistré ($1)."],
  [/^Couldn’t reach (Twitch|Kick): (.*)\.$/, "$1 ist nicht erreichbar: $2.", "Impossible de joindre $1 : $2."],
  [/^Try again$/, "Nochmal versuchen", "Réessayer"],
  [/^This stream’s video isn’t public \(subscriber-only or deleted\), so it can’t be cut\.$/, "Das Video dieses Streams ist nicht öffentlich (nur für Abonnenten oder gelöscht) und lässt sich deshalb nicht schneiden.", "La vidéo de ce stream n’est pas publique (réservée aux abonnés ou supprimée) : impossible de la couper."],
  [/^(Twitch|Kick) stopped answering \((.*)\)\.$/, "$1 antwortet nicht mehr ($2).", "$1 ne répond plus ($2)."],
  [/^Try (.+)’s other streams:$/, "Probier andere Streams von $1:", "Essaie d’autres streams de $1 :"],
  // ---- source card, credits
  [/^Other streams:$/, "Andere Streams:", "Autres streams :"],
  [/^Untitled stream$/, "Stream ohne Titel", "Stream sans titre"],
  [/^(\d+) free clips? left(?: \+ (\d+) paid)?$/, (m) => `Noch ${m[1]} Gratis-Clip${m[1] === "1" ? "" : "s"}${m[2] ? ` + ${m[2]} gekauft` : ""}`, (m) => `${m[1]} clip${m[1] === "1" ? "" : "s"} gratuit${m[1] === "1" ? "" : "s"} restant${m[1] === "1" ? "" : "s"}${m[2] ? ` + ${m[2]} payé${m[2] === "1" ? "" : "s"}` : ""}`],
  [/^Payment received: (\d+) clips added\. They’re saved in this browser\.$/, "Zahlung eingegangen: $1 Clips gutgeschrieben. Sie sind in diesem Browser gespeichert.", "Paiement reçu : $1 clips ajoutés. Ils sont enregistrés dans ce navigateur."],
  [/^We couldn’t confirm that payment yet \((.*)\)\. Refresh in a minute; if it persists email aidan@brickandmortar\.dev\.$/, "Wir konnten die Zahlung noch nicht bestätigen ($1). Lade in einer Minute neu; wenn es dabei bleibt, schreib an aidan@brickandmortar.dev.", "Paiement pas encore confirmé ($1). Recharge dans une minute ; si ça continue, écris à aidan@brickandmortar.dev."],
  // ---- a moment
  [/^chat ([\d.]+)× normal speed$/, "Chat $1× schneller als normal", "chat $1× plus rapide que la normale"],
  [/^small spike$/, "kleiner Ausschlag", "petit pic"],
  [/^the second you linked$/, "die verlinkte Sekunde", "la seconde de ton lien"],
  [/^funny$/, "lustig", "drôle"], [/^hype$/, "Hype", "hype"], [/^shock$/, "Schock", "choc"], [/^fail$/, "Fail", "fail"],
  [/^already clipped on Twitch (\d+)× \((\d+) views\)$/, "schon $1× auf Twitch geclippt ($2 Views)", "déjà clippé $1× sur Twitch ($2 vues)"],
  [/^music risk: (low|medium|high)$/, (m) => "Musik-Risiko: " + lv(m[1]), (m) => "risque musique : " + lv(m[1])],
  [/^Music risk (medium|high): (.*)\.$/, (m) => `Musik-Risiko ${lv(m[1])}: ${why(m[2])}.`, (m) => `Risque musique ${lv(m[1])} : ${why(m[2])}.`],
  [/^possible spoiler$/, "möglicher Spoiler", "spoiler possible"],
  [/^live, (\d+) min ago$/, "live, vor $1 Min.", "live, il y a $1 min"],
  [/^just now$/, "gerade eben", "à l’instant"],
  [/^Cut this$/, "Schneiden", "Couper ce moment"],
  [/^Watch on (Twitch|Kick)$/, "Auf $1 ansehen", "Voir sur $1"],
  [/^✕ Skip$/, "✕ Überspringen", "✕ Passer"],
  [/^Not a good pick$/, "Kein guter Moment", "Pas un bon moment"],
  [/^Missing something\? Request it$/, "Fehlt was? Wünsch es dir", "Il manque un truc ? Demande-le"],
  [/^Skip story spoilers$/, "Story-Spoiler überspringen", "Passer les spoilers de l’histoire"],
  [/^\(for campaigns that ban them\)$/, "(für Kampagnen, die sie verbieten)", "(pour les campagnes qui les interdisent)"],
  [/^Skipped (\d+) moments? as possible spoilers$/, (m) => `${m[1]} Moment${m[1] === "1" ? "" : "e"} als mögliche Spoiler übersprungen`, (m) => `${m[1]} moment${m[1] === "1" ? "" : "s"} passé${m[1] === "1" ? "" : "s"} : spoilers possibles`],
  [/^Show it anyway$/, "Trotzdem zeigen", "L’afficher quand même"],
  // ---- the editor
  [/^Loading video…$/, "Video wird geladen…", "Chargement de la vidéo…"],
  [/^Layout$/, "Layout", "Mise en page"],
  [/^Facecam \+ gameplay$/, "Facecam + Gameplay", "Facecam + gameplay"],
  [/^Full frame, blurred fill$/, "Ganzes Bild, unscharfer Rand", "Image entière, fond flouté"],
  [/^Centre crop$/, "Mittig zuschneiden", "Recadrage centré"],
  [/^Where is the facecam\?$/, "Wo ist die Facecam?", "Où est la facecam ?"],
  [/^↖ top left$/, "↖ oben links", "↖ en haut à gauche"], [/^↗ top right$/, "↗ oben rechts", "↗ en haut à droite"], [/^↙ bottom left$/, "↙ unten links", "↙ en bas à gauche"], [/^↘ bottom right$/, "↘ unten rechts", "↘ en bas à droite"],
  [/^Facecam size$/, "Größe der Facecam", "Taille de la facecam"],
  [/^Pan gameplay$/, "Gameplay verschieben", "Décaler le gameplay"],
  [/^Hook \(first thing they read\)\. Edit any line\.$/, "Hook (das Erste, was sie lesen). Jede Zeile lässt sich ändern.", "Hook (la première chose qu’ils lisent). Tu peux modifier chaque ligne."],
  [/^No hook$/, "Kein Hook", "Sans hook"],
  [/^Hook whole clip$/, "Hook über den ganzen Clip", "Hook sur tout le clip"],
  [/^First 3 s only$/, "Nur die ersten 3 s", "Les 3 premières secondes"],
  [/^Chat overlay$/, "Chat-Overlay", "Chat en surimpression"],
  [/^On$/, "An", "Oui"], [/^Off$/, "Aus", "Non"],
  [/^Clip window$/, "Clip-Ausschnitt", "Fenêtre du clip"],
  [/^start \+5s$/, "Start +5s", "début +5s"], [/^end −5s$/, "Ende −5s", "fin −5s"],
  [/^▶ Preview$/, "▶ Vorschau", "▶ Aperçu"],
  [/^Render 9:16 clip$/, "9:16-Clip rendern", "Lancer le rendu 9:16"],
  [/^This browser can’t record video\. Open heistclips in Chrome, Edge or Safari on a computer\.$/, "Dieser Browser kann kein Video aufnehmen. Öffne heistclips in Chrome, Edge oder Safari am Computer.", "Ce navigateur ne peut pas enregistrer de vidéo. Ouvre heistclips dans Chrome, Edge ou Safari sur un ordinateur."],
  [/^Want another layout, captions, or something else\?$/, "Anderes Layout, Untertitel oder was ganz anderes?", "Une autre mise en page, des sous-titres, autre chose ?"],
  [/^Request a feature$/, "Feature wünschen", "Demande une fonction"],
  [/^— we build what clippers ask for\.$/, "– wir bauen, was Clipper sich wünschen.", ": on construit ce que les clippeurs demandent."],
  [/^(\d+)×(\d+) source · renders at 1080×1920$/, "Quelle $1×$2 · gerendert wird in 1080×1920", "Source $1×$2 · rendu en 1080×1920"],
  [/^Couldn’t load the video: (.*?)( \(live moments need ~30 s before the video catches up; try again shortly\))?$/, (m) => `Das Video ließ sich nicht laden: ${m[1]}` + (m[2] ? " (Live-Momente brauchen ~30 s, bis das Video nachzieht; versuch es gleich nochmal)" : ""), (m) => `Impossible de charger la vidéo : ${m[1]}` + (m[2] ? " (un moment en live a besoin d’environ 30 s avant que la vidéo suive ; réessaie dans un instant)" : "")],
  [/^Done\. Pick another hook and render again for a second, different post\.$/, "Fertig. Nimm einen anderen Hook und render nochmal: das ist dein zweiter, anderer Post.", "C’est prêt. Choisis un autre hook et relance le rendu pour un deuxième post, différent."],
  [/^Render failed: (.*?)\. Nothing was charged\.$/, "Rendern fehlgeschlagen: $1. Es wurde nichts berechnet.", "Le rendu a échoué : $1. Rien n’a été débité."],
  [/^Render failed: (.*?)\.$/, "Rendern fehlgeschlagen: $1.", "Le rendu a échoué : $1."],
  [/^Nothing was charged\.$/, "Es wurde nichts berechnet.", "Rien n’a été débité."],
  [/^Download (\w+) · (.*)$/, "$1 herunterladen · $2", "Télécharger le $1 · $2"],
  [/^Cut from the (.+) source\.$/, "Geschnitten aus der $1-Quelle.", "Coupé depuis la source $1."],
  [/^WebM plays on TikTok and YouTube\. For Instagram, Safari or Chrome 126\+ export MP4\.$/, "WebM läuft auf TikTok und YouTube. Für Instagram: Safari oder Chrome 126+ exportieren MP4.", "Le WebM passe sur TikTok et YouTube. Pour Instagram, Safari ou Chrome 126+ exportent en MP4."],
  [/^No sound came through for this stretch(: Twitch muted it in the VOD \(licensed music\))?\.$/, (m) => "Für diese Stelle kam kein Ton an" + (m[1] ? ": Twitch hat sie im VOD stummgeschaltet (lizenzierte Musik)" : "") + ".", (m) => "Aucun son n’est passé sur ce passage" + (m[1] ? " : Twitch l’a coupé dans la VOD (musique sous licence)" : "") + "."],
  [/^This clip window is empty\. Use the ±5s buttons to set a start before the end\.$/, "Dieser Clip-Ausschnitt ist leer. Setz mit den ±5s-Knöpfen den Start vor das Ende.", "Cette fenêtre de clip est vide. Utilise les boutons ±5s pour placer le début avant la fin."],
  [/^Couldn’t reach heistclips to check your clips\. Check your connection and try again\.$/, "heistclips ist nicht erreichbar, um deine Clips zu prüfen. Check deine Verbindung und versuch es nochmal.", "Impossible de joindre heistclips pour vérifier tes clips. Vérifie ta connexion et réessaie."],
  [/^Where is the facecam in the stream\? Drag the box onto it; drag the dot to resize\.$/, "Wo ist die Facecam im Stream? Zieh den Rahmen darauf; am Punkt änderst du die Größe.", "Où est la facecam dans le stream ? Fais glisser le cadre dessus ; tire le point pour le redimensionner."],
  [/^Put the facecam$/, "Facecam platzieren", "Placer la facecam"],
  [/^On top$/, "Oben", "En haut"], [/^At the bottom$/, "Unten", "En bas"],
  [/^Facecam style$/, "Facecam-Stil", "Style de la facecam"],
  [/^Panel$/, "Panel", "Bandeau"], [/^Rounded box$/, "Abgerundet", "Cadre arrondi"], [/^Circle$/, "Kreis", "Cercle"],
  [/^No zoom$/, "Kein Zoom", "Sans zoom"],
  [/^Punch-in on the loudest second$/, "Zoom auf die lauteste Sekunde", "Zoom sur la seconde la plus forte"],
  // ---- posting (post.js)
  [/^Post to (YouTube|TikTok)$/, "Auf $1 posten", "Poster sur $1"],
  [/^Checking your account…$/, "Dein Account wird geprüft…", "Vérification de ton compte…"],
  [/^Posting to (.+) isn’t open yet: we’re waiting on \1’s developer approval\. Download the clip and post it by hand for now\.$/, "Posten auf $1 ist noch nicht offen: Wir warten auf die Entwickler-Freigabe von $1. Lad den Clip herunter und poste ihn vorerst von Hand.", "Poster sur $1 n’est pas encore ouvert : on attend la validation développeur de $1. Télécharge le clip et poste-le à la main pour l’instant."],
  [/^Connect (.+) first \(one time\):$/, "Verbinde zuerst $1 (einmalig):", "Connecte d’abord $1 (une seule fois) :"],
  [/^open the connect page$/, "Verbindungsseite öffnen", "ouvre la page de connexion"],
  [/^Open the connect page$/, "Verbindungsseite öffnen", "Ouvre la page de connexion"],
  [/^, then press Post again\.$/, " und drück dann nochmal auf Posten.", ", puis appuie de nouveau sur Poster."],
  [/^Uploading (\d+)%…$/, "Upload $1 %…", "Envoi $1 %…"],
  [/^Posting to (.+)…$/, "Wird auf $1 gepostet…", "Publication sur $1…"],
  [/^Couldn’t post: (.*)$/, "Posten fehlgeschlagen: $1", "Publication impossible : $1"],
  // ---- live
  [/^Live, but couldn’t sync to the recording; moments from chat so far are below\.$/, "Live, aber die Aufnahme ließ sich nicht synchronisieren; die Momente aus dem bisherigen Chat stehen unten.", "En live, mais impossible de se caler sur l’enregistrement ; les moments du chat jusqu’ici sont ci-dessous."],
  [/^Watching live chat · ([\d.]+) msg\/s \(normal ([\d.]+)\) · a spike over ([\d.]+) becomes a moment$/, "Live-Chat läuft mit · $1 Nachr./s (normal $2) · ab $3 wird ein Ausschlag zum Moment", "Chat en live suivi · $1 msg/s (normale $2) · au-dessus de $3, un pic devient un moment"],
  [/^watching chat$/, "Chat wird mitgelesen", "chat suivi en direct"],
  [/^chat disconnected, reconnecting…$/, "Chat getrennt, verbinde neu…", "chat déconnecté, reconnexion…"],
  [/^Kick chat paused \((.*)\), retrying…$/, "Kick-Chat pausiert ($1), neuer Versuch…", "Chat Kick en pause ($1), nouvel essai…"],
  // ---- the request board
  [/^Sending…$/, "Wird gesendet…", "Envoi…"],
  [/^Already on the board, so we added nothing\. Upvote it:$/, "Steht schon auf dem Board, wir haben nichts hinzugefügt. Stimm dafür:", "C’est déjà sur le tableau, on n’a rien ajouté. Vote pour :"],
  [/^Added\. It’s on the board now\.$/, "Eingetragen. Es steht jetzt auf dem Board.", "Ajouté. C’est sur le tableau."],
  [/^That’s an? (.+), not a request\.$/, "Das ist ein $1, kein Wunsch.", "C’est un(e) $1, pas une demande."],
  [/^Find its moments in the clip tool →$/, "Finde die Momente im Clip-Tool →", "Trouve ses moments dans l’outil de clip →"],
  [/^It’s a request, file it$/, "Doch, das ist ein Wunsch", "Si, c’est une demande"],
  [/^Say what you want in a few words\.$/, "Sag in ein paar Worten, was du willst.", "Dis ce que tu veux en quelques mots."],
  [/^No links, please\. Describe it in words\.$/, "Bitte keine Links. Beschreib es in Worten.", "Pas de liens, s’il te plaît. Décris-le avec des mots."],
  [/^Keep it clean, please\.$/, "Bitte sauber bleiben.", "Reste correct, s’il te plaît."],
  [/^That's three requests from this connection today\. Upvote the others instead\.$/, "Das waren heute drei Wünsche von diesem Anschluss. Stimm lieber für die anderen ab.", "Ça fait trois demandes depuis cette connexion aujourd’hui. Vote plutôt pour les autres."],
  [/^requested$/, "gewünscht", "demandé"],
  [/^Requested by a clipper$/, "Wunsch eines Clippers", "Demandé par un clippeur"],
];

export function tr(s) {
  if (!L || !s) return s;
  const m = String(s).match(/^(\s*)([\s\S]*?)(\s*)$/);
  const core = m[2];
  if (!core || core.length > 400) return s;
  for (const r of RULES) {
    const hit = core.match(r[0]);
    if (!hit) continue;
    const to = r[L];
    return m[1] + (typeof to === "function" ? to(hit) : core.replace(r[0], to)) + m[3];
  }
  return s;
}

const LOCAL = /^\/(?:$|\?|clip(?:$|\?)|pricing(?:$|\?)|requests(?:$|[?#])|guides(?:$|\/|\?)|gta-6-clipping-(?:campaigns|rates-today)(?:$|\?))/;
const SKIP = "script,style,textarea,.quote,[data-notr],.src .t > b,.resp,code,pre";
const done = new WeakMap();

function text(n) {
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
  // A link the tool wrote to an English page that also exists in this language.
  if (e.tagName === "A") {
    const h = e.getAttribute("href");
    if (h && LOCAL.test(h)) e.setAttribute("href", "/" + lang + (h === "/" ? "" : h));
  }
}

function walk(root) {
  if (root.nodeType === 3) return text(root);
  if (root.nodeType !== 1) return;
  el(root);
  root.querySelectorAll("*").forEach(el);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n; while ((n = w.nextNode())) text(n);
}

if (L && typeof MutationObserver !== "undefined") {
  const scope = document.querySelector("main") || document.body;
  new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === "characterData") text(m.target);
      else m.addedNodes.forEach(walk);
    }
  }).observe(scope, { childList: true, subtree: true, characterData: true });
  // Only what scripts add later is English; the page itself arrives translated from the server.
  scope.querySelectorAll("#app, #reqmsg, .rnote, .note").forEach(walk);
}
