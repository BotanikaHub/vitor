/* ======================================================================
   Assistente de campanha — o mesmo fluxo do planejador.

   No planejador, criar campanha nunca foi digitar um nome numa caixa: era
   escolher o formato, e o formato já trazia as datas, as fases, os canais
   e o esqueleto do TAP. É esse gesto que está aqui.

   Três passos:
     1. Formato — Dia D, Semana temática, gap, recompra, perpétuo, ou uma
        ideia livre (que vira só um nó no mapa, sem campanha).
     2. Tema — só quando é semana temática. Reaproveita os temas que já
        rodaram e aceita um novo.
     3. Nome, datas, meta e verba — as datas já vêm sugeridas pelo formato,
        e o resumo recalcula em tempo real quantos dias de cronograma saem,
        o ROAS implícito e quanto a marca soma no mês com esta ação.

   Confirmando, nasce tudo de uma vez: o nó no mapa com a cor do formato,
   a campanha na aba Campanhas e o TAP montado com as sete seções.
   ====================================================================== */
(function () {
  'use strict';

  const CHAVE_CAMP = () =>
    `central.campaigns.${(window.user && window.user.id) || 'vitor-gutierrez'}`;

  /* ---------- o que cada formato já traz pronto ---------- */
  const TIPOS = {
    diaD:     { nome: 'Dia D',            dias: 1, desc: 'Ação relâmpago de 1 dia',            cor: 0, app: 'Dia D' },
    semana:   { nome: 'Semana temática',  dias: 5, desc: '5 a 8 dias em torno de um tema',     cor: 6, app: 'Semana temática', temas: true },
    gap:      { nome: 'Ações de gap',     dias: 2, desc: 'Destravar faixa de ticket ou frete', cor: 2, app: 'Ação de GAP' },
    recompra: { nome: 'Ações de recompra',dias: 0, desc: 'Contínua no mês',                    cor: 4, app: 'Recompra' },
    perpetuo: { nome: 'Perpétuo',         dias: 0, desc: 'E-mail e API rodando sempre',        cor: 5, app: 'Perpétuo' },
    outro:    { nome: 'Outro formato',    dias: 5, desc: 'Você define tudo',                   cor: 3, app: 'Livre' },
  };

  const PADRAO = {
    diaD:     { desconto: '8% OFF',  cupom: '8% OFF geral (já embutido no preço no dia)',        frete: 'Sim — para todos, sem piso mínimo neste dia', produtos: 'Todos os SKUs',                     bump: 'Definir SKU complementar no carrinho' },
    semana:   { desconto: '10% OFF', cupom: '10% OFF na linha do tema (já embutido no preço)',   frete: 'Grátis acima de R$ 199',                      produtos: 'SKUs da linha do tema',             bump: 'SKU complementar ao tema no carrinho' },
    gap:      { desconto: '—',       cupom: 'Sem cupom — o ganho vem do combo e do frete',       frete: 'Grátis a partir de R$ 349',                   produtos: 'SKUs que fecham a faixa de ticket', bump: 'Item de baixo valor que empurra o carrinho' },
    recompra: { desconto: '12% OFF', cupom: '12% OFF exclusivo para quem já comprou',            frete: 'Grátis acima de R$ 199',                      produtos: 'Reposição do que a pessoa já comprou', bump: 'Item de manutenção junto' },
    perpetuo: { desconto: '—',       cupom: 'Sem cupom — preço de tabela',                       frete: 'Grátis acima de R$ 199',                      produtos: 'Catálogo inteiro',                  bump: 'Order bump padrão do carrinho' },
    outro:    { desconto: '—',       cupom: 'A definir',                                          frete: 'A definir',                                   produtos: 'A definir',                         bump: 'A definir' },
  };

  const EQUIPE = [
    ['Gabriel', 'Preenche o TAP — define o que será feito e as datas'],
    ['Gustavo', 'Distribui as tarefas no ClickUp e acompanha os status'],
    ['Equipe',  'Realiza as tarefas, altera o status no ClickUp e avisa a próxima pessoa que precisa da demanda'],
  ];

  const CANAIS = [
    ['E-mails base antiga',          'Base de compradores + leads',              'Pedro cria e Sarah programa'],
    ['E-mails base captada',         'não tem',                                  'Pedro cria e Sarah programa'],
    ['WhatsApp grupos antigos',      'Grupo VIP + Grupo de ofertas',             'Pedro cria e Sarah programa'],
    ['WhatsApp grupos da campanha',  'não tem',                                  'Pedro cria e Sarah programa'],
    ['WhatsApp API',                 'Base com opt-in',                          'Pedro cria e Sarah programa'],
    ['Criativos em vídeo',           'UGC conversivo',                           'Pedro cria e Gestor programa'],
    ['Criativos em imagem',          'Estáticos emocionais',                     'Pedro cria e Gestor programa'],
    ['Instagram feed',               'Italo define o planejamento',              'Italo cria planejamento e mostra Gabriel'],
    ['Instagram stories',            'Sequência antecipando + produtos + contagem','Italo cria e não precisa de aprovação'],
    ['Alteração no site',            'Banner + tarja com timer + aviso nas PDPs','Pedro'],
  ];

  /* Catálogo real da loja (Shopify · Botanika Brasil), o mesmo que o
     planejador usa. A VermeFree é outra conta Shopify e ainda não está
     cadastrada aqui — em vez de fingir um catálogo, a tela diz isso e
     abre o campo de produto escrito à mão. */
  const F = 'https://cdn.shopify.com/s/files/1/0780/7238/1672/files/';
  const CATALOGOS = {
    Botanika: [
      { curto:'Tri[Mg]',       sku:'80.1.1',  preco:87.50,  nome:'Tri[Mg] Complex — Magnésio 3 em 1 de Rápida Absorção' },
      { curto:'Vit C',         sku:'80.1.2',  preco:89.52,  nome:'Super Vitamina C — Vitamina C + Quercetina + Própolis' },
      { curto:'Ômega 3',       sku:'80.1.3',  preco:163.12, nome:'Super Ômega 3 + CoQ10 — Concentrado' },
      { curto:'Hair',          sku:'80.1.5',  preco:99.40,  nome:'Hair Botanika — Cabelos, Unhas e Pele' },
      { curto:'Sleep',         sku:'80.1.6',  preco:119.70, nome:'Sleep Inositol — Relaxamento e Rotina do Sono' },
      { curto:'Creatina',      sku:'80.1.7',  preco:128.30, nome:'Creatina Monohidratada + Magnésio Taurato' },
      { curto:'Whey',          sku:'80.1.8',  preco:147.30, nome:'Whey Balance Chocolate — Whey + Colágeno C-PURE®' },
      { curto:'TetraVit D',    sku:'80.1.9',  preco:117.12, nome:'TetraVit D — Vitaminas A, D, E e K em Gotas' },
      { curto:'Whey s/ sabor', sku:'80.1.20', preco:147.30, nome:'Whey Balance Sem Sabor — Whey Concentrado + Colágeno C-PURE®' },
      { curto:'Kit Imunidade', sku:'kitimu',  preco:361.71, nome:'Kit Imunidade — TetraVit D + Ômega 3 + Vit C', kit:true },
    ],
    VermeFree: [],
  };
  const catalogo = (marca) => CATALOGOS[marca] || [];

  const BONUS = { universal: 'Manual da Suplementação (PDF)',
                  influencer: 'Guia da Imunidade Infantil (PDF)' };

  /* De onde vem o faturamento. Tráfego e API são os dois que consomem
     verba; o resto vem de canal que não se compra. As proporções são as do
     Dia D de agosto, que é o que o planejador já usava. */
  const CANAIS_RECEITA = [
    { n:'Tráfego',               pr:.267, invPr:.67, r:'Gestor' },
    { n:'Influencer',            pr:.178, invPr:0,   r:'Joinny' },
    { n:'Instagram Bio/stories', pr:.078, invPr:0,   r:'Italo' },
    { n:'Atendimento',           pr:.056, invPr:0,   r:'Lissia' },
    { n:'Grupos antigos',        pr:.156, invPr:0,   r:'Pedro' },
    { n:'API',                   pr:.267, invPr:.33, r:'Pedro' },
  ];
  const PAGAS = ['Tráfego', 'API'];

  /* O que sobra depois de tráfego e API se reparte entre os outros na
     proporção que eles já tinham entre si. O arredondamento vai para o
     maior canal livre: o número que a pessoa digitou é o que fica. */
  function dividirReceita(meta, verba) {
    const invTraf = Math.round(verba * 0.67);
    const pagas = { 'Tráfego': { inv: invTraf, meta: Math.round(meta * 0.267) },
                    'API':     { inv: verba - invTraf, meta: Math.round(meta * 0.267) } };
    const sobra = Math.max(0, meta - pagas['Tráfego'].meta - pagas['API'].meta);
    const outros = CANAIS_RECEITA.filter((c) => !PAGAS.includes(c.n));
    const somaPr = outros.reduce((t, c) => t + c.pr, 0) || 1;
    const l = CANAIS_RECEITA.map((c) => PAGAS.includes(c.n)
      ? { n: c.n, r: c.r, on: true, inv: pagas[c.n].inv, meta: pagas[c.n].meta }
      : { n: c.n, r: c.r, on: true, inv: 0, meta: Math.round(sobra * c.pr / somaPr) });
    const livres = l.filter((x) => !PAGAS.includes(x.n));
    const somaM = l.reduce((t, x) => t + x.meta, 0);
    if (somaM !== meta && livres.length)
      livres.reduce((x, y) => (y.meta > x.meta ? y : x)).meta += meta - somaM;
    return l;
  }

  const DOW = ['DOM','SEG','TER','QUA','QUI','SEX','SÁB'];
  const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho',
                 'agosto','setembro','outubro','novembro','dezembro'];

  /* ---------- datas e dinheiro ---------- */
  const dISO = (s) => { const [a, m, d] = String(s).split('-').map(Number); return new Date(a, m - 1, d) };
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const dBR = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  const brl = (n) => 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
  const esc = (t) => String(t ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

  function diasEntre(a, b) {
    const out = []; const d = new Date(a);
    while (d <= b && out.length < 120) { out.push(new Date(d)); d.setDate(d.getDate() + 1) }
    return out;
  }
  /* Números como o Vitor escreve: "120.000", "120 mil", "120k". */
  function lerMoeda(v) {
    let s = String(v || '').toLowerCase().trim();
    if (!s) return 0;
    const mil = /\bmil\b|k$/.test(s);
    s = s.replace(/\bmil\b|k$/g, '').replace(/[^\d,.-]/g, '');
    /* ponto é separador de milhar aqui, vírgula é decimal */
    s = s.replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
    const n = parseFloat(s) || 0;
    return Math.round(mil ? n * 1000 : n);
  }

  /* ---------- o TAP ---------- */
  function fasesDe(tipo, ini, fim) {
    if (tipo === 'diaD') {
      const a = new Date(ini); a.setDate(a.getDate() - 2);
      const b = new Date(ini); b.setDate(b.getDate() - 1);
      return [['Fase 1: Captação', 'não tem', '—'],
        ['Fase 2: Antecipação', 'sim', dBR(a)],
        ['Fase 3: É amanhã', 'sim', dBR(b)],
        ['Fase 4: Dia D (venda)', 'sim', dBR(ini)],
        ['Fase 5: Última chance / relâmpago noturno', 'sim', dBR(ini) + ' · 20h']];
    }
    if (tipo === 'perpetuo' || tipo === 'recompra') {
      return [['Fase 1: No ar o mês inteiro', 'sim', `${dBR(ini)} a ${dBR(fim)}`],
        ['Fase 2: Leitura semanal', 'sim', 'toda segunda'],
        ['Fase 3: Ajuste de rota', 'sim', 'quando o número pedir']];
    }
    const dias = diasEntre(ini, fim), n = dias.length;
    const f = [['Fase 1: Captação', 'não tem', '—'],
      ['Fase 2: Antecipação', 'sim', n >= 6 ? `${dBR(dias[0])} a ${dBR(dias[1])}` : dBR(dias[0])]];
    const iA = n >= 6 ? 2 : 1;
    if (dias[iA])     f.push(['Fase 3: É amanhã a abertura', 'sim', dBR(dias[iA])]);
    if (dias[iA + 1]) f.push(['Fase 4: É hoje a abertura', 'sim', dBR(dias[iA + 1])]);
    f.push(['Fase 5: Última chance', 'sim', dBR(dias[n - 1])]);
    return f;
  }

  /* Até duas semanas, uma coluna por dia. Acima disso vira faixa semanal —
     um TAP com trinta colunas ninguém lê. */
  function colunasDe(ini, fim) {
    const dias = diasEntre(ini, fim);
    if (dias.length <= 14) return dias.map((d) => `${DOW[d.getDay()]} ${dBR(d)}`);
    const out = [];
    for (let i = 0; i < dias.length; i += 7)
      out.push(`${dBR(dias[i])}–${dBR(dias[Math.min(i + 6, dias.length - 1)])}`);
    return out;
  }

  function montarTap(c, tipo, tema) {
    const O = A || {};
    const ini = dISO(c.start), fim = dISO(c.end);
    const T = TIPOS[tipo], P = PADRAO[tipo] || PADRAO.outro;
    const periodo = c.start === c.end ? dBR(ini) : `${dBR(ini)} a ${dBR(fim)}`;
    const cols = colunasDe(ini, fim);

    /* As duas fontes que consomem verba são tráfego e API; o resto do
       faturamento vem de canal que não se compra. As proporções são as
       mesmas que o planejador já usava. */
    const rec0 = (O.receita || dividirReceita(c.goal || 0, c.budget || 0)).filter((x) => x.on !== false);
    const somaI = rec0.reduce((t, x) => t + x.inv, 0);
    const somaM = rec0.reduce((t, x) => t + x.meta, 0);
    const roas = somaI ? (somaM / somaI).toFixed(1).replace('.', ',') : '—';

    return [
      { title: 'SOBRE O EVENTO', columns: ['Campo', 'Valor'], rows: [
        ['Nome da Campanha', c.name],
        ['Formato da campanha', `${T.desc}${tema ? ' — tema ' + tema : ''} (${periodo})`],
        ['Cupom automático', c.offer],
        ['Bônus universal', `${O.bonusUniversal || '—'} — todos que comprarem`],
        ['Bônus via influencer', `${O.bonusInfluencer || '—'} — só quem comprar pela influencer`],
        ['Frete', O.frete || P.frete],
        ...(O.brinde ? [['Brinde', O.brinde]] : [])] },
      { title: 'EQUIPE', columns: ['Quem', 'Responsabilidade'], rows: EQUIPE.map((e) => [...e]) },
      { title: 'FASES', columns: ['Fase', 'Tem?', 'Data'], rows: fasesDe(tipo, ini, fim) },
      { title: 'SOBRE A OFERTA', columns: ['Produto', 'Detalhe', 'Desconto'], rows: [
        ...escolhidos().map((p) => [
          p.curto + (p.kit ? ' · kit' : ''),
          `${p.nome} · SKU ${p.sku} · R$ ${p.preco.toFixed(2).replace('.', ',')}`,
          descDe(p.sku) ? descDe(p.sku) + '% OFF' : '—']),
        ...(O.extras || []).map((t) => ['Fora do catálogo', t, '—']),
        ...(escolhidos().length || (O.extras || []).length ? [] : [['A definir', P.produtos, P.desconto]])] },
      { title: 'AUMENTO DE TICKET MÉDIO', columns: ['Estratégia', 'Detalhe', 'Desconto'], rows: [
        ['Frete grátis', O.frete || P.frete, '—'],
        ['Order bump', P.bump, '—'],
        ...(O.brinde ? [['Brinde', O.brinde, '—']] : [])] },
      { title: 'METAS', columns: ['Item', 'Valor', 'Responsável'], rows: (() => {
        /* a divisão por canal é a que a pessoa acabou de conferir no passo
           3; sem ela, cai na proporção padrão */
        const rec = (O.receita || dividirReceita(c.goal, c.budget)).filter((x) => x.on !== false);
        const l = [];
        rec.filter((x) => x.inv > 0).forEach((x) => l.push([`Investimento — ${x.n}`, brl(x.inv), x.r]));
        l.push(['ROAS alvo', roas, 'Gestor']);
        rec.forEach((x) => l.push([`Meta faturamento — ${x.n}`, brl(x.meta), x.r]));
        const sm = rec.reduce((t, x) => t + x.meta, 0), si = rec.reduce((t, x) => t + x.inv, 0);
        l.push(['Meta faturamento total', brl(sm || c.goal), ''],
               ['Investimento API e tráfego', brl(si || c.budget), ''],
               ['Lucro (aprox.)', brl((sm || c.goal) - (si || c.budget)), '']);
        return l;
      })() },
      { title: 'CANAIS · CRONOGRAMA',
        columns: ['Canal', 'Base', ...cols, 'Quem faz'],
        rows: CANAIS.map(([n, base, quem]) => [n, base, ...cols.map(() => '—'), quem]) },
    ];
  }

  const descDe = (sku) => (A.modoDesc === 'cada' ? (A.descPorSku[sku] ?? A.descGeral) : A.descGeral);
  const escolhidos = () => catalogo(A.marca).filter((p) => A.produtos.includes(p.sku));

  /* ---------- guardar ---------- */
  const lerCampanhas = () => {
    try { const v = JSON.parse(localStorage.getItem(CHAVE_CAMP()) || '[]'); return Array.isArray(v) ? v : [] }
    catch { return [] }
  };
  const somaDaMarca = (marca) =>
    lerCampanhas().filter((c) => !marca || c.brand === marca)
      .reduce((t, c) => t + Number(c.goal || 0), 0);

  /* ---------- o passo a passo ---------- */
  let A = null;

  function abrirModal(html) {
    let cx = document.querySelector('.as-fundo');
    if (!cx) {
      cx = document.createElement('div');
      cx.className = 'as-fundo';
      cx.addEventListener('pointerdown', (e) => { if (e.target === cx) fechar() });
      document.body.appendChild(cx);
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.querySelector('.as-fundo')) { e.stopPropagation(); fechar() }
      }, true);
    }
    cx.innerHTML = `<div class="as-cx" role="dialog" aria-modal="true">${html}</div>`;
    return cx.firstElementChild;
  }
  function fechar() { document.querySelector('.as-fundo')?.remove() }

  function comecar(noId) {
    const hoje = new Date();
    const marca = window.MapaMental?.marca?.() || '';
    A = { noId, marca, tipo: null, tema: null, nome: '',
          inicio: iso(hoje), fim: iso(hoje), meta: 45000, verba: 4500,
          /* todos os produtos entram até alguém tirar algum — é mais rápido
             desmarcar dois do que marcar oito */
          produtos: catalogo(marca).map((p) => p.sku),
          modoDesc: 'todos', descGeral: 8, descPorSku: {}, descTocado: false,
          extras: [], frete: undefined, brinde: '',
          bonusUniversal: undefined, bonusInfluencer: undefined,
          receita: null };
    passo1();
  }

  function passo1() {
    const cx = abrirModal(`
      <h3>Nova campanha</h3>
      <p class="as-sub">Escolha o formato. As datas, as fases e o TAP se montam a partir dele.</p>
      <div class="as-ops">
        ${Object.entries(TIPOS).map(([k, t]) =>
          `<button class="as-op" data-tipo="${k}"><b>${t.nome}</b><small>${t.desc}</small></button>`).join('')}
        <button class="as-op as-livre" data-tipo="livre"><b>Livre</b>
          <small>Só uma ideia no mapa — sem campanha, sem TAP, sem datas</small></button>
      </div>
      <div class="as-bts"><button class="as-bt" data-fechar>Cancelar</button></div>`);
    cx.querySelectorAll('[data-tipo]').forEach((b) => {
      b.onclick = () => (b.dataset.tipo === 'livre' ? soUmNo() : escolherTipo(b.dataset.tipo));
    });
    cx.querySelector('[data-fechar]').onclick = fechar;
  }

  /* "Livre" existe porque nem toda ideia é campanha: às vezes é só um nó
     para pensar em cima, e forçar um TAP em cima disso atrapalha. */
  function soUmNo() {
    fechar();
    const nome = 'nova ideia';
    window.MapaMental?.virarCampanha(A.noId, { nome, cor: 3, campId: null });
  }

  function escolherTipo(k) {
    A.tipo = k;
    const T = TIPOS[k], hoje = new Date();
    if (k === 'perpetuo' || k === 'recompra') {
      A.inicio = iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
      A.fim    = iso(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0));
      A.meta = k === 'perpetuo' ? 0 : 30000;
    } else {
      const f = new Date(hoje); f.setDate(hoje.getDate() + Math.max(0, T.dias - 1));
      A.inicio = iso(hoje); A.fim = iso(f);
    }
    A.verba = Math.round(A.meta * 0.1);
    if (T.temas) passoTema(); else passoDados();
  }

  function passoTema() {
    /* os temas que já rodaram saem das próprias campanhas gravadas: não
       existe catálogo separado para sair de sincronia */
    const temas = [...new Set(lerCampanhas()
      .map((c) => (c.name.match(/^Semana (.+)$/) || [])[1]).filter(Boolean))];
    const cx = abrirModal(`
      <h3>Qual tema</h3>
      <p class="as-sub">Os temas que já rodaram, ou um novo.</p>
      <div class="as-ops">
        ${temas.map((t) => `<button class="as-op" data-tema="${esc(t)}"><b>${esc(t)}</b></button>`).join('')}
        <button class="as-op as-novo" data-novo><b>+ novo tema</b></button>
      </div>
      <div class="as-bts"><button class="as-bt" data-voltar>Voltar</button></div>`);
    cx.querySelectorAll('[data-tema]').forEach((b) => {
      b.onclick = () => { A.tema = b.dataset.tema; A.nome = 'Semana ' + A.tema; passoDados() };
    });
    cx.querySelector('[data-novo]').onclick = () => {
      const t = prompt('Nome do tema (ex: Imunidade, Fitness, Energia):');
      if (!t) return;
      A.tema = t.trim(); A.nome = 'Semana ' + A.tema; passoDados();
    };
    cx.querySelector('[data-voltar]').onclick = passo1;
  }

  function passoDados() {
    const T = TIPOS[A.tipo];
    if (!A.nome) A.nome = `${T.nome} — ${MESES[dISO(A.inicio).getMonth()]}`;
    const cx = abrirModal(`
      <div class="as-passos">Passo <b>1</b> de 3 · números</div>
      <h3>${T.nome}${A.tema ? ' · ' + esc(A.tema) : ''}</h3>
      <p class="as-sub">Datas, meta e verba. O resto do TAP nasce disso e você ajusta depois.</p>
      <label class="as-campo"><span>Nome da campanha</span>
        <input id="as-nome" value="${esc(A.nome)}"></label>
      <div class="as-dupla">
        <label class="as-campo"><span>Início</span><input type="date" id="as-ini" value="${A.inicio}"></label>
        <label class="as-campo"><span>Fim</span><input type="date" id="as-fim" value="${A.fim}"></label>
      </div>
      <div class="as-dupla">
        <label class="as-campo"><span>Meta de faturamento</span>
          <input id="as-meta" inputmode="numeric" value="${A.meta.toLocaleString('pt-BR')}"
                 placeholder="120.000 — ou 120 mil"></label>
        <label class="as-campo"><span>Verba</span>
          <input id="as-verba" inputmode="numeric" value="${A.verba.toLocaleString('pt-BR')}"></label>
      </div>
      <div class="as-resumo" id="as-resumo"></div>
      <div class="as-bts">
        <button class="as-bt" data-voltar>Voltar</button>
        <button class="as-bt as-ok" data-adiante>Produtos e oferta →</button>
      </div>`);
    const ids = ['as-nome', 'as-ini', 'as-fim', 'as-meta', 'as-verba'];
    ids.forEach((id) => { cx.querySelector('#' + id).oninput = resumo });
    cx.querySelector('[data-voltar]').onclick = () => (TIPOS[A.tipo].temas ? passoTema() : passo1());
    cx.querySelector('[data-adiante]').onclick = () => { lerCampos(); passoOferta() };
    resumo();
  }

  function lerCampos() {
    const g = (id) => document.getElementById(id);
    A.nome = g('as-nome').value.trim() || A.nome;
    A.inicio = g('as-ini').value; A.fim = g('as-fim').value;
    A.meta = lerMoeda(g('as-meta').value);
    A.verba = lerMoeda(g('as-verba').value);
  }

  function resumo() {
    lerCampos();
    const el = document.getElementById('as-resumo'); if (!el) return;
    const ini = dISO(A.inicio), fim = dISO(A.fim);
    if (!A.inicio || !A.fim || fim < ini) {
      el.className = 'as-resumo as-erro';
      el.textContent = 'Confira as datas: o fim não pode ser antes do início.';
      return;
    }
    const dias = diasEntre(ini, fim).length;
    const cols = colunasDe(ini, fim).length;
    const roas = A.verba ? (A.meta / A.verba).toFixed(1).replace('.', ',') : '—';
    const somaAntes = somaDaMarca(A.marca);
    el.className = 'as-resumo';
    el.innerHTML =
      `<span><b>${dias}</b> dia${dias > 1 ? 's' : ''} · <b>${cols}</b> coluna${cols > 1 ? 's' : ''} no cronograma</span>` +
      `<span>ROAS implícito <b>${roas}</b></span>` +
      `<span>${esc(A.marca || 'A marca')} passa de <b>${brl(somaAntes)}</b> para <b>${brl(somaAntes + A.meta)}</b> no mês</span>`;
  }

  /* ---------- passo 2: produtos e oferta ---------- */
  function passoOferta() {
    const P = PADRAO[A.tipo] || PADRAO.outro;
    const prods = catalogo(A.marca);
    if (!A.descTocado) A.descGeral = parseInt(P.desconto) || 8;
    if (A.frete === undefined) A.frete = P.frete;
    if (A.bonusUniversal === undefined) A.bonusUniversal = BONUS.universal;
    if (A.bonusInfluencer === undefined) A.bonusInfluencer = BONUS.influencer;

    const cx = abrirModal(`
      <div class="as-passos">Passo <b>2</b> de 3 · oferta</div>
      <h3>Produtos e desconto</h3>
      <p class="as-sub">${prods.length
        ? 'O catálogo vem da Shopify. Desmarque o que não entra e escreva o que não está na loja.'
        : ''}</p>
      ${prods.length ? '' : `<p class="as-alerta">O catálogo da <b>${esc(A.marca || 'marca')}</b>
        ainda não está cadastrado aqui — a loja dela é outra conta na Shopify.
        Escreva os produtos desta ação em <b>Fora do catálogo</b>, com o desconto de cada um.</p>`}
      <div class="as-radio">
        <button data-modo="todos" class="${A.modoDesc === 'todos' ? 'as-on' : ''}">Mesmo % para todos</button>
        <button data-modo="cada"  class="${A.modoDesc === 'cada'  ? 'as-on' : ''}">Um % por produto</button>
      </div>
      <label class="as-campo" id="as-cx-desc" style="${A.modoDesc === 'todos' ? '' : 'display:none'}">
        <span>Desconto da ação (%)</span>
        <input type="number" id="as-desc" min="0" max="90" step="1" value="${A.descGeral}"></label>
      ${prods.length ? `<div class="as-cab"><span>Produto</span><span>Preço</span><span>% OFF</span></div>
      <div class="as-lista">${prods.map((p) => {
        const on = A.produtos.includes(p.sku);
        return `<label class="as-lin ${on ? '' : 'as-off'}" data-sku="${p.sku}">
          <input type="checkbox" data-prod="${p.sku}" ${on ? 'checked' : ''}>
          <span class="as-nm">${esc(p.curto)}${p.kit ? ' · kit' : ''}
            <small>${esc(p.nome)} · SKU ${esc(p.sku)}</small></span>
          <span class="as-preco">R$ ${p.preco.toFixed(2).replace('.', ',')}</span>
          <input type="number" class="as-dsku" data-sku="${p.sku}" min="0" max="90"
                 value="${A.descPorSku[p.sku] ?? A.descGeral}"
                 style="${A.modoDesc === 'cada' ? '' : 'visibility:hidden'}">
        </label>`; }).join('')}</div>` : ''}
      <label class="as-campo"><span>Produto fora do catálogo (um por linha)</span>
        <textarea id="as-extras" rows="2" placeholder="Ex: Combo Fitness · 15% OFF">${esc(A.extras.join('\n'))}</textarea></label>
      <div class="as-dupla">
        <label class="as-campo"><span>Frete grátis</span><input id="as-frete" value="${esc(A.frete)}"></label>
        <label class="as-campo"><span>Brinde (opcional)</span>
          <input id="as-brinde" value="${esc(A.brinde)}" placeholder="Ex: coqueteleira acima de R$ 400"></label>
      </div>
      <div class="as-dupla">
        <label class="as-campo"><span>Bônus universal</span><input id="as-bu" value="${esc(A.bonusUniversal)}"></label>
        <label class="as-campo"><span>Bônus via influencer</span><input id="as-bi" value="${esc(A.bonusInfluencer)}"></label>
      </div>
      <div class="as-bts">
        <button class="as-bt" data-voltar>Voltar</button>
        <button class="as-bt as-ok" data-adiante>Canais e metas →</button>
      </div>`);

    cx.querySelectorAll('[data-modo]').forEach((b) => {
      b.onclick = () => { guardaOferta(); A.modoDesc = b.dataset.modo; passoOferta() };
    });
    cx.querySelectorAll('[data-prod]').forEach((c) => {
      c.onchange = () => {
        const sku = c.dataset.prod;
        A.produtos = c.checked ? [...new Set([...A.produtos, sku])] : A.produtos.filter((x) => x !== sku);
        c.closest('.as-lin').classList.toggle('as-off', !c.checked);
      };
    });
    cx.querySelectorAll('.as-dsku').forEach((i) => {
      i.onchange = () => { A.descPorSku[i.dataset.sku] = +i.value };
    });
    const d = cx.querySelector('#as-desc');
    if (d) d.oninput = () => {
      A.descGeral = +d.value || 0; A.descTocado = true;
      /* quem não teve % próprio acompanha o geral; quem teve, fica */
      cx.querySelectorAll('.as-dsku').forEach((i) => {
        if (A.descPorSku[i.dataset.sku] === undefined) i.value = A.descGeral;
      });
    };
    cx.querySelector('[data-voltar]').onclick = () => { guardaOferta(); passoDados() };
    cx.querySelector('[data-adiante]').onclick = () => { guardaOferta(); passoCanais() };
  }

  function guardaOferta() {
    const g = (id) => document.getElementById(id);
    if (!g('as-frete')) return;
    A.frete = g('as-frete').value;
    A.brinde = g('as-brinde').value;
    A.bonusUniversal = g('as-bu').value;
    A.bonusInfluencer = g('as-bi').value;
    A.extras = g('as-extras').value.split('\n').map((t) => t.trim()).filter(Boolean);
  }

  /* ---------- passo 3: canais que faturam ---------- */
  function passoCanais() {
    if (!A.receita) A.receita = dividirReceita(A.meta, A.verba);
    const cx = abrirModal(`
      <div class="as-passos">Passo <b>3</b> de 3 · canais</div>
      <h3>Onde entra a verba e de onde vem o faturamento</h3>
      <p class="as-sub">Já vem dividido na proporção que a operação costuma ter. Mexa no que for diferente desta vez.</p>
      <div class="as-cab as-cab3"><span>Canal que fatura</span><span>Investimento</span><span>Meta</span></div>
      <div class="as-lista">${A.receita.map((c, i) => `
        <label class="as-lin as-lin3 ${c.on ? '' : 'as-off'}" data-i="${i}">
          <input type="checkbox" data-on="${i}" ${c.on ? 'checked' : ''}>
          <span class="as-nm">${esc(c.n)}<small>${esc(c.r)}</small></span>
          <input type="text" inputmode="numeric" data-inv="${i}" value="${Number(c.inv || 0).toLocaleString('pt-BR')}">
          <input type="text" inputmode="numeric" data-meta="${i}" value="${Number(c.meta || 0).toLocaleString('pt-BR')}">
        </label>`).join('')}</div>
      <div class="as-resumo" id="as-somas"></div>
      <div class="as-bts">
        <button class="as-bt" data-voltar>Voltar</button>
        <button class="as-bt as-ok" data-criar>Criar campanha</button>
      </div>`);

    const ler = () => {
      A.receita.forEach((c, i) => {
        c.on = cx.querySelector(`[data-on="${i}"]`).checked;
        c.inv = lerMoeda(cx.querySelector(`[data-inv="${i}"]`).value);
        c.meta = lerMoeda(cx.querySelector(`[data-meta="${i}"]`).value);
      });
      somas();
    };
    cx.querySelectorAll('[data-on],[data-inv],[data-meta]').forEach((e) => {
      e.oninput = ler;
      e.onchange = () => { ler(); e.closest('.as-lin')?.classList.toggle('as-off', e.type === 'checkbox' && !e.checked) };
    });
    cx.querySelector('[data-voltar]').onclick = passoOferta;
    cx.querySelector('[data-criar]').onclick = criar;
    somas();

    function somas() {
      const on = A.receita.filter((c) => c.on);
      const sm = on.reduce((t, c) => t + c.meta, 0);
      const si = on.reduce((t, c) => t + c.inv, 0);
      const el = cx.querySelector('#as-somas');
      const sobra = A.meta - sm;
      el.className = 'as-resumo' + (Math.abs(sobra) > 1 ? ' as-atencao' : '');
      el.innerHTML =
        `<span>Somando os canais: <b>${brl(sm)}</b> de meta e <b>${brl(si)}</b> de verba</span>` +
        `<span>ROAS <b>${si ? (sm / si).toFixed(1).replace('.', ',') : '—'}</b></span>` +
        (Math.abs(sobra) > 1
          ? `<span>${sobra > 0 ? 'Faltam' : 'Passa em'} <b>${brl(Math.abs(sobra))}</b> para bater a meta da ação</span>`
          : '<span>Fecha com a meta da ação</span>');
    }
  }

  function criar() {
    /* os números já foram lidos no passo 1; aqui só se confere que ainda
       fazem sentido antes de gravar */
    const ini = dISO(A.inicio), fim = dISO(A.fim);
    if (!A.inicio || !A.fim || fim < ini) { passoDados(); return }
    const T = TIPOS[A.tipo];
    const hoje = iso(new Date());
    const c = {
      id: 'c-' + Date.now().toString(36),
      name: A.nome, brand: A.marca || 'Botanika', type: T.app,
      status: A.fim < hoje ? 'Leitura' : (A.inicio > hoje ? 'Planejamento' : 'Em execução'),
      owner: 'Vitor Gutierrez',
      start: A.inicio, end: A.fim,
      goal: A.meta, budget: A.verba, progress: 0,
      color: A.marca === 'VermeFree' ? '#4f8a70' : '#121415',
      objective: `${T.desc}${A.tema ? ' — tema ' + A.tema : ''}`,
      offer: A.modoDesc === 'cada'
        ? 'Desconto por produto (já embutido no preço) — ver SOBRE A OFERTA'
        : `${A.descGeral}% OFF geral (já embutido no preço)`,
      channels: CANAIS.map((x) => x[0]),
      products: escolhidos().map((p) => ({ name: p.curto, price: p.preco, discount: descDe(p.sku) })),
      benefits: [A.frete, A.brinde, A.bonusUniversal, A.bonusInfluencer].filter(Boolean),
      schedule: [],
      tap: null,
    };
    c.tap = montarTap(c, A.tipo, A.tema);

    const todas = lerCampanhas();
    todas.push(c);
    /* pelo localStorage, que é o que a ponte espelha para o Supabase — daí
       a campanha aparece para a equipe inteira, e não só aqui */
    localStorage.setItem(CHAVE_CAMP(), JSON.stringify(todas));

    fechar();
    window.MapaMental?.virarCampanha(A.noId, { nome: c.name, cor: T.cor, campId: c.id });
    window.RecarregarCampanhas?.();
    aviso(`"${c.name}" criada — nó no mapa e TAP montado.`);
  }

  function aviso(texto) {
    const t = document.createElement('div');
    t.className = 'as-aviso'; t.textContent = texto;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4200);
  }

  window.AssistenteCampanha = comecar;

  /* Os dois botões de "+ Nova campanha" do app abriam o modal antigo, que
     monta um TAP genérico de quatro seções. Ter dois jeitos de criar
     campanha, cada um gerando um TAP diferente, é como a operação começa a
     divergir de si mesma. Então os dois passam a abrir o assistente.

     Na captura e com stopImmediatePropagation porque o app registra o
     próprio ouvinte no mesmo botão; sem isso os dois abriam juntos. */
  document.addEventListener('click', (e) => {
    const bt = e.target.closest('#newCampaignBtn, #planAddCampaignBtn');
    if (!bt) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    comecar(null);
  }, true);

  /* Abrir a campanha a partir do nó: leva para a aba Campanhas. Como o app
     não expõe uma função para isso, uso o caminho que ele mesmo usa. */
  window.AbrirCampanha = function (campId) {
    if (window.openCampaignWorkspace) return window.openCampaignWorkspace(campId);
    const bt = [...document.querySelectorAll('button,a,[role="button"]')]
      .find((b) => /campanhas/i.test(b.textContent + ' ' + (b.title || '')) && b.offsetParent);
    bt?.click();
  };
})();
