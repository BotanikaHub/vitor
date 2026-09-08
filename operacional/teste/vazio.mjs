/* A caixa de entregas vazia esticava até o fim da janela. Aqui vou até ela
   pela barra lateral e meço a altura do bloco. */
import { chromium } from '/home/user/vitor/node_modules/playwright-core/index.mjs';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const srv = createServer((_, r) => { r.writeHead(200,{'content-type':'text/html; charset=utf-8'}); r.end(html) }).listen(0);
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const pag = await nav.newPage({ viewport: { width: 1440, height: 900 } });
await pag.addInitScript(() => { window.supabase = { createClient: () => ({
  auth:{getSession:async()=>({data:{session:{user:{id:'u1',email:'v@b.com'}}}}),signOut:async()=>({})},
  from:()=>({select:()=>({or:async()=>({data:[],error:null})}),upsert:async()=>({error:null})}) }) } });
await pag.route('**/supabase.js', (r) => r.fulfill({ status:200, body:'', contentType:'application/javascript' }));
await pag.goto(`http://127.0.0.1:${srv.address().port}/`, { waitUntil:'networkidle' });

/* acha o botão da barra lateral que leva às Entregas */
const achou = await pag.evaluate(() => {
  /* qualquer coisa clicável cujo texto, título ou data-* fale em entregas */
  const todos = [...document.querySelectorAll('button,a,[role="button"],[data-page],[data-route],[data-nav]')];
  const alvo = todos.find((b) => {
    const t = [b.textContent, b.title, b.getAttribute('aria-label'),
               ...Object.values(b.dataset || {})].join(' ');
    return /entrega/i.test(t) && b.offsetParent !== null;
  });
  if (!alvo) return null;
  alvo.click();
  return (alvo.title || alvo.textContent || JSON.stringify(alvo.dataset)).trim().slice(0, 40);
});
await pag.waitForTimeout(700);
console.log('naveguei por:', achou);
await pag.screenshot({ path: 'teste/06-entregas.png' });
console.log(await pag.evaluate(() => {
  const e = document.querySelector('.delivery-empty');
  if (!e) return 'não achei .delivery-empty nesta tela';
  const r = e.getBoundingClientRect();
  return `.delivery-empty: ${Math.round(r.width)}x${Math.round(r.height)}  (janela ${innerHeight}px)`;
}));
await nav.close(); srv.close();
