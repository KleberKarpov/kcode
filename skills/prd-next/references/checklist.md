# Checklist de Auditoria — Código vs PRD

Use este checklist quando estiver confrontando o PRD com o código real.

## 1. Estrutura do Projeto

- [ ] Listar diretórios de nível 1 e 2
- [ ] Identificar framework principal (Next.js, Vite, Express, Django, etc.)
- [ ] Identificar linguagem principal
- [ ] Verificar se há monorepo (workspaces, lerna, turbo, nx)

## 2. Stack Tecnológica

- [ ] Ler `package.json` / `requirements.txt` / `go.mod` / `Cargo.toml`
- [ ] Listar dependências principais (não devDependencies)
- [ ] Identificar ORMs/ODMs usados
- [ ] Identificar bundler (Webpack, Vite, esbuild, etc.)

## 3. Frontend

- [ ] Listar páginas/rotas (`app/`, `pages/`, `src/routes/`)
- [ ] Listar componentes principais (`src/components/`)
- [ ] Verificar uso de UI library (shadcn, MUI, Chakra, Tailwind, etc.)
- [ ] Verificar state management (Redux, Zustand, Context, etc.)
- [ ] Verificar formulários e validação (React Hook Form, Zod, etc.)
- [ ] Verificar internacionalização (i18n)
- [ ] Verificar dark mode / temas

## 4. Backend / API

- [ ] Listar rotas/endpoints encontrados
- [ ] Verificar método HTTP de cada endpoint
- [ ] Identificar controladores/handlers
- [ ] Verificar middleware existente (auth, cors, rate limit, etc.)
- [ ] Identificar validação de input (Zod, Joi, etc.)

## 5. Banco de Dados

- [ ] Identificar tipo de DB (PostgreSQL, MySQL, MongoDB, SQLite, etc.)
- [ ] Ler schema (Prisma, SQL migrations, Mongoose models, etc.)
- [ ] Listar tabelas/coleções principais
- [ ] Verificar relacionamentos (FKs, joins, references)
- [ ] Verificar indexes definidos
- [ ] Verificar seeds/fixtures

## 6. Autenticação & Autorização

- [ ] Identificar provedor de auth (Supabase, Firebase, Auth0, Clerk, NextAuth, etc.)
- [ ] Verificar métodos de login (email/senha, OAuth, SSO, magic link)
- [ ] Verificar sistema de permissões/roles
- [ ] Verificar proteção de rotas (middleware de auth)
- [ ] Verificar refresh token / session management

## 7. Integrações Externas

- [ ] Listar APIs de terceiro (Stripe, SendGrid, OpenAI, etc.)
- [ ] Verificar webhooks configurados
- [ ] Verificar storage/S3 buckets
- [ ] Verificar serviços de email

## 8. Infraestrutura & Deploy

- [ ] Identificar plataforma de deploy (Vercel, AWS, GCP, Azure, DigitalOcean, etc.)
- [ ] Verificar `Dockerfile` / `docker-compose.yml`
- [ ] Verificar CI/CD (GitHub Actions, GitLab CI, etc.)
- [ ] Verificar variáveis de ambiente (`.env.example`)
- [ ] Verificar configuração de domínio/DNS

## 9. Testes

- [ ] Identificar framework de testes (Jest, Vitest, Cypress, Playwright, etc.)
- [ ] Verificar se existem testes unitários
- [ ] Verificar se existem testes E2E
- [ ] Cobertura aproximada (se disponível)

## 10. Documentação Existente

- [ ] README.md
- [ ] Docs folder ou wiki
- [ ] PRDs anteriores
- [ ] Diagramas de arquitetura
- [ ] Postman/Insomnia collections

## 11. Código Morto / Drift

- [ ] Arquivos importados que não são usados
- [ ] Componentes criados mas não renderizados
- [ ] Rotas definidas mas sem conteúdo real
- [ ] Features no PRD que não têm código correspondente
- [ ] Código no repo que não está no PRD (drift)

## 12. Pendências Óbvias no Código

- [ ] `TODO` comments
- [ ] `FIXME` / `HACK` / `XXX` comments
- [ ] `throw new Error("not implemented")` ou similar
- [ ] Variáveis/constantes com valor "placeholder" ou "TBD"
- [ ] Routes returning static/dummy data
- [ ] Empty functions/methods
- [ ] Fallback UI components sem lógica real
