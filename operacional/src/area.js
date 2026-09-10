/* ======================================================================
   A página da área.

   Cada um abre a Central por um motivo diferente, e o painel inteiro é
   grande demais para quem cuida de uma coisa só. Esta tela recorta tudo
   por área: as métricas daquele setor com a meta do mês e o quanto falta
   fazer hoje, as campanhas e projetos em que a área está metida com o
   quanto já entregou, e as tarefas dela.

   Três vocabulários de "área" conviviam no sistema: a lista de setores do
   painel (que é de métrica), a lista da conferência (que é de tipo de
   entrega) e a tabela `areas` do banco (que é de gente). Quem manda aqui
   é a última — é a que as pessoas têm no cadastro. As outras duas são
   traduzidas por MAPA, num lugar só.

   Quem é membro vê a própria área. Quem é admin ou gestor troca de área
   no seletor. Isso é recorte de tela, não tranca: o estado da operação é
   compartilhado por desenho, e quem quiser ver o de outra área consegue.
   ====================================================================== */
(function () {
  'use strict';

  const uid = () => (window.user && window.user.id) || 'vitor-gutierrez';
  const esc = (t) => String(t ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const lerLista = (k) => { try { const v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : [] } catch { return [] } };
  const tarefas = (marca) => lerLista(`central.tasks.${uid()}`).filter((t) => !marca || t.brand === marca);
  const campanhas = (marca) => lerLista(`central.campaigns.${uid()}`).filter((c) => !marca || c.brand === marca);

  /* ---------- a tradução ----------
     `setores` são as caixas de métrica do painel; `entregas` são as áreas
     de conferência, que falam de tipo de trabalho. Uma área de gente pode
     responder por mais de uma das duas — o Pedro cuida do tráfego e do
     site, a Sarah cuida de e-mail, grupos e API. */
  const MAPA = {
    'trafego':      { setores: ['trafego', 'site'], entregas: ['Tráfego', 'Site'] },
    'social-media': { setores: ['social_media'],    entregas: ['Instagram'] },
    'creators':     { setores: ['influenciadores'], entregas: ['Influencer'] },
    'automacoes':   { setores: ['automacoes'],      entregas: ['E-mail', 'Grupos', 'API'] },
    'atendimento':  { setores: ['atendimento'],     entregas: ['Atendimento'] },
    'copy':         { setores: [],                  entregas: ['Copy'] },
    'design':       { setores: [],                  entregas: ['Criativo'] },
    'gestao':       { setores: ['geral'],           entregas: ['Oferta'] },
  };
  const doMapa = (slug) => MAPA[slug] || { setores: [], entregas: [] };

  /* ---------- datas ---------- */
  const hojeSP = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const dISO = (s) => { const [a, m, d] = String(s || '').split('-').map(Number); return new Date(a, (m || 1) - 1, d || 1) };
  const dist = (de, ate) => Math.round((dISO(ate) - dISO(de)) / 86400000);
  const dBR = (s) => /^\d{4}-\d{2}-\d{2}/.test(String(s || '')) ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '—';
  const limpo = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

  /* ---------- quem é da área ---------- */
  function areasDoBanco() {
    const A = window.Acessos;
    const doBanco = (A && A.cache && Array.isArray(A.cache.areas) ? A.cache.areas : [])
      .filter((a) => a && a.nome);
    if (doBanco.length) return doBanco.map((a) => ({ id: a.id, nome: a.nome, slug: a.slug || limpo(a.nome).replace(/ /g, '-') }));
    /* sem cadastro carregado, vale a lista de tradução, para a tela não sumir */
    return Object.keys(MAPA).map((slug) => ({ id: slug, nome: slug, slug }));
  }

  function gente(area) {
    try {
      return (window.Acessos.equipe() || [])
        .filter((p) => p.areaId === area.id && p.ativo !== false);
    } catch { return [] }
  }

  const nomesDe = (pessoas) => {
    const n = [];
    for (const p of pessoas) { if (p.nome) n.push(p.nome); if (p.nomeClickup) n.push(p.nomeClickup) }
    return [...new Set(n)];
  };

  /* Tarefa da área é a que está com gente da área, ou a que é do tipo de
     entrega da área. As duas coisas, porque nenhuma sozinha cobre: tarefa
     sem responsável ainda é da área pelo tipo, e tarefa atípica com a
     pessoa certa ainda é dela. */
  function tarefasDaArea(area, marca) {
    const nomes = nomesDe(gente(area));
    const entregas = new Set(doMapa(area.slug).entregas);
    const C = window.Conferencia;
    return tarefas(marca).filter((t) => {
      if (nomes.length && (t.assignees || []).some((a) => nomes.includes(a))) return true;
      if (!entregas.size || !C || !C.areaDe) return false;
      return entregas.has(C.areaDe(t));
    });
  }

  /* ---------- micrometa ----------
     A meta do mês dividida pelo que sobrou dele: o quanto esta área
     precisa fazer HOJE para o mês fechar. Divide o que falta pelos dias
     que faltam, e não a meta pelos dias totais — assim ela sobe quando se
     atrasa e desce quando se adianta, que é o que a pessoa precisa saber
     de manhã. Métrica de nível (ROAS, CSAT) não se divide: mostra o alvo. */
  function micrometa(cfg, meta, realizado, diaHoje, dias) {
    if (meta == null || !isFinite(meta)) return null;
    if (cfg.tipo !== 'fluxo') return { tipo: 'nivel', valor: meta };
    const faltam = Math.max(1, (dias || 30) - (diaHoje || 0) + 1);
    const resta = Math.max(0, meta - (+realizado || 0));
    return { tipo: 'dia', valor: resta / faltam, resta, faltam };
  }


  /* ====================================================================
     O que só existe numa área

     A página de área é a mesma para todas — métricas, campanhas, projetos,
     tarefas. Mas cada área tem um trabalho que não cabe nesse molde: quem
     cuida de influenciadores precisa do ranking de quem vendeu, de quanto
     tem de comissão a pagar, e de mexer nos cupons sem pedir para
     ninguém. É isso que entra aqui, por slug de área.
     ==================================================================== */
  const EXTRAS = {
    creators: {
      /* o que buscar além do de sempre */
      pedir: async (ctx) => {
        const [setor, cup] = await Promise.all([
          ctx.pedir('setor', { setor: 'influenciadores', de: ctx.periodo.de, ate: ctx.periodo.ate }),
          ctx.pedir('cupons', { de: ctx.periodo.de, ate: ctx.periodo.ate }).catch(() => null),
        ]);
        return { ...(setor || {}), cadastro: (cup && cup.cadastro) || [] };
      },
      render: creators,
    },
  };

  const moedaBR = (v) => v == null || !isFinite(v) ? '—'
    : `R$ ${(+v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  function creators(ctx, x) {
    const { ui, fmt, periodo } = ctx;
    if (!x) return ui.cartao('Influenciadores', 'sem números', ui.vazio('Não consegui os números desta área agora.'));
    if (x.erro) return ui.cartao('Influenciadores', 'sem números', ui.vazio(x.erro));

    const k = x.kpis || {}, aq = x.aquisicao || {}, ranking = x.ranking || [];
    const cadastro = (x.cadastro || []).filter((c) => (c.tipo || '') === 'influencer');
    const venderam = new Set(ranking.map((r) => String(r.nome || '').trim()));
    const parados = cadastro.filter((c) => !venderam.has(String(c.nome || '').trim()));
    const janela = `${fmt.dBR(periodo.de)} a ${fmt.dBR(periodo.ate)}`;

    /* Comissão: quando o cupom é percentual, o desconto que o cliente teve é
       o que a marca deixou de ganhar — e é a conta que a gestora usa para
       fechar com cada creator. Vem pronta do banco por influencer. */
    const comissao = ranking.reduce((s, r) => s + (+r.desconto || 0), 0);

    const tiles = `<div class="pn-tiles">
      ${ui.tile({ rotulo: 'Faturamento por cupom', valor: fmt.moeda(k.faturamento, 0), nota: janela })}
      ${ui.tile({ rotulo: 'Vendas', valor: fmt.num(k.vendas), nota: `ticket ${fmt.moeda(k.ticket, 0)}` })}
      ${ui.tile({ rotulo: 'Creators que venderam', valor: fmt.num(k.ativos),
        nota: `${cadastro.length} cadastrados`, tom: parados.length ? 'atencao' : 'ok' })}
      ${ui.tile({ rotulo: 'Desconto dado', valor: fmt.moeda(comissao, 0),
        nota: k.faturamento ? `${fmt.pct(comissao * 100 / +k.faturamento, 1)} do faturamento` : '' })}
    </div>`;

    const seta = (t) => t === 'up' ? '<span class="pn-chip ok">subindo</span>'
      : t === 'down' ? '<span class="pn-chip critico">caindo</span>' : '<span class="pn-chip neutro">estável</span>';

    const tabelaRanking = ui.cartao('Quem vendeu', `${ranking.length} creator${ranking.length === 1 ? '' : 's'} com venda em ${janela}`,
      ranking.length ? ui.tabela([
        { t: 'Creator', f: (r) => `<b>${esc(r.nome)}</b><small class="pn-sub">${esc(r.codigos || '')}</small>` },
        { t: 'Faturamento', num: true, f: (r) => fmt.moeda(r.faturamento, 0) },
        { t: 'Vendas', num: true, f: (r) => fmt.num(r.vendas) },
        { t: 'Ticket', num: true, f: (r) => fmt.moeda(r.ticket, 0) },
        { t: 'Clientes novos', num: true, f: (r) => fmt.pct(r.pct_novos, 0) },
        { t: 'Desconto dado', num: true, f: (r) => fmt.moeda(r.desconto, 0) },
        { t: 'Últimos 7 dias', num: true, f: (r) => seta(r.tendencia) },
      ], ranking) : ui.vazio('Nenhum cupom de creator vendeu neste período.'));

    /* O número que a gestora cobra: quem tem cupom no ar e não vendeu nada. */
    const quietos = ui.cartao('Cadastrados que não venderam', `${parados.length} sem uma venda em ${janela}`,
      parados.length
        ? `<div class="cr-parados">${parados.map((c) => `<span class="cr-parado"><b>${esc(c.nome || c.codigo)}</b><small>${esc(c.codigo)}</small></span>`).join('')}</div>`
        : ui.vazio('Todo creator cadastrado vendeu neste período.'));

    const aquisicao = ui.cartao('De onde veio a venda', 'cliente novo contra quem já comprava',
      `<div class="cr-aq">
        <div class="cr-aq-linha"><span>Clientes novos</span><b>${moedaBR(aq.novos)}</b></div>
        <div class="cr-aq-linha"><span>Já eram clientes</span><b>${moedaBR(aq.recorrentes)}</b></div>
        <div class="cr-aq-barra">
          <i class="novo" style="width:${pctDe(aq.novos, aq.novos, aq.recorrentes)}%"></i>
          <i class="rec" style="width:${pctDe(aq.recorrentes, aq.novos, aq.recorrentes)}%"></i>
        </div>
        <small class="pn-sub">É o número que diz se o canal está trazendo gente nova ou vendendo de novo para quem já vinha.</small>
      </div>`);

    const serie = (x.serie || []).map((p) => ({ x: p.dia, y: +p.faturamento || 0 }));
    const porDia = ui.cartao('Faturamento por dia', 'pedidos com cupom de creator',
      serie.length ? ui.colunas(serie) : ui.vazio('Nenhuma venda por cupom no período.'));

    return tiles +
      `<div class="pn-grid-2">${tabelaRanking}${quietos}</div>` +
      `<div class="pn-grid-2">${aquisicao}${porDia}</div>` +
      cupons(ctx, cadastro);
  }

  const pctDe = (v, a, b) => {
    const t = (+a || 0) + (+b || 0);
    return t ? Math.round((+v || 0) * 100 / t) : 0;
  };

  /* ---------- os cupons, editáveis aqui mesmo ----------
     O banco já aceitava gravar cupom desde o começo (ação `cupom` em
     central_gravar), mas só a tela de Cupons mostrava a lista, sem deixar
     mexer. Quem cuida de creators mexe nisso toda semana — e ia pedir para
     alguém abrir o Supabase. */
  function cupons(ctx, cadastro) {
    const { ui } = ctx;
    const linhas = cadastro.length ? cadastro.map((c) => `
      <form class="cr-cupom" data-cr-cupom="${esc(c.codigo)}">
        <input name="codigo" value="${esc(c.codigo)}" readonly aria-label="Código">
        <input name="nome" value="${esc(c.nome || '')}" placeholder="Nome do creator" aria-label="Nome">
        <label class="cr-pct"><input name="percentual" type="number" step="any" min="0" max="99"
          value="${c.percentual == null ? '' : c.percentual}" aria-label="Desconto do cupom"><span>%</span></label>
        <button type="submit" class="cu-btn">Salvar</button>
        <button type="button" class="cr-x" data-cr-tirar="${esc(c.codigo)}" title="Tirar do acompanhamento">×</button>
      </form>`).join('') : ui.vazio('Nenhum cupom de creator cadastrado ainda.');

    return ui.cartao('Cupons dos creators', `${cadastro.length} acompanhados · dá para editar aqui`,
      `<div class="cr-cupons">${linhas}</div>
       <form class="cr-novo" data-cr-novo>
         <input name="codigo" placeholder="CÓDIGO" required aria-label="Código do cupom">
         <input name="nome" placeholder="Nome do creator" required aria-label="Nome do creator">
         <label class="cr-pct"><input name="percentual" type="number" step="any" min="0" max="99" placeholder="10" aria-label="Desconto"><span>%</span></label>
         <button type="submit" class="cu-btn primary">Acrescentar</button>
       </form>
       <p class="pn-nota">O desconto é o que o cliente ganha com o cupom — é dele que sai a conta do quanto a marca deixou de ganhar com cada creator.</p>`);
  }

  /* ====================================================================
     A tela
     ==================================================================== */
  function render(ctx) {
    const { ui, fmt, marca, st } = ctx;
    const hoje = hojeSP();
    const todas = areasDoBanco();
    if (!todas.length) return ui.vazio('Nenhuma área cadastrada ainda. Cadastre em Acessos.');

    const eu = window.CentralEu || null;
    const manda = !!eu && (eu.papel === 'admin' || eu.papel === 'gestor');
    const minha = eu && eu.area_id ? todas.find((a) => a.id === eu.area_id) : null;
    const escolhida = todas.find((a) => a.id === st.areaId) ||
      (manda ? (minha || todas[0]) : (minha || null));

    if (!escolhida) {
      return ui.vazio('Você ainda não está ligado a uma área. Peça a quem administra para escolher a sua em Acessos.');
    }

    const pessoas = gente(escolhida);
    const mapa = doMapa(escolhida.slug);
    const ts = tarefasDaArea(escolhida, marca);

    const seletor = manda
      ? `<div class="ar-troca"><span>Área</span><select data-ar-area>${todas.map((a) =>
          `<option value="${esc(a.id)}" ${a.id === escolhida.id ? 'selected' : ''}>${esc(a.nome)}</option>`).join('')}</select></div>`
      : `<span class="ar-fixa">${esc(escolhida.nome)}</span>`;

    return `<div class="ar-barra">
        ${seletor}
        <div class="ar-gente">${pessoas.length
          ? pessoas.map((p) => `<span class="ar-pessoa" title="${esc(p.cargo || '')}">${esc(p.nome)}</span>`).join('')
          : '<span class="ar-pessoa vazia">ninguém cadastrado nesta área</span>'}</div>
        ${manda && minha && minha.id !== escolhida.id ? `<button type="button" class="cu-btn" data-ar-minha="${esc(minha.id)}">Ver a minha</button>` : ''}
      </div>` +
      `<p class="pn-nota">Tudo nesta tela é da área ${esc(escolhida.nome)}: as tarefas de quem é dela e as do tipo de entrega dela, as campanhas onde essas tarefas estão, e as métricas dos setores que ela responde.</p>` +
      (EXTRAS[escolhida.slug] ? EXTRAS[escolhida.slug].render(ctx, ctx.extra) : '') +
      kpis(ctx, escolhida, mapa, hoje) +
      campanhasDaArea(ctx, escolhida, ts, hoje) +
      projetosDaArea(ctx, ts, hoje) +
      tarefasNaTela(ctx, ts, hoje);
  }

  /* ---------- KPIs, metas e micrometas ---------- */
  function kpis(ctx, area, mapa, hoje) {
    const { ui, fmt, dados } = ctx;
    if (!mapa.setores.length) {
      return ui.cartao('Métricas', `${esc(area.nome)} ainda não responde por número no painel`,
        ui.vazio('Esta área não tem métrica ligada. Quando tiver, ela aparece aqui com meta do mês e micrometa do dia.'));
    }
    if (!dados) return ui.cartao('Métricas', 'buscando…', ui.vazio('Buscando os números da marca.'));
    if (dados.erro) return ui.cartao('Métricas', 'sem números', ui.vazio(dados.erro));

    const d = dados;
    const metas = ctx.metasCom ? ctx.metasCom(d) : (d.metas || {});
    const real = ctx.comDerivadas
      ? ctx.comDerivadas({ ...(d.manuais || {}), ...(d.realizados || {}) }, d.manuais)
      : (d.realizados || {});
    const diaHoje = +d.dia_hoje || 0, dias = +d.dias || 30;

    const chaves = [...new Set([...Object.keys(ctx.METRICAS), ...Object.keys(metas), ...Object.keys(real)])]
      .filter((k) => mapa.setores.includes(ctx.partes(k).escopo) &&
                     (metas[k] || real[k] != null || ctx.METRICAS[k]));
    if (!chaves.length) return ui.cartao('Métricas', 'nada ligado ainda', ui.vazio('Nenhuma métrica destes setores tem meta nem realizado.'));

    const linhas = chaves.map((k) => {
      const cfg = ctx.metricaDe(k);
      const un = (metas[k] && metas[k].unidade) || cfg.un;
      const meta = metas[k] ? +metas[k].valor : null;
      const r = real[k] == null ? null : +real[k];
      const av = ctx.avaliar(k, r, meta, diaHoje, dias);
      const mm = micrometa(cfg, meta, r, diaHoje, dias);
      const casas = un === 'x' ? 2 : un === '%' ? 1 : 0;
      const hojeTxt = !mm ? '<span class="ar-sem">defina a meta</span>'
        : mm.tipo === 'nivel' ? `<b>${fmt.unidade(un, mm.valor, casas)}</b><small>manter o nível</small>`
        : mm.resta <= 0 ? '<b class="ok">meta batida</b><small>o mês já fechou</small>'
        : `<b>${fmt.unidade(un, mm.valor, casas)}</b><small>por dia, nos ${mm.faltam} que faltam</small>`;
      return `<tr>
        <td><b>${esc(cfg.nome)}</b><small class="pn-sub">${esc(ctx.partes(k).escopo)}${cfg.auto === 'mao' ? ' · lançado à mão' : ''}</small></td>
        <td class="num">${meta == null ? '—' : fmt.unidade(un, meta, casas)}</td>
        <td class="num"><span class="${av.cls}">${r == null ? '—' : fmt.unidade(un, r, casas)}</span><small class="pn-sub">${esc(av.texto)}</small></td>
        <td class="num ar-hoje">${hojeTxt}</td>
      </tr>`;
    }).join('');

    return ui.cartao('Métricas da área', `meta do mês, onde está, e o que precisa sair hoje · dia ${diaHoje} de ${dias}`,
      `<div class="pn-rolagem"><table class="pn-tabela"><thead><tr>
        <th>Métrica</th><th class="num">Meta do mês</th><th class="num">Onde está</th><th class="num">Micrometa de hoje</th>
      </tr></thead><tbody>${linhas}</tbody></table></div>`);
  }

  /* ---------- campanhas ---------- */
  function daCampanha(ts, c) {
    const n = limpo(c.name);
    return ts.filter((t) => {
      const p = limpo(t.project);
      if (!p || p === 'sem projeto') return false;
      return n === p || n.startsWith(p + ' ') || p.startsWith(n + ' ') || (n.startsWith(p) && p.length >= 5);
    });
  }

  function barra(feitas, total) {
    const pct = total ? Math.round((feitas / total) * 100) : 0;
    const falta = 100 - pct;
    return `<div class="ar-pct">
      <div class="ar-pct-barra"><i style="width:${pct}%"></i></div>
      <span><b>${pct}%</b> entregue · faltam ${falta}% (${total - feitas} de ${total})</span>
    </div>`;
  }

  function campanhasDaArea(ctx, area, ts, hoje) {
    const { ui } = ctx;
    const todasC = campanhas(ctx.marca);
    const linhas = todasC
      .map((c) => ({ c, minhas: daCampanha(ts, c) }))
      .filter((x) => x.minhas.length)
      .map((x) => {
        const feitas = x.minhas.filter((t) => t.status === 'feito').length;
        const atrasadas = x.minhas.filter((t) => t.status !== 'feito' && t.due && t.due < hoje).length;
        const quando = x.c.start && x.c.end
          ? (x.c.start > hoje ? `estreia em ${dist(hoje, x.c.start)} dia${dist(hoje, x.c.start) === 1 ? '' : 's'}`
            : x.c.end < hoje ? 'encerrada' : `no ar até ${dBR(x.c.end)}`)
          : '';
        return { ...x, feitas, atrasadas, quando };
      })
      .sort((a, b) => (b.atrasadas - a.atrasadas) || (a.minhas.length - a.feitas) - (b.minhas.length - b.feitas));

    if (!linhas.length) return ui.cartao('Campanhas', 'nenhuma agora',
      ui.vazio(`Nenhuma campanha tem tarefa de ${esc(area.nome)}.`));

    return ui.cartao('Campanhas desta área', `${linhas.length} com tarefa de ${esc(area.nome)}`,
      `<div class="ar-lista">${linhas.map((x) => `
        <div class="ar-item ${x.atrasadas ? 'critico' : ''}" data-ar-campanha="${esc(x.c.name)}">
          <div class="ar-item-topo">
            <b>${esc(x.c.name)}</b>
            <span>${esc(x.c.brand || '')}${x.quando ? ` · ${esc(x.quando)}` : ''}</span>
          </div>
          ${barra(x.feitas, x.minhas.length)}
          ${x.atrasadas ? `<div class="ar-alerta">${x.atrasadas} já passou do prazo</div>` : ''}
        </div>`).join('')}</div>`);
  }

  /* ---------- projetos: o que tem projeto mas não é campanha ---------- */
  function projetosDaArea(ctx, ts, hoje) {
    const { ui } = ctx;
    const nomes = new Set(campanhas(ctx.marca).map((c) => limpo(c.name)));
    const porProjeto = new Map();
    for (const t of ts) {
      const p = String(t.project || '').trim();
      if (!p || limpo(p) === 'sem projeto') continue;
      if ([...nomes].some((n) => n === limpo(p) || n.startsWith(limpo(p) + ' ') || limpo(p).startsWith(n + ' '))) continue;
      if (!porProjeto.has(p)) porProjeto.set(p, []);
      porProjeto.get(p).push(t);
    }
    if (!porProjeto.size) return '';
    const linhas = [...porProjeto.entries()]
      .map(([nome, lista]) => ({ nome, lista,
        feitas: lista.filter((t) => t.status === 'feito').length,
        atrasadas: lista.filter((t) => t.status !== 'feito' && t.due && t.due < hoje).length }))
      .sort((a, b) => (b.atrasadas - a.atrasadas) || (b.lista.length - a.lista.length));

    return ui.cartao('Projetos desta área', `${linhas.length} fora de campanha`,
      `<div class="ar-lista">${linhas.map((x) => `
        <div class="ar-item ${x.atrasadas ? 'critico' : ''}">
          <div class="ar-item-topo"><b>${esc(x.nome)}</b><span>${x.lista.length} tarefa${x.lista.length === 1 ? '' : 's'}</span></div>
          ${barra(x.feitas, x.lista.length)}
          ${x.atrasadas ? `<div class="ar-alerta">${x.atrasadas} já passou do prazo</div>` : ''}
        </div>`).join('')}</div>`);
  }

  /* ---------- as tarefas ---------- */
  function tarefasNaTela(ctx, ts, hoje) {
    const { ui } = ctx;
    const abertas = ts.filter((t) => t.status !== 'feito');
    const atrasadas = abertas.filter((t) => t.due && t.due < hoje);
    const deHoje = abertas.filter((t) => t.due === hoje);
    const semana = abertas.filter((t) => t.due && t.due > hoje && dist(hoje, t.due) <= 7);
    const semPrazo = abertas.filter((t) => !t.due);

    const linha = (t) => `<button type="button" class="ar-tarefa ${t.due && t.due < hoje ? 'vencida' : ''}" data-ar-tarefa="${esc(t.id)}">
      <b>${esc(t.title)}</b>
      <small>${esc((t.assignees || []).join(', ') || 'sem responsável')} · ${esc(t.project || 'Sem projeto')} · ${t.due ? dBR(t.due) : 'sem prazo'}</small>
    </button>`;
    const grupo = (nome, lista, cls) => lista.length
      ? `<div class="ar-grupo"><h4 class="${cls || ''}">${esc(nome)} · ${lista.length}</h4>${lista.slice(0, 10).map(linha).join('')}${lista.length > 10 ? `<small class="pn-sub">e mais ${lista.length - 10}</small>` : ''}</div>` : '';

    const corpo = grupo('Atrasadas', atrasadas, 'critico') + grupo('Vencem hoje', deHoje) +
                  grupo('Próximos 7 dias', semana) + grupo('Sem prazo', semPrazo);
    return ui.cartao('Tarefas da área', `${abertas.length} abertas · ${ts.length - abertas.length} concluídas`,
      corpo || ui.vazio('Nenhuma tarefa aberta nesta área.'));
  }

  /* ====================================================================
     Ligar no painel
     ==================================================================== */
  function ligar() {
    const P = window.Painel;
    if (!P || !P.registrar) return setTimeout(ligar, 150);
    const st = P.estado;

    P.registrar({
      id: 'area', nome: 'Área',
      render: async (ctx) => {
        const eu = window.CentralEu;
        const todas = areasDoBanco();
        const area = todas.find((x) => x.id === st.areaId) ||
                     (eu && eu.area_id ? todas.find((x) => x.id === eu.area_id) : null) || todas[0];
        const mapa = area ? doMapa(area.slug) : { setores: [] };

        const h = hojeSP();
        const pedirDados = mapa.setores.length
          ? ctx.pedir('setores', { ano: +h.slice(0, 4), mes: +h.slice(5, 7), de: ctx.periodo.de, ate: ctx.periodo.ate })
              .catch((e) => ({ erro: `Não consegui os números da ${ctx.marca}: ${(e && e.message) || e}` }))
          : Promise.resolve(null);
        const extraDa = area && EXTRAS[area.slug]
          ? EXTRAS[area.slug].pedir(ctx).catch((e) => ({ erro: `Não consegui os números desta área: ${(e && e.message) || e}` }))
          : Promise.resolve(null);

        const [dados, extra] = await Promise.all([pedirDados, extraDa]);
        return render({ ...ctx, dados, extra });
      },
    });

    const view = document.getElementById('painelView');
    if (!view) return;

    view.addEventListener('change', (e) => {
      const sel = e.target.closest?.('[data-ar-area]');
      if (!sel) return;
      st.areaId = sel.value;
      P.carregar(false);
    });

    view.addEventListener('submit', async (e) => {
      const f = e.target.closest?.('[data-cr-cupom],[data-cr-novo]');
      if (!f) return;
      e.preventDefault();
      const bt = f.querySelector('[type="submit"]');
      const antes = bt ? bt.textContent : '';
      if (bt) { bt.disabled = true; bt.textContent = 'Salvando…' }
      try {
        const pctBruto = String(f.percentual?.value ?? '').trim();
        await P.gravar('cupom', {
          codigo: String(f.codigo.value || '').trim().toUpperCase(),
          nome: String(f.nome.value || '').trim(),
          tipo: 'influencer',
          percentual: pctBruto === '' ? null : +pctBruto,
        });
        window.showToast?.('Cupom salvo');
        P.carregar(true);
      } catch (err) {
        window.showToast?.(`Não salvou: ${err.message}`);
        if (bt) { bt.disabled = false; bt.textContent = antes }
      }
    });

    view.addEventListener('click', async (e) => {
      const tirar = e.target.closest?.('[data-cr-tirar]');
      if (!tirar) return;
      const cod = tirar.dataset.crTirar;
      if (!window.confirm(`Tirar o cupom ${cod} do acompanhamento?\n\nO cupom continua valendo na loja — ele só deixa de ser medido aqui.`)) return;
      try { await P.gravar('cupom_excluir', { codigo: cod }); window.showToast?.('Cupom fora do acompanhamento'); P.carregar(true) }
      catch (err) { window.showToast?.(`Não tirei: ${err.message}`) }
    });

    view.addEventListener('click', (e) => {
      const minha = e.target.closest?.('[data-ar-minha]');
      if (minha) { st.areaId = minha.dataset.arMinha; return P.carregar(false) }

      const c = e.target.closest?.('[data-ar-campanha]');
      if (c) { window.openCampaignWorkspaceByName?.(c.dataset.arCampanha); return }

      const t = e.target.closest?.('[data-ar-tarefa]');
      if (t) {
        const id = t.dataset.arTarefa;
        document.getElementById('tasksNav')?.click();
        setTimeout(() => {
          document.querySelector(`.cu-row[data-task-id="${CSS.escape(id)}"]`)?.click() ||
          document.querySelector(`[data-task-id="${CSS.escape(id)}"]`)?.click();
        }, 140);
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ligar);
  else ligar();

  window.AreaTela = { MAPA, areasDoBanco, tarefasDaArea, micrometa, gente };
})();
