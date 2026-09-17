import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const skillPath = new URL("../skills/campaigns-content-performance/", import.meta.url);

test("publishes the skill with the campaigns MCP dependency", () => {
	const manifest = JSON.parse(
		readFileSync(new URL("../.claude-plugin/marketplace.json", import.meta.url), "utf8"),
	);
	const skill = manifest.plugins.find(
		(plugin) => plugin.name === "campaigns-content-performance",
	);
	assert.equal(skill?.source, "./skills/campaigns-content-performance");

	const openai = readFileSync(new URL("agents/openai.yaml", skillPath), "utf8");
	assert.match(openai, /allow_implicit_invocation:\s*true/);
	assert.match(openai, /https:\/\/campaigns\.mcp\.devfellowship\.com\/mcp/);
	assert.match(openai, /\$campaigns-content-performance/);
});

test("the registry ingest preserves standard metadata", () => {
	const result = spawnSync("bun", ["scripts/ingest.ts"], {
		cwd: new URL("..", import.meta.url),
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
	const payload = JSON.parse(result.stdout.slice(result.stdout.indexOf("{")));
	const skill = payload.skills.find(
		(item) => item.slug === "campaigns-content-performance",
	);
	assert.equal(skill.author, "taigfs");
	assert.deepEqual(skill.tags, [
		"campaigns",
		"analytics",
		"content",
		"social-media",
		"weekly-report",
	]);
});
