#!/usr/bin/env bun
/**
 * ingest.ts — read the plugins declared in .claude-plugin/marketplace.json, parse
 * each SKILL.md frontmatter, content-hash, audit-scan, and POST the batch to the
 * dfl-skills registry /ingest endpoint.
 *
 * Plan 20260626-skills-marketplace, Fase 1. Run by the GitHub Action on push.
 *
 * Env:
 *   SKILLS_INGEST_URL     e.g. https://skills.devfellowship.com/ingest
 *   SKILLS_INGEST_SECRET  shared bearer the API enforces
 *   SKILLS_SOURCE         "owner/repo" stamped on every row (e.g. devfellowship/skills)
 *   SKILLS_VISIBILITY     "public" | "internal"  (stamped per-repo)
 *   GITHUB_SHA            commit sha (optional)
 *
 * 🚨 AUDIT GATE: scans each SKILL.md for high-risk injection / secret patterns.
 * Any finding marks the skill `audit_fail` and (with AUDIT_BLOCK=1) exits non-zero
 * so the CI blocks the merge (Q10 = A). The label-override is handled in the
 * workflow (skip this script's hard-fail when the override label is present).
 *
 * 🚨 DRIFT GATE: the manifest is the publisher. A folder nobody declared is never
 * published, and a declaration with no folder fails — both directions are errors,
 * so "it's on disk" can't silently become "it's on the public site".
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SKILLS_DIR = "skills";
const MANIFEST = ".claude-plugin/marketplace.json";

interface Frontmatter {
	name?: string;
	description?: string;
	kind?: string;
	author?: string;
	tags?: string[];
	[k: string]: unknown;
}

/** Minimal YAML frontmatter parser (name/description/kind/tags). */
function parseFrontmatter(md: string): { fm: Frontmatter; body: string } {
	const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(md);
	if (!m) return { fm: {}, body: md };
	const fm: Frontmatter = {};
	for (const line of m[1].split("\n")) {
		const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
		if (!kv) continue;
		const key = kv[1];
		let val = kv[2].trim();
		if (key === "tags") {
			val = val.replace(/^\[|\]$/g, "");
			fm.tags = val
				.split(",")
				.map((t) => t.trim().replace(/^["']|["']$/g, ""))
				.filter(Boolean);
		} else {
			fm[key] = val.replace(/^["']|["']$/g, "");
		}
	}
	return { fm, body: m[2] };
}

/** High-risk audit patterns (advisory + CI gate). */
const AUDIT_PATTERNS: Array<{ re: RegExp; label: string }> = [
	{ re: /ignore\s+(all\s+)?previous\s+instructions/i, label: "prompt-injection" },
	{ re: /\beval\s*\(/, label: "eval" },
	{ re: /curl\s+[^\n|]*\|\s*(ba)?sh/i, label: "curl-pipe-sh" },
	{ re: /AKIA[0-9A-Z]{16}/, label: "aws-key" },
	{ re: /-----BEGIN[ A-Z]*PRIVATE KEY-----/, label: "private-key" },
	{ re: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, label: "jwt-literal" },
	{ re: /[‪-‮⁦-⁩]/, label: "bidi-override" },
];

function audit(content: string): string[] {
	const findings: string[] = [];
	for (const p of AUDIT_PATTERNS) if (p.re.test(content)) findings.push(p.label);
	return findings;
}

/** Every file in the skill folder can end up as agent instructions, not just SKILL.md. */
function auditDir(dir: string): string[] {
	const findings: string[] = [];
	for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
		if (!entry.isFile()) continue;
		const path = join(entry.parentPath ?? dir, entry.name);
		let content: string;
		try {
			content = readFileSync(path, "utf8");
		} catch {
			continue;
		}
		for (const label of audit(content)) findings.push(`${entry.name}:${label}`);
	}
	return findings;
}

function sha256(s: string): string {
	return createHash("sha256").update(s).digest("hex");
}

interface OutSkill {
	source: string;
	slug: string;
	name: string;
	description: string;
	kind: string;
	visibility: string;
	content_sha256: string;
	commit_sha?: string;
	tags: string[];
	author?: string;
	body: string;
}

/** Slugs declared in the manifest, derived from each plugin's `source` path. */
function readManifestSlugs(): string[] {
	let raw: string;
	try {
		raw = readFileSync(MANIFEST, "utf8");
	} catch {
		console.error(`no ${MANIFEST}`);
		process.exit(2);
	}
	const plugins = JSON.parse(raw).plugins;
	if (!Array.isArray(plugins)) {
		console.error(`${MANIFEST}: "plugins" must be an array`);
		process.exit(2);
	}
	const slugs: string[] = [];
	for (const p of plugins) {
		const m = /^\.\/skills\/([^/]+)\/?$/.exec(String(p?.source ?? ""));
		if (!m) {
			console.error(`${MANIFEST}: plugin "${p?.name}" has no ./skills/<slug> source`);
			process.exit(2);
		}
		slugs.push(m[1]);
	}
	return slugs;
}

function listSkillDirs(): string[] {
	let entries: string[] = [];
	try {
		entries = readdirSync(SKILLS_DIR);
	} catch {
		return [];
	}
	return entries.filter((e) => {
		try {
			return statSync(join(SKILLS_DIR, e)).isDirectory();
		} catch {
			return false;
		}
	});
}

function main() {
	const source = process.env.SKILLS_SOURCE;
	const visibility = process.env.SKILLS_VISIBILITY;
	const url = process.env.SKILLS_INGEST_URL;
	const secret = process.env.SKILLS_INGEST_SECRET;
	if (!source || !visibility) {
		console.error("SKILLS_SOURCE and SKILLS_VISIBILITY required");
		process.exit(2);
	}

	const declared = readManifestSlugs();
	const onDisk = listSkillDirs();

	const undeclared = onDisk.filter((s) => !declared.includes(s));
	if (undeclared.length > 0) {
		console.error(
			`DRIFT: skills/ has undeclared ${undeclared.join(", ")} — add them to ${MANIFEST} or delete the folder`,
		);
		process.exit(1);
	}

	const out: OutSkill[] = [];
	let auditFailures = 0;

	for (const slug of declared) {
		const skillMd = join(SKILLS_DIR, slug, "SKILL.md");
		let content: string;
		try {
			content = readFileSync(skillMd, "utf8");
		} catch {
			console.error(`DRIFT: ${MANIFEST} declares ${slug} but ${skillMd} is missing`);
			process.exit(1);
		}
		const { fm, body } = parseFrontmatter(content);
		const findings = auditDir(join(SKILLS_DIR, slug));
		if (findings.length > 0) {
			auditFailures++;
			console.error(`AUDIT ${slug}: ${findings.join(", ")}`);
		}
		out.push({
			source,
			slug,
			name: fm.name || slug,
			description: fm.description || "",
			kind: (fm.kind as string) || "skill",
			visibility,
			content_sha256: sha256(content),
			commit_sha: process.env.GITHUB_SHA,
			tags: fm.tags || [],
			author: fm.author,
			body,
		});
	}

	console.log(`parsed ${out.length} skills (${auditFailures} with audit findings)`);

	if (auditFailures > 0 && process.env.AUDIT_BLOCK === "1") {
		console.error("AUDIT GATE: high-risk findings present -> failing CI");
		process.exit(1);
	}

	if (process.env.DRY_RUN === "1" || !url || !secret) {
		console.log("DRY_RUN / no endpoint configured — not posting.");
		console.log(JSON.stringify({ skills: out.map((s) => ({ ...s, body: undefined })) }, null, 2));
		return;
	}

	fetch(url, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${secret}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ skills: out }),
	})
		.then(async (r) => {
			const txt = await r.text();
			if (!r.ok) {
				console.error(`ingest failed ${r.status}: ${txt}`);
				process.exit(1);
			}
			console.log(`ingest ok: ${txt}`);
		})
		.catch((e) => {
			console.error(`ingest error: ${e.message}`);
			process.exit(1);
		});
}

main();
