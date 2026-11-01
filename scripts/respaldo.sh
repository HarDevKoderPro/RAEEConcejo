#!/usr/bin/env bash
# Respaldo diario de la base del Inventario RAEE en el VPS (CLAUDE.md §10.2).
# Copia en caliente dentro del contenedor y la saca a ~/backups/raee. Conserva 14 días.
# Cron (02:00):  0 2 * * * /opt/apps/raee/scripts/respaldo.sh >> $HOME/backups/raee/respaldo.log 2>&1
set -euo pipefail

CONTENEDOR="${CONTENEDOR:-raee-app-1}"
DESTINO="${DESTINO:-$HOME/backups/raee}"
DIAS="${DIAS:-14}"
FECHA="$(date +%F)"
TMP="/tmp/raee-respaldo.db"

mkdir -p "$DESTINO"
chmod 700 "$DESTINO"

docker exec "$CONTENEDOR" node scripts/respaldo.js "$TMP"
docker cp "$CONTENEDOR:$TMP" "$DESTINO/raee-$FECHA.db"
docker exec "$CONTENEDOR" rm -f "$TMP"
chmod 600 "$DESTINO/raee-$FECHA.db"

find "$DESTINO" -name 'raee-*.db' -mtime "+$DIAS" -delete
echo "$(date '+%F %T') respaldo OK: $DESTINO/raee-$FECHA.db"
