import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const MAX_FILE_SIZE = 500 * 1024; // Aumentado para 500kb para lidar com arquivos de código maiores
const MAX_LINES = 150;

export function read_file({ path: filePath, start_line, end_line }) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) return { error: `Arquivo não encontrado: ${filePath}` };
  const stat = fs.statSync(abs);
  if (stat.size > MAX_FILE_SIZE) {
    return { error: `Arquivo muito grande (${Math.round(stat.size/1024)}kb). Limite: 500kb. Use 'find_in_repo' ou 'read_file' especificando 'start_line' e 'end_line'.` };
  }

  try {
    const content = fs.readFileSync(abs, 'utf8');
    const lines = content.split('\n');
    const totalLines = lines.length;

    // Se foram especificados limites de linhas (1-indexed)
    if (start_line !== undefined || end_line !== undefined) {
      const start = Math.max(1, parseInt(start_line, 10) || 1);
      const end = Math.min(totalLines, parseInt(end_line, 10) || totalLines);
      if (start > end) {
        return { error: `start_line (${start}) deve ser menor ou igual a end_line (${end}). Total de linhas: ${totalLines}.` };
      }
      const slice = lines.slice(start - 1, end).map((line, idx) => `${start + idx}: ${line}`).join('\n');
      return {
        content: slice,
        path: abs,
        start_line: start,
        end_line: end,
        total_lines: totalLines
      };
    }

    // Truncação inteligente se o arquivo tiver muitas linhas (mesmo sendo < 500kb)
    if (lines.length > MAX_LINES * 2) {
      const head = lines.slice(0, MAX_LINES).map((l, i) => `${i + 1}: ${l}`).join('\n');
      const tail = lines.slice(-MAX_LINES).map((l, i) => `${totalLines - MAX_LINES + i + 1}: ${l}`).join('\n');
      return {
        content: `${head}\n\n--- [ARQUIVO TRUNCADO: ${totalLines - (MAX_LINES * 2)} linhas omitidas. Use 'read_file' com 'start_line' e 'end_line' para ver partes específicas] ---\n\n${tail}`,
        path: abs,
        total_lines: totalLines,
        truncated: true
      };
    }

    const numbered = lines.map((line, idx) => `${idx + 1}: ${line}`).join('\n');
    return { content: numbered, raw_content: content, path: abs, total_lines: totalLines };
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

export function replace_in_file({ path: filePath, target, replacement }) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) return { error: `Arquivo não encontrado: ${filePath}` };
  if (target === undefined || replacement === undefined) {
    return { error: `Parâmetros 'target' e 'replacement' são obrigatórios.` };
  }

  try {
    const content = fs.readFileSync(abs, 'utf8');
    if (!content.includes(target)) {
      return {
        error: `O texto 'target' não foi encontrado no arquivo. Verifique espaços e quebras de linha com 'read_file'.`,
        path: abs
      };
    }

    const occurrences = content.split(target).length - 1;
    if (occurrences > 1) {
      return {
        error: `O texto 'target' aparece ${occurrences} vezes no arquivo. Forneça mais linhas de contexto ao redor do trecho para garantir substituição única.`,
        path: abs
      };
    }

    // Cria backup antes da substituição
    const backup = abs + '.kcode.bak';
    fs.copyFileSync(abs, backup);

    const updated = content.replace(target, replacement);
    fs.writeFileSync(abs, updated, 'utf8');

    return {
      ok: true,
      path: abs,
      backup,
      message: `Substituição realizada com sucesso no arquivo ${path.basename(abs)}.`
    };
  } catch (e) {
    return { error: `Erro ao substituir conteúdo: ${e.message}` };
  }
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
  if (!fs.existsSync(abs)) return { files: [], matches: [], error: `Diretório não encontrado: ${dir}` };
  const safeQuery = String(query).replace(/["\\$`]/g, '\\$&');
  const extFilter = ext ? `--include="*.${ext.replace(/[^a-zA-Z0-9_-]/g, '')}"` : '';
  try {
    const result = execSync(
      `grep -r ${extFilter} -n -l "${safeQuery}" "${abs}" 2>/dev/null | grep -v node_modules | grep -v .git | head -20`,
      { encoding: 'utf8', maxBuffer: 1024 * 1024 * 2 }
    );
    const files = result.trim().split('\n').filter(Boolean);
    if (!files.length) return { files: [], matches: [] };

    const matches = [];
    for (const f of files.slice(0, 5)) {
      const lines = execSync(`grep -n -C 2 "${safeQuery}" "${f}" 2>/dev/null`, { encoding: 'utf8', maxBuffer: 1024 * 1024 })
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
