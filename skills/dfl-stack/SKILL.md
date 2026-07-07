---
name: dfl-stack
description: Stack técnica padrão dos repos frontend DevFellowship — frameworks, libs, versões, ferramentas e o que NÃO introduzir. Use SEMPRE antes de adicionar dependências, configurar build, escolher lib nova ou inicializar repo novo no ecossistema DFL.
tags: [frontend, stack, dependencies, conventions]
---

# DFL Stack — Stack Técnica dos Repos Frontend

Define o que está padronizado nos repositórios frontend do ecossistema DevFellowship. **Não introduzir** nada fora desta lista sem aprovação do Samuel (ou do TL Tainan via PR review).

Backend (edge functions Deno, `dfl-mcp-server`, `dfl-discord-bot-server`, `dfl-craig`) tem stack própria — **fora do escopo** desta skill.

---

## 1. Core

| Camada | Tecnologia | Observação |
|--------|-----------|------------|
| Linguagem | **TypeScript** (strict) | Sem `any` — usar `unknown` + narrow |
| Runtime de build | **Vite** | Config padrão com `@vitejs/plugin-react-swc` |
| Compilador | **SWC** (via plugin Vite) | Não Babel |
| Framework UI | **React 18 ou 19** | 19 nos repos novos; 18 nos legados |
| Roteamento | **React Router DOM v6+** | Sem Next.js, sem Remix |

**Não introduzir:** Webpack direto, Babel, Parcel, esbuild standalone, CRA, Next.js, Remix, Astro.

---

## 2. UI / Estilização

| Camada | Tecnologia |
|--------|-----------|
| CSS | **Tailwind CSS** (utilities-first) |
| Componentes base | **shadcn/ui** (em `src/components/ui/`, intocável) |
| Primitivos headless | **Radix UI** (via shadcn) |
| Ícones | **lucide-react** |
| Temas | Tokens shadcn (`bg-card`, `text-muted-foreground`, etc.) |
| Cor de acento | `orange-500` (DevFellowship) |

**Não introduzir:** styled-components, emotion, CSS Modules, Sass, Material UI, Chakra UI, Ant Design, outras lib de ícones (heroicons, react-icons só se já existir no repo).

---

## 2.5 Reuso primeiro — `@devfellowship/components` e padrões cross-repo

**Regra (Samuel, 2026-05-25): antes de escrever QUALQUER componente/método novo, reusar o que já existe — no próprio repo E em outros repos DFL.** Não recriar o que a lib/ecossistema já entrega.

- **Componentes UI → `@devfellowship/components`** (lib compartilhada do ecossistema): fonte primária de `Button`, `Card`, `Input`, `Select`, `Dialog`, `Popover`, `Form`, `Badge`, `Separator`, etc. **NUNCA** HTML cru (`<button>`, `<input>`) nem componente próprio quando a lib já tem. (Os `src/components/ui/` shadcn locais existem em repos legados; a lib compartilhada é o padrão atual — preferir ela.)
- **Loading → skeleton SEMPRE**, espelhando o layout real que vem depois (ver [[dfl-pr-learnings]]). Nada de spinner genérico/"Loading…" solto onde cabe skeleton. Reusar os skeleton atoms do repo antes de criar novos.
- **Erros → `toast` (sonner) SEMPRE**: erro de mutation/ação → `toast.error(msg)`; sucesso relevante → `toast.success`. Não inventar banner/alert próprio pra erro quando o toast é o padrão.
- **Métodos/helpers/hooks → GREP antes de criar**: formatação (`formatCurrency`, `formatDate`), error message (`fnErrorMessage`), máscaras, etc. já existem — reusar. Se existe em outro repo DFL e faz sentido, mover pra lib compartilhada, não duplicar.

Checagem antes de finalizar: "esse componente/método já existe na `@devfellowship/components` ou em outro repo?" Se sim, importar. Complementa [[dfl-pr-learnings]] (reuse infra) e o checklist da seção 10.

---

## 3. Data Layer

| Necessidade | Tecnologia |
|-------------|-----------|
| Backend / DB / Auth / Storage | **Supabase** (`@supabase/supabase-js`) |
| Realtime | Supabase Realtime (canais) |
| Server state / cache | **TanStack Query v5** (`@tanstack/react-query`) |
| Mutations | `useMutation` do TanStack Query |
| Client state global | **React Context** (sem Redux/Zustand/MobX) |

**Padrões obrigatórios:**
- Nunca chamar `fetch` direto em componente — sempre via hook que usa TanStack Query
- Query keys semânticas em array: `['review-requests', filter, page]`
- Invalidação explícita após mutation (`queryClient.invalidateQueries`)
- Realtime: hook dedicado com `useRef` pra callback estável

**Não introduzir:** Axios, SWR, Apollo Client, Redux, Zustand, MobX, Recoil, Jotai, Valtio.

---

## 4. Forms & Validação

| Camada | Tecnologia | Quando usar |
|--------|-----------|-------------|
| Form lib | **React Hook Form** | Sempre que houver > 3 campos |
| Validação | **Zod** | Schema único compartilhado entre form e tipo |
| Resolver | `@hookform/resolvers/zod` | Liga RHF + Zod |

**Não introduzir:** Formik, Final Form, Yup, Joi, class-validator.

---

## 5. Module Federation

Repos DFL usam **`@originjs/vite-plugin-federation`** quando expõem ou consomem remotes.

- **Host:** `dfl-learn` (super-app)
- **Remotes:** `dfl-payments`, `dfl-reviews`, `dfl-iam`, `dfl-vaults`, etc.

**Comando de build:** `npm run build:federation` (ou `pnpm build:federation`) — `npm run build` puro pode não gerar o remoteEntry corretamente em alguns repos.

**Compartilhar via federation:** `react`, `react-dom`, `react-router-dom`, `@supabase/supabase-js`, `@tanstack/react-query`. Sempre como `singleton: true`.

---

## 6. Tooling

| Ferramenta | Uso |
|-----------|-----|
| **ESLint** | Lint obrigatório antes de commit (`npm run lint`) |
| **Prettier** | Formatação (segue config do repo) |
| **TypeScript** | `tsc --noEmit` parte do build |
| **Husky** + **lint-staged** | Onde houver — não bypass com `--no-verify` |

**Não introduzir:** Biome, Rome, dprint (a menos que Samuel confirme migração explícita).

---

## 7. Testes

Cobertura por repo varia. Quando houver:

- **Vitest** para unit/integration
- **Testing Library** (`@testing-library/react`) para componentes
- **Playwright** para E2E (raro, apenas em repos críticos)

**Não introduzir:** Jest (preferir Vitest pra alinhar com Vite), Cypress, Enzyme, Mocha.

---

## 8. Versões / Convenções de ambiente

- **Node:** varia por repo — sempre checar `.nvmrc`, `engines.node` no `package.json`, ou `package.json` do repo antes de instalar deps
- **Package manager:** misto entre repos — checar lockfile presente antes de rodar comando:
  - `pnpm-lock.yaml` → usar **pnpm**
  - `package-lock.json` → usar **npm**
  - `yarn.lock` → usar **yarn** (raro)
- **Nunca trocar** o package manager do repo sem perguntar (mistura de lockfiles quebra CI)
- **Nunca commitar** lockfile de gerenciador diferente do que o repo usa

---

## 9. Variáveis de ambiente

- Prefixo Vite: **`VITE_`** (apenas essas vão pro bundle do client)
- Arquivo: `.env.local` (gitignored), `.env.example` versionado
- Secrets nunca em `VITE_*` se forem sensíveis — usar Edge Function como proxy
- Para múltiplos ambientes em runtime: ler de `import.meta.env.MODE`

---

## 10. Checklist antes de adicionar dependência nova

1. **Existe nativo?** (browser API, util do TS, hook próprio)
2. **Existe no shadcn/Radix?** (componente UI)
3. **Existe no TanStack?** (table, virtual, form, query)
4. **Já tem lib similar instalada?** (não duplicar funcionalidade)
5. **É manutenida ativamente?** (último release < 6 meses, > 100 stars)
6. **Tem TypeScript nativo ou `@types/`?**
7. **Tamanho razoável?** (consultar bundlephobia)
8. Se passou em todas → instalar e abrir PR pra review

---

## 11. Repos frontend conhecidos (escopo desta skill)

Aplica em todos:
- `dfl-learn` (host MF)
- `dfl-payments` (+ revenue)
- `dfl-reviews`
- `dfl-iam`
- `dfl-vaults`
- `dfl-documents`
- `dfl-skill-evals`
- `dfl-template-app`
- `dfl-notifications`
- `dfl-wiki`
- `dfl-tracks`
- `dfl-flows` (parte frontend)
- `dfl-event-management`
- `dfl-observability` (se tiver UI)

Ver [[dfl-permissions]] para tier de cada repo antes de qualquer ação destrutiva, e [[dfl-code-style]] para regras de código que complementam a stack.


---
> 🔒 **Camada de segurança (obrigatória):** rode também a skill `app-security` em qualquer código que toque dados, auth ou rede — RLS, JWT, secrets, env do cliente, headers, endpoints service-role, infra. Segurança é dimensão obrigatória de toda escrita/review, não opcional.
