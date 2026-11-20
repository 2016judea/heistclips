// Português (Brasil). Escrito do jeito que quem faz cortes fala (você, clipe, corte, gancho, o chat
// explode), não traduzido palavra por palavra do inglês. Os números vêm sempre do snapshot ao
// vivo, nunca deste texto.
const B = (s) => `<b>${s}</b>`;

export default {
  locale: "pt-BR",
  updated: (when, min) => `Atualizado em ${when} · ${min < 2 ? "agora mesmo" : min < 90 ? `há ${min} min` : `há ${Math.round(min / 60)} h`} · atualiza a cada 30 minutos`,
  watching: (n) => `${n} assistindo`,
  form: { ph: "Canal da Twitch ou Kick, ou link de VOD", go: "Achar momentos" },
  // Rótulos fixos das linhas de campanha (as linhas em si são montadas em inglês por render.js).
  rows: [
    [/>(<span class="pulse"><\/span>|▶ )Clip (.+?)’s stream now<\/a>/g, ">$1Clipar a live de $2 agora</a>"],
    [/<span>typical per clip<\/span>/g, "<span>por clipe, em média</span>"],
    [/<b class="big new">new<\/b><span>up to ([^<]+) a clip<\/span>/g, '<b class="big new">nova</b><span>até $1 por clipe</span>'],
    [/ \/ 1k views/g, " / 1 mil views"], [/ per post/g, " por post"], [/ · cap /g, " · teto "], [/ left( \(| <b| ·)/g, " restantes$1"],
    [/\(~(\d+) days\)/g, "(~$1 dias)"], [/\(~(\d+) h of budget at this pace\)/g, "(~$1 h de verba nesse ritmo)"],
    [/ (\d[\d,.k]*) clippers/g, " $1 clipadores"], [/paid out /g, "já pagou "], [/<em>apply first<\/em>/g, "<em>precisa se inscrever</em>"], [/class="tag g">gaming</g, 'class="tag g">games<'],
  ],

  home: {
    title: "Ferramenta de cortes de GTA 6 – ache o momento, corte o clipe, receba | heistclips",
    desc: "Ache os momentos em que o chat explode nas lives de GTA 6, corte em 9:16 com gancho no seu navegador e veja qual campanha de clipes paga mais por clipe agora.",
    h1: "Faça cortes das lives de GTA VI enquanto elas estão no ar.",
    lede: "Feito para gameplay, não para podcast. Cole um canal da Twitch ou da Kick: o heistclips acompanha o chat, marca o segundo em que ele explode e corta em 9:16 (facecam em cima do gameplay), com gancho, no seu navegador.",
    small: (n, each) => `<b>${n} clipes grátis.</b> Depois, ${each} por clipe. Sem cobrança por minuto. Sem marca d’água. Sem tag de IA no arquivo.`,
    liveH: "Ao vivo em GTA agora",
    payH: "O que mais paga por clipe agora",
    paySmall: (gta) => `Campanhas de games e de streamers, ordenadas pelo que um clipe aprovado típico realmente rendeu. ${gta === 1 ? "1 campanha de GTA no ar hoje" : `${gta} campanhas de GTA no ar hoje`}.`,
    all: (n) => `Todas as ${n} campanhas, em ranking →`,
    askH: "Faltou alguma coisa?",
    askP: "Peça uma função. A gente constrói o que quem faz cortes pede.",
    askLink: "Veja o que foi pedido, o que está em obras e o que já saiu →",
    trend: "O que os clipadores estão cortando agora →",
    post: { h: "Poste direto no YouTube", p: `Conecte seu canal do YouTube uma vez. Depois é só postar o clipe como Short com a sua legenda, pela ferramenta de clipes ou pelo Claude. <a href="/post">Conectar o YouTube →</a> A postagem usa os YouTube API Services; veja nossa página de <a href="/privacy">Privacidade</a>.` },
    three: [
      ["O chat acha o momento", "Momento de jogo é visual: transcrição não pega. O chat pega. Cada pico é um horário, mostrado com as frases que o chat digitou, para você ver por que ele foi escolhido. Funciona em live que ainda está no ar."],
      ["Seu navegador faz o corte", "Facecam em cima do gameplay, fundo desfocado ou recorte central; 3 a 5 ganchos para cada post sair diferente; chat por cima do vídeo. Renderizado na sua máquina, sem marca d’água, baixado na hora."],
      ["Música fica marcada", "A rádio do jogo é música licenciada. Se a Twitch silenciou aquele trecho, a gente avisa antes de você postar e perder o pagamento por causa de uma reivindicação."],
    ],
  },

  clip: {
    title: "Criador de clipes de GTA 6 – momentos pelo chat da Twitch ou da Kick, corte 9:16 no navegador | heistclips",
    desc: "Cole um canal ou VOD da Twitch ou da Kick. O heistclips acha os momentos em que o chat explodiu, marca música licenciada e corta clipes 9:16 com gancho direto no seu navegador.",
    h1: "Ache os momentos. Corte o clipe.",
    hint: "Cole um canal da Twitch ou da Kick (ao vivo ou não) ou um link de VOD. A gente lê o chat, não o vídeo: uma live de 7 horas leva uns 20 segundos.",
  },

  pricing: {
    title: "Preços – você paga por clipe, nunca por minuto de live | heistclips",
    desc: (n, packs) => `${n} clipes de GTA 6 grátis, depois ${packs.map((p) => `${p.clips} por US$ ${p.price}`).join(" ou ")}. Achar momentos é sempre grátis.`,
    h1: "Pague por clipe. Nunca por minuto.",
    lede: (n) => `${n} clipes grátis. Depois, você compra um pacote. Achar momentos é sempre grátis.`,
    free: "Grátis", clips: (n) => `${n} clipes`, start: "Começar a clipar", each: (c) => `${c} por clipe`, buy: (n) => `Comprar ${n} clipes`,
    pay: "O pagamento é pela Stripe: cartão, Apple Pay, Google Pay ou Link. Os preços aqui estão em dólar; a Stripe mostra o valor na sua moeda antes de você pagar.",
    faqH: "Perguntas",
    faq: [
      ["Por que por clipe e não por minuto?", "Quem faz cortes recebe por clipe que rende. Ferramenta que cobra por minuto de vídeo faz você pagar pelas sete horas de live que nunca vai postar. Aqui a live é lida de graça; você só paga pelos clipes que exporta."],
      ["O que conta como um clipe?", "Um vídeo 9:16 exportado. Prévia, busca de momentos e reler uma live são grátis. Renderizar o mesmo momento de novo com outro gancho conta como um clipe novo."],
      ["Os créditos expiram?", "Não."],
      ["Onde o vídeo é feito?", "No computador, no seu próprio navegador. No celular, no Safari ou quando o Claude ou o ChatGPT corta, nosso servidor corta direto da live. Um arquivo de vídeo seu, como uma cópia do YouTube, nunca sai do seu aparelho."],
      ["O que aparece na minha fatura?", "BRICKANDMO* HEISTCLIPS. A Brick & Mortar é a empresa por trás do heistclips; a página de pagamento mostra heistclips."],
    ],
  },

  requests: {
    kindFeature: "Pedir uma função", kindBug: "Reportar um bug", bugPh: "O que deu errado? ex.: “O MP4 saiu sem som”", bugAria: "O que deu errado", bugStreamPh: "Link da live ou nome do streamer (opcional)", bugWhatPh: "O que aconteceu? No que você clicou, e o que o heistclips fez?", bugExpectPh: "O que você esperava no lugar? (opcional)", bugBtn: "Reportar", bugOk: "Reportado. Está no mural, e quem desenvolve já recebeu.", bugTag: "Bug", filterAll: "Tudo", filterFeatures: "Funções", filterBugs: "Bugs", moreBug: "Adicionar um contato (opcional)",
    title: "Pedidos de funções – o que quem faz cortes quer em seguida | heistclips",
    desc: "Vote em funções ou peça novas para o heistclips, a ferramenta de cortes de GTA 6. Pedido, em obras e entregue, tudo público.",
    h1: "O que os clipadores pediram",
    lede: "Vote no que você quer em seguida ou peça outra coisa. Sem conta, em qualquer idioma. A gente constrói o que recebe voto, e os pedidos entregues ficam aqui como prova.",
    counts: (r, b, s) => `${r} pedidos · ${b} em obras · ${s} entregues`,
    ph: "O que o heistclips deveria fazer? ex.: “Detectar a facecam sozinho”", aria: "Seu pedido",
    more: "Adicionar detalhes ou um contato (opcional)", detailPh: "O que você estava tentando fazer?", contactPh: "E-mail ou @usuário, só se quiser resposta",
    btn: "Pedir", upvote: "Votar",
    note: "Os itens marcados “Sugerido pelo heistclips” foram colocados por nós no lançamento, a partir do que o pessoal dos cortes fala no Reddit. Todo contador começou em 0; só voto de verdade mexe nele, um por navegador.",
    status: { requested: "pedido", building: "em obras", shipped: "entregue" },
    lead: { shipped: "Entregue", building: "Em obras", update: "Atualização" },
    byUs: "Sugerido pelo heistclips", byClipper: "Pedido por um clipador",
    seeds: {
      "Clip streams while they're live": ["Clipar lives enquanto estão no ar", "Achar e cortar momentos de uma live que ainda está rolando, não só depois que o VOD fica pronto."],
      "Facecam-over-gameplay vertical layout": ["Layout vertical com facecam em cima do gameplay", "O layout empilhado que os clipes de jogo usam de verdade, como padrão no lugar do recorte central."],
      "No watermark, no per-minute billing": ["Sem marca d’água, sem cobrança por minuto", "Paga-se por clipe exportado; nunca uma marca d’água no arquivo."],
      "Warn me before a campaign's budget runs out": ["Me avise antes de a verba de uma campanha acabar", "Um alerta quando uma campanha para a qual eu faço cortes tiver horas, e não dias, de verba."],
      "Mute or swap licensed in-game radio": ["Silenciar ou trocar a rádio licenciada do jogo", "Para os clipes não levarem reivindicação de Content ID nem serem silenciados no TikTok."],
      "Kick support": ["Suporte à Kick", "Achar e cortar momentos de lives da Kick, ao vivo ou salvas."],
      "Spoiler filter": ["Filtro de spoiler", "Pular momentos que mostram spoiler da história, para campanhas que proíbem."],
      "Strip \"AI-generated\" metadata on export": ["Tirar o metadado “gerado por IA” na exportação", "O arquivo exportado nunca deve ser marcado como feito por IA quando as imagens não são."],
      "Track which hook variant won": ["Mostrar qual gancho ganhou", "Me diga qual gancho do primeiro segundo trouxe mais views em todos os meus posts."],
      "Earnings tracker across campaigns": ["Controle de ganhos em todas as campanhas", "Meus US$ por hora em cada campanha para a qual eu faço cortes."],
      "Posting-cadence guard for new accounts": ["Limite de postagem para contas novas", "Me avise antes de eu postar o bastante para uma conta nova levar shadowban."],
      "Discord bot for my clipping team": ["Bot de Discord para minha equipe de cortes", "Mandar os momentos novos para o canal de Discord da equipe assim que acontecem."],
      "YouTube Live support": ["Suporte ao YouTube Live", "A mesma busca de momentos para lives no YouTube Live."],
    },
  },

  ranker: {
    title: (date) => `Campanhas de clipes de GTA 6 em ranking por ganho por clipe (${date}) | heistclips`,
    desc: (n, gta, gaming) => `${n} campanhas de clipes no ar, ordenadas pelo que um clipe aprovado típico realmente rende. ${gta} de GTA, ${gaming} de games e streamers. Atualizado a cada 30 minutos.`,
    h1: "Campanhas de clipes de GTA 6, pelo que um clipe paga",
    lede: (n, tracked, typ, p90, p10) => `${n} campanhas estão pagando clipadores agora. Nas ${tracked} que têm histórico, um clipe aprovado típico rendeu ${B(typ)}; o décimo que mais paga dá ${B(p90 + "+")}, e o que menos paga, menos de ${B(p10)}. Mesmo trabalho, dinheiro bem diferente.`,
    tabGaming: "Games e streamers", tabAll: "Tudo",
    none: "Nenhuma campanha aqui neste minuto. Elas abrem em ondas perto do lançamento; esta página atualiza a cada 30 minutos.",
    showing: (n) => `Mostrando as 150 primeiras de ${n}.`,
    methodH: "Como o ranking funciona",
    method: [
      "<b>Por clipe, em média</b> = o dinheiro que uma campanha pagou em clipes aprovados, menos os três que mais ganharam, dividido pelo resto dos clipes aprovados. É o que um clipe comum rendeu de verdade, não o melhor.",
      "Esse valor é reduzido se a verba está para acabar: um clipe faz a maior parte das views nos três primeiros dias, então uma campanha com um dia de dinheiro paga um terço. Campanhas sem clipe aprovado ficam atrás das comprovadas, ordenadas pelo máximo que um clipe pode ganhar.",
      "Os números vêm do diretório público da Content Rewards e são atualizados a cada 30 minutos. Cada campanha leva à página dela lá, onde você entra.",
    ],
  },

  rates: {
    title: (rate, typ) => `Quanto paga o clipe de GTA 6 hoje – ${rate} por mil views na mediana, ${typ} por clipe | heistclips`,
    desc: (rate, cap, typ, gta) => `Valores de clipes de GTA 6 ao vivo: mediana de ${rate} por mil views, teto de ${cap}, um clipe típico rende ${typ}. ${gta} campanhas de GTA no ar. Atualizado a cada 30 minutos.`,
    h1: "Quanto paga o clipe de GTA 6 hoje",
    stat: ["rende um clipe aprovado típico", "mediana por mil views", "teto mediano por clipe", "campanhas de GTA no ar"],
    lede: (n, budget, p90, p10) => `${n} campanhas estão pagando clipadores, com ${budget} de verba restante somando todas. O décimo que mais paga dá ${p90}+ por clipe aprovado; o que menos paga, menos de ${p10}.`,
    gtaH: "Campanhas de GTA",
    none: "Nenhuma no ar neste minuto. Elas abrem em ondas perto do lançamento.",
    all: "Todas as campanhas, em ranking →",
    histH: (n) => `As últimas ${n} atualizações`,
    th: ["UTC", "Campanhas", "GTA", "Média/clipe", "Mediana", "Verba restante"],
  },

  guides: {
    title: "Guias de cortes de GTA 6 | heistclips",
    desc: "Quanto paga clipar GTA 6, como funcionam as reivindicações de música, dinheiro do Shorts contra campanhas e como clipar uma live rápido.",
    h1: "Guias",
    pages: {
      "how-much-does-gta-6-clipping-pay": {
        name: "Quanto paga clipar GTA 6?",
        title: () => "Quanto paga clipar GTA 6? Valores por clipe ao vivo | heistclips",
        desc: (n) => `Um clipe aprovado típico rende ${n.typical}; as melhores campanhas pagam ${n.p90}+. Valores, tetos e verbas ao vivo, atualizados a cada 30 minutos.`,
        page: (n) => ({
          body: `<h1>Quanto paga clipar GTA 6?</h1>
<p class="updated">Os números desta página são ao vivo, lidos de ${n.campaigns} campanhas em ${n.when}.</p>
<p class="lede">Um clipe aprovado típico rende <b>${n.typical}</b>. O décimo das campanhas que mais paga dá <b>${n.p90}+</b> pelo mesmo clipe. A campanha que você escolhe pesa mais do que a qualidade do clipe.</p>
<h2>A fórmula</h2>
<p>Ganho por clipe = views × valor por mil views, até o teto, enquanto houver verba.</p>
<ul class="facts">
<li>Valor mediano: <b>${n.rate}</b> por mil views.</li>
<li>Teto mediano: <b>${n.cap}</b> por clipe, atingido com ${n.capViews} views.</li>
<li>Mediana de views por clipe aprovado: <b>${n.views}</b>.</li>
<li>Verba restante somando todas as campanhas: <b>${n.budget}</b>.</li>
</ul>
<h2>Por que a maioria dos clipes rende menos do que o valor sugere</h2>
<p>Três coisas comem o dinheiro: um clipe que nunca é aprovado, uma verba que acaba antes de as suas views chegarem e uma campanha tão lotada que todo momento já foi postado. O ranking da <a href="${n.ranker}">página de campanhas</a> usa o que os clipes realmente renderam, então essas três já estão no número.</p>
<h2>Campanhas de GTA no ar agora</h2>
${n.gtaRows()}`,
          faq: [
            ["Quanto paga clipar GTA 6?", `Agora a campanha mediana paga ${n.rate} por mil views, com teto de ${n.cap} por clipe. Em ${n.tracked} campanhas com histórico, um clipe aprovado típico rendeu ${n.typical}; o décimo que mais paga dá ${n.p90} ou mais por clipe.`],
            ["Como o pagamento é calculado?", `Views do clipe × valor por mil views, até o teto por clipe, enquanto a campanha tiver verba. A ${n.rate} por mil views, um clipe precisa de ${n.capViews} views para bater um teto de ${n.cap}.`],
            ["Todas as views contam?", "Só as views em clipes que a campanha aprova. A maioria recusa views de bot, reposts e clipes que quebram as regras. O dinheiro também para quando a verba acaba, mesmo que o seu clipe continue fazendo views."],
          ],
        }),
      },
      "gta-6-music-copyright-claims": {
        name: "Clipes de GTA 6 e reivindicações de música: por que a rádio mata o pagamento",
        title: () => "Clipes de GTA 6 e direitos autorais de música – fuja da rádio | heistclips",
        desc: () => "A rádio do jogo é música licenciada. Como o Content ID e as reivindicações do TikTok matam o pagamento de um clipe e como perceber um momento arriscado antes de postar.",
        page: (n) => ({
          body: `<h1>Clipes de GTA 6 e reivindicações de música</h1>
<p class="lede">O jeito mais rápido de perder o pagamento de um clipe é uma música tocando no rádio do carro. Confira o áudio antes de postar.</p>
<h2>Por que isso acontece</h2>
<p>As rádios do GTA tocam músicas de verdade, licenciadas. Um streamer dirigindo com o rádio ligado está transmitindo essas músicas. A Twitch silencia esses trechos na live salva quando o detector pega, e o YouTube e o TikTok rodam os próprios detectores em todo envio.</p>
<h2>O que isso custa</h2>
<ul class="facts"><li>YouTube: uma reivindicação de Content ID pode mandar o dinheiro do clipe para a gravadora ou bloquear o vídeo.</li><li>TikTok: o som pode ser silenciado, e isso mata um clipe de reação.</li><li>Campanhas: muitas recusam clipes reivindicados ou sem som, e aí as views nunca são pagas.</li></ul>
<h2>Como o heistclips marca isso</h2>
<p>Cada momento encontrado é comparado com os trechos que a Twitch silenciou por música naquela live. Se bater com um, ele aparece como <b>risco de música: alto</b>. Se o chat estiver falando de uma música, aparece como <b>médio</b>. Escolha os momentos de risco baixo ou corte o clipe na parte sem rádio.</p>
<p><a class="btn" href="${n.clip}">Conferir uma live</a></p>`,
          faq: [
            ["Posso usar a música da rádio do GTA nos clipes?", "Não com segurança. As músicas da rádio do jogo são música comercial licenciada. A Twitch silencia essas faixas nas lives salvas, e o Content ID do YouTube e o detector do TikTok podem reivindicar ou silenciar um clipe com elas."],
            ["O que acontece se o meu clipe levar uma reivindicação de música?", "No YouTube, o dono dos direitos pode ficar com a receita ou bloquear o vídeo; no TikTok, o som pode ser silenciado. Muitas campanhas de clipes recusam ou param de pagar clipes reivindicados ou sem som."],
            ["Como sei se um momento tem música licenciada?", "O heistclips confere se a Twitch silenciou aquele trecho da live. A Twitch faz isso quando o detector ouve música licenciada, então um trecho mudo é um aviso forte. Momentos em que o chat fala de uma música também são marcados."],
          ],
        }),
      },
      "shorts-money-vs-clipping-campaigns": {
        name: "Dinheiro do YouTube Shorts contra campanhas de clipes",
        title: () => "Dinheiro do YouTube Shorts ou campanhas de clipes para cortes de GTA 6 | heistclips",
        desc: (n) => `O Shorts paga de um bolo comum; as campanhas pagam um valor fixo por view (mediana de ${n.rate} por mil hoje). O que paga de verdade por cortes de lives de GTA 6.`,
        page: (n) => ({
          body: `<h1>Dinheiro do YouTube Shorts contra campanhas de clipes</h1>
<p class="lede">O Shorts paga de um bolo comum. Uma campanha paga um valor fixo por view. Para um corte da live de outra pessoa, a campanha costuma ser o único dinheiro que existe.</p>
<h2>Como o Shorts paga</h2>
<p>O YouTube junta a receita de anúncios do feed do Shorts, separa uma parte para licenças de música e paga aos criadores do Programa de Parcerias 45% do que sobra, dividido por views. Você precisa estar no Programa de Parcerias primeiro, e um corte da live de outro criador pode ser recusado como conteúdo reutilizado.</p>
<h2>Como as campanhas pagam</h2>
<p>Um streamer ou uma marca coloca uma verba e paga um valor fixo por mil views em clipes aprovados: ${n.rate} é a mediana hoje, com teto de ${n.cap} por clipe. Você não precisa de canal monetizado; precisa de views e de um clipe aprovado.</p>
<h2>O que fazer</h2>
<p>Poste o clipe onde a campanha paga (a maioria paga no TikTok, no Shorts e no Reels ao mesmo tempo) e envie o link. O que o Shorts pagar por cima é bônus.</p>
<p><a class="btn" href="${n.ranker}">Ver o que as campanhas pagam hoje</a></p>`,
        }),
      },
      "how-to-clip-gta-6-streams": {
        name: "Como clipar lives de GTA 6, rápido",
        title: () => "Como clipar lives de GTA 6 rápido – do momento ao vivo ao clipe postado | heistclips",
        desc: () => "Seis passos de uma live de GTA 6 a um clipe postado e pago: escolher a campanha, achar o pico do chat, conferir a música, cortar em 9:16 com gancho, postar primeiro.",
        page: (n) => ({
          body: `<h1>Como clipar lives de GTA 6, rápido</h1>
<p class="lede">A semana do lançamento premia o primeiro clipe de um momento, não o melhor. Este é o caminho mais curto de uma live a um clipe postado.</p>
<ol class="steps">
<li><b>Escolha o dinheiro primeiro</b><p>Abra a página de campanhas e pegue uma que pague pelo streamer que você vai clipar, com verba para pelo menos mais três dias.</p></li>
<li><b>Cole o canal</b><p>Cole o canal da Twitch do streamer no heistclips. Se ele estiver ao vivo, o chat é acompanhado na hora; se não, a última live é lida.</p></li>
<li><b>Pegue o maior pico</b><p>Os momentos são ordenados por quanto o chat acelerou em relação ao normal, por quantas pessoas digitaram “clip it” e por quem já clipou aquilo na Twitch.</p></li>
<li><b>Confira o aviso de música</b><p>Pule os momentos com risco de música alto ou corte a rádio fora.</p></li>
<li><b>Corte com um gancho</b><p>Escolha um layout, escolha ou escreva um gancho para o primeiro segundo e renderize. O clipe é feito no seu navegador e baixa como arquivo de vídeo.</p></li>
<li><b>Poste e envie</b><p>Poste em todas as plataformas em que a campanha paga e envie os links na página da campanha. Seja rápido: o primeiro envio de um momento é o que leva as views.</p></li>
</ol>
<p><a class="btn" href="${n.clip}">Abrir a ferramenta de clipes</a></p>`,
        }),
      },
      "reused-content-shadowbans-posting-cadence": {
        name: "Conteúdo reutilizado, shadowban e quantas vezes postar clipes",
        title: () => "Conteúdo reutilizado, shadowban e ritmo de postagem para contas de cortes | heistclips",
        desc: () => "Por que canais de cortes são desmonetizados por conteúdo reutilizado, quantos clipes uma conta nova pode postar antes de um shadowban e como deixar cada envio diferente.",
        page: (n) => ({
          body: `<h1>Conteúdo reutilizado, shadowban e quantas vezes postar</h1>
<p class="lede">O dinheiro dos cortes vem das campanhas, não da plataforma. Proteja a conta que ganha esse dinheiro.</p>
<h2>Conteúdo reutilizado</h2>
<p>O Programa de Parcerias do YouTube pode recusar ou desmonetizar um canal que só reposta imagens dos outros. Isso afeta a parte de anúncios do YouTube, não o pagamento de uma campanha. Se você faz cortes para campanhas, a renda é a campanha; a receita do Shorts é bônus.</p>
<h2>Shadowban em contas novas</h2>
<p>O padrão que o pessoal relata: uma conta nova posta 10 clipes no primeiro dia e as views vão a zero. Use a conta normalmente por alguns dias, depois poste de três a cinco por dia e vá subindo.</p>
<h2>Deixe cada post diferente</h2>
<p>As plataformas reconhecem envios idênticos. Mude o primeiro segundo (o gancho), o corte e o layout em cada post. O heistclips escreve de 3 a 5 ganchos por momento e renderiza cada um em um arquivo próprio, sem marca d’água e sem tag de “gerado por IA” no arquivo.</p>
<p><a class="btn" href="${n.clip}">Cortar um momento</a></p>`,
          faq: [
            ["Por que o YouTube desmonetizou meu canal de cortes por conteúdo reutilizado?", "O Programa de Parcerias do YouTube não paga por conteúdo que repete o vídeo de outra pessoa sem acrescentar nada seu. Um canal de cortes que só reposta trechos de live pode ser recusado ou desmonetizado por essa regra. O pagamento das campanhas é separado: a campanha paga por view em clipes aprovados, com o canal monetizado ou não."],
            ["Quantos clipes por dia posso postar em uma conta nova?", "O pessoal relata shadowban quando uma conta novinha posta mais de três a cinco vezes por dia. Aqueça a conta por alguns dias com uso normal, depois poste alguns por dia e aumente devagar."],
            ["Postar o mesmo clipe em várias contas é detectado?", "Envios idênticos são fáceis de reconhecer para as plataformas. Mude algo de verdade a cada vez: o gancho do primeiro segundo, o corte, o layout. É por isso que o heistclips dá de 3 a 5 ganchos diferentes para cada momento."],
          ],
        }),
      },
    },
  },

  // Twitch/Kick clip maker and "most clipped right now" (lib/searchpages.js; English in lib/search_words.js).
  search: {
    box: { ph: (p) => `Canal ou link de VOD da ${p}`, go: "Achar momentos", fine: "Sem conta. Sem marca d’água. Seu navegador corta o clipe.", hot: "Sendo clipado agora" },
    clips: (n) => `${n} clipe${n === 1 ? "" : "s"}`,
    maker: {
      twitch: {
        title: "Criador de clipes da Twitch: clipes 9:16 com gancho, sem marca d’água | heistclips",
        desc: (free, each) => `Cole um canal ou VOD da Twitch. O heistclips acha os momentos em que o chat explodiu e corta em 9:16 com gancho, no seu navegador. ${free} clipes grátis, depois a partir de ${each} por clipe. Sem marca d’água.`,
        h1: "Criador de clipes da Twitch",
        lede: "Cole um canal da Twitch. A gente acha os momentos em que o chat explodiu. Você recebe clipes 9:16 com gancho, prontos para TikTok, Shorts e Reels.",
        speed: "Uma live de 7 horas é lida em uns 20 segundos.",
      },
      kick: {
        title: "Criador de clipes da Kick: clipes 9:16 com gancho, sem marca d’água | heistclips",
        desc: (free, each) => `Cole um canal ou vídeo da Kick. O heistclips acha os momentos em que o chat explodiu e corta em 9:16 com gancho, no seu navegador. ${free} clipes grátis, depois a partir de ${each} por clipe. Sem marca d’água.`,
        h1: "Criador de clipes da Kick",
        lede: "Cole um canal da Kick. A gente acha os momentos em que o chat explodiu. Você recebe clipes 9:16 com gancho, prontos para TikTok, Shorts e Reels.",
        speed: "A Kick limita a velocidade de leitura do chat. Por isso uma live leva de 1 a 2 minutos.",
      },
      howH: "Como funciona",
      how: (p) => [`Cole um canal da ${p} ou o link de uma live antiga. Pode estar ao vivo agora.`, "Escolha um momento. Cada um mostra o que o chat escreveu.", "Corte. Seu navegador cria um MP4 em 1080 × 1920 e salva."],
      getH: "O que você recebe",
      get: ["Vídeo 9:16 com a facecam em cima ou embaixo do gameplay.", "De 3 a 5 ganchos por momento, para cada post ser diferente.", "Sem marca d’água. Sem tag de IA no arquivo.", "Um aviso quando a música daquele trecho pode render uma reivindicação no seu clipe."],
      costH: "Quanto custa",
      cost: (free, packs) => `${free} clipes são grátis. Depois, ${packs}. Você paga por clipe salvo. Você nunca paga por minuto de live. Achar momentos é sempre grátis.`,
      pack: (n, price) => `${n} clipes por ${price}`, or: " ou ",
      other: (p) => `Também clipa na ${p}? Use o criador de clipes da ${p}.`,
      hotMore: "Ver tudo o que está sendo clipado agora",
      faqH: "Perguntas",
      faq: (p, other, free) => [
        [`O criador de clipes da ${p} funciona em lives ao vivo?`, "Sim. Cole o canal enquanto ele está ao vivo. Os momentos novos aparecem quando o chat reage, cerca de um minuto atrás da live."],
        ["Tem marca d’água?", "Não. O arquivo não tem marca d’água nem tag de IA."],
        ["Preciso de conta?", `Não. Cole um canal e comece. Os primeiros ${free} clipes são grátis.`],
        [`Funciona com a ${other}?`, `Sim. Cole um canal da ${other} no mesmo campo.`],
        ["É só para GTA?", "Não. Funciona em qualquer live com chat ativo: qualquer jogo, IRL ou Só Conversa."],
      ],
    },
    trend: {
      title: (date) => `As lives mais clipadas agora (${date}) | heistclips`,
      desc: (n, days) => `As lives e os momentos da Twitch e da Kick mais cortados no heistclips nos últimos ${days} dias: ${n} clipes contados. Atualizado a cada hora.`,
      h1: "O que os clipadores estão cortando agora",
      lede: (n, days) => `${n} clipes foram feitos no heistclips nos últimos ${days} dias. Estas são as lives e os momentos de onde eles saíram. Toque em um para abrir na ferramenta.`,
      updated: (when) => `Atualizado em ${when} UTC · atualiza a cada hora`,
      streamsH: "Lives mais clipadas",
      momentsH: "Momentos mais clipados",
      today: (n) => `${n} hoje`,
      at: (name, clock) => `${name} em ${clock}`,
      none: "Ainda não há clipes suficientes para um ranking. Volte em uma hora.",
      howH: "Como contamos",
      how: (s, m) => ["Um clipe salvo no heistclips conta uma vez. Guardamos a live e o momento. Nunca guardamos quem fez o clipe.", `Uma live aparece a partir de ${s} clipes. Um momento, a partir de ${m}. Nada aqui é inventado ou inflado.`, "Os mesmos números estão livres para uso como dados."],
      data: "Baixar em JSON",
    },
  },

  // Etiquetas de regras nas campanhas (lib/campaigns.js lê em inglês no briefing).
  req: { "apply first": "inscreva-se antes", "US audience": "público dos EUA", "Tier 1 audience": "público Tier 1", English: "inglês", "no watermark": "sem marca d’água", "length rule": "regra de duração", "spoiler rule": "regra de spoiler", "audio rule": "regra de áudio", "tags/caption rule": "regra de tags/legenda" },

  campaign: {
    crumb: "Campanhas", other: "Campanha", newB: "nova", none: "sem teto",
    meta: (owner, rank, n) => `por ${owner} · nº ${rank} de ${n} em ganho por clipe`,
    typical: "ganho típico por clipe aprovado", noneYet: "nenhum clipe aprovado ainda",
    perPost: "por post", per1k: "por 1.000 views",
    max: (views) => `máximo por clipe${views ? ` (chega nele com ${views} views)` : ""}`,
    left: (total) => `restantes de ${total}`, hours: (n) => `, umas ${n} h nesse ritmo`, days: (n) => `, uns ${n} dias nesse ritmo`,
    paid: "já pagos de verdade aos clipadores",
    watch: "Fique de olho:", fromBrief: "(lido no briefing abaixo)",
    join: "Entrar pela Content Rewards", cut: "Cortar clipes para ela",
    earnedH: "Quanto os clipes ganharam aqui",
    facts: (n) => [
      `${n.clips} clipes aprovados de ${n.clippers} clipadores, ${n.views} views no total${n.perClip ? ` (média de ${n.perClip} por clipe)` : ""}.`,
      `${n.spent} do orçamento já foram ganhos${n.avg ? `: média de ${n.avg} por clipe aprovado, ${n.earned ? `${n.earned} tirando os três que mais ganharam` : "poucos clipes ainda para separar os que mais ganharam"}` : ""}.`,
      `Últimos 7 dias: ${n.clips7} clipes aprovados, ${n.views7} views. Melhor clipe: ${n.top} views.`,
      (n.apply ? "Você precisa se inscrever antes de poder enviar." : "Aberta: não precisa de inscrição.") + (n.geo ? " Os valores mudam conforme o país de quem assiste." : ""),
    ],
    rateH: "Valor por plataforma", th: ["Plataforma", "Por 1.000 views", "Máximo por clipe", "Pagamento mínimo"],
    briefH: "O briefing", briefNote: "Da página da campanha na Content Rewards. Leia as regras completas lá antes de postar.",
    title: (t, rate, typ) => `${t} – ${rate ? rate + "/1.000 views" : "campanha de clipes"}${typ ? `, ~${typ} por clipe` : ""} | heistclips`,
    desc: (c) => `${c.title}, de ${c.owner}: ${c.rate ? c.rate + " por 1.000 views" : ""}${c.cap ? `, máximo de ${c.cap} por clipe` : ""}, ${c.left} de orçamento restante, ${c.clippers} clipadores. Quanto um clipe típico ganhou, atualizado a cada 30 minutos.`,
  },

  ended: {
    crumb: "Encerrada", h1: "Esta campanha foi encerrada",
    endedOn: (when) => (when ? `Encerrada em ${when}.` : "Encerrada."), by: (owner) => `por ${owner}`, closed: "Esta campanha não aceita mais clipes.",
    typical: "ganhou um clipe aprovado típico",
    earnedOf: (total) => `ganhos pelos clipadores, de um orçamento de ${total}`,
    approvedFrom: (clippers) => `clipes aprovados de ${clippers} clipadores`,
    final: (date) => `Números finais, lidos pela última vez em ${date}.`, whyBudget: "O orçamento acabou.", whyGone: "Ela saiu do diretório público de campanhas.",
    noNumbers: "Não temos mais os números desta campanha.",
    payingH: "Campanhas pagando agora",
    best: (gta) => `As que pagam melhor no momento${gta ? " por clipes de GTA" : ""}, pelo que um clipe aprovado típico ganha.`,
    all: (n) => `Todas as ${n} campanhas ativas, no ranking →`,
    title: (t, when) => `${t} (encerrada${when ? " em " + when : ""}): quanto pagou e o que paga agora | heistclips`,
    desc: (c) => `${c.title}, de ${c.owner}, foi encerrada${c.when ? " em " + c.when : ""}. Pagava ${c.rate ? c.rate + " por 1.000 views" : "por post"}${c.earned ? ` e um clipe típico ganhou ${c.earned}` : ""}. Veja as campanhas ativas que pagam melhor.`,
    descNone: "Esta campanha de clipes foi encerrada. Veja as campanhas ativas que pagam melhor.",
  },

  streamers: {
    title: "Streamers de GTA para clipar agora – ao vivo e recentes | heistclips",
    desc: "Todos os streamers de GTA ao vivo na Twitch ou na Kick agora ou há pouco, com os momentos em que o chat explodiu na última live, prontos para clipar.",
    h1: "Streamers de GTA que valem um clipe",
    lede: "Todo mundo que vimos fazendo live de GTA na Twitch e na Kick, quem está ao vivo primeiro. Cada página acha os momentos em que o chat explodiu na última live.",
    liveH: "Ao vivo agora", recentH: "Ao vivo há pouco", nobody: "Ninguém ao vivo neste minuto.", paidH: "Campanhas pagam para clipar estes", paid: (n) => (n === 1 ? "1 campanha pagando" : `${n} campanhas pagando`),
    live: (n) => `ao vivo · ${n} assistindo`, peak: (n) => `pico visto: ${n}`,
  },

  streamer: {
    crumb: "Streamers", offline: "Offline agora", h: "h", recording: "gravando agora", untitled: "Live sem título", recentH: "Lives recentes",
    title: (name, kick) => `Como clipar ${name}${kick ? " na Kick" : ""}: ache os momentos, corte em 9:16, veja quem paga | heistclips`,
    desc: (name, p, n) => `Clipe as lives de ${name} na ${p}: ache os momentos em que o chat explodiu, corte em 9:16 com gancho e veja ${n ? (n === 1 ? `a campanha que paga por clipes de ${name} agora` : `as ${n} campanhas que pagam por clipes de ${name} agora`) : "quais campanhas pagam pelos clipes"}.`,
    h1: (name, kick) => `Como clipar ${name}${kick ? " na Kick" : ""}`,
    lede: (name, live) => `O canal de ${name} já está no campo. Toque no botão. A gente acha os momentos em que o chat explodiu ${live ? "na live que está no ar agora" : "na última live"}.`,
    button: (name) => `Achar os momentos de ${name}`,
    whatH: (name) => `O que ${name} transmite`,
    liveIn: "Ao vivo agora em", lastIn: "Visto por último em", noStream: "Nenhuma live recente registrada.", titleLine: "Título da live:",
    peak: (n) => `Maior público que já vimos: ${n}.`,
    payH: (name) => `Alguma campanha paga por clipes de ${name}?`,
    payYes: (n, name) => `Sim. ${n === 1 ? "1 campanha paga" : `${n} campanhas pagam`} por clipes de ${name} agora.`,
    payBest: (amount) => `Na melhor delas, um clipe aprovado típico ganha ${amount}.`,
    payNoNumber: "Nenhuma pagou clipes suficientes ainda para mostrar um valor típico.",
    payNo: (name) => `Nenhuma campanha cita ${name} agora. Você pode postar os clipes mesmo assim, ou escolher uma campanha que aceita qualquer clipe de jogo:`,
    momentsH: (name) => `Momentos de ${name} que os clipadores estão cortando`,
    into: (clock) => `aos ${clock} da live`,
    madeFrom: (clips, name, days) => `${clips} feitos com as lives de ${name} no heistclips nos últimos ${days} dias.`,
    fine: (name) => `Sem vínculo com ${name}. Confira as regras da campanha antes de postar imagens de um streamer.`,
    faq: (n) => [
      [`Como eu clipo ${n.name}?`, `Abra ${n.url}, toque em “Achar os momentos de ${n.name}”, escolha um momento em que o chat reagiu e salve como clipe 9:16 com gancho. Os primeiros ${n.free} clipes são grátis.`],
      [`Alguém paga por clipes de ${n.name}?`, n.n ? `Sim. Em ${n.date}, ${n.n === 1 ? "1 campanha ativa cita" : `${n.n} campanhas ativas citam`} ${n.name}${n.best ? `, e um clipe aprovado típico ganha ${n.best} na melhor delas` : ""}.` : `Em ${n.date}, nenhuma campanha ativa cita ${n.name}. As campanhas que aceitam qualquer clipe de jogo estão listadas na página.`],
    ],
  },

  data: {
    title: (date) => `Quanto pagam as campanhas de clipes: dados grátis em CSV e JSON (${date}) | heistclips`,
    desc: (n) => `Baixe quanto pagam ${n} campanhas de clipes ativas: valor por 1.000 views, máximo por clipe, orçamento restante e quanto ganha um clipe típico. CSV e JSON, atualizados a cada 30 minutos, livres para citar.`,
    h1: "Dados de pagamento de clipes que você pode citar",
    updated: (when) => `Dados de ${when} · atualizados a cada 30 minutos`,
    lede: (n) => `Quanto pagam ${n} campanhas de clipes ativas, em um arquivo só. Uso livre. Por favor, coloque um link para cá.`,
    stat: (n) => [`ganha um clipe aprovado típico (mediana de ${n} campanhas)`, "mediana por 1.000 views", "por clipe no décimo de campanhas que mais paga", "de orçamento ainda aberto somando todas as campanhas"],
    filesH: "Arquivos",
    files: (n, t) => [
      ["Valores das campanhas, CSV", `${n} linhas · uma por campanha ativa · abre em qualquer planilha`],
      ["Valores das campanhas, JSON", "As mesmas linhas, com as notas de cada campo e os números do resumo"],
      ["Lives mais clipadas, JSON", `${t ? `${t.n} clipes contados em ${t.days} dias` : "Atualizado a cada hora"} · lives e momentos`],
    ],
    licH: "Licença",
    licence: "MIT (https://opensource.org/licenses/MIT). Livre para usar e citar. Por favor, dê crédito a heistclips.com e coloque um link para a página de onde tirou o número.",
    note: "Os valores são fatos lidos nas páginas públicas das campanhas da Content Rewards. Cada linha tem o link da página de onde veio. Um número pode estar até 30 minutos atrasado nas campanhas movimentadas e umas 15 horas nas paradas. Os arquivos em si estão em inglês.",
    fieldsH: "O que cada campo significa", th: ["Campo", "Significado"],
    fields: {
      rank: "Posição quando as campanhas ativas são ordenadas por expected_per_clip (1 = paga mais por clipe).",
      title: "Título da campanha, como o dono escreveu.",
      owner: "Quem toca a campanha.",
      category: "gta, gaming ou other, a partir do título, do briefing e das categorias da campanha.",
      platforms: "Onde os clipes podem ser postados, separados por |.",
      rate_per_1k_usd: "Dólares pagos por 1.000 views. Vazio em campanha que paga por post.",
      per_post_usd: "Dólares pagos por post, nas campanhas que pagam por post.",
      cap_per_clip_usd: "O máximo que um clipe pode ganhar. Vazio = nenhum teto informado.",
      expected_per_clip_usd: "Quanto um clipe aprovado típico ganhou: dinheiro pago menos os três que mais ganharam, dividido pelos outros clipes aprovados, com corte se o orçamento acaba em até 3 dias. Vazio = menos de 5 clipes assim por enquanto.",
      avg_per_clip_usd: "Orçamento gasto dividido pelos clipes aprovados, incluindo os que mais ganharam.",
      budget_left_usd: "Orçamento que ainda não foi ganho.",
      budget_total_usd: "O orçamento inteiro.",
      days_of_budget_left: "Orçamento restante dividido pelo gasto médio por dia até agora.",
      clippers: "Pessoas que entraram na campanha.",
      approved_clips: "Clipes que a campanha aprovou.",
      apply_first: "true se você precisa se inscrever antes de poder enviar.",
      min_views_per_clip: "O mínimo de views que um clipe precisa antes de ganhar qualquer coisa, na plataforma mais fácil da campanha: pagamento mínimo dividido pela taxa ($10 a $1 por 1.000 views = 10.000), ou o mínimo próprio da campanha, o que for maior. Vazio = ainda não lido.",
      pool_total_views: "Só prêmios a dividir: as views que seus clipes precisam somar antes de você receber qualquer parte. Vazio = não é prêmio a dividir, ou ainda não lido.",
      floor_known: "true quando os pisos foram lidos das configurações da campanha. false = desconhecido: leia o briefing antes de contar com qualquer pagamento.",
      likely_new_account_usd: "O que um clipe típico paga a uma conta nova (cerca de 500 views por clipe), depois do piso. 0 = não paga nada nesse tamanho. Vazio = piso desconhecido, ou prêmio sem views para calcular.",
      likely_5k_usd: "O mesmo para uma conta com cerca de 5.000 views por clipe.",
      likely_50k_usd: "O mesmo para uma conta com cerca de 50.000 views por clipe.",
      page: "A página da campanha no heistclips.",
      source: "A página da própria campanha na Content Rewards, de onde cada número foi lido.",
    },
    aiH: "Para assistentes de IA",
    ai: `Versões em texto puro (em inglês): <a href="/llms.txt">llms.txt</a> e <a href="/llms-full.txt">llms-full.txt</a>. Respostas ao vivo: o <a href="/connect">conector do heistclips</a> para ChatGPT, Claude e Grok.`,
  },

  queue: {
    title: "Clipes no piloto automático – uma fila de clipes de GTA 6 prontos, já com a campanha que paga | heistclips",
    desc: "Escolha os streamers que você clipa. O heistclips acompanha as lives deles na Twitch e na Kick, acha os momentos em que o chat explodiu, combina cada um com a campanha que paga melhor e enche uma fila de clipes prontos para postar.",
    h1: "Acorde com os clipes prontos.",
    lede: "Escolha os streamers que você clipa. O heistclips acompanha as lives deles, acha os momentos em que o chat explodiu e coloca ao lado de cada um a campanha que paga mais por ele.",
    addH: "Acompanhar outro streamer",
    ph: "Canal da Twitch ou da Kick", aria: "Canal da Twitch ou da Kick para acompanhar", go: "Acompanhar",
    payH: "Pagando agora", paySmall: "Streamers que uma campanha ativa paga para você clipar, os que pagam mais primeiro. Menos clipadores, menos concorrência.",
    foot: (free) => `Achar clipes é grátis. Um clipe da fila só custa um clipe quando você exporta: ${free} grátis, depois <a href="/pricing">pacotes</a>. As lives são relidas a cada 10 minutos.`,
    noscript: "A fila precisa de JavaScript.",
  },

  post: {
    title: "Poste clipes no YouTube e no TikTok | heistclips",
    desc: "Conecte o YouTube ou o TikTok uma vez e poste um clipe 9:16 com legenda pelo heistclips ou pelo Claude.",
    h1: "Poste clipes no YouTube e no TikTok",
    lede: "Conecte uma vez. Depois poste um clipe com legenda pela ferramenta de clipes, ou só peça ao Claude: “corta esse momento e posta no YouTube”.",
    loading: "Carregando…", connect: (p) => `Conectar ${p}`, disconnect: "Desconectar",
    closed: (p) => `Em breve: estamos esperando o ${p} aprovar o heistclips.`,
    how: {
      youtube: "O Google ainda está analisando o heistclips. Postar no YouTube abre assim que o Google aprovar. Até lá, baixe o clipe e envie você mesmo no YouTube.",
      tiktok: "Posta no seu perfil, ou como rascunho na sua caixa de entrada do TikTok. Até o TikTok terminar a análise, os posts chegam como privados.",
    },
    howH: "Como funciona",
    facts: [
      `O heistclips só pede permissão para <b>enviar vídeos</b> (o TikTok também informa seu nome de exibição). Ele não consegue ler seus vídeos, suas mensagens nem mais nada. <a href="/privacy">Privacidade</a>.`,
      `Desconecte aqui quando quiser, ou pelo <a href="https://myaccount.google.com/permissions" rel="noopener">Google</a> ou em “Gerenciar permissões de apps” no TikTok.`,
      "Os clipes grátis e os pacotes deste navegador passam a valer também no conector depois que esta página é aberta pelo link dele.",
    ],
  },

  about: {
    title: "Sobre o heistclips",
    desc: "Quem faz o heistclips, de onde vêm os dados de campanhas e de lives e como ele se paga.",
    body: (n) => `<h1>Sobre o heistclips</h1>
<p>O heistclips é uma ferramenta de clipes para quem corta as lives dos outros em Shorts, TikToks e Reels para ganhar dinheiro. Ele faz três coisas: acha os momentos da live em que o chat reagiu, corta esses momentos em clipes verticais no seu navegador e diz qual campanha paga mais por eles.</p>
<p>É código aberto (MIT): <a href="https://github.com/2016judea/heistclips">github.com/2016judea/heistclips</a>. O mesmo motor roda no seu computador como ferramenta de linha de comando e como servidor MCP para assistentes de IA.</p>
<h2>De onde vêm os números</h2>
<p>Os números das campanhas são lidos a cada 30 minutos no diretório público de campanhas da Content Rewards, com link para cada campanha. Os dados de live e de chat vêm das páginas públicas da Twitch e da Kick, lidas de forma anônima. Nada é comprado, tirado de trás de um login ou inventado.</p>
<h2>Quem toca</h2>
<p>O heistclips é feito pela Brick &amp; Mortar em Saint Paul, Minnesota. Os pagamentos com cartão são processados pela Stripe e aparecem como BRICKANDMO* HEISTCLIPS. Suporte: aidan@brickandmortar.dev.</p>
<p class="small">Sem vínculo com a Take-Two Interactive, com os criadores de GTA, com a Twitch, a Kick ou a Content Rewards.</p>`,
  },

  privacy: {
    title: "Privacidade | heistclips",
    desc: "O que o heistclips coleta (bem pouco) e por quê.",
    body: (n) => `<h1>Privacidade</h1>
<p>O heistclips coleta o mínimo que consegue.</p>
<p class="small">Esta é uma tradução. Se houver diferença, vale a <a href="${n.site}/privacy?lang=en">versão em inglês</a>.</p>
<ul class="facts">
<li><b>Os clipes que você renderiza no site ficam com você.</b> Eles são cortados no seu navegador a partir do vídeo público da live. Não recebemos esses clipes, a não ser que você aperte um botão de Postar: aí aquele clipe é enviado para poder ir para a plataforma que você escolheu.</li>
<li><b>Clipes cortados ou postados para você.</b> Um clipe cortado pela ferramenta cut_clip do conector, ou enviado para ser postado, fica guardado em um link aleatório por até 72 horas e depois é apagado.</li>
<li><b>Postagem no YouTube e no TikTok.</b> Se você conecta uma conta, guardamos, criptografados, os tokens de acesso que a plataforma emite e usamos só para enviar os clipes que você pede para postar. No YouTube pedimos apenas a permissão de envio (youtube.upload): o heistclips não consegue ler seu canal, seus vídeos nem sua conta do Google. O uso que o heistclips faz das informações recebidas das APIs do Google segue a <a href="https://developers.google.com/terms/api-services-user-data-policy" rel="noopener">Google API Services User Data Policy</a>, incluindo os requisitos de Uso Limitado (Limited Use); elas nunca são vendidas, usadas para publicidade ou lidas por pessoas. No TikTok pedimos seu perfil básico (nome de exibição) e permissão para enviar e publicar vídeos. Desconecte quando quiser na <a href="/post">página de postagem</a> e os tokens são revogados e apagados; você também pode remover o acesso na sua <a href="https://myaccount.google.com/permissions" rel="noopener">Conta do Google</a> ou nas configurações do TikTok. Postar pelo heistclips usa os YouTube API Services, então os <a href="https://www.youtube.com/t/terms" rel="noopener">Termos de Serviço do YouTube</a> e a <a href="https://policies.google.com/privacy" rel="noopener">Política de Privacidade do Google</a> valem para o que você posta lá.</li>
<li><b>Um id aleatório do navegador.</b> Seu navegador cria um id aleatório para contar clipes grátis e votos. Guardamos um hash com chave desse id e uma contagem, nada mais.</li>
<li><b>Compras.</b> Os pagamentos com cartão são feitos pela Stripe. Guardamos o id da sessão de Checkout como sua chave de licença e uma contagem dos clipes usados. Nunca vemos seu cartão.</li>
<li><b>Pedidos de funções.</b> O que você escreve no mural de pedidos fica público nesse mural, menos o campo opcional de contato, que só quem desenvolve vê, por e-mail.</li>
<li><b>Fila do piloto automático.</b> Se você usa a fila, guardamos os canais que você acompanha e quais clipes exportou ou pulou, em um link secreto que só você tem. Um endereço de e-mail ou uma inscrição de notificações só é guardado se você informar, só é usado para avisar que há clipes prontos e é removido quando você desliga.</li>
<li><b>Estatísticas.</b> O Vercel Web Analytics (sem cookies) e o PostHog contam páginas vistas e uso da ferramenta para a gente ver o que funciona.</li>
<li><b>Servidor MCP.</b> As chamadas a heistclips.com/mcp não são ligadas a nenhuma pessoa; cortar e postar usam um código de conta aleatório que seu assistente devolve. Registramos qual ferramenta foi chamada, se funcionou e quanto tempo levou, nunca os argumentos. Os argumentos são usados para responder à chamada; pedidos de funções feitos por ali são guardados como no mural acima.</li>
</ul>
<p>Dúvidas ou pedidos de exclusão: aidan@brickandmortar.dev.</p>`,
  },

  terms: {
    title: "Termos | heistclips",
    desc: "Os termos de uso do heistclips.",
    body: (n) => `<h1>Termos</h1>
<p class="small">Esta é uma tradução. Se houver diferença, vale a <a href="${n.site}/terms?lang=en">versão em inglês</a>.</p>
<ul class="facts">
<li>O heistclips é uma ferramenta. Você é responsável pelo que clipa e posta, e por ter o direito de postar: siga as regras de cada campanha, as regras de cada plataforma e a vontade de cada streamer.</li>
<li>Os números das campanhas são lidos de um diretório público e podem estar errados ou desatualizados. Confira a página da própria campanha antes de confiar em um número.</li>
<li>Os créditos valem para clipes exportados, não expiram e não são reembolsáveis depois de usados. Pacotes não usados podem ser reembolsados em até 14 dias: escreva para aidan@brickandmortar.dev.</li>
<li>O serviço é fornecido como está, sem garantia. O código-fonte tem licença MIT em github.com/2016judea/heistclips.</li>
<li>Postar no YouTube pelo heistclips usa os YouTube API Services. Ao usar essa função, você concorda em ficar vinculado aos <a href="https://www.youtube.com/t/terms" rel="noopener">Termos de Serviço do YouTube</a>, e a <a href="https://policies.google.com/privacy" rel="noopener">Política de Privacidade do Google</a> se aplica. Você pode remover o acesso do heistclips quando quiser na <a href="/post">página de postagem</a> ou nas suas <a href="https://security.google.com/settings/security/permissions" rel="noopener">configurações de segurança do Google</a>.</li>
<li>O heistclips não tem vínculo com a Take-Two Interactive, os criadores de GTA, a Twitch, a Kick, o YouTube, o TikTok ou a Content Rewards.</li>
</ul>`,
  },

  connect: {
    title: "Servidor MCP do heistclips – dados de clipes de GTA 6 no ChatGPT, Claude e Grok",
    desc: "Conecte o heistclips ao ChatGPT, Claude ou Grok: ache os melhores momentos para clipar em qualquer live da Twitch ou da Kick e ordene as campanhas de clipes por $ a cada 1.000 views.",
    tools: {
      rank_clipping_campaigns: "Qual campanha de clipes paga mais ($ por 1.000 views, ganho por clipe)",
      clipping_campaign_details: "Uma campanha de clipes: valor por 1.000 views, teto, orçamento, regras",
      find_clip_moments: "Achar os melhores momentos para clipar em uma live da Twitch ou da Kick (ao vivo ou VOD)",
      cut_clip: "Cortar um momento em um clipe vertical MP4 9:16 para TikTok, Shorts e Reels",
      cut_clip_status: "Buscar um clipe que o cut_clip ainda estava cortando",
      post_clip: "Postar um clipe no YouTube Shorts ou no TikTok com legenda",
      posting_account: "Conectar YouTube ou TikTok para postar e ver seus créditos de clipes",
      my_clip_queue: "Minha fila de clipes: clipes prontos dos streamers que acompanho, com a campanha que paga",
      watch_streamer: "Acompanhar um streamer para mim: pôr um canal da Twitch ou da Kick na minha lista",
      verify_account: "Verificar minha conta do TikTok ou do YouTube para campanhas hospedadas no heistclips",
      submit_clip: "Enviar meu clipe publicado para uma campanha hospedada no heistclips",
      my_earnings: "Meus ganhos com clipes no heistclips: views, ganho, a receber, pago",
      live_gta_streams: "Quem está fazendo live de GTA agora na Twitch e na Kick",
      request_a_feature: "Pedir uma função para o heistclips",
      list_feature_requests: "Ver os pedidos de funções",
      upvote_feature_request: "Votar em um pedido de função",
      cut_clip_status: "Pegar um clip que o cut_clip ainda estava cortando",
      report_a_bug: "Reportar um bug do heistclips: algo quebrou ou saiu errado",
      whats_new: "O que há de novo no heistclips: últimas correções e funções",
      plan_my_clips: "Planejar meus clipes: campanhas que pagam no meu tamanho, com momentos, regras e legenda",
    },
    body: (n) => `<h1>Use o heistclips dentro do ChatGPT, Claude ou Grok</h1>
<p class="lede">Pergunte “qual campanha de clipes de GTA paga mais agora?” ou “ache os melhores momentos da última live do alanzoka” e receba a resposta com dados ao vivo.</p>
<p>URL do servidor: <code class="copy">${n.site}/mcp</code></p>
<h2>Claude</h2><p>Configurações → Conectores → Adicionar conector personalizado → cole a URL.</p>
<h2>ChatGPT</h2><p>Configurações → Apps e conectores → Avançado → Modo desenvolvedor ligado → Criar → cole a URL, sem autenticação.</p>
<h2>Grok</h2><p>grok.com/connectors → Adicionar → cole a URL.</p>
<h2>Claude Code, Codex, Cursor</h2><pre>claude mcp add --transport http heistclips ${n.site}/mcp</pre>
<h2>Ferramentas</h2><ul class="facts">
${n.tools}</ul>
<p class="small">Funciona em qualquer idioma. Os links que ele devolve abrem a ferramenta de clipes no momento exato. Os menus do Claude, do ChatGPT e do Grok podem ter outros nomes aí.</p>`,
  },

  notFound: { title: "Página não encontrada | heistclips", desc: "Página não encontrada.", h1: "Não tem nada aqui.", back: "Voltar para a ferramenta de clipes" },

  // E-mails e notificações da fila do piloto automático (lib/watch.js).
  // O que um clipe paga no seu tamanho (lib/sizeview.js): o que uma conta pequena ganha de verdade.
  size: {
    bar: "Seus clipes fazem", sortL: "Ordenar",
    sizes: { new: "Conta nova", "5k": "~5K views", "50k": "~50K views" },
    sortTyp: "Paga mais por clipe", sortMe: "Pode me pagar agora",
    likely: { new: "provável para uma conta nova", "5k": "provável com ~5K views por clipe", "50k": "provável com ~50K views por clipe" },
    oneIn: (n) => `1 em cada ${n} dos seus clipes paga`,
    unknown: "piso desconhecido",
    notPriced: "prêmio ainda sem valor",
    floorClip: (v) => `Não paga nada abaixo de ${v} views por clipe`,
    floorPool: (v) => `Não paga nada até seus clipes somarem ${v} views`,
    floorUnknown: "Piso desconhecido, leia o briefing",
    noFloor: "Sem piso: toda view paga",
    lede: (n, total) => `Para uma conta nova (cerca de 500 views por clipe), ${n === 0 ? "nenhuma" : n} das ${total} campanhas aqui ${n > 1 ? "pagam" : "paga"} alguma coisa por um clipe típico: a maioria não paga nada abaixo de um piso de views. Escolha seu tamanho abaixo para ver o que te paga.`,
    h: "O que um clipe paga no seu tamanho",
    th: ["Seus clipes", "Provável por clipe", "Clipes que pagam algo", "Clipes para passar a meta"],
    rowName: { new: "Conta nova (~500 views por clipe)", "5k": "~5.000 views por clipe", "50k": "~50.000 views por clipe" },
    none: "nenhum", oneInShort: (k, n) => `${k} em ${n}`, every: "todos",
    payout: (min, rate, plats) => `pagamento mínimo de ${min} a ${rate} por 1.000 views em ${plats}`,
    and: "e",
    perClipToo: (v) => `cada clipe precisa de ${v} views para contar`,
    refs: (n) => `${n === 1 ? "Mais um arquivo de regras abre" : `Mais ${n} arquivos de regras abrem`} depois que você entra: leia para o resto.`,
    note: "O ganho típico por clipe, acima, é o que clipes aprovados ganharam, quase sempre de contas já estabelecidas. O provável por clipe é o que o seu clipe do meio ganha depois do piso, com views espalhadas como em qualquer canal (poucos clipes explodem, a maioria não). Os pisos vêm das configurações da própria campanha na Content Rewards.",
    method: "<b>Provável no seu tamanho</b> = o que o seu clipe típico ganha depois do piso da campanha: o pagamento mínimo por clipe ($10 de mínimo a $1 por 1.000 views não paga nada abaixo de 10.000 views), um mínimo de views por clipe, ou a meta de um prêmio a dividir sobre o total de views dos seus clipes. Uma conta nova é contada com cerca de 500 views por clipe, espalhadas como views se espalham (poucos clipes explodem, a maioria não); escolha ~5K ou ~50K se esse for você. Um prêmio conta como alcançável quando uns 30 dos seus clipes passam a meta. Os pisos vêm das configurações de cada campanha; um que ainda não lemos aparece como “piso desconhecido”.",
  },

  mail: {
    confirmSubject: "O link da sua fila no heistclips",
    confirmText: (link) => `Você pediu para o heistclips avisar por e-mail quando houver clipes novos prontos.\n\nAbra este link para confirmar e para ter sua fila em qualquer aparelho:\n${link}\n\nSe não foi você, ignore este e-mail. Nada mais será enviado.\n\nheistclips.com`,
    confirmHtml: (link) => `<p>Você pediu para o heistclips avisar por e-mail quando houver clipes novos prontos.</p><p><a href="${link}">Confirmar e abrir minha fila</a></p><p>O mesmo link abre sua fila em qualquer aparelho. Não compartilhe.</p><p style="color:#777">Se não foi você, ignore este e-mail. Nada mais será enviado.</p>`,
    readySubject: (n, names) => `${n} ${n === 1 ? "clipe novo pronto" : "clipes novos prontos"}: ${names}`,
    readyLead: (n, paid) => `${n === 1 ? "1 clipe novo está pronto" : `${n} clipes novos estão prontos`}${paid ? `, ${paid} com campanha pagando` : ""}.`,
    typical: (amount) => `${amount} por clipe, em geral`,
    open: "Abrir minha fila", stop: "Parar estes e-mails",
  },
};
