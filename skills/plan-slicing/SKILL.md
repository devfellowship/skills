---
name: plan-slicing
description: Use when turning a large plan into PRs that several agents or people will build in parallel — assigns one owner PR per shared artifact, predicts file and behavior conflicts, adds sweep PRs for "everywhere" decisions, forbids temporarily unreachable features, and writes the merge and deploy order. Skip for a plan that is a single PR.
author: SamuelStefano
tags: [planning, pull-requests, parallel-work, architecture]
---

# Slicing a plan into PRs

## Overview

Parallel PRs from the same base each quietly build their own copy of shared
pieces, change a shared hook in two incompatible ways, or remove an entry point
"until the next PR". In one redesign, 12 planned PRs became 16, a post-merge
audit found about 10 gaps, and three separate copies of the same list shipped.

**Core principle:** every shared thing has exactly one owner PR, and every PR
leaves the product fully usable.

## 1. Inventory shared artifacts first

Before cutting PRs, list everything more than one PR will touch: components,
hooks, stores, design tokens, routes, settings keys, test fixtures, CI config.
Each gets **one owner PR**; the others depend on it.

## 2. Cross-tree acceptance

When a PR changes a component another tree/platform also renders, its
acceptance includes **that tree's rules** (permissions, recording guards, touch
targets). *Case: reusing a desktop list on mobile dropped the mobile permission
and recording guards — 6 blockers in one PR.*

## 3. "Everywhere" decisions get a sweep PR

"One style everywhere", "rename X", "replace component Y": a dedicated PR whose
acceptance is a grep count (`0 imports of OldToggle`).

## 4. Never temporarily unreachable

No slice removes an entry point before its replacement lands in the same or an
earlier PR. *Case: a theme picker and a review tab were unreachable in
production between stacked PRs.*

## 5. Conflict map

| Column | Example |
|---|---|
| Files touched per PR | `useHotkey.ts` in PR 6 and PR 7 |
| Shared handler / behavior | hotkey table with a "shared handler" column |
| Resolution | serialize, or name who resolves |

Add tests that shortcuts do not fire mid-recording, inside text fields, or in
menus. *Case: one shortcut both recorded and inserted a shape.*

## 6. Blast radius of shared modules

When a shared component gains an import with side effects (a DB client, env
access, a heavy library), list every test that renders it, or lazy-load. *Case:
a module-level client import broke unrelated test files three times.*

## 7. Order and gates

- Write the merge order and the deploy order across repos ("schema before API
  before UI", "API must deploy before the site or it lists 0 items").
- Name who approves each PR (probe branch protection first).
- Keep a lifecycle column: create / update / move / delete / rotate for each
  entity. *Case: a publish pipeline only upserted; moved items left orphan public rows.*
- Classify each output artifact: public / internal / personal. *Case: internal
  items were published to a public registry.*
- Anything a root/router must call (a pack, a plugin list, a registry) needs the
  root to **name** the member. Listing is not wiring.

## 8. Run the coverage audit on the chained tip

Before merging the stack, check out all PRs chained together and run the plan's
coverage matrix plus the full test suite on that tip — not after merge.
