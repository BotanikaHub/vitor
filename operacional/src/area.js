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
      id: 'area', nome: 'Área', semPeriodo: true,
      render: async (ctx) => {
        const mapa = (() => {
          const eu = window.CentralEu;
          const todas = areasDoBanco();
          const a = todas.find((x) => x.id === st.areaId) ||
                    (eu && eu.area_id ? todas.find((x) => x.id === eu.area_id) : null) || todas[0];
          return a ? doMapa(a.slug) : { setores: [] };
        })();
        let dados = null;
        if (mapa.setores.length) {
          const h = hojeSP();
          try { dados = await ctx.pedir('setores', { ano: +h.slice(0, 4), mes: +h.slice(5, 7), de: h, ate: h }) }
          catch (e) { dados = { erro: `Não consegui os números da ${ctx.marca}: ${(e && e.message) || e}` } }
        }
        return render({ ...ctx, dados });
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
