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
};
