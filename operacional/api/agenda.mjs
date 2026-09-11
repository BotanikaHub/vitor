/* ======================================================================
   A agenda de quem está logado.

   O navegador nunca vê o endereço do calendário. Ele manda uma vez, na
   hora de ligar; daí em diante pede "me dê a agenda" e recebe só os
   compromissos. O endereço fica na tabela `agenda_fonte`, cada linha
   visível apenas para o dono, e quem o usa é esta função.

   Por que importa: o endereço secreto do iCal é uma credencial de
   leitura vitalícia. Se ele estivesse no localStorage, uma extensão
   qualquer do navegador leria a agenda inteira de quem instalou.

   Três motivos para o arquivo ser lido aqui e não lá:
     1. o segredo não desce;
     2. o navegador não consegue — o Google não libera CORS no iCal;
     3. a leitura é cara e o resultado é guardado, então oito pessoas
        abrindo a Central não viram oito downloads por minuto.
   ====================================================================== */

import { ler } from './lib/ical.mjs';

const CENTRAL_URL = process.env.SUPABASE_URL || 'https://sjkuysdmixfzeerxuudn.supabase.co';
const CENTRAL_ANON = process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqa3V5c2RtaXhmemVlcnh1dWRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMTMxNDQsImV4cCI6MjA5NjY4OTE0NH0.oMbvy25V6-W7YvF70zNb1xVfRwH_tGBWp3NPHGtpOtM';

const VALIDADE = 10 * 60 * 1000;      /* relê o calendário a cada dez minutos */
const TETO = 6 * 1024 * 1024;         /* um .ics maior que isto é outra coisa */
const DIAS_ANTES = 7;
const DIAS_DEPOIS = 45;

function responder(res, status, corpo) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(status).send(JSON.stringify(corpo));
}

async function usuario(bearer) {
  if (!bearer) return null;
  const r = await fetch(`${CENTRAL_URL}/auth/v1/user`, {
    headers: { apikey: CENTRAL_ANON, Authorization: `Bearer ${bearer}` },
  });
  if (!r.ok) return null;
  const u = await r.json();
  return u && u.id ? u : null;
}

const cabecalhos = (bearer) => ({
  apikey: CENTRAL_ANON, Authorization: `Bearer ${bearer}`,
  'Content-Type': 'application/json',
});

async function fonte(bearer) {
  const r = await fetch(`${CENTRAL_URL}/rest/v1/agenda_fonte?select=*`, { headers: cabecalhos(bearer) });
  if (!r.ok) return null;
  const linhas = await r.json();
  return Array.isArray(linhas) && linhas[0] ? linhas[0] : null;
}

async function gravar(bearer, dono, campos) {
  await fetch(`${CENTRAL_URL}/rest/v1/agenda_fonte?on_conflict=dono`, {
    method: 'POST',
    headers: { ...cabecalhos(bearer), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ dono, ...campos }),
  });
}

/* ---------- o endereço que aceitamos ----------
   Só https, e só de onde um calendário mora. Sem esta porta fechada,
   qualquer um usaria esta função como buscador de páginas internas — o
   servidor tem rede que o navegador não tem, e é assim que uma função
   inocente vira um jeito de ler o que está atrás do firewall. */
const CASAS = [
  /^calendar\.google\.com$/i,
  /^outlook\.(office365|office|live)\.com$/i,
  /(^|\.)icloud\.com$/i,
  /(^|\.)notion\.so$/i,
];

function endereco(cru) {
  let u;
  try { u = new URL(String(cru || '').trim().replace(/^webcal:\/\//i, 'https://')) } catch { return null }
  if (u.protocol !== 'https:') return null;
  if (!CASAS.some((re) => re.test(u.hostname))) return null;
  return u.toString();
}

const casaDe = (url) => { try { return new URL(url).hostname } catch { return '' } };

async function buscar(url) {
  const corta = AbortSignal.timeout ? AbortSignal.timeout(12000) : undefined;
  const r = await fetch(url, { signal: corta, redirect: 'follow', headers: { Accept: 'text/calendar' } });
  if (!r.ok) throw new Error(`o calendário respondeu ${r.status}`);
  const texto = await r.text();
  if (texto.length > TETO) throw new Error('o calendário é grande demais');
  if (!/BEGIN:VCALENDAR/i.test(texto)) throw new Error('esse endereço não devolve um calendário');
  return texto;
}

function janela() {
  const agora = Date.now();
  return { de: agora - DIAS_ANTES * 86400000, ate: agora + DIAS_DEPOIS * 86400000 };
}

export default async function handler(req, res) {
  try {
    const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim() || null;
    const u = await usuario(bearer);
    if (!u) return responder(res, 401, { erro: 'entre na Central para ver a sua agenda' });

    const corpo = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    /* ---- desligar ---- */
    if (req.method === 'DELETE' || (req.method === 'POST' && corpo.acao === 'desligar')) {
      await fetch(`${CENTRAL_URL}/rest/v1/agenda_fonte?dono=eq.${u.id}`, {
        method: 'DELETE', headers: cabecalhos(bearer),
      });
      return responder(res, 200, { ligado: false });
    }

    /* ---- ligar ---- */
    if (req.method === 'POST') {
      const url = endereco(corpo.url);
      if (!url) {
        return responder(res, 400, {
          erro: 'Esse endereço não serve. Precisa ser o endereço secreto em formato iCal, começando com https, do Google Agenda, do Outlook, do iCloud ou do Notion.',
        });
      }
      let eventos;
      try { eventos = ler(await buscar(url), janela()) } catch (e) {
        return responder(res, 400, { erro: String(e.message || e).slice(0, 200) });
      }
      await gravar(bearer, u.id, {
        url, apelido: String(corpo.apelido || '').slice(0, 60) || null,
        eventos, lido_em: new Date().toISOString(), erro: null,
      });
      return responder(res, 200, { ligado: true, casa: casaDe(url), eventos, lido_em: new Date().toISOString() });
    }

    /* ---- ler ---- */
    const f = await fonte(bearer);
    if (!f) return responder(res, 200, { ligado: false, eventos: [] });

    const velho = !f.lido_em || (Date.now() - Date.parse(f.lido_em)) > VALIDADE;
    const forcar = new URL(req.url, 'http://x').searchParams.get('forcar') === '1';

    if (velho || forcar) {
      try {
        const eventos = ler(await buscar(f.url), janela());
        const lido = new Date().toISOString();
        await gravar(bearer, u.id, { url: f.url, eventos, lido_em: lido, erro: null });
        return responder(res, 200, { ligado: true, casa: casaDe(f.url), apelido: f.apelido, eventos, lido_em: lido });
      } catch (e) {
        /* a leitura falhou: devolve o que já tinha, dizendo que está velho.
           Uma agenda de ontem serve; uma tela em branco não serve. */
        const msg = String(e.message || e).slice(0, 200);
        await gravar(bearer, u.id, { url: f.url, erro: msg });
        return responder(res, 200, {
          ligado: true, casa: casaDe(f.url), apelido: f.apelido,
          eventos: f.eventos || [], lido_em: f.lido_em, erro: msg,
        });
      }
    }

    return responder(res, 200, {
      ligado: true, casa: casaDe(f.url), apelido: f.apelido,
      eventos: f.eventos || [], lido_em: f.lido_em, erro: f.erro || null,
    });
  } catch (e) {
    console.error('[agenda]', e);
    return responder(res, 502, { erro: String(e.message || e).slice(0, 200) });
  }
}

export { endereco, janela };
