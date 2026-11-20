// Español. Escrito como habla quien hace clips (tú, clip, gancho, el chat explota), no traducido
// palabra por palabra del inglés. Las cifras salen siempre del snapshot en vivo, nunca de este texto.
const B = (s) => `<b>${s}</b>`;

export default {
  locale: "es",
  updated: (when, min) => `Actualizado el ${when} · ${min < 2 ? "ahora mismo" : min < 90 ? `hace ${min} min` : `hace ${Math.round(min / 60)} h`} · se actualiza cada 30 minutos`,
  watching: (n) => `${n} viendo`,
  form: { ph: "Canal de Twitch o Kick, o enlace de VOD", go: "Buscar momentos" },
  // Etiquetas fijas de las filas de campaña (las filas las arma render.js en inglés).
  rows: [
    [/>(<span class="pulse"><\/span>|▶ )Clip (.+?)’s stream now<\/a>/g, ">$1Clipear el directo de $2 ahora</a>"],
    [/<span>typical per clip<\/span>/g, "<span>por clip, lo normal</span>"],
    [/<b class="big new">new<\/b><span>up to ([^<]+) a clip<\/span>/g, '<b class="big new">nueva</b><span>hasta $1 por clip</span>'],
    [/ \/ 1k views/g, " / 1.000 vistas"], [/ per post/g, " por publicación"], [/ · cap /g, " · tope "], [/ left( \(| <b| ·)/g, " restantes$1"],
    [/\(~(\d+) days\)/g, "(~$1 días)"], [/\(~(\d+) h of budget at this pace\)/g, "(~$1 h de presupuesto a este ritmo)"],
    [/ (\d[\d,.k]*) clippers/g, " $1 clippers"], [/paid out /g, "ya pagó "], [/<em>apply first<\/em>/g, "<em>hay que postular</em>"], [/class="tag g">gaming</g, 'class="tag g">gaming<'],
  ],

  home: {
    title: "Herramienta de clips de GTA 6 – encuentra el momento, corta el clip, cobra | heistclips",
    desc: "Encuentra los momentos en que el chat explota en los directos de GTA 6, córtalos en 9:16 con gancho en tu navegador y mira qué campaña de clips paga más por clip ahora mismo.",
    h1: "Clipea los directos de GTA VI mientras están en vivo.",
    lede: "Hecho para gameplay, no para podcasts. Pega un canal de Twitch o Kick: heistclips sigue el chat, marca el segundo en que explota y lo corta en 9:16 (facecam sobre el gameplay), con gancho, en tu navegador.",
    small: (n, each) => `<b>${n} clips gratis.</b> Después, ${each} por clip. Sin cobro por minuto. Sin marca de agua. Sin etiqueta de IA en el archivo.`,
    liveH: "En vivo en GTA ahora mismo",
    payH: "Lo que más paga por clip ahora mismo",
    paySmall: (gta) => `Campañas de gaming y de streamers, ordenadas por lo que de verdad ha ganado un clip aprobado normal. ${gta === 1 ? "1 campaña de GTA activa hoy" : `${gta} campañas de GTA activas hoy`}.`,
    all: (n) => `Las ${n} campañas, en ranking →`,
    askH: "¿Te falta algo?",
    askP: "Pide una función. Construimos lo que piden los clippers.",
    askLink: "Mira lo pedido, lo que está en marcha y lo ya entregado →",
    trend: "Lo que los clippers están cortando ahora →",
    post: { h: "Publícalo directo en YouTube", p: `Conecta tu canal de YouTube una vez. Después publicas el clip como Short con tu descripción, desde la herramienta de clips o desde Claude. <a href="/post">Conectar YouTube →</a> La publicación usa los YouTube API Services; mira nuestra página de <a href="/privacy">Privacidad</a>.` },
    three: [
      ["El chat encuentra el momento", "Los momentos de un juego son visuales: una transcripción no los ve. El chat sí. Cada pico es una marca de tiempo, con las líneas que escribió el chat, para que veas por qué se eligió. Funciona con directos que siguen en vivo."],
      ["Tu navegador hace el corte", "Facecam sobre el gameplay, fondo desenfocado o recorte centrado; de 3 a 5 ganchos para que cada publicación sea distinta; chat superpuesto. Renderizado en tu equipo, sin marca de agua, descargado al momento."],
      ["La música queda marcada", "La radio del juego es música con licencia. Si Twitch silenció ese tramo, te lo decimos antes de que publiques y pierdas el pago por un reclamo."],
    ],
  },

  clip: {
    title: "Creador de clips de GTA 6 – momentos del chat de Twitch o Kick, corte 9:16 en tu navegador | heistclips",
    desc: "Pega un canal o VOD de Twitch o Kick. heistclips encuentra los momentos en que el chat explotó, marca la música con licencia y corta clips 9:16 con gancho directamente en tu navegador.",
    h1: "Encuentra los momentos. Corta el clip.",
    hint: "Pega un canal de Twitch o Kick (en vivo o no) o un enlace de VOD. Se lee el chat, no el video: un directo de 7 horas tarda unos 20 segundos.",
  },

  pricing: {
    title: "Precios – pagas por clip, nunca por minuto de directo | heistclips",
    desc: (n, packs) => `${n} clips de GTA 6 gratis, después ${packs.map((p) => `${p.clips} por ${p.price} USD`).join(" o ")}. Buscar momentos siempre es gratis.`,
    h1: "Paga por clip. Nunca por minuto.",
    lede: (n) => `${n} clips gratis. Después compras un paquete. Buscar momentos siempre es gratis.`,
    free: "Gratis", clips: (n) => `${n} clips`, start: "Empezar a clipear", each: (c) => `${c} por clip`, buy: (n) => `Comprar ${n} clips`,
    pay: "El pago va por Stripe: tarjeta, Apple Pay, Google Pay o Link. Los precios aquí están en dólares; Stripe te muestra el importe en tu moneda antes de pagar.",
    faqH: "Preguntas",
    faq: [
      ["¿Por qué por clip y no por minuto?", "A los clippers les pagan por clip que funciona. Las herramientas que cobran por minuto de video te hacen pagar las siete horas de directo que nunca vas a publicar. Aquí el directo se lee gratis; solo pagas los clips que exportas."],
      ["¿Qué cuenta como un clip?", "Un video 9:16 exportado. La vista previa, la búsqueda de momentos y volver a leer un directo son gratis. Renderizar el mismo momento con otro gancho cuenta como un clip nuevo."],
      ["¿Los créditos caducan?", "No."],
      ["¿Dónde se hace el video?", "En una computadora, en tu propio navegador. En el teléfono, en Safari o cuando Claude o ChatGPT lo cortan, nuestro servidor lo corta directo del stream. Un archivo de video tuyo, como una copia de YouTube, nunca sale de tu equipo."],
      ["¿Qué aparece en mi estado de cuenta?", "BRICKANDMO* HEISTCLIPS. Brick & Mortar es la empresa detrás de heistclips; la página de pago dice heistclips."],
    ],
  },

  requests: {
    kindFeature: "Pedir una función", kindBug: "Reportar un bug", bugPh: "¿Qué salió mal? p. ej. «El MP4 no tiene sonido»", bugAria: "Qué salió mal", bugStreamPh: "Enlace del directo o nombre del streamer (opcional)", bugWhatPh: "¿Qué pasó? ¿Dónde hiciste clic y qué hizo heistclips?", bugExpectPh: "¿Qué esperabas en su lugar? (opcional)", bugBtn: "Reportar", bugOk: "Reportado. Está en el tablero y el desarrollador ya lo tiene.", bugTag: "Bug", filterAll: "Todo", filterFeatures: "Funciones", filterBugs: "Bugs", moreBug: "Añadir una forma de contactarte (opcional)",
    title: "Peticiones de funciones – lo que los clippers quieren después | heistclips",
    desc: "Vota funciones o pide nuevas para heistclips, la herramienta de clips de GTA 6. Pedido, en marcha y entregado, todo en público.",
    h1: "Lo que pidieron los clippers",
    lede: "Vota lo que quieres después o pide otra cosa. Sin cuenta, en cualquier idioma. Construimos lo que recibe votos, y las peticiones entregadas se quedan aquí como prueba.",
    counts: (r, b, s) => `${r} pedidas · ${b} en marcha · ${s} entregadas`,
    ph: "¿Qué debería hacer heistclips? p. ej. «Detectar la facecam solo»", aria: "Tu petición",
    more: "Añadir detalles o un contacto (opcional)", detailPh: "¿Qué intentabas hacer?", contactPh: "Correo o @usuario, solo si quieres respuesta",
    btn: "Pedir", upvote: "Votar",
    note: "Los elementos marcados «Sugerido por heistclips» los añadimos nosotros en el lanzamiento, a partir de lo que dicen los clippers en Reddit. Cada contador empezó en 0; solo lo mueven los votos reales, uno por navegador.",
    status: { requested: "pedido", building: "en marcha", shipped: "entregado" },
    lead: { shipped: "Entregado", building: "En marcha", update: "Novedad" },
    byUs: "Sugerido por heistclips", byClipper: "Pedido por un clipper",
    seeds: {
      "Clip streams while they're live": ["Clipear directos mientras están en vivo", "Encontrar y cortar momentos de un directo que sigue en marcha, no solo cuando el VOD ya terminó."],
      "Facecam-over-gameplay vertical layout": ["Formato vertical con facecam sobre el gameplay", "El formato apilado que de verdad usan los clips de juegos, por defecto en lugar del recorte centrado."],
      "No watermark, no per-minute billing": ["Sin marca de agua, sin cobro por minuto", "Se paga por clip exportado; nunca una marca de agua en el archivo."],
      "Warn me before a campaign's budget runs out": ["Avísame antes de que se acabe el presupuesto de una campaña", "Una alerta cuando a una campaña para la que clipeo le quedan horas, no días, de presupuesto."],
      "Mute or swap licensed in-game radio": ["Silenciar o cambiar la radio con licencia del juego", "Para que los clips no reciban un reclamo de Content ID ni los silencien en TikTok."],
      "Kick support": ["Compatibilidad con Kick", "Encontrar y cortar momentos de directos de Kick, en vivo o guardados."],
      "Spoiler filter": ["Filtro de spoilers", "Saltar los momentos que muestran spoilers de la historia, para las campañas que los prohíben."],
      "Strip \"AI-generated\" metadata on export": ["Quitar los metadatos de «generado por IA» al exportar", "Lo exportado nunca debería marcarse como hecho por IA cuando las imágenes no lo son."],
      "Track which hook variant won": ["Saber qué gancho ganó", "Dime qué gancho del primer segundo tuvo más vistas en todas mis publicaciones."],
      "Earnings tracker across campaigns": ["Registro de ganancias en todas las campañas", "Mis USD por hora en cada campaña para la que clipeo."],
      "Posting-cadence guard for new accounts": ["Límite de publicaciones para cuentas nuevas", "Avísame antes de que publique tanto que a una cuenta nueva le caiga un shadowban."],
      "Discord bot for my clipping team": ["Bot de Discord para mi equipo de clips", "Mandar los momentos nuevos al canal de Discord del equipo en cuanto ocurren."],
      "YouTube Live support": ["Compatibilidad con YouTube Live", "La misma búsqueda de momentos para directos en YouTube Live."],
    },
  },

  ranker: {
    title: (date) => `Campañas de clips de GTA 6 ordenadas por pago por clip (${date}) | heistclips`,
    desc: (n, gta, gaming) => `${n} campañas de clips activas, ordenadas por lo que de verdad gana un clip aprobado normal. ${gta} de GTA, ${gaming} de gaming y streamers. Se actualiza cada 30 minutos.`,
    h1: "Campañas de clips de GTA 6, por lo que paga un clip",
    lede: (n, tracked, typ, p90, p10) => `${n} campañas están pagando a clippers ahora mismo. En las ${tracked} que tienen historial, un clip aprobado normal ha ganado ${B(typ)}; la décima parte que más paga da ${B(p90 + "+")}, y la que menos, por debajo de ${B(p10)}. El mismo trabajo, un dinero muy distinto.`,
    tabGaming: "Gaming y streamers", tabAll: "Todo",
    none: "No hay campañas aquí en este minuto. Se abren por oleadas alrededor del lanzamiento; esta página se actualiza cada 30 minutos.",
    showing: (n) => `Se muestran las 150 primeras de ${n}.`,
    methodH: "Cómo funciona el ranking",
    method: [
      "<b>Por clip, lo normal</b> = el dinero que una campaña ha pagado por clips aprobados, menos sus tres mayores pagos, dividido entre el resto de sus clips aprobados. Es lo que de verdad ha ganado un clip corriente, no el mejor.",
      "Esa cifra se recorta si el presupuesto está por acabarse: un clip consigue casi todas sus vistas en los tres primeros días, así que una campaña con un día de dinero paga un tercio. Las campañas sin clips aprobados van detrás de las probadas, ordenadas por lo máximo que puede ganar un clip.",
      "Las cifras salen del directorio público de Content Rewards y se actualizan cada 30 minutos. Cada campaña enlaza a su propia página allí, donde te unes.",
    ],
  },

  rates: {
    title: (rate, typ) => `Cuánto pagan hoy los clips de GTA 6 – ${rate} por 1.000 vistas de mediana, ${typ} por clip | heistclips`,
    desc: (rate, cap, typ, gta) => `Tarifas de clips de GTA 6 en vivo: mediana de ${rate} por 1.000 vistas, tope de ${cap}, un clip normal gana ${typ}. ${gta} campañas de GTA activas. Se actualiza cada 30 minutos.`,
    h1: "Cuánto pagan hoy los clips de GTA 6",
    stat: ["gana un clip aprobado normal", "mediana por 1.000 vistas", "tope mediano por clip", "campañas de GTA activas"],
    lede: (n, budget, p90, p10) => `${n} campañas están pagando a clippers, con ${budget} de presupuesto restante entre todas. La décima parte que más paga da ${p90}+ por clip aprobado; la que menos, por debajo de ${p10}.`,
    gtaH: "Campañas de GTA",
    none: "Ninguna activa en este minuto. Se abren por oleadas alrededor del lanzamiento.",
    all: "Todas las campañas, en ranking →",
    histH: (n) => `Las últimas ${n} actualizaciones`,
    th: ["UTC", "Campañas", "GTA", "Normal/clip", "Mediana", "Presupuesto restante"],
  },

  guides: {
    title: "Guías de clips de GTA 6 | heistclips",
    desc: "Cuánto paga clipear GTA 6, cómo funcionan los reclamos de música, el dinero de Shorts frente a las campañas y cómo clipear un directo rápido.",
    h1: "Guías",
    pages: {
      "how-much-does-gta-6-clipping-pay": {
        name: "¿Cuánto paga clipear GTA 6?",
        title: () => "¿Cuánto paga clipear GTA 6? Tarifas por clip en vivo | heistclips",
        desc: (n) => `Un clip aprobado normal gana ${n.typical}; las mejores campañas pagan ${n.p90}+. Tarifas, topes y presupuestos en vivo, actualizados cada 30 minutos.`,
        page: (n) => ({
          body: `<h1>¿Cuánto paga clipear GTA 6?</h1>
<p class="updated">Las cifras de esta página son en vivo, leídas de ${n.campaigns} campañas el ${n.when}.</p>
<p class="lede">Un clip aprobado normal gana <b>${n.typical}</b>. La décima parte de las campañas que mejor paga da <b>${n.p90}+</b> por el mismo clip. Importa más la campaña que eliges que lo bueno que sea el clip.</p>
<h2>La fórmula</h2>
<p>Pago por clip = vistas × tarifa por 1.000 vistas, hasta el tope, mientras quede presupuesto.</p>
<ul class="facts">
<li>Tarifa mediana: <b>${n.rate}</b> por 1.000 vistas.</li>
<li>Tope mediano: <b>${n.cap}</b> por clip, que se alcanza con ${n.capViews} vistas.</li>
<li>Mediana de vistas por clip aprobado: <b>${n.views}</b>.</li>
<li>Presupuesto restante entre todas las campañas: <b>${n.budget}</b>.</li>
</ul>
<h2>Por qué la mayoría de los clips gana menos de lo que sugiere la tarifa</h2>
<p>Tres cosas se comen el dinero: un clip que nunca se aprueba, un presupuesto que se acaba antes de que lleguen tus vistas y una campaña tan saturada que cada momento ya está publicado. El ranking de <a href="${n.ranker}">la página de campañas</a> usa lo que los clips han ganado de verdad, así que esas tres ya están dentro de la cifra.</p>
<h2>Campañas de GTA activas ahora mismo</h2>
${n.gtaRows()}`,
          faq: [
            ["¿Cuánto paga clipear GTA 6?", `Ahora mismo la campaña mediana paga ${n.rate} por 1.000 vistas, con un tope de ${n.cap} por clip. En ${n.tracked} campañas con historial, un clip aprobado normal ha ganado ${n.typical}; la décima parte que más paga da ${n.p90} o más por clip.`],
            ["¿Cómo se calcula el pago?", `Vistas del clip × tarifa por 1.000 vistas, hasta el tope por clip, mientras la campaña tenga presupuesto. A ${n.rate} por 1.000 vistas, un clip necesita ${n.capViews} vistas para llegar a un tope de ${n.cap}.`],
            ["¿Cuentan todas las vistas?", "Solo las vistas de los clips que la campaña aprueba. La mayoría rechaza vistas de bots, resubidas y clips que rompen sus reglas. El dinero también se detiene cuando se acaba el presupuesto, aunque tu clip siga sumando vistas."],
          ],
        }),
      },
      "gta-6-music-copyright-claims": {
        name: "Clips de GTA 6 y reclamos de música: por qué la radio mata el pago",
        title: () => "Clips de GTA 6 y reclamos de derechos de música – evita la radio | heistclips",
        desc: () => "La radio del juego es música con licencia. Cómo Content ID y los reclamos de TikTok acaban con el pago de un clip, y cómo detectar un momento de riesgo antes de publicar.",
        page: (n) => ({
          body: `<h1>Clips de GTA 6 y reclamos de música</h1>
<p class="lede">La forma más rápida de perder el pago de un clip es una canción en la radio del coche. Revisa el audio antes de publicar.</p>
<h2>Por qué pasa</h2>
<p>Las emisoras de GTA ponen canciones reales, con licencia. Un streamer que conduce con la radio encendida está emitiendo esas canciones. Twitch las silencia en el directo guardado cuando su detector las encuentra, y YouTube y TikTok pasan sus propios detectores en cada subida.</p>
<h2>Lo que te cuesta</h2>
<ul class="facts"><li>YouTube: un reclamo de Content ID puede enviar el dinero del clip a la discográfica, o bloquearlo.</li><li>TikTok: pueden silenciar el sonido, y eso mata un clip de reacción.</li><li>Campañas: muchas rechazan clips reclamados o sin sonido, así que esas vistas nunca se pagan.</li></ul>
<h2>Cómo lo marca heistclips</h2>
<p>Cada momento que encuentra se compara con los tramos que Twitch silenció por música en ese directo. Si coincide con uno, se marca como <b>riesgo de música: alto</b>. Si el chat habla de una canción, se marca como <b>medio</b>. Elige momentos de riesgo bajo, o corta el clip en la parte sin radio.</p>
<p><a class="btn" href="${n.clip}">Revisar un directo</a></p>`,
          faq: [
            ["¿Puedo usar la música de la radio de GTA en los clips?", "No sin riesgo. Las canciones de la radio del juego son música comercial con licencia. Twitch las silencia en los directos guardados, y Content ID de YouTube y el detector de TikTok pueden reclamar o silenciar un clip que las lleve."],
            ["¿Qué pasa si mi clip recibe un reclamo de música?", "En YouTube el titular puede quedarse con los ingresos o bloquear el video; en TikTok pueden silenciar el sonido. Muchas campañas de clips rechazan o dejan de pagar los clips con reclamos o sin audio."],
            ["¿Cómo sé si un momento tiene música con licencia?", "heistclips revisa si Twitch silenció ese tramo del directo. Twitch lo hace cuando su detector oye música con licencia, así que un tramo mudo es un aviso serio. También marca los momentos en que el chat habla de una canción."],
          ],
        }),
      },
      "shorts-money-vs-clipping-campaigns": {
        name: "El dinero de YouTube Shorts frente a las campañas de clips",
        title: () => "Dinero de YouTube Shorts o campañas de clips para clips de GTA 6 | heistclips",
        desc: (n) => `Shorts paga de un fondo común; las campañas pagan una tarifa fija por vista (mediana de ${n.rate} por 1.000 hoy). Qué paga de verdad por clips de directos de GTA 6.`,
        page: (n) => ({
          body: `<h1>El dinero de YouTube Shorts frente a las campañas de clips</h1>
<p class="lede">Shorts paga de un fondo común. Una campaña paga una tarifa fija por vista. Para un clip del directo de otra persona, la campaña suele ser el único dinero que hay.</p>
<h2>Cómo paga Shorts</h2>
<p>YouTube junta los ingresos por anuncios del feed de Shorts, aparta una parte para licencias de música y paga a los creadores del Programa de Socios el 45 % del resto, repartido por vistas. Primero tienes que estar en el Programa de Socios, y un clip del directo de otro creador puede rechazarse como contenido reutilizado.</p>
<h2>Cómo pagan las campañas</h2>
<p>Un streamer o una marca pone un presupuesto y paga una tarifa fija por 1.000 vistas en clips aprobados: ${n.rate} es la mediana hoy, con un tope de ${n.cap} por clip. No necesitas un canal monetizado; necesitas vistas y un clip aprobado.</p>
<h2>Qué hacer</h2>
<p>Publica el clip donde paga la campaña (la mayoría paga en TikTok, Shorts y Reels a la vez) y envíalo. Lo que Shorts sume encima es un extra.</p>
<p><a class="btn" href="${n.ranker}">Ver qué pagan hoy las campañas</a></p>`,
        }),
      },
      "how-to-clip-gta-6-streams": {
        name: "Cómo clipear directos de GTA 6, rápido",
        title: () => "Cómo clipear directos de GTA 6 rápido – del momento en vivo al clip publicado | heistclips",
        desc: () => "Seis pasos de un directo de GTA 6 a un clip publicado y pagado: elegir la campaña, encontrar el pico del chat, revisar la música, cortar en 9:16 con gancho, publicar primero.",
        page: (n) => ({
          body: `<h1>Cómo clipear directos de GTA 6, rápido</h1>
<p class="lede">La semana del lanzamiento premia al primer clip de un momento, no al mejor. Este es el camino más corto de un directo a un clip publicado.</p>
<ol class="steps">
<li><b>Elige primero el dinero</b><p>Abre la página de campañas y elige una que pague por el streamer que vas a clipear, con presupuesto para al menos tres días más.</p></li>
<li><b>Pega el canal</b><p>Pega el canal de Twitch del streamer en heistclips. Si está en vivo, sigue el chat mientras pasa; si no, lee su último directo.</p></li>
<li><b>Quédate con el pico más grande</b><p>Los momentos se ordenan por cuánto se aceleró el chat frente a lo normal, cuánta gente escribió «clip it» y si los espectadores ya lo clipearon en Twitch.</p></li>
<li><b>Revisa el aviso de música</b><p>Sáltate los momentos con riesgo de música alto, o recorta la radio.</p></li>
<li><b>Córtalo con un gancho</b><p>Elige un formato, elige o escribe un gancho para el primer segundo y renderiza. El clip se hace en tu navegador y se descarga como archivo de video.</p></li>
<li><b>Publica y envía</b><p>Publica en todas las plataformas donde paga la campaña y envía los enlaces en la página de la campaña. Hazlo rápido: la primera subida de un momento se lleva las vistas.</p></li>
</ol>
<p><a class="btn" href="${n.clip}">Abrir la herramienta de clips</a></p>`,
        }),
      },
      "reused-content-shadowbans-posting-cadence": {
        name: "Contenido reutilizado, shadowbans y cada cuánto publicar clips",
        title: () => "Contenido reutilizado, shadowbans y ritmo de publicación para cuentas de clips | heistclips",
        desc: () => "Por qué desmonetizan los canales de clips por contenido reutilizado, cuántos clips puede publicar una cuenta nueva antes de un shadowban y cómo hacer distinta cada subida.",
        page: (n) => ({
          body: `<h1>Contenido reutilizado, shadowbans y cada cuánto publicar</h1>
<p class="lede">El dinero de los clips viene de las campañas, no de la plataforma. Cuida la cuenta que lo gana.</p>
<h2>Contenido reutilizado</h2>
<p>El Programa de Socios de YouTube puede rechazar o desmonetizar un canal que solo resube imágenes de otros. Eso afecta a la parte de anuncios de YouTube, no al pago de una campaña. Si clipeas para campañas, el ingreso es la campaña; lo de Shorts es un extra.</p>
<h2>Shadowbans en cuentas nuevas</h2>
<p>El patrón que cuentan los clippers: una cuenta nueva publica 10 clips el primer día y sus vistas caen a cero. Usa la cuenta con normalidad unos días, luego publica de tres a cinco al día y ve subiendo desde ahí.</p>
<h2>Haz distinta cada publicación</h2>
<p>Las plataformas detectan las subidas idénticas. Cambia el primer segundo (el gancho), el corte y el formato en cada publicación. heistclips escribe de 3 a 5 ganchos por momento y renderiza cada uno como archivo propio, sin marca de agua y sin etiqueta de «generado por IA» en el archivo.</p>
<p><a class="btn" href="${n.clip}">Cortar un momento</a></p>`,
          faq: [
            ["¿Por qué YouTube desmonetizó mi canal de clips por contenido reutilizado?", "El Programa de Socios de YouTube no paga por contenido que repite el video de otra persona sin aportar algo propio. Un canal de clips que solo resube trozos de directos puede ser rechazado o desmonetizado por esa norma. Los pagos de las campañas van aparte: una campaña paga por vista en los clips aprobados, esté o no monetizado tu canal."],
            ["¿Cuántos clips al día puedo publicar en una cuenta nueva?", "Los clippers cuentan que les cae un shadowban cuando una cuenta recién creada publica más de tres a cinco veces al día. Calienta la cuenta unos días con uso normal, luego publica unos pocos al día y sube poco a poco."],
            ["¿Se nota si publico el mismo clip en varias cuentas?", "Las subidas idénticas son fáciles de detectar para las plataformas. Cambia algo real cada vez: el gancho del primer segundo, el corte, el formato. Por eso heistclips da de 3 a 5 ganchos distintos a cada momento."],
          ],
        }),
      },
    },
  },

  // Twitch/Kick clip maker and "most clipped right now" (lib/searchpages.js; English in lib/search_words.js).
  search: {
    box: { ph: (p) => `Canal o enlace de VOD de ${p}`, go: "Buscar momentos", fine: "Sin cuenta. Sin marca de agua. Tu navegador corta el clip.", hot: "Se está clipeando ahora" },
    clips: (n) => `${n} clip${n === 1 ? "" : "s"}`,
    maker: {
      twitch: {
        title: "Creador de clips de Twitch: clips 9:16 con gancho, sin marca de agua | heistclips",
        desc: (free, each) => `Pega un canal o VOD de Twitch. heistclips encuentra los momentos en que el chat explotó y los corta en 9:16 con gancho, en tu navegador. ${free} clips gratis, luego desde ${each} por clip. Sin marca de agua.`,
        h1: "Creador de clips de Twitch",
        lede: "Pega un canal de Twitch. Encontramos los momentos en que el chat explotó. Recibes clips 9:16 con gancho, listos para TikTok, Shorts y Reels.",
        speed: "Un directo de 7 horas se lee en unos 20 segundos.",
      },
      kick: {
        title: "Creador de clips de Kick: clips 9:16 con gancho, sin marca de agua | heistclips",
        desc: (free, each) => `Pega un canal o vídeo de Kick. heistclips encuentra los momentos en que el chat explotó y los corta en 9:16 con gancho, en tu navegador. ${free} clips gratis, luego desde ${each} por clip. Sin marca de agua.`,
        h1: "Creador de clips de Kick",
        lede: "Pega un canal de Kick. Encontramos los momentos en que el chat explotó. Recibes clips 9:16 con gancho, listos para TikTok, Shorts y Reels.",
        speed: "Kick limita la velocidad de lectura del chat. Por eso un directo tarda de 1 a 2 minutos.",
      },
      howH: "Cómo funciona",
      how: (p) => [`Pega un canal de ${p} o el enlace de un directo pasado. Puede estar en vivo ahora.`, "Elige un momento. Cada uno muestra lo que escribió el chat.", "Córtalo. Tu navegador crea un MP4 en 1080 × 1920 y lo guarda."],
      getH: "Lo que recibes",
      get: ["Vídeo 9:16 con la facecam arriba o abajo del gameplay.", "De 3 a 5 ganchos por momento, para que cada publicación sea distinta.", "Sin marca de agua. Sin etiqueta de IA en el archivo.", "Un aviso cuando la música de ese tramo puede traerle un reclamo a tu clip."],
      costH: "Cuánto cuesta",
      cost: (free, packs) => `${free} clips son gratis. Después, ${packs}. Pagas por cada clip guardado. Nunca pagas por minutos de directo. Buscar momentos siempre es gratis.`,
      pack: (n, price) => `${n} clips por ${price}`, or: " o ",
      other: (p) => `¿También clipeas en ${p}? Usa el creador de clips de ${p}.`,
      hotMore: "Ver todo lo que se está clipeando ahora",
      faqH: "Preguntas",
      faq: (p, other, free) => [
        [`¿El creador de clips de ${p} funciona con directos en vivo?`, "Sí. Pega el canal mientras está en vivo. Los momentos nuevos aparecen cuando el chat reacciona, más o menos un minuto por detrás del directo."],
        ["¿Lleva marca de agua?", "No. El archivo no lleva marca de agua ni etiqueta de IA."],
        ["¿Necesito una cuenta?", `No. Pega un canal y empieza. Los primeros ${free} clips son gratis.`],
        [`¿Funciona con ${other}?`, `Sí. Pega un canal de ${other} en el mismo campo.`],
        ["¿Es solo para GTA?", "No. Funciona en cualquier directo con chat activo: cualquier juego, IRL o Charlando."],
      ],
    },
    trend: {
      title: (date) => `Los directos más clipeados ahora (${date}) | heistclips`,
      desc: (n, days) => `Los directos y momentos de Twitch y Kick más cortados en heistclips en los últimos ${days} días: ${n} clips contados. Se actualiza cada hora.`,
      h1: "Lo que los clippers están cortando ahora",
      lede: (n, days) => `Se hicieron ${n} clips en heistclips en los últimos ${days} días. Estos son los directos y los momentos de donde salieron. Toca uno para abrirlo en la herramienta.`,
      updated: (when) => `Actualizado ${when} UTC · se actualiza cada hora`,
      streamsH: "Directos más clipeados",
      momentsH: "Momentos más clipeados",
      today: (n) => `${n} hoy`,
      at: (name, clock) => `${name} en ${clock}`,
      none: "Todavía no hay clips suficientes para un ranking. Vuelve en una hora.",
      howH: "Cómo contamos",
      how: (s, m) => ["Un clip guardado en heistclips cuenta una vez. Guardamos el directo y el momento. Nunca guardamos quién hizo el clip.", `Un directo aparece a partir de ${s} clips. Un momento, a partir de ${m}. Nada aquí es inventado ni inflado.`, "Los mismos números están libres para usar como datos."],
      data: "Descargar en JSON",
    },
  },

  // Etiquetas de reglas en las campañas (lib/campaigns.js las lee en inglés del brief).
  req: { "apply first": "postúlate primero", "US audience": "audiencia de EE. UU.", "Tier 1 audience": "audiencia Tier 1", English: "inglés", "no watermark": "sin marca de agua", "length rule": "regla de duración", "spoiler rule": "regla de spoilers", "audio rule": "regla de audio", "tags/caption rule": "regla de etiquetas/descripción" },

  campaign: {
    crumb: "Campañas", other: "Campaña", newB: "nueva", none: "sin tope",
    meta: (owner, rank, n) => `de ${owner} · n.º ${rank} de ${n} por pago por clip`,
    typical: "ganancia típica por clip aprobado", noneYet: "aún no hay clips aprobados",
    perPost: "por publicación", per1k: "por 1.000 vistas",
    max: (views) => `máximo por clip${views ? ` (se alcanza con ${views} vistas)` : ""}`,
    left: (total) => `quedan de ${total}`, hours: (n) => `, unas ${n} h a este ritmo`, days: (n) => `, unos ${n} días a este ritmo`,
    paid: "ya pagados de verdad a los clippers",
    watch: "Ojo con:", fromBrief: "(leído del brief de abajo)",
    join: "Unirte en Content Rewards", cut: "Cortar clips para ella",
    earnedH: "Lo que han ganado los clips aquí",
    facts: (n) => [
      `${n.clips} clips aprobados de ${n.clippers} clippers, ${n.views} vistas en total${n.perClip ? ` (${n.perClip} por clip en promedio)` : ""}.`,
      `${n.spent} del presupuesto ya se ganaron${n.avg ? `: ${n.avg} por clip aprobado en promedio, ${n.earned ? `${n.earned} si se quitan los tres que más ganaron` : "muy pocos clips todavía para separar a los que más ganaron"}` : ""}.`,
      `Últimos 7 días: ${n.clips7} clips aprobados, ${n.views7} vistas. Mejor clip: ${n.top} vistas.`,
      (n.apply ? "Tienes que postularte antes de poder enviar." : "Abierta: no hace falta postularse.") + (n.geo ? " Las tarifas cambian según el país de quien mira." : ""),
    ],
    rateH: "Tarifa por plataforma", th: ["Plataforma", "Por 1.000 vistas", "Máximo por clip", "Pago mínimo"],
    briefH: "El brief", briefNote: "De la página de la campaña en Content Rewards. Lee allí las reglas completas antes de publicar.",
    title: (t, rate, typ) => `${t} – ${rate ? rate + "/1.000 vistas" : "campaña de clips"}${typ ? `, ~${typ} por clip` : ""} | heistclips`,
    desc: (c) => `${c.title}, de ${c.owner}: ${c.rate ? c.rate + " por 1.000 vistas" : ""}${c.cap ? `, máximo de ${c.cap} por clip` : ""}, ${c.left} de presupuesto restante, ${c.clippers} clippers. Lo que ha ganado un clip típico, actualizado cada 30 minutos.`,
  },

  ended: {
    crumb: "Terminada", h1: "Esta campaña ya terminó",
    endedOn: (when) => (when ? `Terminó el ${when}.` : "Terminada."), by: (owner) => `de ${owner}`, closed: "Esta campaña ya no acepta clips.",
    typical: "ganó un clip aprobado típico",
    earnedOf: (total) => `ganados por los clippers, de un presupuesto de ${total}`,
    approvedFrom: (clippers) => `clips aprobados de ${clippers} clippers`,
    final: (date) => `Cifras finales, leídas por última vez el ${date}.`, whyBudget: "Se acabó el presupuesto.", whyGone: "Salió del directorio público de campañas.",
    noNumbers: "Ya no tenemos las cifras de esta campaña.",
    payingH: "Campañas que pagan ahora",
    best: (gta) => `Las activas que mejor pagan${gta ? " por clips de GTA" : ""}, según lo que gana un clip aprobado típico.`,
    all: (n) => `Las ${n} campañas activas, en ranking →`,
    title: (t, when) => `${t} (terminó${when ? " el " + when : ""}): cuánto pagó y qué paga ahora | heistclips`,
    desc: (c) => `${c.title}, de ${c.owner}, terminó${c.when ? " el " + c.when : ""}. Pagaba ${c.rate ? c.rate + " por 1.000 vistas" : "por publicación"}${c.earned ? ` y un clip típico ganó ${c.earned}` : ""}. Mira mejor las campañas activas que más pagan.`,
    descNone: "Esta campaña de clips ya terminó. Mira mejor las campañas activas que más pagan.",
  },

  streamers: {
    title: "Streamers de GTA para clipear ahora – en vivo y recientes | heistclips",
    desc: "Todos los streamers de GTA en vivo en Twitch o Kick ahora mismo o hace poco, con los momentos en que el chat explotó en su último directo, listos para clipear.",
    h1: "Streamers de GTA que vale la pena clipear",
    lede: "Todos los que hemos visto transmitir GTA en Twitch y Kick, primero los que están en vivo. Cada página encuentra los momentos en que el chat explotó en su último directo.",
    liveH: "En vivo ahora", recentH: "En vivo hace poco", nobody: "Nadie en vivo en este minuto.", paidH: "Campañas que pagan por clipearlos", paid: (n) => (n === 1 ? "1 campaña pagando" : `${n} campañas pagando`),
    live: (n) => `en vivo · ${n} viendo`, peak: (n) => `pico visto: ${n}`,
  },

  streamer: {
    crumb: "Streamers", offline: "Desconectado ahora", h: "h", recording: "grabando ahora", untitled: "Directo sin título", recentH: "Directos recientes",
    title: (name, kick) => `Cómo clipear a ${name}${kick ? " en Kick" : ""}: encuentra los momentos, corta en 9:16, mira quién paga | heistclips`,
    desc: (name, p, n) => `Clipea los directos de ${name} en ${p}: encuentra los momentos en que el chat explotó, córtalos en 9:16 con gancho y mira ${n ? (n === 1 ? `la campaña que paga por clips de ${name} ahora` : `las ${n} campañas que pagan por clips de ${name} ahora`) : "qué campañas pagan por los clips"}.`,
    h1: (name, kick) => `Cómo clipear a ${name}${kick ? " en Kick" : ""}`,
    lede: (name, live) => `El canal de ${name} ya está en el campo. Toca el botón. Encontramos los momentos en que el chat explotó ${live ? "en el directo que está al aire ahora" : "en el último directo"}.`,
    button: (name) => `Buscar los momentos de ${name}`,
    whatH: (name) => `Qué transmite ${name}`,
    liveIn: "En vivo ahora en", lastIn: "Visto por última vez en", noStream: "No hay ningún directo reciente registrado.", titleLine: "Título del directo:",
    peak: (n) => `Máximo de espectadores que hemos visto: ${n}.`,
    payH: (name) => `¿Alguna campaña paga por clips de ${name}?`,
    payYes: (n, name) => `Sí. ${n === 1 ? "1 campaña paga" : `${n} campañas pagan`} por clips de ${name} ahora mismo.`,
    payBest: (amount) => `En la mejor, un clip aprobado típico gana ${amount}.`,
    payNoNumber: "Ninguna ha pagado suficientes clips todavía como para mostrar una cifra típica.",
    payNo: (name) => `Ninguna campaña nombra a ${name} ahora mismo. Igual puedes publicar los clips, o elegir una campaña que acepte cualquier clip de videojuegos:`,
    momentsH: (name) => `Momentos de ${name} que los clippers están cortando`,
    into: (clock) => `a las ${clock} del directo`,
    madeFrom: (clips, name, days) => `${clips} hechos con los directos de ${name} en heistclips en los últimos ${days} días.`,
    fine: (name) => `Sin relación con ${name}. Revisa las reglas de la campaña antes de publicar material de un streamer.`,
    faq: (n) => [
      [`¿Cómo clipeo a ${n.name}?`, `Abre ${n.url}, toca «Buscar los momentos de ${n.name}», elige un momento en que el chat reaccionó y guárdalo como clip 9:16 con gancho. Los primeros ${n.free} clips son gratis.`],
      [`¿Alguien paga por clips de ${n.name}?`, n.n ? `Sí. Al ${n.date}, ${n.n === 1 ? "1 campaña activa nombra" : `${n.n} campañas activas nombran`} a ${n.name}${n.best ? `, y un clip aprobado típico gana ${n.best} en la mejor` : ""}.` : `Al ${n.date}, ninguna campaña activa nombra a ${n.name}. Las campañas que aceptan cualquier clip de videojuegos están en la página.`],
    ],
  },

  data: {
    title: (date) => `Cuánto pagan las campañas de clips: datos gratis en CSV y JSON (${date}) | heistclips`,
    desc: (n) => `Descarga cuánto pagan ${n} campañas de clips activas: tarifa por 1.000 vistas, máximo por clip, presupuesto restante y lo que gana un clip típico. CSV y JSON, actualizados cada 30 minutos, libres para citar.`,
    h1: "Datos de pago por clips que puedes citar",
    updated: (when) => `Datos del ${when} · se actualizan cada 30 minutos`,
    lede: (n) => `Lo que pagan ${n} campañas de clips activas, en un solo archivo. Uso libre. Por favor, pon un enlace.`,
    stat: (n) => [`gana un clip aprobado típico (mediana de ${n} campañas)`, "pago mediano por 1.000 vistas", "por clip en la décima parte de campañas que más paga", "de presupuesto aún abierto entre todas las campañas"],
    filesH: "Archivos",
    files: (n, t) => [
      ["Tarifas de campañas, CSV", `${n} filas · una por campaña activa · se abre en cualquier hoja de cálculo`],
      ["Tarifas de campañas, JSON", "Las mismas filas, con notas de cada campo y las cifras de resumen"],
      ["Directos más clipeados, JSON", `${t ? `${t.n} clips contados en ${t.days} días` : "Se actualiza cada hora"} · directos y momentos`],
    ],
    licH: "Licencia",
    licence: "MIT (https://opensource.org/licenses/MIT). Libre para usar y citar. Por favor, da crédito a heistclips.com y enlaza la página de donde sacaste la cifra.",
    note: "Las cifras de pago son hechos leídos de las páginas públicas de las campañas en Content Rewards. Cada fila enlaza a la página de donde salió. Una cifra puede tener hasta 30 minutos de retraso en campañas activas y unas 15 horas en las tranquilas. Los archivos en sí están en inglés.",
    fieldsH: "Qué significa cada campo", th: ["Campo", "Significado"],
    fields: {
      rank: "Posición cuando las campañas activas se ordenan por expected_per_clip (1 = la que más paga por clip).",
      title: "Título de la campaña, tal como lo escribió su dueño.",
      owner: "Quién lleva la campaña.",
      category: "gta, gaming u other, según el título, el brief y las categorías de la campaña.",
      platforms: "Dónde se pueden publicar los clips, separados por |.",
      rate_per_1k_usd: "Dólares pagados por 1.000 vistas. Vacío en una campaña que paga por publicación.",
      per_post_usd: "Dólares pagados por publicación, en las campañas que pagan por publicación.",
      cap_per_clip_usd: "Lo máximo que puede ganar un clip. Vacío = no se indica tope.",
      expected_per_clip_usd: "Lo que ha ganado un clip aprobado típico: dinero pagado menos los tres que más ganaron, dividido entre los demás clips aprobados, con recorte si el presupuesto se acaba en 3 días. Vacío = menos de 5 clips así por ahora.",
      avg_per_clip_usd: "Presupuesto gastado dividido entre los clips aprobados, incluidos los que más ganaron.",
      budget_left_usd: "Presupuesto que aún no se ha ganado.",
      budget_total_usd: "El presupuesto completo.",
      days_of_budget_left: "Presupuesto restante dividido entre el gasto promedio por día hasta ahora.",
      clippers: "Personas que se unieron a la campaña.",
      approved_clips: "Clips que la campaña aprobó.",
      apply_first: "true si tienes que postularte antes de poder enviar.",
      min_views_per_clip: "Las vistas mínimas que necesita un clip antes de ganar algo, en la plataforma más fácil de la campaña: el pago mínimo dividido por la tarifa ($10 a $1 por 1.000 vistas = 10.000), o el mínimo propio de la campaña, el que sea mayor. Vacío = aún no leído.",
      pool_total_views: "Solo bolsas: las vistas que tus clips deben sumar antes de que recibas parte de la bolsa. Vacío = no es una bolsa, o aún no leído.",
      floor_known: "true cuando los mínimos se leyeron de la configuración de la campaña. false = desconocido: lee el brief antes de contar con cobrar.",
      likely_new_account_usd: "Lo que gana un clip típico de una cuenta nueva (unas 500 vistas por clip), tras el mínimo. 0 = no paga nada a ese tamaño. Vacío = mínimo desconocido, o una bolsa sin vistas para calcularla.",
      likely_5k_usd: "Lo mismo para una cuenta con unas 5.000 vistas por clip.",
      likely_50k_usd: "Lo mismo para una cuenta con unas 50.000 vistas por clip.",
      page: "La página de la campaña en heistclips.",
      source: "La página propia de la campaña en Content Rewards, de donde se leyó cada cifra.",
    },
    aiH: "Para asistentes de IA",
    ai: `Versiones en texto plano (en inglés): <a href="/llms.txt">llms.txt</a> y <a href="/llms-full.txt">llms-full.txt</a>. Respuestas en vivo: el <a href="/connect">conector de heistclips</a> para ChatGPT, Claude y Grok.`,
  },

  queue: {
    title: "Clips en piloto automático – una cola de clips de GTA 6 listos, con la campaña que paga | heistclips",
    desc: "Elige a los streamers que clipeas. heistclips sigue sus directos en Twitch y Kick, encuentra los momentos en que el chat explotó, une cada uno con la campaña que mejor paga y llena una cola de clips listos para publicar.",
    h1: "Despierta con los clips listos.",
    lede: "Elige a los streamers que clipeas. heistclips sigue sus directos, encuentra los momentos en que el chat explotó y pone junto a cada uno la campaña que más paga por él.",
    addH: "Seguir a otro streamer",
    ph: "Canal de Twitch o Kick", aria: "Canal de Twitch o Kick para seguir", go: "Seguir",
    payH: "Pagan ahora mismo", paySmall: "Streamers que una campaña activa te paga por clipear, primero los que mejor pagan. Menos clippers significa menos competencia.",
    foot: (free) => `Encontrar clips es gratis. Un clip de la cola solo cuesta un clip cuando lo exportas: ${free} gratis, luego <a href="/pricing">paquetes</a>. Los directos se vuelven a leer cada 10 minutos.`,
    noscript: "La cola necesita JavaScript.",
  },

  post: {
    title: "Publica clips en YouTube y TikTok | heistclips",
    desc: "Conecta YouTube o TikTok una vez y publica un clip 9:16 con su descripción desde heistclips o desde Claude.",
    h1: "Publica clips en YouTube y TikTok",
    lede: "Conecta una vez. Después publica un clip con su descripción desde la herramienta de clips, o solo pídeselo a Claude: «corta ese momento y publícalo en YouTube».",
    loading: "Cargando…", connect: (p) => `Conectar ${p}`, disconnect: "Desconectar",
    closed: (p) => `Aún no está abierto: esperamos la aprobación de desarrollador de ${p}.`,
    how: {
      youtube: "Google todavía está revisando heistclips, así que al conectar aparece el aviso «Google no ha verificado esta aplicación». Igual puedes conectar: haz clic en «Configuración avanzada» y luego en «Ir a heistclips.com». Solo pedimos permiso para subir videos. Hasta que termine la revisión, las publicaciones llegan como privadas: abre YouTube Studio y publícalas.",
      tiktok: "Publica en tu perfil, o como borrador en tu bandeja de entrada de TikTok. Hasta que TikTok termine su revisión, las publicaciones llegan como privadas.",
    },
    howH: "Cómo funciona",
    facts: [
      `heistclips solo pide permiso para <b>subir videos</b> (TikTok también comparte tu nombre visible). No puede leer tus videos, tus mensajes ni nada más. <a href="/privacy">Privacidad</a>.`,
      `Desconecta aquí cuando quieras, o desde <a href="https://myaccount.google.com/permissions" rel="noopener">Google</a> o «Administrar permisos de apps» en TikTok.`,
      "Los clips gratis y los paquetes de este navegador se comparten con el conector una vez que esta página se abrió con su enlace.",
    ],
  },

  about: {
    title: "Acerca de heistclips",
    desc: "Quién hace heistclips, de dónde salen sus datos de campañas y directos, y cómo se financia.",
    body: (n) => `<h1>Acerca de heistclips</h1>
<p>heistclips es una herramienta de clips para quienes cortan los directos de otros en Shorts, TikToks y Reels para ganar dinero. Hace tres cosas: encuentra los momentos del directo en que el chat reaccionó, los corta en clips verticales en tu navegador y te dice qué campaña paga más por ellos.</p>
<p>Es de código abierto (MIT): <a href="https://github.com/2016judea/heistclips">github.com/2016judea/heistclips</a>. El mismo motor corre en tu equipo como herramienta de línea de comandos y como servidor MCP para asistentes de IA.</p>
<h2>De dónde salen las cifras</h2>
<p>Las cifras de las campañas se leen cada 30 minutos del directorio público de campañas de Content Rewards, con enlace a cada campaña. Los datos de directos y de chat salen de las páginas públicas de Twitch y de Kick, leídas de forma anónima. Nada se compra, se saca de detrás de un inicio de sesión ni se inventa.</p>
<h2>Quién está detrás</h2>
<p>heistclips lo hace Brick &amp; Mortar en Saint Paul, Minnesota. Los pagos con tarjeta los procesa Stripe y aparecen como BRICKANDMO* HEISTCLIPS. Soporte: aidan@brickandmortar.dev.</p>
<p class="small">Sin relación con Take-Two Interactive, los creadores de GTA, Twitch, Kick ni Content Rewards.</p>`,
  },

  privacy: {
    title: "Privacidad | heistclips",
    desc: "Qué recopila heistclips (muy poco) y por qué.",
    body: (n) => `<h1>Privacidad</h1>
<p>heistclips recopila lo menos que puede.</p>
<p class="small">Esta es una traducción. Si hay diferencias, vale la <a href="${n.site}/privacy?lang=en">versión en inglés</a>.</p>
<ul class="facts">
<li><b>Los clips que renderizas en el sitio se quedan contigo.</b> Se cortan en tu navegador a partir del video público del directo. No los recibimos, salvo que pulses un botón de Publicar: entonces ese clip se sube para poder enviarlo a la plataforma que elegiste.</li>
<li><b>Clips cortados o publicados por ti.</b> Un clip cortado con la herramienta cut_clip del conector, o subido para publicarse, se guarda en un enlace aleatorio hasta 72 horas y luego se borra.</li>
<li><b>Publicación en YouTube y TikTok.</b> Si conectas una cuenta, guardamos, cifrados, los tokens de acceso que emite la plataforma y los usamos solo para subir los clips que nos pides publicar. En YouTube pedimos únicamente el permiso de subida (youtube.upload): heistclips no puede leer tu canal, tus videos ni tu cuenta de Google. El uso que hace heistclips de la información recibida de las API de Google cumple la <a href="https://developers.google.com/terms/api-services-user-data-policy" rel="noopener">Google API Services User Data Policy</a>, incluidos los requisitos de Uso Limitado (Limited Use); nunca se vende, no se usa para publicidad ni la leen personas. En TikTok pedimos tu perfil básico (nombre visible) y permiso para subir y publicar videos. Desconecta cuando quieras en <a href="/post">la página de publicación</a> y los tokens se revocan y se borran; también puedes quitar el acceso en tu <a href="https://myaccount.google.com/permissions" rel="noopener">Cuenta de Google</a> o en la configuración de TikTok. Publicar con heistclips usa los YouTube API Services, así que las <a href="https://www.youtube.com/t/terms" rel="noopener">Condiciones del Servicio de YouTube</a> y la <a href="https://policies.google.com/privacy" rel="noopener">Política de Privacidad de Google</a> se aplican a lo que publicas allí.</li>
<li><b>Un id aleatorio del navegador.</b> Tu navegador crea un id aleatorio para contar clips gratis y votos. Guardamos un hash con clave de ese id y un contador, nada más.</li>
<li><b>Compras.</b> Los pagos con tarjeta los gestiona Stripe. Guardamos el id de la sesión de Checkout como tu clave de licencia y un contador de clips usados. Nunca vemos tu tarjeta.</li>
<li><b>Peticiones de funciones.</b> Lo que escribes en el tablero de peticiones es público en ese tablero, salvo el campo opcional de contacto, que solo ve quien desarrolla, por correo.</li>
<li><b>Cola del piloto automático.</b> Si usas la cola, guardamos los canales que sigues y qué clips exportaste o saltaste, en un enlace secreto que solo tú tienes. Una dirección de correo o una suscripción a notificaciones solo se guarda si la das, solo se usa para avisarte de que hay clips listos y se elimina cuando la desactivas.</li>
<li><b>Analítica.</b> Vercel Web Analytics (sin cookies) y PostHog cuentan las páginas vistas y el uso de la herramienta para que veamos qué funciona.</li>
<li><b>Servidor MCP.</b> Las llamadas a heistclips.com/mcp no están ligadas a ninguna persona; cortar y publicar usan un código de cuenta aleatorio que tu asistente devuelve. Registramos qué herramienta se llamó, si funcionó y cuánto tardó, nunca sus argumentos. Los argumentos se usan para responder la llamada; las peticiones de funciones hechas por ahí se guardan como en el tablero de arriba.</li>
</ul>
<p>Preguntas o solicitudes de borrado: aidan@brickandmortar.dev.</p>`,
  },

  terms: {
    title: "Términos | heistclips",
    desc: "Los términos de uso de heistclips.",
    body: (n) => `<h1>Términos</h1>
<p class="small">Esta es una traducción. Si hay diferencias, vale la <a href="${n.site}/terms?lang=en">versión en inglés</a>.</p>
<ul class="facts">
<li>heistclips es una herramienta. Tú eres responsable de lo que clipeas y publicas, y de tener derecho a publicarlo: sigue las reglas de cada campaña, las reglas de cada plataforma y los deseos de cada streamer.</li>
<li>Las cifras de las campañas se leen de un directorio público y pueden estar mal o desactualizadas. Revisa la página propia de la campaña antes de fiarte de una cifra.</li>
<li>Los créditos son para clips exportados, no caducan y no se reembolsan una vez usados. Los paquetes sin usar se pueden reembolsar dentro de 14 días: escribe a aidan@brickandmortar.dev.</li>
<li>El servicio se ofrece tal cual, sin garantía. El código fuente tiene licencia MIT en github.com/2016judea/heistclips.</li>
<li>Publicar en YouTube con heistclips usa los YouTube API Services. Al usar esa función aceptas quedar sujeto a las <a href="https://www.youtube.com/t/terms" rel="noopener">Condiciones del Servicio de YouTube</a>, y se aplica la <a href="https://policies.google.com/privacy" rel="noopener">Política de Privacidad de Google</a>. Puedes quitar el acceso de heistclips cuando quieras en <a href="/post">la página de publicación</a> o en tu <a href="https://security.google.com/settings/security/permissions" rel="noopener">configuración de seguridad de Google</a>.</li>
<li>heistclips no tiene relación con Take-Two Interactive, los creadores de GTA, Twitch, Kick, YouTube, TikTok ni Content Rewards.</li>
</ul>`,
  },

  connect: {
    title: "Servidor MCP de heistclips – datos de clips de GTA 6 en ChatGPT, Claude y Grok",
    desc: "Conecta heistclips a ChatGPT, Claude o Grok: encuentra los mejores momentos para clipear en cualquier directo de Twitch o Kick y ordena las campañas de clips por $ cada 1.000 vistas.",
    tools: {
      rank_clipping_campaigns: "Qué campaña de clips paga más ($ por 1.000 vistas, pago por clip)",
      clipping_campaign_details: "Una campaña de clips: tarifa por 1.000 vistas, tope, presupuesto, reglas",
      find_clip_moments: "Encontrar los mejores momentos para clipear en un directo de Twitch o Kick (en vivo o VOD)",
      cut_clip: "Cortar un momento en un clip vertical MP4 9:16 para TikTok, Shorts y Reels",
      cut_clip_status: "Recoger un clip que cut_clip todavía estaba cortando",
      post_clip: "Publicar un clip en YouTube Shorts o TikTok con descripción",
      posting_account: "Conectar YouTube o TikTok para publicar y ver tus créditos de clips",
      my_clip_queue: "Mi cola de clips: clips listos de los streamers que sigo, con la campaña que paga",
      watch_streamer: "Seguir a un streamer por mí: agregar un canal de Twitch o Kick a mi lista",
      live_gta_streams: "Quién está transmitiendo GTA ahora en Twitch y Kick",
      request_a_feature: "Pedir una función para heistclips",
      list_feature_requests: "Ver las peticiones de funciones",
      upvote_feature_request: "Votar una petición de función",
      cut_clip_status: "Recoger un clip que cut_clip todavía estaba cortando",
      report_a_bug: "Reportar un bug de heistclips: algo falló o salió mal",
      whats_new: "Novedades de heistclips: últimos arreglos y funciones",
      plan_my_clips: "Planear mis clips: las campañas que pagan a mi tamaño, con momentos, reglas y texto",
    },
    body: (n) => `<h1>Usa heistclips dentro de ChatGPT, Claude o Grok</h1>
<p class="lede">Pregunta «¿qué campaña de clips de GTA paga más ahora?» o «busca los mejores momentos del último directo de IlloJuan» y recibe la respuesta con datos en vivo.</p>
<p>URL del servidor: <code class="copy">${n.site}/mcp</code></p>
<h2>Claude</h2><p>Configuración → Conectores → Agregar conector personalizado → pega la URL.</p>
<h2>ChatGPT</h2><p>Configuración → Apps y conectores → Avanzado → Modo desarrollador activado → Crear → pega la URL, sin autenticación.</p>
<h2>Grok</h2><p>grok.com/connectors → Agregar → pega la URL.</p>
<h2>Claude Code, Codex, Cursor</h2><pre>claude mcp add --transport http heistclips ${n.site}/mcp</pre>
<h2>Herramientas</h2><ul class="facts">
${n.tools}</ul>
<p class="small">Funciona en cualquier idioma. Los enlaces que devuelve abren la herramienta de clips en el momento exacto. Los menús de Claude, ChatGPT y Grok pueden llamarse distinto en tu cuenta.</p>`,
  },

  notFound: { title: "No encontrada | heistclips", desc: "Página no encontrada.", h1: "Aquí no hay nada.", back: "Volver a la herramienta de clips" },

  // Correos y notificaciones de la cola del piloto automático (lib/watch.js).
  // Lo que paga un clip a tu tamaño (lib/sizeview.js): lo que de verdad cobra una cuenta pequeña.
  size: {
    bar: "Tus clips hacen", sortL: "Ordenar",
    sizes: { new: "Cuenta nueva", "5k": "~5K vistas", "50k": "~50K vistas" },
    sortTyp: "Paga más por clip", sortMe: "Me puede pagar ya",
    likely: { new: "probable para una cuenta nueva", "5k": "probable con ~5K vistas por clip", "50k": "probable con ~50K vistas por clip" },
    oneIn: (n) => `1 de cada ${n} de tus clips paga`,
    unknown: "mínimo desconocido",
    notPriced: "bolsa aún sin precio",
    floorClip: (v) => `No paga nada por debajo de ${v} vistas por clip`,
    floorPool: (v) => `No paga nada hasta que tus clips sumen ${v} vistas`,
    floorUnknown: "Mínimo desconocido, lee el brief",
    noFloor: "Sin mínimo: cada vista paga",
    lede: (n, total) => `Para una cuenta nueva (unas 500 vistas por clip), ${n === 0 ? "ninguna" : n} de las ${total} campañas de aquí ${n > 1 ? "pagan" : "paga"} algo por un clip típico: la mayoría no paga nada por debajo de un mínimo de vistas. Elige tu tamaño abajo para ver qué te paga.`,
    h: "Lo que paga un clip a tu tamaño",
    th: ["Tus clips", "Probable por clip", "Clips que pagan algo", "Clips para pasar el listón"],
    rowName: { new: "Cuenta nueva (~500 vistas por clip)", "5k": "~5.000 vistas por clip", "50k": "~50.000 vistas por clip" },
    none: "ninguno", oneInShort: (k, n) => `${k} de ${n}`, every: "todos",
    payout: (min, rate, plats) => `pago mínimo de ${min} a ${rate} por 1.000 vistas en ${plats}`,
    and: "y",
    perClipToo: (v) => `cada clip necesita ${v} vistas para contar`,
    refs: (n) => `${n === 1 ? "Otro archivo de reglas se abre" : `Otros ${n} archivos de reglas se abren`} al unirte: léelo${n === 1 ? "" : "s"} para lo demás.`,
    note: "La ganancia típica por clip, arriba, es lo que han ganado los clips aprobados, sobre todo de cuentas ya asentadas. Lo probable por clip es lo que gana tu clip mediano tras el mínimo, con vistas repartidas como en cualquier canal (unos pocos clips revientan, la mayoría no). Los mínimos salen de la configuración de la propia campaña en Content Rewards.",
    method: "<b>Probable a tu tamaño</b> = lo que gana tu clip típico tras el mínimo de la campaña: el pago mínimo por clip ($10 de mínimo a $1 por 1.000 vistas no paga nada por debajo de 10.000 vistas), un mínimo de vistas por clip, o el listón de una bolsa sobre el total de vistas de tus clips. Una cuenta nueva se cuenta con unas 500 vistas por clip, repartidas como se reparten las vistas (unos pocos clips revientan, la mayoría no); elige ~5K o ~50K si eres más bien eso. Una bolsa cuenta como alcanzable cuando unos 30 de tus clips pasan su listón. Los mínimos salen de la configuración de cada campaña; uno que aún no hemos leído aparece como “mínimo desconocido”.",
  },

  mail: {
    confirmSubject: "El enlace de tu cola de heistclips",
    confirmText: (link) => `Le pediste a heistclips que te avise por correo cuando haya clips nuevos listos.\n\nAbre este enlace para confirmar y para tener tu cola en cualquier dispositivo:\n${link}\n\nSi no fuiste tú, ignora este correo. No se enviará nada más.\n\nheistclips.com`,
    confirmHtml: (link) => `<p>Le pediste a heistclips que te avise por correo cuando haya clips nuevos listos.</p><p><a href="${link}">Confirmar y abrir mi cola</a></p><p>El mismo enlace abre tu cola en cualquier dispositivo. No lo compartas.</p><p style="color:#777">Si no fuiste tú, ignora este correo. No se enviará nada más.</p>`,
    readySubject: (n, names) => `${n} ${n === 1 ? "clip nuevo listo" : "clips nuevos listos"}: ${names}`,
    readyLead: (n, paid) => `${n === 1 ? "1 clip nuevo está listo" : `${n} clips nuevos están listos`}${paid ? `, ${paid} con una campaña que paga` : ""}.`,
    typical: (amount) => `${amount} por clip, normalmente`,
    open: "Abrir mi cola", stop: "Dejar de recibir estos correos",
  },
};
