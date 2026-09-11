/* ======================================================================
   O que volta sempre.

   Duas coisas moram aqui, e são a mesma ideia em duas escalas.

   1. A RECORRÊNCIA da tarefa. O campo existe na ficha desde o começo —
      "não repetir / diária / semanal / mensal" — e nada no sistema nunca
      olhou para ele. A pessoa marcava "semanal", fechava a tarefa, e ela
      simplesmente acabava. Agora, quando uma tarefa que se repete é
      concluída, a próxima nasce com a data seguinte.

   2. A ROTINA da área. O que se faz todo dia, toda semana e todo mês e
      não é tarefa de campanha: olhar o gerenciador de manhã, conferir a
      fila do atendimento, fechar o número da semana, revisar as réguas
      do mês. Isso não vira tarefa — viraria três mil e seiscentas linhas
      por ano e afogaria a lista. Vira uma lista curta que se marca, e o
      que fica guardado é só a marca do dia.

   O que as duas têm em comum: ninguém deveria precisar lembrar. Se volta
   sempre, o sistema é que traz de volta.
   ====================================================================== */
(function () {
  'use strict';

  const uid = () => (window.user && window.user.id) || 'vitor-gutierrez';
  const chaveTar = () => `central.tasks.${uid()}`;
  const CHAVE_ROT = 'central.rotina';
  const CHAVE_FEITOS = 'central.rotina.feitos';

  const esc = (t) => String(t ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const lerLista = (k) => { try { const v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : [] } catch { return [] } };
  const lerObj = (k) => { try { const v = JSON.parse(localStorage.getItem(k) || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {} } catch { return {} } };
  const novoId = (p) => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  const hojeSP = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const dISO = (s) => { const [a, m, d] = String(s || '').split('-').map(Number); return new Date(Date.UTC(a, (m || 1) - 1, d || 1)) };
  const iso = (d) => d.toISOString().slice(0, 10);
  const dBR = (s) => /^\d{4}-\d{2}-\d{2}/.test(String(s || '')) ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '—';
  const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

  /* ====================================================================
     1. A recorrência da tarefa
     ==================================================================== */

  /* Um mês adiante mantendo o dia; 31 de janeiro vira 28 ou 29 de
     fevereiro, e não 3 de março, que é o que somar 31 dias faria. */
  function maisUmMes(d) {
    const dia = d.getUTCDate();
    const fora = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
    const ultimo = new Date(Date.UTC(fora.getUTCFullYear(), fora.getUTCMonth() + 1, 0)).getUTCDate();
    fora.setUTCDate(Math.min(dia, ultimo));
    return fora;
  }

  const PASSO = {
    daily:   (d) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + 1); return x },
    weekly:  (d) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + 7); return x },
    monthly: maisUmMes,
  };

  /* A próxima data que ainda não passou.

     Somar um passo e pronto não serve: uma tarefa diária fechada com três
     semanas de atraso nasceria vencida, e a pessoa abriria a Central com
     vinte e uma tarefas vermelhas que ninguém deixou de fazer. Então anda
     até alcançar hoje — com um teto, para um dado estranho não virar laço
     infinito. */
  function proxima(deQuando, tipo, dataHoje) {
    const passo = PASSO[tipo];
    if (!passo) return null;
    const hoje = dISO(dataHoje || hojeSP());
    let d = dISO(deQuando || dataHoje || hojeSP());
    for (let i = 0; i < 400; i++) {
      d = passo(d);
      if (d >= hoje) return iso(d);
    }
    return iso(d);
  }

  /* ====================================================================
     Girar: o que fechou e se repete volta para o fim da fila

     Não fica pendurado no clique de fechar. Um clique é um lugar só —
     e a tarefa fecha na lista, na ficha, e daqui a pouco vai fechar em
     outra tela. Pior: quem fechou foi o Pedro, no navegador dele; a Sarah
     precisa ver a próxima aparecer sem ter clicado em nada.

     Então é uma varredura: toda tarefa concluída que se repete e ainda
     não gerou a seguinte, gera. Roda ao abrir e depois de mexer na lista.

     O id da nova é calculado da origem e da data, e não sorteado. Se o
     Pedro e a Sarah girarem a mesma tarefa antes de sincronizar, os dois
     chegam no mesmo id e a junção do banco funde as duas em uma — em vez
     de a operação ganhar duas cópias da mesma tarefa de segunda-feira. */
  function girar(dataHoje) {
    const todas = (window.__centralGetTasks && window.__centralGetTasks()) || lerLista(chaveTar());
    const existe = new Set(todas.map((t) => String(t.id)));
    const novas = [];

    for (const t of todas) {
      if (t.status !== 'feito' || t.repetiu) continue;
      const tipo = String(t.recurrence || 'none');
      if (!PASSO[tipo]) continue;

      const quando = proxima(t.due, tipo, dataHoje);
      if (!quando) continue;
      const id = `${t.id}~${quando}`;
      t.repetiu = quando;                      /* marca a origem: não gira de novo */
      if (existe.has(id)) continue;

      novas.push({
        ...JSON.parse(JSON.stringify(t)),
        id,
        status: 'a fazer',
        due: quando,
        start: null,
        repetiu: undefined,
        /* o que foi feito na vez passada não vem junto: o checklist volta
           desmarcado, e comentário e histórico ficam na tarefa de origem */
        checklist: (t.checklist || []).map((c) => ({ ...c, id: novoId('c'), done: false })),
        subtasks: (t.subtasks || []).map((s) => ({ ...s, id: novoId('s'), done: false })),
        comments: [],
        history: [{ at: 'Agora', text: `Repetição de "${t.title}" de ${dBR(t.due)}.` }],
        conferencia: undefined,
      });
      existe.add(id);
    }

    if (!novas.length) {
      /* mesmo sem tarefa nova, a marca de "já repetiu" precisa ser gravada */
      if (todas.some((t) => t.repetiu)) gravarTarefas(todas);
      return { criadas: 0 };
    }
    todas.push(...novas);
    gravarTarefas(todas);
    return { criadas: novas.length, tarefas: novas };
  }

  function gravarTarefas(todas) {
    try { localStorage.setItem(chaveTar(), JSON.stringify(todas)) } catch {}
    const c = document.getElementById('taskNavCount');
    if (c) c.textContent = todas.filter((t) => t.status !== 'feito').length;
    const lista = document.getElementById('tasksView');
    if (lista && lista.classList.contains('active')) window.__centralShowTasks?.();
  }

  /* ====================================================================
     2. A rotina da área
     ==================================================================== */

  const CADENCIAS = [
    { id: 'diaria',  nome: 'Todo dia',    curto: 'dia' },
    { id: 'semanal', nome: 'Toda semana', curto: 'semana' },
    { id: 'mensal',  nome: 'Todo mês',    curto: 'mês' },
  ];

  const R = (titulo, area, cadencia, dia) => ({ titulo, area, cadencia, dia: dia == null ? null : dia });

  /* De fábrica: o que a operação já faz e ninguém tinha escrito em lugar
     nenhum — está nos rituais (daily de manhã, KPI na quinta) e nas
     métricas que cada área leva para a reunião. */
  const FABRICA = [
    R('Daily da operação', 'gestao', 'diaria', null),
    R('Olhar o faturamento do dia anterior contra a meta do mês', 'gestao', 'diaria', null),
    R('Reunião de KPI', 'gestao', 'semanal', 4),
    R('Fechar o número da semana de cada área', 'gestao', 'semanal', 5),
    R('Fechar o mês: meta, realizado e o que explica a diferença', 'gestao', 'mensal', 1),

    R('Ler o gerenciador: gasto, ROAS e o que caiu desde ontem', 'trafego', 'diaria', null),
    R('Conferir se o site está de pé e sem oferta vencida no ar', 'trafego', 'diaria', null),
    R('Remanejar verba entre campanhas com o resultado da semana', 'trafego', 'semanal', 1),
    R('Revisar criativos cansados e subir substitutos', 'trafego', 'semanal', 3),
    R('Fechar o mês do tráfego: gasto, ROAS, CPA e o que muda', 'trafego', 'mensal', 1),

    R('Subir stories do dia', 'social-media', 'diaria', null),
    R('Responder o direct e os comentários', 'social-media', 'diaria', null),
    R('Montar o planejamento de feed da semana', 'social-media', 'semanal', 1),
    R('Levantar os posts que mais renderam e por quê', 'social-media', 'semanal', 5),
    R('Fechar o mês do Instagram: seguidores, alcance e vendas por link', 'social-media', 'mensal', 1),

    R('Conferir os envios que saíram: e-mail, grupos e API', 'automacoes', 'diaria', null),
    R('Olhar o gasto da API contra o combinado', 'automacoes', 'diaria', null),
    R('Revisar as réguas automáticas procurando oferta que já acabou', 'automacoes', 'semanal', 1),
    R('Fechar o número da semana: enviados e conversão por canal', 'automacoes', 'semanal', 5),
    R('Limpar a base: quem não abre há meses', 'automacoes', 'mensal', 1),

    R('Zerar a fila do atendimento', 'atendimento', 'diaria', null),
    R('Anotar a dúvida que mais se repetiu no dia', 'atendimento', 'diaria', null),
    R('Levar para a reunião as objeções que mais apareceram', 'atendimento', 'semanal', 4),
    R('Revisar as respostas prontas contra a oferta que está no ar', 'atendimento', 'mensal', 1),

    R('Falar com as influenciadoras que estão paradas', 'creators', 'semanal', 1),
    R('Conferir cupons e vendas de cada creator', 'creators', 'semanal', 5),
    R('Fechar o mês dos creators: quem rendeu, quem saiu, quem entrou', 'creators', 'mensal', 1),
  ];

  const deFabrica = () => FABRICA.map((r, i) => ({ ...r, id: `rot:${i}` }));

  function rotina() {
    const guardada = lerLista(CHAVE_ROT);
    return guardada.length ? guardada : deFabrica();
  }
  function gravarRotina(rs) {
    try { localStorage.setItem(CHAVE_ROT, JSON.stringify(rs)) } catch {}
  }

  /* ---------- o período de cada cadência ----------
     A marca precisa valer por um período inteiro, senão "feito" na terça
     apagaria o "feito" da segunda. Dia é o dia; semana é a segunda-feira
     daquela semana; mês é o ano-mês. */
  function periodoDe(cadencia, dataHoje) {
    const h = dataHoje || hojeSP();
    if (cadencia === 'mensal') return h.slice(0, 7);
    if (cadencia === 'semanal') {
      const d = dISO(h);
      const desloc = (d.getUTCDay() + 6) % 7;          /* segunda = 0 */
      d.setUTCDate(d.getUTCDate() - desloc);
      return iso(d);
    }
    return h;
  }

  const chaveFeito = (item, dataHoje) => `${item.id}|${periodoDe(item.cadencia, dataHoje)}`;

  const feitos = () => lerObj(CHAVE_FEITOS);

  function estaFeito(item, dataHoje) {
    return !!feitos()[chaveFeito(item, dataHoje)];
  }

  function marcar(item, ligado, dataHoje) {
    const f = feitos();
    const k = chaveFeito(item, dataHoje);
    if (ligado) {
      const eu = (window.CentralEu && window.CentralEu.nome) || (window.user && window.user.firstName) || 'alguém';
      f[k] = { quem: eu, em: new Date().toISOString() };
    } else {
      delete f[k];
    }
    /* A marca de ontem não interessa a ninguém e cresceria para sempre:
       guarda as das últimas semanas e os meses do ano, e larga o resto. */
    podar(f, dataHoje);
    try { localStorage.setItem(CHAVE_FEITOS, JSON.stringify(f)) } catch {}
    return f;
  }

  function podar(f, dataHoje) {
    const h = dISO(dataHoje || hojeSP());
    const corte = new Date(h); corte.setUTCDate(corte.getUTCDate() - 60);
    for (const k of Object.keys(f)) {
      const p = k.slice(k.lastIndexOf('|') + 1);
      if (/^\d{4}-\d{2}$/.test(p)) continue;                     /* mês fica */
      if (/^\d{4}-\d{2}-\d{2}$/.test(p) && dISO(p) >= corte) continue;
      delete f[k];
    }
  }

  /* ---------- o que a área tem para hoje ---------- */
  function daArea(slug, dataHoje) {
    const h = dataHoje || hojeSP();
    const diaSemana = dISO(h).getUTCDay();
    const diaMes = +h.slice(8, 10);
    const todas = rotina().filter((r) => !slug || r.area === slug);

    /* Semanal e mensal com dia marcado só aparecem no dia; sem dia
       marcado, aparecem o período inteiro, porque não há quando. */
    const cabeHoje = (r) => {
      if (r.cadencia === 'diaria') return true;
      if (r.dia == null) return true;
      if (r.cadencia === 'semanal') return +r.dia === diaSemana;
      return +r.dia === diaMes || (diaMes === 1 && +r.dia > 28);
    };

    return CADENCIAS.map((c) => ({
      cadencia: c,
      itens: todas.filter((r) => r.cadencia === c.id).map((r) => ({
        ...r, hoje: cabeHoje(r), feito: estaFeito(r, h),
      })),
    })).filter((g) => g.itens.length);
  }

  window.Rotina = {
    proxima, girar, PASSO,
    rotina, gravarRotina, deFabrica, daArea, periodoDe, estaFeito, marcar, feitos,
    CADENCIAS, DIAS, CHAVE_ROT, CHAVE_FEITOS,
  };

  /* ---------- quando girar ----------
     Ao abrir, e depois que alguém mexeu na lista de tarefas. O clique é
     ouvido na subida, sem atrapalhar ninguém: quando chega aqui, o app já
     mudou o status e gravou. */
  const girarDepois = () => setTimeout(() => { try { girar() } catch (e) { console.warn('[rotina]', e.message) } }, 60);

  function ligar() {
    girarDepois();
    document.addEventListener('click', (e) => {
      if (e.target.closest?.('[data-toggle-done], #taskSaveBtn')) girarDepois();
    });
    /* estado que chegou de outra pessoa pela ponte */
    window.addEventListener('storage', (e) => { if (e.key === chaveTar()) girarDepois() });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ligar); else ligar();
})();
