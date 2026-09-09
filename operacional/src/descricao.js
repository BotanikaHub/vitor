/* ======================================================================
   A descrição da tarefa, lida como texto e não como código.

   O ClickUp guarda a descrição em Markdown, e o app mostrava o arquivo
   cru dentro de uma caixa de texto: "> ⚠️ **TAREFA RECORRENTE**",
   "## Por que esta tarefa existe", "| Quem | O que paga |". Quem abre a
   tarefa para saber o que fazer tem que decifrar antes de ler.

   Das 209 descrições que vieram do ClickUp, 182 usam negrito, 149 têm
   título, 147 têm lista, 130 têm caixa de marcar e 52 têm tabela. Ou
   seja: quase todas. Então a descrição passa a ser desenhada, e a caixa
   de texto continua ali, escondida, para quem quiser editar — e é ela
   que o app continua lendo na hora de salvar, como sempre leu.
   ====================================================================== */
(function () {
  'use strict';

  const esc = (t) => String(t ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  /* ---------- o que acontece dentro de uma linha ----------
     A ordem importa: primeiro escapo o que é HTML, depois tiro os
     trechos de código da frente — senão um asterisco dentro de `código`
     viraria negrito — e só então negrito, itálico e link. */
  const MARCA = '\u0000';

  function dentro(t) {
    const codigos = [];
    let s = esc(t).replace(/`([^`]+)`/g, (_, c) => {
      codigos.push(c); return MARCA + (codigos.length - 1) + MARCA;
    });

    s = s
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
        (_, txt, url) => '<a href="' + url + '" target="_blank" rel="noopener">' + txt + '</a>')
      .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g,
        (_, antes, url) => antes + '<a href="' + url + '" target="_blank" rel="noopener">' + url + '</a>')
      .replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
      .replace(/(^|[^_\w])_([^_\n]+)_(?!_)/g, '$1<em>$2</em>')
      .replace(/~~([^~]+)~~/g, '<del>$1</del>');

    return s.replace(new RegExp(MARCA + '(\\d+)' + MARCA, 'g'),
      (_, i) => '<code>' + esc(codigos[+i]) + '</code>');
  }

  const CAIXA  = /^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/;
  const ITEM   = /^(\s*)[-*+]\s+(.*)$/;
  const NUM    = /^(\s*)(\d+)[.)]\s+(.*)$/;
  const TITULO = /^(#{1,6})\s+(.*)$/;
  const CITA   = /^\s*>\s?(.*)$/;
  const REGUA  = /^\s*(?:[-*_]\s*){3,}$/;
  const TABELA = /^\s*\|(.+)\|\s*$/;
  const SEPARA = /^\s*\|?[\s:|-]+\|[\s:|-]*$/;

  const celulas = (l) => l.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());

  /* ---------- o texto inteiro ---------- */
  function desenhar(md) {
    const linhas = String(md || '').replace(/\r\n?/g, '\n').split('\n');
    const saida = [];
    let i = 0;

    while (i < linhas.length) {
      const l = linhas[i];

      /* bloco de código cercado */
      if (/^\s*```/.test(l)) {
        const corpo = [];
        i++;
        while (i < linhas.length && !/^\s*```/.test(linhas[i])) corpo.push(linhas[i++]);
        i++;
        saida.push('<pre><code>' + esc(corpo.join('\n')) + '</code></pre>');
        continue;
      }

      if (!l.trim()) { i++; continue }

      if (REGUA.test(l) && !ITEM.test(l)) { saida.push('<hr>'); i++; continue }

      const t = l.match(TITULO);
      if (t) {
        const n = Math.min(6, t[1].length);
        saida.push('<h' + n + '>' + dentro(t[2]) + '</h' + n + '>');
        i++; continue;
      }

      /* tabela: cabeçalho, separador, e o resto até acabar */
      if (TABELA.test(l) && i + 1 < linhas.length && SEPARA.test(linhas[i + 1])) {
        const cab = celulas(l);
        i += 2;
        const corpo = [];
        while (i < linhas.length && TABELA.test(linhas[i])) corpo.push(celulas(linhas[i++]));
        saida.push('<div class="ds-tabela"><table><thead><tr>' +
          cab.map((c) => '<th>' + dentro(c) + '</th>').join('') +
          '</tr></thead><tbody>' +
          corpo.map((r) => '<tr>' + cab.map((_, k) => '<td>' + dentro(r[k] || '') + '</td>').join('') + '</tr>').join('') +
          '</tbody></table></div>');
        continue;
      }

      /* citação: junta as linhas seguidas e desenha o que há dentro */
      if (CITA.test(l)) {
        const corpo = [];
        while (i < linhas.length && CITA.test(linhas[i])) corpo.push(linhas[i++].match(CITA)[1]);
        saida.push('<blockquote>' + desenhar(corpo.join('\n')) + '</blockquote>');
        continue;
      }

      /* lista de caixas: isto é texto, não é o checklist da tarefa —
         então o estado aparece, mas não se clica. Quem confere de
         verdade é a Conferência, ali em cima. */
      if (CAIXA.test(l)) {
        const itens = [];
        while (i < linhas.length && CAIXA.test(linhas[i])) {
          const m = linhas[i++].match(CAIXA);
          itens.push('<li class="' + (m[1].toLowerCase() === 'x' ? 'feito' : '') + '">' + dentro(m[2]) + '</li>');
        }
        saida.push('<ul class="ds-caixas">' + itens.join('') + '</ul>');
        continue;
      }

      if (NUM.test(l)) { saida.push(lista(linhas, i, 'ol')); i = lista.fim; continue }
      if (ITEM.test(l)) { saida.push(lista(linhas, i, 'ul')); i = lista.fim; continue }

      /* parágrafo: as linhas seguidas até a branca ou o próximo bloco */
      const corpo = [];
      while (i < linhas.length && linhas[i].trim() && !TITULO.test(linhas[i]) &&
             !CITA.test(linhas[i]) && !ITEM.test(linhas[i]) && !NUM.test(linhas[i]) &&
             !REGUA.test(linhas[i]) && !TABELA.test(linhas[i]) && !/^\s*```/.test(linhas[i]))
        corpo.push(linhas[i++]);
      if (corpo.length) saida.push('<p>' + corpo.map(dentro).join('<br>') + '</p>');
      else i++;
    }

    return saida.join('');
  }

  /* Lista com um nível de recuo. Guarda onde parou em `lista.fim` porque
     precisa devolver duas coisas e o laço de cima só lê uma. */
  function lista(linhas, i, tag) {
    const re = tag === 'ol' ? NUM : ITEM;
    const texto = (m) => (tag === 'ol' ? m[3] : m[2]);
    const raiz = (linhas[i].match(re) || [])[1].length;
    const itens = [];
    let ultimo = -1;

    while (i < linhas.length) {
      if (tag === 'ul' && CAIXA.test(linhas[i])) break;
      const m = linhas[i].match(re);
      if (!m) break;
      if (m[1].length > raiz && ultimo >= 0) {
        const filhos = [];
        while (i < linhas.length) {
          const f = linhas[i].match(re);
          if (!f || f[1].length <= raiz) break;
          filhos.push('<li>' + dentro(texto(f)) + '</li>');
          i++;
        }
        itens[ultimo] += '<' + tag + '>' + filhos.join('') + '</' + tag + '>';
        continue;
      }
      itens.push('<li>' + dentro(texto(m)));
      ultimo = itens.length - 1;
      i++;
    }
    lista.fim = i;
    return '<' + tag + '>' + itens.map((x) => x + '</li>').join('') + '</' + tag + '>';
  }

  /* ---------- a mesma descrição, em uma linha ----------
     A lista de tarefas mostra o começo da descrição embaixo do título, e
     ali cabe uma linha só. Sem isto, a linha começa com "> ⚠️ **TAREFA
     RECORRENTE" e não se lê nada. */
  function resumo(md) {
    return String(md || '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/^\s*\|.*\|\s*$/gm, ' ')
      .replace(/^\s*#{1,6}\s+/gm, '')
      .replace(/^\s*>\s?/gm, '')
      .replace(/^\s*[-*+]\s+\[[ xX]\]\s+/gm, '')
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/^\s*\d+[.)]\s+/gm, '')
      .replace(/^\s*(?:[-*_]\s*){3,}$/gm, ' ')
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[*_~`]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* Uma linha só é reescrita quando o resumo difere do que está lá — e a
     marca guarda o original, para não resumir o resumo na volta. */
  function linhasDaLista() {
    for (const el of document.querySelectorAll('.cu-titletext small, .cu-week-card p')) {
      const bruto = el.dataset.dsBruto ?? el.textContent;
      const limpo = resumo(bruto);
      if (limpo === bruto) continue;
      el.dataset.dsBruto = bruto;
      if (el.textContent !== limpo) el.textContent = limpo;
    }
  }

  /* ====================================================================
     Trocar a caixa de texto pelo texto desenhado
     ==================================================================== */

  function tomar() {
    const area = document.getElementById('detailDescription');
    if (!area) return;

    const md = area.value || '';
    let vista = document.getElementById('descricaoLida');

    if (!vista) {
      vista = document.createElement('div');
      vista.id = 'descricaoLida';
      vista.className = 'ds';
      area.insertAdjacentElement('afterend', vista);
    }
    if (!area.closest('.tsection')?.querySelector('.ds-editar')) {
      const bt = document.createElement('button');
      bt.type = 'button';
      bt.className = 'ds-editar';
      bt.textContent = 'editar';
      area.closest('.tsection')?.querySelector('.tsection-head')?.appendChild(bt);
    }

    /* Não redesenho o que já está desenhado: a ficha é refeita a cada
       clique, e redesenhar sempre jogaria fora a rolagem de quem lê. */
    if (vista.dataset.md !== md) {
      vista.dataset.md = md;
      vista.innerHTML = md.trim() ? desenhar(md)
        : '<p class="ds-vazio">Sem descrição. O briefing desta tarefa ainda não foi escrito no ClickUp.</p>';
    }

    if (!area.hidden && vista.hidden !== true) area.hidden = true;
  }

  function editando(sim) {
    const area = document.getElementById('detailDescription');
    const vista = document.getElementById('descricaoLida');
    const bt = document.querySelector('.ds-editar');
    if (!area || !vista) return;
    area.hidden = !sim;
    vista.hidden = sim;
    if (bt) bt.textContent = sim ? 'pronto' : 'editar';
    if (sim) { area.focus(); area.selectionStart = area.selectionEnd = area.value.length }
    else { vista.dataset.md = null; tomar() }
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest?.('.ds-editar')) return;
    e.preventDefault();
    editando(document.getElementById('detailDescription')?.hidden !== false);
  });

  /* ---------- repor o que o app refaz ---------- */
  let pedido = 0;
  const redesenhar = () => {
    cancelAnimationFrame(pedido);
    pedido = requestAnimationFrame(() => { tomar(); linhasDaLista() });
  };

  const olho = new MutationObserver(redesenhar);
  function ligar() {
    olho.observe(document.body, { childList: true, subtree: true });
    redesenhar();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ligar);
  else ligar();

  window.Descricao = { desenhar, dentro, resumo };
})();
