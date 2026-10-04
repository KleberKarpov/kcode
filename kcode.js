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
  if (process.env.OPENROUTER_API_KEY === 'mock' || process.env.KCODE_SIMULATE === 'true') {
    return [
      { id: 'qwen/qwen-2.5-coder-32b-instruct', name: 'Qwen 2.5 Coder 32B Instruct', context_length: 32768, pricing: { prompt: '0.0000002', completion: '0.0000002' } },
      { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1 (Reasoning)', context_length: 65536, pricing: { prompt: '0.00000055', completion: '0.00000219' } },
      { id: 'deepseek/deepseek-chat:free', name: 'DeepSeek V3 (Free)', context_length: 65536, pricing: { prompt: '0', completion: '0' } },
      { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B Instruct', context_length: 131072, pricing: { prompt: '0.00000035', completion: '0.0000004' } },
      { id: 'mistralai/codestral-2501', name: 'Codestral 2501', context_length: 256000, pricing: { prompt: '0.0000003', completion: '0.0000009' } }
    ];
  }
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'kcode-cli/0.3.1'
      }
    };
    https.get("https://openrouter.ai/api/v1/models", options, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode !== 200) {
            reject(new Error(parsed.error?.message || `HTTP ${res.statusCode}`));
          } else if (!parsed || !Array.isArray(parsed.data)) {
            reject(new Error("Resposta inválida do OpenRouter (campo 'data' ausente ou inválido)"));
          } else {
            resolve(parsed.data);
          }
        }
        catch (e) { reject(e); }
      });
    }).on("error", reject);
  });
}

async function fetchOpenRouterAuth(apiKey) {
  if (apiKey === 'mock' || process.env.KCODE_SIMULATE === 'true') {
    return {
      label: 'Simulated Test Key',
      usage: 1.2345,
      usage_daily: 0.5,
      usage_weekly: 1.0,
      usage_monthly: 1.2345,
      limit: 10.0,
      is_free_tier: false
    };
  }
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'openrouter.ai',
      path: '/api/v1/key',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'kcode-cli/0.3.1'
      }
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode !== 200) {
            reject(new Error(parsed.error?.message || `HTTP ${res.statusCode}`));
          } else if (!parsed || !parsed.data) {
            reject(new Error("Invalid OpenRouter response (missing 'data' field)"));
          } else {
            resolve(parsed.data);
          }
        }
        catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

async function fetchOpenRouterCredits(apiKey) {
  if (apiKey === 'mock' || process.env.KCODE_SIMULATE === 'true') {
    return {
      total_credits: 10.0,
      total_usage: 1.2345
    };
  }
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'openrouter.ai',
      path: '/api/v1/credits',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'kcode-cli/0.3.1'
      }
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode !== 200) {
            reject(new Error(parsed.error?.message || `HTTP ${res.statusCode}`));
          } else if (!parsed || !parsed.data) {
            reject(new Error("Invalid OpenRouter response (missing 'data' field from /credits)"));
          } else {
            resolve(parsed.data);
          }
        }
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
if (fs.existsSync(path.join(process.cwd(), '.env'))) {
  dotenv.config({ path: path.join(process.cwd(), '.env'), override: false });
}
if (!process.env.OPENROUTER_API_KEY && fs.existsSync(path.join(os.homedir(), '.kcode', '.env'))) {
  dotenv.config({ path: path.join(os.homedir(), '.kcode', '.env') });
}

const VERSION = '0.4.0';
const rawArgs = process.argv.slice(2);

if (rawArgs.includes('--version') || rawArgs.includes('-v')) {
  console.log(`kcode v${VERSION}`);
  process.exit(0);
}

if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
  console.log(`
kcode v${VERSION} — Terminal AI coding agent powered by OpenRouter

Uso:
  kcode                                Inicia a sessão interativa (REPL)
  kcode run "<prompt>" [opções]        Executa instrução em modo autônomo/headless
  kcode -p "<prompt>" [opções]         Atalho para execução pontual (print mode)
  kcode --balance                      Consulta o saldo real do OpenRouter
  kcode --version, -v                  Exibe a versão do kcode
  kcode --help, -h                     Exibe esta ajuda

Opções do modo headless:
  -m, --model <modelo>                 Especifica o modelo OpenRouter (ex: anthropic/claude-3.5-sonnet)
  -s, --skill <skill>                  Ativa uma skill (ex: reversa, frontend-design)
  -y, --yes                            Auto-aprovação de ferramentas para agentes autônomos
  --no-history                         Não grava no histórico de conversa do projeto
  -q, --quiet                          Omite pensamentos e logs de ferramentas
`);
  process.exit(0);
}

const API_KEY = process.env.OPENROUTER_API_KEY;
const SIMULATE = process.env.KCODE_SIMULATE === 'true';
if (!API_KEY && !SIMULATE) { console.error('\n OPENROUTER_API_KEY nao definida no .env\n'); process.exit(1); }

const MODELS = {
  default: process.env.KCODE_MODEL || 'qwen/qwen-2.5-coder-32b-instruct',
  strong: process.env.KCODE_MODEL_STRONG || 'deepseek/deepseek-r1',
  free: process.env.KCODE_MODEL_FREE || 'deepseek/deepseek-chat:free',
};

const HIST = path.join(os.homedir(), '.kcode', 'history');
fs.mkdirSync(HIST, { recursive: true });

let model = MODELS.default, messages = [], activeSkill = null;

// ── Interactive selector ──────────────────────────────────────────────────────
const CATEGORIES = [
  { label: '★ OPEN SOURCE — Modelos abertos (Qwen, DeepSeek, Llama, Mistral)', value: 'OPENSOURCE' },
  { label: '💻 CODING      — Modelos especializados em programação',           value: 'CODING' },
  { label: '🆓 FREE        — Modelos gratuitos / com cota free',               value: 'FREE' },
  { label: '① Text        — Modelos gerais de texto',                         value: 'Text' },
  { label: '② Image       — Modelos de imagem / multimodais',                 value: 'Image' },
  { label: '③ Audio/Speech',                                                   value: 'Audio' },
];

function renderSelector(title, items, cursor, startIdx = 0, pageSize = 12) {
  process.stdout.write('\x1b[2J\x1b[H'); // clear
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
    if (rl) rl.pause();
    const stdin = process.stdin;
    const prevRaw = stdin.isRaw;
    if (typeof stdin.setRawMode === 'function') {
      stdin.setRawMode(true);
    }
    stdin.resume();

    const redraw = () => renderSelector(title, items, cursor, startIdx, pageSize);
    redraw();

    const onKey = (buf) => {
      const key = buf.toString();
      if (key === '\x03') { // Ctrl+C
        cleanup();
        process.exit(0);
      }
      if (key === '\x1b[A' || key === '\x1b[D') { // up / left
        if (cursor > 0) { cursor--; if (cursor < startIdx) startIdx = cursor; }
      } else if (key === '\x1b[B' || key === '\x1b[C') { // down / right
        if (cursor < items.length - 1) { cursor++; if (cursor >= startIdx + pageSize) startIdx++; }
      } else if (key === '\x1b[5~') { // PgUp
        cursor = Math.max(0, cursor - pageSize);
        startIdx = Math.max(0, startIdx - pageSize);
      } else if (key === '\x1b[6~') { // PgDn
        cursor = Math.min(items.length - 1, cursor + pageSize);
        startIdx = Math.min(Math.max(0, items.length - pageSize), startIdx + pageSize);
      } else if (key === '\r' || key === '\n') { // Enter
        cleanup();
        resolve(items[cursor]);
        return;
      } else if (key === '\x1b' || key === 'q') { // Esc / q
        cleanup();
        resolve(null);
        return;
      }
      redraw();
    };

    const cleanup = () => {
      stdin.removeListener('data', onKey);
      if (typeof stdin.setRawMode === 'function') {
        stdin.setRawMode(prevRaw || false);
      }
      if (rl) rl.resume();
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
    ['/model [nome|id]', 'Navegue e escolha categoria + modelo (setas + Enter)'],
    ['/skill [nome]', 'Ativa/desativa skill'],
    ['/skills', 'Lista skills disponiveis'],
    ['/reversa', 'Ativa o framework Reversa para engenharia reversa'],
    ['/memory [regra]', 'Exibe ou adiciona regras persistentes em MEMORY.md'],
    ['/paste', 'Modo para colar bloco de código longo (termina com EOF)'],
    ['/files [dir]', 'Lista arquivos do projeto'],
    ['/run <cmd>', 'Roda comando local'],
    ['/status', 'Git status'],
    ['/diff', 'Git diff'],
    ['/deploy <site> [staging|prod]', 'Deploy de site'],
    ['/scan <arquivo>', 'Analisa seguranca de um script'],
    ['/balance', 'Verifica saldo e limites no OpenRouter'],
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

let rl = null;

let inPasteMode = false;
let pasteBuffer = [];

async function handleCmd(input) {
  const [cmd, ...args] = input.trim().split(/\s+/);
  if (cmd === '/help') { help(); return; }
  if (cmd === '/exit') { save(); process.exit(0); }
  if (cmd === '/clear') { messages = []; header(); console.log(p('y', '  Historico limpo.')); return; }

  if (cmd === '/model') {
    // ── atalhos rápidos por flag: /model default | strong | free | <id-direto> ──
    if (args[0]) {
      const direct = args[0].replace(/[<>[\\]]/g, '');
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
      // id direto (ex: /model qwen/qwen-2.5-coder-32b-instruct)
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
          const isFreeId = (m.id || '').toLowerCase().includes(':free');
          const pIn  = parseFloat(m.pricing?.prompt     || '0');
          const pOut = parseFloat(m.pricing?.completion || '0');
          return isFreeId || (pIn === 0 && pOut === 0);
        });
      } else if (cat.value === 'OPENSOURCE') {
        const openKeywords = ['qwen', 'deepseek', 'meta-llama', 'llama', 'mistral', 'gemma', 'phi-', 'nous', 'hermes', 'codestral', 'yi-'];
        filtered = allModels.filter(m => {
          const id = (m.id || '').toLowerCase();
          return openKeywords.some(kw => id.includes(kw));
        });
      } else if (cat.value === 'CODING') {
        const codeKeywords = ['coder', 'code', 'codestral', 'dev', 'program', 'sql', 'starcoder'];
        filtered = allModels.filter(m => {
          const id = (m.id || '').toLowerCase();
          const desc = (m.description || '').toLowerCase();
          return codeKeywords.some(kw => id.includes(kw) || desc.includes(kw));
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
        console.log(p('red', '  Nenhum modelo encontrado para esta categoria.'));
        return;
      }

      modelItems = filtered.slice(0, 60).map(m => {
        const ctx = m.context_length ? Math.round(m.context_length / 1024) + 'K' : 'N/A';
        const pIn  = cat.value === 'FREE' ? 'FREE' : formatPrice(m.pricing?.prompt);
        const pOut  = cat.value === 'FREE' ? ''     : ' → ' + formatPrice(m.pricing?.completion);
        return { label: m.id.padEnd(48) + ctx.padEnd(6) + pIn + pOut, value: m.id };
      });
    } catch (e) {
      header(); console.log(p('red', '  Erro ao buscar modelos: ' + e.message)); return;
    }

    // ── PASSO 3: escolha do modelo ───────────────────────────────────────────
    const chosen = await interactiveSelect(`Modelos ${cat.value}  (↑/↓ · Enter · Esc=voltar)`, modelItems, 15);
    header();
    if (!chosen) { console.log(p('d', '  Cancelado.')); return; }
    model = chosen.value;
    console.log(p('g', '  ✓ Modelo alterado para: ' + model));
    return;
  }

  if (cmd === '/balance') {
    console.log(p('y', '\n  Fetching account info from OpenRouter...'));
    try {
      // Fetch both endpoints in parallel for speed
      const [credits, auth] = await Promise.all([
        fetchOpenRouterCredits(API_KEY).catch(() => null),
        fetchOpenRouterAuth(API_KEY)
      ]);

      // ── Account-level balance (from /api/v1/credits) ──
      if (credits) {
        const totalCredits = credits.total_credits || 0;
        const totalUsage = credits.total_usage || 0;
        const remaining = totalCredits - totalUsage;
        const usagePct = totalCredits > 0 ? ((totalUsage / totalCredits) * 100).toFixed(1) : '0.0';

        console.log('\n' + p('c', '  💰 ACCOUNT BALANCE:'));
        console.log(`  ${p('d', 'Total credits purchased:')}   ${p('g', '$' + totalCredits.toFixed(4))}`);
        console.log(`  ${p('d', 'Total consumed (all keys):')} ${p('y', '$' + totalUsage.toFixed(4))} (${usagePct}%)`);
        const balColor = remaining > 5 ? 'g' : remaining > 1 ? 'y' : 'red';
        console.log(`  ${p('d', 'REMAINING BALANCE:')}         ${p(balColor, '$' + remaining.toFixed(4))}`);
      } else {
        console.log('\n' + p('y', '  ⚠  Could not fetch account credits (may require a Management API key).'));
        console.log(p('d', '     Check your balance at: https://openrouter.ai/activity'));
      }

      // ── Per-key usage details (from /api/v1/key) ──
      console.log('\n' + p('c', '  🔑 THIS API KEY:'));
      console.log(`  ${p('d', 'Label:')}             ${auth.label || 'N/A'}`);
      console.log(`  ${p('d', 'All-time usage:')}    ${p('g', '$' + (auth.usage || 0).toFixed(4))}`);

      if (auth.usage_daily !== undefined) {
        console.log(`  ${p('d', 'Today:')}             ${p('d', '$' + (auth.usage_daily || 0).toFixed(4))}`);
      }
      if (auth.usage_weekly !== undefined) {
        console.log(`  ${p('d', 'This week:')}         ${p('d', '$' + (auth.usage_weekly || 0).toFixed(4))}`);
      }
      if (auth.usage_monthly !== undefined) {
        console.log(`  ${p('d', 'This month:')}        ${p('d', '$' + (auth.usage_monthly || 0).toFixed(4))}`);
      }

      if (auth.limit !== null && auth.limit !== undefined) {
        console.log(`  ${p('d', 'Key limit:')}         $${auth.limit.toFixed(4)}`);
        const keyRemaining = auth.limit - (auth.usage || 0);
        console.log(`  ${p('d', 'Key remaining:')}     ${p('g', '$' + keyRemaining.toFixed(4))}`);
      } else {
        console.log(`  ${p('d', 'Key limit:')}         ${p('g', 'Unlimited (uses account credits)')}`);
      }

      if (auth.is_free_tier) {
        console.log(p('red', '\n  ⚠ This key appears to be limited to the Free Tier.'));
      }
    } catch (e) {
      console.log(p("red", "  Error fetching balance: " + e.message));
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

  if (cmd === '/reversa') {
    activeSkill = 'reversa';
    header();
    console.log(p('g', '  ✓ Framework Reversa ativado!\n'));
    console.log(p('d', '  O Reversa documenta e analisa sistemas legados gerando especificações em .reversa/ e _reversa_sdd/.'));
    console.log(p('d', '  Comandos sugeridos: "faça o scout do projeto", "mapeie a arquitetura", "documente os endpoints".\n'));
    return;
  }

  if (cmd === '/memory') {
    const memFile = path.join(cwd, 'MEMORY.md');
    const rule = args.join(' ').trim();
    if (!rule) {
      if (fs.existsSync(memFile)) {
        console.log(p('c', '\n  🧠 REGRAS EM MEMORY.md:\n'));
        console.log(p('d', fs.readFileSync(memFile, 'utf8')) + '\n');
      } else {
        console.log(p('y', '\n  Nenhuma regra encontrada em MEMORY.md. Use: /memory <sua regra>\n'));
      }
      return;
    }
    const timestamp = new Date().toISOString().split('T')[0];
    const entry = `- [${timestamp}] ${rule}\n`;
    fs.appendFileSync(memFile, entry, 'utf8');
    console.log(p('g', `\n  ✓ Regra adicionada ao MEMORY.md:`));
    console.log(p('d', `    ${rule}\n`));
    return;
  }

  if (cmd === '/paste') {
    inPasteMode = true;
    pasteBuffer = [];
    console.log(p('y', '\n  📋 MODO COLAR ATIVADO'));
    console.log(p('d', '  Cole seu texto/código abaixo. Para enviar, digite ') + p('g', 'EOF') + p('d', ' sozinho em uma linha e tecle Enter.\n'));
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
    const scriptPath = path.join(__dirname, 'skills', 'security_analyzer.py');
    const { run_cmd } = await import('./src/tools/shell.js');
    const r = run_cmd({ command: `python3 "${scriptPath}" "${file}"`, cwd });
    console.log('');
    if (r.stdout) process.stdout.write(r.stdout);
    if (r.stderr) console.log(p('red', r.stderr));
    console.log('');
    return;
  }

  console.log(p('red', '  Desconhecido: ' + cmd + '. Use /help.'));
}

const DANGEROUS_TOOLS = new Set([
  'write_file',
  'replace_in_file',
  'apply_patch',
  'run_cmd',
  'ssh_exec',
  'deploy_site'
]);

async function chat(input, options = {}) {
  const { headless = false, quiet = false, noHistory = false, autoYes = false } = options;
  messages.push({ role: 'user', content: input });

  // Injeção contextual persistente de MEMORY.md se existir
  let memContext = '';
  const memPath = path.join(cwd, 'MEMORY.md');
  if (fs.existsSync(memPath)) {
    try {
      const memContent = fs.readFileSync(memPath, 'utf8').trim();
      if (memContent) {
        memContext = `\n\n--- REGRAS PERSISTENTES DO PROJETO (MEMORY.md) ---\n${memContent}\n--- FIM MEMORY.md ---`;
      }
    } catch {}
  }
  const sysExtra = (activeSkill ? skillSystemPrompt(activeSkill, skills) : '') + memContext;

  let isThinking = false;
  const onReasoning = (token) => {
    if (quiet) return;
    if (!isThinking) {
      isThinking = true;
      process.stdout.write(p('d', '\n  💭 [Pensamento: '));
    }
    process.stdout.write(C.d + token + C.r);
  };

  const onToken = (token) => {
    if (isThinking) {
      isThinking = false;
      if (!quiet) process.stdout.write(p('d', ']\n\n') + p('c', '  kcode') + ' ');
    }
    process.stdout.write(token);
  };

  let msg;
  try {
    if (!quiet) process.stdout.write('\n' + p('c', '  kcode') + ' ');
    msg = await runAgent({ messages, model, apiKey: API_KEY, systemExtra: sysExtra, onToken, onReasoning });
    if (isThinking && !quiet) {
      process.stdout.write(p('d', ']\n'));
    }
  } catch (e) {
    if (e.message.includes('402')) {
      console.log('\n' + p('red', '  Erro 402: Sem saldo ou limite atingido no OpenRouter.'));
      console.log(p('y', '  Dica: Modelos ":free" as vezes falham se o provedor estiver instavel.'));
      console.log(p('y', '  Tente o modelo: qwen/qwen-2.5-coder-32b-instruct ou deepseek/deepseek-chat:free'));
    } else {
      console.log('\n' + p('red', '  Erro: ' + e.message));
    }
    messages.pop();
    if (headless) process.exit(1);
    return;
  }

  if (!msg) {
    console.log('\n' + p('red', '  Erro: Resposta vazia da LLM.'));
    messages.pop();
    if (headless) process.exit(1);
    return;
  }
  messages.push(msg);

  let stepCount = 0;
  const MAX_TOOL_STEPS = 15;

  while (msg && msg.tool_calls && msg.tool_calls.length > 0 && stepCount < MAX_TOOL_STEPS) {
    stepCount++;
    if (!quiet) console.log('');
    const results = [];
    for (const tc of msg.tool_calls) {
      const name = tc.function.name;
      let args = {};
      try { args = JSON.parse(tc.function.arguments || '{}'); } catch {}

      // Salvaguarda: em modo headless sem --yes, bloquear ferramentas com efeitos colaterais
      if (headless && !autoYes && DANGEROUS_TOOLS.has(name)) {
        const errorMsg = `Operação '${name}' bloqueada: em modo headless sem a flag --yes / -y, apenas ferramentas seguras de leitura são permitidas.`;
        if (!quiet) console.log(p('red', '  ✗ ' + errorMsg));
        results.push({ role: 'tool', tool_call_id: tc.id || `call_${Date.now()}`, content: JSON.stringify({ error: errorMsg }) });
        continue;
      }

      if (!quiet) console.log(p('y', '  ⚙ ' + name) + p('d', '(' + JSON.stringify(args).slice(0, 80) + ')'));
      const result = await executeTool(name, args);
      if (!quiet) console.log(result.error ? p('red', '  ✗ ' + result.error) : p('g', '  ✓ OK'));
      results.push({ role: 'tool', tool_call_id: tc.id || `call_${Date.now()}`, content: JSON.stringify(result) });
    }

    const previousLength = messages.length;
    messages.push(...results);

    try {
      isThinking = false;
      if (!quiet) process.stdout.write('\n' + p('c', '  kcode') + ' ');
      msg = await runAgent({ messages, model, apiKey: API_KEY, systemExtra: sysExtra, onToken, onReasoning });
      if (isThinking && !quiet) {
        process.stdout.write(p('d', ']\n'));
      }
      if (!msg) {
        console.log('\n' + p('red', '  Erro: Resposta vazia da LLM.'));
        messages.splice(previousLength);
        if (headless) process.exit(1);
        break;
      }
      messages.push(msg);
    } catch (e) {
      console.log('\n' + p('red', '  Erro: ' + e.message));
      // Reverte mensagens de ferramenta não respondidas para evitar envenenar o histórico da sessão
      messages.splice(previousLength);
      if (headless) process.exit(1);
      break;
    }
  }

  if (stepCount >= MAX_TOOL_STEPS && !quiet) {
    console.log('\n' + p('y', '  ⚠️ Limite máximo de iterações de ferramentas atingido (15 passos).'));
  }

  console.log('\n');
  if (!noHistory) save();
  if (headless) process.exit(0);
}

function startREPL() {
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '\n' + p('g', '❯') + ' '
  });

  header();
  rl.prompt();

  // Fetch real account balance in background on startup (non-blocking)
  // Set KCODE_SHOW_BALANCE=false in .env to disable
  const SHOW_BALANCE = (process.env.KCODE_SHOW_BALANCE || 'true').toLowerCase() !== 'false';
  if (SHOW_BALANCE) {
    const balanceTimeout = setTimeout(() => {}, 8000);

    fetchOpenRouterCredits(API_KEY).then(credits => {
      clearTimeout(balanceTimeout);
      const totalCredits = credits.total_credits || 0;
      const totalUsage = credits.total_usage || 0;
      const remainingBalance = totalCredits - totalUsage;
      const balColor = remainingBalance > 5 ? 'g' : remainingBalance > 1 ? 'y' : 'red';
      console.log('\n' + p(balColor, '  💰 OpenRouter Balance: $' + remainingBalance.toFixed(2)));
      rl.prompt();
    }).catch((err) => {
      clearTimeout(balanceTimeout);
      console.log('\n' + p('y', '  ⚠️  Could not fetch balance: ' + (err.message || 'unknown error')));
      rl.prompt();
    });
  }

  rl.on('line', async line => {
    rl.pause();
    if (inPasteMode) {
      if (line.trim() === 'EOF') {
        inPasteMode = false;
        const content = pasteBuffer.join('\n').trim();
        pasteBuffer = [];
        if (!content) {
          console.log(p('y', '  Modo colar cancelado (conteúdo vazio).\n'));
        } else {
          console.log(p('g', `\n  ✓ Recebido bloco com ${content.split('\n').length} linhas. Enviando...\n`));
          await chat(content);
        }
      } else {
        pasteBuffer.push(line);
        rl.resume();
        return;
      }
    } else {
      const input = line.trim();
      if (input) {
        if (input.startsWith('/')) await handleCmd(input);
        else await chat(input);
      }
    }
    rl.resume();
    rl.prompt();
  }).on('close', () => { save(); process.exit(0); });
}

async function main() {
  if (rawArgs.includes('--balance')) {
    try {
      const credits = await fetchOpenRouterCredits(API_KEY);
      const totalCredits = credits.total_credits || 0;
      const totalUsage = credits.total_usage || 0;
      const remainingBalance = totalCredits - totalUsage;
      const balColor = remainingBalance > 5 ? 'g' : remainingBalance > 1 ? 'y' : 'red';
      console.log(p(balColor, `💰 OpenRouter Balance: $${remainingBalance.toFixed(2)} (Total: $${totalCredits.toFixed(2)}, Consumo: $${totalUsage.toFixed(2)})`));

      // Auditoria de governança da chave (OpenRouter Key Security)
      try {
        const keyInfo = await fetchOpenRouterAuth(API_KEY);
        if (keyInfo.limit !== null && keyInfo.limit !== undefined) {
          console.log(p('d', `   Limite configurado na chave: $${keyInfo.limit.toFixed(2)} | Consumo da chave: $${(keyInfo.usage || 0).toFixed(2)}`));
        } else {
          console.log(p('y', `   ⚠️  Aviso de Segurança: Chave sem limite de crédito configurado no OpenRouter.`));
          console.log(p('d', `   Recomendação: Defina um limite em https://openrouter.ai/settings/keys para proteger contra consumo excessivo por agentes autônomos.`));
        }
      } catch {}

      process.exit(0);
    } catch (err) {
      console.error(p('red', `⚠️ Erro ao consultar saldo: ${err.message}`));
      process.exit(1);
    }
  }

  // Parse headless / one-shot execution
  let isHeadless = false;
  let promptText = '';
  let selectedModel = null;
  let selectedSkill = null;
  let autoYes = false;
  let noHistory = false;
  let quietMode = false;

  let i = 0;
  if (rawArgs.length > 0) {
    if (rawArgs[0] === 'run') {
      isHeadless = true;
      i = 1;
    } else if (rawArgs[0] === '-p' || rawArgs[0] === '--prompt') {
      isHeadless = true;
      i = 1;
      if (i < rawArgs.length && !rawArgs[i].startsWith('-')) {
        promptText = rawArgs[i];
        i++;
      }
    } else if (!rawArgs[0].startsWith('-')) {
      isHeadless = true;
      promptText = rawArgs[0];
      i = 1;
    }
  }

  while (i < rawArgs.length) {
    const arg = rawArgs[i];
    if (arg === '-m' || arg === '--model') {
      selectedModel = rawArgs[++i];
    } else if (arg === '-s' || arg === '--skill') {
      selectedSkill = rawArgs[++i];
    } else if (arg === '-y' || arg === '--yes') {
      autoYes = true;
    } else if (arg === '--no-history') {
      noHistory = true;
    } else if (arg === '-q' || arg === '--quiet') {
      quietMode = true;
    } else if (!promptText && !arg.startsWith('-')) {
      promptText = arg;
    }
    i++;
  }

  if (isHeadless) {
    if (!promptText) {
      console.error(p('red', 'Erro: Nenhum prompt informado para execução headless.'));
      console.error(p('d', 'Exemplo: kcode run "Refatore a função" -y'));
      process.exit(1);
    }
    if (selectedModel) {
      if (MODELS[selectedModel]) model = MODELS[selectedModel];
      else model = selectedModel;
    }
    if (selectedSkill) activeSkill = selectedSkill;

    await chat(promptText, { headless: true, autoYes, quiet: quietMode, noHistory });
    return;
  }

  startREPL();
}

main().catch(err => {
  console.error(p('red', 'Erro fatal: ' + err.message));
  process.exit(1);
});
