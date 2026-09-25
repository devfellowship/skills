---
name: complex-plan
description: Use BEFORE writing a plan for large software work — a new app, a redesign, a mobile version, a cross-service pipeline, anything that will become 5+ PRs or be executed by other agents. Routes through the pack in a fixed order (ground truth → two-planner draft → acceptance gates → PR slicing → readiness review → execution handoff) and names the hard gates a plan must pass before it is published. Skip for a one-file bug fix, a question, or a plan that already exists and only needs a small edit.
author: SamuelStefano
tags: [planning, architecture, multi-agent, pack]
---

# Complex plans that ship without bugs

## Why this pack exists

It was distilled from five real large plans and the bugs that came after them.
The pattern was consistent:

- **Facts about code were almost always right.** Audits with `file:line` held up.
- **What broke was every gate written as prose.** Rollout, real-device checks,
  measured limits, CI cost, shared-state isolation, "the person actually sees it".
  When agents executed 30 PRs in 3 days, every gate that was not an automated
  check or a named task was silently skipped.
- **Review findings were found and then lost.** Reviewers predicted the two worst
  bugs word for word; the plan turned them into one sentence with no PR.
- **The best plan came from two blind planners + an adversarial review + a
  dialog where the author could argue back.** 22 minutes, 20 decisions, 26
  review findings applied, and the build followed it with zero parse warnings.

**Core principle:** a plan is not done when it reads well. It is done when every
promise in it is owned by a PR, a test, a question, or a named human with a date.

## The route (do not skip or reorder)

| # | Phase | Skill | Output |
|---|---|---|---|
| 1 | Ground truth | `plan-ground-truth` | `sources/` on disk, coverage table, scope confirmed, live-state probe |
| 2 | Draft | `plan-dual-draft` | `BRIEF.md` → `plan-A.md` + `plan-B.md` → `plan-merged.md` → `review.md` → `dialog.md` |
| 3 | Gates | `plan-acceptance-gates` | acceptance that fires: running app, viewport matrix, rollout, shared state, human-visible outcome |
| 4 | Slicing | `plan-slicing` | PR table with owners of shared artifacts, conflict map, merge/deploy order |
| 5 | Readiness | `plan-readiness-review` | mechanical checklist passed, every finding owned, decisions posted as questions |
| 6 | Handoff | `plan-execution-handoff` | executor briefs, merge policy, "done = seen running" |

Small plan (2–4 PRs, one repo, no UI)? Phases 1, 3, 5 are still mandatory. Phase 2
can be a single planner + one adversarial reviewer.

## Hard gates — the plan is NOT publishable while any is open

1. Every primary source is on disk and mapped in a coverage table (nothing "from memory").
2. Scope was confirmed with the requester, or one example was shown, before any fan-out.
3. Every flag / second code path between the code and real users has a flip PR, owner, date and exit criterion.
4. Every UI acceptance item names viewports **and** requires opening the built app with zero console errors.
5. Every "unknown limit" (body size, rate limit, API shape, duration) is a Phase-0 measurement, not a risk row.
6. Every shared artifact (component, store, token, hook, service worker, setting) has exactly one owner PR.
7. Every review finding is a PR row, a question, or "won't do + consequence". Prose does not count.
8. Every decision that belongs to someone else is a posted question with A/B/C and a recommendation — never answered by the planner.
9. Every human gate (device test, design sign-off, secret, approval) has a name and a date, scheduled at the start, not at the end.
10. Branch protection, CI duration and release gates in the repo docs were probed, and the merge path is written down.

## Stop rules

- Planning is done when the final reviewer says **YES + at most 3 residual risks**, and each risk has an owner. Do not loop for polish.
- If the requester has not seen anything yet, stop and show one example before spending on more agents.
- If a source could not be read, say so in the plan header. Never fill the gap with a guess.

## Files this pack expects

```
<plan-dir>/
  sources/            # transcripts, screenshots, design exports, code audits (phase 1)
  COVERAGE.md         # source item → plan section | dropped because (phase 1)
  BRIEF.md            # shared brief for both planners (phase 2)
  plan-A.md plan-B.md plan-merged.md review.md dialog.md
  PLAN.md             # the publishable body: decisions + criteria only
  EXECUTION-LOG.md    # progress, never inside PLAN.md
```
