/* A página inicial mentia: "6 perto do vencimento", "3 vencidas", "68% no
   mês" e cinco tarefas que não existem, com nomes de gente que existe.
   Aqui confiro que o que aparece vem das tarefas e campanhas de verdade —
   e que, sem dado, ela diz que não tem em vez de inventar. */
import { chromium } from '/home/user/vitor/node_modules/playwright-core/index.mjs';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');

/* Navegar é clicar no destino na lateral, que está sempre à vista. */
const irPara = async (p, id) => {
  await p.locator(`#${id}`).click();
  await p.waitForTimeout(140);
};
const srv = createServer((_, r) => { r.writeHead(200,{'content-type':'text/html; charset=utf-8'}); r.end(html) }).listen(0);
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

const hoje = new Date(); hoje.setHours(0,0,0,0);
const dia = (n) => { const d = new Date(hoje); d.setDate(d.getDate()+n);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` };

const base = { description:'', subtasks:[], checklist:[], attachments:[], comments:[], history:[], recurrence:'none' };
const tarefas = [
  { ...base, id:'t1', title:'Subir criativos do Dia D',  status:'a fazer', assignees:['Ítalo Neves'], due:dia(-3), brand:'Botanika',  project:'Dia D' , priority:'urgent'},
  { ...base, id:'t2', title:'Programar o disparo',       status:'a fazer', assignees:['Sarah'],       due:dia(0),  brand:'Botanika',  project:'Dia D' , priority:'high'},
  { ...base, id:'t3', title:'Aprovar o roteiro',         status:'a fazer', assignees:['Ana'],         due:dia(1),  brand:'VermeFree', project:'Dia D Kids', priority:'normal'},
  { ...base, id:'t4', title:'Coisa de semana que vem',   status:'a fazer', assignees:['Pedro'],       due:dia(6),  brand:'Botanika',  project:'Avulsas', priority:'low'},
  { ...base, id:'t5', title:'Já entregue',               status:'feito',   assignees:['Pedro'],       due:dia(-2), brand:'Botanika',  project:'Dia D', priority:'normal'},
];
const campanhas = [
  { id:'pl-7', name:'Dia D — 09/09', brand:'Botanika', type:'Dia D', status:'Em execução', owner:'Vitor Gutierrez',
    start:dia(-1), end:dia(1), goal:60000, budget:10000, progress:0, color:'#121415', objective:'Ação de 1 dia',
    offer:'9% OFF geral', benefits:[], channels:[], products:[], schedule:[], tap:[] },
  { id:'pl-17', name:'Dia D Kids', brand:'VermeFree', type:'Dia D', status:'Planejamento', owner:'Vitor Gutierrez',
    start:dia(18), end:dia(20), goal:50000, budget:8000, progress:0, color:'#121415', objective:'Kids',
    offer:'10% OFF geral', benefits:[], channels:[], products:[], schedule:[], tap:[] },
  { id:'pl-4', name:'Orgânico — Grupo VIP', brand:'Botanika', type:'Perpétuo', status:'Em execução', owner:'Vitor Gutierrez',
    start:dia(-5), end:dia(9), goal:30000, budget:0, progress:0, color:'#121415', objective:'Perpétuo do mês',
    offer:'Sem desconto geral', benefits:[], channels:[], products:[], schedule:[], tap:[] },
  { id:'pl-99', name:'Coisa de outro mês', brand:'Botanika', type:'Perpétuo', status:'Planejamento', owner:'x',
    start:'2026-01-01', end:'2026-01-31', goal:1, budget:0, progress:0, color:'#121415', objective:'',
    offer:'', benefits:[], channels:[], products:[], schedule:[], tap:[] },
];

const abrir = async (ts, cs) => {
  const pag = await nav.newPage({ viewport:{ width:1440, height:1100 } });
  pag.on('pageerror', (e) => console.log('  [erro na página]', e.message));
  await pag.addInitScript(([a,b]) => {
    window.supabase = { createClient: () => ({
      auth:{getSession:async()=>({data:{session:{user:{id:'u1',email:'v@b.com'}}}}),signOut:async()=>({})},
      from:()=>({select:()=>({or:async()=>({data:[
          {chave:'central.tasks.vitor-gutierrez',dono:null,valor:a},
          {chave:'central.campaigns.vitor-gutierrez',dono:null,valor:b}],error:null}),
        eq:()=>({maybeSingle:async()=>({data:null})})}),upsert:async()=>({error:null})}) }) };
  }, [ts, cs]);
  await pag.route('**/supabase.js', (r) => r.fulfill({ status:200, body:'', contentType:'application/javascript' }));
  await pag.goto(`http://127.0.0.1:${srv.address().port}/`, { waitUntil:'networkidle' });
  await pag.waitForTimeout(1400);
  return pag;
};

const ok = [];
const conf = (n, v) => { assert.ok(v, n); ok.push(n) };
const pag = await abrir(tarefas, campanhas);

const stat = (q) => pag.locator(`[data-stat="${q}"]`).innerText();

/* ---------- nada inventado sobrou ---------- */
const corpo = await pag.locator('body').innerText();
for (const frase of ['Programar disparo do Dia D', 'Finalizar criativos da campanha',
                     'Subir segmentação do Grupo VIP', 'Aprovar roteiro dos creators'])
  conf(`a tarefa inventada "${frase}" não existe mais`, !corpo.includes(frase));
conf('e o "68%" escrito à mão também não', !/68%/.test(corpo));

/* ---------- os três cartões ---------- */
conf('conta as vencidas de verdade', /\b1\b/.test(await stat('vencidas')));
conf('conta as que vencem hoje e amanhã', /\b2\b/.test(await stat('perto')));
const c3 = await stat('conclusao');
conf('a conclusão do mês sai da conta, não do texto', /%/.test(c3) && /de \d+ tarefas do mês/.test(c3));

/* ---------- a lista de atenção ---------- */
const at = await pag.locator('#homeAtencao').innerText();
conf('mostra a vencida primeiro', at.indexOf('Subir criativos') < at.indexOf('Programar o disparo'));
conf('diz há quanto tempo venceu', /vencida há 3 dias/.test(at));
conf('e o que vence hoje e amanhã', /vence hoje/.test(at) && /vence amanhã/.test(at));
conf('com o responsável de verdade', at.includes('Ítalo Neves') && at.includes('Sarah'));
conf('não traz o que ainda está longe', !at.includes('Coisa de semana que vem'));
conf('nem o que já foi entregue', !at.includes('Já entregue'));

/* ---------- as campanhas do mês ---------- */
const ca = await pag.locator('#homeCampanhas').innerText();
conf('as campanhas são as do mês', ca.includes('Dia D — 09/09') && ca.includes('Dia D Kids'));
conf('e a de outro mês fica de fora', !ca.includes('Coisa de outro mês'));
conf('a barra conta as tarefas ligadas à campanha', /1 de 3 tarefas/.test(ca));
conf('e a campanha sem tarefa aparece do mesmo jeito', ca.includes('Orgânico — Grupo VIP'));
conf('e onde não há tarefa, mostra o período', /\d{2}\/\d{2} a \d{2}\/\d{2}/.test(ca));

/* ---------- o sino ---------- */
conf('o sino conta o que venceu e o que vence hoje, e não "3" fixo',
  (await pag.locator('#notificationsBtn .badge').innerText()).trim() === '2');
await pag.locator('#notificationsBtn').click();
await pag.waitForTimeout(600);
conf('e clicar nele leva à lista de atenção, sem prometer caixa de mensagem',
  await pag.locator('#homeAtencao .task').count() === 3 &&
  !(await pag.locator('body').innerText()).includes('notificações novas'));

/* ---------- clicar abre o que é de verdade ---------- */
await pag.locator('#homeAtencao .task').first().click();
await pag.waitForTimeout(900);
conf('clicar na tarefa abre a ficha dela',
  await pag.locator('#taskDetailDrawer.open').count() === 1 &&
  (await pag.locator('#taskTitleInput').inputValue()) === 'Subir criativos do Dia D');
await pag.locator('#taskDetailClose').click();
await pag.waitForTimeout(300);

await irPara(pag, 'homeNav');
await pag.waitForTimeout(400);
await pag.locator('#homeCampanhas [data-ini-campanha="Dia D — 09/09"]').click();
await pag.waitForTimeout(900);
conf('clicar na campanha abre a campanha',
  await pag.locator('#campaignWorkspace.active').count() === 1 &&
  (await pag.locator('#campaignWorkspace .cw-title h2').innerText()).includes('Dia D — 09/09'));

await irPara(pag, 'homeNav');
await pag.waitForTimeout(400);
await pag.screenshot({ path: 'teste/20-inicio.png' });
await pag.close();

/* ---------- sem dado, diz que não tem ---------- */
const vazia = await abrir([], []);
const cv = await vazia.locator('body').innerText();
conf('sem tarefa nenhuma, a lista explica em vez de inventar',
  (await vazia.locator('#homeAtencao').innerText()).includes('Nenhuma tarefa carregada'));
conf('sem campanha, o mesmo',
  (await vazia.locator('#homeCampanhas').innerText()).includes('Nenhuma campanha'));
conf('e os cartões não fingem número', /—/.test(await vazia.locator('[data-stat="conclusao"]').innerText()));
conf('sem nada vencido, o sino não mostra selo nenhum',
  await vazia.locator('#notificationsBtn .badge').count() === 0);
conf('a tela de Tarefas também abre vazia, e não com invenção',
  !cv.includes('Kit principal') && !cv.includes('Briefing e objetivo conferidos'));
await vazia.close();

console.log(ok.map(s => '  ✓ ' + s).join('\n'));
console.log(`\ninício: ${ok.length} checagens passaram`);
await nav.close(); srv.close();
