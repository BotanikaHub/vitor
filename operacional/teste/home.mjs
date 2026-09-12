/* A home que cada um monta.

   O que precisa valer: os blocos que já existiam continuam sendo os do
   app (movidos, não recriados — quem os preenche precisa achá-los onde
   sempre esteve), o arranjo é de quem está logado, arrastar troca a
   ordem, a largura muda, tirar tira, e o catálogo devolve. */
import { chromium } from '/home/user/vitor/node_modules/playwright-core/index.mjs';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const srv = createServer((_, r) => { r.writeHead(200,{'content-type':'text/html; charset=utf-8'}); r.end(html) }).listen(0);
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const pag = await nav.newPage({ viewport: { width: 1440, height: 1000 } });
pag.on('pageerror', (e) => console.log('  [erro na página]', e.message));

const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const dia = (n) => { const d = new Date(`${hoje}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) };
const base = { description:'', subtasks:[], checklist:[], attachments:[], comments:[], history:[], recurrence:'none', priority:'normal' };
const tarefas = [
  { ...base, id:'t1', title:'Subir criativos do Dia D', status:'a fazer', assignees:['Vitor Gutierrez'], due:dia(-1), brand:'Botanika', project:'Dia D' },
  { ...base, id:'t2', title:'Programar disparo', status:'a fazer', assignees:['Sarah'], due:hoje, brand:'Botanika', project:'Dia D' },
  { ...base, id:'t3', title:'Arte da Semana do Cliente', status:'a fazer', assignees:['Ítalo Neves'], due:dia(2), brand:'Botanika', project:'Semana do Cliente' },
];
const campanhas = [
  { id:'c1', name:'Semana do Cliente', brand:'Botanika', type:'Sazonal', status:'Planejamento', owner:'', start:dia(3), end:dia(9),
    goal:0, budget:0, progress:0, color:'#121415', objective:'', offer:'', benefits:[], channels:[], products:[], schedule:[], tap:[] },
];

await pag.addInitScript(([ts, cs]) => {
  window.supabase = { createClient: () => ({
    auth:{getSession:async()=>({data:{session:{user:{id:'u1',email:'v@b.com'}}}}),signOut:async()=>({})},
    from:()=>({select:()=>({or:async()=>({data:[
        {chave:'central.tasks.vitor-gutierrez',dono:null,valor:ts},
        {chave:'central.campaigns.vitor-gutierrez',dono:null,valor:cs}],error:null}),
      eq:()=>({is:()=>({maybeSingle:async()=>({data:null})}),eq:()=>({maybeSingle:async()=>({data:null})}),
        maybeSingle:async()=>({data:{id:'u1',nome:'Vitor Gutierrez',email:'v@b.com',papel:'admin',ativo:true,cargo:'',area_id:null}})})}),
      upsert:async()=>({error:null})}) }) };
}, [tarefas, campanhas]);
await pag.route('**/supabase.js', (r) => r.fulfill({ status:200, body:'', contentType:'application/javascript' }));
await pag.goto(`http://127.0.0.1:${srv.address().port}/`, { waitUntil:'networkidle' });
await pag.waitForTimeout(1400);

const ok = [];
const conf = (n, v) => { assert.ok(v, n); ok.push(n) };
const arranjo = () => pag.evaluate(() => window.HomeModular.arranjo().map((b) => `${b.id}:${b.larg}`));
const guardado = () => pag.evaluate(() =>
  JSON.parse(localStorage.getItem('central.home.layout.vitor-gutierrez') || 'null'));

/* ---------- a grade ---------- */
conf('a home vira uma grade de blocos', await pag.locator('#homeGrade .hm-grade').count() === 1);
conf('a home nasce com o arranjo de fábrica, igual para todo mundo',
  (await arranjo()).join(',') === 'semana:12,perto:4,vencidas:4,conclusao:4,atencao:8,campanhas:4');
conf('os blocos do app foram movidos para dentro da grade, não recriados',
  await pag.locator('#homeGrade [data-hm-corpo="atencao"] #homeAtencao').count() === 1 &&
  await pag.locator('#homeGrade [data-hm-corpo="perto"] [data-stat="perto"]').count() === 1);
/* o número exato depende do fuso de quem roda o teste; o que importa é que
   quem preenche continua achando o lugar de preencher */
conf('e quem os preenche continua achando o que preenche',
  /^[1-9]/.test((await pag.locator('[data-stat="vencidas"] .value').innerText()).trim()) &&
  (await pag.locator('#homeAtencao').innerText()).includes('Subir criativos'));

/* ---------- organizar ---------- */
conf('fora do modo organizar, nada de alça nem de x',
  await pag.locator('.hm-ferramentas').count() === 0);
await pag.locator('[data-hm-organizar]').click(); await pag.waitForTimeout(300);
conf('organizar mostra alça, largura e o x em cada bloco',
  await pag.locator('.hm-ferramentas').count() === 6 &&
  await pag.locator('[data-hm-bloco="atencao"] [data-hm-larg]').count() === 5);
conf('e o bloco passa a poder ser arrastado',
  await pag.locator('[data-hm-bloco="semana"]').getAttribute('draggable') === 'true');

/* ---------- arrastar troca a ordem ---------- */
const antes = await arranjo();
await pag.evaluate(() => {
  const de = document.querySelector('[data-hm-bloco="campanhas"]');
  const para = document.querySelector('[data-hm-bloco="semana"]');
  const dt = new DataTransfer();
  de.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true }));
  para.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
  para.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
});
await pag.waitForTimeout(400);
const depois = await arranjo();
conf('arrastar um bloco para cima de outro põe ele naquele lugar',
  depois[0].startsWith('campanhas') && !antes[0].startsWith('campanhas'));
conf('e o arranjo fica gravado na chave da pessoa',
  (await guardado())?.blocos?.[0]?.id === 'campanhas');

/* ---------- largura ---------- */
await pag.locator('[data-hm-larg="campanhas|12"]').click(); await pag.waitForTimeout(350);
conf('mudar a largura muda o bloco na grade',
  (await arranjo())[0] === 'campanhas:12' &&
  (await pag.locator('[data-hm-bloco="campanhas"]').getAttribute('style')).includes('span 12'));

/* ---------- tirar e devolver ---------- */
await pag.locator('[data-hm-tirar="conclusao"]').click(); await pag.waitForTimeout(350);
conf('tirar um bloco tira da grade', !(await arranjo()).some((b) => b.startsWith('conclusao')));
conf('mas o nó do app fica guardado, não é jogado fora',
  await pag.locator('#homeGuardados [data-stat="conclusao"]').count() === 1);

await pag.locator('[data-hm-add]').click(); await pag.waitForTimeout(300);
conf('o catálogo abre com os blocos que estão de fora',
  await pag.locator('.hm-modal [data-hm-por]').count() >= 6);
conf('e cada oferta traz uma prévia do formato, não do conteúdo',
  await pag.locator('.hm-oferta-previa').count() >= 6);
await pag.locator('[data-hm-por="conclusao"]').click(); await pag.waitForTimeout(400);
conf('devolver traz o bloco de volta inteiro',
  (await arranjo()).some((b) => b.startsWith('conclusao')) &&
  await pag.locator('#homeGrade [data-hm-corpo="conclusao"] [data-stat="conclusao"]').count() === 1);

/* ---------- os blocos novos ---------- */
await pag.locator('[data-hm-add]').click(); await pag.waitForTimeout(300);
await pag.locator('[data-hm-por="minhas"]').click(); await pag.waitForTimeout(500);
const meu = pag.locator('[data-hm-bloco="minhas"]');
conf('o bloco "as minhas de hoje" entra e mostra só o que é meu',
  (await meu.innerText()).includes('Subir criativos') && !(await meu.innerText()).includes('Programar disparo'));

await pag.locator('[data-hm-add]').click(); await pag.waitForTimeout(300);
await pag.locator('[data-hm-por="estreia"]').click(); await pag.waitForTimeout(500);
conf('e o bloco "o que estreia" mostra a campanha que vem, com as abertas',
  /Semana do Cliente/.test(await pag.locator('[data-hm-bloco="estreia"]').innerText()) &&
  /1 de 1 abertas/.test(await pag.locator('[data-hm-bloco="estreia"]').innerText()));

/* ---------- voltar ao padrão ---------- */
await pag.locator('[data-hm-padrao]').click(); await pag.waitForTimeout(400);
conf('voltar ao padrão devolve o arranjo de fábrica',
  (await arranjo()).join(',') === 'semana:12,perto:4,vencidas:4,conclusao:4,atencao:8,campanhas:4');
await pag.locator('[data-hm-organizar]').click(); await pag.waitForTimeout(300);
conf('e sair do modo organizar limpa as ferramentas',
  await pag.locator('.hm-ferramentas').count() === 0);
/* ---------- a lateral ----------
   Já esteve guardada atrás de um sanduíche; atrapalhou e voltou. Fica
   aqui a checagem de que ela está à vista, para não voltar por acidente. */
conf('a lateral fica à vista, sem sanduíche no meio',
  await pag.locator('.sidebar #painelNav').isVisible() &&
  await pag.locator('#menuBotao').count() === 0);

await pag.screenshot({ path: 'teste/30-home-modular.png', fullPage: true });

console.log(ok.map((s) => '  ✓ ' + s).join('\n'));
console.log(`\nhome: ${ok.length} checagens passaram`);
await nav.close(); srv.close();
