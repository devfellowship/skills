---
name: content-orchestrator
description: Use para conduzir uma ideia até um pacote de produção multiplataforma, coordenando estratégia, copy, direção visual e revisão na ordem correta. Não use para uma tarefa isolada de legenda, arte, análise de métricas ou publicação sem autorização.
metadata:
  author: ArthurMMaciel
  tags: [content, orchestration, social-media, workflow, production, pack]
---

# Orquestrador de conteúdo

Conduza a cadeia `content-director → multiplatform-copywriter → visual-director → content-reviewer → produção`. Cada etapa recebe um artefato aprovado e devolve um contrato claro para a seguinte.

Esta skill coordena decisões; não finge executar render, edição, publicação ou coleta de métricas quando essas capacidades não estiverem disponíveis ou autorizadas.

## Escolha o ponto de entrada

- Ideia, tema, produto ou campanha ainda sem estrutura: comece no `content-director`.
- Estratégia aprovada, mas texto incompleto: comece no `multiplatform-copywriter`.
- Roteiro e copy aprovados: comece no `visual-director`.
- Peça pronta ou especificação completa: comece no `content-reviewer`.
- Pedido estreito: use somente a especialista correspondente; não force o pipeline inteiro.

Não pule uma etapa ausente em um pedido de produção completa. Uma aprovação explícita ou um artefato fornecido pode satisfazer a etapa anterior.

## Monte uma fonte de verdade

Leia [references/handoff-contract.md](references/handoff-contract.md). Consolide brief, marca, fatos, fontes, suposições, decisões aprovadas, plataformas, entregáveis e pendências. Quando arquivos já existirem, preserve-os e registre revisões em vez de sobrescrever trabalho do usuário sem necessidade.

Mantenha copy visível, narração, direção visual e instrução operacional em campos distintos. Um dado marcado `VALIDAÇÃO NECESSÁRIA` continua marcado em todas as etapas até receber fonte.

## Execute o fluxo

1. **Estratégia:** invoque `content-director`. Exija mensagem central, conceito, papel de cada canal e plano por peça.
2. **Copy:** invoque `multiplatform-copywriter` com a estratégia aprovada. Exija texto final por campo e plataforma.
3. **Visual:** invoque `visual-director` com estratégia e copy congeladas. Exija sistema visual, cenas/slides, prompts e instruções de edição.
4. **QA:** invoque `content-reviewer` com todos os artefatos. Exija veredito, notas com evidência, achados por severidade e versão corrigida.
5. **Produção:** entregue ou acione somente as ferramentas autorizadas para gerar arte, vídeo, áudio, montagem ou publicação.

Leia cada skill antes de invocá-la. Se uma especialista não estiver instalada, informe a dependência ausente e execute manualmente apenas se conseguir manter o mesmo contrato.

## Corrija no nó responsável

Um achado volta à etapa que o originou:

- ângulo ou público errado → direção de conteúdo;
- hook, fala ou CTA fraco → copy;
- hierarquia, continuidade ou prompt ruim → direção visual;
- falha de render, áudio ou publicação → produção.

Depois da correção, rerode somente as etapas posteriores afetadas. Não regenere toda a campanha por um defeito local. Preserve versões aprovadas e descreva o delta.

Não avance à produção com achado `CRÍTICO`, veredito `Não ainda` ou fato central sem validação. `Sim, com ajustes` pode avançar apenas depois que os ajustes classificados como bloqueantes forem resolvidos.

## Entregue o pacote final

Inclua:

- brief e conceito aprovados;
- peças por plataforma;
- copy final;
- direção visual e prompts;
- ativos/fontes e pendências;
- relatório de revisão, nota e confiança;
- resumo de produção por plataforma;
- próximo passo autorizado.

Se a produção real não foi executada, diga `pronto para produção`, não `conteúdo pronto`. Publicar, agendar ou enviar a terceiros exige autorização específica.
