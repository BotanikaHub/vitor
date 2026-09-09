/* ======================================================================
   Equipe e rituais — as telas do Painel em que gente aparece.

   O Painel mostra o número. Este módulo mostra quem responde por ele, e
   dá lugar aos dois ritos da operação:

     Daily            — todo dia: ontem em números, o que vence hoje por
                        pessoa, o que travou, o que foi combinado.
     Reunião de KPI   — toda quinta: cada setor com dono, meta da semana,
                        realizado, leitura, decisões e ações.
     Pessoas          — quem é quem, de que área, em que marca; e tudo o
                        que cada um carrega: metas, tarefas, projetos, ações.
     Projetos         — as campanhas com dono, prazo, meta e o andamento
                        das tarefas de cada uma.

   Regras:
   - toda meta, ação, tarefa e projeto tem um dono; sem dono, a tela diz
     "sem dono" em vez de esconder;
   - o que se escreve aqui (donos, leituras, ações, cadastro de pessoas)
     vai para o localStorage em chaves `central.*` — e a ponte do Supabase
     leva ao banco, para todo mundo ver;
   - nenhuma tarefa é criada no ClickUp por aqui: as ações das reuniões
     vivem na Central até o Vitor liberar a escrita de volta.
   ====================================================================== */
(function () {
  'use strict';

  const uid = () => (window.user && window.user.id) || 'vitor-gutierrez';
  const K = {
    pessoas:  () => `central.pessoas.${uid()}`,
    donos:    () => `central.donos.${uid()}`,
    rituais:  () => `central.rituais.${uid()}`,
    feitas:   () => `central.feitas.${uid()}`,
    tarefas:  () => `central.tasks.${uid()}`,
    campanhas:() => `central.campaigns.${uid()}`,
  };
  const ler = (k, padrao) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? padrao : v } catch { return padrao } };
  const gravar = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const esc = (t) => String(t ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const MARCAS = ['Botanika', 'VermeFree'];
  const AREAS = [
    { id: 'gestao', nome: 'Gestão' }, { id: 'trafego', nome: 'Tráfego' }, { id: 'influenciadores', nome: 'Influenciadores' },
    { id: 'social_media', nome: 'Social media' }, { id: 'automacoes', nome: 'Automações' }, { id: 'atendimento', nome: 'Atendimento' },
    { id: 'design', nome: 'Design' }, { id: 'conteudo', nome: 'Conteúdo' }, { id: 'operacao', nome: 'Operação' },
  ];
  const areaNome = (id) => (AREAS.find((a) => a.id === id) || {}).nome || '';
  const primeiroNome = (n) => String(n || '').split('|')[0].trim().split(' ')[0];
  const novoId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  /* ---------- datas, em São Paulo ---------- */
  const hojeSP = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const somaDias = (iso, k) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10) };
  const diaSemana = (iso) => new Date(`${iso}T12:00:00Z`).getUTCDay(); // 0 = domingo
  const segundaDe = (iso) => somaDias(iso, -((diaSemana(iso) + 6) % 7));
  const semanaISO = (iso) => {
    const d = new Date(`${iso}T12:00:00Z`); const dia = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - dia + 3);
    const ano = d.getUTCFullYear();
    const jan4 = new Date(Date.UTC(ano, 0, 4));
    const n = 1 + Math.round(((d - jan4) / 86400000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
    return `${ano}-W${String(n).padStart(2, '0')}`;
  };
  const dBR = (iso) => /^\d{4}-\d{2}-\d{2}/.test(String(iso || '')) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—';
  const NOMES_DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

  /* ---------- tarefas e campanhas, como a ponte entrega ---------- */
  function tarefas(marca) {
    const ts = ler(K.tarefas(), []);
    return (Array.isArray(ts) ? ts : []).filter((t) => !marca || t.brand === marca);
  }
  function campanhas(marca) {
    const cs = ler(K.campanhas(), []);
    return (Array.isArray(cs) ? cs : []).filter((c) => !marca || c.brand === marca);
  }

  /* ---------- pessoas ----------
     quem aparece: quem está cadastrado, mais quem assina tarefa ou
     campanha e ainda não foi cadastrado (entra como ativo, sem área — a
     área quem diz é o Vitor) */
  function pessoas() {
    const lista = ler(K.pessoas(), []);
    const porNome = new Map((Array.isArray(lista) ? lista : []).map((p) => [p.nome, p]));
    const vistos = new Map();
    for (const t of tarefas()) for (const a of (t.assignees || [])) { if (!a) continue; const v = vistos.get(a) || { marcas: new Set(), n: 0 }; v.marcas.add(t.brand); v.n++; vistos.set(a, v) }
    for (const c of campanhas()) if (c.owner) { const v = vistos.get(c.owner) || { marcas: new Set(), n: 0 }; v.marcas.add(c.brand); vistos.set(c.owner, v) }
    for (const [nome, v] of vistos) if (!porNome.has(nome)) porNome.set(nome, { nome, area: '', funcao: '', marcas: [...v.marcas].filter(Boolean), ativo: true, origem: 'clickup' });
    return [...porNome.values()].map((p) => ({ ...p, marcas: Array.isArray(p.marcas) && p.marcas.length ? p.marcas : [...MARCAS], tarefas: (vistos.get(p.nome) || {}).n || 0 }))
      .sort((a, b) => (b.ativo - a.ativo) || (b.tarefas - a.tarefas) || a.nome.localeCompare(b.nome));
  }
  function gravarPessoa(nome, campos) {
    const lista = pessoas().map(({ tarefas: _t, ...p }) => p);
    let p = lista.find((x) => x.nome === nome);
    if (!p) { p = { nome, area: '', funcao: '', marcas: [...MARCAS], ativo: true, origem: 'manual' }; lista.push(p) }
    Object.assign(p, campos);
    gravar(K.pessoas(), lista);
  }
  const ativas = (marca) => pessoas().filter((p) => p.ativo && (!marca || (p.marcas || []).includes(marca)));

  /* ---------- donos ---------- */
  const donos = () => ler(K.donos(), {});
  const D = {
    ler: (marca, chave) => donos()[`${marca}|${chave}`] || '',
    gravar: (marca, chave, nome) => { const d = donos(); if (nome) d[`${marca}|${chave}`] = nome; else delete d[`${marca}|${chave}`]; gravar(K.donos(), d) },
    pessoas: () => ativas().map((p) => p.nome),
    /* o dono de uma métrica é o dela; sem ele, o do setor */
    de: (marca, chave) => D.ler(marca, chave) || D.ler(marca, `setor|${String(chave).split('|')[0]}`),
  };

  /* ---------- feitas: quando uma tarefa fechou ----------
     O ClickUp manda feitaEm. O que foi marcado como feito só aqui na
     Central não tem essa data — então anoto a primeira vez que vejo a
     tarefa como feita. */
  function feitaEm(t) {
    if (t.feitaEm) return t.feitaEm;
    if (t.status !== 'feito') return null;
    return ler(K.feitas(), {})[t.id] || null;
  }
  function anotarFeitas() {
    const reg = ler(K.feitas(), {}); let mudou = false; const h = hojeSP();
    for (const t of tarefas()) {
      if (t.status === 'feito' && !t.feitaEm && !reg[t.id]) { reg[t.id] = h; mudou = true }
      if (t.status !== 'feito' && reg[t.id]) { delete reg[t.id]; mudou = true }
    }
    if (mudou) gravar(K.feitas(), reg);
  }

  /* ---------- rituais: notas e ações ---------- */
  const rituais = () => { const r = ler(K.rituais(), {}); return { daily: r.daily || {}, kpi: r.kpi || {}, acoes: Array.isArray(r.acoes) ? r.acoes : [] } };
  const gravarRituais = (r) => gravar(K.rituais(), r);
  function nota(tipo, ref, caminho, valor) {
    const r = rituais(); const bloco = r[tipo][ref] || (r[tipo][ref] = {});
    let alvo = bloco; const partes = caminho.split('.');
    for (const p of partes.slice(0, -1)) alvo = alvo[p] || (alvo[p] = {});
    alvo[partes[partes.length - 1]] = valor; gravarRituais(r);
  }
  function lerNota(tipo, ref, caminho) {
    let alvo = rituais()[tipo][ref]; if (!alvo) return '';
    for (const p of caminho.split('.')) { alvo = alvo && alvo[p]; if (alvo == null) return '' }
    return typeof alvo === 'string' ? alvo : '';
  }
  function novaAcao({ texto, dono, prazo, origem, ref, marca }) {
    const r = rituais();
    r.acoes.push({ id: novoId(), texto: String(texto || '').trim(), dono: dono || '', prazo: prazo || '', feito: false, feitoEm: null, origem, ref, marca, criadaEm: hojeSP() });
    gravarRituais(r);
  }
  function mudarAcao(id, campos) {
    const r = rituais(); const a = r.acoes.find((x) => x.id === id); if (!a) return;
    Object.assign(a, campos);
    if ('feito' in campos) a.feitoEm = campos.feito ? hojeSP() : null;
    gravarRituais(r);
  }
  function apagarAcao(id) { const r = rituais(); r.acoes = r.acoes.filter((x) => x.id !== id); gravarRituais(r) }
  const acoes = (marca, filtro = () => true) => rituais().acoes.filter((a) => (!marca || a.marca === marca) && filtro(a));

  /* ---------- peças ---------- */
  function listaAcoes(itens, { vazioTxt = 'Nenhuma ação.', hoje = hojeSP() } = {}) {
    if (!itens.length) return `<div class="pn-vazio">${esc(vazioTxt)}</div>`;
    return `<div class="eq-acoes">${itens.map((a) => `<label class="eq-acao ${a.feito ? 'feita' : ''} ${!a.feito && a.prazo && a.prazo < hoje ? 'atrasada' : ''}"><input type="checkbox" data-eq-acao-feita="${a.id}" ${a.feito ? 'checked' : ''}><span class="eq-acao-texto">${esc(a.texto)}</span><span class="eq-acao-dono">${esc(a.dono || 'sem dono')}</span><span class="eq-acao-prazo">${a.prazo ? dBR(a.prazo) : '—'}${a.feito && a.feitoEm ? ` · feita ${dBR(a.feitoEm)}` : ''}</span><small class="eq-acao-origem">${a.origem === 'kpi' ? 'KPI' : 'daily'} ${esc(String(a.ref || '').split('|')[1] || '')}</small><button type="button" class="eq-x" data-eq-acao-apaga="${a.id}" title="apagar">×</button></label>`).join('')}</div>`;
  }
  function formAcao(origem, ref, marca, donoPadrao = '') {
    const nomes = ativas(marca).map((p) => p.nome);
    return `<form class="eq-form" data-eq-acao-nova data-origem="${origem}" data-ref="${esc(ref)}" data-eq-marca="${esc(marca)}"><input name="texto" placeholder="Nova ação: o que fica combinado" required><select name="dono" aria-label="Dono"><option value="">Dono</option>${nomes.map((n) => `<option ${n === donoPadrao ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select><input type="date" name="prazo" class="cu-filter" aria-label="Prazo"><button type="submit" class="cu-btn primary">Adicionar</button></form>`;
  }
  const area = (id, tipo, ref, caminho, rotulo, placeholder) => `<label class="eq-nota"><span>${esc(rotulo)}</span><textarea data-eq-nota data-tipo="${tipo}" data-ref="${esc(ref)}" data-caminho="${esc(caminho)}" placeholder="${esc(placeholder || '')}">${esc(lerNota(tipo, ref, caminho))}</textarea></label>`;

  const vencida = (t, hoje) => t.status !== 'feito' && t.due && t.due < hoje;
  const linhaTarefa = (t, hoje) => `<button type="button" class="eq-tarefa ${vencida(t, hoje) ? 'vencida' : ''}" data-eq-abre-tarefa="${esc(t.id)}"><b>${esc(t.title)}</b><small>${esc(t.project || '')} · ${t.due ? dBR(t.due) : 'sem prazo'} · ${esc(t.status)}</small></button>`;

  /* ======================= Daily ======================= */
  function metaResumo(mes, ui, fmt) {
    const meta = +(mes && mes.meta) || 0; if (!meta) return '';
    const dentro = (mes.ritmo || []).find((r) => r.nome === `Meta ${mes.meta_ativa || 1}`);
    return `<div class="eq-meta"><span>Meta do mês <b>${fmt.moeda(meta, 0)}</b></span><span>realizado <b>${fmt.moeda(mes.realizado, 0)}</b> (${fmt.pct(mes.pct, 0)})</span><span>esperado até hoje <b>${fmt.moeda(mes.esperado_ate_hoje, 0)}</b></span><span class="${dentro && dentro.dentro ? 'ok' : 'critico'}">${dentro ? (dentro.dentro ? 'no ritmo' : `faltam ${fmt.moeda(-dentro.gap, 0)}`) : ''}</span>${ui.ritmo(mes.realizado, meta, mes.esperado_ate_hoje)}</div>`;
  }

  async function daily(ctx) {
    const { ui, fmt, marca, pedir, st } = ctx;
    const hoje = hojeSP();
    const dia = st.eqDia || hoje;
    const ontem = somaDias(dia, -1);
    anotarFeitas();
    const mesIni = `${dia.slice(0, 7)}-01`, mesFim = fmt.fimDoMes(dia);
    const [visao, alertas, traf] = await Promise.all([
      pedir('visao', { de: mesIni, ate: mesFim }).catch(() => null),
      pedir('alertas', {}).catch(() => []),
      pedir('trafego', { de: ontem, ate: ontem }).catch(() => null),
    ]).then(([v, a, t]) => [v, Array.isArray(a) ? a : [], t]);
    const serie = (visao && visao.serie) || [];
    const valorDia = (d) => { const p = serie.find((x) => String(x.dia).slice(0, 10) === d); return p ? +p.faturamento : null };
    const fatOntem = dia === hoje ? (visao && visao.visao ? +visao.visao.faturamento_ontem : null) : valorDia(ontem);
    const janela = Array.from({ length: 7 }, (_, i) => valorDia(somaDias(ontem, -1 - i))).filter((v) => v != null);
    const media7 = janela.length ? janela.reduce((s, v) => s + v, 0) / janela.length : null;
    const k = (traf && traf.kpis) || {};
    const roasOntem = +k.investimento > 0 ? (+k.faturamento_atribuido || 0) / +k.investimento : null;
    const breakeven = traf && traf.breakeven ? +traf.breakeven.roas : null;

    const tiles = [
      ui.tile({ rotulo: `Faturamento de ${dBR(ontem)}`, valor: fmt.moeda(fatOntem), delta: media7 != null ? ui.delta(fatOntem, media7, { rotulo: 'vs média dos 7 dias antes' }) : '', tom: fatOntem != null && media7 != null ? (fatOntem < media7 * 0.6 ? 'critico' : fatOntem >= media7 ? 'ok' : '') : '' }),
      dia === hoje ? ui.tile({ rotulo: 'Hoje até agora', valor: fmt.moeda(visao && visao.visao && visao.visao.faturamento_hoje), nota: `atualizado ${fmt.hora(visao && visao.atualizado_em)}` }) : '',
      ui.tile({ rotulo: `Meta Ads em ${dBR(ontem)}`, valor: fmt.moeda(k.investimento), nota: `atribuído ${fmt.moeda(k.faturamento_atribuido, 0)} · ROAS ${fmt.vezes(roasOntem)}`, tom: roasOntem != null && breakeven ? (roasOntem < breakeven ? 'critico' : '') : '' }),
      ui.tile({ rotulo: 'Alertas agora', valor: fmt.num((alertas || []).length), nota: `${(alertas || []).filter((a) => a.severidade === 'critico').length} críticos`, tom: (alertas || []).some((a) => a.severidade === 'critico') ? 'critico' : (alertas || []).length ? 'atencao' : 'ok' }),
    ].join('');

    const ts = tarefas(marca);
    const pess = ativas(marca);
    const ref = `${marca}|${dia}`;
    const pendentes = acoes(marca, (a) => !a.feito && (!a.prazo || a.prazo <= dia));
    const doDia = acoes(marca, (a) => a.origem === 'daily' && a.ref === ref);
    const semDono = ts.filter((t) => t.status !== 'feito' && !(t.assignees || []).length && t.due && t.due <= dia);

    const cartoes = pess.map((p) => {
      const minhas = ts.filter((t) => (t.assignees || []).includes(p.nome));
      const hojeVence = minhas.filter((t) => t.status !== 'feito' && t.due === dia);
      const atrasadas = minhas.filter((t) => vencida(t, dia));
      const feitasOntem = minhas.filter((t) => t.status === 'feito' && feitaEm(t) && feitaEm(t) >= ontem && feitaEm(t) <= dia);
      const minhasAcoes = acoes(marca, (a) => !a.feito && a.dono === p.nome);
      const metas = Object.entries(donos()).filter(([ch, nome]) => nome === p.nome && ch.startsWith(`${marca}|`)).map(([ch]) => ch.slice(marca.length + 1));
      const tom = atrasadas.length ? 'critico' : hojeVence.length ? 'atencao' : 'ok';
      return `<section class="pn-card eq-pessoa ${tom}"><div class="pn-card-head"><strong>${esc(p.nome)}</strong><span>${esc(areaNome(p.area) || 'sem área')}${metas.length ? ` · responde por ${metas.length} ${metas.length === 1 ? 'meta' : 'metas'}` : ''}</span><span class="eq-contas"><b class="${atrasadas.length ? 'critico' : ''}">${atrasadas.length} atrasadas</b><b>${hojeVence.length} vencem hoje</b><b class="ok">${feitasOntem.length} feitas</b></span></div><div class="pn-card-body eq-pessoa-corpo">` +
        `<div class="eq-col"><h4>Vence hoje</h4>${hojeVence.length ? hojeVence.map((t) => linhaTarefa(t, dia)).join('') : '<div class="pn-vazio">nada para hoje</div>'}${atrasadas.length ? `<h4 class="critico">Atrasadas</h4>${atrasadas.slice(0, 6).map((t) => linhaTarefa(t, dia)).join('')}${atrasadas.length > 6 ? `<small class="pn-sub">e mais ${atrasadas.length - 6}</small>` : ''}` : ''}</div>` +
        `<div class="eq-col"><h4>Concluídas de ontem para hoje</h4>${feitasOntem.length ? feitasOntem.map((t) => linhaTarefa(t, dia)).join('') : '<div class="pn-vazio">nenhuma registrada</div>'}${minhasAcoes.length ? `<h4>Ações pendentes</h4>${listaAcoes(minhasAcoes, { hoje: dia })}` : ''}</div>` +
        `<div class="eq-col">${area(p.nome, 'daily', ref, `pessoas.${p.nome}.foco`, 'Foco de hoje', 'o que essa pessoa entrega hoje')}${area(p.nome, 'daily', ref, `pessoas.${p.nome}.travas`, 'Travas', 'o que está impedindo, e quem destrava')}</div>` +
        `</div></section>`;
    }).join('');

    return `<div class="eq-barra"><div class="eq-dia"><button type="button" class="cu-btn" data-eq-dia="-1">‹</button><input type="date" class="cu-filter" data-eq-dia-input value="${dia}"><button type="button" class="cu-btn" data-eq-dia="1">›</button><b>${NOMES_DIA[diaSemana(dia)]}, ${dBR(dia)}${dia === hoje ? ' · hoje' : ''}</b></div><button type="button" class="cu-btn" data-eq-copiar="daily">Copiar resumo</button></div>` +
      `<div class="pn-tiles">${tiles}</div>` +
      (visao && visao.mes ? ui.cartao('Ritmo do mês', `${visao.mes.mes}/${visao.mes.ano} · dia ${visao.mes.dia_hoje} de ${visao.mes.dias}`, metaResumo(visao.mes, ui, fmt)) : '') +
      ((alertas || []).length ? ui.cartao('Alertas para a daily', 'do painel, agora', `<div class="pn-alertas">${(alertas || []).slice(0, 6).map((a) => { const dono = D.de(marca, a.chave || `setor|${a.tela}`); return `<div class="pn-alerta ${a.severidade === 'critico' ? 'critico' : 'atencao'}"><i></i><div><b>${esc(a.titulo)}</b><small>${esc(a.detalhe || '')}${dono ? ` · dono ${esc(dono)}` : ' · sem dono'}</small></div></div>` }).join('')}</div>`) : '') +
      `<div class="eq-grid">${cartoes || '<div class="pn-vazio">Nenhuma pessoa ativa nesta marca. Cadastre em Pessoas.</div>'}</div>` +
      (semDono.length ? ui.cartao('Tarefas sem dono', `${semDono.length} vencidas ou vencendo hoje, sem responsável`, semDono.slice(0, 10).map((t) => linhaTarefa(t, dia)).join('')) : '') +
      ui.cartao('Combinado na daily', `${doDia.length} ${doDia.length === 1 ? 'ação' : 'ações'} de ${dBR(dia)}`, listaAcoes(doDia, { hoje: dia, vazioTxt: 'Nada combinado ainda.' }) + formAcao('daily', ref, marca)) +
      ui.cartao('Pendências abertas', `${pendentes.length} ações com prazo até ${dBR(dia)}, de qualquer dia`, listaAcoes(pendentes, { hoje: dia, vazioTxt: 'Nenhuma pendência. Bom sinal.' }));
  }

  /* ======================= Reunião de KPI ======================= */
  async function kpi(ctx) {
    const { ui, fmt, marca, pedir, st, SETORES, metricaDe, avaliar } = ctx;
    const hoje = hojeSP();
    const base = st.eqSemana || hoje;
    const seg = segundaDe(base), dom = somaDias(seg, 6), qui = somaDias(seg, 3);
    const semana = semanaISO(seg);
    const ref = `${marca}|${semana}`;
    const [ano, mes] = [+qui.slice(0, 4), +qui.slice(5, 7)];
    const d = await pedir('setores', { ano, mes });
    const sem = (d.semanas || []).find((s) => s.inicio <= qui && s.fim >= qui) || null;
    const anterior = (d.semanas || []).find((s) => s.fim === somaDias(seg, -1)) || null;
    const metasMes = ctx.metasCom ? ctx.metasCom(d) : (d.metas || {}), realMes = d.realizados || {};
    const ativaN = (d.meta_geral && +d.meta_geral.meta_ativa) || 1;
    const metaFat = d.meta_geral ? +d.meta_geral[`meta${ativaN}`] || 0 : 0;
    const esperadoFat = metaFat * (+d.dia_hoje || 0) / (+d.dias || 30);
    const realFat = +realMes['geral||faturamento_mes'] || 0;

    const chavesDe = (setorId) => [...new Set([...Object.keys(ctx.METRICAS), ...Object.keys(metasMes), ...Object.keys(realMes), ...Object.keys((sem && sem.realizados) || {})])]
      .filter((k) => k.split('|')[0] === setorId && (metasMes[k] || realMes[k] != null || (sem && sem.realizados && sem.realizados[k] != null)));

    const blocos = SETORES.map((s) => {
      const chaves = chavesDe(s.id);
      const dono = D.ler(marca, `setor|${s.id}`);
      const linhas = chaves.map((k) => {
        const cfg = metricaDe(k); const un = (metasMes[k] && metasMes[k].unidade) || cfg.un;
        const metaSem = sem && sem.metas ? sem.metas[k] : null, realSem = sem && sem.realizados ? sem.realizados[k] : null, realAnt = anterior && anterior.realizados ? anterior.realizados[k] : null;
        const av = avaliar(k, realMes[k], metasMes[k] ? metasMes[k].valor : null, +d.dia_hoje || 0, +d.dias || 30);
        const avSem = metaSem != null ? avaliar(k, realSem, metaSem, cfg.tipo === 'fluxo' ? (sem.dias || 7) : 1, sem.dias || 7) : null;
        const f = (v, c) => v == null ? '—' : fmt.unidade(un, v, c ?? (un === 'x' ? 2 : un === '%' ? 1 : 0));
        return `<tr><td><b>${esc(cfg.nome)}</b><small class="pn-sub">${esc(D.ler(marca, k) || dono || 'sem dono')}</small></td><td class="num">${f(metaSem)}</td><td class="num"><span class="${avSem ? avSem.cls : ''}">${f(realSem)}</span></td><td class="num">${realAnt == null || realSem == null ? ui.delta(null, null) : ui.delta(realSem, realAnt, { menor: cfg.sentido === 'menor' })}</td><td class="num">${f(metasMes[k] && metasMes[k].valor)}</td><td class="num"><span class="${av.cls}">${f(realMes[k])}</span><small class="pn-sub">${esc(av.texto)}</small></td></tr>`;
      }).join('');
      const tabela = chaves.length ? `<div class="pn-rolagem"><table class="pn-tabela"><thead><tr><th>Métrica</th><th class="num">Meta da semana</th><th class="num">Semana</th><th class="num">vs anterior</th><th class="num">Meta do mês</th><th class="num">Mês</th></tr></thead><tbody>${linhas}</tbody></table></div>` : ui.vazio('Sem métrica ligada neste setor.');
      return `<section class="pn-card eq-setor"><div class="pn-card-head"><strong>${esc(s.nome)}</strong><span>${dono ? `dono ${esc(dono)}` : '<em>sem dono</em>'} · ${chaves.length} métricas</span></div><div class="pn-card-body">${tabela}<div class="eq-notas">${area(s.id, 'kpi', ref, `setores.${s.id}.leitura`, 'Leitura da semana', 'o que aconteceu, e por quê')}${area(s.id, 'kpi', ref, `setores.${s.id}.decisoes`, 'Decisões', 'o que muda a partir de agora')}</div></div></section>`;
    }).join('');

    const daReuniao = acoes(marca, (a) => a.origem === 'kpi' && a.ref === ref);
    const pendencias = acoes(marca, (a) => a.origem === 'kpi' && a.ref !== ref && !a.feito);
    const fechadas = acoes(marca, (a) => a.feito && a.feitoEm && a.feitoEm >= seg && a.feitoEm <= dom);
    const ts = tarefas(marca);
    const feitasSemana = ts.filter((t) => t.status === 'feito' && feitaEm(t) && feitaEm(t) >= seg && feitaEm(t) <= dom);
    const atrasadas = ts.filter((t) => vencida(t, hoje));
    const porPessoa = ativas(marca).map((p) => ({ p, feitas: feitasSemana.filter((t) => (t.assignees || []).includes(p.nome)).length, atrasadas: atrasadas.filter((t) => (t.assignees || []).includes(p.nome)).length, abertas: ts.filter((t) => t.status !== 'feito' && (t.assignees || []).includes(p.nome)).length }));

    return `<div class="eq-barra"><div class="eq-dia"><button type="button" class="cu-btn" data-eq-semana="-7">‹</button><input type="date" class="cu-filter" data-eq-semana-input value="${qui}"><button type="button" class="cu-btn" data-eq-semana="7">›</button><b>Semana ${semana.slice(-2)} · ${dBR(seg)} a ${dBR(dom)} · reunião quinta ${dBR(qui)}</b></div><button type="button" class="cu-btn" data-eq-copiar="kpi">Copiar resumo</button></div>` +
      `<p class="pn-nota">Cada setor com dono, meta da semana (quando definida em Setores e metas), realizado da semana contra a anterior, e o acumulado do mês contra o ritmo. Escreva a leitura e as decisões; as ações ficam com dono e prazo, e voltam na próxima quinta até serem fechadas.</p>` +
      (metaFat ? ui.cartao('Faturamento', `meta ${ativaN} do mês`, metaResumo({ meta: metaFat, realizado: realFat, pct: realFat * 100 / metaFat, esperado_ate_hoje: esperadoFat, meta_ativa: ativaN, ritmo: [{ nome: `Meta ${ativaN}`, dentro: realFat >= esperadoFat, gap: realFat - esperadoFat }] }, ui, fmt)) : '') +
      ui.cartao('Pendências da reunião passada', `${pendencias.length} ações abertas de outras semanas`, listaAcoes(pendencias, { hoje, vazioTxt: 'Nenhuma pendência de reuniões anteriores.' })) +
      `<div class="eq-grid">${blocos}</div>` +
      ui.cartao('Execução da semana', `${feitasSemana.length} tarefas concluídas · ${atrasadas.length} atrasadas agora`, ui.tabela([
        { t: 'Pessoa', f: (x) => `<b>${esc(x.p.nome)}</b><small class="pn-sub">${esc(areaNome(x.p.area) || 'sem área')}</small>` },
        { t: 'Concluídas na semana', num: true, f: (x) => fmt.num(x.feitas) },
        { t: 'Abertas', num: true, f: (x) => fmt.num(x.abertas) },
        { t: 'Atrasadas', num: true, f: (x) => `<span class="${x.atrasadas ? 'critico' : ''}">${fmt.num(x.atrasadas)}</span>` },
      ], porPessoa, { vazioTexto: 'Nenhuma pessoa ativa nesta marca.' })) +
      ui.cartao('Ações desta reunião', `${daReuniao.length} combinadas · ${fechadas.length} fechadas na semana`, listaAcoes(daReuniao, { hoje, vazioTxt: 'Nada combinado ainda.' }) + formAcao('kpi', ref, marca));
  }

  /* ======================= Pessoas ======================= */
  async function pessoasTela(ctx) {
    const { ui, fmt, marca, pedir, metricaDe, avaliar } = ctx;
    const hoje = hojeSP();
    anotarFeitas();
    const d = await pedir('setores', { ano: +hoje.slice(0, 4), mes: +hoje.slice(5, 7) }).catch(() => ({}));
    const todas = pessoas();
    const ts = tarefas(marca), cs = campanhas(marca);
    const seg = segundaDe(hoje);

    const cadastro = `<div class="pn-rolagem"><table class="pn-tabela eq-cadastro"><thead><tr><th>Pessoa</th><th>Área</th><th>Função</th><th>Marcas</th><th>Ativa</th><th class="num">Tarefas</th></tr></thead><tbody>${todas.map((p) => `<tr class="${p.ativo ? '' : 'inativa'}"><td><b>${esc(p.nome)}</b><small class="pn-sub">${p.origem === 'clickup' ? 'vem do ClickUp' : 'cadastro manual'}</small></td>` +
      `<td><select data-eq-pessoa="${esc(p.nome)}" data-campo="area"><option value="">sem área</option>${AREAS.map((a) => `<option value="${a.id}" ${a.id === p.area ? 'selected' : ''}>${a.nome}</option>`).join('')}</select></td>` +
      `<td><input data-eq-pessoa="${esc(p.nome)}" data-campo="funcao" value="${esc(p.funcao || '')}" placeholder="função"></td>` +
      `<td>${MARCAS.map((m) => `<label class="eq-marca"><input type="checkbox" data-eq-pessoa="${esc(p.nome)}" data-campo="marca:${m}" ${(p.marcas || []).includes(m) ? 'checked' : ''}>${m}</label>`).join('')}</td>` +
      `<td><input type="checkbox" data-eq-pessoa="${esc(p.nome)}" data-campo="ativo" ${p.ativo ? 'checked' : ''}></td><td class="num">${fmt.num(p.tarefas)}</td></tr>`).join('')}</tbody></table></div>` +
      `<form class="eq-form" data-eq-pessoa-nova><input name="nome" placeholder="Nome de quem entra" required><select name="area"><option value="">Área</option>${AREAS.map((a) => `<option value="${a.id}">${a.nome}</option>`).join('')}</select><button type="submit" class="cu-btn primary">Adicionar pessoa</button></form>`;

    const cartoes = todas.filter((p) => p.ativo && (p.marcas || []).includes(marca)).map((p) => {
      const minhas = ts.filter((t) => (t.assignees || []).includes(p.nome));
      const abertas = minhas.filter((t) => t.status !== 'feito'), atrasadas = minhas.filter((t) => vencida(t, hoje));
      const feitasSem = minhas.filter((t) => t.status === 'feito' && feitaEm(t) && feitaEm(t) >= seg);
      const metas = Object.entries(donos()).filter(([ch, nome]) => nome === p.nome && ch.startsWith(`${marca}|`)).map(([ch]) => ch.slice(marca.length + 1));
      const metasHtml = metas.length ? metas.map((ch) => {
        if (ch.startsWith('setor|')) return `<div class="eq-meta-linha"><b>Setor ${esc((ctx.SETORES.find((s) => s.id === ch.slice(6)) || {}).nome || ch.slice(6))}</b><small>responde pelo setor inteiro</small></div>`;
        const cfg = metricaDe(ch); const m = (ctx.metasCom ? ctx.metasCom(d) : (d.metas || {}))[ch]; const un = (m && m.unidade) || cfg.un;
        const av = avaliar(ch, (d.realizados || {})[ch], m ? m.valor : null, +d.dia_hoje || 0, +d.dias || 30);
        return `<div class="eq-meta-linha ${av.cls}"><b>${esc(cfg.nome)}</b><span>${av.r == null ? '—' : fmt.unidade(un, av.r, un === 'x' ? 2 : un === '%' ? 1 : 0)} de ${av.m ? fmt.unidade(un, av.m, un === 'x' ? 2 : 0) : 'sem meta'}</span>${av.m ? ui.ritmo(av.r, av.m, av.esperado, { un }) : ''}<small class="${av.cls}">${esc(av.texto)}</small></div>`;
      }).join('') : '<div class="pn-vazio">Nenhuma meta atribuída. Atribua em Setores e metas.</div>';
      const projetos = cs.filter((c) => c.owner === p.nome);
      const pend = acoes(marca, (a) => !a.feito && a.dono === p.nome);
      return `<section class="pn-card eq-pessoa ${atrasadas.length ? 'critico' : 'ok'}"><div class="pn-card-head"><strong>${esc(p.nome)}</strong><span>${esc(areaNome(p.area) || 'sem área')}${p.funcao ? ` · ${esc(p.funcao)}` : ''}</span><span class="eq-contas"><b>${abertas.length} abertas</b><b class="${atrasadas.length ? 'critico' : ''}">${atrasadas.length} atrasadas</b><b class="ok">${feitasSem.length} feitas na semana</b></span></div><div class="pn-card-body eq-pessoa-corpo">` +
        `<div class="eq-col"><h4>Metas</h4>${metasHtml}</div>` +
        `<div class="eq-col"><h4>Tarefas</h4>${atrasadas.slice(0, 4).map((t) => linhaTarefa(t, hoje)).join('')}${abertas.filter((t) => !vencida(t, hoje)).slice(0, 4).map((t) => linhaTarefa(t, hoje)).join('') || (atrasadas.length ? '' : '<div class="pn-vazio">nenhuma aberta</div>')}${abertas.length > 8 ? `<small class="pn-sub">e mais ${abertas.length - 8} abertas</small>` : ''}</div>` +
        `<div class="eq-col"><h4>Projetos que lidera</h4>${projetos.length ? projetos.map((c) => `<button type="button" class="eq-tarefa" data-eq-abre-campanha="${esc(c.name)}"><b>${esc(c.name)}</b><small>${esc(c.status)} · ${dBR(c.start)} a ${dBR(c.end)}</small></button>`).join('') : '<div class="pn-vazio">nenhum</div>'}<h4>Ações pendentes</h4>${listaAcoes(pend, { hoje, vazioTxt: 'nenhuma' })}</div>` +
        `</div></section>`;
    }).join('');

    return `<p class="pn-nota">Quem assina tarefa no ClickUp entra sozinho na lista. A área, a função e as marcas são definidas aqui; a pessoa some das telas quando fica inativa, sem perder o histórico.</p>` +
      ui.cartao('Cadastro', `${todas.filter((p) => p.ativo).length} ativas de ${todas.length}`, cadastro) +
      `<div class="eq-grid">${cartoes || '<div class="pn-vazio">Nenhuma pessoa ativa nesta marca.</div>'}</div>`;
  }

  /* ======================= Projetos ======================= */
  async function projetos(ctx) {
    const { ui, fmt, marca } = ctx;
    const hoje = hojeSP();
    const ts = tarefas(marca), cs = campanhas(marca);
    const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    const nomes = ativas(marca).map((p) => p.nome);
    const linha = (c, tsDo) => {
      const feitas = tsDo.filter((t) => t.status === 'feito').length, atrasadas = tsDo.filter((t) => vencida(t, hoje)).length;
      const pct = tsDo.length ? Math.round(feitas / tsDo.length * 100) : 0;
      const gente = [...new Set(tsDo.flatMap((t) => t.assignees || []))];
      const cls = c.status === 'Concluída' ? 'neutro' : atrasadas ? 'critico' : c.status === 'Em execução' ? 'ok' : 'atencao';
      return { c, tsDo, feitas, atrasadas, pct, gente, cls };
    };
    const daCampanha = (c) => ts.filter((t) => norm(t.project) === norm(c.name));
    const linhas = cs.map((c) => linha(c, daCampanha(c))).sort((a, b) => String(a.c.start).localeCompare(String(b.c.start)));
    const usados = new Set(linhas.flatMap((l) => l.tsDo.map((t) => t.id)));
    const outros = [...new Set(ts.filter((t) => !usados.has(t.id)).map((t) => t.project || 'Sem projeto'))].map((nome) => linha({ id: `proj-${nome}`, name: nome, status: 'Sem campanha', owner: '', start: '', end: '', goal: 0, budget: 0, soProjeto: true }, ts.filter((t) => !usados.has(t.id) && (t.project || 'Sem projeto') === nome)))
      .sort((a, b) => b.tsDo.length - a.tsDo.length);

    const cols = [
      { t: 'Projeto', f: (l) => `${l.c.soProjeto ? `<b>${esc(l.c.name)}</b>` : `<button type="button" class="eq-link" data-eq-abre-campanha="${esc(l.c.name)}"><b>${esc(l.c.name)}</b></button>`}<small class="pn-sub">${esc(l.c.type || 'tarefas do ClickUp')}${l.c.start ? ` · ${dBR(l.c.start)} a ${dBR(l.c.end)}` : ''}</small>` },
      { t: 'Status', f: (l) => `<span class="pn-chip ${l.cls}">${esc(l.c.status)}</span>` },
      { t: 'Dono', f: (l) => l.c.soProjeto ? `<small class="pn-sub">${esc(l.gente[0] || 'sem dono')}</small>` : `<select class="pn-dono" data-eq-projeto-dono="${esc(l.c.id)}"><option value="">sem dono</option>${[...new Set([...nomes, l.c.owner].filter(Boolean))].map((n) => `<option ${n === l.c.owner ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>` },
      { t: 'Meta', num: true, f: (l) => l.c.goal ? fmt.moeda(l.c.goal, 0) : '—' },
      { t: 'Verba', num: true, f: (l) => l.c.budget ? fmt.moeda(l.c.budget, 0) : '—' },
      { t: 'Tarefas', num: true, f: (l) => `${l.feitas}/${l.tsDo.length}${l.atrasadas ? ` <span class="critico">· ${l.atrasadas} atrasadas</span>` : ''}` },
      { t: 'Andamento', f: (l) => `<div class="pn-ritmo ${l.pct >= 100 ? 'ok' : l.atrasadas ? 'critico' : ''}" title="${l.pct}%"><i style="width:${l.pct}%"></i></div>` },
      { t: 'Quem', f: (l) => l.gente.length ? l.gente.map((g) => `<span class="eq-av" title="${esc(g)}">${esc(primeiroNome(g))}</span>`).join(' ') : '<small class="pn-sub">ninguém</small>' },
    ];
    const ativasC = linhas.filter((l) => l.c.status !== 'Concluída'), concluidas = linhas.filter((l) => l.c.status === 'Concluída');
    return `<p class="pn-nota">As campanhas vêm do planejador; as tarefas de cada uma, do ClickUp, casadas pelo nome do projeto. O dono se define aqui e vale para a campanha inteira; quem executa aparece pelas tarefas.</p>` +
      ui.cartao('Campanhas em andamento e planejadas', `${ativasC.length} campanhas`, ui.tabela(cols, ativasC, { vazioTexto: 'Nenhuma campanha ativa nesta marca.' })) +
      (outros.length ? ui.cartao('Outros projetos', 'listas do ClickUp sem campanha no planejador', ui.tabela(cols, outros)) : '') +
      (concluidas.length ? ui.cartao('Concluídas', `${concluidas.length} campanhas`, ui.tabela(cols, concluidas)) : '');
  }

  /* ======================= resumo para copiar ======================= */
  function resumo(tipo, ctx) {
    const marca = ctx.marca; const hoje = hojeSP();
    const corpo = document.getElementById('painelCorpo'); if (!corpo) return '';
    const linhas = [];
    if (tipo === 'daily') {
      const dia = ctx.st.eqDia || hoje;
      linhas.push(`*Daily ${marca} · ${dBR(dia)}*`);
      corpo.querySelectorAll('.pn-tile').forEach((t) => linhas.push(`• ${t.querySelector('.pn-tile-rotulo').textContent}: ${t.querySelector('.pn-tile-valor').textContent}`));
      corpo.querySelectorAll('.eq-pessoa').forEach((c) => {
        const nome = c.querySelector('strong').textContent; const contas = c.querySelector('.eq-contas')?.textContent.replace(/\s+/g, ' ').trim();
        const foco = c.querySelector('textarea[data-caminho$=".foco"]')?.value.trim(); const travas = c.querySelector('textarea[data-caminho$=".travas"]')?.value.trim();
        linhas.push(`\n*${nome}* — ${contas}${foco ? `\n  foco: ${foco}` : ''}${travas ? `\n  travas: ${travas}` : ''}`);
      });
      const ac = acoes(marca, (a) => !a.feito);
      if (ac.length) { linhas.push('\n*Ações abertas*'); ac.forEach((a) => linhas.push(`☐ ${a.texto} — ${a.dono || 'sem dono'}${a.prazo ? ` até ${dBR(a.prazo)}` : ''}`)) }
    } else {
      linhas.push(`*Reunião de KPI ${marca} · ${corpo.querySelector('.eq-dia b')?.textContent || ''}*`);
      corpo.querySelectorAll('.eq-setor').forEach((c) => {
        linhas.push(`\n*${c.querySelector('strong').textContent}* (${c.querySelector('.pn-card-head span').textContent})`);
        c.querySelectorAll('tbody tr').forEach((tr) => { const td = [...tr.children].map((x) => x.textContent.replace(/\s+/g, ' ').trim()); linhas.push(`• ${td[0]}: semana ${td[2]} (meta ${td[1]}) · mês ${td[5]}`) });
        const leitura = c.querySelector('textarea[data-caminho$=".leitura"]')?.value.trim(); const dec = c.querySelector('textarea[data-caminho$=".decisoes"]')?.value.trim();
        if (leitura) linhas.push(`  leitura: ${leitura}`);
        if (dec) linhas.push(`  decisões: ${dec}`);
      });
      const ac = acoes(marca, (a) => a.origem === 'kpi' && !a.feito);
      if (ac.length) { linhas.push('\n*Ações*'); ac.forEach((a) => linhas.push(`☐ ${a.texto} — ${a.dono || 'sem dono'}${a.prazo ? ` até ${dBR(a.prazo)}` : ''}`)) }
    }
    return linhas.join('\n');
  }

  /* ======================= ligar ======================= */
  function ligar() {
    const P = window.Painel; if (!P) return;
    P.donos = D;
    P.registrar({ id: 'daily', nome: 'Daily', semPeriodo: true, render: daily });
    P.registrar({ id: 'kpi', nome: 'Reunião de KPI', semPeriodo: true, render: kpi });
    P.registrar({ id: 'pessoas', nome: 'Pessoas', semPeriodo: true, render: pessoasTela });
    P.registrar({ id: 'projetos', nome: 'Projetos', semPeriodo: true, render: projetos });

    const view = document.getElementById('painelView'); if (!view) return;
    const st = P.estado;
    const redesenhar = () => P.carregar(false);
    const ctx = () => ({ marca: st.marca, st });

    view.addEventListener('click', (e) => {
      const t = e.target.closest('[data-eq-dia],[data-eq-semana],[data-eq-acao-apaga],[data-eq-copiar],[data-eq-abre-tarefa],[data-eq-abre-campanha]');
      if (!t) return;
      if (t.dataset.eqDia) { st.eqDia = somaDias(st.eqDia || hojeSP(), +t.dataset.eqDia); return redesenhar() }
      if (t.dataset.eqSemana) { st.eqSemana = somaDias(st.eqSemana || hojeSP(), +t.dataset.eqSemana); return redesenhar() }
      if (t.dataset.eqAcaoApaga) { apagarAcao(t.dataset.eqAcaoApaga); return redesenhar() }
      if (t.dataset.eqCopiar) {
        const texto = resumo(t.dataset.eqCopiar, ctx());
        (navigator.clipboard ? navigator.clipboard.writeText(texto) : Promise.reject()).then(() => window.showToast?.('Resumo copiado'), () => { window.prompt('Copie o resumo:', texto) });
        return;
      }
      if (t.dataset.eqAbreTarefa) {
        const id = t.dataset.eqAbreTarefa;
        window.__centralShowTasks?.();
        setTimeout(() => { const row = document.querySelector(`[data-task-id="${CSS.escape(String(id))}"]`); if (row) row.click(); else window.showToast?.('Tarefa fora do filtro atual') }, 120);
        return;
      }
      if (t.dataset.eqAbreCampanha) window.openCampaignWorkspaceByName?.(t.dataset.eqAbreCampanha);
    });

    view.addEventListener('change', (e) => {
      const el = e.target;
      if (el.matches('[data-eq-dia-input]')) { if (el.value) { st.eqDia = el.value; redesenhar() } return }
      if (el.matches('[data-eq-semana-input]')) { if (el.value) { st.eqSemana = el.value; redesenhar() } return }
      if (el.matches('[data-eq-nota]')) { nota(el.dataset.tipo, el.dataset.ref, el.dataset.caminho, el.value); window.showToast?.('Anotado'); return }
      if (el.matches('[data-eq-acao-feita]')) { mudarAcao(el.dataset.eqAcaoFeita, { feito: el.checked }); return redesenhar() }
      if (el.matches('[data-eq-projeto-dono]')) {
        const cs = ler(K.campanhas(), []); const c = (Array.isArray(cs) ? cs : []).find((x) => String(x.id) === el.dataset.eqProjetoDono);
        if (c) { c.owner = el.value; gravar(K.campanhas(), cs); window.showToast?.(el.value ? `${el.value} lidera ${c.name}` : `${c.name} sem dono`) }
        return;
      }
      if (el.matches('[data-eq-pessoa]')) {
        const nome = el.dataset.eqPessoa, campo = el.dataset.campo;
        if (campo === 'ativo') gravarPessoa(nome, { ativo: el.checked });
        else if (campo.startsWith('marca:')) { const p = pessoas().find((x) => x.nome === nome); const m = new Set(p ? p.marcas : MARCAS); if (el.checked) m.add(campo.slice(6)); else m.delete(campo.slice(6)); gravarPessoa(nome, { marcas: [...m] }) }
        else gravarPessoa(nome, { [campo]: el.value });
        window.showToast?.('Cadastro salvo');
        if (campo === 'ativo' || campo.startsWith('marca:')) redesenhar();
      }
    });

    view.addEventListener('submit', (e) => {
      const f = e.target;
      if (f.matches('[data-eq-acao-nova]')) {
        e.preventDefault();
        if (!f.texto.value.trim()) return;
        novaAcao({ texto: f.texto.value, dono: f.dono.value, prazo: f.prazo.value, origem: f.dataset.origem, ref: f.dataset.ref, marca: f.dataset.eqMarca });
        return redesenhar();
      }
      if (f.matches('[data-eq-pessoa-nova]')) {
        e.preventDefault();
        const nome = f.nome.value.trim(); if (!nome) return;
        gravarPessoa(nome, { area: f.area.value, ativo: true, origem: 'manual' });
        return redesenhar();
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ligar); else ligar();

  window.Equipe = { pessoas, gravarPessoa, ativas, donos: D, tarefas, campanhas, feitaEm, rituais, novaAcao, mudarAcao, apagarAcao, acoes, semanaISO, segundaDe, AREAS };
})();
