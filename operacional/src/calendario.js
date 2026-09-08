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

  const chip = (c) =>
    `<button class="cal-chip" type="button" data-abrir="${esc(c.name)}" style="--pc:${c.color || '#121415'}">` +
    `${esc(c.name)}</button>`;

  /* ---------- a faixa das contínuas ---------- */
  function faixa(onde, lista) {
    const antiga = onde.parentElement?.querySelector('.cal-faixa');
    if (antiga) antiga.remove();
    if (!lista.length) return;
    const f = document.createElement('div');
    f.className = 'cal-faixa';
    const n = lista.length;
    f.innerHTML =
      `<div class="cal-faixa-cab">` +
        `<span class="cal-faixa-tit">No mês inteiro</span>` +
        `<span class="cal-faixa-sub">${n} contínua${n > 1 ? 's' : ''} — ` +
          (naGrade() ? 'aparecendo também dentro da grade' : 'rodam todo dia, por isso saíram da grade') +
        `</span>` +
        `<button type="button" class="cal-alternar">${naGrade() ? 'tirar da grade' : 'mostrar na grade'}</button>` +
      `</div>` +
      `<div class="cal-faixa-chips">${lista.map(chip).join('')}</div>`;
    f.querySelector('.cal-alternar').onclick = () => {
      localStorage.setItem(CHAVE_MODO, naGrade() ? '0' : '1');
      redesenhar(true);
    };
    onde.parentElement.insertBefore(f, onde);
  }

  const abrir = (raiz) => raiz.querySelectorAll('[data-abrir]').forEach((b) => {
    b.onclick = () => window.openCampaignWorkspaceByName?.(b.dataset.abrir);
  });

  /* ---------- mês ---------- */
  const MAX_MES = 3;
  function desenharMes() {
    const grade = document.getElementById('planMonthGrid');
    if (!grade) return;
    const cs = campanhas(), ts = tarefas();
    const cont = cs.filter(ehContinua), pont = naGrade() ? cs : cs.filter((c) => !ehContinua(c));

    grade.querySelectorAll('.month-day').forEach((cel) => {
      const num = +(cel.querySelector('.month-num')?.textContent || 0);
      const itens = cel.querySelector('.month-items');
      if (!itens || !num || cel.classList.contains('muted')) return;
      const dia = `2026-09-${String(num).padStart(2, '0')}`;
      const ativas = pont.filter((c) => c.start <= dia && c.end >= dia).sort(pontualPrimeiro);
      const vencem = ts.filter((t) => t.due === dia);
      const mostra = [...ativas.slice(0, MAX_MES).map(chip),
        ...vencem.slice(0, Math.max(0, 4 - Math.min(ativas.length, MAX_MES)))
          .map((t) => `<div class="month-task">✓ ${esc(t.title)}</div>`)];
      const sobra = ativas.length + vencem.length - mostra.length;
      itens.innerHTML = mostra.join('') +
        (sobra > 0 ? `<div class="month-more">+${sobra} ${sobra > 1 ? 'itens' : 'item'}</div>` : '');
      abrir(itens);
    });
    /* A faixa fica mesmo com as contínuas na grade: é dela que sai o botão
       de voltar atrás. Some só quando não há contínua nenhuma. */
    faixa(grade, cont);
  }

  /* ---------- semana ---------- */
  function desenharSemana() {
    const grade = document.getElementById('planWeekGrid');
    if (!grade) return;
    const cs = campanhas();
    const cont = cs.filter(ehContinua), pont = naGrade() ? cs : cs.filter((c) => !ehContinua(c));
    const dias = ['2026-09-07','2026-09-08','2026-09-09','2026-09-10','2026-09-11','2026-09-12','2026-09-13'];

    grade.querySelectorAll('.plan-day').forEach((sec, i) => {
      const dia = dias[i]; if (!dia) return;
      /* a primeira seção do dia é a de campanhas; a de tarefas fica como o
         app fez, porque tarefa tem data e não enche nada */
      const bloco = sec.querySelector('.day-section');
      if (!bloco) return;
      const tit = bloco.querySelector('.day-section-title');
      const ativas = pont.filter((c) => c.start <= dia && c.end >= dia).sort(pontualPrimeiro);
      bloco.innerHTML = (tit ? tit.outerHTML : '<div class="day-section-title">Campanhas</div>') +
        (ativas.length
          ? ativas.map((c) =>
              `<article class="week-campaign-card" data-abrir="${esc(c.name)}" style="--pc:${c.color || '#121415'}">` +
              `<b>${esc(c.name)}</b><span>${esc(c.status)} · ${esc((c.owner || '').split(' ')[0])}</span></article>`).join('')
          : '<div class="week-empty">Nada com data neste dia</div>');
      abrir(bloco);
    });
    faixa(grade, cont);
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
    if (!mes && !sem) return null;
    return [
      document.getElementById('brandSelect')?.value,
      document.getElementById('campaignStatusFilter')?.value,
      document.getElementById('campaignSearch')?.value,
      naGrade(),
      ler(chaveCamp()).length,
      mes?.children.length, sem?.children.length,
      mes?.querySelector('.month-items')?.dataset.cal || '0',
      sem?.querySelector('.plan-day')?.dataset.cal || '0',
    ].join('|');
  }

  function redesenhar(forcar) {
    const antes = calcular();
    if (antes === null) return;
    if (!forcar && antes === assinatura) return;
    desenharMes();
    desenharSemana();
    document.querySelector('#planMonthGrid .month-items')?.setAttribute('data-cal', '1');
    document.querySelector('#planWeekGrid .plan-day')?.setAttribute('data-cal', '1');
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
