/* O Painel: as telas do Botanika Analytics dentro da Central. Aqui o
   /api/painel é fingido com respostas no formato exato das funções do
   banco de lá (central_visao, central_trafego, ...), com os números que
   elas devolveram de verdade em 09/09 — e confiro que cada tela desenha
   o que recebeu, que o período e a marca chegam certos na chamada, que
   editar uma meta grava, e que abrir e fechar convive com o resto do app. */
import { chromium } from '/home/user/vitor/node_modules/playwright-core/index.mjs';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const srv = createServer((_, r) => { r.writeHead(200,{'content-type':'text/html; charset=utf-8'}); r.end(html) }).listen(0);
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const pag = await nav.newPage({ viewport: { width: 1440, height: 1000 } });
pag.on('pageerror', (e) => console.log('  [erro na página]', e.message));

/* ---------- o que o banco de lá devolve ---------- */
const serie = (de, n, base) => Array.from({ length: n }, (_, i) => {
  const d = new Date(`${de}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + i);
  return { dia: d.toISOString().slice(0, 10), faturamento: base + (i % 5) * 1234.5, pedidos: 10 + (i % 7), gasto: 900 + (i % 4) * 150 };
});
const VISAO = {
  periodo: { de: '2026-09-01', ate: '2026-09-30', eh_mes: true, dias: 30 }, hoje: '2026-09-09', atualizado_em: '2026-09-09T17:02:00Z',
  visao: { faturamento: 148029.77, pedidos: 464, pedidos_totais: 489, ticket: 319.03, unidades: 1388, itens_por_pedido: 2.99, faturamento_hoje: 31447.87, faturamento_ontem: 19219.53,
    status: { aprovados: 464, pendentes: 0, reembolsados: 0, taxa_aprovacao: 94.89, pagamentos: [{ nome: 'Mercado Pago Cartões', qtd: 307 }, { nome: 'Mercado Pago Pix', qtd: 151 }] },
    fontes: [{ canal: 'Orgânico', faturamento: 71765.27, pedidos: 194, pct: 48.48 }, { canal: 'Meta', faturamento: 45477.04, pedidos: 170, pct: 30.72 }, { canal: 'Direto', faturamento: 11754.12, pedidos: 37, pct: 7.94 }],
    grupos: { pago: 45477.04, organico: 102552.73 }, frete_gratis: { pedidos: 175, pct: 37.72 }, cupom: { faturamento: 94659.44, pct: 63.95 },
    lucro: { valor: 107396.83, margem: 0.6736, parcial: true, receita_coberta: 159434.79, produtos_sem_custo: 1 } },
  produtos: [{ sku: '80.1.5', nome: 'Hair Botanika', faturamento: 39461.8, unidades: 397, lucro: 26464.02, margem: 0.67 }, { sku: '80.1.1', nome: 'Tri[Mg] Complex', faturamento: 21000, unidades: 240, lucro: null, margem: null }],
  serie: serie('2026-09-01', 30, 3000),
  clientes: { pedidos_novos: 368, pct_novo: 79.31, pct_recorrente: 20.69 },
  reembolso: { total: 0, pedidos: 0, taxa: 0, faturamento_bruto: 148029.77 },
  recompra: { taxa: 21.55, recompradores: 98, clientes: 458 }, recompra_mes: { taxa: 21.55, recompradores: 98, clientes: 458 },
  anterior: { de: '2026-08-01', ate: '2026-08-09', rotulo: 'vs mês passado', faturamento: 128015.43, pedidos: 436, ticket: 293.61, unidades: 1251, recompra: 16.55 },
  mes: { ano: 2026, mes: 9, inicio: '2026-09-01', fim: '2026-09-30', dias: 30, dia_hoje: 9, hoje: '2026-09-09', meta1: 480000, meta2: 530000, meta3: 600000, meta_ativa: 1, meta: 480000,
    realizado: 148029.77, pct: 30.84, gap: 331970.23, meta_diaria: 16000, esperado_ate_hoje: 144000, projecao: 493432.57,
    ritmo: [{ nome: 'Meta 1', total: 480000, esperado: 144000, gap: 4029.77, dentro: true }, { nome: 'Meta 2', total: 530000, esperado: 159000, gap: -10970.23, dentro: false }, { nome: 'Meta 3', total: 600000, esperado: 180000, gap: -31970.23, dentro: false }],
    por_dia: {}, anterior: { faturamento: 128015.43, pedidos: 436 } },
  reconciliacao: null,
};
const TRAFEGO = {
  kpis: { conversoes: 394, investimento: 17816.78, receita_meta: 120890.49, pedidos_total: 464, faturamento_total: 148029.77, pedidos_atribuidos: 170, faturamento_atribuido: 45477.04 },
  meta: { pct: 15.16, mensal: 300000, realizado: 45477.04, esperado_ate_hoje: 90000 },
  serie: serie('2026-09-01', 9, 4000), periodo: { de: '2026-09-01', ate: '2026-09-30', eh_mes: true },
  anterior: { de: '2026-08-01', ate: '2026-08-09', rotulo: 'vs mês passado', conversoes: 353, investimento: 14853.33, receita_meta: 103174.47, pedidos_atribuidos: 122, faturamento_atribuido: 31960.85 },
  breakeven: { roas: 1.464, margem: 0.683 }, meta_sync: '2026-09-09T14:01:05Z', roas_alvo: 2.928,
  criativos: [{ ad_id: 'a1', nome: 'CAMP | Hair | DrWilliam', gasto: 3287.58, receita: 8363.96, conversoes: 36, cpa: 91.32, roas: 2.54, thumb: '' }, { ad_id: 'a2', nome: 'CORINGA | tri-omega-tetra | v1', gasto: 1588.65, receita: 5728.03, conversoes: 15, cpa: 105.91, roas: 3.61, thumb: '' }],
  gerenciador: [{ id: 'c1', nome: 'GARANHAO | CAMPEOES + NOVOS', status: 'ACTIVE', gasto: 6501.71, impressoes: 348764, cliques: 6686, lp_views: 6193, checkouts: 274, conv_meta: 88, vendas_reais: 43, faturamento_real: 11602.42,
    filhos: [{ id: 's1', nome: 'CAMPEOES | ADV F35-65', gasto: 6501.71, impressoes: 348764, cliques: 6689, lp_views: 6193, checkouts: 274, conv_meta: 88, vendas_reais: 42, faturamento_real: 11404.49,
      filhos: [{ id: 'a1', nome: 'CAMP | Hair | DrWilliam', gasto: 3287.58, impressoes: 184739, cliques: 4272, lp_views: 4020, checkouts: 122, conv_meta: 36, thumb: '' }] }] },
    { id: 'c2', nome: 'PERPETUO (LP) | HAIR DR WILLIAM', status: 'ACTIVE', gasto: 2043.7, impressoes: 78621, cliques: 2277, lp_views: 2146, checkouts: 234, conv_meta: 40, vendas_reais: 0, faturamento_real: 0, filhos: [] }],
};
const metasM = { 'geral||conversao': { valor: 2.5, unidade: '%' }, 'geral||ticket_medio': { valor: 350, unidade: 'R$' }, 'geral||taxa_recompra': { valor: 20, unidade: '%' },
  'trafego||investimento': { valor: 100000, unidade: 'R$' }, 'trafego||faturamento_atribuido': { valor: 300000, unidade: 'R$' }, 'trafego||roas_alvo': { valor: 3, unidade: 'x' }, 'trafego||cpa_alvo': { valor: 105, unidade: 'R$' },
  'influenciadores||faturamento_influencer': { valor: 95000, unidade: 'R$' }, 'influenciadores||influencers_ativos': { valor: 10, unidade: 'un' }, 'influenciadores||pct_clientes_novos': { valor: 25, unidade: '%' },
  'social_media||visualizacoes': { valor: 4000000, unidade: 'un' }, 'social_media||vendas_link': { valor: 120000, unidade: 'R$' },
  'automacoes|email|faturamento': { valor: 1500, unidade: 'R$' }, 'automacoes|whatsapp_api|faturamento': { valor: 14000, unidade: 'R$' }, 'automacoes|grupos|faturamento': { valor: 9000, unidade: 'R$' } };
const realM = { 'geral||pedidos': 464, 'geral||conversao': 1.91, 'geral||ticket_medio': 319.03, 'geral||taxa_recompra': 21.55, 'geral||faturamento_mes': 148029.77,
  'trafego||investimento': 17816.78, 'trafego||faturamento_atribuido': 45477.04, 'trafego||roas_alvo': 2.55, 'trafego||cpa_alvo': 104.8,
  'influenciadores||faturamento_influencer': 26089.69, 'influenciadores||influencers_ativos': 6, 'influenciadores||pct_clientes_novos': 54.41,
  'social_media||visualizacoes': 1302413, 'social_media||interacoes': 24507, 'social_media||cliques_link': 3310, 'social_media||seguidores_liquidos': 1297, 'social_media||vendas_link': 37736.31,
  'automacoes|email|faturamento': 251.45, 'automacoes|whatsapp_api|faturamento': 4690.61, 'automacoes|grupos|faturamento': 6444.4 };
const SETORES = { ano: 2026, mes: 9, inicio: '2026-09-01', fim: '2026-09-30', dias: 30, dia_hoje: 9, hoje: '2026-09-09', metas: metasM, realizados: realM, manuais: {},
  meta_geral: { meta1: 480000, meta2: 530000, meta3: 600000, meta_ativa: 1 },
  historico_metas: [{ ano: 2026, mes: 9, meta1: 480000, meta2: 530000, meta3: 600000, meta_ativa: 1 }, { ano: 2026, mes: 8, meta1: 350000, meta2: 400000, meta3: 450000, meta_ativa: 2 }],
  semanas: [{ n: 1, inicio: '2026-09-01', fim: '2026-09-06', dias: 6, futura: false, em_andamento: false, metas: { 'trafego||investimento': 20000, 'geral||ticket_medio': 350 }, realizados: { 'trafego||investimento': 10733.77, 'geral||ticket_medio': 323.26 } },
    { n: 2, inicio: '2026-09-07', fim: '2026-09-13', dias: 7, futura: false, em_andamento: true, metas: { 'trafego||investimento': 20000, 'geral||ticket_medio': 350 }, realizados: { 'trafego||investimento': 7083.01, 'geral||ticket_medio': 312.99 } },
    { n: 3, inicio: '2026-09-14', fim: '2026-09-20', dias: 7, futura: true, em_andamento: true, metas: { 'trafego||investimento': 20000 }, realizados: {} }],
  sugestao: { medias: {}, semanas: [{ de: '2026-08-31', ate: '2026-09-06' }, { de: '2026-08-24', ate: '2026-08-30' }, { de: '2026-08-17', ate: '2026-08-23' }, { de: '2026-08-10', ate: '2026-08-16' }] },
  sessoes: { dias: 0, ultima: '2026-09-09' },
  /* o mesmo cálculo no recorte que a pessoa escolheu na barra do painel */
  periodo: { de: '2026-09-07', ate: '2026-09-09', dias: 3 },
  realizado_periodo: { 'trafego||investimento': 7083.01, 'site||taxa_checkout': 2.24, 'geral||cac': 37.72 } };
const SETOR = {
  influenciadores: { setor: 'influenciadores', de: '2026-09-01', ate: '2026-09-30', hoje: '2026-09-09', kpis: { ativos: 6, ticket: 383.67, vendas: 68, faturamento: 26089.69 },
    metas: { '|influencers_ativos': 10, '|pct_clientes_novos': 25, '|faturamento_influencer': 95000 }, serie: serie('2026-09-01', 9, 1500).map((p) => ({ dia: p.dia, faturamento: p.faturamento })),
    ranking: [{ nome: 'Victoria', ticket: 384.56, vendas: 54, codigos: 'VICTORIA', desconto: 1092.96, pct_novos: 50, tendencia: 'up', faturamento: 20766.32, recompra_publico: 51.85 }, { nome: 'Julia Colares', ticket: 595.7, vendas: 7, codigos: 'JULIACOLARES', desconto: 219.47, pct_novos: 71.43, tendencia: 'down', faturamento: 4169.87, recompra_publico: 28.57 }],
    outros: [{ nome: 'Botanika (marca)', tipo: 'promo', vendas: 197, faturamento: 59099.05 }], aquisicao: { novos: 14969.53, desconto: 1412.04, recorrentes: 11120.16 }, realizado_mes: {}, realizado_periodo: {} },
  social_media: { setor: 'social_media', de: '2026-09-01', ate: '2026-09-30', hoje: '2026-09-09', metas: {}, serie: [], split: [{ chave: 'bio', pedidos: 93, faturamento: 35750.86 }, { chave: 'stories', pedidos: 1, faturamento: 449.54 }, { chave: 'live', pedidos: 4, faturamento: 1535.91 }],
    produtos: [{ nome: 'Tri[Mg] Complex', unidades: 103, faturamento: 9012.5 }], historico: [{ reach: 130472, views: 493145, semana: '2026-09-07', cliques: 998, interacoes: 8820, seguidores_liquidos: 138 }],
    instagram: { at: '2026-09-09T12:23:00Z', username: 'botanikabrasil', seguidores: 12541, posts: 52 }, top_posts: { posts: [{ id: 'p1', likes: 463, reach: 10230, thumb: '', shares: 219, caption: 'Não é hormônio.', comments: 8, permalink: 'https://www.instagram.com/reel/x/', interacoes: 789, media_type: 'REELS' }] },
    vendas_link: { pedidos: 98, faturamento: 37736.31, pct_do_total: 25.49 }, insights_periodo: { reach: 233066, views: 1302413, cliques: 3310, interacoes: 24507, seguidores_liquidos: 1297 }, realizado_mes: {}, realizado_periodo: {} },
  automacoes: { setor: 'automacoes', de: '2026-09-01', ate: '2026-09-30', hoje: '2026-09-09', metas: { 'email|faturamento': 1500 }, contribuicao_pct: 7.69,
    canais: [{ canal: 'email', spark: [354.75, 607.45, 0, 0, 443.1, 0, 769.57, 0], fat_mes: 251.45, fat_semana: 0, melhor_dia: { dia: '2026-09-03', valor: 251.45 }, fat_periodo: 251.45, disparos_mes: 0, disparos_semana: 0, fat_semana_anterior: 769.57 },
      { canal: 'whatsapp_api', spark: [3810.4, 651.87, 2821.48, 921.38, 3037.1, 4441.75, 4540.09, 1487.96], fat_mes: 4690.61, fat_semana: 1487.96, melhor_dia: { dia: '2026-09-06', valor: 1844.9 }, fat_periodo: 4690.61, disparos_mes: 0, disparos_semana: 0, fat_semana_anterior: 4540.09 },
      { canal: 'grupos', spark: [5174.06, 2572.98, 5636.74, 1113.45, 2207.12, 1884.91, 986.94, 5875.23], fat_mes: 6444.4, fat_semana: 5875.23, melhor_dia: { dia: '2026-09-09', valor: 5875.23 }, fat_periodo: 6444.4, disparos_mes: 0, disparos_semana: 0, fat_semana_anterior: 986.94 }], realizado_mes: {}, realizado_periodo: {} },
  atendimento: { setor: 'atendimento', de: '2026-09-01', ate: '2026-09-30', hoje: '2026-09-09', metas: {}, historico: [], reembolso: { taxa: 0, total: 0, pedidos: 0, faturamento_bruto: 148029.77 }, top_reembolsados: [], realizado_mes: {}, realizado_periodo: {} },
};
const KPIS = { dias: serie('2026-09-07', 3, 9000), hoje: '2026-09-09', frete: { pedidos: 191, na_faixa: 11, gap_medio: 23.94, pct_faixa: 5.76 }, metas: { conversao: 2.5, faturamento: 48000, ticket_medio: 350, taxa_recompra: 20 },
  janela: { de: '2026-09-07', ate: '2026-09-09', rotulo: '07/09', ticket: 312.99, pedidos: 191, sessoes: 8041, recompra: 24.61, conversao: 2.38, frete_pct: 36.65, faturamento: 59780.22, recorrentes_pct: 24.08 },
  anterior: { de: '2026-09-04', ate: '2026-09-06', rotulo: '04/09', ticket: 299.65, pedidos: 114, sessoes: 8591, recompra: 17.54, conversao: 1.33, frete_pct: 30.7, faturamento: 34160.41, recorrentes_pct: 16.67 },
  produtos: [{ sku: '80.1.5', nome: 'Hair Botanika', risco: false, estoque: 1950, unidades: 158, faturamento: 15705.2 }, { sku: '80.1.1', nome: 'Tri[Mg] Complex', risco: true, estoque: 231, unidades: 122, faturamento: 10675 }],
  recompra: { taxa: 24.61, clientes: 188, recompradores: 45 }, tendencia: [{ de: '2026-08-17', ate: '2026-08-19', rotulo: '17/08', ticket: 295.93, pedidos: 185, sessoes: 5206, recompra: 20.54, conversao: 3.55, frete_pct: 35.14, faturamento: 54746.8, recorrentes_pct: 17.84 }], sem_voltar: 892 };
const ESTOQUE = { kits: [{ sku: 'kitimu', nome: 'Kit Imunidade', componentes: [{ sku: '80.1.9', nome: 'TetraVit D', estoque: 873, cobertura: 48.5 }] }],
  kpis: { baixo: 1, alerta: 1, capital: 491943.97, excesso: 7, ruptura: 0, produtos: 19, unidades: 19690, esgotados: 0, sem_custo: 8, excesso_unidades: 2517, primeira_ruptura: 8.44 },
  itens: [{ sku: '80.1.1', nome: 'Tri[Mg] Complex', custo: 21.89, preco: 87.5, repor: 1137, status: 'alerta', capital: 5056.59, estoque: 231, excesso: 0, cobertura: 8.44, tendencia: 'estavel', ruptura_em: '2026-09-17', velocidade: 27.36 },
    { sku: '80.1.5', nome: 'Hair Botanika', custo: 32.74, preco: 99.4, repor: 0, status: 'ok', capital: 63843, estoque: 1950, excesso: 0, cobertura: 45.05, tendencia: 'subindo', ruptura_em: '2026-10-24', velocidade: 43.29 }],
  config: { alerta_dias: 15, critico_dias: 7, excesso_dias: 90, lead_time_dias: 20, cobertura_alvo_dias: 30 }, sync_em: '2026-09-09T14:00:00Z' };
const CUPONS = { cadastro: [{ nome: 'Anna Machado', tipo: 'influencer', codigo: 'ANNAMACHADO', percentual: 5 }], agrupados: [{ nome: 'Botanika (marca)', tipo: 'promo', vendas: 197, codigos: ['BOTANIKA'], faturamento: 59099.05 }, { nome: 'Victoria', tipo: 'influencer', vendas: 54, codigos: ['VICTORIA'], faturamento: 20766.32 }] };
const ALERTAS = [
  { id: 'meta:automacoes|email|faturamento', pct: 55.88, meta: 1500, tela: 'automacoes', chave: 'automacoes|email|faturamento', setor: 'Automações', titulo: 'Automações · E-mail — Faturamento fora do ritmo (56% do previsto)', detalhe: 'Realizado R$ 251 · previsto até hoje R$ 450 · meta do mês R$ 1.500', unidade: 'R$', previsto: 450, realizado: 251.45, severidade: 'critico' },
  { id: 'meta:trafego||investimento', pct: 59.39, meta: 100000, tela: 'trafego', chave: 'trafego||investimento', setor: 'Tráfego', titulo: 'Tráfego · Investimento fora do ritmo (59% do previsto)', detalhe: 'Realizado R$ 17.817 · previsto até hoje R$ 30.000 · meta do mês R$ 100.000', unidade: 'R$', previsto: 30000, realizado: 17816.78, severidade: 'critico' },
  { id: 'meta:trafego||faturamento_atribuido', pct: 50.53, meta: 300000, tela: 'trafego', chave: 'trafego||faturamento_atribuido', setor: 'Tráfego', titulo: 'Tráfego · Faturamento atribuído fora do ritmo (51% do previsto)', detalhe: 'Realizado R$ 45.477 · previsto até hoje R$ 90.000', unidade: 'R$', previsto: 90000, realizado: 45477.04, severidade: 'critico' },
  { id: 'estoque:80.1.1', sku: '80.1.1', tela: 'estoque', setor: 'Estoque', titulo: 'Tri[Mg] Complex: 8,4 dias de estoque', detalhe: '231 un · giro 27,4 un/dia · limite 7/15 dias', cobertura: 8.44, severidade: 'atencao' },
  { id: 'meta:influenciadores||faturamento_influencer', pct: 91.54, meta: 95000, tela: 'influenciadores', chave: 'influenciadores||faturamento_influencer', setor: 'Influenciadores', titulo: 'Influenciadores · Faturamento via influencer fora do ritmo (92% do previsto)', detalhe: 'Realizado R$ 26.090 · previsto até hoje R$ 28.500', unidade: 'R$', previsto: 28500, realizado: 26089.69, severidade: 'atencao' },
];

/* ---------- o /api/painel fingido ---------- */
const chamadas = [];
const gravacoes = [];
await pag.route('**/api/painel**', async (rota) => {
  const req = rota.request();
  const url = new URL(req.url());
  const q = Object.fromEntries(url.searchParams);
  const auth = req.headers()['authorization'] || '';
  const json = (status, corpo) => rota.fulfill({ status, contentType: 'application/json', body: JSON.stringify(corpo) });
  if (req.method() === 'POST') {
    const corpo = JSON.parse(req.postData() || '{}');
    gravacoes.push({ corpo, auth });
    if (corpo.acao === 'meta_kpi') SETORES.metas[`${corpo.dados.escopo}|${corpo.dados.canal}|${corpo.dados.metrica}`] = { valor: corpo.dados.meta_valor, unidade: corpo.dados.unidade };
    if (corpo.acao === 'meta_mensal') Object.assign(SETORES.meta_geral, { meta1: corpo.dados.meta1, meta2: corpo.dados.meta2, meta3: corpo.dados.meta3, meta_ativa: corpo.dados.meta_ativa });
    if (corpo.acao === 'valor_setor' && corpo.dados.periodo === 'mensal') SETORES.manuais[`${corpo.dados.escopo}|${corpo.dados.canal}|${corpo.dados.metrica}`] = corpo.dados.valor;
    return json(200, { ok: true });
  }
  chamadas.push({ q, auth });
  if (q.marca === 'VermeFree') return json(404, { erro: 'marca sem painel ligado: VermeFree' });
  const dados = { visao: VISAO, trafego: TRAFEGO, setores: SETORES, setor: SETOR[q.setor], kpis: KPIS, estoque: ESTOQUE, cupons: CUPONS, alertas: ALERTAS }[q.tela];
  if (!dados) return json(400, { erro: `tela desconhecida: ${q.tela}` });
  return json(200, { marca: 'Botanika', tela: q.tela, dados, em: '2026-09-09T17:05:00.000Z' });
});

await pag.addInitScript(() => {
  /* mensagens enviadas e gastos vêm da base da Central, por RPC — o painel
     junta ao realizado do mesmo recorte */
  window.__rpc = [];
  const rpc = async (fn, args) => {
    window.__rpc.push({ fn, args });
    if (fn !== 'central_envios') return { data: null, error: null };
    if (args.p_marca !== 'Botanika') return { data: {}, error: null };
    const dias = (new Date(args.p_ate) - new Date(args.p_de)) / 86400000 + 1;
    return { data: {
      'automacoes|email|disparos': 1000 * dias,
      'automacoes|whatsapp_api|disparos': 100 * dias,
      'automacoes|whatsapp_api|gastos': 25 * dias,
    }, error: null };
  };
  window.supabase = { createClient: () => ({
    auth:{getSession:async()=>({data:{session:{access_token:'jwt-de-teste',user:{id:'u1',email:'v@b.com'}}}}),signOut:async()=>({})},
    rpc,
    from:()=>({select:()=>({or:async()=>({data:[],error:null}),eq:()=>({maybeSingle:async()=>({data:null})})}),upsert:async()=>({error:null})}) }) };
});
await pag.route('**/supabase.js', (r) => r.fulfill({ status:200, body:'', contentType:'application/javascript' }));
await pag.goto(`http://127.0.0.1:${srv.address().port}/`, { waitUntil:'networkidle' });
await pag.waitForTimeout(1200);

const ok = [];
const conf = (n, v) => { assert.ok(v, n); ok.push(n) };
const texto = async (sel) => (await pag.locator(sel).innerText()).replace(/\s+/g, ' ');
const espera = async (sel, t = 4000) => pag.locator(sel).first().waitFor({ state: 'visible', timeout: t });

/* ---------- abrir ---------- */
conf('a barra lateral ganhou o botão do painel', await pag.locator('#painelNav').count() === 1);
await pag.locator('#painelNav').click();
await espera('#painelView .pn-tile');
conf('o painel abre e a home sai da frente',
  await pag.locator('#painelView').evaluate((e) => e.classList.contains('active')) &&
  await pag.locator('#homeView').evaluate((e) => e.style.display === 'none') &&
  await pag.locator('#painelNav').evaluate((e) => e.classList.contains('active')) &&
  !(await pag.locator('#homeNav').evaluate((e) => e.classList.contains('active'))));
conf('a URL guarda a tela', await pag.evaluate(() => location.hash) === '#painel');
conf('o cabeçalho tem as sete telas do painel e as cinco da equipe', await pag.locator('#painelView [data-tela]').count() === 12);
conf('e os seis atalhos de período', await pag.locator('#painelView [data-preset]').count() === 6);

const hojeSP = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const c0 = chamadas[0];
conf('a primeira chamada pede a visão da Botanika, do mês, com o token de quem está logado',
  c0.q.tela === 'visao' && c0.q.marca === 'Botanika' && c0.q.de === `${hojeSP.slice(0, 7)}-01` && c0.auth === 'Bearer jwt-de-teste');

/* ---------- visão geral ---------- */
const corpo = await texto('#painelCorpo');
conf('o faturamento do período aparece como dinheiro brasileiro', corpo.includes('R$ 148.029,77'));
conf('com a comparação com o mês passado', corpo.includes('15,6%') && corpo.includes('vs mês passado'));
conf('a meta do mês mostra a meta ativa e o ritmo', corpo.includes('R$ 480.000') && corpo.includes('no ritmo') && corpo.includes('faltam R$ 10.970'));
conf('o gráfico de faturamento por dia tem uma coluna por dia', await pag.locator('#painelCorpo .pn-grafico path').count() === 30);
conf('a origem das vendas lista o Orgânico primeiro', (await pag.locator('#painelCorpo .pn-barra-rotulo b').first().innerText()) === 'Orgânico');
conf('a tabela de produtos traz o Hair com margem', corpo.includes('Hair Botanika') && corpo.includes('67,0%'));
conf('produto sem custo mostra traço, não zero', (await pag.locator('#painelCorpo .pn-tabela tbody tr').nth(1).innerText()).includes('—'));
conf('texto do gráfico é tinta, não cor de série', await pag.locator('#painelCorpo .pn-eixo').first().evaluate((e) => getComputedStyle(e).fill !== 'rgb(51, 116, 214)'));

await pag.locator('#painelCorpo .pn-hit').nth(3).hover();
await pag.waitForTimeout(150);
conf('passar o mouse numa coluna mostra o dia e o valor',
  await pag.locator('#painelView .pn-tip').isVisible() && (await pag.locator('#painelView .pn-tip').innerText()).includes('04/09'));
await pag.screenshot({ path: 'teste/22-painel-visao.png', fullPage: true });

/* ---------- período ---------- */
await pag.locator('#painelView [data-preset="hoje"]').click(); await pag.waitForTimeout(400);
const cHoje = chamadas[chamadas.length - 1];
conf('"Hoje" pede só o dia de hoje, em São Paulo', cHoje.q.de === hojeSP && cHoje.q.ate === hojeSP);
await pag.locator('#painelView [data-preset="livre"]').click(); await pag.waitForTimeout(200);
conf('"Período" abre as duas datas', await pag.locator('#painelView .pn-datas').evaluate((e) => !e.classList.contains('oculto')));
await pag.locator('#painelView [data-de]').fill('2026-08-01'); await pag.locator('#painelView [data-ate]').fill('2026-08-15');
await pag.locator('#painelView [data-ate]').dispatchEvent('change'); await pag.waitForTimeout(400);
const cLivre = chamadas[chamadas.length - 1];
conf('e as datas escolhidas vão para a chamada', cLivre.q.de === '2026-08-01' && cLivre.q.ate === '2026-08-15');
await pag.locator('#painelView [data-preset="mes"]').click(); await pag.waitForTimeout(300);

/* ---------- tráfego ---------- */
await pag.locator('#painelView [data-tela="trafego"]').click(); await espera('#painelCorpo .pn-gerenciador');
const tr = await texto('#painelCorpo');
conf('tráfego calcula o ROAS real com o atribuído do Shopify', tr.includes('2,55x') && tr.includes('breakeven 1,46x'));
conf('e o CPA real', tr.includes('R$ 45,22'));
conf('os criativos aparecem com o ROAS colorido', await pag.locator('#painelCorpo .pn-tabela .pn-chip.ok').count() >= 1);
conf('o gerenciador começa com as campanhas fechadas', await pag.locator('#painelCorpo .pn-gerenciador tbody tr').count() === 2);
await pag.locator('#painelCorpo .pn-gerenciador tr.tem').first().click(); await pag.waitForTimeout(300);
conf('clicar numa campanha abre o conjunto', await pag.locator('#painelCorpo .pn-gerenciador tbody tr').count() === 3 &&
  (await pag.locator('#painelCorpo .pn-gerenciador tr.n1').innerText()).includes('CAMPEOES | ADV'));
await pag.locator('#painelCorpo .pn-gerenciador tr.n1').click(); await pag.waitForTimeout(300);
conf('e o conjunto abre o anúncio', await pag.locator('#painelCorpo .pn-gerenciador tr.n2').count() === 1);
conf('gasto e atribuído são dois gráficos, não dois eixos', await pag.locator('#painelCorpo .pn-grafico').count() === 2);
await pag.screenshot({ path: 'teste/23-painel-trafego.png', fullPage: true });

/* ---------- setores e metas ---------- */
await pag.locator('#painelView [data-tela="setores"]').click(); await espera('#painelCorpo .pn-metrica');
const se = await texto('#painelCorpo');
conf('setores mostra a meta de faturamento com as três metas', se.includes('Meta 1 · ativa') && se.includes('R$ 530.000'));
conf('cada setor vira um cartão com as suas métricas', await pag.locator('#painelCorpo .pn-setor').count() === 7);
conf('e o site entrou como setor, porque quem cuida do tráfego cuida dele',
  (await pag.locator('#painelCorpo').innerText()).includes('Sessão → checkout'));
conf('métrica de fluxo mostra o esperado até hoje', se.includes('esperado R$ 30.000'));
conf('métrica fora do ritmo fica marcada', await pag.locator('#painelCorpo .pn-metrica.critico').count() >= 2);
conf('a tabela semanal marca a semana atual', /S2 · 07\/09–13\/09 · agora/i.test(se));

/* ---------- cada setor no recorte que a pessoa escolheu ----------
   O mês é o compromisso; o período é o que a pessoa está olhando agora. */
const pedSet = chamadas.map((c) => c.q).filter((q) => q.tela === 'setores').pop();
conf('a tela de setores passa a pedir também o período escolhido',
  !!pedSet && !!pedSet.de && !!pedSet.ate && !!pedSet.ano && !!pedSet.mes);
conf('e a métrica mostra o valor do período ao lado do mês',
  await pag.locator('#painelCorpo .pn-metrica.com-periodo .pn-metrica-per').count() >= 3);
conf('com o número do recorte, não o do mês',
  (await pag.locator('#painelCorpo .pn-metrica.com-periodo', { hasText: 'Investimento' }).first().innerText()).includes('7.083'));
conf('métrica lançada à mão vem marcada como tal',
  (await pag.locator('#painelCorpo').innerText()).includes('lançado à mão'));

/* ---------- mensagens enviadas e gastos ----------
   Já chegavam à base da Central pelos fluxos do n8n e ninguém lia. Agora
   entram no realizado do mesmo recorte, e a conversão de cada canal deixa
   de depender de alguém digitar. */
const pedEnv = await pag.evaluate(() => (window.__rpc || []).filter((c) => c.fn === 'central_envios'));
conf('o painel busca os envios da marca, no mês e no período',
  pedEnv.length >= 2 && pedEnv.every((c) => c.args.p_marca === 'Botanika' && !!c.args.p_de && !!c.args.p_ate));
const autom = pag.locator('#painelCorpo .pn-setor', { hasText: 'Automações' });
const automTxt = (await autom.innerText()).replace(/\s+/g, ' ');
conf('as mensagens enviadas entram como número medido, não digitado',
  /E-mail · enviados/i.test(automTxt) && !/E-mail · enviados[^·]*lançado à mão/i.test(automTxt));
conf('e a conversão de cada canal passa a ser calculada',
  /E-mail · conversão/i.test(automTxt) && /API · conversão/i.test(automTxt));
conf('grupos segue lançado à mão, porque ainda não tem fonte',
  /Grupos · mensagens enviadas/i.test(automTxt) && /lançado à mão/i.test(automTxt));


await pag.locator('#painelCorpo [data-meta-edita="trafego||investimento"]').click(); await pag.waitForTimeout(250);
conf('clicar numa meta abre o campo com o valor atual', (await pag.locator('#painelCorpo [data-meta-form] input').inputValue()) === '100000');
await pag.locator('#painelCorpo [data-meta-form] input').fill('120000');
await pag.locator('#painelCorpo [data-meta-form] button[type=submit]').click(); await pag.waitForTimeout(600);
const g = gravacoes[0];
conf('salvar grava a meta mensal no painel de lá',
  g && g.corpo.acao === 'meta_kpi' && g.corpo.dados.escopo === 'trafego' && g.corpo.dados.metrica === 'investimento' && g.corpo.dados.meta_valor === 120000 &&
  g.corpo.dados.periodo === 'mensal' && g.corpo.dados.periodo_num === +hojeSP.slice(5, 7) && g.corpo.marca === 'Botanika' && g.auth === 'Bearer jwt-de-teste');
conf('e a tela recarrega com a meta nova', (await texto('#painelCorpo')).includes('R$ 120.000'));

await pag.locator('#painelCorpo [data-meta-edita="__geral"]').first().click(); await pag.waitForTimeout(250);
await pag.locator('#painelCorpo [data-meta-geral] [name=meta1]').fill('500000');
await pag.locator('#painelCorpo [data-meta-geral] [name=meta_ativa]').selectOption('2');
await pag.locator('#painelCorpo [data-meta-geral] button[type=submit]').click(); await pag.waitForTimeout(600);
const g2 = gravacoes[1];
conf('as metas de faturamento gravam as três e a ativa', g2 && g2.corpo.acao === 'meta_mensal' && g2.corpo.dados.meta1 === 500000 && g2.corpo.dados.meta_ativa === 2);
/* ---------- lançar o número que não tem fonte ----------
   O banco já aceitava guardar valor de setor; nenhuma tela pedia. Por isso
   atendimento passou meses sem um número sequer. */
const atend = pag.locator('#painelCorpo .pn-setor', { hasText: 'Atendimento' });
conf('métrica sem fonte automática oferece lançar o número',
  await atend.locator('[data-valor-edita]').count() >= 3);
await atend.locator('[data-valor-edita="atendimento||csat"]').click(); await pag.waitForTimeout(300);
conf('e abre com o campo e onde lançar', await pag.locator('[data-valor-form] select[name=periodo]').count() === 1);
await pag.locator('[data-valor-form] input[name=valor]').fill('92');
await pag.locator('[data-valor-form] button[type=submit]').click(); await pag.waitForTimeout(700);
const gv = gravacoes[gravacoes.length - 1];
conf('salvar grava o valor do setor no painel de lá',
  gv && gv.corpo.acao === 'valor_setor' && gv.corpo.dados.escopo === 'atendimento' &&
  gv.corpo.dados.metrica === 'csat' && gv.corpo.dados.valor === 92 && gv.corpo.dados.periodo === 'mensal');
conf('e o número lançado passa a aparecer no cartão',
  (await atend.innerText()).includes('92'));

await atend.locator('[data-valor-edita="atendimento||volume"]').click(); await pag.waitForTimeout(300);
await pag.locator('[data-valor-form] select[name=periodo]').selectOption('semanal');
await pag.locator('[data-valor-form] input[name=valor]').fill('310');
await pag.locator('[data-valor-form] button[type=submit]').click(); await pag.waitForTimeout(700);
const gs = gravacoes[gravacoes.length - 1];
conf('dá para lançar na semana, com o número que o banco usa (AAAAMMDD da segunda)',
  gs && gs.corpo.dados.periodo === 'semanal' && /^\d{8}$/.test(String(gs.corpo.dados.periodo_num)));

await pag.screenshot({ path: 'teste/24-painel-setores.png', fullPage: true });

await pag.locator('#painelCorpo [data-setor="influenciadores"]').click();
/* esperar por uma tabela qualquer não serve: a tela anterior também tem
   tabela, e a checagem corria antes do desenho novo */
await pag.locator('#painelCorpo .pn-card', { hasText: 'Ranking' }).first().waitFor({ state: 'visible', timeout: 5000 });
const inf = await texto('#painelCorpo');
conf('o setor de influenciadores traz o ranking', inf.includes('Victoria') && inf.includes('R$ 20.766') && inf.includes('subindo'));
conf('e os cupons da marca ficam fora do ranking', inf.includes('Outros cupons') && inf.includes('Botanika (marca)'));
await pag.locator('#painelCorpo [data-setor="automacoes"]').click(); await espera('#painelCorpo .pn-canal');
conf('automações mostra um cartão por canal, com a faísca das semanas',
  await pag.locator('#painelCorpo .pn-canal').count() === 3 && await pag.locator('#painelCorpo .pn-faisca').count() === 3 && (await texto('#painelCorpo')).includes('WhatsApp API'));
await pag.locator('#painelCorpo [data-setor="social_media"]').click(); await espera('#painelCorpo .pn-post');
conf('social media traz seguidores, split e posts', (await texto('#painelCorpo')).includes('@botanikabrasil') && await pag.locator('#painelCorpo .pn-post').count() === 1);
await pag.screenshot({ path: 'teste/25-painel-social.png', fullPage: true });

/* ---------- kpis, estoque, cupons ---------- */
await pag.locator('#painelView [data-tela="kpis"]').click(); await espera('#painelCorpo .pn-tile');
const kp = await texto('#painelCorpo');
conf('KPIs compara a janela com a anterior', kp.includes('R$ 59.780,22') && kp.includes('vs 04/09'));
conf('produto com estoque em risco fica marcado', kp.includes('estoque em risco'));
await pag.locator('#painelView [data-tela="estoque"]').click(); await espera('#painelCorpo .pn-tabela');
const es = await texto('#painelCorpo');
conf('estoque mostra o produto em alerta com cobertura e reposição', es.includes('8,4 d') && es.includes('1.137') && es.includes('17/09/2026'));
conf('e o capital parado', es.includes('R$ 491.944'));
conf('estoque não mostra atalhos de período', await pag.locator('#painelView [data-preset]').count() === 0);
await pag.screenshot({ path: 'teste/26-painel-estoque.png', fullPage: true });
await pag.locator('#painelView [data-tela="cupons"]').click(); await espera('#painelCorpo .pn-tabela');
conf('cupons lista as vendas por cupom com a fatia', (await texto('#painelCorpo')).includes('VICTORIA') && (await texto('#painelCorpo')).includes('26,0%'));

/* ---------- alertas ---------- */
await pag.locator('#painelView [data-tela="alertas"]').click(); await espera('#painelCorpo .pn-alerta');
conf('alertas separa crítico de atenção', await pag.locator('#painelCorpo .pn-alerta.critico').count() === 3 && await pag.locator('#painelCorpo .pn-alerta.atencao').count() === 2);
await pag.screenshot({ path: 'teste/27-painel-alertas.png', fullPage: true });
await pag.locator('#painelCorpo .pn-alerta').first().click(); await espera('#painelCorpo .pn-canal');
conf('clicar num alerta de meta leva ao setor dele', await pag.locator('#painelView [data-tela="setores"]').evaluate((e) => e.classList.contains('active')) &&
  await pag.locator('#painelCorpo [data-setor="automacoes"]').evaluate((e) => e.classList.contains('ativo')));

/* ---------- marca sem painel ---------- */
await pag.locator('#brandSelect').selectOption('VermeFree'); await pag.waitForTimeout(500);
const vf = chamadas[chamadas.length - 1];
conf('trocar a marca na barra troca a marca da chamada', vf.q.marca === 'VermeFree');
conf('marca sem painel ligado diz isso, em vez de quebrar', (await texto('#painelCorpo')).includes('ainda não tem painel ligado'));
await pag.locator('#brandSelect').selectOption('Botanika'); await pag.waitForTimeout(500);
conf('e volta quando a marca volta', await pag.locator('#painelCorpo .pn-metrica').count() > 0);

/* ---------- convivência com o app ---------- */
await pag.locator('#tasksNav').click(); await pag.waitForTimeout(300);
conf('abrir Tarefas esconde o painel', !(await pag.locator('#painelView').evaluate((e) => e.classList.contains('active'))) &&
  !(await pag.locator('#painelNav').evaluate((e) => e.classList.contains('active'))));
await pag.locator('#painelNav').click(); await pag.waitForTimeout(300);
conf('e o painel volta na tela em que estava', await pag.locator('#painelView').evaluate((e) => e.classList.contains('active')) &&
  await pag.locator('#painelView [data-tela="setores"]').evaluate((e) => e.classList.contains('active')));
await pag.evaluate(() => window.__centralShowHome?.()); await pag.waitForTimeout(200);
conf('quando o app abre a home por conta própria, o painel sai', !(await pag.locator('#painelView').evaluate((e) => e.classList.contains('active'))));

await pag.goto(`http://127.0.0.1:${srv.address().port}/#painel`, { waitUntil: 'networkidle' }); await pag.waitForTimeout(1200);
conf('abrir o link com #painel já cai no painel', await pag.locator('#painelView').evaluate((e) => e.classList.contains('active')));

console.log(ok.map(s => '  ✓ ' + s).join('\n'));
console.log(`\npainel: ${ok.length} checagens passaram`);
await nav.close(); srv.close();
