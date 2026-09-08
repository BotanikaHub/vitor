/* Procura moldura dentro de moldura: um elemento com borda e canto
   arredondado logo dentro de outro igual, com pouca folga entre os dois. É
   isso que aparece como "linha duplicada" nas fotos que o Vitor mandou. */
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

console.log(await pag.evaluate(() => {
  const temBorda = (s) => parseFloat(s.borderTopWidth) > 0 && s.borderTopStyle !== 'none'
    && !/rgba\(0, 0, 0, 0\)|transparent/.test(s.borderTopColor);
  const arred = (s) => parseFloat(s.borderTopLeftRadius) >= 6;
  const achados = [];
  for (const e of document.querySelectorAll('*')) {
    const s = getComputedStyle(e);
    if (!temBorda(s) || !arred(s)) continue;
    const r = e.getBoundingClientRect();
    if (r.width < 200 || r.height < 60) continue;
    let p = e.parentElement;
    while (p && p !== document.body) {
      const ps = getComputedStyle(p);
      if (temBorda(ps) && arred(ps)) {
        const pr = p.getBoundingClientRect();
        const folga = Math.min(r.left - pr.left, pr.right - r.right);
        if (folga < 34) achados.push(
          `${p.tagName}.${String(p.className).split(' ').slice(0,2).join('.')}` +
          ` [${Math.round(pr.width)}px]  →  ${e.tagName}.${String(e.className).split(' ').slice(0,2).join('.')}` +
          ` [${Math.round(r.width)}px]  folga ${Math.round(folga)}px`);
        break;
      }
      p = p.parentElement;
    }
  }
  return [...new Set(achados)].slice(0, 14).join('\n') || 'nenhuma moldura colada nesta tela';
}));
await nav.close(); srv.close();
