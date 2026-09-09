/* ===================================================================
   Sessão e dados da Central.

   Duas coisas moram aqui:

   1. A tela de entrar. O app foi escrito com o usuário fixo no código
      ('vitor-gutierrez'), então qualquer pessoa que abrisse era o Vitor.
      Agora ninguém passa sem sessão.

   2. A ponte com o banco. O app guarda tudo em localStorage e lê de forma
      síncrona no boot; reescrever os dezesseis pontos onde ele grava
      exigiria mexer no arquivo inteiro antes das telas estarem aprovadas.
      Então o localStorage vira uma vitrine do que está no Supabase:
      desce no início, sobe a cada gravação.

   O que é de todos e o que é de cada um:
   - tarefas, campanhas, entregas e planejamento são da operação inteira
     (dono nulo) — é o que faltava, o Pedro criava e a Sarah não via;
   - o arranjo da tela de início é de cada pessoa;
   - o tema fica só no navegador, nem sobe.
   =================================================================== */
(function () {
  'use strict';

  const URL_SB   = 'https://sjkuysdmixfzeerxuudn.supabase.co';
  const CHAVE_SB = window.__SB_ANON__ || '';
  const TABELA   = 'operacional_estado';
  const MARCA_RELOAD = 'central.__hidratado';
  const ULTIMO_EMAIL = 'central.__email';

  /* Guardado antes de qualquer troca: é por aqui que a hidratação escreve.
     Se ela usasse o localStorage já espelhado, tudo que desce do banco
     subiria de volta no mesmo instante — cada abertura de página viraria
     uma gravação, e o valor recém-lido poderia passar por cima de um mais
     novo que outra pessoa acabou de salvar. */
  const gravarLocal = localStorage.setItem.bind(localStorage);

  const ehNossa   = (k) => typeof k === 'string' && k.startsWith('central.');
  const soLocal   = (k) => k === 'central.theme' || k === MARCA_RELOAD || k === ULTIMO_EMAIL;
  const ehPessoal = (k) => k.startsWith('central.home.layout.');

  const FONTE = '"Geist Variable","Geist",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';

  /* ================= a tela de entrar ================= */

  /* As mensagens do Supabase vêm em inglês e algumas não dizem nada a quem
     está do outro lado ("Invalid login credentials"). Traduzidas para o que
     a pessoa precisa fazer a seguir. */
  function recado(msg) {
    const m = String(msg || '');
    if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha não conferem.';
    if (/Email not confirmed/i.test(m))       return 'Esse e-mail ainda não foi confirmado. Procure a mensagem de confirmação na caixa de entrada.';
    if (/rate limit|too many/i.test(m))       return 'Muitas tentativas seguidas. Espere um minuto e tente de novo.';
    if (/Failed to fetch|NetworkError/i.test(m)) return 'Não consegui falar com o servidor. Verifique a conexão.';
    return m || 'Não consegui entrar.';
  }

  function estilos() {
    if (document.getElementById('entrar-estilo')) return;
    const s = document.createElement('style');
    s.id = 'entrar-estilo';
    s.textContent = `
      .ent-fundo{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;
        justify-content:center;padding:24px;background:#f6f6f4;font:14px/1.5 ${FONTE};
        color:#151718;-webkit-font-smoothing:antialiased}
      .ent-cx{width:100%;max-width:352px}
      .ent-marca{font-size:19px;font-weight:700;letter-spacing:-.02em;margin-bottom:3px}
      .ent-sub{color:#7e8389;margin-bottom:22px}
      .ent-cartao{background:#fff;border:1px solid #dedfdd;border-radius:14px;padding:24px}
      .ent-campo{margin-bottom:15px}
      .ent-campo:last-of-type{margin-bottom:19px}
      .ent-rot{display:block;font-size:12px;font-weight:600;margin-bottom:6px}
      .ent-cai{position:relative;display:flex;align-items:center}
      /* !important porque as onze folhas do app mexem em input global e
         chegam aqui por cima; sem isso o campo ganha o anel de foco do
         navegador em volta do nosso e fica com borda dupla. */
      .ent-fundo input{width:100%!important;box-sizing:border-box!important;
        padding:10px 12px!important;border:1px solid #dedfdd!important;
        border-radius:10px!important;font:inherit!important;color:#151718!important;
        background:#fff!important;outline:none!important;box-shadow:none!important;
        transition:border-color .12s,box-shadow .12s}
      .ent-fundo input:focus,.ent-fundo input:focus-visible{
        border-color:#151718!important;box-shadow:0 0 0 3px rgba(21,23,24,.08)!important;
        outline:none!important}
      .ent-fundo input[aria-invalid="true"]{border-color:#c0392b!important}
      .ent-fundo input[aria-invalid="true"]:focus{box-shadow:0 0 0 3px rgba(192,57,43,.12)!important}
      .ent-olho{position:absolute;right:6px;background:none;border:0;padding:6px 8px;
        font:inherit;font-size:11px;font-weight:600;color:#7e8389;cursor:pointer;border-radius:7px}
      .ent-olho:hover{color:#151718;background:#f6f6f4}
      .ent-bt{width:100%;padding:11px;border:0;border-radius:10px;background:#151718;color:#fff;
        font:inherit;font-weight:600;cursor:pointer;transition:opacity .12s}
      .ent-bt:hover{opacity:.88}
      .ent-bt[disabled]{opacity:.5;cursor:default}
      .ent-link{display:block;width:100%;margin-top:14px;background:none;border:0;padding:0;
        font:inherit;font-size:13px;color:#7e8389;text-align:center;cursor:pointer}
      .ent-link:hover{color:#151718;text-decoration:underline}
      .ent-msg{margin-top:13px;font-size:13px;min-height:0}
      .ent-msg:empty{margin-top:0}
      .ent-msg.erro{color:#c0392b}
      .ent-msg.ok{color:#1a7f4b}
      .ent-msg.indo{color:#7e8389}
      .ent-pe{margin-top:18px;text-align:center;font-size:12px;color:#a4a8ac}
      @media (prefers-reduced-motion:reduce){.ent-cx *{transition:none!important}}
    `;
    document.head.appendChild(s);
  }

  function telaEntrar(sb) {
    if (!document.body) {
      addEventListener('DOMContentLoaded', () => telaEntrar(sb), { once: true });
      return;
    }
    estilos();
    /* O app pode já ter começado a desenhar atrás; a tela cobre tudo em vez
       de apagar o corpo, senão um erro de sessão levaria a página junto. */
    document.querySelectorAll('.ent-fundo').forEach((e) => e.remove());

    const fundo = document.createElement('div');
    fundo.className = 'ent-fundo';
    fundo.innerHTML = `
      <div class="ent-cx">
        <div class="ent-marca">Central</div>
        <div class="ent-sub">A operação da Botanika e da VermeFree.</div>
        <form class="ent-cartao" novalidate>
          <div class="ent-campo">
            <label class="ent-rot" for="ent-email">E-mail</label>
            <input id="ent-email" name="email" type="email" required
                   autocomplete="username" autocapitalize="off" spellcheck="false">
          </div>
          <div class="ent-campo">
            <label class="ent-rot" for="ent-senha">Senha</label>
            <div class="ent-cai">
              <input id="ent-senha" name="senha" type="password" required
                     autocomplete="current-password">
              <button type="button" class="ent-olho" data-olho>mostrar</button>
            </div>
          </div>
          <button type="submit" class="ent-bt">Entrar</button>
          <button type="button" class="ent-link" data-esqueci>Esqueci minha senha</button>
          <div class="ent-msg" role="status" aria-live="polite"></div>
        </form>
        <div class="ent-pe">Acesso restrito à equipe.</div>
      </div>`;
    document.body.appendChild(fundo);

    const f     = fundo.querySelector('form');
    const email = fundo.querySelector('#ent-email');
    const senha = fundo.querySelector('#ent-senha');
    const bt    = fundo.querySelector('.ent-bt');
    const msg   = fundo.querySelector('.ent-msg');
    const olho  = fundo.querySelector('[data-olho]');

    const diz = (texto, tipo) => { msg.textContent = texto; msg.className = 'ent-msg ' + (tipo || ''); };

    /* Quem já entrou uma vez não precisa digitar o e-mail de novo. */
    const lembrado = localStorage.getItem(ULTIMO_EMAIL);
    if (lembrado) { email.value = lembrado; senha.focus(); } else { email.focus(); }

    olho.onclick = () => {
      const escondida = senha.type === 'password';
      senha.type = escondida ? 'text' : 'password';
      olho.textContent = escondida ? 'ocultar' : 'mostrar';
      senha.focus();
    };

    f.onsubmit = async (e) => {
      e.preventDefault();
      email.setAttribute('aria-invalid', 'false');
      senha.setAttribute('aria-invalid', 'false');
      if (!email.value.trim() || !senha.value) {
        diz('Preencha o e-mail e a senha.', 'erro');
        (!email.value.trim() ? email : senha).focus();
        return;
      }
      bt.disabled = true;
      diz('Entrando…', 'indo');
      const { error } = await sb.auth.signInWithPassword({
        email: email.value.trim(), password: senha.value,
      });
      if (error) {
        bt.disabled = false;
        diz(recado(error.message), 'erro');
        email.setAttribute('aria-invalid', 'true');
        senha.setAttribute('aria-invalid', 'true');
        senha.select();
        return;
      }
      gravarLocal(ULTIMO_EMAIL, email.value.trim());
      /* A marca sai para a hidratação rodar de novo com a sessão nova: quem
         entra tem que ver o estado do banco, não o que sobrou no navegador. */
      sessionStorage.removeItem(MARCA_RELOAD);
      location.reload();
    };

    fundo.querySelector('[data-esqueci]').onclick = async () => {
      const e = email.value.trim();
      if (!e) { diz('Escreva o e-mail primeiro — o link vai para ele.', 'erro'); email.focus(); return; }
      diz('Enviando…', 'indo');
      const { error } = await sb.auth.resetPasswordForEmail(e, { redirectTo: location.origin });
      diz(error ? recado(error.message)
                : 'Se esse e-mail estiver cadastrado, o link para trocar a senha já está a caminho.',
          error ? 'erro' : 'ok');
    };
  }

  /* Fechar a porta quando não dá para autenticar: melhor a pessoa ver que
     algo quebrou do que ver a operação sem ter entrado. */
  function semAcesso() {
    if (!document.body) {
      addEventListener('DOMContentLoaded', semAcesso, { once: true });
      return;
    }
    estilos();
    const fundo = document.createElement('div');
    fundo.className = 'ent-fundo';
    fundo.innerHTML =
      '<div class="ent-cx"><div class="ent-marca">Central</div>' +
      '<div class="ent-cartao"><div style="font-weight:600;margin-bottom:6px">Não consegui verificar quem é você.</div>' +
      '<div style="color:#7e8389">A conexão com o servidor de acesso falhou. Recarregue a página; ' +
      'se continuar assim, avise o Vitor.</div>' +
      '<button type="button" class="ent-bt" style="margin-top:18px">Tentar de novo</button>' +
      '</div></div>';
    fundo.querySelector('button').onclick = () => location.reload();
    document.body.appendChild(fundo);
  }

  /* ================= quem está logado, e como sair ================= */
  /* O começo do e-mail dá nomes horrorosos ("comercialvittorgutierrez"),
     então o nome vem da tabela de perfis quando existir. Se a consulta
     falhar, o e-mail cortado serve — ninguém fica sem saber quem está
     logado por causa disso. */
  async function nomeDe(sb, sessao) {
    try {
      const { data } = await sb.from('profiles')
        .select('id, nome, email, papel, ativo, cargo, area_id')
        .eq('id', sessao.user.id).maybeSingle();
      /* Quem está logado, e o que pode: as telas de acesso e de equipe
         perguntam isto em vez de adivinhar pelo e-mail. */
      if (data) window.CentralEu = data;
      const n = (data?.nome || '').trim();
      if (n) return n.split(/\s+/)[0];
    } catch { /* segue com o e-mail */ }
    const bruto = (sessao.user.email || '').split('@')[0];
    return bruto.length > 14 ? bruto.slice(0, 14) + '…' : bruto;
  }

  async function marcarSessao(sb, sessao) {
    const nome = await nomeDe(sb, sessao);
    const põe = () => {
      const barra = document.querySelector('.global-toolbar');
      if (!barra || document.getElementById('ent-quem')) return;
      const chip = document.createElement('div');
      chip.id = 'ent-quem';
      chip.style.cssText =
        `margin-left:auto;display:flex;align-items:center;gap:9px;font:12px/1 ${FONTE};color:#7e8389`;
      chip.innerHTML =
        `<span title="${sessao.user.email}">${nome}</span>` +
        `<button type="button" style="background:none;border:1px solid #dedfdd;border-radius:8px;` +
        `padding:5px 9px;font:inherit;font-weight:600;color:#151718;cursor:pointer">sair</button>`;
      chip.querySelector('button').onclick = async () => {
        await sb.auth.signOut();
        sessionStorage.removeItem(MARCA_RELOAD);
        location.reload();
      };
      barra.appendChild(chip);
    };
    põe();
    /* A barra é montada pelo app depois deste script; se ainda não existe,
       espera ela aparecer em vez de chutar um tempo. */
    if (!document.getElementById('ent-quem')) {
      const obs = new MutationObserver(() => { põe(); if (document.getElementById('ent-quem')) obs.disconnect(); });
      addEventListener('DOMContentLoaded', () =>
        obs.observe(document.body, { childList: true, subtree: true }), { once: true });
    }
  }

  /* ================= trazer o estado do banco ================= */
  async function hidratar(sb, uid) {
    const { data, error } = await sb.from(TABELA)
      .select('chave, valor, dono')
      .or(`dono.is.null,dono.eq.${uid}`);
    if (error) throw error;

    let mudou = false;
    for (const linha of data || []) {
      const texto = JSON.stringify(linha.valor);
      if (localStorage.getItem(linha.chave) !== texto) { gravarLocal(linha.chave, texto); mudou = true; }
    }
    return mudou;
  }

  /* ================= mandar de volta o que o app gravar ================= */
  let espelhando = false;
  function espelhar(sb, uid) {
    if (espelhando) return;
    espelhando = true;
    localStorage.setItem = function (chave, texto) {
      gravarLocal(chave, texto);
      if (!ehNossa(chave) || soLocal(chave)) return;
      let valor;
      try { valor = JSON.parse(texto); } catch { return; }
      sb.from(TABELA).upsert(
        { chave, dono: ehPessoal(chave) ? uid : null, valor,
          atualizado_em: new Date().toISOString(), atualizado_por: uid },
        { onConflict: 'chave,dono' }
      ).then(({ error }) => { if (error) console.error('[central] não salvou:', chave, error.message); });
    };
  }

  /* ================= a ordem das coisas ================= */
  async function comecar() {
    /* Se a biblioteca não carregou, não dá para saber quem é quem — e
       seguir assim abriria a operação inteira para qualquer um que chegasse
       na URL. Então fecha em vez de abrir. */
    if (!window.supabase || !CHAVE_SB) {
      console.error('[central] Supabase indisponível');
      return semAcesso();
    }
    const sb = window.supabase.createClient(URL_SB, CHAVE_SB);
    /* o Painel precisa do token de quem está logado para falar com /api/painel */
    window.CentralSessao = () => sb.auth.getSession().then((r) => (r.data && r.data.session) || null).catch(() => null);
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return telaEntrar(sb);

    const uid = session.user.id;
    /* O cliente fica à mão dos módulos que leem tabelas de verdade
       (equipe, acessos). A sessão manda em tudo: o RLS decide o resto. */
    window.CentralDB = sb;
    window.CentralSessaoAtual = session;
    marcarSessao(sb, session);

    /* Buscar ANTES de espelhar, e não depois.

       O app roda logo abaixo deste script e grava o estado padrão dele no
       localStorage. Se o espelho já estivesse ligado, esse padrão subiria
       para o banco e passaria por cima do que estava lá — foi o que quase
       apagou as dezoito campanhas. Ligando o espelho só depois, as
       gravações do começo ficam locais, a busca sobrescreve, e a página
       recarrega com o dado certo.

       Também não existe mais marca de "já hidratei nesta aba": ela fazia a
       busca acontecer uma vez só e nunca mais, então dado carregado no
       banco depois disso nunca chegava em quem estava com a aba aberta. O
       laço não acontece por construção — depois de escrever, o local passa
       a ser igual ao remoto, e a próxima comparação não acha diferença. */
    let mudou = false;
    try {
      mudou = await hidratar(sb, uid);
    } catch (e) {
      console.error('[central] não consegui buscar o estado:', e.message);
    }
    espelhar(sb, uid);

    if (mudou) {
      /* Cinto de segurança: se por algum motivo a comparação nunca casar,
         o contador impede a página de recarregar sem parar. */
      const n = +(sessionStorage.getItem(MARCA_RELOAD) || 0);
      if (n < 3) { sessionStorage.setItem(MARCA_RELOAD, String(n + 1)); location.reload(); return; }
      console.warn('[central] o estado local não estabiliza; seguindo sem recarregar');
    } else {
      sessionStorage.removeItem(MARCA_RELOAD);
    }
  }

  comecar();
})();
