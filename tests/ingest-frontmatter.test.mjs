import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const ingest = fileURLToPath(new URL("../scripts/ingest.ts", import.meta.url));

function runIngestDocument(document) {
	const workspace = mkdtempSync(join(tmpdir(), "dfl-skills-frontmatter-"));
	try {
		mkdirSync(join(workspace, ".claude-plugin"), { recursive: true });
		mkdirSync(join(workspace, "skills", "example"), { recursive: true });
		writeFileSync(
			join(workspace, ".claude-plugin", "marketplace.json"),
			JSON.stringify({
				name: "fixture",
				plugins: [{ name: "example", source: "./skills/example", description: "Fixture" }],
			}),
		);
		writeFileSync(
			join(workspace, "skills", "example", "SKILL.md"),
			document,
		);
		const result = spawnSync("bun", [ingest], {
			cwd: workspace,
			encoding: "utf8",
			env: {
				...process.env,
				SKILLS_SOURCE: "devfellowship/skills",
				SKILLS_VISIBILITY: "public",
				DRY_RUN: "1",
				AUDIT_BLOCK: "1",
			},
		});
		return result;
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
}

function runIngest(frontmatter) {
	return runIngestDocument(`---\n${frontmatter}\n---\n\n# Fixture\n`);
}

function payload(result) {
	assert.equal(result.status, 0, result.stderr);
	return JSON.parse(result.stdout.slice(result.stdout.indexOf("{"))).skills[0];
}

test("ingest supports standard nested author and inline tags", () => {
	const skill = payload(
		runIngest(
			"name: example\ndescription: Example skill\nmetadata:\n  author: taigfs\n  tags: [campaigns, analytics]",
		),
	);
	assert.equal(skill.author, "taigfs");
	assert.deepEqual(skill.tags, ["campaigns", "analytics"]);
});

test("ingest preserves legacy top-level author and inline tags", () => {
	const skill = payload(
		runIngest(
			"name: example\ndescription: Example skill\nauthor: devfellowship\ntags: [task, mcp]",
		),
	);
	assert.equal(skill.author, "devfellowship");
	assert.deepEqual(skill.tags, ["task", "mcp"]);
});

test("ingest rejects alternate metadata indentation", () => {
	const result = runIngest(
		"name: example\ndescription: Example skill\nmetadata:\n    author: taigfs\n    tags: [campaigns, analytics]",
	);
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /unsupported metadata/i);
});

test("ingest rejects nested block-list tags", () => {
	const result = runIngest(
		"name: example\ndescription: Example skill\nmetadata:\n  author: taigfs\n  tags:\n    - campaigns\n    - analytics",
	);
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /unsupported metadata/i);
});

test("ingest rejects legacy block-list tags", () => {
	const result = runIngest(
		"name: example\ndescription: Example skill\nauthor: devfellowship\ntags:\n  - task\n  - mcp",
	);
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /unsupported tags/i);
});

test("ingest rejects a missing opening frontmatter delimiter", () => {
	const result = runIngestDocument("name: example\ndescription: Example skill\n---\n\n# Fixture\n");
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /frontmatter.*opening delimiter/i);
});

test("ingest rejects a missing closing frontmatter delimiter", () => {
	const result = runIngestDocument("---\nname: example\ndescription: Example skill\n\n# Fixture\n");
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /frontmatter.*closing delimiter/i);
});

test("ingest rejects an empty author", () => {
	const result = runIngest("name: example\ndescription: Example skill\nauthor:");
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /author.*non-empty scalar/i);
});

test("ingest rejects a structured author value", () => {
	const result = runIngest("name: example\ndescription: Example skill\nauthor: [taigfs]");
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /author.*scalar/i);
});

test("ingest rejects an unknown top-level key", () => {
	const result = runIngest("name: example\ndescription: Example skill\nmaintainer: taigfs");
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /unknown top-level key.*maintainer/i);
});

test("ingest rejects a malformed top-level line", () => {
	const result = runIngest("name: example\ndescription: Example skill\nauthor taigfs");
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /malformed top-level line/i);
});

test("ingest rejects an unknown indented shape", () => {
	const result = runIngest("name: example\ndescription: Example skill\n  author: taigfs");
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /unexpected indentation/i);
});
