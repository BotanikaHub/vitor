/* O calendário passou a desenhar uma barra por campanha atravessando os
   dias dela, no lugar do mesmo chip repetido em cada dia. Aqui carrego as
   campanhas de setembro — seis contínuas e três pontuais por marca — e
   confiro o desenho, o filtro por tipo e a semana de segunda a domingo. */
import { chromium } from '/home/user/vitor/node_modules/playwright-core/index.mjs';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const srv = createServer((_, r) => { r.writeHead(200,{'content-type':'text/html; charset=utf-8'}); r.end(html) }).listen(0);
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const pag = await nav.newPage({ viewport: { width: 1440, height: 1000 } });
pag.on('pageerror', (e) => console.log('  [erro na página]', e.message));

const camps = [];
const põe = (marca, nome, tipo, ini, fim) => camps.push({
  id: 'c' + camps.length, name: nome, brand: marca, type: tipo,
  status: 'Em execução', owner: 'Vitor Gutierrez', start: ini, end: fim,
  goal: 50000, budget: 5000, progress: 0,
  color: marca === 'Botanika' ? '#121415' : '#4f8a70',
  objective: '', offer: '', channels: [], products: [], benefits: [], schedule: [], tap: [] });
for (const m of ['Botanika', 'VermeFree']) {
  ['API','E-mail','Instagram','Grupo VIP','Influencers'].forEach((n) =>
    põe(m, `Orgânico — ${n}`, 'Perpétuo', '2026-09-01', '2026-09-30'));
  põe(m, 'Perpétuo — Tráfego Direto', 'Perpétuo', '2026-09-01', '2026-09-30');
  põe(m, 'Dia D — 09/09', 'Dia D', '2026-09-09', '2026-09-09');
  põe(m, 'Semana do Cliente', 'Semana temática', '2026-09-13', '2026-09-19');
  põe(m, 'Ações de gap', 'Ação de GAP', '2026-09-26', '2026-09-27');
}

await pag.addInitScript((cs) => {
  window.supabase = { createClient: () => ({
    auth:{getSession:async()=>({data:{session:{user:{id:'u1',email:'v@b.com'}}}}),signOut:async()=>({})},
    from:()=>({select:()=>({or:async()=>({data:[{chave:'central.campaigns.vitor-gutierrez',dono:null,valor:cs}],error:null}),
                            eq:()=>({maybeSingle:async()=>({data:null})})}),upsert:async()=>({error:null})}) }) };
}, camps);
await pag.route('**/supabase.js', (r) => r.fulfill({ status:200, body:'', contentType:'application/javascript' }));
await pag.goto(`http://127.0.0.1:${srv.address().port}/`, { waitUntil:'networkidle' });
await pag.waitForTimeout(1400);

const ok = [];
const conf = (n, v) => { assert.ok(v, n); ok.push(n) };
const faixaDo = (id) => pag.evaluate((g) => {
  const f = document.getElementById(g)?.previousElementSibling;
  return f?.classList.contains('cal-faixa')
    ? [...f.querySelectorAll('.cal-chip')].map((c) => c.textContent.trim()) : [];
}, id);
/* cada grade tem a sua faixa, e a da aba escondida não é clicável: o
   clique tem que ser no filtro da grade que está à vista */
const filtrar = (id, rot) => pag.evaluate(([g, r]) => {
  const f = document.getElementById(g)?.previousElementSibling;
  [...(f?.querySelectorAll('.cal-filtros button') || [])]
    .find((b) => b.textContent.trim() === r)?.click();
}, [id, rot]);
const alternar = (id) => pag.evaluate((g) => {
  document.getElementById(g)?.previousElementSibling?.querySelector('.cal-alternar')?.click();
}, id);

const barrasDo = (id) => pag.evaluate((g) =>
  [...document.querySelectorAll('#' + g + ' .cal-barra')].map((b) => {
    const r = b.getBoundingClientRect();
    return { nome: b.textContent.trim(), larg: Math.round(r.width), topo: Math.round(r.top) };
  }), id);

/* a página inicial abre primeiro: a semana de lá tem que ser a mesma */
await pag.selectOption('#brandSelect', 'Botanika').catch(() => {});
await pag.waitForTimeout(700);
const cabInicio = await pag.locator('.timeline-card .cal-cab div').allTextContents();
conf('a semana da página inicial vira a mesma grade',
  cabInicio.join(',') === 'seg,ter,qua,qui,sex,sáb,dom');
const naHome = await pag.evaluate(() =>
  [...document.querySelectorAll('.timeline-card .cal-barra')].map((b) => b.textContent.trim()));
conf('com as campanhas como barra', naHome.some((t) => t.includes('Dia D')));
conf('e sem a linha do tempo de bolinhas antiga',
  await pag.locator('.timeline-card .milestone-dot').count() === 0);
conf('sem moldura dupla: o cartão da home já é a moldura',
  await pag.evaluate(() => {
    const g = document.querySelector('.timeline-card .cal-grade');
    return g && getComputedStyle(g).borderTopWidth === '0px';
  }));
conf('o rótulo do cartão acompanha o que passou a mostrar',
  (await pag.locator('.timeline-card .timeline-head span').textContent()).includes('prazos da semana'));
await pag.screenshot({ path: 'teste/19-inicio.png' });

await pag.evaluate(() => {
  const b = [...document.querySelectorAll('button,a,[role="button"]')]
    .find(x => /planejamento/i.test(x.textContent + ' ' + (x.title||'')) && x.offsetParent);
  b?.click();
});
await pag.waitForTimeout(500);
await pag.selectOption('#brandSelect', 'Botanika').catch(() => {});
await pag.waitForTimeout(400);
await pag.locator('.plan-tab', { hasText: 'Mês' }).first().click();
await pag.waitForTimeout(900);

conf('a faixa traz os sete filtros', await pag.locator('.cal-faixa .cal-filtros button').count() >= 7);
conf('as seis contínuas ficam na faixa', (await faixaDo('planMonthGrid')).length === 6);

const barras = await barrasDo('planMonthGrid');
conf('a campanha vira barra, não chip por dia', barras.length > 0);
conf('nenhuma contínua entra na grade', !barras.some((b) => /Orgânico|Perpétuo/.test(b.nome)));
const sem = barras.filter((b) => b.nome.includes('Semana do Cliente'));
conf('a Semana do Cliente atravessa os dias', sem.some((b) => b.larg > 250));
const diaD = barras.find((b) => b.nome.includes('Dia D'));
conf('o Dia D ocupa um dia só', diaD && diaD.larg < 220);
conf('a barra cortada pela virada de semana ganha a setinha',
  barras.some((b) => /[‹›]/.test(b.nome)));

await pag.screenshot({ path: 'teste/12-mes.png' });

/* filtro por tipo */
await filtrar('planMonthGrid', 'Gap');
await pag.waitForTimeout(700);
const gap = await barrasDo('planMonthGrid');
conf('filtrar por Gap deixa só a ação de gap', gap.length > 0 && gap.every((b) => b.nome.includes('gap')));
await filtrar('planMonthGrid', 'Pontuais');
await pag.waitForTimeout(700);
const pont = await barrasDo('planMonthGrid');
conf('Pontuais traz as três com data', new Set(pont.map(b => b.nome.replace(/[‹›\s]/g,''))).size === 3);
await filtrar('planMonthGrid', 'Tudo');
await pag.waitForTimeout(700);

/* contínuas dentro e fora da grade */
await alternar('planMonthGrid');
await pag.waitForTimeout(800);
const tudo = await barrasDo('planMonthGrid');
conf('o botão traz as contínuas para a grade', tudo.some((b) => /Orgânico/.test(b.nome)));
conf('e o Dia D continua visível', tudo.some((b) => b.nome.includes('Dia D')));
conf('barras que se cruzam ficam em alturas diferentes',
  new Set(tudo.filter(b => b.larg > 10).map((b) => b.topo)).size > 1);
await alternar('planMonthGrid');
await pag.waitForTimeout(800);

/* a semana, de segunda a domingo */
await pag.locator('.plan-tab', { hasText: 'Semana' }).first().click();
await pag.waitForTimeout(900);
conf('a semana vai de segunda a domingo',
  (await pag.locator('#planWeekGrid .cal-cab div').allTextContents()).join(',') === 'seg,ter,qua,qui,sex,sáb,dom');
const naSem = await barrasDo('planWeekGrid');
conf('a semana mostra o Dia D como barra', naSem.some((b) => b.nome.includes('Dia D')));
conf('e não repete as contínuas', !naSem.some((b) => /Orgânico/.test(b.nome)));
/* sem tarefas gravadas, a faixa de prazos não aparece — melhor do que
   sete colunas dizendo "sem prazo" */
conf('sem prazos gravados, a faixa de prazos não aparece',
  await pag.locator('#planWeekGrid .cal-cols').count() === 0);

/* com prazos, ela aparece */
await pag.evaluate(() => {
  localStorage.setItem('central.tasks.vitor-gutierrez', JSON.stringify([
    { id: 't1', title: 'Programar disparo do Dia D', due: '2026-09-09',
      brand: 'Botanika', assignees: ['Sarah'], status: 'a fazer' },
    { id: 't2', title: 'Aprovar criativos', due: '2026-09-11',
      brand: 'Botanika', assignees: ['Ítalo'], status: 'fazendo' },
  ]));
});
await filtrar('planWeekGrid', 'Pontuais');
await pag.waitForTimeout(700);
await filtrar('planWeekGrid', 'Tudo');
await pag.waitForTimeout(700);
conf('com prazos gravados, eles aparecem embaixo da semana',
  await pag.locator('#planWeekGrid .cal-tarefa').count() === 2);
await pag.screenshot({ path: 'teste/13-semana.png' });

/* e a aba Campanhas com a mesma grade */
await pag.evaluate(() => {
  const b = [...document.querySelectorAll('button,a,[role="button"]')]
    .find(x => /^campanhas$/i.test(x.textContent.trim()) && x.offsetParent);
  b?.click();
});
await pag.waitForTimeout(1000);
const naCamp = await barrasDo('campaignCalendar');
conf('a aba Campanhas usa a mesma grade de barras', naCamp.length > 0);
conf('e também sem as contínuas repetidas', !naCamp.some((b) => /Orgânico/.test(b.nome)));
await pag.screenshot({ path: 'teste/14-campanhas.png' });

console.log(ok.map(s => '  ✓ ' + s).join('\n'));
console.log(`\ncalendário: ${ok.length} checagens passaram`);
await nav.close(); srv.close();
