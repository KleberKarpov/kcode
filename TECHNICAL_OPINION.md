# Parecer Técnico: Skill Global Kcode para Claude Code, Antigravity e IDEs

> **Data**: 04 de Outubro de 2026  
> **Status de Avaliação**: **Aprovado com Mitigações Concluídas**  
> **Escopo**: Arquitetura, Governança, Segurança e Interoperabilidade Multi-Agente  

---

## 1. Sumário Executivo

A implementação de uma skill global do Kcode para **Claude Code**, **Google Antigravity** e demais IDEs compatíveis é tecnicamente viável, aderente às melhores práticas da indústria e alinhada ao padrão aberto de [Agent Skills](https://agentskills.io/).

A adição do **modo headless (não-interativo)** ao CLI do Kcode viabilizou seu uso por subagentes e ferramentas externas, eliminando o bloqueio por ausência de terminal iterativo (TTY) e transformando o Kcode em uma **camada de execução e orquestração de LLMs reutilizável por múltiplos agentes**.

Para atender às ressalvas de segurança, governança e conformidade operacional levantadas pela análise técnica, foram executados três ajustes críticos de mitigação detalhados neste documento.

---

## 2. Implicações Técnicas e de Produto

### 2.1. Interoperabilidade e Infraestrutura de Agentes
- **Desacoplamento de CLI**: O Kcode deixa de ser apenas uma ferramenta interativa pontual e passa a atuar como um motor autônomo acionável por outros agentes de IA (Claude, Gemini, Cursor).
- **Acesso Transparente a 100+ Modelos**: Permite que agentes externos invoquem modelos especializados do OpenRouter (DeepSeek R1 para raciocínio, Qwen 2.5 Coder para sintaxe, Codestral, Llama 3.3) sem reconfiguração complexa.
- **Ferramentas Nativas Embarcadas**: O ecossistema de ferramentas do Kcode (edição cirúrgica de arquivos com backup, shell seguro, deploys SSH) passa a ser aproveitado diretamente por IDEs.

### 2.2. Padronização Documental
- Adoção rigorosa da especificação Agent Skills: pasta dedicada com `SKILL.md` contendo YAML frontmatter + instruções detalhadas em Markdown, acompanhado por script auxiliar em `scripts/run_kcode.sh`.

---

## 3. Matriz de Riscos & Salvaguardas Implementadas

| Risco Técnico Identificado | Nível | Impacto Potencial | Salvaguarda / Mitigação Implementada |
|---|---|---|---|
| **Autonomia Excessiva com `--yes`** | Alto | Modificações indevidas em arquivos, comandos destrutivos no shell ou deploys acidentais sem supervisão. | **Modo Seguro por Padrão**: Sem a flag explícita `--yes` / `-y`, o modo headless executa apenas ferramentas de leitura (`read_file`, `list_files`, `find_in_repo`, `git_status`, `git_diff`). Ferramentas modificadoras (`write_file`, `replace_in_file`, `run_cmd`, `ssh_exec`, `deploy_site`) são **bloqueadas preventivamente**. |
| **Divergência de Diretórios Documentados** | Médio | Inconsistência na descoberta de skills em diferentes IDEs, dependência de paths legados ou não documentados. | **Padronização Canônica Tripla**: Skill instalada e sincronizada nos diretórios documentados oficialmente por cada ferramenta: `~/.claude/skills/kcode/`, `~/.gemini/antigravity/skills/kcode/` e `~/.agents/skills/kcode/`. |
| **Esgotamento de Crédito e Chaves OpenRouter** | Alto | Consumo descontrolado de saldo da conta OpenRouter decorrente de loops infinitos de agentes. | **Limite de Chave & Teto de Iterações**: O comando `kcode --balance` agora audita e exibe o limite configurado na chave. O CLI limita a execução a no máximo 15 passos (`MAX_TOOL_STEPS = 15`) por sessão. Recomendação expressa de uso de chaves com Credit Limit no dashboard. |
| **Vazamento de Credenciais** | Crítico | Exposição acidental da `OPENROUTER_API_KEY` em prompts ou histórico de versionamento. | Chaves Bearer carregadas exclusivamente via `.env` protegido no `.gitignore`. Nenhuma credencial embutida em scripts ou documentação. |

---

## 4. Padronização Canônica de Diretórios

Para garantir conformidade com a documentação oficial de cada fornecedor:

1. **Claude Code (Anthropic)**:
   - **Caminho Canônico**: `~/.claude/skills/kcode/`
   - **Referência**: Documentação de Agent Skills para Claude Code.
2. **Google Antigravity**:
   - **Caminho Canônico**: `~/.gemini/antigravity/skills/kcode/`
   - **Compatibilidade Retroativa**: `~/.gemini/config/skills/kcode/`
   - **Referência**: Documentação de IDE Skills do Google Antigravity.
3. **Padrão Aberto Agent Skills (Cursor, Codex, Windsurf)**:
   - **Caminho Canônico**: `~/.agents/skills/kcode/`
   - **Referência**: Especificação Agent Skills v1.0.

---

## 5. Política de Credenciais e Governança de Custos

1. **Chave Exclusiva para Automação**:
   - Crie uma API Key dedicada no OpenRouter com o rótulo `kcode-agent-runner`.
2. **Limite Financeiro Obrigatório (Credit Limit)**:
   - Configure no dashboard da OpenRouter um teto máximo de gasto mensal (ex: \$5.00 a \$10.00). Isso estabelece uma barreira intransponível contra eventuais desvios de subagentes.
3. **Auditoria em Tempo Real**:
   - O comando `kcode --balance` realiza dupla validação:
     - Saldo geral da conta e consumo total.
     - Limite específico da chave e consumo atribuído à chave ativa.
     - Alerta visual caso a chave não possua limite configurado.

---

## 6. Parecer Final

Com a implementação das três mitigações essenciais:
1. **Governança restritiva de `--yes`** no `kcode.js`;
2. **Implantação nos diretórios canônicos** documentados (`~/.claude`, `~/.gemini/antigravity`, `~/.agents`);
3. **Auditoria de segurança de chaves e limitação de passos** no motor do CLI;

A arquitetura da skill global do Kcode atinge o padrão de maturidade, robustez e segurança exigido para uso produtivo em equipes e ambientes autônomos.
