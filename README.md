# Botanika — Planejamento

Ferramenta interna de planejamento da Botanika Brasil. Um único HTML, sem build
e sem dependências: abre no navegador e roda.

Migrado dos artifacts do claude.ai para este repositório — a versão publicada lá
era a `v7`, que virou o `index.html` daqui.

## O que tem dentro

Quatro páginas, todas amarradas ao mês selecionado no topo:

| Página | Para quê |
| --- | --- |
| **Mapa mental** | Canvas no estilo Miro — nós em pílula, notas adesivas, formas, texto livre, zoom e undo/redo. É onde a estratégia do mês nasce. |
| **Mês** | Cartões de meta/verba/ROAS, calendário com uma barra por campanha e detalhe do que sai em cada dia. |
| **Semana** | Recorte semanal: campanhas ativas e o que sai por canal, dia a dia. |
| **Campanhas** | O TAP de cada campanha — sobre o evento, fases, cronograma por dia nos 11 canais e distribuição da meta por canal. Tudo editável no clique. |

## O fluxo que amarra tudo

No mapa, seleciona o nó do mês e clica no **+**. O assistente pergunta:

1. **Formato** — Dia D, Semana temática, Ações de gap, Ações de recompra, Perpétuo ou Outro.
2. **Tema**, quando é semana temática — reaproveita os temas já rodados ou cria um novo, que passa a ficar no catálogo.
3. **Datas, meta e verba** — as datas já vêm sugeridas pelo formato, e o resumo recalcula em tempo real quantos dias de cronograma saem, o ROAS implícito e quanto o mês soma contra a Meta 1.

Confirmando, nasce tudo de uma vez: pílula no mapa com a cor do formato, barra no
calendário, aba nova em Campanhas e o TAP inteiro montado com fases, cronograma e
metas por canal.

Dois atalhos que valem conhecer:

- Botão direito num nó comum → **Transformar em campanha**, pra quando a ideia foi
  rascunhada antes de virar campanha.
- Na aba do TAP → **Regerar cronograma**, pra quando as datas mudam depois.

## Rodando

```
open index.html          # macOS
xdg-open index.html      # Linux
```

## Publicando como Artifact

O publicador injeta a própria casca `<!doctype>/<html>/<head>/<body>`, então existe
um passo que remove essa casca do `index.html`:

```
./build-artifact.sh      # gera dist/artifact.html
```

Publique o `dist/artifact.html`. O `index.html` continua sendo a fonte — nunca
edite o `dist/`.

## Estado atual

Protótipo. **Não persiste nada** — o `D` mora em memória, e fechar a aba perde o
trabalho. Use *Exportar JSON* antes de sair e *Importar JSON* pra voltar. Colocar
persistência é o próximo passo óbvio.

## Constantes que valem revisar quando o time mudar

No topo do `<script>` do `index.html`:

- `TIPOS` — formatos de campanha, duração padrão e cor.
- `CANAIS` — os 11 canais do cronograma e quem faz cada um.
- `SPLIT` — como a meta se divide por canal (proporção tirada do Dia D de agosto).
- `temas` em `D` — catálogo de temas de semana temática.

## `historico/`

As versões anteriores (v1 a v6), como saíram do chat. Só referência — o que roda
é o `index.html`.
