#!/usr/bin/env bash
# Gera dist/artifact.html a partir de index.html.
# O publicador de Artifacts injeta o próprio <!doctype>/<html>/<head>/<body>,
# então aqui removemos essa casca e mantemos só <title>, <style> e o conteúdo.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p dist
sed -e '/<!DOCTYPE html>/d' \
    -e '/^<html lang="pt-BR">$/d' \
    -e '/^<head>$/d' \
    -e '/^<meta /d' \
    -e '/^<\/head>$/d' \
    -e '/^<body>$/d' \
    -e '/^<\/body>$/d' \
    -e '/^<\/html>$/d' \
    index.html > dist/artifact.html

# Injeta o retrato do ClickUp nos dois arquivos. A página publicada não
# declara conector — declarar impede o compartilhamento por link — então
# ela leva os dados dentro. Para atualizar a foto: regenerar
# dados/clickup.json e rebuildar.
mkdir -p dist/site
python3 - <<'PY'
import io
marca='const CU_RETRATO=null; /*[[RETRATO]]*/'
dados=io.open('dados/clickup.json',encoding='utf-8').read().strip()
for alvo,origem in [('dist/artifact.html',None),('dist/site/index.html','index.html')]:
    s=io.open(origem or alvo,encoding='utf-8').read()
    assert s.count(marca)==1, 'marcador do retrato nao encontrado em '+alvo
    io.open(alvo,'w',encoding='utf-8').write(s.replace(marca,'const CU_RETRATO='+dados+';'))
PY

# A rota que serve o planejamento em texto vai junto para a Vercel.
mkdir -p dist/site/api
cp api/tarefas.mjs dist/site/api/tarefas.mjs

echo "dist/artifact.html  ($(wc -l < dist/artifact.html) linhas) — para o Artifact"
echo "dist/site/index.html ($(wc -l < dist/site/index.html) linhas) — para a Vercel"
echo "dist/site/api/tarefas.mjs — rota /api/tarefas"
