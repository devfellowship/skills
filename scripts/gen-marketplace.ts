#!/usr/bin/env bun
/**
 * gen-marketplace.ts — generate .claude-plugin/marketplace.json from the
 * frontmatter of every skills/<slug>/SKILL.md so the manifest can't drift from
 * the source of truth (M-drift). Run in CI (checked with --check) and committed.
 *
 * Usage:
 *   bun scripts/gen-marketplace.ts            # write the file
 *   bun scripts/gen-marketplace.ts --check    # fail if the file is out of date
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SKILLS_DIR = "skills";
const MARKETPLACE = join(".claude-plugin", "marketplace.json");
const MARKETPLACE_NAME = "devfellowship";

/** Read the `name` and `description` scalars from a SKILL.md frontmatter. */
function readFrontmatter(md: string): { name?: string; description?: string } {
	const m = /^---\n([\s\S]*?)\n---/.exec(md);
	if (!m) return {};
	const out: { name?: string; description?: string } = {};
	for (const line of m[1].split("\n")) {
		const kv = /^(name|description):\s*(.*)$/.exec(line);
		if (!kv) continue;
		const key = kv[1] as "name" | "description";
		out[key] = kv[2].trim().replace(/^["']|["']$/g, "");
	}
	return out;
}

function buildManifest(): {
	name: string;
	plugins: Array<{ name: string; source: string; description: string }>;
} {
	const plugins: Array<{ name: string; source: string; description: string }> = [];
	for (const slug of readdirSync(SKILLS_DIR).sort()) {
		const dir = join(SKILLS_DIR, slug);
		try {
			if (!statSync(dir).isDirectory()) continue;
		} catch {
			continue;
		}
		let md: string;
		try {
			md = readFileSync(join(dir, "SKILL.md"), "utf8");
		} catch {
			console.warn(`skip ${slug}: no SKILL.md`);
			continue;
		}
		const fm = readFrontmatter(md);
		plugins.push({
			name: fm.name || slug,
			source: `skills/${slug}`,
			description: fm.description || "",
		});
	}
	return { name: MARKETPLACE_NAME, plugins };
}

function main() {
	const manifest = buildManifest();
	const json = `${JSON.stringify(manifest, null, 2)}\n`;

	if (process.argv.includes("--check")) {
		let current = "";
		try {
			current = readFileSync(MARKETPLACE, "utf8");
		} catch {
			/* missing file → treated as drift below */
		}
		if (current !== json) {
			console.error(
				`${MARKETPLACE} is out of date. Run \`bun scripts/gen-marketplace.ts\` and commit.`,
			);
			process.exit(1);
		}
		console.log(`${MARKETPLACE} up to date (${manifest.plugins.length} skills).`);
		return;
	}

	writeFileSync(MARKETPLACE, json);
	console.log(`wrote ${MARKETPLACE} (${manifest.plugins.length} skills).`);
}

main();
