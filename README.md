# 🚀 kcode

**CLI Agent for development powered by OpenRouter + AI.**

kcode is a terminal-based AI coding agent that connects to any LLM via [OpenRouter](https://openrouter.ai/), equipped with tools for file manipulation, shell execution, Git operations, SSH remote control, and site deployment. It includes a **tool approval system** for dangerous operations, **persistent memory** via `MEMORY.md`, and integrates the **Reversa** framework for legacy system reverse engineering.

**v0.3.1** — Now with real-time OpenRouter balance monitoring, paste mode, and per-tool security approvals.

---

## 📦 Quick Start

### Prerequisites

- Node.js >= 18
- An [OpenRouter](https://openrouter.ai/) API key
- (Optional) SSH key for remote server access

### Installation

```bash
# Clone or navigate to the project
cd ~/kcode

# Install dependencies
npm install

# Create your .env file
cp .env.example .env
# Then edit .env and add your OPENROUTER_API_KEY
```

### Global Installation (recommended)

```bash
# Run the setup script to install kcode globally
python3 setup_kcode.py

# Now you can run kcode from any directory
kcode
```

### Run (without global install)

```bash
node kcode.js
# or via npm
npm start
```

---

## ⚙️ Configuration

### `.env` Variables

| Variable | Description | Example |
|---|---|---|
| `OPENROUTER_API_KEY` | **Required.** Your OpenRouter API key | `sk-or-v1-...` |
| `KCODE_MODEL` | Default model for conversations | `anthropic/claude-3.5-haiku` |
| `KCODE_MODEL_STRONG` | Strong model alias (`/model strong`) | `anthropic/claude-3.5-sonnet` |
| `KCODE_MODEL_FREE` | Free model alias (`/model free`) | `deepseek/deepseek-chat:free` |
| `KCODE_SHOW_BALANCE` | Show balance on startup (`true`/`false`) | `true` |
| `SSH_ALLOWED_HOSTS` | Comma-separated list of allowed SSH hosts | `server1.com,192.168.1.10` |
| `SSH_DEFAULT_USER` | Default SSH username | `deploy` |
| `SSH_KEY_PATH` | Path to SSH private key | `~/.ssh/id_rsa` |
| `DEPLOY_SITES` | JSON config for site deploys | `{"myapp":{"host":"...","cmd":"..."}}` |

#### DEPLOY_SITES Format

```json
{
  "myapp": {
    "host": "server.example.com",
    "cmd": "cd /var/www/myapp && git pull && pm2 restart myapp",
    "user": "deploy"
  }
}
```

### Model Management In-CLI

```
/model default    → Use KCODE_MODEL
/model strong     → Use KCODE_MODEL_STRONG (for complex tasks)
/model free       → Use KCODE_MODEL_FREE (zero-cost)
/model <name>     → Use any OpenRouter model name
/model            → Interactive category browser (↑/↓ + Enter)
```

---

## 🛠️ Commands

When inside kcode's interactive CLI:

| Command | Description |
|---|---|
| `/help` | Show all available commands |
| `/model [name\|id]` | Switch AI model (interactive browser if no argument) |
| `/skills` | List available skills |
| `/skill [name]` | Activate/deactivate a skill |
| `/reversa` | Launch Reversa framework (reverse engineering) |
| `/files [dir]` | List project files (max 60, skips node_modules) |
| `/run <cmd>` | Execute a local shell command |
| `/status` | Show git status of current project |
| `/diff` | Show git diff |
| `/deploy <site> [env]` | Deploy a site (staging/production) |
| `/scan <file>` | Analyze a file for security issues |
| `/balance` | Check real OpenRouter account balance and key usage |
| `/paste` | Secure mode for pasting large text blocks |
| `/memory [text]` | View or add persistent rules to `MEMORY.md` |
| `/clear` | Clear session history |
| `/exit` | Exit kcode |

**Conversation:** Just type normally — kcode will send your message to the AI and stream the response.

### `/balance` — Real-Time Account Balance

The `/balance` command fetches live data from **two** OpenRouter API endpoints:

- **`/api/v1/credits`** — Account-level balance: total credits purchased, total consumed across all keys, and remaining balance with percentage.
- **`/api/v1/key`** — Per-key usage: all-time, daily, weekly, and monthly spend breakdowns.

The remaining balance is color-coded: 🟢 green (>$5), 🟡 yellow (>$1), 🔴 red (<$1).

On startup, kcode fetches your remaining balance in the background and displays it automatically (color-coded). To disable this (e.g. for screen sharing), add to your `.env`:

```env
KCODE_SHOW_BALANCE=false
```

### `/paste` — Paste Mode

For pasting large blocks of text (code, logs, stack traces) safely into the terminal:

1. Type `/paste` to enter paste mode
2. Paste your text freely (multi-line supported)
3. Type `EOF` on a line by itself and press Enter to finish
4. kcode saves the pasted content to `~/.kcode/pastes/` and sends it to the AI

### `/memory` — Persistent Project Memory

Rules and preferences that persist across sessions:

```bash
/memory                           # View current rules
/memory Always use TypeScript     # Add a persistent rule
```

Rules are stored in `MEMORY.md` in the current directory and automatically injected into every AI conversation as system context.

---

## 🧩 Architecture

```
kcode/
├── kcode.js              # Main CLI entry point (v0.2.1 source)
├── setup_kcode.py        # Global installer script
├── src/
│   ├── agent.js          # AI agent controller + OpenRouter integration
│   ├── skills.js         # Skill loading and injection system
│   └── tools/
│       ├── files.js      # File: read, write, list, find, patch
│       ├── shell.js      # Shell: run command, git status, git diff
│       └── ssh.js        # SSH: exec, deploy, tail logs
├── skills/               # Custom skills for kcode CLI (20+ skills)
│   ├── reversa/          # Legacy system reverse engineering
│   ├── security-analyzer/
│   ├── azure-deploy/
│   ├── web-design-guidelines/
│   ├── remotion-best-practices/
│   ├── skill-creator/    # Meta-skill for creating new skills
│   ├── frontend-design/
│   ├── soultrace/
│   └── ...               # And more
├── .claude/skills/       # Skills for Claude Code
├── .agents/skills/       # Skills for Antigravity
└── .reversa/             # Reversa state & config
```

### Core Components

#### `src/agent.js`
The brain of kcode. Handles:
- Communication with OpenRouter API (`/chat/completions`)
- Tool definitions (11 built-in tools)
- Streaming responses (character-by-character rendering)
- Tool-call loop (AI requests tool execution → kcode executes → result sent back)

#### `src/skills.js`
Skill management system:
- Loads `SKILL.md` files from `skills/` directory
- Injects skill content as system prompt extension when activated
- Each skill is a markdown file with frontmatter (name, description) + instructions

#### OpenRouter Integration
kcode communicates with two OpenRouter API endpoints for account management:

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/credits` | Account-level balance (total credits, total usage) |
| `GET /api/v1/key` | Per-key usage (all-time, daily, weekly, monthly) |
| `GET /api/v1/models` | Available model listing for interactive browser |
| `POST /api/v1/chat/completions` | AI conversation with streaming |

#### Tool Categories

**File Tools:**
| Tool | Purpose |
|---|---|
| `read_file` | Read file contents |
| `write_file` | Create/overwrite file (creates `.kcode.bak` backup) |
| `list_files` | List directory tree (skips node_modules, .git, dist) |
| `find_in_repo` | Search text across repo via grep |
| `apply_patch` | Apply unified diff patch to a file |

**Shell Tools:**
| Tool | Purpose |
|---|---|
| `run_cmd` | Execute local shell command (blocked: sudo, rm -rf /) |
| `git_status` | Show git status |
| `git_diff` | Show git diff |

**SSH Tools:**
| Tool | Purpose |
|---|---|
| `ssh_exec` | Run command on remote server via SSH |
| `deploy_site` | Deploy a predefined site configuration |
| `tail_logs` | View remote service logs (journalctl) |

---

## 🔌 Skills System

### kcode CLI Skills

Located in `skills/` directory. To activate:

```
/skills           # List all skills
/skill <name>     # Activate a skill
/skill            # Deactivate current skill
```

**Available Skills:**

| Skill | Description |
|---|---|
| `reversa` | Legacy system reverse engineering framework |
| `remotion-best-practices` | Guidelines for Remotion video creation |
| `security-analyzer` | Security analysis of JavaScript files |
| `azure-deploy` | Azure deployment configurations |
| `azure-ai` | Azure AI services integration |
| `azure-prepare` | Azure environment preparation |
| `web-design-guidelines` | UI/UX best practices |
| `frontend-design` | Frontend design patterns |
| `vercel-react-best-practices` | Vercel + React guidelines |
| `skill-creator` | Meta-skill for creating new skills |
| `soultrace` | Soul trace analysis |
| `deploy` | Deployment automation |
| `cro` | Conversion rate optimization |
| `prd-next` | Product requirement documents |
| `onboarding` | User onboarding flows |
| `guide-tour` | Guide/tour creation |
| `find-skills` | Skill discovery |
| `karpathy-guidelines` | Karpathy-style coding guidelines |
| `imgsvg` | Image to SVG conversion |
| `txtsvg` | Text to SVG conversion |

### Claude Code + Antigravity Skills

Located in `.claude/skills/` and `.agents/skills/`. These follow the [Agent Skills spec](https://agentskills.io/) and are automatically detected by Claude Code and Antigravity.

The Reversa framework is fully available through this system with 11 specialized agents:

| Agent | Role |
|---|---|
| `reversa` | Master orchestrator |
| `reversa-scout` | Project mapping & structure analysis |
| `reversa-detective` | Git archaeology & business rules extraction |
| `reversa-architect` | C4 diagrams, architecture, ERD |
| `reversa-writer` | SDD specifications, OpenAPI docs |
| `reversa-reviewer` | Cross-review, confidence scoring |
| `reversa-visor` | UI/screen analysis |
| `reversa-data-master` | Database analysis |
| `reversa-design-system` | Design tokens extraction |
| `reversa-reconstructor` | System reconstruction planning |
| `reversa-agents-help` | Agent directory & routing guide |

To use in Claude Code or Antigravity:

```
/reversa          # Start from scratch or resume
/reversa <agent>  # Invoke a specific agent
```

---

## 🔄 Reversa Framework

Reversa is a phased approach to reverse engineer legacy systems into AI-executable specifications.

### Usage Flow

```
/reversa → Scout → (Choose doc level) → Architect → Writer → Reviewer → Done
```

1. **Scout** — Scans project structure, identifies modules, language, integrations
2. **Doc Level** — Choose: Essential (1), Complete (2), or Detailed (3)
3. **Architect** — Generates architecture docs (C4, ERD, ADRs)
4. **Writer** — Creates SDD specifications
5. **Reviewer** — Cross-reviews, flags gaps

All output goes to `.reversa/` and `_reversa_sdd/` — never modifies existing project files.

### Reversa Config

```toml
# .reversa/config.toml
[reversa]
version = "1.0.0"
project_name = "my-legacy-project"
doc_level = "completo"  # essencial | completo | detalhado
```

---

## 🛡️ Security Guardrails

kcode implements several safety measures:

- **Tool approval system** — Dangerous tools (`write_file`, `apply_patch`, `run_cmd`, `ssh_exec`, `deploy_site`) require explicit `y/N` approval before execution
- **SSH host whitelist** — Only hosts in `SSH_ALLOWED_HOSTS` can be accessed
- **Production deploy confirmation** — `env=production` requires explicit `y/N` prompt
- **Destructive commands blocked** — `sudo` and `rm -rf /` are rejected
- **File backups** — `write_file` always creates `.kcode.bak` before overwriting
- **Session history caps** — Only last 40 messages persisted to disk
- **Paste mode** — `/paste` provides safe multi-line input without shell injection risks

---

## 📁 Session & Data

| Path | Purpose |
|---|---|
| `~/.kcode/history/<project>.json` | Conversation history (last 40 messages) |
| `~/.kcode/pastes/` | Saved paste mode inputs |
| `./MEMORY.md` | Project-level persistent rules (per directory) |

---

## 🏗️ Building Custom Skills

Create a folder in `skills/` with a `SKILL.md`:

```
skills/my-skill/
└── SKILL.md
```

**SKILL.md format:**

```markdown
---
name: my-skill
description: What this skill does
---

# My Skill

Instructions for the AI when this skill is active.
Include rules, templates, guidelines, etc.
```

Then activate with `/skill my-skill` in the CLI.

You can also use the built-in `skill-creator` meta-skill to generate new skills:

```
/skill skill-creator
Create a skill for optimizing database queries
```

---

## 👤 Author

**Kleber Karpov** — [GitHub](https://github.com/KleberKarpov/kcode)

## 📄 License

MIT
