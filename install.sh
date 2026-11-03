#!/bin/bash
# ============================================================================
# LeadsBooster - Auto-Installer Completo
# Instala tudo do zero em uma VPS Ubuntu 22.04+
# Uso: bash install.sh
# ============================================================================
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ============================================================================
# CONFIGURAÇÃO - EDITE AQUI
# ============================================================================
DOMAIN="${DOMAIN:-prospecta.contatte.com.br}"
VPS_IP="${VPS_IP:-144.91.94.83}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
JWT_SECRET="${JWT_SECRET:-rSoD00OiP+Xh+Q2NhxCrZVhjvzvgpKHc9LgByaHx}"
EVOLUTION_DB_PASSWORD="${EVOLUTION_DB_PASSWORD:-evolution_pass}"
EVOLUTION_API_KEY="${EVOLUTION_API_KEY:-evolution-api-key-change-me}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@admin.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-132210}"

# ============================================================================
# 1. INSTALAR DEPENDÊNCIAS
# ============================================================================
log "=== 1. Instalando dependências ==="
apt-get update -qq
apt-get install -y -qq curl git nginx nodejs npm docker.io docker-compose-v2 2>/dev/null || {
    # Docker Compose v2
    apt-get install -y -qq docker-compose-plugin
}
systemctl enable docker
systemctl start docker

# ============================================================================
# 2. CLONAR REPOSITÓRIO
# ============================================================================
log "=== 2. Clonando repositório ==="
INSTALL_DIR="/opt/leadsbooster-install"
rm -rf "$INSTALL_DIR"
git clone https://github.com/devdiogofalves/Lead-Prospector-Pro---DIOGO.git "$INSTALL_DIR"
cd "$INSTALL_DIR"

# ============================================================================
# 3. GERAR CHAVES JWT
# ============================================================================
log "=== 3. Gerando chaves JWT ==="
ANON_KEY=$(python3 -c "
import jwt, datetime
secret = '$JWT_SECRET'
payload = {'role': 'anon', 'iss': 'supabase', 'iat': int(datetime.datetime.now().timestamp()), 'exp': int((datetime.datetime.now() + datetime.timedelta(days=3650)).timestamp())}
print(jwt.encode(payload, secret, algorithm='HS256'))
")
SERVICE_ROLE_KEY=$(python3 -c "
import jwt, datetime
secret = '$JWT_SECRET'
payload = {'role': 'service_role', 'iss': 'supabase', 'iat': int(datetime.datetime.now().timestamp()), 'exp': int((datetime.datetime.now() + datetime.timedelta(days=3650)).timestamp())}
print(jwt.encode(payload, secret, algorithm='HS256'))
")
log "ANON_KEY e SERVICE_ROLE_KEY geradas"

# ============================================================================
# 4. CONFIGURAR SUPABASE
# ============================================================================
log "=== 4. Configurando Supabase ==="
SUPABASE_DIR="/tmp/supabase-project"
mkdir -p "$SUPABASE_DIR"

# .env
cat > "$SUPABASE_DIR/.env" << EOF
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
JWT_SECRET=$JWT_SECRET
ANON_KEY=$ANON_KEY
SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
SUPABASE_URL=http://api-gw:8000
SITE_URL=https://$DOMAIN
API_EXTERNAL_URL=https://$DOMAIN
FUNCTIONS_VERIFY_JWT=false
WEBHOOK_QUALIFICATION_SECRET=$(openssl rand -hex 32)
EVOLUTION_API_URL=http://evolution-api:8080
EOF

# docker-compose.yml
cp "$INSTALL_DIR/supabase/docker-compose.yml" "$SUPABASE_DIR/docker-compose.yml"

# Edge functions
mkdir -p "$SUPABASE_DIR/volumes/functions"
cp -r "$INSTALL_DIR/supabase/functions"/* "$SUPABASE_DIR/volumes/functions/"

# Iniciar Supabase
cd "$SUPABASE_DIR"
docker compose up -d
log "Aguardando Supabase iniciar..."
sleep 30

# ============================================================================
# 5. CORRIGIR GoTrue (porta + token columns)
# ============================================================================
log "=== 5. Corrigindo GoTrue ==="
# Mover porta para service level (se necessário)
# Atualizar token columns NULL para ''
docker exec supabase-db psql -U postgres -d postgres -c "
UPDATE auth.users SET
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change_token_current = COALESCE(email_change_token_current, '')
WHERE confirmation_token IS NULL OR recovery_token IS NULL;
" 2>/dev/null || true

# ============================================================================
# 6. CRIAR USUÁRIO ADMIN
# ============================================================================
log "=== 6. Criando usuário admin ==="
ADMIN_HASH=$(python3 -c "import bcrypt; print(bcrypt.hashpw(b'$ADMIN_PASSWORD', bcrypt.gensalt()).decode())")
docker exec supabase-db psql -U postgres -d postgres -c "
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, phone_confirmed_at, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '$ADMIN_EMAIL', '$ADMIN_HASH', now(), now(), '{\"is_admin\": true}', '{\"is_admin\": true}', now(), now())
ON CONFLICT (email) DO NOTHING;
" 2>/dev/null || true

# Atribuir role admin
docker exec supabase-db psql -U postgres -d postgres -c "
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = '$ADMIN_EMAIL'
ON CONFLICT DO NOTHING;
" 2>/dev/null || true

# ============================================================================
# 7. CONFIGURAR EVOLUTION API
# ============================================================================
log "=== 7. Configurando Evolution API ==="
mkdir -p /opt/evolution-api

# Criar user e database
docker exec supabase-db psql -U postgres -d postgres -c "CREATE USER evolution WITH PASSWORD '$EVOLUTION_DB_PASSWORD';" 2>/dev/null || true
docker exec supabase-db psql -U postgres -d postgres -c "CREATE DATABASE evolution_db OWNER evolution;" 2>/dev/null || true

# .env
cat > /opt/evolution-api/.env << EOF
AUTHENTICATION_API_KEY=$EVOLUTION_API_KEY
SERVER_URL=http://$VPS_IP:8080
DATABASE_PROVIDER=postgresql
DATABASE_CONNECTION_URI=postgresql://evolution:$EVOLUTION_DB_PASSWORD@supabase-db:5432/evolution_db?schema=evolution_api
DATABASE_CONNECTION_CLIENT_NAME=evolution_exchange
DATABASE_SAVE_DATA_INSTANCE=true
DATABASE_SAVE_DATA_NEW_MESSAGE=true
DATABASE_SAVE_MESSAGE=true
DATABASE_DELETE_MESSAGE=true
CACHE_REDIS_ENABLED=false
CACHE_REDIS_URI=redis://redis:6379
LOG_LEVEL=info
EOF

# docker-compose.yml
cp "$INSTALL_DIR/evolution/docker-compose.yml" /opt/evolution-api/docker-compose.yml

# Iniciar
cd /opt/evolution-api
docker compose up -d
sleep 15
docker network connect supabase_default evolution-api 2>/dev/null || true

# ============================================================================
# 8. CONFIGURAR FRONTEND
# ============================================================================
log "=== 8. Configurando Frontend ==="
cd "$INSTALL_DIR/frontend"
cat > .env << EOF
VITE_SUPABASE_URL=https://$DOMAIN
VITE_SUPABASE_PUBLISHABLE_KEY=$ANON_KEY
EOF

npm install --silent
npm run build

mkdir -p /var/www/leadsbooster
cp -r dist/* /var/www/leadsbooster/

# ============================================================================
# 9. CONFIGURAR NGINX
# ============================================================================
log "=== 9. Configurando Nginx ==="
cat > /etc/nginx/sites-available/leadsbooster << EOF
server {
    listen 80;
    server_name $DOMAIN;
    root /var/www/leadsbooster;
    index index.html;
    location / { try_files \$uri \$uri/ /index.html; }
    location /functions/ { proxy_pass http://127.0.0.1:8000; proxy_set_header Host \$host; }
    location /auth/ { proxy_pass http://127.0.0.1:8000; proxy_set_header Host \$host; }
    location /rest/ { proxy_pass http://127.0.0.1:8000; proxy_set_header Host \$host; }
    location /storage/ { proxy_pass http://127.0.0.1:8000; proxy_set_header Host \$host; }
    location /realtime/ { proxy_pass http://127.0.0.1:8000; proxy_set_header Upgrade \$http_upgrade; proxy_set_header Connection "upgrade"; }
}
EOF

ln -sf /etc/nginx/sites-available/leadsbooster /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

# ============================================================================
# 10. CONFIGURAR PG_CRON
# ============================================================================
log "=== 10. Configurando pg_cron ==="
docker exec supabase-db psql -U postgres -d postgres -c "CREATE EXTENSION IF NOT EXISTS pg_cron;" 2>/dev/null || true
docker exec supabase-db psql -U postgres -d postgres -c "CREATE EXTENSION IF NOT EXISTS pg_net;" 2>/dev/null || true

docker exec supabase-db psql -U postgres -d postgres -c "
SELECT cron.schedule('qualification-worker', '* * * * *', \$\$
  SELECT net.http_post(
    url := 'https://$DOMAIN/functions/v1/qualification-worker',
    headers := '{\"Authorization\": \"Bearer $SERVICE_ROLE_KEY\", \"apikey\": \"$SERVICE_ROLE_KEY\", \"Content-Type\": \"application/json\"}'::jsonb,
    body := '{}'::jsonb
  )
\$\$);
" 2>/dev/null || true

# ============================================================================
# 11. CONFIGURAR EVOLUTION_CONFIG (admin)
# ============================================================================
log "=== 11. Configurando Evolution Config no banco ==="
sleep 5
docker exec supabase-db psql -U postgres -d postgres -c "
INSERT INTO public.evolution_config (url, api_key)
VALUES ('http://$VPS_IP:8080', '$EVOLUTION_API_KEY')
ON CONFLICT DO NOTHING;
" 2>/dev/null || true

# ============================================================================
# 12. CRIAR INSTÂNCIA WHATSAPP (placeholder)
# ============================================================================
log "=== 12. Criando registro de instância WhatsApp ==="
docker exec supabase-db psql -U postgres -d postgres -c "
INSERT INTO public.whatsapp_instances (user_id, instance_name, mandrack_instance_token, status, active)
SELECT id, 'chip1admin', '$EVOLUTION_API_KEY', 'open', true
FROM auth.users WHERE email = '$ADMIN_EMAIL'
ON CONFLICT DO NOTHING;
" 2>/dev/null || true

# ============================================================================
# FINALIZAÇÃO
# ============================================================================
log "=== INSTALAÇÃO CONCLUÍDA ==="
echo ""
echo "============================================"
echo "  LeadsBooster instalado com sucesso!"
echo "============================================"
echo "  URL: https://$DOMAIN"
echo "  Admin: $ADMIN_EMAIL / $ADMIN_PASSWORD"
echo "  Evolution API: http://$VPS_IP:8080/manager"
echo "  Evolution API Key: $EVOLUTION_API_KEY"
echo "============================================"
echo ""
echo "Próximos passos:"
echo "1. Acesse https://$DOMAIN e faça login"
echo "2. Vá em /admin → Evolution e configure URL/API Key"
echo "3. Vá em /whatsapp e crie uma instância"
echo "4. Escaneie o QR code"
echo "5. Configure SSL (certbot) para HTTPS"
echo ""
