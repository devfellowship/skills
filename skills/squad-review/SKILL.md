---
name: squad-review
description: Workflow de deliberação multi-agente (squad de ~6) pra decisões caras de errar — arquitetura, planejamento cross-repo, design review, investigação ambígua. Roda em 2 fases (divergente → convergente) com papéis obrigatórios (red-team + orquestrador que VERIFICA fatos contra o código). Regra de ouro: fato se verifica, não se vota. Saída = decision record. Use quando o custo de errar > custo do squad; NÃO use pra tarefa rotineira. Compõe com [[spec-driven]] (red-team do design) e [[dfl-pr-learnings]].
author: SamuelStefano
tags: [multi-agent, review, architecture, decision-making]
---

# Squad Review — deliberação multi-agente com consenso

Convoca um esquadrão de agentes pra atacar um problema de ângulos diferentes, **revisar as ideias uns dos outros** e convergir num consenso com evidência. Nasceu de uma sessão real (revenue): o squad pegou erros que um único agente passaria batido (função "faltando" que estava em PR aberta; branch obsoleta confundida com a PR real; "claim" confundido com "create").

> **Por que funciona:** não é a quantidade nem a variedade de modelos — é a **revisão cruzada** + o **orquestrador checando fatos disputados contra o ground truth**. 6 agentes concordando pode dar falsa confiança se todos herdaram a mesma premissa errada.

---

## 0. GATE DE ENTRADA — vale convocar o squad?

Squad é **caro e lento**. Use só quando QUALQUER:
- Decisão **cara de errar** (arquitetura, schema, dinheiro, segurança, migração).
- Investigação **ambígua / cross-repo** onde perspectivas independentes reduzem ponto cego.
- Você precisa **fazer divergência aparecer** (suspeita que há trade-offs escondidos).
- Planejamento de sequência/merge com dependências não-triviais.

**NÃO use** pra: fix rotineiro, bug óbvio, código de 1-2 arquivos, pergunta com resposta verificável direta. Aí é trabalho direto + [[dfl-pr-learnings]].

---

## 1. COMPOSIÇÃO DO SQUAD

Padrão: **~6 agentes**, mix de modelos (`haiku`, `sonnet`, `opus`) — um de cada e repetir em `opus` até completar. Mas a composição importa menos que os **papéis**:

- **Lentes** (uma por agente): ex. fatos/inventário, UI/UX, integrações/fluxo, segurança, arquitetura/qualidade, schema/dados, risco/sequência. Adaptar ao problema.
- **Papéis obrigatórios** (não pular):
  - **Red-team / cético** — pelo menos um agente cuja tarefa é DISCORDAR e achar furos, não concordar.
  - **Orquestrador** (você, no thread principal) — NÃO é agente; compila, e **verifica fatos disputados contra o código real** (diff, grep, migration). Fatos não vão a voto.
- **Modelo por lente:** tarefa mecânica/inventário → `haiku`; síntese/UX → `sonnet`; arquitetura/segurança/risco → `opus`.

Lançar agentes **em paralelo** (várias chamadas Agent numa mensagem só). Todos **read-only** (produzem relatório, não editam) pra evitar conflito.

---

## 2. AS DUAS FASES

### Fase 1 — Divergente (propostas independentes)
Cada agente recebe: (a) um **briefing de fatos** comum, (b) sua lente, (c) o formato de saída. Produz: achados rankeados por severidade com `file:line`, recomendação, e **"discordâncias que antecipo"**.
- Dê o MESMO briefing a todos — mas avise que podem corrigi-lo (o briefing pode conter erro seu).
- Peça saída concisa e estruturada (não ensaio).

### Entre fases — Orquestrador verifica
Antes da Fase 2, o orquestrador:
1. Lista os **conflitos factuais** entre os relatórios.
2. **Resolve cada um com evidência direta** (grep/diff/migration/execução) — nunca deixa virar opinião.
3. Redige um **candidato de consenso** que incorpora os achados + as correções factuais.

### Fase 2 — Convergente (revisão cruzada + consenso)
Cada agente recebe o **candidato de consenso** + os fatos travados, e **VOTA** por decisão: `RATIFY / AMEND / REJECT` + 1 linha. Pelo menos um continua no papel red-team. O orquestrador sintetiza o consenso final, anotando **dissidências não-resolvidas**.

---

## 3. REGRAS DE OURO

1. **Fato se verifica, não se vota.** Se dois agentes discordam sobre o que o código faz, o orquestrador abre o arquivo e crava. Voto é só pra DECISÕES (trade-offs), nunca pra fatos.
2. **Red-team obrigatório.** Consenso unânime sem ninguém tentando furar = sinal de premissa compartilhada errada. Force a discordância.
3. **Briefing é falível.** Diga aos agentes pra corrigir o briefing — foi assim que o squad pegou a branch obsoleta e o "claim vs create".
4. **Saída = decision record.** O resultado vira `DR-NNN` (ver [[spec-driven]] §3): decisão, opções, escolha, consequências, **evidência**.
5. **Não auto-implementar no squad.** Agentes são read-only. A implementação vem depois, pelo thread principal, com [[dfl-pr-learnings]].

---

## 4. COMPOSIÇÃO COM OUTRAS SKILLS

- Como **red-team do Design** no [[spec-driven]] (Gate 2 de alto risco): o squad revisa o `02-design.md` contra [[dfl-pr-learnings]] (anti-sprawl, reusar infra) e [[dfl-stack]].
- Achados viram `decisions/DR-NNN-*.md` e atualizam o `context/CONTEXT.md` da feature.
- Lentes de código devem revisar **contra** as skills existentes, não reinventar regra.

---

## 5. TEMPLATE DE BRIEFING (Fase 1)

```
Você é AGENTE <n> (modelo <X>), lente: <lente>. READ-ONLY, relatório só.
CONTEXTO VERIFICADO (corrija se achar erro — o briefing pode estar errado):
<fatos + repos + paths>
SUA LENTE: <foco específico>
SAÍDA: "# <lente>" — achados rankeados Crit/High/Med/Low com file:line + recomendação.
Termine com "Minha ordem recomendada" e "Discordâncias que antecipo".
```

## 6. TEMPLATE DE VOTO (Fase 2)

```
CANDIDATO DE CONSENSO: <o documento>
FATOS TRAVADOS (verificados pelo orquestrador): <...>
VOTE por decisão (RATIFY/AMEND/REJECT + 1 linha): D1..Dn.
Termine com voto final + dissidência bloqueante (se houver).
```

---

## 7. QUANDO ESTA SKILL AJUDA MAIS

- Antes de uma decisão de arquitetura/schema/merge cara de reverter.
- Pra validar (red-team) um design do [[spec-driven]] antes de codar.
- Investigação cross-repo onde você desconfia de premissas.
- Quando precisa de um decision record defensável (com evidência) pra alinhar com o TL.

Anti-uso: pressa, tarefa pequena, pergunta de resposta direta. O squad é bisturi, não martelo.


---
> 🔒 **Camada de segurança (obrigatória):** rode também a skill `app-security` em qualquer código que toque dados, auth ou rede — RLS, JWT, secrets, env do cliente, headers, endpoints service-role, infra. Segurança é dimensão obrigatória de toda escrita/review, não opcional.
