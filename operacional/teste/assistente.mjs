/* Percorre o fluxo como o Vitor faria: clica no + da raiz, escolhe o
   formato, preenche e confirma. Depois confere que nasceu tudo — o nó no
   mapa, a campanha guardada e o TAP com as sete seções. */
import { chromium } from '/home/user/vitor/node_modules/playwright-core/index.mjs';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const srv = createServer((_, r) => { r.writeHead(200,{'content-type':'text/html; charset=utf-8'}); r.end(html) }).listen(0);
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const pag = await nav.newPage({ viewport: { width: 1440, height: 900 } });
pag.on('pageerror', (e) => console.log('  [erro na página]', e.message));
await pag.addInitScript(() => { window.supabase = { createClient: () => ({
  auth:{getSession:async()=>({data:{session:{user:{id:'u1',email:'v@b.com'}}}}),signOut:async()=>({})},
  from:()=>({select:()=>({or:async()=>({data:[],error:null}),eq:()=>({maybeSingle:async()=>({data:null})})}),upsert:async()=>({error:null})}) }) } });
await pag.route('**/supabase.js', (r) => r.fulfill({ status:200, body:'', contentType:'application/javascript' }));
await pag.goto(`http://127.0.0.1:${srv.address().port}/`, { waitUntil:'networkidle' });

await pag.evaluate(() => {
  const b = [...document.querySelectorAll('button,a,[role="button"]')]
    .find(x => /planejamento/i.test(x.textContent + ' ' + (x.title||'')) && x.offsetParent);
  b?.click();
});
await pag.waitForSelector('.mp-cerca', { timeout: 6000 });
await pag.waitForTimeout(700);

const ok = [];
const conf = (n, v) => { assert.ok(v, n); ok.push(n) };
const antes = await pag.evaluate(() =>
  JSON.parse(localStorage.getItem('central.campaigns.vitor-gutierrez') || '[]').length);

/* o + da raiz abre o assistente, e não um nó qualquer */
await pag.locator('.mp-no.mp-raiz').click();
await pag.waitForTimeout(200);
await pag.locator('.mp-no.mp-raiz .mp-mais').click();
await pag.waitForSelector('.as-cx', { timeout: 4000 });
conf('o + da raiz abre o assistente', true);

const formatos = await pag.locator('.as-op').allTextContents();
conf('oferece os formatos do planejador (' + formatos.length + ')', formatos.length === 7);
conf('tem Dia D, Semana temática e Livre',
  formatos.some(t => t.includes('Dia D')) && formatos.some(t => t.includes('Semana temática'))
  && formatos.some(t => t.includes('Livre')));

/* Semana temática pede o tema antes das datas */
await pag.locator('.as-op', { hasText: 'Semana temática' }).click();
await pag.waitForTimeout(250);
conf('semana temática pergunta o tema antes', (await pag.locator('.as-cx h3').textContent()).includes('tema'));

pag.once('dialog', d => d.accept('Imunidade'));
await pag.locator('[data-novo]').click();
await pag.waitForTimeout(350);
conf('o nome já vem do tema',
  (await pag.inputValue('#as-nome')).includes('Imunidade'));

/* as datas vieram do formato: cinco dias */
const ini = await pag.inputValue('#as-ini'), fim = await pag.inputValue('#as-fim');
const dias = Math.round((new Date(fim) - new Date(ini)) / 86400000) + 1;
conf('o formato já sugeriu as datas (' + dias + ' dias)', dias === 5);

/* o resumo recalcula ao vivo, e entende "120 mil" */
await pag.fill('#as-meta', '120 mil');
await pag.fill('#as-verba', '12.000');
await pag.waitForTimeout(200);
const resumo = await pag.locator('#as-resumo').textContent();
conf('o resumo mostra o ROAS implícito (10,0)', resumo.includes('10,0'));
conf('o resumo mostra quanto a marca passa a somar no mês', /R\$/.test(resumo));

/* datas invertidas são recusadas antes de criar */
await pag.fill('#as-fim', '2020-01-01');
await pag.waitForTimeout(200);
conf('recusa data de fim antes do início',
  (await pag.locator('#as-resumo').textContent()).includes('Confira as datas'));
await pag.fill('#as-fim', fim);
await pag.waitForTimeout(200);

await pag.locator('[data-criar]').click();
await pag.waitForTimeout(700);

const depois = await pag.evaluate(() =>
  JSON.parse(localStorage.getItem('central.campaigns.vitor-gutierrez') || '[]'));
conf('a campanha foi guardada', depois.length === antes + 1);
const c = depois[depois.length - 1];
conf('meta lida de "120 mil" = 120000', c.goal === 120000);
conf('o tipo virou Semana temática', c.type === 'Semana temática');
conf('o TAP nasceu com as sete seções', Array.isArray(c.tap) && c.tap.length === 7);
conf('as seções são as do planejador',
  c.tap.map(s => s.title).join('|').includes('SOBRE O EVENTO')
  && c.tap.map(s => s.title).join('|').includes('CANAIS · CRONOGRAMA'));
const canais = c.tap.find(s => s.title.includes('CANAIS'));
conf('o cronograma tem uma coluna por dia (' + (canais.columns.length - 3) + ' dias)',
  canais.columns.length === 3 + 5 - 1 + 1);
conf('o TAP lista os dez canais', canais.rows.length === 10);
const fases = c.tap.find(s => s.title === 'FASES');
conf('as fases nasceram preenchidas', fases.rows.length >= 4);

/* e no mapa: o nó com o selo de campanha */
const noCamp = await pag.locator('.mp-no .mp-camp').count();
conf('o nó da campanha aparece no mapa com o selo', noCamp === 1);
const textos = await pag.locator('.mp-no').allTextContents();
conf('o nó leva o nome da campanha', textos.some(t => t.includes('Imunidade')));

/* o botão "+ Nova campanha" da própria página também abre o assistente:
   dois caminhos de criação gerando TAPs diferentes fariam a operação
   divergir de si mesma */
await pag.evaluate(() => document.getElementById('planAddCampaignBtn')?.click());
await pag.waitForTimeout(400);
conf('o + Nova campanha da página abre o mesmo assistente',
  await pag.locator('.as-cx').count() === 1
  && (await pag.locator('.as-cx h3').textContent()).includes('Nova campanha'));
await pag.keyboard.press('Escape'); await pag.waitForTimeout(200);
conf('Esc fecha o assistente', await pag.locator('.as-cx').count() === 0);

await pag.screenshot({ path: 'teste/09-assistente.png' });
console.log(ok.map(s => '  ✓ ' + s).join('\n'));
console.log(`\nassistente: ${ok.length} checagens passaram`);
await nav.close(); srv.close();
