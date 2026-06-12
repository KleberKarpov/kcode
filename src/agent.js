import { read_file, write_file, list_files, find_in_repo, apply_patch } from './tools/files.js';
import { run_cmd, git_status, git_diff } from './tools/shell.js';
import { ssh_exec, deploy_site, tail_logs } from './tools/ssh.js';

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Lê o conteúdo de um arquivo',
      parameters: { type: 'object', properties: { path: { type: 'string', description: 'Caminho do arquivo' } }, required: ['path'] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Escreve (cria ou substitui) um arquivo. Sempre cria backup .kcode.bak antes.',
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
      description: 'Aplica um diff/patch a um arquivo',
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
  read_file, write_file, list_files, find_in_repo, apply_patch,
  run_cmd, git_status, git_diff,
  ssh_exec, deploy_site, tail_logs
};

export async function runAgent({ messages, model, apiKey, systemExtra = "", onToken }) {
  const system = `Voce e o kcode, um assistente de programacao minimalista e ultra-eficiente.
Siga as regras: 1. Use ferramentas para agir. 2. Seja conciso. 3. Se nao souber, use find_in_repo.
${systemExtra}`;

  // CORREÇÃO CRÍTICA: Sanitiza TODO o array de mensagens para remover 'tool_calls: []'
  // Provedores como Alibaba/OpenRouter rejeitam requisições com arrays de tool_calls vazios.
  const sanitizedMessages = messages.map(msg => {
    if (msg.tool_calls && msg.tool_calls.length === 0) {
      const { tool_calls, ...rest } = msg;
      return rest;
    }
    return msg;
  });

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://kcode.local',
      'X-Title': 'KCode CLI',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, ...sanitizedMessages],
      tools: TOOLS,
      stream: !!onToken,
      provider: {
        order: ["Anthropic", "OpenAI", "Google"],
        allow_fallbacks: true
      }
    })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`OpenRouter error ${res.status}: ${JSON.stringify(err)}`);
  }

  if (!onToken) {
    const data = await res.json();
    return data.choices[0].message;
  }

  const reader = res.body.getReader();
  let assistantMsg = { role: "assistant", content: "", tool_calls: [] };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = new TextDecoder().decode(value);
    for (const line of chunk.split('\n')) {
      if (line.startsWith('data: ')) {
        const dataStr = line.slice(6);
        if (dataStr === '[DONE]') break;
        try {
          const data = JSON.parse(dataStr);
          const delta = data.choices[0].delta;
          if (delta.content) { assistantMsg.content += delta.content; onToken(delta.content); }
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (!assistantMsg.tool_calls[tc.index]) assistantMsg.tool_calls[tc.index] = { id: tc.id, function: { name: "", arguments: "" } };
              if (tc.function.name) assistantMsg.tool_calls[tc.index].function.name += tc.function.name;
              if (tc.function.arguments) assistantMsg.tool_calls[tc.index].function.arguments += tc.function.arguments;
            }
          }
        } catch {}
      }
    }
  }

  // CORREÇÃO CRÍTICA: Remove tool_calls se estiver vazio para evitar erro 400 de provedores como Alibaba/OpenRouter
  if (assistantMsg.tool_calls && assistantMsg.tool_calls.length === 0) {
    delete assistantMsg.tool_calls;
  }

  return assistantMsg;
}

export async function executeTool(toolName, args) {
  const fn = TOOL_FNS[toolName];
  if (!fn) return { error: `Tool desconhecida: ${toolName}` };
  try { return await fn(args); }
  catch (e) { return { error: e.message }; }
}
