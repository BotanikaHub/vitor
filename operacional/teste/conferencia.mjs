/* A conferência antes da entrega.

   O que este teste precisa provar não é que a lista aparece — é que ela
   tranca. As três portas para o "feito" (o círculo da lista, o arrasto no
   quadro, o status na ficha) têm que recusar enquanto houver obrigatório
   em aberto, e destravar assim que fechar. */
import { chromium } from '/home/user/vitor/node_modules/playwright-core/index.mjs';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const srv = createServer((_, r) => { r.writeHead(200,{'content-type':'text/html; charset=utf-8'}); r.end(html) }).listen(0);
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const pag = await nav.newPage({ viewport: { width: 1440, height: 1000 } });
pag.on('pageerror', (e) => console.log('  [erro na página]', e.message));

const campanha = {
  id: 'c-diad', name: 'Dia D — 09/09', brand: 'Botanika', type: 'Dia D',
  status: 'Em execução', owner: 'Vitor Gutierrez', start: '2026-09-09', end: '2026-09-10',
  goal: 60000, budget: 6000, progress: 0, color: '#121415',
  objective: 'Ação relâmpago de 1 dia', offer: 'CUPOM DIAD9',
  channels: ['Instagram'], products: [{ name: 'Tri[Mg] Complex', price: 87.5, discount: 9 }],
  benefits: [], schedule: [], tap: [],
};

const tarefas = [
  { id: 't1', title: 'DIA D — Subir criativos no gerenciador de anúncios', status: 'a fazer',
    description: 'Campanha de tráfego do Dia D', assignees: ['Ítalo Neves'], due: '2026-09-09',
    brand: 'Botanika', project: 'Dia D', priority: 'urgent', recurrence: 'none',
    subtasks: [], checklist: [], attachments: [], comments: [], history: [] },
  { id: 't2', title: 'DIA D — Programar o disparo de e-mail', status: 'a fazer',
    description: '', assignees: ['Sarah'], due: '2026-09-09',
    brand: 'Botanika', project: 'Dia D', priority: 'high', recurrence: 'none',
    subtasks: [], checklist: [], attachments: [], comments: [], history: [] },
  { id: 't4', title: 'DIA D — Revisar a página da coleção no site', status: 'a fazer',
    description: '', assignees: ['Pedro'], due: '2026-09-09',
    brand: 'Botanika', project: 'Dia D', priority: 'normal', recurrence: 'none',
    subtasks: [], checklist: [], attachments: [], comments: [], history: [] },
  { id: 't3', title: 'Post do feed de quinta', status: 'a fazer',
    description: '', assignees: ['Ana'], due: '2026-09-11',
    brand: 'Botanika', project: 'Sem projeto', priority: 'normal', recurrence: 'none',
    subtasks: [], checklist: [], attachments: [], comments: [], history: [] },
];

await pag.addInitScript(([cs, ts]) => {
  window.supabase = { createClient: () => ({
    auth:{getSession:async()=>({data:{session:{user:{id:'u1',email:'v@b.com'}}}}),signOut:async()=>({})},
    from:()=>({select:()=>({or:async()=>({data:[
        {chave:'central.campaigns.vitor-gutierrez',dono:null,valor:cs},
        {chave:'central.tasks.vitor-gutierrez',dono:null,valor:ts}],error:null}),
      eq:()=>({maybeSingle:async()=>({data:null})})}),upsert:async()=>({error:null})}) }) };
}, [[campanha], tarefas]);
await pag.route('**/supabase.js', (r) => r.fulfill({ status:200, body:'', contentType:'application/javascript' }));

/* a IA fica fora do ar até o teste ligar — assim o caminho das regras é o
   caminho de sempre, e não o de exceção */
let iaLigada = false;
await pag.route('**/api/conferencia', async (rota) => {
  if (!iaLigada) return rota.fulfill({ status: 503, contentType: 'application/json',
    body: JSON.stringify({ erro: 'sem chave' }) });
  return rota.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
    itens: [
      { texto: 'Cupom DIAD9 aplicando no checkout do Tri[Mg]', obrigatorio: true },
      { texto: 'Criativo 9x16 exportado para stories', obrigatorio: true },
      { texto: 'Print do anúncio no ar salvo na pasta', obrigatorio: false },
    ] }) });
});

await pag.goto(`http://127.0.0.1:${srv.address().port}/`, { waitUntil:'networkidle' });
await pag.waitForTimeout(1400);

const ok = [];
const conf = (n, v) => { assert.ok(v, n); ok.push(n) };

const conferencia = () => pag.evaluate(() =>
  JSON.parse(localStorage.getItem('central.conferencia.vitor-gutierrez') || '{}'));
const tarefa = (id) => pag.evaluate((i) =>
  JSON.parse(localStorage.getItem('central.tasks.vitor-gutierrez') || '[]')
    .find((t) => String(t.id) === i), id);

const abrirTarefas = async () => {
  if (await pag.locator('#taskDetailDrawer.open').count()) {
    await pag.locator('#taskDetailClose').click();
    await pag.waitForTimeout(300);
  }
  await pag.locator('#tasksNav').click();
  await pag.waitForTimeout(500);
};
const abrirFicha = async (titulo) => {
  await pag.locator('.cu-row', { hasText: titulo }).first().click();
  await pag.waitForTimeout(450);
};
const fecharFicha = async () => {
  await pag.locator('#taskDetailClose').click();
  await pag.waitForTimeout(300);
};

/* ---------- a área ---------- */
conf('reconhece a área pelo que a tarefa diz',
  await pag.evaluate(() => window.Conferencia.areaDe({ title: 'Subir criativos no gerenciador de anúncios' })) === 'Tráfego');
conf('e pelo canal quando o ClickUp manda um',
  await pag.evaluate(() => window.Conferencia.areaDe({ title: 'Tarefa qualquer', canal: 'E-mail' })) === 'E-mail');
conf('cai em Geral quando não dá para saber',
  await pag.evaluate(() => window.Conferencia.areaDe({ title: 'Fazer aquilo' })) === 'Geral');
conf('o padrão de uma área traz os gerais e os dela',
  await pag.evaluate(() => {
    const p = window.Conferencia.padraoDe('Tráfego').map((x) => x.texto).join(' | ');
    return p.includes('briefing') && p.includes('Pixel disparando');
  }));

/* ---------- a ficha ---------- */
await abrirTarefas();
await abrirFicha('Subir criativos');
conf('a conferência aparece na ficha da tarefa',
  await pag.locator('.cf-secao').count() === 1);
/* ---------- abrir a ficha já faz a lista existir ----------
   Antes a lista era opcional, e por isso nunca ninguém gerou uma: em dois
   meses de operação, zero listas. Agora ela nasce sozinha do padrão da
   área, e a tranca vale desde a primeira vez que a tarefa é aberta. */
const c0 = await conferencia();
conf('abrir a ficha faz nascer a lista, sem ninguém pedir',
  Array.isArray(c0.escopos['tarefa:t1']?.itens) && c0.escopos['tarefa:t1'].itens.length > 6);
conf('e ela vem marcada como nascida sozinha', c0.escopos['tarefa:t1'].automatica === true);
conf('a ficha já mostra travado, sem passo nenhum',
  (await pag.locator('.cf-secao').innerText()).includes('Travado'));
conf('e o "feito" do status já sai de circulação',
  await pag.locator('#detailStatus option').evaluateAll(
    (os) => os.some((o) => o.textContent.startsWith('feito') && o.disabled)));

/* ---------- gerar pelas regras ---------- */
await pag.locator('.cf-secao [data-cf-gerar]:not([data-cf-ia])').click();
await pag.waitForTimeout(500);
const c1 = await conferencia();
const lista1 = c1.escopos['tarefa:t1'];
conf('o padrão vira a lista daquela tarefa', Array.isArray(lista1?.itens) && lista1.itens.length > 6);
conf('e a lista sabe de que área nasceu', lista1.area === 'Tráfego');
conf('guardada na chave que a ponte leva para o Supabase',
  await pag.evaluate(() => !!localStorage.getItem('central.conferencia.vitor-gutierrez')));
conf('o contexto da campanha entra na lista',
  lista1.itens.some((i) => i.texto.includes('CUPOM DIAD9')));
conf('inclusive o fim da campanha, que ninguém lembra de tirar do ar',
  lista1.itens.some((i) => /10\/09/.test(i.texto)));
conf('e o produto da oferta', lista1.itens.some((i) => i.texto.includes('Tri[Mg] Complex')));

/* ---------- a tranca ---------- */
conf('com lista aberta, a ficha mostra que está travada',
  (await pag.locator('.cf-secao').innerText()).includes('Travado'));
conf('e o "feito" do status sai de circulação',
  await pag.locator('#detailStatus option').evaluateAll(
    (os) => os.some((o) => o.textContent.startsWith('feito') && o.disabled)));

/* salvar com "feito" escolhido à força não passa */
await pag.evaluate(() => {
  const s = document.getElementById('detailStatus');
  [...s.options].forEach((o) => { o.disabled = false });
  s.value = 'feito';
});
await pag.locator('#taskSaveBtn').click();
await pag.waitForTimeout(500);
conf('salvar com o status forçado não conclui a tarefa',
  (await tarefa('t1')).status === 'a fazer');

/* a tranca é só do "feito": o resto do formulário tem que salvar igual */
await abrirTarefas();
await abrirFicha('Subir criativos');
await pag.locator('#detailPriority').selectOption('low');
/* a descrição agora é desenhada; para escrever, abre-se a edição */
await pag.locator('.ds-editar').click();
await pag.locator('#detailDescription').fill('briefing revisado');
await pag.locator('#taskSaveBtn').click();
await pag.waitForTimeout(600);
const t1 = await tarefa('t1');
conf('e o resto do que foi editado salva normalmente',
  t1.priority === 'low' && t1.description === 'briefing revisado');

/* o círculo da lista */
await abrirTarefas();
await pag.locator('[data-toggle-done="t1"]').first().click();
await pag.waitForTimeout(600);
conf('o círculo da lista recusa enquanto falta conferir',
  (await tarefa('t1')).status === 'a fazer');
conf('e a recusa abre a conferência em vez de só reclamar',
  await pag.locator('.cf-secao').count() === 1);

/* o quadro */
await fecharFicha();
await abrirTarefas();
await pag.locator('[data-view="board"]').click();
await pag.waitForTimeout(450);
const arrastou = await pag.evaluate(() => {
  const col = document.querySelector('[data-drop-status="feito"]');
  if (!col) return 'sem coluna';
  const dt = new DataTransfer();
  dt.setData('text/plain', 't1');
  col.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  return 'ok';
});
conf('a coluna "feito" existe no quadro', arrastou === 'ok');
await pag.waitForTimeout(500);
conf('arrastar para a coluna "feito" também recusa',
  (await tarefa('t1')).status === 'a fazer');

/* ---------- destravar ---------- */
await fecharFicha();
await pag.locator('[data-view="list"]').click();
await pag.waitForTimeout(400);
await abrirFicha('Subir criativos');
/* Itens de prova pedem o link ou o print antes de marcar. Aqui o
   navegador responde sempre a mesma coisa, e mais adiante eu confiro que
   a prova ficou guardada junto da marcação. */
const PROVA = 'https://botanikabrasil.com.br/tri-mg?utm_source=teste';
pag.on('dialog', (d) => d.accept(PROVA));
const marcar = async () => {
  for (;;) {
    const cx = pag.locator('.cf-item.obrig:not(.feito) input[type=checkbox]').first();
    if (!(await cx.count())) break;
    await cx.click();
    await pag.waitForTimeout(160);
  }
};
await marcar();
conf('com tudo conferido, a ficha diz que está liberado',
  (await pag.locator('.cf-secao').innerText()).includes('Liberado'));

/* ---------- marcar passou a custar ---------- */
const comProva = (await conferencia()).escopos['tarefa:t1'].itens.filter((i) => i.prova);
conf('o item de link testado pede prova', comProva.length >= 1);
conf('e a prova fica guardada junto da marcação, não só o clique',
  comProva.every((i) => i.provaTexto === PROVA));
conf('a prova fica escrita na ficha, para quem for revisar depois',
  (await pag.locator('.cf-secao').innerHTML()).includes('utm_source=teste'));
conf('e a marcação é assinada por quem marcou',
  comProva.every((i) => i.por && i.em));
conf('e o "feito" volta ao status',
  await pag.locator('#detailStatus option').evaluateAll(
    (os) => os.filter((o) => o.textContent.startsWith('feito')).every((o) => !o.disabled)));
conf('conferida, a lista se recolhe e devolve a ficha ao briefing',
  await pag.locator('.cf-secao .cf:not(.cf-rot) > .cf-corpo[hidden]').count() === 1);
await pag.locator('.cf-secao .cf:not(.cf-rot) [data-cf-dobra]').first().click();
await pag.waitForTimeout(300);
conf('e volta a abrir quando alguém quer reler',
  await pag.locator('.cf-secao .cf:not(.cf-rot) > .cf-corpo[hidden]').count() === 0);
conf('quem conferiu fica registrado no item',
  (await conferencia()).escopos['tarefa:t1'].itens.filter((i) => i.feito).every((i) => !!i.por));

await abrirTarefas();
await pag.locator('[data-toggle-done="t1"]').first().click();
await pag.waitForTimeout(500);
conf('e aí sim a tarefa fecha', (await tarefa('t1')).status === 'feito');

/* ---------- a IA ---------- */
iaLigada = true;
await abrirFicha('Programar o disparo');
await pag.locator('.cf-secao [data-cf-gerar][data-cf-ia]').click();
await pag.waitForTimeout(900);
const c2 = (await conferencia()).escopos['tarefa:t2'];
conf('a IA escreve a lista quando /api/conferencia responde', c2?.geradoPor === 'ia');
conf('e a lista é a que ela devolveu',
  c2.itens.some((i) => i.texto.includes('Cupom DIAD9 aplicando')));
conf('o que ela marcou como higiene não trava',
  c2.itens.find((i) => /Print do anúncio/.test(i.texto))?.obrigatorio === false);
conf('a ficha mostra de onde a lista veio',
  (await pag.locator('.cf-secao').innerText()).includes('escrita pela IA'));

/* a IA cai; a lista continua saindo */
iaLigada = false;
await pag.locator('.cf-secao [data-cf-gerar][data-cf-ia]').click();
await pag.waitForTimeout(900);
const c3 = (await conferencia()).escopos['tarefa:t2'];
conf('com a IA fora do ar, a lista sai pelas regras', c3.geradoPor === 'regras');
conf('e a área certa foi reconhecida sozinha', c3.area === 'E-mail');
conf('refazer não apaga o que já tinha sido conferido — nada estava marcado',
  c3.itens.every((i) => !i.feito));
conf('e o botão "com IA" some, em vez de prometer o que não entrega',
  await pag.locator('.cf-secao [data-cf-gerar][data-cf-ia]').count() === 0 &&
  await pag.locator('.cf-secao [data-cf-gerar]:not([data-cf-ia])').count() === 1);

/* refazer preservando o que já foi conferido */
await pag.locator('.cf-item input[type=checkbox]').first().click();
await pag.waitForTimeout(300);
const textoMarcado = (await conferencia()).escopos['tarefa:t2'].itens.find((i) => i.feito)?.texto;
await pag.locator('.cf-secao [data-cf-gerar]:not([data-cf-ia])').click();
await pag.waitForTimeout(600);
conf('refazer a lista mantém marcado o que já foi conferido',
  (await conferencia()).escopos['tarefa:t2'].itens.find((i) => i.texto === textoMarcado)?.feito === true);

/* ---------- o padrão da área ---------- */
await pag.locator('.cf-secao [data-cf-area]').click();
await pag.waitForTimeout(400);
conf('o padrão da área abre com as áreas todas',
  await pag.locator('.cf-aba').count() >= 10);
conf('e abre na área daquela tarefa',
  (await pag.locator('.cf-aba.ativa').innerText()).trim() === 'E-mail');
await pag.locator('[data-cf-novo-p]').fill('Assunto sem emoji no começo');
await pag.locator('[data-cf-add-p]').click();
await pag.waitForTimeout(400);
conf('dá para acrescentar ao padrão da área',
  await pag.evaluate(() => window.Conferencia.padraoDe('E-mail').some((p) => p.texto === 'Assunto sem emoji no começo')));
await pag.screenshot({ path: 'teste/19-conferencia-padrao.png' });
await pag.locator('.cf-aba', { hasText: 'Site' }).first().click();
await pag.waitForTimeout(350);
conf('trocar de área troca o padrão que está na tela',
  (await pag.locator('.cf-modal-corpo').innerText()).includes('tema rascunho'));
await pag.locator('.cf-modal-caixa footer [data-cf-fechar]').click();
await pag.waitForTimeout(400);
conf('e o padrão fecha', await pag.locator('.cf-modal').count() === 0);

await pag.locator('.cf-secao [data-cf-gerar]:not([data-cf-ia])').click();
await pag.waitForTimeout(500);
conf('a próxima lista já nasce com o que foi acrescentado ao padrão',
  (await conferencia()).escopos['tarefa:t2'].itens.some((i) => i.texto === 'Assunto sem emoji no começo'));

/* ---------- acrescentar e tirar na própria lista ---------- */
await pag.locator('[data-cf-novo]').first().fill('Confirmar com a Sarah antes de disparar');
await pag.locator('[data-cf-add]').first().click();
await pag.waitForTimeout(400);
conf('dá para acrescentar um item só daquela entrega',
  (await conferencia()).escopos['tarefa:t2'].itens.some((i) => i.texto === 'Confirmar com a Sarah antes de disparar'));
const antesDeTirar = (await conferencia()).escopos['tarefa:t2'].itens.length;
await pag.locator('.cf-item [data-cf-tirar]').first().click();
await pag.waitForTimeout(400);
conf('e tirar um que não faz sentido ali',
  (await conferencia()).escopos['tarefa:t2'].itens.length === antesDeTirar - 1);
await pag.evaluate(() => { document.querySelector('.tdetail-main').scrollTop = 0 });
await pag.waitForTimeout(200);
await pag.screenshot({ path: 'teste/17-conferencia-tarefa.png' });

/* ---------- a campanha ---------- */
await fecharFicha();
await pag.evaluate(() => window.openCampaignWorkspaceByName?.('Dia D — 09/09'));
await pag.waitForTimeout(900);
const resumo = () => pag.locator('[data-cw-pane="summary"]').innerText();
conf('a campanha ganha a conferência dela',
  await pag.locator('.cf-camp').count() === 1);
conf('e conta como estão as conferências das tarefas',
  /conferidas/.test(await resumo()) && /sem lista/.test(await resumo()));
await pag.locator('.cf-camp [data-cf-gerar]:not([data-cf-ia])').click();
await pag.waitForTimeout(600);
const cc = (await conferencia()).escopos['campanha:Botanika|Dia D — 09/09'];
conf('a lista da campanha é a de encerramento, não a de uma área',
  cc.itens.some((i) => /Resultado registrado/.test(i.texto)) &&
  cc.itens.some((i) => /todas as tarefas/i.test(i.texto)));
conf('a campanha nasce travada, como qualquer entrega',
  (await pag.locator('.cf-camp').innerText()).includes('Travado'));

iaLigada = true;
await pag.locator('[data-cf-gerar-todas]').click();
await pag.waitForTimeout(1500);
const depois = await conferencia();
conf('dá para escrever de uma vez a lista das que ainda não têm',
  !!depois.escopos['tarefa:t4'] && depois.escopos['tarefa:t4'].geradoPor === 'ia');
conf('e a tarefa que não é da campanha fica de fora', !depois.escopos['tarefa:t3']);
conf('o botão some quando não falta mais nenhuma',
  await pag.locator('[data-cf-gerar-todas]').count() === 0);
await pag.screenshot({ path: 'teste/18-conferencia-campanha.png' });

/* ---------- o roteiro da área na campanha ----------
   O pedido do Vitor: as ações de uma campanha são sempre as mesmas, só a
   comunicação muda. Então o que se confere é sempre o mesmo, é longo, e
   não cabe em subtarefa — cabe uma vez, na tarefa principal da área, e
   tranca ela. */
const R = (fn, ...a) => pag.evaluate(([f, args]) =>
  window.Conferencia[f](...args), [fn, a]);

/* O roteiro é do trabalho que existe. Mostrar o protocolo do site em
   campanha que não encosta no site foi exatamente a reclamação: "vc ta
   mostrando de tudo, pra qualquer tarefa". */
conf('o roteiro só existe para a área que tem trabalho nesta campanha',
  await pag.evaluate(() => {
    const c = JSON.parse(localStorage.getItem('central.campaigns.vitor-gutierrez'))[0];
    const a = window.Conferencia.areasDa(c);
    return a.includes('Tráfego') && a.includes('E-mail') && a.includes('Site') && !a.includes('Oferta');
  }));
conf('e a área sem tarefa fica de fora, para ser chamada à mão se precisar',
  await pag.evaluate(() => {
    const c = JSON.parse(localStorage.getItem('central.campaigns.vitor-gutierrez'))[0];
    return window.Conferencia.areasDeFora(c).includes('Oferta');
  }));
conf('o resumo oferece chamar a área que faltou',
  await pag.locator('[data-cf-rot-novo]').count() >= 1);
await pag.locator('[data-cf-rot-novo$="|Oferta"]').first().click();
await pag.waitForTimeout(500);
conf('e chamada à mão, ela passa a valer nesta campanha',
  await pag.evaluate(() => {
    const c = JSON.parse(localStorage.getItem('central.campaigns.vitor-gutierrez'))[0];
    return window.Conferencia.areasDa(c).includes('Oferta');
  }));

conf('o roteiro da oferta testa desconto, combinação, brinde, Pix e cartão',
  await pag.evaluate(() => {
    const t = window.Conferencia.porRegrasRoteiro('Oferta').map((i) => i.texto).join(' | ');
    return /combina/i.test(t) && /brinde/i.test(t) && /Pix/.test(t) && /cart[ãa]o/i.test(t) &&
           /frete gr[áa]tis/i.test(t) && /influenciadora/i.test(t) && /recompra/i.test(t);
  }));

conf('e o roteiro do site vai da home ao checkout, e repete no celular',
  await pag.evaluate(() => {
    const et = window.Conferencia.roteiroPadrao('Site');
    const t = et.map((e) => e.itens.map((i) => i.texto).join(' ')).join(' | ');
    return et.length >= 5 && /barra de aviso/i.test(t) && /checkout/i.test(t) &&
           /celular/i.test(t) && /quiz/i.test(t);
  }));

conf('o roteiro é longo de propósito — não é lista de subtarefa',
  await pag.evaluate(() => window.Conferencia.porRegrasRoteiro('Oferta').length >= 20));

conf('cada roteiro tem um dono, tirado de quem toca a área na campanha',
  await pag.evaluate(() => {
    const c = JSON.parse(localStorage.getItem('central.campaigns.vitor-gutierrez'))[0];
    return window.Conferencia.donoRoteiro(c, 'Tráfego') === 'Ítalo Neves';
  }));

conf('a tarefa principal da área é quem o roteiro tranca',
  await pag.evaluate(() => {
    const c = JSON.parse(localStorage.getItem('central.campaigns.vitor-gutierrez'))[0];
    return window.Conferencia.tarefaPrincipal(c, 'Site')?.id === 't4';
  }));

conf('a campanha mostra o roteiro de cada área',
  await pag.locator('.cf-camp .cf-rot').count() >= 4);
/* no resumo eles nascem fechados: são muitos e cada um é longo */
conf('e no resumo eles nascem fechados, para a tela não pesar',
  await pag.locator('.cf-camp .cf-rot > .cf-corpo[hidden]').count() >= 3);
await pag.locator('.cf-camp .cf-rot [data-cf-dobra]').first().click();
await pag.waitForTimeout(400);
conf('abrindo um, as etapas vêm numeradas, na ordem de fazer',
  await pag.locator('.cf-camp .cf-etapa-rot').count() >= 3);

/* a tranca de verdade: a lista da tarefa t4 está toda conferida (a IA
   escreveu e o teste marcou), mas o roteiro do site não — e é ele que
   segura */
await pag.evaluate(() => {
  const C = window.Conferencia;
  const c = C.conferencia('tarefa:t4');
  c.itens.forEach((i) => { i.feito = true; i.por = 'teste'; i.em = new Date().toISOString() });
  C.gravarConferencia('tarefa:t4', c);
});
conf('com a lista da tarefa toda conferida, o roteiro ainda segura',
  await pag.evaluate(() => {
    const ts = JSON.parse(localStorage.getItem('central.tasks.vitor-gutierrez'));
    const t4 = ts.find((t) => t.id === 't4');
    const quais = window.Conferencia.travas(t4);
    return quais.length === 1 && quais[0].tipo === 'roteiro' && quais[0].area === 'Site';
  }));

await fecharFicha().catch(() => {});
await abrirTarefas();
await pag.locator('[data-toggle-done="t4"]').first().click();
await pag.waitForTimeout(600);
conf('e o círculo recusa por causa do roteiro, não da lista da tarefa',
  (await tarefa('t4')).status === 'a fazer');
conf('a recusa diz que o que falta é o roteiro da área',
  (await pag.locator('.as-aviso, .toast, body').first().innerText()).includes('roteiro') ||
  await pag.locator('.cf-secao .cf-rot').count() === 1);

conf('o roteiro do site aparece na ficha da tarefa principal',
  await pag.locator('.cf-secao .cf-rot').count() === 1);

/* marcar dentro do roteiro grava — a chave tem "|" dentro dela, e era
   por aí que a marcação se perdia */
const antesRot = await pag.evaluate(() => {
  const C = window.Conferencia;
  const c = JSON.parse(localStorage.getItem('central.campaigns.vitor-gutierrez'))[0];
  return C.escopoRoteiro(c, 'Site');
});
await pag.locator('.cf-secao .cf-rot .cf-item:not(.feito) input[type=checkbox]').first().click();
await pag.waitForTimeout(400);
conf('marcar item do roteiro grava mesmo com "|" dentro da chave',
  ((await conferencia()).escopos[antesRot]?.itens || []).some((i) => i.feito));

/* o erro que passou vira etapa do roteiro, para toda campanha que vier */
await pag.evaluate(() => window.Conferencia.registrarErroRoteiro('Site',
  'Número escrito no banner conferido contra a quantidade que existe de verdade'));
conf('o erro que passou vira item obrigatório do roteiro da área',
  await pag.evaluate(() => {
    const et = window.Conferencia.roteiroPadrao('Site');
    const ultima = et[et.length - 1];
    return /Erros que j[áa] passaram/.test(ultima.etapa) &&
      ultima.itens.some((i) => /banner/i.test(i.texto) && i.obrigatorio);
  }));
conf('e ele já entra no roteiro desta campanha quando ela é refeita',
  await pag.evaluate((k) => {
    window.Conferencia.refazerRoteiro(k);
    return (window.Conferencia.conferencia(k).itens || []).some((i) => /banner/i.test(i.texto));
  }, antesRot));
conf('refazer o roteiro não apaga o que já tinha sido conferido',
  ((await conferencia()).escopos[antesRot]?.itens || []).some((i) => i.feito));

console.log(ok.map(s => '  ✓ ' + s).join('\n'));
console.log(`\nconferência: ${ok.length} checagens passaram`);
await nav.close(); srv.close();
