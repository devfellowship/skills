---
name: plan-acceptance-gates
description: Use when writing the acceptance criteria, rollout and risk sections of a large plan — turns every prose promise into a gate that fires: checks on the running build, a viewport × input × content matrix, a default-path and flag-exit rule, shared-state isolation, the human who must see the result, measured limits and real-device proof. Use it on a finished draft too, as the checklist a reviewer attacks. Skip for backend-only refactors with no users, flags or limits involved.
author: SamuelStefano
tags: [planning, acceptance-criteria, testing, rollout, mobile, responsive]
---

# Acceptance gates that fire

## Overview

In the source cases, **code rules with a test survived; prose rules, human
ceremonies and isolation claims did not.** "No text overlap", "44 px targets",
"desktop untouched", "measure the upload limit", "test on a real iPhone",
"remove the flag at the end" — each was written, each was skipped, each became
a bug.

**Core principle:** if a criterion cannot fail on its own, it is a wish. Give
every criterion a place where it fails: a test, a CI check, a screenshot a named
person approves, or a PR in the task list.

## 1. "Done" means observed running

Every phase's acceptance includes:
- the **production build** opened in a real browser, **zero console errors**,
  screenshot attached (not dev server, not unit tests);
- the URL / command that shows it, and on which tree real users get.

*Case: unit tests and build were green while the live canvas was blank — the
layout library crashed only in the production bundle. Nobody opened it.*

## 2. Default path and flags

Answer in the plan: **what does a fresh user, empty storage, default settings,
see now and after each phase?**

Every flag, opt-in, `?param`, second component tree or fallback branch needs:
owner · date · metric/telemetry · exit criterion · **the flip PR in the task list**.
- Never build the next version on top of an unshipped flag.
- Internal fallbacks count ("if X missing, render legacy").

*Case: 30 PRs of a new mobile UI and a later redesign were all built behind an
opt-in flag. "Delete the flag at the end" was one sentence with no PR. Phones
in production kept the old UI mixed with new shared tokens.*

## 3. Viewport × input × content matrix

One row per band; each row has a design frame, a rule, or "out of scope + what
the user sees". **A missing row is a blocker.**

| Band | Example | Input |
|---|---|---|
| Phone small / std / large | 360, 390, 430 portrait | touch |
| Phone landscape | 844×390 | touch |
| Tablet / narrow desktop | 768–1023 | touch **and** mouse |
| Laptop | 1280×720, 1440×900 | mouse |
| Desktop window resized narrow | 390 wide, mouse | mouse |

- Map the app's **mode-selection logic** (UA, pointer, width, stored choice) onto
  the table. *Case: the UI tree was chosen per tab by pointer type and cached;
  a desktop window at 390 px got the desktop grid and broke.*
- **Content stress**: longest real title, largest count, empty state, 0 items.
  Say which control drops first at the smallest width. *Case: a short mock title
  hid a header overflow; a real title covered undo/redo/export.*
- Clamp every fixed design dimension for the smallest band (*a fixed 1040×760
  modal overflowed a 768 px laptop*).
- Turn every prose UI rule into an assertion per screen: touch ≥ 44 px, no
  overlap, nothing clipped, focus visible.
- Give the reviewer a recipe to see each band from a laptop (`?ui=mobile`, fresh tab).

## 4. Shared state isolation

"Desktop is untouched" / "only mobile changes" must list the **shared state**, not
just code paths: DB rows and settings, shared stores, service worker, manifest,
CSP, global CSS/tokens, caches, feature flags, analytics.
- A UI surface never writes persisted settings on open or on defaults.
  Test: "open + cancel = no DB change". *Case: a mobile export sheet silently
  enabled a watermark for the whole project, desktop included.*
- Cross-cutting invariants get one named test in the **shared** layer ("an
  unsaved take is never dropped"), not a sentence in one screen's section.
- A service worker is a whole-origin change: plan update flow, stale tabs, desktop.

## 5. The human who must see it

For any output a person consumes (notification, card, email, report, dashboard):
**acceptance = "person P sees Y in place Z, once"**. Name where P actually looks.
- Exactly one sender per notification; say which component sends and which must not.
- Test data vs production routing is explicit: which board/channel/project in each.
- Default ordering/priority puts new items where P will see them.

*Case: a pipeline worked end to end — the card was created, the message sent —
but into a test board and channel the designer never opened, at the bottom of a
priority-sorted list. He reported it as broken.*

## 6. Unknowns become Phase-0 measurements

Any "limit unknown", "API shape unknown", "duration unknown" is a **time-boxed
spike with a yes/no branch** before dependent work, and the number goes into the plan.
- No schema before the raw API response is pasted in the plan.
- Check every constraint against measured durations (*"deliver in 5 min" vs a
  5–8 min export*).

*Case: "request body limit unknown — measure with 50/100/200 MB" was a risk row;
nobody measured; long uploads failed in production.*

## 7. Tests are part of acceptance

- Test preservation from minute zero: removing or weakening an assertion needs
  the intended behavior change named in the PR. *Case: an agent deleted tests of
  code it did not change; that hid a bug.*
- A static selector audit is not e2e. Run the real suite at least once per UI tree.
- Map each stakeholder answer to the specs it breaks (a debug-only badge broke 2 specs).
- Budget e2e: max minutes per PR, sharding, path filters **including shared
  components**, a flake policy, settle helpers for animations.
- Async device/permission actions: latest wins, acquire before release, a failure
  never tears down working state.
- Sheets/dialogs: focus enters, is trapped, returns to the opener.

## 8. Human gates are scheduled, not hoped for

Real-device proof, design sign-off, secrets, approvals: named person + date,
scheduled **on day 1**, and they **block the default flip**. Emulator tests cannot
close a device criterion. Agents execute a week of PRs in a day — a gate "at the
end of phase 3" never happens.
