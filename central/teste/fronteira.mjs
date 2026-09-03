/* O servidor não pode importar valor de um módulo 'use client'.
 *
 * No build de produção, os exports de um módulo cliente viram referência
 * de cliente. Componente funciona; array, objeto e função, não — chegam
 * como algo que não é aquilo. Compila, passa no build, e quebra na
 * primeira página que usar. Foi assim que a home caiu com
 * "SECOES.filter is not a function".
 *
 * Este teste lê os imports e reclama antes de ir pro ar. */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src');
let ok_ = 0, mau = 0;
const ok = (n, c, x = '') => { c ? ok_++ : mau++; console.log((c ? 'OK  | ' : 'FALHA | ') + n + (x ? ' | ' + x : '')); };

function varrer(dir, achados = []) {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) varrer(caminho, achados);
    else if (/\.(ts|tsx)$/.test(nome)) achados.push(caminho);
  }
  return achados;
}

const arquivos = varrer(raiz);
const conteudo = new Map(arquivos.map((f) => [f, readFileSync(f, 'utf8')]));
const ehCliente = (f) => /^\s*['"]use client['"]/.test(conteudo.get(f) || '');

/* De "@/lib/x" para o arquivo em disco. */
function resolverApelido(spec, deQuem) {
  let base;
  if (spec.startsWith('@/')) base = join(raiz, spec.slice(2));
  else if (spec.startsWith('.')) base = resolve(dirname(deQuem), spec);
  else return null;
  for (const t of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
    const tentativa = base + t;
    if (conteudo.has(tentativa)) return tentativa;
  }
  return null;
}

/* Componente é PascalCase: maiúscula seguida de minúscula. SECOES é
   maiúscula também e não é componente — era exatamente esse o caso que
   quebrou, então a regra precisa separar os dois. */
const ehComponente = (nome) => /^[A-Z][a-z]/.test(nome.trim());

const problemas = [];
for (const arquivo of arquivos) {
  if (ehCliente(arquivo)) continue;
  const texto = conteudo.get(arquivo);
  const re = /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(texto))) {
    const alvo = resolverApelido(m[2], arquivo);
    if (!alvo || !ehCliente(alvo)) continue;
    const nomes = m[1].split(',').map((n) => n.split(' as ')[0].trim()).filter(Boolean);
    const valores = nomes.filter((n) => !ehComponente(n) && n !== 'type');
    if (valores.length) {
      problemas.push(
        arquivo.replace(raiz, 'src') + ' importa ' + valores.join(', ') +
        ' de ' + m[2] + ", que é 'use client'",
      );
    }
  }
}

ok('nenhum módulo de servidor importa valor de um módulo cliente',
   problemas.length === 0, problemas.join(' · '));
ok('a lista de seções mora fora do componente cliente',
   !ehCliente(join(raiz, 'lib', 'secoes.ts')));

console.log(`\n${ok_} OK, ${mau} falha(s)`);
process.exit(mau ? 1 : 0);
