/* O painel travava a página porque o botão de fechar ficava fora da tela.
   Com ele de volta, ainda é preciso saber se as saídas de sempre funcionam:
   Esc, clique no fundo e o próprio botão.

   A tarefa vem pelo banco de mentira, e não dos padrões de fábrica do app:
   depois que o que era inventado saiu de lá, o app abre vazio — que é o
   certo, e obriga cada teste a dizer com que dado trabalha. */
import { chromium } from '/home/user/vitor/node_modules/playwright-core/index.mjs';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const srv = createServer((_, r) => { r.writeHead(200,{'content-type':'text/html; charset=utf-8'}); r.end(html) }).listen(0);
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const pag = await nav.newPage({ viewport: { width: 1440, height: 900 } });
const tarefas = [{ id:'t1', title:'DIA D — Programar disparos de e-mail e WhatsApp', status:'a fazer',
  description:'', assignees:['Sarah'], due:'2026-09-09', start:null, brand:'Botanika', project:'Dia D',
  priority:'urgent', recurrence:'none', subtasks:[], checklist:[], attachments:[], comments:[], history:[] }];
await pag.addInitScript((ts) => { window.supabase = { createClient: () => ({
  auth:{getSession:async()=>({data:{session:{user:{id:'u1',email:'v@b.com'}}}}),signOut:async()=>({})},
  from:()=>({select:()=>({or:async()=>({data:[{chave:'central.tasks.vitor-gutierrez',dono:null,valor:ts}],error:null}),
    eq:()=>({maybeSingle:async()=>({data:null})})}),upsert:async()=>({error:null})}) }) } }, tarefas);
await pag.route('**/supabase.js', (r) => r.fulfill({ status:200, body:'', contentType:'application/javascript' }));
await pag.goto(`http://127.0.0.1:${srv.address().port}/`, { waitUntil:'networkidle' });
await pag.waitForTimeout(1200);
await pag.locator('#tasksNav').click(); await pag.waitForTimeout(500);

const aberto = () => pag.evaluate(() => !!document.querySelector('.tdrawer.open'));
const abrir = async () => {
  await pag.locator('.cu-row[data-task-id="t1"]').click();
  await pag.waitForTimeout(500);
  if (!(await aberto())) throw new Error('o painel não abriu');
};

await abrir();
await pag.keyboard.press('Escape'); await pag.waitForTimeout(400);
console.log('Esc fecha:            ', !(await aberto()));

if (await aberto()) await pag.keyboard.press('Escape');
if (!(await aberto())) await abrir();
await pag.mouse.click(40, 450); await pag.waitForTimeout(400);
console.log('clique no fundo fecha:', !(await aberto()));

if (!(await aberto())) await abrir();
await pag.locator('.tdrawer.open .tdrawer-close').click(); await pag.waitForTimeout(400);
console.log('botão × fecha:        ', !(await aberto()));

/* e o painel tem que estar dentro da tela */
await abrir();
const cx = await pag.evaluate(() => {
  const r = document.querySelector('.tdrawer-panel').getBoundingClientRect();
  return { x: Math.round(r.x), dir: Math.round(r.right), larg: innerWidth };
});
console.log('painel dentro da tela:', cx.x >= 0 && cx.dir <= cx.larg, JSON.stringify(cx));
await nav.close(); srv.close();
