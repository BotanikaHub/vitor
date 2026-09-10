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


  /* ================= juntar em vez de atropelar =================

     Enquanto o ClickUp era o original, o banco daqui era cópia: perder uma
     gravação custava um "sincroniza de novo". Agora não. A tarefa nasce,
     muda e fecha aqui — este é o único lugar onde ela existe.

     E o jeito como isto gravava não sobrevive a oito pessoas. O app guarda
     as 70 tarefas num vetor só, e a ponte subia o vetor inteiro a cada
     mudança. Duas pessoas com a página aberta: a Sarah fecha a dela às
     10h02, o Pedro renomeia a dele às 10h03 — e o vetor do Pedro, lido às
     9h40, volta por cima e desfaz o que a Sarah fez. Sem erro, sem aviso.

     Então a gravação passa a juntar três coisas: o que eu tinha quando li
     (`base`), o que eu tenho agora (`meu`) e o que está no banco agora
     (`servidor`). Só o que EU mudei vai por cima; o resto fica como o banco
     está. Duas pessoas na mesma tarefa ainda dá "a última manda" — como em
     qualquer ferramenta —, mas duas pessoas em tarefas diferentes param de
     se atropelar, que é o caso de todo dia.
     ============================================================== */

  const objeto = (v) => v && typeof v === 'object' && !Array.isArray(v);
  const comId = (v) => Array.isArray(v) && v.every((x) => objeto(x) && x.id != null);
  const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  function juntarLista(base, meu, servidor) {
    const doServidor = new Map(servidor.map((x) => [String(x.id), x]));
    const daBase = new Map((Array.isArray(base) ? base : []).map((x) => [String(x.id), x]));
    const meus = new Map(meu.map((x) => [String(x.id), x]));

    /* o que eu apaguei sai; o que outro apagou e eu não toquei, fica fora */
    for (const id of daBase.keys()) if (!meus.has(id)) doServidor.delete(id);

    const fora = [];
    for (const item of meu) {
      const id = String(item.id);
      const antes = daBase.get(id);
      const doBanco = doServidor.get(id);
      /* mudei eu, ou é novo meu: vale o meu. Não mudei: vale o do banco */
      fora.push(!antes || !igual(antes, item) ? item : (doBanco || item));
      doServidor.delete(id);
    }
    /* o que outra pessoa criou enquanto eu estava com a página aberta */
    for (const item of doServidor.values()) fora.push(item);
    return fora;
  }

  function juntar(base, meu, servidor) {
    if (servidor === undefined || servidor === null) return meu;
    /* Cinto: lista que vem vazia depois de ter tido coisa é quase sempre o
       app gravando o padrão dele, não alguém apagando setenta tarefas uma a
       uma. Já aconteceu — foi assim que as dezoito campanhas quase foram
       embora. Esvaziar de propósito se faz item por item. */
    if (Array.isArray(meu) && !meu.length && Array.isArray(base) && base.length) {
      console.warn('[central] ignorei uma gravação vazia por cima de', base.length, 'itens');
      return servidor;
    }
    if (comId(meu) && comId(servidor)) return juntarLista(base, meu, servidor);
    if (objeto(meu) && objeto(servidor)) {
      const b = objeto(base) ? base : {};
      const fora = {};
      for (const k of new Set([...Object.keys(servidor), ...Object.keys(meu)])) {
        const tinha = Object.prototype.hasOwnProperty.call(b, k);
        const tenho = Object.prototype.hasOwnProperty.call(meu, k);
        if (tinha && !tenho) continue;                       /* apaguei eu */
        if (!tenho) { fora[k] = servidor[k]; continue; }      /* nem toquei */
        fora[k] = !tinha || !igual(b[k], meu[k])
          ? juntar(b[k], meu[k], servidor[k])                 /* mudei eu */
          : servidor[k];                                      /* não mudei */
      }
      return fora;
    }
    return meu;
  }


  /* ================= chegou coisa de outra pessoa =================

     Sem ClickUp por trás, o que o Ítalo cria só existe aqui — e antes o
     Pedro só veria depois de recarregar a página por acaso. A ponte passa
     a olhar o banco de tempo em tempo e quando alguém volta para a aba.

     Ela não escreve por baixo: trocar o estado embaixo de quem está no
     meio de uma edição é pior do que não avisar. Ela mostra uma barra e
     deixa a decisão de recarregar com quem está na frente da tela. */
  const NOMES = {
    'central.tasks': 'nas tarefas',
    'central.campaigns': 'nas campanhas',
    'central.conferencia': 'nas conferências',
    'central.pessoas': 'no cadastro de pessoas',
    'central.rituais': 'na daily ou na reunião',
    'central.planning': 'no planejamento',
  };
  const ondeFoi = (chaves) => {
    const lugares = [...new Set(chaves.map((c) => {
      const p = c.split('.').slice(0, 2).join('.');
      return NOMES[p] || null;
    }).filter(Boolean))];
    if (!lugares.length) return 'na Central';
    if (lugares.length === 1) return lugares[0];
    return `${lugares.slice(0, -1).join(', ')} e ${lugares[lugares.length - 1]}`;
  };

  function barraNovidade(chaves) {
    if (document.getElementById('central-novidade')) return;
    const b = document.createElement('div');
    b.id = 'central-novidade';
    b.innerHTML = `<span>Alguém mexeu ${ondeFoi(chaves)}.</span>
      <button type="button" data-atualiza>Atualizar</button>
      <button type="button" data-depois aria-label="Fechar">×</button>`;
    b.style.cssText = `position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:99999;
      display:flex;align-items:center;gap:12px;padding:10px 12px 10px 16px;border-radius:999px;
      background:#121415;color:#fff;font:500 12px/1 ${FONTE};box-shadow:0 8px 28px rgba(0,0,0,.28)`;
    b.querySelector('[data-atualiza]').style.cssText = `border:0;border-radius:999px;padding:7px 14px;
      background:#fff;color:#121415;font:700 12px/1 ${FONTE};cursor:pointer`;
    b.querySelector('[data-depois]').style.cssText = `border:0;background:transparent;color:#9aa0a5;
      font-size:16px;line-height:1;cursor:pointer;padding:0 2px`;
    b.querySelector('[data-atualiza]').onclick = () => location.reload();
    b.querySelector('[data-depois]').onclick = () => b.remove();
    document.body.appendChild(b);
  }

  function vigiar(sb, uid) {
    let olhando = false;
    const olhar = async () => {
      if (olhando || document.hidden) return;
      olhando = true;
      try {
        const chaves = await novidades(sb, uid);
        if (chaves.length) barraNovidade(chaves);
      } catch { /* rede oscilando não vira aviso */ }
      olhando = false;
    };
    setInterval(olhar, 25000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) olhar() });
    window.addEventListener('focus', olhar);
  }

  /* ================= a tela de entrar ================= */

  /* As mensagens do Supabase vêm em inglês e algumas não dizem nada a quem
     está do outro lado ("Invalid login credentials"). Traduzidas para o que
     a pessoa precisa fazer a seguir. */
  function recado(msg) {
    const m = String(msg || '');
    if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha não conferem.';
    if (/Email not confirmed/i.test(m))       return 'Esse e-mail ainda não foi confirmado. Procure a mensagem de confirmação na caixa de entrada.';
    if (/rate limit|too many|after \d+ seconds/i.test(m)) return 'Muitas tentativas seguidas. Espere um minuto e tente de novo.';
    if (/User already registered|already been registered/i.test(m))
      return 'Esse e-mail já tem conta. Volte para "Já tenho conta" e entre.';
    if (/Password should be at least/i.test(m)) return 'A senha é curta demais. Use pelo menos 8 caracteres.';
    if (/[Pp]assword.*(pwned|compromised|leaked|data breach)/i.test(m))
      return 'Essa senha aparece em vazamentos conhecidos e o Supabase não aceita. Escolha outra.';
    if (/Database error saving new user/i.test(m))
      return 'A conta não foi criada por um erro no banco. Tente de novo; se repetir, avise o Vitor.';
    if (/[Ss]ignups? not allowed|[Ss]ignup is disabled/i.test(m))
      return 'O cadastro está desligado no servidor. Avise o Vitor.';
    if (/Failed to fetch|NetworkError/i.test(m)) return 'Não consegui falar com o servidor. Verifique a conexão.';
    return m || 'Não consegui entrar.';
  }

  /* O que o Supabase devolve pendurado no endereço quando o link falha. */
  function recadoLink(m) {
    const t = String(m || '');
    if (/expired|otp_expired/i.test(t))
      return 'Esse link já venceu. Peça outro em "Esqueci minha senha" — ele vale por uma hora.';
    if (/already|used/i.test(t))
      return 'Esse link já foi usado. Peça outro em "Esqueci minha senha".';
    return 'O link não funcionou. Peça outro em "Esqueci minha senha".';
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
      .ent-quem{margin-top:7px;font-size:12px;line-height:1.45}
      .ent-quem:empty{margin-top:0}
      .ent-quem.sim{color:#1a7f4b}
      .ent-quem.nao{color:#b06a12}
      .ent-dica{margin-top:6px;font-size:12px;color:#a4a8ac}
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

  /* A tela tem dois lados. Entrar é o de todo dia; criar conta é o de uma
     vez só, no primeiro acesso — e existe para o Vitor parar de abrir o
     Supabase e cadastrar cada pessoa na mão.

     Quem cria a conta não escolhe nome, papel, área nem marca: isso já
     está na lista de convites e o gatilho do banco monta o perfil com o
     que está lá. A pessoa escolhe só a senha dela. */
  function telaEntrar(sb, modo, aviso) {
    if (!document.body) {
      addEventListener('DOMContentLoaded', () => telaEntrar(sb, modo, aviso), { once: true });
      return;
    }
    estilos();
    /* O app pode já ter começado a desenhar atrás; a tela cobre tudo em vez
       de apagar o corpo, senão um erro de sessão levaria a página junto. */
    document.querySelectorAll('.ent-fundo').forEach((e) => e.remove());

    const criando = modo === 'cadastrar';

    const fundo = document.createElement('div');
    fundo.className = 'ent-fundo';
    fundo.innerHTML = `
      <div class="ent-cx">
        <div class="ent-marca">Central</div>
        <div class="ent-sub">${criando
          ? 'Crie a sua conta para entrar na operação.'
          : 'A operação da Botanika e da VermeFree.'}</div>
        <form class="ent-cartao" novalidate>
          <div class="ent-campo">
            <label class="ent-rot" for="ent-email">E-mail</label>
            <input id="ent-email" name="email" type="email" required
                   autocomplete="username" autocapitalize="off" spellcheck="false">
            <div class="ent-quem" data-quem></div>
          </div>
          <div class="ent-campo">
            <label class="ent-rot" for="ent-senha">${criando ? 'Crie uma senha' : 'Senha'}</label>
            <div class="ent-cai">
              <input id="ent-senha" name="senha" type="password" required
                     autocomplete="${criando ? 'new-password' : 'current-password'}">
              <button type="button" class="ent-olho" data-olho>mostrar</button>
            </div>
            ${criando ? '<div class="ent-dica">Pelo menos 8 caracteres.</div>' : ''}
          </div>
          ${criando ? `
          <div class="ent-campo">
            <label class="ent-rot" for="ent-senha2">Repita a senha</label>
            <input id="ent-senha2" name="senha2" type="password" required autocomplete="new-password">
          </div>` : ''}
          <button type="submit" class="ent-bt">${criando ? 'Criar minha conta' : 'Entrar'}</button>
          ${criando
            ? '<button type="button" class="ent-link" data-modo="entrar">Já tenho conta — entrar</button>'
            : '<button type="button" class="ent-link" data-esqueci>Esqueci minha senha</button>' +
              '<button type="button" class="ent-link" data-modo="cadastrar">Primeiro acesso — criar minha conta</button>'}
          <div class="ent-msg" role="status" aria-live="polite"></div>
        </form>
        <div class="ent-pe">${criando
          ? 'Só quem está na lista da equipe consegue criar conta.'
          : 'Acesso restrito à equipe.'}</div>
      </div>`;
    document.body.appendChild(fundo);

    const f      = fundo.querySelector('form');
    const email  = fundo.querySelector('#ent-email');
    const senha  = fundo.querySelector('#ent-senha');
    const senha2 = fundo.querySelector('#ent-senha2');
    const bt     = fundo.querySelector('.ent-bt');
    const msg    = fundo.querySelector('.ent-msg');
    const olho   = fundo.querySelector('[data-olho]');
    const quem   = fundo.querySelector('[data-quem]');

    const diz = (texto, tipo) => { msg.textContent = texto; msg.className = 'ent-msg ' + (tipo || ''); };

    for (const b of fundo.querySelectorAll('[data-modo]')) {
      b.onclick = () => telaEntrar(sb, b.dataset.modo);
    }

    if (aviso) diz(aviso, 'erro');

    /* Quem já entrou uma vez não precisa digitar o e-mail de novo. */
    const lembrado = localStorage.getItem(ULTIMO_EMAIL);
    if (lembrado && !criando) { email.value = lembrado; senha.focus(); } else { email.focus(); }

    olho.onclick = () => {
      const escondida = senha.type === 'password';
      senha.type = escondida ? 'text' : 'password';
      olho.textContent = escondida ? 'ocultar' : 'mostrar';
      senha.focus();
    };

    /* ---------- de quem é este e-mail ----------
       A lista de convites tem RLS e quem está criando conta ainda não
       entrou; quem responde é a função `convite_de`, que devolve só o
       nome. Serve para dois erros que aconteceriam sempre: digitar um
       endereço parecido mas diferente do que está na lista, e tentar
       criar conta de novo quando já existe uma. */
    let convite = null;
    let conferido = '';
    async function conferirEmail() {
      const e = email.value.trim();
      convite = null;
      conferido = e;
      quem.textContent = '';
      quem.className = 'ent-quem';
      if (!criando || !e) return;
      try {
        const { data, error } = await sb.rpc('convite_de', { p_email: e });
        if (error || !data) { conferido = ''; return }
        convite = data;
        if (data.erro) return;
        if (!data.convidado) {
          quem.textContent = 'Esse e-mail não está na lista da equipe. Confira se digitou certo — ou peça ao Vitor para incluir.';
          quem.className = 'ent-quem nao';
        } else if (data.ja_tem_conta) {
          quem.textContent = `${data.nome} já tem conta com esse e-mail. Entre em vez de criar de novo.`;
          quem.className = 'ent-quem nao';
        } else {
          quem.textContent = `Conta de ${data.nome}.`;
          quem.className = 'ent-quem sim';
        }
      } catch { conferido = '' /* sem resposta, segue: o banco ainda barra na hora */ }
    }
    if (criando) {
      email.addEventListener('blur', conferirEmail);
      email.addEventListener('change', conferirEmail);
    }

    /* ---------- criar conta ---------- */
    async function cadastrar() {
      const e = email.value.trim();
      if (!e || !senha.value) { diz('Preencha o e-mail e a senha.', 'erro'); (!e ? email : senha).focus(); return }
      if (senha.value.length < 8) { diz('A senha precisa de pelo menos 8 caracteres.', 'erro'); senha.focus(); return }
      if (senha.value !== senha2.value) { diz('As duas senhas estão diferentes.', 'erro'); senha2.select(); return }

      bt.disabled = true;
      diz('Criando…', 'indo');
      if (conferido !== e) await conferirEmail();
      if (convite && convite.convidado === false) {
        bt.disabled = false;
        diz('Esse e-mail não está na lista da equipe, então a conta não daria acesso a nada. Confira o endereço ou peça ao Vitor para incluir.', 'erro');
        email.setAttribute('aria-invalid', 'true');
        email.focus();
        return;
      }

      const { data, error } = await sb.auth.signUp({
        email: e,
        password: senha.value,
        options: { emailRedirectTo: location.origin },
      });
      if (error) { bt.disabled = false; diz(recado(error.message), 'erro'); return }

      gravarLocal(ULTIMO_EMAIL, e);

      /* Três desfechos, e o Supabase os separa assim: sessão pronta quer
         dizer que a confirmação por e-mail está desligada e a pessoa já
         está dentro; sem sessão e sem identidade nenhuma é o jeito do
         Supabase dizer "esse e-mail já existe" sem contar isso a um
         estranho — aqui a gente conta, porque quem chegou nesta tela já
         sabia o endereço; o resto é o link de confirmação a caminho. */
      if (data && data.session) {
        sessionStorage.removeItem(MARCA_RELOAD);
        location.reload();
        return;
      }
      const identidades = (data && data.user && data.user.identities) || [];
      if (!identidades.length) {
        bt.disabled = false;
        diz('Esse e-mail já tem conta. Volte para "Já tenho conta" e entre — se não lembra a senha, use "Esqueci minha senha".', 'erro');
        return;
      }
      f.innerHTML =
        '<div style="font-weight:600;margin-bottom:6px">Falta um clique.</div>' +
        '<div style="color:#7e8389">Mandei um e-mail de confirmação para <strong>' + e +
        '</strong>. Abra e clique no link para terminar o cadastro — depois é só entrar por aqui. ' +
        'Se não aparecer em alguns minutos, olhe no spam.</div>' +
        '<button type="button" class="ent-bt" style="margin-top:18px">Ir para a tela de entrar</button>';
      f.querySelector('button').onclick = () => telaEntrar(sb, 'entrar');
    }

    /* ---------- entrar ---------- */
    async function entrar() {
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
    }

    f.onsubmit = (ev) => { ev.preventDefault(); (criando ? cadastrar : entrar)() };

    const esqueci = fundo.querySelector('[data-esqueci]');
    if (esqueci) esqueci.onclick = async () => {
      const e = email.value.trim();
      if (!e) { diz('Escreva o e-mail primeiro — o link vai para ele.', 'erro'); email.focus(); return; }
      diz('Enviando…', 'indo');
      const { error } = await sb.auth.resetPasswordForEmail(e, { redirectTo: location.origin });
      diz(error ? recado(error.message)
                : 'Se esse e-mail estiver cadastrado, o link para trocar a senha já está a caminho.',
          error ? 'erro' : 'ok');
    };
  }

  /* O "Esqueci minha senha" já mandava o link, e o link já trazia a pessoa
     de volta logada — só que sem trocar senha nenhuma. Na próxima vez ela
     esbarraria na mesma senha esquecida. Aqui é onde ela escolhe a nova.

     Enquanto o Vitor cadastrava as contas na mão isso quase não acontecia;
     com oito pessoas escolhendo a própria senha, acontece. */
  function telaSenhaNova(sb) {
    if (!document.body) {
      addEventListener('DOMContentLoaded', () => telaSenhaNova(sb), { once: true });
      return;
    }
    estilos();
    document.querySelectorAll('.ent-fundo').forEach((e) => e.remove());

    const fundo = document.createElement('div');
    fundo.className = 'ent-fundo';
    fundo.innerHTML = `
      <div class="ent-cx">
        <div class="ent-marca">Central</div>
        <div class="ent-sub">Escolha uma senha nova.</div>
        <form class="ent-cartao" novalidate>
          <div class="ent-campo">
            <label class="ent-rot" for="ent-senha">Senha nova</label>
            <div class="ent-cai">
              <input id="ent-senha" name="senha" type="password" required autocomplete="new-password">
              <button type="button" class="ent-olho" data-olho>mostrar</button>
            </div>
            <div class="ent-dica">Pelo menos 8 caracteres.</div>
          </div>
          <div class="ent-campo">
            <label class="ent-rot" for="ent-senha2">Repita a senha</label>
            <input id="ent-senha2" name="senha2" type="password" required autocomplete="new-password">
          </div>
          <button type="submit" class="ent-bt">Salvar e entrar</button>
          <div class="ent-msg" role="status" aria-live="polite"></div>
        </form>
        <div class="ent-pe">Esse link vale uma vez só.</div>
      </div>`;
    document.body.appendChild(fundo);

    const f      = fundo.querySelector('form');
    const senha  = fundo.querySelector('#ent-senha');
    const senha2 = fundo.querySelector('#ent-senha2');
    const bt     = fundo.querySelector('.ent-bt');
    const msg    = fundo.querySelector('.ent-msg');
    const olho   = fundo.querySelector('[data-olho]');
    const diz = (t, tipo) => { msg.textContent = t; msg.className = 'ent-msg ' + (tipo || '') };
    senha.focus();

    olho.onclick = () => {
      const escondida = senha.type === 'password';
      senha.type = escondida ? 'text' : 'password';
      olho.textContent = escondida ? 'ocultar' : 'mostrar';
      senha.focus();
    };

    f.onsubmit = async (ev) => {
      ev.preventDefault();
      if (senha.value.length < 8) { diz('A senha precisa de pelo menos 8 caracteres.', 'erro'); senha.focus(); return }
      if (senha.value !== senha2.value) { diz('As duas senhas estão diferentes.', 'erro'); senha2.select(); return }
      bt.disabled = true;
      diz('Salvando…', 'indo');
      const { error } = await sb.auth.updateUser({ password: senha.value });
      if (error) { bt.disabled = false; diz(recado(error.message), 'erro'); return }
      /* Sem a marca a hidratação roda de novo, e sem o endereço na barra o
         F5 não tenta usar de novo um link que já foi gasto. */
      sessionStorage.removeItem(MARCA_RELOAD);
      location.replace(location.pathname + location.search);
    };
  }

  /* A conta existe, a pessoa entrou — e não está liberada. Acontece com
     quem criou conta com um e-mail fora da lista: o gatilho monta o perfil
     desativado e o RLS não deixa ler nada. Sem esta tela, a operação
     abriria vazia, sem tarefa nem campanha nenhuma, e a pessoa acharia que
     o sistema quebrou. */
  function semLiberacao(sb, sessao) {
    if (!document.body) {
      addEventListener('DOMContentLoaded', () => semLiberacao(sb, sessao), { once: true });
      return;
    }
    estilos();
    document.querySelectorAll('.ent-fundo').forEach((e) => e.remove());
    const fundo = document.createElement('div');
    fundo.className = 'ent-fundo';
    fundo.innerHTML =
      '<div class="ent-cx"><div class="ent-marca">Central</div>' +
      '<div class="ent-cartao"><div style="font-weight:600;margin-bottom:6px">Conta criada, acesso ainda não.</div>' +
      '<div style="color:#7e8389">O e-mail <strong>' + (sessao.user.email || '') + '</strong> não está na lista da ' +
      'equipe, então a conta entrou sem permissão de ver a operação. Se você usa outro endereço aqui dentro, ' +
      'saia e crie a conta com ele; se for esse mesmo, peça ao Vitor para liberar.</div>' +
      '<button type="button" class="ent-bt" style="margin-top:18px">Sair</button>' +
      '</div></div>';
    fundo.querySelector('button').onclick = async () => {
      await sb.auth.signOut();
      sessionStorage.removeItem(MARCA_RELOAD);
      location.reload();
    };
    document.body.appendChild(fundo);
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
  /* o que o banco tinha da última vez que olhamos, por chave: é o terceiro
     lado da junção, e sem ele não dá para saber o que fui eu que mudei */
  const base = new Map();

  async function hidratar(sb, uid) {
    const { data, error } = await sb.from(TABELA)
      .select('chave, valor, dono')
      .or(`dono.is.null,dono.eq.${uid}`);
    if (error) throw error;

    let mudou = false;
    for (const linha of data || []) {
      base.set(linha.chave, linha.valor);
      const texto = JSON.stringify(linha.valor);
      if (localStorage.getItem(linha.chave) !== texto) { gravarLocal(linha.chave, texto); mudou = true; }
    }
    return mudou;
  }

  /* Olha o banco sem mexer na tela. Serve para avisar que chegou coisa
     nova de outra pessoa — escrever por baixo enquanto alguém está no meio
     de uma edição seria pior do que não avisar. */
  async function novidades(sb, uid) {
    const { data, error } = await sb.from(TABELA)
      .select('chave, valor, dono')
      .or(`dono.is.null,dono.eq.${uid}`);
    if (error) return [];
    return (data || [])
      .filter((l) => !soLocal(l.chave) && localStorage.getItem(l.chave) !== JSON.stringify(l.valor))
      .map((l) => l.chave);
  }

  /* ================= mandar de volta o que o app gravar ================= */
  let espelhando = false;
  /* uma fila por chave: duas gravações seguidas da mesma lista não podem
     ler o banco ao mesmo tempo e escrever uma por cima da outra */
  const fila = new Map();

  async function subir(sb, uid, chave, valor) {
    const dono = ehPessoal(chave) ? uid : null;
    let final = valor;
    try {
      const busca = sb.from(TABELA).select('valor').eq('chave', chave);
      const { data } = await (dono === null ? busca.is('dono', null) : busca.eq('dono', dono)).maybeSingle();
      if (data) final = juntar(base.get(chave), valor, data.valor);
    } catch (e) {
      /* sem conseguir ler, sobe o meu: pior é não salvar */
      console.info('[central] não li o estado do banco antes de salvar:', (e && e.message) || e);
    }
    const { error } = await sb.from(TABELA).upsert(
      { chave, dono, valor: final,
        atualizado_em: new Date().toISOString(), atualizado_por: uid },
      { onConflict: 'chave,dono' });
    if (error) { console.error('[central] não salvou:', chave, error.message); return }
    base.set(chave, final);
    const texto = JSON.stringify(final);
    if (localStorage.getItem(chave) !== texto) gravarLocal(chave, texto);
  }

  function espelhar(sb, uid) {
    if (espelhando) return;
    espelhando = true;
    localStorage.setItem = function (chave, texto) {
      gravarLocal(chave, texto);
      if (!ehNossa(chave) || soLocal(chave)) return;
      let valor;
      try { valor = JSON.parse(texto); } catch { return; }
      const antes = fila.get(chave) || Promise.resolve();
      fila.set(chave, antes.then(() => subir(sb, uid, chave, valor)).catch(() => {}));
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
    /* Lido ANTES de criar o cliente: o supabase-js consome o endereço para
       montar a sessão e limpa o que estava lá, então depois não dá mais
       para saber que a pessoa chegou por um link de recuperação. */
    const trecho = String(location.hash || '').replace(/^#/, '');
    const veio = new URLSearchParams(trecho);
    const recuperando = veio.get('type') === 'recovery';
    const recusa = veio.get('error_description') || veio.get('error');

    const sb = window.supabase.createClient(URL_SB, CHAVE_SB);
    /* o Painel precisa do token de quem está logado para falar com /api/painel */
    window.CentralSessao = () => sb.auth.getSession().then((r) => (r.data && r.data.session) || null).catch(() => null);
    const { data: { session } } = await sb.auth.getSession();

    /* Link de recuperação vencido ou já usado: sem isto a pessoa cairia na
       tela de entrar sem entender por que o link não funcionou. */
    if (recusa && !session) return telaEntrar(sb, 'entrar', recadoLink(recusa));
    if (!session) return telaEntrar(sb);

    /* Chegou pelo link do "esqueci minha senha": a senha se troca aqui,
       antes de qualquer outra coisa. */
    if (recuperando) return telaSenhaNova(sb);

    const uid = session.user.id;
    /* O cliente fica à mão dos módulos que leem tabelas de verdade
       (equipe, acessos). A sessão manda em tudo: o RLS decide o resto. */
    window.CentralDB = sb;
    window.CentralSessaoAtual = session;
    await marcarSessao(sb, session);

    /* Agora que qualquer um pode criar conta, o "entrou" e o "pode ver"
       deixaram de ser a mesma coisa. Quem não está liberado para antes de
       hidratar: sem isso ele veria a Central inteira desenhada e vazia. */
    if (window.CentralEu && window.CentralEu.ativo === false) return semLiberacao(sb, session);

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
    vigiar(sb, uid);

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
