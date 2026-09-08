/* ======================================================================
   Contínuas fora da grade.

   Perpétuo e orgânico rodam o mês inteiro. Desenhados como barra em todo
   dia, eles enchem o calendário e escondem justamente o que tem data
   marcada — o Dia D, a Semana do Cliente, a ação de gap. Pior: no mês só
   cabem dois por dia, e as contínuas começam dia 1, então ganham sempre as
   duas vagas. O que é pontual virava "+3 itens".

   Aqui elas saem para uma faixa própria em cima, e a grade guarda o que
   tem data. Quem quiser ver tudo junto tem o botão para trazer de volta —
   a escolha fica guardada.

   Vale para o Mês e para a Semana, que é a mesma leitura em outra régua.
   ====================================================================== */
(function () {
  'use strict';

  const CHAVE_MODO = 'central.cal.continuas';
  const chaveCamp = () => `central.campaigns.${(window.user && window.user.id) || 'vitor-gutierrez'}`;
  const chaveTar  = () => `central.tasks.${(window.user && window.user.id) || 'vitor-gutierrez'}`;

  const ler = (k) => { try { const v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : [] } catch { return [] } };
  const esc = (t) => String(t ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const naGrade = () => localStorage.getItem(CHAVE_MODO) === '1';

  /* Contínua é a que não tem dia: perpétuo e recompra por natureza, e
     qualquer uma que cubra o mês quase inteiro — o critério é o mesmo do
     planejador, para as duas telas concordarem. */
  function ehContinua(c) {
    if (['Perpétuo', 'Recompra'].includes(c.type)) return true;
    const a = new Date(c.start), b = new Date(c.end);
    if (isNaN(a) || isNaN(b)) return false;
    const dias = Math.round((b - a) / 86400000) + 1;
    const noMes = new Date(b.getFullYear(), b.getMonth() + 1, 0).getDate();
    return dias >= noMes * 0.9;
  }

  /* Os mesmos filtros que o app aplica, lidos dos mesmos campos: se a
     pessoa filtrou por status, a faixa tem que respeitar. */
  function campanhas() {
    const q = (document.getElementById('campaignSearch')?.value || '').trim().toLowerCase();
    const st = document.getElementById('campaignStatusFilter')?.value || '';
    const marcaSel = document.getElementById('brandSelect')?.value || '';
    const marca = /todas/i.test(marcaSel) ? '' : marcaSel;
    return ler(chaveCamp()).filter((c) => {
      if (marca && c.brand !== marca) return false;
      if (st && c.status !== st) return false;
      if (q && !`${c.name} ${c.type} ${c.owner} ${c.offer}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }
  function tarefas() {
    const marcaSel = document.getElementById('brandSelect')?.value || '';
    const marca = /todas/i.test(marcaSel) ? '' : marcaSel;
    return ler(chaveTar()).filter((t) => !marca || t.brand === marca);
  }

  /* Mesmo quando as contínuas voltam para a grade, o que tem data vem
     primeiro: só cabem três por dia, e deixar o perpétuo tomar as vagas é
     recriar o problema que essa tela veio resolver. */
  const pontualPrimeiro = (a, b) => (ehContinua(a) ? 1 : 0) - (ehContinua(b) ? 1 : 0);

  /* ---------- filtro por tipo ---------- */
  const CHAVE_FILTRO = 'central.cal.filtro';
  const filtro = () => localStorage.getItem(CHAVE_FILTRO) || 'tudo';
  const FILTROS = [
    ['tudo',     'Tudo'],
    ['pontuais', 'Pontuais'],
    ['continuas','Contínuas'],
    ['Dia D',            'Dia D'],
    ['Semana temática',  'Semana'],
    ['Ação de GAP',      'Gap'],
    ['Recompra',         'Recompra'],
  ];
  function passaNoFiltro(c) {
    const f = filtro();
    if (f === 'tudo') return true;
    if (f === 'pontuais') return !ehContinua(c);
    if (f === 'continuas') return ehContinua(c);
    return c.type === f;
  }

  /* ---------- a faixa das contínuas, com os filtros ---------- */
  function faixa(onde, lista) {
    const antiga = onde.parentElement?.querySelector('.cal-faixa');
    if (antiga) antiga.remove();
    const f = document.createElement('div');
    f.className = 'cal-faixa';
    const n = lista.length;
    f.innerHTML =
      `<div class="cal-faixa-cab">` +
        `<div class="cal-filtros">${FILTROS.map(([k, r]) =>
          `<button type="button" data-f="${k}" class="${filtro() === k ? 'cal-on' : ''}">${r}</button>`).join('')}</div>` +
        (n ? `<button type="button" class="cal-alternar">${naGrade() ? 'tirar as contínuas' : 'contínuas na grade'}</button>` : '') +
      `</div>` +
      (n && !naGrade()
        ? `<div class="cal-faixa-corpo">` +
            `<span class="cal-faixa-tit">No mês inteiro</span>` +
            `<div class="cal-faixa-chips">${lista.map((c) =>
              `<button class="cal-chip" type="button" data-abrir="${esc(c.name)}" style="--pc:${c.color || '#121415'}">` +
              `${esc(c.name)}</button>`).join('')}</div>` +
          `</div>`
        : '');
    f.querySelectorAll('[data-f]').forEach((b) => {
      b.onclick = () => { localStorage.setItem(CHAVE_FILTRO, b.dataset.f); redesenhar(true) };
    });
    const alt = f.querySelector('.cal-alternar');
    if (alt) alt.onclick = () => { localStorage.setItem(CHAVE_MODO, naGrade() ? '0' : '1'); redesenhar(true) };
    onde.parentElement.insertBefore(f, onde);
    abrir(f);
  }

  const abrir = (raiz) => raiz.querySelectorAll('[data-abrir]').forEach((b) => {
    b.onclick = () => window.openCampaignWorkspaceByName?.(b.dataset.abrir);
  });

  /* ---------- as barras ----------
     Uma barra por campanha atravessando os dias dela, e não um chip
     repetido em cada dia: é o desenho do planejador, e é o que deixa ler
     de relance quanto tempo cada ação ocupa. Barras que se cruzam ganham
     faixas empilhadas; a que entra ou sai da semana perde o canto
     arredondado daquele lado e ganha a setinha. */
  const MS = 86400000;
  const soData = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dISO = (s) => { const [a, m, d] = String(s).split('-').map(Number); return new Date(a, m - 1, d) };
  const isoDe = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  /* segunda como primeiro dia: é como a operação conta a semana */
  const colDe = (d) => (d.getDay() + 6) % 7;

  function semanasDe(ano, mes) {
    const prim = new Date(ano, mes - 1, 1);
    const ini = new Date(prim); ini.setDate(1 - colDe(prim));
    const out = [];
    for (let i = 0; i < 6; i++) {
      const a = new Date(ini); a.setDate(ini.getDate() + i * 7);
      const b = new Date(a); b.setDate(a.getDate() + 6);
      if (a.getMonth() === mes - 1 || b.getMonth() === mes - 1) out.push({ a, b });
    }
    return out;
  }

  const ALT_BARRA = 22;
  const TOPO_BARRA = 34;   // abaixo da linha do número do dia
  function semanaHtml(s, lista, ts, mes, hoje) {
    const at = lista.filter((c) => dISO(c.start) <= s.b && dISO(c.end) >= s.a);
    const fx = [];
    at.forEach((c) => {
      const i1 = dISO(c.start) < s.a ? 0 : colDe(dISO(c.start));
      const i2 = dISO(c.end) > s.b ? 6 : colDe(dISO(c.end));
      let f = 0;
      while (fx.some((x) => x.faixa === f && !(x.fim < i1 || x.ini > i2))) f++;
      fx.push({ c, ini: i1, fim: i2, faixa: f });
    });
    const nf = fx.length ? Math.max(...fx.map((f) => f.faixa)) + 1 : 0;
    const alt = nf * ALT_BARRA;

    const dias = [...Array(7)].map((_, k) => {
      const d = new Date(s.a); d.setDate(s.a.getDate() + k);
      const fora = mes != null && d.getMonth() !== mes - 1;
      const eh = +soData(d) === +soData(hoje);
      const venc = ts.filter((t) => t.due === isoDe(d)).length;
      /* o número fica em cima e as barras começam abaixo dele: com o
         número empurrado por padding, a barra passava por cima e o dia
         sumia — era o que acontecia na semana da Semana do Cliente */
      return `<div class="cal-dia ${fora ? 'cal-fora' : ''} ${eh ? 'cal-hoje' : ''}">` +
        `<span class="cal-n">${d.getDate()}</span>` +
        `<span class="cal-espaco" style="height:${alt}px"></span>` +
        (venc ? `<span class="cal-venc">${venc} ${venc > 1 ? 'prazos' : 'prazo'}</span>` : '') +
        `</div>`;
    }).join('');

    const barras = fx.map((f) => {
      const larg = (f.fim - f.ini + 1) / 7 * 100, esq = f.ini / 7 * 100;
      const ci = dISO(f.c.start) < s.a, cf = dISO(f.c.end) > s.b;
      return `<button class="cal-barra" type="button" data-abrir="${esc(f.c.name)}"` +
        ` title="${esc(f.c.name)} · ${esc(f.c.type)}"` +
        ` style="left:calc(${esq}% + 5px);width:calc(${larg}% - 10px);top:${TOPO_BARRA + f.faixa * ALT_BARRA}px;` +
        `background:${f.c.color || '#121415'};` +
        `border-top-left-radius:${ci ? 0 : 5}px;border-bottom-left-radius:${ci ? 0 : 5}px;` +
        `border-top-right-radius:${cf ? 0 : 5}px;border-bottom-right-radius:${cf ? 0 : 5}px">` +
        `${ci ? '‹ ' : ''}${esc(f.c.name)}${cf ? ' ›' : ''}</button>`;
    }).join('');

    return `<div class="cal-sem"><div class="cal-dias">${dias}</div><div class="cal-barras">${barras}</div></div>`;
  }

  function grade(onde, lista, ts, semanas, mes) {
    const hoje = new Date(2026, 8, 7);   // o app inteiro trabalha nesta data
    onde.innerHTML =
      `<div class="cal-cab">${['seg','ter','qua','qui','sex','sáb','dom']
        .map((d) => `<div>${d}</div>`).join('')}</div>` +
      semanas.map((s) => semanaHtml(s, lista, ts, mes, hoje)).join('');
    abrir(onde);
  }

  const visiveis = () => {
    const cs = campanhas().filter(passaNoFiltro);
    return naGrade() ? cs : cs.filter((c) => !ehContinua(c));
  };

  /* ---------- mês ---------- */
  function desenharMes() {
    const g = document.getElementById('planMonthGrid');
    if (!g) return;
    g.classList.add('cal-grade');
    grade(g, visiveis(), tarefas(), semanasDe(2026, 9), 9);
    faixa(g, campanhas().filter(ehContinua));
  }

  /* ---------- semana ----------
     A mesma régua do mês, recortada em uma semana: segunda a domingo,
     porque é assim que a operação conta. Embaixo, o que vence em cada dia,
     que é a leitura que a semana tem a mais. */
  function desenharSemana() {
    const g = document.getElementById('planWeekGrid');
    if (!g) return;
    g.classList.add('cal-grade', 'cal-semana');
    const s = { a: new Date(2026, 8, 7), b: new Date(2026, 8, 13) };
    const ts = tarefas();
    grade(g, visiveis(), ts, [s], null);

    /* A faixa de prazos só existe quando há prazo para mostrar. As tarefas
       do app vivem numa variável interna dele até alguém mexer em alguma;
       antes disso o localStorage está vazio, e sete colunas dizendo "sem
       prazo" seriam uma tela cheia de nada. */
    if (!ts.length) { faixa(g, campanhas().filter(ehContinua)); return; }

    const dias = [...Array(7)].map((_, k) => {
      const d = new Date(s.a); d.setDate(s.a.getDate() + k);
      const dia = isoDe(d);
      const rows = ts.filter((t) => t.due === dia);
      return `<section class="cal-col ${dia === '2026-09-07' ? 'cal-hoje' : ''}">` +
        `<div class="cal-col-cab"><b>${['seg','ter','qua','qui','sex','sáb','dom'][k]}</b>` +
        `<span>${String(d.getDate()).padStart(2, '0')}/09</span></div>` +
        (rows.length
          ? rows.map((t) => `<div class="cal-tarefa"><b>${esc(t.title)}</b>` +
              `<span>${esc((t.assignees || [])[0] || 'sem responsável')} · ${esc(t.status || '')}</span></div>`).join('')
          : '<div class="cal-nada">sem prazo</div>') +
        `</section>`;
    }).join('');
    g.insertAdjacentHTML('beforeend', `<div class="cal-cols">${dias}</div>`);
    faixa(g, campanhas().filter(ehContinua));
  }

  /* ---------- o calendário da aba Campanhas ----------
     Ele mostrava uma coluna por dia com todas as campanhas repetidas — as
     seis contínuas em cada uma das sete colunas. Passa a ser a mesma
     grade de barras, que é o que o Vitor lê no planejador. */
  function desenharCampanhas() {
    const g = document.getElementById('campaignCalendar');
    if (!g) return;
    g.classList.add('cal-grade');
    grade(g, visiveis(), tarefas(), semanasDe(2026, 9), 9);
    faixa(g, campanhas().filter(ehContinua));
  }

  /* ---------- quando redesenhar ----------
     O app remonta essas grades ao trocar de aba, de marca e de filtro. Em
     vez de adivinhar o momento, olho o resultado: se a assinatura do que
     está na tela mudou, refaço. A assinatura evita o laço — o meu próprio
     desenho não dispara outro. */
  let assinatura = null;

  /* A marca vai num filho das grades, e não nelas: o app troca o
     innerHTML, então o filho some junto e a assinatura muda. Sem isso o app
     redesenhava a semana por cima e eu não percebia. */
  function calcular() {
    const mes = document.getElementById('planMonthGrid');
    const sem = document.getElementById('planWeekGrid');
    const cam = document.getElementById('campaignCalendar');
    if (!mes && !sem && !cam) return null;
    return [
      filtro(),
      cam?.querySelector('.cal-sem') ? '1' : '0',
      document.getElementById('brandSelect')?.value,
      document.getElementById('campaignStatusFilter')?.value,
      document.getElementById('campaignSearch')?.value,
      naGrade(),
      ler(chaveCamp()).length,
      mes?.children.length, sem?.children.length,
      mes?.querySelector('.cal-sem') ? '1' : '0',
      sem?.querySelector('.cal-sem') ? '1' : '0',
    ].join('|');
  }

  function redesenhar(forcar) {
    const antes = calcular();
    if (antes === null) return;
    if (!forcar && antes === assinatura) return;
    desenharMes();
    desenharSemana();
    desenharCampanhas();
    /* recalculada depois de desenhar, e não remendada: com a marca já posta
       o próximo laço vê o mesmo valor e para aqui. Remendando a string, um
       lado marcado e o outro não deixava a assinatura mentindo — e o
       observador redesenhava para sempre. */
    assinatura = calcular();
  }

  function comecar() {
    new MutationObserver(() => redesenhar(false))
      .observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener('change', (e) => {
      if (['brandSelect', 'campaignStatusFilter'].includes(e.target?.id)) setTimeout(() => redesenhar(true), 60);
    });
    redesenhar(true);
  }
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', comecar, { once: true });
  else comecar();
})();
