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

const ALLOWED_FRONTMATTER_KEYS = new Set([
	"name",
	"description",
	"kind",
	"author",
	"tags",
	"metadata",
	"license",
	"allowed-tools",
]);

function parseInlineTags(value: string, context: string): string[] {
	if (!/^\[[^\[\]]*\]$/.test(value)) {
		throw new Error(`${context}: unsupported tags format; use an inline [tag, tag] list`);
	}
	const tags = value
		.slice(1, -1)
		.split(",")
		.map((tag) => tag.trim());
	return tags.filter(Boolean).map((tag) => {
		const first = tag[0];
		const last = tag[tag.length - 1];
		if (first === '"' || first === "'") {
			if (last !== first || tag.slice(1, -1).includes(first)) {
				throw new Error(`${context}: tags contain an unterminated or mismatched quote`);
			}
			const unquoted = tag.slice(1, -1);
			if (!unquoted) throw new Error(`${context}: tags must be non-empty scalars`);
			return unquoted;
		}
		if (last === '"' || last === "'" || tag.includes('"') || tag.includes("'")) {
			throw new Error(`${context}: tags contain an unterminated or mismatched quote`);
		}
		return tag;
	});
}

function parseScalar(value: string, key: string, line: number): string {
	const trimmed = value.trim();
	if (!trimmed || /^[\[{>|]/.test(trimmed)) {
		throw new Error(`frontmatter line ${line}: ${key} must be a non-empty scalar`);
	}
	const first = trimmed[0];
	const last = trimmed[trimmed.length - 1];
	let scalar = trimmed;
	if (first === '"' || first === "'") {
		if (last !== first || trimmed.slice(1, -1).includes(first)) {
			throw new Error(`frontmatter line ${line}: ${key} has an unterminated or mismatched quote`);
		}
		scalar = trimmed.slice(1, -1);
	} else if (last === '"' || last === "'") {
		throw new Error(`frontmatter line ${line}: ${key} has an unterminated or mismatched quote`);
	}
	if (!scalar) throw new Error(`frontmatter line ${line}: ${key} must be a non-empty scalar`);
	return scalar;
}

/** Parse the small, explicit frontmatter subset supported by this publisher. */
function parseFrontmatter(md: string): { fm: Frontmatter; body: string } {
	if (!md.startsWith("---\n")) {
		throw new Error("frontmatter: missing opening delimiter");
	}
	const closing = md.indexOf("\n---", 4);
	if (closing < 0 || !/^\n---(?:\n|$)/.test(md.slice(closing))) {
		throw new Error("frontmatter: missing closing delimiter");
	}
	const frontmatter = md.slice(4, closing);
	const afterDelimiter = closing + 4;
	const body = md[afterDelimiter] === "\n" ? md.slice(afterDelimiter + 1) : md.slice(afterDelimiter);
	const fm: Frontmatter = {};
	const metadata: Pick<Frontmatter, "author" | "tags"> = {};
	const lines = frontmatter.split("\n");
	for (let index = 0; index < lines.length; index++) {
		const line = lines[index];
		if (line.trim() === "" || /^\s*#/.test(line)) continue;
		if (line === "metadata:") {
			let entries = 0;
			while (index + 1 < lines.length && /^\s/.test(lines[index + 1])) {
				index++;
				const nested = /^  (author|tags):\s*(.+)$/.exec(lines[index]);
				if (!nested) {
					throw new Error(
						`frontmatter line ${index + 1}: unsupported metadata shape; use two-space author and inline tags`,
					);
				}
				entries++;
				const [, key, rawValue] = nested;
				const value = rawValue.trim();
				if (key === "author") {
					metadata.author = parseScalar(value, "author", index + 1);
				} else {
					metadata.tags = parseInlineTags(value, `frontmatter line ${index + 1}`);
				}
			}
			if (entries === 0) {
				throw new Error("frontmatter metadata: unsupported empty metadata shape");
			}
			continue;
		}
		if (/^metadata:/.test(line)) {
			throw new Error(
				`frontmatter line ${index + 1}: unsupported metadata shape; use a two-space block`,
			);
		}
		if (/^\s/.test(line)) {
			throw new Error(`frontmatter line ${index + 1}: unexpected indentation`);
		}
		const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
		if (!kv) {
			throw new Error(`frontmatter line ${index + 1}: malformed top-level line`);
		}
		const key = kv[1];
		const val = kv[2].trim();
		if (!ALLOWED_FRONTMATTER_KEYS.has(key)) {
			throw new Error(`frontmatter line ${index + 1}: unknown top-level key ${key}`);
		}
		if (key === "tags") {
			fm.tags = parseInlineTags(val, `frontmatter line ${index + 1}`);
		} else if (key === "author") {
			fm.author = parseScalar(val, "author", index + 1);
		} else {
			fm[key] = parseScalar(val, key, index + 1);
		}
	}
	fm.author ??= metadata.author;
	fm.tags ??= metadata.tags;
	return { fm, body };
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

const IGNORED_NAMES = new Set([".git", "node_modules", "__pycache__", ".DS_Store"]);
const IGNORED_SUFFIXES = [".pyc", ".pyo"];
const SAFE_PATH = /^[A-Za-z0-9_.][A-Za-z0-9_./-]*$/;
const MAX_FILE_BYTES = 512 * 1024;
const MAX_FILES_PER_SKILL = 100;
const MAX_SKILL_BYTES = 4 * 1024 * 1024;

interface SkillFileOnDisk {
	path: string;
	bytes: Uint8Array;
}

/** Every regular file under the skill directory, in a stable order. */
function walkSkillDir(dir: string): SkillFileOnDisk[] {
	const found: SkillFileOnDisk[] = [];
	const walk = (current: string, prefix: string): void => {
		for (const entry of readdirSync(current, { withFileTypes: true })) {
			if (IGNORED_NAMES.has(entry.name)) continue;
			if (IGNORED_SUFFIXES.some((suffix) => entry.name.endsWith(suffix))) continue;
			const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
			const absolute = join(current, entry.name);
			if (entry.isSymbolicLink()) continue;
			if (entry.isDirectory()) {
				walk(absolute, relative);
			} else if (entry.isFile()) {
				found.push({ path: relative, bytes: new Uint8Array(readFileSync(absolute)) });
			}
		}
	};
	walk(dir, "");
	found.sort((left, right) => {
		if (left.path === "SKILL.md") return -1;
		if (right.path === "SKILL.md") return 1;
		return left.path.localeCompare(right.path);
	});
	return found;
}

/** Every delivered text file can become agent instructions, not only SKILL.md. */
function auditFiles(files: SkillFileOnDisk[]): string[] {
	const findings: string[] = [];
	for (const file of files) {
		let content: string;
		try {
			content = new TextDecoder("utf-8", { fatal: true }).decode(file.bytes);
			if (content.includes("\0")) continue;
		} catch {
			continue;
		}
		for (const label of audit(content)) findings.push(`${file.path}:${label}`);
	}
	return findings;
}

function sha256(s: string | Uint8Array): string {
	return createHash("sha256").update(s).digest("hex");
}

interface OutSkillFile {
	path: string;
	sha256: string;
	bytes: number;
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
	files: OutSkillFile[];
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
		// A slug declared twice is not harmless: the batch would carry the same
		// (source, slug) twice and Postgres refuses the whole upsert with "ON
		// CONFLICT DO UPDATE command cannot affect row a second time" — nothing
		// publishes, not just the duplicate.
		if (slugs.includes(m[1])) {
			console.error(`${MANIFEST}: "${m[1]}" is declared more than once`);
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
		const dir = join(SKILLS_DIR, slug);
		const onDiskFiles = walkSkillDir(dir);
		const skillFile = onDiskFiles.find((file) => file.path === "SKILL.md");
		if (!skillFile) {
			const skillMd = join(dir, "SKILL.md");
			console.error(`DRIFT: ${MANIFEST} declares ${slug} but ${skillMd} is missing`);
			process.exit(1);
		}
		const content = new TextDecoder("utf-8", { fatal: true }).decode(skillFile.bytes);
		const { fm, body } = parseFrontmatter(content);
		if (typeof fm.name !== "string" || !fm.name.trim()) {
			throw new Error(`frontmatter ${slug}: name is required`);
		}
		if (typeof fm.description !== "string" || !fm.description.trim()) {
			throw new Error(`frontmatter ${slug}: description is required`);
		}
		const findings = auditFiles(onDiskFiles);
		if (findings.length > 0) {
			auditFailures++;
			console.error(`AUDIT ${slug}: ${findings.join(", ")}`);
		}
		let totalBytes = 0;
		const files = onDiskFiles.map((file) => {
			if (!SAFE_PATH.test(file.path) || /(^|\/)\.\.(\/|$)/.test(file.path)) {
				throw new Error(`MANIFEST ${slug}: unsupported path ${file.path}`);
			}
			if (file.bytes.byteLength > MAX_FILE_BYTES) {
				throw new Error(`MANIFEST ${slug}: ${file.path} exceeds ${MAX_FILE_BYTES} bytes`);
			}
			totalBytes += file.bytes.byteLength;
			return { path: file.path, sha256: sha256(file.bytes), bytes: file.bytes.byteLength };
		});
		if (files.length > MAX_FILES_PER_SKILL) {
			throw new Error(`MANIFEST ${slug}: more than ${MAX_FILES_PER_SKILL} files`);
		}
		if (totalBytes > MAX_SKILL_BYTES) {
			throw new Error(`MANIFEST ${slug}: exceeds ${MAX_SKILL_BYTES} total bytes`);
		}

		out.push({
			source,
			slug,
			name: fm.name,
			description: fm.description,
			kind: (fm.kind as string) || "skill",
			visibility,
			content_sha256: sha256(content),
			commit_sha: process.env.GITHUB_SHA,
			tags: fm.tags || [],
			author: fm.author,
			body,
			files,
		});
	}

	console.log(`parsed ${out.length} skills (${auditFailures} with audit findings)`);

	if (auditFailures > 0 && process.env.AUDIT_BLOCK === "1") {
		console.error("AUDIT GATE: high-risk findings present -> failing CI");
		process.exit(1);
	}

	// `prune: true` — this batch is the COMPLETE published set for this source,
	// so the registry deletes the rows it does not mention. Without it, removing
	// a skill here left the row (and its body, served from the pinned commit) on
	// the site forever. Safe to send because the manifest is the publisher and
	// the drift gate above already refused any divergence from disk.
	const payload = { skills: out, prune: true };

	if (process.env.DRY_RUN === "1" || !url || !secret) {
		console.log("DRY_RUN / no endpoint configured — not posting.");
		console.log(
			JSON.stringify(
				{ ...payload, skills: out.map((s) => ({ ...s, body: undefined })) },
				null,
				2,
			),
		);
		return;
	}

	fetch(url, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${secret}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(payload),
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
