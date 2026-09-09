/* ======================================================================
   Conferência antes da entrega.

   O pedido: ninguém marca uma tarefa como concluída sem ter conferido.
   Então a conferência não é um lembrete — é uma tranca. Enquanto houver
   item obrigatório em aberto, os três caminhos que levam ao "feito"
   (o círculo da lista, o arrasto para a coluna, o campo de status na
   ficha) recusam.

   São três níveis, e eles se apoiam um no outro:

     Área      o padrão do que se confere naquele tipo de entrega.
               É o que a operação combinou; muda pouco e vale para todo
               mundo. É daqui que a lista de cada tarefa nasce.

     Tarefa    a lista daquela entrega, nascida do padrão da área mais o
               contexto (a campanha, o canal, o produto). Esta é a que
               tranca a conclusão.

     Roteiro   o protocolo da área naquela campanha, com um dono. Este é
               o nível que faltava. As ações de uma campanha são sempre
               as mesmas — o que muda é a comunicação. Então o que se
               confere também é sempre o mesmo, e é longo: testar cada
               desconto e cada combinação entre eles, o limite do brinde,
               a compra no Pix e no cartão, a home inteira, a página de
               produto, o carrinho, o checkout, e tudo outra vez no
               celular. Isso não cabe em cada subtarefa — cabe uma vez
               só, na tarefa principal daquela área naquela campanha, e
               tranca ela até o roteiro fechar.

     Campanha  a conferência do conjunto: as tarefas todas conferidas,
               os roteiros de todas as áreas fechados, a oferta igual em
               todo canal, o cronograma cumprido, o resultado registrado.

   A lista pode ser escrita pela IA ou pelas regras daqui. As regras
   funcionam sempre, sem chave, sem rede e sem espera — a IA entra por
   cima delas quando existe /api/conferencia respondendo. Se a IA falhar,
   cair ou demorar, a lista das regras fica: nunca se entrega sem lista.
   ====================================================================== */
(function () {
  'use strict';

  const uid       = () => (window.user && window.user.id) || 'vitor-gutierrez';
  const chaveTar  = () => `central.tasks.${uid()}`;
  const chaveCamp = () => `central.campaigns.${uid()}`;
  const chaveConf = () => `central.conferencia.${uid()}`;

  const lerLista = (k) => { try { const v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : [] } catch { return [] } };
  const esc = (t) => String(t ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const agora = () => new Date().toISOString();
  const id = (p) => p + Math.random().toString(36).slice(2, 8);

  /* Quem está conferindo. Antes vinha de window.user, que nunca existiu —
     então toda marcação ficava assinada como "alguém". Agora vem do
     cadastro de acessos: o nome do perfil e o nome que a pessoa tem no
     ClickUp, que é como a tarefa a chama. */
  function meusNomes() {
    const eu = window.CentralEu;
    const nomes = [];
    if (eu && eu.nome) nomes.push(eu.nome);
    try {
      const A = window.Acessos;
      if (A && eu) {
        const p = (A.equipe() || []).find((x) => x.email === eu.email);
        if (p) { if (p.nome) nomes.push(p.nome); if (p.nomeClickup) nomes.push(p.nomeClickup) }
      }
    } catch { /* sem cadastro, vale o nome do perfil */ }
    return [...new Set(nomes.filter(Boolean))];
  }
  const nome = () => meusNomes()[0] || 'alguém';
  const souResponsavel = (t) => {
    const meus = meusNomes();
    return !!(t && meus.length && (t.assignees || []).some((a) => meus.includes(a)));
  };

  function aviso(texto) {
    if (window.showToast) { try { return window.showToast(texto) } catch {} }
    const t = document.createElement('div');
    t.className = 'as-aviso'; t.textContent = texto;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4200);
  }

  /* ---------- o que se confere em cada área ----------
     Escrito como a operação fala, não como um manual: cada linha é uma
     coisa que já deu errado alguma vez. O que é obrigatório trava a
     entrega; o resto fica como lembrete.

     A terceira coluna endurece a linha, porque marcar caixa é grátis e
     erro custa caro:

       'prova'    pede o link, o print ou o número junto da marcação.
                  Sem escrever a prova, a caixa não marca.
       'revisao'  quem fez não pode marcar. Precisa de outra pessoa —
                  é o segundo par de olhos, que é o que pega o que o
                  primeiro não vê.

     Isto aqui é só o padrão de fábrica. O que vale é o que estiver
     guardado — a pessoa edita a área e a edição manda. */
  const GERAIS = [
    ['Está entregue por inteiro o que o briefing pediu', true],
    ['A marca do material é a certa — Botanika ou VermeFree, sem trocar', true],
    ['Preço, desconto e cupom batem com a oferta da campanha', true],
    ['Todo número escrito na peça conferido contra a oferta real: quantidade, limite e prazo', true],
    ['Data e horário de publicação batem com o cronograma', true],
    ['Link testado: abre na página certa e com UTM', true, 'prova'],
    ['Texto lido inteiro, sem erro de português', true],
    ['Arquivo final salvo na pasta da campanha', false],
  ];

  const PADRAO = {
    'Tráfego': [
      ['Campanha, conjunto e anúncio nomeados no padrão', true],
      ['Público, orçamento e datas conferidos no gerenciador', true],
      ['Pixel disparando — teste de evento feito antes de subir', true],
      ['Criativo no formato certo de cada posicionamento', true],
      ['UTM completa: source, medium, campaign e content', true],
      ['Página de destino aberta e testada no celular', true, 'prova'],
      ['Verba do dia dentro do que o TAP previu', false],
    ],
    'Criativo': [
      ['Peça exportada na proporção de cada canal', true],
      ['Texto legível no celular, sem corte nas bordas', true],
      ['Logo, cor e tipografia dentro da marca', true],
      ['A foto é do produto que está na oferta', true],
      ['Selo de preço e desconto igual ao da oferta', true],
      ['Versão editável salva junto do arquivo final', false],
    ],
    'Copy': [
      ['A promessa do texto é a oferta real, sem prometer a mais', true],
      ['Nada dito sobre saúde além do que pode ser dito', true],
      ['Uma chamada só, e clara', true],
      ['Nome do produto e dosagem iguais ao rótulo', true],
      ['Revisado por outra pessoa antes de subir', true, 'revisao'],
    ],
    'Instagram': [
      ['Legenda, primeiro comentário e hashtags prontos', true],
      ['Link da bio ou figurinha apontando para a página da campanha', true],
      ['Capa do Reels e primeiro frame conferidos', true],
      ['Agendamento confirmado no dia e na hora do cronograma', true, 'prova'],
      ['Áudio liberado para conta comercial', false],
    ],
    'E-mail': [
      ['Assunto e pré-cabeçalho sem corte no celular', true],
      ['Teste enviado e aberto no Gmail e no celular', true, 'prova'],
      ['Todos os links clicados no teste', true],
      ['Segmento e exclusões conferidos antes do disparo', true],
      ['Remetente, resposta e descadastro funcionando', true],
    ],
    'Oferta': [
      ['Desconto criado no painel, com data de início e de fim', true],
      ['Cupom testado numa compra de verdade, até a tela de pagamento', true, 'prova'],
      ['Regra escrita: com o que soma e com o que não soma', true],
      ['Margem conferida no pior caso de soma de descontos', true],
    ],
    'Site': [
      ['Alterado no tema rascunho e revisado antes de publicar', true, 'revisao'],
      ['Testado no celular e no computador', true],
      ['Preço, frete e cupom aplicando até o checkout', true],
      ['Estoque conferido dos produtos da oferta', true],
      ['Conferido depois de publicado, abrindo a loja de verdade — não só o editor', true, 'prova'],
      ['Página não ficou mais lenta depois da mudança', false],
    ],
    'Influencer': [
      ['Briefing enviado e confirmado pelo creator', true],
      ['Cupom e link exclusivos criados e testados', true],
      ['Entregável aprovado antes de publicar', true, 'revisao'],
      ['Data de publicação combinada e dentro do cronograma', true],
      ['Print do publicado salvo', false],
    ],
    'Atendimento': [
      ['Respostas prontas da campanha carregadas', true],
      ['Equipe avisada da oferta, do cupom e das regras', true],
      ['Objeções e respostas revisadas', true],
      ['Escala coberta no horário de pico do dia', true],
    ],
    'Grupos': [
      ['Mensagem testada em um grupo antes do disparo geral', true, 'prova'],
      ['Link e cupom testados dentro da própria mensagem', true],
      ['Grupos e horário conferidos contra o cronograma', true],
      ['Não é a mesma mensagem de ontem', true],
    ],
    'API': [
      ['Público e regra da automação conferidos', true],
      ['Teste com um contato real antes de ligar', true, 'prova'],
      ['Limite de disparo e horário dentro do combinado', true],
    ],
    'Geral': [],
  };

  const PADRAO_CAMPANHA = [
    ['Todas as tarefas da campanha conferidas e concluídas', true, 'revisao'],
    ['A oferta está escrita igual em todos os canais', true],
    ['Cronograma cumprido — nenhum dia previsto ficou sem publicar', true],
    ['Meta e verba do TAP batem com o que foi gasto', true],
    ['Página ou coleção da campanha no ar e testada', true],
    ['Resultado registrado: faturamento, verba e ROAS', true, 'prova'],
    ['Aprendizados escritos para a próxima', false],
  ];


  /* ---------- o roteiro da área na campanha ----------
     O Vitor disse assim: "as ações das campanhas são sempre as mesmas, o
     que muda são só as comunicações". Isso é a chave. Se a ação é sempre
     a mesma, a conferência dela pode ser escrita uma vez e usada em toda
     campanha — e ela é longa demais para caber na lista de uma subtarefa.

     Então o roteiro é isto: o protocolo inteiro de uma área, dividido em
     etapas, feito uma vez por campanha, por uma pessoa só. Enquanto ele
     não fecha, a tarefa principal daquela área naquela campanha não
     fecha. As subtarefas seguem com a lista curta delas.

     A ordem das etapas é a ordem de fazer, não a de listar. */
  const ROTEIROS = {
    'Oferta': [
      ['Antes de ligar qualquer coisa', [
        ['Lista escrita de todo desconto vivo hoje na loja: automático, de frete, por quantidade, de influenciadora, de recompra, de boas-vindas', true, 'prova'],
        ['Decidido e escrito, um por um, qual soma com esta campanha e qual não soma', true],
        ['Os que não podem somar já desligados ou limitados dentro do período da campanha', true],
        ['Cupons da campanha criados com data de início, data de fim e limite de uso', true],
        ['Produtos fora da oferta marcados como fora — e conferidos', true],
      ]],
      ['Testar cada desconto sozinho', [
        ['Desconto da campanha aplicado sozinho: valor final conferido na conta', true, 'prova'],
        ['Desconto por quantidade testado nas faixas de 1, 2 e 3 unidades', true, 'prova'],
        ['Cupom de influenciadora testado — aplica e credita a quem tem que creditar', true],
        ['Cupom de recompra testado numa conta que já comprou antes', true],
        ['Frete grátis testado com e sem o valor mínimo, e com CEP de outra região', true, 'prova'],
      ]],
      ['Testar as combinações entre eles', [
        ['Campanha + frete grátis: soma como o combinado, não zera o pedido', true, 'prova'],
        ['Campanha + desconto por quantidade: o preço final é o que a oferta prometeu', true, 'prova'],
        ['Campanha + cupom de influenciadora: ou soma, ou o carrinho recusa com mensagem clara', true],
        ['Campanha + recompra: testado, e a decisão está escrita', true],
        ['Na pior soma possível, o pedido continua acima do custo — margem conferida', true, 'prova'],
        ['O que a campanha barra já foi desligado, não só anotado', true],
      ]],
      ['Brinde', [
        ['Brinde entra sozinho quando bate a regra, sem a pessoa ter que procurar', true],
        ['Limite testado: o carrinho não deixa levar mais brinde do que o combinado', true, 'prova'],
        ['Brinde sai do carrinho quando o pedido deixa de bater a regra', true],
        ['Quantidade de brinde que existe conferida contra o número prometido na comunicação', true, 'prova'],
      ]],
      ['Fechar uma compra de verdade', [
        ['Compra real no Pix, do carrinho até a confirmação, com o desconto na tela de pagamento', true, 'prova'],
        ['Compra real no cartão, do carrinho até a confirmação, com o parcelamento certo', true, 'prova'],
        ['Pedido de teste chegou no painel com valor, cupom e brinde certos', true, 'prova'],
        ['Pedido de teste cancelado ou marcado como teste', false],
      ]],
      ['Quando acabar', [
        ['Cupons e descontos da campanha desligados no dia seguinte ao fim', true],
        ['O que foi desligado por causa da campanha voltou a ligar', true],
      ]],
    ],

    'Site': [
      ['Home, inteira', [
        ['Banner principal aberto na loja de verdade e lido inteiro: número, prazo e condição batem com a oferta', true, 'prova'],
        ['Barra de aviso do topo com o texto desta campanha, sem sobra da campanha passada', true],
        ['Contador regressivo apontando para o fim certo', true],
        ['Home rolada até o rodapé procurando informação que briga com a campanha', true],
        ['Nenhum banner nem selo de campanha antiga ainda no ar', true],
      ]],
      ['Página de produto', [
        ['Preço com desconto aparecendo na página, e igual ao do carrinho', true, 'prova'],
        ['Selo e texto da campanha na página dizendo o mesmo que o banner', true],
        ['Produto que está fora da oferta não mostra selo de desconto', true],
        ['Order bump e sugestões apontando para produto que existe e tem estoque', true],
        ['Descrição, dosagem e tabela nutricional conferidas — nada mudou sem querer', true],
      ]],
      ['Carrinho e checkout', [
        ['Carrinho mostra o desconto separado, com nome que o cliente entende', true, 'prova'],
        ['Barra de frete grátis do carrinho com o valor certo desta campanha', true],
        ['Checkout aberto: valor final, frete e prazo iguais aos do carrinho', true, 'prova'],
        ['Formas de pagamento e parcelamento conferidos na própria tela do checkout', true],
      ]],
      ['O resto da loja', [
        ['Quiz, páginas de coleção e landing da campanha abertos e conferidos', true],
        ['Busca do site: procurar o produto da campanha e ver o que aparece', true],
        ['Menu e link da bio apontando para a página certa desta campanha', true, 'prova'],
      ]],
      ['Tudo outra vez, no celular', [
        ['Home no celular: nenhum texto cortado, nenhum botão fora da tela', true, 'prova'],
        ['Página de produto no celular: preço, selo e botão de compra visíveis sem rolar', true],
        ['Carrinho e checkout no celular, até a tela de pagamento', true, 'prova'],
        ['Testado num aparelho de verdade, não só no modo celular do navegador', true],
      ]],
    ],

    'Tráfego': [
      ['Antes de subir', [
        ['Campanha, conjunto e anúncio nomeados no padrão', true],
        ['Públicos e exclusões conferidos um a um no gerenciador', true],
        ['Orçamento diário e total conferidos contra o que o TAP previu', true, 'prova'],
        ['Datas de início e fim iguais às da campanha', true],
        ['Pixel e conversão testados com um evento de verdade antes de ligar', true, 'prova'],
      ]],
      ['Criativo e destino', [
        ['Cada anúncio aberto: abre a página certa, com a oferta certa', true, 'prova'],
        ['UTM completa em todos: source, medium, campaign e content', true],
        ['Formato certo para cada posicionamento, sem corte', true],
        ['Texto do anúncio não promete mais do que a oferta entrega', true],
      ]],
      ['Depois de ligar', [
        ['Primeiro gasto conferido na primeira hora — está gastando e entregando', true],
        ['Anúncio reprovado tratado no mesmo dia', true],
        ['Nenhum anúncio da campanha passada ainda rodando', true],
        ['Tudo desligado no dia seguinte ao fim da campanha', true],
      ]],
    ],

    'Criativo': [
      ['As peças', [
        ['Tudo que o briefing pediu está exportado, sem faltar peça', true],
        ['Cada peça na proporção do canal onde vai rodar', true],
        ['Todo número escrito na arte conferido contra a oferta: quantidade, limite, prazo e porcentagem', true, 'prova'],
        ['O produto que aparece na arte é o produto que está na oferta', true],
        ['Marca certa — Botanika ou VermeFree, sem trocar', true],
      ]],
      ['Antes de entregar', [
        ['Outra pessoa leu a arte inteira, palavra por palavra', true, 'revisao'],
        ['Visto no celular, em tamanho real, sem corte nas bordas', true, 'prova'],
        ['Versão editável salva junto do arquivo final', false],
      ]],
    ],

    'Copy': [
      ['A oferta', [
        ['A promessa do texto é a oferta real, sem prometer a mais', true],
        ['Número e limite escritos no texto batem com o que existe', true, 'prova'],
        ['Prazo escrito bate com o fim da campanha', true],
        ['Cupom escrito igual em todos os textos, letra por letra', true],
      ]],
      ['O que pode ser dito', [
        ['Nada dito sobre saúde além do que pode ser dito', true],
        ['Nome do produto e dosagem iguais ao rótulo', true],
      ]],
      ['Revisão', [
        ['Texto lido inteiro em voz alta antes de mandar', true],
        ['Outra pessoa revisou antes de subir', true, 'revisao'],
      ]],
    ],

    'Instagram': [
      ['Antes', [
        ['Calendário da campanha fechado: o que sai, em que dia e em que formato', true],
        ['Legenda, primeiro comentário e hashtags prontos de cada post', true],
        ['Capa do Reels e primeiro frame conferidos', true],
        ['Link da bio apontando para a página desta campanha', true, 'prova'],
      ]],
      ['Publicação', [
        ['Agendamento confirmado no dia e na hora do cronograma', true, 'prova'],
        ['Stories com figurinha de link testada, abrindo a página certa', true],
        ['Áudio liberado para conta comercial', false],
      ]],
      ['Depois', [
        ['Print do publicado salvo', false],
        ['Comentários e direct respondidos nas primeiras horas', true],
      ]],
    ],

    'E-mail': [
      ['Antes do disparo', [
        ['Segmento e exclusões conferidos, com o número de contatos na tela', true, 'prova'],
        ['Assunto e pré-cabeçalho sem corte no celular', true],
        ['Teste enviado e aberto no Gmail e no celular', true, 'prova'],
        ['Todos os links clicados no teste, um por um', true],
        ['Remetente, endereço de resposta e descadastro funcionando', true],
      ]],
      ['Disparo', [
        ['Horário do disparo conferido contra o cronograma', true],
        ['Nenhum outro disparo grande no mesmo horário', true],
      ]],
      ['Depois', [
        ['Entrega e retorno olhados uma hora depois do disparo', true],
        ['Erro de envio e reclamação de spam conferidos', true],
      ]],
    ],

    'Grupos': [
      ['Antes', [
        ['Mensagem testada em um grupo só antes do disparo geral', true, 'prova'],
        ['Link e cupom testados dentro da própria mensagem', true],
        ['Lista de grupos e horário conferidos contra o cronograma', true],
        ['Não é a mesma mensagem de ontem', true],
      ]],
      ['Durante e depois', [
        ['Primeiros dez minutos acompanhados: está entregando, não está caindo', true],
        ['Respostas nos grupos atendidas no mesmo dia', true],
      ]],
    ],

    'Influencer': [
      ['Antes', [
        ['Briefing enviado e confirmado pelo creator', true],
        ['Cupom e link exclusivos criados e testados numa compra', true, 'prova'],
        ['Data de publicação combinada e dentro do cronograma', true],
      ]],
      ['Na publicação', [
        ['Entregável aprovado antes de publicar', true, 'revisao'],
        ['Publicado conferido no ar, com o cupom certo escrito', true, 'prova'],
        ['Print do publicado salvo', false],
      ]],
      ['Depois', [
        ['Vendas do cupom conferidas e comissão registrada', true],
      ]],
    ],

    'Atendimento': [
      ['Antes de a campanha começar', [
        ['Respostas prontas da campanha carregadas e testadas', true],
        ['Equipe avisada da oferta, do cupom e do que soma com o quê', true, 'prova'],
        ['Regra do brinde explicada: quem tem direito e a quantos', true],
        ['Escala coberta no horário de pico do dia da campanha', true],
      ]],
      ['Durante', [
        ['Dúvida que apareceu mais de duas vezes virou resposta pronta', true],
        ['Reclamação sobre a oferta escalada na hora, não no fim do dia', true],
      ]],
    ],

    'Geral': [],
  };

  /* ---------- de que área é esta tarefa ----------
     O ClickUp não manda área. Manda canal às vezes, e sempre manda um
     título — e o título de quem trabalha diz a área na primeira palavra:
     "Subir criativo", "Disparo do e-mail", "Post do feed". */
  const PISTAS = [
    ['Tráfego',     /tr[áa]fego|an[úu]ncio|ads?\b|meta ads|google|campanha paga|gerenciador|roas|cpa\b/i],
    ['E-mail',      /e-?mail|newsletter|disparo|activecampaign|fluxo de e-?mail|r[ée]gua/i],
    ['Grupos',      /grupo|whats|zap|sendflow|lista de transmiss/i],
    ['Instagram',   /instagram|insta\b|reels?|stories|feed|post\b|social|tiktok/i],
    ['Influencer',  /influen|creator|ugc|permut/i],
    ['Oferta',      /desconto|cupom|oferta|promo[çc][ãa]o|pre[çc]o|frete gr[áa]tis|brinde|combo|kit\b/i],
    ['Site',        /site|shopify|p[áa]gina|landing|pdp|checkout|banner do site|cole[çc][ãa]o|tema/i],
    ['Criativo',    /criativ|arte|design|v[íi]deo|edi[çc][ãa]o|thumb|capa|export/i],
    ['Copy',        /copy|texto|roteiro|legenda|headline|redac|reda[çc]/i],
    ['Atendimento', /atendimento|suporte|sac\b|resposta pronta|objec/i],
    ['API',         /\bapi\b|automa[çc][ãa]o|integra[çc][ãa]o|n8n|webhook/i],
  ];

  function areaDe(t) {
    const canal = String(t?.canal || '');
    for (const [a, re] of PISTAS) if (re.test(canal)) return a;
    const texto = `${t?.title || ''} ${t?.project || ''} ${t?.description || ''}`;
    for (const [a, re] of PISTAS) if (re.test(texto)) return a;
    return 'Geral';
  }

  const AREAS = Object.keys(PADRAO);

  /* ---------- o que está guardado ----------
     Um objeto só, numa chave que começa com "central." — logo a ponte com
     o Supabase leva e traz sozinha, e a conferência que o Ítalo fez
     aparece na tela do Vitor. */
  function estado() {
    try {
      const e = JSON.parse(localStorage.getItem(chaveConf()) || '{}');
      if (!e.padroes) e.padroes = {};
      if (!e.escopos) e.escopos = {};
      if (!e.roteiros) e.roteiros = {};
      if (!e.donos) e.donos = {};
      return e;
    } catch { return { padroes: {}, escopos: {}, roteiros: {}, donos: {} } }
  }

  function gravar(e) {
    try { localStorage.setItem(chaveConf(), JSON.stringify(e)) } catch {}
  }

  /* o padrão de uma área: o que a pessoa editou, ou o de fábrica */
  function padraoDe(area) {
    const e = estado();
    if (Array.isArray(e.padroes[area]) && e.padroes[area].length) return e.padroes[area];
    return [...GERAIS, ...(PADRAO[area] || [])]
      .map(([texto, obrigatorio, marca]) => ({
        id: id('p'), texto, obrigatorio,
        prova: /prova/.test(marca || ''), revisao: /revisao/.test(marca || ''),
      }));
  }

  /* O erro que escapou vira linha do padrão da área. É o único jeito de a
     lista melhorar: a tarefa recorrente que o Vitor mandou na foto lista
     quatro erros do mesmo tipo, em datas diferentes, porque nenhum deles
     virou item de conferência depois de acontecer. */
  function registrarErro(area, texto) {
    const limpo = String(texto || '').trim().slice(0, 200);
    if (!limpo) return null;
    const itens = padraoDe(area);
    const jaTem = itens.some((i) => limpa(i.texto) === limpa(limpo));
    if (!jaTem) {
      itens.push({ id: id('p'), texto: limpo, obrigatorio: true, prova: false, revisao: false, deErro: agora() });
      gravarPadrao(area, itens);
    }
    return { area, texto: limpo, novo: !jaTem };
  }

  function gravarPadrao(area, itens) {
    const e = estado();
    e.padroes[area] = itens;
    gravar(e);
  }

  const escopoTarefa   = (t) => `tarefa:${t.id}`;
  const escopoCampanha = (c) => `campanha:${c.brand || ''}|${c.name}`;

  const conferencia = (chave) => estado().escopos[chave] || null;

  /* O par chave|item que vai no atributo. A chave tem "|" dentro dela —
     marca, campanha e área — então quem lê separa pelo último, não pelo
     primeiro. Ler pelo primeiro fazia a marcação não gravar, e a lista
     voltava desmarcada logo depois de ser marcada. */
  const par = (chave, item) => `${chave}|${item}`;
  const lerPar = (v) => {
    const t = String(v || '');
    const n = t.lastIndexOf('|');
    return n < 0 ? { chave: t, item: '' } : { chave: t.slice(0, n), item: t.slice(n + 1) };
  };

  function gravarConferencia(chave, conf) {
    const e = estado();
    e.escopos[chave] = conf;
    gravar(e);
  }


  /* ---------- o roteiro: escopo, dono e padrão ----------
     Um roteiro por área por campanha. A chave carrega marca, campanha e
     área, então dois roteiros de campanhas diferentes nunca se misturam,
     e a ponte com o Supabase leva os dois do mesmo jeito. */
  const escopoRoteiro = (c, area) => `roteiro:${c.brand || ''}|${c.name}|${area}`;

  const partesRoteiro = (chave) => {
    const [, resto] = String(chave).split('roteiro:');
    const p = String(resto || '').split('|');
    return { marca: p[0] || '', campanha: p[1] || '', area: p[2] || '' };
  };

  function campanhaDaChave(chave) {
    const { marca, campanha } = partesRoteiro(chave);
    return lerLista(chaveCamp()).find((c) =>
      c.name === campanha && (c.brand || '') === marca) || null;
  }

  /* o protocolo da área: o que a operação editou, ou o de fábrica */
  function roteiroPadrao(area) {
    const e = estado();
    const guardado = e.roteiros[area];
    if (Array.isArray(guardado) && guardado.length) return guardado;
    return (ROTEIROS[area] || []).map(([etapa, itens]) => ({
      etapa,
      itens: itens.map(([texto, obrigatorio, marca]) => ({
        texto, obrigatorio: !!obrigatorio,
        prova: /prova/.test(marca || ''), revisao: /revisao/.test(marca || ''),
      })),
    }));
  }

  function gravarRoteiroPadrao(area, etapas) {
    const e = estado();
    e.roteiros[area] = etapas;
    gravar(e);
  }

  const temRoteiro = (area) => roteiroPadrao(area).some((et) => et.itens.length);

  function porRegrasRoteiro(area) {
    const fora = [];
    for (const et of roteiroPadrao(area))
      for (const i of et.itens)
        fora.push({ id: id('r'), etapa: et.etapa, texto: i.texto,
          obrigatorio: !!i.obrigatorio, prova: !!i.prova, revisao: !!i.revisao, feito: false });
    return fora;
  }

  /* O roteiro nasce sozinho, como a lista da tarefa: na primeira vez que
     alguém abre a campanha ou tenta fechar a tarefa principal da área. */
  function garantirRoteiro(c, area) {
    const chave = escopoRoteiro(c, area);
    const jaTem = conferencia(chave);
    if (jaTem) return jaTem;
    if (!temRoteiro(area)) return null;
    const conf = { itens: porRegrasRoteiro(area), area, roteiro: true,
                   geradoEm: agora(), geradoPor: 'regras', versao: 1, automatica: true };
    gravarConferencia(chave, conf);
    return conf;
  }

  /* De quem é o roteiro. Sai de quem tem mais tarefa daquela área nesta
     campanha — e pode ser trocado à mão, que é o que manda. */
  function donoRoteiro(c, area) {
    const e = estado();
    const escolhido = e.donos[escopoRoteiro(c, area)];
    if (escolhido) return escolhido;
    const conta = new Map();
    for (const t of tarefasDa(c)) {
      if (areaDe(t) !== area) continue;
      for (const a of (t.assignees || [])) conta.set(a, (conta.get(a) || 0) + 1);
    }
    let dono = '', n = 0;
    for (const [a, q] of conta) if (q > n) { dono = a; n = q }
    return dono;
  }

  function gravarDono(c, area, quem) {
    const e = estado();
    const chave = escopoRoteiro(c, area);
    if (quem) e.donos[chave] = quem; else delete e.donos[chave];
    gravar(e);
  }

  /* Quem pode ser dono: o cadastro de acessos quando existe, senão quem
     já está com tarefa nesta campanha. */
  function gentePossivel(c) {
    const nomes = [];
    try {
      const A = window.Acessos;
      if (A) for (const p of (A.equipe() || [])) {
        if (p.nomeClickup) nomes.push(p.nomeClickup);
        else if (p.nome) nomes.push(p.nome);
      }
    } catch { /* sem cadastro, vale quem está nas tarefas */ }
    for (const t of tarefasDa(c)) for (const a of (t.assignees || [])) nomes.push(a);
    return [...new Set(nomes.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  /* As áreas que esta campanha tem de verdade.

     Isto já foi errado: eu forçava oferta e site em toda campanha, "porque
     toda campanha mexe na loja". O efeito foi o roteiro do site — home,
     PDP, carrinho, checkout, celular — aparecer em campanha que não
     encosta no site, e em tarefa que não é de site. O protocolo do site é
     para quando se mexe no site.

     Então a regra passa a ser: a área entra quando existe trabalho dela
     nesta campanha. Quem quiser um roteiro que ninguém abriu tarefa
     acrescenta à mão, no botão do resumo da campanha. */
  function areasDa(c) {
    const vistas = new Set();
    for (const t of tarefasDa(c)) { const a = areaDe(t); if (a !== 'Geral') vistas.add(a) }
    for (const a of AREAS) if (conferencia(escopoRoteiro(c, a))) vistas.add(a);
    return [...vistas].filter(temRoteiro).sort((a, b) => AREAS.indexOf(a) - AREAS.indexOf(b));
  }

  /* as que ainda não estão na campanha e podem ser chamadas à mão */
  const areasDeFora = (c) => AREAS.filter((a) => temRoteiro(a) && !areasDa(c).includes(a));

  /* A tarefa principal daquela área naquela campanha: a que tem
     subtarefas penduradas; sem nenhuma assim, a de prazo mais longe. É
     ela que o roteiro tranca — as subtarefas seguem com a lista curta. */
  function tarefaPrincipal(c, area) {
    const dela = tarefasDa(c).filter((t) => areaDe(t) === area);
    if (!dela.length) return null;
    const comFilhas = dela.filter((t) => (t.subtasks || []).length);
    const pool = comFilhas.length ? comFilhas : dela;
    return pool.slice().sort((a, b) =>
      String(b.due || '').localeCompare(String(a.due || '')))[0] || null;
  }

  const ehPrincipal = (t) => {
    const c = campanhaDaTarefa(t);
    if (!c) return null;
    const area = areaDe(t);
    const p = tarefaPrincipal(c, area);
    return p && String(p.id) === String(t.id) ? { campanha: c, area } : null;
  };

  /* Tudo que segura esta tarefa: a lista dela e, se ela for a principal
     da área, o roteiro da campanha inteiro. */
  function travas(t) {
    const fora = [];
    const daTarefa = pendentes(escopoTarefa(t), t);
    if (daTarefa.length) fora.push({ tipo: 'tarefa', falta: daTarefa.length });
    const p = ehPrincipal(t);
    if (p) {
      garantirRoteiro(p.campanha, p.area);
      const chave = escopoRoteiro(p.campanha, p.area);
      const c = conferencia(chave);
      const falta = (c?.itens || []).filter((i) => i.obrigatorio && !i.feito).length;
      if (falta) fora.push({ tipo: 'roteiro', falta, area: p.area, chave });
    }
    return fora;
  }

  const faltamTotal = (t) => travas(t).reduce((n, x) => n + x.falta, 0);

  /* O erro que passou vira linha do roteiro, na etapa do que já escapou.
     É o mesmo aprendizado do padrão da área, mas no nível onde o erro de
     verdade mora: o banner que foi ao ar dizendo mil quando eram cem não
     era uma subtarefa mal feita — era o roteiro do site que ninguém
     tinha. */
  function registrarErroRoteiro(area, texto) {
    const limpo = String(texto || '').trim().slice(0, 200);
    if (!limpo) return null;
    const etapas = roteiroPadrao(area).map((et) => ({ etapa: et.etapa, itens: et.itens.slice() }));
    const jaTem = etapas.some((et) => et.itens.some((i) => limpa(i.texto) === limpa(limpo)));
    if (jaTem) return { novo: false, area };
    const NOME = 'Erros que já passaram por aqui';
    let alvo = etapas.find((et) => et.etapa === NOME);
    if (!alvo) { alvo = { etapa: NOME, itens: [] }; etapas.push(alvo) }
    alvo.itens.push({ texto: limpo, obrigatorio: true, prova: true, revisao: false });
    gravarRoteiroPadrao(area, etapas);
    return { novo: true, area };
  }

  /* ---------- a tranca ----------
     Isto aqui já foi frouxo: sem lista, não travava. A ideia era não
     parar a operação no dia em que o sistema subiu. O efeito foi que
     ninguém gerou lista nenhuma, e nada nunca travou — os erros que a
     conferência existia para pegar continuaram passando.

     Agora a lista nasce sozinha, do padrão da área, na primeira vez que
     alguém tenta fechar a tarefa. Não existe entrega sem lista: existe
     lista em branco, e ela tranca. */
  function garantirLista(chave, tarefa) {
    const jaTem = conferencia(chave);
    if (jaTem) return jaTem;
    if (!tarefa) return null;
    const area = areaDe(tarefa);
    const conf = {
      itens: porRegras(area, []), area, geradoEm: agora(),
      geradoPor: 'regras', versao: 1, automatica: true,
    };
    gravarConferencia(chave, conf);
    return conf;
  }

  function pendentes(chave, tarefa) {
    let c = conferencia(chave);
    if (!c && tarefa) c = garantirLista(chave, tarefa);
    if (!c || !Array.isArray(c.itens) || !c.itens.length) return [];
    return c.itens.filter((i) => i.obrigatorio && !i.feito);
  }

  const liberado = (chave) => pendentes(chave).length === 0;

  /* O que foi entregue sem passar por aqui. Uma tarefa fechada no ClickUp
     chega na Central já como "feito", e a tranca daqui nunca a viu. Não
     dá para desfazer isso, mas dá para não deixar passar em silêncio: a
     daily mostra a lista todo dia, com nome. */
  function semConferencia(tarefas) {
    return (tarefas || []).filter((t) => {
      if (t.status !== 'feito') return false;
      const c = conferencia(escopoTarefa(t));
      if (!c || !Array.isArray(c.itens) || !c.itens.length) return true;
      return c.itens.some((i) => i.obrigatorio && !i.feito);
    });
  }

  /* ---------- escrever a lista ----------
     Primeiro as regras, que respondem na hora. A IA, quando existe,
     reescreve por cima com o que ela entendeu do contexto — e se ela não
     responder, o que já está na tela continua valendo. */
  function porRegras(area, extras) {
    const base = padraoDe(area).map((p) => ({
      id: id('i'), texto: p.texto, obrigatorio: !!p.obrigatorio,
      prova: !!p.prova, revisao: !!p.revisao, feito: false,
    }));
    for (const [texto, obrigatorio, marca] of (extras || []))
      base.push({ id: id('i'), texto, obrigatorio: !!obrigatorio,
        prova: /prova/.test(marca || ''), revisao: /revisao/.test(marca || ''), feito: false });
    return base;
  }

  /* itens que só existem por causa do contexto daquela tarefa */
  function extrasDaTarefa(t) {
    const e = [];
    const c = campanhaDaTarefa(t);
    if (c) {
      if (c.offer)  e.push([`Cupom "${String(c.offer).slice(0, 60)}" testado e válido no período`, true]);
      if (c.end)    e.push([`Nada continua no ar depois de ${dBR(c.end)}, o fim da campanha`, true]);
      const prods = (c.products || []).map((p) => p.name).filter(Boolean);
      if (prods.length) e.push([`Produtos da oferta conferidos: ${prods.slice(0, 3).join(', ')}`, true]);
    }
    if (t.due) e.push([`Entregue até ${dBR(t.due)}, o prazo da tarefa`, false]);
    return e;
  }

  const dISO = (s) => { const [a, m, d] = String(s || '').split('-').map(Number); return new Date(a, (m || 1) - 1, d || 1) };
  const dBR  = (s) => { const d = dISO(s); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}` };

  const limpa = (t) => String(t || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();

  /* mesma ligação que as abas de campanha usam: o campo Projeto */
  function campanhaDaTarefa(t) {
    const p = limpa(t.project);
    if (!p || p === 'sem projeto') return null;
    return lerLista(chaveCamp()).find((c) => {
      if (c.brand && t.brand && c.brand !== t.brand) return false;
      const n = limpa(c.name);
      return n === p || n.startsWith(p + ' ') || p.startsWith(n + ' ') ||
             (n.startsWith(p) && p.length >= 5);
    }) || null;
  }

  function tarefasDa(c) {
    const n = limpa(c.name);
    return lerLista(chaveTar()).filter((t) => {
      if (c.brand && t.brand && t.brand !== c.brand) return false;
      const p = limpa(t.project);
      if (!p || p === 'sem projeto') return false;
      return n === p || n.startsWith(p + ' ') || p.startsWith(n + ' ') ||
             (n.startsWith(p) && p.length >= 5);
    });
  }

  /* ---------- a IA ----------
     A chave da Anthropic não pode morar aqui: este arquivo vai inteiro
     para o navegador de quem abrir o link, e o repositório é público. Ela
     mora na Vercel, como variável de ambiente, e quem fala com a Anthropic
     é a função em /api/conferencia. Daqui só sai o contexto.

     Se não houver função publicada — ou se a chave não estiver lá — a
     resposta não vem, e as regras continuam valendo. Por isso o pedido
     tem prazo: quinze segundos e desiste. */
  async function porIA(payload) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    try {
      const r = await fetch('/api/conferencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      const itens = (j.itens || [])
        .filter((i) => i && String(i.texto || '').trim())
        .map((i) => ({
          id: id('i'),
          texto: String(i.texto).trim().slice(0, 200),
          obrigatorio: i.obrigatorio !== false,
          feito: false,
        }));
      if (!itens.length) throw new Error('lista vazia');
      return itens;
    } finally { clearTimeout(t) }
  }

  /* Gera e guarda. `ia` diz se pode tentar a IA; o que já estava marcado
     é reaproveitado pelo texto, para regenerar não apagar o trabalho de
     quem já conferiu metade. */
  /* Enquanto não houver chave da Anthropic na Vercel, a função responde 503
     e a lista sai pelas regras. Na primeira vez que isso acontece o botão
     "com IA" some: ele prometia uma coisa e entregava outra. Basta recarregar
     a página depois de ligar a chave para ele voltar. */
  let iaFora = false;

  async function gerar(chave, contexto, ia) {
    const antes = conferencia(chave);
    const marcados = new Map((antes?.itens || []).filter((i) => i.feito)
      .map((i) => [limpa(i.texto), i]));

    let itens = contexto.base ? contexto.base() : porRegras(contexto.area, contexto.extras);
    let por = 'regras';

    if (ia) {
      try { itens = await porIA(contexto.payload); por = 'ia' }
      catch (e) { iaFora = true; console.info('[conferência] IA indisponível, seguindo pelas regras:', e.message) }
    }

    for (const i of itens) {
      const v = marcados.get(limpa(i.texto));
      if (v) { i.feito = true; i.por = v.por; i.em = v.em }
    }

    const conf = {
      itens, area: contexto.area, geradoEm: agora(), geradoPor: por,
      versao: (antes?.versao || 0) + 1,
    };
    gravarConferencia(chave, conf);
    return conf;
  }

  /* ====================================================================
     A tela
     ==================================================================== */

  function barra(chave) {
    const c = conferencia(chave);
    if (!c) return { feitos: 0, total: 0, obrig: 0, faltam: 0 };
    const obrig = c.itens.filter((i) => i.obrigatorio);
    return {
      feitos: c.itens.filter((i) => i.feito).length,
      total: c.itens.length,
      obrig: obrig.length,
      faltam: obrig.filter((i) => !i.feito).length,
    };
  }

  /* Aberta quando ainda falta conferir — que é quando ela precisa ser
     lida — e fechada quando já passou, para não empurrar o briefing e as
     subtarefas para o fim da ficha. A pessoa pode abrir e fechar, e a
     escolha dela vale enquanto a tela estiver de pé. */
  const dobra = new Map();
  const aberta = (chave, falta) => dobra.has(chave) ? dobra.get(chave) : falta > 0;

  function listaHtml(chave, contexto) {
    const c = conferencia(chave);
    const b = barra(chave);
    const pct = b.total ? Math.round((b.feitos / b.total) * 100) : 0;
    const ok = b.total > 0 && b.faltam === 0;

    const abrir = aberta(chave, b.faltam);

    const cabeca = `
      <div class="cf-topo">
        ${c ? `<button type="button" class="cf-dobra ${abrir ? 'aberta' : ''}" data-cf-dobra="${esc(chave)}"
          aria-expanded="${abrir}" title="${abrir ? 'Ocultar a lista' : 'Mostrar a lista'}">›</button>` : ''}
        <div class="cf-titulo">
          <strong>Conferência</strong>
          <span>${c ? `${b.feitos} de ${b.total} conferidos${b.faltam ? ` · faltam ${b.faltam} obrigatórios` : ''}` : 'ainda não há lista para esta entrega'}</span>
        </div>
        <div class="cf-acoes">
          ${iaFora ? '' : `<button type="button" class="cf-bt" data-cf-gerar="${esc(chave)}" data-cf-ia="1">${c ? 'Refazer com IA' : 'Gerar com IA'}</button>`}
          <button type="button" class="cf-bt" data-cf-gerar="${esc(chave)}">${c ? 'Refazer pelo padrão' : 'Usar o padrão'}</button>
          ${contexto.area ? `<button type="button" class="cf-bt cf-bt-fraco" data-cf-area="${esc(contexto.area)}">Padrão de ${esc(contexto.area)}</button>` : ''}
          ${contexto.area ? `<button type="button" class="cf-bt cf-bt-fraco" data-cf-erro="${esc(contexto.area)}" title="o que passou hoje vira item obrigatório de amanhã">Passou um erro</button>` : ''}
        </div>
      </div>`;

    if (!c) return `<div class="cf">${cabeca}
      <p class="cf-vazio">A lista nasce sozinha, pelo padrão da área, na primeira vez que
      alguém abrir ou tentar fechar esta entrega. Nada se entrega sem conferir.</p></div>`;

    const selo = ok
      ? '<span class="cf-selo cf-ok">Liberado para entrega</span>'
      : `<span class="cf-selo cf-trava">Travado — ${b.faltam} item${b.faltam > 1 ? 's' : ''} obrigatório${b.faltam > 1 ? 's' : ''} em aberto</span>`;

    return `<div class="cf ${ok ? 'cf-liberado' : 'cf-travado'}">
      ${cabeca}
      <div class="cf-medidor"><i style="width:${pct}%"></i></div>
      ${selo}
      <div class="cf-corpo" ${abrir ? '' : 'hidden'}>
      <div class="cf-itens">
        ${c.itens.map((i) => `
          <label class="cf-item ${i.feito ? 'feito' : ''} ${i.obrigatorio ? 'obrig' : ''}">
            <input type="checkbox" data-cf-item="${esc(chave)}|${esc(i.id)}" ${i.feito ? 'checked' : ''}>
            <span class="cf-texto">${esc(i.texto)}</span>
            ${i.obrigatorio ? '<span class="cf-tag">obrigatório</span>' : ''}
            ${i.revisao ? '<span class="cf-tag cf-tag-revisao" title="quem fez a tarefa não pode marcar">outra pessoa</span>' : ''}
            ${i.prova ? '<span class="cf-tag cf-tag-prova" title="pede link, print ou o que foi testado">com prova</span>' : ''}
            ${i.feito && i.por ? `<span class="cf-quem">${esc(i.por)}${i.em ? ' · ' + dBRiso(i.em) : ''}</span>` : ''}
            <button type="button" class="cf-x" data-cf-tirar="${esc(chave)}|${esc(i.id)}" title="Tirar este item">×</button>
            ${i.feito && i.provaTexto ? `<span class="cf-prova">${esc(i.provaTexto)}</span>` : ''}
          </label>`).join('')}
      </div>
      <div class="cf-linha-add">
        <input type="text" data-cf-novo="${esc(chave)}" placeholder="Acrescentar item de conferência">
        <button type="button" class="cf-bt" data-cf-add="${esc(chave)}">Acrescentar</button>
      </div>
      <small class="cf-rodape">Lista ${c.geradoPor === 'ia' ? 'escrita pela IA' : 'montada pelo padrão da área'}
        em ${dBRiso(c.geradoEm)}${c.area ? ` · área ${esc(c.area)}` : ''}</small>
      </div>
    </div>`;
  }

  const dBRiso = (s) => {
    const d = new Date(s);
    return isNaN(d) ? '' : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  };


  /* ---------- a tela do roteiro ----------
     Um bloco por área da campanha, com dono, com as etapas na ordem de
     fazer. É longo de propósito: o que ele cobre é longo. Fica fechado
     quando já passou e aberto enquanto falta. */
  function roteiroHtml(c, area, comContexto) {
    const chave = escopoRoteiro(c, area);
    garantirRoteiro(c, area);
    const conf = conferencia(chave);
    if (!conf) return '';

    const b = barra(chave);
    const pct = b.total ? Math.round((b.feitos / b.total) * 100) : 0;
    const ok = b.total > 0 && b.faltam === 0;
    /* No resumo da campanha eles nascem fechados: são muitos, e cada um é
       longo. Desenhar dez roteiros abertos a cada mudança de tela deixava
       a Central pesada à toa. Na ficha da tarefa que ele tranca, abre. */
    const abrir = abertoRot(chave, b.faltam, comContexto);
    const dono = donoRoteiro(c, area);
    const gente = gentePossivel(c);
    const principal = tarefaPrincipal(c, area);

    const etapas = [];
    if (abrir) for (const i of conf.itens) {
      const nomeEtapa = i.etapa || 'Conferência';
      let et = etapas.find((x) => x.etapa === nomeEtapa);
      if (!et) { et = { etapa: nomeEtapa, itens: [] }; etapas.push(et) }
      et.itens.push(i);
    }

    const item = (i) => `
      <label class="cf-item ${i.feito ? 'feito' : ''} ${i.obrigatorio ? 'obrig' : ''}">
        <input type="checkbox" data-cf-item="${esc(chave)}|${esc(i.id)}" ${i.feito ? 'checked' : ''}>
        <span class="cf-texto">${esc(i.texto)}</span>
        ${i.obrigatorio ? '<span class="cf-tag">obrigatório</span>' : ''}
        ${i.revisao ? '<span class="cf-tag cf-tag-revisao" title="quem fez não pode marcar">outra pessoa</span>' : ''}
        ${i.prova ? '<span class="cf-tag cf-tag-prova" title="pede link, print ou o que foi testado">com prova</span>' : ''}
        ${i.feito && i.por ? `<span class="cf-quem">${esc(i.por)}${i.em ? ' · ' + dBRiso(i.em) : ''}</span>` : ''}
        <button type="button" class="cf-x" data-cf-tirar="${esc(chave)}|${esc(i.id)}" title="Tirar este item">×</button>
        ${i.feito && i.provaTexto ? `<span class="cf-prova">${esc(i.provaTexto)}</span>` : ''}
      </label>`;

    return `<div class="cf cf-rot ${ok ? 'cf-liberado' : 'cf-travado'}">
      <div class="cf-topo">
        <button type="button" class="cf-dobra ${abrir ? 'aberta' : ''}" data-cf-dobra="${esc(chave)}"
          aria-expanded="${abrir}" title="${abrir ? 'Ocultar o roteiro' : 'Mostrar o roteiro'}">›</button>
        <div class="cf-titulo">
          <strong>Roteiro de ${esc(area)}</strong>
          <span>${b.feitos} de ${b.total} conferidos${b.faltam ? ` · faltam ${b.faltam} obrigatórios` : ''}${
            comContexto ? '' : principal ? ` · tranca "${esc(principal.title)}"` : ' · sem tarefa principal ainda'}</span>
        </div>
        <div class="cf-acoes">
          <label class="cf-dono">
            <span>Quem confere</span>
            <select data-cf-dono="${esc(chave)}">
              <option value="">— escolher —</option>
              ${gente.map((g) => `<option value="${esc(g)}" ${g === dono ? 'selected' : ''}>${esc(g)}</option>`).join('')}
              ${dono && !gente.includes(dono) ? `<option value="${esc(dono)}" selected>${esc(dono)}</option>` : ''}
            </select>
          </label>
          <button type="button" class="cf-bt" data-cf-rot-gerar="${esc(chave)}">Refazer pelo protocolo</button>
          <button type="button" class="cf-bt cf-bt-fraco" data-cf-erro-rot="${esc(chave)}"
            title="o que passou hoje vira etapa obrigatória do roteiro">Passou um erro</button>
        </div>
      </div>
      <div class="cf-medidor"><i style="width:${pct}%"></i></div>
      ${ok
        ? '<span class="cf-selo cf-ok">Roteiro fechado — a área pode entregar</span>'
        : `<span class="cf-selo cf-trava">Travado — ${b.faltam} item${b.faltam > 1 ? 's' : ''} obrigatório${b.faltam > 1 ? 's' : ''} em aberto</span>`}
      <div class="cf-corpo" ${abrir ? '' : 'hidden'}>
        ${etapas.map((et, n) => {
          const f = et.itens.filter((i) => i.feito).length;
          return `<div class="cf-etapa ${f === et.itens.length ? 'cf-etapa-ok' : ''}">
            <div class="cf-etapa-rot"><b>${n + 1}</b>${esc(et.etapa)}<i>${f}/${et.itens.length}</i></div>
            <div class="cf-itens">${et.itens.map(item).join('')}</div>
          </div>`;
        }).join('')}
        <div class="cf-linha-add">
          <input type="text" data-cf-novo="${esc(chave)}" placeholder="Acrescentar item ao roteiro desta campanha">
          <button type="button" class="cf-bt" data-cf-add="${esc(chave)}">Acrescentar</button>
        </div>
        <small class="cf-rodape">Protocolo de ${esc(area)}${dono ? ` · conferindo: ${esc(dono)}` : ' · ainda sem dono'} ·
          o mesmo em toda campanha — o que muda é a comunicação</small>
      </div>
    </div>`;
  }

  /* Refazer não pode apagar o que já foi conferido: o que bate pelo
     texto volta marcado, com quem marcou e a prova. */
  function refazerRoteiro(chave) {
    const { area } = partesRoteiro(chave);
    const antes = conferencia(chave);
    const marcados = new Map((antes?.itens || []).filter((i) => i.feito).map((i) => [limpa(i.texto), i]));
    const itens = porRegrasRoteiro(area);
    for (const i of itens) {
      const v = marcados.get(limpa(i.texto));
      if (v) { i.feito = true; i.por = v.por; i.em = v.em; if (v.provaTexto) i.provaTexto = v.provaTexto }
    }
    gravarConferencia(chave, { itens, area, roteiro: true, geradoEm: agora(),
      geradoPor: 'regras', versao: (antes?.versao || 0) + 1 });
    return itens;
  }

  /* No resumo, fechado por padrão; na ficha, aberto enquanto falta. A
     escolha de quem clicou vale sobre as duas. */
  const abertoRot = (chave, falta, noResumo) =>
    dobra.has(chave) ? dobra.get(chave) : (!noResumo && falta > 0);

  /* assinatura do bloco de roteiros: muda quando algo neles muda */
  function assinaturaRoteiros(c) {
    return areasDa(c).map((a) => {
      const chave = escopoRoteiro(c, a);
      const b = barra(chave);
      return `${a}:${b.feitos}/${b.total}:${donoRoteiro(c, a)}:${abertoRot(chave, b.faltam, true)}`;
    }).join(';') + '|' + areasDeFora(c).length;
  }

  function roteirosHtml(c) {
    const areas = areasDa(c);
    const fora = areasDeFora(c);
    const chamar = fora.length ? `<div class="cf-rot-chamar">
      <span>Esta campanha também mexe em:</span>
      ${fora.map((a) => `<button type="button" class="cf-bt cf-bt-fraco" data-cf-rot-novo="${esc(escopoRoteiro(c, a))}">+ ${esc(a)}</button>`).join('')}
    </div>` : '';
    if (!areas.length) return chamar ? `<div class="cf-rots">
      <div class="cf-tarefas-rot">Roteiro por área</div>
      <p class="cf-vazio">Nenhuma área com tarefa nesta campanha ainda. O roteiro aparece quando
      existir trabalho da área aqui — ou quando alguém chamar um abaixo.</p>${chamar}</div>` : '';
    const fechados = areas.filter((a) => { const b = barra(escopoRoteiro(c, a)); return b.total > 0 && b.faltam === 0 }).length;
    return `<div class="cf-rots">
      <div class="cf-tarefas-rot">Roteiro de cada área nesta campanha — ${fechados} de ${areas.length} fechados</div>
      ${areas.map((a) => roteiroHtml(c, a, true)).join('')}
      ${chamar}
    </div>`;
  }

  /* ---------- a ficha da tarefa ---------- */

  let tarefaAberta = null;

  const tarefaPorId = (i) => lerLista(chaveTar()).find((t) => String(t.id) === String(i)) || null;

  function tarefaDaFicha() {
    const dr = document.getElementById('taskDetailDrawer');
    if (!dr || !dr.classList.contains('open')) return null;
    if (tarefaAberta) { const t = tarefaPorId(tarefaAberta); if (t) return t }
    /* o cabeçalho termina com os últimos sete dígitos do id */
    const k = document.getElementById('taskDetailKicker')?.textContent || '';
    const m = k.match(/#(\S+)\s*$/);
    if (m) { const t = lerLista(chaveTar()).find((x) => String(x.id).slice(-7) === m[1]); if (t) return t }
    const titulo = document.getElementById('taskTitleInput')?.value?.trim();
    return titulo ? lerLista(chaveTar()).find((t) => t.title === titulo) || null : null;
  }

  function contextoTarefa(t) {
    const area = areaDe(t);
    const c = campanhaDaTarefa(t);
    return {
      area,
      extras: extrasDaTarefa(t),
      payload: {
        tipo: 'tarefa',
        area,
        marca: t.brand || '',
        tarefa: {
          titulo: t.title, descricao: t.description || '', projeto: t.project || '',
          canal: t.canal || '', prazo: t.due || '', prioridade: t.priority || '',
          subtarefas: (t.subtasks || []).map((s) => s.title),
        },
        campanha: c ? {
          nome: c.name, tipo: c.type || '', oferta: c.offer || '',
          objetivo: c.objective || '', inicio: c.start || '', fim: c.end || '',
          canais: c.channels || [],
          produtos: (c.products || []).map((p) => p.name).filter(Boolean),
        } : null,
        padrao: padraoDe(area).map((p) => p.texto),
      },
    };
  }

  function porFicha() {
    const dr = document.getElementById('taskDetailDrawer');
    if (!dr || !dr.classList.contains('open')) return;
    const main = dr.querySelector('.tdetail-main');
    if (!main) return;
    const t = tarefaDaFicha();
    if (!t) return;

    const chave = escopoTarefa(t);
    /* abrir a ficha de uma tarefa aberta já faz a lista existir: assim a
       pessoa vê o que vai ser cobrado antes de começar, e não na hora de
       fechar */
    if (t.status !== 'feito') garantirLista(chave, t);
    /* se esta é a tarefa principal da área nesta campanha, o roteiro da
       campanha vem junto — é ele que segura esta tarefa, e ela é o único
       lugar onde a pessoa vai olhar */
    const p = ehPrincipal(t);
    if (p) garantirRoteiro(p.campanha, p.area);
    const rot = p ? escopoRoteiro(p.campanha, p.area) : '';

    const assinatura = `${chave}|${JSON.stringify(barra(chave))}|${aberta(chave, barra(chave).faltam)}` +
      (p ? `|${rot}|${JSON.stringify(barra(rot))}|${donoRoteiro(p.campanha, p.area)}|${aberta(rot, barra(rot).faltam)}` : '');
    const atual = main.querySelector('[data-cf-secao]');
    if (atual && atual.dataset.cfSecao === assinatura) return;

    const html = `<section class="tsection cf-secao" data-cf-secao="${esc(assinatura)}">
      ${listaHtml(chave, contextoTarefa(t))}
      ${p ? roteiroHtml(p.campanha, p.area, false) : ''}</section>`;

    if (atual) atual.outerHTML = html;
    else main.insertAdjacentHTML('afterbegin', html);

    travarSelect(chave);
  }

  /* O campo de status é do app; eu só desligo a opção enquanto a lista
     não fechar, para a recusa aparecer antes de a pessoa tentar.

     As opções do app não têm atributo value — o valor delas é o próprio
     texto. Então antes de reescrever o texto eu fixo o value, senão
     mudar o rótulo apagaria o status na hora de salvar. */
  function travarSelect(chave) {
    const sel = document.getElementById('detailStatus');
    if (!sel) return;
    const t = tarefaDaFicha();
    const trancar = (t ? faltamTotal(t) : pendentes(chave).length) > 0 &&
      statusEscolhido(sel) !== 'feito';

    for (const o of sel.options) {
      if (statusDaOpcao(o) !== 'feito') continue;
      o.value = 'feito';
      o.disabled = trancar;
      o.textContent = trancar ? 'feito (conferência pendente)' : 'feito';
      o.title = trancar ? 'A conferência desta tarefa ainda tem item obrigatório em aberto.' : '';
    }
  }

  const statusDaOpcao = (o) => (o.getAttribute('value') || o.textContent || '').replace(/ \(.*\)$/, '').trim();
  const statusEscolhido = (sel) => statusDaOpcao(sel.options[sel.selectedIndex] || {
    getAttribute: () => null, textContent: sel.value });

  /* ---------- a campanha ---------- */

  function campanhaNaTela() {
    const ws = document.getElementById('campaignWorkspace');
    if (!ws || !ws.classList.contains('active')) return null;
    const nome = ws.querySelector('.cw-title h2')?.textContent?.trim();
    if (!nome) return null;
    const marca = (ws.querySelector('.cw-title small')?.textContent || '').split('·')[0].trim();
    const todas = lerLista(chaveCamp());
    const porNome = todas.filter((x) => x.name.trim() === nome);
    if (porNome.length === 1) return porNome[0];
    const m = porNome.filter((x) => (x.brand || '').toLowerCase() === marca.toLowerCase());
    return m.length === 1 ? m[0] : null;
  }

  function contextoCampanha(c) {
    const ts = tarefasDa(c);
    return {
      area: null,
      extras: [],
      payload: {
        tipo: 'campanha',
        marca: c.brand || '',
        campanha: {
          nome: c.name, tipo: c.type || '', oferta: c.offer || '',
          objetivo: c.objective || '', inicio: c.start || '', fim: c.end || '',
          meta: c.goal || 0, verba: c.budget || 0, canais: c.channels || [],
          produtos: (c.products || []).map((p) => p.name).filter(Boolean),
        },
        tarefas: ts.map((t) => ({ titulo: t.title, status: t.status, area: areaDe(t) })),
        padrao: PADRAO_CAMPANHA.map(([t]) => t),
      },
    };
  }

  /* a campanha herda o padrão dela, e não o de uma área */
  function porRegrasCampanha() {
    return PADRAO_CAMPANHA.map(([texto, obrigatorio, marca]) =>
      ({ id: id('i'), texto, obrigatorio,
         prova: /prova/.test(marca || ''), revisao: /revisao/.test(marca || ''), feito: false }));
  }

  function contagemDa(c) {
    const ts = tarefasDa(c);
    const semLista = ts.filter((t) => !conferencia(escopoTarefa(t)));
    const travadas = ts.filter((t) => pendentes(escopoTarefa(t)).length);
    return { total: ts.length, semLista: semLista.length, travadas: travadas.length,
             ok: ts.length - semLista.length - travadas.length };
  }

  function resumoTarefasDa(c) {
    const { total, semLista, travadas, ok } = contagemDa(c);
    if (!total) return '';
    return `<div class="cf-tarefas-rot">Conferência das tarefas desta campanha</div>
    <div class="cf-tarefas">
      <div class="cf-tarefa-num"><b>${ok}</b><span>conferidas</span></div>
      <div class="cf-tarefa-num ${travadas ? 'ruim' : ''}"><b>${travadas}</b><span>travadas</span></div>
      <div class="cf-tarefa-num ${semLista ? 'morno' : ''}"><b>${semLista}</b><span>sem lista</span></div>
      ${semLista ? `<button type="button" class="cf-bt" data-cf-gerar-todas="${esc(escopoCampanha(c))}">Gerar a lista das ${semLista} que faltam</button>` : ''}
    </div>`;
  }

  function naCampanha() {
    const c = campanhaNaTela();
    if (!c) return;
    const pane = document.querySelector('[data-cw-pane="summary"] .cp');
    if (!pane) return;

    const chave = escopoCampanha(c);
    const assinatura = `${chave}|${JSON.stringify(barra(chave))}|${JSON.stringify(contagemDa(c))}` +
      `|${aberta(chave, barra(chave).faltam)}|${assinaturaRoteiros(c)}`;
    const atual = pane.querySelector('[data-cf-camp]');
    if (atual && atual.dataset.cfCamp === assinatura) return;

    const html = `<section class="cf-camp" data-cf-camp="${esc(assinatura)}">
      ${resumoTarefasDa(c)}
      ${roteirosHtml(c)}
      ${listaHtml(chave, contextoCampanha(c))}</section>`;

    if (atual) atual.outerHTML = html;
    else pane.insertAdjacentHTML('beforeend', html);
  }

  /* ---------- o padrão da área ---------- */

  function abrirArea(area) {
    fecharArea();
    const itens = padraoDe(area);
    const caixa = document.createElement('div');
    caixa.className = 'cf-modal';
    caixa.innerHTML = `
      <div class="cf-modal-fundo" data-cf-fechar></div>
      <div class="cf-modal-caixa" role="dialog" aria-label="Padrão de conferência">
        <header>
          <div>
            <strong>Padrão de conferência</strong>
            <span>o que sempre se confere nas entregas desta área</span>
          </div>
          <button type="button" class="cf-x-grande" data-cf-fechar>×</button>
        </header>
        <div class="cf-abas">
          ${AREAS.map((a) => `<button type="button" class="cf-aba ${a === area ? 'ativa' : ''}" data-cf-troca="${esc(a)}">${esc(a)}</button>`).join('')}
        </div>
        <div class="cf-modal-corpo" data-cf-corpo="${esc(area)}">
          <div class="cf-padrao">
            ${itens.map((p) => `
              <div class="cf-padrao-linha" data-cf-p="${esc(p.id)}">
                <input type="checkbox" data-cf-obrig="${esc(p.id)}" ${p.obrigatorio ? 'checked' : ''} title="Obrigatório — trava a entrega">
                <span contenteditable="plaintext-only" spellcheck="false" data-cf-texto="${esc(p.id)}">${esc(p.texto)}</span>
                <button type="button" class="cf-x" data-cf-tirar-p="${esc(p.id)}">×</button>
              </div>`).join('')}
          </div>
          <div class="cf-linha-add">
            <input type="text" data-cf-novo-p="1" placeholder="Acrescentar ao padrão de ${esc(area)}">
            <button type="button" class="cf-bt" data-cf-add-p="1">Acrescentar</button>
          </div>
          <p class="cf-nota">A caixa marcada é item obrigatório: enquanto ele não estiver
          conferido, a tarefa não fecha. O que está aqui vale para as próximas listas —
          as listas já geradas continuam como estão até serem refeitas.</p>
        </div>
        <footer>
          <button type="button" class="cf-bt cf-bt-fraco" data-cf-restaurar="${esc(area)}">Voltar ao padrão de fábrica</button>
          <button type="button" class="cf-bt cf-bt-forte" data-cf-fechar>Pronto</button>
        </footer>
      </div>`;
    document.body.appendChild(caixa);
  }

  const fecharArea = () => document.querySelector('.cf-modal')?.remove();

  function areaAberta() {
    return document.querySelector('[data-cf-corpo]')?.dataset.cfCorpo || null;
  }

  function lerPadraoDaTela() {
    return [...document.querySelectorAll('.cf-padrao-linha')].map((l) => ({
      id: l.dataset.cfP,
      texto: l.querySelector('[data-cf-texto]').textContent.trim(),
      obrigatorio: l.querySelector('[data-cf-obrig]').checked,
    })).filter((p) => p.texto);
  }

  function salvarAreaDaTela() {
    const a = areaAberta();
    if (a) gravarPadrao(a, lerPadraoDaTela());
  }

  /* ====================================================================
     Os cliques
     ==================================================================== */

  document.addEventListener('click', async (e) => {
    const alvo = e.target;

    /* --- abrir e fechar a lista --- */
    const d = alvo.closest?.('[data-cf-dobra]');
    if (d) {
      const chave = d.dataset.cfDobra;
      dobra.set(chave, !aberta(chave, barra(chave).faltam));
      redesenhar();
      return;
    }

    /* --- gerar / refazer --- */
    const g = alvo.closest?.('[data-cf-gerar]');
    if (g) {
      const chave = g.dataset.cfGerar;
      const ia = g.dataset.cfIa === '1';
      g.disabled = true;
      const antes = g.textContent;
      g.textContent = ia ? 'Escrevendo…' : 'Montando…';
      try {
        if (chave.startsWith('campanha:')) {
          const c = campanhaNaTela();
          if (c) {
            const ctx = contextoCampanha(c);
            if (ia) {
              await gerar(chave, { ...ctx, area: null, extras: [], base: porRegrasCampanha }, true);
            } else {
              const antesC = conferencia(chave);
              const marcados = new Map((antesC?.itens || []).filter((i) => i.feito).map((i) => [limpa(i.texto), i]));
              const itens = porRegrasCampanha();
              for (const i of itens) if (marcados.has(limpa(i.texto))) i.feito = true;
              gravarConferencia(chave, { itens, geradoEm: agora(), geradoPor: 'regras', versao: (antesC?.versao || 0) + 1 });
            }
          }
        } else {
          const t = tarefaDaFicha();
          if (t) await gerar(chave, contextoTarefa(t), ia);
        }
        if (ia && iaFora) aviso('A IA está desligada. A lista veio do padrão da área.');
      } finally {
        g.disabled = false; g.textContent = antes;
        redesenhar();
      }
      return;
    }

    /* --- gerar a lista de todas as tarefas de uma campanha --- */
    const gt = alvo.closest?.('[data-cf-gerar-todas]');
    if (gt) {
      const c = campanhaNaTela();
      if (!c) return;
      gt.disabled = true;
      const antes = gt.textContent;
      const faltando = tarefasDa(c).filter((t) => !conferencia(escopoTarefa(t)));
      let n = 0;
      for (const t of faltando) {
        gt.textContent = `Escrevendo ${++n} de ${faltando.length}…`;
        await gerar(escopoTarefa(t), contextoTarefa(t), true);
      }
      gt.disabled = false; gt.textContent = antes;
      aviso(`${faltando.length} lista${faltando.length > 1 ? 's' : ''} de conferência criada${faltando.length > 1 ? 's' : ''}${iaFora ? ', pelo padrão da área — a IA está desligada' : ''}.`);
      redesenhar();
      return;
    }

    /* --- chamar para esta campanha um roteiro de área que não tem tarefa --- */
    const rn = alvo.closest?.('[data-cf-rot-novo]');
    if (rn) {
      const chave = rn.dataset.cfRotNovo;
      const c = campanhaDaChave(chave);
      if (c) { garantirRoteiro(c, partesRoteiro(chave).area); dobra.set(chave, true) }
      redesenhar();
      return;
    }

    /* --- refazer o roteiro pelo protocolo da área --- */
    const rg = alvo.closest?.('[data-cf-rot-gerar]');
    if (rg) {
      refazerRoteiro(rg.dataset.cfRotGerar);
      redesenhar();
      return;
    }

    /* --- o erro que passou, no nível do roteiro --- */
    const erRot = alvo.closest?.('[data-cf-erro-rot]');
    if (erRot) {
      const chave = erRot.dataset.cfErroRot;
      const { area } = partesRoteiro(chave);
      const dito = window.prompt(
        `O que passou sem alguém ver?\n\nEscreva como uma coisa a conferir, na forma de quem vai checar.\nEx.: "Número escrito no banner conferido contra a quantidade que existe de verdade".\n\nIsso entra no roteiro de ${area} de todas as próximas campanhas.`, '');
      const r = registrarErroRoteiro(area, dito);
      if (r) {
        if (r.novo) { refazerRoteiro(chave); aviso(`Entrou no roteiro de ${area}. Vale desta campanha em diante.`) }
        else aviso('Esse item já estava no roteiro da área.');
      }
      redesenhar();
      return;
    }

    /* --- tirar item da lista --- */
    const x = alvo.closest?.('[data-cf-tirar]');
    if (x) {
      const { chave, item } = lerPar(x.dataset.cfTirar);
      const c = conferencia(chave);
      if (c) {
        c.itens = c.itens.filter((i) => i.id !== item);
        gravarConferencia(chave, c);
        redesenhar();
      }
      e.preventDefault();
      return;
    }

    /* --- acrescentar item --- */
    const a = alvo.closest?.('[data-cf-add]');
    if (a) {
      const chave = a.dataset.cfAdd;
      const campo = document.querySelector(`[data-cf-novo="${CSS.escape(chave)}"]`);
      const texto = campo?.value.trim();
      if (!texto) return;
      const c = conferencia(chave) || { itens: [], geradoEm: agora(), geradoPor: 'mão', versao: 1 };
      c.itens.push({ id: id('i'), texto, obrigatorio: true, feito: false });
      gravarConferencia(chave, c);
      redesenhar();
      return;
    }

    /* --- o erro que passou --- */
    const er = alvo.closest?.('[data-cf-erro]');
    if (er) {
      const area = er.dataset.cfErro;
      const dito = window.prompt(
        `O que passou sem alguém ver?\n\nEscreva como item de conferência, na forma de uma coisa a checar.\nEx.: "Link do produto abre na página do produto, não na home".\n\nIsso vira item obrigatório de ${area} para todas as próximas entregas.`, '');
      const r = registrarErro(area, dito);
      if (r) aviso(r.novo ? `Virou item obrigatório de ${area}. Vale da próxima entrega em diante.` : 'Esse item já estava no padrão da área.');
      redesenhar();
      return;
    }

    /* --- padrão da área --- */
    const pa = alvo.closest?.('[data-cf-area]');
    if (pa) { abrirArea(pa.dataset.cfArea); return }

    if (alvo.closest?.('[data-cf-fechar]')) { salvarAreaDaTela(); fecharArea(); redesenhar(); return }

    const tr = alvo.closest?.('[data-cf-troca]');
    if (tr) { salvarAreaDaTela(); abrirArea(tr.dataset.cfTroca); return }

    const xp = alvo.closest?.('[data-cf-tirar-p]');
    if (xp) {
      xp.closest('.cf-padrao-linha')?.remove();
      salvarAreaDaTela();
      return;
    }

    if (alvo.closest?.('[data-cf-add-p]')) {
      const campo = document.querySelector('[data-cf-novo-p]');
      const texto = campo?.value.trim();
      if (!texto) return;
      const atual = lerPadraoDaTela();
      atual.push({ id: id('p'), texto, obrigatorio: true });
      const area = areaAberta();
      if (area) { gravarPadrao(area, atual); abrirArea(area) }
      return;
    }

    const rest = alvo.closest?.('[data-cf-restaurar]');
    if (rest) {
      const area = rest.dataset.cfRestaurar;
      const e2 = estado();
      delete e2.padroes[area];
      gravar(e2);
      abrirArea(area);
      return;
    }
  });

  /* quem confere este roteiro */
  document.addEventListener('change', (e) => {
    const sel = e.target.closest?.('[data-cf-dono]');
    if (!sel) return;
    const chave = sel.dataset.cfDono;
    const c = campanhaDaChave(chave);
    if (!c) return;
    const { area } = partesRoteiro(chave);
    gravarDono(c, area, sel.value);
    redesenhar();
  });

  /* marcar e desmarcar item */
  document.addEventListener('change', (e) => {
    const cb = e.target.closest?.('[data-cf-item]');
    if (cb) {
      const { chave, item } = lerPar(cb.dataset.cfItem);
      const c = conferencia(chave);
      if (!c) return;
      const i = c.itens.find((y) => y.id === item);
      if (!i) return;

      if (cb.checked) {
        /* segundo par de olhos: quem fez não confere o próprio trabalho */
        if (i.revisao) {
          if (String(chave).startsWith('roteiro:')) {
            const c2 = campanhaDaChave(chave);
            const dono = c2 ? donoRoteiro(c2, partesRoteiro(chave).area) : '';
            if (dono && meusNomes().includes(dono)) {
              cb.checked = false;
              aviso('Este item é de revisão: quem conduz o roteiro não pode marcar. Peça a outra pessoa.');
              return;
            }
          }
          const t = tarefaPorId(String(chave).split(':')[1]);
          if (t && souResponsavel(t)) {
            cb.checked = false;
            aviso('Este item é de revisão: quem fez a tarefa não pode marcar. Peça a outra pessoa.');
            return;
          }
          if (!meusNomes().length) {
            cb.checked = false;
            aviso('Este item é de revisão e precisa saber quem está marcando. Entre com a sua conta.');
            return;
          }
        }
        /* prova: o link, o print ou o número que mostra que foi feito */
        if (i.prova && !i.provaTexto) {
          const dito = window.prompt(`Prova de "${i.texto}"\n\nCole o link, o print ou escreva o que foi testado:`, '');
          if (!dito || !dito.trim()) {
            cb.checked = false;
            aviso('Sem a prova, este item não marca.');
            return;
          }
          i.provaTexto = dito.trim().slice(0, 300);
        }
      }

      i.feito = cb.checked;
      if (cb.checked) { i.por = nome(); i.em = agora() } else { delete i.por; delete i.em; delete i.provaTexto }
      gravarConferencia(chave, c);
      redesenhar();
      return;
    }
    if (e.target.closest?.('[data-cf-obrig]')) salvarAreaDaTela();
  });

  document.addEventListener('focusout', (e) => {
    if (e.target.closest?.('[data-cf-texto]')) salvarAreaDaTela();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.querySelector('.cf-modal')) {
      salvarAreaDaTela(); fecharArea(); e.stopPropagation();
    }
    if (e.key === 'Enter' && e.target.closest?.('[data-cf-texto]')) {
      e.preventDefault(); e.target.blur();
    }
    if (e.key === 'Enter' && e.target.closest?.('[data-cf-novo],[data-cf-novo-p]')) {
      e.preventDefault();
      const chave = e.target.dataset.cfNovo;
      (chave
        ? document.querySelector(`[data-cf-add="${CSS.escape(chave)}"]`)
        : document.querySelector('[data-cf-add-p]'))?.click();
    }
  });

  /* ====================================================================
     A tranca

     São três portas para o "feito", e todas passam por aqui antes de
     chegarem no app: o ouvinte é de captura, no documento, então corre
     antes dos ouvintes que o app pendurou nos elementos.
     ==================================================================== */

  function recusar(t) {
    const quais = travas(t);
    const falta = quais.reduce((n, x) => n + x.falta, 0);
    const doRoteiro = quais.find((x) => x.tipo === 'roteiro');
    aviso(doRoteiro
      ? `"${t.title}" não pode ser concluída: ${falta} item${falta > 1 ? 's' : ''} em aberto — ${doRoteiro.falta} no roteiro de ${doRoteiro.area} desta campanha.`
      : `"${t.title}" não pode ser concluída: ${falta} item${falta > 1 ? 's' : ''} de conferência em aberto.`);
    /* abre a ficha na conferência, para a recusa vir com o caminho junto */
    if (!document.getElementById('taskDetailDrawer')?.classList.contains('open')) {
      const linha = document.querySelector(`[data-task-id="${CSS.escape(String(t.id))}"]`);
      if (linha) { tarefaAberta = String(t.id); linha.click() }
    }
    setTimeout(() => {
      const s = document.querySelector('.cf-secao');
      if (s) { s.scrollIntoView({ block: 'center', behavior: 'smooth' }); s.classList.add('cf-pisca'); setTimeout(() => s.classList.remove('cf-pisca'), 1400) }
    }, 120);
  }

  document.addEventListener('click', (e) => {
    /* de quem é a ficha que vai abrir */
    const linha = e.target.closest?.('[data-task-id]');
    if (linha && !e.target.closest('[data-toggle-done]')) tarefaAberta = linha.dataset.taskId;

    /* o círculo da lista */
    const bt = e.target.closest?.('[data-toggle-done]');
    if (bt) {
      const t = tarefaPorId(bt.dataset.toggleDone);
      if (t && t.status !== 'feito' && faltamTotal(t)) {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        recusar(t);
      }
      return;
    }

    /* o botão Salvar da ficha: aqui não dá para barrar o salvamento
       inteiro sem jogar fora o que a pessoa escreveu nos outros campos.
       Então devolvo o status ao que era e deixo o resto salvar. */
    if (e.target.closest?.('#taskSaveBtn')) {
      const sel = document.getElementById('detailStatus');
      const t = tarefaDaFicha();
      if (sel && statusEscolhido(sel) === 'feito' && t && t.status !== 'feito' && faltamTotal(t)) {
        sel.value = t.status;
        recusar(t);
      }
    }
  }, true);

  document.addEventListener('drop', (e) => {
    const col = e.target.closest?.('[data-drop-status]');
    if (!col || col.dataset.dropStatus !== 'feito') return;
    let idArrastado = '';
    try { idArrastado = e.dataTransfer.getData('text/plain') } catch {}
    const t = tarefaPorId(idArrastado);
    if (t && t.status !== 'feito' && faltamTotal(t)) {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      recusar(t);
    }
  }, true);

  /* ====================================================================
     Redesenhar

     O app refaz as telas o tempo todo — cada aba clicada, cada tarefa
     salva. Em vez de pendurar ouvintes que somem junto, olho as mudanças
     e reponho o que é meu. A assinatura evita o laço: se o que está na
     tela já é o que eu desenharia, não desenho.
     ==================================================================== */

  let pedido = 0;
  function redesenhar() {
    cancelAnimationFrame(pedido);
    pedido = requestAnimationFrame(() => { porFicha(); naCampanha() });
  }

  const olho = new MutationObserver(redesenhar);
  function ligar() {
    olho.observe(document.body, { childList: true, subtree: true });
    redesenhar();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ligar);
  else ligar();

  /* ---------- para os testes e para quem vier depois ---------- */
  window.Conferencia = {
    areas: AREAS, areaDe, padraoDe, gravarPadrao,
    escopoTarefa, escopoCampanha, conferencia, gravarConferencia,
    pendentes, liberado, gerar, porRegras, porRegrasCampanha,
    estado, redesenhar, abrirArea, tarefasDa, campanhaDaTarefa,
    garantirLista, semConferencia, registrarErro, meusNomes, souResponsavel,
    roteiros: ROTEIROS, roteiroPadrao, gravarRoteiroPadrao, porRegrasRoteiro,
    escopoRoteiro, garantirRoteiro, refazerRoteiro, registrarErroRoteiro,
    areasDa, areasDeFora, tarefaPrincipal, ehPrincipal, travas, faltamTotal,
    donoRoteiro, gravarDono, gentePossivel,
  };
})();
