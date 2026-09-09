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
| `inicio.js` | os cartões, a lista de atenção e as campanhas do mês da página inicial, lidos das tarefas e campanhas de verdade |
| `descricao.js` | a descrição da tarefa desenhada a partir do Markdown do ClickUp — títulos, tabelas, citações, caixas de marcar — em vez do arquivo cru |
| `painel.js` | o Painel — visão geral, tráfego, setores e metas, KPIs, estoque, cupons e alertas — lido ao vivo do banco de cada marca por `/api/painel` (abaixo) |
| `equipe.js` | as telas do Painel em que gente aparece: Daily, Reunião de KPI, Pessoas e Projetos — e o dono de cada setor, meta, ação e projeto |

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

### A IA está desligada

Por decisão do Vitor, a Central roda sem a chave da Anthropic — a conferência
sai pelo padrão de cada área, que é o mesmo material que a IA usaria de base.
Na primeira vez que alguém pede "Gerar com IA" e a função responde 503, o botão
some da ficha e a tela diz de onde a lista veio. Nada quebra por causa disso.

Para ligar um dia, é isto. A chave da Anthropic não pode morar no `src/`: o
`dist/index.html` vai inteiro para o navegador de quem abrir o link, e este
repositório é público. Quem fala com a Anthropic é `api/conferencia.mjs`, que
roda na Vercel.

No painel do projeto `operacional` na Vercel, em *Settings → Environment
Variables*, crie:

    ANTHROPIC_API_KEY = <a chave>

e publique de novo. Não cole a chave em lugar nenhum além do painel.

## O painel

O acompanhamento morava em dois apps do Lovable — o Botanika Analytics e o
VermeFree Analytics —, cada um com o seu login. Agora ele é uma tela da
Central (`#painel`), com as mesmas telas: visão geral, tráfego, setores e
metas, KPIs, estoque, cupons e alertas. Os números continuam sendo os de lá,
lidos ao vivo: Shopify (pedidos pagos, `is_test = false`, dia em São Paulo),
Meta Ads, Instagram e as metas por setor. A tela se atualiza sozinha a cada
45 segundos enquanto está aberta.

    navegador ──► /api/painel ──► painel_marcas (Central)  ──► banco do painel da marca
      JWT da        confirma o       url, chave publicável,      central_visao, central_trafego,
      Central       login            token                        central_setores, ... (só com token)

O banco de cada painel é fechado para tudo que não é a chave de serviço, e
essa chave não mora aqui. A entrada é outra: as funções `central_*` de lá
(o SQL está em `painel/lovable.sql`) devolvem cada tela já calculada e só
respondem a um token. O token vive na tabela `painel_marcas` da Central, e a
função da Vercel o leva de um banco ao outro sem passar pelo navegador. Para
girar o token de uma marca:

    -- na Central
    update painel_marcas set token = default, girado_em = now() where marca = 'Botanika' returning token;
    -- no banco do painel, com o sha256 do token novo
    update app_config set value = jsonb_build_object('hash', '<sha256>', 'marca', 'Botanika') where key = 'central_token_sha256';

Editar uma meta na tela grava em `metas_kpi` (metas por setor) ou em
`metas_mensais` (as três metas de faturamento) do banco de lá, pela mesma
ponte, com a ação `central_gravar`.

Para ligar uma marca nova (a VermeFree, por exemplo): rodar `painel/lovable.sql`
no banco do painel dela, gravar o sha256 do token em `app_config`, e inserir a
linha dela em `painel_marcas` com a URL e a chave publicável do projeto.

## Daily, reunião de KPI, pessoas e projetos

O Painel mostra o número; estas quatro telas mostram quem responde por ele.

- **Daily** — o dia escolhido (hoje, por padrão): faturamento de ontem contra
  a média dos sete dias antes, Meta Ads de ontem, alertas do painel, e um
  cartão por pessoa com o que vence hoje, o que está atrasado, o que fechou
  de ontem para hoje, o foco do dia e as travas. As ações combinadas ficam
  com dono e prazo. "Copiar resumo" monta o texto para o grupo.
- **Reunião de KPI** — a semana escolhida (a reunião é na quinta): cada setor
  com dono, meta da semana e realizado contra a semana anterior, acumulado do
  mês contra o ritmo, leitura e decisões. As ações voltam toda quinta até
  serem fechadas. A tabela "Execução da semana" conta as tarefas concluídas
  por pessoa (a data de conclusão vem do ClickUp; o que é fechado só na
  Central ganha a data em que a Central viu).
- **Pessoas** — quem assina tarefa no ClickUp entra sozinho; área, função,
  marcas e ativo se definem aqui. O cartão de cada pessoa junta as metas que
  ela responde, as tarefas, os projetos que lidera e as ações pendentes.
- **Projetos** — as campanhas do planejador com dono, meta, verba e as
  tarefas do ClickUp casadas pelo nome do projeto; o que não casa aparece em
  "Outros projetos".

O dono de um setor ou de uma métrica se escolhe em Setores e metas. O que
essas telas gravam mora no `localStorage` e passa pela ponte como qualquer
outra chave `central.*`:

| Chave | O que guarda |
|---|---|
| `central.pessoas.<usuário>` | o cadastro: nome, área, função, marcas, ativo |
| `central.donos.<usuário>` | `marca|setor|<setor>` e `marca|<escopo>|<canal>|<métrica>` → nome |
| `central.rituais.<usuário>` | notas da daily e da reunião, e a lista de ações |
| `central.feitas.<usuário>` | a data em que a Central viu cada tarefa como feita |

Nenhuma ação vira tarefa no ClickUp por aqui: isso só depois que a escrita de
volta for liberada.

## De onde vem o que aparece na tela

Nada no app é escrito à mão. Os padrões de fábrica são vazios de propósito:
sem banco, a Central abre vazia e diz que está vazia. Antes ela abria com
tarefas e campanhas inventadas — nomes de gente real em entregas que não
existem —, e isso é pior do que tela vazia, porque quem abre acredita.

    ClickUp                       Planejador (planejamento_tap)
    listas Botanika e VermeFree   campanhas, TAP, mapas mentais
      │  n8n [Botanika] ClickUp        │
      │  → Planejador, de hora          │
      ▼  em hora                        ▼
    tarefas_planejadas ───────►  operacional_estado  ◄──── a Central grava
                                  (central.*)              o que a equipe edita

As subtarefas entram aninhadas na tarefa mãe, pelo campo `parent` do ClickUp,
e não como linhas soltas. A campanha de cada tarefa vem do campo personalizado
**Projeto** — é ele que liga a tarefa à campanha do planejador.

### Refazer a sincronia

Duas chamadas, nesta ordem:

1. no n8n, rode o fluxo **[Botanika] ClickUp → Planejador** — ele traz as
   listas Botanika e VermeFree para `tarefas_planejadas`;
2. no Supabase, `select * from public.central_sincronizar();` — ele reconstrói
   `central.tasks` e `central.campaigns` e conserta os vínculos do mapa.

O fluxo está **desligado** e a função é chamada à mão de propósito. Enquanto a
Central não souber escrever de volta no ClickUp, uma sincronia automática
apagaria de hora em hora o que a equipe marcou aqui — inclusive as
conferências. Ligar o automático é o passo seguinte à escrita de volta, não
antes dela.

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
