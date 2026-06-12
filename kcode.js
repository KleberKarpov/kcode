#!/usr/bin/env node
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import readline from 'readline';
import path from 'path';
import os from 'os';
import fs from 'fs';
import https from 'https';
import { runAgent, executeTool } from './src/agent.js';
import { loadSkills, skillSystemPrompt } from './src/skills.js';

async function fetchOpenRouterModels() {
  return new Promise((resolve, reject) => {
    https.get("https://openrouter.ai/api/v1/models", (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        try { resolve(JSON.parse(data).data); }
        catch (e) { reject(e); }
      });
    }).on("error", reject);
  });
}

async function fetchOpenRouterAuth(apiKey) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'openrouter.ai',
      path: '/api/v1/key',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        try { resolve(JSON.parse(data).data); }
        catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

async function fetchOpenRouterCredits(apiKey) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'openrouter.ai',
      path: '/api/v1/credits',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        try { resolve(JSON.parse(data).data); }
        catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

function formatPrice(val) {
  if (val === undefined || val === null) return "N/A";
  const price = parseFloat(val) * 1000000;
  if (price === 0) return "Free";
  return "$" + price.toFixed(2) + "/M";
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const VERSION = '0.3.0';
const API_KEY = process.env.OPENROUTER_API_KEY;

if (!API_KEY) {
  console.log('\n' + p('red', '  ⚠️ ERRO: OPENROUTER_API_KEY não encontrada.'));
  console.log(p('d', '  O KCode precisa de uma chave de API para se comunicar com a IA.\n'));
  console.log(p('c', '  ✅ Como resolver em 30 segundos:'));
  console.log(p('d', '  1. Obtenha sua chave gratuita em: https://openrouter.ai/keys'));
  console.log(p('d', '  2. Cole sua chave e execute este comando no terminal:'));
  console.log(p('g', '     echo "OPENROUTER_API_KEY=sua_chave_aqui" >> .env'));
  console.log(p('d', '  3. Digite "kcode" novamente para iniciar.\n'));
  process.exit(1);
}

const MODELS = {
  default: process.env.KCODE_MODEL || 'anthropic/claude-3.5-haiku',
  strong: process.env.KCODE_MODEL_STRONG || '',
  free: process.env.KCODE_MODEL_FREE || '',
};

const HIST = path.join(os.homedir(), '.kcode', 'history');
fs.mkdirSync(HIST, { recursive: true });

let model = MODELS.default, messages = [], activeSkill = null, lastModelList = [];
let isPasting = false;
let pasteBuffer = [];

// ── Interactive selector ──────────────────────────────────────────────────
const CATEGORIES = [
  { label: '★ FREE  — Modelos gratuitos', value: 'FREE' },
  { label: '① Text  — Modelos de texto',   value: 'Text' },
  { label: '② Image — Modelos de imagem',  value: 'Image' },
  { label: '③ Embeddings',                 value: 'Embeddings' },
  { label: '④ Audio',                      value: 'Audio' },
  { label: '⑤ Video',                      value: 'Video' },
  { label: '⑥ Rerank',                     value: 'Rerank' },
  { label: '⑦ Speech',                     value: 'Speech' },
  { label: '⑧ Transcription',              value: 'Transcription' },
];

function renderSelector(title, items, cursor, startIdx = 0, pageSize = 12) {
  process.stdout.write('\x1b[2J\x1b[H');
  console.log('\n  ' + p('c', title));
  console.log('  ' + p('d', '↑/↓ para navegar · Enter para confirmar · Esc para cancelar') + '\n');
  const end = Math.min(startIdx + pageSize, items.length);
  for (let i = startIdx; i < end; i++) {
    const active = i === cursor;
    const bullet = active ? p('g', '▶ ') : '  ';
    const label  = active ? p('g', items[i].label || items[i]) : p('d', items[i].label || items[i]);
    console.log('  ' + bullet + label);
  }
  if (items.length > pageSize) {
    console.log('\n  ' + p('d', `[${startIdx+1}-${end} de ${items.length}] PgUp/PgDn para paginar`));
  }
}

async function interactiveSelect(title, items, pageSize = 12) {
  return new Promise(resolve => {
    let cursor = 0, startIdx = 0;
    rl.pause();
    const stdin = process.stdin;
    const prevRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();

    const redraw = () => renderSelector(title, items, cursor, startIdx, pageSize);
    redraw();

    const onKey = (buf) => {
      const key = buf.toString();
      if (key === '\x1b[A' || key === '\x1b[D') {
        if (cursor > 0) { cursor--; if (cursor < startIdx) startIdx = cursor; }
      } else if (key === '\x1b[B' || key === '\x1b[C') {
        if (cursor < items.length - 1) { cursor++; if (cursor >= startIdx + pageSize) startIdx++; }
      } else if (key === '\x1b[5~') {
        cursor = Math.max(0, cursor - pageSize);
        startIdx = Math.max(0, startIdx - pageSize);
      } else if (key === '\x1b[6~') {
        cursor = Math.min(items.length - 1, cursor + pageSize);
        startIdx = Math.min(Math.max(0, items.length - pageSize), startIdx + pageSize);
      } else if (key === '\r' || key === '\n') {
        cleanup();
        resolve(items[cursor]);
        return;
      } else if (key === '\x1b' || key === 'q') {
        cleanup();
        resolve(null);
        return;
      }
      redraw();
    };

    const cleanup = () => {
      stdin.removeListener('data', onKey);
      stdin.setRawMode(false);
      rl.resume();
    };

    stdin.on('data', onKey);
  });
}

const skills = loadSkills();
const cwd = process.cwd();
const histFile = path.join(HIST, path.basename(cwd) + '.json');
if (fs.existsSync(histFile)) try { messages = JSON.parse(fs.readFileSync(histFile, 'utf8')); } catch {}

const ESC = '\x1b';
const C = {
  r: ESC+'[0m', d: ESC+'[2m', c: ESC+'[36m',
  g: ESC+'[32m', y: ESC+'[33m', red: ESC+'[31m',
  m: ESC+'[35m', gr: ESC+'[90m'
};
const p = (k, t) => C[k] + t + C.r;

function header() {
  console.clear();
  process.stdout.write(C.c);
  console.log('');
  console.log('  ██╗ ██╗ ██████╗  ██████╗ ██████╗ ███████╗');
  console.log('  ██║██╔╝██╔════╝ ██╔═══██╗██╔══██╗██╔════╝');
  console.log('  █████╔╝ ██║      ██║   ██║██║  ██║█████╗  ');
  console.log('  ██╔═██╗ ██║      ██║   ██║██║  ██║██╔══╝  ');
  console.log('  ██║  ██╗╚██████╗ ╚██████╔╝██████╔╝███████╗');
  console.log('  ╚═╝  ╚═╝ ╚═════╝  ╚═════╝ ╚═════╝ ╚══════╝');
  process.stdout.write(C.r);
  console.log(p('d', '  v'+VERSION+' · '+cwd));
  console.log(p('d', '  Developer: Kleber Karpov - karpovls@gmail.com'));
  console.log(p('d', '  Modelo: '+model));
  if (activeSkill) console.log(p('m', '  Skill: '+activeSkill));
  if (messages.length) console.log(p('d', '  Historico: '+messages.length+' msgs'));
  console.log(p('gr', '\n  /help para comandos · Ctrl+C para sair\n'));
}

function help() {
  const cmds = [
    ['/model [num|id]', 'Escolha ou busque modelos'],
    ['/skill [nome]', 'Ativa/desativa skill'],
    ['/skills', 'Lista skills disponiveis'],
    ['/files [dir]', 'Lista arquivos do projeto'],
    ['/run <cmd>', 'Roda comando local'],
    ['/status', 'Git status'],
    ['/diff', 'Git diff'],
    ['/deploy <site> [staging|prod]', 'Deploy de site'],
    ['/scan <arquivo>', 'Analisa seguranca de um script'],
    ['/balance', 'Verifica saldo e limites no OpenRouter'],
    ['/paste', 'Modo seguro para colar blocos grandes de texto'],
    ['/clear', 'Limpa historico da sessao'],
    ['/exit', 'Sai'],
  ];
  console.log('');
  for (const [cmd, desc] of cmds) {
    console.log('  ' + p('c', cmd.padEnd(40)) + ' ' + p('d', desc));
  }
  console.log('');
}

function save() {
  try { fs.writeFileSync(histFile, JSON.stringify(messages.slice(-40), null, 2)); } catch {}
}

async function askPermission(toolName, args) {
  return new Promise(resolve => {
    console.log(p('red', `\n  ⚠️ AÇÃO DE RISCO DETECTADA: A IA quer executar: ${p('c', toolName)}`));
    console.log(p('d', '  Parâmetros: ' + JSON.stringify(args, null, 2).split('\n').join('\n  ')));

    rl.pause();
    process.stdout.write(p('y', '\n  Executar esta ação? (y/N): '));

    const stdin = process.stdin;
    stdin.setRawMode(false);
    stdin.resume();

    const onData = (chunk) => {
      const input = chunk.toString().trim().toLowerCase();
      if (input === 'y' || input === 'yes') {
        cleanup();
        resolve(true);
      } else {
        cleanup();
        resolve(false);
      }
    };

    const cleanup = () => {
      stdin.removeListener('data', onData);
      stdin.pause();
      rl.resume();
      rl.prompt();
    };

    stdin.on('data', onData);
  });
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '\n' + p('g', '❯') + ' '
});

async function handleCmd(input) {
  const [cmd, ...args] = input.trim().split(/\s+/);
  if (cmd === '/help') { help(); return; }
  if (cmd === '/exit') { save(); process.exit(0); }
  if (cmd === '/clear') { messages = []; header(); console.log(p('y', '  Historico limpo.')); return; }

  if (cmd === '/paste') {
    isPasting = true;
    pasteBuffer = [];
    console.log(p('y', '\n  📋 MODO DE COLAGEM ATIVADO'));
    console.log(p('d', '  Cole seu texto livremente (Ctrl+C ou Ctrl+D também cancelam).'));
    console.log(p('d', '  ⚠️ Para finalizar: pressione ENTER, digite \x1b[1mEOF\x1b[22m (em uma linha sozinha) e pressione ENTER novamente.\n'));
    rl.prompt();
    return;
  }

  if (cmd === '/memory') {
    const memFile = path.join(cwd, 'MEMORY.md');
    if (!args.length) {
      if (fs.existsSync(memFile)) {
        const content = fs.readFileSync(memFile, 'utf8');
        console.log(p('m', '\n  🧠 MEMÓRIA DO PROJETO (MEMORY.md):'));
        console.log(p('d', content.split('\n').map(l => '  ' + l).join('\n')));
      } else {
        console.log(p('y', '\n  Nenhuma memória (MEMORY.md) encontrada neste diretório.'));
        console.log(p('d', '  Use /memory <texto> para criar uma regra ou preferência persistente.'));
      }
      console.log('');
      return;
    }
    const newMemory = args.join(' ');
    let existing = '';
    if (fs.existsSync(memFile)) {
      existing = fs.readFileSync(memFile, 'utf8').trim() + '\n\n';
    }
    const timestamp = new Date().toISOString().split('T')[0];
    fs.writeFileSync(memFile, existing + `## [${timestamp}]\n- ${newMemory}\n`, 'utf8');
    console.log(p('g', `\n  ✓ Memória atualizada em ${p('c', memFile)}`));
    console.log(p('d', '  O modelo levará isso em consideração nas próximas interações.\n'));
    return;
  }

  if (cmd === '/model') {
    // ── atalhos rápidos por flag: /model default | strong | free | <id-direto> ──
    if (args[0]) {
      const direct = args[0].replace(/[<>[\]]/g, "");
      if (direct === 'strong') {
        if (!MODELS.strong) { console.log(p('red', '  Modelo strong nao configurado no .env')); return; }
        model = MODELS.strong; header(); console.log(p('g', '  Modelo: ' + model)); return;
      }
      if (direct === 'free') {
        if (!MODELS.free) { console.log(p('red', '  Modelo free nao configurado no .env')); return; }
        model = MODELS.free; header(); console.log(p('g', '  Modelo: ' + model)); return;
      }
      if (direct === 'default') {
        model = MODELS.default; header(); console.log(p('g', '  Modelo: ' + model)); return;
      }
      // id direto (ex: /model anthropic/claude-3.5-haiku)
      model = direct; header(); console.log(p('g', '  Modelo alterado para: ' + model)); return;
    }

    // ── PASSO 1: escolha de categoria ────────────────────────────────────────
    const cat = await interactiveSelect('Selecione uma categoria de modelos', CATEGORIES);
    if (!cat) { header(); console.log(p('d', '  Cancelado.')); return; }

    // ── PASSO 2: carrega modelos da categoria ────────────────────────────────
    process.stdout.write('\x1b[2J\x1b[H');
    console.log('\n  ' + p('y', `Buscando modelos "${cat.value}" no OpenRouter...`));
    let modelItems = [];
    try {
      const allModels = await fetchOpenRouterModels();
      let filtered;
      if (cat.value === 'FREE') {
        filtered = allModels.filter(m => {
          const pIn  = parseFloat(m.pricing?.prompt     || '0');
          const pOut = parseFloat(m.pricing?.completion || '0');
          return pIn === 0 && pOut === 0;
        });
      } else {
        const sel = cat.value.toLowerCase();
        filtered = allModels.filter(m => {
          const desc = (m.description || '').toLowerCase();
          const name = (m.id || '').toLowerCase();
          if (sel === 'text') return !desc.includes('image') && !desc.includes('audio') && !desc.includes('video');
          return desc.includes(sel) || name.includes(sel);
        });
      }

      if (!filtered.length) {
        header();
        console.log(p("red", "  Nenhum modelo encontrado para esta categoria."));
        return;
      }

      modelItems = filtered.slice(0, 60).map(m => {
        const ctx = m.context_length ? Math.round(m.context_length / 1024) + 'K' : 'N/A';
        const pIn  = cat.value === 'FREE' ? 'FREE' : formatPrice(m.pricing?.prompt);
        const pOut  = cat.value === 'FREE' ? ''     : ' \u2192 ' + formatPrice(m.pricing?.completion);
        return { label: m.id.padEnd(48) + ctx.padEnd(6) + pIn + pOut, value: m.id };
      });
    } catch (e) {
      header(); console.log(p('red', '  Erro ao buscar modelos: ' + e.message)); return;
    }

    // ── PASSO 3: escolha do modelo ───────────────────────────────────────────
    const chosen = await interactiveSelect(`Modelos ${cat.value}  (\u2191/\u2193 \u00b7 Enter \u00b7 Esc=voltar)`, modelItems, 15);
    header();
    if (!chosen) { console.log(p('d', '  Cancelado.')); return; }
    model = chosen.value;
    console.log(p('g', '  \u2713 Modelo alterado para: ' + model));
    return;
  }

  if (cmd === '/balance') {
    console.log(p('y', '\n  Buscando informações da conta no OpenRouter...'));
    try {
      // 1. Buscar saldo geral real da conta
      const credits = await fetchOpenRouterCredits(API_KEY);
      const totalBought = credits.total_credits || 0;
      const totalGranted = credits.total_granted || 0;
      const totalUsed = credits.total_used || 0;
      const remainingBalance = (totalBought + totalGranted) - totalUsed;

      console.log('\n' + p('c', '  💰 SALDO GERAL DA CONTA:'));
      console.log(`  ${p('d', 'Total comprado + concedido:')} ${p('g', '$' + (totalBought + totalGranted).toFixed(4))}`);
      console.log(`  ${p('d', 'Total já consumido:')} ${p('red', '$' + totalUsed.toFixed(4))}`);
      console.log(`  ${p('d', 'SALDO RESTANTE DISPONÍVEL:')} ${p('g', '$' + remainingBalance.toFixed(4))}`);

      // 2. Buscar limites específicos desta chave API
      const keyInfo = await fetchOpenRouterAuth(API_KEY);
      console.log('\n' + p('c', '  🔑 STATUS DESTA CHAVE API:'));
      console.log(`  ${p('d', 'Label:')} ${keyInfo.label || 'N/A'}`);

      if (keyInfo.limit !== null && keyInfo.limit !== undefined) {
        console.log(`  ${p('d', 'Limite de gasto artificial desta chave:')} $${keyInfo.limit.toFixed(4)}`);
        const keyRemaining = keyInfo.limit_remaining !== null ? keyInfo.limit_remaining : (keyInfo.limit - keyInfo.usage);
        console.log(`  ${p('d', 'Saldo restante específico desta chave:')} ${p('g', '$' + keyRemaining.toFixed(4))}`);
      } else {
        console.log(`  ${p('d', 'Limite desta chave:')} ${p('g', 'Ilimitado (consome diretamente do saldo geral da conta acima)')}`);
      }

      if (totalUsed > 0 && !keyInfo.is_free_tier) {
        // Apenas informativo
      }
    } catch (e) {
      console.log(p("red", "  Erro ao buscar saldo: " + e.message));
    }
    console.log('');
    return;
  }

  if (cmd === '/skills') {
    const list = Object.values(loadSkills());
    if (!list.length) { console.log(p('y', '  Nenhuma skill encontrada.')); return; }
    console.log('');
    for (const s of list) {
      const label = s.isLocal ? p('g', '[L] ') : '    ';
      console.log('  ' + label + p('m', s.name.padEnd(20)) + ' ' + p('d', s.description || s.title));
    }
    console.log('');
    return;
  }

  if (cmd === '/skill') {
    if (!args[0]) { activeSkill = null; header(); console.log(p('y', '  Skill desativada.')); return; }
    if (!skills[args[0]]) { console.log(p('red', '  Skill "'+args[0]+'" nao encontrada.')); return; }
    activeSkill = args[0];
    header();
    console.log(p('m', '  Skill "'+args[0]+'" ativada.'));
    return;
  }

  // Atalho dedicado para o framework Reversa
  if (cmd === '/reversa') {
    if (!skills['reversa']) { console.log(p('red', '  Skill "reversa" nao encontrada. Verifique a pasta skills/.')); return; }
    activeSkill = 'reversa';
    header();
    console.log(p('m', '  ⚙️ Framework Reversa ativado. O agente ira iniciar a analise do projeto legado conforme as diretrizes.'));
    return;
  }

  if (cmd === '/files') {
    const { list_files } = await import('./src/tools/files.js');
    const { files, error } = list_files({ dir: args[0] || '.', max: 60 });
    if (error) { console.log(p('red', '  ' + error)); return; }
    console.log('');
    files.forEach(f => console.log('  ' + p('d', f)));
    console.log('');
    return;
  }

  if (cmd === '/run') {
    const command = args.join(' ');
    if (!command) { console.log(p('red', '  Uso: /run <comando>')); return; }
    const { run_cmd } = await import('./src/tools/shell.js');
    const r = run_cmd({ command, cwd });
    console.log('');
    if (r.stdout) process.stdout.write(r.stdout);
    if (r.stderr) console.log(p('red', r.stderr));
    console.log('');
    return;
  }

  if (cmd === '/status') {
    const { git_status } = await import('./src/tools/shell.js');
    const r = git_status({ dir: cwd });
    console.log('\n' + (r.stdout || p('d', '  Nada.')) + '\n');
    return;
  }

  if (cmd === '/diff') {
    const { git_diff } = await import('./src/tools/shell.js');
    const r = git_diff({ dir: cwd });
    console.log('\n' + (r.stdout || p('d', '  Sem diff.')) + '\n');
    return;
  }

  if (cmd === '/deploy') {
    const [site, env = 'staging'] = args;
    if (!site) { console.log(p('red', '  Uso: /deploy <site> [staging|production]')); return; }
    const { deploy_site } = await import('./src/tools/ssh.js');
    console.log(p('y', '  Deployando "'+site+'" ('+env+')...'));
    const r = await deploy_site({ site, env });
    if (r.error) console.log(p('red', '  ' + r.error));
    else console.log(p('g', '  Concluido!\n') + r.stdout);
    return;
  }

  if (cmd === '/scan') {
    const file = args[0];
    if (!file) { console.log(p('red', '  Uso: /scan <arquivo>')); return; }
    const { run_cmd } = await import('./src/tools/shell.js');
    const r = run_cmd({ command: `python3 ~/kcode/skills/security_analyzer.py "${file}"`, cwd });
    console.log('');
    if (r.stdout) process.stdout.write(r.stdout);
    if (r.stderr) console.log(p('red', r.stderr));
    console.log('');
    return;
  }

  console.log(p('red', '  Desconhecido: ' + cmd + '. Use /help.'));
}

async function chat(input) {
  messages.push({ role: 'user', content: input });
  let sysExtra = activeSkill ? skillSystemPrompt(activeSkill, skills) : '';

  // INJEÇÃO DE MEMÓRIA PERSISTENTE
  const memFile = path.join(cwd, 'MEMORY.md');
  if (fs.existsSync(memFile)) {
    const memContent = fs.readFileSync(memFile, 'utf8').trim();
    if (memContent) {
      sysExtra += `\n\n--- MEMÓRIA DO PROJETO (Regras e Preferências Persistentes) ---\n${memContent}\n--- FIM DA MEMÓRIA ---`;
    }
  }

  let msg;
  try {
    process.stdout.write('\n' + p('c', '  kcode') + ' ');
    msg = await runAgent({ messages, model, apiKey: API_KEY, systemExtra: sysExtra, onToken: t => process.stdout.write(t) });
  } catch (e) {
    if (e.message.includes('402')) {
      console.log('\n' + p('red', '  Erro 402: Sem saldo ou limite atingido no OpenRouter.'));
      console.log(p('y', '  Dica: Modelos ":free" as vezes falham se o provedor estiver instavel.'));
      console.log(p('y', '  Tente o modelo: qwen/qwen-turbo:free ou google/gemini-2.0-flash-exp:free'));
    } else {
      console.log('\n' + p('red', '  Erro: ' + e.message));
    }
    messages.pop();
    return;
  }
  messages.push(msg);

  while (msg.tool_calls && msg.tool_calls.length > 0) {
    console.log('');
    const results = [];
    for (const tc of msg.tool_calls) {
      const name = tc.function.name;
      let args = {};
      try { args = JSON.parse(tc.function.arguments || '{}'); } catch {}

      const REQUIRES_APPROVAL = ['write_file', 'apply_patch', 'run_cmd', 'ssh_exec', 'deploy_site'];
      if (REQUIRES_APPROVAL.includes(name)) {
        const approved = await askPermission(name, args);
        if (!approved) {
          console.log(p('red', '  ❌ Ação cancelada pelo usuário.'));
          results.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ error: 'Ação cancelada pelo usuário por política de segurança.' }) });
          continue;
        }
      }

      console.log(p('y', '  ⚙ ' + name) + p('d', '(' + JSON.stringify(args).slice(0, 80) + ')'));
      const result = await executeTool(name, args);
      console.log(result.error ? p('red', '  ✗ ' + result.error) : p('g', '  ✓ OK'));
      results.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
    }
    messages.push(...results);
    try {
      process.stdout.write('\n' + p('c', '  kcode') + ' ');
      msg = await runAgent({ messages, model, apiKey: API_KEY, systemExtra: sysExtra, onToken: t => process.stdout.write(t) });
      messages.push(msg);
    } catch (e) {
      if (e.message.includes('402')) {
        console.log('\n' + p('red', '  Erro 402: Sem saldo ou limite atingido no OpenRouter.'));
        console.log(p('y', '  Dica: Modelos ":free" as vezes falham se o provedor estiver instavel.'));
        console.log(p('y', '  Tente o modelo: qwen/qwen-turbo:free ou google/gemini-2.0-flash-exp:free'));
      } else {
        console.log('\n' + p('red', '  Erro: ' + e.message));
      }
      break;
    }
  }
  console.log('\n');
  save();
}

header();
rl.prompt();

// Busca de saldo REAL da conta em background na inicialização (não bloqueante)
fetchOpenRouterCredits(API_KEY).then(credits => {
  const totalBought = credits.total_credits || 0;
  const totalGranted = credits.total_granted || 0;
  const totalUsed = credits.total_used || 0;
  const remainingBalance = (totalBought + totalGranted) - totalUsed;
  console.log('\n' + p('g', '  💰 Saldo OpenRouter: $' + remainingBalance.toFixed(4)));
  rl.prompt();
}).catch(() => {
  // Aviso discreto em vez de falha silenciosa total
  console.log('\n' + p('y', '  ⚠️  Não foi possível buscar o saldo do OpenRouter. Verifique sua API_KEY ou conexão.'));
  rl.prompt();
});

rl.on('line', async line => {
  // MODO DE COLAGEM (PASTE MODE)
  if (isPasting) {
    const trimmed = line.trim();
    // Aceita EOF ou eof para ser mais amigável
    if (trimmed === 'EOF' || trimmed === 'eof') {
      isPasting = false;
      const fullText = pasteBuffer.join('\n');
      pasteBuffer = [];

      if (fullText.trim()) {
        const pasteDir = path.join(os.homedir(), '.kcode', 'pastes');
        fs.mkdirSync(pasteDir, { recursive: true });
        const fileName = `pasted_block_${Date.now()}.md`;
        const filePath = path.join(pasteDir, fileName);
        fs.writeFileSync(filePath, fullText, 'utf8');

        const lineCount = fullText.split('\n').length;
        console.log(p('y', `\n  📋 Texto colado com sucesso! (${lineCount} linhas, ${fullText.length} caracteres).`));
        console.log(p('d', `  Salvo em: ${p('c', filePath)}`));
        console.log(p('c', '  kcode ') + p('d', 'Processando o texto colado...\n'));

        const instruction = `O usuário colou um bloco grande de texto usando o modo /paste. O conteúdo foi salvo em: "${filePath}". Por favor, use a ferramenta 'read_file' para ler este arquivo e prossiga com a solicitação do usuário.`;
        await chat(instruction);
      } else {
        console.log(p('d', '  Colagem cancelada (texto vazio).'));
      }
      rl.prompt();
      return;
    } else {
      pasteBuffer.push(line);
    }
    rl.prompt();
    return;
  }

  rl.pause();
  let input = line.trim();

  if (input.toLowerCase() === 'exit') {
    console.log(p('y', '\n  Saindo...'));
    save();
    process.exit(0);
  }

  if (input) {
    if (input.startsWith('/')) await handleCmd(input);
    else await chat(input);
  }
  rl.resume();
  rl.prompt();
}).on('close', () => { save(); process.exit(0); });
