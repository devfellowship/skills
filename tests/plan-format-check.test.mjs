import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const script = fileURLToPath(new URL("../skills/plan-dual-draft/format_check.py", import.meta.url));

function check(body, name = "PLAN.md") {
	const dir = mkdtempSync(join(tmpdir(), "plan-format-"));
	try {
		const file = join(dir, name);
		writeFileSync(file, body);
		const r = spawnSync("python3", [script, file], { encoding: "utf8" });
		return { code: r.status, out: r.stdout };
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

const good = `## Decisions
### ADR-1 — Pick X
**Context:** c
**Decision:** d
**Alternatives:** a
**Consequence:** q

### Q-1 — Which?
- **A.** a
- **B)** b
- **Recommended:** A
- **Blocks:** PR 2
- **Decider:** lead

See ADR-1 and Q-1.
## Out of scope
- nothing
## Appendix
`;

test("a well-formed plan passes", () => {
	const r = check(good);
	assert.equal(r.code, 0, r.out);
	assert.equal(r.out.trim(), "ok");
});

test("an ADR without a Decision field is a finding", () => {
	const r = check(good.replace("**Decision:** d\n", ""));
	assert.equal(r.code, 1);
	assert.match(r.out, /ADR-1 .*missing \*\*Decision/);
});

test("a question without a decider is a finding", () => {
	const r = check(good.replace("- **Decider:** lead\n", ""));
	assert.equal(r.code, 1);
	assert.match(r.out, /Q-1 .*missing \*\*Decider/);
});

test("scope after Out of scope is a finding, an appendix is not", () => {
	const r = check(`${good}## Rollout\n`);
	assert.equal(r.code, 1);
	assert.match(r.out, /heading after 'Out of scope': ## Rollout/);
});

test("a reference to an undefined ADR is a finding", () => {
	const r = check(`${good}\nDepends on ADR-9.\n`);
	assert.equal(r.code, 1);
	assert.match(r.out, /ADR-9 referenced, never defined/);
});

test("Portuguese field names are accepted", () => {
	const pt = good
		.replace("**Context:**", "**Contexto:**")
		.replace("**Decision:**", "**Decisão:**")
		.replace("**Alternatives:**", "**Alternativas:**")
		.replace("**Consequence:**", "**Consequência:**")
		.replace("**Recommended:**", "**Recomendada:**");
	assert.equal(check(pt).code, 0);
});

test("a draft file without its sentinel is a finding", () => {
	const r = check(good, "plan-merged.md");
	assert.equal(r.code, 1);
	assert.match(r.out, /sentinel/);
	assert.equal(check(`${good}<!-- MERGE-DONE -->\n`, "plan-merged.md").code, 0);
});
