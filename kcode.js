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
      { id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku', context_length: 200000, pricing: { prompt: '0.000001', completion: '0.000005' } },
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', context_length: 200000, pricing: { prompt: '0.000003', completion: '0.000015' } },
      { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash Exp (Free)', context_length: 1048576, pricing: { prompt: '0', completion: '0' } },
      { id: 'qwen/qwen-turbo:free', name: 'Qwen Turbo (Free)', context_length: 32768, pricing: { prompt: '0', completion: '0' } }
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

const VERSION = '0.3.1';
const API_KEY = process.env.OPENROUTER_API_KEY;
const SIMULATE = process.env.KCODE_SIMULATE === 'true';
if (!API_KEY && !SIMULATE) { console.error('\n OPENROUTER_API_KEY nao definida no .env\n'); process.exit(1); }

const MODELS = {
  default: process.env.KCODE_MODEL || 'anthropic/claude-3.5-haiku',
  strong: process.env.KCODE_MODEL_STRONG || '',
  free: process.env.KCODE_MODEL_FREE || '',
};

const HIST = path.join(os.homedir(), '.kcode', 'history');
fs.mkdirSync(HIST, { recursive: true });

let model = MODELS.default, messages = [], activeSkill = null;

// ── Interactive selector ──────────────────────────────────────────────────────
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
    rl.pause();
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
    ['/model', 'Navegue e escolha categoria + modelo (setas + Enter)'],
    ['/skill [nome]', 'Ativa/desativa skill'],
    ['/skills', 'Lista skills disponiveis'],
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
  const sysExtra = activeSkill ? skillSystemPrompt(activeSkill, skills) : '';
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
  if (!msg) {
    console.log('\n' + p('red', '  Erro: Resposta vazia da LLM.'));
    messages.pop();
    return;
  }
  messages.push(msg);

  while (msg && msg.tool_calls && msg.tool_calls.length > 0) {
    console.log('');
    const results = [];
    for (const tc of msg.tool_calls) {
      const name = tc.function.name;
      let args = {};
      try { args = JSON.parse(tc.function.arguments || '{}'); } catch {}
      console.log(p('y', '  ⚙ ' + name) + p('d', '(' + JSON.stringify(args).slice(0, 80) + ')'));
      const result = await executeTool(name, args);
      console.log(result.error ? p('red', '  ✗ ' + result.error) : p('g', '  ✓ OK'));
      results.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
    }
    messages.push(...results);
    try {
      process.stdout.write('\n' + p('c', '  kcode') + ' ');
      msg = await runAgent({ messages, model, apiKey: API_KEY, systemExtra: sysExtra, onToken: t => process.stdout.write(t) });
      if (!msg) {
        console.log('\n' + p('red', '  Erro: Resposta vazia da LLM.'));
        break;
      }
      messages.push(msg);
    } catch (e) {
      console.log('\n' + p('red', '  Erro: ' + e.message));
      break;
    }
  }
  console.log('\n');
  save();
}

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
  const input = line.trim();
  if (input) {
    if (input.startsWith('/')) await handleCmd(input);
    else await chat(input);
  }
  rl.resume();
  rl.prompt();
}).on('close', () => { save(); process.exit(0); });
