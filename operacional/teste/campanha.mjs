/* As abas de dentro da campanha liam pouco do que o TAP já tinha. Aqui
   monto uma campanha com TAP cheio e tarefas ligadas, e confiro que cada
   aba mostra o que precisa. */
import { chromium } from '/home/user/vitor/node_modules/playwright-core/index.mjs';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const srv = createServer((_, r) => { r.writeHead(200,{'content-type':'text/html; charset=utf-8'}); r.end(html) }).listen(0);
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const pag = await nav.newPage({ viewport: { width: 1440, height: 1000 } });
pag.on('pageerror', (e) => console.log('  [erro na página]', e.message));

const campanha = {
  id: 'c-diad', name: 'Dia D — 09/09', brand: 'Botanika', type: 'Dia D',
  status: 'Em execução', owner: 'Vitor Gutierrez', start: '2026-09-09', end: '2026-09-09',
  goal: 60000, budget: 6000, progress: 0, color: '#121415',
  objective: 'Ação relâmpago de 1 dia (09/09)',
  offer: '9% OFF geral (já embutido no preço)',
  channels: [], products: [], benefits: ['Grátis para todos', 'Coqueteleira acima de R$ 400',
                                         'Manual da Suplementação (PDF)', 'Guia da Imunidade (PDF)'],
  schedule: [],
  tap: [
    { title: 'SOBRE O EVENTO', columns: ['Campo','Valor'], rows: [
      ['Nome da Campanha','Dia D — 09/09'],
      ['Formato da campanha','Ação relâmpago de 1 dia (09/09)'],
      ['Cupom automático','9% OFF geral (já embutido no preço)'],
      ['Bônus universal','Manual da Suplementação (PDF) — todos que comprarem'],
      ['Bônus via influencer','Guia da Imunidade (PDF) — só quem comprar pela influencer'],
      ['Frete','Grátis para todos, sem piso mínimo'],
      ['Brinde','Coqueteleira acima de R$ 400']] },
    { title: 'EQUIPE', columns: ['Quem','Responsabilidade'], rows: [['Gabriel','Preenche o TAP']] },
    { title: 'FASES', columns: ['Fase','Tem?','Data'], rows: [
      ['Fase 1: Captação','não tem','—'],
      ['Fase 2: Antecipação','sim','07/09'],
      ['Fase 3: É amanhã','sim','08/09'],
      ['Fase 4: Dia D (venda)','sim','09/09'],
      ['Fase 5: Última chance','sim','09/09 · 20h']] },
    { title: 'SOBRE A OFERTA', columns: ['Produto','Detalhe','Desconto'], rows: [
      ['Tri[Mg]','Tri[Mg] Complex · SKU 80.1.1 · R$ 87,50','9% OFF'],
      ['Vit C','Super Vitamina C · SKU 80.1.2 · R$ 89,52','9% OFF'],
      ['Fora do catálogo','Combo Fitness · 15% OFF','—']] },
    { title: 'AUMENTO DE TICKET MÉDIO', columns: ['Estratégia','Detalhe','Desconto'], rows: [
      ['Orderbump','SKU complementar no carrinho','10% / 15%'],
      ['Desconto por volume','3 un = 10% · 5 un = 15%','até 20%']] },
    { title: 'METAS', columns: ['Item','Valor','Responsável'], rows: [
      ['Investimento — Tráfego','R$ 4.020','Gestor'],
      ['Investimento — API','R$ 1.980','Gestor'],
      ['ROAS alvo','4,0','Gestor'],
      ['Meta faturamento — Tráfego','R$ 16.020','Gestor'],
      ['Meta faturamento — Influencer','R$ 10.680','Joinny'],
      ['Meta faturamento — API','R$ 16.020','Pedro'],
      ['Meta faturamento total','R$ 60.000',''],
      ['Investimento API e tráfego','R$ 6.000',''],
      ['Lucro (aprox.)','R$ 54.000','']] },
    { title: 'CANAIS · CRONOGRAMA',
      columns: ['Canal','Base','SEG 07/09','TER 08/09','QUA 09/09','Quem faz'], rows: [
      ['E-mails base antiga','Compradores + leads','1 sem CTA','1 é amanhã','2 vendas','Pedro cria e Sarah programa'],
      ['WhatsApp API','Base com opt-in','0','1 sem CTA','2 08h e 20h','Pedro cria e Sarah programa'],
      ['Instagram stories','Sequência','—','—','09h / 13h / 19h','Italo'],
      ['E-mails base captada','não tem','—','—','—','Pedro']] },
  ],
};
const tarefas = [
  { id: 't1', title: 'DIA D — Programar disparos de e-mail e WhatsApp', status: 'a fazer',
    assignees: ['Sarah'], due: '2026-09-09', brand: 'Botanika', project: 'Dia D',
    priority: 'urgent', checklist: [{id:'c1',text:'a',done:true},{id:'c2',text:'b',done:false}],
    clickupUrl: 'https://app.clickup.com/t/abc', canal: 'WhatsApp' },
  { id: 't2', title: 'DIA D — Criar criativos principais', status: 'fazendo',
    assignees: ['Ítalo Neves'], due: '2026-09-08', brand: 'Botanika', project: 'Dia D',
    priority: 'high', checklist: [] },
  { id: 't3', title: 'DIA D — Aprovar campanha', status: 'feito',
    assignees: ['Gabriel'], due: '2026-09-08', brand: 'Botanika', project: 'Dia D',
    priority: 'normal', checklist: [] },
  { id: 't4', title: 'Outra coisa', status: 'a fazer', assignees: ['Ana'],
    due: '2026-09-10', brand: 'Botanika', project: 'Creators Setembro', priority: 'normal', checklist: [] },
];

await pag.addInitScript(([cs, ts]) => {
  window.supabase = { createClient: () => ({
    auth:{getSession:async()=>({data:{session:{user:{id:'u1',email:'v@b.com'}}}}),signOut:async()=>({})},
    from:()=>({select:()=>({or:async()=>({data:[
        {chave:'central.campaigns.vitor-gutierrez',dono:null,valor:cs},
        {chave:'central.tasks.vitor-gutierrez',dono:null,valor:ts}],error:null}),
      eq:()=>({maybeSingle:async()=>({data:null})})}),upsert:async()=>({error:null})}) }) };
}, [[campanha], tarefas]);
await pag.route('**/supabase.js', (r) => r.fulfill({ status:200, body:'', contentType:'application/javascript' }));
await pag.goto(`http://127.0.0.1:${srv.address().port}/`, { waitUntil:'networkidle' });
await pag.waitForTimeout(1400);

await pag.evaluate(() => window.openCampaignWorkspaceByName?.('Dia D — 09/09'));
await pag.waitForTimeout(900);

const ok = [];
const conf = (n, v) => { assert.ok(v, n); ok.push(n) };
const aba = async (nome) => {
  await pag.locator(`[data-cw-tab="${nome}"]`).click();
  await pag.waitForTimeout(350);
  return (await pag.locator(`[data-cw-pane="${nome}"]`).innerText()).replace(/\s+/g, ' ');
};

/* resumo */
const r = await aba('summary');
conf('o resumo abre os números da ação',
  /META R\$ 60\.000/i.test(r) && /LUCRO PREVISTO/i.test(r));
conf('e o ROAS sai da conta, não em branco', /ROAS ALVO 10,0/i.test(r));
conf('avisa quando os canais não fecham com a meta da ação',
  /faltam/i.test(r) && r.includes('R$ 42.720'));
conf('explica o que é a ação', r.includes('Ação relâmpago de 1 dia'));
conf('lista cupom, frete, bônus e brinde',
  r.includes('9% OFF') && r.includes('Grátis para todos') && r.includes('Coqueteleira'));
conf('mostra de onde vem o faturamento, canal a canal',
  r.includes('Tráfego') && r.includes('Influencer') && r.includes('Joinny'));
conf('mostra as fases com data', r.includes('Fase 4: Dia D') && r.includes('09/09'));
conf('conta as peças que saem', /peças em \d+ dias/.test(r));
conf('conta as tarefas da campanha', /1 de 3 concluídas/.test(r));
await pag.screenshot({ path: 'teste/15-resumo.png' });

/* oferta */
const o = await aba('offer');
conf('a oferta lista os produtos com preço', o.includes('Tri[Mg]') && o.includes('R$ 87,50'));
conf('e calcula o preço final com o desconto', o.includes('R$ 79,63'));
conf('lê o desconto escrito no meio do texto do produto avulso',
  /Fora do catálogo.*15% OFF/.test(o));
conf('mostra o que a pessoa ganha além do desconto', o.includes('Coqueteleira'));
conf('traz as estratégias de ticket médio', o.includes('Orderbump') && o.includes('Desconto por volume'));

/* cronograma */
const cr = await aba('schedule');
conf('o cronograma abre o dia a dia', cr.includes('SEG 07/09') && cr.includes('1 sem CTA'));
conf('agrupa por dia com a contagem', /QUA 09\/09 3 peças/.test(cr) || /3 peças/.test(cr));
conf('diz quem faz cada peça', cr.includes('Pedro cria e Sarah programa'));
conf('e mantém a grade completa embaixo', cr.includes('E-mails base captada'));
await pag.screenshot({ path: 'teste/16-cronograma.png' });

/* tarefas */
const t = await aba('tasks');
conf('as tarefas da campanha aparecem', t.includes('Programar disparos') && t.includes('Criar criativos'));
conf('separadas por status', t.includes('A fazer') && t.includes('Fazendo') && t.includes('Concluídas'));
conf('com responsável e prazo', t.includes('Sarah') && t.includes('vence 09/09'));
conf('com o andamento do checklist', t.includes('1/2 do checklist'));
conf('e o link para o ClickUp', await pag.locator('[data-cw-pane="tasks"] a[href*="clickup"]').count() === 1);
conf('tarefa de outro projeto não entra', !t.includes('Outra coisa'));
await pag.screenshot({ path: 'teste/17-tarefas.png' });

/* ---------- editar no lugar ---------- */
const gravado = () => pag.evaluate(() =>
  JSON.parse(localStorage.getItem('central.campaigns.vitor-gutierrez'))[0]);

/* uma célula do cronograma */
await aba('schedule');
const cel = pag.locator('[data-cw-pane="schedule"] [data-ed]').nth(4);
await cel.click();
await pag.keyboard.press('Control+a');
await pag.keyboard.type('3 disparos');
await pag.keyboard.press('Enter');
await pag.waitForTimeout(500);
conf('editar uma célula do cronograma grava no TAP',
  JSON.stringify(await gravado()).includes('3 disparos'));

/* com investimento por canal no TAP, a verba do cartão é a soma deles e
   não se edita ali — edita-se o canal, e a conta acompanha */
await aba('summary');
conf('a verba vira a soma dos canais quando eles existem',
  await pag.locator('[data-cw-pane="summary"] [data-campo="budget"]').count() === 0);
const invTraf = pag.locator('[data-cw-pane="summary"] .cp-tab tbody tr').first().locator('[data-ed]').nth(1);
await invTraf.click();
await pag.keyboard.press('Control+a');
await pag.keyboard.type('R$ 8.010');
await pag.keyboard.press('Enter');
await pag.waitForTimeout(700);
const t2 = (await pag.locator('[data-cw-pane="summary"]').innerText()).replace(/\s+/g,' ');
conf('editar o investimento de um canal grava', /R\$ 8\.010/.test(t2));
conf('e a verba e o ROAS acompanham', /VERBA R\$ 9\.990/i.test(t2) && /ROAS ALVO 6,0/i.test(t2));

/* a meta da ação continua editável, porque é decisão e não soma */
const metaCard = pag.locator('[data-cw-pane="summary"] [data-campo="goal"]');
await metaCard.click();
await pag.keyboard.press('Control+a');
await pag.keyboard.type('80 mil');
await pag.keyboard.press('Enter');
await pag.waitForTimeout(600);
conf('a meta da ação é editável e entende "80 mil"', (await gravado()).goal === 80000);

/* acrescentar e tirar produto */
await aba('offer');
const antes = (await gravado()).tap.find(s => s.title.includes('OFERTA')).rows.length;
await pag.locator('[data-cw-pane="offer"] .cp-bloco').first()
  .locator('[data-linha^="mais"]').first().click();
await pag.waitForTimeout(500);
conf('dá para acrescentar produto',
  (await gravado()).tap.find(s => s.title.includes('OFERTA')).rows.length === antes + 1);
/* a aba tem duas tabelas com "×"; a dos produtos é o primeiro bloco */
pag.on('dialog', (d) => d.accept());
await pag.locator('[data-cw-pane="offer"] .cp-bloco').first()
  .locator('[data-linha^="menos"]').last().click();
await pag.waitForTimeout(500);
conf('e tirar, com confirmação',
  (await gravado()).tap.find(s => s.title.includes('OFERTA')).rows.length === antes);
await pag.screenshot({ path: 'teste/18-editar.png' });

/* ---------- excluir ---------- */
const todas = () => pag.evaluate(() =>
  JSON.parse(localStorage.getItem('central.campaigns.vitor-gutierrez') || '[]'));

/* um nó do mapa apontando para ela, para conferir o desvínculo */
await pag.evaluate(() => {
  localStorage.setItem('central.planning.map.vitor-gutierrez.Botanika', JSON.stringify({
    v: 2, layout: 'direita', prox: 3, proxItem: 1, itens: [],
    nos: [{ id: 1, pai: null, t: 'Setembro', cor: 0, x: 4500, y: 3000 },
          { id: 2, pai: 1, t: 'Dia D — 09/09', campId: 'c-diad', cor: 0, x: 4500, y: 3000 }],
  }));
});

conf('o botão de excluir aparece ao lado de editar',
  await pag.locator('#campaignWorkspace [data-excluir]').count() === 1);

await pag.locator('#campaignWorkspace [data-excluir]').click();
await pag.waitForTimeout(900);
conf('a campanha some da lista', (await todas()).length === 0);
conf('e volta para a visão geral, sem ficar numa tela órfã',
  await pag.locator('#campaignWorkspace.active').count() === 0);
const mapa = await pag.evaluate(() =>
  JSON.parse(localStorage.getItem('central.planning.map.vitor-gutierrez.Botanika')));
conf('o nó do mapa continua', mapa.nos.length === 2);
conf('mas sem o vínculo com a campanha que não existe mais',
  !mapa.nos.some((n) => n.campId));

console.log(ok.map(s => '  ✓ ' + s).join('\n'));
console.log(`\ncampanha: ${ok.length} checagens passaram`);
await nav.close(); srv.close();
