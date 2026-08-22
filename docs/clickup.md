# Como o planejamento vira tarefa no ClickUp

Observado direto do workspace em 22/08/2026, na lista `BB | Dia D Botanika (07/08)`
— a mesma campanha que serve de exemplo no app. Não é proposta: é o que já está
rodando lá.

## Onde as coisas moram

Tudo no space **Marketing**, com prefixo por loja: `BB |` Botanika, `VF |`
VermeFree, `ANS |` a terceira operação.

| Pasta | O que tem dentro |
|---|---|
| `{Loja} \| Campanhas Ativas` | uma lista por campanha, com a data no nome — `BB \| Dia D Botanika (07/08)`, `BB \| Semana Fitness (11-15/08)` |
| `{Loja} \| Campanhas Concluídas` | para onde a lista vai quando acaba |
| `{Loja} \| Modelos de Campanha` | um modelo por formato |
| `{Loja} \| Áreas` | Estratégia, Gestão, Administrativo, IA, Infra, Social Media, Creators, Tráfego, Atendimento |
| `{Loja} \| Pasta do sprint` | listas semanais — `Sprint 4 (24/8/26 - 30/8/26)` |
| `{Loja}` | `Lista modelo` e `Visualização do Planejamento do Mês` |

Os modelos são **os mesmos formatos do assistente do app**: Dia D, Semana
Temática, Perpétuo, Ações de Recompra, Ações de Gap. O `TIPOS` do `index.html` e
a pasta de modelos são a mesma taxonomia — se um mudar, o outro precisa mudar.

## O formato de uma lista de campanha

Duas camadas.

**Tarefas-pai são os canais**, com emoji, sem data e sem responsável. No Dia D:
`📧 E-mail Marketing (Base Antiga)`, `💬 WhatsApp Grupos`, `📲 WhatsApp API`,
`📱 Instagram`, `🌐 Site / E-commerce`, `🚀 Tráfego Pago`, `🤝 Influencer`,
`📄 Materiais de Apoio (PDFs)`.

**As subtarefas são o trabalho**, cada uma com data, responsável e prioridade.

## O que o TAP não diz e o ClickUp diz

Três coisas que a conversa do ClickUp resolveu e que o gerador de TAP do app
ainda não sabe:

**1. "Pedro cria e Sarah programa" são duas tarefas, não uma.** A coluna
_Quem faz_ do cronograma descreve um revezamento, e no ClickUp ele vira um par:

```
Criar 8 mensagens de venda Dia D — grupos WhatsApp   → Pedro Lage
Programar 8 mensagens WhatsApp grupos para 07/08     → Sarah | Gestora de Automações
```

Vale para todos os canais com "X cria e Y programa". O mesmo padrão aparece em
aprovação: `Definir planejamento de feed Instagram` (Ítalo) →
`Aprovar planejamento de feed Instagram` (Gabriel).

**2. O nome da tarefa vem da célula do cronograma.** A célula `2 vendas` do
e-mail no dia 07/08 virou `Criar 2 e-mails de venda Dia D — base antiga` e
`Programar 2 e-mails de venda para 07/08`. A quantidade e a data saem direto da
grade — é por isso que preencher o cronograma com ritmo em vez de traços
importa.

**3. Prioridade sai da fase.** Dia da venda `urgent`, dias de preparação
`high`, materiais de apoio `normal`.

Status em uso: `fila`, `fazer`, `feito`, `dispensado`.

## Quem é quem

| ClickUp | No TAP |
|---|---|
| Pedro Lage | Pedro — cria conteúdo, mexe no site, sobe criativo |
| Sarah \| Gestora de Automações | Sarah — programa disparo de e-mail e WhatsApp |
| Ítalo Neves | Italo — Instagram |
| Joingle Pires | Joinny — influencers |
| Gabriel Ferreira | Gabriel — aprova |

## Se um dia gerar isso pelo app

O cronograma do TAP já tem canal, dia, quantidade e responsável, que é
exatamente uma subtarefa. O que falta mapear:

- desdobrar _Quem faz_ em criar/programar e aprovar quando houver dois nomes
- emoji e nome do canal-pai (o app tem `Criativos em vídeo` e
  `Criativos em imagem` separados; o ClickUp junta em `🚀 Tráfego Pago`)
- data da lista no nome, no formato `(07/08)` ou `(11-15/08)`
- criar dentro de `{Loja} | Campanhas Ativas`, não solto

Nada disso está implementado. Está escrito aqui para não se perder.
