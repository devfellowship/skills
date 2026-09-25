---
name: plan-readiness-review
description: Use right before publishing or handing off a large plan — a mechanical checklist that blocks publishing while any finding is unowned, any decision is answered by the planner instead of its owner, any section is used before it is defined, or the body mixes decisions with execution logs. Also use for each revision (v2, v3). Skip for chat-only sketches that will not be executed.
author: SamuelStefano
tags: [planning, review, checklist, decisions]
---

# Readiness review — publish only when this passes

## Overview

Plans in the source cases were published under time pressure (a publish
permission about to expire), four times in one hour, to a registry with no
delete. Their holes were structural and checkable: a section cited before it was
defined, production scope printed after "out of scope", option labels written
from memory, review findings reduced to one sentence.

**Core principle:** readiness is a checklist, not a feeling. Run every line; a
single "no" blocks publishing.

## Checklist

**Coverage**
- [ ] `COVERAGE.md` has no source item without a section or a `dropped because`.
- [ ] Every review finding ID appears in the coverage matrix as a PR row, a question, or "won't do + consequence".
- [ ] The requester's #1 quality word is inside the MVP floor.

**Decisions**
- [ ] Every decision owned by someone else is a **posted question**, not an answer in the body: A/B/C, `Recommended`, why, and "blocks PR N".
- [ ] The option space is complete (include the decider's likely view; a missing option gets "other" as the answer).
- [ ] Option labels were read back from the registry after posting, not retyped.
- [ ] No preference question was flipped by a reviewer without evidence.
- [ ] Every user answer that overrides an ADR has already been applied to the body.
- [ ] One representation per decision (question **or** body section, linked — not two copies that drift).

**Gates** (from `plan-acceptance-gates`)
- [ ] Every flag has a flip PR, owner, date, exit.
- [ ] Every UI phase has viewport rows and "production build opened, zero console errors, screenshot".
- [ ] Every unknown limit is a Phase-0 measurement.
- [ ] Every human gate has a name and a date, scheduled first.
- [ ] Every output consumed by a person names who sees it and where.

**Structure**
- [ ] Nothing is referenced before it is defined.
- [ ] Nothing in scope appears after "Out of scope".
- [ ] Every block has **done when** (observable live) · **depends on** · **owner**.
- [ ] Format passes a mechanical check (ADR fields present, question shape).
- [ ] Header lists sources **not** read.

**Hygiene**
- [ ] Body = decisions + criteria. Progress, journals and reviewer names go to `EXECUTION-LOG.md` or the task tracker. *Case: a plan grew from 43 KB to 184 KB of logs and stopped being usable; the TL said "I don't know what's going on anymore".*
- [ ] Live state re-read right before publishing (PRs merged during planning).
- [ ] Visibility and audience match the decider (not "personal" when a lead must answer).
- [ ] Nothing personal or secret in a shared plan.
- [ ] A "first tasks" section exists and tasks are created and linked to the plan.

## Publishing

- Draft and review locally. Open the publish window only for the final body.
- After publishing, read the plan back through the registry API and confirm
  owner, extracted decisions and question count.

## Revision protocol

For each new version: re-run the coverage table against the **sources**, list
"changed since vN", reconcile task statuses before rewriting, and turn every
answered question into a task the same day.
