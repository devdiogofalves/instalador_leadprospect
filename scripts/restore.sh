#!/bin/bash
# Restore do LeadsBooster a partir de um backup
set -e
if [ -z "$1" ]; then
  echo "Uso: $0 <diretorio_backup>"
  exit 1
fi
BACKUP_DIR="$1"

echo "=== 1. Restaurar Supabase config ==="
cp "$BACKUP_DIR/supabase.env" /tmp/supabase-project/.env
cp "$BACKUP_DIR/supabase-docker-compose.yml" /tmp/supabase-project/docker-compose.yml
cp -r "$BACKUP_DIR/functions"/* /tmp/supabase-project/volumes/functions/

echo "=== 2. Restaurar Evolution API ==="
cp "$BACKUP_DIR/evolution.env" /opt/evolution-api/.env
cp "$BACKUP_DIR/evolution-docker-compose.yml" /opt/evolution-api/docker-compose.yml

echo "=== 3. Restaurar Frontend ==="
cp -r "$BACKUP_DIR/leadsbooster-src"/* /opt/leadsbooster/
cp -r "$BACKUP_DIR/leadsbooster-dist"/* /var/www/leadsbooster/

echo "=== 4. Restaurar banco de dados ==="
docker exec -i supabase-db psql -U postgres -d postgres < "$BACKUP_DIR/database.sql"

echo "=== 5. Reiniciar containers ==="
cd /tmp/supabase-project && docker compose up -d
cd /opt/evolution-api && docker compose up -d

echo "=== Restore concluído ==="
