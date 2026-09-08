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
await pag.locator('text=Tarefas').first().click().catch(()=>{});
await pag.waitForTimeout(400);
await pag.getByText('DIA D — Programar disparos de e-mail e WhatsApp').first().click();
await pag.waitForTimeout(800);

await pag.screenshot({ path: 'teste/medir.png' });
await pag.waitForTimeout(2500);
console.log(await pag.evaluate(() => {
  const e = document.querySelector('.tdrawer-panel');
  const linhas = [];
  linhas.push('transform depois de 2,5s: ' + getComputedStyle(e).transform);
  for (const folha of document.styleSheets) {
    let regras; try { regras = folha.cssRules } catch { continue }
    const anda = (lista, meio) => { for (const x of lista) {
      if (x.cssRules) { anda(x.cssRules, x.conditionText || x.media?.mediaText || meio); continue }
      if (x.selectorText && /tdrawer-panel/.test(x.selectorText))
        linhas.push((meio ? '@media ' + meio + '  ' : '') + x.cssText.slice(0, 300));
    } };
    anda(regras, null);
  }
  return linhas.join('\n');
}));
await nav.close(); srv.close();
