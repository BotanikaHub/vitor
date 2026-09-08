/* As contínuas ocupavam as duas vagas de cada dia do mês e escondiam o que
   tem data. Aqui carrego as 18 campanhas de setembro — 12 contínuas e 6
   pontuais — e confiro que o pontual aparece. */
import { chromium } from '/home/user/vitor/node_modules/playwright-core/index.mjs';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const srv = createServer((_, r) => { r.writeHead(200,{'content-type':'text/html; charset=utf-8'}); r.end(html) }).listen(0);
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const pag = await nav.newPage({ viewport: { width: 1440, height: 1000 } });
pag.on('pageerror', (e) => console.log('  [erro na página]', e.message));

/* o mesmo desenho do banco: seis contínuas e três pontuais por marca */
const camps = [];
const põe = (marca, nome, tipo, ini, fim) => camps.push({
  id: 'c' + camps.length, name: nome, brand: marca, type: tipo,
  status: 'Em execução', owner: 'Vitor Gutierrez', start: ini, end: fim,
  goal: 50000, budget: 5000, progress: 0,
  color: marca === 'Botanika' ? '#121415' : '#4f8a70',
  objective: '', offer: '', channels: [], products: [], benefits: [], schedule: [], tap: [] });
for (const m of ['Botanika', 'VermeFree']) {
  ['API', 'E-mail', 'Instagram', 'Grupo VIP', 'Influencers'].forEach((n) =>
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

await pag.evaluate(() => {
  const b = [...document.querySelectorAll('button,a,[role="button"]')]
    .find(x => /planejamento/i.test(x.textContent + ' ' + (x.title||'')) && x.offsetParent);
  b?.click();
});
await pag.waitForTimeout(500);
/* com "Todas as marcas" a faixa junta as doze, o que está certo; aqui
   quero a leitura de uma marca, que é como o Vitor trabalha */
await pag.selectOption('#brandSelect', 'Botanika').catch(() => {});
await pag.waitForTimeout(400);
await pag.locator('.plan-tab', { hasText: 'Mês' }).first().click();
await pag.waitForTimeout(900);

const ok = [];
const conf = (n, v) => { assert.ok(v, n); ok.push(n) };

conf('a faixa das contínuas aparece', await pag.locator('.cal-faixa').count() >= 1);
/* existe uma faixa por grade — mês e semana — então a contagem tem que
   ser da faixa daquela grade, não das duas somadas */
const faixaDo = (id) => pag.evaluate((g) => {
  const grade = document.getElementById(g);
  const f = grade?.previousElementSibling;
  return f && f.classList.contains('cal-faixa')
    ? [...f.querySelectorAll('.cal-chip')].map((c) => c.textContent.trim()) : [];
}, id);
const naFaixa = await faixaDo('planMonthGrid');
conf('as seis contínuas da marca estão na faixa (' + naFaixa.length + ')', naFaixa.length === 6);
conf('e são as de rodar o mês todo', naFaixa.every(t => /Orgânico|Perpétuo/.test(t)));

/* o dia 9 é o Dia D: tem que aparecer, e antes era engolido */
const dia9 = pag.locator('.month-day', { has: pag.locator('.month-num', { hasText: /^9$/ }) }).first();
const noDia9 = await dia9.locator('.cal-chip').allTextContents();
conf('o Dia D aparece no dia 9', noDia9.some(t => t.includes('Dia D')));
conf('e nenhuma contínua ocupa o dia', !noDia9.some(t => /Orgânico|Perpétuo/.test(t)));

const dia15 = pag.locator('.month-day', { has: pag.locator('.month-num', { hasText: /^15$/ }) }).first();
conf('a Semana do Cliente aparece no meio dela (dia 15)',
  (await dia15.locator('.cal-chip').allTextContents()).some(t => t.includes('Semana do Cliente')));

const dia3 = pag.locator('.month-day', { has: pag.locator('.month-num', { hasText: /^3$/ }) }).first();
conf('dia sem nada pontual fica limpo', await dia3.locator('.cal-chip').count() === 0);

/* o botão traz as contínuas de volta para dentro da grade */
await pag.locator('.cal-alternar').first().click();
await pag.waitForTimeout(600);
const dia9Cheio = await dia9.locator('.cal-chip').allTextContents();
conf('o botão traz as contínuas para a grade', dia9Cheio.some(t => /Orgânico|Perpétuo/.test(t)));
conf('e o Dia D continua visível junto', dia9Cheio.some(t => t.includes('Dia D')));
await pag.locator('.cal-alternar').first().click();
await pag.waitForTimeout(600);
conf('e dá para tirar de novo',
  !(await dia9.locator('.cal-chip').allTextContents()).some(t => /Orgânico/.test(t)));

await pag.screenshot({ path: 'teste/12-mes.png' });

/* a mesma leitura na semana */
await pag.locator('.plan-tab', { hasText: 'Semana' }).first().click();
await pag.waitForTimeout(800);
conf('a semana também tem a faixa', (await faixaDo('planWeekGrid')).length === 6);
const qua = pag.locator('#planWeekGrid .plan-day').nth(2);
const naQua = await qua.locator('.week-campaign-card b').allTextContents();
conf('na quarta (09/09) aparece o Dia D', naQua.some(t => t.includes('Dia D')));
conf('e as contínuas não enchem o dia', !naQua.some(t => /Orgânico/.test(t)));
await pag.screenshot({ path: 'teste/13-semana.png' });

console.log(ok.map(s => '  ✓ ' + s).join('\n'));
console.log(`\ncalendário: ${ok.length} checagens passaram`);
await nav.close(); srv.close();
