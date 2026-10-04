#!/bin/bash
# Wrapper para execução de tarefas no Kcode CLI a partir de IDEs e agentes de IA
# Compatível com Claude Code, Antigravity, Cursor, Codex e ecossistema Agent Skills.

PROMPT="$1"
shift
ARGS="$@"

if [ -z "$PROMPT" ]; then
    echo "Uso: run_kcode.sh \"<instrucao/prompt>\" [opcoes/argumentos]"
    echo "Exemplo: run_kcode.sh \"Refatore esta funcao\" --model qwen/qwen-2.5-coder-32b-instruct -q"
    exit 1
fi

KCODE_BIN=""

# Procura o executável kcode no PATH ou em diretórios conhecidos
if command -v kcode &> /dev/null; then
    KCODE_BIN="$(command -v kcode)"
elif [ -x "/Users/imac/.nvm/versions/node/v24.18.1/bin/kcode" ]; then
    KCODE_BIN="/Users/imac/.nvm/versions/node/v24.18.1/bin/kcode"
elif [ -x "$HOME/bin/kcode" ]; then
    KCODE_BIN="$HOME/bin/kcode"
elif [ -x "/usr/local/bin/kcode" ]; then
    KCODE_BIN="/usr/local/bin/kcode"
elif [ -x "$HOME/.local/bin/kcode" ]; then
    KCODE_BIN="$HOME/.local/bin/kcode"
fi

if [ -n "$KCODE_BIN" ]; then
    # Executa em modo headless com auto-aprovação habilitada para automação
    "$KCODE_BIN" run "$PROMPT" --yes $ARGS
else
    echo "⚠️ O binário/CLI 'kcode' não foi encontrado no PATH nem nos diretórios padrão."
    echo "Certifique-se de que o kcode está instalado globalmente ou adicione o caminho do executável ao PATH."
    exit 1
fi
