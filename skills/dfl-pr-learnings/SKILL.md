---
name: dfl-pr-learnings
description: Erros recorrentes que Claude comete em PRs do Samuel nos repos DFL e que o TL taigfs sempre aponta. Use SEMPRE antes de finalizar qualquer arquivo .tsx/.ts/.sql em repo DFL — vira checklist obrigatório de "será que o taigfs vai aprovar isso?". Cobre componentização, services layer, tipos gerados Supabase, schema design, e 5 erros BLOQUEANTES reincidentes (Seção 0). Complementa [[dfl-code-style]].
author: SamuelStefano
tags: [pr-review, code-review, conventions, checklist]
---

# DFL PR Learnings — Erros do Claude que o taigfs sempre aponta

Skill destilada de **70+ comentários reais** do TL `taigfs` em PRs do Samuel nos repos `dfl-reviews`, `dfl-payments` e `dfl-schema` (atualizado 2026-05-19). 98% do código nessas PRs foi escrito por mim (Claude). Esta skill existe pra eu **parar de cometer os mesmos erros**.

**Antes de declarar qualquer arquivo finalizado**, rode mentalmente o checklist da seção 12.

---

## 🚨 SEÇÃO 0 — ERROS BLOQUEANTES (reincidentes — já cometi DEPOIS de ter a regra)

Estes 3 erros eu cometi **mesmo tendo a regra escrita nesta skill**. São BLOQUEANTES. Se eu fizer qualquer um, a PR volta garantido. Checar ANTES de escrever o arquivo, não depois.

### 0.1 — NÃO inventar pasta. Acesso a dados = `services/{entity}-service.ts`

**Cometido 2×** (`src/data/` em PR antiga, `src/hooks/revenue/queries/` na #81). TL na #81:
> "You started a new naming pattern here. We follow `services` layer (folder) with one file per entity (`services/charges-service.ts`), not `queries`."

**Pastas que NÃO existem no DFL e eu fico inventando:** `queries/`, `mappers/`, `data/`, `dao/` (a menos que o repo já tenha).

**Regra absoluta:**
- Acesso a entidade Supabase → `src/services/{entity}-service.ts` (UM arquivo por entidade)
- Ex: `services/charges-service.ts`, `services/contracts-service.ts`
- **Antes de criar QUALQUER pasta nova**, `ls src/` e usar o que já existe. Pasta nova = parar e perguntar.

**🧪 LITMUS TEST de `services/` (cometido na #109 — `contracts-service.ts`, `generate-document-request.ts`):**

`services/` é **só** pra código que **realmente chama axios/API/Supabase**. TL na #109:
> "This should be in utils/, right? It doesn't actually call axios/api? If not, it's a util function."
> "Move to utils/ with tests"

Antes de pôr qualquer arquivo em `services/`, perguntar: **"esse arquivo faz uma chamada HTTP/Supabase real?"**
- **Sim** (axios/fetch/`supabase.from()`/RPC) → `services/{entity}-service.ts`. ✓
- **Não** (builder de payload, transformação pura, monta request object, formata) → é **util**, vai pra `src/utils/{kebab}.ts` **COM `.test.ts` ao lado**.

Sinais de que é util disfarçado de service: nome `*-request.ts`, `build-*`, `make-*`, `format-*`, função que retorna um objeto/string sem `await`, zero import de cliente HTTP. Função pura em `services/` = misplaced garantido.

### 0.2 — NÃO escrever mapper em arquivo separado. Mapper é função DENTRO do service

**Cometido na #81** (`queries/mappers.ts`). TL:
> "Mappers is not a pattern we use (we prefer services/daos). Teríamos um mapper por service, é a função do service."

**Regra:** A função de map (row do banco → domain object) vive **dentro** do `{entity}-service.ts`. Não tem `mappers.ts`, não tem `mappers.test.ts`. Testa o service.

### 0.3 — NÃO espelhar tabelas Supabase à mão. Usar `supabase/types.ts` gerado

**Cometido 2×** (narrowing helpers em PR antiga, `types/revenue-rows.ts` na #81). TL na #81:
> "You shouldn't have to mirror supabase tables if you generate `supabase/types.ts`, right? Please double check that."

**Regra:**
- Tipo de row do banco (`ContractRow`, `ChargeRow`) → **NUNCA escrever à mão**
- Gerar: `supabase gen types typescript` (ou `dfl-db generate:types`)
- Importar do `supabase/types.ts` gerado: `Database["payments"]["Tables"]["contracts"]["Row"]`
- Só tipos de **domínio derivado** (que não são 1:1 com tabela) ficam em `types/`

**Por que eu erro:** É mais rápido escrever a interface na hora do que gerar os types. Mas é exatamente isso que o TL recusa. Gerar SEMPRE.

### 0.4 — Schema: não criar tabela/coluna específica de fluxo. Usar `logs`/`activity_logs` reutilizável

**Cometido na #303** (colunas `payment_error`/`payment_error_at` específicas). TL:
> "It's not a good practice to create tables only for a specific flow. Usually we create `logs`/`activity_logs` tables that can be reused, else we need one errors table per entity (repetitive)."

**Regra:** Antes de adicionar coluna/tabela pra rastrear erro/evento de UM fluxo, perguntar: "existe `logs`/`activity_logs`/`audit_log` que serve?". Reutilizar. Tabela nova só pra estado que é genuinamente da entidade.

**SHARPEN (#499, 2026-06-24) — o tell "What's this table about?".** taigfs comentou só isso numa `CREATE TABLE` (`work.task_unlock_grants`). **A pergunta É o veredito:** se o TL não entende pra que a tabela serve lendo o diff, ou o design não se justifica ou a tabela não devia existir. Tell do Tainan: **"What's this table about?" = "justifica ou apaga"**.
- ANTES de qualquer `CREATE TABLE` num PR: escrever no corpo do PR, em 1 frase, por que a tabela existe e por que nenhuma infra existente serve. Sem a frase, não abre.
- Default = reusar, nesta ordem: `workflow_management.action_requests` (aprovação/grant/lifecycle: `status`+`decided_by`+`target_*`+`payload`), `logs`/`activity_logs`/`audit_log` (eventos/erros), ou uma **coluna de status/timestamp na própria entidade**.
- ❌ Tabela `*_grants`/`*_errors`/`*_flags`/`*_locks` de UM fluxo → quase sempre é coluna ou linha em tabela genérica. Pista de redundância: se a tabela tem FK pra `action_request_id`, o action_request já é a fonte da verdade.
- ✅ Tabela nova só com entidade própria, FKs próprias e >1 consumidor.

**SHARPEN (#499) — comentário no topo de migration é OBRIGATÓRIO.** taigfs: "adicione um comentário no início da migration explicando o propósito da tabela e suas relações." Migration SQL é a **exceção** à regra de zero-comentários. Todo `CREATE TABLE`/migration abre com `-- ` explicando propósito + relações + quem preenche/lê.

### 0.5 — TESTAR local/sandbox antes de submeter

**Cometido na #303.** TL:
> "Have you tested those changes locally (or in a sandbox)? This avoids having regressions (to break something that was already working)."

**Regra:** Mudou edge fn / webhook / lógica que já funcionava → testar local (`supabase functions serve`) ou sandbox ([[dfl-ngrok-webhook-testing]]) ANTES do push. Mexer em código que já roda em prod sem testar = regressão garantida.

### 0.6 — Schema de validação (Zod) NÃO fica colado no hook. Vai pra `schemas/`

**Cometido na #108** (`zod`/schema dentro de `hooks/revenue/useCreateContractForm.ts`). TL:
> "Move this to schemas/contract-schema.ts"

**Regra:** Todo schema de validação/tipo Zod vive em `src/schemas/{entity}-schema.ts` (UM por entidade), não inline no hook nem na page. O hook **importa** o schema. Mesma lógica de extração que utils/consts: schema é dado/contrato, não lógica de hook.
- Ex: `schemas/contract-schema.ts`, `schemas/charge-schema.ts`
- Pasta é `schemas/` (não `validation/`, não `zod/`, não inline).

---

## 1. ERRO #1 — Múltiplos componentes no mesmo arquivo

**Frequência:** 7+ comentários, sempre o mesmo recado: **"One file for each component"**.

**Padrão que cometi várias vezes:**
```tsx
// linked-tasks-info.tsx — 164 linhas
function TaskModal({ ... }) { ... }      // ❌ deveria ser /molecules/task-modal.tsx
function TaskInfoRow({ ... }) { ... }    // ❌ deveria ser /molecules/task-info-row.tsx
export function LinkedTasksInfo({...}){} // ✓ só este fica aqui
```

**Outro caso:** `review-requests-board.tsx` tinha `KanbanCard`, `MetricCard` e o board principal todos no mesmo arquivo. Recebi "One file for each component" 4 vezes na mesma PR.

**Regra absoluta:** Um arquivo `.tsx` exporta **um** componente. Componentes auxiliares vão em arquivos próprios na mesma pasta (atoms/molecules/organisms conforme [[dfl-code-style]]).

**Como prevenir:** Antes de declarar `function X()` dentro de um arquivo que já tem `export function Y()`, **pare**. Crie arquivo novo.

---

## 2. ERRO #2 — Lógica de negócio dentro do componente

**Frequência:** 5+ comentários. Quotes:

> "Mova a lógica para o hook `hooks/useReviewRequestDetails.ts`"
> "Toda a lógica entre a linha 46 e 92 poderia estar em um hook"
> "Da linha 28 à 142 é tudo lógica, saca? Poderia estar em um hook"
> "Bora mover toda a lógica para um hook instead, `useCreateInvoice.ts`"
> "Da linha 18 à linha 150 pode ir pra lá"

**Sinal vermelho:** Se um componente `.tsx` tem mais de **~30 linhas antes do `return`** (estados, useEffects, callbacks, derivações), tem lógica que não devia estar ali.

**Regra:**
- Componente: só renderiza JSX + recebe props
- Lógica vai em `hooks/use{ComponentName}.ts` (ex: `use-review-request-card.ts`)
- O hook retorna apenas o que o JSX precisa: `{ creatorName, hasComplexity, handleApprove, ... }`

**Como prevenir:** Quando começar a escrever `useState`, `useEffect`, ou função handler dentro de um componente, **assuma desde o início** que vai pra hook separado. Crie o hook antes de continuar.

---

## 3. ERRO #3 — Constantes hardcoded inline

**Frequência:** 6+ comentários: **"Move to consts/"**, **"Podia ser um arquivo em /consts"**.

**Padrão que cometi:**
```tsx
// review-requests-board.tsx
const COLUMNS = [
  { id: 'submitted', label: 'Aguardando Revisão', accent: 'bg-amber-400', ... },
  { id: 'in_review', ... },
  // mais 3 colunas, ~70 linhas
] as const  // ❌ deveria estar em /consts/review-board-columns.ts
```

**Outros exemplos:**
- `STATUS_LABELS: Record<string, string> = { ... }` → `/consts/status-labels.ts`
- `TONE_CLASSES = { amber: ..., blue: ..., red: ... }` → `/consts/tone-classes.ts`
- Listas de configuração de qualquer tipo

**Regra:** Toda estrutura de dados estática (array de config, mapa, enum-like object) com mais de ~5 linhas vai pra `src/consts/`.

**Como prevenir:** Ao escrever `const X = [` ou `const X = {`, se vai ter mais de 5 linhas e não muda em runtime, criar arquivo em `consts/` na hora.

---

## 4. ERRO #4 — Funções utilitárias inline

**Frequência:** 5+ comentários: **"Move to utils/X.ts and create a test file"**.

**Quotes diretas do taigfs:**
> "Move this to `utils/normalize-pix-key.ts` and create a test file"
> "Move this to `utils/only-digits.ts` and create a test file"
> "Move this to `utils/infer-pix-key-type.ts` and create a test file"

**Regra:** Função pura que pode ser testada isoladamente vai em `src/utils/` **com arquivo de teste correspondente AO LADO** (mesmo diretório, mesmo nome + `.test.ts`):

```
src/utils/
  ├── normalize-pix-key.ts
  ├── normalize-pix-key.test.ts    ← ao lado, mesmo nome
  ├── format-currency.ts
  └── format-currency.test.ts
```

**❌ NÃO usar `src/__tests__/unit/X.test.ts`** — esse padrão antigo foi corrigido pelo TL em 2026-05-15. Tests ficam **ao lado** do arquivo testado.

**Sinal:** Se eu escrevo `const getInitials = (name: string) => ...` ou `function normalizeKey(value: string): string { ... }` dentro de um componente/hook, é util. Vai pra `/utils`.

**Como prevenir:** Ao identificar função pura (sem hooks, sem estado, só transformação), criar em `/utils` desde o início. Sempre **com teste ao lado**.

### 4.1 — Vale pra função de UMA LINHA também. "O vizinho tem inline" NÃO é desculpa.

**Cometido na #172** (`UserLabel.tsx`, helper `shortId` de 1 linha: `` `${id.slice(0,8)}…` ``). taigfs: **"Move to utils/."** — mesmo numa PR que ele **aprovou** (nit, mas flagou).

Eu racionalizei deixar inline porque arquivos vizinhos (`WaitingTaskBanner`, `InstanceTimeline`, `GlobalTasks`) têm `formatDate`/`formatDeadline`/`formatDuration` inline. **Esse raciocínio é errado.** O TL trata QUALQUER função pura top-level num `.tsx` como misplaced, independente de:
- tamanho (1 linha conta),
- de já existir o mesmo anti-pattern em vizinhos (legacy ≠ permissão),
- de ser helper "privado" do componente.

**Regra dura:** zero `function`/`const =>` pura no nível de módulo de um `.tsx`. Formatter/transform/slice/initials → `src/utils/{kebab}.ts` + `.test.ts` ao lado, **na primeira vez**. Se vir um `formatDate` inline num arquivo que estou editando, é dívida — não é precedente pra copiar.

---

## 5. ERRO #5 — Tipos inline que deveriam estar em /types

**Frequência:** 3+ comentários.

**Padrão errado:**
```ts
// dentro de task-selection-section.tsx
interface Task {
  id: string;
  name: string;
  ...
}
interface Epic { ... }
```

**Quote:** "Poderia estar na pasta `types/`" / "Em `/types`".

**Regra:** Interface/type que representa entidade de domínio (Task, Epic, ReviewRequest, User, Invoice) **sempre** em `src/types/` (ou `src/interfaces/`, conforme convenção do repo). Tipos locais de props (`interface Props { ... }`) podem ficar inline.

---

## 6. ERRO #6 — Path/folder errado

**Frequência:** 4+ comentários.

**Casos:**
- Criei `src/data/X-api.ts` → taigfs: **"Para todos os arquivos `/src/data`, nosso padrão de pastas/nomenclatura não é esse, é `/src/services/{entityName}-service.ts`"**
- Criei `src/lib/payments/woovi.ts` com lógica de edge function → taigfs: **"Put it into `supabase/functions/{function-name}/index.ts`"**
- Criei wrapper `review-requests-export.tsx` que só chamava outra função → taigfs: **"Precisa desse arquivo? Economizaríamos um arquivo."**

**⚠️ Ver Seção 0.1 — esse erro é BLOQUEANTE e reincidente.** Inventei `queries/` na #81 mesmo com a regra abaixo.

**Regras de path consolidadas:**

| Tipo | Path correto |
|------|-------------|
| Acesso a entidade Supabase **(chama axios/API/Supabase de verdade)** | `src/services/{entity-name}-service.ts` (NÃO `src/data/`, NÃO `queries/`, NÃO `mappers/`) |
| Função pura / builder de request / sem chamada HTTP | `src/utils/{kebab-name}.ts` + `.test.ts` (**NÃO** `services/` — ver litmus test 0.1) |
| Mapper (row → domain) | função DENTRO do `{entity}-service.ts` (NÃO arquivo próprio) |
| Tipo de row do banco | gerado em `supabase/types.ts` (NÃO escrever à mão) |
| Schema de validação Zod | `src/schemas/{entity}-schema.ts` (NÃO inline no hook — ver 0.6) |
| Edge function | `supabase/functions/{function-name}/index.ts` |
| Nome de edge function | `dfl-{repo-suffix}-{verbo}-{entidade}` (ex: `dfl-payments-request-woovi-payment`) |
| Util puro | `src/utils/{kebab-name}.ts` + `src/utils/{kebab-name}.test.ts` (ao lado) |
| Constantes | `src/consts/{kebab-name}.ts` |
| Tipos de domínio | `src/types/{kebab-name}.ts` |
| Hook | `src/hooks/use-{kebab-name}.ts` |
| Rotas | `src/routes.tsx` (uma fonte só, pra app principal E module federation) |

---

## 7. ERRO #7 — Naming inconsistente / não-DDD

**Frequência:** 4+ comentários.

**Casos:**
- Arquivo `fellow-selector.tsx` → taigfs: **"user-selector.tsx — Let's use user instead of fellow"**
- `use-fellows.ts` → **"Rename to use-users (or a better entity name)"**
- `runWooviPaymentForInvoice.ts` (não é hook nem fica em /functions) → **"if it's a hook, you should start with `useRun...`. If it's just a function, you should put it inside functions/services"**
- `useInvoiceDetailEffects.ts` que tem múltiplas funções → **"Also, the file name should reflect the function name"**

**Regras:**
- Use o nome **da entidade do domínio** (User, não Fellow; Task, não Item)
- Hook **sempre** começa com `use` no arquivo e na função (`use-X.ts` + `useX()`)
- Nome do arquivo **deve refletir** o que ele exporta — se um arquivo tem múltiplas funções/componentes, ele tá errado (ver erro #1)

---

## 8. ERRO #8 — `let` em React + estado mutável fora do estado

**Quote direta:** **"We don't use let, use `useRef` instead"** seguido de **"Example: const xyz = useRef(false); xyz.current = true;"**

**Padrão errado:**
```tsx
function CreateInvoicePage() {
  let hasCalledOnce = false  // ❌
  // ...
}
```

**Padrão correto:**
```tsx
const hasCalledOnce = useRef(false)
hasCalledOnce.current = true
```

**Regra:** Em componente React, **nunca `let`**. Para flag mutável que não dispara render: `useRef`. Para estado que dispara render: `useState`.

---

## 9. ERRO #9 — Tipagem fraca / `unknown` mal usado

**Quote direta:**
> "Você põe value unknown, a gente tem que ser tipado, né, typescript. Então, se é um array, você tem certeza que é um array? Não precisa nem de uma função para isso."

**Padrão errado:** Funções helper que recebem `unknown` e fazem narrowing manual quando o tipo já é conhecido pelo Supabase schema.

**Solução do taigfs:**
> "Dá pra você usar a CLI do Supabase para gerar os types.ts do schema work nesse projeto aqui, daí você teria tipado aqui não precisaria definir aqui."

**Regra:** Para dados Supabase, **gerar tipos com a CLI** (`supabase gen types typescript`) e usar os types gerados. Não criar narrowing helpers pra `unknown`.

---

## 10. ERRO #10 — Lógica condicional dentro do JSX

**Quote:**
> "It's a good practice to move this before the render (L43), for example: `const message = (() => { if (isPixLoading) { return 'Loading PIX Key'; } if (!pixKey) { return ...; } return ... })();`"

**Padrão errado:**
```tsx
return (
  <Card>
    {isPixLoading ? "Loading..." : !pixKey ? "Sem chave" : `Chave: ${pixKey}`}
  </Card>
)
```

**Padrão correto:**
```tsx
const message = (() => {
  if (isPixLoading) return "Loading PIX Key"
  if (!pixKey) return "Sem chave PIX"
  return `Chave: ${pixKey}`
})()

return <Card>{message}</Card>
```

Preferível ainda: extrair pra hook se a derivação for complexa.

---

## 11.a — TUDO em inglês (regra obrigatória DFL)

**Regra absoluta:** todo código nos repos DFL é **em inglês**. Sem exceção.

Inclui: nomes de variáveis, funções, componentes, hooks, **arquivos**, mensagens de erro/log, comentários (raros), mensagens de commit.

**Antes de finalizar:** grep mental por português (`reviews`, `requisição`, `usuário`, `pendente`, `iniciar`, `aprovar`, `solicitação`...). Se achar, traduzir.

**Exceções:** strings de UI que aparecem pra usuário PT-BR ficam em PT no **value**, mas a **chave/identificador** é em inglês:
```ts
const STATUS_LABELS = {
  pending: 'Pendente',       // ✓ chave em EN, value em PT pra exibição
  in_review: 'Em revisão',
}
```

## 11.b — Mensagem de commit / PR / branch

**Sem exceção:**
- ❌ Nenhum `Co-Authored-By: Claude` ou trailer indicando autor
- ❌ Nenhum footer "🤖 Generated with..."
- ❌ Nenhum checklist (`## Test plan`, bullet points)
- ❌ Nenhum emoji (salvo se Samuel pedir explicitamente)
- ✅ **Em inglês**, imperativo, curto
- ✅ Formato: `tipo: descrição curta` (tipos: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `style`)

**Certo:**
```
feat: add kanban view for review requests
fix: handle null avatar url with initials fallback
refactor: extract task modal to its own component
chore: rename fellow-selector to user-selector
```

**Errado:**
```
feat(reviews): kanban board

- Add 5 columns
- Extract KanbanCard to molecule

Co-Authored-By: Claude <noreply@anthropic.com>
```

## 12. ERRO #11 — Pós-processamento que devia ser query

**Quote:**
> "Todo esse código adicionado (da linha 65 à linha ~143) tá bem feio. Não consigo entender só de ler. Se o problema foi o limit das tasks, já filtra elas à partir de coisas que você sabe... Tudo isso faz com que todo esse código vire 1 query com o próprio supabase client."

**Padrão errado:** Buscar dados crus do Supabase e filtrar/agrupar/ordenar no cliente em > 50 linhas de JS.

**Padrão correto:** Empurrar **filtros, joins, ordenação e paginação** pra própria query Supabase (`.eq`, `.in`, `.order`, `.range`, RPC functions). O JS do hook só deve consumir resultado já trabalhado.

---

## 11.c — Lições de revisão arquitetural (PR #304, 2026-05-19)

PR #304 (consolidated revenue stack) recebeu **14 comentários + CHANGES_REQUESTED**. Padrões novos que TL apontou — todos arquiteturais, fora do foco original desta skill em componentização frontend. **Aplicar SEMPRE em PRs de backend/schema/edge fn:**

### A. Schema sprawl — não criar schema novo

**Quote TL** (linha 3 de `20260515160000_create_revenue_schema.sql`): **"Let's do it inside payments."**

Eu criei `CREATE SCHEMA revenue`. Devia ter colocado as 6 tabelas em `payments.*` (`payments.contracts`, `payments.charges`, etc).

**Regra:** Antes de `CREATE SCHEMA <novo>`:
1. `psql -c "\dn"` ou `SELECT schema_name FROM information_schema.schemata`
2. Pergunta: "qual desses serve?" — `payments`, `work`, `lms`, `iam`, `notifications`, `financial`, `documents`, `event_management`, etc.
3. Default = extender. Schema novo só se domínio for genuinamente disjunto e nenhum existente serve.

### B. Reusar `dfl-notifications` — nunca criar helper paralelo

**Quote TL** (`_shared/revenue-notifications/notify-admins.ts`): **"Reuse dfl-notifications."**

Criei helper que faz fan-out de email. TL: deletar e POSTar direto pra edge function `dfl-notifications` (que já existe, 388 linhas, faz template lookup + Resend + in-app + preferences).

**Regra:** Antes de criar `_shared/<dominio>/notify-*.ts`:
1. `ls supabase/functions/ | grep notif`
2. Já existe `dfl-notifications` — sempre. Padrão de invocação: ver [[dfl-notifications-pattern]] na memória.
3. Faltou feature? Extender lá (PR separada), não duplicar.

### C. Não denormalizar dados de outros sistemas (CRM)

**Quote TL** (`client_data_snapshot.document/email`): **"Remove this data, let's keep it in the CRM. Add `external_id` (pointing to the CRM)."**

Salvei `{name, document, email, address}` do cliente em `revenue.contracts.client_data_snapshot`. TL: snapshot apenas `external_id` + `external_system`. CRM é a fonte da verdade — duplicar = divergência garantida.

**Regra:** Dado que vem de outro sistema (CRM, gateway, app externo) → guardar **referência**, não snapshot.

**Exceção:** legal/fiscal. NF-e exige snapshot fiscal do destinatário no momento da emissão — aí sim, tag explícita (`fiscal_snapshot`) e comentário explicando.

### D. FK redundante derivável = remover

**Quote TL** (`revenue.contracts.business_unit_id`, linha 66): **"Remove it from here (already linked in client_companies)."**

`business_unit_id` no contrato + também em `client_companies` → derivar via JOIN, não duplicar.

**Regra:** Toda nova FK passa por: "isso é derivável via outra FK?". Se sim, dropar.

### E. Frontend concern não vai pra edge fn

**Quote TL** (`_shared/revenue-woovi/rate-limit.ts`): **"Is this necessary? Check for `useDebounce` for the frontend input."**

Rate-limit in-memory por isolate não funciona (réplicas múltiplas) e proteção contra double-click é UX → frontend.

**Regra:** Antes de adicionar throttle/rate-limit no backend:
- UX (clique-feliz, double-submit)? → `useDebounce` no frontend
- Abuse (atacante)? → API gateway / WAF
- **Edge fn** = idempotency key, não rate-limit.

### F. Questionar jargão do provider — usar nome neutro

**Quote TL** (`revenue.charges.brcode`, linha 116): **"Should it be qrcode?"**

`brcode` é jargão Woovi. Convenção neutra: `qrcode` ou `pix_code`.

**Regra:** Nome de campo no schema reflete **domínio**, não provider. Se for migrar de Woovi pra Stripe um dia, o campo continua válido.

### G. Sandbox de integração — usar e documentar

**Quote TL** (Spedy webhook): **"Run against the test environment: https://docs.spedy.com.br/#section/Ambiente-de-testes"**

Spedy/Woovi têm sandbox. Webhook deve respeitar `environmentType: "sandbox" | "production"` no payload e separar dados no DB (ou ter env separado).

**Regra:** Toda integração externa em PR:
- env `<PROVIDER>_BASE_URL` configurável (default prod, override sandbox)
- doc do sandbox no PR description
- teste manual em sandbox antes do merge

### H. DFL-Bot_Reviewer ≠ TL

Bot disse "PR is clean" em #283, #284, #295, #296, #303, #304 — TL detonou todas. **Bot pega lint/typecheck. Não substitui review humano.** Aprovação bot ≠ aprovação TL.

---

## 11.d — Lições de revisão (taigfs, mineradas 2026-06-24)

### I. Seed/dados de domínio NÃO vão em migration de schema
**Tell:** migration = só DDL (estrutura). Seed/dados de exemplo vão pela camada de app/MCP tools.
- ❌ `INSERT` de dados de domínio dentro de migration de schema.
- ✅ DDL na migration; dados via app/MCP. Exceção: reference data idempotente com `-- @allow-dml` + `ON CONFLICT`. *(dfl-schema#488)*

### J. Não duplicar side-effect que o provider externo já faz
**Quote TL:** *"Please double check if this isn't already sent by Spedy; if so we don't need to notify on our side."*
Antes de adicionar notificação/email/webhook próprio em cima de integração externa (Spedy/Woovi/Autentique): conferir se o provider **já** dispara. Duplicar = usuário recebe 2× / divergência. ✅ confere o nativo antes de criar side-effect. ❌ notificação paralela "pra garantir". *(dfl-schema#508, #462)*

### K. Verificar o payload upstream ANTES de modelar colunas
**Quote TL:** *"Have you checked if the GitHub webhook sends you all these informations?"*
Não desenhar colunas a partir de payload externo **assumido**. Confirmar (doc/sandbox/log real) que a fonte entrega cada campo antes de criar coluna pra ele. *(dfl-schema#111)*

### L. Naming canônico do test de helpers de hook
**Tell:** convenção fixa = `<hook>.helpers.ts` + `<hook>.helpers.test.ts`. Não inventar sufixo (`*.behaviors.test.ts`). *(dfl-payments#82, #27)*

---

## 12. ✅ CHECKLIST OBRIGATÓRIO antes de finalizar arquivo

Rodar para **cada arquivo** que eu criei ou alterei significativamente:

**🚨 GATE — Seção 0 (reincidentes, BLOQUEANTES) — checar PRIMEIRO:**
- [ ] **Não criei pasta nova** (`queries/`, `mappers/`, `data/`)? Acesso a dados está em `services/{entity}-service.ts`?
- [ ] **Todo arquivo em `services/` chama axios/API/Supabase de verdade?** Se é função pura / builder de request → moveu pra `utils/` COM `.test.ts` (litmus test 0.1)?
- [ ] **Mapper é função dentro do service**, não arquivo separado?
- [ ] **Tipo de row do banco veio do `supabase/types.ts` gerado**, não escrito à mão?
- [ ] **Schema Zod está em `schemas/{entity}-schema.ts`**, não inline no hook (0.6)?
- [ ] **Não criei tabela/coluna específica de fluxo** — reusei `logs`/`activity_logs`/`action_requests`? Se há `CREATE TABLE`: justifiquei em 1 frase no PR e a tabela passa no teste "What's this table about?" (0.4)? Migration abre com comentário de propósito?
- [ ] **Testei local/sandbox** se mexi em código que já funcionava?

**Estrutural:**
- [ ] Arquivo tem **≤ 150 linhas**?
- [ ] Exporta **um único** componente/função principal?
- [ ] **Nenhum** `function X()` ou `const X = () =>` interno que poderia ser componente próprio?
- [ ] Componente `.tsx` tem **menos de ~30 linhas antes do `return`**?

**Extração:**
- [ ] Toda **lógica** (states, effects, callbacks, derivações) está em hook `use-{nome}.ts`?
- [ ] Toda **constante estática** (array/objeto > 5 linhas) está em `consts/`?
- [ ] Toda **função pura** está em `utils/{nome}.ts` **com teste**? (inclui formatter de 1 linha tipo `shortId`/`getInitials`; "o vizinho tem inline" NÃO é desculpa — §4.1)
- [ ] Todo **tipo de domínio** está em `types/`?

**Path & naming:**
- [ ] Path bate com a tabela de [paths corretos](#6-erro-6--pathfolder-errado)?
- [ ] Nome reflete a **entidade do domínio** (não apelido como "fellow")?
- [ ] Hook começa com `use-` e exporta `useX`?
- [ ] Arquivo de teste presente para utils?

**Anti-patterns:**
- [ ] Nenhum `let` no componente (`useRef` em vez disso)?
- [ ] Nenhum `unknown` em vez dos tipos gerados pelo Supabase CLI?
- [ ] Lógica condicional complexa **fora** do JSX?
- [ ] Filtros/joins/ordenação **na query Supabase**, não no JS?

**DRY:**
- [ ] Constantes/rotas que aparecem em mais de um lugar têm **fonte única**?
- [ ] Não criei wrapper que só chama outra função sem agregar valor?
- [ ] Não dupliquei `if (!isInModuleFederation)` ou similar em múltiplos arquivos?

**Build artifacts:**
- [ ] Arquivos como `.temp/`, `dist/`, `package-lock.json` **não foram deletados nem adicionados acidentalmente**?
- [ ] `.gitignore` cobre arquivos transitórios?

**Arquitetural (PR #304 learnings — backend/schema/edge fn):**
- [ ] `CREATE SCHEMA <novo>`? Listei schemas existentes antes? Algum serve (default: extender `payments`/`work`/`iam`/`notifications`)?
- [ ] Helper de notificação que eu criei? Posso POSTar direto pra `dfl-notifications` em vez disso?
- [ ] Coluna armazenando dados de CRM/gateway? Devia ser só `external_id text` + `external_system text`?
- [ ] FK nova? Já não tem JOIN possível pra derivar via outra FK existente?
- [ ] Rate-limit/throttle no backend? Não é UX (que vai no frontend) ou abuse (que vai no gateway)?
- [ ] Nome de campo é jargão de provider (`brcode`, `correlationID`)? Trocar pra neutro (`qrcode`, `external_ref`)?
- [ ] Integração externa: tem env pra sandbox? PR description menciona como testar?

---

## 13. Princípio geral

> "Bem feio. Não consigo entender só de ler."

Se eu olho o código que escrevi e levo > 30 segundos pra entender, **vai voltar**. Refatorar antes de pedir review.

A regra de Tainan implícita em todos os comentários: **legibilidade > esperteza**. Sempre.

---

## 14. Quando esta skill ajuda mais

- Antes de declarar implementação completa
- Ao terminar `.tsx` com mais de 100 linhas
- Ao escrever `function X()` aninhado em outro arquivo
- Ao copiar lógica que já existe em outro lugar (sinal de extração faltando)
- Antes de propor PR pro Samuel

## 15. Regras descobertas automaticamente

Veja `learned-rules.md` (mesma pasta). Esse arquivo é **gerado/atualizado automaticamente** pelo pipeline `~/.claude/scripts/dfl-pr-pipeline.sh` (cron semanal aos domingos 03:00 BRT). Contém regras extraídas pelo Haiku 4.5 a partir de comentários reais do `taigfs` em PRs.

Quando aparecer regra **nova** lá que não está nesta SKILL.md curada, considere incorporar manualmente.

## 16. Hook validator local (PostToolUse)

Adicionalmente, o hook `~/.claude/scripts/dfl-validator.py` roda **automaticamente** após cada Edit/Write/MultiEdit em `.tsx`/`.ts` em repo DFL. Ele **bloqueia** violações claras (>150 linhas, múltiplos componentes, hook em `.tsx`, `let` em React, constante > 5 linhas inline, interface de domínio inline, função util inline, path errado) e **avisa** em casos borderline. Eu vejo a violação na hora e devo corrigir antes de continuar.

Ver também: [[dfl-code-style]] (regras de base) e [[dfl-stack]] (lib choices).


---
> 🔒 **Camada de segurança (obrigatória):** rode também a skill `app-security` em qualquer código que toque dados, auth ou rede — RLS, JWT, secrets, env do cliente, headers, endpoints service-role, infra. Segurança é dimensão obrigatória de toda escrita/review, não opcional.
