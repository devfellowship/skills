---
name: dfl-schema-migrations
description: Regras e correções recorrentes ao criar/editar migrations SQL no dfl-schema (qualquer .sql em supabase/migrations/). Use SEMPRE antes de finalizar ou abrir PR de migration — é o checklist obrigatório de "o Tainan/Samuel vão pedir correção disso?". Cobre o MÉTODO DE APLICAÇÃO (ledger por timestamp, duplicate-version=silent-skip, timestamp malformado, recorded-not-applied, human-gate de prod), SEGURANÇA/AUTZ (NUNCA GRANT write SECURITY DEFINER a anon com schema exposto no PostgREST — o gate do app é bypassável; gate por segredo DENTRO da função), dfl-db-simplicity (empurrar lógica pro TS testável, não plpgsql novo) e padrões de upsert/enum/trigger. AUTO-EVOLUI: cada correção de PR nova vira entrada no "Registro de correções". Complementa [[dfl-pr-learnings]] e [[dfl-db-simplicity]].
tags: [schema, database, postgres, migrations]
---

# DFL Schema Migrations — checklist + correções recorrentes

Skill destilada das revisões reais de migrations no `dfl-schema`. **Quase toda migration nesses PRs é escrita por mim (Claude) e volta pra correção.** Esta skill existe pra elas **saírem certas de primeira**. Roda mentalmente o checklist da §6 ANTES de abrir/atualizar qualquer PR de migration.

> **Como esta skill evolui:** toda vez que eu corrigir uma migration (review do squad, comentário do Tainan, ou achado meu), adiciono uma entrada no **§7 Registro de correções** com data + PR + a regra destilada, e sincronizo as §0–5. Objetivo: convergir pra zero-retrabalho. Estilo `dfl-pr-learnings`.

---

## 0. 🚨 REGRAS DURAS (quebrar = furo de segurança ou migration que não aplica)

### 0.1 — NUNCA aplico migration no DB de prod. Só abro PR.
Migrations do `dfl-schema` aplicam em **prod no merge** (workflow `push-migrations.yml`, runner self-hosted, psql no pooler). Aplicar é **human-gate do Tainan** + minha regra dura de mutação ([[dfl-supabase-db-mutation-4-judges]] — IA apagou o banco em 2025). Eu **abro PR, peço review, NUNCA mergeio/aplico**. Se a mudança troca a **assinatura** de uma função que o app já chama, a PR de schema e a do app **sobem juntas** (senão o app deployado quebra).

### 0.2 — Write `SECURITY DEFINER` granted a `anon` + schema exposto no PostgREST = QUALQUER UM ESCREVE.
**O furo da PR #577 (2026-06-27).** Se o schema está no `pgrst.db_schemas` (exposto), uma função `SECURITY DEFINER` com `GRANT EXECUTE ... TO anon` é chamável por **qualquer um com a anon key pública** via `POST /rest/v1/rpc/<fn>` — roda como o dono (postgres), ignora RLS e grants de tabela. **O gate de bearer no app NÃO protege** (só guarda a rota HTTP do app, não o PostgREST).
- NUNCA: `GRANT EXECUTE ON FUNCTION <write_rpc> TO anon;` quando o schema é exposto.
- Se o write PRECISA ser anon-callable (app anon-only / "Option B"), **verificar o segredo DENTRO da função**, fail-closed:

      IF p_secret IS NULL OR p_secret <> current_setting('app.<name>_secret', true) THEN
        RAISE EXCEPTION 'unauthorized' USING errcode = '28000';
      END IF;

  (segredo como GUC no DB; o app passa o segredo que já tem). Assim o bearer vira gate **enforçado no DB**, não só no app.
- Default melhor (sem app anon-only): o write usa **`service_role`** (não exposto a anon) e NÃO precisa de SECURITY DEFINER.
- "anon não tem grant na TABELA, logo não escreve" é **falso** quando existe um RPC SECURITY DEFINER anon — o RPC é o bypass. Securizar a tabela != securizar o RPC.

### 0.3 — Não granta a `authenticated` se o app não chama como authenticated.
Grant morto = superfície extra (qualquer user logado chama o RPC via PostgREST com a sessão). Grant **mínimo**: só a role que o app realmente usa.

### 0.4 — SECURITY DEFINER read que ignora RLS + granted a anon = VAZAMENTO.
Uma fn read `SECURITY DEFINER` vê linhas que a RLS esconderia. Se granted a anon, anon lê o que era privado (ex: `ingest_peek_hashes` vazava slugs/hashes de skills `internal`). Restringir a `service_role` (ou gate por segredo). RLS-bypass + anon = não.

---

## 1. Método de aplicação (como a migration REALMENTE entra em prod)

`push-migrations.yml` (on merge): loop `for FILE in supabase/migrations/*.sql` (ordem **glob/lexical**), pega a **VERSÃO** = prefixo `YYYYMMDDHHMMSS`, pula se já está em `supabase_migrations.schema_migrations`, aplica as pendentes via `psql -v ON_ERROR_STOP=1 -f`.

### 1.1 — Timestamp ÚNICO e VÁLIDO. Duplicado = SQL silenciosamente perdido.
- **Duplicate version** (dois arquivos com o mesmo `YYYYMMDDHHMMSS`): o ledger grava a versão **uma vez** e **PULA SILENCIOSAMENTE** o perdedor alfabético — sem erro, objetos nunca criados. Guard: `scripts/check-duplicate-migration-versions.sh` (falha no PR). Já aconteceu 2x. Sempre timestamp único.
- **Timestamp malformado** (ex: `20261906173321` = mês 19): ordena fora de lugar; landmine pro `supabase db push` (history order). Usar data real `YYYYMMDDHHMMSS`.

### 1.2 — recorded-not-applied: confiar em prod ao vivo, não no ledger.
Migration pode constar aplicada sem criar os objetos ([[dfl-migration-recorded-not-applied]]). **Pós-apply, verificar em prod**: `SELECT oid FROM pg_proc WHERE proname='<fn>' AND pronamespace=(SELECT oid FROM pg_namespace WHERE nspname='<schema>')`, ou via PostgREST/capability-probe do serviço. Se faltou, re-aplicar com **timestamp novo** (não reusar).

### 1.3 — `NOTIFY pgrst, 'reload schema';` ao adicionar/expor RPC.
Dentro da txn (dispara no COMMIT). Sem isso, o PostgREST pode não enxergar a fn nova sem restart.

---

## 2. dfl-db-simplicity (empurrar pro TS antes de escrever plpgsql)

Antes de escrever função SQL / `SECURITY DEFINER` / RLS bespoke nova, ver [[dfl-db-simplicity]]:
1. "Isso dá pra fazer numa edge fn/serviço TS com teste (`*.test.ts`), usando `service_role` + `.from().upsert()`?" Faz lá. É o default do TL.
2. Invariante de dados puro? Constraint declarativa (FK/CHECK/UNIQUE/NOT NULL/enum/índice).
3. Atomicidade/corrida que SÓ o banco garante (dinheiro, `FOR UPDATE`)? Só então RPC, **mínima e comentada**.
4. **Justificar no PR** por que foi em SQL e não no TS (o TL pergunta). Batch-upsert idempotente sem corrida = caso clássico de "vai pro TS".
5. RLS: reusar helpers (`iam.is_member()`, `iam.is_global_admin()`), não inventar policy complexa.

---

## 3. Padrões de SQL (correção que volta)

- **Upsert `ON CONFLICT DO UPDATE`:** preservar campos que NÃO devem ser zerados com `COALESCE(EXCLUDED.x, s.x)` — não sobrescrever cegamente com NULL. (Bug #577: `content_sha256 = EXCLUDED.content_sha256` apagava o hash quando o row vinha sem ele. Certo: `COALESCE(EXCLUDED.content_sha256, s.content_sha256)`.)
- **Coluna NOT NULL em INSERT explícito:** um NULL no INSERT **não** cai no DEFAULT da coluna -> viola constraint. `COALESCE`/guard se o input pode faltar.
- **Cast de enum** `(v->>'x')::meu_enum`: erra em NULL/label inválido -> **aborta o batch inteiro**. Garantir validação upstream (zod) OU `COALESCE`/guard.
- **Cast de vector** `(v->>'embedding')::public.vector(1536)`: dimensão errada aborta o batch. Pinned ao modelo.
- **Loop de batch numa txn só:** 1 row ruim aborta TUDO (sem `SAVEPOINT`/`EXCEPTION`). Decidir: per-row resiliente (`EXCEPTION WHEN others THEN ... CONTINUE`) vs all-or-nothing **documentado**. Conferir o que o app espera.
- **Deixar os triggers `BEFORE` cuidarem** de `updated_at`/`search_vector` — não setar na mão no INSERT/UPDATE.
- **`SET search_path = <schema>, public, pg_temp`** em toda fn SECURITY DEFINER.

---

## 4. Convenções de migration dfl-schema

- **Comentário de topo OBRIGATÓRIO** (exceção à regra de zero-comentário): propósito + relações + quem escreve/lê. (dfl-pr-learnings 0.4/I.)
- **Nome:** `YYYYMMDDHHMMSS_<schema>_<descritor>.sql` (data real).
- **Idempotente:** `CREATE OR REPLACE FUNCTION`, `CREATE TABLE IF NOT EXISTS`, etc.
- **Seção `-- DOWN`** (rollback manual) no fim.
- **DDL only** — sem seed/dados de domínio na migration de schema (vão via app/MCP). Exceção: reference data idempotente com `-- @allow-dml` + `ON CONFLICT`.
- **Sem `CREATE SCHEMA` novo** sem checar os existentes — default = extender. (schema sprawl, dfl-pr-learnings 11.c/A.)
- **Sem tabela/coluna específica de UM fluxo** — reusar `logs`/`activity_logs`/`action_requests` (dfl-pr-learnings 0.4). `CREATE TABLE` passa no "What's this table about?" (1 frase no PR).

---

## 5. Commit / PR (estilo DFL)

- Commit `tipo: descrição` em **inglês**, imperativo, 1 linha. Sem corpo, sem `Co-Authored-By`, sem "Generated with", sem emoji. ([[dfl-pr-learnings]] 11.b, [[dfl-no-author-attribution-in-prs]])
- PR description: o que destrava + por que a lógica foi em SQL (se foi) + que é human-gated apply.

---

## 6. CHECKLIST antes de abrir/atualizar PR de migration

**Aplicação:**
- [ ] Timestamp `YYYYMMDDHHMMSS` **único** e **válido** (data real, mês <= 12)?
- [ ] Não estou aplicando em prod — só PR? Mudança de assinatura pareada com a PR do app?
- [ ] `NOTIFY pgrst, 'reload schema'` se adicionei/expus RPC?
- [ ] Defini o passo de verificação pós-apply (pg_proc / capability-probe)?

**Segurança/autz (o mais reincidente):**
- [ ] Write `SECURITY DEFINER` com `GRANT ... TO anon` em schema exposto? REMOVER anon ou gate por segredo DENTRO da fn.
- [ ] Grant a `authenticated` que o app não usa? Remover.
- [ ] Read `SECURITY DEFINER` (RLS-bypass) granted a anon vazando linhas privadas? Restringir.
- [ ] Grant **mínimo**? `SET search_path` em toda fn SECURITY DEFINER?

**dfl-db-simplicity:**
- [ ] Não daria pra ser TS testável (service_role + `.upsert()`)? Se ficou em SQL, justifiquei no PR?

**SQL:**
- [ ] `ON CONFLICT` preserva campos sensíveis com `COALESCE(EXCLUDED.x, s.x)`?
- [ ] Casts (enum/vector) e NOT NULL guardados (batch não aborta por 1 row)?
- [ ] Triggers `BEFORE` cuidam de `updated_at`/`search_vector`?

**Convenções:**
- [ ] Comentário de topo? Seção `-- DOWN`? Idempotente? DDL-only?
- [ ] Sem `CREATE SCHEMA`/tabela-de-fluxo novos sem justificativa?

---

## 7. Registro de correções (auto-evolui — append a cada PR)

### 2026-06-27 · dfl-schema#577 (skills ingest RPC) — review squad 4 + skills DFL
Migration cria `skills.ingest_skills(jsonb)` + `ingest_peek_hashes`. Achados (viraram as regras acima):
- CRÍTICO: `GRANT EXECUTE ON skills.ingest_skills TO anon` + schema `skills` exposto no PostgREST (`20260626220000`) -> anon key pública escreve no registry direto, furando o bearer `SKILLS_INGEST_SECRET` do app. -> §0.2. Fix sob "Option B" (app anon-only, dfl-services#64): gate por segredo dentro da fn (`p_secret` vs GUC).
- ALTO: `ingest_peek_hashes` SECURITY DEFINER (bypass RLS) granted a anon -> vaza slugs/hashes de skills `internal`. -> §0.4.
- MÉDIO: grant `authenticated` morto (app só usa anon client). -> §0.3.
- MÉDIO: `content_sha256 = EXCLUDED.content_sha256` apaga hash com NULL -> re-embed espúrio. -> §3 (COALESCE).
- BAIXO: timestamp malformado `20261906173321` (vizinho, PR #538) = landmine de ordering. -> §1.1.
- CERTO (manter): comentário de topo rico, `-- DOWN`, `CREATE OR REPLACE` idempotente, `SET search_path`, `NOTIFY pgrst` dentro da txn, versão única.
- Veredito dfl-db-simplicity: o batch-upsert idealmente seria `.upsert()` em TS com service_role (testável) — o "Option B (zero service_role)" produziu um furo maior do que evitaria.

### 2026-06-28 · dfl-services#65 (SUBSTITUI dfl-schema#577) — o melhor fix de migration foi NÃO ter migration
A #577 (2 RPCs `SECURITY DEFINER` pro ingest) foi SUBSTITUÍDA por **TS + service_role** no `dfl-skills` (write path only; read segue anon+RLS). Resolveu 2 problemas de uma vez: (a) **zero migration/plpgsql** (dfl-db-simplicity §2 — era upsert idempotente sem corrida = caso clássico de TS testável; virou `.upsert({onConflict})` + `.select()`); (b) **fechou o furo anon-write** da §0.2 (write usa service_role server-only, não a anon pública). Read segue anon+RLS = boundary intacto. #577 FECHADA.
- **Regra reforçada (pré-migration):** antes de escrever migration/RPC, perguntar **"isso é só upsert/select que o serviço TS faz com service_role (2 clients: read anon+RLS, write service_role)?"** → se sim, **NÃO escreve migration**. service_role num servidor é o padrão correto; o "zero service_role" foi o que forçou o RPC e abriu o furo.

<!-- PROXIMAS ENTRADAS: data | repo#PR | achados -> regra. Manter as regras das §0-5 sincronizadas. -->


---
> 🔒 **Camada de segurança (obrigatória):** rode também a skill `app-security` em qualquer código que toque dados, auth ou rede — RLS, JWT, secrets, env do cliente, headers, endpoints service-role, infra. Segurança é dimensão obrigatória de toda escrita/review, não opcional.
