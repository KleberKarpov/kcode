import { Client } from 'ssh2';
import fs from 'fs';
import os from 'os';
import path from 'path';
import readline from 'readline';

const allowedHosts = (process.env.SSH_ALLOWED_HOSTS || '').split(',').map(h => h.trim()).filter(Boolean);
const defaultUser = process.env.SSH_DEFAULT_USER || 'root';
const keyPath = (process.env.SSH_KEY_PATH || '~/.ssh/id_rsa').replace('~', os.homedir());
let deployConfig = {};
try { deployConfig = JSON.parse(process.env.DEPLOY_SITES || '{}'); } catch {}

function confirm(prompt) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, ans => { rl.close(); resolve(ans.toLowerCase().trim() === 'y'); });
  });
}

export async function ssh_exec({ host, command, user, require_confirm = false }) {
  if (allowedHosts.length && !allowedHosts.includes(host)) {
    return { error: `Host não permitido: ${host}. Adiciona em SSH_ALLOWED_HOSTS no .env` };
  }
  if (require_confirm) {
    const ok = await confirm(`\n⚠️  SSH ${user || defaultUser}@${host} → "${command}"\nConfirmar? [y/N] `);
    if (!ok) return { error: "Execução cancelada." };
  }
  const conn = new Client();
  return new Promise(resolve => {
    conn.on("ready", () => {
      conn.exec(command, (err, stream) => {
        if (err) resolve({ error: err.message });
        let stdout = "", stderr = "";
        stream.on("close", (code) => { conn.end(); resolve({ stdout, stderr, exit: code }); })
              .on("data", (data) => stdout += data)
              .stderr.on("data", (data) => stderr += data);
      });
    }).on("error", (err) => resolve({ error: err.message }))
      .connect({ host, port: 22, username: user || defaultUser, privateKey: fs.readFileSync(keyPath) });
  });
}

export async function deploy_site({ site, env = "staging", require_confirm = true }) {
  const cfg = deployConfig[site];
  if (!cfg) return { error: `Site "${site}" não configurado em DEPLOY_SITES.` };
  if (require_confirm) {
    const ok = await confirm(`\n🚨 PRODUÇÃO: deploy de "${site}" em ${cfg.host}\nConfirmar? [y/N] `);
    if (!ok) return { error: "Deploy cancelado." };
  }
  return ssh_exec({ host: cfg.host, command: cfg.cmd, user: cfg.user || defaultUser, require_confirm: false });
}

export async function tail_logs({ host, service, lines = 50, user }) {
  const command = `journalctl -u ${service} -n ${lines} --no-pager 2>/dev/null || tail -${lines} /var/log/${service}/*.log 2>/dev/null || echo "Log não encontrado"`;
  return ssh_exec({ host, command, user, require_confirm: false });
}
