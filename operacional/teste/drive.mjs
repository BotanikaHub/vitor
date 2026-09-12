/* Os arquivos de cada marca.

   O que precisa valer: sem chave e sem pasta, a tela ensina o caminho em
   vez de ficar em branco; ligada, ela lista a pasta da marca, anda para
   dentro das subpastas e procura; trocar de marca troca a pasta; dá para
   anexar um arquivo na tarefa e na campanha sem subir cópia nenhuma; o
   anexo leva ao arquivo de verdade; e nenhum id de pasta de outra marca
   passa pela porta. */
import { chromium } from '/home/user/vitor/node_modules/playwright-core/index.mjs';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const srv = createServer((_, r) => { r.writeHead(200,{'content-type':'text/html; charset=utf-8'}); r.end(html) }).listen(0);
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const porta = srv.address().port;

let ok = 0, ruim = 0;
const conf = (o, v) => { if (v) { ok++; console.log('  ✓', o) } else { ruim++; console.log('  ✗', o) } };

const hoje = new Intl.DateTimeFormat('en-CA', { timeZone:'America/Sao_Paulo', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());
const base = { description:'', subtasks:[], checklist:[], attachments:[], comments:[], history:[], recurrence:'none', priority:'normal' };
const tarefas = [
  { ...base, id:'t1', title:'Subir criativos do Dia D', status:'a fazer', assignees:['Pedro Lage'], due:hoje, brand:'Botanika', project:'Dia D' },
];
const campanhas = [
  { id:'c1', name:'Dia D', brand:'Botanika', type:'Dia D', status:'Em execução', owner:'Vitor Gutierrez',
    start:hoje, end:hoje, goal:0, budget:0, progress:0, color:'#121415',
    objective:'', offer:'', benefits:[], channels:[], products:[], schedule:[], tap:[] },
];

/* A pasta de cada marca, como o Drive a devolveria */
const ARVORE = {
  '1BotanikaRaizAaBbCcDdEeFfGgHh': [
    { id:'1CriativosSubAaBbCcDdEeFfGgHh', nome:'Criativos', tipo:'application/vnd.google-apps.folder', pasta:true, link:'https://drive.google.com/drive/folders/1CriativosSubAaBbCcDdEeFfGgHh', em:'2026-09-01T10:00:00Z', tamanho:null },
    { id:'1BriefingAaBbCcDdEeFfGgHhIiJj', nome:'Briefing do Dia D.pdf', tipo:'application/pdf', pasta:false, link:'https://drive.google.com/file/d/1BriefingAaBbCcDdEeFfGgHhIiJj/view', em:'2026-09-05T10:00:00Z', tamanho:240000 },
  ],
  '1CriativosSubAaBbCcDdEeFfGgHh': [
    { id:'f-banner', nome:'banner-dia-d.png', tipo:'image/png', pasta:false, link:'https://drive.google.com/file/d/f-banner/view', em:'2026-09-06T10:00:00Z', tamanho:512000 },
  ],
  '1VermeFreeRaizAaBbCcDdEeFfGgHh': [
    { id:'f-verme', nome:'catálogo VermeFree.xlsx', tipo:'application/vnd.ms-excel', pasta:false, link:'https://drive.google.com/file/d/f-verme/view', em:'2026-09-02T10:00:00Z', tamanho:80000 },
  ],
};
const PASTAS = { Botanika:'1BotanikaRaizAaBbCcDdEeFfGgHh', VermeFree:'1VermeFreeRaizAaBbCcDdEeFfGgHh' };
const NOMES = { '1CriativosSubAaBbCcDdEeFfGgHh':'Criativos' };

const estado = { ligado:{ Botanika:true, VermeFree:true }, semChave:false };
const pedidos = [];

const pag = await nav.newPage({ viewport:{ width:1440, height:1100 } });
pag.on('pageerror', (e) => console.log('  [erro na página]', e.message));
await pag.addInitScript(([ts, cs]) => {
  window.__gravou = [];
  window.supabase = { createClient: () => ({
    auth:{ getSession: async () => ({ data:{ session:{ access_token:'jwt', user:{ id:'u1', email:'p@b.com' } } } }), signOut: async () => ({}) },
    rpc: async () => ({ data:null, error:null }),
    from: (tab) => ({
      select: () => ({ or: async () => ({ data:[
          { chave:'central.tasks.vitor-gutierrez', dono:null, valor: ts },
          { chave:'central.campaigns.vitor-gutierrez', dono:null, valor: cs }], error:null }),
        eq: () => ({ maybeSingle: async () => ({ data:{ id:'u1', nome:'Pedro Lage', email:'p@b.com', papel:'admin', ativo:true, cargo:'', area_id:null } }) }),
        order: async () => ({ data:[], error:null }) }),
      update: (campos) => ({ eq: async (col, val) => { window.__gravou.push({ tab, campos, col, val }); return { error:null } } }),
      upsert: async () => ({ error:null }),
    }),
  }) };
}, [tarefas, campanhas]);

await pag.route('**/api/painel**', (r) => r.fulfill({ status:200, contentType:'application/json',
  body: JSON.stringify({ marca:'Botanika', tela:'x', dados:{}, em:new Date().toISOString() }) }));

await pag.route('**/api/drive**', (r) => {
  const u = new URL(r.request().url());
  const marca = u.searchParams.get('marca') || 'Botanika';
  const busca = (u.searchParams.get('q') || '').trim();
  pedidos.push({ marca, pasta: u.searchParams.get('pasta'), busca });
  const json = (c) => r.fulfill({ status:200, contentType:'application/json', body: JSON.stringify(c) });
  if (estado.semChave) return json({ ligado:false, semChave:true, erro:'A Central ainda não tem a chave da conta de serviço do Google.' });
  if (!estado.ligado[marca]) return json({ ligado:false, marca, erro:`A ${marca} ainda não tem pasta do Drive ligada.` });
  const raiz = PASTAS[marca];
  const pedida = u.searchParams.get('pasta') || raiz;
  /* a porta: pasta que não é desta marca não passa */
  const daMarca = pedida === raiz || (raiz === '1BotanikaRaizAaBbCcDdEeFfGgHh' && pedida === '1CriativosSubAaBbCcDdEeFfGgHh');
  if (!daMarca) return r.fulfill({ status:403, contentType:'application/json', body: JSON.stringify({ erro:'essa pasta não é desta marca' }) });
  let arquivos = ARVORE[pedida] || [];
  if (busca) arquivos = Object.values(ARVORE).flat().filter((a) => a.nome.toLowerCase().includes(busca.toLowerCase()));
  const trilha = pedida === raiz ? [] : [{ id: pedida, nome: NOMES[pedida] || pedida }];
  return json({ ligado:true, marca, raiz, pasta:pedida, trilha, arquivos, proxima:null, busca: busca || null });
});

await pag.goto(`http://127.0.0.1:${porta}/#painel`, { waitUntil:'networkidle' });
await pag.waitForTimeout(1400);
const irAosArquivos = async () => {
  await pag.locator('#painelView [data-tela="arquivos"]').click();
  await pag.waitForTimeout(700);
};

/* ---------- 1. sem chave ---------- */
console.log('\nsem a chave do Google');
estado.semChave = true;
await irAosArquivos();
let txt = await pag.locator('#painelCorpo .dv-ligar').innerText();
conf('a aba Arquivos existe no painel', await pag.locator('#painelView [data-tela="arquivos"]').count() === 1);
conf('sem chave, a tela ensina o caminho inteiro', /Google Cloud/.test(txt) && /conta de serviço/i.test(txt));
conf('e diz o nome exato da variável', txt.includes('GOOGLE_DRIVE_SA'));
conf('e avisa para não colar a chave no chat', /não aqui no chat/i.test(txt));
estado.semChave = false;

/* ---------- 2. marca sem pasta ---------- */
console.log('\nmarca sem pasta ligada');
estado.ligado.Botanika = false;
await pag.evaluate(() => window.Painel.carregar(true));
await pag.waitForTimeout(700);
txt = await pag.locator('#painelCorpo .dv-ligar').innerText();
conf('a tela pede o id da pasta', /id do endereço|folders\//i.test(txt));
await pag.locator('[data-dv-pasta]').fill('https://drive.google.com/drive/folders/1BotanikaRaizAaBbCcDdEeFfGgHh');
await pag.locator('.dv-ligar button[type="submit"]').click();
await pag.waitForTimeout(400);
const gravou = await pag.evaluate(() => window.__gravou);
conf('colar o endereço inteiro grava só o id', gravou.some((g) => g.campos.drive_pasta === '1BotanikaRaizAaBbCcDdEeFfGgHh'));
conf('e grava na marca certa', gravou.some((g) => g.val === 'Botanika' && g.tab === 'painel_marcas'));
estado.ligado.Botanika = true;

/* id que não é id */
await pag.evaluate(() => window.Painel.estado.dvPasta = null);
const recusa = await pag.evaluate(async () => {
  try { await window.Drive.ligarPasta('Botanika', 'não é um id'); return null } catch (e) { return e.message }
});
conf('e o que não é id é recusado antes de gravar', /não parece um id/i.test(recusa || ''));

/* ---------- 3. listar ---------- */
console.log('\na pasta da marca');
await pag.evaluate(() => window.Painel.carregar(true));
await pag.waitForTimeout(700);
conf('os itens da pasta aparecem', await pag.locator('#painelCorpo .dv-item').count() === 2);
conf('a subpasta vem primeiro e marcada como pasta',
     await pag.locator('#painelCorpo .dv-item').first().evaluate((e) => e.classList.contains('dv-pasta')));
conf('o arquivo mostra o tipo e o tamanho',
     (await pag.locator('#painelCorpo .dv-item').nth(1).innerText()).includes('PDF'));
conf('e leva ao arquivo no Drive, não a uma cópia',
     (await pag.locator('#painelCorpo a.dv-item').first().getAttribute('href')).includes('drive.google.com'));
conf('abre em outra aba, para não perder a Central',
     await pag.locator('#painelCorpo a.dv-item').first().getAttribute('target') === '_blank');

/* entrar na subpasta */
await pag.locator('#painelCorpo [data-dv-abre="1CriativosSubAaBbCcDdEeFfGgHh"]').first().click();
await pag.waitForTimeout(700);
conf('entrar na subpasta mostra o que tem dentro',
     (await pag.locator('#painelCorpo').innerText()).includes('banner-dia-d'));
conf('e a trilha mostra o caminho de volta',
     (await pag.locator('#painelCorpo .dv-trilha').innerText()).includes('Criativos'));
await pag.locator('#painelCorpo .dv-passo').first().click();
await pag.waitForTimeout(700);
conf('voltar pela trilha volta para a raiz da marca',
     (await pag.locator('#painelCorpo').innerText()).includes('Briefing do Dia D'));

/* procurar */
await pag.locator('#painelCorpo .dv-busca input').fill('banner');
await pag.locator('#painelCorpo .dv-busca button[type="submit"]').click();
await pag.waitForTimeout(700);
conf('a busca acha o que está dentro de subpasta, e não só o nível aberto',
     (await pag.locator('#painelCorpo').innerText()).includes('banner-dia-d'));
conf('e o pedido de busca foi para o servidor', pedidos.some((p) => p.busca === 'banner'));
await pag.locator('[data-dv-limpa]').click();
await pag.waitForTimeout(700);

/* ---------- 4. trocar de marca ---------- */
console.log('\ntrocar de marca');
await pag.selectOption('#brandSelect', 'VermeFree');
await pag.waitForTimeout(1200);
await pag.evaluate(() => window.Painel.carregar(true));
await pag.waitForTimeout(800);
conf('trocar de marca troca a pasta que se enxerga',
     (await pag.locator('#painelCorpo').innerText()).includes('VermeFree.xlsx'));
conf('e o que era da Botanika sai da tela',
     !(await pag.locator('#painelCorpo').innerText()).includes('Briefing do Dia D'));
conf('o pedido levou a marca certa', pedidos[pedidos.length - 1].marca === 'VermeFree');

/* a porta: pasta da outra marca não passa */
const barrada = await pag.evaluate(async () => {
  try { await window.Drive.listar({ marca:'VermeFree', pasta:'1CriativosSubAaBbCcDdEeFfGgHh' }, true); return null }
  catch (e) { return e.message }
});
conf('pedir a pasta da outra marca é barrado', /não é desta marca/i.test(barrada || ''));
await pag.selectOption('#brandSelect', 'Botanika');
await pag.waitForTimeout(900);

/* ---------- 5. anexar na tarefa ---------- */
console.log('\nanexar na tarefa');
await pag.evaluate(() => { window.Painel.esconder(); window.__centralShowTasks() });
await pag.waitForTimeout(900);
await pag.locator('[data-task-id="t1"]').first().click();
await pag.waitForTimeout(900);
conf('a ficha da tarefa ganha o botão de anexar do Drive',
     await pag.locator('[data-dv-anexar]').count() === 1);
await pag.locator('[data-dv-anexar]').click();
await pag.locator('.dv-modal').waitFor({ state:'visible', timeout:5000 });
await pag.waitForTimeout(600);
conf('o escolhedor abre com a pasta da marca', await pag.locator('.dv-modal .dv-item').count() >= 1);
conf('e ali o arquivo é para escolher, não para abrir',
     await pag.locator('.dv-modal [data-dv-escolhe]').count() >= 1);
await pag.locator('.dv-modal [data-dv-escolhe="1BriefingAaBbCcDdEeFfGgHhIiJj"]').click();
await pag.waitForTimeout(600);
conf('escolher fecha o escolhedor', await pag.locator('.dv-modal').count() === 0);
const anexos = await pag.evaluate(() => window.__centralGetTasks().find((t) => t.id === 't1').attachments);
conf('o anexo entra na tarefa', anexos.length === 1);
conf('guardando o link do arquivo, e não uma cópia', anexos[0].link.includes('drive.google.com'));
conf('e de onde ele veio', anexos[0].drive && anexos[0].drive.id === '1BriefingAaBbCcDdEeFfGgHhIiJj');
conf('a tarefa gravada no navegador tem o anexo', await pag.evaluate(() =>
  JSON.parse(localStorage.getItem('central.tasks.vitor-gutierrez')).find((t) => t.id === 't1').attachments.length) === 1);
conf('e a lista mostra o anexo como link que abre',
     await pag.locator('#attachmentList .dv-anexo a[href*="drive.google.com"]').count() === 1);

/* não duplica */
await pag.locator('[data-dv-anexar]').click();
await pag.waitForTimeout(600);
await pag.locator('.dv-modal [data-dv-escolhe="1BriefingAaBbCcDdEeFfGgHhIiJj"]').click();
await pag.waitForTimeout(500);
conf('anexar o mesmo arquivo de novo não duplica', await pag.evaluate(() =>
  window.__centralGetTasks().find((t) => t.id === 't1').attachments.length) === 1);

/* tirar */
await pag.locator('#attachmentList [data-dv-tira-anexo]').click();
await pag.waitForTimeout(500);
conf('e dá para tirar o anexo', await pag.evaluate(() =>
  window.__centralGetTasks().find((t) => t.id === 't1').attachments.length) === 0);

/* ---------- 6. anexar na campanha ---------- */
console.log('\nanexar na campanha');
/* fechar a ficha da tarefa antes: aberta, ela cobre a lista de campanhas */
await pag.locator('#taskDetailClose').click();
await pag.waitForTimeout(400);
await pag.evaluate(() => { window.Painel.esconder(); window.__centralShowCampaigns() });
await pag.waitForTimeout(900);
await pag.locator('[data-campaign-id], .camp-row').first().click();
await pag.waitForTimeout(1200);
conf('a campanha ganha o cartão de arquivos', await pag.locator('.dv-card').count() === 1);
conf('que começa dizendo que o arquivo continua morando no Drive',
     (await pag.locator('.dv-card').innerText()).includes('morando no Drive'));
await pag.locator('[data-dv-anexar-camp]').click();
await pag.locator('.dv-modal').waitFor({ state:'visible', timeout:5000 });
await pag.waitForTimeout(600);
await pag.locator('.dv-modal [data-dv-escolhe="1BriefingAaBbCcDdEeFfGgHhIiJj"]').click();
await pag.waitForTimeout(700);
const daCamp = await pag.evaluate(() =>
  JSON.parse(localStorage.getItem('central.campaigns.vitor-gutierrez'))[0].arquivos);
conf('o arquivo entra na campanha', daCamp && daCamp.length === 1);
conf('com nome e link', daCamp[0].nome.includes('Briefing') && daCamp[0].link.includes('drive.google.com'));
conf('e o cartão mostra o arquivo', (await pag.locator('.dv-card').innerText()).includes('Briefing'));

await nav.close();
srv.close();
console.log(`\ndrive: ${ok} checagens passaram${ruim ? `, ${ruim} FALHARAM` : ''}`);
process.exit(ruim ? 1 : 0);
