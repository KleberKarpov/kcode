# ⚡ KCode

> **Your intelligent, secure, and flexible AI coding assistant via CLI.**

**KCode** is a command-line interface (CLI) tool that brings the power of generative AI assistants directly to your terminal. Unlike closed ecosystems, KCode integrates with the **OpenRouter** API, giving you the freedom to choose your preferred LLM (Claude, Qwen, Llama, Gemini, or free tiers) while maintaining full control over your costs and data.

[![Version](https://img.shields.io/badge/version-0.3.0-blue.svg)](https://github.com/karpov/kcode)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

---

## 🚀 Why use KCode?

- **🛡️ Security-First Architecture:** Interactive approval prompts for destructive tools (`write_file`, `run_cmd`, `ssh_exec`). Proactive regex-based blocking of dangerous shell patterns (e.g., `rm -rf`, `sudo`, `git reset --hard`) requiring explicit (Y/n) confirmation before acting.
- **🌐 True BYOK (Bring Your Own Key):** Use your own OpenRouter API key. No expensive monthly subscriptions, no hidden infrastructure costs for the creator, and complete data privacy.
- **🧠 Persistent Project Memory:** Create a `MEMORY.md` file in your project, and KCode will automatically remember your coding preferences, business rules, and architectural decisions across all sessions.
- **📋 Smart Large-Text Handling (`/paste`):** Paste massive code blocks or logs without polluting the terminal or hitting token limits. KCode saves them to a temporary file and instructs the AI to read it automatically.
- **🧩 Extensible Skill Ecosystem:** Supercharge your workflow with custom skills for specialized tasks.

---

## 📦 Installation

### Prerequisites
- Node.js (v18 or higher)
- An API key from [OpenRouter](https://openrouter.ai/)

### Step-by-Step (1-minute setup)

1. Clone this repository and install dependencies:
   ```bash
   git clone https://github.com/kleberkarpov/kcode.git
   cd kcode
   npm install
   ```
2. **(Recommended)** Create a global symlink to use the `kcode` command from anywhere:
   ```bash
   sudo ln -sf $(pwd)/kcode.js /usr/local/bin/kcode
   ```
3. Configure your API key (Replace `sk-or-...` with your actual key):
   ```bash
   # This command creates the .env file and saves your key automatically
   echo "OPENROUTER_API_KEY=your_openrouter_key_here" >> .env
   ```
   *(If you don't have a key, get one for free at [openrouter.ai/keys](https://openrouter.ai/keys))*

---

## 🎯 Quick Start

Simply type `kcode` in your project's terminal:

```bash
$ kcode

  ██╗ ██╗ ██████╗  ██████╗ ██████╗ ███████╗
  ██║██╔╝██╔════╝ ██╔═══██╗██╔══██╗██╔════╝
  █████╔╝ ██║      ██║   ██║██║  ██║█████╗  
  ██╔═██╗ ██║      ██║   ██║██║  ██║██╔══╝  
  ██║  ██╗╚██████╗ ╚██████╔╝██████╔╝███████╗
  ╚═╝  ╚═╝ ╚═════╝  ╚═════╝ ╚═════╝ ╚══════╝
  v0.3.0 · /Users/karpov/my-project
  Developer: Kleber Karpov - karpovls@gmail.com
  Model: anthropic/claude-3.5-haiku
  History: 40 msgs

  💰 OpenRouter Balance: $5.4200 (loaded in background)

  ❯ 
```

---

## ⌨️ Main Commands

| Command | Description |
| :--- | :--- |
| `/help` | Display the complete list of commands. |
| `/model` | Open an interactive selector to switch the AI model. |
| `/paste` | Activate secure paste mode for large texts (finalize with `EOF`). |
| `/memory [text]` | Display or add persistent rules to the project's `MEMORY.md`. |
| `/balance` | Check your OpenRouter account balance and usage limits. |
| `/reversa` | Activate the reverse engineering framework for legacy system analysis. |
| `/skill [name]` | Activate a specific skill (e.g., `guide-tour`, `image-to-svg`). |
| `/run <cmd>` | Execute a local shell command (subject to security approval). |
| `/exit` or `exit` | Save history and exit the application. |

---

## 🔒 Security & Permissions

KCode is designed to be a copilot, not a destructive autopilot.
- **Shell Guards:** Commands like `rm -rf`, `sudo`, `mkfs`, or `git push --force` are intercepted before execution.
- **Human Approval:** Any tool that modifies the file system or executes shells (`write_file`, `apply_patch`, `run_cmd`, `ssh_exec`) will require you to type `y` or `yes` to proceed.
- **Context Truncation:** Very long command outputs are automatically summarized (first and last 75 lines) to prevent context leakage and unexpected token costs.

---

## 🧩 Skill Ecosystem

KCode becomes more powerful with skills. The project includes:

### 🛠️ Native Skills (Created by Kleber Karpov)
- **`guide-tour`**: Implements onboarding (Product Tour) systems in React/HTML interfaces non-destructively, with safe `data-tour` attribute injection and `apply_patch` usage for large files.
- **`image-to-svg`**: Vectorizes logos and icons (PNG/JPG) to SVG using `potrace` and `imagemagick`, with safety validations and without overwriting originals.
- **`prd-generator`**: Generates structured Product Requirements Documents (PRD) from natural conversations.

### 🤝 Third-Party Integrations
- **`reversa`**: Complete reverse engineering framework for documenting and modernizing legacy systems. *(Credits: [sandeco](https://github.com/sandeco) / License: MIT)*. KCode provides the `/reversa` entry point to orchestrate this framework safely, writing only to dedicated directories (`.reversa/` and `_reversa_sdd/`).

---

## 🤝 Contributing

Contributions are welcome! If you find a bug or have an idea for a new skill, open an *Issue* or submit a *Pull Request*.

## 📜 License

Distributed under the MIT License. See the `LICENSE` file for more details.
