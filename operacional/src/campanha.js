/* ======================================================================
   As abas de dentro da campanha.

   O Resumo dizia três linhas e os números vazios; a Oferta repetia uma
   frase; o Cronograma mostrava pouco; e as Tarefas ficavam em 0/0 mesmo
   com a campanha tendo tarefa no ClickUp. Tudo que falta já está no TAP —
   é só ler dali em vez de deixar a pessoa abrir a tabela e procurar.

   O TAP continua sendo a fonte: estas abas não guardam nada próprio, só
   leem. Assim nada desencontra quando alguém edita uma célula.
   ====================================================================== */
(function () {
  'use strict';

  const chaveCamp = () => `central.campaigns.${(window.user && window.user.id) || 'vitor-gutierrez'}`;
  const chaveTar  = () => `central.tasks.${(window.user && window.user.id) || 'vitor-gutierrez'}`;
  const ler = (k) => { try { const v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : [] } catch { return [] } };
  const esc = (t) => String(t ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const brl = (n) => 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
  const dISO = (s) => { const [a, m, d] = String(s || '').split('-').map(Number); return new Date(a, (m || 1) - 1, d || 1) };
  const dBR = (s) => { const d = dISO(s); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}` };
  const num = (t) => { const n = String(t || '').replace(/[^\d,-]/g, '').replace(',', '.'); return parseFloat(n) || 0 };

  const sec = (c, re) => (c.tap || []).find((s) => re.test(s.title || ''));
  const linha = (s, re) => (s?.rows || []).find((l) => re.test(String(l[0] || '')));

  /* ---------- leituras do TAP ---------- */
  function canais(c) {
    const s = sec(c, /CANAIS/i);
    if (!s) return null;
    const cols = s.columns || [];
    /* primeira é o canal, segunda a base, última quem faz; o miolo são os
       dias — é dali que sai tudo que esta tela conta */
    const dias = cols.slice(2, -1).map((rot, i) => ({ rot, i: i + 2 }));
    return { s, cols, dias };
  }
  const temPeca = (v) => { const t = String(v || '').trim(); return t && t !== '—' && t !== '-' && t !== '0' };

  function pecasPorDia(c) {
    const k = canais(c); if (!k) return [];
    return k.dias.map(({ rot, i }) => ({
      dia: rot,
      itens: k.s.rows.filter((l) => temPeca(l[i]))
        .map((l) => ({ canal: l[0], o: String(l[i]).trim(), quem: l[l.length - 1] })),
    })).filter((d) => d.itens.length);
  }

  function metasPorCanal(c) {
    const s = sec(c, /^METAS/i);
    if (!s) return [];
    return (s.rows || [])
      .filter((l) => /^Meta faturamento — /.test(String(l[0])))
      .map((l) => ({ nome: String(l[0]).replace('Meta faturamento — ', ''), valor: num(l[1]), quem: l[2] || '' }))
      .filter((x) => x.valor > 0);
  }
  function investPorCanal(c) {
    const s = sec(c, /^METAS/i);
    if (!s) return [];
    return (s.rows || [])
      .filter((l) => /^Investimento — /.test(String(l[0])))
      .map((l) => ({ nome: String(l[0]).replace('Investimento — ', ''), valor: num(l[1]) }))
      .filter((x) => x.valor > 0);
  }

  /* ---------- tarefas da campanha ----------
     A ligação é o campo "Projeto" do ClickUp. Nome de campanha e nome de
     projeto raramente batem letra a letra ("Dia D — 09/09" e "Dia D"), então
     comparo por prefixo dos dois lados, sem acento e sem pontuação. */
  const limpa = (t) => String(t || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();

  function tarefasDa(c) {
    const nome = limpa(c.name);
    return ler(chaveTar()).filter((t) => {
      if (c.brand && t.brand && t.brand !== c.brand) return false;
      const p = limpa(t.project);
      if (!p || p === 'sem projeto') return false;
      return nome === p || nome.startsWith(p + ' ') || p.startsWith(nome + ' ') ||
             nome.startsWith(p) && p.length >= 5;
    });
  }

  /* ---------- pedaços de tela ---------- */
  const cartao = (rot, val, pe) =>
    `<div class="cp-num"><span class="cp-rot">${esc(rot)}</span>` +
    `<b>${val}</b>${pe ? `<small>${esc(pe)}</small>` : ''}</div>`;

  const bloco = (tit, sub, corpo) =>
    `<section class="cp-bloco"><div class="cp-cab"><h3>${esc(tit)}</h3>` +
    (sub ? `<span>${esc(sub)}</span>` : '') + `</div>${corpo}</section>`;

  function tabela(cols, linhas) {
    if (!linhas.length) return '<p class="cp-vazio">Nada preenchido aqui ainda.</p>';
    return `<div class="cp-tab-cx"><table class="cp-tab"><thead><tr>` +
      cols.map((x) => `<th>${esc(x)}</th>`).join('') + `</tr></thead><tbody>` +
      linhas.map((l) => `<tr>` + l.map((v) => `<td>${v}</td>`).join('') + `</tr>`).join('') +
      `</tbody></table></div>`;
  }

  /* ---------- resumo ---------- */
  function resumo(c) {
    const ini = dISO(c.start), fim = dISO(c.end);
    const dias = Math.round((fim - ini) / 86400000) + 1;
    const k = canais(c), porDia = pecasPorDia(c);
    const totalPecas = porDia.reduce((t, d) => t + d.itens.length, 0);
    const metas = metasPorCanal(c), inv = investPorCanal(c);
    /* A meta da ação é a que a pessoa escreveu; a soma dos canais é outra
       coisa e pode não fechar com ela. Mostrar a soma no lugar da meta
       esconderia justamente essa diferença, que é o que precisa aparecer. */
    const somaMeta = metas.reduce((t, x) => t + x.valor, 0);
    const somaInv = inv.reduce((t, x) => t + x.valor, 0) || c.budget || 0;
    const meta = c.goal || somaMeta;
    const roas = somaInv ? (meta / somaInv).toFixed(1).replace('.', ',') : '—';
    const difere = somaMeta && Math.abs(somaMeta - meta) > 1;
    const ts = tarefasDa(c), feitas = ts.filter((t) => t.status === 'feito').length;
    const evento = sec(c, /SOBRE O EVENTO/i);
    const fases = sec(c, /^FASES/i);
    const pegar = (re) => { const l = linha(evento, re); return l ? String(l[1] || '') : '' };

    const canaisAtivos = k ? [...new Set(porDia.flatMap((d) => d.itens.map((i) => i.canal)))] : [];

    return `
      <div class="cp-numeros">
        ${cartao('Meta', brl(meta), dias === 1 ? 'em 1 dia' : `em ${dias} dias`)}
        ${cartao('Verba', brl(somaInv), somaInv ? 'tráfego e API' : 'sem investimento')}
        ${cartao('ROAS alvo', roas, somaInv ? 'meta ÷ verba' : 'não se compra faturamento aqui')}
        ${cartao('Lucro previsto', brl(meta - somaInv), 'meta menos verba')}
      </div>

      ${bloco('O que é esta ação', `${dBR(c.start)} a ${dBR(c.end)}`, `
        <p class="cp-texto">${esc(c.objective || '—')}</p>
        <div class="cp-linhas">
          ${[['Cupom', c.offer], ['Frete', pegar(/frete/i)],
             ['Bônus universal', pegar(/bônus universal/i)],
             ['Bônus via influencer', pegar(/influencer/i)],
             ['Brinde', pegar(/brinde/i)]]
            .filter(([, v]) => v && v !== '—')
            .map(([r, v]) => `<div class="cp-linha"><span>${esc(r)}</span><b>${esc(v)}</b></div>`).join('')}
        </div>`)}

      ${bloco('De onde vem o faturamento',
        metas.length ? `${metas.length} canais somam ${brl(somaMeta)}` : '',
        (difere ? `<p class="cp-aviso">Os canais somam <b>${brl(somaMeta)}</b>, e a meta da ação é
          <b>${brl(meta)}</b> — faltam <b>${brl(meta - somaMeta)}</b> distribuídos.</p>` : '') +
        tabela(
          ['Canal', 'Meta', 'Investimento', 'ROAS', 'Responsável'],
          metas.map((m) => {
            const i = inv.find((x) => x.nome === m.nome)?.valor || 0;
            return [esc(m.nome), `<b>${brl(m.valor)}</b>`, i ? brl(i) : '—',
                    i ? (m.valor / i).toFixed(1).replace('.', ',') : '—', esc(m.quem)];
          })))}

      ${fases ? bloco('Como a ação se desenrola', `${(fases.rows || []).length} fases`, tabela(
        ['Fase', 'Tem?', 'Quando'],
        (fases.rows || []).map((l) => [esc(l[0]), esc(l[1]), `<b>${esc(l[2])}</b>`]))) : ''}

      ${bloco('O que sai, e por onde', totalPecas ? `${totalPecas} peças em ${porDia.length} dias` : '', `
        <div class="cp-chips">${canaisAtivos.map((n) => `<span class="cp-chip">${esc(n)}</span>`).join('') ||
          '<span class="cp-vazio">O cronograma ainda não tem nada marcado.</span>'}</div>
        ${porDia.length ? `<div class="cp-dias">${porDia.map((d) => `
          <div class="cp-dia"><b>${esc(d.dia)}</b><span>${d.itens.length} peça${d.itens.length > 1 ? 's' : ''}</span></div>`).join('')}</div>` : ''}`)}

      ${bloco('Tarefas desta campanha', ts.length ? `${feitas} de ${ts.length} concluídas` : 'nenhuma ligada ainda', `
        ${ts.length ? `<div class="cp-barra"><i style="width:${Math.round(feitas / ts.length * 100)}%"></i></div>
        <div class="cp-chips">${[...new Set(ts.flatMap((t) => t.assignees || []))].slice(0, 8)
          .map((a) => `<span class="cp-chip">${esc(String(a).split('|')[0].trim())}</span>`).join('')}</div>`
        : `<p class="cp-vazio">Nenhuma tarefa com o projeto "${esc(c.name)}" no ClickUp.</p>`}`)}
    `;
  }

  /* ---------- oferta ---------- */
  function oferta(c) {
    const so = sec(c, /SOBRE A OFERTA/i), tk = sec(c, /TICKET/i);
    const prods = (so?.rows || []).filter((l) => !/^A definir/i.test(String(l[0])));
    const linhas = prods.map((l) => {
      /* o produto escrito à mão costuma trazer o desconto no meio do texto
         ("Combo Fitness · 15% OFF") em vez da coluna própria; se a coluna
         está vazia, vale o que está escrito */
      const desc = num(l[2]) || num(String(l[1]).match(/(\d+)\s*%/)?.[1] || '');
      const preco = num(String(l[1]).match(/R\$\s*[\d.,]+/)?.[0] || '');
      const fim = preco && desc ? preco * (1 - desc / 100) : 0;
      return [
        `<b>${esc(l[0])}</b>`,
        `<span class="cp-menor">${esc(l[1])}</span>`,
        desc ? `<b>${esc(num(l[2]) ? l[2] : desc + '% OFF')}</b>` : '—',
        fim ? `<b>R$ ${fim.toFixed(2).replace('.', ',')}</b>` : '—',
      ];
    });
    const benef = (c.benefits || []).filter(Boolean);
    return `
      ${bloco('Produtos participantes', prods.length ? `${prods.length} itens` : '',
        tabela(['Produto', 'Detalhe', 'Desconto', 'Preço final'], linhas))}
      ${bloco('O que a pessoa ganha além do desconto', '', `
        <div class="cp-linhas">${benef.length
          ? benef.map((b, i) => `<div class="cp-linha"><span>${['Frete','Brinde','Bônus universal','Bônus via influencer'][i] || 'Benefício'}</span><b>${esc(b)}</b></div>`).join('')
          : '<p class="cp-vazio">Sem benefícios cadastrados.</p>'}</div>`)}
      ${tk ? bloco('Como subir o ticket médio', '', tabela(
        ['Estratégia', 'Detalhe', 'Desconto'],
        (tk.rows || []).map((l) => [`<b>${esc(l[0])}</b>`, esc(l[1]), esc(l[2])]))) : ''}
    `;
  }

  /* ---------- cronograma ---------- */
  function cronograma(c) {
    const k = canais(c);
    if (!k) return '<p class="cp-vazio">Esta campanha ainda não tem cronograma.</p>';
    const porDia = pecasPorDia(c);
    const grade = tabela(
      k.cols,
      k.s.rows.map((l) => l.map((v, i) => {
        if (i === 0) return `<b>${esc(v)}</b>`;
        if (i === l.length - 1) return `<span class="cp-menor">${esc(v)}</span>`;
        return temPeca(v) ? `<span class="cp-peca">${esc(v)}</span>` : '<span class="cp-off">—</span>';
      })));
    return `
      ${bloco('Dia a dia', porDia.length
        ? `${porDia.reduce((t, d) => t + d.itens.length, 0)} peças`
        : 'nada marcado ainda', porDia.length ? `
        <div class="cp-agenda">${porDia.map((d) => `
          <div class="cp-agenda-dia">
            <div class="cp-agenda-cab"><b>${esc(d.dia)}</b><span>${d.itens.length} peça${d.itens.length > 1 ? 's' : ''}</span></div>
            ${d.itens.map((i) => `<div class="cp-item"><b>${esc(i.canal)}</b>` +
              `<span>${esc(i.o)}</span><small>${esc(i.quem)}</small></div>`).join('')}
          </div>`).join('')}</div>`
        : '<p class="cp-vazio">Preencha a grade abaixo e o dia a dia aparece aqui.</p>')}
      ${bloco('A grade completa', 'a mesma do TAP, editável lá', grade)}
    `;
  }

  /* ---------- tarefas ---------- */
  const ROTULO = { 'a fazer': 'A fazer', fazendo: 'Fazendo', revisar: 'Em revisão', feito: 'Concluídas' };
  function tarefas(c) {
    const ts = tarefasDa(c);
    if (!ts.length) return `<p class="cp-vazio">Nenhuma tarefa com o projeto "${esc(c.name)}" no ClickUp.
      As tarefas chegam pelo campo <b>Projeto</b> de lá.</p>`;
    const ordem = ['a fazer', 'fazendo', 'revisar', 'feito'];
    return ordem.map((st) => {
      const l = ts.filter((t) => t.status === st);
      if (!l.length) return '';
      return bloco(ROTULO[st] || st, `${l.length}`, `<div class="cp-tarefas">${l.map((t) => {
        const ck = t.checklist || [], feitos = ck.filter((x) => x.done).length;
        return `<div class="cp-tarefa">
          <div class="cp-tarefa-topo">
            <b>${esc(t.title)}</b>
            ${t.priority && t.priority !== 'normal' ? `<span class="cp-pri cp-${esc(t.priority)}">${
              { urgent: 'urgente', high: 'alta', low: 'baixa' }[t.priority] || esc(t.priority)}</span>` : ''}
          </div>
          <div class="cp-tarefa-pe">
            <span>${esc((t.assignees || []).map((a) => String(a).split('|')[0].trim()).join(', ') || 'sem responsável')}</span>
            ${t.due ? `<span>vence ${dBR(t.due)}</span>` : ''}
            ${t.canal ? `<span>${esc(t.canal)}</span>` : ''}
            ${ck.length ? `<span>${feitos}/${ck.length} do checklist</span>` : ''}
            ${t.clickupUrl ? `<a href="${esc(t.clickupUrl)}" target="_blank" rel="noopener">abrir no ClickUp ↗</a>` : ''}
          </div>
        </div>`;
      }).join('')}</div>`);
    }).join('');
  }

  /* ---------- tomar as abas ---------- */
  function campanhaAberta() {
    const ws = document.getElementById('campaignWorkspace');
    const nome = ws?.querySelector('.cw-title h2')?.textContent?.trim();
    if (!nome) return null;
    const iguais = ler(chaveCamp()).filter((x) => x.name.trim() === nome);
    return iguais.length === 1 ? iguais[0] : null;
  }

  function enriquecer() {
    const ws = document.getElementById('campaignWorkspace');
    if (!ws || !ws.classList.contains('active')) return;
    const c = campanhaAberta();
    if (!c) return;
    /* O app remonta as abas a cada clique de aba, e isso apaga o que eu
       escrevi. Então a trava não pode ser só o nome da campanha: tem que
       olhar se o meu conteúdo ainda está lá. */
    const meu = ws.querySelector('[data-cw-pane="summary"] .cp');
    if (meu && ws.dataset.cp === c.name) return;
    ws.dataset.cp = c.name;
    const põe = (nome, html) => {
      const p = ws.querySelector(`[data-cw-pane="${nome}"]`);
      if (p) { p.innerHTML = `<div class="cp">${html}</div>` }
    };
    põe('summary', resumo(c));
    põe('offer', oferta(c));
    põe('schedule', cronograma(c));
    põe('tasks', tarefas(c));
  }

  new MutationObserver(enriquecer).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', enriquecer, { once: true });
  else enriquecer();
})();
