#!/usr/bin/env bash
# =====================================================================
# MPARFUM - Restauración de un resguardo
# Uso:   ./restore.sh ARCHIVO.archive.gz [URI] [BASE_DESTINO]
#
#   BASE_DESTINO = mparfum          -> reemplaza la base productiva (--drop)
#   BASE_DESTINO = mparfum_restore  -> restaura en una base de prueba para
#                                      verificar el resguardo sin tocar producción
# =====================================================================
set -euo pipefail

ARCHIVO="${1:?Indicar el archivo .archive.gz a restaurar}"
URI="${2:-mongodb://localhost:27017}"
DESTINO="${3:-mparfum_restore}"

# 1) Integridad del archivo
if [ -f "$ARCHIVO.sha256" ]; then
  sha256sum -c "$ARCHIVO.sha256" || { echo "El archivo está corrupto, se cancela."; exit 1; }
fi

# 2) Restauración
OPCIONES=(--uri="$URI" --gzip --archive="$ARCHIVO" --drop --nsInclude="mparfum.*")
if [ "$DESTINO" != "mparfum" ]; then
  # Copia de prueba: se renombra la base para no tocar producción
  OPCIONES+=(--nsFrom="mparfum.*" --nsTo="$DESTINO.*")
elif [[ "$ARCHIVO" == *_oplog.archive.gz ]]; then
  # Restauración real de un resguardo con oplog: se reaplica el oplog para
  # llegar al instante exacto en que terminó el dump
  OPCIONES=(--uri="$URI" --gzip --archive="$ARCHIVO" --drop --oplogReplay)
fi
mongorestore "${OPCIONES[@]}"

# 3) Verificación: compara cantidad de documentos e índices con la base original
if [ "$DESTINO" != "mparfum" ]; then
  mongosh "$URI" --quiet --eval "var DESTINO='$DESTINO'" "$(dirname "$0")/verificar_restore.js"
fi
