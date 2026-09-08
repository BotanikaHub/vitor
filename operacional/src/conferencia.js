/* ======================================================================
   Conferência antes da entrega.

   O pedido: ninguém marca uma tarefa como concluída sem ter conferido.
   Então a conferência não é um lembrete — é uma tranca. Enquanto houver
   item obrigatório em aberto, os três caminhos que levam ao "feito"
   (o círculo da lista, o arrasto para a coluna, o campo de status na
   ficha) recusam.

   São três níveis, e eles se apoiam um no outro:

     Área      o padrão do que se confere naquele tipo de entrega.
               É o que a operação combinou; muda pouco e vale para todo
               mundo. É daqui que a lista de cada tarefa nasce.

     Tarefa    a lista daquela entrega, nascida do padrão da área mais o
               contexto (a campanha, o canal, o produto). Esta é a que
               tranca a conclusão.

     Campanha  a conferência do conjunto: as tarefas todas conferidas,
               a oferta igual em todo canal, o cronograma cumprido, o
               resultado registrado.

   A lista pode ser escrita pela IA ou pelas regras daqui. As regras
   funcionam sempre, sem chave, sem rede e sem espera — a IA entra por
   cima delas quando existe /api/conferencia respondendo. Se a IA falhar,
   cair ou demorar, a lista das regras fica: nunca se entrega sem lista.
   ====================================================================== */
(function () {
  'use strict';

  const uid       = () => (window.user && window.user.id) || 'vitor-gutierrez';
  const chaveTar  = () => `central.tasks.${uid()}`;
  const chaveCamp = () => `central.campaigns.${uid()}`;
  const chaveConf = () => `central.conferencia.${uid()}`;

  const lerLista = (k) => { try { const v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : [] } catch { return [] } };
  const esc = (t) => String(t ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const agora = () => new Date().toISOString();
  const id = (p) => p + Math.random().toString(36).slice(2, 8);

  const nome = () => (window.user && (window.user.firstName || window.user.name)) || 'alguém';

  function aviso(texto) {
    if (window.showToast) { try { return window.showToast(texto) } catch {} }
    const t = document.createElement('div');
    t.className = 'as-aviso'; t.textContent = texto;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4200);
  }

  /* ---------- o que se confere em cada área ----------
     Escrito como a operação fala, não como um manual: cada linha é uma
     coisa que já deu errado alguma vez. O que é obrigatório trava a
     entrega; o resto fica como lembrete.

     Isto aqui é só o padrão de fábrica. O que vale é o que estiver
     guardado — a pessoa edita a área e a edição manda. */
  const GERAIS = [
    ['Está entregue por inteiro o que o briefing pediu', true],
    ['A marca do material é a certa — Botanika ou VermeFree, sem trocar', true],
    ['Preço, desconto e cupom batem com a oferta da campanha', true],
    ['Data e horário de publicação batem com o cronograma', true],
    ['Link testado: abre na página certa e com UTM', true],
    ['Texto lido inteiro, sem erro de português', true],
    ['Arquivo final salvo na pasta da campanha', false],
  ];

  const PADRAO = {
    'Tráfego': [
      ['Campanha, conjunto e anúncio nomeados no padrão', true],
      ['Público, orçamento e datas conferidos no gerenciador', true],
      ['Pixel disparando — teste de evento feito antes de subir', true],
      ['Criativo no formato certo de cada posicionamento', true],
      ['UTM completa: source, medium, campaign e content', true],
      ['Página de destino aberta e testada no celular', true],
      ['Verba do dia dentro do que o TAP previu', false],
    ],
    'Criativo': [
      ['Peça exportada na proporção de cada canal', true],
      ['Texto legível no celular, sem corte nas bordas', true],
      ['Logo, cor e tipografia dentro da marca', true],
      ['A foto é do produto que está na oferta', true],
      ['Selo de preço e desconto igual ao da oferta', true],
      ['Versão editável salva junto do arquivo final', false],
    ],
    'Copy': [
      ['A promessa do texto é a oferta real, sem prometer a mais', true],
      ['Nada dito sobre saúde além do que pode ser dito', true],
      ['Uma chamada só, e clara', true],
      ['Nome do produto e dosagem iguais ao rótulo', true],
      ['Revisado por outra pessoa antes de subir', true],
    ],
    'Instagram': [
      ['Legenda, primeiro comentário e hashtags prontos', true],
      ['Link da bio ou figurinha apontando para a página da campanha', true],
      ['Capa do Reels e primeiro frame conferidos', true],
      ['Agendamento confirmado no dia e na hora do cronograma', true],
      ['Áudio liberado para conta comercial', false],
    ],
    'E-mail': [
      ['Assunto e pré-cabeçalho sem corte no celular', true],
      ['Teste enviado e aberto no Gmail e no celular', true],
      ['Todos os links clicados no teste', true],
      ['Segmento e exclusões conferidos antes do disparo', true],
      ['Remetente, resposta e descadastro funcionando', true],
    ],
    'Site': [
      ['Alterado no tema rascunho e revisado antes de publicar', true],
      ['Testado no celular e no computador', true],
      ['Preço, frete e cupom aplicando até o checkout', true],
      ['Estoque conferido dos produtos da oferta', true],
      ['Página não ficou mais lenta depois da mudança', false],
    ],
    'Influencer': [
      ['Briefing enviado e confirmado pelo creator', true],
      ['Cupom e link exclusivos criados e testados', true],
      ['Entregável aprovado antes de publicar', true],
      ['Data de publicação combinada e dentro do cronograma', true],
      ['Print do publicado salvo', false],
    ],
    'Atendimento': [
      ['Respostas prontas da campanha carregadas', true],
      ['Equipe avisada da oferta, do cupom e das regras', true],
      ['Objeções e respostas revisadas', true],
      ['Escala coberta no horário de pico do dia', true],
    ],
    'Grupos': [
      ['Mensagem testada em um grupo antes do disparo geral', true],
      ['Link e cupom testados dentro da própria mensagem', true],
      ['Grupos e horário conferidos contra o cronograma', true],
      ['Não é a mesma mensagem de ontem', true],
    ],
    'API': [
      ['Público e regra da automação conferidos', true],
      ['Teste com um contato real antes de ligar', true],
      ['Limite de disparo e horário dentro do combinado', true],
    ],
    'Geral': [],
  };

  const PADRAO_CAMPANHA = [
    ['Todas as tarefas da campanha conferidas e concluídas', true],
    ['A oferta está escrita igual em todos os canais', true],
    ['Cronograma cumprido — nenhum dia previsto ficou sem publicar', true],
    ['Meta e verba do TAP batem com o que foi gasto', true],
    ['Página ou coleção da campanha no ar e testada', true],
    ['Resultado registrado: faturamento, verba e ROAS', true],
    ['Aprendizados escritos para a próxima', false],
  ];

  /* ---------- de que área é esta tarefa ----------
     O ClickUp não manda área. Manda canal às vezes, e sempre manda um
     título — e o título de quem trabalha diz a área na primeira palavra:
     "Subir criativo", "Disparo do e-mail", "Post do feed". */
  const PISTAS = [
    ['Tráfego',     /tr[áa]fego|an[úu]ncio|ads?\b|meta ads|google|campanha paga|gerenciador|roas|cpa\b/i],
    ['E-mail',      /e-?mail|newsletter|disparo|activecampaign|fluxo de e-?mail|r[ée]gua/i],
    ['Grupos',      /grupo|whats|zap|sendflow|lista de transmiss/i],
    ['Instagram',   /instagram|insta\b|reels?|stories|feed|post\b|social|tiktok/i],
    ['Influencer',  /influen|creator|ugc|permut/i],
    ['Site',        /site|shopify|p[áa]gina|landing|pdp|checkout|banner do site|cole[çc][ãa]o|tema/i],
    ['Criativo',    /criativ|arte|design|v[íi]deo|edi[çc][ãa]o|thumb|capa|export/i],
    ['Copy',        /copy|texto|roteiro|legenda|headline|redac|reda[çc]/i],
    ['Atendimento', /atendimento|suporte|sac\b|resposta pronta|objec/i],
    ['API',         /\bapi\b|automa[çc][ãa]o|integra[çc][ãa]o|n8n|webhook/i],
  ];

  function areaDe(t) {
    const canal = String(t?.canal || '');
    for (const [a, re] of PISTAS) if (re.test(canal)) return a;
    const texto = `${t?.title || ''} ${t?.project || ''} ${t?.description || ''}`;
    for (const [a, re] of PISTAS) if (re.test(texto)) return a;
    return 'Geral';
  }

  const AREAS = Object.keys(PADRAO);

  /* ---------- o que está guardado ----------
     Um objeto só, numa chave que começa com "central." — logo a ponte com
     o Supabase leva e traz sozinha, e a conferência que o Ítalo fez
     aparece na tela do Vitor. */
  function estado() {
    try {
      const e = JSON.parse(localStorage.getItem(chaveConf()) || '{}');
      if (!e.padroes) e.padroes = {};
      if (!e.escopos) e.escopos = {};
      return e;
    } catch { return { padroes: {}, escopos: {} } }
  }

  function gravar(e) {
    try { localStorage.setItem(chaveConf(), JSON.stringify(e)) } catch {}
  }

  /* o padrão de uma área: o que a pessoa editou, ou o de fábrica */
  function padraoDe(area) {
    const e = estado();
    if (Array.isArray(e.padroes[area]) && e.padroes[area].length) return e.padroes[area];
    return [...GERAIS, ...(PADRAO[area] || [])]
      .map(([texto, obrigatorio]) => ({ id: id('p'), texto, obrigatorio }));
  }

  function gravarPadrao(area, itens) {
    const e = estado();
    e.padroes[area] = itens;
    gravar(e);
  }

  const escopoTarefa   = (t) => `tarefa:${t.id}`;
  const escopoCampanha = (c) => `campanha:${c.brand || ''}|${c.name}`;

  const conferencia = (chave) => estado().escopos[chave] || null;

  function gravarConferencia(chave, conf) {
    const e = estado();
    e.escopos[chave] = conf;
    gravar(e);
  }

  /* ---------- a tranca ----------
     Sem lista, não trava: uma tarefa que nunca foi conferida ainda pode
     ser fechada, senão o sistema pararia a operação no dia em que subiu.
     Com lista, todo item obrigatório tem que estar marcado. */
  function pendentes(chave) {
    const c = conferencia(chave);
    if (!c || !Array.isArray(c.itens) || !c.itens.length) return [];
    return c.itens.filter((i) => i.obrigatorio && !i.feito);
  }

  const liberado = (chave) => pendentes(chave).length === 0;

  /* ---------- escrever a lista ----------
     Primeiro as regras, que respondem na hora. A IA, quando existe,
     reescreve por cima com o que ela entendeu do contexto — e se ela não
     responder, o que já está na tela continua valendo. */
  function porRegras(area, extras) {
    const base = padraoDe(area).map((p) => ({
      id: id('i'), texto: p.texto, obrigatorio: !!p.obrigatorio, feito: false,
    }));
    for (const [texto, obrigatorio] of (extras || []))
      base.push({ id: id('i'), texto, obrigatorio: !!obrigatorio, feito: false });
    return base;
  }

  /* itens que só existem por causa do contexto daquela tarefa */
  function extrasDaTarefa(t) {
    const e = [];
    const c = campanhaDaTarefa(t);
    if (c) {
      if (c.offer)  e.push([`Cupom "${String(c.offer).slice(0, 60)}" testado e válido no período`, true]);
      if (c.end)    e.push([`Nada continua no ar depois de ${dBR(c.end)}, o fim da campanha`, true]);
      const prods = (c.products || []).map((p) => p.name).filter(Boolean);
      if (prods.length) e.push([`Produtos da oferta conferidos: ${prods.slice(0, 3).join(', ')}`, true]);
    }
    if (t.due) e.push([`Entregue até ${dBR(t.due)}, o prazo da tarefa`, false]);
    return e;
  }

  const dISO = (s) => { const [a, m, d] = String(s || '').split('-').map(Number); return new Date(a, (m || 1) - 1, d || 1) };
  const dBR  = (s) => { const d = dISO(s); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}` };

  const limpa = (t) => String(t || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();

  /* mesma ligação que as abas de campanha usam: o campo Projeto */
  function campanhaDaTarefa(t) {
    const p = limpa(t.project);
    if (!p || p === 'sem projeto') return null;
    return lerLista(chaveCamp()).find((c) => {
      if (c.brand && t.brand && c.brand !== t.brand) return false;
      const n = limpa(c.name);
      return n === p || n.startsWith(p + ' ') || p.startsWith(n + ' ') ||
             (n.startsWith(p) && p.length >= 5);
    }) || null;
  }

  function tarefasDa(c) {
    const n = limpa(c.name);
    return lerLista(chaveTar()).filter((t) => {
      if (c.brand && t.brand && t.brand !== c.brand) return false;
      const p = limpa(t.project);
      if (!p || p === 'sem projeto') return false;
      return n === p || n.startsWith(p + ' ') || p.startsWith(n + ' ') ||
             (n.startsWith(p) && p.length >= 5);
    });
  }

  /* ---------- a IA ----------
     A chave da Anthropic não pode morar aqui: este arquivo vai inteiro
     para o navegador de quem abrir o link, e o repositório é público. Ela
     mora na Vercel, como variável de ambiente, e quem fala com a Anthropic
     é a função em /api/conferencia. Daqui só sai o contexto.

     Se não houver função publicada — ou se a chave não estiver lá — a
     resposta não vem, e as regras continuam valendo. Por isso o pedido
     tem prazo: quinze segundos e desiste. */
  async function porIA(payload) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    try {
      const r = await fetch('/api/conferencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      const itens = (j.itens || [])
        .filter((i) => i && String(i.texto || '').trim())
        .map((i) => ({
          id: id('i'),
          texto: String(i.texto).trim().slice(0, 200),
          obrigatorio: i.obrigatorio !== false,
          feito: false,
        }));
      if (!itens.length) throw new Error('lista vazia');
      return itens;
    } finally { clearTimeout(t) }
  }

  /* Gera e guarda. `ia` diz se pode tentar a IA; o que já estava marcado
     é reaproveitado pelo texto, para regenerar não apagar o trabalho de
     quem já conferiu metade. */
  async function gerar(chave, contexto, ia) {
    const antes = conferencia(chave);
    const marcados = new Map((antes?.itens || []).filter((i) => i.feito)
      .map((i) => [limpa(i.texto), i]));

    let itens = contexto.base ? contexto.base() : porRegras(contexto.area, contexto.extras);
    let por = 'regras';

    if (ia) {
      try { itens = await porIA(contexto.payload); por = 'ia' }
      catch (e) { console.info('[conferência] IA indisponível, seguindo pelas regras:', e.message) }
    }

    for (const i of itens) {
      const v = marcados.get(limpa(i.texto));
      if (v) { i.feito = true; i.por = v.por; i.em = v.em }
    }

    const conf = {
      itens, area: contexto.area, geradoEm: agora(), geradoPor: por,
      versao: (antes?.versao || 0) + 1,
    };
    gravarConferencia(chave, conf);
    return conf;
  }

  /* ====================================================================
     A tela
     ==================================================================== */

  function barra(chave) {
    const c = conferencia(chave);
    if (!c) return { feitos: 0, total: 0, obrig: 0, faltam: 0 };
    const obrig = c.itens.filter((i) => i.obrigatorio);
    return {
      feitos: c.itens.filter((i) => i.feito).length,
      total: c.itens.length,
      obrig: obrig.length,
      faltam: obrig.filter((i) => !i.feito).length,
    };
  }

  /* Aberta quando ainda falta conferir — que é quando ela precisa ser
     lida — e fechada quando já passou, para não empurrar o briefing e as
     subtarefas para o fim da ficha. A pessoa pode abrir e fechar, e a
     escolha dela vale enquanto a tela estiver de pé. */
  const dobra = new Map();
  const aberta = (chave, falta) => dobra.has(chave) ? dobra.get(chave) : falta > 0;

  function listaHtml(chave, contexto) {
    const c = conferencia(chave);
    const b = barra(chave);
    const pct = b.total ? Math.round((b.feitos / b.total) * 100) : 0;
    const ok = b.total > 0 && b.faltam === 0;

    const abrir = aberta(chave, b.faltam);

    const cabeca = `
      <div class="cf-topo">
        ${c ? `<button type="button" class="cf-dobra ${abrir ? 'aberta' : ''}" data-cf-dobra="${esc(chave)}"
          aria-expanded="${abrir}" title="${abrir ? 'Ocultar a lista' : 'Mostrar a lista'}">›</button>` : ''}
        <div class="cf-titulo">
          <strong>Conferência</strong>
          <span>${c ? `${b.feitos} de ${b.total} conferidos${b.faltam ? ` · faltam ${b.faltam} obrigatórios` : ''}` : 'ainda não há lista para esta entrega'}</span>
        </div>
        <div class="cf-acoes">
          <button type="button" class="cf-bt" data-cf-gerar="${esc(chave)}" data-cf-ia="1">${c ? 'Refazer com IA' : 'Gerar com IA'}</button>
          <button type="button" class="cf-bt" data-cf-gerar="${esc(chave)}">${c ? 'Refazer pelo padrão' : 'Usar o padrão'}</button>
          ${contexto.area ? `<button type="button" class="cf-bt cf-bt-fraco" data-cf-area="${esc(contexto.area)}">Padrão de ${esc(contexto.area)}</button>` : ''}
        </div>
      </div>`;

    if (!c) return `<div class="cf">${cabeca}
      <p class="cf-vazio">Sem lista, esta entrega ainda pode ser fechada. Gere a lista e
      a conclusão passa a depender dela.</p></div>`;

    const selo = ok
      ? '<span class="cf-selo cf-ok">Liberado para entrega</span>'
      : `<span class="cf-selo cf-trava">Travado — ${b.faltam} item${b.faltam > 1 ? 's' : ''} obrigatório${b.faltam > 1 ? 's' : ''} em aberto</span>`;

    return `<div class="cf ${ok ? 'cf-liberado' : 'cf-travado'}">
      ${cabeca}
      <div class="cf-medidor"><i style="width:${pct}%"></i></div>
      ${selo}
      <div class="cf-corpo" ${abrir ? '' : 'hidden'}>
      <div class="cf-itens">
        ${c.itens.map((i) => `
          <label class="cf-item ${i.feito ? 'feito' : ''} ${i.obrigatorio ? 'obrig' : ''}">
            <input type="checkbox" data-cf-item="${esc(chave)}|${esc(i.id)}" ${i.feito ? 'checked' : ''}>
            <span class="cf-texto">${esc(i.texto)}</span>
            ${i.obrigatorio ? '<span class="cf-tag">obrigatório</span>' : ''}
            ${i.feito && i.por ? `<span class="cf-quem">${esc(i.por)}${i.em ? ' · ' + dBRiso(i.em) : ''}</span>` : ''}
            <button type="button" class="cf-x" data-cf-tirar="${esc(chave)}|${esc(i.id)}" title="Tirar este item">×</button>
          </label>`).join('')}
      </div>
      <div class="cf-linha-add">
        <input type="text" data-cf-novo="${esc(chave)}" placeholder="Acrescentar item de conferência">
        <button type="button" class="cf-bt" data-cf-add="${esc(chave)}">Acrescentar</button>
      </div>
      <small class="cf-rodape">Lista ${c.geradoPor === 'ia' ? 'escrita pela IA' : 'montada pelo padrão da área'}
        em ${dBRiso(c.geradoEm)}${c.area ? ` · área ${esc(c.area)}` : ''}</small>
      </div>
    </div>`;
  }

  const dBRiso = (s) => {
    const d = new Date(s);
    return isNaN(d) ? '' : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  /* ---------- a ficha da tarefa ---------- */

  let tarefaAberta = null;

  const tarefaPorId = (i) => lerLista(chaveTar()).find((t) => String(t.id) === String(i)) || null;

  function tarefaDaFicha() {
    const dr = document.getElementById('taskDetailDrawer');
    if (!dr || !dr.classList.contains('open')) return null;
    if (tarefaAberta) { const t = tarefaPorId(tarefaAberta); if (t) return t }
    /* o cabeçalho termina com os últimos sete dígitos do id */
    const k = document.getElementById('taskDetailKicker')?.textContent || '';
    const m = k.match(/#(\S+)\s*$/);
    if (m) { const t = lerLista(chaveTar()).find((x) => String(x.id).slice(-7) === m[1]); if (t) return t }
    const titulo = document.getElementById('taskTitleInput')?.value?.trim();
    return titulo ? lerLista(chaveTar()).find((t) => t.title === titulo) || null : null;
  }

  function contextoTarefa(t) {
    const area = areaDe(t);
    const c = campanhaDaTarefa(t);
    return {
      area,
      extras: extrasDaTarefa(t),
      payload: {
        tipo: 'tarefa',
        area,
        marca: t.brand || '',
        tarefa: {
          titulo: t.title, descricao: t.description || '', projeto: t.project || '',
          canal: t.canal || '', prazo: t.due || '', prioridade: t.priority || '',
          subtarefas: (t.subtasks || []).map((s) => s.title),
        },
        campanha: c ? {
          nome: c.name, tipo: c.type || '', oferta: c.offer || '',
          objetivo: c.objective || '', inicio: c.start || '', fim: c.end || '',
          canais: c.channels || [],
          produtos: (c.products || []).map((p) => p.name).filter(Boolean),
        } : null,
        padrao: padraoDe(area).map((p) => p.texto),
      },
    };
  }

  function porFicha() {
    const dr = document.getElementById('taskDetailDrawer');
    if (!dr || !dr.classList.contains('open')) return;
    const main = dr.querySelector('.tdetail-main');
    if (!main) return;
    const t = tarefaDaFicha();
    if (!t) return;

    const chave = escopoTarefa(t);
    const assinatura = `${chave}|${JSON.stringify(barra(chave))}|${aberta(chave, barra(chave).faltam)}`;
    const atual = main.querySelector('[data-cf-secao]');
    if (atual && atual.dataset.cfSecao === assinatura) return;

    const html = `<section class="tsection cf-secao" data-cf-secao="${esc(assinatura)}">
      ${listaHtml(chave, contextoTarefa(t))}</section>`;

    if (atual) atual.outerHTML = html;
    else main.insertAdjacentHTML('afterbegin', html);

    travarSelect(chave);
  }

  /* O campo de status é do app; eu só desligo a opção enquanto a lista
     não fechar, para a recusa aparecer antes de a pessoa tentar.

     As opções do app não têm atributo value — o valor delas é o próprio
     texto. Então antes de reescrever o texto eu fixo o value, senão
     mudar o rótulo apagaria o status na hora de salvar. */
  function travarSelect(chave) {
    const sel = document.getElementById('detailStatus');
    if (!sel) return;
    const trancar = pendentes(chave).length > 0 && statusEscolhido(sel) !== 'feito';
    for (const o of sel.options) {
      if (statusDaOpcao(o) !== 'feito') continue;
      o.value = 'feito';
      o.disabled = trancar;
      o.textContent = trancar ? 'feito (conferência pendente)' : 'feito';
      o.title = trancar ? 'A conferência desta tarefa ainda tem item obrigatório em aberto.' : '';
    }
  }

  const statusDaOpcao = (o) => (o.getAttribute('value') || o.textContent || '').replace(/ \(.*\)$/, '').trim();
  const statusEscolhido = (sel) => statusDaOpcao(sel.options[sel.selectedIndex] || {
    getAttribute: () => null, textContent: sel.value });

  /* ---------- a campanha ---------- */

  function campanhaNaTela() {
    const ws = document.getElementById('campaignWorkspace');
    if (!ws || !ws.classList.contains('active')) return null;
    const nome = ws.querySelector('.cw-title h2')?.textContent?.trim();
    if (!nome) return null;
    const marca = (ws.querySelector('.cw-title small')?.textContent || '').split('·')[0].trim();
    const todas = lerLista(chaveCamp());
    const porNome = todas.filter((x) => x.name.trim() === nome);
    if (porNome.length === 1) return porNome[0];
    const m = porNome.filter((x) => (x.brand || '').toLowerCase() === marca.toLowerCase());
    return m.length === 1 ? m[0] : null;
  }

  function contextoCampanha(c) {
    const ts = tarefasDa(c);
    return {
      area: null,
      extras: [],
      payload: {
        tipo: 'campanha',
        marca: c.brand || '',
        campanha: {
          nome: c.name, tipo: c.type || '', oferta: c.offer || '',
          objetivo: c.objective || '', inicio: c.start || '', fim: c.end || '',
          meta: c.goal || 0, verba: c.budget || 0, canais: c.channels || [],
          produtos: (c.products || []).map((p) => p.name).filter(Boolean),
        },
        tarefas: ts.map((t) => ({ titulo: t.title, status: t.status, area: areaDe(t) })),
        padrao: PADRAO_CAMPANHA.map(([t]) => t),
      },
    };
  }

  /* a campanha herda o padrão dela, e não o de uma área */
  function porRegrasCampanha() {
    return PADRAO_CAMPANHA.map(([texto, obrigatorio]) =>
      ({ id: id('i'), texto, obrigatorio, feito: false }));
  }

  function contagemDa(c) {
    const ts = tarefasDa(c);
    const semLista = ts.filter((t) => !conferencia(escopoTarefa(t)));
    const travadas = ts.filter((t) => pendentes(escopoTarefa(t)).length);
    return { total: ts.length, semLista: semLista.length, travadas: travadas.length,
             ok: ts.length - semLista.length - travadas.length };
  }

  function resumoTarefasDa(c) {
    const { total, semLista, travadas, ok } = contagemDa(c);
    if (!total) return '';
    return `<div class="cf-tarefas-rot">Conferência das tarefas desta campanha</div>
    <div class="cf-tarefas">
      <div class="cf-tarefa-num"><b>${ok}</b><span>conferidas</span></div>
      <div class="cf-tarefa-num ${travadas ? 'ruim' : ''}"><b>${travadas}</b><span>travadas</span></div>
      <div class="cf-tarefa-num ${semLista ? 'morno' : ''}"><b>${semLista}</b><span>sem lista</span></div>
      ${semLista ? `<button type="button" class="cf-bt" data-cf-gerar-todas="${esc(escopoCampanha(c))}">Gerar a lista das ${semLista} que faltam</button>` : ''}
    </div>`;
  }

  function naCampanha() {
    const c = campanhaNaTela();
    if (!c) return;
    const pane = document.querySelector('[data-cw-pane="summary"] .cp');
    if (!pane) return;

    const chave = escopoCampanha(c);
    const assinatura = `${chave}|${JSON.stringify(barra(chave))}|${JSON.stringify(contagemDa(c))}` +
      `|${aberta(chave, barra(chave).faltam)}`;
    const atual = pane.querySelector('[data-cf-camp]');
    if (atual && atual.dataset.cfCamp === assinatura) return;

    const html = `<section class="cf-camp" data-cf-camp="${esc(assinatura)}">
      ${resumoTarefasDa(c)}
      ${listaHtml(chave, contextoCampanha(c))}</section>`;

    if (atual) atual.outerHTML = html;
    else pane.insertAdjacentHTML('beforeend', html);
  }

  /* ---------- o padrão da área ---------- */

  function abrirArea(area) {
    fecharArea();
    const itens = padraoDe(area);
    const caixa = document.createElement('div');
    caixa.className = 'cf-modal';
    caixa.innerHTML = `
      <div class="cf-modal-fundo" data-cf-fechar></div>
      <div class="cf-modal-caixa" role="dialog" aria-label="Padrão de conferência">
        <header>
          <div>
            <strong>Padrão de conferência</strong>
            <span>o que sempre se confere nas entregas desta área</span>
          </div>
          <button type="button" class="cf-x-grande" data-cf-fechar>×</button>
        </header>
        <div class="cf-abas">
          ${AREAS.map((a) => `<button type="button" class="cf-aba ${a === area ? 'ativa' : ''}" data-cf-troca="${esc(a)}">${esc(a)}</button>`).join('')}
        </div>
        <div class="cf-modal-corpo" data-cf-corpo="${esc(area)}">
          <div class="cf-padrao">
            ${itens.map((p) => `
              <div class="cf-padrao-linha" data-cf-p="${esc(p.id)}">
                <input type="checkbox" data-cf-obrig="${esc(p.id)}" ${p.obrigatorio ? 'checked' : ''} title="Obrigatório — trava a entrega">
                <span contenteditable="plaintext-only" spellcheck="false" data-cf-texto="${esc(p.id)}">${esc(p.texto)}</span>
                <button type="button" class="cf-x" data-cf-tirar-p="${esc(p.id)}">×</button>
              </div>`).join('')}
          </div>
          <div class="cf-linha-add">
            <input type="text" data-cf-novo-p="1" placeholder="Acrescentar ao padrão de ${esc(area)}">
            <button type="button" class="cf-bt" data-cf-add-p="1">Acrescentar</button>
          </div>
          <p class="cf-nota">A caixa marcada é item obrigatório: enquanto ele não estiver
          conferido, a tarefa não fecha. O que está aqui vale para as próximas listas —
          as listas já geradas continuam como estão até serem refeitas.</p>
        </div>
        <footer>
          <button type="button" class="cf-bt cf-bt-fraco" data-cf-restaurar="${esc(area)}">Voltar ao padrão de fábrica</button>
          <button type="button" class="cf-bt cf-bt-forte" data-cf-fechar>Pronto</button>
        </footer>
      </div>`;
    document.body.appendChild(caixa);
  }

  const fecharArea = () => document.querySelector('.cf-modal')?.remove();

  function areaAberta() {
    return document.querySelector('[data-cf-corpo]')?.dataset.cfCorpo || null;
  }

  function lerPadraoDaTela() {
    return [...document.querySelectorAll('.cf-padrao-linha')].map((l) => ({
      id: l.dataset.cfP,
      texto: l.querySelector('[data-cf-texto]').textContent.trim(),
      obrigatorio: l.querySelector('[data-cf-obrig]').checked,
    })).filter((p) => p.texto);
  }

  function salvarAreaDaTela() {
    const a = areaAberta();
    if (a) gravarPadrao(a, lerPadraoDaTela());
  }

  /* ====================================================================
     Os cliques
     ==================================================================== */

  document.addEventListener('click', async (e) => {
    const alvo = e.target;

    /* --- abrir e fechar a lista --- */
    const d = alvo.closest?.('[data-cf-dobra]');
    if (d) {
      const chave = d.dataset.cfDobra;
      dobra.set(chave, !aberta(chave, barra(chave).faltam));
      redesenhar();
      return;
    }

    /* --- gerar / refazer --- */
    const g = alvo.closest?.('[data-cf-gerar]');
    if (g) {
      const chave = g.dataset.cfGerar;
      const ia = g.dataset.cfIa === '1';
      g.disabled = true;
      const antes = g.textContent;
      g.textContent = ia ? 'Escrevendo…' : 'Montando…';
      try {
        if (chave.startsWith('campanha:')) {
          const c = campanhaNaTela();
          if (c) {
            const ctx = contextoCampanha(c);
            if (ia) {
              await gerar(chave, { ...ctx, area: null, extras: [], base: porRegrasCampanha }, true);
            } else {
              const antesC = conferencia(chave);
              const marcados = new Map((antesC?.itens || []).filter((i) => i.feito).map((i) => [limpa(i.texto), i]));
              const itens = porRegrasCampanha();
              for (const i of itens) if (marcados.has(limpa(i.texto))) i.feito = true;
              gravarConferencia(chave, { itens, geradoEm: agora(), geradoPor: 'regras', versao: (antesC?.versao || 0) + 1 });
            }
          }
        } else {
          const t = tarefaDaFicha();
          if (t) await gerar(chave, contextoTarefa(t), ia);
        }
      } finally {
        g.disabled = false; g.textContent = antes;
        redesenhar();
      }
      return;
    }

    /* --- gerar a lista de todas as tarefas de uma campanha --- */
    const gt = alvo.closest?.('[data-cf-gerar-todas]');
    if (gt) {
      const c = campanhaNaTela();
      if (!c) return;
      gt.disabled = true;
      const antes = gt.textContent;
      const faltando = tarefasDa(c).filter((t) => !conferencia(escopoTarefa(t)));
      let n = 0;
      for (const t of faltando) {
        gt.textContent = `Escrevendo ${++n} de ${faltando.length}…`;
        await gerar(escopoTarefa(t), contextoTarefa(t), true);
      }
      gt.disabled = false; gt.textContent = antes;
      aviso(`${faltando.length} lista${faltando.length > 1 ? 's' : ''} de conferência criada${faltando.length > 1 ? 's' : ''}.`);
      redesenhar();
      return;
    }

    /* --- tirar item da lista --- */
    const x = alvo.closest?.('[data-cf-tirar]');
    if (x) {
      const [chave, item] = x.dataset.cfTirar.split('|');
      const c = conferencia(chave);
      if (c) {
        c.itens = c.itens.filter((i) => i.id !== item);
        gravarConferencia(chave, c);
        redesenhar();
      }
      e.preventDefault();
      return;
    }

    /* --- acrescentar item --- */
    const a = alvo.closest?.('[data-cf-add]');
    if (a) {
      const chave = a.dataset.cfAdd;
      const campo = document.querySelector(`[data-cf-novo="${CSS.escape(chave)}"]`);
      const texto = campo?.value.trim();
      if (!texto) return;
      const c = conferencia(chave) || { itens: [], geradoEm: agora(), geradoPor: 'mão', versao: 1 };
      c.itens.push({ id: id('i'), texto, obrigatorio: true, feito: false });
      gravarConferencia(chave, c);
      redesenhar();
      return;
    }

    /* --- padrão da área --- */
    const pa = alvo.closest?.('[data-cf-area]');
    if (pa) { abrirArea(pa.dataset.cfArea); return }

    if (alvo.closest?.('[data-cf-fechar]')) { salvarAreaDaTela(); fecharArea(); redesenhar(); return }

    const tr = alvo.closest?.('[data-cf-troca]');
    if (tr) { salvarAreaDaTela(); abrirArea(tr.dataset.cfTroca); return }

    const xp = alvo.closest?.('[data-cf-tirar-p]');
    if (xp) {
      xp.closest('.cf-padrao-linha')?.remove();
      salvarAreaDaTela();
      return;
    }

    if (alvo.closest?.('[data-cf-add-p]')) {
      const campo = document.querySelector('[data-cf-novo-p]');
      const texto = campo?.value.trim();
      if (!texto) return;
      const atual = lerPadraoDaTela();
      atual.push({ id: id('p'), texto, obrigatorio: true });
      const area = areaAberta();
      if (area) { gravarPadrao(area, atual); abrirArea(area) }
      return;
    }

    const rest = alvo.closest?.('[data-cf-restaurar]');
    if (rest) {
      const area = rest.dataset.cfRestaurar;
      const e2 = estado();
      delete e2.padroes[area];
      gravar(e2);
      abrirArea(area);
      return;
    }
  });

  /* marcar e desmarcar item */
  document.addEventListener('change', (e) => {
    const cb = e.target.closest?.('[data-cf-item]');
    if (cb) {
      const [chave, item] = cb.dataset.cfItem.split('|');
      const c = conferencia(chave);
      if (!c) return;
      const i = c.itens.find((y) => y.id === item);
      if (!i) return;
      i.feito = cb.checked;
      if (cb.checked) { i.por = nome(); i.em = agora() } else { delete i.por; delete i.em }
      gravarConferencia(chave, c);
      redesenhar();
      return;
    }
    if (e.target.closest?.('[data-cf-obrig]')) salvarAreaDaTela();
  });

  document.addEventListener('focusout', (e) => {
    if (e.target.closest?.('[data-cf-texto]')) salvarAreaDaTela();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.querySelector('.cf-modal')) {
      salvarAreaDaTela(); fecharArea(); e.stopPropagation();
    }
    if (e.key === 'Enter' && e.target.closest?.('[data-cf-texto]')) {
      e.preventDefault(); e.target.blur();
    }
    if (e.key === 'Enter' && e.target.closest?.('[data-cf-novo],[data-cf-novo-p]')) {
      e.preventDefault();
      const chave = e.target.dataset.cfNovo;
      (chave
        ? document.querySelector(`[data-cf-add="${CSS.escape(chave)}"]`)
        : document.querySelector('[data-cf-add-p]'))?.click();
    }
  });

  /* ====================================================================
     A tranca

     São três portas para o "feito", e todas passam por aqui antes de
     chegarem no app: o ouvinte é de captura, no documento, então corre
     antes dos ouvintes que o app pendurou nos elementos.
     ==================================================================== */

  function recusar(t) {
    const chave = escopoTarefa(t);
    const falta = pendentes(chave);
    aviso(`"${t.title}" não pode ser concluída: ${falta.length} item${falta.length > 1 ? 's' : ''} de conferência em aberto.`);
    /* abre a ficha na conferência, para a recusa vir com o caminho junto */
    if (!document.getElementById('taskDetailDrawer')?.classList.contains('open')) {
      const linha = document.querySelector(`[data-task-id="${CSS.escape(String(t.id))}"]`);
      if (linha) { tarefaAberta = String(t.id); linha.click() }
    }
    setTimeout(() => {
      const s = document.querySelector('.cf-secao');
      if (s) { s.scrollIntoView({ block: 'center', behavior: 'smooth' }); s.classList.add('cf-pisca'); setTimeout(() => s.classList.remove('cf-pisca'), 1400) }
    }, 120);
  }

  document.addEventListener('click', (e) => {
    /* de quem é a ficha que vai abrir */
    const linha = e.target.closest?.('[data-task-id]');
    if (linha && !e.target.closest('[data-toggle-done]')) tarefaAberta = linha.dataset.taskId;

    /* o círculo da lista */
    const bt = e.target.closest?.('[data-toggle-done]');
    if (bt) {
      const t = tarefaPorId(bt.dataset.toggleDone);
      if (t && t.status !== 'feito' && pendentes(escopoTarefa(t)).length) {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        recusar(t);
      }
      return;
    }

    /* o botão Salvar da ficha: aqui não dá para barrar o salvamento
       inteiro sem jogar fora o que a pessoa escreveu nos outros campos.
       Então devolvo o status ao que era e deixo o resto salvar. */
    if (e.target.closest?.('#taskSaveBtn')) {
      const sel = document.getElementById('detailStatus');
      const t = tarefaDaFicha();
      if (sel && statusEscolhido(sel) === 'feito' && t && t.status !== 'feito' && pendentes(escopoTarefa(t)).length) {
        sel.value = t.status;
        recusar(t);
      }
    }
  }, true);

  document.addEventListener('drop', (e) => {
    const col = e.target.closest?.('[data-drop-status]');
    if (!col || col.dataset.dropStatus !== 'feito') return;
    let idArrastado = '';
    try { idArrastado = e.dataTransfer.getData('text/plain') } catch {}
    const t = tarefaPorId(idArrastado);
    if (t && t.status !== 'feito' && pendentes(escopoTarefa(t)).length) {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      recusar(t);
    }
  }, true);

  /* ====================================================================
     Redesenhar

     O app refaz as telas o tempo todo — cada aba clicada, cada tarefa
     salva. Em vez de pendurar ouvintes que somem junto, olho as mudanças
     e reponho o que é meu. A assinatura evita o laço: se o que está na
     tela já é o que eu desenharia, não desenho.
     ==================================================================== */

  let pedido = 0;
  function redesenhar() {
    cancelAnimationFrame(pedido);
    pedido = requestAnimationFrame(() => { porFicha(); naCampanha() });
  }

  const olho = new MutationObserver(redesenhar);
  function ligar() {
    olho.observe(document.body, { childList: true, subtree: true });
    redesenhar();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ligar);
  else ligar();

  /* ---------- para os testes e para quem vier depois ---------- */
  window.Conferencia = {
    areas: AREAS, areaDe, padraoDe, gravarPadrao,
    escopoTarefa, escopoCampanha, conferencia, gravarConferencia,
    pendentes, liberado, gerar, porRegras, porRegrasCampanha,
    estado, redesenhar, abrirArea, tarefasDa, campanhaDaTarefa,
  };
})();
