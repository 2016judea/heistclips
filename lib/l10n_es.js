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
    three: [
      ["El chat encuentra el momento", "Los momentos de un juego son visuales: una transcripción no los ve. El chat sí. Cada pico es una marca de tiempo, con las líneas que escribió el chat, para que veas por qué se eligió. Funciona con directos que siguen en vivo."],
      ["Tu navegador hace el corte", "Facecam sobre el gameplay, fondo desenfocado o recorte centrado; de 3 a 5 ganchos para que cada publicación sea distinta; chat superpuesto. Renderizado en tu equipo, sin marca de agua, descargado al momento."],
      ["La música queda marcada", "La radio del juego es música con licencia. Si Twitch silenció ese tramo, te lo decimos antes de que publiques y pierdas el pago por un reclamo."],
    ],
  },

  clip: {
    title: "Creador de clips de GTA 6 – momentos del chat de Twitch, corte 9:16 en tu navegador | heistclips",
    desc: "Pega un canal o VOD de Twitch. heistclips encuentra los momentos en que el chat explotó, marca la música con licencia y corta clips 9:16 con gancho directamente en tu navegador.",
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
      ["¿Dónde se hace el video?", "En tu navegador, en tu equipo. No se nos sube nada."],
      ["¿Qué aparece en mi estado de cuenta?", "BRICKANDMORTAR.DEV, la empresa detrás de heistclips."],
    ],
  },

  requests: {
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
};
