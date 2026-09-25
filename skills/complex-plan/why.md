# Why this pack exists

Distilled from seven large plans — a capability-graph app, a mobile version of a
video editor, a UI redesign of the same editor, a design→dev notification
pipeline, a skills marketplace, a content-analytics schema, a revenue funnel —
and every bug that came after them.

- **Facts about code were almost always right.** Audits with `path:line` held up;
  no bug traced back to a wrong audit fact.
- **What broke was every gate written as prose.** Rollout, real-device checks,
  measured limits, CI cost, shared-state isolation, "the person actually sees
  it". When agents executed 30 PRs in 3 days, every gate that was not an
  automated check or a PR row was silently skipped.
- **Review findings were found and then lost.** Reviewers flagged the two worst
  bugs of the redesign, one of them word for word; the plan turned them into a
  sentence with no PR.
- **A pipeline worked and nobody saw it.** Cards were created and messages sent —
  into a test board and an admin channel the designer never opened, at the
  bottom of a priority-sorted list. He reported it as broken three times.
- **The best plan came from two blind planners + an adversarial review + a
  dialog where the author could argue back.** 22 minutes, 20 decisions, 26
  findings applied; the builder loaded real content with zero parse warnings —
  and it **still shipped a blank canvas**, because acceptance never required
  opening the production build.

The pack turns each of those into a gate with a place where it fails.
