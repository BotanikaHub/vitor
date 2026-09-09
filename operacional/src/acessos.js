/* ======================================================================
   Acessos — quem entra na Central, e com que permissão.

   Esta é a única tela que fala com as tabelas de verdade do banco em vez
   do localStorage: `profiles` (quem já entrou), `equipe_convites` (quem
   foi cadastrado e ainda não entrou), `areas`, `brands` e
   `profile_brands`. Quem manda no que pode ser salvo é o RLS do banco —
   admin edita todo mundo, o resto só lê. A tela reflete isso: sem ser
   admin, os campos vêm desabilitados e a tela diz por quê.

   Como uma pessoa passa a ter acesso:

     1. entra na lista aqui (e-mail, nome, papel, área, marcas);
     2. alguém cria a conta dela no Supabase com esse mesmo e-mail;
     3. na primeira entrada, o gatilho `ao_criar_usuario` lê a lista e
        monta o perfil já liberado, com papel, área e marcas.

   Sem passo 1, quem cria conta chega bloqueado e não enxerga nada — as
   regras do banco pedem `estou_ativo()`.
   ====================================================================== */
(function () {
  'use strict';

  const esc = (t) => String(t ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const PAPEIS = [
    { id: 'admin',   nome: 'Admin',   diz: 'muda acessos, papéis e metas de todo mundo' },
    { id: 'gestor',  nome: 'Gestor',  diz: 'enxerga as duas marcas e conduz a operação' },
    { id: 'membro',  nome: 'Membro',  diz: 'trabalha nas marcas em que está' },
    { id: 'externo', nome: 'Externo', diz: 'parceiro de fora: não enxerga a operação' },
  ];
  const papelNome = (id) => (PAPEIS.find((p) => p.id === id) || {}).nome || id || '—';
  const eMail = (e) => /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(String(e || '').trim());

  const db = () => window.CentralDB || null;
  const eu = () => window.CentralEu || null;
  const souAdmin = () => !!(eu() && eu().papel === 'admin' && eu().ativo);

  /* ---------- o que veio do banco ---------- */
  const cache = { em: 0, areas: [], marcas: [], perfis: [], convites: [], vinculos: [], erro: null };

  async function carregar(forcar) {
    const sb = db();
    if (!sb) { cache.erro = 'sem sessão'; return cache }
    if (!forcar && Date.now() - cache.em < 20000) return cache;
    /* Se o cliente do Supabase não for o de verdade (teste, sessão a
       meio caminho), nada disto responde — e a tela precisa dizer isso em
       vez de derrubar o Painel inteiro. */
    try {
      return await buscar(sb);
    } catch (e) {
      cache.erro = e.message || String(e); cache.em = Date.now();
      cache.areas = []; cache.marcas = []; cache.perfis = []; cache.convites = []; cache.vinculos = [];
      return cache;
    }
  }

  async function buscar(sb) {
    const [areas, marcas, perfis, convites, vinculos] = await Promise.all([
      sb.from('areas').select('id, nome, slug, ordem').order('ordem'),
      sb.from('brands').select('id, nome, slug, ativo').order('nome'),
      sb.from('profiles').select('id, nome, email, papel, ativo, cargo, area_id, criado_em').order('nome'),
      sb.from('equipe_convites').select('email, nome, nome_clickup, cargo, papel, area_id, marcas, observacao, criado_em').order('nome'),
      sb.from('profile_brands').select('profile_id, brand_id'),
    ]);
    const erro = [areas, marcas, perfis, convites, vinculos].map((r) => r.error).find(Boolean);
    cache.erro = erro ? erro.message : null;
    cache.areas = areas.data || []; cache.marcas = marcas.data || [];
    cache.perfis = perfis.data || []; cache.convites = convites.data || [];
    cache.vinculos = vinculos.data || [];
    cache.em = Date.now();
    return cache;
  }

  const areaNome = (id) => (cache.areas.find((a) => a.id === id) || {}).nome || '';
  const marcaNome = (id) => (cache.marcas.find((m) => m.id === id) || {}).nome || '';
  const marcasDoPerfil = (id) => cache.vinculos.filter((v) => v.profile_id === id).map((v) => v.brand_id);

  /* A equipe é a soma dos dois lados: quem já entrou e quem só está na
     lista. O e-mail é a chave — um convite cujo e-mail já virou perfil
     some da lista de espera e vira a linha do perfil. */
  function equipe() {
    const porEmail = new Map();
    for (const c of cache.convites) porEmail.set(c.email, {
      email: c.email, nome: c.nome, nomeClickup: c.nome_clickup || '', cargo: c.cargo || '',
      papel: c.papel, areaId: c.area_id, marcas: c.marcas || [], observacao: c.observacao || '',
      temAcesso: false, ativo: false, id: null, desde: c.criado_em,
    });
    for (const p of cache.perfis) {
      const conv = porEmail.get(p.email) || {};
      porEmail.set(p.email, {
        email: p.email, nome: p.nome, nomeClickup: conv.nomeClickup || '', cargo: p.cargo || conv.cargo || '',
        papel: p.papel, areaId: p.area_id || conv.areaId || null, marcas: marcasDoPerfil(p.id), observacao: conv.observacao || '',
        temAcesso: true, ativo: p.ativo, id: p.id, desde: p.criado_em,
      });
    }
    return [...porEmail.values()].sort((a, b) =>
      (b.temAcesso - a.temAcesso) || (b.ativo - a.ativo) ||
      PAPEIS.findIndex((x) => x.id === a.papel) - PAPEIS.findIndex((x) => x.id === b.papel) ||
      String(a.nome).localeCompare(String(b.nome)));
  }

  /* ---------- gravar ---------- */
  async function salvarPessoa(email, campos) {
    const sb = db(); if (!sb) throw new Error('sem sessão');
    const p = equipe().find((x) => x.email === email);
    if (!p) throw new Error('pessoa fora da lista');

    if (p.temAcesso) {
      const mudar = {};
      if ('nome' in campos)   mudar.nome = campos.nome;
      if ('cargo' in campos)  mudar.cargo = campos.cargo || null;
      if ('papel' in campos)  mudar.papel = campos.papel;
      if ('areaId' in campos) mudar.area_id = campos.areaId || null;
      if ('ativo' in campos)  mudar.ativo = campos.ativo;
      if (Object.keys(mudar).length) {
        const { error } = await sb.from('profiles').update(mudar).eq('id', p.id);
        if (error) throw error;
      }
      if ('marcas' in campos) {
        const antes = new Set(marcasDoPerfil(p.id)), agora = new Set(campos.marcas);
        const tirar = [...antes].filter((x) => !agora.has(x));
        const por = [...agora].filter((x) => !antes.has(x));
        if (tirar.length) {
          const { error } = await sb.from('profile_brands').delete().eq('profile_id', p.id).in('brand_id', tirar);
          if (error) throw error;
        }
        if (por.length) {
          const { error } = await sb.from('profile_brands').insert(por.map((b) => ({ profile_id: p.id, brand_id: b })));
          if (error) throw error;
        }
      }
    }

    /* O convite continua valendo depois que a pessoa entra: é onde mora o
       nome do ClickUp, e é o que reconstrói o perfil se a conta for
       refeita um dia. */
    const conv = {};
    if ('nome' in campos)        conv.nome = campos.nome;
    if ('cargo' in campos)       conv.cargo = campos.cargo || null;
    if ('papel' in campos)       conv.papel = campos.papel;
    if ('areaId' in campos)      conv.area_id = campos.areaId || null;
    if ('marcas' in campos)      conv.marcas = campos.marcas;
    if ('nomeClickup' in campos) conv.nome_clickup = campos.nomeClickup || null;
    if ('observacao' in campos)  conv.observacao = campos.observacao || null;
    if (Object.keys(conv).length) {
      const existe = cache.convites.some((c) => c.email === email);
      const { error } = existe
        ? await sb.from('equipe_convites').update(conv).eq('email', email)
        : await sb.from('equipe_convites').insert({ email, nome: campos.nome || p.nome, ...conv });
      if (error) throw error;
    }
    await carregar(true);
  }

  async function convidar({ email, nome, papel, areaId, marcas, cargo, nomeClickup }) {
    const sb = db(); if (!sb) throw new Error('sem sessão');
    const { error } = await sb.from('equipe_convites').insert({
      email: String(email).toLowerCase().trim(), nome: String(nome).trim(),
      papel: papel || 'membro', area_id: areaId || null,
      marcas: marcas && marcas.length ? marcas : cache.marcas.filter((m) => m.ativo).map((m) => m.id),
      cargo: cargo || null, nome_clickup: nomeClickup || null,
      criado_por: (eu() || {}).id || null,
    });
    if (error) throw error;
    await carregar(true);
  }

  async function tirarDaLista(email) {
    const sb = db(); if (!sb) throw new Error('sem sessão');
    const { error } = await sb.from('equipe_convites').delete().eq('email', email);
    if (error) throw error;
    await carregar(true);
  }

  /* ---------- a tela ---------- */
  function selectArea(email, valor, pode) {
    return `<select data-ac-campo="areaId" data-ac-email="${esc(email)}" ${pode ? '' : 'disabled'}>` +
      `<option value="">sem área</option>${cache.areas.map((a) => `<option value="${a.id}" ${a.id === valor ? 'selected' : ''}>${esc(a.nome)}</option>`).join('')}</select>`;
  }
  function selectPapel(email, valor, pode) {
    return `<select data-ac-campo="papel" data-ac-email="${esc(email)}" ${pode ? '' : 'disabled'} title="${esc((PAPEIS.find((p) => p.id === valor) || {}).diz || '')}">` +
      PAPEIS.map((p) => `<option value="${p.id}" ${p.id === valor ? 'selected' : ''}>${esc(p.nome)}</option>`).join('') + '</select>';
  }
  function caixasMarca(email, marcas, pode) {
    return cache.marcas.filter((m) => m.ativo).map((m) => `<label class="ac-marca"><input type="checkbox" data-ac-campo="marca:${m.id}" data-ac-email="${esc(email)}" ${marcas.includes(m.id) ? 'checked' : ''} ${pode ? '' : 'disabled'}>${esc(m.nome)}</label>`).join('');
  }
  function selectClickup(email, valor, pode, nomes) {
    const opcoes = [...new Set([...nomes, valor].filter(Boolean))].sort();
    return `<select data-ac-campo="nomeClickup" data-ac-email="${esc(email)}" ${pode ? '' : 'disabled'}>` +
      `<option value="">— não é do ClickUp —</option>${opcoes.map((n) => `<option ${n === valor ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
  }

  function linha(p, pode, nomes) {
    const eEu = eu() && eu().email === p.email;
    return `<tr class="${p.temAcesso && !p.ativo ? 'ac-bloqueada' : ''}">` +
      `<td><b>${esc(p.nome)}</b>${eEu ? '<span class="ac-eu">você</span>' : ''}<small class="pn-sub">${esc(p.email)}</small></td>` +
      `<td><input data-ac-campo="cargo" data-ac-email="${esc(p.email)}" value="${esc(p.cargo)}" placeholder="cargo" ${pode ? '' : 'disabled'}></td>` +
      `<td>${selectPapel(p.email, p.papel, pode && !eEu)}</td>` +
      `<td>${selectArea(p.email, p.areaId, pode)}</td>` +
      `<td>${caixasMarca(p.email, p.marcas, pode)}</td>` +
      `<td>${selectClickup(p.email, p.nomeClickup, pode, nomes)}</td>` +
      `<td class="num">${p.temAcesso
        ? `<label class="ac-marca" title="desligar tira o acesso na hora"><input type="checkbox" data-ac-campo="ativo" data-ac-email="${esc(p.email)}" ${p.ativo ? 'checked' : ''} ${pode && !eEu ? '' : 'disabled'}>${p.ativo ? 'entra' : 'bloqueada'}</label>`
        : `<span class="pn-chip atencao">falta criar a conta</span>${pode ? `<button type="button" class="eq-x" data-ac-tira="${esc(p.email)}" title="tirar da lista">×</button>` : ''}`}</td></tr>`;
  }

  async function tela(ctx) {
    const { ui } = ctx;
    await carregar(false);
    if (cache.erro) return ui.cartao('Acessos', '', `<div class="pn-erro"><p>Não consegui ler a lista de acessos: ${esc(cache.erro)}</p><button type="button" class="cu-btn primary" data-painel-atualiza>Tentar de novo</button></div>`);

    const pode = souAdmin();
    const gente = equipe();
    const dentro = gente.filter((p) => p.temAcesso);
    const esperando = gente.filter((p) => !p.temAcesso);
    /* os nomes que assinam tarefa no ClickUp, para casar com a pessoa */
    const nomes = [...new Set((window.Equipe ? window.Equipe.tarefas() : []).flatMap((t) => t.assignees || []).filter(Boolean))];
    const semCasar = nomes.filter((n) => !gente.some((p) => p.nomeClickup === n));

    const cols = '<thead><tr><th>Pessoa</th><th>Cargo</th><th>Papel</th><th>Área</th><th>Marcas</th><th>Nome no ClickUp</th><th class="num">Acesso</th></tr></thead>';
    const tabela = (linhas) => `<div class="pn-rolagem"><table class="pn-tabela ac-tabela">${cols}<tbody>${linhas}</tbody></table></div>`;

    const aviso = pode ? '' : `<p class="pn-nota ac-so-leitura">Só um admin muda acesso, papel e área. Você está vendo a lista, mas os campos estão travados — é o banco que decide, não a tela.</p>`;

    const comoDarAcesso = `<div class="ac-passos">
      <p>Quem está na lista abaixo <b>ainda não tem conta</b>. Criar a conta é o único passo que não dá para fazer daqui — precisa do painel do Supabase, porque só ele cria senha:</p>
      <ol>
        <li>abra <b>supabase.com</b> → projeto da Central → <b>Authentication</b> → <b>Users</b>;</li>
        <li><b>Add user</b> → <b>Create new user</b>: cole o e-mail, escreva uma senha provisória e marque <i>Auto Confirm User</i>;</li>
        <li>mande o link da Central e a senha para a pessoa. Ela troca a senha em "esqueci minha senha" na tela de entrada.</li>
      </ol>
      <p>Na primeira entrada, o perfil já vem montado com o papel, a área e as marcas desta lista — não precisa liberar nada depois.</p>
      <button type="button" class="cu-btn" data-ac-copiar>Copiar os e-mails que faltam</button>
    </div>`;

    return aviso +
      ui.cartao('Quem entra na Central', `${dentro.filter((p) => p.ativo).length} com acesso · ${dentro.filter((p) => !p.ativo).length} bloqueadas`,
        dentro.length ? tabela(dentro.map((p) => linha(p, pode, nomes)).join('')) : ui.vazio('Ninguém entrou ainda.')) +
      ui.cartao('Cadastrados, esperando a conta', `${esperando.length} ${esperando.length === 1 ? 'pessoa' : 'pessoas'}`,
        (esperando.length ? tabela(esperando.map((p) => linha(p, pode, nomes)).join('')) : ui.vazio('Todo mundo da lista já entrou.')) +
        (esperando.length ? comoDarAcesso : '')) +
      (pode ? ui.cartao('Cadastrar mais alguém', 'o e-mail é o convite', `<form class="eq-form ac-form" data-ac-nova>
        <input name="email" type="email" placeholder="e-mail" required>
        <input name="nome" placeholder="Nome" required>
        <input name="cargo" placeholder="Cargo">
        <select name="papel">${PAPEIS.map((p) => `<option value="${p.id}" ${p.id === 'membro' ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select>
        <select name="area"><option value="">Área</option>${cache.areas.map((a) => `<option value="${a.id}">${esc(a.nome)}</option>`).join('')}</select>
        ${cache.marcas.filter((m) => m.ativo).map((m) => `<label class="ac-marca"><input type="checkbox" name="marca" value="${m.id}" checked>${esc(m.nome)}</label>`).join('')}
        <button type="submit" class="cu-btn primary">Cadastrar</button>
      </form>`) : '') +
      (semCasar.length ? ui.cartao('Nomes do ClickUp sem pessoa', 'quem assina tarefa mas não está na lista de acessos',
        `<div class="pn-lista-mini">${semCasar.map((n) => `<span>${esc(n)}</span>`).join('')}</div>
         <p class="pn-nota">Cadastre a pessoa com o e-mail dela e escolha o nome do ClickUp na coluna, ou deixe assim: a tarefa continua aparecendo, só não vira cartão de ninguém.</p>`) : '') +
      ui.cartao('O que cada papel pode', 'as regras valem no banco, não só na tela',
        `<div class="ac-papeis">${PAPEIS.map((p) => `<div><b>${esc(p.nome)}</b><span>${esc(p.diz)}</span></div>`).join('')}</div>`);
  }

  /* ---------- ligar ---------- */
  function ligar() {
    const P = window.Painel; if (!P) return;
    P.registrar({ id: 'acessos', nome: 'Acessos', semPeriodo: true, render: tela });
    P.acessos = { carregar, equipe, salvarPessoa, convidar, tirarDaLista, souAdmin, PAPEIS };

    const view = document.getElementById('painelView'); if (!view) return;
    const redesenhar = () => P.carregar(false);

    view.addEventListener('change', async (e) => {
      const el = e.target.closest('[data-ac-campo]'); if (!el) return;
      const email = el.dataset.acEmail, campo = el.dataset.acCampo;
      try {
        if (campo.startsWith('marca:')) {
          const p = equipe().find((x) => x.email === email);
          const m = new Set(p ? p.marcas : []);
          if (el.checked) m.add(campo.slice(6)); else m.delete(campo.slice(6));
          await salvarPessoa(email, { marcas: [...m] });
        } else if (campo === 'ativo') {
          await salvarPessoa(email, { ativo: el.checked });
        } else {
          await salvarPessoa(email, { [campo]: el.value });
        }
        window.showToast?.('Acesso salvo');
        if (campo === 'ativo' || campo === 'papel') redesenhar();
      } catch (err) {
        window.showToast?.(`Não salvou: ${err.message}`);
        redesenhar();
      }
    });

    view.addEventListener('click', async (e) => {
      const tira = e.target.closest('[data-ac-tira]');
      if (tira) {
        try { await tirarDaLista(tira.dataset.acTira); window.showToast?.('Tirei da lista'); redesenhar() }
        catch (err) { window.showToast?.(`Não deu: ${err.message}`) }
        return;
      }
      if (e.target.closest('[data-ac-copiar]')) {
        const faltam = equipe().filter((p) => !p.temAcesso).map((p) => p.email).join(', ');
        (navigator.clipboard ? navigator.clipboard.writeText(faltam) : Promise.reject())
          .then(() => window.showToast?.('E-mails copiados'), () => window.prompt('Copie os e-mails:', faltam));
      }
    });

    view.addEventListener('submit', async (e) => {
      const f = e.target; if (!f.matches('[data-ac-nova]')) return;
      e.preventDefault();
      const email = f.email.value.trim().toLowerCase();
      if (!eMail(email)) return window.showToast?.('E-mail inválido');
      const marcas = [...f.querySelectorAll('[name=marca]:checked')].map((x) => x.value);
      try {
        await convidar({ email, nome: f.nome.value, cargo: f.cargo.value, papel: f.papel.value, areaId: f.area.value, marcas });
        window.showToast?.(`${f.nome.value.trim()} entrou na lista`);
        redesenhar();
      } catch (err) { window.showToast?.(`Não cadastrei: ${err.message}`) }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ligar); else ligar();

  window.Acessos = { carregar, equipe, salvarPessoa, convidar, tirarDaLista, souAdmin, areaNome, marcaNome, PAPEIS, cache };
})();
