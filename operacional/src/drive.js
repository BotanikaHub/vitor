/* ======================================================================
   Os arquivos de cada marca.

   O Drive da Botanika para a Botanika, o da VermeFree para a VermeFree —
   trocar de marca na barra de cima troca a pasta que se enxerga.

   Três lugares usam a mesma lista:
     · a tela Arquivos, para procurar e abrir;
     · a ficha da tarefa, para anexar sem subir cópia;
     · a campanha, para deixar à mão o material dela.

   Anexar aqui é guardar o link, não o arquivo. O que estava no app antes
   guardava só o nome — "banner-final-v3.png, 240 KB" — e ninguém
   conseguia abrir nada a partir dali. Agora o anexo leva ao arquivo de
   verdade, que continua morando no Drive, com a versão que o Drive tem.

   Quem fala com o Google é /api/drive, com uma conta de serviço que vive
   no servidor. Daqui não sai credencial nenhuma.
   ====================================================================== */
(function () {
  'use strict';

  const uid = () => (window.user && window.user.id) || 'vitor-gutierrez';
  const esc = (t) => String(t ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const lerLista = (k) => { try { const v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : [] } catch { return [] } };

  const marcaAtual = () => {
    const v = document.getElementById('brandSelect')?.value || '';
    return ['Botanika', 'VermeFree'].includes(v) ? v : 'Botanika';
  };

  const tamanho = (n) => {
    if (!n) return '';
    if (n < 1024) return `${n} B`;
    if (n < 1048576) return `${Math.round(n / 1024)} KB`;
    return `${(n / 1048576).toFixed(1).replace('.', ',')} MB`;
  };
  const dBR = (iso) => {
    if (!iso) return '';
    try { return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: '2-digit' }).format(new Date(iso)) }
    catch { return '' }
  };

  /* O ícone do Drive é uma imagem que só carrega logada; um desenho por
     família de tipo diz a mesma coisa e sempre aparece. */
  const TIPOS = [
    [/folder/, 'pasta', '▮'],
    [/image|photoshop/, 'imagem', '▣'],
    [/video|mp4|quicktime/, 'vídeo', '▶'],
    [/audio|mpeg|wav/, 'áudio', '♪'],
    [/spreadsheet|excel|csv/, 'planilha', '▤'],
    [/presentation|powerpoint/, 'apresentação', '▦'],
    [/pdf/, 'PDF', '▥'],
    [/document|word|text/, 'documento', '▤'],
  ];
  const familia = (tipo) => {
    for (const [re, nome, sinal] of TIPOS) if (re.test(String(tipo || ''))) return { nome, sinal };
    return { nome: 'arquivo', sinal: '▢' };
  };

  /* ---------- falar com o servidor ---------- */
  const cache = new Map();

  async function pedir(params, semCache) {
    const chave = JSON.stringify(params);
    if (!semCache && cache.has(chave)) return cache.get(chave);
    let t = null;
    try { const s = await window.CentralSessao?.(); t = s && s.access_token } catch {}
    if (!t) throw new Error('sem sessão');
    const url = new URL('/api/drive', location.origin);
    for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
    const r = await fetch(url, { headers: { Authorization: `Bearer ${t}` } });
    const corpo = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(corpo.erro || `HTTP ${r.status}`);
    cache.set(chave, corpo);
    return corpo;
  }

  const listar = (opcoes, semCache) => pedir({
    marca: (opcoes && opcoes.marca) || marcaAtual(),
    pasta: opcoes && opcoes.pasta,
    q: opcoes && opcoes.busca,
  }, semCache);

  /* ---------- o que dizer quando não está ligado ---------- */
  function comoLigar(d) {
    if (d.semChave) {
      return `<div class="dv-ligar">
        <b>Falta a chave da conta de serviço.</b>
        <p>O Drive de cada marca é lido por uma conta de serviço do Google — um e-mail de robô com quem você compartilha a pasta. Não tem tela de consentimento e ninguém da equipe precisa autorizar nada.</p>
        <ol>
          <li>No <b>Google Cloud</b>, crie um projeto e ligue a <b>Google Drive API</b>.</li>
          <li>Crie uma <b>conta de serviço</b> e gere uma chave em JSON.</li>
          <li>Na <b>Vercel</b>, guarde esse JSON na variável <code>GOOGLE_DRIVE_SA</code>. Se a colagem com quebras de linha der problema, cole o JSON em base64 — a Central aceita os dois.</li>
          <li>No <b>Drive</b>, compartilhe a pasta de cada marca com o e-mail da conta de serviço, como Leitor.</li>
        </ol>
        <p class="dv-obs">A chave dá acesso de leitura ao que for compartilhado com ela. Cole direto na Vercel, não aqui no chat.</p>
      </div>`;
    }
    if (d.semAcesso) {
      return `<div class="dv-ligar">
        <b>O Drive não encontra a pasta.</b>
        <p>${esc(d.erro || '')}</p>
        <p>Confira se a pasta foi compartilhada com o e-mail da conta de serviço — ele termina em <code>.iam.gserviceaccount.com</code> e está no JSON da chave, no campo <code>client_email</code>.</p>
      </div>`;
    }
    return `<div class="dv-ligar">
      <b>${esc(d.erro || 'Esta marca ainda não tem pasta ligada.')}</b>
      <p>Abra a pasta da marca no Drive e copie o id do endereço — é o pedaço depois de <code>/folders/</code>. Cole abaixo.</p>
      <form data-dv-form>
        <input data-dv-pasta placeholder="1y2eKzgCufCm_PhwrcaoRqxyVuNR3_NRM" required>
        <button type="submit" class="dv-bt">Ligar a pasta da ${esc(d.marca || marcaAtual())}</button>
      </form>
      <div class="dv-msg" role="status" aria-live="polite"></div>
    </div>`;
  }

  /* ---------- gravar o id da pasta ---------- */
  async function ligarPasta(marca, id) {
    const sb = window.CentralDB;
    if (!sb) throw new Error('sem banco');
    const limpo = String(id || '').trim()
      .replace(/^https?:\/\/drive\.google\.com\/drive\/(u\/\d+\/)?folders\//, '')
      .split(/[?#]/)[0].trim();
    if (!/^[A-Za-z0-9_-]{10,}$/.test(limpo)) throw new Error('esse id não parece um id de pasta do Drive');
    const { error } = await sb.from('painel_marcas').update({ drive_pasta: limpo }).eq('marca', marca);
    if (error) throw new Error(error.message);
    cache.clear();
    return limpo;
  }

  /* ---------- a lista, que é a mesma em todo lugar ---------- */
  function lista(d, { escolher } = {}) {
    if (!d.arquivos.length) {
      return `<div class="pn-vazio">${d.busca ? `Nada com "${esc(d.busca)}" nesta pasta.` : 'Esta pasta está vazia.'}</div>`;
    }
    return '<div class="dv-lista">' + d.arquivos.map((a) => {
      const f = familia(a.tipo);
      const acao = a.pasta
        ? `data-dv-abre="${esc(a.id)}"`
        : escolher ? `data-dv-escolhe="${esc(a.id)}"` : '';
      const corpo =
        `<i class="dv-sinal">${f.sinal}</i>` +
        `<span class="dv-nome">${esc(a.nome)}</span>` +
        `<small class="dv-meta">${esc(a.pasta ? 'pasta' : f.nome)}${a.tamanho ? ` · ${tamanho(a.tamanho)}` : ''}${a.em ? ` · ${dBR(a.em)}` : ''}</small>` +
        (a.pasta || escolher ? '' : '<span class="dv-abrir">abrir ↗</span>');
      return a.pasta || escolher
        ? `<button type="button" class="dv-item ${a.pasta ? 'dv-pasta' : ''}" ${acao}>${corpo}</button>`
        : `<a class="dv-item" href="${esc(a.link)}" target="_blank" rel="noopener">${corpo}</a>`;
    }).join('') + '</div>';
  }

  function trilha(d) {
    const raiz = `<button type="button" class="dv-passo" data-dv-abre="${esc(d.raiz)}">${esc(d.marca)}</button>`;
    const resto = (d.trilha || []).filter((p) => p.id !== d.raiz)
      .map((p) => `<span>/</span><button type="button" class="dv-passo" data-dv-abre="${esc(p.id)}">${esc(p.nome)}</button>`).join('');
    return `<nav class="dv-trilha">${raiz}${resto}</nav>`;
  }

  /* ====================================================================
     A tela Arquivos
     ==================================================================== */
  const st = () => (window.Painel || {}).estado || {};

  async function tela(ctx) {
    const s = st();
    let d;
    try {
      d = await listar({ marca: ctx.marca, pasta: s.dvPasta, busca: s.dvBusca }, ctx.forcar);
    } catch (e) {
      return ctx.ui.cartao('Arquivos', '', `<div class="pn-erro"><p>${esc(e.message)}</p></div>`);
    }
    if (!d.ligado) return ctx.ui.cartao('Arquivos', esc(ctx.marca), comoLigar(d));

    const barra = `<div class="dv-barra">
      ${trilha(d)}
      <form class="dv-busca" data-dv-busca>
        <input name="q" value="${esc(s.dvBusca || '')}" placeholder="Procurar na pasta inteira">
        ${s.dvBusca ? '<button type="button" class="dv-bt-vazio" data-dv-limpa>limpar</button>' : ''}
        <button type="submit" class="dv-bt-vazio">procurar</button>
      </form>
    </div>`;

    const sub = d.busca ? `${d.arquivos.length} achado(s) para "${d.busca}"` : `${d.arquivos.length} item(ns)`;
    return ctx.ui.cartao(`Arquivos da ${d.marca}`, sub, barra + lista(d) +
      (d.proxima ? '<p class="dv-obs">Mostrando os primeiros cem. Use a busca para achar o resto.</p>' : ''));
  }

  /* ====================================================================
     O escolhedor: a mesma lista, para anexar
     ==================================================================== */
  let escolhendo = null;   /* { pasta, busca, aoEscolher } */

  async function abrirEscolhedor(aoEscolher) {
    escolhendo = { pasta: null, busca: '', aoEscolher };
    document.querySelectorAll('.dv-modal').forEach((e) => e.remove());
    const cx = document.createElement('div');
    cx.className = 'dv-modal';
    cx.innerHTML = '<div class="dv-modal-cx"><div class="dv-modal-topo"><b>Anexar do Drive</b>' +
      '<button type="button" class="dv-x" data-dv-fecha>×</button></div>' +
      '<div class="dv-modal-corpo"><div class="pn-vazio">Buscando…</div></div></div>';
    document.body.appendChild(cx);
    cx.addEventListener('click', (e) => { if (e.target === cx) fecharEscolhedor() });
    await desenharEscolhedor();
  }

  function fecharEscolhedor() {
    escolhendo = null;
    document.querySelectorAll('.dv-modal').forEach((e) => e.remove());
  }

  async function desenharEscolhedor() {
    const cx = document.querySelector('.dv-modal .dv-modal-corpo');
    if (!cx || !escolhendo) return;
    let d;
    try { d = await listar({ pasta: escolhendo.pasta, busca: escolhendo.busca }) }
    catch (e) { cx.innerHTML = `<div class="pn-erro"><p>${esc(e.message)}</p></div>`; return }
    if (!d.ligado) { cx.innerHTML = comoLigar(d); return }
    cx.innerHTML = `<div class="dv-barra">${trilha(d)}
      <form class="dv-busca" data-dv-busca-modal>
        <input name="q" value="${esc(escolhendo.busca || '')}" placeholder="Procurar">
        <button type="submit" class="dv-bt-vazio">procurar</button>
      </form></div>` + lista(d, { escolher: true });
    cx.dataset.dvArquivos = JSON.stringify(d.arquivos);
  }

  const achar = (id) => {
    const cx = document.querySelector('.dv-modal .dv-modal-corpo');
    try { return JSON.parse(cx.dataset.dvArquivos || '[]').find((a) => a.id === id) } catch { return null }
  };

  /* ====================================================================
     Anexar na tarefa

     O app desenha o anexo como um nome e um tamanho, sem link — porque
     nunca houve arquivo de verdade por trás. Os que vêm do Drive têm, e
     por isso a lista é redesenhada aqui: senão o anexo continuaria sendo
     um texto que não leva a lugar nenhum.
     ==================================================================== */
  /* De quem é a ficha aberta: a conferência já resolvia isso, e resolve
     bem (o id, o cabeçalho, o título — nessa ordem). Reaproveitar em vez
     de escrever uma segunda adivinhação que erra em outros casos.

     Mas o objeto tem que ser o que o app tem na mão, e não uma cópia lida
     do localStorage: anexar mexe no vetor do app, senão a mudança some no
     próximo desenho. */
  const tarefaAberta = () => {
    const C = window.Conferencia;
    const d = C && C.tarefaDaFicha ? C.tarefaDaFicha() : null;
    if (!d) return null;
    const ts = (window.__centralGetTasks && window.__centralGetTasks()) || [];
    return ts.find((t) => String(t.id) === String(d.id)) || d;
  };

  function gravarTarefas() {
    const ts = (window.__centralGetTasks && window.__centralGetTasks()) || [];
    try { localStorage.setItem(`central.tasks.${uid()}`, JSON.stringify(ts)) } catch {}
  }

  function desenharAnexos() {
    const cx = document.getElementById('attachmentList');
    if (!cx) return;
    const t = tarefaAberta();
    if (!t) return;
    const anexos = t.attachments || [];
    const assinatura = JSON.stringify(anexos.map((a) => a.link || a.name));
    if (cx.dataset.dvFeito === assinatura) return;
    cx.dataset.dvFeito = assinatura;
    cx.innerHTML = anexos.map((a, i) => {
      const f = familia(a.drive && a.drive.tipo);
      const dentro = `<i class="dv-sinal">${a.link ? f.sinal : '◫'}</i><span class="dv-nome">${esc(a.name)}</span>` +
        `<small class="dv-meta">${esc(a.size || (a.link ? 'no Drive' : ''))}</small>`;
      return `<div class="dv-anexo">` +
        (a.link
          ? `<a href="${esc(a.link)}" target="_blank" rel="noopener">${dentro}<span class="dv-abrir">abrir ↗</span></a>`
          : `<span>${dentro}</span>`) +
        `<button type="button" class="dv-x" data-dv-tira-anexo="${i}" title="tirar o anexo">×</button></div>`;
    }).join('') || '<div class="dv-sem">Nenhum arquivo anexado.</div>';
  }

  function porBotaoAnexar() {
    const area = document.querySelector('#taskDetailBody .attachment-drop');
    if (!area || area.parentElement.querySelector('[data-dv-anexar]')) return;
    const bt = document.createElement('button');
    bt.type = 'button';
    bt.className = 'dv-bt';
    bt.dataset.dvAnexar = '1';
    bt.textContent = 'Anexar do Drive';
    bt.style.marginTop = '9px';
    area.insertAdjacentElement('afterend', bt);
  }

  /* ====================================================================
     Os arquivos da campanha
     ==================================================================== */
  const campanhaAberta = () => {
    const ws = document.getElementById('campaignWorkspace');
    if (!ws || !ws.classList.contains('active')) return null;
    const nome = ws.querySelector('.cw-title h2')?.textContent?.trim();
    return lerLista(`central.campaigns.${uid()}`).find((c) => c.name.trim() === nome) || null;
  };

  function gravarCampanha(c) {
    const todas = lerLista(`central.campaigns.${uid()}`);
    const i = todas.findIndex((x) => String(x.id) === String(c.id));
    if (i < 0) return;
    todas[i] = c;
    try { localStorage.setItem(`central.campaigns.${uid()}`, JSON.stringify(todas)) } catch {}
  }

  function cartaoCampanha(c) {
    const arqs = c.arquivos || [];
    return `<section class="cw-card dv-card"><div class="cw-card-head"><strong>Arquivos da campanha</strong>` +
      `<span>${arqs.length} do Drive da ${esc(c.brand || '')}</span></div><div class="cw-card-body">` +
      (arqs.length
        ? '<div class="dv-lista">' + arqs.map((a, i) => {
            const f = familia(a.tipo);
            return `<div class="dv-anexo"><a href="${esc(a.link)}" target="_blank" rel="noopener">` +
              `<i class="dv-sinal">${f.sinal}</i><span class="dv-nome">${esc(a.nome)}</span>` +
              `<small class="dv-meta">${esc(f.nome)}</small><span class="dv-abrir">abrir ↗</span></a>` +
              `<button type="button" class="dv-x" data-dv-tira-camp="${i}" title="tirar">×</button></div>`;
          }).join('') + '</div>'
        : '<div class="dv-sem">Nada anexado ainda. O arquivo continua morando no Drive — aqui fica o caminho até ele.</div>') +
      `<button type="button" class="dv-bt" data-dv-anexar-camp style="margin-top:11px">Anexar do Drive</button>` +
      `</div></section>`;
  }

  function porCartaoCampanha() {
    const ws = document.getElementById('campaignWorkspace');
    if (!ws || !ws.classList.contains('active')) return;
    const pane = ws.querySelector('[data-cw-pane="summary"] .cp') || ws.querySelector('[data-cw-pane="summary"]');
    if (!pane) return;
    const c = campanhaAberta();
    if (!c) return;
    const assinatura = `${c.id}·${(c.arquivos || []).length}`;
    const jaTem = pane.querySelector('.dv-card');
    if (jaTem && jaTem.dataset.dvAssina === assinatura) return;
    if (jaTem) jaTem.remove();
    pane.insertAdjacentHTML('beforeend', cartaoCampanha(c));
    const novo = pane.querySelector('.dv-card');
    if (novo) novo.dataset.dvAssina = assinatura;
  }

  /* ====================================================================
     Ligar
     ==================================================================== */
  function montar() {
    const P = window.Painel;
    if (!P || !P.registrar) return setTimeout(montar, 150);
    P.registrar({ id: 'arquivos', nome: 'Arquivos', semPeriodo: true, render: tela });

    const view = document.getElementById('painelView');
    if (!view) return setTimeout(montar, 150);
    const redesenhar = () => P.carregar(false);

    view.addEventListener('click', (e) => {
      const abre = e.target.closest('[data-dv-abre]');
      if (abre) { st().dvPasta = abre.dataset.dvAbre; st().dvBusca = ''; return redesenhar() }
      if (e.target.closest('[data-dv-limpa]')) { st().dvBusca = ''; return redesenhar() }
    });

    view.addEventListener('submit', async (e) => {
      const busca = e.target.closest('[data-dv-busca]');
      if (busca) {
        e.preventDefault();
        st().dvBusca = busca.querySelector('input').value.trim();
        return redesenhar();
      }
      const form = e.target.closest('[data-dv-form]');
      if (!form) return;
      e.preventDefault();
      const msg = view.querySelector('.dv-msg');
      const campo = form.querySelector('[data-dv-pasta]');
      try {
        await ligarPasta(marcaAtual(), campo.value);
        redesenhar();
      } catch (err) {
        if (msg) { msg.textContent = err.message; msg.className = 'dv-msg erro' }
      }
    });

    /* trocar de marca troca a pasta que se enxerga */
    document.getElementById('brandSelect')?.addEventListener('change', () => {
      st().dvPasta = null; st().dvBusca = '';
    });

    /* ---- o escolhedor, que vive fora do painel ---- */
    document.addEventListener('click', async (e) => {
      if (e.target.closest('[data-dv-fecha]')) return fecharEscolhedor();

      const abre = e.target.closest('.dv-modal [data-dv-abre]');
      if (abre && escolhendo) {
        escolhendo.pasta = abre.dataset.dvAbre; escolhendo.busca = '';
        return desenharEscolhedor();
      }

      const escolhe = e.target.closest('[data-dv-escolhe]');
      if (escolhe && escolhendo) {
        const a = achar(escolhe.dataset.dvEscolhe);
        const f = escolhendo.aoEscolher;
        fecharEscolhedor();
        if (a && f) f(a);
        return;
      }

      if (e.target.closest('[data-dv-anexar]')) {
        return abrirEscolhedor((a) => {
          const t = tarefaAberta();
          if (!t) return;
          t.attachments = t.attachments || [];
          if (t.attachments.some((x) => x.drive && x.drive.id === a.id)) return;
          t.attachments.push({
            name: a.nome, size: tamanho(a.tamanho) || 'no Drive',
            link: a.link, drive: { id: a.id, tipo: a.tipo },
          });
          gravarTarefas();
          desenharAnexos();
          window.showToast?.(`"${a.nome}" anexado`);
        });
      }

      if (e.target.closest('[data-dv-anexar-camp]')) {
        return abrirEscolhedor((a) => {
          const c = campanhaAberta();
          if (!c) return;
          c.arquivos = c.arquivos || [];
          if (c.arquivos.some((x) => x.id === a.id)) return;
          c.arquivos.push({ id: a.id, nome: a.nome, tipo: a.tipo, link: a.link });
          gravarCampanha(c);
          porCartaoCampanha();
          window.showToast?.(`"${a.nome}" anexado à campanha`);
        });
      }

      const tiraAnexo = e.target.closest('[data-dv-tira-anexo]');
      if (tiraAnexo) {
        const t = tarefaAberta();
        if (!t) return;
        t.attachments.splice(+tiraAnexo.dataset.dvTiraAnexo, 1);
        gravarTarefas();
        desenharAnexos();
        return;
      }

      const tiraCamp = e.target.closest('[data-dv-tira-camp]');
      if (tiraCamp) {
        const c = campanhaAberta();
        if (!c) return;
        (c.arquivos || []).splice(+tiraCamp.dataset.dvTiraCamp, 1);
        gravarCampanha(c);
        porCartaoCampanha();
      }
    });

    document.addEventListener('submit', (e) => {
      const f = e.target.closest('[data-dv-busca-modal]');
      if (!f || !escolhendo) return;
      e.preventDefault();
      escolhendo.busca = f.querySelector('input').value.trim();
      desenharEscolhedor();
    });

    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && escolhendo) fecharEscolhedor() });

    /* A ficha da tarefa e a campanha são remontadas o tempo todo pelo app;
       um observador só põe de volta o que é meu. */
    new MutationObserver(() => { porBotaoAnexar(); desenharAnexos(); porCartaoCampanha() })
      .observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();

  window.Drive = { listar, ligarPasta, abrirEscolhedor, familia, tamanho, marcaAtual };
})();
