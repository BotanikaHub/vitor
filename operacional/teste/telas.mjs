/* Mede os mesmos lugares em várias larguras: o que parece certo em 1440
   costuma quebrar em 1280 ou 1728, e as fotos do Vitor vêm de uma tela
   maior que a minha. */
import { chromium } from '/home/user/vitor/node_modules/playwright-core/index.mjs';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const srv = createServer((_, r) => { r.writeHead(200,{'content-type':'text/html; charset=utf-8'}); r.end(html) }).listen(0);
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const tarefaDoTeste = [{ id:'t1', title:'DIA D — Programar disparos de e-mail e WhatsApp', status:'a fazer',
  description:'', assignees:['Sarah'], due:'2026-09-09', start:null, brand:'Botanika', project:'Dia D',
  priority:'urgent', recurrence:'none', subtasks:[], checklist:[], attachments:[], comments:[], history:[] }];

const stub = (ts) => { window.supabase = { createClient: () => ({
  auth:{getSession:async()=>({data:{session:{user:{id:'u1',email:'v@b.com'}}}}),signOut:async()=>({})},
  from:()=>({select:()=>({or:async()=>({data:[{chave:'central.tasks.vitor-gutierrez',dono:null,valor:ts},{chave:'central.campaigns.vitor-gutierrez',dono:null,valor:[]}],error:null}),eq:()=>({maybeSingle:async()=>({data:null})})}),upsert:async()=>({error:null})}) }) } };

for (const [w, h] of [[1280,800],[1440,900],[1728,1080],[1920,1080]]) {
  const pag = await nav.newPage({ viewport: { width: w, height: h } });
  await pag.addInitScript(stub, tarefaDoTeste);
  await pag.route('**/supabase.js', (r) => r.fulfill({ status:200, body:'', contentType:'application/javascript' }));
  await pag.goto(`http://127.0.0.1:${srv.address().port}/`, { waitUntil:'networkidle' });

  /* painel da tarefa */
  await pag.waitForTimeout(1200); await pag.locator('#tasksNav').click(); await pag.waitForTimeout(600);
  await pag.locator('.cu-row[data-task-id="t1"]').first().click();
  await pag.waitForTimeout(600);
  const painel = await pag.evaluate(() => {
    const p = document.querySelector('.tdrawer-panel'), pr = p.getBoundingClientRect();
    const cortados = [...p.querySelectorAll('input,select,textarea,button')].filter(e => {
      const r = e.getBoundingClientRect();
      return r.width > 30 && (r.right > pr.right - 2 || r.left < pr.left + 2);
    }).length;
    const lado = document.querySelector('.tdetail-side');
    const lr = lado?.getBoundingClientRect();
    return { painel: `${Math.round(pr.left)}→${Math.round(pr.right)}`,
             coluna: lr ? `${Math.round(lr.width)}px` : '—', cortados };
  });
  await pag.keyboard.press('Escape'); await pag.waitForTimeout(300);

  /* entregas */
  await pag.evaluate(() => {
    const b = [...document.querySelectorAll('button,a,[role="button"]')]
      .find(x => /entrega/i.test(x.textContent + ' ' + (x.title||'')) && x.offsetParent);
    b?.click();
  });
  await pag.waitForTimeout(600);
  const ent = await pag.evaluate(() => {
    const ws = document.querySelector('.delivery-workspace');
    if (!ws) return 'área de entregas não encontrada';
    const cols = [...ws.children].map(e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e);
      return `${e.tagName}.${String(e.className).split(' ')[0]} h=${Math.round(r.height)} fundo=${s.backgroundColor} borda=${s.borderTopWidth}` });
    const vazios = [...ws.querySelectorAll('.delivery-empty')].map(e => {
      const r = e.getBoundingClientRect();
      return `${Math.round(r.height)}px${e.getAttribute('style') ? ' (style inline: ' + e.getAttribute('style') + ')' : ''}` });
    const s = getComputedStyle(ws), r = ws.getBoundingClientRect();
    return `workspace h=${Math.round(r.height)} css-h=${s.height} minH=${s.minHeight} disp=${s.display} rows=${s.gridTemplateRows} flex=${s.flex}\n         ` +
           cols.join(' | ') + '  vazios: ' + (vazios.join(', ') || 'nenhum');
  });

  console.log(`${w}x${h}  painel ${painel.painel}  coluna ${painel.coluna}  cortados ${painel.cortados}`);
  console.log(`         entregas: ${ent}`);
  await pag.close();
}
await nav.close(); srv.close();
