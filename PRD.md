# kcode — Product Requirements Document (PRD) v0.4.0

> **Data**: 04 de Outubro de 2026  
> **Autor**: Kleber Karpov (karpovls@gmail.com)  
> **Status**: Approved / Living Document  
> **Repositório**: [github.com/KleberKarpov/kcode](https://github.com/KleberKarpov/kcode)  

---

## 1. Visão & Objetivos

### 1.1 Problema
Desenvolvedores de software e agentes modernos de IA frequentemente enfrentam limitações severas:
1. **Lock-in de Modelos**: Ficam presos a modelos proprietários específicos sem acesso fluido aos modelos abertos de ponta mais avançados em código e raciocínio (ex: DeepSeek R1, Qwen 2.5 Coder 32B, Codestral 2501, Llama 3.3 70B).
2. **Falta de Ferramentas Nativas em Agentes de IDE**: Muitas ferramentas de terminal e subagentes não possuem um ecossistema completo e cirúrgico de manipulação local (edição precisa com backup, shell com guardrails de segurança, execução remota e deploys SSH).
3. **Incompatibilidade com Automação Headless**: A maioria das ferramentas de coding agent é desenvolvida como REPL estritamente interativo. Sem modo não-interativo (*headless*), subagentes de IDEs (como Claude Code e Google Antigravity) não conseguem delegar tarefas a elas sem travar por falta de terminal TTY.
4. **Falta de Transparência de Custos**: Ausência de monitoramento de saldo em tempo real e de limites de crédito específicos por chave, gerando risco de surpresas financeiras ou esgotamento de cotas.

### 1.2 Solução Proposta
O **kcode** é uma plataforma e motor CLI de engenharia de software alimentada por IA via [OpenRouter](https://openrouter.ai/). Ele atua simultaneamente em duas frentes:
1. **CLI Interativo para o Desenvolvedor**: Interface de terminal intuitiva com streaming token-a-token, renderização de raciocínio (*thinking tags*), atalhos de modelo, modo colar para grandes blocos de código e memória persistente de projeto.
2. **Skill Global Multi-IDE para Agentes**: Uma skill padronizada sob o padrão [Agent Skills](https://agentskills.io/) instalada globalmente em **Claude Code**, **Google Antigravity** e **Cursor/Codex**, permitindo que outros agentes deleguem tarefas de codificação, refatoração, consulta de modelos alternativos e auditoria de forma autônoma e segura.

### 1.3 Métricas de Sucesso (KPIs)
- **Interoperabilidade Multi-IDE**: 100% de compatibilidade e descoberta automática em Claude Code (`~/.claude/skills/`), Antigravity (`~/.gemini/antigravity/skills/`) e padrão Agent Skills (`~/.agents/skills/`).
- **Resiliência de Execução**: Zero travamentos por falta de TTY em execuções de subagentes ou scripts automatizados.
- **Eficiência Financeira**: Monitoramento em tempo real do saldo OpenRouter e auditoria de limites na inicialização e via comando dedicado.
- **Integridade de Código**: 100% de edições de arquivo protegidas com backups automáticos `.kcode.bak` e bloqueio de comandos destrutivos no shell.

---

## 2. Usuários & Personas

### 2.1 Persona Primária: Engenheiro de Software / Power User
- **Perfil**: Desenvolvedor full-stack ou devops que trabalha diariamente no terminal macOS/Linux.
- **Necessidades**: Alternar rapidamente entre modelos especializados sem pagar assinaturas separadas; aplicar patches cirúrgicos no código sem alucinações; rodar deploys com um comando.
- **Dores**: Interfaces lentas na web, falta de controle sobre gastos de API, ferramentas que reescrevem arquivos inteiros e quebram formatações.

### 2.2 Persona Secundária: Agentes de IA Autônomos (Claude Code, Antigravity, Cursor)
- **Perfil**: Agentes e subagentes executando pipelines de desenvolvimento dentro de IDEs.
- **Necessidades**: Invocar o Kcode de forma não-interativa (`kcode run "<prompt>"`), solicitar segunda opinião arquitetural (ex: DeepSeek R1), obter dados de auditoria e executar scripts via wrapper padronizado.
- **Dores**: REPLs interativos que travam o processo em segundo plano aguardando stdin.

---

## 3. Requisitos Funcionais

| ID | Requisito | Prioridade | Descrição |
|---|---|---|---|
| **F01** | REPL Interativo de Terminal | Alta | Sessão conversacional rica com readline, histórico persistente de até 40 mensagens e atalhos rápidos (`/model`, `/files`, `/run`, `/status`, `/diff`, `/clear`, `/exit`). |
| **F02** | Suporte a Streaming & Reasoning Tokens | Alta | Parser SSE resiliente para buffering TCP com suporte nativo a tags de raciocínio/pensamento (`<thought>`, `reasoning_content`) de modelos como DeepSeek R1 e QwQ. |
| **F03** | Modo Headless / Não-Interativo | Alta | Execução de tarefas diretas via linha de comando (`kcode run "<prompt>"` e `kcode -p "<prompt>"`) com flags `-m, --model`, `-s, --skill`, `-y, --yes`, `-q, --quiet` e `--no-history`. |
| **F04** | Governança e Salvaguarda `--yes` | Alta | Em modo headless, bloquear preventivamente ferramentas de modificação de estado (`write_file`, `replace_in_file`, `apply_patch`, `run_cmd`, `ssh_exec`, `deploy_site`) a menos que `--yes` / `-y` seja explicitamente passado. |
| **F05** | Ferramentas de Arquivos Cirúrgicas | Alta | `read_file` (com suporte a paginação `start_line`/`end_line`), `replace_in_file` (substituição cirúrgica com verificação de unicidade e backup `.kcode.bak`), `write_file`, `list_files`, `find_in_repo`, `apply_patch`. |
| **F06** | Ferramentas de Shell com Guardrails | Alta | `run_cmd` com bloqueio ativo por regex de padrões destrutivos (`rm -rf`, `sudo`, `dd`, `mkfs`, `git reset --hard`, etc.) e truncação inteligente de output (máximo 150 linhas). |
| **F07** | Ferramentas SSH e Deploy | Média | `ssh_exec`, `deploy_site` (leitura de configurações de `DEPLOY_SITES` com confirmação em produção) e `tail_logs`. |
| **F08** | Auditoria de Saldo & Chave OpenRouter | Alta | Comando `/balance` e flag CLI `kcode --balance` consultando `/api/v1/credits` e `/api/v1/key`, exibindo saldo restante, consumo total e limite configurado na chave. |
| **F09** | Skill Global Agent Skills | Alta | Distribuição da skill em `~/.claude/skills/kcode/`, `~/.gemini/antigravity/skills/kcode/` e `~/.agents/skills/kcode/` com script wrapper `run_kcode.sh`. |
| **F10** | Memória Persistente de Projeto | Média | Comando `/memory` que injeta regras persistentes do arquivo `./MEMORY.md` em todas as conversas do diretório atual. |
| **F11** | Modo Colar Seguro (`/paste`) | Média | Entrada segura de múltiplos blocos de texto/código terminados com delimitador `EOF`. |
| **F12** | Integração com Framework Reversa | Média | Comando `/reversa` e carregamento de skills de engenharia reversa legada em `_reversa_sdd/`. |

---

## 4. Requisitos Não-Funcionais

| ID | Categoria | Descrição |
|---|---|---|
| **NF01** | **Segurança** | Bloqueio de elevação de privilégios (`sudo`) e destruição de dados. Nenhuma chave de API versionada no Git. `.env` estritamente ignorado no `.gitignore`. |
| **NF02** | **Performance** | Streaming em tempo real com `TextDecoder`. Truncação de outputs de ferramentas para preservação de contexto e economia de tokens. |
| **NF03** | **Portabilidade** | Executável em qualquer ambiente macOS ou Linux com Node.js >= 18. Instalação global via symlink em `bin/kcode`. |
| **NF04** | **Compatibilidade** | Aderência integral à especificação aberta [Agent Skills v1.0](https://agentskills.io/) e diretórios canônicos de Anthropic e Google Antigravity. |
| **NF05** | **Confiabilidade** | Reversão de tool-calls pendentes em caso de erro na LLM para evitar corrupção do histórico da sessão. Teto de 15 iterações de ferramentas por execução. |

---

## 5. Arquitetura do Sistema

```mermaid
flowchart TD
    subgraph Ambientes de Chamada
        USER["Desenvolvedor (Terminal / REPL)"]
        CLAUDE["Claude Code CLI (~/.claude/skills/kcode)"]
        ANTIGRAVITY["Google Antigravity (~/.gemini/antigravity/skills/kcode)"]
        CURSOR["Cursor / Codex (~/.agents/skills/kcode)"]
    end

    subgraph Interface de Entrada kcode.js
        CLI_PARSER{"CLI Arguments Parser"}
        REPL["startREPL() (Interativo / Readline)"]
        HEADLESS["chat(input, { headless: true })"]
    end

    subgraph Camada de Governança & Segurança
        SAFEGUARD{"autoYes ativo?"}
        ALLOW_ALL["Autorizar Ferramentas Modificadoras"]
        SAFE_ONLY["Modo Somente-Leitura (Bloquear DANGEROUS_TOOLS)"]
        SHELL_GUARD["Shell Regex Guard (Bloqueia rm -rf, sudo, etc.)"]
    end

    subgraph Ferramentas e Execução (src/)
        AGENT["src/agent.js (Controller OpenRouter)"]
        FILES["src/tools/files.js (read, replace, write)"]
        SHELL["src/tools/shell.js (run_cmd, git)"]
        SSH["src/tools/ssh.js (ssh_exec, deploy)"]
    end

    subgraph Provedor Externo
        OR["OpenRouter API v1 (Chat, Credits, Key Auth)"]
    end

    USER -->|kcode| CLI_PARSER
    CLAUDE -->|run_kcode.sh| CLI_PARSER
    ANTIGRAVITY -->|run_kcode.sh| CLI_PARSER
    CURSOR -->|run_kcode.sh| CLI_PARSER

    CLI_PARSER -->|Sem argumentos| REPL
    CLI_PARSER -->|run / -p| HEADLESS

    HEADLESS --> SAFEGUARD
    SAFEGUARD -->|--yes| ALLOW_ALL
    SAFEGUARD -->|Sem --yes| SAFE_ONLY

    ALLOW_ALL --> AGENT
    SAFE_ONLY --> AGENT
    REPL --> AGENT

    AGENT --> FILES
    AGENT --> SHELL_GUARD --> SHELL
    AGENT --> SSH
    AGENT <-->|SSE Streaming| OR
```

---

## 6. Mapeamento Canônico de Diretórios

| Plataforma | Caminho Canônico | Status |
|---|---|---|
| **Claude Code** | `~/.claude/skills/kcode/` | ✅ Ativo e testado |
| **Google Antigravity** | `~/.gemini/antigravity/skills/kcode/` | ✅ Ativo e testado |
| **Antigravity (Compat)** | `~/.gemini/config/skills/kcode/` | ✅ Ativo e testado |
| **Padrão Agent Skills** | `~/.agents/skills/kcode/` | ✅ Ativo e testado |

---

## 7. Modelo de Governança de Custos e Credenciais

1. **Chave Dedicada**: Cada instalação do Kcode deve utilizar uma chave OpenRouter específica (`kcode-agent-key`).
2. **Limite de Gastos Obrigatório**: O usuário deve configurar um Credit Limit no dashboard da OpenRouter para estancar eventuais loops autônomos.
3. **Auditoria no CLI**: O comando `kcode --balance` valida simultaneamente:
   - Saldo remanescente da conta.
   - Consumo acumulado.
   - Limite configurado na chave, emitindo alertas caso a chave esteja irrestrita.
4. **Teto de Raciocínio**: O motor limita a no máximo 15 passos de ferramentas (`MAX_TOOL_STEPS = 15`) por prompt.

---

## 8. Roadmap de Versões

### 8.1 Versões Entregues
- **v0.1.0 – v0.2.0**: Criação do REPL básico, integração inicial com OpenRouter, ferramentas de arquivo e shell.
- **v0.3.0**: Adição de guardrails no shell, aprovação de ferramentas, modo `/paste`, `/memory` e backup `.kcode.bak`.
- **v0.3.1**: Monitoramento em tempo real do saldo OpenRouter (`/balance`), toggle `KCODE_SHOW_BALANCE`.
- **v0.4.0 (Atual)**:
  - Implementação do modo headless (`kcode run` e `kcode -p`).
  - Governança de segurança do `--yes` com modo seguro de somente-leitura por padrão.
  - Distribuição global nos ecossistemas Claude Code, Google Antigravity e Agent Skills.
  - Auditoria de limite de chave no `kcode --balance`.
  - Elaboração do parecer técnico formal ([TECHNICAL_OPINION.md](file:///Volumes/KARPOV%202TB/KLEBER%20KARPOV/WORKSPACE/kcode/TECHNICAL_OPINION.md)) e deste PRD.

### 8.2 Próximos Passos (v0.5.0)
- Suporte a chamadas de ferramentas em paralelo (*parallel tool calling*).
- Servidor MCP (Model Context Protocol) nativo para que o Kcode possa atuar também como servidor de contexto para Claude Desktop e IDEs.
- Cache de contexto e cálculo de tokens antes da submissão do prompt.
