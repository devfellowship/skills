---
name: dfl-db-simplicity
description: Diretriz de manutenibilidade do TL (Tainan/taigfs, 2026-06-19) para o banco nos repos DFL — a especialização do time é app/TS, NÃO banco. Empurrar lógica pro TS (edge functions/API, que têm arquivos de teste), manter o banco FINO. Evitar ao máximo RLS complexa e funções plpgsql (SECURITY DEFINER, lógica em SQL). Use ANTES de decidir onde colocar lógica nova em qualquer feature que toque dfl-schema. Complementa [[dfl-pr-learnings]].
author: SamuelStefano
tags: [schema, database, postgres, architecture]
---

# DFL DB Simplicity — lógica no TS, banco fino

Diretriz do TL (Tainan) numa call 2026-06-19, sobre a PR #522 (uma `SECURITY DEFINER` RPC de cancelamento). Não estava *errada* — mas o TL apontou que, pra **manutenção**, é melhor evitar ao máximo esse tipo de coisa.

## Por quê (a razão, não decore a regra)

- A **especialização do time é aplicação/TypeScript**, não banco de dados. Complexidade de SQL (RLS, plpgsql, `SECURITY DEFINER`, lógica de negócio em função) é poderosa, mas vira **dívida de manutenção fora do domínio de quem mantém**.
- **Testabilidade:** edge functions em TS têm **arquivos de teste** (`*.test.ts`) que o time sabe escrever e rodar. Função plpgsql só testa via docker/integração — mais lento e fora da zona de conforto. Lógica em TS = cobertura de teste de verdade, por quem consegue manter.
- **Revisão/debug:** o time lê e debuga TS com fluência; um `RAISE`/`FOR UPDATE`/policy RLS num plpgsql é mais difícil de revisar com confiança.

## Default: empurrar lógica pro TS

Ordem de preferência pra **lógica nova**:

1. **Edge function em TS** (service-role client) + checagem de auth em TS + chamadas simples ao banco (`select`/`insert`/`update`). Testável com `*.test.ts`. **Este é o default.**
2. Constraint declarativa no banco quando é invariante de dados puro (FK, `CHECK`, `UNIQUE`, `NOT NULL`, enum, índice).
3. Função SQL / RLS bespoke — **só quando há justificativa forte** (ver abaixo).

Manter o banco **fino**: tabelas + FKs + constraints simples + índices + enums. Orquestração e regra de negócio → camada TS.

## Quando SQL/RPC AINDA se justifica (não é proibido, é último recurso)

Use função SQL / `SECURITY DEFINER` só quando o app layer **genuinamente não consegue garantir** a propriedade:

- **Atomicidade/corrida crítica de dinheiro:** um `FOR UPDATE` + multi-update que PRECISA ser uma transação indivisível pra não double-spend (ex: `confirm_charge_paid`). Difícil de garantir do TS sem corrida.
- **Idempotência por constraint:** `UNIQUE` parcial pra dedup de webhook (isso é DDL, ok — fica no banco).
- **Invariante que o banco é o único lugar seguro pra impor** (defesa em profundidade real).

Mesmo aí: **minimize o corpo, comente o WHY, e prefira que o TS faça o resto.** Se dá pra fazer no TS com uma transação/checagem razoável, faça no TS.

## RLS: reusar simples, não inventar complexo

- RLS é **segurança** (defesa em profundidade) — NÃO sair removendo de dado sensível só por manutenção.
- Mas: **reusar os helpers padrão** (`iam.is_global_admin()`, `iam.is_member()`) com policies simples. **Não** escrever policy bespoke complexa. Se a lógica de acesso ficou complicada, ela provavelmente pertence ao TS (edge function decide e usa service-role).

## Checklist antes de escrever qualquer `.sql` com função/RPC/policy

1. "Essa lógica dá pra fazer numa edge function TS com teste?" → se sim, **faça lá**.
2. "Isso é invariante de dados puro?" → constraint declarativa, ok.
3. "Preciso MESMO de atomicidade/corrida que só o banco garante?" → só então RPC, mínima e comentada.
4. "Tô escrevendo policy RLS nova e complexa?" → pare; mova a decisão pro TS, reuse helper simples no banco.
5. Sempre que puser lógica em SQL, **justifique no PR** por que não foi no TS (o TL vai perguntar).

## Nota sobre o legado

O `payments`/dfl-schema atual usa MUITA RLS + RPC `SECURITY DEFINER` (`activate_contract_for_document`, `cancel_contract`, `create_contract_addendum`, etc.). Isso é o padrão **existente** — não sair reescrevendo. A diretriz vale pra **lógica nova**: na dúvida entre nova RPC vs edge function, escolher edge function TS. Migrar legado só se o TL pedir.


---
> 🔒 **Camada de segurança (obrigatória):** rode também a skill `app-security` em qualquer código que toque dados, auth ou rede — RLS, JWT, secrets, env do cliente, headers, endpoints service-role, infra. Segurança é dimensão obrigatória de toda escrita/review, não opcional.
