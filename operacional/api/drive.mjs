/* ======================================================================
   Os arquivos de cada marca.

   O Drive da Botanika para a Botanika, o da VermeFree para a VermeFree.
   Trocar de marca na barra de cima troca a pasta que se enxerga.

   Por que conta de serviço, e não "entrar com o Google":
   ler o Drive de alguém é um escopo restrito lá — o mais fechado que
   existe. Um aplicativo não verificado não passa, e a verificação de
   escopo restrito pede avaliação de segurança, que leva semanas e custa.
   Com conta de serviço não existe tela de consentimento: a pasta é
   compartilhada com um e-mail de robô, como se compartilha com uma
   pessoa, e o robô só enxerga o que foi compartilhado com ele. Nenhuma
   pessoa da equipe precisa autorizar nada, e ninguém reconecta toda
   semana.

   A chave da conta de serviço mora numa variável de ambiente da Vercel e
   nunca desce para o navegador. O id da pasta, sim — ele não é segredo,
   o acesso é.

   O que esta função entrega: listar a pasta da marca, andar para dentro
   das subpastas e procurar por nome. Só leitura.
   ====================================================================== */

import { createSign } from 'node:crypto';

const CENTRAL_URL = process.env.SUPABASE_URL || 'https://sjkuysdmixfzeerxuudn.supabase.co';
const CENTRAL_ANON = process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqa3V5c2RtaXhmemVlcnh1dWRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMTMxNDQsImV4cCI6MjA5NjY4OTE0NH0.oMbvy25V6-W7YvF70zNb1xVfRwH_tGBWp3NPHGtpOtM';

const PASTA = 'application/vnd.google-apps.folder';
const CAMPOS = 'id,name,mimeType,iconLink,webViewLink,thumbnailLink,modifiedTime,size,owners(displayName)';

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

/* a pasta daquela marca, lida como o usuário — o RLS decide */
async function pastaDaMarca(nome, bearer) {
  const r = await fetch(
    `${CENTRAL_URL}/rest/v1/painel_marcas?marca=eq.${encodeURIComponent(nome)}&select=marca,drive_pasta,ativo`,
    { headers: { apikey: CENTRAL_ANON, Authorization: `Bearer ${bearer}` } });
  if (!r.ok) return null;
  const linhas = await r.json();
  const m = Array.isArray(linhas) && linhas[0];
  return m && m.ativo ? m : null;
}

/* ---------- a conta de serviço ---------- */
function conta() {
  const cru = process.env.GOOGLE_DRIVE_SA || '';
  if (!cru.trim()) return null;
  /* aceita o JSON direto ou em base64, porque colar JSON com quebras de
     linha no painel da Vercel é onde isso costuma quebrar */
  const texto = cru.trim().startsWith('{') ? cru : Buffer.from(cru, 'base64').toString('utf8');
  const sa = JSON.parse(texto);
  if (!sa.client_email || !sa.private_key) throw new Error('a chave da conta de serviço está incompleta');
  return sa;
}

const b64u = (t) => Buffer.from(t).toString('base64url');

/* O token do Google vale uma hora; guardar o que já foi pedido evita uma
   ida a mais em toda listagem. Vive só enquanto a função estiver quente,
   e é isso mesmo — não é lugar de guardar credencial. */
let guardado = { token: null, ate: 0 };

async function token() {
  if (guardado.token && Date.now() < guardado.ate - 60000) return guardado.token;
  const sa = conta();
  if (!sa) throw Object.assign(new Error('sem conta de serviço configurada'), { faltaChave: true });

  const agora = Math.floor(Date.now() / 1000);
  const cabeca = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const corpo = b64u(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    aud: sa.token_uri || 'https://oauth2.googleapis.com/token',
    iat: agora, exp: agora + 3600,
  }));
  const assina = createSign('RSA-SHA256');
  assina.update(`${cabeca}.${corpo}`);
  const jwt = `${cabeca}.${corpo}.${assina.sign(sa.private_key).toString('base64url')}`;

  const r = await fetch(sa.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  const corpoR = await r.json().catch(() => ({}));
  if (!r.ok || !corpoR.access_token) {
    throw new Error(corpoR.error_description || corpoR.error || `o Google recusou a chave (HTTP ${r.status})`);
  }
  guardado = { token: corpoR.access_token, ate: Date.now() + (corpoR.expires_in || 3600) * 1000 };
  return guardado.token;
}

async function drive(caminho, params) {
  const t = await token();
  const url = new URL(`https://www.googleapis.com/drive/v3/${caminho}`);
  for (const [k, v] of Object.entries(params || {})) if (v != null) url.searchParams.set(k, v);
  /* as duas de sempre: sem elas, pasta que mora num drive compartilhado
     simplesmente não aparece, e ninguém descobre por quê */
  url.searchParams.set('supportsAllDrives', 'true');
  const r = await fetch(url, { headers: { Authorization: `Bearer ${t}` } });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (corpo.error && corpo.error.message) || `HTTP ${r.status}`;
    throw Object.assign(new Error(msg), { status: r.status });
  }
  return corpo;
}

/* ---------- a pasta pedida é mesmo desta marca? ----------
   Sem esta conferência bastaria passar o id da pasta da outra marca para
   ler a outra marca: o robô enxerga as duas. Sobe de pai em pai até
   achar a raiz da marca. */
async function dentroDe(pastaId, raiz) {
  if (!pastaId || pastaId === raiz) return true;
  let atual = pastaId;
  for (let i = 0; i < 12; i++) {
    const f = await drive(`files/${encodeURIComponent(atual)}`, { fields: 'id,parents' });
    const pais = f.parents || [];
    if (!pais.length) return false;
    if (pais.includes(raiz)) return true;
    atual = pais[0];
  }
  return false;
}

const aspas = (t) => String(t).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    const q = Object.fromEntries(url.searchParams);
    const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim() || null;

    const u = await usuario(bearer);
    if (!u) return responder(res, 401, { erro: 'entre na Central para ver os arquivos' });

    const marca = await pastaDaMarca(q.marca || 'Botanika', bearer);
    if (!marca) return responder(res, 404, { erro: `marca sem ficha na Central: ${q.marca || ''}` });
    if (!marca.drive_pasta) {
      return responder(res, 200, {
        ligado: false, marca: marca.marca,
        erro: `A ${marca.marca} ainda não tem pasta do Drive ligada.`,
      });
    }

    const raiz = marca.drive_pasta;
    const pasta = q.pasta && q.pasta !== raiz ? q.pasta : raiz;

    if (pasta !== raiz && !(await dentroDe(pasta, raiz))) {
      return responder(res, 403, { erro: 'essa pasta não é desta marca' });
    }

    const busca = String(q.q || '').trim().slice(0, 80);
    /* Procurar vale a pasta inteira, e não só o nível aberto: quem procura
       não sabe em que subpasta o arquivo está — era por isso que ia ao
       Drive em vez de procurar aqui. */
    const filtro = busca
      ? `name contains '${aspas(busca)}' and trashed = false`
      : `'${aspas(pasta)}' in parents and trashed = false`;

    const lista = await drive('files', {
      q: filtro,
      fields: `nextPageToken, files(${CAMPOS})`,
      orderBy: 'folder,name_natural',
      pageSize: '100',
      includeItemsFromAllDrives: 'true',
      corpora: 'allDrives',
      pageToken: q.pagina || null,
    });

    /* o caminho de volta, para a tela desenhar a trilha */
    const trilha = [];
    if (pasta !== raiz) {
      let atual = pasta;
      for (let i = 0; i < 12; i++) {
        const f = await drive(`files/${encodeURIComponent(atual)}`, { fields: 'id,name,parents' });
        trilha.unshift({ id: f.id, nome: f.name });
        if (f.id === raiz || !(f.parents || []).length || (f.parents || []).includes(raiz)) break;
        atual = f.parents[0];
      }
    }

    const arquivos = (lista.files || []).map((f) => ({
      id: f.id,
      nome: f.name,
      tipo: f.mimeType,
      pasta: f.mimeType === PASTA,
      link: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
      icone: f.iconLink || '',
      miniatura: f.thumbnailLink || '',
      em: f.modifiedTime || '',
      tamanho: f.size ? +f.size : null,
      dono: (f.owners && f.owners[0] && f.owners[0].displayName) || '',
    }));

    return responder(res, 200, {
      ligado: true, marca: marca.marca, raiz, pasta, trilha, arquivos,
      proxima: lista.nextPageToken || null,
      busca: busca || null,
    });
  } catch (e) {
    if (e.faltaChave) {
      return responder(res, 200, {
        ligado: false, semChave: true,
        erro: 'A Central ainda não tem a chave da conta de serviço do Google.',
      });
    }
    console.error('[drive]', e);
    const msg = String(e.message || e).slice(0, 240);
    /* o robô não foi convidado para a pasta: é o erro mais provável de
       todos na primeira vez, e merece dizer o que fazer */
    if (/File not found|notFound|insufficient/i.test(msg)) {
      return responder(res, 200, {
        ligado: false, semAcesso: true,
        erro: 'O Drive respondeu que não encontra a pasta. Quase sempre é a pasta não ter sido compartilhada com o e-mail da conta de serviço.',
      });
    }
    return responder(res, 502, { erro: msg });
  }
}

export { conta, dentroDe };
