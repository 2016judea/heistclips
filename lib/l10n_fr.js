// Français. Écrit comme parlent les clippeurs (tu, clip, hook, le chat s'enflamme), pas traduit
// mot à mot de l'anglais. Les chiffres viennent toujours du snapshot en direct, jamais de ce texte.
const B = (s) => `<b>${s}</b>`;

export default {
  locale: "fr-FR",
  updated: (when, min) => `Mis à jour le ${when} · ${min < 2 ? "à l’instant" : min < 90 ? `il y a ${min} min` : `il y a ${Math.round(min / 60)} h`} · actualisé toutes les 30 minutes`,
  watching: (n) => `${n} spectateurs`,
  form: { ph: "Chaîne Twitch ou Kick, ou lien de VOD", go: "Trouver les moments" },
  // Libellés fixes des lignes de campagne (les lignes elles-mêmes sont construites en anglais par render.js).
  rows: [
    [/>(<span class="pulse"><\/span>|▶ )Clip (.+?)’s stream now<\/a>/g, ">$1Clipper le stream de $2</a>"],
    [/<span>typical per clip<\/span>/g, "<span>par clip, en moyenne</span>"],
    [/<b class="big new">new<\/b><span>up to ([^<]+) a clip<\/span>/g, '<b class="big new">nouveau</b><span>jusqu’à $1 par clip</span>'],
    [/ \/ 1k views/g, " / 1 000 vues"], [/ per post/g, " par post"], [/ · cap /g, " · plafond "], [/ left( \(| <b| ·)/g, " restants$1"],
    [/\(~(\d+) days\)/g, "(~$1 jours)"], [/\(~(\d+) h of budget at this pace\)/g, "(~$1 h de budget à ce rythme)"],
    [/ (\d[\d,.k]*) clippers/g, " $1 clippeurs"], [/paid out /g, "déjà versé : "], [/<em>apply first<\/em>/g, "<em>candidature requise</em>"], [/class="tag g">gaming</g, 'class="tag g">gaming<'],
  ],

  home: {
    title: "Outil de clipping GTA 6 – trouve le moment, coupe le clip, sois payé | heistclips",
    desc: "Trouve les moments où le chat s’enflamme dans les streams GTA 6, coupe-les en 9:16 avec un hook dans ton navigateur, et vois quelle campagne de clipping paie le plus par clip en ce moment.",
    h1: "Clippe les streams GTA VI pendant qu’ils sont en live.",
    lede: "Pensé pour le gameplay, pas pour les podcasts. Colle une chaîne Twitch ou Kick : heistclips suit le chat, repère la seconde où il s’enflamme et la découpe en 9:16 (facecam au-dessus du gameplay), avec un hook, dans ton navigateur.",
    small: (n, each) => `<b>${n} clips offerts.</b> Ensuite ${each} le clip. Pas de facturation à la minute. Pas de filigrane. Pas de tag IA dans le fichier.`,
    liveH: "En live sur GTA en ce moment",
    payH: "Ce qui paie le plus par clip en ce moment",
    paySmall: (gta) => `Campagnes gaming et streamers, classées selon ce qu’un clip validé rapporte vraiment en moyenne. ${gta} campagne${gta === 1 ? "" : "s"} GTA en cours aujourd’hui.`,
    all: (n) => `Les ${n} campagnes, classées →`,
    askH: "Il te manque quelque chose ?",
    askP: "Demande une fonction. On construit ce que les clippeurs demandent.",
    askLink: "Voir ce qui est demandé, en cours et livré →",
    trend: "Ce que les clippeurs découpent en ce moment →",
    post: { h: "Poste direct sur YouTube", p: `Connecte ta chaîne YouTube une fois. Ensuite tu postes le clip en Short avec ta légende, depuis l’outil de clip ou depuis Claude. <a href="/post">Connecter YouTube →</a> La publication passe par les YouTube API Services ; voir notre page <a href="/privacy">Confidentialité</a>.` },
    three: [
      ["Le chat trouve le moment", "Les moments de gaming sont visuels : une transcription passe à côté. Pas le chat. Chaque pic est un horodatage, affiché avec les lignes que le chat a tapées, pour que tu voies pourquoi il a été retenu. Marche aussi sur les streams encore en live."],
      ["Ton navigateur fait le montage", "Facecam au-dessus du gameplay, fond flouté ou recadrage centré ; 3 à 5 hooks pour que chaque post soit différent ; chat en surimpression. Rendu sur ta machine, sans filigrane, téléchargé tout de suite."],
      ["La musique est signalée", "La radio du jeu, c’est de la musique sous licence. Si Twitch a coupé le son sur ce passage, on te le dit avant que tu postes et que tu perdes le paiement à cause d’une réclamation."],
    ],
  },

  clip: {
    title: "Créateur de clips GTA 6 – les moments du chat Twitch ou Kick, coupés en 9:16 dans ton navigateur | heistclips",
    desc: "Colle une chaîne ou une VOD Twitch ou Kick. heistclips trouve les moments où le chat s’est enflammé, signale la musique sous licence et coupe des clips 9:16 avec un hook, directement dans ton navigateur.",
    h1: "Trouve les moments. Coupe le clip.",
    hint: "Colle une chaîne Twitch ou Kick (en live ou non) ou un lien de VOD. On lit le chat, pas la vidéo : un stream de 7 heures prend environ 20 secondes.",
  },

  pricing: {
    title: "Prix – tu paies au clip, jamais à la minute de stream | heistclips",
    desc: (n, packs) => `${n} clips GTA 6 offerts, puis ${packs.map((p) => `${p.clips} pour ${p.price} $`).join(" ou ")}. Trouver les moments est toujours gratuit.`,
    h1: "Paie au clip. Jamais à la minute.",
    lede: (n) => `${n} clips offerts. Ensuite, tu prends un pack. Trouver les moments est toujours gratuit.`,
    free: "Gratuit", clips: (n) => `${n} clips`, start: "Commencer à clipper", each: (c) => `${c} le clip`, buy: (n) => `Acheter ${n} clips`,
    pay: "Le paiement passe par Stripe : carte bancaire, Apple Pay, Google Pay ou Link. Les prix sont affichés ici en dollars US ; Stripe t’indique le montant dans ta devise avant de payer.",
    faqH: "Questions",
    faq: [
      ["Pourquoi au clip et pas à la minute ?", "Les clippeurs sont payés au clip qui marche. Les outils qui facturent à la minute de vidéo te font payer les sept heures de stream que tu ne posteras jamais. Ici, le stream est lu gratuitement ; tu ne paies que les clips que tu exportes."],
      ["Qu’est-ce qui compte comme un clip ?", "Une vidéo 9:16 exportée. L’aperçu, la recherche de moments et la relecture d’un stream sont gratuits. Refaire le rendu du même moment avec un autre hook compte comme un nouveau clip."],
      ["Les crédits expirent-ils ?", "Non."],
      ["Où la vidéo est-elle fabriquée ?", "Dans ton navigateur, sur ta machine. Rien ne nous est envoyé."],
      ["Qu’est-ce qui apparaît sur mon relevé ?", "BRICKANDMORTAR.DEV, la société qui édite heistclips."],
    ],
  },

  requests: {
    title: "Demandes de fonctions – ce que les clippeurs veulent ensuite | heistclips",
    desc: "Vote pour des fonctions ou demandes-en de nouvelles pour heistclips, l’outil de clipping GTA 6. Demandé, en cours et livré, en public.",
    h1: "Ce que les clippeurs ont demandé",
    lede: "Vote pour ce que tu veux ensuite, ou demande autre chose. Sans compte, dans la langue que tu veux. On construit ce qui reçoit des votes, et les demandes livrées restent ici comme preuve.",
    counts: (r, b, s) => `${r} demandées · ${b} en cours · ${s} livrées`,
    ph: "Que devrait faire heistclips ? ex. « Détecter la facecam automatiquement »", aria: "Ta demande",
    more: "Ajouter des détails ou un contact (facultatif)", detailPh: "Qu’est-ce que tu essayais de faire ?", contactPh: "E-mail ou @pseudo, seulement si tu veux une réponse",
    btn: "Demander", upvote: "Voter pour",
    note: "Les éléments marqués « Suggéré par heistclips » ont été ajoutés par nous au lancement, d’après ce que les clippeurs disent sur Reddit. Chaque compteur est parti de 0 ; seuls les vrais votes le font bouger, un par navigateur.",
    status: { requested: "demandé", building: "en cours", shipped: "livré" },
    lead: { shipped: "Livré", building: "En cours", update: "Mise à jour" },
    byUs: "Suggéré par heistclips", byClipper: "Demandé par un clippeur",
    seeds: {
      "Clip streams while they're live": ["Clipper les streams pendant qu’ils sont en live", "Trouver et couper des moments d’un stream encore en cours, pas seulement une fois la VOD terminée."],
      "Facecam-over-gameplay vertical layout": ["Format vertical facecam au-dessus du gameplay", "La mise en page empilée que les clips gaming utilisent vraiment, par défaut à la place du recadrage centré."],
      "No watermark, no per-minute billing": ["Pas de filigrane, pas de facturation à la minute", "On paie au clip exporté ; jamais de filigrane sur le fichier."],
      "Warn me before a campaign's budget runs out": ["Me prévenir avant qu’une campagne n’ait plus de budget", "Une alerte quand une campagne pour laquelle je clippe n’a plus que quelques heures de budget, pas quelques jours."],
      "Mute or swap licensed in-game radio": ["Couper ou remplacer la radio sous licence du jeu", "Pour que les clips ne prennent pas de réclamation Content ID et ne soient pas coupés sur TikTok."],
      "Kick support": ["Prise en charge de Kick", "Trouver et couper des moments de streams Kick, en live ou enregistrés."],
      "Spoiler filter": ["Filtre anti-spoilers", "Ignorer les moments qui montrent des spoilers de l’histoire, pour les campagnes qui les interdisent."],
      "Strip \"AI-generated\" metadata on export": ["Retirer les métadonnées « généré par IA » à l’export", "Les exports ne doivent jamais être signalés comme faits par IA quand les images ne le sont pas."],
      "Track which hook variant won": ["Savoir quel hook a gagné", "Me dire quel hook de première seconde a fait le plus de vues sur l’ensemble de mes posts."],
      "Earnings tracker across campaigns": ["Suivi des gains sur toutes les campagnes", "Mes $ par heure sur chaque campagne pour laquelle je clippe."],
      "Posting-cadence guard for new accounts": ["Garde-fou de rythme de publication pour les nouveaux comptes", "Me prévenir avant que je poste assez pour faire shadowban un compte tout neuf."],
      "Discord bot for my clipping team": ["Bot Discord pour mon équipe de clipping", "Envoyer les nouveaux moments dans le salon Discord de notre équipe dès qu’ils arrivent."],
      "YouTube Live support": ["Prise en charge de YouTube Live", "La même recherche de moments pour les streams sur YouTube Live."],
    },
  },

  ranker: {
    title: (date) => `Campagnes de clipping GTA 6 classées par gain au clip (${date}) | heistclips`,
    desc: (n, gta, gaming) => `${n} campagnes de clipping en cours, classées selon ce qu’un clip validé rapporte vraiment en moyenne. ${gta} GTA, ${gaming} gaming et streamers. Actualisé toutes les 30 minutes.`,
    h1: "Campagnes de clipping GTA 6, classées par ce que rapporte un clip",
    lede: (n, tracked, typ, p90, p10) => `${n} campagnes paient des clippeurs en ce moment. Sur les ${tracked} qui ont un historique, un clip validé a rapporté ${B(typ)} en moyenne ; le meilleur dixième paie ${B(p90 + "+")}, le moins bon moins de ${B(p10)}. Même travail, argent très différent.`,
    tabGaming: "Gaming et streamers", tabAll: "Tout",
    none: "Aucune campagne ici à cette minute. Elles ouvrent par vagues autour du lancement ; cette page s’actualise toutes les 30 minutes.",
    showing: (n) => `Affichage des 150 premières sur ${n}.`,
    methodH: "Comment marche le classement",
    method: [
      "<b>Par clip, en moyenne</b> = l’argent qu’une campagne a versé sur les clips validés, moins ses trois meilleurs gains, divisé par le reste de ses clips validés. C’est ce qu’un clip ordinaire a vraiment rapporté, pas le meilleur.",
      "Ce chiffre est réduit si le budget est presque épuisé : un clip fait l’essentiel de ses vues dans ses trois premiers jours, donc une campagne à qui il reste un jour d’argent en paie un tiers. Les campagnes sans clip validé passent après celles qui ont fait leurs preuves, classées par le maximum qu’un clip peut gagner.",
      "Les chiffres viennent de l’annuaire public de Content Rewards et sont actualisés toutes les 30 minutes. Chaque campagne renvoie vers sa propre page là-bas, où tu t’inscris.",
    ],
  },

  rates: {
    title: (rate, typ) => `Tarifs du clipping GTA 6 aujourd’hui – ${rate} les 1 000 vues en médiane, ${typ} par clip | heistclips`,
    desc: (rate, cap, typ, gta) => `Tarifs du clipping GTA 6 en direct : ${rate} les 1 000 vues en médiane, plafond ${cap}, un clip rapporte ${typ} en moyenne. ${gta} campagnes GTA en cours. Actualisé toutes les 30 minutes.`,
    h1: "Tarifs du clipping GTA 6 aujourd’hui",
    stat: ["ce que rapporte un clip validé, en moyenne", "tarif médian les 1 000 vues", "plafond médian par clip", "campagnes GTA en cours"],
    lede: (n, budget, p90, p10) => `${n} campagnes paient des clippeurs, avec ${budget} de budget restant au total. Le meilleur dixième paie ${p90}+ par clip validé ; le moins bon, moins de ${p10}.`,
    gtaH: "Campagnes GTA",
    none: "Aucune en ce moment. Elles ouvrent par vagues autour du lancement.",
    all: "Toutes les campagnes, classées →",
    histH: (n) => `Les ${n} dernières actualisations`,
    th: ["UTC", "Campagnes", "GTA", "Moyenne/clip", "Tarif médian", "Budget restant"],
  },

  guides: {
    title: "Guides du clipping GTA 6 | heistclips",
    desc: "Ce que paie le clipping GTA 6, comment marchent les réclamations musicales, l’argent des Shorts face aux campagnes, et comment clipper un stream vite.",
    h1: "Guides",
    pages: {
      "how-much-does-gta-6-clipping-pay": {
        name: "Combien paie le clipping GTA 6 ?",
        title: () => "Combien paie le clipping GTA 6 ? Tarifs par clip en direct | heistclips",
        desc: (n) => `Un clip validé rapporte ${n.typical} en moyenne ; les meilleures campagnes paient ${n.p90}+. Tarifs, plafonds et budgets en direct, actualisés toutes les 30 minutes.`,
        page: (n) => ({
          body: `<h1>Combien paie le clipping GTA 6 ?</h1>
<p class="updated">Les chiffres de cette page sont en direct, lus sur ${n.campaigns} campagnes le ${n.when}.</p>
<p class="lede">Un clip validé rapporte <b>${n.typical}</b> en moyenne. Le dixième des campagnes qui paie le mieux donne <b>${n.p90}+</b> pour le même clip. La campagne que tu choisis compte plus que la qualité du clip.</p>
<h2>La formule</h2>
<p>Gain par clip = vues × tarif les 1 000 vues, jusqu’au plafond, tant qu’il reste du budget.</p>
<ul class="facts">
<li>Tarif médian : <b>${n.rate}</b> les 1 000 vues.</li>
<li>Plafond médian : <b>${n.cap}</b> par clip, atteint à ${n.capViews} vues.</li>
<li>Vues médianes par clip validé : <b>${n.views}</b>.</li>
<li>Budget restant sur l’ensemble des campagnes : <b>${n.budget}</b>.</li>
</ul>
<h2>Pourquoi la plupart des clips gagnent moins que ce que le tarif laisse croire</h2>
<p>Trois choses mangent l’argent : un clip jamais validé, un budget épuisé avant que tes vues arrivent, et une campagne tellement saturée que chaque moment est déjà posté. Le classement de <a href="${n.ranker}">la page des campagnes</a> part de ce que les clips ont vraiment gagné, donc ces trois-là sont déjà dans le chiffre.</p>
<h2>Campagnes GTA en cours</h2>
${n.gtaRows()}`,
          faq: [
            ["Combien paie le clipping GTA 6 ?", `En ce moment, la campagne médiane paie ${n.rate} les 1 000 vues, avec un plafond de ${n.cap} par clip. Sur ${n.tracked} campagnes qui ont un historique, un clip validé a rapporté ${n.typical} en moyenne ; le meilleur dixième des campagnes paie ${n.p90} ou plus par clip.`],
            ["Comment le paiement est-il calculé ?", `Vues du clip × tarif les 1 000 vues, jusqu’au plafond par clip, tant que la campagne a du budget. À ${n.rate} les 1 000 vues, il faut ${n.capViews} vues pour atteindre un plafond de ${n.cap}.`],
            ["Toutes les vues comptent-elles ?", "Seulement les vues sur les clips que la campagne valide. La plupart refusent les vues de bots, les reposts et les clips qui enfreignent leurs règles. L’argent s’arrête aussi quand le budget est épuisé, même si ton clip continue de faire des vues."],
          ],
        }),
      },
      "gta-6-music-copyright-claims": {
        name: "Clips GTA 6 et réclamations musicales : pourquoi la radio tue le paiement",
        title: () => "Clips GTA 6 et réclamations de droits musicaux – évite la radio | heistclips",
        desc: () => "La radio du jeu, c’est de la musique sous licence. Comment Content ID et les réclamations TikTok tuent le paiement d’un clip, et comment repérer un moment risqué avant de poster.",
        page: (n) => ({
          body: `<h1>Clips GTA 6 et réclamations musicales</h1>
<p class="lede">Le moyen le plus rapide de perdre le paiement d’un clip, c’est une chanson à l’autoradio. Vérifie le son avant de poster.</p>
<h2>Pourquoi ça arrive</h2>
<p>Les stations de radio de GTA passent de vraies chansons sous licence. Un streamer qui roule avec la radio allumée diffuse ces chansons. Twitch coupe leur son dans le stream enregistré quand son détecteur les repère, et YouTube et TikTok font tourner leurs propres détecteurs sur chaque upload.</p>
<h2>Ce que ça te coûte</h2>
<ul class="facts"><li>YouTube : une réclamation Content ID peut envoyer l’argent du clip au label, ou le bloquer.</li><li>TikTok : le son peut être coupé, ce qui tue un clip de réaction.</li><li>Campagnes : beaucoup refusent les clips réclamés ou sans son, donc les vues ne sont jamais payées.</li></ul>
<h2>Comment heistclips le signale</h2>
<p>Chaque moment trouvé est comparé aux passages que Twitch a coupés pour musique dans ce stream. S’il en chevauche un, il est marqué <b>risque musique : élevé</b>. Si le chat parle d’une chanson, il est marqué <b>moyen</b>. Prends les moments à risque faible, ou coupe le clip sur la partie sans radio.</p>
<p><a class="btn" href="${n.clip}">Vérifier un stream</a></p>`,
          faq: [
            ["Puis-je utiliser la musique de la radio de GTA dans mes clips ?", "Pas sans risque. Les chansons de la radio du jeu sont de la musique commerciale sous licence. Twitch coupe leur son dans les streams enregistrés, et Content ID de YouTube comme la détection de TikTok peuvent réclamer ou couper un clip qui en contient."],
            ["Que se passe-t-il si mon clip reçoit une réclamation musicale ?", "Sur YouTube, l’ayant droit peut prendre les revenus ou bloquer la vidéo ; sur TikTok, le son peut être coupé. Beaucoup de campagnes de clipping refusent les clips réclamés ou sans son, ou arrêtent de les payer."],
            ["Comment savoir si un moment contient de la musique sous licence ?", "heistclips vérifie si Twitch a coupé le son sur ce passage du stream. Twitch le fait quand son détecteur entend de la musique sous licence : un passage muet est donc un sérieux avertissement. Les moments où le chat parle d’une chanson sont signalés aussi."],
          ],
        }),
      },
      "shorts-money-vs-clipping-campaigns": {
        name: "L’argent des YouTube Shorts face aux campagnes de clipping",
        title: () => "Argent des YouTube Shorts ou campagnes de clipping pour les clips GTA 6 | heistclips",
        desc: (n) => `Shorts paie à partir d’un pot commun ; les campagnes paient un tarif fixe par vue (${n.rate} les 1 000 en médiane aujourd’hui). Ce qui paie vraiment pour des clips de streams GTA 6.`,
        page: (n) => ({
          body: `<h1>L’argent des YouTube Shorts face aux campagnes de clipping</h1>
<p class="lede">Shorts paie à partir d’un pot commun. Une campagne paie un tarif fixe par vue. Pour un clip tiré du stream de quelqu’un d’autre, la campagne est en général le seul argent qui existe.</p>
<h2>Comment paie Shorts</h2>
<p>YouTube met en commun les revenus publicitaires du fil Shorts, en réserve une partie pour les licences musicales et verse aux créateurs du Programme Partenaire 45 % du reste, réparti selon les vues. Il faut d’abord être dans le Programme Partenaire, et un clip du stream d’un autre créateur peut être refusé comme contenu réutilisé.</p>
<h2>Comment paient les campagnes</h2>
<p>Un streamer ou une marque met un budget et paie un tarif fixe les 1 000 vues sur les clips validés : ${n.rate} en médiane aujourd’hui, plafonné à ${n.cap} par clip. Pas besoin d’une chaîne monétisée ; il te faut des vues et un clip validé.</p>
<h2>Ce qu’il faut faire</h2>
<p>Poste le clip là où la campagne paie (la plupart paient sur TikTok, Shorts et Reels en même temps) et déclare-le. Tout ce que Shorts ajoute par-dessus, c’est du bonus.</p>
<p><a class="btn" href="${n.ranker}">Voir ce que paient les campagnes aujourd’hui</a></p>`,
        }),
      },
      "how-to-clip-gta-6-streams": {
        name: "Comment clipper des streams GTA 6, vite",
        title: () => "Clipper des streams GTA 6 rapidement – du moment en live au clip posté | heistclips",
        desc: () => "Six étapes d’un stream GTA 6 en live à un clip posté et payé : choisir la campagne, trouver le pic du chat, vérifier la musique, couper en 9:16 avec un hook, poster en premier.",
        page: (n) => ({
          body: `<h1>Comment clipper des streams GTA 6, vite</h1>
<p class="lede">La semaine du lancement récompense le premier clip d’un moment, pas le meilleur. Voici le chemin le plus court d’un live à un clip posté.</p>
<ol class="steps">
<li><b>Choisis d’abord l’argent</b><p>Ouvre la page des campagnes et prends-en une qui paie pour le streamer que tu vas clipper, avec du budget pour au moins trois jours de plus.</p></li>
<li><b>Colle la chaîne</b><p>Colle la chaîne Twitch du streamer dans heistclips. S’il est en live, le chat est suivi en direct ; sinon, c’est son dernier stream qui est lu.</p></li>
<li><b>Prends le plus gros pic</b><p>Les moments sont classés selon l’accélération du chat par rapport à la normale, le nombre de « clip it » tapés, et si des spectateurs l’ont déjà clippé sur Twitch.</p></li>
<li><b>Regarde le signalement musique</b><p>Laisse de côté les moments à risque musique élevé, ou coupe la radio.</p></li>
<li><b>Coupe-le avec un hook</b><p>Choisis une mise en page, choisis ou écris un hook pour la première seconde, et lance le rendu. Le clip est fabriqué dans ton navigateur et se télécharge en fichier vidéo.</p></li>
<li><b>Poste et déclare</b><p>Poste sur chaque plateforme où la campagne paie et envoie les liens sur la page de la campagne. Fais vite : c’est le premier upload d’un moment qui prend les vues.</p></li>
</ol>
<p><a class="btn" href="${n.clip}">Ouvrir l’outil de clip</a></p>`,
        }),
      },
      "reused-content-shadowbans-posting-cadence": {
        name: "Contenu réutilisé, shadowbans et rythme de publication des clips",
        title: () => "Contenu réutilisé, shadowbans et rythme de publication pour les comptes de clips | heistclips",
        desc: () => "Pourquoi les chaînes de clips sont démonétisées pour contenu réutilisé, combien de clips un nouveau compte peut poster avant un shadowban, et comment rendre chaque upload différent.",
        page: (n) => ({
          body: `<h1>Contenu réutilisé, shadowbans et rythme de publication</h1>
<p class="lede">L’argent du clipping vient des campagnes, pas de la plateforme. Protège le compte qui le gagne.</p>
<h2>Contenu réutilisé</h2>
<p>Le Programme Partenaire de YouTube peut refuser ou démonétiser une chaîne qui ne fait que reposter les images des autres. Ça touche la part publicitaire de YouTube, pas le paiement d’une campagne. Si tu clippes pour des campagnes, le revenu, c’est la campagne ; les revenus Shorts sont un bonus.</p>
<h2>Shadowbans sur les nouveaux comptes</h2>
<p>Le schéma que rapportent les clippeurs : un nouveau compte poste 10 clips le premier jour et ses vues tombent à zéro. Utilise le compte normalement quelques jours, puis poste trois à cinq clips par jour et monte à partir de là.</p>
<h2>Rends chaque post différent</h2>
<p>Les plateformes repèrent les uploads identiques. Change la première seconde (le hook), le montage et la mise en page à chaque post. heistclips écrit 3 à 5 hooks par moment et rend chacun dans son propre fichier, sans filigrane et sans tag « généré par IA » dans le fichier.</p>
<p><a class="btn" href="${n.clip}">Couper un moment</a></p>`,
          faq: [
            ["Pourquoi YouTube a-t-il démonétisé ma chaîne de clips pour contenu réutilisé ?", "Le Programme Partenaire de YouTube ne paie pas les contenus qui reprennent la vidéo de quelqu’un d’autre sans rien y ajouter. Une chaîne de clips qui ne fait que reposter des images de stream peut être refusée ou démonétisée à ce titre. Les paiements des campagnes sont à part : une campagne paie à la vue sur les clips validés, que ta chaîne soit monétisée ou non."],
            ["Combien de clips par jour puis-je poster sur un nouveau compte ?", "Les clippeurs rapportent des shadowbans quand un compte tout neuf poste plus de trois à cinq fois par jour. Fais chauffer le compte quelques jours avec un usage normal, puis poste une poignée de clips par jour et augmente doucement."],
            ["Poster le même clip sur plusieurs comptes, ça se voit ?", "Les uploads identiques sont faciles à repérer pour les plateformes. Change quelque chose de réel à chaque fois : le hook de la première seconde, le montage, la mise en page. C’est pour ça que heistclips donne 3 à 5 hooks différents à chaque moment."],
          ],
        }),
      },
    },
  },

  // Twitch/Kick clip maker and "most clipped right now" (lib/searchpages.js; English in lib/search_words.js).
  search: {
    box: { ph: (p) => `Chaîne ${p} ou lien de VOD`, go: "Trouver", fine: "Sans compte. Sans filigrane. Ton navigateur découpe le clip.", hot: "Clippé en ce moment" },
    clips: (n) => `${n} clip${n === 1 ? "" : "s"}`,
    maker: {
      twitch: {
        title: "Créateur de clips Twitch : clips 9:16 avec hook, sans filigrane | heistclips",
        desc: (free, each) => `Colle une chaîne ou une VOD Twitch. heistclips trouve les moments où le chat s’emballe et les découpe en 9:16 avec un hook, dans ton navigateur. ${free} clips offerts, puis dès ${each} le clip. Sans filigrane.`,
        h1: "Créateur de clips Twitch",
        lede: "Colle une chaîne Twitch. On trouve les moments où le chat s’emballe. Tu reçois des clips 9:16 avec un hook, prêts pour TikTok, Shorts et Reels.",
        speed: "Un stream de 7 heures est lu en 20 secondes environ.",
      },
      kick: {
        title: "Créateur de clips Kick : clips 9:16 avec hook, sans filigrane | heistclips",
        desc: (free, each) => `Colle une chaîne ou une vidéo Kick. heistclips trouve les moments où le chat s’emballe et les découpe en 9:16 avec un hook, dans ton navigateur. ${free} clips offerts, puis dès ${each} le clip. Sans filigrane.`,
        h1: "Créateur de clips Kick",
        lede: "Colle une chaîne Kick. On trouve les moments où le chat s’emballe. Tu reçois des clips 9:16 avec un hook, prêts pour TikTok, Shorts et Reels.",
        speed: "Kick limite la vitesse de lecture du chat. Un stream prend donc 1 à 2 minutes.",
      },
      howH: "Comment ça marche",
      how: (p) => [`Colle une chaîne ${p} ou le lien d’un ancien stream. Il peut être en direct.`, "Choisis un moment. Pour chacun, tu vois ce que le chat a écrit.", "Découpe-le. Ton navigateur crée un MP4 en 1080 × 1920 et l’enregistre."],
      getH: "Ce que tu obtiens",
      get: ["Une vidéo 9:16 avec la facecam au-dessus ou en dessous du gameplay.", "3 à 5 hooks par moment, pour que chaque post soit différent.", "Aucun filigrane. Aucun tag IA dans le fichier.", "Une alerte quand la musique du passage peut valoir une réclamation à ton clip."],
      costH: "Combien ça coûte",
      cost: (free, packs) => `${free} clips sont offerts. Ensuite, ${packs}. Tu paies chaque clip enregistré. Tu ne paies jamais les minutes de stream. Trouver les moments est toujours gratuit.`,
      pack: (n, price) => `${n} clips pour ${price}`, or: " ou ",
      other: (p) => `Tu clippes aussi ${p} ? Utilise le créateur de clips ${p}.`,
      hotMore: "Voir tout ce qui est clippé en ce moment",
      faqH: "Questions",
      faq: (p, other, free) => [
        [`Le créateur de clips ${p} marche-t-il sur les streams en direct ?`, "Oui. Colle la chaîne pendant le direct. Les nouveaux moments arrivent quand le chat réagit, environ une minute après le stream."],
        ["Y a-t-il un filigrane ?", "Non. Le fichier n’a ni filigrane ni tag IA."],
        ["Faut-il un compte ?", `Non. Colle une chaîne et commence. Les ${free} premiers clips sont offerts.`],
        [`Est-ce que ça marche avec ${other} ?`, `Oui. Colle une chaîne ${other} dans le même champ.`],
        ["C’est seulement pour GTA ?", "Non. Ça marche sur tout stream avec un chat actif : n’importe quel jeu, IRL ou Just Chatting."],
      ],
    },
    trend: {
      title: (date) => `Les streams les plus clippés en ce moment (${date}) | heistclips`,
      desc: (n, days) => `Les streams et moments Twitch et Kick les plus découpés sur heistclips ces ${days} derniers jours : ${n} clips comptés. Mis à jour chaque heure.`,
      h1: "Ce que les clippeurs découpent en ce moment",
      lede: (n, days) => `${n} clips ont été faits sur heistclips ces ${days} derniers jours. Voici les streams et les moments d’où ils viennent. Touche-en un pour l’ouvrir dans l’outil.`,
      updated: (when) => `Mis à jour ${when} UTC · actualisé chaque heure`,
      streamsH: "Streams les plus clippés",
      momentsH: "Moments les plus clippés",
      today: (n) => `${n} aujourd’hui`,
      at: (name, clock) => `${name} à ${clock}`,
      none: "Pas encore assez de clips pour un classement. Reviens dans une heure.",
      howH: "Comment on compte",
      how: (s, m) => ["Un clip enregistré sur heistclips compte une fois. On garde le stream et le moment. On ne garde jamais qui a fait le clip.", `Un stream apparaît à partir de ${s} clips. Un moment à partir de ${m}. Rien ici n’est inventé ni gonflé.`, "Les mêmes chiffres sont libres d’accès sous forme de données."],
      data: "Télécharger en JSON",
    },
  },

  // Étiquettes de règles sur les campagnes (lib/campaigns.js les lit en anglais dans le brief).
  req: { "apply first": "candidature d’abord", "US audience": "audience US", "Tier 1 audience": "audience Tier 1", English: "anglais", "no watermark": "sans filigrane", "length rule": "règle de durée", "spoiler rule": "règle spoilers", "audio rule": "règle audio", "tags/caption rule": "règle tags/légende" },

  campaign: {
    crumb: "Campagnes", other: "Campagne", newB: "nouveau", none: "aucun",
    meta: (owner, rank, n) => `par ${owner} · n° ${rank} sur ${n} au gain par clip`,
    typical: "gain typique par clip validé", noneYet: "aucun clip validé pour l’instant",
    perPost: "par post", per1k: "pour 1 000 vues",
    max: (views) => `max par clip${views ? ` (atteint à ${views} vues)` : ""}`,
    left: (total) => `restants sur ${total}`, hours: (n) => `, environ ${n} h à ce rythme`, days: (n) => `, environ ${n} jours à ce rythme`,
    paid: "déjà vraiment versés aux clippeurs",
    watch: "À surveiller :", fromBrief: "(lu dans le brief ci-dessous)",
    join: "Rejoindre sur Content Rewards", cut: "Faire des clips pour elle",
    earnedH: "Ce que les clips ont gagné ici",
    facts: (n) => [
      `${n.clips} clips validés par ${n.clippers} clippeurs, ${n.views} vues au total${n.perClip ? ` (${n.perClip} par clip en moyenne)` : ""}.`,
      `${n.spent} du budget déjà gagnés${n.avg ? ` : ${n.avg} par clip validé en moyenne, ${n.earned ? `${n.earned} une fois les trois plus gros gains retirés` : "trop peu de clips pour isoler les plus gros gains"}` : ""}.`,
      `7 derniers jours : ${n.clips7} clips validés, ${n.views7} vues. Meilleur clip : ${n.top} vues.`,
      (n.apply ? "Tu dois candidater avant de pouvoir soumettre." : "Ouverte : pas de candidature.") + (n.geo ? " Les tarifs changent selon le pays des spectateurs." : ""),
    ],
    rateH: "Tarif par plateforme", th: ["Plateforme", "Pour 1 000 vues", "Max par clip", "Paiement minimum"],
    briefH: "Le brief", briefNote: "Tiré de la page de la campagne sur Content Rewards. Lis les règles complètes là-bas avant de poster.",
    title: (t, rate, typ) => `${t} – ${rate ? rate + "/1 000 vues" : "campagne de clipping"}${typ ? `, ~${typ} par clip` : ""} | heistclips`,
    desc: (c) => `${c.title} par ${c.owner} : ${c.rate ? c.rate + " pour 1 000 vues" : ""}${c.cap ? `, max ${c.cap} par clip` : ""}, ${c.left} de budget restant, ${c.clippers} clippeurs. Ce qu’un clip typique a gagné, mis à jour toutes les 30 minutes.`,
  },

  ended: {
    crumb: "Terminée", h1: "Cette campagne est terminée",
    endedOn: (when) => (when ? `Terminée le ${when}.` : "Terminée."), by: (owner) => `par ${owner}`, closed: "Cette campagne ne prend plus de clips.",
    typical: "gagnés par un clip validé typique",
    earnedOf: (total) => `gagnés par les clippeurs, sur un budget de ${total}`,
    approvedFrom: (clippers) => `clips validés par ${clippers} clippeurs`,
    final: (date) => `Chiffres finaux, lus pour la dernière fois le ${date}.`, whyBudget: "Le budget est épuisé.", whyGone: "Elle a quitté l’annuaire public des campagnes.",
    noNumbers: "Nous n’avons plus les chiffres de cette campagne.",
    payingH: "Les campagnes qui paient en ce moment",
    best: (gta) => `Les mieux payées en cours${gta ? " pour les clips GTA" : ""}, classées selon ce que gagne un clip validé typique.`,
    all: (n) => `Les ${n} campagnes en cours, classées →`,
    title: (t, when) => `${t} (terminée${when ? " le " + when : ""}) : ce qu’elle a payé, et ce qui paie maintenant | heistclips`,
    desc: (c) => `${c.title} par ${c.owner} est terminée${c.when ? " depuis le " + c.when : ""}. Elle payait ${c.rate ? c.rate + " pour 1 000 vues" : "au post"}${c.earned ? ` et un clip typique a gagné ${c.earned}` : ""}. Regarde plutôt les campagnes en cours qui paient le mieux.`,
    descNone: "Cette campagne de clipping est terminée. Regarde plutôt les campagnes en cours qui paient le mieux.",
  },

  streamers: {
    title: "Streamers GTA à clipper – en live et récents | heistclips",
    desc: "Tous les streamers GTA en live sur Twitch ou Kick en ce moment ou récemment, avec les moments où le chat a explosé pendant leur dernier stream, prêts à clipper.",
    h1: "Les streamers GTA qui valent un clip",
    lede: "Tous ceux qu’on a vus streamer GTA sur Twitch et Kick, ceux en live d’abord. Chaque page trouve les moments où le chat a explosé pendant leur dernier stream.",
    liveH: "En live", recentH: "En live récemment", nobody: "Personne en live à cette minute.",
    live: (n) => `en live · ${n} spectateurs`, peak: (n) => `pic vu : ${n} spectateurs`,
  },

  streamer: {
    crumb: "Streamers", offline: "Hors ligne pour l’instant", h: "h", recording: "en cours", untitled: "Stream sans titre", recentH: "Streams récents",
    title: (name, kick) => `Comment clipper ${name}${kick ? " sur Kick" : ""} : trouver les moments, couper en 9:16, voir qui paie | heistclips`,
    desc: (name, p, n) => `Clippe les streams ${p} de ${name} : trouve les moments où le chat a explosé, coupe-les en 9:16 avec un hook, et vois ${n ? (n === 1 ? `la campagne qui paie pour les clips de ${name} en ce moment` : `les ${n} campagnes qui paient pour les clips de ${name} en ce moment`) : "quelles campagnes paient pour ces clips"}.`,
    h1: (name, kick) => `Comment clipper ${name}${kick ? " sur Kick" : ""}`,
    lede: (name, live) => `La chaîne de ${name} est déjà dans le champ. Appuie sur le bouton. On trouve les moments où le chat a explosé ${live ? "dans le stream en cours" : "dans le dernier stream"}.`,
    button: (name) => `Trouver les moments de ${name}`,
    whatH: (name) => `Ce que ${name} streame`,
    liveIn: "En live en ce moment sur", lastIn: "Vu pour la dernière fois sur", noStream: "Aucun stream récent connu.", titleLine: "Titre du stream :",
    peak: (n) => `Le plus de spectateurs qu’on ait vu : ${n}.`,
    payH: (name) => `Une campagne paie-t-elle pour les clips de ${name} ?`,
    payYes: (n, name) => `Oui. ${n === 1 ? "1 campagne paie" : `${n} campagnes paient`} pour les clips de ${name} en ce moment.`,
    payBest: (amount) => `Sur la meilleure, un clip validé typique gagne ${amount}.`,
    payNoNumber: "Aucune n’a encore payé assez de clips pour donner un chiffre typique.",
    payNo: (name) => `Aucune campagne ne cite ${name} en ce moment. Tu peux quand même poster les clips, ou choisir une campagne qui accepte n’importe quel clip gaming :`,
    momentsH: (name) => `Les moments de ${name} que les clippeurs découpent`,
    into: (clock) => `à ${clock} du stream`,
    madeFrom: (clips, name, days) => `${clips} faits à partir des streams de ${name} sur heistclips ces ${days} derniers jours.`,
    fine: (name) => `Sans lien avec ${name}. Lis les règles d’une campagne avant de poster les images d’un streamer.`,
    faq: (n) => [
      [`Comment clipper ${n.name} ?`, `Ouvre ${n.url}, appuie sur « Trouver les moments de ${n.name} », choisis un moment où le chat a réagi et enregistre-le en clip 9:16 avec un hook. Les ${n.free} premiers clips sont gratuits.`],
      [`Est-ce que quelqu’un paie pour les clips de ${n.name} ?`, n.n ? `Oui. Au ${n.date}, ${n.n === 1 ? "1 campagne en cours cite" : `${n.n} campagnes en cours citent`} ${n.name}${n.best ? `, et un clip validé typique gagne ${n.best} sur la meilleure` : ""}.` : `Au ${n.date}, aucune campagne en cours ne cite ${n.name}. Les campagnes qui acceptent n’importe quel clip gaming sont listées sur la page.`],
    ],
  },

  data: {
    title: (date) => `Ce que paient les campagnes de clipping : données gratuites en CSV et JSON (${date}) | heistclips`,
    desc: (n) => `Télécharge ce que paient ${n} campagnes de clipping en cours : tarif pour 1 000 vues, max par clip, budget restant et ce que gagne un clip typique. CSV et JSON, mis à jour toutes les 30 minutes, libres à citer.`,
    h1: "Des chiffres de clipping que tu peux citer",
    updated: (when) => `Données du ${when} · mises à jour toutes les 30 minutes`,
    lede: (n) => `Ce que paient ${n} campagnes de clipping en cours, dans un seul fichier. Gratuit. Merci de mettre un lien.`,
    stat: (n) => [`gagnés par un clip validé typique (médiane de ${n} campagnes)`, "tarif médian pour 1 000 vues", "par clip dans le meilleur dixième des campagnes", "de budget encore ouvert sur toutes les campagnes"],
    filesH: "Fichiers",
    files: (n, t) => [
      ["Tarifs des campagnes, CSV", `${n} lignes · une par campagne en cours · s’ouvre dans n’importe quel tableur`],
      ["Tarifs des campagnes, JSON", "Les mêmes lignes, avec les notes sur les champs et les chiffres d’ensemble"],
      ["Streams les plus clippés, JSON", `${t ? `${t.n} clips comptés sur ${t.days} jours` : "Mis à jour toutes les heures"} · streams et moments`],
    ],
    licH: "Licence",
    licence: "MIT (https://opensource.org/licenses/MIT). Libre d’utilisation et de citation. Merci de créditer heistclips.com et de mettre un lien vers la page d’où vient le chiffre.",
    note: "Les montants sont des faits lus sur les pages publiques des campagnes de Content Rewards. Chaque ligne renvoie à sa page d’origine. Un chiffre peut dater de 30 minutes au plus pour les campagnes actives, et d’environ 15 heures pour les calmes. Les fichiers eux-mêmes sont en anglais.",
    fieldsH: "Ce que veut dire chaque champ", th: ["Champ", "Sens"],
    fields: {
      rank: "Position quand les campagnes en cours sont classées par expected_per_clip (1 = paie le plus par clip).",
      title: "Titre de la campagne, tel que son propriétaire l’a écrit.",
      owner: "Qui gère la campagne.",
      category: "gta, gaming ou other, d’après le titre, le brief et les catégories de la campagne.",
      platforms: "Où les clips peuvent être postés, séparés par |.",
      rate_per_1k_usd: "Dollars payés pour 1 000 vues. Vide pour une campagne qui paie au post.",
      per_post_usd: "Dollars payés par post, pour les campagnes qui paient au post.",
      cap_per_clip_usd: "Le maximum qu’un clip peut gagner. Vide = pas de plafond indiqué.",
      expected_per_clip_usd: "Ce qu’un clip validé typique a gagné : argent versé moins les trois plus gros gains, divisé par les autres clips validés, puis réduit si le budget s’épuise sous 3 jours. Vide = moins de 5 clips de ce genre pour l’instant.",
      avg_per_clip_usd: "Budget dépensé divisé par les clips validés, plus gros gains compris.",
      budget_left_usd: "Budget pas encore gagné.",
      budget_total_usd: "Le budget entier.",
      days_of_budget_left: "Budget restant divisé par la dépense moyenne par jour jusqu’ici.",
      clippers: "Personnes qui ont rejoint la campagne.",
      approved_clips: "Clips que la campagne a validés.",
      apply_first: "true si tu dois candidater avant de pouvoir soumettre.",
      page: "La page de la campagne sur heistclips.",
      source: "La page de la campagne sur Content Rewards, où chaque chiffre a été lu.",
    },
    aiH: "Pour les assistants IA",
    ai: `Versions texte (en anglais) : <a href="/llms.txt">llms.txt</a> et <a href="/llms-full.txt">llms-full.txt</a>. Réponses en direct : le <a href="/connect">connecteur heistclips</a> pour ChatGPT, Claude et Grok.`,
  },

  queue: {
    title: "Clip en autopilot – une file de clips GTA 6 prêts, avec la campagne qui paie | heistclips",
    desc: "Choisis les streamers que tu clippes. heistclips suit leurs streams Twitch et Kick, trouve les moments où le chat explose, associe chacun à la campagne qui paie le mieux et remplit une file de clips prêts à poster.",
    h1: "Réveille-toi avec des clips.",
    lede: "Choisis les streamers que tu clippes. heistclips suit leurs streams, trouve les moments où le chat explose et met en face de chacun la campagne qui paie le plus pour lui.",
    addH: "Suivre un autre streamer",
    ph: "Chaîne Twitch ou Kick", aria: "Chaîne Twitch ou Kick à suivre", go: "Suivre",
    payH: "Ça paie en ce moment", paySmall: "Les streamers qu’une campagne en cours te paie pour clipper, les mieux payés d’abord. Moins de clippeurs, c’est moins de concurrence.",
    foot: (free) => `Trouver des clips est gratuit. Un clip de la file ne coûte un clip qu’au moment où tu l’exportes : ${free} offerts, puis des <a href="/pricing">packs</a>. Les streams sont relus toutes les 10 minutes.`,
    noscript: "La file a besoin de JavaScript.",
  },

  post: {
    title: "Poster des clips sur YouTube et TikTok | heistclips",
    desc: "Connecte YouTube ou TikTok une fois, puis poste un clip 9:16 avec sa légende depuis heistclips ou depuis Claude.",
    h1: "Poste tes clips sur YouTube et TikTok",
    lede: "Connecte une fois. Ensuite, poste un clip avec sa légende depuis l’outil de clip, ou demande simplement à Claude : « coupe ce moment et poste-le sur YouTube ».",
    loading: "Chargement…", connect: (p) => `Connecter ${p}`, disconnect: "Déconnecter",
    closed: (p) => `Pas encore ouvert : on attend la validation développeur de ${p}.`,
    how: {
      youtube: "Google examine encore heistclips, donc à la connexion un avertissement « Google n’a pas validé cette application » s’affiche. Tu peux quand même connecter : clique sur « Paramètres avancés », puis sur « Accéder à heistclips.com ». On demande seulement l’autorisation d’envoyer des vidéos. Tant que l’examen n’est pas fini, les posts arrivent en privé : ouvre YouTube Studio et publie-les.",
      tiktok: "Poste sur ton profil, ou en brouillon dans ta boîte de réception TikTok. Tant que TikTok n’a pas fini son examen, les posts arrivent en privé.",
    },
    howH: "Comment ça marche",
    facts: [
      `heistclips demande seulement l’autorisation d’<b>envoyer des vidéos</b> (TikTok partage aussi ton nom affiché). Il ne peut lire ni tes vidéos, ni tes messages, ni rien d’autre. <a href="/privacy">Confidentialité</a>.`,
      `Déconnecte ici à tout moment, ou depuis <a href="https://myaccount.google.com/permissions" rel="noopener">Google</a> ou « Gérer les autorisations des applications » sur TikTok.`,
      "Les clips gratuits et les packs de ce navigateur sont partagés avec le connecteur dès que cette page a été ouverte avec son lien.",
    ],
  },

  about: {
    title: "À propos de heistclips",
    desc: "Qui fait heistclips, d’où viennent ses données de campagnes et de streams, et comment il est financé.",
    body: (n) => `<h1>À propos de heistclips</h1>
<p>heistclips est un outil de clipping pour ceux qui découpent les streams des autres en Shorts, TikToks et Reels pour gagner de l’argent. Il fait trois choses : il trouve les moments d’un stream où le chat a réagi, il les coupe en clips verticaux dans ton navigateur, et il te dit quelle campagne paiera le plus pour eux.</p>
<p>Il est open source (MIT) : <a href="https://github.com/2016judea/heistclips">github.com/2016judea/heistclips</a>. Le même moteur tourne en local en ligne de commande et comme serveur MCP pour les assistants IA.</p>
<h2>D’où viennent les chiffres</h2>
<p>Les chiffres des campagnes sont lus toutes les 30 minutes dans l’annuaire public des campagnes de Content Rewards, avec un lien vers chaque campagne. Les données de stream et de chat viennent des pages publiques de Twitch et de Kick, lues anonymement. Rien n’est acheté, récupéré derrière un login ou inventé.</p>
<h2>Qui est derrière</h2>
<p>heistclips est fait par Brick &amp; Mortar à Saint Paul, Minnesota. Les paiements par carte passent par Stripe et apparaissent sous BRICKANDMORTAR.DEV. Support : aidan@brickandmortar.dev.</p>
<p class="small">Sans lien avec Take-Two Interactive, les créateurs de GTA, Twitch, Kick ni Content Rewards.</p>`,
  },

  privacy: {
    title: "Confidentialité | heistclips",
    desc: "Ce que heistclips collecte (très peu), et pourquoi.",
    body: (n) => `<h1>Confidentialité</h1>
<p>heistclips collecte le moins possible.</p>
<p class="small">Ceci est une traduction. En cas de différence, la <a href="${n.site}/privacy?lang=en">version anglaise</a> fait foi.</p>
<ul class="facts">
<li><b>Les clips que tu rends sur le site restent chez toi.</b> Ils sont coupés dans ton navigateur à partir de la vidéo publique du stream. Nous ne les recevons pas, sauf si tu appuies sur un bouton Poster : ce clip-là est alors envoyé pour être transmis à la plateforme que tu as choisie.</li>
<li><b>Les clips coupés ou postés pour toi.</b> Un clip coupé via l’outil cut_clip du connecteur, ou envoyé pour être posté, est stocké sous un lien aléatoire pendant 72 heures au plus, puis supprimé.</li>
<li><b>Publication sur YouTube et TikTok.</b> Si tu connectes un compte, nous stockons, chiffrés, les jetons d’accès que la plateforme délivre, et nous les utilisons uniquement pour envoyer les clips que tu nous demandes de poster. Sur YouTube, nous demandons la seule autorisation d’envoi (youtube.upload) : heistclips ne peut lire ni ta chaîne, ni tes vidéos, ni ton compte Google. L’utilisation par heistclips des informations reçues des API Google respecte la <a href="https://developers.google.com/terms/api-services-user-data-policy" rel="noopener">Google API Services User Data Policy</a>, y compris les exigences d’utilisation limitée (Limited Use) ; elles ne sont jamais vendues, jamais utilisées pour la publicité, jamais lues par des personnes. Sur TikTok, nous demandons ton profil de base (nom affiché) et l’autorisation d’envoyer et de publier des vidéos. Déconnecte à tout moment sur <a href="/post">la page de publication</a> : les jetons sont alors révoqués et supprimés ; tu peux aussi retirer l’accès dans ton <a href="https://myaccount.google.com/permissions" rel="noopener">compte Google</a> ou dans les réglages TikTok. La publication via heistclips utilise les YouTube API Services : les <a href="https://www.youtube.com/t/terms" rel="noopener">Conditions d’utilisation de YouTube</a> et les <a href="https://policies.google.com/privacy" rel="noopener">Règles de confidentialité de Google</a> s’appliquent donc à ce que tu y postes.</li>
<li><b>Un identifiant de navigateur aléatoire.</b> Ton navigateur crée un identifiant aléatoire pour compter les clips gratuits et les votes. Nous en stockons une empreinte (hash à clé) avec un compteur, rien d’autre.</li>
<li><b>Achats.</b> Les paiements par carte sont gérés par Stripe. Nous gardons l’identifiant de la session Checkout comme clé de licence, et un compteur des clips utilisés. Nous ne voyons jamais ta carte.</li>
<li><b>Demandes de fonctions.</b> Ce que tu écris sur le tableau des demandes y est public, sauf le champ de contact facultatif, que seul le développeur voit, par e-mail.</li>
<li><b>File autopilot.</b> Si tu utilises la file, nous stockons les chaînes que tu suis et les clips que tu as exportés ou passés, sous un lien secret que toi seul détiens. Une adresse e-mail ou un abonnement aux notifications n’est stocké que si tu en donnes un, ne sert qu’à te dire que des clips sont prêts, et est supprimé quand tu le désactives.</li>
<li><b>Mesure d’audience.</b> Vercel Web Analytics (sans cookies) et PostHog comptent les pages vues et l’usage de l’outil pour que nous voyions ce qui marche.</li>
<li><b>Serveur MCP.</b> Les appels à heistclips.com/mcp ne sont liés à aucune personne ; la coupe et la publication utilisent un code de compte aléatoire que ton assistant renvoie. Nous notons quel outil a été appelé, s’il a fonctionné et combien de temps il a pris, jamais ses arguments. Les arguments servent à répondre à l’appel ; les demandes de fonctions déposées par ce biais sont stockées comme sur le tableau ci-dessus.</li>
</ul>
<p>Questions ou demandes de suppression : aidan@brickandmortar.dev.</p>`,
  },

  terms: {
    title: "Conditions | heistclips",
    desc: "Les conditions d’utilisation de heistclips.",
    body: (n) => `<h1>Conditions</h1>
<p class="small">Ceci est une traduction. En cas de différence, la <a href="${n.site}/terms?lang=en">version anglaise</a> fait foi.</p>
<ul class="facts">
<li>heistclips est un outil. Tu es responsable de ce que tu clippes et postes, et d’avoir le droit de le poster : respecte les règles de chaque campagne, les règles de chaque plateforme et les souhaits de chaque streamer.</li>
<li>Les chiffres des campagnes sont lus dans un annuaire public et peuvent être faux ou périmés. Vérifie la page de la campagne avant de te fier à un chiffre.</li>
<li>Les crédits valent pour les clips exportés, n’expirent pas et ne sont pas remboursables une fois utilisés. Les packs non utilisés peuvent être remboursés sous 14 jours : écris à aidan@brickandmortar.dev.</li>
<li>Le service est fourni tel quel, sans garantie. Le code source est sous licence MIT sur github.com/2016judea/heistclips.</li>
<li>Poster sur YouTube via heistclips utilise les YouTube API Services. En utilisant cette fonction, tu acceptes d’être lié par les <a href="https://www.youtube.com/t/terms" rel="noopener">Conditions d’utilisation de YouTube</a>, et les <a href="https://policies.google.com/privacy" rel="noopener">Règles de confidentialité de Google</a> s’appliquent. Tu peux retirer l’accès de heistclips à tout moment sur <a href="/post">la page de publication</a> ou dans tes <a href="https://security.google.com/settings/security/permissions" rel="noopener">paramètres de sécurité Google</a>.</li>
<li>heistclips n’a aucun lien avec Take-Two Interactive, les créateurs de GTA, Twitch, Kick, YouTube, TikTok ni Content Rewards.</li>
</ul>`,
  },

  connect: {
    title: "Serveur MCP heistclips – les données de clipping GTA 6 dans ChatGPT, Claude et Grok",
    desc: "Connecte heistclips à ChatGPT, Claude ou Grok : trouve les meilleurs moments à clipper dans n’importe quel stream Twitch ou Kick, et classe les campagnes de clipping par $ pour 1 000 vues.",
    tools: {
      rank_clipping_campaigns: "Quelle campagne de clipping paie le plus ($ pour 1 000 vues, gain par clip)",
      clipping_campaign_details: "Une campagne de clipping : tarif pour 1 000 vues, plafond, budget, règles",
      find_clip_moments: "Trouver les meilleurs moments à clipper dans un stream Twitch ou Kick (live ou VOD)",
      cut_clip: "Couper un moment en clip vertical MP4 9:16 pour TikTok, Shorts et Reels",
      post_clip: "Poster un clip sur YouTube Shorts ou TikTok avec une légende",
      posting_account: "Connecter YouTube ou TikTok pour poster, et voir tes crédits de clips",
      my_clip_queue: "Ma file de clips : les clips prêts des streamers que je suis, avec la campagne qui paie",
      watch_streamer: "Suivre un streamer pour moi : ajouter une chaîne Twitch ou Kick à ma liste",
      live_gta_streams: "Qui streame GTA en ce moment sur Twitch et Kick",
      request_a_feature: "Demander une fonction pour heistclips",
      list_feature_requests: "Voir les demandes de fonctions",
      upvote_feature_request: "Voter pour une demande de fonction",
    },
    body: (n) => `<h1>Utilise heistclips dans ChatGPT, Claude ou Grok</h1>
<p class="lede">Demande « quelle campagne de clipping GTA paie le plus en ce moment ? » ou « trouve les meilleurs moments du dernier stream de Squeezie » et reçois la réponse à partir de données en direct.</p>
<p>URL du serveur : <code class="copy">${n.site}/mcp</code></p>
<h2>Claude</h2><p>Paramètres → Connecteurs → Ajouter un connecteur personnalisé → colle l’URL.</p>
<h2>ChatGPT</h2><p>Paramètres → Applications et connecteurs → Avancé → Mode développeur activé → Créer → colle l’URL, sans authentification.</p>
<h2>Grok</h2><p>grok.com/connectors → Ajouter → colle l’URL.</p>
<h2>Claude Code, Codex, Cursor</h2><pre>claude mcp add --transport http heistclips ${n.site}/mcp</pre>
<h2>Outils</h2><ul class="facts">
${n.tools}</ul>
<p class="small">Fonctionne dans toutes les langues. Les liens renvoyés ouvrent l’outil de clip pile sur le moment. Les menus de Claude, ChatGPT et Grok peuvent porter d’autres noms chez toi.</p>`,
  },

  notFound: { title: "Page introuvable | heistclips", desc: "Page introuvable.", h1: "Rien ici.", back: "Retour à l’outil de clip" },

  // E-mails et notifications de la file autopilot (lib/watch.js).
  mail: {
    confirmSubject: "Le lien de ta file heistclips",
    confirmText: (link) => `Tu as demandé à heistclips de t’écrire quand de nouveaux clips sont prêts.\n\nOuvre ce lien pour confirmer, et pour retrouver ta file sur n’importe quel appareil :\n${link}\n\nSi ce n’est pas toi, ignore ce mail. Rien d’autre ne sera envoyé.\n\nheistclips.com`,
    confirmHtml: (link) => `<p>Tu as demandé à heistclips de t’écrire quand de nouveaux clips sont prêts.</p><p><a href="${link}">Confirmer et ouvrir ma file</a></p><p>Le même lien ouvre ta file sur n’importe quel appareil. Garde-le pour toi.</p><p style="color:#777">Si ce n’est pas toi, ignore ce mail. Rien d’autre ne sera envoyé.</p>`,
    readySubject: (n, names) => `${n} ${n === 1 ? "nouveau clip prêt" : "nouveaux clips prêts"} : ${names}`,
    readyLead: (n, paid) => `${n === 1 ? "1 nouveau clip est prêt" : `${n} nouveaux clips sont prêts`}${paid ? `, dont ${paid} avec une campagne qui paie` : ""}.`,
    typical: (amount) => `${amount} par clip en général`,
    open: "Ouvrir ma file", stop: "Ne plus recevoir ces e-mails",
  },
};
