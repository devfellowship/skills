# BRIEF — <plan title>

> Both planners read this file. Do not read the other planner's plan.

## 1. The ask (quoted)

> "<exact words of the requester, including quality words like 'visually insane'>"

Style / scope vetoes:
- "<reference X is for content, not aesthetics>"
- Out of scope unless stated: <list>

## 2. Required reading (and why)

| File | Why it matters |
|---|---|
| `sources/CONTEXT.md` | sectioned requirements from the raw sources |
| `sources/audit-*.md` | what exists today, with `path:line` — reuse it |
| `<prior plan slug>` | must not contradict; do not invent a third vocabulary |
| `<repo>/CLAUDE.md` or `AGENTS.md` | release gates, house rules |

Repos are read-only. Read what you need, do not sweep everything.

## 3. Non-negotiable model

<the domain model stated once, e.g. "capability → claim → task → evidence">.
Disagree on design, never on this.

## 4. Cover every one of these

1. Data model with real table/column names and volumes.
2. Architecture with named libraries and versions.
3. Screens / surfaces with states (empty, loading, error, long content), per viewport band.
4. Rollout: how real users get it by default; every flag with owner, date, exit.
5. Shared state touched (DB rows, stores, service worker, tokens, global CSS).
6. Security and permissions per action.
7. Phases, each with acceptance that can be checked on the running app.
8. MVP by <date>: a floor (must ship) + an ordered "if time" list with fallbacks.
   Keep the requester's #1 quality word inside the floor.
9. Risks, with every unknown limit turned into a measurement.
10. First tasks / PRs (never drop this section).

## 5. Output format

- ADRs: `### ADR-N — Title`, fields **Context / Decision / Alternatives / Consequence**.
- Open questions: `### Q-N — question`, options **A / B / C**, `Recommended: X` + why.
- No inline diagrams unless the registry renders them; describe, then link.

## 6. Limits

- No sub-agents, no code, no publishing.
- Light exploration (shared RAM). Max <N> files per repo.
- Last line of your file: `<!-- PLAN-DONE -->`.
- Chat reply: 5 lines — the 5 decisions you are most confident in.
