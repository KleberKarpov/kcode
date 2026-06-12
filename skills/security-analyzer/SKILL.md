# Security Analyzer — Analisador de Segurança de Skills e Scripts
description: Analisa código-fonte de novas skills e scripts em busca de riscos de segurança, dados sensíveis expostos, brechas de invasão e padrões maliciosos antes da importação.

## Propósito

Esta skill ativa uma análise de segurança rigorosa sempre que uma nova skill, script ou módulo de terceiros for importado. O agente deve examinar TODO o código recebido antes de aprovar sua integração, utilizando as seguintes categorias de verificação:

---

## 1. Exposição de Dados Sensíveis

Busque ativamente os seguintes padrões e alerte se encontrar:

- **API Keys, Tokens e Secrets hardcodados** — variáveis como `api_key`, `secret`, `token`, `access_token` com valores literais
- **Credenciais AWS** — padrões `AKIA[0-9A-Z]{16}` e secret keys
- **Senhas em texto claro** — `password=`, `passwd=`, `pwd=` com valores literais
- **Chaves privadas** — `BEGIN PRIVATE KEY`, `BEGIN RSA PRIVATE KEY`
- **Strings de conexão de banco** — URI com `user:password@host`
- **GitHub Personal Access Tokens** — padrão `ghp_[A-Za-z0-9]{36}`
- **Google API Keys** — padrão `AIza[0-9A-Za-z-]{35}`
- **Dados pessoais** — CPFs, emails reais em código de exemplo
- **Dados codificados em Base64** — `base64.b64decode()` com strings longas (possível tentativa de esconder secrets)

---

## 2. Risco de Brechas para Invasões

Analise cada trecho de código quanto a:

### Execução de Código Arbitrário
- `eval()`, `exec()`, `execfile()` — **RISCO CRÍTICO** — permitem execução de código arbitrário
- `compile()` com entradas do usuário — **RISCO ALTO**
- `__import__()` dinâmico — **RISCO ALTO**

### Command Injection
- `os.system()`, `os.popen()` — **RISCO CRÍTICO** — executam via shell
- `subprocess.call/run/Popen()` com `shell=True` — **RISCO ALTO**
- Concatenação de input do usuário em comandos shell

### Path Traversal
- `open()`, `read_file()`, etc. com input do usuário sem validação
- Uso de `../` em caminhos de arquivo
- Falta de sanitização de caminhos com `os.path.realpath()`

### SQL Injection
- Queries com string formatting (`%s`, `.format()`, f-strings)
- Concatenação de input do usuário em queries SQL

### Desserialização Insegura
- `pickle.load()`, `pickle.loads()` — podem executar código arbitrário
- `marshal` com dados não confiáveis
- `shelve` (usa pickle internamente)

### Imports Perigosos
- `ctypes`, `ctypes.cdll` — chamada a bibliotecas C nativas
- `telnetlib` — protocolo inseguro (texto plano)
- `http.server` — não seguro para produção
- `xmlrpc`, `xml.parsers.expat` — vulnerável a XXE e billion laughs

---

## 3. Identificação de Código Malicioso

Busque padrões comportamentais suspeitos:

- **Ofuscação de código** — strings longas codificadas (base64, hex, rot13)
- **Comunicação externa não autorizada** — `requests.post()`, `urllib` enviando dados para servidores desconhecidos
- **Exfiltração de dados** — envio de variáveis sensíveis via HTTP, DNS ou outros canais
- **Shell reverso** — `socket.connect()` para IPs externos, `bash -i`, `/dev/tcp`
- **Keyloggers** — uso de `pynput`, hooks de teclado
- **Cryptojacking** — referências a stratum pools, xmrig, coinhive
- **Mecanismos de persistência** — modificação de crontab, systemd, .bashrc, .profile, tarefas agendadas
- **Anti-debugging / anti-análise** — detecção de VM, sandbox, ptrace
- **Webshell patterns** — `passthru()`, `shell_exec()`, backticks com shell commands

---

## 4. Boas Práticas de Segurança

Verifique se o código segue:

- **Tratamento de erros seguro** — evitar `except:` genérico (captura KeyboardInterrupt/SystemExit)
- **Sem supressão de warnings de segurança** — `warnings.filterwarnings('ignore')`
- **URLs não hardcodadas** — usar variáveis de ambiente para endpoints
- **Logs sem dados sensíveis** — `print()` de passwords, tokens, keys é inaceitável
- **Uso de HTTPS** — jamais enviar dados sensíveis por HTTP
- **Validação de entrada** — todo input do usuário deve ser validado/sanitizado
- **Princípio do menor privilégio** — o código só deve acessar o que necessita
- **Controle de acesso em APIs** — endpoints devem ter autenticação/autorização

---

## 5. Níveis de Risco e Recomendações

Ao finalizar a análise, classifique o código em:

| Nível | Descrição | Ação Recomendada |
|-------|-----------|-------------------|
| 🔴 **CRÍTICO** | exec/eval, dados sensíveis expostos, shell reverso, cryptojacking | **BLOQUEAR** — Não importar sem correções completas |
| 🟠 **ALTO** | command injection, SQL injection, pickle inseguro | **REVISAR** — Corrigir antes de importar |
| 🟡 **MÉDIO** | path traversal, módulos perigosos, except genérico | **ATENÇÃO** — Revisar e mitigar antes de usar |
| 🟢 **BAIXO** | URLs hardcodadas, prints informativos | **MONITORAR** — Aceitável, mas melhorar |
| ℹ️ **INFO** | Observações de boas práticas | **SUGESTÃO** — Melhorias opcionais |

---

## 6. Formato do Relatório de Segurança

Ao analisar um código, gere o relatório neste formato:

```
🔒 RELATÓRIO DE SEGURANÇA — [nome do arquivo/skill]
═══════════════════════════════════════════════════
📊 Score de Risco: [0-100]
🏷️ Nível: [SEGURO | BAIXO_RISCO | MEDIO_RISCO | ALTO_RISCO | RISCO_CRITICO]

Resultado: ✅ APROVADO | ⚠️ APROVADO COM RESSALVAS | ⛔ BLOQUEADO

CRÍTICOS: [N] | ALTOS: [N] | MÉDIOS: [N] | BAIXOS: [N] | INFO: [N]

📋 Descobertas:
  1. [🔴/🟠/🟡/🟢/ℹ️] Descrição do risco (linha N)
     💡 Recomendação: como corrigir

[... demais descobertas ...]

📝 Conclusão:
  [Texto explicativo sobre o resultado final e próximos passos]
```

---

## 7. Regras Mandatórias

1. **NUNCA aprovar código com riscos CRÍTICOS sem correção**
2. **SEMPRE solicitar justificativa para o uso de funções perigosas** (eval, exec, subprocess, etc.)
3. **SEMPRE verificar se secrets estão em variáveis de ambiente**
4. **PARAR E ALERTAR imediatamente se encontrar código malicioso intencional**
5. **REVISAR todas as dependências externas** mencionadas no código
6. **NÃO EXECUTAR código não verificado** — apenas analisar estaticamente
7. **DOCUMENTAR todas as descobertas** mesmo em código aprovado
