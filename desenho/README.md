# O desenho da Central

As telas do sistema, desenhadas antes de programar. Depois de três
versões recusadas, a regra passou a ser esta: o Vitor recusa num
desenho, não num deploy.

Publicado em
https://claude.ai/code/artifact/1ea3a252-b28d-4c2c-92a4-3a0c21579afc

## A estrutura que estas telas assumem

Veio das respostas dele, não do meu palpite:

- **Marca primeiro.** Ela fica no topo da barra lateral e manda em tudo
  abaixo. Trocar de marca troca metas, campanhas, tarefas, conteúdo e
  atendimento de uma vez.
- **Início é a área da pessoa**, não um painel genérico. Quem é da
  Gestão vê carga da equipe; quem é do Design veria as peças dele.
- **Quatro módulos novos**: Resultado, Conteúdo, Atendimento, Creators.

## Os arquivos

| Arquivo | Tela |
|---|---|
| `Main.dc.html` | Início — a minha área |
| `Resultado.dc.html` | Faturamento por canal e por campanha |
| `Campanhas.dc.html` | Com data, perpétuo e projetos |
| `Tarefas.dc.html` | O quadro (na VermeFree, para mostrar a troca de marca) |
| `Conteudo.dc.html` | Calendário editorial |
| `Atendimento.dc.html` | Fila, carrinho abandonado, recuperação |
| `Creators.dc.html` | Entregas, custo e autorização de imagem |
| `canvas.json` | Onde cada tela fica no canvas, e as anotações |

Os números são os reais da operação — metas de setembro, os canais do
planejador, os dados da reunião de KPI de 03/09, as pessoas e as
campanhas do ClickUp. Desenho com dado de mentira não deixa ninguém
julgar nada.

## Refazer

```bash
python3 telas1.py && python3 telas2.py && python3 telas3.py && python3 telas4.py
```

`gerar.py` guarda a casca (barra lateral, topo, folha de estilo) que os
sete arquivos repetem — cada `.dc.html` precisa ser independente, então
a casca é escrita uma vez e injetada em todos.

Depois, o passo que monta o canvas está no histórico do commit que
criou esta pasta.
