# Automação da operação — arquitetura

Escrito em 22/08/2026, a partir do que o Vitor pediu: automatizar a estrutura
toda para ele sobrar para o estratégico.

## A decisão que governa todo o resto

**O motor é o n8n, não uma sessão do Claude Code.**

Uma sessão acorda quando chamada e morre no fim do turno. Não recebe webhook,
não segura conexão, não sobrevive à noite. Nesta mesma conversa o conector do
Fireflies caiu no meio, uma Routine criada por sessão não conseguiu levar o
conector do SendFlow junto, e o container é reciclado por inatividade. Nada
disso é defeito a contornar — é o formato da coisa.

Então: **n8n roda, chamando a API da Claude quando precisa de julgamento.** O
Claude Code entra para construir os fluxos, escrever os prompts, mapear o
ClickUp e corrigir o que quebrar. Uma coisa é a fábrica, outra é a linha de
produção.

## WhatsApp: Evolution API no servidor do Vitor

A objeção ao SendFlow não era a conexão — era **outras pessoas terem um painel
onde leem as conversas dele**. Evolution numa VPS própria resolve: a instância é
dele, o painel é dele, e ninguém da equipe tem login.

E, ao contrário do SendFlow, **o Evolution recebe**: manda webhook quando chega
mensagem. É isso que torna possível aprovar tarefa respondendo no WhatsApp, que
é como o Vitor quer trabalhar.

Custo: a VPS, algo entre US$ 5 e 10 por mês. O software é livre.

O Pedro já tem um Evolution rodando (instância "Botanika", usada no fluxo
`[Botanika] Aviso WhatsApp - Nova tarefa ClickUp`). Criar outra instância lá
seria grátis e rápido, **mas não serve**: quem administra o servidor enxerga
todas as instâncias. A separação só existe com servidor próprio.

## O que precisa ser provisionado antes

Três coisas, todas do lado do Vitor, e todas bloqueiam trechos grandes:

1. **VPS com Evolution API**, instância do número dele, dentro dos grupos da
   Botanika e da VermeFree.
2. **Chave da API da Anthropic**, para o n8n chamar o Claude. Cobrada por uso,
   separada da assinatura. No volume aqui — algumas dezenas de chamadas por dia
   sobre textos curtos — é baixo, mas é conta nova.
3. **Áudio do Fireflies funcionando.** O teste de 22/08 gravou 1 minuto e veio
   vazio: sem falante, sem frase, sem áudio, marcado como reunião silenciosa. A
   extensão detectou a reunião e criou o registro na conta certa, então o elo
   que falta é só a captura de som — provável permissão de microfone/aba no
   Chrome. Sem transcrição, metade do que está abaixo não existe.

## O que o Vitor pediu, e onde cada peça vive

| O que | Gatilho | Motor | Entrega |
|---|---|---|---|
| Link da reunião nos grupos | horário | n8n | Evolution → grupos |
| Transcrever a reunião | fim da reunião | Fireflies | — |
| Virar tarefa e mandar para aprovação | transcrição pronta | n8n + Claude API | Evolution → Vitor |
| Aprovar/corrigir respondendo no zap | mensagem recebida | Evolution webhook → n8n + Claude API | ClickUp |
| Tarefas de cada um, todo dia | horário | n8n + ClickUp | Evolution → grupos |
| Lembrete de dados de KPI | quarta à noite e quinta de manhã | n8n | Evolution → grupos |
| Resumo do dia para o Vitor | fim do dia | n8n + ClickUp + Claude API | Evolution → Vitor |
| Ler as campanhas do mês | sob demanda | n8n + ClickUp | — |

## A ordem de construção

Construir os oito de uma vez produz oito coisas meio prontas. A ordem abaixo
entrega valor a cada etapa e cada uma valida a seguinte.

**1. Link nos grupos.** Não depende de IA nem de transcrição — só Evolution e
horário. É o "olá mundo" da instalação: se isso funciona, o Evolution está de
pé, dentro dos grupos certos, e o n8n dispara na hora certa. Textos prontos em
`docs/rotinas.md`.

**2. Tarefas de cada um, todo dia.** Lê o ClickUp, agrupa por pessoa, marca o
que está atrasado, manda no grupo. Sem IA — é consulta e formatação. Valida a
leitura do ClickUp, que todo o resto usa.

**3. Lembretes de KPI.** Quarta à noite e quinta de manhã. Trivial depois do 1.

**4. Resumo do dia.** Primeira peça com Claude API: pega o movimento do dia no
ClickUp e escreve o texto que o Vitor manda para o Gabriel e a Vanessa.
Bom primeiro uso de IA porque errar é barato — ele lê antes de encaminhar.

**5. Transcrição → tarefas → aprovação.** A mais valiosa e a mais difícil.
Depende do áudio do Fireflies e das convenções em `docs/clickup.md` — em
especial que "Pedro cria e Sarah programa" são duas tarefas, que o nome sai da
célula do cronograma, e que a prioridade sai da fase.

**6. Aprovar respondendo no WhatsApp.** Só depois que o 5 estiver acertando as
tarefas. Interpretar "a terceira não, e a quinta é da Sarah" só faz sentido
quando a lista já vem boa.

## Regras que valem para tudo

**Nada escreve no ClickUp sem aprovação do Vitor.** Ler é livre; criar, alterar
e concluir passam por ele.

**Toda mensagem automática diz o que é.** Ninguém no grupo deve confundir aviso
de sistema com o Vitor digitando.

**Grupo de equipe nunca se mistura com grupo de cliente.** A Botanika tem Grupo
VIP e Grupo de ofertas, que são de comprador. Um disparo apontado para o grupo
errado é irreversível.

**Todo fluxo com IA guarda o texto que gerou e o que foi aprovado.** Sem isso
não dá para melhorar o prompt depois — e vai precisar.
