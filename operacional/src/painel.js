/* ======================================================================
   O Painel — o acompanhamento, dentro da mesma Central que planeja.

   Até aqui a operação se definia aqui e se acompanhava em outro lugar:
   o Botanika Analytics e o VermeFree Analytics, dois apps no Lovable, cada
   um com o seu login. Este módulo traz as telas deles para cá — visão
   geral, tráfego, setores com metas e KPIs, estoque, cupons, alertas — e
   os números continuam sendo os de verdade: Shopify, Meta Ads, Instagram,
   lidos ao vivo do banco de cada marca por /api/painel.

   Nada aqui inventa número. Quando o painel de uma marca não responde, a
   tela diz isso; quando um dado não existe, mostra um traço.

   Como se encaixa no app: um botão a mais na barra lateral (#painelNav) e
   uma seção a mais (#painelView). O app não sabe da seção — então este
   módulo esconde as outras quando abre, e se esconde quando qualquer
   outra abre (observando as classes que o app troca).
   ====================================================================== */
(function () {
  'use strict';

  const ATUALIZA_MS = 45000;
  const CACHE_MS = 45000;
  const MARCAS = ['Botanika', 'VermeFree'];
  const REF_SB = 'sjkuysdmixfzeerxuudn';

  /* ---------- formatação, em português ---------- */
  const esc = (t) => String(t ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const n = (v) => (v == null || v === '' || Number.isNaN(+v)) ? null : +v;
  const num = (v, c = 0) => { const x = n(v); return x == null ? '—' : x.toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c }) };
  const moeda = (v, c = 2) => { const x = n(v); return x == null ? '—' : x.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: c, maximumFractionDigits: c }) };
  const pct = (v, c = 1) => { const x = n(v); return x == null ? '—' : `${num(x, c)}%` };
  const vezes = (v) => { const x = n(v); return x == null ? '—' : `${num(x, 2)}x` };
  const curto = (v) => { const x = n(v); if (x == null) return '—'; const a = Math.abs(x);
    if (a >= 1e6) return `${num(x / 1e6, 1)} mi`; if (a >= 1e3) return `${num(x / 1e3, a >= 1e4 ? 0 : 1)} mil`; return num(x, 0) };
  const dBR = (iso) => { const s = String(iso || ''); return /^\d{4}-\d{2}-\d{2}/.test(s) ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '—' };
  const dLonga = (iso) => { const s = String(iso || ''); return /^\d{4}-\d{2}-\d{2}/.test(s) ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '—' };
  const hora = (iso) => { if (!iso) return '—'; const d = new Date(iso); return Number.isNaN(d.getTime()) ? '—'
    : d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) };
  const unidade = (u, v, c) => u === 'R$' ? moeda(v, c ?? 0) : u === '%' ? pct(v, c ?? 1) : u === 'x' ? vezes(v) : num(v, c ?? 0);

  /* hoje em São Paulo, como o banco de lá conta */
  function hojeSP() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  }
  const somaDias = (iso, k) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10) };
  const fimDoMes = (iso) => { const d = new Date(`${iso.slice(0, 7)}-01T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0); return d.toISOString().slice(0, 10) };

  const PRESETS = [
    { id: 'hoje', nome: 'Hoje' }, { id: 'ontem', nome: 'Ontem' }, { id: '7d', nome: '7 dias' },
    { id: '30d', nome: '30 dias' }, { id: 'mes', nome: 'Este mês' }, { id: 'livre', nome: 'Período' },
  ];
  function periodoDe(preset, de, ate) {
    const h = hojeSP();
    switch (preset) {
      case 'hoje': return { de: h, ate: h };
      case 'ontem': return { de: somaDias(h, -1), ate: somaDias(h, -1) };
      case '7d': return { de: somaDias(h, -6), ate: h };
      case '30d': return { de: somaDias(h, -29), ate: h };
      case 'livre': return { de: de || `${h.slice(0, 7)}-01`, ate: ate || h };
      default: return { de: `${h.slice(0, 7)}-01`, ate: fimDoMes(h) };
    }
  }

  /* ---------- as telas e os setores ---------- */
  const TELAS = [
    { id: 'visao', nome: 'Visão geral' }, { id: 'trafego', nome: 'Tráfego' }, { id: 'setores', nome: 'Setores e metas' },
    { id: 'kpis', nome: 'KPIs' }, { id: 'estoque', nome: 'Estoque' }, { id: 'cupons', nome: 'Cupons' }, { id: 'alertas', nome: 'Alertas' },
  ];
  /* telas que outros módulos registram (equipe.js: Daily, Reunião de KPI,
     Pessoas, Projetos) — entram no cabeçalho num segundo grupo, e são
     desenhadas por quem as registrou, com as mesmas peças daqui. */
  const EXTRAS = [];
  const telaExtra = (id) => EXTRAS.find((t) => t.id === id);
  const SETORES = [
    { id: 'geral', nome: 'Geral' }, { id: 'trafego', nome: 'Tráfego' }, { id: 'site', nome: 'Site' },
    { id: 'influenciadores', nome: 'Influenciadores' },
    { id: 'social_media', nome: 'Social media' }, { id: 'automacoes', nome: 'Automações' }, { id: 'atendimento', nome: 'Atendimento' },
  ];
  /* chave = escopo|canal|metrica, como no banco de lá.
     fluxo: acumula no mês e se compara com o ritmo (meta × dia/dias);
     taxa: é um nível, e se compara direto com a meta. */
  /* ---------- o que cada setor responde ----------
     `auto` diz de onde o número vem: 'api' quando o banco da marca calcula
     sozinho (Shopify, Meta, Instagram, sessões), 'mao' quando alguém
     precisa lançar, e 'derivada' quando sai de uma conta entre os dois.
     O que é de mão aparece marcado na tela, para ninguém confundir número
     medido com número digitado. */
  const METRICAS = {
    /* ---------- geral ---------- */
    'geral||faturamento_mes':                 { nome: 'Faturamento',               tipo: 'fluxo', un: 'R$', auto: 'api' },
    'geral||pedidos':                         { nome: 'Pedidos',                   tipo: 'fluxo', un: 'un', auto: 'api' },
    'geral||ticket_medio':                    { nome: 'Ticket médio',              tipo: 'taxa',  un: 'R$', auto: 'api' },
    'geral||taxa_recompra':                   { nome: 'Taxa de recompra',          tipo: 'taxa',  un: '%',  auto: 'api' },
    'geral||conversao':                       { nome: 'Conversão',                 tipo: 'taxa',  un: '%',  auto: 'api' },
    'geral||sessoes':                         { nome: 'Sessões',                   tipo: 'fluxo', un: 'un', auto: 'api' },
    'geral||cac':                             { nome: 'CAC (custo por pedido)',    tipo: 'taxa',  un: 'R$', sentido: 'menor', auto: 'derivada' },
    /* ---------- tráfego ---------- */
    'trafego||investimento':                  { nome: 'Investimento',              tipo: 'fluxo', un: 'R$', auto: 'api' },
    'trafego||faturamento_atribuido':         { nome: 'Faturamento atribuído',     tipo: 'fluxo', un: 'R$', auto: 'api' },
    'trafego||roas_alvo':                     { nome: 'ROAS',                      tipo: 'taxa',  un: 'x',  auto: 'api' },
    'trafego||cpa_alvo':                      { nome: 'CPA',                       tipo: 'taxa',  un: 'R$', sentido: 'menor', auto: 'api' },
    'trafego||impressoes':                    { nome: 'Impressões',                tipo: 'fluxo', un: 'un', auto: 'api' },
    'trafego||cliques':                       { nome: 'Cliques no link',           tipo: 'fluxo', un: 'un', auto: 'api' },
    'trafego||ctr':                           { nome: 'CTR',                       tipo: 'taxa',  un: '%',  auto: 'derivada' },
    'trafego||cpc':                           { nome: 'Custo por clique',          tipo: 'taxa',  un: 'R$', sentido: 'menor', auto: 'derivada' },
    'trafego||cpm':                           { nome: 'CPM',                       tipo: 'taxa',  un: 'R$', sentido: 'menor', auto: 'api' },
    'trafego||frequencia':                    { nome: 'Frequência',                tipo: 'taxa',  un: 'x',  sentido: 'menor', auto: 'api' },
    'trafego||lp_views':                      { nome: 'Visitas à página',          tipo: 'fluxo', un: 'un', auto: 'api' },
    'trafego||clique_para_lp':                { nome: 'Clique → página',           tipo: 'taxa',  un: '%',  auto: 'derivada' },
    'trafego||checkouts_ads':                 { nome: 'Checkouts do anúncio',      tipo: 'fluxo', un: 'un', auto: 'api' },
    /* ---------- site ---------- */
    'site||sessoes':                          { nome: 'Sessões',                   tipo: 'fluxo', un: 'un', auto: 'api' },
    'site||conversao':                        { nome: 'Conversão',                 tipo: 'taxa',  un: '%',  auto: 'derivada' },
    'site||checkouts_iniciados':              { nome: 'Checkouts iniciados',       tipo: 'fluxo', un: 'un', auto: 'api' },
    'site||taxa_checkout':                    { nome: 'Sessão → checkout',         tipo: 'taxa',  un: '%',  auto: 'derivada' },
    'site||conclusao_checkout':               { nome: 'Checkout → pedido',         tipo: 'taxa',  un: '%',  auto: 'derivada' },
    'site||receita_por_sessao':               { nome: 'Receita por sessão',        tipo: 'taxa',  un: 'R$', auto: 'derivada' },
    'site||velocidade':                       { nome: 'Velocidade da página (s)',  tipo: 'taxa',  un: 'un', sentido: 'menor', auto: 'mao' },
    /* ---------- influenciadores ---------- */
    'influenciadores||faturamento_influencer':{ nome: 'Faturamento via influencer',tipo: 'fluxo', un: 'R$', auto: 'api' },
    'influenciadores||influencers_ativos':    { nome: 'Influencers ativos',        tipo: 'taxa',  un: 'un', auto: 'api' },
    'influenciadores||pct_clientes_novos':    { nome: 'Clientes novos',            tipo: 'taxa',  un: '%',  auto: 'api' },
    'influenciadores||fat_por_influencer':    { nome: 'Faturamento por influencer',tipo: 'taxa',  un: 'R$', auto: 'derivada' },
    'influenciadores||comissao':              { nome: 'Comissão paga',             tipo: 'fluxo', un: 'R$', auto: 'api' },
    'influenciadores||roi':                   { nome: 'Retorno sobre comissão',    tipo: 'taxa',  un: 'x',  auto: 'derivada' },
    'influenciadores||publicacoes':           { nome: 'Publicações no ar',         tipo: 'fluxo', un: 'un', auto: 'mao' },
    /* ---------- social media ---------- */
    'social_media||visualizacoes':            { nome: 'Visualizações',             tipo: 'fluxo', un: 'un', auto: 'api' },
    'social_media||interacoes':               { nome: 'Interações',                tipo: 'fluxo', un: 'un', auto: 'api' },
    'social_media||cliques_link':             { nome: 'Cliques no link',           tipo: 'fluxo', un: 'un', auto: 'api' },
    'social_media||taxa_clique':              { nome: 'Views → clique',            tipo: 'taxa',  un: '%',  auto: 'derivada' },
    'social_media||seguidores':               { nome: 'Seguidores',                tipo: 'taxa',  un: 'un', auto: 'api' },
    'social_media||seguidores_liquidos':      { nome: 'Seguidores líquidos',       tipo: 'fluxo', un: 'un', auto: 'api' },
    'social_media||vendas_link':              { nome: 'Vendas pelo link',          tipo: 'fluxo', un: 'R$', auto: 'api' },
    'social_media||vendas_bio':               { nome: 'Vendas · link da bio',      tipo: 'fluxo', un: 'R$', auto: 'api' },
    'social_media||vendas_stories':           { nome: 'Vendas · stories',          tipo: 'fluxo', un: 'R$', auto: 'api' },
    'social_media||vendas_live':              { nome: 'Vendas · live',             tipo: 'fluxo', un: 'R$', auto: 'api' },
    'social_media||publicacoes':              { nome: 'Publicações no ar',         tipo: 'fluxo', un: 'un', auto: 'mao' },
    /* ---------- automações ---------- */
    'automacoes|email|faturamento':           { nome: 'E-mail · faturamento',      tipo: 'fluxo', un: 'R$', auto: 'api' },
    'automacoes|email|pedidos':               { nome: 'E-mail · pedidos',          tipo: 'fluxo', un: 'un', auto: 'api' },
    'automacoes|email|disparos':              { nome: 'E-mail · enviados',         tipo: 'fluxo', un: 'un', auto: 'api' },
    'automacoes|email|conversao':             { nome: 'E-mail · conversão',        tipo: 'taxa',  un: '%',  auto: 'derivada' },
    'automacoes|whatsapp_api|faturamento':    { nome: 'API · faturamento',         tipo: 'fluxo', un: 'R$', auto: 'api' },
    'automacoes|whatsapp_api|pedidos':        { nome: 'API · pedidos',             tipo: 'fluxo', un: 'un', auto: 'api' },
    'automacoes|whatsapp_api|disparos':       { nome: 'API · mensagens enviadas',  tipo: 'fluxo', un: 'un', auto: 'api' },
    'automacoes|whatsapp_api|entregues':      { nome: 'API · entregues',           tipo: 'fluxo', un: 'un', auto: 'api' },
    'automacoes|whatsapp_api|gastos':         { nome: 'API · gastos',              tipo: 'fluxo', un: 'R$', sentido: 'menor', auto: 'api' },
    'automacoes|whatsapp_api|conversao':      { nome: 'API · conversão',           tipo: 'taxa',  un: '%',  auto: 'derivada' },
    'automacoes|grupos|faturamento':          { nome: 'Grupos · faturamento',      tipo: 'fluxo', un: 'R$', auto: 'api' },
    'automacoes|grupos|pedidos':              { nome: 'Grupos · pedidos',          tipo: 'fluxo', un: 'un', auto: 'api' },
    'automacoes|grupos|disparos':             { nome: 'Grupos · mensagens enviadas', tipo: 'fluxo', un: 'un', auto: 'mao' },
    'automacoes|grupos|conversao':            { nome: 'Grupos · conversão',        tipo: 'taxa',  un: '%',  auto: 'derivada' },
    /* ---------- atendimento ---------- */
    'atendimento||volume':                    { nome: 'Atendimentos',              tipo: 'fluxo', un: 'un', auto: 'mao' },
    'atendimento||tempo_resposta':            { nome: 'Tempo de resposta (min)',   tipo: 'taxa',  un: 'un', sentido: 'menor', auto: 'mao' },
    'atendimento||csat':                      { nome: 'Satisfação (CSAT)',         tipo: 'taxa',  un: '%',  auto: 'mao' },
    'atendimento||fila_aberta':               { nome: 'Fila aberta agora',         tipo: 'taxa',  un: 'un', sentido: 'menor', auto: 'mao' },
    'atendimento||por_pedido':                { nome: 'Atendimentos por pedido',   tipo: 'taxa',  un: 'x',  sentido: 'menor', auto: 'derivada' },
  };
  const CANAIS = { email: 'E-mail', whatsapp_api: 'WhatsApp API', grupos: 'Grupos' };
  const partes = (chave) => { const [escopo, canal, metrica] = String(chave).split('|'); return { escopo, canal: canal || '', metrica } };
  const metricaDe = (chave) => METRICAS[chave] || { nome: partes(chave).metrica.replace(/_/g, ' '), tipo: 'fluxo', un: 'un' };

  /* ---------- estado ---------- */
  const st = {
    tela: 'visao', marca: 'Botanika', preset: 'mes', de: '', ate: '', setor: 'todos',
    cache: {}, timer: null, erro: null, carregando: false, em: null, aberto: false,
    editando: null, abertos: {},
  };

  /* ---------- a ponte ---------- */
  async function jwt() {
    try {
      if (typeof window.CentralSessao === 'function') {
        const s = await window.CentralSessao();
        if (s && s.access_token) return s.access_token;
      }
    } catch { /* cai no localStorage */ }
    try {
      const bruto = localStorage.getItem(`sb-${REF_SB}-auth-token`);
      const j = bruto ? JSON.parse(bruto) : null;
      return (j && j.access_token) || '';
    } catch { return '' }
  }

  async function pedir(tela, args, forcar) {
    const chave = `${st.marca}|${tela}|${JSON.stringify(args)}`;
    const c = st.cache[chave];
    if (!forcar && c && Date.now() - c.em < CACHE_MS) return c.dados;
    const q = new URLSearchParams({ marca: st.marca, tela, ...args });
    const r = await fetch(`/api/painel?${q}`, { headers: { Authorization: `Bearer ${await jwt()}` } });
    let corpo = null;
    try { corpo = await r.json() } catch { corpo = null }
    if (!r.ok) throw Object.assign(new Error((corpo && corpo.erro) || `HTTP ${r.status}`), { status: r.status });
    st.cache[chave] = { em: Date.now(), dados: corpo.dados };
    st.em = corpo.em || new Date().toISOString();
    return corpo.dados;
  }

  async function gravar(acao, dados) {
    const r = await fetch('/api/painel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await jwt()}` },
      body: JSON.stringify({ marca: st.marca, acao, dados }),
    });
    let corpo = null;
    try { corpo = await r.json() } catch { corpo = null }
    if (!r.ok || !corpo || corpo.ok === false) throw new Error((corpo && corpo.erro) || `HTTP ${r.status}`);
    st.cache = {};
    return corpo;
  }

  /* ---------- peças de desenho ---------- */
  function delta(atual, anterior, { menor = false, rotulo = '' } = {}) {
    const a = n(atual), b = n(anterior);
    if (a == null || b == null || b === 0) return `<span class="pn-delta flat">— <small>${esc(rotulo)}</small></span>`;
    const d = (a - b) / Math.abs(b) * 100;
    const bom = menor ? d <= 0 : d >= 0;
    const cls = Math.abs(d) < 0.05 ? 'flat' : bom ? 'up' : 'down';
    const seta = Math.abs(d) < 0.05 ? '=' : d > 0 ? '▲' : '▼';
    return `<span class="pn-delta ${cls}">${seta} ${num(Math.abs(d), 1)}% <small>${esc(rotulo)}</small></span>`;
  }

  function tile({ rotulo, valor, nota = '', delta: dl = '', tom = '' }) {
    return `<div class="pn-tile ${tom}"><div class="pn-tile-rotulo">${esc(rotulo)}</div><div class="pn-tile-valor">${valor}</div>` +
      `<div class="pn-tile-nota">${dl}${nota ? `<span>${nota}</span>` : ''}</div></div>`;
  }

  function cartao(titulo, sub, corpo, extra = '') {
    return `<section class="pn-card ${extra}"><div class="pn-card-head"><strong>${esc(titulo)}</strong>${sub ? `<span>${sub}</span>` : ''}</div><div class="pn-card-body">${corpo}</div></section>`;
  }

  const vazio = (t) => `<div class="pn-vazio">${esc(t)}</div>`;

  /* barra de progresso com a marca do "esperado até hoje" */
  function ritmo(realizado, meta, esperado, { un = 'R$' } = {}) {
    const r = n(realizado) || 0, m = n(meta) || 0, e = n(esperado);
    const p = m > 0 ? Math.min(100, r / m * 100) : 0;
    const pe = m > 0 && e != null ? Math.min(100, e / m * 100) : null;
    const dentro = e == null ? r >= m : r >= e;
    const cls = m <= 0 ? 'sem' : dentro ? 'ok' : (e != null && r / e >= 0.8) || (e == null && r / m >= 0.8) ? 'atencao' : 'critico';
    return `<div class="pn-ritmo ${cls}" title="${esc(`${unidade(un, r)} de ${unidade(un, m)}`)}"><i style="width:${p}%"></i>` +
      (pe != null ? `<b style="left:${pe}%" title="esperado até hoje: ${esc(unidade(un, e))}"></b>` : '') + `</div>`;
  }

  /* gráfico de colunas: uma medida, um eixo, marcas finas, ponta arredondada
     colada na base, tooltip por coluna. Texto sempre em tinta, nunca na cor
     da série. */
  function colunas(pontos, { formato = curto, formatoTip = (v) => moeda(v), rotuloX = dBR, altura = 170, cor = 'var(--pn-serie)' } = {}) {
    if (!pontos.length) return vazio('Sem dados no período.');
    const W = 640, H = altura, pl = 44, pr = 6, pt = 8, pb = 22;
    const ys = pontos.map((p) => n(p.y) || 0);
    const bruto = Math.max(...ys, 0);
    const passo = bruto > 0 ? Math.pow(10, Math.floor(Math.log10(bruto))) : 1;
    let max = Math.ceil(bruto / (passo / 2)) * (passo / 2) || 1;
    if (max === bruto) max = bruto + passo / 2;
    const cy = (v) => pt + (H - pt - pb) * (1 - v / max);
    const slot = (W - pl - pr) / pontos.length;
    const larg = Math.max(2, Math.min(28, slot - 3));
    const cada = Math.max(1, Math.ceil(pontos.length / 8));
    const grade = [0, 0.5, 1].map((f) => `<line x1="${pl}" x2="${W - pr}" y1="${cy(max * f)}" y2="${cy(max * f)}" class="pn-grade"/>` +
      `<text x="${pl - 6}" y="${cy(max * f) + 3}" class="pn-eixo" text-anchor="end">${esc(formato(max * f))}</text>`).join('');
    const barras = pontos.map((p, i) => {
      const y = n(p.y) || 0, x = pl + i * slot + (slot - larg) / 2, top = cy(y), h = Math.max(0, cy(0) - top);
      const r = Math.min(4, larg / 2, h);
      const d = h <= 0 ? '' : `M${x},${cy(0)} v${-(h - r)} a${r},${r} 0 0 1 ${r},${-r} h${larg - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${h - r} z`;
      const tip = p.tip || `${rotuloX(p.x)} · ${formatoTip(y)}`;
      const rot = i % cada === 0 ? `<text x="${x + larg / 2}" y="${H - 6}" class="pn-eixo" text-anchor="middle">${esc(rotuloX(p.x))}</text>` : '';
      return `${d ? `<path d="${d}" fill="${cor}" class="pn-barra-svg ${p.cls || ''}"/>` : ''}${rot}` +
        `<rect x="${pl + i * slot}" y="${pt}" width="${slot}" height="${H - pt - pb}" class="pn-hit" data-tip="${esc(tip)}"/>`;
    }).join('');
    return `<svg class="pn-grafico" viewBox="0 0 ${W} ${H}" role="img" aria-label="gráfico de colunas">${grade}${barras}</svg>`;
  }

  /* faísca: uma linha de 2px, sem eixo, para um cartão pequeno */
  function faisca(valores, largura = 120, altura = 30) {
    const vs = (valores || []).map((v) => n(v) || 0);
    if (vs.length < 2) return '';
    const max = Math.max(...vs, 1);
    const pts = vs.map((v, i) => `${(i / (vs.length - 1) * (largura - 4) + 2).toFixed(1)},${(altura - 3 - (v / max) * (altura - 6)).toFixed(1)}`).join(' ');
    return `<svg class="pn-faisca" viewBox="0 0 ${largura} ${altura}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="var(--pn-serie)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  }

  /* barras horizontais em HTML: ranking de uma medida, rótulo direto */
  function barrasH(linhas, { valor = (l) => l.faturamento, rotulo = (l) => l.nome, formato = (v) => moeda(v, 0), sub = () => '' } = {}) {
    if (!linhas.length) return vazio('Nada no período.');
    const max = Math.max(...linhas.map((l) => n(valor(l)) || 0), 1);
    return `<div class="pn-barras">${linhas.map((l) => { const v = n(valor(l)) || 0; return `<div class="pn-barra-linha"><div class="pn-barra-rotulo"><b>${esc(rotulo(l))}</b>${sub(l) ? `<small>${esc(sub(l))}</small>` : ''}</div>` +
      `<div class="pn-barra"><i style="width:${(v / max * 100).toFixed(1)}%"></i></div><div class="pn-barra-valor">${formato(v)}</div></div>` }).join('')}</div>`;
  }

  function tabela(cols, linhas, { vazioTexto = 'Nada por aqui.', classe = '' } = {}) {
    if (!linhas.length) return vazio(vazioTexto);
    return `<div class="pn-rolagem"><table class="pn-tabela ${classe}"><thead><tr>${cols.map((c) => `<th class="${c.num ? 'num' : ''}">${esc(c.t)}</th>`).join('')}</tr></thead>` +
      `<tbody>${linhas.map((l) => `<tr${l.__cls ? ` class="${l.__cls}"` : ''}>${cols.map((c) => `<td class="${c.num ? 'num' : ''}">${c.f(l)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  const sev = (s) => s === 'critico' ? 'critico' : s === 'atencao' ? 'atencao' : 'ok';
  const chipStatus = (s, t) => `<span class="pn-chip ${sev(s)}">${esc(t || s)}</span>`;

  /* ---------- Visão geral ---------- */
  function rVisao(d) {
    const v = d.visao || {}, a = d.anterior || {}, m = d.mes || {}, c = d.clientes || {}, rc = d.recompra || {}, re = d.reembolso || {};
    const rot = a.rotulo || 'vs período anterior';
    const tiles = [
      tile({ rotulo: 'Faturamento', valor: moeda(v.faturamento), delta: delta(v.faturamento, a.faturamento, { rotulo: rot }) }),
      tile({ rotulo: 'Pedidos pagos', valor: num(v.pedidos), delta: delta(v.pedidos, a.pedidos, { rotulo: rot }), nota: `${num(v.pedidos_totais)} no total · ${pct(v.status && v.status.taxa_aprovacao)} aprovados` }),
      tile({ rotulo: 'Ticket médio', valor: moeda(v.ticket), delta: delta(v.ticket, a.ticket, { rotulo: rot }) }),
      tile({ rotulo: 'Unidades', valor: num(v.unidades), delta: delta(v.unidades, a.unidades, { rotulo: rot }), nota: `${num(v.itens_por_pedido, 1)} itens por pedido` }),
      tile({ rotulo: 'Recompra', valor: pct(rc.taxa), delta: delta(rc.taxa, a.recompra, { rotulo: rot }), nota: `${num(rc.recompradores)} de ${num(rc.clientes)} clientes` }),
      tile({ rotulo: 'Hoje', valor: moeda(v.faturamento_hoje), delta: delta(v.faturamento_hoje, v.faturamento_ontem, { rotulo: 'vs ontem' }), nota: `ontem ${moeda(v.faturamento_ontem, 0)}` }),
    ].join('');

    const metaHtml = (() => {
      const meta = n(m.meta) || 0;
      if (!meta) return vazio('Sem meta definida para este mês. Defina em Setores e metas.');
      const ritmos = (m.ritmo || []).map((r) => `<div class="pn-meta-linha"><span>${esc(r.nome)} · ${moeda(r.total, 0)}</span>${ritmo(m.realizado, r.total, r.esperado)}<b class="${r.dentro ? 'ok' : 'critico'}">${r.dentro ? 'no ritmo' : `faltam ${moeda(-r.gap, 0)}`}</b></div>`).join('');
      return `<div class="pn-meta"><div class="pn-meta-topo"><div><small>Realizado no mês</small><b>${moeda(m.realizado, 0)}</b></div>` +
        `<div><small>Meta ${m.meta_ativa || 1}</small><b>${moeda(meta, 0)}</b></div><div><small>Atingido</small><b>${pct(m.pct)}</b></div>` +
        `<div><small>Projeção</small><b>${moeda(m.projecao, 0)}</b></div><div><small>Por dia para bater</small><b>${moeda(Math.max(0, (meta - (n(m.realizado) || 0)) / Math.max(1, (n(m.dias) || 30) - (n(m.dia_hoje) || 0) + 1)), 0)}</b></div></div>${ritmos}</div>`;
    })();

    const serie = (d.serie || []).map((p) => ({ x: p.dia, y: p.faturamento, tip: `${dBR(p.dia)} · ${moeda(p.faturamento)} · ${num(p.pedidos)} pedidos` }));
    const fontes = v.fontes || [];
    const prods = (d.produtos || []).slice(0, 12);
    const lucro = v.lucro || {};
    const cupom = v.cupom || {}, frete = v.frete_gratis || {}, status = v.status || {};

    return `<div class="pn-tiles">${tiles}</div>
      <div class="pn-grid-2">
        ${cartao('Meta do mês', `${esc(String(m.mes || ''))}/${esc(String(m.ano || ''))} · dia ${esc(String(m.dia_hoje || ''))} de ${esc(String(m.dias || ''))}`, metaHtml)}
        ${cartao('Faturamento por dia', `${dBR(d.periodo && d.periodo.de)} a ${dBR(d.periodo && d.periodo.ate)}`, colunas(serie))}
      </div>
      <div class="pn-grid-3">
        ${cartao('Origem das vendas', `pago ${moeda(v.grupos && v.grupos.pago, 0)} · orgânico ${moeda(v.grupos && v.grupos.organico, 0)}`,
          barrasH(fontes, { rotulo: (f) => f.canal, sub: (f) => `${num(f.pedidos)} pedidos · ${pct(f.pct)}` }))}
        ${cartao('Clientes', 'no período', `<div class="pn-kv"><div><small>Pedidos de novos</small><b>${num(c.pedidos_novos)}</b></div><div><small>Novos</small><b>${pct(c.pct_novo)}</b></div><div><small>Recorrentes</small><b>${pct(c.pct_recorrente)}</b></div>` +
          `<div><small>Recompra no mês</small><b>${pct(d.recompra_mes && d.recompra_mes.taxa)}</b></div><div><small>Com cupom</small><b>${pct(cupom.pct)}</b></div><div><small>Frete grátis (≥ R$ 349)</small><b>${pct(frete.pct)} · ${num(frete.pedidos)}</b></div></div>`)}
        ${cartao('Margem e reembolso', lucro.parcial ? `${num(lucro.produtos_sem_custo)} produto(s) sem custo cadastrado` : 'custo por SKU',
          `<div class="pn-kv"><div><small>Lucro bruto</small><b>${lucro.valor == null ? '—' : moeda(lucro.valor, 0)}</b></div><div><small>Margem</small><b>${lucro.margem == null ? '—' : pct(lucro.margem * 100)}</b></div><div><small>Receita coberta</small><b>${moeda(lucro.receita_coberta, 0)}</b></div>` +
          `<div><small>Reembolsado</small><b>${moeda(re.total, 0)}</b></div><div><small>Pedidos reembolsados</small><b>${num(re.pedidos)}</b></div><div><small>Taxa de reembolso</small><b>${pct(re.taxa)}</b></div></div>` +
          `<div class="pn-lista-mini">${(status.pagamentos || []).map((p) => `<span>${esc(p.nome)} <b>${num(p.qtd)}</b></span>`).join('')}</div>`)}
      </div>
      ${cartao('Produtos', `${prods.length} mais vendidos no período`, tabela([
        { t: 'Produto', f: (p) => `<b>${esc(p.nome)}</b><small class="pn-sub">${esc(p.sku || '')}</small>` },
        { t: 'Faturamento', num: true, f: (p) => moeda(p.faturamento, 0) },
        { t: 'Unidades', num: true, f: (p) => num(p.unidades) },
        { t: 'Lucro', num: true, f: (p) => p.lucro == null ? '—' : moeda(p.lucro, 0) },
        { t: 'Margem', num: true, f: (p) => p.margem == null ? '—' : pct(p.margem * 100) },
      ], prods))}`;
  }

  /* ---------- Tráfego ---------- */
  function rTrafego(d) {
    const k = d.kpis || {}, a = d.anterior || {}, mt = d.meta || {}, be = d.breakeven || {};
    const rot = a.rotulo || 'vs período anterior';
    const roas = n(k.investimento) > 0 ? (n(k.faturamento_atribuido) || 0) / n(k.investimento) : null;
    const roasAnt = n(a.investimento) > 0 ? (n(a.faturamento_atribuido) || 0) / n(a.investimento) : null;
    const cpa = n(k.conversoes) > 0 ? (n(k.investimento) || 0) / n(k.conversoes) : null;
    const cpaAnt = n(a.conversoes) > 0 ? (n(a.investimento) || 0) / n(a.conversoes) : null;
    const tiles = [
      tile({ rotulo: 'Investimento', valor: moeda(k.investimento), delta: delta(k.investimento, a.investimento, { rotulo: rot }) }),
      tile({ rotulo: 'Faturamento atribuído (Shopify)', valor: moeda(k.faturamento_atribuido), delta: delta(k.faturamento_atribuido, a.faturamento_atribuido, { rotulo: rot }), nota: `${num(k.pedidos_atribuidos)} pedidos · ${pct(n(k.faturamento_total) ? n(k.faturamento_atribuido) / n(k.faturamento_total) * 100 : null)} do total` }),
      tile({ rotulo: 'ROAS real', valor: vezes(roas), delta: delta(roas, roasAnt, { rotulo: rot }), nota: `alvo ${vezes(d.roas_alvo)} · breakeven ${vezes(be.roas)}`, tom: roas != null && n(be.roas) != null ? (roas < n(be.roas) ? 'critico' : roas < n(d.roas_alvo) ? 'atencao' : 'ok') : '' }),
      tile({ rotulo: 'CPA real', valor: moeda(cpa), delta: delta(cpa, cpaAnt, { rotulo: rot, menor: true }), nota: `${num(k.conversoes)} conversões (Meta)` }),
      tile({ rotulo: 'Receita segundo a Meta', valor: moeda(k.receita_meta), delta: delta(k.receita_meta, a.receita_meta, { rotulo: rot }), nota: `ROAS Meta ${vezes(n(k.investimento) ? (n(k.receita_meta) || 0) / n(k.investimento) : null)}` }),
      tile({ rotulo: 'Meta de atribuído', valor: pct(mt.pct), nota: `${moeda(mt.realizado, 0)} de ${moeda(mt.mensal, 0)} · esperado ${moeda(mt.esperado_ate_hoje, 0)}` }),
    ].join('');

    const sg = (d.serie || []).map((p) => ({ x: p.dia, y: p.gasto, tip: `${dBR(p.dia)} · gasto ${moeda(p.gasto)}` }));
    const sf = (d.serie || []).map((p) => ({ x: p.dia, y: p.faturamento, tip: `${dBR(p.dia)} · atribuído ${moeda(p.faturamento)}` }));

    const criativos = (d.criativos || []).slice(0, 20);
    const ger = d.gerenciador || [];
    const linhaGer = (x, nivel, pai) => {
      const filhos = x.filhos || [];
      const id = `${pai}/${x.id}`;
      const aberto = !!st.abertos[id];
      const roasX = x.faturamento_real == null || !(n(x.gasto) > 0) ? null : (n(x.faturamento_real) || 0) / n(x.gasto);
      return `<tr class="pn-ger n${nivel} ${filhos.length ? 'tem' : ''}" data-ger="${esc(id)}">` +
        `<td><span class="pn-ger-nome" style="--nivel:${nivel}">${filhos.length ? `<i class="pn-seta ${aberto ? 'aberta' : ''}"></i>` : '<i class="pn-seta vazia"></i>'}${x.thumb ? `<img src="${esc(x.thumb)}" alt="" loading="lazy">` : ''}<span>${esc(x.nome)}</span>${x.status ? chipStatus(x.status === 'ACTIVE' ? 'ok' : 'atencao', x.status === 'ACTIVE' ? 'ativa' : x.status.toLowerCase()) : ''}</span></td>` +
        `<td class="num">${moeda(x.gasto, 0)}</td><td class="num">${num(x.impressoes)}</td><td class="num">${num(x.cliques)}</td><td class="num">${num(x.lp_views)}</td><td class="num">${num(x.checkouts)}</td><td class="num">${num(x.conv_meta)}</td>` +
        `<td class="num">${x.vendas_reais == null ? '—' : num(x.vendas_reais)}</td><td class="num">${x.faturamento_real == null ? '—' : moeda(x.faturamento_real, 0)}</td><td class="num">${roasX == null ? '—' : vezes(roasX)}</td></tr>` +
        (aberto ? filhos.map((f) => linhaGer(f, nivel + 1, id)).join('') : '');
    };
    const gerHtml = ger.length ? `<div class="pn-rolagem"><table class="pn-tabela pn-gerenciador"><thead><tr><th>Campanha › conjunto › anúncio</th><th class="num">Gasto</th><th class="num">Impr.</th><th class="num">Cliques</th><th class="num">LP</th><th class="num">Checkouts</th><th class="num">Conv. Meta</th><th class="num">Vendas reais</th><th class="num">Fat. real</th><th class="num">ROAS real</th></tr></thead><tbody>${ger.map((c) => linhaGer(c, 0, 'g')).join('')}</tbody></table></div>` : vazio('Sem campanhas no período.');

    return `<div class="pn-tiles">${tiles}</div>
      <div class="pn-grid-2">
        ${cartao('Gasto por dia', `Meta Ads · sincronizado ${hora(d.meta_sync)}`, colunas(sg))}
        ${cartao('Faturamento atribuído por dia', 'pedidos do Shopify com origem Meta', colunas(sf))}
      </div>
      ${cartao('Criativos', `${criativos.length} com mais gasto · breakeven ROAS ${vezes(be.roas)} (margem ${pct((n(be.margem) || 0) * 100, 0)})`, tabela([
        { t: 'Anúncio', f: (c) => `<span class="pn-ger-nome">${c.thumb ? `<img src="${esc(c.thumb)}" alt="" loading="lazy">` : ''}<span>${esc(c.nome)}</span></span>` },
        { t: 'Gasto', num: true, f: (c) => moeda(c.gasto, 0) },
        { t: 'Receita (Meta)', num: true, f: (c) => moeda(c.receita, 0) },
        { t: 'Conversões', num: true, f: (c) => num(c.conversoes) },
        { t: 'CPA', num: true, f: (c) => moeda(c.cpa, 0) },
        { t: 'ROAS', num: true, f: (c) => `<span class="pn-chip ${n(c.roas) < n(be.roas) ? 'critico' : n(c.roas) < n(d.roas_alvo) ? 'atencao' : 'ok'}">${vezes(c.roas)}</span>` },
      ], criativos))}
      ${cartao('Gerenciador', 'clique numa campanha para abrir os conjuntos e anúncios', gerHtml)}`;
  }

  /* ---------- Setores e metas ---------- */
  function avaliar(chave, realizado, meta, diaHoje, dias) {
    const cfg = metricaDe(chave);
    const r = n(realizado), m = n(meta);
    if (m == null || m <= 0) return { cfg, r, m, esperado: null, cls: 'sem', texto: 'sem meta' };
    if (cfg.tipo === 'fluxo') {
      const e = m * diaHoje / Math.max(1, dias);
      const razao = e > 0 ? (r || 0) / e : 0;
      return { cfg, r, m, esperado: e, cls: razao >= 1 ? 'ok' : razao >= 0.8 ? 'atencao' : 'critico', texto: `${pct(razao * 100, 0)} do ritmo` };
    }
    const razao = cfg.sentido === 'menor' ? (r > 0 ? m / r : 0) : (m > 0 ? (r || 0) / m : 0);
    return { cfg, r, m, esperado: null, cls: razao >= 1 ? 'ok' : razao >= 0.8 ? 'atencao' : 'critico', texto: `${pct(razao * 100, 0)} da meta` };
  }

  /* a meta de faturamento do mês mora em metas_mensais (as três metas), e
     não em metas_kpi — então entra aqui pela meta ativa, e edita lá */
  /* ---------- números que saem de uma conta ----------
     Conversão por canal é pedidos ÷ mensagens enviadas, e as enviadas são
     lançadas à mão enquanto a integração não existe — então essa conta só
     vale no mês, que é o recorte do que foi lançado. No período escolhido
     entram só as derivadas que nascem inteiras da API. */
  function comDerivadas(real, manuais) {
    const r = { ...(real || {}) };
    const m = manuais || null;
    const v = (k) => { const x = r[k] != null ? r[k] : (m ? m[k] : null); return x == null ? null : +x };
    for (const canal of ['email', 'whatsapp_api', 'grupos']) {
      const ped = v(`automacoes|${canal}|pedidos`), env = v(`automacoes|${canal}|disparos`);
      if (ped != null && env > 0) r[`automacoes|${canal}|conversao`] = ped * 100 / env;
    }
    const at = v('atendimento||volume'), pe = v('geral||pedidos');
    if (at != null && pe > 0) r['atendimento||por_pedido'] = at / pe;
    return r;
  }

  /* ---------- mensagens enviadas e gastos ----------
     Estes números já chegavam à base da Central pelos fluxos do n8n: as
     campanhas do ActiveCampaign em `emails`, o WhatsApp API em
     `meta_whatsapp`, com gasto em reais. Ninguém lia — e por isso eles
     apareciam no painel como campo de digitar à mão. A função
     central_envios devolve com as mesmas chaves do painel, então entram
     direto no realizado, em qualquer recorte.

     Se não houver sessão, ou a função não existir naquela base, segue sem:
     o que estiver lançado à mão continua valendo. */
  async function envios(marca, de, ate) {
    const db = window.CentralDB;
    if (!db || typeof db.rpc !== 'function' || !de || !ate) return {};
    try {
      const { data, error } = await db.rpc('central_envios', { p_marca: marca, p_de: de, p_ate: ate });
      if (error) throw error;
      return data && typeof data === 'object' ? data : {};
    } catch (e) {
      console.info('[painel] envios indisponíveis:', (e && e.message) || e);
      return {};
    }
  }

  async function juntarEnvios(d, p) {
    if (!d) return d;
    const ateMes = d.hoje && d.fim && d.hoje < d.fim ? d.hoje : d.fim;
    const [noMes, noPeriodo] = await Promise.all([
      envios(st.marca, d.inicio, ateMes),
      d.periodo ? envios(st.marca, d.periodo.de, d.periodo.ate) : Promise.resolve({}),
    ]);
    d.realizados = { ...(d.realizados || {}), ...noMes };
    if (d.realizado_periodo) d.realizado_periodo = { ...d.realizado_periodo, ...noPeriodo };
    return d;
  }

  const ORIGEM = { api: '', derivada: '', mao: 'lançado à mão' };

  /* A semana é guardada como AAAAMMDD da segunda-feira — o mesmo número que
     central_setores procura ao ler metas e lançamentos semanais. */
  function semanaAtual() {
    const h = hojeSP();
    const d = new Date(`${h}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return +d.toISOString().slice(0, 10).replace(/-/g, '');
  }

  function metasCom(d) {
    const metas = { ...(d.metas || {}) };
    const mg = d.meta_geral || {};
    const ativa = n(mg.meta_ativa) || 1;
    if (!metas['geral||faturamento_mes'] && n(mg[`meta${ativa}`]) > 0) metas['geral||faturamento_mes'] = { valor: n(mg[`meta${ativa}`]), unidade: 'R$', geral: true };
    return metas;
  }
  function cartaoSetor(setor, d) {
    const metas = metasCom(d);
    /* O que é medido manda sobre o que foi digitado: se um dia a integração
       existir, o número dela cobre o lançamento à mão sozinho. */
    const real = comDerivadas({ ...(d.manuais || {}), ...(d.realizados || {}) }, d.manuais);
    const per = comDerivadas(d.realizado_periodo, null);
    const jan = d.periodo || null;
    /* o período só vira coluna quando é outro recorte que não o mês inteiro */
    const mostraPeriodo = !!(jan && d.realizado_periodo &&
      !(jan.de === d.inicio && jan.ate === (d.hoje < d.fim ? d.hoje : d.fim)));
    const chaves = [...new Set([...Object.keys(METRICAS), ...Object.keys(metas), ...Object.keys(real)])]
      .filter((k) => partes(k).escopo === setor.id && (metas[k] || real[k] != null || METRICAS[k]));
    const D = window.Painel && window.Painel.donos;
    const seletorDono = (chave, atual, vazioTxt) => !D ? '' :
      `<select class="pn-dono" data-dono="${esc(chave)}" title="responsável"><option value="">${esc(vazioTxt)}</option>${D.pessoas().map((nome) => `<option ${nome === atual ? 'selected' : ''}>${esc(nome)}</option>`).join('')}</select>`;
    const donoSetor = D ? D.ler(st.marca, `setor|${setor.id}`) : '';
    const cabeca = `${chaves.length} métricas` + (D ? ` · dono ${seletorDono(`setor|${setor.id}`, donoSetor, 'sem dono')}` : '');
    if (!chaves.length) return cartao(setor.nome, cabeca, vazio('Este setor ainda não tem métrica ligada.'));
    const linhas = chaves.map((k) => {
      const meta = metas[k] ? n(metas[k].valor) : null;
      const un = (metas[k] && metas[k].unidade) || metricaDe(k).un;
      const av = avaliar(k, real[k], meta, n(d.dia_hoje) || 0, n(d.dias) || 30);
      const editando = st.editando === k;
      const campoMeta = editando
        ? `<form class="pn-edita" data-meta-form="${esc(k)}"><input name="valor" type="number" step="any" min="0" value="${meta == null ? '' : meta}" placeholder="meta do mês" autofocus><button type="submit" class="cu-btn primary">Salvar</button><button type="button" class="cu-btn" data-meta-cancela>Cancelar</button></form>`
        : `<button type="button" class="pn-meta-btn" data-meta-edita="${metas[k] && metas[k].geral ? '__geral' : esc(k)}" title="editar a meta do mês">${meta == null ? 'definir meta' : unidade(un, meta, un === 'x' ? 2 : 0)}</button>`;
      const donoMetrica = D ? D.ler(st.marca, k) : '';
      const marca = ORIGEM[av.cfg.auto || 'api'];
      const casas = un === 'x' ? 2 : un === '%' ? 1 : 0;
      const noPeriodo = mostraPeriodo
        ? `<div class="pn-metrica-per"><b>${per[k] == null ? '—' : unidade(un, per[k], casas)}</b><small>${av.cfg.auto === 'mao' ? 'só no mês' : 'no período'}</small></div>` : '';
      /* Métrica sem fonte automática precisa de alguém para lançar. O banco
         já aceitava (valor_setor), mas nenhuma tela pedia — então ninguém
         nunca lançou, e atendimento ficou meses sem um número sequer. */
      const deMao = av.cfg.auto === 'mao';
      const lancando = st.lancando === k;
      const valorHtml = deMao
        ? (lancando
          ? `<form class="pn-edita pn-lanca" data-valor-form="${esc(k)}">
              <input name="valor" type="number" step="any" min="0" value="${av.r == null ? '' : av.r}" placeholder="valor" autofocus>
              <select name="periodo" aria-label="Onde lançar">
                <option value="mensal">no mês</option>
                <option value="semanal">nesta semana</option>
              </select>
              <button type="submit" class="cu-btn primary">Salvar</button>
              <button type="button" class="cu-btn" data-valor-cancela>Cancelar</button>
            </form>`
          : `<button type="button" class="pn-valor-btn" data-valor-edita="${esc(k)}" title="lançar o número deste mês">${av.r == null ? 'lançar' : unidade(un, av.r, casas)}</button>`)
        : (av.r == null ? '—' : unidade(un, av.r, casas));
      return `<div class="pn-metrica ${av.cls} ${mostraPeriodo ? 'com-periodo' : ''}"><div class="pn-metrica-nome"><b>${esc(av.cfg.nome)}</b><small>${av.cfg.tipo === 'fluxo' ? 'acumulado no mês' : 'nível atual'}${av.cfg.sentido === 'menor' ? ' · quanto menor, melhor' : ''}${marca ? ` · ${esc(marca)}` : ''}</small>${D ? seletorDono(k, donoMetrica, donoSetor ? `dono: ${donoSetor}` : 'sem dono') : ''}</div>` +
        noPeriodo +
        `<div class="pn-metrica-valor">${valorHtml}</div>` +
        `<div class="pn-metrica-meta">${campoMeta}</div>` +
        `<div class="pn-metrica-ritmo">${av.m ? ritmo(av.r, av.m, av.esperado, { un }) : ''}<small class="${av.cls}">${esc(av.texto)}${av.esperado != null ? ` · esperado ${unidade(un, av.esperado, 0)}` : ''}</small></div></div>`;
    }).join('');
    return cartao(setor.nome, cabeca, `<div class="pn-metricas">${linhas}</div>`, 'pn-setor');
  }

  function metaGeral(d) {
    const mg = d.meta_geral || {}, real = (d.realizados || {})['geral||faturamento_mes'];
    const ativa = n(mg.meta_ativa) || 1;
    const editando = st.editando === '__geral';
    const corpo = editando
      ? `<form class="pn-edita pn-edita-geral" data-meta-geral><label>Meta 1<input name="meta1" type="number" step="any" min="0" value="${n(mg.meta1) || ''}"></label><label>Meta 2<input name="meta2" type="number" step="any" min="0" value="${n(mg.meta2) || ''}"></label><label>Meta 3<input name="meta3" type="number" step="any" min="0" value="${n(mg.meta3) || ''}"></label>` +
        `<label>Ativa<select name="meta_ativa">${[1, 2, 3].map((i) => `<option value="${i}" ${i === ativa ? 'selected' : ''}>Meta ${i}</option>`).join('')}</select></label><button type="submit" class="cu-btn primary">Salvar</button><button type="button" class="cu-btn" data-meta-cancela>Cancelar</button></form>`
      : `<div class="pn-meta-topo">${[1, 2, 3].map((i) => { const t = n(mg[`meta${i}`]) || 0; const e = t * (n(d.dia_hoje) || 0) / Math.max(1, n(d.dias) || 30);
          return `<div class="${i === ativa ? 'ativa' : ''}"><small>Meta ${i}${i === ativa ? ' · ativa' : ''}</small><b>${moeda(t, 0)}</b>${t ? ritmo(real, t, e) : ''}</div>` }).join('')}` +
        `<div><small>Realizado</small><b>${moeda(real, 0)}</b></div></div><button type="button" class="pn-meta-btn" data-meta-edita="__geral">editar as metas de faturamento</button>`;
    const hist = (d.historico_metas || []).slice(0, 6).map((h) => `<span>${String(h.mes).padStart(2, '0')}/${h.ano} <b>${moeda(h[`meta${n(h.meta_ativa) || 1}`], 0)}</b></span>`).join('');
    return cartao('Meta de faturamento do mês', `${esc(String(d.mes || ''))}/${esc(String(d.ano || ''))}`, corpo + (hist ? `<div class="pn-lista-mini">${hist}</div>` : ''));
  }

  function semanas(setorId, d) {
    const sems = d.semanas || [];
    if (!sems.length) return '';
    const chaves = [...new Set(sems.flatMap((s) => [...Object.keys(s.metas || {}), ...Object.keys(s.realizados || {})]))]
      .filter((k) => setorId === 'todos' ? true : partes(k).escopo === setorId)
      .filter((k) => METRICAS[k] || sems.some((s) => (s.metas || {})[k] != null));
    if (!chaves.length) return '';
    const cols = [{ t: 'Métrica', f: (k) => `<b>${esc(metricaDe(k).nome)}</b>${setorId === 'todos' ? `<small class="pn-sub">${esc((SETORES.find((s) => s.id === partes(k).escopo) || {}).nome || '')}</small>` : ''}` },
      ...sems.map((s) => ({ t: `S${s.n} · ${dBR(s.inicio)}–${dBR(s.fim)}${s.em_andamento && !s.futura ? ' · agora' : s.futura ? ' · futura' : ''}`, num: true, f: (k) => {
        const un = metricaDe(k).un, r = (s.realizados || {})[k], m = (s.metas || {})[k];
        if (s.futura) return m == null ? '—' : `<small class="pn-sub">meta ${unidade(un, m, un === 'x' ? 2 : 0)}</small>`;
        const av = m == null ? null : avaliar(k, r, m, metricaDe(k).tipo === 'fluxo' ? s.dias : 1, s.dias);
        return `<span class="${av ? av.cls : ''}">${r == null ? '—' : unidade(un, r, un === 'x' ? 2 : un === '%' ? 1 : 0)}</span>${m != null ? `<small class="pn-sub">meta ${unidade(un, m, un === 'x' ? 2 : 0)}</small>` : ''}`;
      } }))];
    return cartao('Semana a semana', 'realizado e meta semanal', tabela(cols, chaves));
  }

  function detalheSetor(setorId, x) {
    if (!x) return '';
    if (setorId === 'influenciadores') {
      const k = x.kpis || {}, aq = x.aquisicao || {};
      return `<div class="pn-tiles">${tile({ rotulo: 'Faturamento via influencer', valor: moeda(k.faturamento) })}${tile({ rotulo: 'Vendas', valor: num(k.vendas) })}${tile({ rotulo: 'Influencers ativos', valor: num(k.ativos) })}${tile({ rotulo: 'Ticket', valor: moeda(k.ticket) })}${tile({ rotulo: 'Clientes novos', valor: moeda(aq.novos, 0), nota: `recorrentes ${moeda(aq.recorrentes, 0)} · desconto ${moeda(aq.desconto, 0)}` })}</div>` +
        `<div class="pn-grid-2">${cartao('Ranking', 'por faturamento no período', tabela([
          { t: 'Influencer', f: (r) => `<b>${esc(r.nome)}</b><small class="pn-sub">${esc(r.codigos || '')}</small>` },
          { t: 'Faturamento', num: true, f: (r) => moeda(r.faturamento, 0) }, { t: 'Vendas', num: true, f: (r) => num(r.vendas) },
          { t: 'Ticket', num: true, f: (r) => moeda(r.ticket, 0) }, { t: 'Novos', num: true, f: (r) => pct(r.pct_novos, 0) },
          { t: 'Tendência', num: true, f: (r) => r.tendencia === 'up' ? '<span class="pn-chip ok">subindo</span>' : r.tendencia === 'down' ? '<span class="pn-chip critico">caindo</span>' : '—' },
        ], x.ranking || []))}${cartao('Faturamento por dia', 'pedidos com cupom de influencer', colunas((x.serie || []).map((p) => ({ x: p.dia, y: p.faturamento }))))}</div>` +
        ((x.outros || []).length ? cartao('Outros cupons', 'promoções da marca, fora do ranking', barrasH(x.outros, { sub: (o) => `${num(o.vendas)} vendas · ${o.tipo}` })) : '');
    }
    if (setorId === 'social_media') {
      const ig = x.instagram || {}, ins = x.insights_periodo || {}, vl = x.vendas_link || {};
      const posts = ((x.top_posts || {}).posts || []).slice(0, 6);
      return `<div class="pn-tiles">${tile({ rotulo: 'Seguidores', valor: num(ig.seguidores), nota: ig.username ? `@${esc(ig.username)} · ${hora(ig.at)}` : '' })}${tile({ rotulo: 'Visualizações', valor: num(ins.views) })}${tile({ rotulo: 'Alcance', valor: num(ins.reach) })}${tile({ rotulo: 'Interações', valor: num(ins.interacoes) })}${tile({ rotulo: 'Cliques no link', valor: num(ins.cliques) })}${tile({ rotulo: 'Vendas pelo link', valor: moeda(vl.faturamento, 0), nota: `${num(vl.pedidos)} pedidos · ${pct(vl.pct_do_total)} do total` })}</div>` +
        `<div class="pn-grid-3">${cartao('De onde vem a venda', 'bio, stories, live', barrasH(x.split || [], { rotulo: (s) => s.chave, sub: (s) => `${num(s.pedidos)} pedidos` }))}` +
        `${cartao('Produtos pelo link', 'no período', barrasH((x.produtos || []).slice(0, 6), { sub: (p) => `${num(p.unidades)} un` }))}` +
        `${cartao('Semana a semana', 'Instagram', tabela([{ t: 'Semana', f: (h) => dBR(h.semana) }, { t: 'Views', num: true, f: (h) => num(h.views) }, { t: 'Alcance', num: true, f: (h) => num(h.reach) }, { t: 'Interações', num: true, f: (h) => num(h.interacoes) }, { t: 'Cliques', num: true, f: (h) => num(h.cliques) }, { t: 'Seg. líq.', num: true, f: (h) => num(h.seguidores_liquidos) }], x.historico || []))}</div>` +
        (posts.length ? cartao('Posts que mais renderam', 'por interações', `<div class="pn-posts">${posts.map((p) => `<a class="pn-post" href="${esc(p.permalink)}" target="_blank" rel="noopener">${p.thumb ? `<img src="${esc(p.thumb)}" alt="" loading="lazy">` : '<i></i>'}<b>${num(p.interacoes)} interações</b><small>${num(p.reach)} alcance · ${esc(p.media_type || '')}</small><p>${esc(p.caption || '')}</p></a>`).join('')}</div>`) : '');
    }
    if (setorId === 'automacoes') {
      const canais = x.canais || [];
      return `<div class="pn-tiles">${tile({ rotulo: 'Participação no faturamento', valor: pct(x.contribuicao_pct), nota: 'e-mail, WhatsApp API e grupos somados' })}</div>` +
        `<div class="pn-grid-3">${canais.map((c) => cartao(CANAIS[c.canal] || c.canal, `melhor dia ${dBR(c.melhor_dia && c.melhor_dia.dia)} · ${moeda(c.melhor_dia && c.melhor_dia.valor, 0)}`,
          `<div class="pn-canal"><div><small>No mês</small><b>${moeda(c.fat_mes, 0)}</b></div><div><small>Esta semana</small><b>${moeda(c.fat_semana, 0)}</b>${delta(c.fat_semana, c.fat_semana_anterior, { rotulo: 'vs semana anterior' })}</div><div><small>Disparos na semana</small><b>${num(c.disparos_semana)}</b></div></div>${faisca(c.spark, 220, 36)}<small class="pn-sub">últimas 8 semanas</small>`)).join('')}</div>`;
    }
    if (setorId === 'atendimento') {
      const re = x.reembolso || {};
      return `<div class="pn-tiles">${tile({ rotulo: 'Reembolsado', valor: moeda(re.total, 0), nota: `${num(re.pedidos)} pedidos · ${pct(re.taxa)} do bruto` })}</div>` +
        `<div class="pn-grid-2">${cartao('Semana a semana', 'volume, tempo de resposta e CSAT', tabela([{ t: 'Semana', f: (h) => dBR(h.semana) }, { t: 'Volume', num: true, f: (h) => num(h.volume) }, { t: 'Resposta (min)', num: true, f: (h) => num(h.tempo_resposta_min, 0) }, { t: 'CSAT', num: true, f: (h) => pct(h.csat, 0) }], x.historico || [], { vazioTexto: 'Nenhuma semana lançada ainda.' }))}` +
        `${cartao('Produtos mais reembolsados', 'no período', tabela([{ t: 'Produto', f: (p) => esc(p.nome || p.sku || '—') }, { t: 'Valor', num: true, f: (p) => moeda(p.valor || p.total, 0) }, { t: 'Pedidos', num: true, f: (p) => num(p.pedidos || p.qtd) }], x.top_reembolsados || [], { vazioTexto: 'Nenhum reembolso no período.' }))}</div>`;
    }
    return '';
  }

  function rSetores(d, det) {
    const chips = `<div class="pn-chips">${[{ id: 'todos', nome: 'Todos' }, ...SETORES].map((s) => `<button type="button" class="pn-chip-btn ${st.setor === s.id ? 'ativo' : ''}" data-setor="${s.id}">${esc(s.nome)}</button>`).join('')}</div>`;
    const sug = d.sugestao || {};
    const nota = `<p class="pn-nota">Dia ${esc(String(d.dia_hoje || ''))} de ${esc(String(d.dias || ''))}. As metas de fluxo se comparam com o ritmo — a meta do mês dividida pelos dias passados. Clique numa meta para mudar; a média das últimas ${(sug.semanas || []).length || 4} semanas ajuda a calibrar.</p>`;
    if (st.setor === 'todos') {
      return chips + nota + metaGeral(d) + `<div class="pn-grid-2">${SETORES.map((s) => cartaoSetor(s, d)).join('')}</div>` + semanas('todos', d);
    }
    const setor = SETORES.find((s) => s.id === st.setor) || SETORES[0];
    return chips + nota + (setor.id === 'geral' ? metaGeral(d) : '') + cartaoSetor(setor, d) + detalheSetor(setor.id, det) + semanas(setor.id, d);
  }

  /* ---------- KPIs ---------- */
  function rKpis(d) {
    const j = d.janela || {}, a = d.anterior || {}, m = d.metas || {}, fr = d.frete || {}, rc = d.recompra || {};
    const rot = `vs ${a.rotulo || 'anterior'}`;
    const tiles = [
      tile({ rotulo: 'Faturamento', valor: moeda(j.faturamento), delta: delta(j.faturamento, a.faturamento, { rotulo: rot }), nota: m.faturamento ? `meta da janela ${moeda(m.faturamento, 0)}` : '' }),
      tile({ rotulo: 'Pedidos', valor: num(j.pedidos), delta: delta(j.pedidos, a.pedidos, { rotulo: rot }) }),
      tile({ rotulo: 'Ticket médio', valor: moeda(j.ticket), delta: delta(j.ticket, a.ticket, { rotulo: rot }), nota: m.ticket_medio ? `meta ${moeda(m.ticket_medio, 0)}` : '' }),
      tile({ rotulo: 'Conversão', valor: pct(j.conversao, 2), delta: delta(j.conversao, a.conversao, { rotulo: rot }), nota: `${num(j.sessoes)} sessões${m.conversao ? ` · meta ${pct(m.conversao)}` : ''}` }),
      tile({ rotulo: 'Recompra', valor: pct(j.recompra), delta: delta(j.recompra, a.recompra, { rotulo: rot }), nota: `${num(rc.recompradores)} de ${num(rc.clientes)}${m.taxa_recompra ? ` · meta ${pct(m.taxa_recompra, 0)}` : ''}` }),
      tile({ rotulo: 'Frete grátis', valor: pct(j.frete_pct), delta: delta(j.frete_pct, a.frete_pct, { rotulo: rot }), nota: `${num(fr.na_faixa)} pedidos a até R$ ${num(fr.gap_medio, 0)} da faixa` }),
    ].join('');
    const dias = (d.dias || []).map((p) => ({ x: p.dia, y: p.faturamento, tip: `${dBR(p.dia)} · ${moeda(p.faturamento)} · ${num(p.pedidos)} pedidos` }));
    const tend = [...(d.tendencia || []), ...(j.de ? [{ ...j, __cls: 'pn-atual' }] : [])];
    return `<div class="pn-tiles">${tiles}</div>
      <div class="pn-grid-2">
        ${cartao('Faturamento por dia', `${dBR(j.de)} a ${dBR(j.ate)}`, colunas(dias))}
        ${cartao('Produtos na janela', `${num(d.sem_voltar)} clientes sem voltar`, tabela([
          { t: 'Produto', f: (p) => `<b>${esc(p.nome)}</b>${p.risco ? ' <span class="pn-chip critico">estoque em risco</span>' : ''}` },
          { t: 'Faturamento', num: true, f: (p) => moeda(p.faturamento, 0) }, { t: 'Unidades', num: true, f: (p) => num(p.unidades) }, { t: 'Estoque', num: true, f: (p) => num(p.estoque) },
        ], d.produtos || []))}
      </div>
      ${cartao('Tendência', 'janelas de mesmo tamanho, a atual por último', tabela([
        { t: 'Janela', f: (t) => `${dBR(t.de)}–${dBR(t.ate)}` }, { t: 'Faturamento', num: true, f: (t) => moeda(t.faturamento, 0) }, { t: 'Pedidos', num: true, f: (t) => num(t.pedidos) },
        { t: 'Ticket', num: true, f: (t) => moeda(t.ticket, 0) }, { t: 'Sessões', num: true, f: (t) => num(t.sessoes) }, { t: 'Conversão', num: true, f: (t) => pct(t.conversao, 2) },
        { t: 'Recompra', num: true, f: (t) => pct(t.recompra) }, { t: 'Recorrentes', num: true, f: (t) => pct(t.recorrentes_pct) }, { t: 'Frete grátis', num: true, f: (t) => pct(t.frete_pct) },
      ], tend))}`;
  }

  /* ---------- Estoque ---------- */
  function rEstoque(d) {
    const k = d.kpis || {}, cfg = d.config || {};
    const itens = d.itens || [];
    const tiles = [
      tile({ rotulo: 'Produtos', valor: num(k.produtos), nota: `${num(k.unidades)} unidades` }),
      tile({ rotulo: 'Capital parado', valor: moeda(k.capital, 0), nota: k.sem_custo ? `${num(k.sem_custo)} sem custo cadastrado` : '' }),
      tile({ rotulo: 'Primeira ruptura', valor: k.primeira_ruptura == null ? '—' : `${num(k.primeira_ruptura, 1)} dias`, tom: n(k.primeira_ruptura) < n(cfg.critico_dias) ? 'critico' : n(k.primeira_ruptura) < n(cfg.alerta_dias) ? 'atencao' : 'ok' }),
      tile({ rotulo: 'Em alerta', valor: num((n(k.alerta) || 0) + (n(k.baixo) || 0) + (n(k.ruptura) || 0)), nota: `${num(k.ruptura)} rompidos · ${num(k.baixo)} baixos · ${num(k.alerta)} em alerta`, tom: (n(k.ruptura) || 0) > 0 ? 'critico' : '' }),
      tile({ rotulo: 'Em excesso', valor: num(k.excesso), nota: `${num(k.excesso_unidades)} unidades acima de ${num(cfg.excesso_dias)} dias` }),
    ].join('');
    const stChip = (s) => chipStatus(s === 'ok' ? 'ok' : s === 'alerta' || s === 'excesso' ? 'atencao' : 'critico', { ok: 'ok', alerta: 'alerta', baixo: 'baixo', ruptura: 'rompido', esgotado: 'esgotado', excesso: 'excesso' }[s] || s);
    return `<div class="pn-tiles">${tiles}</div>
      ${cartao('Produtos', `cobertura alvo ${num(cfg.cobertura_alvo_dias)} dias · lead time ${num(cfg.lead_time_dias)} dias · sincronizado ${hora(d.sync_em)}`, tabela([
        { t: 'Produto', f: (i) => `<b>${esc(i.nome)}</b><small class="pn-sub">${esc(i.sku)}</small>` },
        { t: 'Status', f: (i) => stChip(i.status) },
        { t: 'Estoque', num: true, f: (i) => num(i.estoque) },
        { t: 'Giro/dia', num: true, f: (i) => num(i.velocidade, 1) },
        { t: 'Cobertura', num: true, f: (i) => i.cobertura == null ? '—' : `${num(i.cobertura, 1)} d` },
        { t: 'Rompe em', num: true, f: (i) => dLonga(i.ruptura_em) },
        { t: 'Repor', num: true, f: (i) => n(i.repor) ? `<b>${num(i.repor)}</b>` : '—' },
        { t: 'Tendência', num: true, f: (i) => ({ subindo: '▲ subindo', caindo: '▼ caindo', estavel: '= estável' })[i.tendencia] || '—' },
        { t: 'Capital', num: true, f: (i) => moeda(i.capital, 0) },
      ], itens))}
      ${(d.kits || []).length ? cartao('Kits', 'a cobertura do kit é a do componente mais curto', `<div class="pn-grid-3">${d.kits.map((kit) => `<div class="pn-kit"><b>${esc(kit.nome)}</b>${(kit.componentes || []).map((c) => `<div class="pn-kit-item"><span>${esc(c.nome)}</span><b>${num(c.estoque)} un · ${num(c.cobertura, 0)} d</b></div>`).join('')}</div>`).join('')}</div>`) : ''}`;
  }

  /* ---------- Cupons ---------- */
  function rCupons(d) {
    const ag = d.agrupados || [], cad = d.cadastro || [];
    const total = ag.reduce((s, x) => s + (n(x.faturamento) || 0), 0);
    return `<div class="pn-grid-2">
      ${cartao('Vendas por cupom', `${moeda(total, 0)} no período`, tabela([
        { t: 'Cupom', f: (c) => `<b>${esc(c.nome)}</b><small class="pn-sub">${(c.codigos || []).join(', ')}</small>` },
        { t: 'Tipo', f: (c) => `<span class="pn-chip neutro">${esc(c.tipo || '')}</span>` },
        { t: 'Vendas', num: true, f: (c) => num(c.vendas) }, { t: 'Faturamento', num: true, f: (c) => moeda(c.faturamento, 0) },
        { t: '% do total', num: true, f: (c) => pct(total ? (n(c.faturamento) || 0) / total * 100 : null) },
      ], ag))}
      ${cartao('Cupons acompanhados', `${cad.length} cadastrados`, tabela([
        { t: 'Código', f: (c) => `<b>${esc(c.codigo)}</b>` }, { t: 'Nome', f: (c) => esc(c.nome) },
        { t: 'Tipo', f: (c) => `<span class="pn-chip neutro">${esc(c.tipo || '')}</span>` }, { t: 'Desconto', num: true, f: (c) => c.percentual == null ? '—' : pct(c.percentual, 0) },
      ], cad))}
    </div>`;
  }

  /* ---------- Alertas ---------- */
  function rAlertas(lista) {
    const l = Array.isArray(lista) ? lista : [];
    if (!l.length) return cartao('Alertas', 'tudo dentro do esperado', vazio('Nenhum alerta agora: metas no ritmo e estoque coberto.'));
    const ordem = { critico: 0, atencao: 1 };
    const grupos = ['critico', 'atencao'].map((s) => ({ s, itens: l.filter((a) => a.severidade === s) })).filter((g) => g.itens.length);
    return grupos.map((g) => cartao(g.s === 'critico' ? 'Crítico' : 'Atenção', `${g.itens.length} ${g.itens.length === 1 ? 'alerta' : 'alertas'}`,
      `<div class="pn-alertas">${g.itens.sort((a, b) => (ordem[a.severidade] || 0) - (ordem[b.severidade] || 0)).map((a) => `<button type="button" class="pn-alerta ${sev(a.severidade)}" data-abre-tela="${esc(a.tela === 'estoque' ? 'estoque' : a.tela === 'trafego' ? 'trafego' : 'setores')}" data-abre-setor="${esc(a.tela || '')}"><i></i><div><b>${esc(a.titulo)}</b><small>${esc(a.detalhe || '')}</small></div>${a.pct != null ? `<span>${pct(a.pct, 0)}</span>` : a.cobertura != null ? `<span>${num(a.cobertura, 1)} d</span>` : ''}</button>`).join('')}</div>`)).join('');
  }

  /* ---------- a moldura ---------- */
  function cabecalho() {
    const sel = document.getElementById('brandSelect');
    const global = sel ? sel.value : '';
    const marcaFixa = MARCAS.includes(global);
    const p = periodoDe(st.preset, st.de, st.ate);
    const ex = telaExtra(st.tela);
    const semPeriodo = ['estoque', 'alertas'].includes(st.tela) || !!(ex && ex.semPeriodo);
    return `<header class="taskspage-head pn-head"><div class="taskspage-title"><div><h1>Painel</h1><p>Central / Acompanhamento / ${esc((TELAS.find((t) => t.id === st.tela) || ex || {}).nome || '')}</p></div>` +
      `<div class="pn-head-dir">${marcaFixa ? `<span class="pn-marca">${esc(st.marca)}</span>` : `<div class="cu-views pn-marcas">${MARCAS.map((m) => `<button type="button" class="cu-view ${st.marca === m ? 'active' : ''}" data-marca="${m}">${m}</button>`).join('')}</div>`}` +
      `<span class="pn-atualizado" id="painelAtualizado">${st.carregando ? 'atualizando…' : st.em ? `atualizado ${hora(st.em)}` : ''}</span><button type="button" class="cu-btn" data-painel-atualiza title="buscar de novo agora">↻</button></div></div>` +
      /* Uma barra só de abas. Antes eram duas cápsulas cinzas idênticas
         lado a lado — os números e os rituais — e uma terceira embaixo
         para o período: três faixas iguais empilhadas, que é o que se
         lia como linha repetida. Agora os dois grupos dividem a mesma
         cápsula, separados por um traço, e o período desce numa linha
         mais leve, sem cápsula, com o intervalo à direita. */
      `<div class="cu-toolbar pn-toolbar"><div class="cu-views pn-abas" aria-label="Tela do painel">` +
        `<span class="pn-abas-grupo">${TELAS.map((t) => `<button type="button" class="cu-view ${st.tela === t.id ? 'active' : ''}" data-tela="${t.id}">${esc(t.nome)}</button>`).join('')}</span>` +
        (EXTRAS.length ? `<span class="pn-abas-corte" aria-hidden="true"></span><span class="pn-abas-grupo pn-extras" role="group" aria-label="Rituais e equipe">${EXTRAS.map((t) => `<button type="button" class="cu-view ${st.tela === t.id ? 'active' : ''}" data-tela="${t.id}">${esc(t.nome)}</button>`).join('')}</span>` : '') +
      `</div>` +
      (semPeriodo ? '' : `<div class="pn-periodo"><div class="pn-presets" role="group" aria-label="Período">${PRESETS.map((x) => `<button type="button" class="pn-preset ${st.preset === x.id ? 'ativo' : ''}" data-preset="${x.id}">${esc(x.nome)}</button>`).join('')}</div>` +
        `<div class="pn-datas ${st.preset === 'livre' ? '' : 'oculto'}"><input type="date" class="cu-filter" data-de value="${p.de}" aria-label="De"><span>até</span><input type="date" class="cu-filter" data-ate value="${p.ate}" aria-label="Até"></div>` +
        `<span class="pn-intervalo">${dLonga(p.de)} — ${dLonga(p.ate)}</span></div>`) + `</div></header>`;
  }

  function moldura() {
    const view = document.getElementById('painelView');
    if (!view) return null;
    if (!view.querySelector('.pn-corpo')) view.innerHTML = `${cabecalho()}<div class="pn-corpo" id="painelCorpo"></div><div class="pn-tip" hidden></div>`;
    else view.querySelector('.pn-head').outerHTML = cabecalho();
    return view;
  }

  function erroHtml(e) {
    const status = e && e.status;
    const msg = status === 401 ? 'Entre na Central para ver o painel.'
      : status === 404 ? `A ${st.marca} ainda não tem painel ligado à Central. Assim que o banco dela receber as funções e o token, ele aparece aqui.`
      : `Não consegui falar com o painel da ${st.marca}: ${e && e.message ? e.message : 'erro desconhecido'}.`;
    return cartao('Sem dados', '', `<div class="pn-erro"><p>${esc(msg)}</p><button type="button" class="cu-btn primary" data-painel-atualiza>Tentar de novo</button></div>`);
  }

  let pedidoAtual = 0;
  async function carregar(forcar) {
    const view = moldura();
    if (!view) return;
    const corpo = view.querySelector('#painelCorpo');
    const meu = ++pedidoAtual;
    st.carregando = true;
    const rot = view.querySelector('#painelAtualizado'); if (rot) rot.textContent = 'atualizando…';
    if (!corpo.innerHTML) corpo.innerHTML = `<div class="pn-carregando">Buscando os números da ${esc(st.marca)}…</div>`;
    corpo.classList.add('pn-ocupado');
    try {
      const p = periodoDe(st.preset, st.de, st.ate);
      const h = hojeSP();
      let html = '';
      switch (st.tela) {
        case 'visao': html = rVisao(await pedir('visao', { de: p.de, ate: p.ate }, forcar)); break;
        case 'trafego': html = rTrafego(await pedir('trafego', { de: p.de, ate: p.ate }, forcar)); break;
        case 'kpis': html = rKpis(await pedir('kpis', { de: p.de, ate: p.ate }, forcar)); break;
        case 'estoque': html = rEstoque(await pedir('estoque', {}, forcar)); break;
        case 'cupons': html = rCupons(await pedir('cupons', { de: p.de, ate: p.ate }, forcar)); break;
        case 'alertas': html = rAlertas(await pedir('alertas', {}, forcar)); break;
        default: {
          const ex = telaExtra(st.tela);
          if (!ex) break;
          html = await ex.render({
            marca: st.marca, periodo: p, hoje: h, st, forcar,
            pedir: (tela, args) => pedir(tela, args || {}, forcar),
            ui: { tile, cartao, tabela, colunas, barrasH, faisca, ritmo, delta, chipStatus, vazio },
            fmt: { moeda, num, pct, vezes, curto, dBR, dLonga, hora, esc, unidade, hojeSP, somaDias, fimDoMes },
            metricaDe, avaliar, partes, metasCom, comDerivadas, envios, gravar, SETORES, METRICAS,
          });
          break;
        }
        case 'setores': {
          const [d, det] = await Promise.all([
            pedir('setores', { ano: +h.slice(0, 4), mes: +h.slice(5, 7), de: p.de, ate: p.ate }, forcar),
            st.setor !== 'todos' && st.setor !== 'geral' && st.setor !== 'trafego' ? pedir('setor', { setor: st.setor, de: p.de, ate: p.ate }, forcar) : Promise.resolve(null),
          ]);
          await juntarEnvios(d, p);
          html = rSetores(d, det); break;
        }
      }
      if (meu !== pedidoAtual) return;
      st.erro = null;
      corpo.innerHTML = html;
    } catch (e) {
      if (meu !== pedidoAtual) return;
      st.erro = e;
      corpo.innerHTML = erroHtml(e);
      console.warn('[painel]', e);
    } finally {
      if (meu === pedidoAtual) {
        st.carregando = false;
        corpo.classList.remove('pn-ocupado');
        const r = view.querySelector('#painelAtualizado'); if (r) r.textContent = st.em && !st.erro ? `atualizado ${hora(st.em)}` : '';
      }
    }
  }

  /* ---------- abrir e fechar ---------- */
  const OUTRAS = ['tasksView', 'deliveriesView', 'planningView', 'campaignsView'];
  const NAVS = ['homeNav', 'tasksNav', 'deliveriesNav', 'planningNav', 'campaignsNav'];
  let observando = false;

  function mostrar() {
    const view = document.getElementById('painelView'), nav = document.getElementById('painelNav');
    if (!view) return;
    const home = document.getElementById('homeView'); if (home) home.style.display = 'none';
    OUTRAS.forEach((id) => document.getElementById(id)?.classList.remove('active'));
    NAVS.forEach((id) => document.getElementById(id)?.classList.remove('active'));
    view.classList.add('active'); nav?.classList.add('active');
    document.title = 'Central · Painel';
    if (location.hash !== '#painel') location.hash = 'painel';
    st.aberto = true;
    const sel = document.getElementById('brandSelect');
    if (sel && MARCAS.includes(sel.value)) st.marca = sel.value;
    carregar(false);
    ligarRelogio();
  }

  function esconder() {
    const view = document.getElementById('painelView'), nav = document.getElementById('painelNav');
    view?.classList.remove('active'); nav?.classList.remove('active');
    st.aberto = false;
    if (st.timer) { clearInterval(st.timer); st.timer = null }
  }

  function ligarRelogio() {
    if (st.timer) clearInterval(st.timer);
    st.timer = setInterval(() => {
      if (!st.aberto || document.visibilityState !== 'visible' || st.editando) return;
      carregar(true);
    }, ATUALIZA_MS);
  }

  /* quando o app abre outra tela por conta própria (busca global, link de
     tarefa), a classe "active" aparece em outra seção — e este painel sai. */
  function observar() {
    if (observando) return; observando = true;
    const mo = new MutationObserver(() => {
      if (!st.aberto) return;
      const home = document.getElementById('homeView');
      const outraAtiva = OUTRAS.some((id) => document.getElementById(id)?.classList.contains('active')) || (home && home.style.display !== 'none');
      if (outraAtiva) esconder();
    });
    [...OUTRAS, 'homeView'].forEach((id) => { const el = document.getElementById(id); if (el) mo.observe(el, { attributes: true, attributeFilter: ['class', 'style'] }) });
  }

  /* ---------- eventos ---------- */
  function ligar() {
    const view = document.getElementById('painelView');
    if (!view) return;
    document.getElementById('painelNav')?.addEventListener('click', mostrar);
    document.querySelectorAll('.navitem').forEach((b) => { if (b.id !== 'painelNav') b.addEventListener('click', () => { if (st.aberto) esconder() }, true) });
    document.getElementById('brandSelect')?.addEventListener('change', (e) => {
      if (MARCAS.includes(e.target.value)) st.marca = e.target.value;
      if (st.aberto) { st.editando = null; carregar(false) }
    });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && st.aberto) carregar(false) });

    view.addEventListener('click', async (e) => {
      const t = e.target.closest('[data-tela],[data-preset],[data-marca],[data-setor],[data-painel-atualiza],[data-meta-edita],[data-meta-cancela],[data-valor-edita],[data-valor-cancela],[data-ger],[data-abre-tela]');
      if (!t) return;
      if (t.dataset.tela) { st.tela = t.dataset.tela; st.editando = null; view.querySelector('#painelCorpo').innerHTML = ''; return carregar(false) }
      if (t.dataset.preset) { st.preset = t.dataset.preset; return carregar(false) }
      if (t.dataset.marca) { st.marca = t.dataset.marca; st.editando = null; view.querySelector('#painelCorpo').innerHTML = ''; return carregar(false) }
      if (t.dataset.setor) { st.setor = t.dataset.setor; st.editando = null; return carregar(false) }
      if (t.hasAttribute('data-painel-atualiza')) { st.cache = {}; return carregar(true) }
      if (t.dataset.metaEdita) { st.editando = t.dataset.metaEdita; return carregar(false) }
      if (t.dataset.valorEdita) { st.lancando = t.dataset.valorEdita; return carregar(false) }
      if (t.matches('[data-valor-cancela]')) { st.lancando = null; return carregar(false) }
      if (t.hasAttribute('data-meta-cancela')) { st.editando = null; return carregar(false) }
      if (t.dataset.ger) { st.abertos[t.dataset.ger] = !st.abertos[t.dataset.ger]; return carregar(false) }
      if (t.dataset.abreTela) {
        st.tela = t.dataset.abreTela;
        if (st.tela === 'setores') st.setor = SETORES.some((s) => s.id === t.dataset.abreSetor) ? t.dataset.abreSetor : 'todos';
        view.querySelector('#painelCorpo').innerHTML = ''; return carregar(false);
      }
    });

    view.addEventListener('change', (e) => {
      if (e.target.matches('[data-dono]') && window.Painel && window.Painel.donos) {
        window.Painel.donos.gravar(st.marca, e.target.dataset.dono, e.target.value);
        window.showToast?.(e.target.value ? `${e.target.value} passa a responder por isso` : 'Sem dono');
        return;
      }
      if (e.target.matches('[data-de],[data-ate]')) {
        const de = view.querySelector('[data-de]')?.value, ate = view.querySelector('[data-ate]')?.value;
        if (!de || !ate) return;
        st.de = de <= ate ? de : ate; st.ate = de <= ate ? ate : de; st.preset = 'livre';
        carregar(false);
      }
    });

    view.addEventListener('submit', async (e) => {
      const f = e.target;
      if (!f.matches('[data-meta-form],[data-meta-geral],[data-valor-form]')) return;
      e.preventDefault();
      const h = hojeSP(), ano = +h.slice(0, 4), mes = +h.slice(5, 7);
      const botao = f.querySelector('[type="submit"]'); if (botao) { botao.disabled = true; botao.textContent = 'Salvando…' }
      try {
        if (f.dataset.valorForm) {
          const { escopo, canal, metrica } = partes(f.dataset.valorForm);
          const periodo = f.periodo.value === 'semanal' ? 'semanal' : 'mensal';
          const num = periodo === 'semanal' ? semanaAtual() : mes;
          await gravar('valor_setor', { escopo, canal, metrica, periodo, ano, periodo_num: num, valor: +f.valor.value || 0 });
          st.lancando = null;
          window.showToast?.(periodo === 'semanal' ? 'Número lançado nesta semana' : 'Número lançado no mês');
          return carregar(true);
        }
        if (f.dataset.metaForm) {
          const { escopo, canal, metrica } = partes(f.dataset.metaForm);
          const bruto = f.valor.value.trim();
          await gravar('meta_kpi', { escopo, canal, metrica, periodo: 'mensal', ano, periodo_num: mes, meta_valor: bruto === '' ? null : +bruto, unidade: metricaDe(f.dataset.metaForm).un });
        } else {
          await gravar('meta_mensal', { ano, mes, meta1: +f.meta1.value || 0, meta2: +f.meta2.value || 0, meta3: +f.meta3.value || 0, meta_ativa: +f.meta_ativa.value || 1 });
        }
        st.editando = null;
        window.showToast?.('Meta salva no painel');
        carregar(true);
      } catch (err) {
        window.showToast?.(`Não salvou: ${err.message}`);
        if (botao) { botao.disabled = false; botao.textContent = 'Salvar' }
      }
    });

    /* tooltip dos gráficos */
    const tip = () => view.querySelector('.pn-tip');
    view.addEventListener('mousemove', (e) => {
      const alvo = e.target.closest('[data-tip]'); const el = tip();
      if (!el) return;
      if (!alvo) { el.hidden = true; return }
      el.textContent = alvo.dataset.tip; el.hidden = false;
      const r = view.getBoundingClientRect();
      el.style.left = `${e.clientX - r.left + 12}px`; el.style.top = `${e.clientY - r.top - 34}px`;
    });
    view.addEventListener('mouseleave', () => { const el = tip(); if (el) el.hidden = true });

    observar();
    if (location.hash === '#painel') setTimeout(mostrar, 0);
    window.addEventListener('hashchange', () => { if (location.hash === '#painel' && !st.aberto) mostrar() });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ligar); else ligar();

  function registrar(tela) {
    if (!tela || !tela.id || EXTRAS.some((t) => t.id === tela.id)) return;
    EXTRAS.push(tela);
    if (st.aberto) moldura();
  }
  function abrir(tela, extra) {
    if (tela) st.tela = tela;
    if (extra && typeof extra === 'object') Object.assign(st, extra);
    const corpo = document.getElementById('painelCorpo'); if (corpo) corpo.innerHTML = '';
    if (st.aberto) carregar(false); else mostrar();
  }

  window.Painel = {
    mostrar, esconder, carregar, registrar, abrir, estado: st,
    periodoDe, avaliar, colunas, delta, moeda, num, pct,
    telas: TELAS, setores: SETORES, metricas: METRICAS, comDerivadas, envios, gravar,
    pedir: (tela, args, forcar) => pedir(tela, args || {}, forcar),
  };
})();
