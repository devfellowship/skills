# Prompts (copy, then fill the brackets)

## Planner A

Read `<dir>/BRIEF.md` and everything it lists. Write `<dir>/plan-A.md`.
Your angle: ARCHITECTURE and COLLABORATION first — data model, integration with
<existing system>, merge/versioning, permissions, phased MVP by <date>.
Still cover every section of the brief. Do NOT read `plan-B.md`.
End the file with `<!-- PLAN-DONE -->`. Reply in 5 lines: your 5 most confident decisions.

## Planner B

Same, file `plan-B.md`. Your angle: EXPERIENCE and VISUAL first — concrete
screens per viewport band, states, performance at <N> items, keyboard/touch,
how <hard interaction> LOOKS. Still cover every section. Do NOT read `plan-A.md`.

## Merge (to A, resumed)

Read `plan-B.md`. Write `plan-merged.md`.
- Where A and B differ, pick ONE and record an ADR; the loser goes under Alternatives.
- Keep B's depth on <screens/visuals>; keep A's depth on <data/merge>.
- MVP must be realistic for <date>.
- Size budget <N> KB: cut prose, NEVER drop a whole section (keep "first tasks").
- Top section: "What came from where (A/B)".
End with `<!-- MERGE-DONE -->`. Reply in 5 lines.

## Knock-down review (to B, resumed)

Read `plan-merged.md`. Try to KNOCK IT DOWN. Do not edit it.
Write `review.md`: `B#N — BLOCKING|IMPORTANT|MINOR — section/ADR — what is wrong — concrete fix`.
Hunt for: impossible MVP; contradictions between sections; ADRs with no real
decision; clashes with <schema/prior plan>; missing lifecycle/merge/version/delete
cases; house-rule violations; depth lost from plan-B, especially "<#1 quality word>";
mockups showing actions the phase cannot power; any acceptance written as prose
instead of a check on the running app; any flag without a flip PR; any shared
component without an owner PR; any unknown limit not measured.
Claims that something exists / does not exist need a source.
End with `<!-- REVIEW-DONE -->`. Reply: counts per severity.

## Apply review (to A)

Answer every item in `dialog.md`: `B#N — ACCEPTED|PARTIAL|REJECTED — reason`.
Edit the plan for accepted/partial. If you disagree, write an argued rebuttal
with a source. End with `<!-- DIALOG-DONE -->`.

## Close-out (to B)

Read `dialog.md`. For each rebuttal: `B-reply — AGREE|DISAGREE — why`.
Apply the smallest fix if still open. Then do a consistency pass over the WHOLE
plan (edits create new contradictions) and fix what you find.
End with `Final verdict: YES|NO` + at most 3 residual risks.
