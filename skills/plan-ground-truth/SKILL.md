---
name: plan-ground-truth
description: Use at the very start of a large plan, before any drafting — put every primary source on disk, confirm scope, resolve unknown terms, audit the code with file:line, screenshot the current product, and probe live state (branch protection, CI time, release gates, tools, credentials). Also use when revising a plan (v2, v3): the revision re-reads the sources, not the previous version. Skip for a plan whose sources are a single short message you can quote whole.
author: SamuelStefano
tags: [planning, research, requirements, audit]
---

# Ground truth before the first line of the plan

## Overview

Every plan that went wrong in the source cases went wrong **before** drafting:
a chat summary that dropped content, a term nobody looked up, a request read
too broadly, a repo rule nobody opened. Every plan that went right started from
files on disk with `file:line` evidence.

**Core principle:** draft only from files you can re-read. Your memory, your
summary and your previous version are not sources.

## Step 1 — Put every source on disk

- Raw transcripts, chat threads, voice notes → `sources/` verbatim.
- Then write a **sectioned** context file from them (`sources/CONTEXT.md`):
  requirements, rejections, open doubts, names/terms, deadlines.
  *Case: a first chat summary of a 1h call lost several requirements; the user
  caught it. The sectioned file recovered them and both planners read it.*
- Design exports / prototypes → extract the **source** (HTML/CSS/JSON), not
  only screenshots. List which viewports the design actually covers.
  *Case: a prototype had 17 frames — 8 desktop, 9 phone, zero tablet or narrow
  desktop. The missing band shipped broken.*
- Long sessions compact. If the conversation was compacted, re-read from disk.

## Step 2 — Confirm scope before spending

- List the surfaces the request could mean (e.g. Home, Editor, Export, Mobile)
  and ask which one, with the options "decide for me" and "I'll describe it".
- "Study and decide a better UI" is not licence for a full redesign.
  *Case: a 6-agent study redesigned the editor; the requester only wanted the
  projects page. The discarded decision record later cost 5 of 21 questions
  and one of its dropped halves became a bug.*
- Show **one example** before any fan-out of agents.
- Mark superseded decision records `DISCARDED` at the top so no later plan
  reconciles with them.

## Step 3 — Coverage table

`COVERAGE.md`: every item in the sources → the plan section that covers it, or
`dropped because <reason>`. This is re-checked in the readiness review.

*Case: a plan written from the agent's own summary lost the publishing layer,
a funnel stage, a "shared across products" requirement and the outbound case.
The requester found four holes by asking "is it complete?".*

## Step 4 — Resolve every unknown term

Any product, tool or acronym you cannot define: search the code, the docs, the
web, then ask. Do not write a block around a term you did not resolve.
*Case: one unknown name turned out to be the entire publishing layer, and the
plan proposed building a sender that already existed.*

## Step 5 — Quote deciders with their strength

"Could be a path" is not "do not evaluate". "Maybe later" is not "out of scope".
Copy the exact phrase when a decision rests on it. Never turn a doubt into a
decision or a suggestion into a veto.

## Step 6 — Audit the code, and look at the product

- Parallel read-only audits by area, each claim with `path:line`. Cross-check any
  two audits that contradict each other yourself.
- Record **what already exists** so the plan reuses it ("already built — do not replan").
- **Screenshot the current UI** at the target viewports. Reading code does not
  show a header that overflows or a stage that uses 4% of the screen.
- Check whether to **integrate or buy** before listing any "build X" item.

## Step 7 — Probe live state (the things plans assume and never check)

| Probe | Why it bit |
|---|---|
| Branch protection / required reviews / code owners | Merges stalled 2h40 at the end; then "skip CI" removed the only e2e gate |
| Repo rules files (`CLAUDE.md`, `AGENTS.md`, ADRs, `.sdd/`) for release gates | A repo rule said the new mobile tree stays opt-in until device proof; the plan never read it, so phones kept the old UI |
| CI duration of the suites the plan will extend | Mobile e2e reached 45–50 min/PR and people started ignoring it |
| Tools/MCPs/credentials the plan needs, and who owns them | A diagram tool was disconnected; a DNS token lived in a personal vault |
| Deploy topology (what branch deploys, restart behavior, caches) | A merged feature did not appear because the server restarts only when idle |
| Protections the design relies on (RLS, rulesets, CODEOWNERS) via API | Twice assumed enabled, twice found off |
| Existing plans/ADRs on the same topic | Avoids a third vocabulary; lets the author refute wrong review claims |

## Step 8 — Declare what you did not read

Plan header: `Not read: <board X — no access>, <repo Y — not cloned>`. A gap
you name gets filled; a gap you guess becomes a bug.

## Revisions (v2, v3…)

Re-run steps 3 and 7 against the **sources**, then list "changed since vN".
*Case: a requirement present in v1 evaporated in the v2 rewrite because v2 was
written from v1.* Re-read live state right before publishing — PRs merge while
you plan.
