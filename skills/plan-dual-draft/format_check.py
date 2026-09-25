#!/usr/bin/env python3
"""Mechanical format check for a plan body. Usage: python3 format_check.py PLAN.md

Prints one line per finding and exits 1 when there is any; prints "ok" and exits 0 otherwise.
Checks: ADR fields, question fields, headings after "Out of scope", ADR-N / Q-N referenced
but never defined or used before being defined, and the sentinel line when the file is a draft.
"""
import re
import sys

# Each field lists accepted spellings (English first). Add your plan tracker's own.
ADR_FIELDS = {
    "Context": ("Context", "Contexto"),
    "Decision": ("Decision", "Decisão", "Decisao"),
    "Alternatives": ("Alternatives", "Alternativas"),
    "Consequence": ("Consequence", "Consequences", "Consequência", "Consequencias"),
}
Q_FIELDS = {
    "A.": ("A.", "A)", "A:"),
    "B.": ("B.", "B)", "B:"),
    "Recommended:": ("Recommended", "Recomendada", "Recomendado"),
    "Blocks:": ("Blocks", "Bloqueia"),
    "Decider:": ("Decider", "Decisor", "Quem decide"),
}


def has_field(body, names):
    return any(re.search(r"\*\*" + re.escape(n), body, re.I) for n in names)


def blocks(lines, prefix):
    """Yield (line_no, header, body) for every '### <prefix>N' block."""
    starts = [i for i, l in enumerate(lines) if re.match(rf"^###\s+{prefix}\d+\b", l)]
    for n, s in enumerate(starts):
        end = len(lines)
        for j in range(s + 1, len(lines)):
            if re.match(r"^#{1,3}\s", lines[j]):
                end = j
                break
        yield s + 1, lines[s].strip(), "\n".join(lines[s:end])


def main(path):
    text = open(path, encoding="utf-8").read()
    lines = text.splitlines()
    findings = []

    for ln, head, body in blocks(lines, "ADR-"):
        for f, names in ADR_FIELDS.items():
            if not has_field(body, names):
                findings.append(f"line {ln}: {head[:60]} — missing **{f}**")

    for ln, head, body in blocks(lines, "Q-"):
        for f, names in Q_FIELDS.items():
            if not has_field(body, names):
                findings.append(f"line {ln}: {head[:60]} — missing **{f}")

    oos = next((i for i, l in enumerate(lines) if re.match(r"^##\s+.*out of scope", l, re.I)), None)
    if oos is not None:
        for i in range(oos + 1, len(lines)):
            if re.match(r"^##\s", lines[i]) and not re.search(r"appendix|anexo|changelog", lines[i], re.I):
                findings.append(f"line {i + 1}: heading after 'Out of scope': {lines[i].strip()[:60]}")

    defined = {}
    for i, l in enumerate(lines):
        m = re.match(r"^###\s+((?:ADR|Q)-\d+)\b", l)
        if m:
            defined.setdefault(m.group(1), i)
    for i, l in enumerate(lines):
        for ref in set(re.findall(r"\b((?:ADR|Q)-\d+)\b", l)):
            if ref not in defined:
                findings.append(f"line {i + 1}: {ref} referenced, never defined")
                defined[ref] = -1  # report once

    if re.search(r"plan-[AB]\.md|plan-merged\.md", path) and "-DONE -->" not in (lines[-1] if lines else ""):
        findings.append("last line: sentinel <!-- …-DONE --> missing")

    for f in findings:
        print(f)
    if not findings:
        print("ok")
    return 1 if findings else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
