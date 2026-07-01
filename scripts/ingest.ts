#!/usr/bin/env bun
/**
 * ingest.ts — walk skills/<name>/, parse SKILL.md frontmatter, content-hash,
 * audit-scan (ALL files in the skill folder), and POST the batch to the
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
 * 🚨 AUDIT GATE: scans EVERY file under skills/<slug>/ for high-risk injection /
 * secret / exfil patterns — not just SKILL.md. A malicious skill can hide its
 * payload in a sibling file its SKILL.md tells the agent to `read @helper.md` at
 * runtime, so all sibling files must be audited even though only SKILL.md is
 * ingested/embedded. Any finding marks the skill `audit_fail` and (with
 * AUDIT_BLOCK=1) exits non-zero so CI blocks the merge (Q10 = A). The
 * label-override is handled in the workflow (skip this script's hard-fail when
 * the override label is present).
 *
 * ⚠️ Regex is a FLOOR, not a ceiling. These patterns catch known-bad shapes and
 * raise the cost of an attack; they are trivially bypassable by a motivated
 * adversary (reword, split, encode). The real defense is a security-literate
 * human review (see .github/CODEOWNERS) + a required status check on this gate.
 * Treat findings as "needs human eyes", not "provably safe if clean".
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SKILLS_DIR = "skills";

/** Skill names that must never be claimed (impersonation / shadowing). */
const RESERVED_NAMES = new Set(["admin", "system", "claude", "anthropic"]);

interface Frontmatter {
	name?: string;
	description?: string;
	kind?: string;
	tags?: string[];
	metadata?: Record<string, unknown>;
	[k: string]: unknown;
}

/** Strip a matching pair of surrounding quotes from a scalar value. */
function unquote(v: string): string {
	return v.trim().replace(/^["']|["']$/g, "");
}

/**
 * Parse YAML frontmatter, preserving nested maps such as
 * `metadata: { author, version }` that the old flat line-regex silently dropped
 * (M5). This is a small indentation-aware parser (no external dependency, no
 * arbitrary-code-execution surface like js-yaml's unsafe `load`): it handles
 * top-level scalars, `[...]`/`- ` lists, and one level of `key:`-then-indented
 * nested map — which is all the frontmatter these skills use.
 */
function parseFrontmatter(md: string): { fm: Frontmatter; body: string } {
	const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(md);
	if (!m) return { fm: {}, body: md };
	const fm: Frontmatter = {};
	const lines = m[1].split("\n");
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (!line.trim() || /^\s*#/.test(line)) continue;
		// Only top-level (unindented) keys start a new field.
		const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
		if (!kv) continue;
		const key = kv[1];
		const rawVal = kv[2].trim();

		if (key === "tags") {
			const inline = rawVal.replace(/^\[|\]$/g, "");
			const inlineTags = inline
				.split(",")
				.map((t) => unquote(t))
				.filter(Boolean);
			// Support block-list form as well (`tags:` then `  - foo`).
			const blockTags: string[] = [];
			while (i + 1 < lines.length && /^\s+-\s+/.test(lines[i + 1])) {
				blockTags.push(unquote(lines[++i].replace(/^\s+-\s+/, "")));
			}
			fm.tags = [...inlineTags, ...blockTags].filter(Boolean);
			continue;
		}

		if (rawVal === "") {
			// Possible nested map: consume indented `key: value` children.
			const nested: Record<string, unknown> = {};
			let consumed = false;
			while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1]) && !/^\s+-\s+/.test(lines[i + 1])) {
				const child = /^\s+([A-Za-z0-9_-]+):\s*(.*)$/.exec(lines[++i]);
				if (child) {
					nested[child[1]] = unquote(child[2]);
					consumed = true;
				}
			}
			fm[key] = consumed ? nested : "";
			continue;
		}

		fm[key] = unquote(rawVal);
	}
	return { fm, body: m[2] };
}

/**
 * High-risk audit patterns (advisory + CI gate). Floor, not ceiling.
 * A finding means "a human who understands the attack must look at this before
 * it ships", NOT "this is malware". Tuned so the curated skills pass while the
 * common injection/exfil payloads get flagged.
 */
const AUDIT_PATTERNS: Array<{ re: RegExp; label: string }> = [
	// --- Prompt injection (classic + reworded) ---
	{ re: /ignore\s+(all\s+)?previous\s+instructions/i, label: "prompt-injection" },
	{
		// "disregard/forget/override/ignore ... <target>" where target is an
		// instruction/directive/rule/prompt/guardrail. Requires the injection verb
		// to sit near the target so legit prose ("ignore subagent questions",
		// "override the default") does not trip it.
		re: /\b(disregard|forget|override|bypass|ignore)\b[^.\n]{0,40}\b(previous|prior|above|all|any|earlier|system)?\s*(instruction|directive|guardrail|guideline|rule|prompt)s?\b/i,
		label: "prompt-injection-reworded",
	},
	{
		// Coaxing the agent to act "as if" without/regardless of its constraints.
		re: /\b(pretend|act as if|from now on)\b[^.\n]{0,60}\b(no\s+restrictions?|without\s+restrictions?|no\s+rules?|unrestricted|jailbreak)\b/i,
		label: "prompt-injection-jailbreak",
	},

	// --- Code execution / dynamic eval ---
	{ re: /\beval\s*\(/, label: "eval" },
	{ re: /\bnew\s+Function\s*\(/, label: "dynamic-function" },
	{ re: /\b(child_process|execSync|spawnSync|os\.system|subprocess\.)\b/, label: "shell-exec" },
	{ re: /curl\s+[^\n|]*\|\s*(ba)?sh/i, label: "curl-pipe-sh" },
	{ re: /wget\s+[^\n|]*\|\s*(ba)?sh/i, label: "wget-pipe-sh" },

	// --- Network exfil: a fetch/download verb aimed at a hard-coded EXTERNAL
	// URL. Legit skills that document fetching public guidelines are expected to
	// surface here and get a quick human OK — that is the point of the gate; it
	// is cheaper to eyeball a fetch than to miss an exfil call. ---
	{
		re: /\b(fetch|WebFetch|axios|http\.get|https\.get|urllib|requests\.(get|post))\b[^\n]{0,80}https?:\/\/[^\s)"']+/i,
		label: "network-fetch-external-url",
	},
	{
		re: /\b(curl|wget)\b[^\n|]{0,80}https?:\/\/[^\s)"']+/i,
		label: "network-download-external-url",
	},

	// --- Secret / credential reads (env + well-known files) ---
	{ re: /\bprocess\.env\b/, label: "process-env-read" },
	{ re: /\bDeno\.env\b/, label: "deno-env-read" },
	{ re: /~\/\.claude\b/, label: "claude-dir-read" },
	{ re: /\bcredentials\b/i, label: "credentials-read" },
	{ re: /(^|[\s/'"`])\.env\b/, label: "dotenv-read" },
	{ re: /\.ssh\/id_[a-z0-9]+/i, label: "ssh-key-read" },
	{ re: /\.aws\/credentials/i, label: "aws-credentials-read" },

	// --- Hard-coded secret literals ---
	{ re: /AKIA[0-9A-Z]{16}/, label: "aws-key" },
	{ re: /gh[pousr]_[A-Za-z0-9]{20,}/, label: "github-token" },
	{ re: /github_pat_[A-Za-z0-9_]{20,}/, label: "github-pat" },
	{ re: /sk-[A-Za-z0-9]{20,}/, label: "openai-key" },
	{ re: /-----BEGIN[ A-Z]*PRIVATE KEY-----/, label: "private-key" },
	{
		re: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
		label: "jwt-literal",
	},

	// --- Obfuscation ---
	{
		// Long base64 blob — common wrapper for a hidden payload.
		re: /[A-Za-z0-9+/]{200,}={0,2}/,
		label: "long-base64-blob",
	},
	{ re: /\b(atob|Buffer\.from)\s*\([^)]*base64/i, label: "base64-decode" },

	// --- Unicode bidi / RTL override (hidden-text attack) ---
	{ re: /[‪-‮⁦-⁩]/, label: "bidi-override" },
];

interface Finding {
	label: string;
	file: string;
}

function auditText(content: string, file: string): Finding[] {
	const findings: Finding[] = [];
	for (const p of AUDIT_PATTERNS) {
		if (p.re.test(content)) findings.push({ label: p.label, file });
	}
	return findings;
}

/** Recursively list every file under a directory. */
function walkFiles(dir: string): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		let s: ReturnType<typeof statSync>;
		try {
			s = statSync(full);
		} catch {
			continue;
		}
		if (s.isDirectory()) files.push(...walkFiles(full));
		else if (s.isFile()) files.push(full);
	}
	return files;
}

/** Audit metadata-level issues (name↔slug, reserved words). */
function auditMetadata(slug: string, fm: Frontmatter): Finding[] {
	const findings: Finding[] = [];
	const skillMd = join(SKILLS_DIR, slug, "SKILL.md");
	if (fm.name && fm.name !== slug) {
		findings.push({ label: `name-slug-mismatch(${fm.name}!=${slug})`, file: skillMd });
	}
	const nameForReserved = String(fm.name ?? slug).toLowerCase();
	if (RESERVED_NAMES.has(nameForReserved)) {
		findings.push({ label: `reserved-name(${nameForReserved})`, file: skillMd });
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

		// AUDIT: scan every file in the skill folder (SKILL.md + all siblings),
		// plus metadata-level checks. Only SKILL.md is ingested/embedded below,
		// but the whole folder ships with the skill and can be loaded at runtime.
		const findings: Finding[] = [];
		for (const file of walkFiles(dir)) {
			let text: string;
			try {
				text = readFileSync(file, "utf8");
			} catch {
				continue;
			}
			findings.push(...auditText(text, file));
		}
		findings.push(...auditMetadata(slug, fm));

		if (findings.length > 0) {
			auditFailures++;
			for (const f of findings) console.error(`AUDIT ${slug}: ${f.label} [${f.file}]`);
		}

		out.push({
			source,
			slug,
			name: (fm.name as string) || slug,
			description: (fm.description as string) || "",
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
