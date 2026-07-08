---
name: spec-driven
description: Metodologia spec-driven development (SDD) pros projetos do Samuel. Use ANTES de codar qualquer feature não-trivial (>~meio dia, cross-file/cross-repo, ambígua, ou sensível a dinheiro/segurança). Força alinhar requisitos→design→tasks com gates de aprovação humana ANTES de escrever código, atacando a causa-raiz do retrabalho (PR volta com correção do TL por escopo/design errado). Specs ficam em `.sdd/<feature>/` (gitignored). Compõe com [[dfl-pr-learnings]], [[dfl-code-style]], [[dfl-permissions]], [[dfl-stack]] e [[squad-review]].
author: SamuelStefano
tags: [planning, spec, workflow, requirements]
---

# Spec-Driven Development (SDD)

Metodologia pra **alinhar o que vai ser feito ANTES de codar**. Nasceu de um problema real: PRs do Samuel voltam com correção do TL — quase sempre por **escopo/design errado** (schema sprawl, "reusa X", abordagem errada), não por bug. SDD inverte isso: o alinhamento acontece num **spec aprovado antes da primeira linha de código**.

> Princípio central: **um erro de design pego no spec custa 1 parágrafo; pego na review custa uma PR inteira; pego em prod custa um incidente.**

---

## 0. GATE DE ENTRADA — vale a pena fazer spec?

SDD tem custo. **Não rode pra tarefa trivial.** Faça spec quando QUALQUER um:

- Esforço estimado **> ~meio dia** de trabalho.
- Toca **múltiplos arquivos/pastas** ou **múltiplos repos** (ex: dfl-payments + dfl-schema).
- É **ambígua** (não está óbvio o "como", ou há mais de uma abordagem defensável).
- Mexe com **dinheiro, fiscal, auth ou dados de produção**.
- Cria **schema/edge function/migration** nova.

**Pula SDD** (vai direto pro código + [[dfl-pr-learnings]]) quando: fix de 1-2 arquivos, bug óbvio, rename, bump de dep, ajuste de copy/estilo.

Se em dúvida → spec leve (só Requirements + Tasks, sem Design pesado).

---

## 1. ESTRUTURA NO REPO

Tudo vive em `.sdd/<feature>/` na raiz do repo onde o trabalho é ancorado (gitignored — é ferramenta local, não entra na PR do time).

```
.sdd/
  README.md                  # o que é, como usar (ponteiro pra esta skill)
  IDEAS.md                   # backlog de ideias/futuro (não-agora)
  <feature>/                 # uma pasta por feature (ex: revenue/)
    00-overview.md           # visão, "você está aqui", % de conclusão, fluxo
    01-requirements.md       # O QUE + POR QUÊ (user stories + EARS)
    02-design.md             # COMO (arquitetura, dados, decisões, reuse audit)
    03-tasks.md              # tasks ordenadas, com dono + status + critério
    context/
      CONTEXT.md             # contexto VIVO comprimido (fonte de verdade p/ outros agentes)
    decisions/
      DR-NNN-<slug>.md       # decision records (1 decisão = 1 arquivo)
    scopes/
      <slug>.md              # escopo fechado de um sub-bloco (greenfield bounded)
```

Convenção de nomes: arquivos numerados (`00-`, `01-`...) pra ordem de leitura; decision records `DR-001`, `DR-002`...; escopos em kebab-case.

---

## 2. AS FASES (cada uma tem um GATE de aprovação)

O fluxo é sequencial e **cada fase termina num gate** — só avança com OK do Samuel (ou, em design de alto risco, do [[squad-review]]). Não pule gates: o valor todo está neles.

### Fase 1 — Requirements (`01-requirements.md`) — O QUE + POR QUÊ
- **User stories**: "Como `<papel>`, quero `<ação>`, pra `<valor>`."
- **Critérios de aceitação em EARS** (formato testável):
  - `WHEN <gatilho>, the system SHALL <comportamento>`
  - `IF <condição>, THEN the system SHALL <comportamento>`
  - `WHILE <estado>, the system SHALL <comportamento>`
- **Fora de escopo**: lista explícita do que NÃO será feito (evita scope creep).
- **GATE 1**: Samuel aprova o escopo/requisitos. Nada de design ainda.

### Fase 2 — Design (`02-design.md`) — COMO
- **Reuse audit FIRST** (compõe [[dfl-pr-learnings]] Seção 0 + lições #304): antes de propor qualquer coisa nova, GREP o que já existe (schema, edge fn, helper, tipo, tabela `logs`/`audit_log`). Listar "o que reuso" antes de "o que crio".
- **Arquitetura**: componentes, fluxo de dados, sequência (diagrama texto/DAG).
- **Modelo de dados**: DDL exata com nomes REAIS de coluna (verificar no migration, não chutar).
- **Interfaces/contratos**: assinaturas de função, payloads de edge fn, shape de RPC.
- **Decisões** → cada decisão arquitetural significativa vira um **decision record** em `decisions/` (ver Seção 3).
- **Riscos** e mitigação.
- **GATE 2**: aprovação humana. Em design caro-de-errar (dinheiro/segurança/schema) → rodar [[squad-review]] como red-team ANTES do gate.

### Fase 3 — Tasks (`03-tasks.md`) — execução granular
- Lista **ordenada** de tasks discretas. Cada task:
  - mapeia pra ≥1 requisito (rastreabilidade)
  - tem **dono** (agent / Samuel / TL) e **dependências**
  - tem **critério de pronto** (test/lint/typecheck/comportamento)
  - status: `todo` / `doing` / `done` / `blocked`
- **GATE 3**: aprovação do plano de execução.

### Fase 4 — Implement
- Executar tasks **uma por vez**, marcando status.
- **Cada arquivo passa pelo checklist da [[dfl-pr-learnings]]** (e o hook validator local). Stack/lib conforme [[dfl-stack]]. Permissões de repo conforme [[dfl-permissions]].
- Ao concluir cada task: atualizar `03-tasks.md` E o `context/CONTEXT.md`.

### Fase 5 — Verify & sync
- Rodar testes/lint/typecheck. Confirmar critérios de aceitação (EARS) um a um.
- Atualizar `00-overview.md` (% de conclusão) e `CONTEXT.md`.
- Decisões que mudaram → atualizar/criar decision record.

---

## 3. DECISION RECORDS (`decisions/DR-NNN-<slug>.md`)

Toda decisão arquitetural não-óbvia vira um arquivo curto. Formato:

```markdown
# DR-NNN: <título da decisão>
- Status: proposed | accepted | superseded by DR-MMM
- Data: YYYY-MM-DD
- Contexto: <o problema/força que exige decisão>
- Opções consideradas: <A / B / C, com 1 linha de trade-off cada>
- Decisão: <a escolhida> — <por quê>
- Consequências: <o que isso trava/abre, dependências>
- Evidência: <file:line, diff, ou verificação que sustenta>
```

Regra de ouro herdada do [[squad-review]]: **fato se verifica, não se vota**. Toda decisão tem "Evidência" apontando pro código real, não pra suposição.

---

## 4. ESCOPOS (`scopes/<slug>.md`)

Pra cada sub-bloco greenfield bem-delimitado, um "escopo fechado" — o mini-brief que um agente (ou o [[squad-review]]) recebe pra atacar aquilo sem reler o spec inteiro. Formato:

```markdown
# Escopo: <nome>
- Objetivo (1 frase) | Repo(s) | Bloqueado por | Desbloqueia
- Reuso obrigatório: <fns/tabelas/helpers existentes a reaproveitar>
- Entregáveis: <arquivos a criar/editar>
- Critério de pronto: <testável>
- Fora de escopo: <...>
```

Escopo bom = um agente fresco consegue executar só com ele + as skills.

---

## 5. CONTEXTO VIVO (`context/CONTEXT.md`)

Documento **comprimido e sempre atualizado** que é a fonte de verdade recuperável por outros agentes/sessões. Atualizado em cada gate e ao fim de cada task. Otimizado pra recuperação, não pra prosa. Estrutura fixa:

```markdown
# CONTEXT — <feature> (atualizado YYYY-MM-DD)
## Estado atual        # 1 parágrafo: onde estamos, % conclusão
## Decisões firmes      # bullets, link p/ DR-NNN
## Em aberto            # perguntas/bloqueios ativos
## Mapa de arquivos     # path → o que é (só o que importa)
## Glossário/IDs        # termos, nomes de fn, PRs, branches
## Não-fazer            # armadilhas conhecidas
```

Mantenha **enxuto** — se passar de ~150 linhas, comprima (o objetivo é o MENOR número de linhas que ainda responde "qual o contexto disso?"). Isto é o embrião da plataforma de contextos do Samuel: cada feature tem seu CONTEXT.md auto-mantido.

---

## 6. COMPOSIÇÃO COM OUTRAS SKILLS (sempre reusar)

SDD não substitui as skills — **orquestra** elas:

| Fase | Skills acionadas |
|------|------------------|
| Design (reuse audit) | [[dfl-pr-learnings]] Seção 0 + lições #304 (anti-sprawl, reusar infra, não denormalizar CRM) |
| Design (red-team de alto risco) | [[squad-review]] |
| Tasks/Implement | [[dfl-code-style]] (atomic design, workflow), [[dfl-stack]] (libs), [[dfl-permissions]] (tier do repo) |
| Implement (cada arquivo) | checklist [[dfl-pr-learnings]] + hook validator |
| PR/commit | regras de commit DFL (sem atribuição Claude, inglês, imperativo) |

Sempre que uma fase tocar algo coberto por skill existente, **invoque-a** em vez de reinventar.

---

## 7. QUANDO ESTA SKILL AJUDA MAIS

- Feature nova não-trivial, antes de codar.
- Trabalho cross-repo (FE + schema + edge fn).
- Decisão de schema/migration/edge function.
- Retomar trabalho parado (o `CONTEXT.md` + spec recuperam o estado em segundos).
- Quando o TL provavelmente discordaria do design — o spec é onde isso se resolve barato.

Anti-uso: fix trivial, bug óbvio. Não burocratize o pequeno.


---
> 🔒 **Camada de segurança (obrigatória):** rode também a skill `app-security` em qualquer código que toque dados, auth ou rede — RLS, JWT, secrets, env do cliente, headers, endpoints service-role, infra. Segurança é dimensão obrigatória de toda escrita/review, não opcional.
