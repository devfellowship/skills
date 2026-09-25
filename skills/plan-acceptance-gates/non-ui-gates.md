# Gates for pipelines, webhooks, notifications, data and integrations

From a design→dev pipeline that worked end to end and that its consumer still
reported as broken three times, plus a skills registry and an analytics schema.

## 1. Model the human consumer

For every output (card, message, email, report, row someone reads):

| Output | Consumer (role, not only person) | Where they look: app · view · default filter · sort · channel · project | How it lands there | Verified as them? |
|---|---|---|---|---|

- Ask the consumer where they look; do not infer. *(Cards went to a test board and
  an admin channel; the designer watched another board.)*
- For machine-created items, state where they land in each view. Defaults must
  make them visible. *(New cards got priority 0 in a list sorted by priority, 19 deep.)*
- Notifications link the queue, not only the item. *(The default view showed 3 of 24 cards.)*
- Dry-run the consumer's first action on their own machine and credentials
  (install, login, file-name case on their OS).
- Plan for the consumer leaving: role over person, a runbook, a handover.

## 2. Triggers and senders

- Derive the trigger from domain state ("when does the consumer need to know?"),
  not from the handiest event. *(A PR-based trigger missed work done before any PR existed.)*
- A table of outputs with **exactly one sender** each. Adding a sender retires the
  old one in the same PR. *(Two senders → every message twice.)*
- One no-duplicates key across every creation path (webhook, agent, human, MCP).
- Re-delivery of the same event creates nothing new — one test.
- Retry and dead-letter behavior stated for each consumer of an event.
- Write the coverage contract (what triggers, preconditions, fallback) in the doc
  users read. *(An agent's own 8 PRs got no card and nobody knew why.)*
- For each rule, say where it is enforced and which paths bypass it.

## 3. Test vs production routing

- Separate by configuration, not intent: which board/channel/project in test and in prod.
- Test items: marked, never in a consumer's queue, with a named cleanup.
- A destination the decider chose (board, channel, project) is never swapped for a
  test one silently. A swap is an open correction in `EXECUTION-LOG.md` with a
  revert date, and the decider is told the same day. *(The lead picked one board;
  the agent shipped to its own test board; nobody compared them for six weeks.)*
- Promotion from test to prod is a PR row with an owner; a known consumer-facing
  defect blocks expanding to more repos or users.

## 4. Secrets and access — one table

| Secret | Store path | Issuer | Minimal scope | Expiry | Sync / deploy | Other readers of the same key |
|---|---|---|---|---|---|---|

- Nothing set by hand outside the secret manager. *(A hand-set secret drifted and 3 webhooks returned 401 silently.)*
- Check key names shared across functions/apps before declaring one. *(One name would have overwritten the token of 23 apps.)*
- Order fail-closed dependencies: create secret → declare → merge.
- Any grant to an anonymous or public role carries a threat line: who can call
  it, what they can write, why that is safe. *(A write function was granted to
  anyone holding the public key.)*

## 5. Data lifecycle

- Create / update / move / delete / rotate designed for every entity. *(An
  upsert-only publisher left orphan public rows.)*
- Backfill: items that existed before launch get processed, or the plan says why not.
- Migrations: rollback, or declared irreversible with an approver.
- Removing a capability is its own approval item, never bundled into a fix PR or
  covered by a blanket merge approval; announce it to the consumer. *(A fix PR
  deleted the whole creation path; 16-day outage nobody approved.)*

## 6. Done

- Read the reply body and the real destination, not a success log.
- After any change, re-run the **whole** human scenario end to end, not only the part touched.
