#!/usr/bin/env bun
/**
 * ingest.ts — walk skills/<name>/SKILL.md, parse frontmatter, content-hash,
 * audit-scan, and POST the batch to the dfl-skills registry /ingest endpoint.
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
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SKILLS_DIR = "skills";

interface Frontmatter {
	name?: string;
	description?: string;
	kind?: string;
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
	body: string;
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

	let entries: string[] = [];
	try {
		entries = readdirSync(SKILLS_DIR);
	} catch {
		console.error(`no ${SKILLS_DIR}/ dir`);
		process.exit(2);
	}

	const out: OutSkill[] = [];
	let auditFailures = 0;

	for (const slug of entries) {
		const dir = join(SKILLS_DIR, slug);
		let isDir = false;
		try {
			isDir = statSync(dir).isDirectory();
		} catch {
			/* ignore */
		}
		if (!isDir) continue;
		const skillMd = join(dir, "SKILL.md");
		let content: string;
		try {
			content = readFileSync(skillMd, "utf8");
		} catch {
			console.warn(`skip ${slug}: no SKILL.md`);
			continue;
		}
		const { fm, body } = parseFrontmatter(content);
		const findings = audit(content);
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
