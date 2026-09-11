/* ======================================================================
   O backlog: as tarefas que já se sabe de cor.

   As campanhas da operação são quase sempre as mesmas — muda a oferta e
   uma coisa ou outra. O Dia D de outubro tem o mesmo trabalho do Dia D de
   setembro: alguém define a oferta, alguém escreve, alguém faz a arte,
   alguém sobe o banner, alguém programa o e-mail, alguém liga o tráfego,
   alguém desliga o cupom no dia seguinte.

   Enquanto o ClickUp era o dono das tarefas, elas vinham de lá copiadas
   do mês anterior. Com ele fora, o assistente passou a criar a campanha,
   o TAP e o nó no mapa — e nenhuma tarefa. Todo mês alguém teria que
   digitar as vinte e poucas de novo, e o que fosse esquecido só apareceria
   como erro no dia.

   Então o que se repete vira modelo. Um modelo por formato, com a lista
   de tarefas e o dia de cada uma contado a partir do começo ou do fim da
   campanha — D-7, D-2, D+1. Aplicar o modelo numa campanha calcula as
   datas de verdade, acha quem é da área no cadastro e cria tudo.

   O modelo não é lei: é a memória da operação, e se edita aqui mesmo.
   O que estas listas trazem de fábrica foi lido da tabela CANAIS do TAP,
   que é onde a operação já tinha escrito quem faz o quê. Está para ser
   corrigido, não para ser obedecido.
   ====================================================================== */
(function () {
  'use strict';

  const uid = () => (window.user && window.user.id) || 'vitor-gutierrez';
  const CHAVE = 'central.backlog';
  const chaveTar = () => `central.tasks.${uid()}`;
  const chaveCamp = () => `central.campaigns.${uid()}`;

  const esc = (t) => String(t ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const lerLista = (k) => { try { const v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : [] } catch { return [] } };
  const novoId = (p) => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  const hojeSP = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const dISO = (s) => { const [a, m, d] = String(s || '').split('-').map(Number); return new Date(Date.UTC(a, (m || 1) - 1, d || 1)) };
  const iso = (d) => d.toISOString().slice(0, 10);
  const mais = (s, n) => { const d = dISO(s); d.setUTCDate(d.getUTCDate() + (+n || 0)); return iso(d) };
  const dBR = (s) => /^\d{4}-\d{2}-\d{2}/.test(String(s || '')) ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '—';

  /* D-2, D0, D+1 — como a equipe fala, e como a coluna do modelo mostra */
  const rotuloDia = (it) => {
    const n = +it.dias || 0;
    const letra = it.ref === 'fim' ? 'F' : 'D';
    return n === 0 ? letra : `${letra}${n > 0 ? '+' : '−'}${Math.abs(n)}`;
  };

  /* ====================================================================
     Os modelos de fábrica

     `area` é a área de entrega da conferência — a mesma palavra que o
     roteiro usa. Ela viaja na tarefa como `canal`, então a tarefa nasce
     já sabendo qual protocolo de conferência responde por ela, em vez de
     depender de a classificação adivinhar pelo título.
     ==================================================================== */
  const M = (titulo, area, ref, dias, checklist) => ({ titulo, area, ref, dias, checklist: checklist || [] });

  const OFERTA_FIM = [
    M('Desligar cupons e descontos da campanha e religar o que foi pausado', 'Oferta', 'fim', 1,
      ['Cupons da campanha desligados', 'Descontos automáticos voltaram ao normal', 'O que foi pausado por causa da campanha voltou a ligar']),
  ];

  const FABRICA = [
    {
      id: 'mod-diad', nome: 'Dia D', formato: 'Dia D', marca: '',
      sobre: 'Ação relâmpago de um dia. O D é o dia da ação.',
      itens: [
        M('Fechar a oferta do Dia D: desconto, frete, brinde e o que não pode somar', 'Oferta', 'inicio', -7,
          ['Desconto escrito', 'Frete decidido', 'Brinde e limite decididos', 'Lista do que não soma com esta campanha']),
        M('Escrever a copy do Dia D: e-mail, grupos, API e stories', 'Copy', 'inicio', -5,
          ['E-mail de aviso e e-mail do dia', 'Mensagem dos grupos', 'Mensagem da API', 'Textos dos stories']),
        M('Produzir os criativos do Dia D: vídeo e estático', 'Criativo', 'inicio', -5,
          ['Vídeo UGC', 'Estático emocional', 'Banner do site nas duas medidas', 'Tudo exportado e na pasta']),
        M('Alinhar com as influenciadoras o que sobe no Dia D', 'Influencer', 'inicio', -5,
          ['Quem publica e em que horário', 'Cupom de cada uma conferido', 'Material enviado']),
        M('Criar os cupons e descontos no Shopify com data de início e fim', 'Oferta', 'inicio', -3,
          ['Cupom criado com data e limite de uso', 'Produtos fora da oferta marcados', 'Testado numa compra de verdade']),
        M('Subir banner, tarja com contador e aviso nas páginas de produto', 'Site', 'inicio', -2,
          ['Banner da home no ar', 'Barra do topo com o texto desta campanha', 'Contador apontando para o fim certo', 'Aviso nas PDPs']),
        M('Programar os e-mails do Dia D (base antiga e base captada)', 'E-mail', 'inicio', -2,
          ['E-mail de véspera programado', 'E-mail do dia programado', 'Teste enviado e lido no celular']),
        M('Programar os disparos nos grupos de WhatsApp', 'Grupos', 'inicio', -2,
          ['Mensagem da véspera', 'Mensagens do dia', 'Grupos conferidos um a um']),
        M('Programar a campanha na API do WhatsApp', 'API', 'inicio', -2,
          ['Template aprovado', 'Público conferido', 'Gasto estimado combinado']),
        M('Programar feed e sequência de stories do Dia D', 'Instagram', 'inicio', -2,
          ['Post de feed programado', 'Sequência de stories pronta', 'Link na bio apontando para a campanha']),
        M('Subir as campanhas do Dia D no gerenciador, pausadas', 'Tráfego', 'inicio', -2,
          ['Criativos subidos', 'Públicos definidos', 'Verba do dia definida', 'Tudo pausado esperando o dia']),
        M('Deixar as respostas prontas do Dia D no atendimento', 'Atendimento', 'inicio', -1,
          ['Resposta sobre o desconto', 'Resposta sobre o frete', 'Resposta sobre o brinde', 'Resposta sobre o prazo de entrega']),
        M('Conferência geral na véspera: oferta, site e comunicação', 'Oferta', 'inicio', -1,
          ['Roteiro da Oferta fechado', 'Roteiro do Site fechado', 'Comunicação lida inteira procurando número errado']),
        M('Ligar as campanhas do Dia D e acompanhar durante o dia', 'Tráfego', 'inicio', 0,
          ['Campanhas ligadas no horário', 'Primeira leitura de manhã', 'Leitura do meio do dia', 'Leitura do fim da tarde']),
        M('Disparar nos grupos ao longo do dia', 'Grupos', 'inicio', 0, ['Disparo da manhã', 'Disparo da tarde', 'Disparo de última hora']),
        M('Conferir a entrega dos e-mails e reenviar para quem não abriu', 'E-mail', 'inicio', 0,
          ['Entrega conferida', 'Reenvio para não abertos programado']),
        M('Acompanhar o envio da API e o gasto', 'API', 'inicio', 0, ['Envio saiu', 'Gasto dentro do combinado']),
        M('Subir stories de contagem e de fechamento', 'Instagram', 'inicio', 0, ['Stories da manhã', 'Contagem regressiva', 'Story de última chamada']),
        M('Conferir se as influenciadoras publicaram', 'Influencer', 'inicio', 0, ['Lista conferida uma a uma', 'Quem não publicou foi cobrado']),
        M('Plantão de atendimento no Dia D', 'Atendimento', 'inicio', 0, ['Fila zerada no fim do dia', 'Dúvidas repetidas anotadas']),
        M('Pausar as campanhas do Dia D e anotar o resultado', 'Tráfego', 'fim', 1, ['Campanhas pausadas', 'Faturamento e ROAS anotados']),
        M('Tirar banner, tarja e selos do Dia D do ar', 'Site', 'fim', 1, ['Banner fora', 'Barra do topo limpa', 'Selos das PDPs fora']),
        ...OFERTA_FIM,
      ],
    },
    {
      id: 'mod-semana', nome: 'Semana temática', formato: 'Semana temática', marca: '',
      sobre: 'Cinco a oito dias em torno de um tema. O D é o primeiro dia.',
      itens: [
        M('Escolher o tema da semana e o que entra na linha', 'Oferta', 'inicio', -10, ['Tema escrito', 'SKUs da linha listados', 'Desconto por produto decidido']),
        M('Fechar a oferta da semana: desconto, frete, brinde e o que não soma', 'Oferta', 'inicio', -8, ['Desconto escrito', 'Frete decidido', 'Lista do que não soma']),
        M('Escrever a copy da semana inteira, dia a dia', 'Copy', 'inicio', -6, ['E-mails da semana', 'Mensagens dos grupos', 'Roteiros de stories por dia']),
        M('Produzir os criativos da semana', 'Criativo', 'inicio', -6, ['Peça de abertura', 'Peças do meio da semana', 'Peça de última chamada', 'Banner do site']),
        M('Alinhar as influenciadoras da semana', 'Influencer', 'inicio', -6, ['Quem publica em que dia', 'Cupons conferidos', 'Material enviado']),
        M('Criar cupons e descontos da semana no Shopify', 'Oferta', 'inicio', -4, ['Cupom com data de início e fim', 'Produtos fora da linha marcados', 'Testado numa compra']),
        M('Subir banner, tarja e avisos da semana', 'Site', 'inicio', -2, ['Banner no ar', 'Barra do topo', 'Contador para o fim certo', 'Coleção do tema montada']),
        M('Programar os e-mails da semana', 'E-mail', 'inicio', -2, ['Sequência programada dia a dia', 'Teste lido no celular']),
        M('Programar os disparos nos grupos para a semana', 'Grupos', 'inicio', -2, ['Mensagens de cada dia', 'Grupos conferidos']),
        M('Programar a campanha da semana na API', 'API', 'inicio', -2, ['Template aprovado', 'Público e gasto combinados']),
        M('Programar feed e stories da semana', 'Instagram', 'inicio', -2, ['Posts de feed', 'Stories por dia', 'Link na bio']),
        M('Subir as campanhas da semana no gerenciador', 'Tráfego', 'inicio', -2, ['Criativos subidos', 'Públicos e verba definidos']),
        M('Respostas prontas da semana no atendimento', 'Atendimento', 'inicio', -1, ['Desconto', 'Frete', 'Prazo', 'O que é e o que não é da linha do tema']),
        M('Conferência geral na véspera: oferta, site e comunicação', 'Oferta', 'inicio', -1, ['Roteiro da Oferta fechado', 'Roteiro do Site fechado']),
        M('Acompanhar tráfego e ajustar durante a semana', 'Tráfego', 'inicio', 0, ['Leitura diária', 'Verba remanejada para o que rende']),
        M('Acompanhar e-mails, grupos e API durante a semana', 'E-mail', 'inicio', 1, ['Entregas conferidas', 'Reenvios programados']),
        M('Última chamada: stories, grupos e e-mail do fim', 'Instagram', 'fim', 0, ['Stories de última chamada', 'Disparo final nos grupos', 'E-mail de encerramento']),
        M('Tirar do ar banner, tarja e coleção do tema', 'Site', 'fim', 1, ['Banner fora', 'Barra limpa', 'Coleção despublicada']),
        M('Pausar as campanhas da semana e anotar o resultado', 'Tráfego', 'fim', 1, ['Campanhas pausadas', 'Faturamento e ROAS anotados']),
        ...OFERTA_FIM,
      ],
    },
    {
      id: 'mod-gap', nome: 'Ação de GAP', formato: 'Ação de GAP', marca: '',
      sobre: 'Destravar faixa de ticket ou frete. Dois dias, pouca produção.',
      itens: [
        M('Definir a faixa que se quer destravar e o combo que destrava', 'Oferta', 'inicio', -4, ['Faixa de ticket escrita', 'Combo montado', 'Margem conferida']),
        M('Escrever a copy da ação de gap', 'Copy', 'inicio', -3, ['E-mail', 'Mensagem dos grupos', 'Stories']),
        M('Montar as peças da ação de gap', 'Criativo', 'inicio', -3, ['Estático', 'Banner do carrinho']),
        M('Ajustar a régua de frete grátis e o order bump', 'Site', 'inicio', -1, ['Barra de frete com o valor novo', 'Order bump apontando para o combo', 'Testado no carrinho']),
        M('Programar e-mail e grupos da ação de gap', 'E-mail', 'inicio', -1, ['E-mail programado', 'Grupos programados']),
        M('Acompanhar ticket médio e conversão durante a ação', 'Tráfego', 'inicio', 0, ['Ticket médio antes anotado', 'Leitura no fim de cada dia']),
        M('Voltar a régua de frete e o order bump ao normal', 'Site', 'fim', 1, ['Barra de frete de volta', 'Order bump de volta']),
        ...OFERTA_FIM,
      ],
    },
    {
      id: 'mod-recompra', nome: 'Ações de recompra', formato: 'Recompra', marca: '',
      sobre: 'Contínua no mês, para quem já comprou.',
      itens: [
        M('Montar a base de quem está na janela de recompra', 'API', 'inicio', -3, ['Corte por data da última compra', 'Quem já comprou de novo saiu da lista']),
        M('Escrever a copy da recompra', 'Copy', 'inicio', -3, ['E-mail', 'Mensagem da API']),
        M('Criar o cupom exclusivo de recompra', 'Oferta', 'inicio', -2, ['Cupom criado com limite por cliente', 'Testado numa conta que já comprou']),
        M('Programar a régua de e-mail da recompra', 'E-mail', 'inicio', -1, ['Régua programada', 'Teste lido']),
        M('Programar os envios de recompra na API', 'API', 'inicio', -1, ['Template aprovado', 'Gasto combinado']),
        M('Ler o resultado da recompra e ajustar a janela', 'API', 'fim', 0, ['Conversão anotada', 'Janela ajustada para o mês seguinte']),
      ],
    },
    {
      id: 'mod-perpetuo', nome: 'Perpétuo', formato: 'Perpétuo', marca: '',
      sobre: 'E-mail e API rodando sempre. Manutenção, não lançamento.',
      itens: [
        M('Conferir as réguas de e-mail que rodam sozinhas', 'E-mail', 'inicio', 0, ['Boas-vindas', 'Carrinho abandonado', 'Pós-compra', 'Nenhuma com oferta vencida']),
        M('Conferir os fluxos da API que rodam sozinhos', 'API', 'inicio', 0, ['Fluxos ativos listados', 'Nenhum com oferta vencida', 'Gasto do mês dentro do combinado']),
        M('Revisar os textos perpétuos procurando oferta que já acabou', 'Copy', 'inicio', 1, ['E-mails automáticos lidos', 'Mensagens automáticas lidas']),
        M('Ler o resultado do perpétuo no mês', 'E-mail', 'fim', 0, ['Conversão anotada', 'O que rendeu menos foi reescrito']),
      ],
    },
  ];

  /* Identidade de fábrica é a posição, não um sorteio: enquanto ninguém
     editou nada, `modelos()` monta a lista do zero a cada chamada — e com
     id aleatório o que a tela desenhou não seria o mesmo que o clique
     acha um instante depois. Editar não gravava nada, e o item que abria
     o checklist nunca era o item aberto. */
  const deFabrica = () => JSON.parse(JSON.stringify(FABRICA)).map((m) => ({
    ...m, itens: m.itens.map((it, i) => ({ ...it, id: `${m.id}:${i}` })),
  }));

  /* ---------- o que está guardado ----------
     Chave que começa com "central.", sem dono: a ponte leva e traz, e o
     modelo que o Vitor corrige aparece corrigido para todo mundo. */
  function modelos() {
    const guardado = lerLista(CHAVE);
    if (guardado.length) return guardado;
    return deFabrica();
  }

  function gravar(ms) {
    try { localStorage.setItem(CHAVE, JSON.stringify(ms)) } catch {}
  }

  const doFormato = (tipo) => {
    const t = String(tipo || '').toLowerCase().trim();
    return modelos().find((m) => String(m.formato || '').toLowerCase().trim() === t) || null;
  };

  /* ====================================================================
     De quem é a tarefa

     O modelo guarda a área de entrega, não a pessoa: quem faz o e-mail
     pode mudar, e um modelo com nome dentro envelhece no dia em que
     alguém troca de função. A pessoa sai do cadastro, na hora de aplicar.
     ==================================================================== */
  /* O cadastro só é lido quando alguém abre a tela de Acessos. Quem abre
     o Backlog ou acabou de criar uma campanha normalmente não passou por
     lá — e sem cadastro `quemFaz` devolve vazio e as tarefas nascem sem
     dono. Então quem vai perguntar de quem é a tarefa pede o cadastro
     antes. */
  async function comCadastro() {
    try { await window.Acessos?.carregar?.(false) } catch {}
  }

  function quemFaz(entrega) {
    const A = window.AreaTela;
    if (!A || !A.MAPA) return [];
    const slug = Object.keys(A.MAPA).find((s) => (A.MAPA[s].entregas || []).includes(entrega));
    if (!slug) return [];
    const area = (A.areasDoBanco() || []).find((x) => x.slug === slug);
    if (!area) return [];
    const pessoas = A.gente(area) || [];
    if (!pessoas.length) return [];
    /* Uma pessoa só, mesmo quando a área tem duas. Duas assinaturas na
       mesma tarefa contam duas vezes na carga e na daily, e ninguém sabe
       de quem é. O cadastro já vem ordenado por papel, então a primeira é
       quem responde pela área — e quem for fazer troca no lugar. */
    const p = pessoas[0];
    return [p.nomeClickup || p.nome];
  }

  /* ====================================================================
     Aplicar o modelo numa campanha
     ==================================================================== */
  function previa(modelo, camp) {
    if (!modelo || !camp) return [];
    const inicio = camp.start || hojeSP();
    const fim = camp.end || inicio;
    return (modelo.itens || []).map((it) => {
      const base = it.ref === 'fim' ? fim : inicio;
      return {
        item: it,
        titulo: it.titulo,
        area: it.area,
        quando: rotuloDia(it),
        due: mais(base, it.dias),
        quem: quemFaz(it.area),
      };
    }).sort((a, b) => String(a.due).localeCompare(String(b.due)));
  }

  /* O app guarda as tarefas num vetor preso dentro dele e só redesenha
     quando alguém troca de tela. `__centralGetTasks` devolve esse mesmo
     vetor, então empurrar nele já é mexer no do app — falta redesenhar.

     O jeito do app é chamar `showTasks`, mas isso ARRASTA quem está no
     Backlog para a lista de tarefas no meio do que estava fazendo. Então
     só redesenha se a lista já estiver na frente; caso contrário, atualiza
     o contador da lateral e deixa a pessoa onde ela está. */
  function avisarApp(todas) {
    const c = document.getElementById('taskNavCount');
    if (c) c.textContent = todas.filter((t) => t.status !== 'feito').length;
    const lista = document.getElementById('tasksView');
    if (lista && lista.classList.contains('active')) window.__centralShowTasks?.();
  }

  const mesmaTarefa = (a, b) =>
    String(a || '').toLowerCase().trim() === String(b || '').toLowerCase().trim();

  function aplicar(modelo, camp) {
    const linhas = previa(modelo, camp);
    if (!linhas.length) return { criadas: 0, puladas: 0 };

    const todas = (window.__centralGetTasks && window.__centralGetTasks()) || lerLista(chaveTar());
    /* Aplicar duas vezes não pode virar tarefa em dobro: o que já existe
       com o mesmo título nesta campanha fica como está. */
    const jaTem = new Set(todas
      .filter((t) => mesmaTarefa(t.project, camp.name))
      .map((t) => String(t.title || '').toLowerCase().trim()));

    let criadas = 0, puladas = 0;
    for (const l of linhas) {
      if (jaTem.has(String(l.titulo).toLowerCase().trim())) { puladas++; continue }
      todas.push({
        id: novoId('t'),
        title: l.titulo,
        status: 'a fazer',
        assignees: l.quem,
        due: l.due,
        start: null,
        brand: camp.brand || 'Botanika',
        project: camp.name,
        /* a área de entrega viaja na tarefa: é assim que o roteiro de
           conferência certo aparece sem depender de adivinhação */
        canal: l.area,
        description: `Do modelo "${modelo.nome}" — ${l.quando} da campanha ${camp.name}.`,
        priority: 'normal',
        recurrence: 'none',
        subtasks: [],
        checklist: (l.item.checklist || []).map((t) => ({ id: novoId('c'), text: t, done: false })),
        attachments: [],
        comments: [],
        history: [{ at: 'Agora', text: `Criada a partir do modelo "${modelo.nome}".` }],
      });
      criadas++;
    }

    try { localStorage.setItem(chaveTar(), JSON.stringify(todas)) } catch {}
    avisarApp(todas);
    return { criadas, puladas };
  }


  /* ====================================================================
     A tela
     ==================================================================== */
  const AREAS = ['Oferta', 'Site', 'Copy', 'Criativo', 'Tráfego', 'E-mail', 'Grupos', 'API', 'Instagram', 'Influencer', 'Atendimento', 'Geral'];

  const campanhas = () => lerLista(chaveCamp());

  function abas(atual) {
    const ms = modelos();
    const R = window.Rotina;
    return '<div class="bk-abas">' +
      ms.map((m) => `<button type="button" class="cu-view ${m.id === atual ? 'active' : ''}" data-bk-modelo="${esc(m.id)}">${esc(m.nome)}<span>${(m.itens || []).length}</span></button>`).join('') +
      '<button type="button" class="bk-novo" data-bk-novo>+ modelo</button>' +
      '<span class="bk-corte" aria-hidden="true"></span>' +
      `<button type="button" class="cu-view ${atual === 'rotina' ? 'active' : ''}" data-bk-modelo="rotina">Rotina<span>${R ? R.rotina().length : 0}</span></button>` +
      '</div>';
  }

  /* ====================================================================
     A rotina, que é o outro lado da mesma moeda

     O modelo diz o que uma campanha sempre pede; a rotina diz o que a
     área sempre faz, campanha ou não. Mora na mesma tela porque quem vem
     aqui vem pela mesma pergunta: o que se repete?
     ==================================================================== */
  function telaRotina(ctx) {
    const R = window.Rotina;
    if (!R) return ctx.ui.cartao('Rotina', '', '<div class="pn-vazio">Carregando…</div>');
    const A = window.AreaTela;
    const areas = (A ? A.areasDoBanco() : []).map((a) => ({ id: a.slug, nome: a.nome }));
    const rs = R.rotina();

    const selArea = (r) => `<select data-bk-rot-campo="area" data-bk-rot="${esc(r.id)}">` +
      areas.map((a) => `<option value="${esc(a.id)}" ${a.id === r.area ? 'selected' : ''}>${esc(a.nome)}</option>`).join('') +
      (areas.some((a) => a.id === r.area) ? '' : `<option value="${esc(r.area)}" selected>${esc(r.area)}</option>`) + '</select>';

    const selQuando = (r) => {
      if (r.cadencia === 'semanal') {
        return `<select data-bk-rot-campo="dia" data-bk-rot="${esc(r.id)}"><option value="">todo dia da semana</option>` +
          R.DIAS.map((d, i) => `<option value="${i}" ${String(r.dia) === String(i) ? 'selected' : ''}>${esc(d)}</option>`).join('') + '</select>';
      }
      if (r.cadencia === 'mensal') {
        return `<select data-bk-rot-campo="dia" data-bk-rot="${esc(r.id)}"><option value="">qualquer dia do mês</option>` +
          Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}" ${String(r.dia) === String(i + 1) ? 'selected' : ''}>dia ${i + 1}</option>`).join('') + '</select>';
      }
      return '<span class="bk-sem">todo dia útil ou não</span>';
    };

    const grupo = (c) => {
      const meus = rs.filter((r) => r.cadencia === c.id);
      return `<div class="bk-rot-grupo"><h4>${esc(c.nome)} <span>${meus.length}</span></h4>` +
        (meus.length
          ? `<table class="bk-tabela"><tbody>${meus.map((r) => `<tr>` +
              `<td><span class="bk-ed" contenteditable="plaintext-only" spellcheck="false" data-bk-rot-campo="titulo" data-bk-rot="${esc(r.id)}">${esc(r.titulo)}</span></td>` +
              `<td>${selArea(r)}</td>` +
              `<td>${selQuando(r)}</td>` +
              `<td><button type="button" class="bk-x" data-bk-rot-tira="${esc(r.id)}" title="tirar da rotina">×</button></td>` +
            `</tr>`).join('')}</tbody></table>`
          : '<div class="bk-sem">nada nesta cadência</div>') +
        `<button type="button" class="bk-mais" data-bk-rot-mais="${esc(c.id)}">+ item ${esc(c.curto === 'dia' ? 'diário' : c.curto === 'semana' ? 'semanal' : 'mensal')}</button></div>`;
    };

    return abas('rotina') + ctx.ui.cartao('Rotina',
      'o que cada área faz sempre, com campanha ou sem',
      '<p class="pn-nota">Isto não vira tarefa. Tarefa de rotina encheria a lista com milhares de linhas por ano — aqui fica uma lista curta que se marca, e o que se guarda é só a marca do período. Aparece no início de cada pessoa e na página da área dela.</p>' +
      R.CADENCIAS.map(grupo).join(''));
  }

  function linhaItem(m, it, aberto) {
    const quem = quemFaz(it.area);
    return `<tr data-bk-linha="${esc(it.id)}">` +
      `<td class="bk-quando">` +
        `<select data-bk-campo="ref" data-bk-item="${esc(it.id)}">` +
          `<option value="inicio" ${it.ref !== 'fim' ? 'selected' : ''}>do início</option>` +
          `<option value="fim" ${it.ref === 'fim' ? 'selected' : ''}>do fim</option></select>` +
        `<input type="number" data-bk-campo="dias" data-bk-item="${esc(it.id)}" value="${+it.dias || 0}" step="1">` +
        `<b>${esc(rotuloDia(it))}</b></td>` +
      `<td><span class="bk-ed" contenteditable="plaintext-only" spellcheck="false" data-bk-campo="titulo" data-bk-item="${esc(it.id)}">${esc(it.titulo)}</span>` +
        `<button type="button" class="bk-lista" data-bk-abre="${esc(it.id)}">${(it.checklist || []).length} item(ns) de checklist ${aberto ? '▴' : '▾'}</button>` +
        (aberto ? `<textarea class="bk-check" data-bk-campo="checklist" data-bk-item="${esc(it.id)}" rows="${Math.max(2, (it.checklist || []).length + 1)}" placeholder="um item por linha">${esc((it.checklist || []).join('\n'))}</textarea>` : '') +
      `</td>` +
      `<td><select data-bk-campo="area" data-bk-item="${esc(it.id)}">${AREAS.map((a) => `<option ${a === it.area ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select></td>` +
      `<td class="bk-quem">${quem.length ? esc(quem[0]) : '<span class="bk-sem">sem gente na área</span>'}</td>` +
      `<td><button type="button" class="bk-x" data-bk-tira="${esc(it.id)}" title="tirar do modelo">×</button></td>` +
    '</tr>';
  }

  function aplicador(m) {
    const cs = campanhas().slice().sort((a, b) => String(b.start || '').localeCompare(String(a.start || '')));
    if (!cs.length) return '<div class="bk-aplicar"><span class="bk-sem">Nenhuma campanha para aplicar ainda.</span></div>';
    return '<div class="bk-aplicar">' +
      '<label>Aplicar em</label>' +
      `<select data-bk-alvo>${cs.map((c) => `<option value="${esc(c.id)}">${esc(c.name)} · ${dBR(c.start)}–${dBR(c.end)} · ${esc(c.brand || '')}</option>`).join('')}</select>` +
      `<button type="button" class="bk-bt" data-bk-aplica="${esc(m.id)}">Criar as ${(m.itens || []).length} tarefas</button>` +
      '<small>As datas saem do início e do fim da campanha escolhida. Tarefa que já existe com o mesmo título não é criada de novo.</small>' +
      '</div>';
  }

  async function tela(ctx) {
    await comCadastro();
    const st = (window.Painel || {}).estado || {};
    if (st.bkModelo === 'rotina') return telaRotina(ctx);
    const ms = modelos();
    const m = ms.find((x) => x.id === st.bkModelo) || ms[0];
    if (!m) return '<div class="pn-vazio">Nenhum modelo.</div>';
    const aberto = st.bkAberto;

    const corpo =
      `<div class="bk-topo">` +
        `<span class="bk-ed bk-nome" contenteditable="plaintext-only" spellcheck="false" data-bk-modelo-campo="nome">${esc(m.nome)}</span>` +
        `<span class="bk-ed bk-sobre" contenteditable="plaintext-only" spellcheck="false" data-bk-modelo-campo="sobre">${esc(m.sobre || '')}</span>` +
        `<label class="bk-formato">nasce com as campanhas do formato` +
          `<input data-bk-modelo-campo="formato" value="${esc(m.formato || '')}" placeholder="nenhum"></label>` +
        (ms.length > 1 ? `<button type="button" class="bk-x bk-apaga" data-bk-apaga="${esc(m.id)}" title="apagar o modelo">apagar modelo</button>` : '') +
      `</div>` +
      `<table class="bk-tabela"><thead><tr>` +
        `<th>Quando</th><th>Tarefa</th><th>Área</th><th>Quem</th><th></th>` +
      `</tr></thead><tbody>` +
        (m.itens || []).slice().sort((a, b) => (a.ref === b.ref ? (+a.dias || 0) - (+b.dias || 0) : (a.ref === 'fim' ? 1 : -1)))
          .map((it) => linhaItem(m, it, it.id === aberto)).join('') +
      `</tbody></table>` +
      `<button type="button" class="bk-mais" data-bk-mais="${esc(m.id)}">+ tarefa no modelo</button>` +
      aplicador(m);

    const sub = 'o que se repete em toda campanha deste formato';
    return abas(m.id) + ctx.ui.cartao('Modelos de campanha', sub, corpo);
  }

  /* ---------- gravar o que foi editado ---------- */
  function comModelo(id, f) {
    const ms = modelos();
    const m = ms.find((x) => x.id === id);
    if (!m) return;
    f(m, ms);
    gravar(ms);
  }
  const acharItem = (id) => {
    for (const m of modelos()) for (const it of (m.itens || [])) if (it.id === id) return { m, it };
    return null;
  };

  function mudarItem(itemId, campo, valor) {
    const achado = acharItem(itemId);
    if (!achado) return;
    comModelo(achado.m.id, (m) => {
      const it = (m.itens || []).find((x) => x.id === itemId);
      if (!it) return;
      if (campo === 'dias') it.dias = Math.round(+valor || 0);
      else if (campo === 'checklist') it.checklist = String(valor).split('\n').map((x) => x.trim()).filter(Boolean);
      else it[campo] = String(valor).trim();
    });
  }

  /* ====================================================================
     Quando a campanha nasce

     O assistente cria a campanha e some. Em vez de a tarefa aparecer
     sozinha — vinte e duas de uma vez, sem ninguém pedir —, a Central
     mostra o que o modelo tem e espera um clique. Quem cria a campanha é
     quem sabe se este mês é igual aos outros.
     ==================================================================== */
  async function oferecer(camp) {
    const m = doFormato(camp && camp.type);
    if (!m || !(m.itens || []).length) return;
    await comCadastro();
    const linhas = previa(m, camp);

    document.querySelectorAll('.bk-oferta').forEach((e) => e.remove());
    const cx = document.createElement('div');
    cx.className = 'bk-oferta';
    cx.innerHTML =
      `<div class="bk-oferta-cx">` +
        `<b>O modelo "${esc(m.nome)}" tem ${linhas.length} tarefas.</b>` +
        `<span>Criadas com data contada a partir de ${dBR(camp.start)} e ${dBR(camp.end)}, e com quem é da área hoje.</span>` +
        `<ul>${linhas.map((l) => `<li><i>${esc(l.quando)}</i><b>${esc(l.titulo)}</b><small>${esc(l.quem[0] || 'sem gente na área')} · ${dBR(l.due)}</small></li>`).join('')}</ul>` +
        `<div class="bk-oferta-pe">` +
          `<button type="button" class="bk-bt" data-bk-oferta-sim>Criar as ${linhas.length} tarefas</button>` +
          `<button type="button" class="bk-bt-vazio" data-bk-oferta-nao>Agora não</button>` +
        `</div>` +
      `</div>`;
    document.body.appendChild(cx);
    cx.querySelector('[data-bk-oferta-nao]').onclick = () => cx.remove();
    cx.querySelector('[data-bk-oferta-sim]').onclick = () => {
      const r = aplicar(m, camp);
      cx.remove();
      window.showToast?.(`${r.criadas} tarefa(s) criadas${r.puladas ? `, ${r.puladas} já existiam` : ''}`);
    };
    cx.addEventListener('click', (e) => { if (e.target === cx) cx.remove() });
  }

  /* ---------- ligar ---------- */
  function ligar() {
    const P = window.Painel;
    if (!P || !P.registrar) return setTimeout(ligar, 150);
    P.registrar({ id: 'backlog', nome: 'Backlog', semPeriodo: true, render: tela });

    const view = document.getElementById('painelView');
    if (!view) return setTimeout(ligar, 150);
    const st = P.estado;
    const redesenhar = () => P.carregar(false);

    view.addEventListener('click', (e) => {
      const ab = e.target.closest('[data-bk-modelo]');
      if (ab) { st.bkModelo = ab.dataset.bkModelo; st.bkAberto = null; return redesenhar() }

      const abre = e.target.closest('[data-bk-abre]');
      if (abre) { st.bkAberto = st.bkAberto === abre.dataset.bkAbre ? null : abre.dataset.bkAbre; return redesenhar() }

      const tira = e.target.closest('[data-bk-tira]');
      if (tira) {
        const achado = acharItem(tira.dataset.bkTira);
        if (achado) comModelo(achado.m.id, (m) => { m.itens = (m.itens || []).filter((x) => x.id !== tira.dataset.bkTira) });
        return redesenhar();
      }

      const mais = e.target.closest('[data-bk-mais]');
      if (mais) {
        comModelo(mais.dataset.bkMais, (m) => {
          const it = { id: novoId('it'), titulo: 'Nova tarefa do modelo', area: 'Geral', ref: 'inicio', dias: 0, checklist: [] };
          (m.itens = m.itens || []).push(it);
          st.bkAberto = it.id;
        });
        return redesenhar();
      }

      if (e.target.closest('[data-bk-novo]')) {
        const ms = modelos();
        const m = { id: novoId('mod'), nome: 'Novo modelo', formato: '', marca: '', sobre: '', itens: [] };
        ms.push(m); gravar(ms); st.bkModelo = m.id;
        return redesenhar();
      }

      const apaga = e.target.closest('[data-bk-apaga]');
      if (apaga) {
        const ms = modelos().filter((x) => x.id !== apaga.dataset.bkApaga);
        gravar(ms); st.bkModelo = ms[0] && ms[0].id;
        return redesenhar();
      }

      const rotTira = e.target.closest('[data-bk-rot-tira]');
      if (rotTira) {
        const R = window.Rotina;
        R.gravarRotina(R.rotina().filter((x) => x.id !== rotTira.dataset.bkRotTira));
        return redesenhar();
      }

      const rotMais = e.target.closest('[data-bk-rot-mais]');
      if (rotMais) {
        const R = window.Rotina;
        const eu = window.CentralEu;
        const A = window.AreaTela;
        const minha = eu && eu.area_id && (A ? A.areasDoBanco() : []).find((a) => a.id === eu.area_id);
        const rs = R.rotina();
        rs.push({ id: novoId('rot'), titulo: 'Novo item da rotina',
                  area: (minha && minha.slug) || 'gestao', cadencia: rotMais.dataset.bkRotMais, dia: null });
        R.gravarRotina(rs);
        return redesenhar();
      }

      const aplica = e.target.closest('[data-bk-aplica]');
      if (aplica) {
        const m = modelos().find((x) => x.id === aplica.dataset.bkAplica);
        const alvo = view.querySelector('[data-bk-alvo]');
        const c = campanhas().find((x) => String(x.id) === String(alvo && alvo.value));
        if (!m || !c) return;
        const r = aplicar(m, c);
        window.showToast?.(`${r.criadas} tarefa(s) criadas em "${c.name}"${r.puladas ? `, ${r.puladas} já existiam` : ''}`);
      }
    });

    /* contenteditable grava ao sair do campo; select e input, ao mudar */
    const pegar = (el) => (el.tagName === 'SPAN' || el.isContentEditable ? el.textContent : el.value);
    view.addEventListener('focusout', (e) => {
      const el = e.target.closest('[data-bk-campo],[data-bk-modelo-campo]');
      if (!el) return;
      if (el.dataset.bkModeloCampo) {
        const ms = modelos(); const m = ms.find((x) => x.id === st.bkModelo) || ms[0];
        if (m) { m[el.dataset.bkModeloCampo] = String(pegar(el)).trim(); gravar(ms) }
        return;
      }
      mudarItem(el.dataset.bkItem, el.dataset.bkCampo, pegar(el));
    }, true);

    const mudarRotina = (el) => {
      const R = window.Rotina;
      const rs = R.rotina();
      const r = rs.find((x) => x.id === el.dataset.bkRot);
      if (!r) return;
      const campo = el.dataset.bkRotCampo;
      const valor = el.tagName === 'SELECT' ? el.value : el.textContent;
      if (campo === 'dia') r.dia = valor === '' ? null : +valor;
      else r[campo] = String(valor).trim();
      R.gravarRotina(rs);
    };

    view.addEventListener('focusout', (e) => {
      const el = e.target.closest('[data-bk-rot-campo]');
      if (el && el.isContentEditable) mudarRotina(el);
    }, true);

    view.addEventListener('change', (e) => {
      const rot = e.target.closest('[data-bk-rot-campo]');
      if (rot) { mudarRotina(rot); return redesenhar() }
      const el = e.target.closest('[data-bk-campo]');
      if (!el || el.tagName === 'TEXTAREA') return;
      mudarItem(el.dataset.bkItem, el.dataset.bkCampo, el.value);
      if (el.dataset.bkCampo === 'ref' || el.dataset.bkCampo === 'dias' || el.dataset.bkCampo === 'area') redesenhar();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ligar); else ligar();

  window.Backlog = { modelos, gravar, doFormato, previa, aplicar, quemFaz, comCadastro, deFabrica, rotuloDia, oferecer, CHAVE };
})();
