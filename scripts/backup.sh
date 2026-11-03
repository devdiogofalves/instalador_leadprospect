#!/bin/bash
# Backup completo do LeadsBooster (Supabase self-hosted + Evolution API + Frontend)
set -e
BACKUP_DIR="/opt/leadsbooster-backup/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "=== 1. Backup do banco de dados ==="
docker exec supabase-db pg_dump -U postgres -d postgres > "$BACKUP_DIR/database.sql"

echo "=== 2. Backup do Supabase config ==="
cp /tmp/supabase-project/.env "$BACKUP_DIR/supabase.env"
cp /tmp/supabase-project/docker-compose.yml "$BACKUP_DIR/supabase-docker-compose.yml"

echo "=== 3. Backup das Edge Functions ==="
cp -r /tmp/supabase-project/volumes/functions "$BACKUP_DIR/functions"

echo "=== 4. Backup do Evolution API ==="
cp /opt/evolution-api/.env "$BACKUP_DIR/evolution.env"
cp /opt/evolution-api/docker-compose.yml "$BACKUP_DIR/evolution-docker-compose.yml"

echo "=== 5. Backup do Frontend ==="
cp -r /opt/leadsbooster "$BACKUP_DIR/leadsbooster-src"
cp -r /var/www/leadsbooster "$BACKUP_DIR/leadsbooster-dist"

echo "=== Backup concluído em $BACKUP_DIR ==="
ls -la "$BACKUP_DIR"
