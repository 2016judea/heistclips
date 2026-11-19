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
    three: [
      ["O chat acha o momento", "Momento de jogo é visual: transcrição não pega. O chat pega. Cada pico é um horário, mostrado com as frases que o chat digitou, para você ver por que ele foi escolhido. Funciona em live que ainda está no ar."],
      ["Seu navegador faz o corte", "Facecam em cima do gameplay, fundo desfocado ou recorte central; 3 a 5 ganchos para cada post sair diferente; chat por cima do vídeo. Renderizado na sua máquina, sem marca d’água, baixado na hora."],
      ["Música fica marcada", "A rádio do jogo é música licenciada. Se a Twitch silenciou aquele trecho, a gente avisa antes de você postar e perder o pagamento por causa de uma reivindicação."],
    ],
  },

  clip: {
    title: "Criador de clipes de GTA 6 – momentos pelo chat da Twitch, corte 9:16 no navegador | heistclips",
    desc: "Cole um canal ou VOD da Twitch. O heistclips acha os momentos em que o chat explodiu, marca música licenciada e corta clipes 9:16 com gancho direto no seu navegador.",
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
      ["Onde o vídeo é feito?", "No seu navegador, na sua máquina. Nada é enviado para a gente."],
      ["O que aparece na minha fatura?", "BRICKANDMORTAR.DEV, a empresa por trás do heistclips."],
    ],
  },

  requests: {
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
};
