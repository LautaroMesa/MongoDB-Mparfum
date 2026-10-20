#!/usr/bin/env bash
# =====================================================================
# MPARFUM - Resguardo de la base con mongodump
# Uso:   ./backup.sh [URI] [DIRECTORIO_DESTINO]
# Ej.:   ./backup.sh "mongodb://localhost:27017" /var/backups/mparfum
# Programado con cron (ver crontab.txt).
#
# Política (detalle en docs/03_politica_resguardo.md):
#   - diario    : se conservan los últimos 7
#   - semanal   : (domingos) se conservan las últimas 4 semanas
#   - mensual   : (día 1) se conservan los últimos 12 meses
# Requiere MongoDB Database Tools (mongodump / mongorestore).
# =====================================================================
set -euo pipefail

URI="${1:-mongodb://localhost:27017}"
DESTINO="${2:-$(dirname "$0")/resguardos}"
BASE="mparfum"
FECHA="$(date +%Y-%m-%d_%H%M)"

# Tipo de copia según el día
if [ "$(date +%d)" = "01" ]; then TIPO="mensual"; RETENCION_DIAS=365
elif [ "$(date +%u)" = "7" ]; then TIPO="semanal"; RETENCION_DIAS=28
else TIPO="diario"; RETENCION_DIAS=7
fi

mkdir -p "$DESTINO/$TIPO"
LOG="$DESTINO/backup.log"

# Si el servidor es un replica set se incluye el oplog: el resguardo queda
# consistente a un único instante aunque haya escrituras durante el dump.
# (--oplog sólo se admite en un dump de toda la instancia, no de una base.)
ES_RS=$(mongosh "$URI" --quiet --eval 'db.hello().setName ? 1 : 0')
if [ "$ES_RS" = "1" ]; then
  ARCHIVO="$DESTINO/$TIPO/${BASE}_${FECHA}_oplog.archive.gz"
  echo "[$(date '+%F %T')] Inicio resguardo $TIPO (con oplog) -> $ARCHIVO" | tee -a "$LOG"
  mongodump --uri="$URI" --oplog --gzip --archive="$ARCHIVO" 2>>"$LOG"
else
  ARCHIVO="$DESTINO/$TIPO/${BASE}_${FECHA}.archive.gz"
  echo "[$(date '+%F %T')] Inicio resguardo $TIPO -> $ARCHIVO" | tee -a "$LOG"
  mongodump --uri="$URI" --db="$BASE" --gzip --archive="$ARCHIVO" 2>>"$LOG"
fi

# Suma de verificación para detectar archivos corruptos al restaurar
sha256sum "$ARCHIVO" > "$ARCHIVO.sha256"
echo "[$(date '+%F %T')] OK - $(du -h "$ARCHIVO" | cut -f1)" | tee -a "$LOG"

# Rotación: se borran los resguardos que superan la retención de su tipo
find "$DESTINO/$TIPO" -name "${BASE}_*.archive.gz*" -mtime +"$RETENCION_DIAS" -print -delete | sed 's/^/  borrado: /' | tee -a "$LOG"

# Copia fuera del servidor (regla 3-2-1). Descomentar y configurar:
# rclone copy "$ARCHIVO" gdrive:mparfum-backups/$TIPO/
# aws s3 cp "$ARCHIVO" s3://mparfum-backups/$TIPO/
