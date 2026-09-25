---
name: plan-execution-handoff
description: Use when a large plan is about to be executed by agents or people — writing executor briefs by section reference, setting the merge policy, the verification tools, the resource budget, and the definition of done (seen running on the tree real users get). Also use when resuming execution after a crash or handoff. Skip for executing a one-PR plan yourself.
author: SamuelStefano
tags: [planning, execution, multi-agent, handoff, verification]
---

# From plan to shipped

## Overview

Good plans still shipped bugs at the handoff: a builder merged its own PR 84
seconds after opening it and deleted the branch the deploy pointed at; "Playwright
unavailable" was accepted while it was installed next door; three sessions
resumed the same handoff; a plan was marked done four hours before the requester
found three bugs on a phone.

**Core principle:** the executor brief carries the gates, not just the tasks.

## Executor brief (one per agent)

- **Scope by section reference**: "implement §2.1–2.2, §11 floor items a–c, ADRs 3, 7, 9". Two executors that share only a file-format section can work in parallel.
- **"Open a PR. Do NOT merge."** Deploys track `main` only.
- **Re-read the live plan and its ADRs before starting and before each PR.** *Case: a follow-up PR contradicted ADRs added after the executor's snapshot; it was closed with zero credit.*
- **Tests**: never delete or weaken an assertion of code you did not change; name the behavior change when you do.
- **Verification tools by path** (`<path>/node_modules/.bin/playwright`, the screenshot script, the device recipe). "Unavailable" is not a reason to skip; it is a blocker to report.
- **No dead controls**: every visible button works or is not rendered.
- **Resource budget**: max parallel heavy agents, where e2e and screenshots run, RAM limit. A step the brief forbids cannot be in the plan's acceptance.
- **Commit WIP early**, one worktree per agent, a `.gitignore` committed before any agent starts.
- **Coordinate through files** with done-markers; one named owner session per handoff.

## Merge policy

- Independent reviewer per PR before merge (post-merge review fixes cost extra PRs every time).
- UI PRs are reviewed with a screenshot of the built app, not only the diff.
- If a required suite is skipped ("merge with admin"), name what replaces it — e.g. one full e2e run on the chained tip.
- A red covering suite blocks the stack; fix specs in the same PR that changes the UI.

## Definition of done

- Production build, on the **default** path real users get, screenshot per viewport band.
- For outputs people consume: the named person saw it in their place.
- Deploys follow a runbook: DNS → verify it resolves → domain/certificate → deploy `main` → verify HTTPS 200. *Case: a domain created before its DNS record failed certificate issuance and the proxy never retried.*
- Plan status moves to done only after the above, with the evidence linked.

## After shipping

Write a short retro: symptom → cost → rule → which skill owns the rule. Feed it
back into this pack. The fastest, cleanest plan in the source cases was fed by
retros already written that way.
