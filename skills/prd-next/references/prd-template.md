# PRD Template — Referência

Use este template como base quando não houver PRD anterior ou quando iniciar do zero.

## Estrutura Mínima

```markdown
# [Nome do Projeto] — PRD v{version}

> Data: {YYYY-MM-DD}
> Autor: {author}
> Status: Draft / Review / Approved

---

## 1. Visão & Objetivos
### 1.1 Problema
O que estamos resolvendo?

### 1.2 Solução Proposta
Como o produto resolve o problema?

### 1.3 Métricas de Sucesso
Quais KPIs indicam que estamos indo bem?

## 2. Usuários & Personas
### 2.1 Persona Primária
- **Nome:** 
- **Perfil:**
- **Necessidades:**
- **Dores:**

### 2.2 Persona Secundária
*(se aplicável)*

## 3. Requisitos Funcionais

| # | Requisito | Prioridade | Descrição |
|---|-----------|------------|-----------|
| F1 | | Alta/Med/Baixa | |
| F2 | | Alta/Med/Baixa | |

## 4. Requisitos Não-Funcionais

| # | Requisito | Categoria | Descrição |
|---|-----------|-----------|-----------|
| NF1 | | Performance/Segurança/Escalabilidade | |

## 5. Arquitetura Técnica
### 5.1 Stack
- **Frontend:** 
- **Backend:** 
- **Database:** 
- **Infraestrutura:** 

### 5.2 Diagrama
*(descrição textual ou link)*

## 6. Fluxos de Usuário
### 6.1 Fluxo Principal
1. Usuário faz X
2. Sistema responde Y
3. Resultado Z

### 6.2 Fluxos Alternativos
*(edge cases)*

## 7. Modelo de Dados
*(tabelas, campos, relacionamentos principais)*

## 8. API — Endpoints Principais
*(lista concisa)*

## 9. Integrações Externas
*(serviços de terceiros, webhooks, SDKs)*

## 10. Segurança & Privacidade
### 10.1 Autenticação
### 10.2 Autorização
### 10.3 Proteção de Dados

## 11. Deployment & Ambientes
| Ambiente | URL | Notas |
|----------|-----|-------|
| Development | | |
| Staging | | |
| Production | | |

## 12. Roadmap
### 12.1 Fase 1 — MVP
*(items com prioridade máxima)*

### 12.2 Fase 2 — Expansão
*(próxima leva de features)*

### 12.3 Fase 3 — Maturação
*(features avançadas, otimizações)*

## 13. Riscos & Mitigações

| # | Risco | Probabilidade | Impacto | Mitigação |
|---|-------|--------------|---------|-----------|

---

## Changelog

### v{version} — {date}
- Initial draft
```

## Diretrizes de Uso

1. **Seja específico**: evite vagueza nos requisitos — "o sistema deve ser rápido" é inútil. Use "o sistema deve carregar em < 2s em 3G".
2. **Priorize sempre**: todo requisito funcional precisa de prioridade (Alta/Media/Baixa).
3. **Mantenha vivo**: atualize o PRD a cada sprint ou mudança significativa de escopo.
4. **Use referências de código**: quando possível, vincule requisitos a arquivos/linhas reais.
5. **Seccione por fase**: MVP vs. Expansão vs. Maturação ajuda o time a focar.
