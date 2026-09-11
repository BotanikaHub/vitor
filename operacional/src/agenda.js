/* ======================================================================
   A agenda.

   Cada pessoa liga o próprio calendário e vê o dia dela aqui dentro: os
   compromissos, as tarefas que vencem, e a rotina que cai hoje. As três
   coisas que decidem a manhã de alguém estavam em três lugares.

   E dentro de cada reunião, um espaço de anotação. A daily e a reunião
   de KPI acontecem toda semana e o que se combina nelas se perde — fica
   no caderno de um, na cabeça de outro. Aqui fica na reunião.

   A anotação é da equipe, não de quem escreveu: o valor está em o Pedro
   abrir a daily de terça e ler o que ficou combinado. A tela diz isso em
   cima da caixa, porque quem escreve tem que saber quem lê.

   O endereço do calendário não mora aqui. Ele é mandado uma vez para
   /api/agenda e nunca volta — do servidor para cá vêm só compromissos.
   ====================================================================== */
(function () {
  'use strict';

  const uid = () => (window.user && window.user.id) || 'vitor-gutierrez';
  const CHAVE_NOTAS = 'central.agenda.notas';
  const esc = (t) => String(t ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const lerObj = (k) => { try { const v = JSON.parse(localStorage.getItem(k) || '{}'); return v && typeof v === 'object' ? v : {} } catch { return {} } };
  const lerLista = (k) => { try { const v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : [] } catch { return [] } };

  const FUSO = 'America/Sao_Paulo';
  const hojeSP = () => new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const diaDe = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
  const horaDe = (iso) => new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
  const dISO = (s) => { const [a, m, d] = String(s || '').split('-').map(Number); return new Date(Date.UTC(a, (m || 1) - 1, d || 1)) };
  const iso = (d) => d.toISOString().slice(0, 10);
  const mais = (s, n) => { const d = dISO(s); d.setUTCDate(d.getUTCDate() + n); return iso(d) };
  const NOMES = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const rotuloDia = (d) => {
    const h = hojeSP();
    if (d === h) return 'hoje';
    if (d === mais(h, 1)) return 'amanhã';
    if (d === mais(h, -1)) return 'ontem';
    return `${NOMES[dISO(d).getUTCDay()]}, ${+d.slice(8, 10)} de ${MES[+d.slice(5, 7) - 1]}`;
  };

  /* ---------- falar com o servidor ---------- */
  let cache = null;

  async function token() {
    try { const s = await window.CentralSessao?.(); return s && s.access_token } catch { return null }
  }

  async function pedir(caminho, opcoes) {
    const t = await token();
    if (!t) throw new Error('sem sessão');
    const r = await fetch(`/api/agenda${caminho || ''}`, {
      ...opcoes,
      headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', ...(opcoes || {}).headers },
    });
    const corpo = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(corpo.erro || `HTTP ${r.status}`);
    return corpo;
  }

  const buscar = (forcar) => pedir(forcar ? '?forcar=1' : '').then((r) => (cache = r));
  const ligar = (url) => pedir('', { method: 'POST', body: JSON.stringify({ url }) }).then((r) => (cache = r));
  const desligar = () => pedir('', { method: 'POST', body: JSON.stringify({ acao: 'desligar' }) }).then((r) => (cache = r));

  /* ---------- as anotações ----------
     Numa chave "central.", sem dono: a ponte leva e traz, e o que se
     combinou na daily está lá para quem não pôde ir. */
  const notas = () => lerObj(CHAVE_NOTAS);
  function anotar(uidEvento, texto) {
    const n = notas();
    const t = String(texto || '').trim();
    if (!t) delete n[uidEvento];
    else n[uidEvento] = { texto: t, por: (window.CentralEu && window.CentralEu.nome) || 'alguém', em: new Date().toISOString() };
    try { localStorage.setItem(CHAVE_NOTAS, JSON.stringify(n)) } catch {}
    return n;
  }

  /* ---------- juntar o dia ----------
     Compromisso, tarefa que vence e rotina que cai. É o que uma pessoa
     precisa saber de manhã, e estava em três telas. */
  function meusNomes() {
    const eu = window.CentralEu;
    const nomes = [];
    if (eu && eu.nome) nomes.push(eu.nome);
    try {
      const p = (window.Acessos.equipe() || []).find((x) => eu && x.email === eu.email);
      if (p && p.nomeClickup) nomes.push(p.nomeClickup);
    } catch {}
    return nomes;
  }

  function dias(de, ate, eventos) {
    const nomes = meusNomes();
    const tarefas = lerLista(`central.tasks.${uid()}`)
      .filter((t) => t.status !== 'feito' && t.due && (!nomes.length || (t.assignees || []).some((a) => nomes.includes(a))));
    const R = window.Rotina;
    const A = window.AreaTela;
    const eu = window.CentralEu;
    const area = eu && eu.area_id && A ? (A.areasDoBanco() || []).find((a) => a.id === eu.area_id) : null;

    /* ordenado aqui também, e não só no servidor: a tela não pode
       depender de quem a alimenta ter ordenado */
    const todos = (eventos || []).slice().sort((a, b) => String(a.comeca).localeCompare(String(b.comeca)));

    const fora = [];
    for (let d = de; d <= ate; d = mais(d, 1)) {
      const doDia = todos.filter((e) => diaDe(e.comeca) === d);
      const tarefasDoDia = tarefas.filter((t) => t.due === d);
      const rot = R && d === hojeSP()
        ? R.daArea(area ? area.slug : null, d).flatMap((g) => g.itens.filter((i) => i.hoje).map((i) => ({ ...i, curto: g.cadencia.curto })))
        : [];
      if (doDia.length || tarefasDoDia.length || rot.length) fora.push({ dia: d, eventos: doDia, tarefas: tarefasDoDia, rotina: rot });
    }
    return fora;
  }

  /* ====================================================================
     A tela
     ==================================================================== */
  const FAIXAS = [
    { id: 'hoje', nome: 'Hoje', de: 0, ate: 0 },
    { id: 'semana', nome: '7 dias', de: 0, ate: 6 },
    { id: 'mes', nome: '30 dias', de: 0, ate: 29 },
    { id: 'antes', nome: 'O que passou', de: -7, ate: -1 },
  ];

  function comoLigar() {
    return `<div class="ag-ligar">
      <b>Ligue o seu calendário.</b>
      <p>Cada um liga o seu, e só você vê o seu. O endereço vai direto para o servidor e nunca volta para o navegador.</p>
      <ol>
        <li>No <b>Google Agenda</b>, abra as configurações do calendário que você usa para trabalhar.</li>
        <li>Role até <b>“Endereço secreto no formato iCal”</b> e copie o endereço.</li>
        <li>Cole aqui embaixo.</li>
      </ol>
      <p class="ag-obs">O <b>Notion Calendar</b> roda em cima de uma conta Google — o endereço é o mesmo. No <b>Outlook</b>, a opção se chama “Publicar calendário”.</p>
      <form data-ag-form>
        <input type="url" data-ag-url placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" required>
        <button type="submit" class="ag-bt">Ligar</button>
      </form>
      <p class="ag-obs">Esse endereço é uma chave: quem o tiver lê a sua agenda até você gerar outro. Por isso ele fica guardado no servidor, e não aqui. Se um dia vazar, é só pedir um novo no Google — o antigo morre na hora.</p>
      <div class="ag-msg" role="status" aria-live="polite"></div>
    </div>`;
  }

  function cartaoEvento(e, aberto, n) {
    const nota = n[e.uid];
    return `<article class="ag-ev ${aberto ? 'aberto' : ''}" data-ag-ev="${esc(e.uid)}">
      <div class="ag-ev-topo">
        <span class="ag-hora">${e.diaInteiro ? 'dia inteiro' : `${horaDe(e.comeca)}–${horaDe(e.termina)}`}</span>
        <b>${esc(e.titulo)}</b>
        ${e.gente > 1 ? `<span class="ag-gente">${e.gente} pessoas</span>` : ''}
        ${nota ? '<span class="ag-tem-nota" title="tem anotação">anotada</span>' : ''}
      </div>
      ${e.onde ? `<div class="ag-onde">${esc(e.onde)}</div>` : ''}
      ${aberto ? `<div class="ag-ficha">
        ${e.sobre ? `<pre class="ag-sobre">${esc(e.sobre)}</pre>` : ''}
        <label class="ag-rot">Anotações da reunião <span>a equipe inteira lê</span></label>
        <textarea class="ag-nota" data-ag-nota="${esc(e.uid)}" rows="5"
          placeholder="O que ficou combinado, quem ficou de fazer o quê, o que travou.">${esc(nota ? nota.texto : '')}</textarea>
        ${nota ? `<div class="ag-assina">última mudança de ${esc(nota.por)} · ${esc(new Date(nota.em).toLocaleString('pt-BR', { timeZone: FUSO, dateStyle: 'short', timeStyle: 'short' }))}</div>` : ''}
      </div>` : ''}
    </article>`;
  }

  function render(ctx, dados) {
    const st = (window.Painel || {}).estado || {};
    const faixa = FAIXAS.find((f) => f.id === st.agFaixa) || FAIXAS[1];
    const abas = '<div class="ag-abas">' + FAIXAS.map((f) =>
      `<button type="button" class="cu-view ${f.id === faixa.id ? 'active' : ''}" data-ag-faixa="${f.id}">${esc(f.nome)}</button>`).join('') +
      (dados.ligado ? `<span class="ag-fonte">${esc(dados.casa || 'calendário')}${dados.lido_em ? ` · lido ${horaDe(dados.lido_em)}` : ''}</span>
         <button type="button" class="ag-bt-vazio" data-ag-atualiza>atualizar</button>
         <button type="button" class="ag-bt-vazio" data-ag-desliga>desligar</button>` : '') +
      '</div>';

    if (!dados.ligado) return abas + ctx.ui.cartao('Agenda', 'o seu calendário, dentro da Central', comoLigar());

    const h = hojeSP();
    const lista = dias(mais(h, faixa.de), mais(h, faixa.ate), dados.eventos);
    const n = notas();
    const aberto = st.agAberto;

    const corpo = dados.erro
      ? `<p class="ag-erro">Não consegui reler o calendário agora (${esc(dados.erro)}). O que está na tela é a última leitura que deu certo.</p>` : '';

    if (!lista.length) {
      return abas + ctx.ui.cartao('Agenda', faixa.nome.toLowerCase(),
        corpo + `<div class="pn-vazio">Nada marcado ${faixa.id === 'hoje' ? 'para hoje' : `nestes ${faixa.ate - faixa.de + 1} dias`}.</div>`);
    }

    return abas + ctx.ui.cartao('Agenda', faixa.nome.toLowerCase(), corpo + lista.map((d) => `
      <section class="ag-dia ${d.dia === h ? 'ag-hoje' : ''}">
        <h4>${esc(rotuloDia(d.dia))}<span>${d.dia.slice(8, 10)}/${d.dia.slice(5, 7)}</span></h4>
        ${d.eventos.map((e) => cartaoEvento(e, e.uid === aberto, n)).join('')}
        ${d.tarefas.length ? `<div class="ag-lado"><h5>vence hoje</h5>${d.tarefas.map((t) =>
          `<div class="ag-tarefa" data-ag-tarefa="${esc(t.id)}"><b>${esc(t.title)}</b><span>${esc(t.project || '')}</span></div>`).join('')}</div>` : ''}
        ${d.rotina.length ? `<div class="ag-lado"><h5>rotina</h5>${d.rotina.map((i) =>
          `<label class="ag-rotina ${i.feito ? 'ok' : ''}"><input type="checkbox" data-ag-rotina="${esc(i.id)}" ${i.feito ? 'checked' : ''}><span>${esc(i.titulo)}</span><small>${esc(i.curto)}</small></label>`).join('')}</div>` : ''}
      </section>`).join(''));
  }

  /* ---------- ligar no painel ---------- */
  function montar() {
    const P = window.Painel;
    if (!P || !P.registrar) return setTimeout(montar, 150);

    P.registrar({
      id: 'agenda', nome: 'Agenda', semPeriodo: true,
      render: async (ctx) => {
        let dados = cache;
        if (!dados || ctx.forcar) {
          dados = await buscar(!!ctx.forcar).catch((e) => ({ ligado: false, eventos: [], erro: e.message }));
        }
        return render(ctx, dados || { ligado: false, eventos: [] });
      },
    });

    const view = document.getElementById('painelView');
    if (!view) return setTimeout(montar, 150);
    const st = P.estado;
    const redesenhar = () => P.carregar(false);
    const diz = (t, tipo) => {
      const m = view.querySelector('.ag-msg');
      if (m) { m.textContent = t; m.className = 'ag-msg ' + (tipo || '') }
    };

    view.addEventListener('click', async (e) => {
      const f = e.target.closest('[data-ag-faixa]');
      if (f) { st.agFaixa = f.dataset.agFaixa; return redesenhar() }

      const ev = e.target.closest('[data-ag-ev]');
      if (ev && !e.target.closest('.ag-ficha')) {
        st.agAberto = st.agAberto === ev.dataset.agEv ? null : ev.dataset.agEv;
        return redesenhar();
      }

      if (e.target.closest('[data-ag-atualiza]')) {
        try { await buscar(true); window.showToast?.('Agenda relida') }
        catch (err) { window.showToast?.(`Não consegui: ${err.message}`) }
        return redesenhar();
      }

      if (e.target.closest('[data-ag-desliga]')) {
        try { await desligar(); cache = { ligado: false, eventos: [] } }
        catch (err) { window.showToast?.(`Não consegui: ${err.message}`) }
        return redesenhar();
      }

      const t = e.target.closest('[data-ag-tarefa]');
      if (t) {
        window.__centralShowTasks?.();
        setTimeout(() => document.querySelector(`[data-task-id="${CSS.escape(t.dataset.agTarefa)}"]`)?.click(), 90);
      }
    });

    view.addEventListener('submit', async (e) => {
      const f = e.target.closest('[data-ag-form]');
      if (!f) return;
      e.preventDefault();
      const campo = f.querySelector('[data-ag-url]');
      const bt = f.querySelector('button');
      if (bt) bt.disabled = true;
      diz('Lendo o calendário…', 'indo');
      try {
        await ligar(campo.value);
        redesenhar();
      } catch (err) {
        if (bt) bt.disabled = false;
        diz(err.message, 'erro');
      }
    });

    /* a anotação grava ao sair do campo, como tudo que se edita no lugar */
    view.addEventListener('focusout', (e) => {
      const cx = e.target.closest?.('[data-ag-nota]');
      if (cx) anotar(cx.dataset.agNota, cx.value);
    }, true);

    view.addEventListener('change', (e) => {
      const cx = e.target.closest?.('[data-ag-rotina]');
      if (!cx) return;
      const R = window.Rotina;
      const item = (R.rotina() || []).find((x) => x.id === cx.dataset.agRotina);
      if (!item) return;
      R.marcar(item, cx.checked);
      cx.closest('.ag-rotina')?.classList.toggle('ok', cx.checked);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();

  window.Agenda = { buscar, ligar, desligar, notas, anotar, dias, rotuloDia, FAIXAS, CHAVE_NOTAS };
})();
