# BRIEF — <plan title>

> Both planners read this file. Do not read the other planner's plan.

## 1. The ask (quoted)

> "<exact words of the requester, including quality words like 'visually stunning'>"

- **Success =** <measurable outcome, e.g. "a new user finishes checkout on a 360 px phone in under 2 minutes">.
- Style / scope vetoes: "<reference X is for content, not aesthetics>".
- Out of scope unless stated: <list>.

## 2. Required reading (and why)

| File | Why it matters |
|---|---|
| `sources/CONTEXT.md` | sectioned requirements from the raw sources |
| `sources/audit-*.md` | what exists today, with `path:line` — reuse it |
| `sources/PROBES.md` | branch protection, CI time, release gates, tools |
| `<prior plan>` | must not contradict; no third vocabulary |
| `<repo>/CLAUDE.md` / `AGENTS.md` | house rules and release gates |

This brief may contain mistakes. If a source contradicts it, follow the source
and cite `path:line`. Repos are read-only; read what you need, do not sweep.

## 3. Non-negotiable model

<the domain model stated once, e.g. "order → line item → shipment">.
If the model is unchanged by this plan, write "existing model — see
`sources/audit-data.md`"; do not invent one. Disagree on design, never on this.

## 4. Cover every one of these

1. Data model with real table/column names and volumes.
2. Architecture with named libraries and versions; which repo/package owns each part.
3. Screens / surfaces with states (empty, loading, error, long content) per band of `MATRIX.md`.
4. Rollout: what a fresh user sees by default; every flag with owner, date, exit.
5. Shared state touched (DB rows, stores, service worker, tokens, global CSS).
6. Security: who can call each action; any grant to a public role has a threat line.
7. Human consumers of every output (who, where they look, how it reaches them).
8. Phases, each accepted on the running build.
9. MVP by <date>: a floor + an ordered "if time" list with fallbacks. The
   requester's #1 quality word stays inside the floor.
10. Risks; every unknown limit becomes a measurement.
11. First tasks / PR rows (never drop this section).

## 5. Output format

- ADR: `### ADR-N — Title` with **Context** / **Decision** / **Alternatives** / **Consequence**.
- Question: `complex-plan/templates/QUESTION.md` (A/B/C, Recommended + why, Blocks, Decider).
- No inline diagrams unless the plan tracker renders them.

## 6. Limits

- No sub-agents, no code, no publishing.
- Light exploration: at most 40 files per repo.
- Body ≤ 60 KB.
- Last line of your file: `<!-- PLAN-DONE -->`.
- Chat reply: 5 lines — your 5 most confident decisions.
