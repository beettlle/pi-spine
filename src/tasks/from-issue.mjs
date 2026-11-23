/**
 * `spine tasks from-issue` — scaffold SP-* packet from a GitHub issue (#384).
 *
 * Fetches issue title/body via `gh issue view <n> --json` and scaffolds
 * `{tasksRoot}/SP-###-<slug>/` with PROMPT.md + STATUS.md stubs:
 *
 * - Mission first line uses `Closes #N` or `Partial #N` (#147 link format).
 * - Mission stays thin (title + pointer to the issue; #385 thin packets).
 * - Contract / File Scope / Steps are required stubs. The scaffold never
 *   claims Contract completeness: the Contract table ships with empty rows
 *   so `spine tasks validate <id>` fails until the operator fills it.
 * - `dependencies.json` is never written (no silent DAG edges).
 * - CONTEXT.md `Next Task ID` is read-only by default; it is only updated
 *   when the caller explicitly passes `nextId` (CLI `--next-id`).
 *
 * Independence: spine + `gh` only. No batch start, no File Scope invention.
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const TASK_ID_RE = /^[A-Z][A-Z0-9]*-\d+$/;
const NEXT_TASK_ID_LINE_RE = /^\*\*Next Task ID:\*\* ([A-Z][A-Z0-9]*-\d+)\s*$/m;
const GH_ISSUE_JSON_FIELDS = "number,title,body";
const GH_TIMEOUT_MS = 30_000;
const SLUG_MAX_LENGTH = 48;

/**
 * Fail-loud error for from-issue scaffolding. `exitCode` is surfaced by the
 * CLI handler (1 = fetch/validation, 2 = config/tasksRoot resolution).
 */
export class FromIssueError extends Error {
	/**
	 * @param {string} message
	 * @param {{ exitCode?: number }} [options]
	 */
	constructor(message, { exitCode = 1 } = {}) {
		super(message);
		this.name = "FromIssueError";
		this.exitCode = exitCode;
	}
}

/**
 * Parse and shape-check `gh issue view --json number,title,body` stdout.
 * Input validation at the gh boundary (fail loud on malformed payloads).
 *
 * @param {string} stdout Raw gh stdout
 * @param {number} expectedNumber Issue number that was requested
 * @returns {{ number: number, title: string, body: string }}
 */
export function parseIssueJson(stdout, expectedNumber) {
	let payload;
	try {
		payload = JSON.parse(stdout);
	} catch (err) {
		throw new FromIssueError(
			`gh issue view ${expectedNumber} returned malformed JSON: ${err instanceof Error ? err.message : String(err)}`,
		);
	}
	if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
		throw new FromIssueError(`gh issue view ${expectedNumber} returned a non-object JSON payload`);
	}
	if (payload.number !== expectedNumber) {
		throw new FromIssueError(
			`gh issue view returned issue #${payload.number} but #${expectedNumber} was requested`,
		);
	}
	if (typeof payload.title !== "string" || payload.title.trim() === "") {
		throw new FromIssueError(`gh issue view ${expectedNumber} returned no title`);
	}
	return {
		number: payload.number,
		title: payload.title.trim(),
		body: typeof payload.body === "string" ? payload.body : "",
	};
}

/**
 * Fetch a GitHub issue via the `gh` CLI.
 *
 * @param {{ issueNumber: number, projectRoot?: string, ghCommand?: string }} options
 * @returns {{ number: number, title: string, body: string }}
 */
export function fetchIssueViaGh({ issueNumber, projectRoot = process.cwd(), ghCommand = "gh" }) {
	if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
		throw new FromIssueError(`Invalid issue number: ${issueNumber}. Expected a positive integer.`);
	}

	const result = spawnSync(
		ghCommand,
		["issue", "view", String(issueNumber), "--json", GH_ISSUE_JSON_FIELDS],
		{
			cwd: projectRoot,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
			timeout: GH_TIMEOUT_MS,
		},
	);

	if (result.error) {
		const code = /** @type {NodeJS.ErrnoException} */ (result.error).code;
		if (code === "ENOENT") {
			throw new FromIssueError(
				`gh CLI not found on PATH (looked for "${ghCommand}"). Install GitHub CLI or pass --gh <cmd>.`,
			);
		}
		throw new FromIssueError(`gh issue view ${issueNumber} failed to run: ${result.error.message}`);
	}
	if (result.status !== 0) {
		const stderr = (result.stderr ?? "").trim();
		throw new FromIssueError(
			stderr || `gh issue view ${issueNumber} exited with status ${result.status ?? "unknown"}`,
		);
	}
	return parseIssueJson(result.stdout ?? "", issueNumber);
}

/**
 * Slugify an issue title for the `SP-###-<slug>` folder name.
 * Safe chars only [a-z0-9-]; falls back to `issue` when nothing remains.
 *
 * @param {string} title
 * @param {{ maxLength?: number }} [options]
 * @returns {string}
 */
export function slugifyTitle(title, { maxLength = SLUG_MAX_LENGTH } = {}) {
	const slug = String(title ?? "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, maxLength)
		.replace(/-+$/g, "");
	return slug || "issue";
}

/**
 * Build the scaffolded PROMPT.md. Contract rows are intentionally empty so
 * `spine tasks validate` fails until the operator fills them.
 *
 * @param {{ taskId: string, issue: { number: number, title: string }, linkType: "closes"|"partial", created?: string }} options
 * @returns {string}
 */
export function buildPromptScaffold({ taskId, issue, linkType, created }) {
	const day = created ?? new Date().toISOString().slice(0, 10);
	const link = linkType === "partial" ? "Partial" : "Closes";
	return `# Task: ${taskId} — ${issue.title}

**Created:** ${day}
**Size:** M
**Type:** llm

## Review Level: 1 (Plan Only)

<!-- TODO(operator): adjust review level, risk, and score before batch start. -->

**Risk:** TODO(operator): severity and blast radius.
**Score:** 0/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 0

## Mission

${link} #${issue.number} — ${issue.title}. Narrative and acceptance criteria live on the issue; keep this packet thin (#385) and fill Contract, File Scope, and Steps below before batch start.

## Dependencies

<!-- TODO(operator): list real dependencies only; this scaffold never writes dependencies.json edges. -->

- **None**

## Context to Read First

- GitHub #${issue.number} — narrative and ACs (\`gh issue view ${issue.number}\`)

## Environment

<!-- TODO(operator): fill workspace and required services. -->

- **Workspace:** TODO(operator)
- **Services required:** None

## File Scope

<!-- TODO(operator): list files this task creates or modifies; used for lane packing. Do not leave empty. -->

## Contract

<!-- TODO(operator): fill every field before batch start. \`spine tasks validate ${taskId}\` must pass after fill-in. -->

| Field | Value |
|-------|-------|
| testCommand |  |
| fileScopeMustChange |  |

## Steps

### Step 0: TODO(operator) — Implementation
- [ ] TODO(operator): define concrete outcomes for this task

### Step 1: Testing & Verification
- [ ] Fill Contract testCommand, then run \`spine tasks validate ${taskId}\`

## Completion Criteria

- [ ] Contract filled; \`spine tasks validate ${taskId}\` exits 0
- [ ] TODO(operator): concrete deliverables

## Do NOT

- Auto \`spine batch start\` before Contract is filled
- Replace this packet with the issue body at runtime
- Edit \`.spine/\` or \`.review/\`
- Modify \`AGENTS.md\`, \`CLAUDE.md\`, or \`.gitnexus/\`

## Git Commit Convention

- \`feat(${taskId}): <summary>\`

## Amendments

- None
`;
}

/**
 * Build the scaffolded STATUS.md mirroring the PROMPT steps.
 *
 * @param {{ taskId: string, created?: string }} options
 * @returns {string}
 */
export function buildStatusScaffold({ taskId, created }) {
	const day = created ?? new Date().toISOString().slice(0, 10);
	return `# STATUS — ${taskId}

**Task:** ${taskId}
**Current Step:** Step 0 — TODO(operator) Implementation
**Status:** 🔵 Ready for Execution
**Last Updated:** ${day}

## Steps

### Step 0: TODO(operator) — Implementation
**Status:** ⬜ Not Started

- [ ] TODO(operator): define concrete outcomes for this task

### Step 1: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Fill Contract testCommand, then run \`spine tasks validate ${taskId}\`

## Blockers

- Contract/File Scope/Steps are stubs until the operator fills them (#384)

## Discoveries

- Scaffolded from a GitHub issue via \`spine tasks from-issue\`; keep narrative on the issue (#385).
`;
}

/**
 * Read `**Next Task ID:** PREFIX-###` from CONTEXT.md (read-only).
 *
 * @param {string} contextPath Absolute path to CONTEXT.md
 * @returns {string|null} Task ID, or null when missing/unparsable
 */
export function readNextTaskId(contextPath) {
	let markdown;
	try {
		markdown = fs.readFileSync(contextPath, "utf-8");
	} catch {
		return null;
	}
	return NEXT_TASK_ID_LINE_RE.exec(markdown)?.[1] ?? null;
}

/**
 * Update the `**Next Task ID:**` line in CONTEXT.md. Explicit opt-in only —
 * this module never calls it without a caller-provided `nextId`.
 *
 * @param {string} contextPath Absolute path to CONTEXT.md
 * @param {string} nextId New task ID (PREFIX-###)
 */
export function updateNextTaskId(contextPath, nextId) {
	if (!TASK_ID_RE.test(nextId)) {
		throw new FromIssueError(
			`Invalid --next-id value: "${nextId}". Expected PREFIX-### (e.g. SP-891).`,
		);
	}
	let markdown;
	try {
		markdown = fs.readFileSync(contextPath, "utf-8");
	} catch (err) {
		throw new FromIssueError(`Cannot read CONTEXT.md at ${contextPath}: ${err instanceof Error ? err.message : String(err)}`);
	}
	if (!NEXT_TASK_ID_LINE_RE.test(markdown)) {
		throw new FromIssueError(
			`CONTEXT.md has no \`**Next Task ID:** PREFIX-###\` line; update it manually instead of using --next-id.`,
		);
	}
	const updated = markdown.replace(NEXT_TASK_ID_LINE_RE, `**Next Task ID:** ${nextId}`);
	fs.writeFileSync(contextPath, updated, "utf-8");
}

/**
 * Scaffold `{tasksRoot}/{taskId}-{slug}/` with PROMPT.md + STATUS.md stubs.
 *
 * @param {object} options
 * @param {string} options.tasksRoot Absolute tasks root
 * @param {{ number: number, title: string }} options.issue Fetched issue (title/body)
 * @param {"closes"|"partial"} options.linkType Mission link format
 * @param {string} [options.taskId] Explicit task ID; defaults to CONTEXT.md Next Task ID
 * @param {string} [options.slug] Folder slug override; defaults to slugified title
 * @param {string} [options.nextId] Explicit CONTEXT.md Next Task ID update (opt-in)
 * @param {string} [options.created] Override the Created date (ISO date)
 * @returns {{ taskId: string, folderPath: string, promptPath: string, statusPath: string, contextNextIdUpdated: boolean }}
 */
export function scaffoldTaskFolder({
	tasksRoot,
	issue,
	linkType,
	taskId,
	slug,
	nextId,
	created,
}) {
	if (linkType !== "closes" && linkType !== "partial") {
		throw new FromIssueError(`Invalid linkType: ${linkType}. Expected "closes" or "partial".`);
	}

	/** @type {string | null | undefined} */
	let resolvedTaskId = taskId;
	if (resolvedTaskId === undefined || resolvedTaskId === null || resolvedTaskId === "") {
		resolvedTaskId = readNextTaskId(path.join(tasksRoot, "CONTEXT.md"));
		if (!resolvedTaskId) {
			throw new FromIssueError(
				`Cannot derive a task ID: no \`**Next Task ID:**\` in ${path.join(tasksRoot, "CONTEXT.md")}. Pass --id SP-### explicitly.`,
			);
		}
	}
	if (!TASK_ID_RE.test(resolvedTaskId)) {
		throw new FromIssueError(`Invalid task ID: "${resolvedTaskId}". Expected PREFIX-### (e.g. SP-890).`);
	}

	const folderName = `${resolvedTaskId}-${slug ?? slugifyTitle(issue.title)}`;
	const folderPath = path.join(tasksRoot, folderName);
	// Ensure the tasks root exists (race-free: recursive mkdir is a no-op when
	// it already exists), then create the task folder atomically — EEXIST from
	// the non-recursive call is the fail-loud duplicate guard.
	fs.mkdirSync(tasksRoot, { recursive: true });
	try {
		fs.mkdirSync(folderPath, { recursive: false });
	} catch (err) {
		if (/** @type {NodeJS.ErrnoException} */ (err).code === "EEXIST") {
			throw new FromIssueError(
				`Task folder already exists: ${folderPath}. Pass --id/--slug or remove the folder first.`,
			);
		}
		throw new FromIssueError(
			`Cannot create task folder ${folderPath}: ${err instanceof Error ? err.message : String(err)}`,
		);
	}
	const promptPath = path.join(folderPath, "PROMPT.md");
	const statusPath = path.join(folderPath, "STATUS.md");
	fs.writeFileSync(promptPath, buildPromptScaffold({ taskId: resolvedTaskId, issue, linkType, created }), "utf-8");
	fs.writeFileSync(statusPath, buildStatusScaffold({ taskId: resolvedTaskId, created }), "utf-8");

	let contextNextIdUpdated = false;
	if (nextId !== undefined && nextId !== null && nextId !== "") {
		updateNextTaskId(path.join(tasksRoot, "CONTEXT.md"), nextId);
		contextNextIdUpdated = true;
	}

	return {
		taskId: resolvedTaskId,
		folderPath,
		promptPath,
		statusPath,
		contextNextIdUpdated,
	};
}
