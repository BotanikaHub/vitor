/* ======================================================================
   A ponte entre a Central e o painel de cada marca.

   O painel (Botanika Analytics, VermeFree Analytics) mora em outro
   projeto Supabase, do Lovable, fechado para tudo que não é chave de
   serviço — e a chave de serviço dele não pode morar aqui. Então a
   entrada é outra: funções SQL de lá (central_visao, central_trafego,
   ...) que devolvem cada tela já calculada e só respondem a um token.

   Esta função faz três coisas, nesta ordem:
     1. confirma que quem chama está logado na Central (o JWT do
        Supabase da Central, no cabeçalho Authorization);
     2. lê, como esse usuário, a linha da marca em painel_marcas — a URL,
        a chave publicável e o token do painel;
     3. chama a função de lá com o token, e devolve o JSON.

   O token nunca vai ao navegador: ele sai do banco da Central, passa
   por aqui e entra no banco do painel. Não há variável de ambiente com
   segredo — o que é público (URL da Central, chave anônima) está no
   código, como já está no index.html.
   ====================================================================== */

const CENTRAL_URL = process.env.SUPABASE_URL || 'https://sjkuysdmixfzeerxuudn.supabase.co';
const CENTRAL_ANON = process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqa3V5c2RtaXhmemVlcnh1dWRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMTMxNDQsImV4cCI6MjA5NjY4OTE0NH0.oMbvy25V6-W7YvF70zNb1xVfRwH_tGBWp3NPHGtpOtM';

/* As telas que a Central pede e a função de lá que responde cada uma.
   `args` diz quais parâmetros da URL viram argumentos, e em que ordem. */
const TELAS = {
  saude:    { fn: 'central_saude',    args: [] },
  visao:    { fn: 'central_visao',    args: ['de', 'ate'] },
  trafego:  { fn: 'central_trafego',  args: ['de', 'ate'] },
  setores:  { fn: 'central_setores',  args: ['ano', 'mes'] },
  setor:    { fn: 'central_setor',    args: ['setor', 'de', 'ate'] },
  estoque:  { fn: 'central_estoque',  args: [] },
  cupons:   { fn: 'central_cupons',   args: ['de', 'ate'] },
  alertas:  { fn: 'central_alertas',  args: [] },
  kpis:     { fn: 'central_kpis',     args: ['de', 'ate'] },
};
const NOMES = { de: 'p_de', ate: 'p_ate', ano: 'p_ano', mes: 'p_mes', setor: 'p_setor' };

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const SETORES = new Set(['geral', 'trafego', 'influenciadores', 'social_media', 'automacoes', 'atendimento']);

function responder(res, status, corpo) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(status).send(JSON.stringify(corpo));
}

/* quem está chamando, segundo o Supabase da Central */
async function usuario(bearer) {
  if (!bearer) return null;
  const r = await fetch(`${CENTRAL_URL}/auth/v1/user`, {
    headers: { apikey: CENTRAL_ANON, Authorization: `Bearer ${bearer}` },
  });
  if (!r.ok) return null;
  const u = await r.json();
  return u && u.id ? u : null;
}

/* a linha da marca, lida como o usuário (RLS decide) ou pela vista pública */
async function marca(nome, bearer) {
  const tabela = bearer ? 'painel_marcas' : 'painel_marcas_publico';
  const campos = bearer ? 'marca,url,chave_publica,token,ativo' : 'marca,url,chave_publica,ativo';
  const r = await fetch(`${CENTRAL_URL}/rest/v1/${tabela}?marca=eq.${encodeURIComponent(nome)}&select=${campos}`, {
    headers: { apikey: CENTRAL_ANON, Authorization: `Bearer ${bearer || CENTRAL_ANON}` },
  });
  if (!r.ok) return null;
  const linhas = await r.json();
  return Array.isArray(linhas) && linhas[0] && linhas[0].ativo ? linhas[0] : null;
}

/* a função de lá */
async function painel(m, fn, args) {
  const r = await fetch(`${m.url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: m.chave_publica,
      Authorization: `Bearer ${m.chave_publica}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_token: m.token || '', ...args }),
  });
  const texto = await r.text();
  let corpo;
  try { corpo = JSON.parse(texto) } catch { corpo = { erro: texto.slice(0, 300) } }
  if (!r.ok) {
    /* nunca repassar o corpo cru: pode citar o token nos parâmetros */
    const msg = (corpo && (corpo.message || corpo.erro)) || `HTTP ${r.status}`;
    throw Object.assign(new Error(String(msg).replace(/[0-9a-f]{64}/g, '***')), { status: r.status });
  }
  return corpo;
}

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    const q = Object.fromEntries(url.searchParams);
    const nomeMarca = q.marca || (req.body && req.body.marca) || 'Botanika';
    const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim() || null;

    /* ---- saúde: sem login, sem token, só "o painel de lá responde?" ---- */
    if (q.tela === 'saude' && !bearer) {
      const m = await marca(nomeMarca, null);
      if (!m) return responder(res, 404, { ok: false, erro: `marca sem painel ligado: ${nomeMarca}` });
      const r = await painel({ ...m, token: '' }, 'central_saude', {}).catch((e) => ({ ok: false, erro: e.message }));
      return responder(res, 200, { ok: true, marca: m.marca, painel_responde: !!r, resposta: r });
    }

    const u = await usuario(bearer);
    if (!u) return responder(res, 401, { erro: 'entre na Central para ver o painel' });

    const m = await marca(nomeMarca, bearer);
    if (!m) return responder(res, 404, { erro: `marca sem painel ligado: ${nomeMarca}` });
    if (!m.token) return responder(res, 503, { erro: `o painel da ${m.marca} está sem token na Central` });

    /* ---- gravar ---- */
    if (req.method === 'POST') {
      const corpo = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      if (!corpo.acao) return responder(res, 400, { erro: 'falta a ação' });
      const r = await painel(m, 'central_gravar', { p_acao: String(corpo.acao), p_dados: corpo.dados || {} });
      return responder(res, 200, r);
    }

    /* ---- ler ---- */
    const tela = TELAS[q.tela];
    if (!tela) return responder(res, 400, { erro: `tela desconhecida: ${q.tela || ''}` });
    const args = {};
    for (const a of tela.args) {
      const v = q[a];
      if (v == null || v === '') return responder(res, 400, { erro: `falta ${a}` });
      if ((a === 'de' || a === 'ate') && !DATA.test(v)) return responder(res, 400, { erro: `${a} inválida` });
      if (a === 'setor' && !SETORES.has(v)) return responder(res, 400, { erro: 'setor inválido' });
      if (a === 'ano' || a === 'mes') { if (!/^\d+$/.test(v)) return responder(res, 400, { erro: `${a} inválido` }) }
      args[NOMES[a]] = (a === 'ano' || a === 'mes') ? Number(v) : v;
    }
    const r = await painel(m, tela.fn, args);
    return responder(res, 200, { marca: m.marca, tela: q.tela, dados: r, em: new Date().toISOString() });
  } catch (e) {
    console.error('[painel]', e);
    return responder(res, e.status === 401 ? 502 : 502, { erro: String(e.message || e).slice(0, 300) });
  }
}
