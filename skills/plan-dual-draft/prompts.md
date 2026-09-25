# Prompts (copy, then fill the brackets)

## Planner A

Read `<dir>/BRIEF.md` and everything it lists. Write `<dir>/plan-A.md`.
Your angle: ARCHITECTURE and COLLABORATION first — data model, integration with
<existing system>, versioning, permissions, phased MVP by <date>.
Still cover every section of the brief. Do NOT read `plan-B.md`.
End the file with `<!-- PLAN-DONE -->`. Reply in 5 lines: your 5 most confident decisions.

## Planner B

Same, file `plan-B.md`. Your angle: EXPERIENCE and VISUAL first — concrete
screens per band, states, performance at <N> items, keyboard/touch, how <hard
interaction> LOOKS. Still cover every section. Do NOT read `plan-A.md`.

## Planner B, no-UI plans (pipelines, webhooks, data)

Same, file `plan-B.md`. Your angle: CONSUMER and OPERATIONS first — the consumer
table (`plan-acceptance-gates/non-ui-gates.md` §1), triggers and senders, failure
modes, retries, secrets, test vs prod routing, observability. Still cover every
section. Do NOT read `plan-A.md`.

## Single planner (small plans)

Planner A prompt, with "cover BOTH angles: architecture/data AND
experience/visual". Then go straight to the knock-down review with a second agent.

## Cross-read (optional flow, to both, resumed)

Read the other planner's plan. Append to YOUR plan, under "Adopted from <X>",
everything it covers that yours lacks. Do not change any decision you already
made — disagreements stay visible. End with `<!-- CROSS-DONE -->`. Reply in 3 lines.

## Merge (to A, resumed)

Read `plan-B.md` (and `diffs.md`). Write `plan-merged.md`.
- Where A and B differ, pick ONE and record an ADR; the loser goes under Alternatives. Every line of `diffs.md` ends as an ADR.
- Keep B's depth on <screens/visuals>; keep A's depth on <data/merge>.
- MVP must be realistic for <date>.
- ≤ 60 KB: cut prose, NEVER drop a whole section (keep "first tasks").
- Top section: "What came from where (A/B)".
End with `<!-- MERGE-DONE -->`. Reply in 5 lines.

## Knock-down review (to B, resumed; reused in readiness for phases 3–4)

Read `plan-merged.md`. Try to KNOCK IT DOWN. Do not edit it.
Write `review.md`: `B#N — BLOCKING|IMPORTANT|MINOR — section/ADR — what is wrong — concrete fix`.
Hunt for:
- an MVP that cannot fit the deadline; the requester's #1 quality word missing from the floor;
- contradictions between sections; ADRs with no real decision or depending on an open question;
- clashes with <schema / prior plan / vocabulary>;
- missing lifecycle cases (create, update, move, delete, rotate, merge, version);
- house-rule violations (DB thinness, security, stack);
- depth lost from EITHER draft;
- mockups showing actions the phase cannot power; "keep X" with no `path:line`;
- acceptance written as prose instead of a check on the running build;
- any flag without a flip PR; any shared artifact without an owner PR; any unknown limit not measured;
- any output without a named human consumer and the place they look;
- any decision the planner answered that belongs to someone else.
Claims that something exists / does not exist need a source.
End with `<!-- REVIEW-DONE -->`. Reply: counts per severity.

## Apply review (to A)

Answer every item in `dialog.md`: `B#N — ACCEPTED|PARTIAL|REJECTED — reason`.
Edit the plan for accepted/partial. If you disagree, write an argued rebuttal
with a source. End with `<!-- DIALOG-DONE -->`.

## Close-out (to B)

Read `dialog.md`. For each rebuttal: `B-reply — AGREE|DISAGREE — why`.
Apply the smallest fix if still open. Consistency pass over the WHOLE plan; run
`format-check.md`. Cross-read flow only: propose at most one "more detail" round,
limited to sections an executor could not implement without guessing.
End with `Draft verdict: YES|NO` + at most 3 residual risks.
