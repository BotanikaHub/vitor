/* Monta o dist/index.html a partir da fonte em src/.
   Diferença para o build original: o HTML-base é lido direto, e não
   descomprimido de cinco arquivos base64. O conteúdo é o mesmo — o que
   muda é que agora o Git enxerga o que mudou de um commit para o outro,
   que é o mínimo para duas pessoas conseguirem mexer no mesmo arquivo. */
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'src');
const leia = (f) => fs.readFileSync(path.join(src, f), 'utf8');

const base = leia('base.html');

/* Os replace() recebem função, e não texto: um "$'" ou "$&" dentro de um
   módulo (o painel tem) seria lido como padrão de substituição e entraria
   trocado no HTML.
   A ordem importa: cada folha corrige a anterior, e a v7 é a que manda. */
const CAMADAS = [
  'responsive-v3.css',
  'cilo-design-v5.css',
  'cilo-v6-0.css', 'cilo-v6-1.css', 'cilo-v6-2.css', 'cilo-v6-3.css',
  'cilo-v6-4.css', 'cilo-v6-5.css', 'cilo-v6-6.css', 'cilo-v6-7.css',
  'cilo-design-v7.css',
  'cilo-v8-correcoes.css',
  'mapa.css',
  'conferencia.css',
  'descricao.css',
  'painel.css',
  'equipe.css',
  'acessos.css',
  'home.css',
  'area.css',
  'menu.css',
  'backlog.css',
  'agenda.css',
];

const estilos = CAMADAS
  .filter((f) => fs.existsSync(path.join(src, f)))
  .map((f) => `/* ===== ${f} ===== */\n${leia(f).trim()}`)
  .join('\n\n');

let html = estilos
  ? base.replace('</style>', () => `\n${estilos}\n</style>`)
  : base;

for (const js of ['cilo-design-v6.js', 'cilo-v8-comportamento.js', 'mapa.js', 'assistente.js', 'calendario.js', 'campanha.js', 'conferencia.js', 'inicio.js', 'home.js', 'descricao.js', 'painel.js', 'equipe.js', 'acessos.js', 'area.js', 'backlog.js', 'rotina.js', 'agenda.js', 'menu.js'])
  if (fs.existsSync(path.join(src, js)))
    html = html.replace('</body>', () => `<script>\n${leia(js).trim()}\n</script>\n</body>`);

/* A ponte com o Supabase entra no <head>, e não antes do </body>, porque o
   app lê o localStorage assim que o próprio script roda: a sessão precisa
   estar resolvida antes disso. A chave anônima vem do ambiente quando
   houver, e cai na que já está publicada no repositório quando não houver —
   é a mesma que o navegador recebe de qualquer jeito. */
const ANON = process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqa3V5c2RtaXhmemVlcnh1dWRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMTMxNDQsImV4cCI6MjA5NjY4OTE0NH0.oMbvy25V6-W7YvF70zNb1xVfRwH_tGBWp3NPHGtpOtM';

if (fs.existsSync(path.join(src, 'supabase.js'))) {
  const ponte =
    `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"></script>\n` +
    `<script>window.__SB_ANON__=${JSON.stringify(ANON)}</script>\n` +
    `<script>\n${leia('supabase.js').trim()}\n</script>\n`;
  html = html.replace('</head>', () => `${ponte}</head>`);
}

const saida = path.join(__dirname, 'dist');
fs.rmSync(saida, { recursive: true, force: true });
fs.mkdirSync(saida, { recursive: true });
fs.writeFileSync(path.join(saida, 'index.html'), html);
console.log(`dist/index.html — ${Buffer.byteLength(html)} bytes`);
