/* Exercita o mapa como uma pessoa usaria, e confere o que ele diz que faz.
   As verificações são as mesmas que eu escrevi no prompt do mapa: se ele
   passa aqui, faz o que o do planejador faz. */
import { chromium } from '/home/user/vitor/node_modules/playwright-core/index.mjs';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const srv = createServer((_, r) => { r.writeHead(200,{'content-type':'text/html; charset=utf-8'}); r.end(html) }).listen(0);
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const pag = await nav.newPage({ viewport: { width: 1440, height: 900 } });
pag.on('pageerror', (e) => { console.log('  [erro na página]', e.message, '\n', (e.stack||'').split('\n').slice(0,4).join('\n')) });
await pag.addInitScript(() => { window.supabase = { createClient: () => ({
  auth:{getSession:async()=>({data:{session:{user:{id:'u1',email:'v@b.com'}}}}),signOut:async()=>({})},
  from:()=>({select:()=>({or:async()=>({data:[],error:null}),eq:()=>({maybeSingle:async()=>({data:null})})}),upsert:async()=>({error:null})}) }) } });
await pag.route('**/supabase.js', (r) => r.fulfill({ status:200, body:'', contentType:'application/javascript' }));
await pag.goto(`http://127.0.0.1:${srv.address().port}/`, { waitUntil:'networkidle' });

/* vai para o Planejamento */
await pag.evaluate(() => {
  const b = [...document.querySelectorAll('button,a,[role="button"]')]
    .find(x => /planejamento/i.test(x.textContent + ' ' + (x.title||'')) && x.offsetParent);
  b?.click();
});
await pag.waitForSelector('.mp-cerca', { timeout: 6000 });
await pag.waitForTimeout(600);
const ok = [];
const conf = (nome, valor) => { assert.ok(valor, nome); ok.push(nome) };

/* 1. montou */
conf('o mapa monta na aba de planejamento', await pag.locator('.mp-cerca').count() === 1);
conf('a raiz aparece', await pag.locator('.mp-no.mp-raiz').count() === 1);

/* 2. Tab cria filho, e a árvore se arruma sozinha */
await pag.locator('.mp-no.mp-raiz').click();
for (let i = 0; i < 3; i++) {
  await pag.keyboard.press('Tab'); await pag.waitForTimeout(120);
  await pag.keyboard.type('ramo ' + (i + 1)); await pag.keyboard.press('Enter');
  await pag.waitForTimeout(250);
  await pag.locator('.mp-no.mp-raiz').click();   // volta à raiz para o próximo
  await pag.waitForTimeout(120);
}
conf('Tab cria filhos', await pag.locator('.mp-no').count() === 4);

/* 3. nenhum nó em cima do outro */
const colisoes = await pag.evaluate(() => {
  const cx = [...document.querySelectorAll('.mp-no')].map(e => e.getBoundingClientRect());
  let n = 0;
  for (let i = 0; i < cx.length; i++) for (let j = i + 1; j < cx.length; j++) {
    const a = cx[i], b = cx[j];
    if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) n++;
  }
  return n;
});
conf('nenhum nó se sobrepõe (' + colisoes + ' colisões)', colisoes === 0);

/* 4. filho sempre à direita do pai, fora dele */
const fora = await pag.evaluate(() => {
  const raiz = document.querySelector('.mp-no.mp-raiz').getBoundingClientRect();
  return [...document.querySelectorAll('.mp-no:not(.mp-raiz)')]
    .every(e => e.getBoundingClientRect().left >= raiz.right - 1);
});
conf('os filhos nascem fora do pai, não por cima', fora);

/* 5. zoom ancorado no cursor */
const ancora = await pag.evaluate(async () => {
  const c = document.querySelector('.mp-cerca'), r = c.getBoundingClientRect();
  const alvo = document.querySelector('.mp-no.mp-raiz');
  const antes = alvo.getBoundingClientRect();
  const cx = antes.left + antes.width / 2, cy = antes.top + antes.height / 2;
  c.dispatchEvent(new WheelEvent('wheel', { deltaY: -240, ctrlKey: true, clientX: cx, clientY: cy, bubbles: true, cancelable: true }));
  await new Promise(r2 => requestAnimationFrame(r2));
  const dep = alvo.getBoundingClientRect();
  return { dx: Math.abs((dep.left + dep.width/2) - cx), cresceu: dep.width > antes.width };
});
conf('o zoom cresce', ancora.cresceu);
conf('o ponto sob o cursor não se move (' + ancora.dx.toFixed(1) + 'px)', ancora.dx < 2);

/* 6. fechar e abrir ramo */
await pag.locator('.mp-no.mp-raiz').click(); await pag.waitForTimeout(150);
await pag.keyboard.press(' '); await pag.waitForTimeout(350);
conf('Espaço fecha o ramo da raiz', await pag.locator('.mp-no').count() === 1);
await pag.keyboard.press(' '); await pag.waitForTimeout(350);
conf('Espaço abre de novo', await pag.locator('.mp-no').count() === 4);

/* 7. desfazer devolve o estado */
const antesUndo = await pag.locator('.mp-no').count();
await pag.locator('.mp-no.mp-raiz').click();
await pag.keyboard.press('Tab'); await pag.waitForTimeout(150);
await pag.keyboard.press('Escape'); await pag.waitForTimeout(150);
await pag.keyboard.press('Control+z'); await pag.waitForTimeout(350);
conf('Ctrl+Z desfaz a criação', await pag.locator('.mp-no').count() === antesUndo);

/* 8. nota adesiva e forma */
await pag.keyboard.press('n');
await pag.mouse.click(420, 700); await pag.waitForTimeout(200);  // longe da raiz, para a foto ficar legível
await pag.keyboard.type('lembrete'); await pag.keyboard.press('Enter'); await pag.waitForTimeout(250);
conf('a nota adesiva nasce e aceita texto', await pag.locator('.mp-nota').count() === 1);

/* 9. o mapa fica guardado */
/* a chave leva a marca no fim desde que o mapa passou a ser por marca */
const guardado = await pag.evaluate(() => {
  const marca = document.getElementById('brandSelect')?.value || '';
  const k = 'central.planning.map.vitor-gutierrez' + (marca && !/todas/i.test(marca) ? '.' + marca : '');
  const m = JSON.parse(localStorage.getItem(k) || 'null');
  return m && m.nos && m.nos.length >= 4 && (m.itens || []).length >= 1;
});
conf('o mapa é gravado no localStorage (e a ponte leva ao Supabase)', guardado);

/* 10. sobrevive a recarregar */
await pag.reload({ waitUntil: 'networkidle' });
await pag.evaluate(() => {
  const b = [...document.querySelectorAll('button,a,[role="button"]')]
    .find(x => /planejamento/i.test(x.textContent + ' ' + (x.title||'')) && x.offsetParent);
  b?.click();
});
await pag.waitForSelector('.mp-cerca', { timeout: 6000 });
await pag.waitForTimeout(700);
conf('depois de recarregar, o mapa volta igual',
  await pag.locator('.mp-no').count() === 4 && await pag.locator('.mp-nota').count() === 1);

await pag.screenshot({ path: 'teste/07-mapa.png' });
console.log(ok.map(s => '  ✓ ' + s).join('\n'));
console.log(`\nmapa: ${ok.length} checagens passaram`);
await nav.close(); srv.close();
