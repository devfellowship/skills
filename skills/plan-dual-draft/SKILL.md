---
name: plan-dual-draft
description: Use to draft a large plan with two independent planner agents — shared brief, blind drafts from different angles and models, a merge that picks instead of averaging, an adversarial review that tries to knock the plan down, a written dialog where the author may argue back, and a final consistency pass with a YES/NO verdict. Use after plan-ground-truth. Skip for a small plan (one planner plus one adversarial reviewer is enough) and for editing an existing plan.
author: SamuelStefano
tags: [planning, multi-agent, review, architecture]
---

# Two planners, one plan

## Overview

The best plan in the source cases took 22 minutes: two blind planners, one merge,
one hostile review with 26 numbered findings, one written dialog, one
consistency pass. The builder later loaded real content with zero warnings
because the plan was precise enough to split work by section.

**Core principle:** disagreement is the product. Two blind drafts surface the
decisions; the merge records them; the review attacks them; the dialog lets the
right side win with a source.

## Roles

| Role | Model hint | Job |
|---|---|---|
| Orchestrator | any | writes `BRIEF.md`, launches, polls files, never reads 120 KB |
| Planner A | strongest reasoning model | angle 1 (e.g. architecture, data, collaboration) — still covers every section |
| Planner B | a *different* model | angle 2 (e.g. experience, visuals, performance) — still covers every section |
| Merger | Planner A, resumed | one plan, decisions as ADRs, provenance section |
| Reviewer | Planner B, resumed | tries to knock the merged plan down |

Resume the same agents (keep their context) instead of starting new ones.

## Step 1 — One shared brief

`BRIEF.md`, read by both planners by path. Template in `brief-template.md`. It must hold:

1. The requester's ask, **quoted**, including style vetoes ("reference for content, not aesthetics").
2. Required reading, each item with *why* it matters (sources/CONTEXT.md, the code audits, prior plans to not contradict).
3. The **non-negotiable model** stated once. Planners disagree on design, never on the model.
4. A coverage checklist (10 points) — including "be specific: libraries, versions, data volumes", "MVP by <date> with acceptance per phase", "first tasks".
5. The output format (ADR header shape, question shape A/B/C + recommended), so the result parses mechanically.
6. Limits: no sub-agents, no code, no publishing, light exploration (RAM), a sentinel last line `<!-- PLAN-DONE -->`.

## Step 2 — Blind drafts

- Each prompt: "Do **not** read `plan-X.md`." Blindness prevents early convergence.
- Each ends its chat reply with **5 lines: the 5 decisions you are most confident in**. The orchestrator diffs those, not the files.
- Wait on files: `until grep -q 'PLAN-DONE' plan-A.md; do sleep 15; done`.

## Step 3 — Merge (picks, never averages)

Prompt (see `prompts.md`):
- Where they differ, **pick one** and record an ADR with the loser under *Alternatives*.
- Say which planner owns which depth ("keep B's screen-level UX, keep A's merge rigor").
- Top section **"What came from where (A/B)"**.
- **Never drop a whole section to hit a size budget — cut prose.**
  *Case: the merge dropped "first tasks" and "executive summary"; no tasks were ever created.*

Variant (bidirectional): before the merge, each planner reads the other's plan
and appends what it missed to its own; then merge. Costs one more round; use it
when the angles are far apart.

## Step 4 — Knock-down review

The reviewer does **not** edit. It writes `review.md` with numbered findings:
`B#N — [BLOCKING|IMPORTANT|MINOR] — section/ADR — what is wrong — concrete fix`.

Hunt list (give it verbatim):
- an MVP that cannot fit the deadline;
- sections that contradict each other;
- ADRs with no real decision, or whose decision depends on an open question;
- clashes with the existing schema, vocabulary or prior plans;
- missing lifecycle / merge / version / delete cases;
- house-rule violations (DB thinness, security, stack);
- depth lost from either draft, **especially the requester's #1 quality word**;
- mockups that show buttons the phase cannot power;
- every item from `plan-acceptance-gates` that is prose instead of a gate.

## Step 5 — Dialog

The author answers every item in `dialog.md`:
`B#N — ACCEPTED | PARTIAL | REJECTED — reason`, then edits the plan.

- The author **may argue back**, but a claim like "X does not exist" or "X exists"
  needs a source (`path:line`, plan slug, doc URL) on either side.
  *Case: two review claims were factually wrong; the author proved it and the
  defended feature shipped exactly as planned.*
- Reviewers never flip a **preference** question (language, tone, visual taste)
  without evidence of what the requester wants — keep both reasons in the question.

## Step 6 — Close-out

Reviewer, resumed: reply to rebuttals (AGREE/DISAGREE), apply the smallest fix
if still open, then a **consistency pass over the whole plan** — edits create
new contradictions (*case: 5 new inconsistencies from the edits themselves*).
End with `Final verdict: YES|NO` + at most 3 residual risks, and act on each risk
(assign it, or turn it into a parallel task).

## Coordination rules

- Files, not status: every step ends with a marker (`PLAN-DONE`, `MERGE-DONE`, `REVIEW-DONE`, `DIALOG-DONE`).
- Replies capped at 3–5 lines.
- Run a mechanical format check after every edit (ADR fields, question shape).
- If the registry publish permission expires quickly, publish a v0 of the
  context early and ask for the final publish only when the final body exists.
