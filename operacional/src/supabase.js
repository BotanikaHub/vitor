/* ===================================================================
   Liga o app ao nosso Supabase.

   O app foi escrito para guardar tudo em localStorage, e a leitura é
   síncrona logo no boot. Reescrever os dezesseis pontos onde ele grava
   exigiria mexer no arquivo inteiro antes das telas estarem aprovadas —
   caro e arriscado. Então o caminho aqui é outro: o localStorage vira uma
   vitrine do que está no banco.

   Como funciona, na ordem:

   1. Sem sessão, aparece a tela de entrar e o app nem começa.
   2. Com sessão, o estado é buscado no banco e escrito no localStorage.
      Se o que veio for diferente do que já estava, a página recarrega uma
      vez — assim o app inicia lendo o dado de todo mundo, e não o que
      sobrou no navegador desta pessoa.
   3. Dali em diante, toda gravação do app no localStorage é copiada para
      o banco.

   O que é de todos e o que é de cada um:
   - o arranjo da tela de início é pessoal (dono preenchido);
   - o tema fica só no navegador, nem vai para o banco;
   - tarefas, campanhas, entregas e planejamento são da operação inteira
     (dono nulo) — é justamente o que estava faltando.
   =================================================================== */
(function () {
  'use strict';

  const URL_SB  = 'https://sjkuysdmixfzeerxuudn.supabase.co';
  const CHAVE_SB = window.__SB_ANON__ || '';   // preenchida pelo build
  const TABELA  = 'operacional_estado';
  const MARCA_RELOAD = 'central.__hidratado';

  /* Guardado antes de qualquer troca: é por aqui que a hidratação escreve.
     Se ela usasse o localStorage já espelhado, tudo que desce do banco
     subiria de volta no mesmo instante — cada abertura de página viraria
     uma gravação, e o valor recém-lido poderia passar por cima de um mais
     novo que outra pessoa acabou de salvar. */
  const gravarLocal = localStorage.setItem.bind(localStorage);

  const ehNossa   = (k) => typeof k === 'string' && k.startsWith('central.');
  const soLocal   = (k) => k === 'central.theme' || k === MARCA_RELOAD;
  const ehPessoal = (k) => k.startsWith('central.home.layout.');

  /* ---------- a tela de entrar ---------- */
  function telaEntrar(sb, aviso) {
    if (!document.body) {
      addEventListener('DOMContentLoaded', () => telaEntrar(sb, aviso), { once: true });
      return;
    }
    document.body.innerHTML = '';
    document.body.style.cssText =
      'margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;' +
      'background:#f6f6f4;font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;color:#151718';
    const cx = document.createElement('form');
    cx.style.cssText =
      'width:320px;background:#fff;border:1px solid #dedfdd;border-radius:14px;padding:26px';
    cx.innerHTML =
      '<div style="font-size:17px;font-weight:700;letter-spacing:-.01em">Central</div>' +
      '<div style="color:#7e8389;margin:5px 0 20px">Entre para ver a operação.</div>' +
      '<label style="display:block;font-size:12px;font-weight:600;margin-bottom:5px">E-mail</label>' +
      '<input name="email" type="email" required autocomplete="email" ' +
      'style="width:100%;box-sizing:border-box;padding:9px 11px;border:1px solid #dedfdd;border-radius:9px;font:inherit;margin-bottom:13px">' +
      '<label style="display:block;font-size:12px;font-weight:600;margin-bottom:5px">Senha</label>' +
      '<input name="senha" type="password" required autocomplete="current-password" ' +
      'style="width:100%;box-sizing:border-box;padding:9px 11px;border:1px solid #dedfdd;border-radius:9px;font:inherit;margin-bottom:18px">' +
      '<button type="submit" style="width:100%;padding:10px;border:0;border-radius:9px;background:#151718;' +
      'color:#fff;font:inherit;font-weight:600;cursor:pointer">Entrar</button>' +
      '<div data-erro style="color:#c0392b;margin-top:12px;min-height:19px">' + (aviso || '') + '</div>';
    cx.onsubmit = async (e) => {
      e.preventDefault();
      const erro = cx.querySelector('[data-erro]');
      erro.textContent = 'Entrando…';
      erro.style.color = '#7e8389';
      const { error } = await sb.auth.signInWithPassword({
        email: cx.email.value.trim(),
        password: cx.senha.value,
      });
      if (error) {
        erro.style.color = '#c0392b';
        erro.textContent = error.message === 'Invalid login credentials'
          ? 'E-mail ou senha não conferem.'
          : error.message;
        return;
      }
      sessionStorage.removeItem(MARCA_RELOAD);
      location.reload();
    };
    document.body.appendChild(cx);
  }

  /* ---------- trazer o estado do banco ---------- */
  async function hidratar(sb, uid) {
    const { data, error } = await sb
      .from(TABELA)
      .select('chave, valor, dono')
      .or(`dono.is.null,dono.eq.${uid}`);
    if (error) throw error;

    let mudou = false;
    for (const linha of data || []) {
      const texto = JSON.stringify(linha.valor);
      if (localStorage.getItem(linha.chave) !== texto) {
        gravarLocal(linha.chave, texto);
        mudou = true;
      }
    }
    return mudou;
  }

  /* ---------- mandar de volta o que o app gravar ---------- */
  let espelhando = false;
  function espelhar(sb, uid) {
    if (espelhando) return;            // uma vez por página, não duas
    espelhando = true;
    localStorage.setItem = function (chave, texto) {
      gravarLocal(chave, texto);
      if (!ehNossa(chave) || soLocal(chave)) return;
      let valor;
      try { valor = JSON.parse(texto); } catch { return; }  // não é JSON, não sobe
      sb.from(TABELA)
        .upsert(
          { chave, dono: ehPessoal(chave) ? uid : null, valor,
            atualizado_em: new Date().toISOString(), atualizado_por: uid },
          { onConflict: 'chave,dono' })
        .then(({ error }) => { if (error) console.error('[central] não salvou:', chave, error.message); });
    };
  }

  /* ---------- a ordem das coisas ---------- */
  async function comecar() {
    if (!CHAVE_SB) { console.error('[central] sem chave do Supabase; seguindo só local'); return; }
    const sb = window.supabase.createClient(URL_SB, CHAVE_SB);
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return telaEntrar(sb);

    const uid = session.user.id;
    espelhar(sb, uid);

    /* A marca no sessionStorage existe para o recarregamento acontecer uma
       vez só. Sem ela, uma gravação nossa dispararia hidratação, diferença
       e recarga de novo — a página entraria em laço. */
    if (!sessionStorage.getItem(MARCA_RELOAD)) {
      sessionStorage.setItem(MARCA_RELOAD, '1');
      try {
        if (await hidratar(sb, uid)) { location.reload(); return; }
      } catch (e) {
        console.error('[central] não consegui buscar o estado:', e.message);
      }
    }
  }

  /* O app lê o localStorage no boot, então isto tem que resolver antes.
     O script do Supabase é carregado de forma bloqueante no <head>. */
  comecar();
})();
