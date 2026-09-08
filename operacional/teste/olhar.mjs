/* Sobe o app com uma sessão de mentira (só para passar da porta) e fotografa
   os lugares que o Vitor apontou. Serve para ver o defeito, não para provar
   nada sobre o banco. */
import { chromium } from '/home/user/vitor/node_modules/playwright-core/index.mjs';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const srv = createServer((_, r) => { r.writeHead(200,{'content-type':'text/html; charset=utf-8'}); r.end(html) }).listen(0);
const porta = srv.address().port;

const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const pag = await nav.newPage({ viewport: { width: 1440, height: 900 } });
await pag.addInitScript(() => {
  window.supabase = { createClient: () => ({
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u1', email: 'vitor@botanika.com.br' } } } }),
            signOut: async () => ({}) },
    from: () => ({ select: () => ({ or: async () => ({ data: [], error: null }) }),
                   upsert: async () => ({ error: null }) }),
  }) };
});
await pag.route('**/supabase.js', (r) => r.fulfill({ status: 200, body: '', contentType: 'application/javascript' }));
await pag.goto(`http://127.0.0.1:${porta}/`, { waitUntil: 'networkidle' });

const foto = async (nome) => { await pag.screenshot({ path: `teste/${nome}.png`, fullPage: false }); console.log('  →', nome) };
await foto('01-inicio');

/* Tarefas */
const tarefas = pag.locator('text=Tarefas').first();
if (await tarefas.count()) { await tarefas.click().catch(()=>{}); await pag.waitForTimeout(500); await foto('02-tarefas') }

/* abre a primeira tarefa da lista, que é onde o pop-up sai do lugar */
await pag.getByText('DIA D — Programar disparos de e-mail e WhatsApp').first().click();
await pag.waitForTimeout(800); await foto('03-tarefa-aberta');
await pag.keyboard.press('Escape'); await pag.waitForTimeout(400);

for (const [nome, alvo] of [['04-entregas','Entregas'],['05-campanhas','Campanhas']]) {
  const l = pag.getByText(alvo, { exact: true }).first();
  if (await l.count()) { await l.click().catch(()=>{}); await pag.waitForTimeout(700); await foto(nome) }
}

await nav.close(); srv.close();
