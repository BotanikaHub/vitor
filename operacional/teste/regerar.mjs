/* A fusão a três é onde errar custa caro: uma regra errada apaga o que a
   equipe escreveu à mão. Então cada regra tem a sua checagem.

   Cenário: uma semana temática nasce, a equipe escreve à mão em duas
   células e acrescenta uma linha própria, e aí as datas mudam. */
import { chromium } from '/home/user/vitor/node_modules/playwright-core/index.mjs';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const srv = createServer((_, r) => { r.writeHead(200,{'content-type':'text/html; charset=utf-8'}); r.end(html) }).listen(0);
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const pag = await nav.newPage({ viewport: { width: 1440, height: 900 } });
pag.on('pageerror', (e) => console.log('  [erro na página]', e.message));
await pag.addInitScript(() => { window.supabase = { createClient: () => ({
  auth:{getSession:async()=>({data:{session:{user:{id:'u1',email:'v@b.com'}}}}),signOut:async()=>({})},
  from:()=>({select:()=>({or:async()=>({data:[],error:null}),eq:()=>({maybeSingle:async()=>({data:null})})}),upsert:async()=>({error:null})}) }) } });
await pag.route('**/supabase.js', (r) => r.fulfill({ status:200, body:'', contentType:'application/javascript' }));
await pag.goto(`http://127.0.0.1:${srv.address().port}/`, { waitUntil:'networkidle' });
await pag.waitForTimeout(600);

const ok = [];
const conf = (n, v) => { assert.ok(v, n); ok.push(n) };

const r = await pag.evaluate(() => {
  const K = 'central.campaigns.vitor-gutierrez';
  const ler = () => JSON.parse(localStorage.getItem(K) || '[]');

  /* uma semana temática de 5 dias, criada pelo gerador */
  const c = { id: 'c-teste', name: 'Semana Teste', brand: 'Botanika',
    type: 'Semana temática', status: 'Planejamento', owner: 'Vitor',
    start: '2026-10-05', end: '2026-10-09', goal: 100000, budget: 10000,
    progress: 0, color: '#121415', objective: '', offer: '',
    channels: [], products: [], benefits: [], schedule: [] };
  localStorage.setItem(K, JSON.stringify([c]));

  /* faz o TAP nascer usando o mesmo caminho do assistente */
  window.RegerarCronograma('c-teste');
  let atual = ler()[0];
  const sec0 = atual.tap.find(s => s.title.includes('CANAIS'));
  const colunasAntes = sec0.columns.slice();
  const linhaEmail0 = sec0.rows.findIndex(l => l[0] === 'E-mails base antiga');
  const geradoNaAbertura = sec0.rows[linhaEmail0][4];

  /* a equipe mexe: escreve à mão numa célula, renomeia a base de um canal
     e acrescenta uma linha que o gerador não faz */
  sec0.rows[linhaEmail0][4] = 'ESCRITO À MÃO';
  const linhaApi = sec0.rows.findIndex(l => l[0] === 'WhatsApp API');
  sec0.rows[linhaApi][1] = 'Base com opt-in (só SP)';
  sec0.rows.splice(linhaApi + 1, 0,
    ['Podcast', 'parceria', ...colunasAntes.slice(2, -1).map(() => 'x'), 'Ana']);
  localStorage.setItem(K, JSON.stringify([atual]));

  /* agora as datas mudam: a semana estende dois dias */
  atual = ler()[0];
  atual.end = '2026-10-11';
  localStorage.setItem(K, JSON.stringify([atual]));
  window.RegerarCronograma('c-teste');

  const dep = ler()[0];
  const sec = dep.tap.find(s => s.title.includes('CANAIS'));
  const email = sec.rows.find(l => l[0] === 'E-mails base antiga');
  const api = sec.rows.find(l => l[0] === 'WhatsApp API');
  const podcast = sec.rows.find(l => l[0] === 'Podcast');
  const iApi = sec.rows.indexOf(api), iPod = sec.rows.indexOf(podcast);
  return {
    colunasAntes: colunasAntes.length, colunasDepois: sec.columns.length,
    geradoNaAbertura,
    maoContinua: email[4],
    baseRenomeadaContinua: api[1],
    temPodcast: !!podcast, podcastLogoApos: iPod === iApi + 1,
    /* a última coluna de dia é a nova; tem que vir preenchida pelo ritmo */
    ultimoDiaEmail: email[email.length - 2],
    ultimoDiaPodcast: podcast ? podcast[podcast.length - 2] : null,
    secoes: dep.tap.length,
  };
});

conf('estender a semana acrescenta colunas (' + r.colunasAntes + ' → ' + r.colunasDepois + ')',
  r.colunasDepois === r.colunasAntes + 2);
conf('a célula escrita à mão continua lá', r.maoContinua === 'ESCRITO À MÃO');
conf('a base renomeada à mão continua', r.baseRenomeadaContinua === 'Base com opt-in (só SP)');
conf('a linha criada à mão sobrevive', r.temPodcast);
conf('e continua ancorada logo abaixo de onde estava', r.podcastLogoApos);
conf('o dia que entrou nasce preenchido pelo ritmo', r.ultimoDiaEmail === '2 última chance');
conf('a linha da pessoa não é preenchida pelo gerador', r.ultimoDiaPodcast === '');
conf('nenhuma seção se perdeu no caminho', r.secoes === 7);

console.log(ok.map(s => '  ✓ ' + s).join('\n'));
console.log(`\nregerar: ${ok.length} checagens passaram`);
await nav.close(); srv.close();
