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

/* A ordem importa: cada folha corrige a anterior, e a v7 é a que manda. */
const CAMADAS = [
  'responsive-v3.css',
  'cilo-design-v5.css',
  'cilo-v6-0.css', 'cilo-v6-1.css', 'cilo-v6-2.css', 'cilo-v6-3.css',
  'cilo-v6-4.css', 'cilo-v6-5.css', 'cilo-v6-6.css', 'cilo-v6-7.css',
  'cilo-design-v7.css',
];

const estilos = CAMADAS
  .filter((f) => fs.existsSync(path.join(src, f)))
  .map((f) => `/* ===== ${f} ===== */\n${leia(f).trim()}`)
  .join('\n\n');

let html = estilos
  ? base.replace('</style>', `\n${estilos}\n</style>`)
  : base;

if (fs.existsSync(path.join(src, 'cilo-design-v6.js')))
  html = html.replace('</body>', `<script>\n${leia('cilo-design-v6.js').trim()}\n</script>\n</body>`);

const saida = path.join(__dirname, 'dist');
fs.rmSync(saida, { recursive: true, force: true });
fs.mkdirSync(saida, { recursive: true });
fs.writeFileSync(path.join(saida, 'index.html'), html);
console.log(`dist/index.html — ${Buffer.byteLength(html)} bytes`);
