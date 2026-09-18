import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = new URL("../", import.meta.url);

function dryRunPayload() {
	const result = spawnSync("bun", ["scripts/ingest.ts"], {
		cwd: root,
		encoding: "utf8",
		env: {
			...process.env,
			SKILLS_SOURCE: "devfellowship/skills",
			SKILLS_VISIBILITY: "public",
			DRY_RUN: "1",
			AUDIT_BLOCK: "1",
		},
	});
	assert.equal(result.status, 0, result.stderr);
	return JSON.parse(result.stdout.slice(result.stdout.indexOf("{")));
}

test("dry run carries the complete campaigns skill file manifest", () => {
	const payload = dryRunPayload();
	const skill = payload.skills.find((entry) => entry.slug === "campaigns-content-performance");
	assert.ok(skill);
	assert.equal(skill.files.length > 0, true, "has_files=true");
	assert.deepEqual(
		skill.files.map((entry) => entry.path),
		["SKILL.md", "agents/openai.yaml"],
	);

	for (const file of skill.files) {
		const content = readFileSync(new URL(`../skills/campaigns-content-performance/${file.path}`, import.meta.url));
		assert.equal(file.bytes, content.byteLength);
		assert.equal(file.sha256, createHash("sha256").update(content).digest("hex"));
	}
	assert.equal(skill.files.some((entry) => entry.path.startsWith("tests/")), false);
});

function jobBlock(yaml, job) {
	const lines = yaml.split("\n");
	const start = lines.indexOf(`  ${job}:`);
	assert.notEqual(start, -1, `missing ${job} job`);
	const block = [];
	for (let index = start + 1; index < lines.length; index++) {
		if (lines[index].trim() && !lines[index].startsWith("    ")) break;
		block.push(lines[index]);
	}
	return block;
}

test("production ingest depends on the audit job", () => {
	const yaml = readFileSync(new URL("../.github/workflows/ingest.yml", import.meta.url), "utf8");
	const block = jobBlock(yaml, "ingest");
	assert.ok(block.some((line) => /^ {4}needs:\s*(audit|\[\s*audit\s*\])\s*$/.test(line)));
	assert.equal(block.some((line) => /always\s*\(/.test(line)), false);
	assert.ok(block.some((line) => /github\.ref == 'refs\/heads\/main'/.test(line)));
	assert.ok(block.some((line) => /^ {4}runs-on: ubuntu-latest$/.test(line)));
});
