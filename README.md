# DFL Skills (public)

`npx skills add devfellowship/skills`

A curated, public set of generic DFL skills. Internal/ops skills live in the private `devfellowship/internal-skills` registry.

## Security model

The `audit` gate in `scripts/ingest.ts` scans every file in a skill folder for
high-risk injection / secret / exfil patterns. **Read it honestly:**

- The **content audit is best-effort defense-in-depth, NOT a security
  boundary.** A regex/keyword scanner is fundamentally bypassable — an adversary
  can reword the instruction in prose, encode it (base64 under the size
  threshold, hex, zero-width joiners, homoglyphs), or hide the payload in a
  sibling file that `SKILL.md` loads at runtime. A clean audit means "no obvious
  bad shape", never "safe".
- The **structural checks are enforceable** and carry no false-positive risk:
  the walker refuses to follow symlinks and caps file size / recursion depth /
  file count (DoS/traversal guards on the CI runner), filenames are scanned for
  bidi/RTLO control chars (an RTLO name disguises `evil<RLO>gpj.exe` as
  `evilexe.jpg`), and reserved-name checks are NFKC-normalized + trimmed +
  token-aware (so `"admin "`, Cyrillic `аdmin`, and `claude-helper` are all
  flagged).

**Real enforcement needs three org-admin settings that code alone cannot set:**

1. The `audit` job configured as a **required status check** on the branch
   ruleset — a red check is cosmetic if it does not block merge.
2. `require_code_owner_review: true` so `CODEOWNERS` actually blocks merges
   (present-but-unenforced today is inert).
3. The `skip-skill-audit` label and `bypass_actors` restricted to a **minimal
   trusted set** — a broad bypass team defeats the gate.

A future step (not implemented here) is an **LLM-based semantic review**: it can
reason about intent that a regex cannot, giving real detection quality. Until
then, treat audit findings as "needs human eyes", and rely on the three
governance settings above — not the scanner — as the actual boundary.
