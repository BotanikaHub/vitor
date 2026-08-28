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

# Injeta o retrato do ClickUp. A página publicada não declara conector —
# declarar impede o compartilhamento por link — então ela leva os dados
# dentro. Para atualizar a foto: regenerar dados/clickup.json e rebuildar.
python3 - <<'PY'
import io
alvo='dist/artifact.html'
s=io.open(alvo,encoding='utf-8').read()
marca='const CU_RETRATO=null; /*[[RETRATO]]*/'
assert s.count(marca)==1, 'marcador do retrato não encontrado'
dados=io.open('dados/clickup.json',encoding='utf-8').read().strip()
io.open(alvo,'w',encoding='utf-8').write(s.replace(marca,'const CU_RETRATO='+dados+';'))
PY

echo "dist/artifact.html gerado ($(wc -l < dist/artifact.html) linhas)"
