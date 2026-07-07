---
name: dfl-code-style
description: Modo de trabalho e regras de código do Samuel para todos os repos DevFellowship. Use SEMPRE que for escrever, refatorar ou revisar código TypeScript/React em qualquer repo DFL. Cobre componentização, atomic design, hooks, nomenclatura, organização de pastas, git workflow.
tags: [frontend, react, typescript, conventions]
---

# DFL Code Style — Modo de Trabalho do Samuel

Regras obrigatórias para todo código nos repos do ecossistema DevFellowship. Aplicar **sem exceção** ao escrever ou refatorar.

---

## 1. Componentização

### Regra de ouro: ≤ 150 linhas por componente
Qualquer arquivo `.tsx` que ultrapasse 150 linhas deve ser quebrado.

**Como quebrar:**
- Extrair seções visuais → molecules / organisms separados
- Extrair lógica → hook `use{NomeDoComponente}.ts`
- Extrair constantes → arquivo em `consts/`
- Extrair tipos → arquivo em `interfaces/` ou `types/`

### Reaproveitar ao máximo
Qualquer trecho que possa ser reusado vira componente. Não duplicar JSX.

### Sem componentes aninhados no mesmo arquivo
Um componente exportado por arquivo. Se há `<TaskModal>` e `<TaskInfoRow>` no mesmo arquivo, separar em `task-modal.tsx` e `task-info-row.tsx`.

---

## 2. Atomic Design

Toda UI segue a hierarquia:

| Nível | O que vai aqui | Exemplos |
|-------|----------------|----------|
| `atoms/` | Elementos visuais mínimos, sem lógica de negócio | Avatar, Badge, IconButton, VideoThumbnail |
| `molecules/` | Combinações de atoms com pouca lógica | MetaBar, CommentCard, KanbanCard, TaskInfoRow |
| `organisms/` | Seções completas com lógica | ContentSection, KanbanBoard, WizardForm |
| `pages/` | Compõe organisms — uma por rota | review-request-details.tsx |

Pasta atual do shadcn (`src/components/ui/`) é **intocável** — usar shadcn CLI pra adicionar.

---

## 3. Lógica em hooks

Toda lógica de componente vai em hook separado:

```
src/components/molecules/charge-card.tsx
src/hooks/use-charge-card.ts
```

O componente só renderiza. O hook concentra: state, derivações, callbacks, queries, mutations.

**Nomenclatura:** `use{ComponentName}` em PascalCase no nome do hook (mas arquivo em kebab-case).

---

## 4. Nomenclatura

| Tipo | Convenção | Exemplo |
|------|-----------|---------|
| Arquivo | `kebab-case.tsx` / `.ts` | `review-meta-bar.tsx` |
| Componente | `PascalCase` | `ReviewMetaBar` |
| Hook | `useCamelCase` | `useReviewActions` |
| Constante | `SCREAMING_SNAKE_CASE` | `INVOICE_STATUS_ORDER` |
| Variável/função | `camelCase` | `handleApprove` |
| Tipo/Interface | `PascalCase` | `ReviewRequestStatus` |

---

## 5. Organização de pastas

```
src/
  components/
    atoms/
    molecules/
    organisms/
    ui/                  ← shadcn (intocável)
  hooks/                 ← um hook por componente / por feature
  consts/                ← todas as constantes (BOARD_COLUMNS, STATUS_CONFIG…)
  interfaces/  ou  types/   ← types/interfaces compartilhados
  utils/                 ← helpers puros (sem JSX)
  pages/                 ← rotas
  services/              ← cliente Supabase, integrações externas
  contexts/              ← React Context providers
```

**Constantes nunca ficam inline em arquivos de componente** — extrair para `consts/`.

---

## 6. Sem comentários

Código deve ser autoexplicativo. Não escrever:

```ts
// Calcula o total de pontos
const total = sum(points)
```

Renomear pra ficar claro:
```ts
const totalPoints = sumTaskPoints(tasks)
```

**Exceção:** comentários `// TODO:` com motivo específico ou `// @ts-expect-error` com explicação curta de bug externo.

---

## 7. Git Workflow

### Branches
- Nomenclatura: `feat/`, `fix/`, `chore/`, `refactor/`
- Sempre criar branch nova antes de começar
- Base sempre na `main` atualizada
- Uma branch por tarefa

### Commits
- Formato: `tipo: descrição curta`
- Tipos: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `style`
- Sem corpo, sem bullet points, sem trailers
- **Sem `Co-Authored-By: Claude`**
- Português ou inglês — manter consistência com o repo

**Exemplos certos:**
```
feat: kanban view para charges
fix: avatar fallback quando user_avatar_url null
chore: extract BOARD_COLUMNS to consts
```

**Exemplo errado:**
```
feat(reviews): kanban board

- Add 5 columns for review status
- Extract KanbanCard to molecule
- Implement drag and drop

Co-Authored-By: Claude <noreply@anthropic.com>
```

### PRs
- **Nunca mergear** — só Samuel merge (regra absoluta para `devfellowship` org)
- Pra Tier 2 seguro: mergear OK (ver skill `dfl-permissions`)
- Título curto, descrição clara
- Sem emojis (a menos que Samuel peça)

---

## 8. Stack obrigatória

Tudo em repo DFL usa:

- **React 18/19** + **TypeScript** + **Vite** + **SWC**
- **Tailwind CSS** + **shadcn/ui** (Radix UI)
- **TanStack Query** para data fetching (não fetch direto em componente)
- **React Router DOM** para rotas
- **Supabase** (Postgres + Auth + Edge Functions)
- **Module Federation** (`@originjs/vite-plugin-federation`) onde aplicável

**Não introduzir:**
- Redux, Zustand, MobX (state vai em context + react-query)
- styled-components, emotion (só Tailwind)
- Axios (usar fetch ou supabase-js)
- Outras lib de UI (só shadcn/Radix)

---

## 9. Padrões específicos por área

### Data fetching
- Sempre via TanStack Query (`useQuery`, `useMutation`)
- Key arrays semânticas: `['review-requests', filter, page]`
- Invalidação explícita após mutation
- Realtime Supabase: hook dedicado com `useRef` pra callback estável

### Forms
- React Hook Form quando há > 3 campos
- Validação com Zod schema
- Estados de erro visíveis no campo

### Estilização
- Tailwind utilities primeiro
- Cores: usar tokens do tema (`bg-card`, `text-muted-foreground`, `border-border`)
- Cor de acento: `orange-500` (DevFellowship)
- Estados: `emerald-` (success), `red-` (error), `amber-` (warning), `blue-` (info)

### Acessibilidade
- Botões sempre `<button>` ou `<Button>` (não `<div onClick>`)
- Imagens com `alt`
- Inputs com `<label>` ou `aria-label`

---

## 10. Anti-patterns (NUNCA fazer)

- ❌ Componente com Card aninhado em Panel (dupla borda)
- ❌ `useEffect(..., [ref.current])` — React não rastreia `.current`
- ❌ `any` no TypeScript (usar `unknown` + narrow, ou tipar)
- ❌ Logs `console.log` deixados no commit
- ❌ Importar de `'../../../../components/...'` — usar alias `@/`
- ❌ Componente que faz fetch direto sem hook
- ❌ Mock de dados hardcoded em componente de produção
- ❌ Lógica de negócio dentro de `.tsx` (sempre extrair pra hook/util)

---

## 11. Verificação antes de commit

Sempre antes de commitar:

```bash
npm run lint          # Sem erros
npm run build         # ou npm run build:federation — build limpo
npm test              # se houver testes — passando
```

Se há mudança em UI: testar manualmente no dev server (`npm run dev`).

---

## 12. Quando há dúvida de padrão

1. Procurar padrão similar já existente no repo
2. Se houver, replicar exatamente
3. Se não houver, perguntar ao Samuel antes de inventar

**Why:** Manter consistência com o que o TL (Tainan) já validou em reviews passadas. Padrões novos devem ser explícitos.


---
> 🔒 **Camada de segurança (obrigatória):** rode também a skill `app-security` em qualquer código que toque dados, auth ou rede — RLS, JWT, secrets, env do cliente, headers, endpoints service-role, infra. Segurança é dimensão obrigatória de toda escrita/review, não opcional.
