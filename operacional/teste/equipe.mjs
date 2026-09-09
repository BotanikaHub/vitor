/* Equipe e rituais: Daily, Reunião de KPI, Pessoas e Projetos dentro do
   Painel, com donos em tudo. As tarefas e campanhas vêm do localStorage
   (como a ponte entrega), e o /api/painel é fingido com o mesmo formato
   das funções de lá. Confiro que cada tela lê o que tem, que o que se
   escreve (dono, nota, ação, cadastro) vai para as chaves central.* e que
   as telas conversam entre si. */
import { chromium } from '/home/user/vitor/node_modules/playwright-core/index.mjs';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const srv = createServer((_, r) => { r.writeHead(200,{'content-type':'text/html; charset=utf-8'}); r.end(html) }).listen(0);
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const contexto = await nav.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] });
const pag = await contexto.newPage();
pag.on('pageerror', (e) => console.log('  [erro na página]', e.message));

const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const dia = (n) => { const d = new Date(`${hoje}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) };
const ontem = dia(-1);

const base = { description:'', subtasks:[], checklist:[], attachments:[], comments:[], history:[], recurrence:'none', priority:'normal' };
const tarefas = [
  { ...base, id:'t1', title:'Subir criativos do Dia D', status:'a fazer', assignees:['Pedro Lage'], due:hoje, brand:'Botanika', project:'Dia D — 09/09' },
  { ...base, id:'t2', title:'Copy do e-mail de aquecimento', status:'a fazer', assignees:['Pedro Lage'], due:dia(-3), brand:'Botanika', project:'Dia D — 09/09' },
  { ...base, id:'t3', title:'Relatório de tráfego', status:'feito', assignees:['Pedro Lage'], due:ontem, brand:'Botanika', project:'Dia D — 09/09', feitaEm: ontem },
  { ...base, id:'t4', title:'Roteiro do reels', status:'feito', assignees:['Ítalo Neves'], due:dia(-6), brand:'Botanika', project:'Orgânico', feitaEm: dia(-6) },
  { ...base, id:'t5', title:'Programar disparo', status:'a fazer', assignees:['Sarah | Gestora de Automações'], due:dia(2), brand:'Botanika', project:'Dia D — 09/09' },
  { ...base, id:'t6', title:'Tarefa órfã vencida', status:'a fazer', assignees:[], due:dia(-1), brand:'Botanika', project:'Avulsas' },
  { ...base, id:'t7', title:'Coisa da VermeFree', status:'a fazer', assignees:['Ana Medeiros'], due:hoje, brand:'VermeFree', project:'Dia D Kids' },
  { ...base, id:'t8', title:'Feita só na Central', status:'feito', assignees:['Ítalo Neves'], due:hoje, brand:'Botanika', project:'Orgânico' },
  /* a campanha que estreia daqui a três dias: prazo ainda não venceu, e é
     exatamente por isso que ninguém olha para ela */
  { ...base, id:'t9', title:'Arte do banner da Semana do Cliente', status:'a fazer', assignees:['Ítalo Neves'], due:dia(2), brand:'Botanika', project:'Semana do Cliente' },
  { ...base, id:'t10', title:'Cupons da Semana do Cliente', status:'a fazer', assignees:[], due:dia(3), brand:'Botanika', project:'Semana do Cliente' },
  { ...base, id:'t11', title:'Briefing da Semana do Cliente', status:'feito', assignees:['Ítalo Neves'], due:dia(-2), brand:'Botanika', project:'Semana do Cliente', feitaEm: dia(-2) },
];
const campanhas = [
  { id:'pl-7', name:'Dia D — 09/09', brand:'Botanika', type:'Dia D', status:'Em execução', owner:'Vitor Gutierrez', start:dia(-1), end:dia(1), goal:60000, budget:10000, progress:0, color:'#121415', objective:'', offer:'', benefits:[], channels:[], products:[], schedule:[], tap:[] },
  { id:'pl-4', name:'Orgânico', brand:'Botanika', type:'Perpétuo', status:'Em execução', owner:'', start:dia(-5), end:dia(9), goal:30000, budget:0, progress:0, color:'#121415', objective:'', offer:'', benefits:[], channels:[], products:[], schedule:[], tap:[] },
  { id:'pl-17', name:'Dia D Kids', brand:'VermeFree', type:'Dia D', status:'Planejamento', owner:'Vitor Gutierrez', start:dia(18), end:dia(20), goal:50000, budget:8000, progress:0, color:'#121415', objective:'', offer:'', benefits:[], channels:[], products:[], schedule:[], tap:[] },
  { id:'pl-9', name:'Semana do Cliente', brand:'Botanika', type:'Sazonal', status:'Planejamento', owner:'Vitor Gutierrez', start:dia(3), end:dia(9), goal:80000, budget:12000, progress:0, color:'#121415', objective:'', offer:'', benefits:[], channels:[], products:[], schedule:[], tap:[] },
  { id:'pl-1', name:'Campanha velha', brand:'Botanika', type:'Dia D', status:'Concluída', owner:'Pedro Lage', start:'2026-08-01', end:'2026-08-02', goal:1, budget:0, progress:0, color:'#121415', objective:'', offer:'', benefits:[], channels:[], products:[], schedule:[], tap:[] },
];

/* ---------- o banco de lá, resumido ---------- */
const serie = Array.from({ length: 30 }, (_, i) => ({ dia: `${hoje.slice(0, 7)}-${String(i + 1).padStart(2, '0')}`, faturamento: 5000 + (i % 3) * 500, pedidos: 12 }));
const VISAO = { periodo: { de: `${hoje.slice(0, 7)}-01`, ate: `${hoje.slice(0, 7)}-30` }, hoje, atualizado_em: new Date().toISOString(), serie,
  visao: { faturamento: 148029.77, pedidos: 464, pedidos_totais: 489, ticket: 319, unidades: 1388, faturamento_hoje: 31447.87, faturamento_ontem: 19219.53, status: {}, fontes: [], grupos: {}, frete_gratis: {}, cupom: {}, lucro: {} },
  produtos: [], clientes: {}, reembolso: {}, recompra: {}, recompra_mes: {}, anterior: { rotulo: 'vs mês passado' },
  mes: { ano: +hoje.slice(0, 4), mes: +hoje.slice(5, 7), dias: 30, dia_hoje: +hoje.slice(8, 10), meta1: 480000, meta2: 530000, meta3: 600000, meta_ativa: 1, meta: 480000, realizado: 148029.77, pct: 30.84, esperado_ate_hoje: 144000, projecao: 493432, ritmo: [{ nome: 'Meta 1', total: 480000, esperado: 144000, gap: 4029.77, dentro: true }] } };
const TRAFEGO = { kpis: { investimento: 1597.45, faturamento_atribuido: 5004.32, conversoes: 40 }, breakeven: { roas: 1.46 }, roas_alvo: 2.93, serie: [], criativos: [], gerenciador: [], meta: {}, anterior: {} };
const ALERTAS = [{ id: 'meta:trafego||investimento', pct: 59, meta: 100000, tela: 'trafego', chave: 'trafego||investimento', setor: 'Tráfego', titulo: 'Tráfego · Investimento fora do ritmo (59% do previsto)', detalhe: 'Realizado R$ 17.817 · previsto até hoje R$ 30.000', severidade: 'critico' }];
const seg = (() => { const d = new Date(`${hoje}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10) })();
const SETORES = { ano: +hoje.slice(0, 4), mes: +hoje.slice(5, 7), dias: 30, dia_hoje: +hoje.slice(8, 10), hoje,
  metas: { 'trafego||investimento': { valor: 100000, unidade: 'R$' }, 'trafego||roas_alvo': { valor: 3, unidade: 'x' }, 'geral||ticket_medio': { valor: 350, unidade: 'R$' } },
  realizados: { 'trafego||investimento': 17816.78, 'trafego||roas_alvo': 2.55, 'geral||ticket_medio': 319.03, 'geral||faturamento_mes': 148029.77, 'geral||pedidos': 464 },
  meta_geral: { meta1: 480000, meta2: 530000, meta3: 600000, meta_ativa: 1 }, historico_metas: [], manuais: {}, sugestao: { medias: {}, semanas: [] },
  semanas: [{ n: 1, inicio: dia(-7 - ((new Date(`${hoje}T12:00:00Z`).getUTCDay() + 6) % 7)), fim: dia(-1 - ((new Date(`${hoje}T12:00:00Z`).getUTCDay() + 6) % 7)), dias: 7, futura: false, em_andamento: false, metas: { 'trafego||investimento': 20000 }, realizados: { 'trafego||investimento': 10733.77 } },
    { n: 2, inicio: seg, fim: dia(6 - ((new Date(`${hoje}T12:00:00Z`).getUTCDay() + 6) % 7)), dias: 7, futura: false, em_andamento: true, metas: { 'trafego||investimento': 20000 }, realizados: { 'trafego||investimento': 7083.01 } }] };

const chamadas = [];
await pag.route('**/api/painel**', async (rota) => {
  const q = Object.fromEntries(new URL(rota.request().url()).searchParams);
  chamadas.push(q);
  const json = (status, corpo) => rota.fulfill({ status, contentType: 'application/json', body: JSON.stringify(corpo) });
  if (rota.request().method() === 'POST') return json(200, { ok: true });
  const dados = { visao: VISAO, trafego: TRAFEGO, alertas: ALERTAS, setores: SETORES, setor: { setor: q.setor, metas: {}, canais: [] } }[q.tela];
  return dados ? json(200, { marca: q.marca, tela: q.tela, dados, em: new Date().toISOString() }) : json(400, { erro: 'tela' });
});
await pag.addInitScript(({ ts, cs }) => {
  window.supabase = { createClient: () => ({
    auth:{getSession:async()=>({data:{session:{access_token:'jwt',user:{id:'u1',email:'v@b.com'}}}}),signOut:async()=>({})},
    from:()=>({select:()=>({or:async()=>({data:[{chave:'central.tasks.vitor-gutierrez',dono:null,valor:ts},{chave:'central.campaigns.vitor-gutierrez',dono:null,valor:cs}],error:null}),
      eq:()=>({maybeSingle:async()=>({data:null})})}),upsert:async()=>({error:null})}) }) };
}, { ts: tarefas, cs: campanhas });
await pag.route('**/supabase.js', (r) => r.fulfill({ status:200, body:'', contentType:'application/javascript' }));
await pag.goto(`http://127.0.0.1:${srv.address().port}/`, { waitUntil:'networkidle' });
await pag.waitForTimeout(1200);

const ok = [];
const conf = (n, v) => { assert.ok(v, n); ok.push(n) };
const texto = async (sel) => (await pag.locator(sel).innerText()).replace(/\s+/g, ' ');
const espera = async (sel, t = 5000) => pag.locator(sel).first().waitFor({ state: 'visible', timeout: t });
const chave = async (k) => pag.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), k);

await pag.locator('#painelNav').click(); await espera('#painelView .pn-tile');
conf('o cabeçalho ganhou o grupo de rituais, equipe e acessos', await pag.locator('#painelView .pn-extras [data-tela]').count() === 5);

/* ---------- Daily ---------- */
await pag.locator('#painelView [data-tela="daily"]').click(); await espera('#painelCorpo .eq-pessoa');
let corpo = await texto('#painelCorpo');
conf('a daily abre no dia de hoje', corpo.includes('· hoje') && (await pag.locator('[data-eq-dia-input]').inputValue()) === hoje);
conf('mostra o faturamento de ontem e o Meta Ads de ontem', corpo.includes('R$ 19.219,53') && corpo.includes('R$ 1.597,45'));
const cOntem = chamadas.find((c) => c.tela === 'trafego');
conf('e pede o tráfego só do dia de ontem', cOntem && cOntem.de === ontem && cOntem.ate === ontem);
conf('as pessoas da Botanika viram cartões, e a da VermeFree não',
  corpo.includes('Pedro Lage') && corpo.includes('Ítalo Neves') && !corpo.includes('Ana Medeiros'));
const pedro = pag.locator('#painelCorpo .eq-pessoa', { hasText: 'Pedro Lage' });
const pedroTxt = (await pedro.innerText()).replace(/\s+/g, ' ');
conf('o cartão do Pedro separa o que vence hoje do atrasado e do feito',
  pedroTxt.includes('1 atrasadas') && pedroTxt.includes('1 vencem hoje') && pedroTxt.includes('1 feitas') &&
  pedroTxt.includes('Subir criativos') && pedroTxt.includes('Copy do e-mail') && pedroTxt.includes('Relatório de tráfego'));
conf('tarefa feita só na Central ganha a data de hoje', (await chave('central.feitas.vitor-gutierrez'))?.t8 === hoje);
conf('tarefa vencida sem responsável aparece separada', corpo.includes('Tarefas sem dono') && corpo.includes('Tarefa órfã'));
conf('o alerta do painel entra na daily, e diz que está sem dono', corpo.includes('fora do ritmo') && corpo.includes('sem dono'));

/* ---------- o que estreia ----------
   Campanha não quebra no dia da estreia: quebra nos dias antes, quando o
   prazo da tarefa ainda não venceu e por isso ninguém olha para ela. */
conf('a daily olha para frente e mostra a campanha que vem',
  corpo.includes('O que estreia') && corpo.includes('Semana do Cliente') && corpo.includes('estreia em 3 dias'));
conf('com o quanto já está pronto e o que ainda está aberto',
  /2 abertas/.test(corpo) && /1 de 3 prontas/.test(corpo));
conf('e aponta o que não tem dono antes de a campanha começar',
  corpo.includes('1 sem dono'));
const italo = pag.locator('#painelCorpo .eq-pessoa', { hasText: 'Ítalo Neves' });
const italoTxt = (await italo.innerText()).replace(/\s+/g, ' ');
/* os rótulos das colunas sobem para maiúsculas no CSS */
conf('a tarefa da estreia entra na daily de quem a tem, mesmo sem prazo vencido',
  /estreia em 3 dias/i.test(italoTxt) && /Arte do banner/i.test(italoTxt));
conf('e vem com o campo de por que ainda não fechou',
  await italo.locator('textarea[data-caminho^="estreias."]').count() === 1);
await italo.locator('textarea[data-caminho^="estreias."]').fill('Faltou a foto do produto novo');
await italo.locator('textarea[data-caminho^="estreias."]').dispatchEvent('change'); await pag.waitForTimeout(250);
conf('o porquê fica gravado por campanha e por pessoa',
  (await chave('central.rituais.vitor-gutierrez'))?.daily?.[`Botanika|${hoje}`]?.estreias?.['semana-do-cliente']?.['Ítalo Neves'] === 'Faltou a foto do produto novo');
conf('a campanha que termina hoje ou amanhã aparece para sair do ar',
  corpo.includes('O que sai do ar') && corpo.includes('Dia D — 09/09'));

await pedro.locator('textarea[data-caminho$=".foco"]').fill('Fechar os criativos até 14h');
await pedro.locator('textarea[data-caminho$=".foco"]').dispatchEvent('change'); await pag.waitForTimeout(200);
const rit = await chave('central.rituais.vitor-gutierrez');
conf('o foco escrito vai para central.rituais, por marca e dia', rit?.daily?.[`Botanika|${hoje}`]?.pessoas?.['Pedro Lage']?.foco === 'Fechar os criativos até 14h');

const form = pag.locator('#painelCorpo [data-eq-acao-nova][data-origem="daily"]');
await form.locator('[name=texto]').fill('Trocar o link do Whey');
await form.locator('[name=dono]').selectOption('Pedro Lage');
await form.locator('[name=prazo]').fill(dia(1));
await form.locator('button[type=submit]').click(); await espera('#painelCorpo .eq-acao');
corpo = await texto('#painelCorpo');
conf('a ação combinada aparece com dono e prazo', corpo.includes('Trocar o link do Whey') && (await pag.locator('#painelCorpo .eq-acao').first().innerText()).includes('Pedro Lage'));
conf('e fica gravada com origem e marca', (await chave('central.rituais.vitor-gutierrez')).acoes[0].origem === 'daily' && (await chave('central.rituais.vitor-gutierrez')).acoes[0].marca === 'Botanika');
conf('a ação pendente também aparece no cartão da pessoa', (await pedro.innerText()).includes('Trocar o link do Whey'));

await pag.locator('#painelCorpo [data-eq-copiar="daily"]').click(); await pag.waitForTimeout(300);
const copiado = await pag.evaluate(() => navigator.clipboard.readText());
conf('copiar resumo gera texto para o grupo, com pessoas e ações', copiado.includes('*Daily Botanika') && copiado.includes('Pedro Lage') && copiado.includes('☐ Trocar o link do Whey'));
await pag.screenshot({ path: 'teste/28-daily.png', fullPage: true });

await pag.locator('#painelCorpo [data-eq-dia="-1"]').click(); await pag.waitForTimeout(500);
conf('voltar um dia muda a data e o tráfego pedido', (await pag.locator('[data-eq-dia-input]').inputValue()) === ontem && chamadas[chamadas.length - 1].de === dia(-2));
await pag.locator('#painelCorpo [data-eq-dia="1"]').click(); await pag.waitForTimeout(400);

/* ---------- donos em Setores ---------- */
await pag.locator('#painelView [data-tela="setores"]').click(); await espera('#painelCorpo .pn-setor');
conf('cada setor ganhou um seletor de dono', await pag.locator('#painelCorpo [data-dono^="setor|"]').count() === 6);
await pag.locator('#painelCorpo [data-dono="setor|trafego"]').selectOption('Pedro Lage'); await pag.waitForTimeout(200);
conf('escolher o dono grava em central.donos', (await chave('central.donos.vitor-gutierrez'))['Botanika|setor|trafego'] === 'Pedro Lage');
await pag.locator('#painelView [data-tela="daily"]').click(); await espera('#painelCorpo .eq-pessoa');
conf('e o alerta do setor passa a dizer quem responde', (await texto('#painelCorpo')).includes('dono Pedro Lage'));

/* ---------- Reunião de KPI ---------- */
await pag.locator('#painelView [data-tela="kpi"]').click(); await espera('#painelCorpo .eq-setor');
corpo = await texto('#painelCorpo');
conf('a reunião mostra a semana e a quinta', /Semana \d\d · \d\d\/\d\d a \d\d\/\d\d · reunião quinta/.test(corpo));
conf('o setor de tráfego aparece com o dono; os outros, sem', corpo.includes('dono Pedro Lage') && (await pag.locator('#painelCorpo .eq-setor em').count()) === 5);
const traf = pag.locator('#painelCorpo .eq-setor', { hasText: 'Tráfego' });
const trafTxt = (await traf.innerText()).replace(/\s+/g, ' ');
conf('a meta da semana e o realizado entram na tabela', trafTxt.includes('R$ 20.000') && trafTxt.includes('R$ 7.083'));
conf('a execução da semana conta as tarefas feitas por pessoa', corpo.includes('Execução da semana') && (await pag.locator('#painelCorpo .pn-tabela', { hasText: 'Concluídas na semana' }).innerText()).includes('Pedro Lage'));
await traf.locator('textarea[data-caminho$=".leitura"]').fill('CPA subiu com o criativo novo');
await traf.locator('textarea[data-caminho$=".leitura"]').dispatchEvent('change'); await pag.waitForTimeout(200);
const semanaRef = Object.keys((await chave('central.rituais.vitor-gutierrez')).kpi)[0];
conf('a leitura fica gravada por marca e semana ISO', /^Botanika\|\d{4}-W\d{2}$/.test(semanaRef));
const formK = pag.locator('#painelCorpo [data-eq-acao-nova][data-origem="kpi"]');
await formK.locator('[name=texto]').fill('Pausar o conjunto que não converte');
await formK.locator('[name=dono]').selectOption('Pedro Lage');
await formK.locator('button[type=submit]').click(); await pag.waitForTimeout(500);
conf('a ação da reunião entra na lista da reunião', (await texto('#painelCorpo')).includes('Pausar o conjunto'));
await pag.locator('#painelCorpo [data-eq-semana="7"]').click(); await pag.waitForTimeout(500);
conf('na semana seguinte ela volta como pendência', (await pag.locator('#painelCorpo .pn-card', { hasText: 'Pendências da reunião passada' }).innerText()).includes('Pausar o conjunto'));
await pag.locator('#painelCorpo .pn-card', { hasText: 'Pendências da reunião passada' }).locator('[data-eq-acao-feita]').click(); await pag.waitForTimeout(400);
conf('e marcar como feita tira da pendência', !(await pag.locator('#painelCorpo .pn-card', { hasText: 'Pendências da reunião passada' }).innerText()).includes('Pausar o conjunto'));
await pag.locator('#painelCorpo [data-eq-semana="-7"]').click(); await pag.waitForTimeout(400);
await pag.screenshot({ path: 'teste/29-kpi.png', fullPage: true });

/* ---------- Pessoas ---------- */
await pag.locator('#painelView [data-tela="pessoas"]').click(); await espera('#painelCorpo .eq-cadastro');
conf('quem assina tarefa já está no cadastro, das duas marcas', (await texto('#painelCorpo')).includes('Ana Medeiros') && await pag.locator('#painelCorpo .eq-cadastro tbody tr').count() >= 5);
await pag.locator('#painelCorpo [data-eq-pessoa="Pedro Lage"][data-campo="area"]').selectOption('trafego'); await pag.waitForTimeout(200);
conf('a área escolhida vai para central.pessoas', (await chave('central.pessoas.vitor-gutierrez')).find((p) => p.nome === 'Pedro Lage').area === 'trafego');
const cardPedro = pag.locator('#painelCorpo .eq-pessoa', { hasText: 'Pedro Lage' });
const pedroCard = (await cardPedro.innerText()).replace(/\s+/g, ' ');
conf('o cartão da pessoa junta metas, tarefas, projetos e ações',
  pedroCard.includes('Setor Tráfego') && pedroCard.includes('Campanha velha') && pedroCard.includes('Trocar o link do Whey'));
await pag.locator('#painelCorpo [data-eq-pessoa-nova] [name=nome]').fill('Nova Pessoa');
await pag.locator('#painelCorpo [data-eq-pessoa-nova] [name=area]').selectOption('design');
await pag.locator('#painelCorpo [data-eq-pessoa-nova] button[type=submit]').click(); await pag.waitForTimeout(500);
conf('adicionar alguém cria o cadastro e o cartão', (await texto('#painelCorpo')).includes('Nova Pessoa') && (await chave('central.pessoas.vitor-gutierrez')).some((p) => p.nome === 'Nova Pessoa' && p.origem === 'manual'));
await pag.locator('#painelCorpo [data-eq-pessoa="Nova Pessoa"][data-campo="ativo"]').click(); await pag.waitForTimeout(500);
conf('desativar tira o cartão sem apagar o cadastro', (await pag.locator('#painelCorpo .eq-pessoa', { hasText: 'Nova Pessoa' }).count()) === 0 && (await pag.locator('#painelCorpo .eq-cadastro tr.inativa').count()) === 1);
await pag.screenshot({ path: 'teste/30-pessoas.png', fullPage: true });

/* ---------- Projetos ---------- */
await pag.locator('#painelView [data-tela="projetos"]').click(); await espera('#painelCorpo .pn-tabela');
corpo = await texto('#painelCorpo');
conf('as campanhas da marca aparecem com as tarefas casadas', corpo.includes('Dia D — 09/09') && corpo.includes('1/4'));
conf('com o atraso marcado', corpo.includes('1 atrasadas'));
conf('e quem executa', await pag.locator('#painelCorpo .eq-av', { hasText: 'Pedro' }).count() >= 1);
conf('projeto do ClickUp sem campanha entra em "Outros projetos"', corpo.includes('Outros projetos') && corpo.includes('Avulsas'));
conf('campanha concluída fica separada', corpo.includes('Concluídas') && corpo.includes('Campanha velha'));
await pag.locator('#painelCorpo [data-eq-projeto-dono="pl-4"]').selectOption('Ítalo Neves'); await pag.waitForTimeout(200);
conf('trocar o dono da campanha grava na campanha', (await chave('central.campaigns.vitor-gutierrez')).find((c) => c.id === 'pl-4').owner === 'Ítalo Neves');
await pag.screenshot({ path: 'teste/31-projetos.png', fullPage: true });

/* ---------- a marca da barra vale para tudo ---------- */
await pag.locator('#brandSelect').selectOption('VermeFree'); await pag.waitForTimeout(500);
conf('trocar a marca troca as campanhas e as pessoas', (await texto('#painelCorpo')).includes('Dia D Kids') && !(await texto('#painelCorpo')).includes('Dia D — 09/09'));

console.log(ok.map(s => '  ✓ ' + s).join('\n'));
console.log(`\nequipe: ${ok.length} checagens passaram`);
await nav.close(); srv.close();
