# Operacional

A Central desenhada com o design system Cilo, trazida do repositório
`Vitorgutierrezzxcv/gest-operacional` para cá.

    npm run build      # gera dist/index.html

## O que mudou na vinda

No repositório de origem o HTML-base vinha comprimido em gzip e fatiado em
cinco arquivos `.b64`. O Git guardava um blob binário: não dava para ver o que
mudava de um commit para o outro, nem para duas pessoas mexerem no mesmo
arquivo. Aqui ele é `src/base.html`, texto puro. O `dist/index.html` gerado é
**byte a byte igual** ao do build original — só a fonte deixou de ser opaca.

## Como o arquivo se monta

`src/base.html` é a página inteira. Por cima dela o build cola onze folhas de
estilo, nesta ordem, e a ordem importa porque cada uma corrige a anterior:

    responsive-v3 → cilo-design-v5 → cilo-v6-0..7 → cilo-design-v7

A `cilo-design-v7.css` é a que manda: é ela que traz os tokens do Cilo
(`--c7-ink`, `--c7-line`, raio de 14px, a paleta cinza-quente). Por último o
build injeta `cilo-design-v6.js` antes do `</body>`.

## O que ainda falta

**Não há banco.** Tudo é `localStorage` — tarefas, campanhas, entregas e o
layout do início ficam no navegador de cada pessoa. Na prática, o Pedro cria
uma tarefa e a Sarah não vê. Também não há login. Enquanto isso não for
trocado por Supabase com RLS, isto é uma demonstração do desenho, não o
sistema da operação.
