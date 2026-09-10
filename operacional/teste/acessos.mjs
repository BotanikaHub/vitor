/* Acessos: quem entra na Central e com que permissão. Esta tela fala com
   as tabelas de verdade — profiles, equipe_convites, areas, brands,
   profile_brands — então aqui o cliente do Supabase é fingido no formato
   exato do supabase-js, e eu confiro o que a tela grava em cada uma.
   Confiro também o que muda nas outras telas: a pessoa passa a ser a do
   cadastro, e a tarefa acha o dono pelo nome que ele tem no ClickUp. */
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
const contexto = await nav.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] });
const pag = await contexto.newPage();
pag.on('pageerror', (e) => console.log('  [erro na página]', e.message));

const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const base = { description:'', subtasks:[], checklist:[], attachments:[], comments:[], history:[], recurrence:'none', priority:'normal' };
const tarefas = [
  { ...base, id:'t1', title:'Programar o disparo da terça', status:'a fazer', assignees:['Sarah | Gestora de Automações'], due:hoje, brand:'Botanika', project:'Dia D' },
  { ...base, id:'t2', title:'Subir criativos', status:'a fazer', assignees:['Pedro Lage'], due:hoje, brand:'Botanika', project:'Dia D' },
  { ...base, id:'t3', title:'Coisa de quem não foi cadastrado', status:'a fazer', assignees:['Joingle Pires'], due:hoje, brand:'Botanika', project:'Avulsas' },
];

/* ---------- o banco, como o supabase-js o entrega ---------- */
const AREAS = [
  { id:'a-traf', nome:'Tráfego', slug:'trafego', ordem:4 },
  { id:'a-auto', nome:'Automações', slug:'automacoes', ordem:3 },
  { id:'a-gest', nome:'Gestão', slug:'gestao', ordem:7 },
];
const MARCAS = [
  { id:'m-bot', nome:'Botanika', slug:'botanika', ativo:true },
  { id:'m-ver', nome:'VermeFree', slug:'vermefree', ativo:true },
];
const dados = {
  areas: AREAS,
  brands: MARCAS,
  profiles: [
    { id:'u-vitor', nome:'Vitor Gutierrez', email:'comercialvittorgutierrez@gmail.com', papel:'admin', ativo:true, cargo:'Gestor da operação', area_id:'a-gest', criado_em:'2026-09-03' },
    { id:'u-pedro', nome:'Pedro Lage', email:'pedrogustavolage@gmail.com', papel:'membro', ativo:false, cargo:null, area_id:null, criado_em:'2026-09-09' },
  ],
  equipe_convites: [
    { email:'pedrogustavolage@gmail.com', nome:'Pedro Lage', nome_clickup:'Pedro Lage', cargo:'Gestor de IA e tráfego', papel:'gestor', area_id:'a-traf', marcas:['m-bot','m-ver'], observacao:null, criado_em:'2026-09-09' },
    { email:'sarah.juliabrito@gmail.com', nome:'Sarah Brito', nome_clickup:'Sarah | Gestora de Automações', cargo:'Gestora de automações', papel:'gestor', area_id:'a-auto', marcas:['m-bot','m-ver'], observacao:null, criado_em:'2026-09-09' },
    { email:'lissiabrasil@gmail.com', nome:'Lissia Brasil', nome_clickup:null, cargo:'Atendimento', papel:'membro', area_id:null, marcas:['m-bot'], observacao:null, criado_em:'2026-09-09' },
  ],
  profile_brands: [ { profile_id:'u-vitor', brand_id:'m-bot' }, { profile_id:'u-vitor', brand_id:'m-ver' } ],
  operacional_estado: [{ chave:`central.tasks.vitor-gutierrez`, dono:null, valor:tarefas }],
};

await pag.addInitScript(({ dados, souAdmin }) => {
  const escritas = [];
  window.__escritas = escritas;
  const copia = JSON.parse(JSON.stringify(dados));
  if (!souAdmin) { const v = copia.profiles.find((p) => p.email.startsWith('comercial')); v.papel = 'membro' }

  const resposta = (data) => ({ data, error: null });
  function tabela(nome) {
    const linhas = () => copia[nome] || [];
    const api = {};
    const lendo = { filtros: [] };
    api.select = () => {
      const r = {
        order: () => Promise.resolve(resposta(linhas())),
        eq: (col, val) => { lendo.filtros.push([col, val]); return r },
        maybeSingle: () => Promise.resolve(resposta(linhas().find((l) => lendo.filtros.every(([c, v]) => l[c] === v)) || null)),
        or: () => Promise.resolve(resposta(linhas())),
        then: (ok, falha) => Promise.resolve(resposta(linhas())).then(ok, falha),
      };
      return r;
    };
    api.update = (valores) => ({
      eq: (col, val) => {
        escritas.push({ tabela: nome, op: 'update', valores, onde: { [col]: val } });
        for (const l of linhas()) if (l[col] === val) Object.assign(l, valores);
        return Promise.resolve({ error: null });
      },
    });
    api.insert = (valores) => {
      escritas.push({ tabela: nome, op: 'insert', valores });
      for (const v of [].concat(valores)) linhas().push({ ...v });
      return Promise.resolve({ error: null });
    };
    api.upsert = () => Promise.resolve({ error: null });
    api.delete = () => {
      const onde = {};
      const r = {
        eq: (col, val) => { onde[col] = val; r.__apaga = () => { copia[nome] = linhas().filter((l) => l[col] !== val) }; return r },
        in: (col, vals) => {
          escritas.push({ tabela: nome, op: 'delete', onde, dentro: { [col]: vals } });
          copia[nome] = linhas().filter((l) => !(Object.entries(onde).every(([c, v]) => l[c] === v) && vals.includes(l[col])));
          return Promise.resolve({ error: null });
        },
        then: (ok, falha) => {
          escritas.push({ tabela: nome, op: 'delete', onde });
          r.__apaga?.();
          return Promise.resolve({ error: null }).then(ok, falha);
        },
      };
      return r;
    };
    return api;
  }
  window.supabase = { createClient: () => ({
    auth: { getSession: async () => ({ data: { session: { access_token:'jwt', user: { id:'u-vitor', email:'comercialvittorgutierrez@gmail.com' } } } }), signOut: async () => ({}) },
    from: tabela,
  }) };
}, { dados, souAdmin: true });

await pag.route('**/supabase.js', (r) => r.fulfill({ status:200, body:'', contentType:'application/javascript' }));
await pag.route('**/api/painel**', (r) => r.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ marca:'Botanika', tela:'x', dados:{ visao:{}, serie:[], mes:{}, kpis:{}, metas:{}, realizados:{}, semanas:[] }, em:new Date().toISOString() }) }));
await pag.goto(`http://127.0.0.1:${srv.address().port}/`, { waitUntil:'networkidle' });
await pag.waitForTimeout(1300);

const ok = [];
const conf = (n, v) => { assert.ok(v, n); ok.push(n) };
const texto = async (sel) => (await pag.locator(sel).innerText()).replace(/\s+/g, ' ');
const espera = async (sel, t = 5000) => pag.locator(sel).first().waitFor({ state: 'visible', timeout: t });
const escritas = () => pag.evaluate(() => window.__escritas);

await irPara(pag, 'painelNav'); await espera('#painelView [data-tela="acessos"]');
await pag.locator('#painelView [data-tela="acessos"]').click(); await espera('#painelCorpo .ac-tabela');

/* ---------- quem entra e quem espera ---------- */
const corpo = await texto('#painelCorpo');
conf('a Central sabe quem está logado', await pag.evaluate(() => window.CentralEu?.email) === 'comercialvittorgutierrez@gmail.com');
conf('quem já tem conta aparece na primeira lista', corpo.includes('Vitor Gutierrez') && /você/i.test(corpo));
conf('e quem tem conta mas está bloqueado aparece marcado',
  await pag.locator('#painelCorpo tr.ac-bloqueada').count() === 1 &&
  (await pag.locator('#painelCorpo tr.ac-bloqueada').innerText()).includes('Pedro Lage'));
conf('quem foi cadastrado e ainda não criou conta fica na lista de espera',
  corpo.includes('Sarah Brito') && corpo.includes('Lissia Brasil') && corpo.includes('falta criar a conta'));
conf('a tela ensina o caminho de criar a conta', corpo.includes('Authentication') && corpo.includes('Auto Confirm'));
conf('e o papel de cada um está escrito em português', corpo.includes('O que cada papel pode') && corpo.includes('parceiro de fora'));
conf('nome do ClickUp que não é de ninguém fica separado',
  corpo.includes('Nomes do ClickUp sem pessoa') && corpo.includes('Joingle Pires') && !corpo.includes('Sarah | Gestora de Automações Pedro'));
await pag.screenshot({ path: 'teste/32-acessos.png', fullPage: true });

/* ---------- mudar quem já entrou grava em profiles ---------- */
const linhaPedro = pag.locator('#painelCorpo tr', { hasText: 'pedrogustavolage' }).first();
await linhaPedro.locator('[data-ac-campo="papel"]').selectOption('gestor'); await pag.waitForTimeout(500);
let w = await escritas();
const upPerfil = w.find((x) => x.tabela === 'profiles' && x.op === 'update' && x.valores.papel === 'gestor');
conf('mudar o papel de quem tem conta grava em profiles', !!upPerfil && upPerfil.onde.id === 'u-pedro');
const upConvite = w.find((x) => x.tabela === 'equipe_convites' && x.valores?.papel === 'gestor');
conf('e o convite guarda a mesma coisa, para a conta poder ser refeita', !!upConvite);

await espera('#painelCorpo .ac-tabela');
const linhaPedro2 = pag.locator('#painelCorpo tr', { hasText: 'pedrogustavolage' }).first();
await linhaPedro2.locator('[data-ac-campo="ativo"]').click(); await pag.waitForTimeout(600);
w = await escritas();
conf('liberar o acesso grava ativo em profiles',
  w.some((x) => x.tabela === 'profiles' && x.valores.ativo === true && x.onde.id === 'u-pedro'));
conf('e a linha deixa de aparecer bloqueada', await pag.locator('#painelCorpo tr.ac-bloqueada').count() === 0);

/* ---------- marcas ---------- */
const linhaVitor = pag.locator('#painelCorpo tr', { hasText: 'comercialvittorgutierrez' }).first();
await linhaVitor.locator('[data-ac-campo^="marca:"]').last().click(); await pag.waitForTimeout(600);
w = await escritas();
conf('tirar uma marca de quem tem conta apaga o vínculo em profile_brands',
  w.some((x) => x.tabela === 'profile_brands' && x.op === 'delete' && x.onde.profile_id === 'u-vitor'));
await pag.locator('#painelCorpo tr', { hasText: 'comercialvittorgutierrez' }).first().locator('[data-ac-campo^="marca:"]').last().click();
await pag.waitForTimeout(600);
w = await escritas();
conf('e devolver a marca insere o vínculo de volta',
  w.some((x) => x.tabela === 'profile_brands' && x.op === 'insert'));

/* ---------- quem só está na lista grava só no convite ---------- */
const linhaLissia = pag.locator('#painelCorpo tr', { hasText: 'lissiabrasil' }).first();
await linhaLissia.locator('[data-ac-campo="cargo"]').fill('Atendimento Botanika');
await linhaLissia.locator('[data-ac-campo="cargo"]').dispatchEvent('change'); await pag.waitForTimeout(600);
w = await escritas();
const cargoLissia = w.filter((x) => x.valores?.cargo === 'Atendimento Botanika');
conf('mexer em quem não tem conta grava só no convite, nunca em profiles',
  cargoLissia.length >= 1 && cargoLissia.every((x) => x.tabela === 'equipe_convites'));
conf('e quem tem conta sem convite ganha um, para o cadastro não se perder',
  w.some((x) => x.tabela === 'equipe_convites' && x.op === 'insert' && x.valores.email === 'comercialvittorgutierrez@gmail.com'));

/* ---------- casar com o ClickUp ---------- */
await espera('#painelCorpo .ac-tabela');
const linhaLissia2 = pag.locator('#painelCorpo tr', { hasText: 'lissiabrasil' }).first();
conf('o nome do ClickUp é escolhido numa lista de quem assina tarefa',
  (await linhaLissia2.locator('[data-ac-campo="nomeClickup"]').innerText()).includes('Joingle Pires'));

/* ---------- cadastrar mais alguém ---------- */
const form = pag.locator('#painelCorpo [data-ac-nova]');
await form.locator('[name=email]').fill('novapessoa@botanika.com.br');
await form.locator('[name=nome]').fill('Nova Pessoa');
await form.locator('[name=cargo]').fill('Design');
await form.locator('[name=papel]').selectOption('membro');
await form.locator('button[type=submit]').click(); await pag.waitForTimeout(700);
w = await escritas();
const nova = w.find((x) => x.tabela === 'equipe_convites' && x.op === 'insert' && x.valores.email === 'novapessoa@botanika.com.br');
conf('cadastrar alguém entra na lista de convites, com marcas',
  !!nova && nova.valores.email === 'novapessoa@botanika.com.br' && nova.valores.marcas.length === 2);
conf('e ela aparece esperando a conta', (await texto('#painelCorpo')).includes('Nova Pessoa'));

/* ---------- as outras telas passam a usar este cadastro ---------- */
await pag.locator('#painelView [data-tela="pessoas"]').click(); await espera('#painelCorpo .eq-cadastro');
const pes = await texto('#painelCorpo');
conf('Pessoas passa a mostrar o cadastro do banco', pes.includes('vem do cadastro de acessos'));
conf('com quem entra, quem falta a conta e quem só existe no ClickUp',
  pes.includes('entra') && pes.includes('falta a conta') && pes.includes('sem cadastro') && pes.includes('Joingle Pires'));
conf('e o cargo e a área vêm de lá', pes.includes('Gestor de IA e tráfego') && pes.includes('Tráfego'));

await pag.locator('#painelCorpo [data-eq-abre-acessos]').click(); await espera('#painelCorpo .ac-tabela');
conf('o botão do cadastro leva para Acessos',
  await pag.locator('#painelView [data-tela="acessos"]').evaluate((e) => e.classList.contains('active')));

await pag.locator('#painelView [data-tela="daily"]').click(); await espera('#painelCorpo .eq-pessoa');
const sarah = pag.locator('#painelCorpo .eq-pessoa', { hasText: 'Sarah Brito' });
conf('a daily chama a pessoa pelo nome do cadastro', await sarah.count() === 1);
conf('e acha a tarefa dela pelo nome que ela tem no ClickUp',
  (await sarah.innerText()).includes('Programar o disparo da terça'));
conf('quem não foi cadastrado continua aparecendo, com o nome do ClickUp',
  await pag.locator('#painelCorpo .eq-pessoa', { hasText: 'Joingle Pires' }).count() === 1);
await pag.screenshot({ path: 'teste/33-daily-cadastro.png', fullPage: true });

/* ---------- sem ser admin, a tela é de leitura ---------- */
const pag2 = await contexto.newPage();
pag2.on('pageerror', (e) => console.log('  [erro na página 2]', e.message));
await pag2.addInitScript(({ dados }) => {
  const copia = JSON.parse(JSON.stringify(dados));
  copia.profiles.find((p) => p.id === 'u-vitor').papel = 'membro';
  const resposta = (data) => ({ data, error: null });
  window.supabase = { createClient: () => ({
    auth: { getSession: async () => ({ data: { session: { access_token:'jwt', user: { id:'u-vitor', email:'comercialvittorgutierrez@gmail.com' } } } }), signOut: async () => ({}) },
    from: (nome) => ({
      select: () => { const f = []; const r = {
        order: () => Promise.resolve(resposta(copia[nome] || [])),
        eq: (c, v) => { f.push([c, v]); return r },
        maybeSingle: () => Promise.resolve(resposta((copia[nome] || []).find((l) => f.every(([c, v]) => l[c] === v)) || null)),
        or: () => Promise.resolve(resposta(copia[nome] || [])),
        then: (ok, x) => Promise.resolve(resposta(copia[nome] || [])).then(ok, x) }; return r },
      update: () => ({ eq: () => Promise.resolve({ error: { message: 'sem permissão' } }) }),
      insert: () => Promise.resolve({ error: { message: 'sem permissão' } }),
      upsert: () => Promise.resolve({ error: null }),
      delete: () => ({ eq: () => Promise.resolve({ error: { message: 'sem permissão' } }) }),
    }),
  }) };
}, { dados });
await pag2.route('**/supabase.js', (r) => r.fulfill({ status:200, body:'', contentType:'application/javascript' }));
await pag2.route('**/api/painel**', (r) => r.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ marca:'Botanika', tela:'x', dados:{}, em:new Date().toISOString() }) }));
await pag2.goto(`http://127.0.0.1:${srv.address().port}/#painel`, { waitUntil:'networkidle' });
await pag2.waitForTimeout(1300);
await pag2.locator('#painelView [data-tela="acessos"]').click();
await pag2.locator('#painelCorpo .ac-tabela').first().waitFor({ state:'visible', timeout: 5000 });
const corpo2 = (await pag2.locator('#painelCorpo').innerText()).replace(/\s+/g, ' ');
conf('quem não é admin vê a lista, e a tela diz que não pode mexer', corpo2.includes('Só um admin muda acesso'));
conf('os campos vêm travados', await pag2.locator('#painelCorpo .ac-tabela select:not([disabled])').count() === 0);
conf('e não existe formulário de cadastrar', await pag2.locator('#painelCorpo [data-ac-nova]').count() === 0);

console.log(ok.map(s => '  ✓ ' + s).join('\n'));
console.log(`\nacessos: ${ok.length} checagens passaram`);
await nav.close(); srv.close();
