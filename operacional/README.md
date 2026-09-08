# Operacional

A Central da Botanika e da VermeFree, desenhada com o design system Cilo e
trazida do repositório `Vitorgutierrezzxcv/gest-operacional` para cá.

    npm install
    npm run build      # gera dist/index.html
    node teste/*.mjs   # a suíte, arquivo por arquivo

## Como o arquivo se monta

`src/base.html` é a página inteira — no repositório de origem ela vinha
comprimida em gzip e fatiada em cinco arquivos `.b64`, e o Git só enxergava um
blob binário. Aqui é texto puro.

Por cima dela o build cola as folhas de estilo, nesta ordem, e a ordem importa
porque cada uma corrige a anterior:

    responsive-v3 → cilo-design-v5 → cilo-v6-0..7 → cilo-design-v7
    → cilo-v8-correcoes → mapa → conferencia

E injeta os scripts antes do `</body>`:

    cilo-design-v6 → cilo-v8-comportamento → mapa → assistente
    → calendario → campanha → conferencia

A ponte com o Supabase (`src/supabase.js`) entra no `<head>`, e não no fim: o
app lê o `localStorage` assim que o próprio script roda, então a sessão precisa
estar resolvida antes disso.

## O que cada módulo faz

Os módulos rodam **depois** do app e refazem os painéis dele por cima. Não há
como alterar o app por dentro sem voltar ao blob binário, então cada um observa
as mudanças da tela e repõe o que é seu, com uma assinatura que evita o laço.

| arquivo | o que faz |
|---|---|
| `supabase.js` | tela de entrar, sessão, e o `localStorage` como vitrine da tabela `operacional_estado` — o que uma pessoa grava, a outra vê |
| `mapa.js` | o mapa mental do planejamento, com as mesmas teclas do planejador |
| `assistente.js` | o passo a passo que cria a campanha: catálogo da Shopify, divisão da receita por canal, TAP e cronograma já preenchidos |
| `calendario.js` | o calendário em barras — mês, semana começando segunda, e a faixa da página inicial |
| `campanha.js` | as abas de dentro da campanha, editáveis no lugar, e a exclusão |
| `conferencia.js` | a conferência antes da entrega (abaixo) |

## A conferência

Ninguém marca uma tarefa como concluída sem ter conferido: enquanto houver item
obrigatório em aberto, as três portas para o "feito" — o círculo da lista, o
arrasto para a coluna do quadro, o status na ficha — recusam.

São três níveis:

- **Área** — o padrão do que se confere naquele tipo de entrega (Tráfego,
  Criativo, Copy, Instagram, E-mail, Site, Influencer, Atendimento, Grupos,
  API). É editável, e é dele que a lista de cada tarefa nasce.
- **Tarefa** — a lista daquela entrega, do padrão da área mais o contexto
  (a campanha, o cupom, os produtos, o prazo). É esta que tranca.
- **Campanha** — a conferência de encerramento, mais a contagem de como estão
  as conferências das tarefas dela.

A lista pode ser escrita pela IA ou pelas regras daqui. **As regras funcionam
sempre** — sem chave, sem rede e sem espera. A IA entra por cima quando existe
`/api/conferencia` respondendo, e se ela falhar ou demorar a lista das regras
fica: nunca se entrega sem lista.

### Para ligar a IA

A chave da Anthropic não pode morar no `src/`: o `dist/index.html` vai inteiro
para o navegador de quem abrir o link, e este repositório é público. Quem fala
com a Anthropic é `api/conferencia.mjs`, que roda na Vercel.

No painel do projeto `operacional` na Vercel, em *Settings → Environment
Variables*, crie:

    ANTHROPIC_API_KEY = <a chave>

e publique de novo. Sem essa variável a função responde 503 e a tela cai nas
regras — o botão "Gerar com IA" continua existindo e continua entregando lista.
Não cole a chave em lugar nenhum além do painel.

## Onde ficam os dados

Tabela `operacional_estado` no Supabase (`sjkuysdmixfzeerxuudn`), com RLS
ligada. A ponte espelha toda chave que começa com `central.`:

| chave | o que guarda |
|---|---|
| `central.campaigns.<usuário>` | as campanhas e o TAP de cada uma |
| `central.tasks.<usuário>` | as tarefas vindas do ClickUp |
| `central.planning.map.<usuário>.<marca>` | o mapa mental de cada marca |
| `central.conferencia.<usuário>` | os padrões das áreas e as listas de conferência |
| `central.home.layout.<usuário>` | o layout da página inicial — este é pessoal |
| `central.theme` | claro ou escuro — este nem sai do navegador |

A hidratação acontece **antes** de o espelho ser instalado. Ao contrário, os
valores de fábrica do app subiriam por cima do que está no banco.

## O que ainda falta

Cinco tabelas antigas (`dados_cliente`, `chats`, `chat_messages`, `documents`,
`n8n_chat_histories`) continuam sem RLS, com o papel `anon` podendo ler e
escrever. A chave anônima já é pública no navegador e este repositório é
público — então, na prática, esses dados estão abertos. Falta a decisão de
escrever as políticas.
