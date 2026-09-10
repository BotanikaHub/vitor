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
| `acessos.js` | quem entra na Central: a lista de convites, os perfis, papéis, áreas e marcas — a única tela que fala com as tabelas do banco em vez do `localStorage` |

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

### A tranca não espera ser pedida

A primeira versão disto era frouxa: *sem lista, não travava*. A ideia era não
parar a operação no dia em que o sistema subiu. O efeito foi outro — em dois
meses, **zero listas foram criadas**, e portanto nada nunca travou. Uma tranca
que espera alguém pedir para ser trancada não tranca nada.

Agora:

- **A lista nasce sozinha.** Abrir a ficha de uma tarefa aberta já cria a lista
  pelo padrão da área. Não existe entrega sem lista; existe lista em branco, e
  ela tranca. A lista criada assim vem marcada com `automatica: true`.
- **Quem fez não confere o próprio trabalho.** Itens marcados como `revisao` só
  podem ser marcados por outra pessoa: se quem está logado é responsável pela
  tarefa, a caixa recusa. Quem é quem vem do cadastro de acessos, casando o
  nome do perfil e o nome que a pessoa tem no ClickUp.
- **Marcar custa.** Itens marcados como `prova` pedem o link, o print ou o que
  foi testado, e guardam isso junto da marcação, com nome e hora. Sem escrever,
  não marca.
- **O erro que passou vira linha.** O botão "Passou um erro" na ficha
  transforma o que escapou em item obrigatório daquela área, para todas as
  próximas entregas. Sem isso a lista nunca aprende — foi assim que o mesmo
  tipo de erro apareceu quatro vezes na tarefa recorrente de conferência.
- **O que escapou fica visível.** A daily mostra o que foi entregue sem
  conferir nos últimos sete dias, com nome.

Quais itens pedem prova e quais pedem outra pessoa está na terceira coluna do
padrão de fábrica, em `PADRAO` e `GERAIS`. O padrão de cada área é editável na
própria tela, e o que estiver guardado manda.

### O roteiro da área na campanha

As ações de uma campanha são sempre as mesmas — o que muda é a comunicação.
Então o que se confere também é sempre o mesmo, e é longo demais para caber na
lista de uma subtarefa. O **roteiro** é esse protocolo inteiro: uma vez por
campanha, por área, com um dono.

- **Oferta.** Listar todo desconto vivo na loja; decidir e escrever o que soma
  e o que não soma; desligar o que a campanha barra; testar cada desconto
  sozinho (quantidade, influenciadora, recompra, frete); testar as combinações
  entre eles e conferir a margem na pior soma; testar o limite do brinde;
  fechar uma compra de verdade no Pix e no cartão; desligar tudo no dia
  seguinte ao fim.
- **Site.** Home inteira, banner e barra de aviso lidos no site de verdade;
  página de produto; carrinho; checkout; quiz, coleções e busca; e tudo outra
  vez no celular, num aparelho de verdade.
- **Tráfego, Criativo, Copy, Instagram, E-mail, Grupos, Influencer,
  Atendimento** têm o seu, na mesma forma.

**O roteiro é do trabalho que existe.** Ele aparece para a área que tem tarefa
naquela campanha — o protocolo do site não vai para campanha que não encosta no
site. Quando a campanha mexe em algo que ninguém abriu tarefa, o resumo da
campanha oferece chamar aquele roteiro à mão. No resumo eles nascem fechados;
na ficha da tarefa que travam, abertos enquanto falta.

Cada roteiro vive em `roteiro:<marca>|<campanha>|<área>` e aparece em dois
lugares: no resumo da campanha, um bloco por área, e na ficha da **tarefa
principal** daquela área — a que tem subtarefas ou, sem nenhuma assim, a de
prazo mais longe. É essa tarefa que o roteiro tranca; as subtarefas seguem com
a lista curta delas.

O dono sai de quem tem mais tarefa daquela área na campanha, e pode ser trocado
no próprio bloco. Item de revisão dentro do roteiro não pode ser marcado por
quem conduz o roteiro.

O botão **"Passou um erro"** do roteiro escreve o item numa etapa
`Erros que já passaram por aqui`, com prova obrigatória, e ele passa a valer em
**toda campanha seguinte**. Foi assim que entrou o número escrito na arte: o
banner do Dia D foi ao ar prometendo o manual "para os 1000 primeiros" quando
eram 100, e o texto do tema estava certo — o erro estava dentro da imagem, que
ninguém tinha roteiro para conferir.

### O furo que sobra

A tranca vale dentro da Central. **Uma tarefa fechada no ClickUp chega aqui já
como "feito"**, e a conferência nunca a viu. Enquanto a escrita de volta para o
ClickUp não estiver ligada, isso depende de combinado — e a daily cobra todo
dia, com nome, o que passou por fora.

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

## A home que cada um monta

A tela inicial vinha pronta e igual para todo mundo. Mas quem abre a Central de
manhã não abre pelo mesmo motivo: o Pedro quer ver o que estreia, a Lissia quer
a fila do dia, o Vitor quer o ritmo do mês.

Agora ela é um quadro de blocos numa grade de doze colunas. Cada bloco tem
largura (¼, ⅓, ½, ⅔ ou inteiro), **se arrasta** para onde se quer, sai quando
não serve e volta pelo catálogo. O botão **Organizar** liga as alças, as
larguras e o ×; **Adicionar bloco** abre o catálogo, onde cada oferta traz uma
**prévia do formato** — linhas para lista, barras para campanha, um número
grande para contador.

O arranjo é **de cada pessoa**: mora em `central.home.layout.<uid>`, que a ponte
guarda por dono. O da Sarah não mexe no do Pedro.

**Os quatro blocos que já existiam não foram reescritos — foram adotados.** O nó
do app inteiro é movido para dentro da moldura nova, e quem os preenche
(`inicio.js`) continua encontrando `#homeAtencao` e `[data-stat]` onde sempre
esteve. Quando um deles sai da home, o nó fica guardado num canto escondido e
volta inteiro se a pessoa o chamar de novo.

Os blocos disponíveis:

| Bloco | O que mostra |
|---|---|
| Semana | a linha do tempo com campanhas e marcos dos sete dias |
| Perto do vencimento · Vencidas · Conclusão no mês | os três contadores, agora separados |
| Tarefas que pedem atenção | vencidas primeiro, depois as próximas 48h |
| Campanhas do mês | as com data neste mês, com o quanto já andou |
| **As minhas de hoje** | só o que está no seu nome, vencendo ou atrasado |
| **O que estreia** | campanhas dos próximos dez dias e quantas seguem abertas |
| **Travadas na conferência** | o que não fecha porque falta item obrigatório |
| **Entregue sem conferir** | o que foi fechado por fora |
| **Ações combinadas** | o que ficou da daily e da reunião, com prazo até hoje |

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

### O que cada setor responde

O catálogo de métricas do painel diz, para cada linha, **de onde o número vem**:
`api` quando o banco da marca calcula sozinho (Shopify, Meta Ads, Instagram,
sessões), `derivada` quando sai de uma conta entre dois números medidos, e
`mao` quando alguém precisa lançar. O que é de mão aparece marcado na tela —
número medido e número digitado não podem se confundir.

- **Geral** — faturamento, pedidos, ticket, conversão, sessões, recompra e
  **CAC** (investimento ÷ pedidos), o número que amarra tráfego a resultado.
- **Tráfego** — investimento, faturamento atribuído, ROAS, CPA, impressões,
  cliques, CTR, CPC, CPM, **frequência** (fadiga de criativo), visitas à
  página, clique → página e checkouts do anúncio.
- **Site** — setor novo, porque quem cuida do tráfego cuida do site: sessões,
  conversão, checkouts iniciados, **sessão → checkout**, **checkout → pedido**
  (o abandono) e receita por sessão.
- **Influenciadores** — faturamento por cupom, influencers ativos, clientes
  novos, **faturamento por influencer**, comissão paga e retorno sobre a
  comissão.
- **Social media** — views, interações, cliques, views → clique, seguidores, e
  as vendas separadas por **link da bio, stories e live** (pelo `utm_medium` do
  pedido).
- **Automações** — faturamento, pedidos e conversão de **e-mail, WhatsApp API e
  grupos**. Pedidos e faturamento são automáticos; mensagens enviadas e gastos
  são lançados à mão enquanto a integração não existe, e a conversão é a conta
  entre os dois — por isso ela só vale no recorte do mês.
- **Atendimento** — atendimentos, tempo de resposta, CSAT, fila aberta e
  atendimentos por pedido.

### Mensagens enviadas e gastos, sem ninguém digitar

Estes números já chegavam à base da Central e ninguém lia:

| Tabela | Quem enche | O que tem |
|---|---|---|
| `public.emails` | fluxo n8n *ActiveCampaign → Supabase* | campanha, data, envios, aberturas, cliques |
| `public.meta_whatsapp` | fluxo n8n *Report - Meta API* | dia, mensagens enviadas e entregues, **gasto em reais** |
| `public.disparos_manual` | à mão | dia, canal, mensagens disparadas |

`banco/envios.sql` cria `central_envios(marca, de, ate)`, que lê as três e
devolve **com as mesmas chaves que o painel usa** — então entram direto no
realizado, em qualquer recorte, sem tradução no meio. O painel chama por RPC
com a sessão de quem está logado; sem sessão, ou sem a função, segue sem, e o
que estiver lançado à mão continua valendo.

Com isso, **e-mails enviados**, **mensagens da API** e **gastos da API** saem
de "digitado" e viram medido — e a **conversão de cada canal** (pedidos ÷
mensagens) passa a ser calculada sozinha, por período e por semana.

**Grupos ainda não.** O fluxo do SendFlow que existe traz composição de grupo
(quem entrou, quem saiu), não disparo. Até haver uma credencial do SendFlow no
n8n, os grupos saem de `disparos_manual`.

### Lançar o número que não tem fonte

Atendimento passou meses sem um número sequer — `atendimento_metricas` com zero
linhas. O motivo não era falta de combinado: **o banco já aceitava guardar
valor de setor (`valor_setor`), mas nenhuma tela pedia**. Quem quisesse lançar
teria que abrir o Supabase.

Agora toda métrica marcada como `mao` no catálogo mostra um botão **lançar** no
lugar do valor, com o campo e a escolha entre **no mês** e **nesta semana** — a
semana guardada como `AAAAMMDD` da segunda, que é o número que `central_setores`
procura. O que foi lançado na semana entra na tabela da reunião de quinta junto
do que a API mediu.

E **o medido manda sobre o digitado**: se um dia a integração existir, o número
dela cobre o lançamento à mão sozinho, sem ninguém ter que apagar nada.

### O filtro de cada setor

`central_setores` passou a receber o período da barra do painel e devolve
`realizado_periodo` junto do mês. Assim cada setor vê o próprio resultado no
recorte que escolheu — hoje, ontem, 3 dias, 7, 30 ou um período à mão — ao lado
do mês e da meta. O mês é o compromisso; o período é o que a pessoa está
olhando agora.

## A página da área

Cada um abre a Central por um motivo diferente, e o painel inteiro é grande
demais para quem cuida de uma coisa só. A aba **Área** recorta tudo por área:

- **Métricas da área** — as métricas dos setores que ela responde, com a meta do
  mês, onde está, e a **micrometa de hoje**.
- **Campanhas desta área** — só as que têm tarefa da área, cada uma com o
  **quanto já entregou e quanto falta** — contado sobre as tarefas *da área*
  naquela campanha, não sobre as de todo mundo.
- **Projetos desta área** — o que tem projeto e não é campanha, na mesma conta.
- **Tarefas da área** — atrasadas, de hoje, dos próximos sete dias e sem prazo.

### A micrometa

A micrometa divide **o que falta pelos dias que sobraram**, não a meta pelo mês
inteiro. Assim ela sobe quando se atrasa e desce quando se adianta — que é o que
a pessoa precisa saber de manhã. Métrica de nível (ROAS, CSAT, conversão) não se
divide: mostra o alvo a manter.

### Três vocabulários de "área", um lugar só

O sistema tinha três listas diferentes: os **setores** do painel (que falam de
métrica), as **áreas** da conferência (que falam de tipo de entrega) e a tabela
**`areas`** do banco (que fala de gente). Quem manda é a última — é a que as
nove pessoas já têm no cadastro. As outras duas são traduzidas pelo `MAPA` de
`src/area.js`, num lugar só: `trafego` responde pelos setores *tráfego* e *site*
e pelas entregas *Tráfego* e *Site*; `automacoes` responde por *E-mail*,
*Grupos* e *API*; e assim por diante.

**Tarefa da área** é a de quem é dela **mais** a do tipo dela. Nenhuma das duas
sozinha cobre: tarefa sem responsável ainda é da área pelo tipo, e tarefa
atípica com a pessoa certa ainda é dela.

### Quem vê o quê

Membro cai na própria área e não tem seletor. Admin e gestor trocam de área e
têm um atalho para voltar à sua. **Isso é recorte de tela, não tranca**: o
estado da operação é compartilhado por desenho, e quem quiser ver o de outra
área consegue por outros caminhos.

## Daily, reunião de KPI, pessoas e projetos

### A daily olha para frente

Campanha não quebra no dia em que estreia — quebra nos dias antes, quando o
prazo da tarefa ainda não venceu e por isso ninguém olha para ela.

- **"O que estreia"** lista as campanhas dos próximos 10 dias com quanto já
  está pronto, quantas tarefas seguem abertas, quantas já estão atrasadas e
  quantas estão sem dono — e avisa quando uma campanha não tem tarefa nenhuma.
- **A partir de 4 dias antes**, as tarefas abertas daquela campanha entram no
  cartão de cada pessoa, mesmo com prazo ainda no futuro, junto de um campo
  **"Por que ainda não fechou"** que fica gravado por campanha e por pessoa e
  volta na daily seguinte.
- **"O que sai do ar"** lista o que termina hoje ou amanhã, porque banner,
  tarja, cupom, selo e anúncio precisam sair juntos.

### Quando o painel da marca não responde

Os rituais são da Central; os números vêm do banco da marca. Se aquele banco
demorar ou cair, a reunião acontece do mesmo jeito: aviso no topo, botão de
tentar de novo, e a pauta, a leitura e as ações inteiras no lugar. Antes, um
tempo esgotado apagava a tela toda.

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

## Quem entra na Central

Acesso é uma coisa; cadastro de pessoa é outra. As duas moram na tela
**Acessos**, dentro do Painel.

O banco já tinha a estrutura desde a Etapa 1 — `profiles` (uma linha por
conta, ligada ao `auth.users`), `areas`, `brands`, `profile_brands` e o papel
de cada um (`admin`, `gestor`, `membro`, `externo`). O que faltava era a
lista de quem *pode* entrar, e uma tela para administrar isso. Agora existe
`equipe_convites`: o e-mail é o convite.

    cadastrar em Acessos ─► criar a conta no Supabase ─► a pessoa entra
      (e-mail, nome,          (Authentication → Users,     (o gatilho lê a lista
       papel, área, marcas)     com senha provisória)       e monta o perfil pronto)

O gatilho `app.ao_criar_usuario` faz a terceira parte: quem está na lista
entra **liberado**, com o papel, a área e as marcas cadastradas; quem não
está entra bloqueado e não enxerga nada. Criar a conta é o único passo que
não dá para fazer pela Central — só o painel do Supabase cria senha.

Quem manda no que pode ser salvo é o RLS, não a tela: `admin` edita todo
mundo, o resto só lê, e ninguém muda o próprio papel. Sem ser admin, a tela
mostra a lista com os campos travados e diz por quê.

### O nome no ClickUp

O ClickUp assina as tarefas com o nome que a pessoa tem lá — "Sarah |
Gestora de Automações", "polyana costa ribeiro". O cadastro guarda esse nome
em `nome_clickup`, e é assim que a tarefa encontra o dono na Daily, na
reunião de KPI e em Pessoas. Quem assina tarefa e não está cadastrado
continua aparecendo, marcado como "sem cadastro".

### O estado só para quem tem acesso

As linhas de `operacional_estado` com dono nulo são de todo mundo — mas
"todo mundo" passou a querer dizer *quem está liberado*. As três regras da
tabela agora pedem `app.estou_ativo()` e não-externo, o mesmo critério das
outras. Antes bastava estar logado.

### O que está trancado, e o que não estava

Cinco tabelas da base da Central rodavam com RLS **desligado** — qualquer um
com a chave pública lia e escrevia nelas, e uma delas, `dados_cliente`, tem
dado de cliente. Nenhuma é usada pela Central: são a memória do agente do n8n
(`chats`, `chat_messages`, `n8n_chat_histories`, `documents`) e a base do SDR.

Quem escreve nelas é o n8n, com a chave de serviço — e a chave de serviço passa
por cima do RLS. A prova estava ao lado: `compra_aprovada`, `emails` e
`meta_whatsapp` já rodavam com RLS ligado e zero política, e os fluxos gravavam
nelas todo dia. Então ligar o RLS sem política fecha a porta para `anon` e
`authenticated` sem encostar no n8n. Está em `banco/acessos.sql`.

Fica um item que só você pode ligar, no painel do Supabase: **proteção contra
senha vazada** (Auth → Password, checagem no HaveIBeenPwned). Vale ligar antes
de a equipe criar as contas.

### Sem ClickUp, a Central é o original

A decisão mudou o risco principal. Enquanto o ClickUp era a fonte, perder uma
gravação aqui custava um "sincroniza de novo". Agora a tarefa nasce, muda e
fecha aqui — não há segunda cópia.

E o jeito antigo de gravar não sobrevive a oito pessoas: o app guarda as 70
tarefas num vetor só, e a ponte subia **o vetor inteiro** a cada mudança. Duas
abas abertas e a conta é essa — a Sarah fecha a dela às 10h02, o Pedro renomeia
o dele às 10h03, e o vetor do Pedro, lido às 9h40, volta por cima e desfaz o
que a Sarah fez. Sem erro, sem aviso.

A gravação passa a **juntar três coisas**: o que eu tinha quando li, o que eu
tenho agora, e o que está no banco agora. Só o que *eu* mudei vai por cima; o
resto fica como o banco está. Item novo de outra pessoa não some, item que eu
apaguei sai mesmo, e duas pessoas na mesma tarefa continuam em "a última
manda" — como em qualquer ferramenta. As gravações da mesma chave entram em
fila, para duas seguidas não lerem o banco ao mesmo tempo.

E como ninguém mais recarrega a página por acaso, a ponte olha o banco a cada
25 segundos e quando a aba volta ao foco. Ela **não escreve por baixo** — trocar
o estado no meio de uma edição é pior que não avisar. Mostra uma barra dizendo
onde mexeram e deixa o recarregar com quem está na frente da tela.

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
