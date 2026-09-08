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
conf('o resumo conta os dias de preparação antes da ação',
  (await pag.locator('#as-resumo').textContent()).includes('de preparação antes'));

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

/* passo 2: produtos do catálogo da Shopify */
await pag.locator('[data-adiante]').click();
await pag.waitForTimeout(350);
conf('o passo de oferta abre', (await pag.locator('.as-cx h3').textContent()).includes('Produtos'));
const linhas = await pag.locator('.as-lin[data-sku]').count();
conf('o catálogo da Shopify aparece (' + linhas + ' produtos)', linhas === 10);
conf('todos vêm marcados', await pag.locator('.as-lin[data-sku] input:checked').count() === 10);
await pag.screenshot({ path: 'teste/10-oferta.png' });

/* desmarcar um produto o tira da oferta */
await pag.locator('.as-lin[data-sku="80.1.5"] input[type=checkbox]').uncheck();
await pag.waitForTimeout(150);

/* um % por produto */
await pag.locator('[data-modo="cada"]').click();
await pag.waitForTimeout(300);
conf('dá para dar um desconto por produto',
  await pag.locator('.as-dsku').first().isVisible());
await pag.locator('.as-dsku[data-sku="80.1.1"]').fill('25');
await pag.locator('.as-dsku[data-sku="80.1.1"]').dispatchEvent('change');

await pag.fill('#as-extras', 'Combo Fitness · 15% OFF');
await pag.fill('#as-brinde', 'Coqueteleira acima de R$ 400');
await pag.waitForTimeout(150);

/* passo 3: canais que faturam */
await pag.locator('[data-adiante]').click();
await pag.waitForTimeout(350);
conf('o passo de canais abre', (await pag.locator('.as-cx h3').textContent()).includes('verba'));
conf('lista os seis canais de receita', await pag.locator('.as-lin3').count() === 6);
const somas = await pag.locator('#as-somas').textContent();
conf('a divisão já fecha com a meta da ação', somas.includes('Fecha com a meta'));
await pag.screenshot({ path: 'teste/11-canais.png' });

/* desligar um canal deixa a soma abaixo da meta, e a tela avisa */
await pag.locator('[data-on="1"]').uncheck();
await pag.waitForTimeout(250);
conf('desligar um canal avisa que falta para bater a meta',
  (await pag.locator('#as-somas').textContent()).includes('Faltam'));
await pag.locator('[data-on="1"]').check();
await pag.waitForTimeout(250);

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
/* semana temática: 5 dias de ação + 2 de preparação = 7 colunas,
   mais Canal, Base e Quem faz */
conf('o cronograma abre a janela com a preparação (' + (canais.columns.length - 3) + ' colunas)',
  canais.columns.length === 3 + 7);
conf('o TAP lista os dez canais', canais.rows.length === 10);

/* e o ponto todo: nasce preenchido, não uma grade de traços */
const linhaEmail = canais.rows.find(r => r[0] === 'E-mails base antiga');
const celulas = linhaEmail.slice(2, -1);
conf('o cronograma nasce preenchido, não com traços',
  celulas.filter(v => v !== '—').length === celulas.length);
conf('o primeiro dia da janela é de antecipação', celulas[0] === '1 sem CTA');
conf('a véspera avisa que é amanhã', celulas[1] === '1 é amanhã');
conf('o dia de abertura tem o disparo de venda', celulas[2] === '2 vendas');
conf('o último dia é de última chance', celulas[celulas.length - 1] === '2 última chance');
const site = canais.rows.find(r => r[0] === 'Alteração no site');
conf('o site sobe na abertura e sai no fim',
  site[4] === '00h no ar' && site[site.length - 2] === '23h59 tira do ar');
const captada = canais.rows.find(r => r[0] === 'E-mails base captada');
conf('canal sem ritmo padrão nasce vazio de propósito',
  captada.slice(2, -1).every(v => v === '—'));

const ticket = c.tap.find(s => s.title === 'AUMENTO DE TICKET MÉDIO');
conf('o ticket médio traz orderbump e desconto por volume',
  ticket.rows.some(r => r[0] === 'Orderbump') &&
  ticket.rows.some(r => r[0] === 'Desconto por volume' && r[2] === 'até 20%'));
const fases = c.tap.find(s => s.title === 'FASES');
conf('as fases nasceram preenchidas', fases.rows.length >= 4);

const oferta = c.tap.find(s => s.title === 'SOBRE A OFERTA');
conf('a oferta lista os 9 produtos marcados mais o de fora do catálogo',
  oferta.rows.length === 10);
conf('o produto desmarcado ficou de fora',
  !oferta.rows.some(r => r[0].startsWith('Hair')));
conf('o desconto por produto foi respeitado (25%)',
  oferta.rows.some(r => r[0].startsWith('Tri[Mg]') && r[2] === '25% OFF'));
conf('o produto escrito à mão entrou',
  oferta.rows.some(r => r[0] === 'Fora do catálogo' && r[1].includes('Combo Fitness')));
conf('os produtos também vão para o campo products da campanha',
  Array.isArray(c.products) && c.products.length === 9);

const evento = c.tap.find(s => s.title === 'SOBRE O EVENTO');
conf('o brinde entrou no TAP',
  evento.rows.some(r => r[0] === 'Brinde' && r[1].includes('Coqueteleira')));

const metas = c.tap.find(s => s.title === 'METAS');
conf('as metas saem canal a canal',
  metas.rows.filter(r => r[0].startsWith('Meta faturamento —')).length === 6);
conf('a soma das metas por canal bate com a meta da ação',
  metas.rows.some(r => r[0] === 'Meta faturamento total' && r[1].includes('120.000')));

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
