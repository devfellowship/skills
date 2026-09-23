import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const script = fileURLToPath(new URL("../scripts/codeowners.ts", import.meta.url));
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

function workspace(skills) {
	const root = mkdtempSync(join(tmpdir(), "dfl-skills-codeowners-"));
	for (const [slug, frontmatter] of Object.entries(skills)) {
		mkdirSync(join(root, "skills", slug), { recursive: true });
		writeFileSync(join(root, "skills", slug, "SKILL.md"), `---\nname: ${slug}\ndescription: test\n${frontmatter}---\nbody\n`);
	}
	return root;
}

function run(cwd, mode) {
	return spawnSync("bun", [script, mode], { cwd, encoding: "utf8" });
}

test("an author owns its skill together with core; no author and the org fall to core", () => {
	const root = workspace({
		alpha: "author: taigfs\n",
		beta: "metadata:\n  author: gabi-gasparini\n",
		gamma: "author: devfellowship\n",
		delta: "",
	});
	try {
		assert.equal(run(root, "--write").status, 0);
		const rules = readFileSync(join(root, ".github", "CODEOWNERS"), "utf8")
			.split("\n")
			.filter((l) => l && !l.startsWith("#"));
		assert.deepEqual(rules, [
			"* @devfellowship/core",
			"/skills/alpha/ @taigfs @devfellowship/core",
			"/skills/beta/ @gabi-gasparini @devfellowship/core",
		]);
		assert.equal(run(root, "--check").status, 0);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("a free-text author is refused, not guessed", () => {
	const root = workspace({ alpha: "author: Jesse Vincent\n" });
	try {
		const result = run(root, "--write");
		assert.equal(result.status, 1);
		assert.match(result.stderr, /OWNER-ERROR skills\/alpha\/SKILL\.md: .*not a GitHub handle/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("a hand edit to CODEOWNERS is drift", () => {
	const root = workspace({ alpha: "author: taigfs\n" });
	try {
		run(root, "--write");
		const path = join(root, ".github", "CODEOWNERS");
		writeFileSync(path, readFileSync(path, "utf8").replace("@taigfs", "@someone-else"));
		const result = run(root, "--check");
		assert.equal(result.status, 1);
		assert.match(result.stderr, /CODEOWNERS DRIFT/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("the committed CODEOWNERS is the generator output", () => {
	const result = run(repoRoot, "--check");
	assert.equal(result.status, 0, result.stderr);
});
