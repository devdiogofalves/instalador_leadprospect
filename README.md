# LeadsBooster - SaaS de Prospecção B2B

Sistema completo de prospecção B2B com IA, WhatsApp, LinkedIn e Instagram.

## Estrutura
- `supabase/` - Supabase self-hosted (Docker Compose + Edge Functions)
- `frontend/` - Frontend React/Vite
- `evolution/` - Evolution API (WhatsApp)
- `docs/` - Documentação e manual de instalação
- `scripts/` - Scripts de backup e restore

## Instalação
Veja `docs/INSTALACAO.md` para o guia completo.

## Backup
```bash
./scripts/backup.sh
```

## Restore
```bash
./scripts/restore.sh /caminho/do/backup
```

## Licença
Proprietário - Diogo Alves
