/* Procura conteúdo cortado: elemento cuja caixa passa da borda do pai que
   esconde o excedente. É o que aparece nas fotos — os campos da coluna da
   direita do painel entrando por baixo da borda. */
import { chromium } from '/home/user/vitor/node_modules/playwright-core/index.mjs';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const srv = createServer((_, r) => { r.writeHead(200,{'content-type':'text/html; charset=utf-8'}); r.end(html) }).listen(0);
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const pag = await nav.newPage({ viewport: { width: 1440, height: 900 } });
await pag.addInitScript(() => { window.supabase = { createClient: () => ({
  auth:{getSession:async()=>({data:{session:{user:{id:'u1',email:'v@b.com'}}}}),signOut:async()=>({})},
  from:()=>({select:()=>({or:async()=>({data:[],error:null}),eq:()=>({maybeSingle:async()=>({data:null})})}),upsert:async()=>({error:null})}) }) } });
await pag.route('**/supabase.js', (r) => r.fulfill({ status:200, body:'', contentType:'application/javascript' }));
await pag.goto(`http://127.0.0.1:${srv.address().port}/`, { waitUntil:'networkidle' });
await pag.locator('text=Tarefas').first().click(); await pag.waitForTimeout(400);
await pag.getByText('DIA D — Programar disparos de e-mail e WhatsApp').first().click();
await pag.waitForTimeout(700);

console.log(await pag.evaluate(() => {
  const painel = document.querySelector('.tdrawer-panel');
  const pr = painel.getBoundingClientRect();
  const fora = [];
  for (const e of painel.querySelectorAll('*')) {
    const r = e.getBoundingClientRect();
    if (r.width < 40 || r.height < 12) continue;
    if (r.right > pr.right - 1 || r.left < pr.left + 1)
      fora.push(`${e.tagName}.${String(e.className).split(' ').slice(0,2).join('.')} ` +
        `[${Math.round(r.left)}→${Math.round(r.right)}]  painel [${Math.round(pr.left)}→${Math.round(pr.right)}]`);
  }
  const col = document.querySelector('.tdetail-side, .tdrawer-side, .tside');
  const info = col ? (() => { const r = col.getBoundingClientRect(), s = getComputedStyle(col);
    return `coluna: ${String(col.className)} [${Math.round(r.left)}→${Math.round(r.right)}] w=${s.width} pad=${s.padding} overflow=${s.overflow}` })() : 'coluna lateral não encontrada';
  return info + '\n' + ([...new Set(fora)].slice(0,10).join('\n') || 'nada cortado');
}));
await nav.close(); srv.close();
