# EXECUTOR BRIEF — <agent / PR rows>

- **Scope:** PLAN.md §<refs>, ADR-<n>, PR rows <n>. Nothing else.
- **Re-read** the live PLAN.md and ADRs before starting and before each PR.
- **Output:** open a PR. Do NOT merge. Merger: <name>.
- **Tests:** never delete or weaken an assertion of code you did not change.
- **Verify with:** <path to e2e runner>, <screenshot script>, <device recipe>. If a tool fails, report it as a blocker; never skip the check.
- **Done when:** <copied from the PR row>, with evidence (screenshot / row id / URL) in the PR body.
- **No dead controls:** every rendered button works.
- **Budget:** max <n> heavy processes; e2e runs <where>.
- **Coordination:** commit WIP early; write `<!-- DONE PR n -->` to EXECUTION-LOG.md when finished.
