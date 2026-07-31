#!/usr/bin/env bash
#
# Copia de seguridad de Pathfinder VTT: base de datos + mapas subidos.
#
# Pensado para ejecutarse por cron en el SERVIDOR (ver DESPLIEGUE.md §7).
# Salva las dos cosas que importan y que Coolify no respalda por su cuenta:
#   1. La base de datos PostgreSQL (pg_dump).
#   2. El volumen de mapas subidos (uploads), que NO está en la base de datos.
# Además borra las copias más viejas que RETENER_DIAS para no llenar el disco.
#
set -euo pipefail

# ------------------------------------------------------------------ Ajustes --
# UUID del recurso en Coolify. Es el prefijo de los volúmenes y el nombre de
# proyecto de compose (se ve en la URL del recurso en Coolify y con
# `docker volume ls`). Si algún día recreas el recurso, actualiza esta línea.
PROYECTO="${COOLIFY_PROJECT:-fkbyauuwmhrxzd2zerr9b8fl}"

DESTINO="${BACKUP_DIR:-/root/backups/pathfinder}"   # dónde se guardan las copias
RETENER_DIAS="${BACKUP_RETENER_DIAS:-14}"           # cuántos días conservar
DB_USER="${DB_USER:-pathfinder}"
DB_NAME="${DB_NAME:-pathfinder}"

# --------------------------------------------------------------------- Obra --
FECHA="$(date +%F-%H%M)"
mkdir -p "$DESTINO"

# Localiza el contenedor de postgres por sus ETIQUETAS de compose. El nombre
# exacto cambia en cada despliegue; las etiquetas (proyecto + servicio) no.
PG_CONTAINER="$(docker ps -q \
  -f "label=com.docker.compose.project=$PROYECTO" \
  -f "label=com.docker.compose.service=postgres")"

if [ -z "$PG_CONTAINER" ]; then
  echo "ERROR: no encuentro el contenedor de postgres del proyecto $PROYECTO" >&2
  echo "       ¿Está corriendo la app? Revisa 'docker ps' y el UUID PROYECTO." >&2
  exit 1
fi

# 1. Base de datos → un .sql.gz con fecha
docker exec "$PG_CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" \
  | gzip > "$DESTINO/db-$FECHA.sql.gz"

# 2. Mapas subidos → un .tar.gz del volumen (montado en solo lectura)
docker run --rm \
  -v "${PROYECTO}_uploads:/datos:ro" \
  -v "$DESTINO:/salida" \
  alpine tar czf "/salida/uploads-$FECHA.tar.gz" -C /datos .

# 3. Rotación: fuera las copias más viejas que RETENER_DIAS
find "$DESTINO" -name 'db-*.sql.gz'      -mtime "+$RETENER_DIAS" -delete
find "$DESTINO" -name 'uploads-*.tar.gz' -mtime "+$RETENER_DIAS" -delete

echo "[$(date +%F' '%T)] Copia hecha en $DESTINO (db-$FECHA.sql.gz, uploads-$FECHA.tar.gz)"
