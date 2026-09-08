/* Abre a tela de entrar num navegador de verdade e tira foto. O Supabase é
   substituído por um duble: aqui não há rede para ele, e o que se quer ver
   é a tela, não a autenticação. */
import { chromium } from '/home/user/vitor/node_modules/playwright-core/index.mjs';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';

/* Servido por HTTP, e não por setContent: em about:blank o navegador nega
   o localStorage, e é justamente nele que a ponte trabalha. */
const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const servidor = createServer((_, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(html);
}).listen(0);
const porta = servidor.address().port;
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const pag = await nav.newPage({ viewport: { width: 1280, height: 800 } });

await pag.addInitScript(() => {
  window.supabase = { createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: null } }),
      signInWithPassword: async () => ({ error: { message: 'Invalid login credentials' } }),
      resetPasswordForEmail: async () => ({ error: null }),
    },
  }) };
});

pag.on('console', (m) => console.log('  [browser]', m.type(), m.text()));
pag.on('pageerror', (e) => console.log('  [pageerror]', e.message));
/* o script do Supabase vem de CDN e aqui não há saída para ela: responde
   vazio, já que quem vale no teste é o duble do addInitScript */
await pag.route('**/supabase.js', (r) => r.fulfill({ status: 200, body: '', contentType: 'application/javascript' }));
await pag.goto(`http://127.0.0.1:${porta}/`, { waitUntil: 'domcontentloaded' });
await pag.waitForSelector('.ent-fundo', { timeout: 5000 });
await pag.screenshot({ path: 'teste/entrar.png' });

/* erro de senha: a mensagem tem que sair em português */
await pag.fill('#ent-email', 'pedro@botanika.com.br');
await pag.fill('#ent-senha', 'errada');
await pag.click('.ent-bt');
await pag.waitForFunction(() => document.querySelector('.ent-msg')?.textContent.includes('não conferem'), null, { timeout: 5000 });
await pag.screenshot({ path: 'teste/entrar-erro.png' });

/* mostrar/ocultar senha */
await pag.click('[data-olho]');
const tipo = await pag.getAttribute('#ent-senha', 'type');
if (tipo !== 'text') throw new Error('o botão mostrar não revelou a senha');

/* esqueci a senha */
await pag.click('[data-esqueci]');
await pag.waitForFunction(() => document.querySelector('.ent-msg')?.textContent.includes('a caminho'), null, { timeout: 5000 });

console.log('tela de entrar: renderizou, recusou senha errada em português, mostra/oculta e envia troca de senha');
await nav.close();
servidor.close();
