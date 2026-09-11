/* O que volta sempre: a recorrência da tarefa e a rotina da área.

   O que precisa valer: a próxima data de uma tarefa que se repete é a
   próxima que ainda não passou (e não uma vencida, quando se fecha com
   atraso); fechar uma tarefa que se repete faz a seguinte nascer, uma vez
   só, com o checklist zerado; girar duas vezes não duplica; o id da nova
   é o mesmo em qualquer navegador, para a junção do banco não criar duas;
   e a rotina da área aparece marcável no início, valendo pelo período
   certo — dia, semana, mês. */
import { chromium } from '/home/user/vitor/node_modules/playwright-core/index.mjs';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const srv = createServer((_, r) => { r.writeHead(200,{'content-type':'text/html; charset=utf-8'}); r.end(html) }).listen(0);
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const porta = srv.address().port;

let ok = 0, ruim = 0;
const conf = (o, v) => { if (v) { ok++; console.log('  ✓', o) } else { ruim++; console.log('  ✗', o) } };

const hoje = new Intl.DateTimeFormat('en-CA', { timeZone:'America/Sao_Paulo', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());
const dia = (n) => { const d = new Date(`${hoje}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0,10) };

const base = { description:'', subtasks:[], checklist:[], attachments:[], comments:[], history:[], recurrence:'none', priority:'normal' };
const tarefas = [
  { ...base, id:'t-sem', title:'Remanejar verba entre campanhas', status:'feito', assignees:['Pedro Lage'],
    due:dia(-1), brand:'Botanika', project:'Avulsas', recurrence:'weekly',
    checklist:[{ id:'c1', text:'Ler o resultado', done:true }, { id:'c2', text:'Mover a verba', done:true }],
    comments:[{ author:'Pedro', text:'feito', at:'ontem' }] },
  { ...base, id:'t-atras', title:'Daily do dia', status:'feito', assignees:['Vitor Gutierrez'],
    due:dia(-20), brand:'Botanika', project:'Avulsas', recurrence:'daily' },
  { ...base, id:'t-mes', title:'Fechar o mês', status:'feito', assignees:['Vitor Gutierrez'],
    due:'2026-01-31', brand:'Botanika', project:'Avulsas', recurrence:'monthly' },
  { ...base, id:'t-nao', title:'Coisa de uma vez só', status:'feito', assignees:['Pedro Lage'],
    due:dia(-2), brand:'Botanika', project:'Avulsas', recurrence:'none' },
  { ...base, id:'t-aberta', title:'Ainda aberta e semanal', status:'a fazer', assignees:['Pedro Lage'],
    due:dia(1), brand:'Botanika', project:'Avulsas', recurrence:'weekly' },
];

const AREAS = [
  { id:'a-traf', nome:'Tráfego', slug:'trafego', ordem:1 },
  { id:'a-gest', nome:'Gestão', slug:'gestao', ordem:2 },
];
const PERFIS = [{ id:'u1', nome:'Pedro Lage', email:'p@b.com', papel:'gestor', ativo:true, cargo:'Tráfego', area_id:'a-traf', criado_em:'2026-09-03' }];

const pag = await nav.newPage({ viewport: { width: 1440, height: 1100 } });
pag.on('pageerror', (e) => console.log('  [erro na página]', e.message));
await pag.addInitScript(([ts, areas, perfis]) => {
  window.supabase = { createClient: () => ({
    auth:{ getSession: async () => ({ data:{ session:{ user:{ id:'u1', email:'p@b.com' } } } }), signOut: async () => ({}) },
    rpc: async () => ({ data:null, error:null }),
    from: (nome) => {
      const dados = { areas, brands:[{ id:'m-bot', nome:'Botanika', slug:'botanika', ativo:true }], profiles:perfis,
                      equipe_convites:[], profile_brands:[{ profile_id:'u1', brand_id:'m-bot' }] }[nome] || [];
      const resp = { data: dados, error: null };
      const eq = { maybeSingle: async () => ({ data: perfis[0] }), is: () => ({ maybeSingle: async () => ({ data: perfis[0] }) }),
                   eq: () => eq, then: (f) => Promise.resolve(resp).then(f) };
      return { select: () => ({ or: async () => ({ data:[{ chave:'central.tasks.vitor-gutierrez', dono:null, valor: ts }], error:null }),
                                eq: () => eq, order: async () => resp, then: (f) => Promise.resolve(resp).then(f) }),
               upsert: async () => ({ error:null }) };
    },
  }) };
}, [tarefas, AREAS, PERFIS]);
await pag.route('**/api/painel**', (r) => r.fulfill({ status:200, contentType:'application/json',
  body: JSON.stringify({ marca:'Botanika', tela:'x', dados:{}, em:new Date().toISOString() }) }));

await pag.goto(`http://127.0.0.1:${porta}/`, { waitUntil:'networkidle' });
await pag.waitForTimeout(1400);

/* ---------- 1. a próxima data ---------- */
console.log('\na próxima data');
const p = (de, tipo, h) => pag.evaluate(([de, tipo, h]) => window.Rotina.proxima(de, tipo, h), [de, tipo, h]);
conf('semanal em dia vira a semana seguinte', await p('2026-09-14', 'weekly', '2026-09-14') === '2026-09-21');
conf('diária vira o dia seguinte', await p('2026-09-14', 'daily', '2026-09-14') === '2026-09-15');
conf('mensal vira o mesmo dia do mês seguinte', await p('2026-09-14', 'monthly', '2026-09-14') === '2026-10-14');
conf('31 de janeiro vira o último de fevereiro, não 3 de março',
     await p('2026-01-31', 'monthly', '2026-01-31') === '2026-02-28');
conf('e o passo seguinte não fica preso no dia 28',
     await p('2026-02-28', 'monthly', '2026-02-28') === '2026-03-28');
conf('fechada com três semanas de atraso, a diária não nasce vencida: cai em hoje',
     await p(dia(-20), 'daily', hoje) === hoje);
conf('nem a semanal', await p(dia(-20), 'weekly', hoje) >= hoje);
conf('"não repetir" não gera data nenhuma', await p('2026-09-14', 'none', '2026-09-14') === null);

/* ---------- 2. girar ---------- */
console.log('\ngirar o que fechou');
const depois = await pag.evaluate(() => JSON.parse(localStorage.getItem('central.tasks.vitor-gutierrez')));
const nova = depois.find((t) => t.title === 'Remanejar verba entre campanhas' && t.status === 'a fazer');
conf('a semanal fechada gerou a próxima', !!nova);
conf('com a data da semana seguinte', nova && nova.due === dia(6));
conf('aberta, e não já feita', nova && nova.status === 'a fazer');
conf('com o mesmo responsável', nova && nova.assignees[0] === 'Pedro Lage');
conf('com o checklist de volta ao zero', nova && nova.checklist.every((c) => c.done === false));
conf('e sem carregar os comentários da vez passada', nova && nova.comments.length === 0);
conf('a nova diz de onde veio', nova && /Repetição de/.test(nova.history[0].text));
conf('a atrasada também gerou, para a frente', depois.some((t) => t.title === 'Daily do dia' && t.status === 'a fazer' && t.due >= hoje));
conf('a mensal gerou', depois.some((t) => t.title === 'Fechar o mês' && t.status === 'a fazer'));
conf('a de uma vez só não gerou nada', depois.filter((t) => t.title === 'Coisa de uma vez só').length === 1);
conf('e a que ainda está aberta não gerou nada', depois.filter((t) => t.title === 'Ainda aberta e semanal').length === 1);
conf('a origem fica marcada como já repetida', depois.find((t) => t.id === 't-sem').repetiu === dia(6));
conf('e a nova não nasce marcada, senão repetiria sozinha', nova && !nova.repetiu);

/* ---------- 3. girar de novo não duplica ---------- */
console.log('\ngirar de novo');
const antes = depois.length;
await pag.evaluate(() => { window.Rotina.girar(); window.Rotina.girar() });
conf('nada é criado a mais', await pag.evaluate(() =>
  JSON.parse(localStorage.getItem('central.tasks.vitor-gutierrez')).length) === antes);

/* o id é calculado, não sorteado: dois navegadores chegam no mesmo */
conf('o id da repetição sai da origem e da data, para dois navegadores não criarem duas',
     nova && nova.id === `t-sem~${dia(6)}`);

/* ---------- 4. fechar na tela gera ---------- */
console.log('\nfechar pela lista');
await pag.evaluate(() => {
  const ts = window.__centralGetTasks();
  const t = ts.find((x) => x.id === 't-aberta');
  t.status = 'feito';
  localStorage.setItem('central.tasks.vitor-gutierrez', JSON.stringify(ts));
});
await pag.evaluate(() => window.Rotina.girar());
conf('fechar a semanal aberta faz a seguinte nascer', await pag.evaluate(() =>
  JSON.parse(localStorage.getItem('central.tasks.vitor-gutierrez')).filter((t) => t.title === 'Ainda aberta e semanal').length) === 2);

/* ---------- 5. a rotina: períodos ---------- */
console.log('\na rotina e seus períodos');
const per = (c, h) => pag.evaluate(([c, h]) => window.Rotina.periodoDe(c, h), [c, h]);
conf('o período da diária é o dia', await per('diaria', '2026-09-11') === '2026-09-11');
conf('o da semanal é a segunda daquela semana', await per('semanal', '2026-09-11') === '2026-09-07');
conf('domingo ainda pertence à semana que começou na segunda', await per('semanal', '2026-09-13') === '2026-09-07');
conf('e segunda já é a semana nova', await per('semanal', '2026-09-14') === '2026-09-14');
conf('o da mensal é o ano e o mês', await per('mensal', '2026-09-11') === '2026-09');

console.log('\nmarcar a rotina');
const marcou = await pag.evaluate(() => {
  const R = window.Rotina;
  const item = R.rotina().find((r) => r.cadencia === 'diaria');
  R.marcar(item, true, '2026-09-11');
  return { hoje: R.estaFeito(item, '2026-09-11'), amanha: R.estaFeito(item, '2026-09-12'), id: item.id };
});
conf('marcar vale para o dia', marcou.hoje);
conf('e não vale para o dia seguinte — a rotina recomeça', !marcou.amanha);
conf('quem marcou fica registrado', await pag.evaluate(([id]) =>
  !!window.Rotina.feitos()[`${id}|2026-09-11`].quem, [marcou.id]));
const desmarcou = await pag.evaluate(() => {
  const R = window.Rotina;
  const item = R.rotina().find((r) => r.cadencia === 'diaria');
  R.marcar(item, false, '2026-09-11');
  return R.estaFeito(item, '2026-09-11');
});
conf('e dá para desmarcar', !desmarcou);

conf('a marca antiga é podada, para não crescer para sempre', await pag.evaluate(() => {
  const R = window.Rotina;
  const item = R.rotina().find((r) => r.cadencia === 'diaria');
  R.marcar(item, true, '2026-01-05');
  R.marcar(item, true, '2026-09-11');
  return !R.estaFeito(item, '2026-01-05') && R.estaFeito(item, '2026-09-11');
}));
conf('mas a do mês fica, porque o ano inteiro cabe', await pag.evaluate(() => {
  const R = window.Rotina;
  const item = R.rotina().find((r) => r.cadencia === 'mensal');
  R.marcar(item, true, '2026-01-05');
  R.marcar(item, true, '2026-09-11');
  return R.estaFeito(item, '2026-01-05');
}));

/* ---------- 6. o que cai hoje ---------- */
console.log('\no que cai hoje');
const grupos = await pag.evaluate(() => window.Rotina.daArea('trafego', '2026-09-14'));  /* segunda */
conf('a rotina vem separada por cadência', grupos.length === 3);
conf('a diária cai todo dia', grupos.find((g) => g.cadencia.id === 'diaria').itens.every((i) => i.hoje));
const sem = grupos.find((g) => g.cadencia.id === 'semanal');
conf('a semanal de segunda cai na segunda', sem.itens.some((i) => i.hoje && /verba/i.test(i.titulo)));
conf('e a de quarta não cai na segunda', sem.itens.some((i) => !i.hoje));
const mensal = await pag.evaluate(() => window.Rotina.daArea('trafego', '2026-09-02'));
conf('a mensal do dia 1 não cai no dia 2',
     mensal.find((g) => g.cadencia.id === 'mensal').itens.every((i) => !i.hoje));

/* ---------- 7. na tela inicial ---------- */
console.log('\nno início');
await pag.evaluate(() => { try { localStorage.removeItem('central.home.layout.u1') } catch {} });
await pag.reload({ waitUntil:'networkidle' });
await pag.waitForTimeout(1500);
conf('o bloco da rotina aparece na tela inicial', await pag.locator('[data-hm-bloco="rotina"]').count() === 1);
const cxs = pag.locator('[data-hm-bloco="rotina"] [data-hm-rotina]');
conf('com os itens da área de quem está logado', await cxs.count() > 0);
const titulo = await pag.locator('[data-hm-bloco="rotina"] .hm-rot span').first().innerText();
conf('e são os do tráfego, que é a área do Pedro', /gerenciador|site|verba|criativ|m[êe]s/i.test(titulo));
conf('nenhum vem marcado de graça', await pag.locator('[data-hm-bloco="rotina"] [data-hm-rotina]:checked').count() === 0);

await cxs.first().check();
await pag.waitForTimeout(300);
conf('marcar na tela grava', await pag.evaluate(() => Object.keys(window.Rotina.feitos()).length) > 0);
conf('e o item aparece riscado', await pag.locator('[data-hm-bloco="rotina"] .hm-rot.ok').count() === 1);
conf('o contador do topo acompanha', /^1 de /i.test(await pag.locator('.hm-rot-topo').innerText()));

/* ---------- 8. editar a rotina no painel ---------- */
console.log('\neditar a rotina');
await pag.evaluate(() => { location.hash = '#painel' });
await pag.waitForTimeout(1200);
await pag.locator('#painelView [data-tela="backlog"]').click();
await pag.waitForTimeout(400);
await pag.locator('#painelCorpo [data-bk-modelo="rotina"]').click();
await pag.locator('#painelCorpo .bk-rot-grupo').first().waitFor({ state:'visible', timeout:5000 });
conf('a rotina tem aba própria dentro do Backlog', await pag.locator('#painelCorpo .bk-rot-grupo').count() === 3);
conf('e diz que não vira tarefa, para ninguém esperar isso',
     (await pag.locator('#painelCorpo .pn-nota').innerText()).includes('não vira tarefa'));
const quantos = await pag.evaluate(() => window.Rotina.rotina().length);
await pag.locator('#painelCorpo [data-bk-rot-mais]').first().click();
await pag.waitForTimeout(400);
conf('dá para acrescentar item na rotina', await pag.evaluate(() => window.Rotina.rotina().length) === quantos + 1);
await pag.locator('#painelCorpo [data-bk-rot-tira]').last().click();
await pag.waitForTimeout(400);
conf('e tirar', await pag.evaluate(() => window.Rotina.rotina().length) === quantos);

await nav.close();
srv.close();
console.log(`\nrotina: ${ok} checagens passaram${ruim ? `, ${ruim} FALHARAM` : ''}`);
process.exit(ruim ? 1 : 0);
