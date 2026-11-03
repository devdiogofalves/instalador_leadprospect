# LeadsBooster - SaaS de Prospecção B2B

Sistema completo de prospecção B2B com IA, WhatsApp, LinkedIn e Instagram.

## Auto-Instalação (VPS nova)

```bash
# 1. Clone o repositório
git clone https://github.com/devdiogofalves/instalador_leadprospect.git
cd instalador_leadprospect

# 2. Configure as variáveis (opcional - valores padrão já estão definidos)
export DOMAIN="seu-dominio.com"
export VPS_IP="seu-ip"
export POSTGRES_PASSWORD="sua-senha"

# 3. Execute o auto-installer
bash install.sh
```

O script instala automaticamente:
- ✅ Docker e Docker Compose
- ✅ Supabase Self-Hosted (banco, auth, API gateway, edge functions)
- ✅ Evolution API (WhatsApp) com Redis
- ✅ Frontend (build e deploy no Nginx)
- ✅ Nginx com proxy reverso
- ✅ pg_cron (worker automático a cada minuto)
- ✅ Usuário admin
- ✅ Configuração do webhook WhatsApp

## Estrutura
- `supabase/` - Supabase self-hosted (Docker Compose + Edge Functions)
- `frontend/` - Frontend React/Vite
- `evolution/` - Evolution API (WhatsApp)
- `docs/` - Documentação e manual de instalação
- `scripts/` - Scripts de backup e restore
- `install.sh` - Auto-installer completo

## Backup e Restore
```bash
# Backup
./scripts/backup.sh

# Restore
./scripts/restore.sh /caminho/do/backup
```

## Credenciais padrão
- Admin: admin@admin.com / 132210
- Evolution API Key: evolution-api-key-change-me

## Licença
Proprietário - Diogo Alves
