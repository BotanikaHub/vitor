/* ======================================================================
   A home que cada um monta.

   A tela inicial vinha pronta e igual para todo mundo: a faixa da semana,
   três contadores, as tarefas que pedem atenção e as campanhas do mês,
   nessa ordem, sempre. Mas quem abre a Central de manhã não abre pelo
   mesmo motivo: o Pedro quer ver o que estreia, a Lissia quer a fila do
   dia, o Vitor quer o ritmo do mês.

   Então a home vira um quadro de blocos. Cada bloco tem uma largura, se
   arrasta para onde se quer, sai quando não serve e volta pelo catálogo.
   O arranjo é de cada pessoa — mora em `central.home.layout.<uid>`, que a
   ponte já guarda por dono, e não atrapalha o de ninguém.

   Os quatro blocos que já existiam não foram reescritos: eles são
   adotados. O nó do app inteiro é movido para dentro da moldura nova, e
   quem os preenche (inicio.js) continua encontrando `#homeAtencao` e
   `[data-stat]` onde sempre esteve — só que agora dentro de um bloco que
   o dono da tela colocou ali.
   ====================================================================== */
(function () {
  'use strict';

  const uid = () => (window.user && window.user.id) || 'vitor-gutierrez';
  const CHAVE = () => `central.home.layout.${uid()}`;
  const esc = (t) => String(t ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const lerLista = (k) => { try { const v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : [] } catch { return [] } };
  const tarefas = () => lerLista(`central.tasks.${uid()}`);

  const hoje = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d };
  const dISO = (s) => { const [a, m, d] = String(s || '').split('-').map(Number); return new Date(a, (m || 1) - 1, d || 1) };
  const dias = (s) => Math.round((dISO(s) - hoje()) / 86400000);
  const dBR = (s) => { const d = dISO(s); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}` };
  const primeiro = (a) => String(a || '').split('|')[0].trim();
  const vazio = (t) => `<div class="ini-vazio">${esc(t)}</div>`;

  /* ---------- o catálogo ----------
     `adota` diz que o bloco é um pedaço do app que já existe e só muda de
     lugar; `render` é o que eu desenho. Nenhum bloco inventa número: todos
     leem as mesmas tarefas e campanhas que as outras telas leem. */
  const BLOCOS = [
    { id: 'semana', nome: 'Semana', sobre: 'A linha do tempo com as campanhas e marcos dos sete dias.',
      larg: 12, adota: '[data-module="timeline"]' },
    { id: 'perto', nome: 'Perto do vencimento', sobre: 'Quantas vencem hoje ou amanhã e seguem abertas.',
      larg: 4, adota: '[data-stat="perto"]' },
    { id: 'vencidas', nome: 'Tarefas vencidas', sobre: 'O que passou do prazo e precisa de ação hoje.',
      larg: 4, adota: '[data-stat="vencidas"]' },
    { id: 'conclusao', nome: 'Conclusão no mês', sobre: 'Quanto das tarefas com prazo neste mês já fechou.',
      larg: 4, adota: '[data-stat="conclusao"]' },
    { id: 'atencao', nome: 'Tarefas que pedem atenção', sobre: 'Vencidas primeiro, depois o que vence nas próximas 48h.',
      larg: 8, adota: '[data-module="attention"]' },
    { id: 'campanhas', nome: 'Campanhas do mês', sobre: 'As que têm data dentro deste mês, com o quanto já andou.',
      larg: 4, adota: '[data-module="campaigns"]' },

    { id: 'minhaArea', nome: 'A minha área', sobre: 'O resumo da sua área: micrometas de hoje, campanhas e o que está atrasado.',
      larg: 12, render: minhaArea },
    { id: 'minhas', nome: 'As minhas de hoje', sobre: 'Só o que está no seu nome: o que vence hoje e o que atrasou.',
      larg: 6, render: minhas },
    { id: 'estreia', nome: 'O que estreia', sobre: 'Campanhas dos próximos dez dias e quantas tarefas seguem abertas.',
      larg: 6, render: estreia },
    { id: 'travadas', nome: 'Travadas na conferência', sobre: 'O que não fecha porque falta item obrigatório.',
      larg: 6, render: travadas },
    { id: 'furo', nome: 'Entregue sem conferir', sobre: 'O que foi fechado por fora, sem a conferência ver.',
      larg: 6, render: furo },
    { id: 'acoes', nome: 'Ações combinadas', sobre: 'O que ficou combinado na daily e na reunião, com prazo até hoje.',
      larg: 6, render: acoes },
    { id: 'rotina', nome: 'A rotina de hoje', sobre: 'O que a sua área faz todo dia, e o da semana e do mês que cai hoje.',
      larg: 6, render: rotinaHoje },
  ];

  const doCatalogo = (id) => BLOCOS.find((b) => b.id === id) || null;
  const LARGURAS = [{ v: 3, n: '¼' }, { v: 4, n: '⅓' }, { v: 6, n: '½' }, { v: 8, n: '⅔' }, { v: 12, n: '1' }];

  /* Quem executa abre a Central para ver o que é da área dele e fechar o
     que é dele — não para acompanhar a operação inteira. Quem administra
     abre para o contrário. Então o arranjo de fábrica é diferente para
     cada um; depois disso, todo mundo monta o seu. */
  const PADRAO = () => {
    const papel = (window.CentralEu || {}).papel;
    const manda = papel === 'admin' || papel === 'gestor';
    const ids = manda
      ? ['minhaArea', 'rotina', 'semana', 'perto', 'vencidas', 'conclusao', 'atencao', 'campanhas']
      : ['minhaArea', 'minhas', 'rotina', 'atencao'];
    return ids.map((id) => ({ id, larg: id === 'minhas' ? 6 : id === 'rotina' ? 6 : id === 'atencao' && !manda ? 6 : doCatalogo(id).larg }));
  };

  /* ---------- o arranjo de quem está logado ---------- */
  function arranjo() {
    try {
      const g = JSON.parse(localStorage.getItem(CHAVE()) || 'null');
      const blocos = g && Array.isArray(g.blocos) ? g.blocos : null;
      if (!blocos) return PADRAO();
      const limpo = blocos
        .filter((b) => b && doCatalogo(b.id))
        .map((b) => ({ id: b.id, larg: LARGURAS.some((l) => l.v === +b.larg) ? +b.larg : doCatalogo(b.id).larg }));
      return limpo.length ? limpo : PADRAO();
    } catch { return PADRAO() }
  }

  function gravar(blocos) {
    try { localStorage.setItem(CHAVE(), JSON.stringify({ v: 1, blocos })) } catch {}
    desenhar();
  }

  /* ---------- os blocos novos ---------- */
  const meus = () => {
    try { const n = window.Conferencia?.meusNomes?.(); if (n && n.length) return n } catch {}
    const eu = window.CentralEu;
    return [eu && eu.nome].filter(Boolean);
  };

  function linhaTarefa(t) {
    const d = t.due ? dias(t.due) : null;
    const quando = d == null ? 'sem prazo'
      : d < 0 ? (d === -1 ? 'vencida ontem' : `vencida há ${-d} dias`)
      : d === 0 ? 'vence hoje' : d === 1 ? 'vence amanhã' : `em ${d} dias`;
    return `<div class="task" data-ini-tarefa="${esc(t.id)}">
      <span class="urgency ${d != null && d < 0 ? 'red' : 'orange'}"></span>
      <div>
        <div class="task-title">${esc(t.title)}</div>
        <div class="task-meta">${esc(t.brand || '')} · ${esc(t.project || 'Sem projeto')}</div>
      </div>
      <span class="due ${d != null && d < 0 ? '' : 'soon'}">${esc(quando)}${t.due ? ` · ${dBR(t.due)}` : ''}</span>
    </div>`;
  }


  /* ---------- a área da pessoa, já na home ----------
     Antes era preciso ir à aba Área para ver o que é da sua. Quem executa
     abre a Central e quer isso na cara: o que a área precisa entregar
     hoje, o quanto falta em cada campanha, e o que já passou do prazo.

     As métricas vêm do painel da marca, que é rede — por isso este bloco
     devolve promessa. O resto é local e aparece na hora. */
  let cacheArea = { em: 0, dados: null, marca: '' };

  async function metricasDaArea(setores, marca) {
    if (!setores.length) return null;
    const P = window.Painel;
    if (!P || !P.pedir) return null;
    if (cacheArea.dados && cacheArea.marca === marca && Date.now() - cacheArea.em < 60000) return cacheArea.dados;
    const h = new Date().toISOString().slice(0, 10);
    const d = await P.pedir('setores', { ano: +h.slice(0, 4), mes: +h.slice(5, 7), de: h, ate: h });
    cacheArea = { em: Date.now(), dados: d, marca };
    return d;
  }

  /* A lista de áreas vem do banco e só é lida quando alguém abre a tela
     de Acessos. Quem chega direto no início — que é todo mundo, toda
     manhã — não passou por lá: sem isto, `areasDoBanco` cai no plano B e
     o id da área de cada um não casa com nada. A pessoa lia "você não
     está ligado a uma área" estando. */
  async function comCadastro() {
    try { await window.Acessos?.carregar?.(false) } catch {}
  }

  async function minhaArea() {
    const A = window.AreaTela;
    if (!A) return vazio('A página de área ainda não está de pé nesta tela.');
    await comCadastro();
    const eu = window.CentralEu;
    const todas = A.areasDoBanco();
    const area = eu && eu.area_id ? todas.find((x) => x.id === eu.area_id) : null;
    if (!area) return vazio('Você ainda não está ligado a uma área. Peça a quem administra para escolher a sua em Acessos.');

    const marca = document.getElementById('brandSelect')?.value || '';
    const ts = A.tarefasDaArea(area, ['Botanika', 'VermeFree'].includes(marca) ? marca : '');
    const h = new Date().toISOString().slice(0, 10);
    const abertas = ts.filter((t) => t.status !== 'feito');
    const atrasadas = abertas.filter((t) => t.due && t.due < h);
    const deHoje = abertas.filter((t) => t.due === h);

    const cabeca = `<div class="hm-area-topo">
      <b>${esc(area.nome)}</b>
      <span class="${atrasadas.length ? 'critico' : ''}">${atrasadas.length} atrasada${atrasadas.length === 1 ? '' : 's'}</span>
      <span>${deHoje.length} para hoje</span>
      <span>${abertas.length} abertas</span>
      <button type="button" class="hm-bt" data-hm-abre-area>Abrir a área</button>
    </div>`;

    /* campanhas: o quanto falta a ÁREA entregar em cada uma */
    const cs = lerLista(`central.campaigns.${uid()}`)
      .map((c) => {
        const n = limpaTxt(c.name);
        const minhasT = ts.filter((t) => {
          const p = limpaTxt(t.project);
          if (!p || p === 'sem projeto') return false;
          return n === p || n.startsWith(p + ' ') || p.startsWith(n + ' ') || (n.startsWith(p) && p.length >= 5);
        });
        return { c, minhasT, feitas: minhasT.filter((t) => t.status === 'feito').length };
      })
      .filter((x) => x.minhasT.length)
      .slice(0, 4);

    const camps = cs.length ? `<div class="hm-area-camps">${cs.map((x) => {
      const pct = Math.round((x.feitas / x.minhasT.length) * 100);
      return `<div class="hm-area-camp" data-ini-campanha="${esc(x.c.name)}">
        <div class="hm-area-camp-topo"><b>${esc(x.c.name)}</b><span>${pct}%</span></div>
        <div class="ar-pct-barra"><i style="width:${pct}%"></i></div>
        <small>faltam ${x.minhasT.length - x.feitas} de ${x.minhasT.length}</small>
      </div>`;
    }).join('')}</div>` : '';

    /* Sem nada atrasado nem de hoje, a tela não fica vazia: mostra o que
       vem — quem executa quer saber o que é dele daqui para a frente,
       não só o que já queimou. */
    const proximas = abertas
      .filter((t) => !atrasadas.includes(t) && !deHoje.includes(t))
      .sort((a, b) => String(a.due || '9999').localeCompare(String(b.due || '9999')));
    const mostrar = (atrasadas.length || deHoje.length)
      ? [...atrasadas, ...deHoje].slice(0, 5)
      : proximas.slice(0, 5);
    const listaTarefas = mostrar.length
      ? (atrasadas.length || deHoje.length ? '' : '<div class="hm-area-rot">O que vem a seguir</div>') +
        mostrar.map(linhaTarefa).join('')
      : '<div class="ini-vazio">Nenhuma tarefa aberta nesta área.</div>';

    /* as micrometas: só as de fluxo com meta, que são as que viram "hoje" */
    let micro = '';
    try {
      const mapa = A.MAPA[area.slug] || { setores: [] };
      const d = await metricasDaArea(mapa.setores, marca);
      if (d && !d.erro) {
        const P = window.Painel;
        const metas = d.metas || {};
        const real = P.comDerivadas ? P.comDerivadas({ ...(d.manuais || {}), ...(d.realizados || {}) }, d.manuais) : (d.realizados || {});
        const linhas = Object.keys(metas)
          .filter((k) => mapa.setores.includes(String(k).split('|')[0]))
          .map((k) => {
            const cfg = P.metricas[k] || { nome: k, tipo: 'fluxo', un: '' };
            const mm = A.micrometa(cfg, +metas[k].valor, real[k], +d.dia_hoje || 0, +d.dias || 30);
            return { k, cfg, mm, un: metas[k].unidade || cfg.un };
          })
          .filter((x) => x.mm)
          .slice(0, 4);
        if (linhas.length) micro = `<div class="hm-area-micro">${linhas.map((x) => `
          <div class="hm-area-mm">
            <small>${esc(x.cfg.nome)}</small>
            <b>${x.mm.tipo === 'nivel' ? valorBR(x.un, x.mm.valor) : x.mm.resta <= 0 ? 'batida' : valorBR(x.un, x.mm.valor)}</b>
            <i>${x.mm.tipo === 'nivel' ? 'manter' : x.mm.resta <= 0 ? 'meta do mês' : 'hoje'}</i>
          </div>`).join('')}</div>`;
      }
    } catch { /* sem número, a área ainda vale pelas tarefas */ }

    return cabeca + micro + camps + listaTarefas;
  }

  const limpaTxt = (t) => String(t || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

  function valorBR(un, v) {
    if (v == null || !isFinite(v)) return '—';
    if (un === 'R$') return `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
    if (un === '%') return `${(+v).toFixed(1)}%`;
    if (un === 'x') return `${(+v).toFixed(2)}x`;
    return Math.round(v).toLocaleString('pt-BR');
  }

  function minhas() {
    const nomes = meus();
    if (!nomes.length) return vazio('Entre com a sua conta para a Central saber quais são as suas.');
    const minhasT = tarefas().filter((t) => t.status !== 'feito' &&
      (t.assignees || []).some((a) => nomes.includes(a)));
    const hojeOuAntes = minhasT.filter((t) => t.due && dias(t.due) <= 0);
    const proximas = minhasT.filter((t) => t.due && dias(t.due) > 0 && dias(t.due) <= 3);
    const lista = [...hojeOuAntes, ...proximas]
      .sort((a, b) => String(a.due).localeCompare(String(b.due))).slice(0, 7);
    if (!lista.length) return vazio(minhasT.length
      ? 'Nada seu vence hoje nem nos próximos três dias.'
      : `Nenhuma tarefa no nome de ${esc(nomes[0])}.`);
    return lista.map(linhaTarefa).join('');
  }

  /* A rotina da área de quem está olhando. Diária inteira; semanal e
     mensal só quando caem hoje — uma lista de trinta itens que nunca
     muda vira papel de parede, e ninguém marca papel de parede. */
  async function rotinaHoje() {
    const R = window.Rotina;
    if (!R) return vazio('A rotina ainda não carregou.');
    await comCadastro();
    const eu = window.CentralEu;
    const A = window.AreaTela;
    const area = eu && eu.area_id && A ? (A.areasDoBanco() || []).find((a) => a.id === eu.area_id) : null;
    const grupos = R.daArea(area ? area.slug : null);
    const itens = grupos.flatMap((g) => g.itens.filter((i) => i.hoje).map((i) => ({ ...i, c: g.cadencia })));
    if (!itens.length) {
      return vazio(area
        ? `Nada na rotina de ${esc(area.nome)} para hoje.`
        : 'Sem área no seu cadastro — peça para ligarem a sua em Acessos, e a rotina dela aparece aqui.');
    }
    const feitos = itens.filter((i) => i.feito).length;
    return `<div class="hm-rot-topo">${feitos} de ${itens.length} ${area ? `· ${esc(area.nome)}` : ''}</div>` +
      itens.map((i) => `<label class="hm-rot ${i.feito ? 'ok' : ''}">` +
        `<input type="checkbox" data-hm-rotina="${esc(i.id)}" ${i.feito ? 'checked' : ''}>` +
        `<span>${esc(i.titulo)}</span><small>${esc(i.c.curto)}</small></label>`).join('');
  }

  function estreia() {
    const C = window.Conferencia;
    const cs = lerLista(`central.campaigns.${uid()}`);
    const ts = tarefas();
    const perto = cs
      .filter((c) => c.start && c.status !== 'Concluída' && dias(c.start) >= 0 && dias(c.start) <= 10)
      .map((c) => {
        const dela = C && C.tarefasDa ? C.tarefasDa(c) : ts.filter((t) => t.project === c.name);
        return { c, faltam: dias(c.start), abertas: dela.filter((t) => t.status !== 'feito').length, total: dela.length };
      })
      .sort((a, b) => a.faltam - b.faltam);
    if (!perto.length) return vazio('Nenhuma campanha estreia nos próximos dez dias.');
    return perto.slice(0, 6).map((e) => `<div class="campaign" data-ini-campanha="${esc(e.c.name)}">
      <div class="campaign-top"><b>${esc(e.c.name)}</b><span>${e.faltam === 0 ? 'hoje' : e.faltam === 1 ? 'amanhã' : `em ${e.faltam} dias`}</span></div>
      <div class="campaign-foot"><span>${esc(e.c.brand || '')}</span><span class="${e.abertas ? 'critico' : ''}">${e.abertas} de ${e.total} abertas</span></div>
    </div>`).join('');
  }

  function travadas() {
    const C = window.Conferencia;
    if (!C || !C.pendentes) return vazio('A conferência ainda não está de pé nesta tela.');
    const presas = tarefas().filter((t) => t.status !== 'feito' &&
      C.pendentes(C.escopoTarefa(t)).length > 0 && t.due && dias(t.due) <= 3);
    if (!presas.length) return vazio('Nada travado com prazo nos próximos dias.');
    return presas.slice(0, 7).map((t) => {
      const falta = C.pendentes(C.escopoTarefa(t)).length;
      return `<div class="task" data-ini-tarefa="${esc(t.id)}">
        <span class="urgency red"></span>
        <div><div class="task-title">${esc(t.title)}</div>
          <div class="task-meta">${esc((t.assignees || []).map(primeiro).join(', ') || 'sem responsável')}</div></div>
        <span class="due">${falta} em aberto</span>
      </div>`;
    }).join('');
  }

  function furo() {
    const C = window.Conferencia;
    if (!C || !C.semConferencia) return vazio('A conferência ainda não está de pé nesta tela.');
    const ts = C.semConferencia(tarefas()).slice(0, 7);
    if (!ts.length) return vazio('Nada foi entregue sem passar pela conferência.');
    return ts.map((t) => `<div class="task" data-ini-tarefa="${esc(t.id)}">
      <span class="urgency orange"></span>
      <div><div class="task-title">${esc(t.title)}</div>
        <div class="task-meta">${esc((t.assignees || []).map(primeiro).join(', ') || 'sem responsável')}</div></div>
      <span class="due soon">sem conferência</span>
    </div>`).join('');
  }

  function acoes() {
    let r;
    try { r = JSON.parse(localStorage.getItem(`central.rituais.${uid()}`) || '{}') } catch { r = {} }
    const h = new Date().toISOString().slice(0, 10);
    const lista = (Array.isArray(r.acoes) ? r.acoes : [])
      .filter((a) => !a.feito && (!a.prazo || a.prazo <= h))
      .sort((a, b) => String(a.prazo || '').localeCompare(String(b.prazo || '')))
      .slice(0, 7);
    if (!lista.length) return vazio('Nenhuma ação combinada em aberto com prazo até hoje.');
    return lista.map((a) => `<div class="task">
      <span class="urgency ${a.prazo && a.prazo < h ? 'red' : 'orange'}"></span>
      <div><div class="task-title">${esc(a.texto)}</div>
        <div class="task-meta">${esc(a.dono || 'sem dono')} · ${a.origem === 'kpi' ? 'reunião de KPI' : 'daily'}</div></div>
      <span class="due">${a.prazo ? dBR(a.prazo) : 'sem prazo'}</span>
    </div>`).join('');
  }

  /* ---------- a moldura ----------
     Os nós adotados não podem ser recriados: eles são do app e alguém
     continua preenchendo. Quando saem do arranjo, ficam guardados num
     canto escondido, e voltam inteiros se a pessoa os chamar de novo. */
  function guarda() {
    let g = document.getElementById('homeGuardados');
    if (!g) {
      g = document.createElement('div');
      g.id = 'homeGuardados';
      g.hidden = true;
      document.body.appendChild(g);
    }
    return g;
  }

  function no(bloco) {
    if (!bloco.adota) return null;
    return document.querySelector(`#homeGrade ${bloco.adota}`) ||
           document.querySelector(`#homeGuardados ${bloco.adota}`) ||
           document.querySelector(bloco.adota);
  }

  let organizando = false;

  function cabeca() {
    const n = arranjo().length;
    return `<div class="hm-barra">
      <div class="hm-barra-txt"><strong>Sua home</strong><span>${n} bloco${n === 1 ? '' : 's'} · o arranjo é só seu</span></div>
      <button type="button" class="hm-bt ${organizando ? 'hm-bt-forte' : ''}" data-hm-organizar>${organizando ? 'Pronto' : 'Organizar'}</button>
      ${organizando ? '<button type="button" class="hm-bt" data-hm-add>Adicionar bloco</button>' +
                      '<button type="button" class="hm-bt hm-bt-fraco" data-hm-padrao>Voltar ao padrão</button>' : ''}
    </div>`;
  }

  function molduraDe(b, cat) {
    const ferramentas = organizando ? `<div class="hm-ferramentas">
      <span class="hm-pega" title="Arraste para mudar de lugar">⠿</span>
      <span class="hm-nome">${esc(cat.nome)}</span>
      <span class="hm-largs">${LARGURAS.map((l) => `<button type="button" class="hm-larg ${b.larg === l.v ? 'ativa' : ''}" data-hm-larg="${b.id}|${l.v}" title="${l.n} da largura">${l.n}</button>`).join('')}</span>
      <button type="button" class="hm-x" data-hm-tirar="${b.id}" title="Tirar da home">×</button>
    </div>` : '';
    return `<section class="hm-bloco" data-hm-bloco="${esc(b.id)}" style="grid-column:span ${b.larg}"
      ${organizando ? 'draggable="true"' : ''}>${ferramentas}<div class="hm-corpo" data-hm-corpo="${esc(b.id)}"></div></section>`;
  }

  function assinatura() {
    return JSON.stringify({ a: arranjo(), o: organizando });
  }

  function desenhar() {
    const alvo = document.getElementById('dashboard');
    if (!alvo) return;
    const assin = assinatura();
    let grade = document.getElementById('homeGrade');

    if (!grade || grade.dataset.hm !== assin) {
      const blocos = arranjo();
      /* tudo que é do app volta para a guarda antes de refazer a grade,
         senão a recriação do HTML apagaria nós que não são meus */
      if (grade) for (const cat of BLOCOS) {
        if (!cat.adota) continue;
        const el = grade.querySelector(cat.adota);
        if (el) guarda().appendChild(el);
      }
      const html = `${cabeca()}<div class="hm-grade" id="homeGradeItens">${blocos.map((b) => molduraDe(b, doCatalogo(b.id))).join('')}</div>`;
      if (!grade) {
        grade = document.createElement('div');
        grade.id = 'homeGrade';
        alvo.replaceWith(grade);
        grade.appendChild(alvo);
        alvo.hidden = true;
      }
      const antigo = grade.querySelector('#homeGradeItens');
      if (antigo) { antigo.previousElementSibling?.remove(); antigo.remove() }
      grade.insertAdjacentHTML('afterbegin', html);
      grade.dataset.hm = assin;

      for (const b of blocos) {
        const corpo = grade.querySelector(`[data-hm-corpo="${CSS.escape(b.id)}"]`);
        const cat = doCatalogo(b.id);
        if (!corpo || !cat) continue;
        if (cat.adota) { const el = no(cat); if (el) corpo.appendChild(el) }
      }
    }

    /* o conteúdo dos blocos que eu desenho é refeito sempre — é barato e
       evita a tela ficar velha depois de alguém salvar em outra aba.
       Bloco que precisa buscar coisa devolve promessa: desenha o que dá na
       hora e preenche quando chegar, sem segurar o resto da tela. */
    for (const b of arranjo()) {
      const cat = doCatalogo(b.id);
      if (!cat || !cat.render) continue;
      const corpo = grade.querySelector(`[data-hm-corpo="${CSS.escape(b.id)}"]`);
      if (!corpo) continue;
      const dentro = cat.render();
      if (dentro && typeof dentro.then === 'function') {
        if (!corpo.dataset.html) corpo.innerHTML = molde(cat, '<div class="ini-vazio">Buscando…</div>');
        const meu = (esperando[b.id] = (esperando[b.id] || 0) + 1);
        dentro.then((h) => {
          if (esperando[b.id] !== meu) return;
          const html = molde(cat, h);
          if (corpo.dataset.html !== html) { corpo.dataset.html = html; corpo.innerHTML = html }
        }).catch(() => {});
        continue;
      }
      const html = molde(cat, dentro);
      if (corpo.dataset.html !== html) { corpo.dataset.html = html; corpo.innerHTML = html }
    }
  }

  const esperando = {};
  const molde = (cat, dentro) => `<div class="card"><div class="cardhead"><strong>${esc(cat.nome)}</strong><span>${esc(cat.sobre)}</span></div>
    <div class="hm-lista">${dentro}</div></div>`;

  /* ---------- o catálogo na tela ---------- */
  function abrirCatalogo() {
    fecharCatalogo();
    const tem = new Set(arranjo().map((b) => b.id));
    const fora = BLOCOS.filter((b) => !tem.has(b.id));
    const caixa = document.createElement('div');
    caixa.className = 'hm-modal';
    caixa.innerHTML = `<div class="hm-modal-fundo" data-hm-fechar></div>
      <div class="hm-modal-caixa" role="dialog" aria-label="Blocos para a home">
        <header><div><strong>Blocos</strong><span>o que dá para pôr na sua home</span></div>
          <button type="button" class="hm-x-grande" data-hm-fechar>×</button></header>
        <div class="hm-catalogo">${fora.length ? fora.map((b) => `
          <button type="button" class="hm-oferta" data-hm-por="${esc(b.id)}">
            <span class="hm-oferta-previa" aria-hidden="true">${previa(b)}</span>
            <b>${esc(b.nome)}</b><small>${esc(b.sobre)}</small>
          </button>`).join('') : '<p class="hm-nada">Todos os blocos já estão na sua home.</p>'}</div>
      </div>`;
    document.body.appendChild(caixa);
  }
  const fecharCatalogo = () => document.querySelector('.hm-modal')?.remove();

  /* Uma prévia é um desenho do formato, não do conteúdo: linhas para
     lista, barras para campanha, um número grande para contador. Diz o
     que o bloco parece antes de a pessoa colocá-lo. */
  function previa(b) {
    if (['perto', 'vencidas', 'conclusao'].includes(b.id)) return '<i class="p-num"></i>';
    if (b.id === 'semana') return '<i class="p-linha"></i><i class="p-linha"></i><i class="p-linha curta"></i>';
    if (['campanhas', 'estreia'].includes(b.id)) return '<i class="p-barra"></i><i class="p-barra media"></i><i class="p-barra curta"></i>';
    return '<i class="p-item"></i><i class="p-item"></i><i class="p-item"></i>';
  }

  /* ---------- marcar a rotina ----------
     No change e não no click: a caixa é um input, e o estado que interessa
     é o depois. Só o bloco é redesenhado — desenhar a home inteira roubaria
     o foco de quem está marcando três itens seguidos. */
  document.addEventListener('change', (e) => {
    const cx = e.target.closest?.('[data-hm-rotina]');
    if (!cx) return;
    const R = window.Rotina;
    const item = (R.rotina() || []).find((x) => x.id === cx.dataset.hmRotina);
    if (!item) return;
    R.marcar(item, cx.checked);
    const bloco = cx.closest('[data-hm-bloco]');
    const dentro = bloco && bloco.querySelector('.hm-corpo');
    if (dentro) Promise.resolve(rotinaHoje()).then((h) => { dentro.innerHTML = h });
  });

  /* ---------- cliques ---------- */
  document.addEventListener('click', (e) => {
    const alvo = e.target;
    if (alvo.closest?.('[data-hm-organizar]')) { organizando = !organizando; if (!organizando) fecharCatalogo(); return desenhar() }
    if (alvo.closest?.('[data-hm-add]')) return abrirCatalogo();
    if (alvo.closest?.('[data-hm-fechar]')) return fecharCatalogo();
    if (alvo.closest?.('[data-hm-padrao]')) { try { localStorage.removeItem(CHAVE()) } catch {} ; return desenhar() }
    if (alvo.closest?.('[data-hm-abre-area]')) {
      document.getElementById('painelNav')?.click();
      setTimeout(() => document.querySelector('#painelView [data-tela="area"]')?.click(), 160);
      return;
    }

    const por = alvo.closest?.('[data-hm-por]');
    if (por) {
      const id = por.dataset.hmPor;
      const cat = doCatalogo(id); if (!cat) return;
      gravar([...arranjo(), { id, larg: cat.larg }]);
      fecharCatalogo();
      return;
    }
    const tirar = alvo.closest?.('[data-hm-tirar]');
    if (tirar) return gravar(arranjo().filter((b) => b.id !== tirar.dataset.hmTirar));

    const larg = alvo.closest?.('[data-hm-larg]');
    if (larg) {
      const [id, v] = larg.dataset.hmLarg.split('|');
      return gravar(arranjo().map((b) => (b.id === id ? { ...b, larg: +v } : b)));
    }
  });

  /* ---------- arrastar ---------- */
  let arrastado = null;
  document.addEventListener('dragstart', (e) => {
    const b = e.target.closest?.('[data-hm-bloco]');
    if (!b || !organizando) return;
    arrastado = b.dataset.hmBloco;
    b.classList.add('hm-voando');
    try { e.dataTransfer.setData('text/plain', arrastado); e.dataTransfer.effectAllowed = 'move' } catch {}
  });
  document.addEventListener('dragend', (e) => {
    e.target.closest?.('[data-hm-bloco]')?.classList.remove('hm-voando');
    document.querySelectorAll('.hm-alvo').forEach((x) => x.classList.remove('hm-alvo'));
    arrastado = null;
  });
  document.addEventListener('dragover', (e) => {
    if (!organizando) return;
    const b = e.target.closest?.('[data-hm-bloco]');
    if (!b) return;
    e.preventDefault();
    document.querySelectorAll('.hm-alvo').forEach((x) => x.classList.remove('hm-alvo'));
    if (b.dataset.hmBloco !== arrastado) b.classList.add('hm-alvo');
  });
  document.addEventListener('drop', (e) => {
    if (!organizando) return;
    const b = e.target.closest?.('[data-hm-bloco]');
    if (!b) return;
    e.preventDefault();
    let de = arrastado;
    if (!de) { try { de = e.dataTransfer.getData('text/plain') } catch {} }
    const para = b.dataset.hmBloco;
    if (!de || de === para) return;
    const blocos = arranjo();
    const i = blocos.findIndex((x) => x.id === de);
    const j = blocos.findIndex((x) => x.id === para);
    if (i < 0 || j < 0) return;
    const [movido] = blocos.splice(i, 1);
    blocos.splice(j, 0, movido);
    arrastado = null;
    gravar(blocos);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.querySelector('.hm-modal')) { fecharCatalogo(); e.stopPropagation() }
  });

  /* ---------- redesenhar ---------- */
  let pedido = 0;
  const pedir = () => { cancelAnimationFrame(pedido); pedido = requestAnimationFrame(desenhar) };

  const olho = new MutationObserver(pedir);
  function ligar() {
    olho.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('storage', pedir);
    pedir();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ligar);
  else ligar();

  window.HomeModular = { BLOCOS, arranjo, gravar, desenhar: pedir, padrao: PADRAO,
    organizar: (v) => { organizando = !!v; pedir() } };
})();
