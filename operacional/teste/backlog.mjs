/* O backlog: as tarefas que já se sabe de cor.

   O que precisa valer: os modelos de fábrica aparecem; a aba do Backlog
   existe no painel; editar o modelo grava; aplicar numa campanha cria as
   tarefas com a data contada a partir das datas dela, com quem é da área
   e com o checklist; aplicar de novo não duplica; e a campanha nova
   oferece as tarefas do modelo do formato dela em vez de nascer vazia. */
import { chromium } from '/home/user/vitor/node_modules/playwright-core/index.mjs';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const srv = createServer((_, r) => { r.writeHead(200,{'content-type':'text/html; charset=utf-8'}); r.end(html) }).listen(0);
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const porta = srv.address().port;

let ok = 0, ruim = 0;
const conf = (o, v) => { if (v) { ok++; console.log('  ✓', o) } else { ruim++; console.log('  ✗', o) } };

const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());
const dia = (n) => { const d = new Date(`${hoje}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0,10) };

const base = { description:'', subtasks:[], checklist:[], attachments:[], comments:[], history:[], recurrence:'none', priority:'normal' };
const tarefas = [
  { ...base, id:'t1', title:'Coisa antiga', status:'a fazer', assignees:['Pedro Lage'], due:hoje, brand:'Botanika', project:'Avulsas' },
];
const campanhas = [
  { id:'c1', name:'Dia D de Outubro', brand:'Botanika', type:'Dia D', status:'Planejamento', owner:'Vitor Gutierrez',
    start:dia(20), end:dia(20), goal:80000, budget:16000, progress:0, color:'#121415',
    objective:'', offer:'', benefits:[], channels:[], products:[], schedule:[], tap:[] },
];

const AREAS = [
  { id:'a-traf', nome:'Tráfego', slug:'trafego', ordem:1 },
  { id:'a-auto', nome:'Automações', slug:'automacoes', ordem:2 },
  { id:'a-soc',  nome:'Social media', slug:'social-media', ordem:3 },
  { id:'a-gest', nome:'Gestão', slug:'gestao', ordem:4 },
];
const MARCAS = [{ id:'m-bot', nome:'Botanika', slug:'botanika', ativo:true }];
const PERFIS = [
  { id:'u1', nome:'Vitor Gutierrez', email:'v@b.com', papel:'admin',  ativo:true, cargo:'Gestor', area_id:'a-gest', criado_em:'2026-09-03' },
  { id:'u2', nome:'Pedro Lage',      email:'p@b.com', papel:'gestor', ativo:true, cargo:'Tráfego', area_id:'a-traf', criado_em:'2026-09-03' },
  { id:'u3', nome:'Sarah Brito',     email:'s@b.com', papel:'gestor', ativo:true, cargo:'Automações', area_id:'a-auto', criado_em:'2026-09-03' },
  { id:'u4', nome:'Ítalo Neves',     email:'i@b.com', papel:'membro', ativo:true, cargo:'Social', area_id:'a-soc', criado_em:'2026-09-03' },
];

const pag = await nav.newPage({ viewport: { width: 1440, height: 1100 } });
pag.on('pageerror', (e) => console.log('  [erro na página]', e.message));
await pag.addInitScript(([ts, cs, areas, marcas, perfis]) => {
  const tabela = (nome) => ({
    areas, brands: marcas, profiles: perfis, equipe_convites: [], profile_brands: perfis.map((p) => ({ profile_id: p.id, brand_id: 'm-bot' })),
  })[nome] || [];
  window.supabase = { createClient: () => ({
    auth: { getSession: async () => ({ data: { session: { user: { id:'u1', email:'v@b.com' } } } }), signOut: async () => ({}) },
    rpc: async () => ({ data: null, error: null }),
    from: (nome) => {
      const dados = tabela(nome);
      const resp = { data: dados, error: null };
      const eqChain = {
        maybeSingle: async () => ({ data: perfis[0] }),
        is: () => ({ maybeSingle: async () => ({ data: perfis[0] }) }),
        eq: () => eqChain, then: (f) => Promise.resolve(resp).then(f),
      };
      return {
        select: () => ({
          or: async () => ({ data: [
            { chave:'central.tasks.vitor-gutierrez', dono:null, valor: ts },
            { chave:'central.campaigns.vitor-gutierrez', dono:null, valor: cs }], error:null }),
          eq: () => eqChain,
          order: async () => resp,
          then: (f) => Promise.resolve(resp).then(f),
        }),
        upsert: async () => ({ error: null }),
      };
    },
  }) };
}, [tarefas, campanhas, AREAS, MARCAS, PERFIS]);
await pag.route('**/api/painel**', (r) => r.fulfill({ status:200, contentType:'application/json',
  body: JSON.stringify({ marca:'Botanika', tela:'x', dados:{}, em:new Date().toISOString() }) }));

await pag.goto(`http://127.0.0.1:${porta}/#painel`, { waitUntil:'networkidle' });
await pag.waitForTimeout(1500);

/* ---------- 1. os modelos de fábrica ---------- */
console.log('\nos modelos de fábrica');
const ms = await pag.evaluate(() => window.Backlog.modelos().map((m) => ({ nome:m.nome, formato:m.formato, n:m.itens.length })));
conf('existe um modelo por formato de campanha', ms.length >= 5);
conf('o Dia D é um deles', ms.some((m) => m.formato === 'Dia D'));
conf('e vem com a lista de tarefas cheia, não vazia', (ms.find((m) => m.formato === 'Dia D') || {}).n >= 15);
conf('todo item sabe de que área é', await pag.evaluate(() =>
  window.Backlog.modelos().every((m) => m.itens.every((i) => i.area && i.titulo))));
conf('e cada um sabe se conta do início ou do fim da campanha', await pag.evaluate(() =>
  window.Backlog.modelos().every((m) => m.itens.every((i) => i.ref === 'inicio' || i.ref === 'fim'))));
conf('tem tarefa de depois que a campanha acaba — desligar o cupom', await pag.evaluate(() =>
  window.Backlog.doFormato('Dia D').itens.some((i) => i.ref === 'fim' && /desligar/i.test(i.titulo))));
conf('o rótulo do dia é o que a equipe fala: D−2, D, D+1', await pag.evaluate(() => {
  const r = window.Backlog.rotuloDia;
  return r({ ref:'inicio', dias:-2 }) === 'D−2' && r({ ref:'inicio', dias:0 }) === 'D' && r({ ref:'fim', dias:1 }) === 'F+1';
}));

/* ---------- 2. a prévia calcula data e responsável ---------- */
console.log('\na prévia');
const previa = await pag.evaluate(async () => {
  await window.Backlog.comCadastro();
  const c = JSON.parse(localStorage.getItem('central.campaigns.vitor-gutierrez'))[0];
  return window.Backlog.previa(window.Backlog.doFormato('Dia D'), c);
});
conf('a prévia sai em ordem de data', previa.every((l, i) => !i || l.due >= previa[i-1].due));
const dDia = campanhas[0].start;
const banner = previa.find((l) => /banner/i.test(l.titulo));
conf('o banner do site é D−2 da campanha', banner && banner.due === dia(18));
const desliga = previa.find((l) => /desligar cupons/i.test(l.titulo));
conf('desligar o cupom é o dia seguinte ao fim', desliga && desliga.due === dia(21));
conf('a tarefa de tráfego cai com quem é da área de tráfego',
     (previa.find((l) => l.area === 'Tráfego') || {}).quem?.[0] === 'Pedro Lage');
conf('a de e-mail cai com quem é de automações',
     (previa.find((l) => l.area === 'E-mail') || {}).quem?.[0] === 'Sarah Brito');
conf('e a de Instagram com quem é de social', 
     (previa.find((l) => l.area === 'Instagram') || {}).quem?.[0] === 'Ítalo Neves');
conf('ninguém recebe duas assinaturas na mesma tarefa', previa.every((l) => l.quem.length <= 1));

/* ---------- 3. aplicar cria as tarefas de verdade ---------- */
console.log('\naplicar numa campanha');
const r1 = await pag.evaluate(async () => {
  await window.Backlog.comCadastro();
  const c = JSON.parse(localStorage.getItem('central.campaigns.vitor-gutierrez'))[0];
  return window.Backlog.aplicar(window.Backlog.doFormato('Dia D'), c);
});
conf('as tarefas são criadas', r1.criadas >= 15);
const criadas = await pag.evaluate(() =>
  JSON.parse(localStorage.getItem('central.tasks.vitor-gutierrez')).filter((t) => t.project === 'Dia D de Outubro'));
conf('todas nascem ligadas à campanha', criadas.length === r1.criadas);
conf('com a marca da campanha', criadas.every((t) => t.brand === 'Botanika'));
conf('com prazo', criadas.every((t) => /^\d{4}-\d{2}-\d{2}$/.test(t.due)));
conf('como "a fazer", não como feitas', criadas.every((t) => t.status === 'a fazer'));
conf('a maioria já nasce com checklist', criadas.filter((t) => (t.checklist||[]).length).length >= criadas.length - 2);
conf('o checklist nasce desmarcado', criadas.every((t) => (t.checklist||[]).every((c) => c.done === false)));
conf('a tarefa diz de onde veio', criadas.every((t) => /modelo/i.test(t.description)));
conf('e guarda a área de entrega, para o roteiro de conferência achar sozinho',
     criadas.every((t) => t.canal));
conf('a tarefa antiga continua lá', await pag.evaluate(() =>
  JSON.parse(localStorage.getItem('central.tasks.vitor-gutierrez')).some((t) => t.id === 't1')));

/* o canal casa com a área que a conferência reconhece */
const casa = await pag.evaluate(() => {
  const ts = JSON.parse(localStorage.getItem('central.tasks.vitor-gutierrez')).filter((t) => t.project === 'Dia D de Outubro');
  return ts.every((t) => window.Conferencia.areaDe(t) === t.canal);
});
conf('e a conferência classifica cada uma na área que o modelo disse', casa);

/* ---------- 4. aplicar duas vezes não duplica ---------- */
console.log('\naplicar de novo');
const r2 = await pag.evaluate(() => {
  const c = JSON.parse(localStorage.getItem('central.campaigns.vitor-gutierrez'))[0];
  return window.Backlog.aplicar(window.Backlog.doFormato('Dia D'), c);
});
conf('nada é criado de novo', r2.criadas === 0);
conf('e a tela diz quantas já existiam', r2.puladas === r1.criadas);
conf('o número de tarefas da campanha não mexeu', await pag.evaluate(() =>
  JSON.parse(localStorage.getItem('central.tasks.vitor-gutierrez')).filter((t) => t.project === 'Dia D de Outubro').length) === r1.criadas);

/* ---------- 5. a tela ---------- */
console.log('\na tela do backlog');
await pag.locator('#painelView [data-tela="backlog"]').click();
await pag.locator('#painelCorpo .bk-tabela').first().waitFor({ state:'visible', timeout:5000 });
conf('a aba do Backlog existe no painel', await pag.locator('#painelView [data-tela="backlog"]').count() === 1);
conf('os modelos aparecem como abas', await pag.locator('#painelCorpo [data-bk-modelo]').count() >= 5);
conf('a tabela mostra as tarefas do modelo', await pag.locator('#painelCorpo .bk-tabela tbody tr').count() >= 15);
conf('e a coluna Quem já mostra a pessoa de cada área',
     (await pag.locator('#painelCorpo .bk-quem').first().innerText()).trim().length > 2);

/* trocar de modelo */
await pag.locator('#painelCorpo [data-bk-modelo]').nth(1).click();
await pag.waitForTimeout(300);
conf('trocar de modelo troca a lista',
     (await pag.locator('#painelCorpo .bk-nome').innerText()).includes('Semana'));

/* editar grava */
await pag.locator('#painelCorpo [data-bk-modelo]').first().click();
await pag.waitForTimeout(300);
const primeiro = pag.locator('#painelCorpo .bk-tabela tbody tr').first();
await primeiro.locator('[data-bk-campo="titulo"]').click();
await pag.keyboard.press('End');
await pag.keyboard.type(' — corrigido');
await pag.locator('#painelCorpo .bk-nome').click();
await pag.waitForTimeout(300);
conf('editar o título do item grava no modelo', await pag.evaluate(() =>
  window.Backlog.modelos().some((m) => m.itens.some((i) => / — corrigido$/.test(i.titulo)))));

/* abrir o checklist */
await primeiro.locator('[data-bk-abre]').click();
await pag.waitForTimeout(300);
conf('dá para abrir e editar o checklist do item', await pag.locator('#painelCorpo .bk-check').count() === 1);

/* + tarefa */
const antes = await pag.evaluate(() => window.Backlog.doFormato('Dia D').itens.length);
await pag.locator('#painelCorpo [data-bk-mais]').click();
await pag.waitForTimeout(350);
conf('dá para acrescentar tarefa no modelo', await pag.evaluate(() => window.Backlog.doFormato('Dia D').itens.length) === antes + 1);

/* tirar */
await pag.locator('#painelCorpo .bk-tabela tbody tr [data-bk-tira]').last().click();
await pag.waitForTimeout(350);
conf('e tirar', await pag.evaluate(() => window.Backlog.doFormato('Dia D').itens.length) === antes);

/* ---------- 6. a campanha nova oferece as tarefas ---------- */
console.log('\nquando a campanha nasce');
await pag.evaluate(() => {
  const c = { id:'c9', name:'Dia D de Novembro', brand:'Botanika', type:'Dia D',
              start:'2026-11-10', end:'2026-11-10' };
  window.Backlog.oferecer(c);
});
await pag.locator('.bk-oferta').waitFor({ state:'visible', timeout:3000 });
const oferta = await pag.locator('.bk-oferta-cx').innerText();
conf('a campanha nova não nasce muda: a Central mostra o que o modelo tem', /tarefas/i.test(oferta));
conf('com a lista inteira à vista antes de aceitar', await pag.locator('.bk-oferta-cx li').count() >= 15);
conf('e com a data já calculada para as datas desta campanha', oferta.includes('08/11'));
await pag.locator('[data-bk-oferta-nao]').click();
await pag.waitForTimeout(200);
conf('"agora não" fecha sem criar nada', await pag.locator('.bk-oferta').count() === 0);
conf('e nenhuma tarefa da campanha nova foi criada', await pag.evaluate(() =>
  JSON.parse(localStorage.getItem('central.tasks.vitor-gutierrez')).filter((t) => t.project === 'Dia D de Novembro').length) === 0);

await pag.evaluate(() => window.Backlog.oferecer({ id:'c9', name:'Dia D de Novembro', brand:'Botanika', type:'Dia D', start:'2026-11-10', end:'2026-11-10' }));
await pag.locator('[data-bk-oferta-sim]').click();
await pag.waitForTimeout(400);
conf('aceitar cria as tarefas da campanha nova', await pag.evaluate(() =>
  JSON.parse(localStorage.getItem('central.tasks.vitor-gutierrez')).filter((t) => t.project === 'Dia D de Novembro').length) >= 15);

/* ---------- 7. formato sem modelo não oferece nada ---------- */
await pag.evaluate(() => window.Backlog.oferecer({ id:'c8', name:'Coisa avulsa', brand:'Botanika', type:'Livre', start:'2026-11-10', end:'2026-11-12' }));
await pag.waitForTimeout(200);
conf('formato que não tem modelo não abre caixa nenhuma', await pag.locator('.bk-oferta').count() === 0);

await nav.close();
srv.close();
console.log(`\nbacklog: ${ok} checagens passaram${ruim ? `, ${ruim} FALHARAM` : ''}`);
process.exit(ruim ? 1 : 0);
