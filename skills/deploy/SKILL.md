# Deploy e DevOps
description: Boas praticas para deploy, PM2, Docker e operacoes de servidor

## Regras de Deploy

- Sempre verifique git status antes de deployar
- Em producao, exija confirmacao explicita
- Apos deploy, verifique logs por 30 segundos
- Use usuario deploy, nunca root

## Comandos PM2

pm2 status
pm2 restart <app>
pm2 logs <app> --lines 50
pm2 save

## Checklist de Deploy

1. git pull origin main
2. npm install --production (se package.json mudou)
3. pm2 restart <app>
4. pm2 logs <app> --lines 20
