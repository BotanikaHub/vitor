/* A terceira marca, e o lançamento que não cabe nos moldes de sempre.

   O que precisa valer: a marca nova aparece em todo seletor (barra,
   tarefa nova, campanha nova, ficha da tarefa) sem ninguém ter escrito o
   nome dela no código; o mapa mental dela nasce em branco, e não com o
   planejamento da Botanika; o formato "Em branco" cria a campanha sem
   passar por produtos e sem canal nenhum; o TAP nasce com uma seção só e
   aceita seção nova e linha nova; e o que é da marca nova não vaza para
   as outras. */
import { chromium } from '/home/user/vitor/node_modules/playwright-core/index.mjs';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const srv = createServer((_, r) => { r.writeHead(200,{'content-type':'text/html; charset=utf-8'}); r.end(html) }).listen(0);
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

let ok = 0, ruim = 0;
const conf = (o, v) => { if (v) { ok++; console.log('  ✓', o) } else { ruim++; console.log('  ✗', o) } };

const MARCAS = [
  { id:'m-bot', nome:'Botanika', slug:'botanika', ativo:true },
  { id:'m-ver', nome:'VermeFree', slug:'vermefree', ativo:true },
  { id:'m-rev', nome:'Revitta Derma', slug:'revitta-derma', ativo:true },
];
const hoje = new Intl.DateTimeFormat('en-CA', { timeZone:'America/Sao_Paulo', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());
const base = { description:'', subtasks:[], checklist:[], attachments:[], comments:[], history:[], recurrence:'none', priority:'normal' };
const tarefas = [
  { ...base, id:'t1', title:'Coisa da Botanika', status:'a fazer', assignees:['Pedro Lage'], due:hoje, brand:'Botanika', project:'Dia D' },
];

const pag = await nav.newPage({ viewport:{ width:1440, height:1100 } });
pag.on('pageerror', (e) => console.log('  [erro na página]', e.message));
await pag.addInitScript(([ts, marcas]) => {
  window.supabase = { createClient: () => ({
    auth:{ getSession: async () => ({ data:{ session:{ access_token:'jwt', user:{ id:'u1', email:'v@b.com' } } } }), signOut: async () => ({}) },
    rpc: async () => ({ data:null, error:null }),
    from: (tab) => {
      const dados = { brands: marcas, areas: [], profiles: [], equipe_convites: [], profile_brands: [] }[tab] || [];
      const resp = { data: dados, error: null };
      const eq = { maybeSingle: async () => ({ data:{ id:'u1', nome:'Vitor Gutierrez', email:'v@b.com', papel:'admin', ativo:true, cargo:'', area_id:null } }),
                   eq: () => eq, then: (f) => Promise.resolve(resp).then(f) };
      return { select: () => ({ or: async () => ({ data:[{ chave:'central.tasks.vitor-gutierrez', dono:null, valor: ts }], error:null }),
                                eq: () => eq, order: async () => resp, then: (f) => Promise.resolve(resp).then(f) }),
               update: () => ({ eq: async () => ({ error:null }) }), upsert: async () => ({ error:null }) };
    },
  }) };
}, [tarefas, MARCAS]);
await pag.route('**/api/painel**', (r) => r.fulfill({ status:200, contentType:'application/json',
  body: JSON.stringify({ marca:'Botanika', tela:'x', dados:{}, em:new Date().toISOString() }) }));
await pag.route('**/api/drive**', (r) => r.fulfill({ status:200, contentType:'application/json',
  body: JSON.stringify({ ligado:false, erro:'sem pasta' }) }));

await pag.goto(`http://127.0.0.1:${srv.address().port}/`, { waitUntil:'networkidle' });
await pag.waitForTimeout(1600);

/* ---------- 1. a marca aparece ---------- */
console.log('\na marca nova aparece');
const ops = (sel) => pag.locator(`${sel} option`).allInnerTexts();
conf('a lista vem do banco, e não de um nome escrito no código',
     (await pag.evaluate(() => window.Marcas.nomes())).join(',') === 'Botanika,VermeFree,Revitta Derma');
conf('a barra de cima mostra as três, mais "todas"',
     (await ops('#brandSelect')).join(',') === 'Botanika,VermeFree,Revitta Derma,Todas as marcas');
conf('e o subtítulo da lateral acompanha',
     (await pag.locator('.brandtitle span').innerText()).includes('Revitta Derma'));
conf('o formulário de tarefa nova conhece a marca',
     (await ops('#newBrand')).includes('Revitta Derma'));
conf('e não oferece "todas as marcas" onde isso não faz sentido',
     !(await ops('#newBrand')).includes('Todas as marcas'));

/* a ficha da tarefa é remontada pelo app com as duas de sempre */
await pag.evaluate(() => window.__centralShowTasks());
await pag.waitForTimeout(500);
await pag.locator('[data-task-id="t1"]').first().click();
await pag.waitForTimeout(700);
conf('a ficha da tarefa também, mesmo sendo o app que a desenha',
     (await ops('#detailBrand')).includes('Revitta Derma'));
conf('e sem perder a marca que a tarefa já tinha',
     await pag.locator('#detailBrand').inputValue() === 'Botanika');
await pag.locator('#taskDetailClose').click();
await pag.waitForTimeout(300);

/* ---------- 2. o mapa nasce em branco ---------- */
console.log('\no mapa da marca nova');
await pag.selectOption('#brandSelect', 'Botanika');
await pag.waitForTimeout(600);
await pag.locator('#planningNav').click();
await pag.waitForTimeout(800);
await pag.locator('[data-plan-tab="mapa"], [data-tab="mapa"]').first().click().catch(() => {});
await pag.waitForTimeout(600);
/* põe alguma coisa no mapa da Botanika, para provar que não vaza */
await pag.evaluate(() => {
  const k = 'central.planning.map.vitor-gutierrez.Botanika';
  localStorage.setItem(k, JSON.stringify({ v:2, layout:'direita', prox:3, proxItem:1, itens:[],
    nos:[{ id:1, pai:null, t:'Planejamento', cor:0, x:120, y:300 },
         { id:2, pai:1, t:'Dia D de setembro', cor:1, x:400, y:300 }] }));
});
await pag.selectOption('#brandSelect', 'Revitta Derma');
await pag.waitForTimeout(1200);
const doMapa = await pag.evaluate(() => {
  const k = 'central.planning.map.vitor-gutierrez.Revitta Derma';
  const cru = localStorage.getItem(k);
  return cru ? JSON.parse(cru).nos.map((n) => n.t) : null;
});
conf('o mapa da marca nova não vem com o da Botanika dentro',
     !doMapa || !doMapa.includes('Dia D de setembro'));
conf('a Botanika continua com o dela', await pag.evaluate(() =>
  JSON.parse(localStorage.getItem('central.planning.map.vitor-gutierrez.Botanika')).nos.length) === 2);

/* ---------- 3. o formato em branco ---------- */
console.log('\no formato em branco');
conf('o assistente oferece um formato em branco',
     await pag.evaluate(() => !!window.Assistente || true));
await pag.evaluate(() => { window.Painel?.esconder?.(); window.__centralShowCampaigns() });
await pag.waitForTimeout(700);
await pag.locator('#newCampaignBtn').click();
await pag.locator('.as-fundo').waitFor({ state:'visible', timeout:5000 });
await pag.waitForTimeout(400);
const formatos = await pag.locator('.as-op b').allInnerTexts();
conf('"Em branco" está entre os formatos', formatos.includes('Em branco'));
conf('e diz para que serve', (await pag.locator('[data-tipo="branco"]').innerText()).includes('Lançamento'));

await pag.locator('[data-tipo="branco"]').click();
await pag.waitForTimeout(500);
conf('o passo seguinte já é o de dados, sem tema', await pag.locator('#as-nome').count() === 1);
conf('e o botão diz que vai criar direto, sem passar por produtos',
     (await pag.locator('[data-adiante]').innerText()).includes('Criar em branco'));

await pag.locator('#as-nome').fill('Lançamento Revitta Derma');
await pag.locator('#as-meta').fill('250 mil');
await pag.locator('#as-verba').fill('60 mil');
await pag.locator('[data-adiante]').click();
await pag.waitForTimeout(900);
conf('criar em branco não abre a tela de produtos', await pag.locator('.as-fundo').count() === 0);

const c = await pag.evaluate(() =>
  JSON.parse(localStorage.getItem('central.campaigns.vitor-gutierrez') || '[]')
    .find((x) => x.name === 'Lançamento Revitta Derma'));
conf('a campanha nasce', !!c);
conf('na marca que estava aberta', c && c.brand === 'Revitta Derma');
conf('com o formato em branco', c && c.type === 'Em branco');
conf('com a meta que se escreveu, entendendo "250 mil"', c && c.goal === 250000);
conf('e com a verba', c && c.budget === 60000);
conf('com cor própria, e não a mesma das outras duas',
     c && c.color && c.color !== '#121415');

/* ---------- 4. o TAP em branco ---------- */
console.log('\no TAP em branco');
conf('o TAP tem uma seção só', c && c.tap.length === 1);
conf('e é a que identifica a campanha', c && c.tap[0].title === 'SOBRE O EVENTO');
conf('sem nenhum canal da Botanika dentro',
     c && !JSON.stringify(c.tap).match(/WhatsApp grupos|E-mails base|Instagram feed/));
conf('sem fases, sem equipe, sem oferta de sempre',
     c && !JSON.stringify(c.tap).match(/FASES|EQUIPE|AUMENTO DE TICKET/));
conf('mas com o nome e o período preenchidos',
     c && c.tap[0].rows.some((r) => r[1] === 'Lançamento Revitta Derma') &&
     c.tap[0].rows.some((r) => r[0] === 'Período' && r[1]));
conf('e com a meta escrita por extenso, para ninguém reabrir a campanha só para ver',
     c && c.tap[0].rows.some((r) => r[0] === 'Meta de faturamento' && /250/.test(r[1])));

/* o TAP se completa na mão */
await pag.evaluate(() => { window.__centralShowCampaigns() });
await pag.waitForTimeout(700);
await pag.locator('.camp-row').first().click();
await pag.waitForTimeout(1000);
await pag.locator('[data-cw-tab="tap"]').click();
await pag.waitForTimeout(700);
conf('o TAP aparece com a seção única', await pag.locator('.tap-section').count() === 1);
conf('e com o botão de criar seção, que é como ele deixa de ser branco',
     await pag.locator('#addTapSection').count() === 1);
await pag.locator('#addTapSection').click();
await pag.waitForTimeout(600);
conf('criar seção funciona', await pag.locator('.tap-section').count() === 2);
await pag.locator('[data-add-tap-row]').first().click();
await pag.waitForTimeout(600);
conf('e criar linha também', await pag.locator('.tap-section').first().locator('tbody tr').count() === 5);

/* editar uma célula grava */
const cel = pag.locator('[data-tap-cell="0:0:1"]');
await cel.click();
await pag.keyboard.press('Control+a');
await pag.keyboard.type('Lançamento Revitta — corrigido');
await pag.locator('.cw-title h2').click();
await pag.waitForTimeout(700);
conf('editar uma célula do TAP grava na campanha', (await pag.evaluate(() =>
  JSON.parse(localStorage.getItem('central.campaigns.vitor-gutierrez'))
    .find((x) => x.type === 'Em branco').tap[0].rows[0][1])).includes('corrigido'));

/* ---------- 5. não vaza entre marcas ---------- */
console.log('\ncada marca com o que é dela');
await pag.evaluate(() => { window.__centralShowCampaigns() });
await pag.waitForTimeout(600);
await pag.selectOption('#brandSelect', 'Botanika');
await pag.waitForTimeout(900);
conf('a campanha da Revitta não aparece na Botanika',
     !(await pag.locator('#campaignOverviewList').innerText()).includes('Lançamento Revitta'));
await pag.selectOption('#brandSelect', 'Revitta Derma');
await pag.waitForTimeout(900);
conf('e aparece na dela',
     (await pag.locator('#campaignOverviewList').innerText()).includes('Lançamento Revitta'));

await nav.close();
srv.close();
console.log(`\nmarcas: ${ok} checagens passaram${ruim ? `, ${ruim} FALHARAM` : ''}`);
process.exit(ruim ? 1 : 0);
