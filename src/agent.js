import { read_file, write_file, replace_in_file, list_files, find_in_repo, apply_patch } from './tools/files.js';
import { run_cmd, git_status, git_diff } from './tools/shell.js';
import { ssh_exec, deploy_site, tail_logs } from './tools/ssh.js';

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Lê o conteúdo de um arquivo. Permite ler intervalos específicos de linhas com start_line e end_line.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Caminho do arquivo' },
          start_line: { type: 'number', description: 'Linha inicial (1-indexed, opcional)' },
          end_line: { type: 'number', description: 'Linha final (1-indexed, opcional)' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'replace_in_file',
      description: 'Substitui cirurgicamente um trecho exato de código (target) por outro (replacement) em um arquivo existente. Cria automaticamente backup .kcode.bak.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Caminho do arquivo' },
          target: { type: 'string', description: 'Trecho exato a ser substituído (inclua linhas de contexto ao redor para ser único no arquivo)' },
          replacement: { type: 'string', description: 'Novo trecho de código que substituirá o target' }
        },
        required: ['path', 'target', 'replacement']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Escreve (cria ou substitui o arquivo inteiro). Use replace_in_file quando quiser apenas alterar um trecho. Cria backup .kcode.bak antes.',
      parameters: { type: 'object', properties: { path: { type: 'string', description: 'Caminho' }, content: { type: 'string', description: 'Conteúdo' } }, required: ['path', 'content'] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'Lista arquivos do projeto',
      parameters: { type: 'object', properties: { dir: { type: 'string' }, pattern: { type: 'string' }, max: { type: 'number' } } }
    }
  },
  {
    type: 'function',
    function: {
      name: 'find_in_repo',
      description: 'Busca texto nos arquivos do projeto',
      parameters: { type: 'object', properties: { query: { type: 'string' }, dir: { type: 'string' }, ext: { type: 'string' } }, required: ['query'] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'apply_patch',
      description: 'Aplica um diff/patch a um arquivo (prefira replace_in_file para alterações de código)',
      parameters: { type: 'object', properties: { path: { type: 'string' }, patch: { type: 'string' } }, required: ['path', 'patch'] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'run_cmd',
      description: 'Executa comando shell local',
      parameters: { type: 'object', properties: { command: { type: 'string' }, cwd: { type: 'string' } }, required: ['command'] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'git_status',
      description: 'Verifica status do git',
      parameters: { type: 'object', properties: { dir: { type: 'string' } } }
    }
  },
  {
    type: 'function',
    function: {
      name: 'git_diff',
      description: 'Verifica diff do git',
      parameters: { type: 'object', properties: { dir: { type: 'string' }, staged: { type: 'boolean' } } }
    }
  },
  {
    type: 'function',
    function: {
      name: 'ssh_exec',
      description: 'Executa comando via SSH',
      parameters: { type: 'object', properties: { host: { type: 'string' }, command: { type: 'string' }, user: { type: 'string' }, require_confirm: { type: 'boolean' } }, required: ['host', 'command'] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'deploy_site',
      description: 'Executa deploy configurado',
      parameters: { type: 'object', properties: { site: { type: 'string' }, env: { type: 'string' } }, required: ['site'] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'tail_logs',
      description: 'Vê logs de um serviço via SSH',
      parameters: { type: 'object', properties: { host: { type: 'string' }, service: { type: 'string' }, lines: { type: 'number' }, user: { type: 'string' } }, required: ['host', 'service'] }
    }
  }
];

const TOOL_FNS = {
  read_file, write_file, replace_in_file, list_files, find_in_repo, apply_patch,
  run_cmd, git_status, git_diff,
  ssh_exec, deploy_site, tail_logs
};

export async function runAgent({ messages, model, apiKey, systemExtra = "", onToken, onReasoning, enableTools = true }) {
  const system = `Voce e o kcode, um assistente de programacao minimalista e ultra-eficiente.
Siga as regras: 1. Use ferramentas para agir. Para editar código existente, prefira replace_in_file. 2. Seja conciso e direto. 3. Se nao souber onde fica algo, use find_in_repo.
${systemExtra}`;

  // Sanitização rigorosa das mensagens para compatibilidade com modelos abertos e OpenAI schema
  const sanitizedMessages = messages.map(msg => {
    const copy = { ...msg };
    if (copy.tool_calls) {
      if (Array.isArray(copy.tool_calls) && copy.tool_calls.length === 0) {
        delete copy.tool_calls;
      }
    }
    // Para mensagens de assistente com tool_calls, content vazio deve ser null
    if (copy.role === 'assistant' && copy.tool_calls && copy.tool_calls.length > 0) {
      if (!copy.content) copy.content = null;
    }
    // Garante que mensagens de ferramenta tenham id válido
    if (copy.role === 'tool' && !copy.tool_call_id) {
      copy.tool_call_id = 'call_default';
    }
    return copy;
  });

  const requestBody = {
    model,
    messages: [{ role: "system", content: system }, ...sanitizedMessages],
    stream: !!onToken,
    max_tokens: 4096,
    provider: {
      allow_fallbacks: true
    }
  };

  if (enableTools) {
    requestBody.tools = TOOLS;
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://kcode.local',
      'X-Title': 'KCode CLI',
    },
    body: JSON.stringify(requestBody)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const errMsg = (err.error?.message || '').toLowerCase();
    // Se o modelo aberto não suporta tools/function calling, retenta automaticamente sem tools
    if (enableTools && (errMsg.includes('tool') || errMsg.includes('function') || errMsg.includes('unsupported'))) {
      return runAgent({ messages, model, apiKey, systemExtra, onToken, onReasoning, enableTools: false });
    }
    throw new Error(`OpenRouter error ${res.status}: ${JSON.stringify(err)}`);
  }

  if (!onToken) {
    const data = await res.json();
    return data.choices?.[0]?.message;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = "";
  let assistantMsg = { role: "assistant", content: "", tool_calls: [] };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    // Decodificação streaming com buffer de linhas incompletas
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || "";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith(':')) continue; // Ignora keep-alives e linhas vazias

      if (line.startsWith('data: ')) {
        const dataStr = line.slice(6).trim();
        if (dataStr === '[DONE]') break;
        try {
          const data = JSON.parse(dataStr);
          const choice = data.choices?.[0];
          if (!choice) continue;
          const delta = choice.delta;
          if (!delta) continue;

          // Suporte a tokens de raciocínio (DeepSeek-R1, QwQ, etc.)
          const reasoning = delta.reasoning || delta.thought;
          if (reasoning && onReasoning) {
            onReasoning(reasoning);
          }

          if (delta.content) {
            assistantMsg.content += delta.content;
            onToken(delta.content);
          }

          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              if (!assistantMsg.tool_calls[idx]) {
                assistantMsg.tool_calls[idx] = {
                  id: tc.id || `call_${idx}_${Date.now()}`,
                  type: 'function',
                  function: { name: "", arguments: "" }
                };
              }
              if (tc.id && !assistantMsg.tool_calls[idx].id) {
                assistantMsg.tool_calls[idx].id = tc.id;
              }
              if (tc.function?.name) {
                assistantMsg.tool_calls[idx].function.name += tc.function.name;
              }
              if (tc.function?.arguments) {
                assistantMsg.tool_calls[idx].function.arguments += tc.function.arguments;
              }
            }
          }
        } catch {
          // Erro em evento SSE isolado não derruba a resposta
        }
      }
    }
  }

  // Sanitização final do objeto gerado pelo assistente
  if (Array.isArray(assistantMsg.tool_calls)) {
    assistantMsg.tool_calls = assistantMsg.tool_calls.filter(Boolean);
  }

  if (assistantMsg.tool_calls && assistantMsg.tool_calls.length === 0) {
    delete assistantMsg.tool_calls;
  } else if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
    if (!assistantMsg.content) {
      assistantMsg.content = null;
    }
  }

  return assistantMsg;
}

export async function executeTool(toolName, args) {
  const fn = TOOL_FNS[toolName];
  if (!fn) return { error: `Tool desconhecida: ${toolName}` };
  try { return await fn(args); }
  catch (e) { return { error: e.message }; }
}
