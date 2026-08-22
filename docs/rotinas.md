# Avisos de reunião no WhatsApp

Estado em 22/08/2026. Os textos abaixo já foram testados e aprovados — foram
enviados de verdade para o Vitor e ele validou.

## Como funciona hoje

O Vitor recebe as mensagens no WhatsApp pessoal e **encaminha** para os grupos
da equipe (Botanika e VermeFree). Por isso os textos são escritos falando com a
equipe, não com ele: dá pra encaminhar sem editar.

Isso é provisório. Assim que o número **Botanika - Gestor 1** entrar nos dois
grupos, o disparo passa a ir direto para os grupos e o Vitor sai do meio. O que
trava é a privacidade daquele número — "Quem pode me adicionar a grupos" precisa
estar em "Todos", senão o WhatsApp manda convite em vez de adicionar.

## Dados do envio

- Ferramenta: SendFlow, `send-text-message`
- `accountId`: `AqaNpdKwunL96p9gZnLc` — conta "Botanika - Gestor 1" (5531 97471868)
- `phoneNumber`: `5531993031383` — WhatsApp pessoal do Vitor

O número pessoal dele **não** está conectado a ferramenta nenhuma, e é pra
continuar assim: ele decidiu não expor as próprias conversas. Quem envia é o
número da empresa; ele só recebe.

## Reuniões

| | Daily | KPI |
|---|---|---|
| Quando | seg, ter, qua, sex | quinta |
| Horário | 9:15–10:00 no calendário, começa 9:20 | 9:15–11:00, começa 9:20 |
| Link | https://meet.google.com/qon-tpeo-cnr | https://meet.google.com/mpp-bhpv-vyd |

Quinta é KPI **no lugar** da daily — nunca as duas.

Os links são de conta Gmail pessoal, então **não existe acesso liberado**: o
Acesso rápido do Meet é exclusivo do Workspace, e só o organizador admite
participantes. Todo mundo bate na porta e o Vitor deixa entrar. Enquanto for
assim, avisar no grupo antes faz a entrada acontecer junta em vez de pingada.

## As duas rotinas da manhã

**Precisam ser criadas pela interface de Rotinas do claude.ai**, não daqui: uma
rotina criada por sessão não carrega o conector do SendFlow, e dispararia toda
manhã sem conseguir enviar. Na interface dá pra anexar o conector.

### Rotina 1 — aviso, 9:10 seg a sex

```
Envie uma mensagem de WhatsApp para o Vitor avisando que a reunião da manhã
começa às 9:20. Ele encaminha para os grupos da equipe, então o texto tem que
estar escrito para a equipe, pronto para encaminhar sem edição.

Use send-text-message do SendFlow com:
- accountId: AqaNpdKwunL96p9gZnLc
- phoneNumber: 5531993031383

Descubra que dia da semana é hoje em America/Sao_Paulo.

Se for QUINTA-FEIRA, envie exatamente:

Bom dia, time 👋

Hoje é dia de KPI — não tem daily. Começa 9:20 e vai até 11h, se organizem aí.

Já já mando o link.

Se for segunda, terça, quarta ou sexta, envie exatamente:

Bom dia, time 👋

Daily começa às 9:20. Já já mando o link.

Envie uma mensagem só, sem alterar o texto e sem acrescentar nada.
```

### Rotina 2 — link, 9:15 seg a sex

```
Envie o link da reunião da manhã para o Vitor no WhatsApp. Ele encaminha para
os grupos, então escreva para a equipe, pronto para encaminhar.

Use send-text-message do SendFlow com:
- accountId: AqaNpdKwunL96p9gZnLc
- phoneNumber: 5531993031383

Descubra que dia da semana é hoje em America/Sao_Paulo.

Se for QUINTA-FEIRA, envie exatamente:

Reunião de KPI 📊

👉 https://meet.google.com/mpp-bhpv-vyd

Cada setor traz seus indicadores. Entrem que já vamos começar.

Se for segunda, terça, quarta ou sexta, envie exatamente:

Daily de hoje 🎯

👉 https://meet.google.com/qon-tpeo-cnr

Entrem que já vamos começar.

Envie uma mensagem só, sem alterar o texto e sem acrescentar nada.
```

Cron das duas, em UTC (São Paulo é UTC-3): `10 12 * * 1-5` e `15 12 * * 1-5`.

Elas disparam em feriado também. Não tem calendário de feriado no meio —
quando atrapalhar, é pausar na mão.

## A terceira rotina, ainda não montada

Depois da reunião: ler a transcrição no Fireflies, montar as tarefas seguindo
`docs/clickup.md`, publicar uma página de revisão e mandar o link no WhatsApp.
O Vitor revisa e aprova **na própria página**, que sobe direto no ClickUp.

A aprovação não pode ser por resposta no WhatsApp: o SendFlow só envia, não tem
caixa de entrada, e não há como uma resposta acordar uma sessão.

Texto da mensagem, já aprovado:

```
Daily de hoje — N tarefas pra revisar ✅

Puxei da transcrição e montei seguindo o padrão do ClickUp: canal, responsável
e prazo já preenchidos.

Confere, ajusta o que estiver errado e aprova por aí:
👉 <link>

Nada sobe no ClickUp antes de você aprovar.
```

Falta, antes de montar:

1. **Ler uma transcrição real** e conferir a qualidade do português. Se a
   transcrição vier ruim, nada em cima dela se sustenta.
2. **Criar uma tarefa de teste no ClickUp** pela ferramenta, pra conhecer o
   formato exato da criação. Não dá pra publicar uma página com um botão que
   escreve no ClickUp sem ter visto uma criação real acontecer.

## Fireflies

Conta: `comercialvittorgutierrez@gmail.com` — a pessoal do Vitor, que é quem
organiza as reuniões. Conectado como MCP em `https://api.fireflies.ai/mcp`.

Pendências na configuração:

- **Idioma para Português.** É a mais crítica; em inglês a transcrição não serve.
- Captura pela **extensão do Chrome** com Auto-Capture, não pelo bot — o bot
  entra como participante e ficaria preso na sala de espera até ser admitido.
  Pelo celular, "Add to live meeting" no app, acionado no começo da call.
- Calendário não conectado (o Fireflies reporta "No integrations"). Com a
  captura pela extensão não é obrigatório.
- No plano gratuito o ilimitado depende de Auto-join e Share-all ligados. Não
  sabemos se a regra vale igual para captura por extensão — dá pra acompanhar
  pelos minutos consumidos, que o Fireflies devolve.

O conector cai da sessão às vezes. Religar o botão não resolve; só sessão nova.
