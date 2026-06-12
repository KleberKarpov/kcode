import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GLOBAL_SKILLS_DIR = path.resolve(__dirname, '../skills');
const LOCAL_SKILLS_DIR = path.join(process.cwd(), 'skills');

export function loadSkills() {
  const skills = {};

  const loadFromDir = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      const skillFile = path.join(dir, name, 'SKILL.md');
      if (fs.existsSync(skillFile)) {
        const content = fs.readFileSync(skillFile, 'utf8');
        const titleMatch = content.match(/^#\s+(.+)/m);
        const descMatch = content.match(/description:\s*(.+)/i);
        skills[name] = {
          name,
          title: titleMatch ? titleMatch[1] : name,
          description: descMatch ? descMatch[1] : '',
          content,
          isLocal: dir === LOCAL_SKILLS_DIR
        };
      }
    }
  };

  loadFromDir(GLOBAL_SKILLS_DIR);
  loadFromDir(LOCAL_SKILLS_DIR);

  return skills;
}

export function skillSystemPrompt(skillName, skills) {
  const skill = skills[skillName];
  if (!skill) return null;
  const prefix = skill.isLocal ? " (LOCAL)" : "";
  return `\n\n--- SKILL ATIVA: ${skill.title}${prefix} ---\n${skill.content}\n--- FIM DA SKILL ---`;
}
