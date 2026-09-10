/* A descrição vinha do ClickUp em Markdown e o app mostrava o arquivo cru:
   "> ⚠️ **TAREFA RECORRENTE**", "## Por que esta tarefa existe",
   "| Quando | O que aconteceu |". Aqui uso a descrição de verdade de uma
   tarefa de verdade — a que o Vitor mandou na foto — e confiro que ela é
   lida como texto, e não como código. */
import { chromium } from '/home/user/vitor/node_modules/playwright-core/index.mjs';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');

/* A lateral agora fica guardada atrás do sanduíche: navegar é abrir e
   escolher, que é o que uma pessoa faz. */
const irPara = async (p, id) => {
  const bt = p.locator('#menuBotao');
  if (await bt.isVisible().catch(() => false)) {
    const jaAberto = await p.evaluate(() => document.body.classList.contains('mn-aberto'));
    if (!jaAberto) { await bt.click(); await p.waitForTimeout(260) }
  }
  await p.locator(`#${id}`).click();
  await p.waitForTimeout(140);
};
const srv = createServer((_, r) => { r.writeHead(200,{'content-type':'text/html; charset=utf-8'}); r.end(html) }).listen(0);
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const pag = await nav.newPage({ viewport: { width: 1440, height: 1000 } });
pag.on('pageerror', (e) => console.log('  [erro na página]', e.message));

/* a descrição real da tarefa 86akbh65m, do ClickUp */
const descricao = [
  '> ⚠️ **TAREFA RECORRENTE — repetir todo dia útil.**  ',
  '> A recorrência precisa ser ligada na mão: abrir a tarefa, clicar na data de vencimento e escolher "repetir diariamente".',
  '',
  '**Conferir tudo que vai ao ar antes de publicar.**',
  '',
  '## Por que esta tarefa existe',
  '',
  'Foi pedida em **21/08**, depois de um link do Whey sem sabor levar para a página inicial em vez da página do produto.',
  '',
  '**Desde então aconteceram mais quatro erros do mesmo tipo:**',
  '',
  '| Quando | O que aconteceu |',
  '| ---| --- |',
  '| 17/08 | Comunicações de grupo anunciaram frete grátis que não existia |',
  '| 21/08 | Botão do Whey sem sabor levava para a home |',
  '| 25/08 | Ação de recompra publicada no story geral em vez do melhores amigos |',
  '',
  '## O que conferir todo dia',
  '',
  '**No site**',
  '- [ ] Preço com desconto aplicado, se houver campanha no ar',
  '- [x] Frete configurado conforme a ação',
  '- [ ] Testar como cliente em aba anônima, no celular',
  '',
  '**Nos disparos**',
  '- [ ] Links levam para a página certa, não para a home',
  '',
  '---',
  '',
  'Detalhe do processo em [botanika.com.br](https://botanika.com.br) e no campo `utm_source`.',
  '',
  '1. Primeiro conferir',
  '2. Depois publicar',
].join('\n');

const tarefas = [{
  id:'86akbh65m', title:'CONFERIR TUDO QUE VAI AO AR · todo dia até 09h | BOTANIKA + VERMEFREE',
  description: descricao, status:'a fazer', assignees:['Gestão Alliance'], due:'2026-09-04',
  start:'2026-09-03', brand:'Botanika', project:'Sem projeto', priority:'urgent', recurrence:'none',
  subtasks:[], checklist:[], attachments:[], comments:[], history:[],
  clickupUrl:'https://app.clickup.com/t/86akbh65m',
}, {
  id:'t2', title:'Tarefa sem briefing nenhum', description:'', status:'a fazer', assignees:[],
  due:'2026-09-10', start:null, brand:'Botanika', project:'Sem projeto', priority:'normal',
  recurrence:'none', subtasks:[], checklist:[], attachments:[], comments:[], history:[],
}];

await pag.addInitScript((ts) => {
  window.supabase = { createClient: () => ({
    auth:{getSession:async()=>({data:{session:{user:{id:'u1',email:'v@b.com'}}}}),signOut:async()=>({})},
    from:()=>({select:()=>({or:async()=>({data:[{chave:'central.tasks.vitor-gutierrez',dono:null,valor:ts}],error:null}),
      eq:()=>({maybeSingle:async()=>({data:null})})}),upsert:async()=>({error:null})}) }) };
}, tarefas);
await pag.route('**/supabase.js', (r) => r.fulfill({ status:200, body:'', contentType:'application/javascript' }));
await pag.goto(`http://127.0.0.1:${srv.address().port}/`, { waitUntil:'networkidle' });
await pag.waitForTimeout(1400);

const ok = [];
const conf = (n, v) => { assert.ok(v, n); ok.push(n) };

await irPara(pag, 'tasksNav'); await pag.waitForTimeout(500);
await pag.locator('.cu-row[data-task-id="86akbh65m"]').click(); await pag.waitForTimeout(600);

const lida = pag.locator('#descricaoLida');
const texto = (await lida.innerText()).replace(/\s+/g, ' ');

/* ---------- nada de código à vista ---------- */
conf('a caixa de texto crua sai da frente',
  await pag.locator('#detailDescription').isHidden());
conf('o asterisco duplo do negrito não aparece mais', !texto.includes('**'));
conf('nem o "##" do título', !texto.includes('##'));
conf('nem o "> " da citação', !/(^|\s)> /.test(texto));
conf('nem os canos da tabela', !texto.includes('|'));
conf('nem o "- [ ]" da caixa de marcar', !texto.includes('- [ ]') && !texto.includes('- [x]'));

/* ---------- e o conteúdo continua inteiro ---------- */
conf('o aviso da recorrência virou citação',
  await lida.locator('blockquote').count() === 1 &&
  (await lida.locator('blockquote').innerText()).includes('TAREFA RECORRENTE'));
conf('o negrito virou negrito',
  (await lida.locator('strong').allInnerTexts()).some((t) => t.includes('21/08')));
conf('os títulos viraram títulos',
  (await lida.locator('h2').allInnerTexts()).join(' | ') === 'Por que esta tarefa existe | O que conferir todo dia');

const tab = lida.locator('.ds-tabela table');
conf('a tabela virou tabela', await tab.count() === 1);
conf('com o cabeçalho certo',
  (await tab.locator('thead th').allInnerTexts()).join(' · ') === 'Quando · O que aconteceu');
conf('e as três linhas', await tab.locator('tbody tr').count() === 3);
conf('com o conteúdo no lugar certo',
  (await tab.locator('tbody tr').first().locator('td').allInnerTexts())[0] === '17/08');

const caixas = lida.locator('.ds-caixas li');
conf('as caixas de marcar viraram caixas', await caixas.count() === 4);
conf('a que estava marcada aparece marcada',
  await lida.locator('.ds-caixas li.feito').count() === 1 &&
  (await lida.locator('.ds-caixas li.feito').innerText()).includes('Frete configurado'));
conf('e as caixas não são clicáveis — quem confere é a Conferência',
  await lida.locator('.ds-caixas input').count() === 0);

conf('a lista numerada virou lista numerada',
  await lida.locator('ol li').count() === 2);
conf('o link virou link, abrindo fora',
  await lida.locator('a[href="https://botanika.com.br"][target="_blank"]').count() === 1);
conf('o trecho de código virou código',
  (await lida.locator('code').innerText()) === 'utm_source');
conf('a régua virou régua', await lida.locator('hr').count() === 1);

await pag.screenshot({ path: 'teste/21-descricao.png' });

/* ---------- e a mesma descrição, em uma linha, na lista ---------- */
await pag.locator('#taskDetailClose').click(); await pag.waitForTimeout(400);
const sub = await pag.locator('.cu-row[data-task-id="86akbh65m"] .cu-titletext small').innerText();
conf('na lista, a linha de baixo também sai limpa',
  !sub.includes('**') && !sub.includes('>') && !sub.includes('##'));
conf('e ainda diz do que a tarefa trata', sub.includes('TAREFA RECORRENTE'));
await pag.locator('.cu-row[data-task-id="86akbh65m"]').click(); await pag.waitForTimeout(600);

/* ---------- editar continua possível, e salvar continua salvando ---------- */
await pag.locator('.ds-editar').click(); await pag.waitForTimeout(300);
conf('o botão "editar" traz a caixa de texto de volta',
  await pag.locator('#detailDescription').isVisible() && await lida.isHidden());
conf('e com o Markdown original, não com o desenho',
  (await pag.locator('#detailDescription').inputValue()).includes('## Por que esta tarefa existe'));

await pag.locator('#detailDescription').fill('## Novo briefing\n\nEscrito **aqui**.');
await pag.locator('.ds-editar').click(); await pag.waitForTimeout(400);
conf('sair da edição redesenha com o que foi escrito',
  (await lida.locator('h2').innerText()) === 'Novo briefing' &&
  (await lida.locator('strong').innerText()) === 'aqui');

await pag.locator('#taskSaveBtn').click(); await pag.waitForTimeout(700);
const salva = await pag.evaluate(() => JSON.parse(localStorage.getItem('central.tasks.vitor-gutierrez'))
  .find((t) => t.id === '86akbh65m').description);
conf('e o app salva o Markdown, e não o HTML',
  salva === '## Novo briefing\n\nEscrito **aqui**.');

/* ---------- sem descrição, diz que não tem ---------- */
await irPara(pag, 'tasksNav'); await pag.waitForTimeout(400);
await pag.locator('.cu-row[data-task-id="t2"]').click(); await pag.waitForTimeout(600);
conf('tarefa sem briefing avisa em vez de mostrar caixa vazia',
  (await pag.locator('#descricaoLida').innerText()).includes('ainda não foi escrito'));

/* ---------- o desenho não deixa passar HTML de fora ---------- */
const perigo = await pag.evaluate(() =>
  window.Descricao.desenhar('<img src=x onerror=alert(1)> e <script>alert(2)<\/script>'));
conf('HTML que vier na descrição é escapado, não executado',
  !/<img|<script/i.test(perigo) && perigo.includes('&lt;img'));

/* um caso real: uma descrição do ClickUp usa <PRODUTO> como lacuna no
   nome da campanha, e isso tem que aparecer como texto */
const lacuna = await pag.evaluate(() =>
  window.Descricao.desenhar('PERPETUO (LP) | <PRODUTO> | ABERTO ADV'));
conf('a lacuna <PRODUTO> continua legível, e não some como marcação',
  lacuna.includes('&lt;PRODUTO&gt;'));

console.log(ok.map(s => '  ✓ ' + s).join('\n'));
console.log(`\ndescrição: ${ok.length} checagens passaram`);
await nav.close(); srv.close();
