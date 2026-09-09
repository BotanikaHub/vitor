/* ======================================================================
   A página inicial.

   Ela vinha com número escrito à mão — "6 perto do vencimento", "3
   vencidas", "68% no mês" — e uma lista de tarefas que não existem, com
   nomes de gente que existe. Isso é pior do que não mostrar nada: quem
   abre acredita.

   Agora os três cartões, a lista de atenção e as campanhas do mês saem
   das mesmas tarefas e campanhas que as outras telas usam — as que vêm
   do ClickUp e do planejador. Quando não há dado, a tela diz que não há,
   em vez de inventar.
   ====================================================================== */
(function () {
  'use strict';

  const uid = () => (window.user && window.user.id) || 'vitor-gutierrez';
  const ler = (k) => { try { const v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : [] } catch { return [] } };
  const tarefas   = () => ler(`central.tasks.${uid()}`);
  const campanhas = () => ler(`central.campaigns.${uid()}`);
  const esc = (t) => String(t ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

  const hoje = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d };
  const dISO = (s) => { const [a, m, d] = String(s || '').split('-').map(Number); return new Date(a, (m || 1) - 1, d || 1) };
  const dias = (s) => Math.round((dISO(s) - hoje()) / 86400000);
  const dBR = (s) => { const d = dISO(s); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}` };
  const primeiro = (a) => String(a || '').split('|')[0].trim();

  const aberta = (t) => t.status !== 'feito';

  /* ---------- os três cartões ----------
     "Perto do vencimento" é o que vence hoje ou amanhã e ainda está
     aberto; 48h contadas em dias, que é como a operação fala. */
  function contas() {
    const ts = tarefas();
    const abertas = ts.filter(aberta);
    const vencidas = abertas.filter((t) => t.due && dias(t.due) < 0);
    const perto    = abertas.filter((t) => t.due && dias(t.due) >= 0 && dias(t.due) <= 1);

    const h = hoje();
    const doMes = ts.filter((t) => {
      if (!t.due) return false;
      const d = dISO(t.due);
      return d.getMonth() === h.getMonth() && d.getFullYear() === h.getFullYear();
    });
    const feitasNoMes = doMes.filter((t) => t.status === 'feito');
    const pct = doMes.length ? Math.round((feitasNoMes.length / doMes.length) * 100) : 0;

    return { vencidas, perto, doMes, feitasNoMes, pct, total: ts.length };
  }

  function cartoes(c) {
    const põe = (qual, valor, nota, largura) => {
      const el = document.querySelector(`[data-stat="${qual}"]`);
      if (!el) return;
      const v = el.querySelector('.value'), n = el.querySelector('.note'), b = el.querySelector('.progress i');
      if (v && v.textContent !== String(valor)) v.textContent = valor;
      if (n && n.textContent !== nota) n.textContent = nota;
      if (b) b.style.width = `${largura || 0}%`;
    };
    põe('perto', c.perto.length, c.total ? 'vencem hoje ou amanhã' : 'sem tarefas carregadas');
    põe('vencidas', c.vencidas.length, c.vencidas.length ? 'precisam de ação hoje' : 'nada atrasado');
    põe('conclusao', c.doMes.length ? `${c.pct}%` : '—',
      c.doMes.length ? `${c.feitasNoMes.length} de ${c.doMes.length} tarefas do mês concluídas`
                     : 'nenhuma tarefa com prazo neste mês', c.pct);
  }

  /* ---------- tarefas que pedem atenção ----------
     Vencidas primeiro, depois as que vencem hoje e amanhã. Nada de
     "hoje · 18h": o ClickUp manda o dia, e a hora eu não tenho. */
  function atencao(c) {
    const alvo = document.getElementById('homeAtencao');
    if (!alvo) return;

    const lista = [...c.vencidas, ...c.perto]
      .sort((a, b) => String(a.due).localeCompare(String(b.due)))
      .slice(0, 6);

    const html = lista.length ? lista.map((t) => {
      const d = dias(t.due);
      const quando = d < 0 ? (d === -1 ? 'vencida ontem' : `vencida há ${-d} dias`)
                   : d === 0 ? 'vence hoje' : 'vence amanhã';
      const quem = (t.assignees || []).map(primeiro).join(', ') || 'sem responsável';
      return `<div class="task" data-ini-tarefa="${esc(t.id)}">
        <span class="urgency ${d < 0 ? 'red' : 'orange'}"></span>
        <div>
          <div class="task-title">${esc(t.title)}</div>
          <div class="task-meta">${esc(quem)} · ${esc(t.brand || '')} · ${esc(t.project || 'Sem projeto')}</div>
        </div>
        <span class="due ${d < 0 ? '' : 'soon'}">${quando} · ${dBR(t.due)}</span>
      </div>`;
    }).join('') : `<div class="ini-vazio">${c.total
      ? 'Nada vencido nem vencendo nas próximas 48h.'
      : 'Nenhuma tarefa carregada ainda — o espelho do ClickUp preenche esta lista.'}</div>`;

    if (alvo.dataset.ini !== html) { alvo.dataset.ini = html; alvo.innerHTML = html }
  }

  /* ---------- campanhas do mês ----------
     A barra é o quanto das tarefas daquela campanha já foi concluído.
     Onde não há tarefa ligada, a barra fica onde o calendário está: é o
     quanto do período já passou, e o rodapé diz que é isso. */
  const limpa = (t) => String(t || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();

  function tarefasDa(c, ts) {
    const n = limpa(c.name);
    return ts.filter((t) => {
      if (c.brand && t.brand && t.brand !== c.brand) return false;
      const p = limpa(t.project);
      if (!p || p === 'sem projeto') return false;
      return n === p || n.startsWith(p + ' ') || p.startsWith(n + ' ') ||
             (n.startsWith(p) && p.length >= 5);
    });
  }

  function campanhasDoMes() {
    const h = hoje();
    const dentro = (c) => {
      if (!c.start || !c.end) return false;
      const i = dISO(c.start), f = dISO(c.end);
      return (i.getFullYear() * 12 + i.getMonth()) <= (h.getFullYear() * 12 + h.getMonth()) &&
             (f.getFullYear() * 12 + f.getMonth()) >= (h.getFullYear() * 12 + h.getMonth());
    };
    const ordem = { 'Em execução': 0, 'Em preparação': 1, 'Planejamento': 2, 'Concluída': 3 };
    return campanhas().filter(dentro)
      .sort((a, b) => (ordem[a.status] ?? 9) - (ordem[b.status] ?? 9) ||
                       String(a.start).localeCompare(String(b.start)));
  }

  function campanhasNaHome() {
    const alvo = document.getElementById('homeCampanhas');
    if (!alvo) return;
    const ts = tarefas();
    const lista = campanhasDoMes().slice(0, 6);

    const html = lista.length ? lista.map((c) => {
      const suas = tarefasDa(c, ts);
      const feitas = suas.filter((t) => t.status === 'feito').length;
      let pct, pe;
      if (suas.length) {
        pct = Math.round((feitas / suas.length) * 100);
        pe = `${feitas} de ${suas.length} tarefas`;
      } else {
        const i = dISO(c.start), f = dISO(c.end), agora = hoje();
        const total = Math.max(1, (f - i) / 86400000 + 1);
        pct = Math.min(100, Math.max(0, Math.round(((agora - i) / 86400000 + 1) / total * 100)));
        pe = `${dBR(c.start)} a ${dBR(c.end)}`;
      }
      return `<div class="campaign" data-ini-campanha="${esc(c.name)}" title="${esc(c.brand)} · ${esc(c.status)}">
        <div class="campaign-top"><b>${esc(c.name)}</b><span>${esc(c.brand || '')}</span></div>
        <div class="campaign-bar"><i style="width:${pct}%"></i></div>
        <div class="campaign-foot"><span>${esc(pe)}</span><span>${pct}%</span></div>
      </div>`;
    }).join('') : `<div class="ini-vazio">Nenhuma campanha com data dentro deste mês.</div>`;

    if (alvo.dataset.ini !== html) { alvo.dataset.ini = html; alvo.innerHTML = html }
  }

  /* ---------- abrir ----------
     A ficha da tarefa e a tela da campanha são do app; daqui eu só bato
     na porta delas, do mesmo jeito que uma pessoa bateria. */
  document.addEventListener('click', (e) => {
    const t = e.target.closest?.('[data-ini-tarefa]');
    if (t) {
      const id = t.dataset.iniTarefa;
      document.getElementById('tasksNav')?.click();
      setTimeout(() => {
        const linha = document.querySelector(`.cu-row[data-task-id="${CSS.escape(id)}"]`) ||
                      document.querySelector(`[data-task-id="${CSS.escape(id)}"]`);
        linha?.click();
      }, 120);
      return;
    }
    const c = e.target.closest?.('[data-ini-campanha]');
    if (c) window.openCampaignWorkspaceByName?.(c.dataset.iniCampanha);
  });

  /* ---------- o sino ----------
     O botão dizia "Você tem 3 notificações novas" — três fixo, sempre,
     sem nada por trás. Não existe caixa de notificação neste sistema, e
     inventar uma seria repetir o erro. Então o sino passa a contar o que
     de fato pede resposta hoje: o que venceu e o que vence hoje. Clicar
     leva à lista onde essas tarefas estão. */
  function sino(c) {
    const bt = document.getElementById('notificationsBtn');
    if (!bt) return;
    const n = c.vencidas.length + c.perto.filter((t) => dias(t.due) === 0).length;
    let selo = bt.querySelector('.badge');
    if (!n) { selo?.remove(); bt.title = 'Nada vencido nem vencendo hoje'; return }
    if (!selo) { selo = document.createElement('span'); selo.className = 'badge'; bt.appendChild(selo) }
    if (selo.textContent !== String(n)) selo.textContent = n;
    bt.title = `${n} tarefa${n > 1 ? 's' : ''} vencida${n > 1 ? 's' : ''} ou vencendo hoje`;
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest?.('#notificationsBtn')) return;
    e.stopImmediatePropagation();
    const c = contas();
    const n = c.vencidas.length + c.perto.filter((t) => dias(t.due) === 0).length;
    document.getElementById('homeNav')?.click();
    setTimeout(() => {
      const card = document.getElementById('homeAtencao')?.closest('.card');
      card?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      card?.classList.add('ini-pisca');
      setTimeout(() => card?.classList.remove('ini-pisca'), 1400);
    }, 120);
    window.showToast?.(n
      ? `${n} tarefa${n > 1 ? 's' : ''} vencida${n > 1 ? 's' : ''} ou vencendo hoje.`
      : 'Nada vencido nem vencendo hoje.');
  }, true);

  /* ---------- redesenhar ---------- */
  let pedido = 0;
  function desenhar() {
    cancelAnimationFrame(pedido);
    pedido = requestAnimationFrame(() => {
      if (!document.querySelector('[data-stat]')) return;
      const c = contas();
      cartoes(c); atencao(c); campanhasNaHome(); sino(c);
    });
  }

  const olho = new MutationObserver(desenhar);
  function ligar() {
    olho.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('storage', desenhar);
    desenhar();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ligar);
  else ligar();

  window.InicioReal = { contas, campanhasDoMes, desenhar };
})();
