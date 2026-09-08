/* ======================================================================
   Mapa mental — o motor do planejador, trazido para a Central.

   O que existia aqui era um esboço: nós posicionados na mão, edição por
   prompt(), sem zoom ancorado, sem desfazer, sem notas nem formas. O que
   o Vitor usa no planejador é outra coisa, e é isso que está aqui.

   Duas naturezas no mesmo canvas, e essa é a ideia central:

   1. Uma árvore que se arruma sozinha. Os nós têm pai e filho, e quem
      decide onde cada um fica é o algoritmo — ninguém arruma árvore na
      mão.
   2. Um quadro livre. Notas adesivas, formas e textos ficam exatamente
      onde foram largados, e o layout nunca encosta neles.

   Guardado em central.planning.map.<pessoa>, que é a mesma chave de
   antes. Como ela passa pela ponte do Supabase, o mapa é da equipe: o
   Pedro mexe e a Sarah vê.
   ====================================================================== */
(function () {
  'use strict';

  /* ---------- medidas ---------- */
  const MUNDO_W = 9000, MUNDO_H = 6000, RAIZ_X = 4500, RAIZ_Y = 3000;
  const FOLGA_V = 16, FOLGA_H = 64, ALT_PADRAO = 44, LARG_PADRAO = 190;
  const Z_MIN = 0.08, Z_MAX = 4, PILHA_MAX = 60;

  /* Cores de ramo: continuam variadas porque é por elas que se distingue
     um galho do outro num mapa grande, mas puxadas para baixo em saturação
     para conviverem com o cinza-quente do resto do sistema. */
  const RAMOS = ['#7a6cc4','#c25a4a','#c98548','#c9a227','#2f8f74','#b06596','#3d7fb8','#8a5aa8'];
  const NOTAS = ['#fbf3bd','#dcecc4','#c8dced','#f3d4de','#f6dfc0','#dcd6f2','#ffffff'];
  const FUNDOS = [undefined,'#eef5e4','#fbf3bd','#f8e2e8','#e3edf6'];

  /* ---------- estado ---------- */
  let M = null;                 // o mapa carregado
  let sel = { t: null, id: null };
  let fer = 'sel', formaAtual = 'ret';
  let Z = 1, PX = 0, PY = 0;
  let editando = false, termo = '';
  let pilha = [], pilhaR = [], medidas = {};
  let cerca, mundo, fios, grade, paleta, menu, elPc;
  let ligadoAoDocumento = false, jaEnquadrou = false, olhoDeTamanho = null;

  const chave = () => {
    /* o app guarda o usuário num objeto global; se ele mudar de nome, a
       chave acompanha em vez de quebrar calada */
    const id = (window.user && window.user.id) || 'vitor-gutierrez';
    return `central.planning.map.${id}`;
  };

  /* ================= dados ================= */
  function mapaNovo() {
    return { v: 2, layout: 'direita', prox: 2, proxItem: 1, itens: [],
      nos: [{ id: 1, pai: null, t: 'Planejamento', cor: 0, x: RAIZ_X, y: RAIZ_Y }] };
  }

  /* O esboço antigo guardava um array cru de {id,parent,title,subtitle}.
     Jogar fora seria apagar trabalho de alguém, então ele é convertido. */
  function converter(velho) {
    const m = mapaNovo();
    if (!Array.isArray(velho) || !velho.length) return m;
    const mapaId = new Map();
    let prox = 1;
    velho.forEach((n) => mapaId.set(n.id, prox++));
    m.nos = velho.map((n) => ({
      id: mapaId.get(n.id),
      pai: n.parent != null && mapaId.has(n.parent) ? mapaId.get(n.parent) : null,
      t: [n.title, n.subtitle].filter(Boolean).join(' — ') || 'sem título',
      x: RAIZ_X, y: RAIZ_Y,
    }));
    /* mais de uma raiz não desenha árvore: as sobrando viram filhas da primeira */
    const raizes = m.nos.filter((n) => !n.pai);
    if (raizes.length > 1) raizes.slice(1).forEach((n) => { n.pai = raizes[0].id });
    if (!m.nos.some((n) => !n.pai) && m.nos.length) m.nos[0].pai = null;
    m.prox = prox;
    return m;
  }

  function carregar() {
    let cru = null;
    try { cru = JSON.parse(localStorage.getItem(chave()) || 'null'); } catch { /* nasce novo */ }
    if (!cru) return mapaNovo();
    if (Array.isArray(cru)) return converter(cru);
    if (!cru.nos || !cru.nos.length) return mapaNovo();
    cru.itens = cru.itens || []; cru.prox = cru.prox || 2; cru.proxItem = cru.proxItem || 1;
    cru.layout = cru.layout || 'direita';
    return cru;
  }
  const salvar = () => { try { localStorage.setItem(chave(), JSON.stringify(M)) } catch (e) { console.error('[mapa]', e) } };

  /* ================= árvore ================= */
  const nos = () => M.nos;
  const itens = () => M.itens;
  const acharNo = (id) => M.nos.find((n) => n.id === id);
  const acharItem = (id) => M.itens.find((i) => i.id === id);
  const alvoSel = () => sel.t === 'no' ? acharNo(sel.id) : sel.t === 'item' ? acharItem(sel.id) : null;
  const filhos = (id) => M.nos.filter((n) => n.pai === id);
  const raiz = () => M.nos.find((n) => !n.pai);

  /* Toda subida na árvore tem trava de profundidade: um dado torto com
     ciclo pai→filho travaria o navegador em vez de só desenhar errado. */
  function nivel(n) { let k = 0, p = n.pai, g = 0; while (p && g++ < 80) { k++; p = acharNo(p)?.pai } return k }
  function ramoCor(n) { let a = n, g = 0; while (a && a.cor === undefined && g++ < 80) a = acharNo(a.pai); return RAMOS[(a?.cor) || 0] }
  function descendentes(id) { let c = 0; filhos(id).forEach((f) => { c += 1 + descendentes(f.id) }); return c }
  function ehDesc(id, p) { let x = acharNo(p)?.pai, g = 0; while (x && g++ < 80) { if (x === id) return true; x = acharNo(x)?.pai } return false }
  function visivel(n) { let p = n.pai, g = 0; while (p && g++ < 80) { const a = acharNo(p); if (!a) break; if (a.fech) return false; p = a.pai } return true }
  function lado(n) { const r = raiz(); if (!r || n.id === r.id) return 1; let a = n, g = 0; while (a.pai && a.pai !== r.id && g++ < 80) a = acharNo(a.pai) || a; return (a.x ?? 0) < (r.x ?? 0) ? -1 : 1 }

  /* ================= desfazer ================= */
  function guardar() { pilha.push(JSON.stringify(M)); if (pilha.length > PILHA_MAX) pilha.shift(); pilhaR = []; hist() }
  function desfazer() { if (!pilha.length) return; pilhaR.push(JSON.stringify(M)); M = JSON.parse(pilha.pop()); if (!alvoSel()) sel = { t: 'no', id: raiz()?.id ?? null }; organizar({ enquadrar: false }); salvar(); hist() }
  function refazer() { if (!pilhaR.length) return; pilha.push(JSON.stringify(M)); M = JSON.parse(pilhaR.pop()); if (!alvoSel()) sel = { t: 'no', id: raiz()?.id ?? null }; organizar({ enquadrar: false }); salvar(); hist() }
  function hist() {
    const u = cerca.querySelector('[data-mp="undo"]'), r = cerca.querySelector('[data-mp="redo"]');
    if (u) u.disabled = !pilha.length;
    if (r) r.disabled = !pilhaR.length;
  }

  /* ================= arranjo ================= */
  /* As distâncias vêm da medida real de cada nó. Com valores fixos, um nó
     de três linhas passa da altura reservada e os vizinhos se empilham; e
     uma distância menor que a largura de dois nós faz o filho voltar por
     cima do pai. Zero não é medida — página escondida mede zero, e nesse
     caso vale o padrão. */
  const altDe = (n) => (medidas[n.id]?.h || ALT_PADRAO) + FOLGA_V;
  const largDe = (n) => (medidas[n.id]?.w || LARG_PADRAO);

  function alturaRamo(id) {
    const a = acharNo(id); if (!a) return ALT_PADRAO + FOLGA_V;
    const f = a.fech ? [] : filhos(id);
    if (!f.length) return altDe(a);
    return Math.max(altDe(a), f.reduce((t, c) => t + alturaRamo(c.id), 0));
  }

  function espalhar(pai, lista, s) {
    const tot = lista.reduce((t, n) => t + alturaRamo(n.id), 0);
    let y = pai.y - tot / 2;
    for (const n of lista) {
      const h = alturaRamo(n.id);
      n.x = pai.x + s * (largDe(pai) / 2 + largDe(n) / 2 + FOLGA_H);
      n.y = y + h / 2; y += h;
      if (!n.fech) espalhar(n, filhos(n.id), s);
    }
  }

  function calcular() {
    const r = raiz(); if (!r) return false;
    r.x = RAIZ_X; r.y = RAIZ_Y;
    const n1 = filhos(r.id);
    if (M.layout === 'radial') {
      espalhar(r, n1.filter((_, i) => i % 2 === 0), 1);
      espalhar(r, n1.filter((_, i) => i % 2 === 1), -1);
    } else espalhar(r, n1, 1);
    return true;
  }

  /* Duas passadas: a primeira arruma com as medidas que houver, a segunda
     refaz depois que o navegador mediu os nós de verdade. Sem ela, um nó
     recém-criado entra na conta com a altura padrão e desencontra tudo à
     volta. Na segunda só mexo em left/top — recriar o DOM faria o mapa
     inteiro piscar a cada clique. */
  function organizar(op) {
    const enquadrar = !op || op.enquadrar !== false;
    if (!calcular()) return;
    desenhar();
    requestAnimationFrame(() => {
      medir();
      if (calcular()) {
        mundo.querySelectorAll('.mp-no').forEach((e) => {
          const n = acharNo(+e.dataset.id); if (!n) return;
          e.style.left = n.x + 'px'; e.style.top = n.y + 'px';
        });
        linhas();
        if (enquadrar) enquadrarTudo();
        porPaleta();
      }
    });
  }
  function medir() {
    mundo.querySelectorAll('.mp-no').forEach((e) => {
      const w = e.offsetWidth, h = e.offsetHeight;
      if (w && h) medidas[e.dataset.id] = { w, h };
    });
  }

  /* ================= câmera ================= */
  function transformar() {
    mundo.style.transform = `translate(${PX}px,${PY}px) scale(${Z})`;
    elPc.textContent = Math.round(Z * 100) + '%';
    const p = 24 * Z;
    grade.style.backgroundSize = `${p}px ${p}px`;
    grade.style.backgroundPosition = `${PX % p}px ${PY % p}px`;
    porPaleta();
  }
  /* O ponto embaixo do cursor não pode se mexer: é o que faz o zoom
     parecer que a pessoa está chegando perto, e não que a tela fugiu. */
  function zoomEm(f, cx, cy) {
    const r = cerca.getBoundingClientRect();
    cx = cx ?? r.width / 2; cy = cy ?? r.height / 2;
    const novo = Math.min(Z_MAX, Math.max(Z_MIN, Z * f));
    if (novo === Z) return;
    const wx = (cx - PX) / Z, wy = (cy - PY) / Z;
    Z = novo; PX = cx - wx * Z; PY = cy - wy * Z;
    transformar();
  }
  function enquadrarTudo() {
    const pts = [...nos().filter(visivel), ...itens()];
    if (!pts.length) return;
    /* Aba escondida mede zero, e a essa altura enquadrar não significa
       nada: sem isto o mapa ficava com a câmera na origem e os nós lá
       pelas coordenadas de mundo, longe da vista. Quem chama de novo é o
       observador de tamanho, assim que a aba aparece. */
    if (!cerca.clientWidth || !cerca.clientHeight) return;
    const xs = pts.map((n) => n.x ?? RAIZ_X), ys = pts.map((n) => n.y ?? RAIZ_Y);
    /* folga maior à direita: é para lá que os nós crescem */
    const x1 = Math.min(...xs) - 230, x2 = Math.max(...xs) + 290;
    const y1 = Math.min(...ys) - 150, y2 = Math.max(...ys) + 150;
    const w = cerca.clientWidth, h = cerca.clientHeight; if (!w || !h) return;
    Z = Math.min(1.4, Math.max(Z_MIN, Math.min(w / (x2 - x1), h / (y2 - y1)) * 0.92));
    PX = w / 2 - ((x1 + x2) / 2) * Z; PY = h / 2 - ((y1 + y2) / 2) * Z;
    jaEnquadrou = true;
    transformar();
  }
  function centrarNoSel() {
    const n = alvoSel(); if (!n) return enquadrarTudo();
    PX = cerca.clientWidth / 2 - n.x * Z; PY = cerca.clientHeight / 2 - n.y * Z;
    transformar();
  }

  /* ================= desenho ================= */
  function linhas() {
    let s = '';
    for (const n of nos()) {
      if (!n.pai || !visivel(n)) continue;
      const p = acharNo(n.pai); if (!p) continue;
      const mp = medidas[p.id] || { w: 120 }, mn = medidas[n.id] || { w: 120 };
      const dir = n.x >= p.x ? 1 : -1;
      const x1 = p.x + dir * (mp.w / 2), x2 = n.x - dir * (mn.w / 2);
      const d = Math.max(28, Math.abs(x2 - x1) * 0.5);
      s += `<path d="M${x1} ${p.y} C${x1 + dir * d} ${p.y}, ${x2 - dir * d} ${n.y}, ${x2} ${n.y}"`
        + ` fill="none" stroke="${ramoCor(n)}" stroke-width="${nivel(n) === 1 ? 2.2 : 1.5}"`
        + ` stroke-linecap="round" opacity="${n.feito ? 0.26 : 0.9}"/>`;
    }
    fios.innerHTML = s;
  }

  function botao(cls, txt, titulo, aoClicar) {
    const b = document.createElement('button');
    b.className = cls; b.textContent = txt; if (titulo) b.title = titulo;
    b.onpointerdown = (e) => e.stopPropagation();
    b.onclick = (e) => { e.stopPropagation(); aoClicar() };
    return b;
  }

  function desenhar() {
    mundo.querySelectorAll('.mp-el').forEach((e) => e.remove());

    for (const n of nos()) {
      if (!visivel(n)) continue;
      if (n.x === undefined) { n.x = RAIZ_X; n.y = RAIZ_Y }
      const d = document.createElement('div');
      const temSelo = !!(n.nota || n.feito);
      d.className = 'mp-el mp-no' + (nivel(n) === 0 ? ' mp-raiz' : '')
        + (n.feito ? ' mp-feito' : '') + (temSelo ? ' mp-comselo' : '')
        + (sel.t === 'no' && sel.id === n.id ? ' mp-sel' : '');
      if (termo) d.classList.add(n.t.toLowerCase().includes(termo) ? 'mp-achado' : 'mp-apagado');
      d.dataset.id = n.id; d.dataset.tipo = 'no';
      d.style.left = n.x + 'px'; d.style.top = n.y + 'px';
      d.style.borderColor = ramoCor(n);
      if (n.fundo) d.style.background = n.fundo;

      if (n.feito) { const o = document.createElement('span'); o.className = 'mp-ok'; o.textContent = '✓'; d.appendChild(o) }
      const t = document.createElement('span'); t.className = 'mp-txt'; t.textContent = n.t; d.appendChild(t);
      if (n.nota) { const b = document.createElement('span'); b.className = 'mp-selo'; b.textContent = 'nota'; b.title = n.nota; d.appendChild(b) }

      const s = lado(n) > 0 ? 'mp-dir' : 'mp-esq';
      if (filhos(n.id).length) {
        d.appendChild(botao('mp-fecho ' + s, n.fech ? String(descendentes(n.id)) : '–',
          n.fech ? 'Abrir o ramo' : 'Fechar o ramo',
          () => { guardar(); n.fech = !n.fech; organizar({ enquadrar: false }); salvar() }));
      }
      d.appendChild(botao('mp-mais ' + s, '+', 'Novo filho',
        () => { sel = { t: 'no', id: n.id }; novoFilho() }));

      ligar(d, n, 'no'); mundo.appendChild(d);
    }

    for (const it of itens()) {
      const d = document.createElement('div');
      d.className = 'mp-el mp-' + it.tipo + (it.forma ? ' mp-' + it.forma : '')
        + (sel.t === 'item' && sel.id === it.id ? ' mp-sel' : '');
      if (termo) d.classList.add((it.t || '').toLowerCase().includes(termo) ? 'mp-achado' : 'mp-apagado');
      d.dataset.id = it.id; d.dataset.tipo = 'item';
      d.style.left = it.x + 'px'; d.style.top = it.y + 'px';
      if (it.tipo === 'nota') d.style.background = it.cor || NOTAS[0];
      if (it.tipo === 'forma') d.style.borderColor = it.cor || RAMOS[0];
      if (it.tipo === 'texto') d.style.color = it.cor || '#151718';
      const t = document.createElement('span'); t.className = 'mp-txt'; t.textContent = it.t || '';
      d.appendChild(t); ligar(d, it, 'item'); mundo.appendChild(d);
    }

    requestAnimationFrame(() => { medir(); linhas(); porPaleta() });
    hist();
  }

  /* ================= arrastar, selecionar, reparentar ================= */
  function ligar(el, obj, tipo) {
    el.addEventListener('pointerdown', (e) => {
      if (editando || e.button === 2) return;
      e.stopPropagation(); fecharMenu();
      sel = { t: tipo, id: obj.id }; marcarSel();
      const x0 = e.clientX, y0 = e.clientY, ox = obj.x, oy = obj.y;
      let moveu = false, alvo = null;
      el.setPointerCapture(e.pointerId);
      const mover = (ev) => {
        const dx = (ev.clientX - x0) / Z, dy = (ev.clientY - y0) / Z;
        /* só vira arrasto depois de três pixels, e é aí que o desfazer é
           empilhado: senão cada clique simples sujava o histórico */
        if (!moveu && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) { guardar(); moveu = true }
        if (!moveu) return;
        obj.x = ox + dx; obj.y = oy + dy;
        el.style.left = obj.x + 'px'; el.style.top = obj.y + 'px';
        if (tipo === 'no') linhas();
        if (tipo === 'no' && obj.pai) {
          el.style.pointerEvents = 'none';
          const sob = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.mp-no');
          el.style.pointerEvents = '';
          const id = sob ? +sob.dataset.id : null;
          /* soltar um pai dentro do próprio filho cria ciclo e trava a
             árvore — por isso a checagem de descendência */
          const ok = id && id !== obj.id && id !== obj.pai && !ehDesc(obj.id, id);
          if (alvo && alvo !== sob) alvo.classList.remove('mp-alvo');
          alvo = ok ? sob : null;
          if (alvo) alvo.classList.add('mp-alvo');
        }
        porPaleta();
      };
      const soltar = () => {
        el.removeEventListener('pointermove', mover);
        try { el.releasePointerCapture(e.pointerId) } catch { /* já solto */ }
        if (alvo) {
          const nv = +alvo.dataset.id; alvo.classList.remove('mp-alvo');
          obj.pai = nv; const p = acharNo(nv); if (p && p.fech) p.fech = false;
          organizar({ enquadrar: false });
        } else if (moveu && tipo === 'no') { medir(); linhas() }
        if (moveu) salvar();
        porPaleta();
      };
      el.addEventListener('pointermove', mover);
      el.addEventListener('pointerup', soltar, { once: true });
      el.addEventListener('pointercancel', soltar, { once: true });
    });
    el.addEventListener('dblclick', (e) => { e.stopPropagation(); sel = { t: tipo, id: obj.id }; editar() });
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault(); e.stopPropagation();
      sel = { t: tipo, id: obj.id }; marcarSel(); abrirMenu(e.clientX, e.clientY);
    });
  }
  function marcarSel() {
    mundo.querySelectorAll('.mp-el').forEach((e) =>
      e.classList.toggle('mp-sel', e.dataset.tipo === sel.t && +e.dataset.id === sel.id));
    porPaleta();
  }

  /* ================= edição de texto ================= */
  function editar(novo) {
    const el = mundo.querySelector(`.mp-el[data-tipo="${sel.t}"][data-id="${sel.id}"]`);
    if (!el) return;
    const obj = alvoSel(), c = el.querySelector('.mp-txt');
    if (!obj || !c) return;
    if (!novo) guardar();
    editando = true;
    c.setAttribute('contenteditable', 'true'); c.focus();
    const r = document.createRange(); r.selectNodeContents(c);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    const fim = () => {
      if (!editando) return;
      editando = false;
      obj.t = c.textContent.trim() || (sel.t === 'no' ? 'sem título' : '');
      c.removeAttribute('contenteditable');
      organizar({ enquadrar: false }); salvar();
    };
    c.onblur = fim;
    c.onkeydown = (e) => {
      e.stopPropagation();
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); c.blur() }
      if (e.key === 'Escape') { e.preventDefault(); c.textContent = obj.t; c.blur() }
    };
  }

  /* ================= criar e apagar ================= */
  function criarEm(tipo, x, y) {
    guardar();
    if (tipo === 'no') {
      const r = raiz();
      const n = { id: M.prox++, pai: r?.id ?? null, t: 'novo', x, y };
      nos().push(n); sel = { t: 'no', id: n.id };
    } else {
      const it = { id: M.proxItem++, tipo, x, y, t: tipo === 'texto' ? 'Texto' : '' };
      if (tipo === 'nota') it.cor = NOTAS[0];
      if (tipo === 'forma') { it.forma = formaAtual; it.cor = RAMOS[0] }
      itens().push(it); sel = { t: 'item', id: it.id };
    }
    ferramenta('sel'); desenhar(); salvar();
    setTimeout(() => editar(true), 30);
  }
  function novoFilho() {
    const p = sel.t === 'no' ? acharNo(sel.id) : null; if (!p) return;
    guardar(); if (p.fech) p.fech = false;
    const n = { id: M.prox++, pai: p.id, t: 'novo', x: p.x, y: p.y };
    nos().push(n); sel = { t: 'no', id: n.id };
    organizar({ enquadrar: false }); salvar();
    /* editar(true) = "é novo, não empilhe outro desfazer": criar o nó e
       escrever o nome são uma ação só para quem está usando */
    setTimeout(() => editar(true), 20);
  }
  function novoIrmao() {
    if (sel.t !== 'no') return;
    const a = acharNo(sel.id); if (!a) return;
    if (!a.pai) return novoFilho();
    guardar();
    const n = { id: M.prox++, pai: a.pai, t: 'novo', x: a.x, y: a.y };
    nos().splice(nos().indexOf(a) + 1, 0, n);   // a ordem do array é a ordem dos irmãos
    sel = { t: 'no', id: n.id };
    organizar({ enquadrar: false }); salvar(); setTimeout(() => editar(true), 20);
  }
  function apagar() {
    if (sel.t === 'item') {
      guardar(); M.itens = itens().filter((x) => x.id !== sel.id);
      sel = { t: null, id: null }; desenhar(); salvar(); return;
    }
    if (sel.t !== 'no') return;
    const a = acharNo(sel.id); if (!a) return;
    if (!a.pai) return aviso('A raiz do mapa não pode ser excluída.');
    const d = descendentes(sel.id);
    if (d && !confirm(`Excluir "${a.t}" e mais ${d} ${d > 1 ? 'nós' : 'nó'} abaixo?`)) return;
    guardar();
    const rem = (id) => { filhos(id).forEach((f) => rem(f.id)); M.nos = M.nos.filter((x) => x.id !== id) };
    rem(sel.id); sel = { t: 'no', id: a.pai };
    organizar({ enquadrar: false }); salvar();
  }
  function duplicarRamo() {
    if (sel.t !== 'no') return;
    const a = acharNo(sel.id); if (!a || !a.pai) return;
    guardar();
    const cop = (o, np) => {
      const n = { ...JSON.parse(JSON.stringify(o)), id: M.prox++, pai: np };
      nos().push(n); filhos(o.id).forEach((f) => cop(f, n.id)); return n;
    };
    sel = { t: 'no', id: cop(a, a.pai).id };
    organizar({ enquadrar: false }); salvar();
  }
  function moverIrmao(dir) {
    if (sel.t !== 'no') return;
    const a = acharNo(sel.id); if (!a || !a.pai) return;
    const irm = filhos(a.pai), i = irm.indexOf(a), j = i + dir;
    if (j < 0 || j >= irm.length) return;
    guardar();
    const ia = nos().indexOf(a), ib = nos().indexOf(irm[j]);
    nos().splice(ia, 1); nos().splice(ib, 0, a);
    organizar({ enquadrar: false }); salvar();
  }

  /* ================= aparência do selecionado ================= */
  function corRamo(i) { const n = alvoSel(); if (!n || sel.t !== 'no') return; guardar(); n.cor = i; desenhar(); salvar() }
  function corItem(c) { const o = alvoSel(); if (!o) return; guardar(); o.cor = c; desenhar(); salvar() }
  function tipoForma(f) { const o = alvoSel(); if (!o) return; guardar(); o.forma = f; desenhar(); salvar() }
  function destaque() {
    const n = alvoSel(); if (!n || sel.t !== 'no') return; guardar();
    n.fundo = FUNDOS[(FUNDOS.indexOf(n.fundo) + 1) % FUNDOS.length];
    if (!n.fundo) delete n.fundo;
    desenhar(); salvar();
  }
  function marcarFeito() { const n = alvoSel(); if (!n || sel.t !== 'no') return; guardar(); n.feito = !n.feito; desenhar(); salvar() }
  function editarNota() {
    const n = alvoSel(); if (!n || sel.t !== 'no') return;
    const v = prompt('Nota desta ideia', n.nota || '');
    if (v === null) return;
    guardar(); if (v.trim()) n.nota = v.trim(); else delete n.nota;
    organizar({ enquadrar: false }); salvar();
  }

  /* ================= paleta flutuante ================= */
  function porPaleta() {
    const obj = alvoSel();
    if (!obj || !sel.t) return paleta.classList.remove('mp-on');
    if (sel.t === 'no' && !visivel(obj)) return paleta.classList.remove('mp-on');
    const el = mundo.querySelector(`.mp-el[data-tipo="${sel.t}"][data-id="${sel.id}"]`);
    if (!el) return paleta.classList.remove('mp-on');
    pintarPaleta(); paleta.classList.add('mp-on');
    const q = cerca.getBoundingClientRect(), r = el.getBoundingClientRect();
    const x = r.left - q.left + r.width / 2 - paleta.offsetWidth / 2;
    let y = r.top - q.top - paleta.offsetHeight - 11;
    if (y < 8) y = r.bottom - q.top + 11;       // não coube em cima, vai embaixo
    paleta.style.left = Math.max(8, Math.min(x, q.width - paleta.offsetWidth - 8)) + 'px';
    paleta.style.top = y + 'px';
  }
  function pintarPaleta() {
    paleta.innerHTML = '';
    const risco = () => { const s = document.createElement('span'); s.className = 'mp-risco'; return s };
    const bolinha = (cor, aoClicar, titulo) => {
      const b = document.createElement('button'); b.title = titulo || 'cor';
      const s = document.createElement('span'); s.className = 'mp-cor'; s.style.background = cor;
      b.appendChild(s); b.onpointerdown = (e) => e.stopPropagation();
      b.onclick = (e) => { e.stopPropagation(); aoClicar() }; return b;
    };
    const obj = alvoSel();
    if (sel.t === 'no') {
      RAMOS.slice(0, 6).forEach((c, i) => paleta.appendChild(bolinha(c, () => corRamo(i))));
      paleta.appendChild(risco());
      paleta.appendChild(botao('', '✦', 'Destaque', destaque));
      paleta.appendChild(botao('', '✎', 'Nota', editarNota));
      paleta.appendChild(botao('', '✓', 'Concluído', marcarFeito));
    } else if (obj?.tipo === 'nota') {
      NOTAS.forEach((c) => paleta.appendChild(bolinha(c, () => corItem(c))));
      paleta.appendChild(risco());
      paleta.appendChild(botao('', '🗑', 'Excluir', apagar));
    } else if (obj?.tipo === 'forma') {
      [['ret', '▭'], ['oval', '◯'], ['losango', '◇']].forEach(([f, s]) =>
        paleta.appendChild(botao('', s, f, () => tipoForma(f))));
      paleta.appendChild(risco());
      RAMOS.slice(0, 5).forEach((c) => paleta.appendChild(bolinha(c, () => corItem(c))));
      paleta.appendChild(risco());
      paleta.appendChild(botao('', '🗑', 'Excluir', apagar));
    } else {
      RAMOS.slice(0, 5).forEach((c) => paleta.appendChild(bolinha(c, () => corItem(c))));
      paleta.appendChild(risco());
      paleta.appendChild(botao('', '🗑', 'Excluir', apagar));
    }
  }

  /* ================= menu do botão direito ================= */
  function abrirMenu(x, y) {
    const item = (rot, atalho, aoClicar, perigo) => {
      const b = document.createElement('button');
      if (perigo) b.className = 'mp-perigo';
      b.innerHTML = `<span>${rot}</span>${atalho ? `<span class="mp-atalho">${atalho}</span>` : ''}`;
      b.onclick = () => { fecharMenu(); aoClicar() };
      return b;
    };
    menu.innerHTML = '';
    if (sel.t === 'item') {
      menu.appendChild(item('Editar texto', 'F2', () => editar()));
      menu.appendChild(document.createElement('hr'));
      menu.appendChild(item('Excluir', 'Del', apagar, true));
    } else {
      const a = acharNo(sel.id); if (!a) return;
      const ehRaiz = !a.pai, nf = filhos(a.id).length;
      menu.appendChild(item('Novo filho', 'Tab', novoFilho));
      if (!ehRaiz) menu.appendChild(item('Novo irmão', 'Enter', novoIrmao));
      menu.appendChild(item('Renomear', 'F2', () => editar()));
      menu.appendChild(document.createElement('hr'));
      menu.appendChild(item(a.nota ? 'Editar nota' : 'Adicionar nota', '', editarNota));
      menu.appendChild(item(a.feito ? 'Desmarcar concluído' : 'Marcar como concluído', '', marcarFeito));
      if (nf) menu.appendChild(item(a.fech ? 'Abrir ramo' : 'Fechar ramo', 'Espaço',
        () => { guardar(); a.fech = !a.fech; organizar({ enquadrar: false }); salvar() }));
      menu.appendChild(document.createElement('hr'));
      if (ehRaiz) {
        menu.appendChild(item('Fechar todos os ramos', '', () => fecharTudo(false)));
        menu.appendChild(item('Abrir todos os ramos', '', () => fecharTudo(true)));
        menu.appendChild(item('Alternar layout', '', trocarLayout));
        menu.appendChild(item('Reorganizar', '', () => organizar()));
      } else {
        menu.appendChild(item('Mover para cima', '', () => moverIrmao(-1)));
        menu.appendChild(item('Mover para baixo', '', () => moverIrmao(1)));
        menu.appendChild(item('Duplicar ramo', 'Ctrl+D', duplicarRamo));
        menu.appendChild(document.createElement('hr'));
        menu.appendChild(item('Excluir', 'Del', apagar, true));
      }
    }
    menu.classList.add('mp-on');
    const r = menu.getBoundingClientRect();
    menu.style.left = Math.min(x, innerWidth - r.width - 10) + 'px';
    menu.style.top = Math.min(y, innerHeight - r.height - 10) + 'px';
  }
  const fecharMenu = () => menu.classList.remove('mp-on');

  function fecharTudo(abrir) {
    guardar();
    nos().forEach((n) => { if (filhos(n.id).length && n.pai) n.fech = !abrir });
    organizar(); salvar();
  }
  function trocarLayout() { guardar(); M.layout = M.layout === 'radial' ? 'direita' : 'radial'; organizar(); salvar() }

  function buscar(v) {
    termo = v.trim().toLowerCase(); desenhar();
    if (!termo) return;
    const a = nos().find((n) => visivel(n) && n.t.toLowerCase().includes(termo));
    if (a) { sel = { t: 'no', id: a.id }; centrarNoSel(); marcarSel() }
  }
  function navegar(dir) {
    if (sel.t !== 'no') return;
    const a = acharNo(sel.id); if (!a) return;
    let al = null;
    if (dir === 'pai') al = a.pai;
    else if (dir === 'filho') {
      if (a.fech) { guardar(); a.fech = false; organizar({ enquadrar: false }); salvar() }
      al = filhos(a.id)[0]?.id;
    } else {
      const irm = a.pai ? filhos(a.pai) : [a], i = irm.indexOf(a);
      al = irm[i + (dir === 'cima' ? -1 : 1)]?.id;
    }
    if (al) { sel = { t: 'no', id: al }; marcarSel(); centrarNoSel() }
  }

  function ferramenta(f) {
    fer = f;
    cerca.querySelector('.mp-formas').classList.remove('mp-on');
    cerca.querySelectorAll('[data-fer]').forEach((b) => b.classList.toggle('mp-on', b.dataset.fer === f));
    cerca.classList.toggle('mp-criando', f !== 'sel');
  }
  function telaCheia() {
    cerca.classList.toggle('mp-cheio');
    setTimeout(enquadrarTudo, 60);
  }
  function aviso(m) { console.info('[mapa]', m); }

  /* ================= montagem ================= */
  const ICONES = {
    sel: '<path d="M5 3l14 8-6 1.6L9.6 19z"/>',
    nota: '<path d="M4 5a1 1 0 011-1h14a1 1 0 011 1v9l-6 6H5a1 1 0 01-1-1z"/><path d="M20 14h-5a1 1 0 00-1 1v5"/>',
    forma: '<rect x="3" y="4" width="8" height="7" rx="1.5"/><circle cx="18" cy="7.5" r="3.5"/><path d="M7 14l4 6H3z"/>',
    texto: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
    no: '<path d="M12 5v14M5 12h14"/>',
    undo: '<path d="M4 11h11a4.5 4.5 0 010 9h-5"/><path d="M8 7l-4 4 4 4"/>',
    redo: '<path d="M20 11H9a4.5 4.5 0 000 9h5"/><path d="M16 7l4 4-4 4"/>',
    enq: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M8.5 4.5v15M15.5 4.5v15"/>',
    cheio: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  };
  const svg = (k) => `<svg viewBox="0 0 24 24">${ICONES[k]}</svg>`;

  function montar(hospedeiro) {
    /* Não apago o conteúdo antigo: o esboço que existia aqui continua
       sendo desenhado pelo código do app, que procura #mindNodes a cada
       troca de aba. Apagando, ele quebrava com "Cannot set properties of
       null". Escondido, ele segue desenhando no vazio e não atrapalha
       ninguém. */
    [...hospedeiro.children].forEach((e) => {
      if (!e.classList.contains('mp-cerca') && !e.classList.contains('mp-dica'))
        e.style.display = 'none';
    });
    hospedeiro.querySelectorAll('.mp-cerca,.mp-dica').forEach((e) => e.remove());
    cerca = document.createElement('div');
    cerca.className = 'mp-cerca';
    cerca.innerHTML =
      '<div class="mp-grade"></div>' +
      '<div class="mp-mundo"><svg class="mp-fios"></svg></div>' +
      '<div class="mp-topo">' +
        '<input class="mp-nome" placeholder="Nome do mapa">' +
        '<input class="mp-busca" placeholder="buscar…">' +
      '</div>' +
      '<div class="mp-fer">' +
        '<div class="mp-grupo">' +
          `<button data-fer="sel" class="mp-on" title="Selecionar (V)">${svg('sel')}</button>` +
          `<button data-fer="nota" title="Nota adesiva (N)">${svg('nota')}</button>` +
          `<button data-fer="forma" title="Formas (S)">${svg('forma')}</button>` +
          `<button data-fer="texto" title="Texto (T)">${svg('texto')}</button>` +
          `<button data-fer="no" title="Novo nó solto">${svg('no')}</button>` +
        '</div>' +
        '<div class="mp-risco"></div>' +
        '<div class="mp-grupo">' +
          `<button data-mp="undo" title="Desfazer (Ctrl+Z)">${svg('undo')}</button>` +
          `<button data-mp="redo" title="Refazer (Ctrl+Shift+Z)">${svg('redo')}</button>` +
        '</div>' +
      '</div>' +
      '<div class="mp-formas"></div>' +
      '<div class="mp-paleta"></div>' +
      '<div class="mp-zoom">' +
        `<button data-mp="enq" title="Enquadrar tudo">${svg('enq')}</button>` +
        '<span class="mp-risco"></span>' +
        '<button data-mp="menos" title="Afastar">−</button>' +
        '<span class="mp-pc" title="Voltar a 100%">100%</span>' +
        '<button data-mp="mais" title="Aproximar">+</button>' +
        '<span class="mp-risco"></span>' +
        `<button data-mp="cheio" title="Tela cheia (F)">${svg('cheio')}</button>` +
      '</div>';
    hospedeiro.appendChild(cerca);

    const dica = document.createElement('p');
    dica.className = 'mp-dica';
    dica.innerHTML = '<b>Tab</b> cria filho · <b>Enter</b> cria irmão · <b>F2</b> renomeia · ' +
      '<b>Espaço</b> fecha o ramo · botão direito abre o menu · <b>F</b> tela cheia.';
    hospedeiro.appendChild(dica);

    mundo = cerca.querySelector('.mp-mundo');
    fios = cerca.querySelector('.mp-fios');
    grade = cerca.querySelector('.mp-grade');
    paleta = cerca.querySelector('.mp-paleta');
    elPc = cerca.querySelector('.mp-pc');

    menu = document.querySelector('.mp-menu');
    if (!menu) { menu = document.createElement('div'); menu.className = 'mp-menu'; document.body.appendChild(menu) }

    ligarControles();

    /* A aba de planejamento pode estar escondida quando o mapa monta, e aí
       toda medida é zero. Em vez de chutar um tempo de espera, espero o
       elemento ganhar tamanho de verdade. */
    olhoDeTamanho?.disconnect();
    olhoDeTamanho = new ResizeObserver(() => {
      if (!jaEnquadrou && cerca.clientWidth > 0) organizar();
    });
    olhoDeTamanho.observe(cerca);
  }

  function ligarControles() {
    const q = (s) => cerca.querySelector(s);

    /* Os painéis moram dentro do canvas. Sem esta saída, a captura de
       ponteiro do arrasto retarga o clique e os botões nunca disparam —
       e o retarget varia entre navegadores, então são as duas proteções:
       o painel para o evento, e o canvas ignora o que veio de dentro. */
    ['.mp-fer', '.mp-zoom', '.mp-topo', '.mp-paleta', '.mp-formas'].forEach((s) =>
      q(s)?.addEventListener('pointerdown', (e) => e.stopPropagation()));

    cerca.querySelectorAll('[data-fer]').forEach((b) => {
      b.onclick = () => { b.dataset.fer === 'forma' ? menuFormas() : ferramenta(b.dataset.fer) };
    });
    q('[data-mp="undo"]').onclick = desfazer;
    q('[data-mp="redo"]').onclick = refazer;
    q('[data-mp="enq"]').onclick = enquadrarTudo;
    q('[data-mp="menos"]').onclick = () => zoomEm(1 / 1.2);
    q('[data-mp="mais"]').onclick = () => zoomEm(1.2);
    q('[data-mp="cheio"]').onclick = telaCheia;
    elPc.onclick = () => { Z = 1; centrarNoSel() };
    q('.mp-busca').oninput = (e) => buscar(e.target.value);
    const nome = q('.mp-nome');
    nome.value = M.nome || '';
    nome.oninput = (e) => { M.nome = e.target.value; salvar() };

    cerca.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.mp-fer,.mp-zoom,.mp-topo,.mp-paleta,.mp-formas')) { fecharMenu(); return }
      if (editando) return;
      fecharMenu(); q('.mp-formas').classList.remove('mp-on');
      if (fer !== 'sel') {
        const r = cerca.getBoundingClientRect();
        criarEm(fer, (e.clientX - r.left - PX) / Z, (e.clientY - r.top - PY) / Z);
        return;
      }
      sel = { t: null, id: null }; marcarSel();
      const x0 = e.clientX, y0 = e.clientY, px = PX, py = PY;
      cerca.classList.add('mp-arrasta'); cerca.setPointerCapture(e.pointerId);
      const mover = (ev) => { PX = px + (ev.clientX - x0); PY = py + (ev.clientY - y0); transformar() };
      const soltar = () => {
        cerca.removeEventListener('pointermove', mover);
        cerca.classList.remove('mp-arrasta');
        try { cerca.releasePointerCapture(e.pointerId) } catch { /* já solto */ }
      };
      cerca.addEventListener('pointermove', mover);
      cerca.addEventListener('pointerup', soltar, { once: true });
      cerca.addEventListener('pointercancel', soltar, { once: true });
    });

    cerca.addEventListener('wheel', (e) => {
      e.preventDefault();
      let dx = e.deltaX, dy = e.deltaY;
      if (e.deltaMode === 1) { dx *= 16; dy *= 16 }   // roda em linhas, não em pixels
      if (e.ctrlKey || e.metaKey) {
        const r = cerca.getBoundingClientRect();
        zoomEm(Math.exp(-dy * 0.0035), e.clientX - r.left, e.clientY - r.top);
      } else { PX -= dx; PY -= dy; transformar() }
    }, { passive: false });

    cerca.addEventListener('contextmenu', (e) => e.preventDefault());
    /* Uma vez só. A aba é remontada pelo app a cada troca de marca, e
       registrar de novo faria um Tab criar vários filhos de uma vez. */
    if (!ligadoAoDocumento) {
      ligadoAoDocumento = true;
      document.addEventListener('pointerdown', (e) => { if (!e.target.closest('.mp-menu')) fecharMenu() });
      document.addEventListener('keydown', teclado);
      addEventListener('resize', () => { if (cerca?.isConnected) enquadrarTudo() });
    }
  }

  function menuFormas() {
    const s = cerca.querySelector('.mp-formas');
    if (s.classList.contains('mp-on')) return s.classList.remove('mp-on');
    s.innerHTML = '';
    [['ret', 'Retângulo'], ['oval', 'Oval'], ['losango', 'Losango']].forEach(([k, n]) => {
      const b = document.createElement('button'); b.textContent = n;
      b.onclick = () => { formaAtual = k; ferramenta('forma') };
      s.appendChild(b);
    });
    s.classList.add('mp-on');
    const r = cerca.querySelector('[data-fer="forma"]').getBoundingClientRect();
    const c = cerca.getBoundingClientRect();
    s.style.top = Math.max(8, r.top - c.top - 40) + 'px';
  }

  function teclado(e) {
    if (!cerca || !cerca.isConnected || editando) return;
    const a = document.activeElement;
    if (a && (a.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(a.tagName))) return;
    /* só responde quando o mapa está visível: senão o Tab da tela de
       tarefas criaria nó aqui atrás sem ninguém ver */
    if (!cerca.offsetParent && !cerca.classList.contains('mp-cheio')) return;

    const cmd = e.ctrlKey || e.metaKey;
    if (cmd && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? refazer() : desfazer(); return }
    if (cmd && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicarRamo(); return }
    if (cmd) return;
    if (/^[vnst]$/i.test(e.key)) { ferramenta({ v: 'sel', n: 'nota', s: 'forma', t: 'texto' }[e.key.toLowerCase()]); return }
    if (/^f$/i.test(e.key)) { e.preventDefault(); telaCheia(); return }
    if (e.key === 'Tab') { e.preventDefault(); novoFilho() }
    else if (e.key === 'Enter') { e.preventDefault(); novoIrmao() }
    else if (e.key === 'F2') { e.preventDefault(); editar() }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); apagar() }
    else if (e.key === ' ') {
      e.preventDefault();
      if (sel.t !== 'no') return;
      const n = acharNo(sel.id);
      if (n && filhos(n.id).length) { guardar(); n.fech = !n.fech; organizar({ enquadrar: false }); salvar() }
    }
    else if (e.key === 'Escape') { cerca.classList.contains('mp-cheio') ? telaCheia() : ferramenta('sel') }
    else if (e.key === 'ArrowUp') { e.preventDefault(); navegar('cima') }
    else if (e.key === 'ArrowDown') { e.preventDefault(); navegar('baixo') }
    /* as setas laterais respeitam o lado: num nó que cresce para a
       esquerda, a seta esquerda desce em vez de subir */
    else if (e.key === 'ArrowLeft') { e.preventDefault(); navegar(sel.t === 'no' && lado(acharNo(sel.id) || {}) > 0 ? 'pai' : 'filho') }
    else if (e.key === 'ArrowRight') { e.preventDefault(); navegar(sel.t === 'no' && lado(acharNo(sel.id) || {}) > 0 ? 'filho' : 'pai') }
  }

  /* ================= entrada ================= */
  function abrir(hospedeiro) {
    M = carregar();
    sel = { t: 'no', id: raiz()?.id ?? null };
    Z = 1; PX = 0; PY = 0; pilha = []; pilhaR = []; medidas = {}; termo = '';
    jaEnquadrou = false;
    montar(hospedeiro);
    transformar();     // garante que existe transform desde o primeiro quadro
    organizar();
  }

  /* O app monta a aba de planejamento quando a pessoa entra nela, e
     remonta ao trocar de marca. Em vez de adivinhar o momento, fico de
     olho: assim que o palco do mapa aparecer sem o nosso motor dentro,
     assumo. */
  function vigiar() {
    const tenta = () => {
      const palco = document.querySelector('.mind-shell');
      if (!palco) return;
      /* o app troca o elemento inteiro ao mudar de marca: se a nossa cerca
         saiu do documento, é hora de montar de novo */
      if (palco.dataset.mp === '1' && cerca && cerca.isConnected) return;
      palco.dataset.mp = '1';
      palco.style.border = '0'; palco.style.background = 'transparent'; palco.style.overflow = 'visible';
      abrir(palco);
    };
    tenta();
    new MutationObserver(tenta).observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading')
    addEventListener('DOMContentLoaded', vigiar, { once: true });
  else vigiar();

  window.MapaMental = { abrir, recarregar: () => { if (cerca?.isConnected) abrir(cerca.parentElement) } };
})();
