# Mechanical format check (run after every edit)

```bash
python3 format_check.py plan-merged.md   # or PLAN.md
```

It prints one line per finding and exits 1, or prints `ok`. It checks:

1. Every `### ADR-N` block has **Context**, **Decision**, **Alternatives**, **Consequence**.
2. Every `### Q-N` block has **A.**/**A)**, **B.**/**B)**, **Recommended:**, **Blocks:**, **Decider:**.
3. No heading of any level after "Out of scope" (appendix/changelog excepted).
4. Every `ADR-N` / `Q-N` referenced is defined somewhere.
6. `warn:` lines (do not fail): an `ADR-N` / `Q-N` used before its definition, outside the provenance/summary section. Read each one: a forward pointer to an ADR list at the end is fine; a scope block that depends on something defined later is a structure bug.
5. Draft files (`plan-A/B/merged.md`) end with their `<!-- …-DONE -->` sentinel.

Plans written before `QUESTION.md` existed fail on **Blocks** / **Decider**: add the two fields, do not loosen the script.

Adjust the field names at the top of the script if your plan tracker parses a
different ADR shape. Any finding blocks the draft verdict and readiness.
