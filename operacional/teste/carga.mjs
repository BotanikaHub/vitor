/* Prova que o dado do banco chega até a tela: o app sobe com o estado que a
   busca trouxe, e não com o padrão que ele traz embutido. O Supabase é
   dublê porque o sandbox não alcança supabase.co — o que se testa aqui é o
   caminho, não a rede. */
import { chromium } from '/home/user/vitor/node_modules/playwright-core/index.mjs';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const srv = createServer((_, r) => { r.writeHead(200,{'content-type':'text/html; charset=utf-8'}); r.end(html) }).listen(0);
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const pag = await nav.newPage({ viewport: { width: 1440, height: 900 } });

/* 18 campanhas e um mapa por marca, como está no banco de verdade */
const campanhas = Array.from({ length: 18 }, (_, i) => ({
  id: 'pl-' + (i + 1), name: 'Campanha ' + (i + 1),
  brand: i < 9 ? 'Botanika' : 'VermeFree', type: 'Dia D', status: 'Em execução',
  owner: 'Vitor Gutierrez', start: '2026-09-01', end: '2026-09-30',
  goal: 50000, budget: 0, progress: 0, color: '#121415',
  objective: 'objetivo', offer: 'oferta', channels: [], products: [], benefits: [],
  schedule: [['09/09', 'E-mail', 'disparo', 'Pedro']],
  tap: [{ title: 'SOBRE O EVENTO', columns: ['Campo','Valor'], rows: [['Nome', 'Campanha ' + (i+1)]] }],
}));
const noDe = (marca) => ({ v: 2, nome: 'Mapa ' + marca, layout: 'direita', prox: 4, proxItem: 1, itens: [],
  nos: [{ id: 1, pai: null, t: marca, cor: 0, x: 4500, y: 3000 },
        { id: 2, pai: 1, t: marca + ' — ramo A', x: 4500, y: 3000 },
        { id: 3, pai: 1, t: marca + ' — ramo B', x: 4500, y: 3000 }] });

await pag.addInitScript(({ camps, bot, verm }) => {
  window.__linhas = [
    { chave: 'central.campaigns.vitor-gutierrez', dono: null, valor: camps },
    { chave: 'central.planning.map.vitor-gutierrez.Botanika', dono: null, valor: bot },
    { chave: 'central.planning.map.vitor-gutierrez.VermeFree', dono: null, valor: verm },
  ];
  window.supabase = { createClient: () => ({
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u1', email: 'v@b.com' } } } }), signOut: async () => ({}) },
    from: () => ({
      select: () => ({ or: async () => ({ data: window.__linhas, error: null }),
                       eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
      upsert: async () => ({ error: null }),
    }),
  }) };
}, { camps: campanhas, bot: noDe('Botanika'), verm: noDe('VermeFree') });
await pag.route('**/supabase.js', (r) => r.fulfill({ status:200, body:'', contentType:'application/javascript' }));
await pag.goto(`http://127.0.0.1:${srv.address().port}/`, { waitUntil:'networkidle' });
await pag.waitForTimeout(1200);   // a busca escreve e a página recarrega uma vez

const guardadas = await pag.evaluate(() =>
  JSON.parse(localStorage.getItem('central.campaigns.vitor-gutierrez') || '[]').length);
assert.equal(guardadas, 18, 'as 18 campanhas do banco venceram o padrão do app');
console.log('  ✓ as 18 campanhas do banco chegam ao app (e não o padrão embutido)');

/* o mapa da marca que estiver selecionada */
await pag.evaluate(() => {
  const b = [...document.querySelectorAll('button,a,[role="button"]')]
    .find(x => /planejamento/i.test(x.textContent + ' ' + (x.title||'')) && x.offsetParent);
  b?.click();
});
await pag.waitForSelector('.mp-cerca', { timeout: 6000 });
await pag.waitForTimeout(700);
const marca1 = await pag.evaluate(() => document.getElementById('brandSelect')?.value || '');
const textos1 = await pag.locator('.mp-no').allTextContents();
assert.ok(textos1.some(t => t.includes(marca1)), `o mapa aberto é o da marca ${marca1}`);
console.log(`  ✓ abre o mapa da marca selecionada (${marca1}, ${textos1.length} nós)`);

/* trocar de marca troca de mapa */
const outra = marca1 === 'Botanika' ? 'VermeFree' : 'Botanika';
await pag.selectOption('#brandSelect', outra).catch(() => {});
await pag.waitForTimeout(900);
const textos2 = await pag.locator('.mp-no').allTextContents();
assert.ok(textos2.some(t => t.includes(outra)), 'trocar de marca troca o mapa');
console.log(`  ✓ trocar para ${outra} troca o mapa (${textos2.length} nós)`);

await pag.screenshot({ path: 'teste/08-carga.png' });
console.log('\ncarga: 3 checagens passaram');
await nav.close(); srv.close();
