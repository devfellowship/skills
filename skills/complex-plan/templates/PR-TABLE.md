# PR table — lives as the `## Tasks` section of PLAN.md; each row becomes one tracker task

| PR | Scope (§ refs + ADRs) | Owns shared artifacts | Depends on | Files touched | Done when (observed live) | Reviewer / merger | Blocked by | Lifecycle |
|---|---|---|---|---|---|---|---|---|
| 1 | §2.1, ADR-3 | `tokens.css`, `useHotkey` | — | `src/index.css`, `src/hooks/useHotkey.ts` | prod build at 390/1280, 0 console errors, screenshots | agent R / human M | Q-2 | C U |
| 9 | §6 flip default | flag `ui.v2` (removal) | 1–8, device gate | `useUiVersion.ts` | fresh phone, empty storage, gets v2 | human M | device test (name, date) | D |

Columns:
- **Owns shared artifacts** — every component/hook/store/token/setting touched by 2+ rows has exactly one owner row.
- **Done when** — observable on the running product, never "tests pass".
- **Lifecycle** — which of Create / Update / Move / Delete / Rotate this row covers for its entities.

## Conflict map

| File / behavior | Rows | Resolution (serialize / resolver) |
|---|---|---|
| `useHotkey.ts` shared handler | 6, 7 | serialize 6 → 7 |

## Merge and deploy order

1. schema → 2. API deploy → 3. site (else it lists 0 items) → …
