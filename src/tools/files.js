import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const MAX_FILE_SIZE = 500 * 1024; // Aumentado para 500kb para lidar com arquivos de código maiores
const MAX_LINES = 150;

export function read_file({ path: filePath }) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) return { error: `Arquivo não encontrado: ${filePath}` };
  const stat = fs.statSync(abs);
  if (stat.size > MAX_FILE_SIZE) {
    return { error: `Arquivo muito grande (${Math.round(stat.size/1024)}kb). Limite: 500kb. Use 'find_in_repo' ou 'run_cmd' com 'grep' para buscar trechos específicos.` };
  }

  try {
    const content = fs.readFileSync(abs, 'utf8');
    const lines = content.split('\n');

    // Truncação inteligente se o arquivo tiver muitas linhas (mesmo sendo < 500kb)
    if (lines.length > MAX_LINES * 2) {
      const head = lines.slice(0, MAX_LINES).join('\n');
      const tail = lines.slice(-MAX_LINES).join('\n');
      return {
        content: `${head}\n\n--- [ARQUIVO TRUNCADO: ${lines.length - (MAX_LINES * 2)} linhas omitidas. Use 'run_cmd' com 'grep' ou 'sed' para ver o meio] ---\n\n${tail}`,
        path: abs,
        truncated: true
      };
    }

    return { content, path: abs };
  } catch (e) {
    return { error: `Erro ao ler arquivo: ${e.message}` };
  }
}

export function write_file({ path: filePath, content }) {
  const abs = path.resolve(filePath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const exists = fs.existsSync(abs);
  if (exists) {
    const backup = abs + '.kcode.bak';
    fs.copyFileSync(abs, backup);
  }
  fs.writeFileSync(abs, content, 'utf8');
  return { ok: true, path: abs, backup: exists ? abs + '.kcode.bak' : null };
}

export function list_files({ dir = '.', pattern = '*', max = 80 }) {
  const abs = path.resolve(dir);
  if (!fs.existsSync(abs)) return { error: `Diretório não encontrado: ${dir}` };
  try {
    const result = execSync(
      `find "${abs}" -maxdepth 3 -type f -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/.next/*" -not -path "*/dist/*" -not -path "*/__pycache__/*" | head -${max}`,
      { encoding: 'utf8', maxBuffer: 1024 * 1024 * 2 }
    );
    const files = result.trim().split('\n').filter(Boolean);
    return { files, count: files.length, truncated: files.length >= max };
  } catch (e) {
    return { error: e.message };
  }
}

export function find_in_repo({ query, dir = '.', ext = '' }) {
  const abs = path.resolve(dir);
  const extFilter = ext ? `--include="*.${ext}"` : '';
  try {
    const result = execSync(
      `grep -r ${extFilter} -n -l "${query}" "${abs}" 2>/dev/null | grep -v node_modules | grep -v .git | head -20`,
      { encoding: 'utf8', maxBuffer: 1024 * 1024 * 2 }
    );
    const files = result.trim().split('\n').filter(Boolean);
    if (!files.length) return { files: [], matches: [] };

    const matches = [];
    for (const f of files.slice(0, 5)) {
      const lines = execSync(`grep -n -C 2 "${query}" "${f}" 2>/dev/null`, { encoding: 'utf8', maxBuffer: 1024 * 1024 })
        .trim().split('\n').slice(0, 15);
      matches.push({ file: path.relative(process.cwd(), f), lines });
    }
    return { files: files.map(f => path.relative(process.cwd(), f)), matches };
  } catch (e) {
    return { files: [], matches: [], note: 'Nenhum resultado encontrado.' };
  }
}

export function apply_patch({ path: filePath, patch: patchContent }) {
  const abs = path.resolve(filePath);
  const tmpPatch = `/tmp/kcode_${Date.now()}.patch`;
  fs.writeFileSync(tmpPatch, patchContent, 'utf8');
  try {
    execSync(`patch "${abs}" "${tmpPatch}"`, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 2 });
    fs.unlinkSync(tmpPatch);
    return { ok: true, path: abs };
  } catch (e) {
    fs.unlinkSync(tmpPatch);
    return { error: `Falha ao aplicar patch: ${e.message}` };
  }
}
