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

  const iSec = (c, re) => (c.tap || []).findIndex((s) => re.test(s.title || ''));
  const sec = (c, re) => (c.tap || [])[iSec(c, re)];
  const linha = (s, re) => (s?.rows || []).find((l) => re.test(String(l[0] || '')));
  const iLinha = (s, re) => (s?.rows || []).findIndex((l) => re.test(String(l[0] || '')));

  /* ---------- editar no lugar ----------
     Tudo que se vê aqui vem do TAP, então editar aqui é editar o TAP. A
     célula guarda o endereço dela — seção, linha, coluna — e ao sair do
     campo grava. Sem formulário, sem botão de salvar: onde está escrito
     é onde se escreve. */
  const ed = (si, ri, ci, valor, cls) =>
    `<span class="cp-ed ${cls || ''}" contenteditable="plaintext-only" spellcheck="false"` +
    ` data-ed="${si}.${ri}.${ci}">${esc(valor ?? '')}</span>`;

  /* campo do próprio objeto campanha, e não de uma célula do TAP */
  const edCampo = (campo, valor, cls) =>
    `<span class="cp-ed ${cls || ''}" contenteditable="plaintext-only" spellcheck="false"` +
    ` data-campo="${campo}">${esc(valor ?? '')}</span>`;

  function gravar(c) {
    const todas = ler(chaveCamp());
    const i = todas.findIndex((x) => String(x.id) === String(c.id));
    if (i < 0) return;
    todas[i] = c;
    localStorage.setItem(chaveCamp(), JSON.stringify(todas));
    window.RecarregarCampanhas?.();
  }

  /* Números vêm com R$ e ponto de milhar, e o Vitor escreve "80 mil" tanto
     quanto "80.000" — o assistente já entende as duas formas, e aqui tem
     que ser igual, senão o mesmo texto vale coisas diferentes em telas
     diferentes. */
  const soNumero = (t) => {
    let x = String(t || '').toLowerCase().trim();
    if (!x) return 0;
    const mil = /\bmil\b|\dk$/.test(x);
    x = x.replace(/\bmil\b/g, '').replace(/k$/, '')
         .replace(/[^\d,.-]/g, '')
         .replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
    const n = parseFloat(x) || 0;
    return Math.round(mil ? n * 1000 : n);
  };

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
    const si = iSec(c, /^METAS/i), s = c.tap?.[si];
    if (!s) return [];
    return (s.rows || []).map((l, ri) => ({ l, ri }))
      .filter(({ l }) => /^Meta faturamento — /.test(String(l[0])))
      .map(({ l, ri }) => ({ si, ri, nome: String(l[0]).replace('Meta faturamento — ', ''),
                             valor: num(l[1]), txt: l[1], quem: l[2] || '' }))
      .filter((x) => x.valor > 0);
  }
  function investPorCanal(c) {
    const si = iSec(c, /^METAS/i), s = c.tap?.[si];
    if (!s) return [];
    return (s.rows || []).map((l, ri) => ({ l, ri }))
      .filter(({ l }) => /^Investimento — /.test(String(l[0])))
      .map(({ l, ri }) => ({ si, ri, nome: String(l[0]).replace('Investimento — ', ''),
                             valor: num(l[1]), txt: l[1] }))
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
    const iEv = iSec(c, /SOBRE O EVENTO/i), evento = c.tap?.[iEv];
    const iFa = iSec(c, /^FASES/i), fases = c.tap?.[iFa];
    /* devolve a célula editável daquele campo do evento, ou nada quando a
       linha não existe — não invento linha só para ter onde escrever */
    const campoEvento = (re) => {
      const ri = iLinha(evento, re);
      return ri < 0 ? null : ed(iEv, ri, 1, evento.rows[ri][1]);
    };

    const canaisAtivos = k ? [...new Set(porDia.flatMap((d) => d.itens.map((i) => i.canal)))] : [];

    return `
      <div class="cp-numeros">
        ${cartao('Meta', edCampo('goal', brl(meta), 'cp-ed-num'), dias === 1 ? 'em 1 dia' : `em ${dias} dias`)}
        ${cartao('Verba',
          /* quando o TAP tem investimento por canal, a verba é a soma deles;
             deixar editar aqui seria oferecer um campo que não muda nada,
             porque a soma venceria na próxima leitura */
          inv.length ? brl(somaInv) : edCampo('budget', brl(somaInv), 'cp-ed-num'),
          inv.length ? `somado de ${inv.length} canais` : (somaInv ? 'sem divisão por canal' : 'sem investimento'))}
        ${cartao('ROAS alvo', roas, somaInv ? 'meta ÷ verba' : 'não se compra faturamento aqui')}
        ${cartao('Lucro previsto', brl(meta - somaInv), 'meta menos verba')}
      </div>

      ${bloco('O que é esta ação', `${dBR(c.start)} a ${dBR(c.end)}`, `
        <p class="cp-texto">${edCampo('objective', c.objective || '')}</p>
        <div class="cp-linhas">
          ${[['Cupom', edCampo('offer', c.offer)],
             ['Frete', campoEvento(/frete/i)],
             ['Bônus universal', campoEvento(/bônus universal/i)],
             ['Bônus via influencer', campoEvento(/influencer/i)],
             ['Brinde', campoEvento(/brinde/i)]]
            .filter(([, v]) => v)
            .map(([r, v]) => `<div class="cp-linha"><span>${esc(r)}</span><b>${v}</b></div>`).join('')}
        </div>`)}

      ${bloco('De onde vem o faturamento',
        metas.length ? `${metas.length} canais somam ${brl(somaMeta)}` : '',
        (difere ? `<p class="cp-aviso">Os canais somam <b>${brl(somaMeta)}</b>, e a meta da ação é
          <b>${brl(meta)}</b> — faltam <b>${brl(meta - somaMeta)}</b> distribuídos.</p>` : '') +
        tabela(
          ['Canal', 'Meta', 'Investimento', 'ROAS', 'Responsável'],
          metas.map((m) => {
            const i = inv.find((x) => x.nome === m.nome)?.valor || 0;
            const li = inv.find((x) => x.nome === m.nome);
            return [esc(m.nome), ed(m.si, m.ri, 1, m.txt, 'cp-ed-num'),
                    li ? ed(li.si, li.ri, 1, li.txt, 'cp-ed-num') : '—',
                    i ? (m.valor / i).toFixed(1).replace('.', ',') : '—', esc(m.quem)];
          })))}

      ${fases ? bloco('Como a ação se desenrola', `${(fases.rows || []).length} fases`, tabela(
        ['Fase', 'Tem?', 'Quando', ''],
        (fases.rows || []).map((l, ri) => [
          ed(iFa, ri, 0, l[0]), ed(iFa, ri, 1, l[1]), ed(iFa, ri, 2, l[2]),
          `<button class="cp-x" data-linha="menos.${iFa}.${ri}" title="Tirar esta fase">×</button>`]))
        + `<div class="cp-mais"><button data-linha="mais.${iFa}.0">+ fase</button></div>`) : ''}

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
    const iSo = iSec(c, /SOBRE A OFERTA/i), so = c.tap?.[iSo];
    const iTk = iSec(c, /TICKET/i), tk = c.tap?.[iTk];
    const prods = (so?.rows || []).map((l, ri) => ({ l, ri }))
      .filter(({ l }) => !/^A definir/i.test(String(l[0])));
    const linhas = prods.map(({ l, ri }) => {
      /* o produto escrito à mão costuma trazer o desconto no meio do texto
         ("Combo Fitness · 15% OFF") em vez da coluna própria; se a coluna
         está vazia, vale o que está escrito */
      const desc = num(l[2]) || num(String(l[1]).match(/(\d+)\s*%/)?.[1] || '');
      const preco = num(String(l[1]).match(/R\$\s*[\d.,]+/)?.[0] || '');
      const fim = preco && desc ? preco * (1 - desc / 100) : 0;
      return [
        ed(iSo, ri, 0, l[0], 'cp-forte'),
        ed(iSo, ri, 1, l[1], 'cp-menor'),
        ed(iSo, ri, 2, l[2]),
        fim ? `<b>R$ ${fim.toFixed(2).replace('.', ',')}</b>` : '—',
        `<button class="cp-x" data-linha="menos.${iSo}.${ri}" title="Tirar este produto">×</button>`,
      ];
    });
    const benef = (c.benefits || []).filter(Boolean);
    return `
      ${bloco('Produtos participantes', prods.length ? `${prods.length} itens` : '',
        tabela(['Produto', 'Detalhe', 'Desconto', 'Preço final', ''], linhas) +
        (iSo >= 0 ? `<div class="cp-mais"><button data-linha="mais.${iSo}.0">+ produto</button></div>` : ''))}
      ${bloco('O que a pessoa ganha além do desconto', 'vem do TAP, em Sobre o evento', `
        <div class="cp-linhas">${(() => {
          const iEv = iSec(c, /SOBRE O EVENTO/i), ev = c.tap?.[iEv];
          const alvos = [[/frete/i, 'Frete'], [/brinde/i, 'Brinde'],
                         [/bônus universal/i, 'Bônus universal'], [/influencer/i, 'Bônus via influencer']];
          const l = alvos.map(([re, rot]) => {
            const ri = iLinha(ev, re);
            return ri < 0 ? '' :
              `<div class="cp-linha"><span>${rot}</span><b>${ed(iEv, ri, 1, ev.rows[ri][1])}</b></div>`;
          }).filter(Boolean);
          return l.length ? l.join('') : '<p class="cp-vazio">Sem benefícios cadastrados.</p>';
        })()}</div>`)}
      ${tk ? bloco('Como subir o ticket médio', '', tabela(
        ['Estratégia', 'Detalhe', 'Desconto', ''],
        (tk.rows || []).map((l, ri) => [
          ed(iTk, ri, 0, l[0], 'cp-forte'), ed(iTk, ri, 1, l[1]), ed(iTk, ri, 2, l[2]),
          `<button class="cp-x" data-linha="menos.${iTk}.${ri}">×</button>`]))
        + `<div class="cp-mais"><button data-linha="mais.${iTk}.0">+ estratégia</button></div>`) : ''}
    `;
  }

  /* ---------- cronograma ---------- */
  function cronograma(c) {
    const k = canais(c);
    if (!k) return '<p class="cp-vazio">Esta campanha ainda não tem cronograma.</p>';
    const si = iSec(c, /CANAIS/i);
    const porDia = pecasPorDia(c);
    const grade = tabela(
      [...k.cols, ''],
      k.s.rows.map((l, ri) => [
        ...l.map((v, ci) => ed(si, ri, ci,
          ci === 0 || ci === l.length - 1 ? v : (temPeca(v) ? v : '—'),
          ci === 0 ? 'cp-forte' : ci === l.length - 1 ? 'cp-menor'
            : temPeca(v) ? 'cp-peca' : 'cp-off')),
        `<button class="cp-x" data-linha="menos.${si}.${ri}" title="Tirar este canal">×</button>`,
      ]));
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
      ${bloco('A grade completa', 'clique numa célula para escrever',
        grade + `<div class="cp-mais"><button data-linha="mais.${si}.0">+ canal</button></div>`)}
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

  /* Um ouvinte só, no documento: as abas são refeitas o tempo todo e
     religar a cada refazimento deixaria ouvintes soltos para trás. */
  document.addEventListener('focusout', (e) => {
    const el = e.target.closest?.('[data-ed],[data-campo]');
    if (!el) return;
    const c = campanhaAberta(); if (!c) return;
    const txt = el.textContent.trim();

    if (el.dataset.campo) {
      const campo = el.dataset.campo;
      const novo = ['goal', 'budget'].includes(campo) ? soNumero(txt) : txt;
      if (c[campo] === novo) return;
      c[campo] = novo;
    } else {
      const [si, ri, ci] = el.dataset.ed.split('.').map(Number);
      const l = c.tap?.[si]?.rows?.[ri];
      if (!l || l[ci] === txt) return;
      l[ci] = txt;
    }
    gravar(c);
    /* refaz para as contas dependentes acompanharem — o ROAS muda quando a
       verba muda, e o aviso de canais quando uma meta muda */
    const ws = document.getElementById('campaignWorkspace');
    if (ws) { delete ws.dataset.cp; enriquecer() }
  });

  /* Enter confirma, Esc desfaz — como em qualquer campo. */
  document.addEventListener('keydown', (e) => {
    const el = e.target.closest?.('[data-ed],[data-campo]');
    if (!el) return;
    if (e.key === 'Enter') { e.preventDefault(); el.blur() }
    if (e.key === 'Escape') { e.preventDefault(); el.dataset.cancelar = '1'; el.blur() }
    e.stopPropagation();
  });

  /* acrescentar e tirar linha das tabelas que crescem */
  document.addEventListener('click', (e) => {
    const bt = e.target.closest?.('[data-linha]');
    if (!bt) return;
    const c = campanhaAberta(); if (!c) return;
    const [acao, si, ri] = bt.dataset.linha.split('.');
    const s2 = c.tap?.[+si]; if (!s2) return;
    if (acao === 'mais') s2.rows.push(s2.columns.map(() => ''));
    else if (acao === 'menos') {
      if (!confirm('Tirar esta linha?')) return;
      s2.rows.splice(+ri, 1);
    }
    gravar(c);
    const ws = document.getElementById('campaignWorkspace');
    if (ws) { delete ws.dataset.cp; enriquecer() }
  });

  /* ---------- a lista de campanhas, separada ----------
     Perpétuo e pontual são duas leituras diferentes: uma é o que roda
     sempre e a outra é o que tem data e prazo. Misturadas numa lista só,
     a pessoa lê dezoito linhas para achar as três que importam hoje. */
  const ehContinua = (c) => ['Perpétuo', 'Recompra'].includes(c.type) || (() => {
    const a = new Date(c.start), b = new Date(c.end);
    if (isNaN(a) || isNaN(b)) return false;
    const dias = Math.round((b - a) / 86400000) + 1;
    return dias >= new Date(b.getFullYear(), b.getMonth() + 1, 0).getDate() * 0.9;
  })();

  function separarLista() {
    const lista = document.getElementById('campaignList');
    if (!lista || lista.dataset.sep === '1') return;
    const linhas = [...lista.children].filter((e) => !e.classList.contains('camp-list-head')
      && !e.classList.contains('camp-grupo'));
    if (linhas.length < 2) return;

    const todas = ler(chaveCamp());
    const nomeDe = (el) => el.querySelector('.camp-name')?.textContent?.trim()
      || el.textContent.trim().split('\n')[0];
    const grupo = (el) => {
      const n = nomeDe(el);
      const c = todas.find((x) => x.name.trim() === n);
      return c && ehContinua(c) ? 'continua' : 'pontual';
    };
    const pont = linhas.filter((e) => grupo(e) === 'pontual');
    const cont = linhas.filter((e) => grupo(e) === 'continua');
    if (!pont.length || !cont.length) { lista.dataset.sep = '1'; return }

    const cab = (rot, sub, n) => {
      const d = document.createElement('div');
      d.className = 'camp-grupo';
      d.innerHTML = `<b>${rot}</b><span>${n} · ${sub}</span>`;
      return d;
    };
    lista.appendChild(cab('Pontuais', 'têm data de início e fim', pont.length));
    pont.forEach((e) => lista.appendChild(e));
    lista.appendChild(cab('Contínuas', 'rodam o mês inteiro', cont.length));
    cont.forEach((e) => lista.appendChild(e));
    lista.dataset.sep = '1';
  }

  new MutationObserver(() => { enriquecer(); separarLista() })
    .observe(document.documentElement, { childList: true, subtree: true });
  const comecar = () => { enriquecer(); separarLista() };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', comecar, { once: true });
  else comecar();
})();
