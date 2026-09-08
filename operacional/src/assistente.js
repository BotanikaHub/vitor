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
    const ini = dISO(c.start), fim = dISO(c.end);
    const T = TIPOS[tipo], P = PADRAO[tipo] || PADRAO.outro;
    const periodo = c.start === c.end ? dBR(ini) : `${dBR(ini)} a ${dBR(fim)}`;
    const cols = colunasDe(ini, fim);

    /* As duas fontes que consomem verba são tráfego e API; o resto do
       faturamento vem de canal que não se compra. As proporções são as
       mesmas que o planejador já usava. */
    const invTraf = Math.round((c.budget || 0) * 0.67);
    const invApi  = (c.budget || 0) - invTraf;
    const metaTraf = Math.round((c.goal || 0) * 0.267);
    const roas = invTraf ? (metaTraf / invTraf).toFixed(1).replace('.', ',') : '—';

    return [
      { title: 'SOBRE O EVENTO', columns: ['Campo', 'Valor'], rows: [
        ['Nome da Campanha', c.name],
        ['Formato da campanha', `${T.desc}${tema ? ' — tema ' + tema : ''} (${periodo})`],
        ['Cupom automático', P.cupom],
        ['Bônus universal', 'A definir — todos que comprarem'],
        ['Bônus via influencer', 'A definir — só quem comprar pela influencer'],
        ['Frete', P.frete]] },
      { title: 'EQUIPE', columns: ['Quem', 'Responsabilidade'], rows: EQUIPE.map((e) => [...e]) },
      { title: 'FASES', columns: ['Fase', 'Tem?', 'Data'], rows: fasesDe(tipo, ini, fim) },
      { title: 'SOBRE A OFERTA', columns: ['Produto', 'Detalhe', 'Desconto'], rows: [
        ['Produtos participantes', P.produtos, P.desconto],
        ['Order bump', P.bump, '—']] },
      { title: 'AUMENTO DE TICKET MÉDIO', columns: ['Estratégia', 'Detalhe', 'Desconto'], rows: [
        ['Frete grátis', P.frete, '—'],
        ['Order bump', P.bump, '—']] },
      { title: 'METAS', columns: ['Item', 'Valor', 'Responsável'], rows: [
        ['Investimento — Tráfego', brl(invTraf), 'Gestor'],
        ['Investimento — API', brl(invApi), 'Gestor'],
        ['ROAS alvo', roas, 'Gestor'],
        ['Meta faturamento total', brl(c.goal), ''],
        ['Investimento API e tráfego', brl(c.budget), ''],
        ['Lucro (aprox.)', brl((c.goal || 0) - (c.budget || 0)), '']] },
      { title: 'CANAIS · CRONOGRAMA',
        columns: ['Canal', 'Base', ...cols, 'Quem faz'],
        rows: CANAIS.map(([n, base, quem]) => [n, base, ...cols.map(() => '—'), quem]) },
    ];
  }

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
          inicio: iso(hoje), fim: iso(hoje), meta: 45000, verba: 4500 };
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
        <button class="as-bt as-ok" data-criar>Criar campanha</button>
      </div>`);
    const ids = ['as-nome', 'as-ini', 'as-fim', 'as-meta', 'as-verba'];
    ids.forEach((id) => { cx.querySelector('#' + id).oninput = resumo });
    cx.querySelector('[data-voltar]').onclick = () => (TIPOS[A.tipo].temas ? passoTema() : passo1());
    cx.querySelector('[data-criar]').onclick = criar;
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

  function criar() {
    lerCampos();
    const ini = dISO(A.inicio), fim = dISO(A.fim);
    if (!A.inicio || !A.fim || fim < ini) return resumo();
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
      offer: (PADRAO[A.tipo] || PADRAO.outro).cupom,
      channels: CANAIS.map((x) => x[0]),
      products: [], benefits: [], schedule: [],
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
