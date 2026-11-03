# LeadsBooster - Manual de Instalação Completa

## Pré-requisitos
- VPS Ubuntu 22.04+ com Docker e Docker Compose
- Domínio apontando para o VPS (Cloudflare DNS)
- Mínimo 4GB RAM, 2 vCPUs, 40GB SSD

## 1. Clonar repositório
```bash
git clone https://github.com/devdiogofalves/Lead-Prospector-Pro---DIOGO.git
cd Lead-Prospector-Pro---DIOGO
```

## 2. Configurar Supabase Self-Hosted
```bash
# Copiar config
cp supabase/.env.example /tmp/supabase-project/.env
# Editar com suas credenciais
nano /tmp/supabase-project/.env

# Copiar docker-compose
cp supabase/docker-compose.yml /tmp/supabase-project/docker-compose.yml

# Copiar edge functions
cp -r supabase/functions /tmp/supabase-project/volumes/

# Iniciar
cd /tmp/supabase-project && docker compose up -d
```

## 3. Configurar Evolution API
```bash
mkdir -p /opt/evolution-api
cp evolution/.env.example /opt/evolution-api/.env
# Editar com suas credenciais
nano /opt/evolution-api/.env

cp evolution/docker-compose.yml /opt/evolution-api/docker-compose.yml
cd /opt/evolution-api && docker compose up -d

# Conectar à rede do Supabase
docker network connect supabase_default evolution-api
```

## 4. Criar banco de dados Evolution
```bash
docker exec supabase-db psql -U postgres -c "CREATE USER evolution WITH PASSWORD 'your_password';"
docker exec supabase-db psql -U postgres -c "CREATE DATABASE evolution_db OWNER evolution;"
```

## 5. Configurar Frontend
```bash
cd frontend
cp .env.example .env
# Editar com suas credenciais
nano .env

npm install
npm run build
cp -r dist/* /var/www/leadsbooster/
```

## 6. Configurar Nginx
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    root /var/www/leadsbooster;
    index index.html;
    location / { try_files $uri $uri/ /index.html; }
    location /functions/ { proxy_pass http://127.0.0.1:8000; }
    location /auth/ { proxy_pass http://127.0.0.1:8000; }
    location /rest/ { proxy_pass http://127.0.0.1:8000; }
}
```

## 7. Configurar pg_cron
```sql
-- No psql do Supabase
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Job para qualification-worker (a cada minuto)
SELECT cron.schedule('qualification-worker', '* * * * *', $$
  SELECT net.http_post(
    url := 'https://yourdomain.com/functions/v1/qualification-worker',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY", "apikey": "YOUR_SERVICE_ROLE_KEY", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  )
$$);
```

## 8. Configurar Webhook (automático)
O webhook é configurado automaticamente ao criar uma instância WhatsApp no painel admin.

## Credenciais padrão
- Admin: admin@admin.com / 132210
- Evolution API Key: (configurada no .env)

## Troubleshooting
- GoTrue port 9999 deve estar exposta no docker-compose (não dentro de environment)
- auth.users token columns devem ser '' (empty string), não NULL
- RLS policies devem usar has_role(auth.uid(), 'admin')
- Frontend deve usar o JWT anon key, não Supabase Cloud key
