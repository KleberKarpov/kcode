---
name: image-to-svg
description: Converte imagens (PNG, JPG, WEBP) em SVG vetorial de alta qualidade, otimizado para logos e ícones, com validação de ferramentas e segurança.
version: 2.0.0
dependencies:
  - potrace
  - imagemagick
  - inkscape (ou svgo para otimização web)
---

# Image to SVG Converter (Consolidado)

## Objetivo
Transformar imagens raster (bitmap) em vetores SVG escaláveis de alta qualidade, preservando a identidade visual e otimizando para uso em web e design responsivo.

## Ferramentas Utilizadas
- `imagemagick`: Pré-processamento da imagem (remover fundo, aumentar contraste, converter para escala de cinza/preto e branco).
- `potrace`: Vetorização do bitmap (conversão de pixels para curvas matemáticas).
- `inkscape` ou `svgo`: Limpeza, otimização e redução de peso do arquivo SVG final.

## Fluxo de Trabalho Seguro no KCode
1. **Validação de Ambiente**: Antes de qualquer ação, use a ferramenta `run_cmd` para verificar se as dependências estão instaladas (`potrace -V`, `convert -version`). Se não estiverem, instrua o usuário a instalá-las (ex: `brew install potrace imagemagick inkscape`). *Lembre-se: o KCode solicitará sua aprovação explícita para executar esses comandos.*
2. **Pré-processamento**: Crie uma cópia de trabalho da imagem. Nunca modifique o arquivo original do usuário.
3. **Vetorização**: Execute o `potrace` na imagem processada.
4. **Otimização**: Limpe metadados desnecessários e minimize o código SVG para uso em produção.
5. **Entrega**: Salve o arquivo final em um diretório organizado (ex: `output_svgs/` ou `assets/`) com o sufixo `-vectorized.svg`.

## Regras Absolutas de Segurança e Qualidade
- **NUNCA sobrescreva** a imagem original do usuário.
- **NUNCA execute comandos destrutivos** (como `rm` na pasta de origem).
- **SEMPRE valide** se o arquivo de saída foi gerado com sucesso antes de informar a conclusão.
- **Limite de Complexidade**: Avise o usuário que fotos complexas, degradês detalhados ou imagens com muitos ruídos não são ideais para vetorização e podem resultar em arquivos SVG pesados ou com baixa fidelidade. Esta ferramenta é otimizada para **logos, ícones e ilustrações de cores sólidas**.

## Exemplo de Execução pelo Agente
Quando o usuário solicitar: "Converta este logo.png para SVG"
1. Verifique: `run_cmd` com `ls logo.png` para confirmar existência.
2. Verifique dependências: `run_cmd` com `which potrace`.
3. Execute o pipeline de conversão via `run_cmd` (aguardando sua aprovação em cada etapa de risco).
4. Informe o caminho do arquivo SVG gerado e ofereça uma prévia do código se o arquivo for pequeno (< 500 linhas).

## Comandos de Referência (para o agente montar o `run_cmd`)
```bash
# 1. Pré-processar: converter para preto e branco de alto contraste
convert input.png -colorspace gray -threshold 80% temp.pbm

# 2. Vetorizar com potrace (gerando SVG limpo)
potrace -s temp.pbm -o output_raw.svg

# 3. Otimizar (se inkscape estiver disponível)
inkscape output_raw.svg --export-plain-svg=output_final.svg

# 4. Limpeza temporária
rm temp.pbm output_raw.svg
```