/* A página de cada área.

   O que precisa valer: quem é membro vê a própria área e não troca; quem
   manda troca; a tarefa da área é a de quem é dela mais a do tipo dela;
   campanha e projeto mostram o quanto falta; e a micrometa diz o que
   precisa sair hoje, dividindo o que falta pelos dias que sobraram. */
import { chromium } from '/home/user/vitor/node_modules/playwright-core/index.mjs';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');

/* Navegar é clicar no destino na lateral, que está sempre à vista. */
const irPara = async (p, id) => {
  await p.locator(`#${id}`).click();
  await p.waitForTimeout(140);
};
const srv = createServer((_, r) => { r.writeHead(200,{'content-type':'text/html; charset=utf-8'}); r.end(html) }).listen(0);
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const dia = (n) => { const d = new Date(`${hoje}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) };
const ANO = +hoje.slice(0, 4), MES = +hoje.slice(5, 7), DIA = +hoje.slice(8, 10);

const AREAS = [
  { id: 'a-traf', nome: 'Tráfego', slug: 'trafego' },
  { id: 'a-soc', nome: 'Social Media', slug: 'social-media' },
  { id: 'a-cre', nome: 'Creators', slug: 'creators' },
  { id: 'a-gest', nome: 'Gestão', slug: 'gestao' },
];
const PERFIS = [
  { id: 'u-pedro', nome: 'Pedro Lage', email: 'pedro@b.com', papel: 'gestor', ativo: true, cargo: 'Tráfego', area_id: 'a-traf', criado_em: null },
  { id: 'u-italo', nome: 'Ítalo Neves', email: 'italo@b.com', papel: 'membro', ativo: true, cargo: 'Social', area_id: 'a-soc', criado_em: null },
];
const base = { description:'', subtasks:[], checklist:[], attachments:[], comments:[], history:[], recurrence:'none', priority:'normal' };
const tarefas = [
  { ...base, id:'t1', title:'Subir criativos no gerenciador', status:'feito', assignees:['Pedro Lage'], due:dia(-3), brand:'Botanika', project:'Dia D', feitaEm:dia(-3) },
  { ...base, id:'t2', title:'Ajustar públicos do anúncio', status:'a fazer', assignees:['Pedro Lage'], due:dia(-1), brand:'Botanika', project:'Dia D' },
  { ...base, id:'t3', title:'Revisar a página da coleção no site', status:'a fazer', assignees:[], due:dia(1), brand:'Botanika', project:'Dia D' },
  { ...base, id:'t4', title:'Post do feed de quinta', status:'a fazer', assignees:['Ítalo Neves'], due:dia(2), brand:'Botanika', project:'Orgânico' },
  { ...base, id:'t5', title:'Padronizar UTMs dos links', status:'a fazer', assignees:['Pedro Lage'], due:dia(4), brand:'Botanika', project:'Arrumação interna' },
];
const campanhas = [
  { id:'c1', name:'Dia D', brand:'Botanika', type:'Dia D', status:'Em execução', owner:'', start:dia(-2), end:dia(2),
    goal:0, budget:0, progress:0, color:'#121415', objective:'', offer:'', benefits:[], channels:[], products:[], schedule:[], tap:[] },
];
const SETOR_INF = {
  setor: 'influenciadores', de: dia(-30), ate: hoje, hoje,
  kpis: { faturamento: 24731.69, vendas: 68, ticket: 363.7, ativos: 2 },
  aquisicao: { novos: 14000, recorrentes: 10731.69, desconto: 1269.84 },
  serie: [{ dia: dia(-2), faturamento: 5000 }, { dia: dia(-1), faturamento: 8000 }],
  ranking: [
    { nome: 'Victoria', codigos: 'VICTORIA', vendas: 54, faturamento: 20766.32, ticket: 384.56, pct_novos: 50, desconto: 1092.96, tendencia: 'up' },
    { nome: 'Julia Colares', codigos: 'JULIACOLARES', vendas: 14, faturamento: 3965.37, ticket: 283.24, pct_novos: 71.43, desconto: 176.88, tendencia: 'down' },
  ],
  outros: [], metas: {}, realizado_periodo: {}, realizado_mes: {},
};
const CUPONS = { cadastro: [
  { codigo: 'VICTORIA', nome: 'Victoria', tipo: 'influencer', percentual: 5 },
  { codigo: 'JULIACOLARES', nome: 'Julia Colares', tipo: 'influencer', percentual: 4 },
  { codigo: 'ANNAM', nome: 'Anna Machado', tipo: 'influencer', percentual: 10 },
  { codigo: 'BOTANIKA5', nome: 'Boas-vindas', tipo: 'promo', percentual: 5 },
], agrupados: [] };
const gravacoes = [];

const SETORES = { ano: ANO, mes: MES, dias: 30, dia_hoje: DIA, hoje, inicio: `${hoje.slice(0,7)}-01`, fim: `${hoje.slice(0,7)}-30`,
  metas: { 'trafego||investimento': { valor: 30000, unidade: 'R$' }, 'trafego||roas_alvo': { valor: 3, unidade: 'x' } },
  realizados: { 'trafego||investimento': 12000, 'trafego||roas_alvo': 2.4 },
  manuais: {}, meta_geral: null, historico_metas: [], semanas: [], sessoes: {}, sugestao: { semanas: [] },
  periodo: { de: hoje, ate: hoje, dias: 1 }, realizado_periodo: {} };

async function abrir(perfil) {
  const pag = await nav.newPage({ viewport: { width: 1440, height: 1000 } });
  pag.on('pageerror', (e) => console.log('  [erro na página]', e.message));
  await pag.addInitScript(([ts, cs, areas, perfis, eu]) => {
    window.__eu = eu;
    window.supabase = { createClient: () => ({
      auth:{getSession:async()=>({data:{session:{access_token:'jwt',user:{id:eu.id,email:eu.email}}}}),signOut:async()=>({})},
      rpc: async () => ({ data: {}, error: null }),
      from:(tab)=>({
        select:()=>({
          or:async()=>({data:[
            {chave:'central.tasks.vitor-gutierrez',dono:null,valor:ts},
            {chave:'central.campaigns.vitor-gutierrez',dono:null,valor:cs}],error:null}),
          eq:()=>({is:()=>({maybeSingle:async()=>({data:null})}),eq:()=>({maybeSingle:async()=>({data:null})}),
                   maybeSingle:async()=>({data:eu})}),
          order:async()=>({data: tab==='areas'?areas: tab==='profiles'?perfis: [], error:null}),
          then:(f)=>f({data: tab==='areas'?areas: tab==='profiles'?perfis: [], error:null}),
        }),
        upsert:async()=>({error:null}),
      }) }) };
  }, [tarefas, campanhas, AREAS, PERFIS, perfil]);
  await pag.route('**/supabase.js', (r) => r.fulfill({ status:200, body:'', contentType:'application/javascript' }));
  await pag.route('**/api/painel**', async (rota) => {
    const req = rota.request();
    if (req.method() === 'POST') {
      gravacoes.push(JSON.parse(req.postData() || '{}'));
      return rota.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ ok: true }) });
    }
    const q = Object.fromEntries(new URL(req.url()).searchParams);
    const dados = q.tela === 'setor' ? SETOR_INF : q.tela === 'cupons' ? CUPONS : SETORES;
    return rota.fulfill({ status:200, contentType:'application/json',
      body: JSON.stringify({ marca:'Botanika', tela:q.tela, dados, em: new Date().toISOString() }) });
  });
  await pag.goto(`http://127.0.0.1:${srv.address().port}/`, { waitUntil:'networkidle' });
  await pag.waitForTimeout(1500);
  await pag.evaluate((e) => { window.CentralEu = e; window.Acessos?.carregar?.(true) }, perfil);
  await irPara(pag, 'painelNav');
  await pag.waitForTimeout(500);
  await pag.locator('#painelView [data-tela="area"]').click();
  await pag.waitForTimeout(1200);
  return pag;
}

const ok = [];
const conf = (n, v) => { assert.ok(v, n); ok.push(n) };

/* ---------- a área na home de quem executa ----------
   Quem executa abre a Central para ver o que é da área dele; quem
   administra, para acompanhar a operação. O arranjo de fábrica é
   diferente para cada um. */
const pHome = await abrir({ id:'u-italo', nome:'Ítalo Neves', email:'italo@b.com', papel:'membro', ativo:true, cargo:'Social', area_id:'a-soc' });
await irPara(pHome, 'homeNav'); await pHome.waitForTimeout(900);
const arr = await pHome.evaluate(() => window.HomeModular.arranjo().map((b) => b.id));
/* A home de fábrica é a de sempre: a área não entra sozinha na frente de
   ninguém — chegou a entrar, atrapalhou, e voltou para o catálogo. */
conf('a área não se impõe na home de quem não pediu', !arr.includes('minhaArea'));
await pHome.locator('[data-hm-organizar]').click(); await pHome.waitForTimeout(300);
await pHome.locator('[data-hm-add]').click(); await pHome.waitForTimeout(300);
await pHome.locator('[data-hm-por="minhaArea"]').click(); await pHome.waitForTimeout(1200);
conf('mas está no catálogo, para quem quiser chamar',
  (await pHome.evaluate(() => window.HomeModular.arranjo().map((b) => b.id))).includes('minhaArea'));
await pHome.waitForTimeout(900);
const bloco = (await pHome.locator('[data-hm-bloco="minhaArea"]').innerText()).replace(/\s+/g, ' ');
conf('e aí a área dele aparece na home, sem ir a lugar nenhum',
  /Social Media/i.test(bloco) && /1 abertas/.test(bloco));
conf('sem nada atrasado, a home mostra o que vem em vez de ficar vazia',
  /O que vem a seguir/i.test(bloco) && /Post do feed/i.test(bloco));
conf('com atalho para abrir a área inteira',
  await pHome.locator('[data-hm-abre-area]').count() === 1);
await pHome.close();

/* ---------- o membro ---------- */
const pIt = await abrir({ id:'u-italo', nome:'Ítalo Neves', email:'italo@b.com', papel:'membro', ativo:true, cargo:'Social', area_id:'a-soc' });
conf('a área virou uma tela do painel', await pIt.locator('#painelView [data-tela="area"]').count() === 1);
let txt = (await pIt.locator('#painelCorpo').innerText()).replace(/\s+/g, ' ');
conf('quem é membro cai na área dele', /Social Media/i.test(txt));
conf('e não ganha seletor para bisbilhotar as outras',
  await pIt.locator('[data-ar-area]').count() === 0 && await pIt.locator('.ar-fixa').count() === 1);
conf('a tarefa de quem é da área entra', /Post do feed/i.test(txt));
conf('e a de outra área fica de fora', !/Ajustar p[úu]blicos/i.test(txt));
await pIt.close();

/* ---------- quem manda ---------- */
const pPe = await abrir({ id:'u-pedro', nome:'Pedro Lage', email:'pedro@b.com', papel:'gestor', ativo:true, cargo:'Tráfego', area_id:'a-traf' });
txt = (await pPe.locator('#painelCorpo').innerText()).replace(/\s+/g, ' ');
conf('quem é gestor ganha o seletor de área', await pPe.locator('[data-ar-area]').count() === 1);
conf('e cai na própria por padrão',
  await pPe.locator('[data-ar-area]').inputValue() === 'a-traf');
conf('as tarefas de quem é da área entram', /Ajustar p[úu]blicos/i.test(txt));
conf('e as do tipo da área também, mesmo sem responsável', /Revisar a p[áa]gina da cole[çc][ãa]o/i.test(txt));
conf('mas a de outra área não', !/Post do feed/i.test(txt));

/* ---------- campanha e projeto, com o quanto falta ---------- */
conf('a campanha em que a área está aparece com o quanto entregou',
  /Dia D/.test(txt) && /entregue/.test(txt));
const camp = await pPe.locator('[data-ar-campanha="Dia D"]').innerText();
conf('e a conta é das tarefas da área naquela campanha, não das de todo mundo',
  /33% entregue/.test(camp.replace(/\s+/g, ' ')) && /faltam 67%/.test(camp.replace(/\s+/g, ' ')));
conf('projeto que não é campanha entra separado',
  /Projetos desta [áa]rea/i.test(txt) && /Arruma[çc][ãa]o interna/.test(txt));

/* ---------- micrometa ---------- */
conf('a métrica de fluxo ganha micrometa do dia', /Micrometa de hoje/i.test(txt));
const mm = await pPe.evaluate(({ dias, diaHoje }) => window.AreaTela.micrometa(
  { tipo: 'fluxo' }, 30000, 12000, diaHoje, dias), { dias: 30, diaHoje: DIA });
conf('ela divide o que falta pelos dias que sobraram, não a meta pelo mês inteiro',
  mm.tipo === 'dia' && Math.round(mm.valor) === Math.round(18000 / (30 - DIA + 1)));
const nivel = await pPe.evaluate(() => window.AreaTela.micrometa({ tipo: 'taxa' }, 3, 2.4, 9, 30));
conf('e métrica de nível não se divide: mostra o alvo a manter',
  nivel.tipo === 'nivel' && nivel.valor === 3);
conf('meta já batida não pede mais nada',
  (await pPe.evaluate(() => window.AreaTela.micrometa({ tipo: 'fluxo' }, 100, 120, 9, 30))).resta === 0);

/* ---------- trocar de área ---------- */
await pPe.locator('[data-ar-area]').selectOption('a-soc');
await pPe.waitForTimeout(900);
txt = (await pPe.locator('#painelCorpo').innerText()).replace(/\s+/g, ' ');
conf('trocar de área troca tudo na tela', /Post do feed/i.test(txt) && !/Ajustar p[úu]blicos/i.test(txt));
conf('e aparece o atalho para voltar à sua', await pPe.locator('[data-ar-minha]').count() === 1);
await pPe.locator('[data-ar-minha]').click(); await pPe.waitForTimeout(900);
conf('que devolve a área de quem está logado',
  await pPe.locator('[data-ar-area]').inputValue() === 'a-traf');
/* ---------- a área de creators ---------- */
await pPe.locator('[data-ar-area]').selectOption('a-cre');
await pPe.waitForTimeout(1200);
txt = (await pPe.locator('#painelCorpo').innerText()).replace(/\s+/g, ' ');
conf('a área de creators traz o que só existe nela',
  /Quem vendeu/i.test(txt) && /Victoria/.test(txt) && /Julia Colares/.test(txt));
conf('com o desconto dado por creator, que é a conta do fechamento',
  /Desconto dado/i.test(txt) && /R\$ 1\.093/.test(txt));
conf('e a tendência dos últimos sete dias', /subindo/i.test(txt) && /caindo/i.test(txt));
conf('cadastrado que não vendeu aparece separado, para ser cobrado',
  /não venderam/i.test(txt) && /Anna Machado/.test(txt));
conf('e cupom que não é de creator fica de fora dessa conta', !/Boas-vindas/.test(txt));
conf('mostra de onde veio a venda: cliente novo contra recorrente',
  /De onde veio a venda/i.test(txt) && /J[áa] eram clientes/i.test(txt));
conf('e o faturamento por dia', /Faturamento por dia/i.test(txt));

/* os cupons se editam ali mesmo */
conf('os cupons dos creators vêm editáveis',
  await pPe.locator('[data-cr-cupom]').count() === 3 && await pPe.locator('[data-cr-novo]').count() === 1);
const linha = pPe.locator('[data-cr-cupom="VICTORIA"]');
await linha.locator('[name=percentual]').fill('7');
await linha.locator('button[type=submit]').click();
await pPe.waitForTimeout(700);
const g = gravacoes[gravacoes.length - 1];
conf('salvar manda o cupom para o painel da marca',
  g && g.acao === 'cupom' && g.dados.codigo === 'VICTORIA' && g.dados.percentual === 7 && g.dados.tipo === 'influencer');

const novo = pPe.locator('[data-cr-novo]');
await novo.locator('[name=codigo]').fill('nova');
await novo.locator('[name=nome]').fill('Nova Creator');
await novo.locator('[name=percentual]').fill('12');
await novo.locator('button[type=submit]').click();
await pPe.waitForTimeout(700);
const g2 = gravacoes[gravacoes.length - 1];
conf('e acrescentar um novo sobe com o código em maiúsculas',
  g2 && g2.acao === 'cupom' && g2.dados.codigo === 'NOVA' && g2.dados.nome === 'Nova Creator');

pPe.on('dialog', (d) => d.accept());
await pPe.locator('[data-cr-tirar="ANNAM"]').click();
await pPe.waitForTimeout(700);
const g3 = gravacoes[gravacoes.length - 1];
conf('tirar do acompanhamento pede confirmação e manda o código',
  g3 && g3.acao === 'cupom_excluir' && g3.dados.codigo === 'ANNAM');

conf('e a área ganhou filtro de período, que a de antes não tinha',
  await pPe.locator('#painelView [data-preset]').count() === 6);
await pPe.screenshot({ path: 'teste/31-area.png', fullPage: true });
await pPe.close();

console.log(ok.map((s) => '  ✓ ' + s).join('\n'));
console.log(`\nárea: ${ok.length} checagens passaram`);
await nav.close(); srv.close();
