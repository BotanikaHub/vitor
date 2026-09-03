/* O planejador continua sendo um arquivo só, e continua sendo o mesmo
   arquivo — não uma cópia que envelhece. Este passo o traz para dentro
   da Central a cada build, para as duas coisas nunca divergirem.

   Ele vive aqui enquanto as telas dele não forem portadas uma a uma.
   Quando a última sair daqui, este script sai junto. */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, '..', '..');
const origem = resolve(raiz, 'dist', 'site', 'index.html');
const destino = resolve(aqui, '..', 'public', 'planejador', 'index.html');

if (!existsSync(origem)) {
  console.error(
    'Não achei ' + origem + '.\n' +
    'Rode ./build-artifact.sh na raiz antes: é ele que gera o arquivo ' +
    'que vai pro ar.',
  );
  process.exit(1);
}

mkdirSync(dirname(destino), { recursive: true });
let html = readFileSync(origem, 'utf8');

/* Dentro da Central o planejador usa o tema claro. É a mesma folha de
   estilo dele, com o outro conjunto de cores — não uma cópia editada. */
const antes = html;
html = html.replace('<html lang="pt-BR">', '<html lang="pt-BR" data-tema="claro">');
if (html === antes) {
  console.error('Não achei a tag <html> para marcar o tema claro.');
  process.exit(1);
}

writeFileSync(destino, html);
console.log(
  'planejador embutido — ' + (html.length / 1024).toFixed(0) + ' KB, ' +
  html.split('\n').length + ' linhas',
);
