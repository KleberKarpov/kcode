import { execSync } from 'child_process';

const TIMEOUT = 30_000;
const MAX_LINES = 150;

// Padrões perigosos baseados em regex para capturar variações de comandos destrutivos
const DANGEROUS_PATTERNS = [
  /\brm\s+-(?:[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*|[a-zA-Z]*f[a-zA-Z]*r[a-zA-Z]*|[rfvRFV]+)\b/i, // rm -rf, rm -fr, rm -rvf, etc.
  /\brm\s+-[a-zA-Z]*r[a-zA-Z]*\b/i,               // rm -r ou rm -R (recursivo, mesmo sem -f)
  /\bmkfs\b/i,                                    // formatação de disco
  /:\(\)\{\s*:\|\:&\s*\}\s*;/i,                   // fork bomb
  /\bdd\s+if=\/dev\/zero\b/i,                     // sobrescrita de disco
  /\bchmod\s+(?:-R\s+)?777\s/i,                   // permissões inseguras
  /^\s*sudo\s+/i,                                 // elevação de privilégio
  /^\s*su\s*$/i,                                  // troca de usuário
  /\bgit\s+reset\s+--hard\b/i,                    // destruição de mudanças locais
  /\bgit\s+push\s+--force(?:\s|$)/i,              // reescrita de histórico remoto
  />\s*\/dev\/sda/i,                              // redirecionamento para dispositivo
  />\s*\/etc\/passwd/i,                           // corrupção de arquivos de sistema
  />\s*\/etc\/shadow/i,
];

export function run_cmd({ command, cwd = '.', timeout = TIMEOUT }) {
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      return { error: `Comando bloqueado por política de segurança: padrão perigoso detectado. Operações destrutivas ou de alto risco não são permitidas.` };
    }
  }

  try {
    let output = execSync(command, {
      cwd,
      encoding: 'utf8',
      timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 1024 * 1024 * 5 // 5MB para evitar MaxBufferExceeded em saídas grandes
    });

    // Truncação inteligente de saída para economizar tokens do modelo
    const lines = output.split('\n');
    if (lines.length > MAX_LINES) {
      const head = lines.slice(0, 75).join('\n');
      const tail = lines.slice(-75).join('\n');
      output = `${head}\n\n--- [SAÍDA TRUNCADA: ${lines.length - 150} linhas omitidas para economizar tokens. Use grep, head ou tail para ver o meio] ---\n\n${tail}`;
    }

    return { stdout: output, exit: 0 };
  } catch (e) {
    let stderr = e.stderr || e.message || '';
    const errLines = stderr.split('\n');
    if (errLines.length > MAX_LINES) {
      const head = errLines.slice(0, 75).join('\n');
      const tail = errLines.slice(-75).join('\n');
      stderr = `${head}\n\n--- [ERRO TRUNCADO: ${errLines.length - 150} linhas omitidas] ---\n\n${tail}`;
    }
    return { stdout: e.stdout || '', stderr, exit: e.status || 1 };
  }
}

export function git_status({ dir = '.' }) {
  return run_cmd({ command: 'git status --short', cwd: dir });
}

export function git_diff({ dir = '.', staged = false }) {
  const flag = staged ? '--staged' : '';
  return run_cmd({ command: `git diff ${flag}`, cwd: dir });
}
