#!/bin/sh
# Respaldo automático de la base de datos (PostgreSQL).
#
#   backup.sh            -> servicio: hace un respaldo cada día a la hora indicada (modo normal)
#   backup.sh now        -> hace un respaldo ahora mismo
#   backup.sh restore X  -> restaura el respaldo X (nombre del archivo dentro de la carpeta de respaldos)
#
# Variables (se configuran en el archivo .env, ver .env.example):
#   BACKUP_TIME  hora diaria del respaldo, formato 24 h (por defecto 18:30)
#   BACKUP_KEEP  cuántos respaldos se conservan; los más viejos se borran (por defecto 20)
set -eu
umask 022

DIR=/respaldos
KEEP="${BACKUP_KEEP:-20}"
TIME="${BACKUP_TIME:-18:30}"
CHECK_EVERY=300 # Cada cuántos segundos revisa si toca respaldar

log() { echo "[respaldo $(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# Valores inválidos en el .env no deben dejar el servicio roto
case "$KEEP" in ''|*[!0-9]*) KEEP=20 ;; esac
[ "$KEEP" -ge 1 ] || KEEP=20
case "$TIME" in [0-2][0-9]:[0-5][0-9]) ;; *) log "BACKUP_TIME '$TIME' no es válida (use HH:MM); se usa 18:30"; TIME=18:30 ;; esac

to_minutes() { echo $(( $(expr "${1%:*}" + 0) * 60 + $(expr "${1#*:}" + 0) )); }

# ¿Toca hacer un respaldo?  due HORA_ACTUAL FECHA_HOY FECHA_DEL_ULTIMO EDAD_EN_SEGUNDOS_DEL_ULTIMO
due() {
  now_hm=$1; today=$2; newest_date=$3; age=$4
  [ -n "$newest_date" ] || return 0   # Todavía no hay ningún respaldo
  [ "$age" -le 86400 ] || return 0    # Más de 24 h sin respaldar (por ejemplo, el equipo estuvo apagado)
  if [ "$(to_minutes "$now_hm")" -ge "$(to_minutes "$TIME")" ] && [ "$newest_date" != "$today" ]; then
    return 0                          # Ya pasó la hora de hoy y hoy no se ha respaldado
  fi
  return 1
}

newest() { ls -1 "$DIR"/respaldo_*.dump 2>/dev/null | sort | tail -n 1; }

prune() {
  ls -1 "$DIR"/respaldo_*.dump 2>/dev/null | sort -r | tail -n +"$((KEEP + 1))" | while read -r old; do
    rm -f "$old" && log "Respaldo antiguo eliminado: $(basename "$old")"
  done
}

run_backup() {
  mkdir -p "$DIR"
  stamp=$(date +%Y-%m-%d_%H%M)
  tmp="$DIR/.respaldo_$stamp.tmp"
  final="$DIR/respaldo_$stamp.dump"
  # Se escribe en un archivo temporal y se verifica antes de darlo por bueno
  if pg_dump --format=custom --file="$tmp" && pg_restore --list "$tmp" >/dev/null; then
    chmod 644 "$tmp"
    mv "$tmp" "$final"
    log "Respaldo creado: respaldo_$stamp.dump ($(du -h "$final" | cut -f1))"
    prune
    return 0
  fi
  rm -f "$tmp"
  log "ERROR: no se pudo crear el respaldo"
  return 1
}

restore() {
  [ -n "${1:-}" ] || { echo "Indica el nombre del archivo a restaurar."; exit 1; }
  file="$DIR/$(basename "$1")"
  [ -f "$file" ] || { echo "No existe $file"; exit 1; }
  log "Restaurando $(basename "$file") ..."
  # Todo o nada: si algo falla, la base queda como estaba
  pg_restore --clean --if-exists --no-owner --single-transaction --dbname="$PGDATABASE" "$file"
  log "Restauración terminada."
}

daemon() {
  log "Servicio de respaldos iniciado: todos los días a las $TIME (zona horaria $(date +%Z)); se conservan los últimos $KEEP en $DIR"
  while true; do
    last=$(newest || true)
    if [ -n "$last" ]; then
      name=$(basename "$last"); last_date=$(echo "${name#respaldo_}" | cut -c1-10)
      age=$(( $(date +%s) - $(stat -c %Y "$last") ))
    else
      last_date=""; age=0
    fi
    if due "$(date +%H:%M)" "$(date +%Y-%m-%d)" "$last_date" "$age"; then
      run_backup || true # Si falla, reintenta en la próxima revisión
    fi
    sleep "$CHECK_EVERY"
  done
}

[ "${BACKUP_SOURCE_ONLY:-}" = "1" ] && return 0 2>/dev/null || true

case "${1:-daemon}" in
  daemon) daemon ;;
  now) run_backup ;;
  restore) restore "${2:-}" ;;
  *) echo "Uso: backup.sh [daemon|now|restore ARCHIVO]"; exit 1 ;;
esac
