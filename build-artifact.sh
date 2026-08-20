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
echo "dist/artifact.html gerado ($(wc -l < dist/artifact.html) linhas)"
