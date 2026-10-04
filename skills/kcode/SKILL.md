---
name: kcode
description: Delegar tarefas de engenharia de software, geração de código, refatoração, análise e execução de ferramentas através do agente CLI Kcode (conectado a 100+ modelos via OpenRouter com ferramentas de arquivo, shell e SSH). Use para consultar modelos alternativos (Qwen, DeepSeek, Codestral, Llama, Claude Opus), rodar tarefas autônomas com aprovação de ferramentas, checar saldo OpenRouter ou acionar deploys.
license: MIT
compatibility: Claude Code, Antigravity, Cursor, Codex e demais agentes compatíveis com Agent Skills.
metadata:
  author: Kleber Karpov
  version: "0.3.1"
  framework: kcode
  role: coding-agent
---

# Kcode Agent Skill

Esta skill permite que agentes de IA e IDEs (como **Claude Code**, **Antigravity**, **Cursor**, **Codex**) deleguem e executem tarefas especializadas de engenharia de software através do **Kcode CLI**.

---

## 📁 Mapeamento Canônico de Diretórios

Para garantir a interoperabilidade e descoberta automática entre diferentes IDEs e agentes, a skill segue os diretórios canônicos documentados:

| Ambiente / IDE | Diretório Canônico Documentado | Função |
|---|---|---|
| **Claude Code** | `~/.claude/skills/kcode/` | Descoberta automática de skills globais do Claude Code |
| **Antigravity** | `~/.gemini/antigravity/skills/kcode/` | Caminho canônico documentado do Google Antigravity |
| **Antigravity (Compatibilidade)** | `~/.gemini/config/skills/kcode/` | Caminho legado / retrocompatibilidade de plugins |
| **Padrão Agent Skills** | `~/.agents/skills/kcode/` | Estrutura aberta para Cursor, Codex, Windsurf e demais agentes |

---

## 🧠 Capacidades do Kcode

1. **Acesso Multi-Modelo via OpenRouter**:
   - Modelos de ponta em código: `qwen/qwen-2.5-coder-32b-instruct` (padrão), `deepseek/deepseek-r1` (raciocínio/forte), `mistralai/codestral-2501`, `meta-llama/llama-3.3-70b-instruct`, `anthropic/claude-3.5-sonnet`, entre outros.
2. **Conjunto Integrado de Ferramentas (Tool Calling)**:
   - **Manipulação de Arquivos**: `read_file`, `write_file`, `replace_in_file` (edição cirúrgica com backup automático `.kcode.bak`), `list_files`, `find_in_repo`, `apply_patch`.
   - **Shell & Git**: `run_cmd`, `git_status`, `git_diff`.
   - **Servidores Remotos (SSH)**: `ssh_exec`, `deploy_site`, `tail_logs`.
3. **Memória Persistente de Projeto**:
   - Carrega e respeita automaticamente regras de `./MEMORY.md`.
4. **Monitoramento Real de Créditos e Governança**:
   - Consulta saldo, consumo e limite configurado da chave na API OpenRouter com `kcode --balance`.

---

## 🛡️ Governança de Segurança e Salvaguardas

O Kcode implementa três camadas de proteção para execução autônoma via IDEs e agentes:

1. **Modo Seguro por Padrão (Sem `--yes`)**:
   - Quando invocado em modo headless sem a flag `--yes` / `-y`, o Kcode opera em **modo somente-leitura**.
   - Ferramentas de modificação de estado (`write_file`, `replace_in_file`, `apply_patch`, `run_cmd`, `ssh_exec`, `deploy_site`) são **bloqueadas preventivamente**, retornando mensagem informativa.
   - Ferramentas de inspeção (`read_file`, `list_files`, `find_in_repo`, `git_status`, `git_diff`, `tail_logs`) executam livremente.

2. **Auto-Aprovação Explícita (`--yes`)**:
   - A flag `--yes` deve ser utilizada apenas pelo wrapper de skill ou em fluxos de automação onde o agente tem autorização prévia para aplicar mudanças.
   - O wrapper `run_kcode.sh` inclui `--yes` para viabilizar refatorações e execuções autônomas sem travamentos por ausência de TTY.

3. **Política de Credenciais OpenRouter**:
   - **Chave Dedicada**: Recomenda-se gerar uma API Key específica para o Kcode no [dashboard da OpenRouter](https://openrouter.ai/settings/keys).
   - **Limite de Crédito Obrigatório**: Defina um teto de crédito (Credit Limit) na chave para prevenir que loops descontrolados ou vazamentos consumam todo o saldo da conta.
   - **Teto de Execução (Max Tool Steps)**: O Kcode limita a 15 passos consecutivos de chamadas de ferramentas por prompt, abortando loops de raciocínio infinitos.
   - **Proteção contra Vazamento**: Nunca versione arquivos `.env`, chaves Bearer ou segredos em `SKILL.md` ou scripts.

---

## 🚀 Como Invocar a Partir do Seu Agente/IDE

### Método 1: Wrapper Script da Skill (Recomendado)

```bash
# Execução padrão (utiliza caminho do padrão Agent Skills ou do ambiente ativo)
~/.agents/skills/kcode/scripts/run_kcode.sh "<instrução/prompt>" [opções]

# Exemplo com modelo específico e saída limpa
~/.agents/skills/kcode/scripts/run_kcode.sh "Analise a complexidade assintótica desta função" --model deepseek/deepseek-r1 -q
```

### Método 2: Invocação Direta via CLI

```bash
# Execução headless com auto-aprovação de ferramentas (--yes)
kcode run "Refatore a função processPayment em src/pay.ts" --yes

# Execução segura em modo de consulta (apenas ferramentas de leitura)
kcode run "Audite o código em busca de bugs e liste as linhas suspeitas"

# Atalho com modo de impressão pontual (-p)
kcode -p "Gere um teste unitário com Jest para este módulo" -m qwen/qwen-2.5-coder-32b-instruct

# Consultar saldo e limite da chave OpenRouter
kcode --balance
```

---

## ⚙️ Opções do Modo Headless

| Flag | Descrição |
|---|---|
| `-m, --model <id>` | Especifica o modelo OpenRouter (ex: `anthropic/claude-3.5-sonnet`, `deepseek/deepseek-r1`) |
| `-s, --skill <name>` | Ativa uma skill interna do Kcode (ex: `reversa`, `frontend-design`, `azure-deploy`) |
| `-y, --yes` | Autoriza execução de ferramentas de modificação (arquivos, shell, SSH) em modo autônomo |
| `-q, --quiet` | Omite cabeçalhos de pensamento e logs de ferramentas, retornando apenas a resposta |
| `--no-history` | Não grava a interação no histórico local do projeto (`~/.kcode/history/`) |

---

## 💡 Quando Utilizar o Kcode

- **Segunda Opinião / Revisão Cruzada**: Obter análise arquitetural de modelos especializados como DeepSeek R1 ou Codestral para validar decisões complexas.
- **Deploys e SSH**: Disparar rotinas de deploy configuradas no `DEPLOY_SITES` via Kcode.
- **Auditoria de Saldo**: Checar custos acumulados, limites de chave e saldo remanescente na conta OpenRouter com `kcode --balance`.
