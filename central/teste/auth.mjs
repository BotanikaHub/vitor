/* Percorre as telas de entrada da Central num Chromium headless.
   O Supabase é simulado — a suíte nunca fala com o banco de verdade —
   e o que se testa é o que a pessoa vê e o que a tela manda. */
import { chromium } from 'playwright-core';

const B = process.env.BASE || 'http://localhost:3000';
let ok_ = 0, mau = 0;
const ok = (n, c, x = '') => { c ? ok_++ : mau++; console.log((c ? 'OK  | ' : 'FALHA | ') + n + (x ? ' | ' + x : '')); };

const b = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});

/* O que o Supabase Auth responderia. */
function supabaseFalso(op = {}) {
  const reg = { cadastros: [], logins: [] };
  return { reg, rota: async (r) => {
    const req = r.request(), u = req.url();
    const corpo = () => { try { return JSON.parse(req.postData() || '{}'); } catch { return {}; } };
    if (/\/auth\/v1\/signup/.test(u)) {
      reg.cadastros.push(corpo());
      if (op.emailRepetido) return r.fulfill({ status: 422, contentType: 'application/json',
        body: JSON.stringify({ msg: 'User already registered', error_code: 'user_already_exists' }) });
      return r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ user: { id: 'u1', email: corpo().email }, session: null }) });
    }
    if (/\/auth\/v1\/token/.test(u)) {
      reg.logins.push(corpo());
      if (op.senhaErrada) return r.fulfill({ status: 400, contentType: 'application/json',
        body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }) });
      return r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_in: 3600,
          token_type: 'bearer', user: { id: 'u1', email: 'x@y.z' } }) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  }};
}

async function abrir(caminho, op = {}) {
  const { reg, rota } = supabaseFalso(op);
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const erros = []; p.on('pageerror', (e) => erros.push(e.message));
  await p.route('**/*.supabase.co/**', rota);
  await p.goto(B + caminho, { waitUntil: 'networkidle' });
  return { p, reg, erros };
}
const texto = (p) => p.innerText('body');

// ---- 1. sem sessão, a guarda manda para o login ----
{
  const p = await b.newPage();
  const resp = await p.goto(B + '/', { waitUntil: 'domcontentloaded' });
  ok('sem sessão, a raiz leva ao login', p.url().includes('/entrar'), p.url());
  ok('e guarda de onde a pessoa veio', p.url().includes('de=%2F'), p.url());
  ok('a resposta é 200 depois do desvio', resp.status() === 200, String(resp.status()));
  await p.close();
}

// ---- 2. cadastro ----
{
  const { p, reg, erros } = await abrir('/cadastro');
  ok('a tela de criar conta abre', /Criar conta/.test(await texto(p)));
  await p.fill('#nome', 'Fulana de Teste');
  await p.fill('#email', 'fulana@exemplo.test');
  await p.fill('#senha', 'curta');
  await p.click('button[type=submit]');
  await p.waitForTimeout(200);
  ok('senha curta não vai para o servidor', reg.cadastros.length === 0);
  ok('e diz o porquê', /pelo menos 8 caracteres/i.test(await texto(p)));
  await p.fill('#senha', 'senha-de-teste-123');
  await p.click('button[type=submit]');
  await p.waitForTimeout(400);
  ok('manda o nome junto, para o perfil nascer com ele',
     reg.cadastros[0]?.data?.nome === 'Fulana de Teste', JSON.stringify(reg.cadastros[0]?.data));
  const t = await texto(p);
  ok('avisa que a conta foi criada', /Conta criada/.test(t));
  ok('e que o acesso ainda precisa ser liberado', /liberado por um administrador/i.test(t));
  ok('sem erro de JS', erros.length === 0, erros.join(' | '));
  await p.close();
}

// ---- 3. e-mail já cadastrado ----
{
  const { p, erros } = await abrir('/cadastro', { emailRepetido: true });
  await p.fill('#nome', 'Fulana'); await p.fill('#email', 'ja@existe.test');
  await p.fill('#senha', 'senha-de-teste-123');
  await p.click('button[type=submit]');
  await p.waitForTimeout(400);
  ok('e-mail repetido explica em português', /já tem conta/i.test(await texto(p)),
     (await texto(p)).slice(0, 90).replace(/\n/g, ' · '));
  ok('sem erro de JS', erros.length === 0, erros.join(' | '));
  await p.close();
}

// ---- 4. login com senha errada ----
{
  const { p, reg, erros } = await abrir('/entrar', { senhaErrada: true });
  await p.fill('#email', 'x@y.z'); await p.fill('#senha', 'errada');
  await p.click('button[type=submit]');
  await p.waitForTimeout(400);
  ok('mandou o login', reg.logins.length === 1);
  ok('senha errada não fala em "credentials"',
     /não conferem/i.test(await texto(p)) && !/credential/i.test(await texto(p)),
     (await texto(p)).slice(0, 90).replace(/\n/g, ' · '));
  ok('sem erro de JS', erros.length === 0, erros.join(' | '));
  await p.close();
}

// ---- 5. o visual é o combinado: branco, sem tema escuro ----
{
  const { p, erros } = await abrir('/entrar');
  const fundo = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  ok('a plataforma é branca', fundo === 'rgb(250, 250, 250)', fundo);
  const escuro = await b.newContext({ colorScheme: 'dark' });
  const p2 = await escuro.newPage();
  await p2.route('**/*.supabase.co/**', supabaseFalso().rota);
  await p2.goto(B + '/entrar', { waitUntil: 'networkidle' });
  const fundo2 = await p2.evaluate(() => getComputedStyle(document.body).backgroundColor);
  ok('e continua branca com o sistema no escuro', fundo2 === 'rgb(250, 250, 250)', fundo2);
  await escuro.close();
  ok('a marca aparece como Central', /Central/.test(await texto(p)));
  ok('sem erro de JS', erros.length === 0, erros.join(' | '));
  await p.close();
}

// ---- 6. em português, do título ao rodapé ----
{
  const { p } = await abrir('/entrar');
  ok('a página se declara em português', await p.getAttribute('html', 'lang') === 'pt-BR');
  ok('o título é em português', (await p.title()).includes('Entrar'));
  await p.close();
}

await b.close();
console.log(`\n${ok_} OK, ${mau} falha(s)`);
process.exit(mau ? 1 : 0);
