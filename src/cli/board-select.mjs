/**
 * Board selection (SP-889 / #386): map GitHub labels or a milestone to pending
 * spine task IDs via Mission `Closes #N` / `Partial #N` links (SP-887 parser).
 *
 * Selection only — resolves and prints the comma-separated ID list for
 * `spine plan` / `spine batch start`. Never starts batches, never polls, and
 * never mutates issue state; re-run when the board changes.
 *
 * CLI surface: `node bin/spine-plan.mjs --github-label <label>… [--milestone <m>] [--print-ids]`.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { compareTaskIds, discoverTasks } from "../tasks/packet/discover.mjs";
import { parseMissionIssueLinks } from "../integrations/github/mission-issue-links.mjs";
import { loadSpineConfig } from "../config/spine-config-load.mjs";
import { resolveTasksRootPath } from "../config/env-overrides.mjs";
import { missingConfigHint } from "../config/missing-config-hint.mjs";

/** Wall-clock cap per `gh` call (array-args spawn, no shell). */
const GH_CALL_TIMEOUT_MS = 15_000;

/** Upper bound for the open-issue board pull (gh paginates up to the limit). */
const GH_ISSUE_LIMIT = 1000;

/**
 * Mission section extraction — mirrors the `## Mission` slice rule used by
 * `collectIssueLinksFromTasks` in `src/integrations/github/sync-on-land.mjs`.
 */
const MISSION_SECTION_RE = /^## Mission\s*\n([\s\S]*?)(?=^## |\s*$)/m;

/**
 * @typedef {object} BoardMatch
 * @property {string} taskId Pending task ID (e.g. `SP-889`).
 * @property {number[]} issues Board issues the task's Mission links (closes ∪ partial).
 */

/**
 * @typedef {object} BoardSelection
 * @property {string[]} taskIds Pending task IDs on the board, sorted by `compareTaskIds`.
 * @property {number} boardIssueCount Open issues matching the label/milestone filters.
 * @property {BoardMatch[]} matches Per-task linked board issues.
 * @property {number} excludedCount Tasks skipped because `.DONE`/`.SUPERSEDED` exists.
 * @property {string[]} readErrors `PROMPT.md` read failures (warn-and-continue).
 */
/**
 * @typedef {object} GhRunResult
 * @property {number | null} status
 * @property {string} stdout
 * @property {string} stderr
 * @property {Error | null} error
 */

/** argv flags that select a board rather than a scope. */
const BOARD_LABEL_FLAG = "--github-label";
const BOARD_MILESTONE_FLAG = "--milestone";
const BOARD_PRINT_IDS_FLAG = "--print-ids";

/**
 * @param {string} filePath
 * @returns {string}
 */
function defaultReadTextFile(filePath) {
	return fs.readFileSync(filePath, "utf-8");
}

/**
 * Default `gh` runner — array-args spawn (no shell), piped output, hard timeout.
 * Mirrors `defaultRunGh` in `src/integrations/github/sync-on-land.mjs`.
 *
 * @param {string} projectRoot
 * @param {string[]} args
 * @returns {GhRunResult}
 */
export function defaultRunGh(projectRoot, args) {
	const result = spawnSync("gh", args, {
		cwd: projectRoot,
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "pipe"],
		timeout: GH_CALL_TIMEOUT_MS,
	});
	return {
		status: result.status ?? null,
		stdout: typeof result.stdout === "string" ? result.stdout : "",
		stderr: typeof result.stderr === "string" ? result.stderr : "",
		error: result.error ?? null,
	};
}

/**
 * Parse the board-select argv subset: repeatable `--github-label <label>`
 * (also `--github-label=<label>`), optional `--milestone <m>` (title or
 * number), and `--print-ids`. Unknown flags pass through in `rest`.
 *
 * @param {string[]} argv
 * @returns {{ labels: string[], milestone: string | null, printIds: boolean, rest: string[] }}
 */
export function parseBoardSelectArgs(argv) {
	/** @type {string[]} */
	const labels = [];
	/** @type {string | null} */
	let milestone = null;
	let printIds = false;
	/** @type {string[]} */
	const rest = [];
	/** @type {string | null} */
	let pendingFlag = null;

	for (const arg of argv) {
		if (pendingFlag === BOARD_LABEL_FLAG) {
			labels.push(arg);
			pendingFlag = null;
			continue;
		}
		if (pendingFlag === BOARD_MILESTONE_FLAG) {
			milestone = arg;
			pendingFlag = null;
			continue;
		}
		if (arg === BOARD_LABEL_FLAG || arg === BOARD_MILESTONE_FLAG) {
			pendingFlag = arg;
			continue;
		}
		if (arg.startsWith(`${BOARD_LABEL_FLAG}=`)) {
			labels.push(arg.slice(BOARD_LABEL_FLAG.length + 1));
			continue;
		}
		if (arg.startsWith(`${BOARD_MILESTONE_FLAG}=`)) {
			milestone = arg.slice(BOARD_MILESTONE_FLAG.length + 1);
			continue;
		}
		if (arg === BOARD_PRINT_IDS_FLAG) {
			printIds = true;
			continue;
		}
		rest.push(arg);
	}

	return { labels, milestone, printIds, rest };
}

/**
 * `gh issue list` argv for the open-issue board pull. Fields `number`,
 * `labels`, `milestone` are filtered in-memory so multiple `--github-label`
 * values keep documented any-match semantics regardless of gh's own
 * repeated-flag behavior.
 *
 * @returns {string[]}
 */
export function buildGhIssueListArgs() {
	return [
		"issue",
		"list",
		"--state",
		"open",
		"--limit",
		String(GH_ISSUE_LIMIT),
		"--json",
		"number,labels,milestone",
	];
}

/**
 * Extract the `## Mission` section body from a PROMPT markdown string.
 *
 * @param {string} markdown
 * @returns {string | null} Mission body text, or null when the section is absent.
 */
export function extractMissionText(markdown) {
	const match = MISSION_SECTION_RE.exec(String(markdown ?? ""));
	return match ? match[1] : null;
}

/**
 * @param {unknown} issue Parsed `gh issue list --json` entry.
 * @returns {{ number: number, labelNames: string[], milestoneTitle: string | null, milestoneNumber: number | null }}
 */
function normalizeGhIssue(issue) {
	const number = Number(issue?.number);
	const labels = Array.isArray(issue?.labels) ? issue.labels : [];
	const labelNames = labels
		.map((label) => String(label?.name ?? "").trim().toLowerCase())
		.filter(Boolean);
	const milestone = issue?.milestone ?? null;
	return {
		number,
		labelNames,
		milestoneTitle: milestone?.title != null ? String(milestone.title).trim() : null,
		milestoneNumber: milestone?.number != null ? Number(milestone.number) : null,
	};
}

/**
 * Filter parsed `gh issue list` entries to the board: an issue is on the
 * board when it carries ANY requested label (case-insensitive) or its
 * milestone matches the requested title (case-insensitive) or number.
 *
 * @param {unknown[]} issues Parsed gh JSON entries.
 * @param {{ labels: string[], milestone: string | null }} filters
 * @returns {number[]} Matching open-issue numbers, ascending.
 */
export function filterIssuesByBoard(issues, { labels, milestone }) {
	const wantedLabels = new Set(
		(Array.isArray(labels) ? labels : [])
			.map((label) => String(label).trim().toLowerCase())
			.filter(Boolean),
	);
	const milestoneRequest = milestone == null ? null : String(milestone).trim();
	const milestoneAsNumber = milestoneRequest !== null && /^\d+$/.test(milestoneRequest)
		? Number(milestoneRequest)
		: null;

	/** @type {number[]} */
	const matched = [];
	for (const raw of issues) {
		const issue = normalizeGhIssue(raw);
		if (!Number.isInteger(issue.number) || issue.number <= 0) continue;
		const labelHit = [...wantedLabels].some((label) => issue.labelNames.includes(label));
		const milestoneHit =
			milestoneRequest !== null &&
			((milestoneAsNumber !== null && issue.milestoneNumber === milestoneAsNumber) ||
				(issue.milestoneTitle !== null &&
					issue.milestoneTitle.toLowerCase() === milestoneRequest.toLowerCase()));
		if (labelHit || milestoneHit) matched.push(issue.number);
	}
	return matched.sort((a, b) => a - b);
}

/**
 * Resolve a GitHub board (label and/or milestone) to pending spine task IDs.
 * Loads config to resolve `tasksRoot`, pulls open issues once via `gh`,
 * discovers task folders, and matches each pending task whose PROMPT Mission
 * links a board issue through the shared SP-887 parser.
 *
 * @param {object} params
 * @param {string} [params.projectRoot]
 * @param {string[]} params.labels Requested labels (any-match; may be empty).
 * @param {string | null} params.milestone Requested milestone title or number.
 * @param {(projectRoot: string, args: string[]) => GhRunResult} [params.runGh] Injectable gh runner.
 * @param {(filePath: string) => string} [params.readTextFile] Injectable PROMPT reader.
 * @param {typeof discoverTasks} [params.discover] Injectable task discovery.
 * @param {string} [params.tasksRoot] Direct tasksRoot override (skips config load; tests).
 * @param {(filePath: string) => boolean} [params.fileExists] Injectable marker probe (`.DONE`/`.SUPERSEDED`).
 * @returns {BoardSelection & { filters: { labels: string[], milestone: string | null } }}
 */
export function resolveBoardTaskIds({
	projectRoot = process.cwd(),
	labels,
	milestone,
	runGh,
	readTextFile,
	discover,
	tasksRoot: tasksRootOverride,
	fileExists,
} = {}) {
	const requestedLabels = (Array.isArray(labels) ? labels : []).map((label) => String(label).trim()).filter(Boolean);
	const requestedMilestone = milestone == null ? null : String(milestone).trim();
	if (requestedLabels.length === 0 && (requestedMilestone === null || requestedMilestone === "")) {
		const err = new Error(
			"Board selection needs at least one --github-label <label> or --milestone <title|number>",
		);
		err.suggestedCommand = "spine plan --github-label <label>";
		throw err;
	}

	const configResult = loadSpineConfig(projectRoot);
	if (configResult.error) {
		const err = new Error(configResult.error.message);
		err.suggestedCommand = configResult.error.suggestedCommand;
		throw err;
	}

	const tasksRoot =
		tasksRootOverride ??
		(() => {
			const configResult = loadSpineConfig(projectRoot);
			if (configResult.error) {
				const err = new Error(configResult.error.message);
				err.suggestedCommand = configResult.error.suggestedCommand;
				throw err;
			}
			const resolved = resolveTasksRootPath(projectRoot, configResult.config);
			if (!resolved) {
				const err = new Error("Cannot resolve board: tasksRoot not configured");
				err.suggestedCommand = missingConfigHint(projectRoot).suggestedCommand;
				throw err;
			}
			return resolved;
		})();

	const run = runGh ?? defaultRunGh;
	const read = readTextFile ?? defaultReadTextFile;
	const findTasks = discover ?? discoverTasks;
	const markerExists = fileExists ?? ((filePath) => fs.existsSync(filePath));

	const ghResult = run(projectRoot, buildGhIssueListArgs());
	if (ghResult.error) {
		const err = new Error(`gh failed: ${ghResult.error.message}`);
		err.suggestedCommand = "gh auth status && gh issue list --state open --limit 5";
		throw err;
	}
	if (ghResult.status !== 0) {
		const detail = (ghResult.stderr || ghResult.stdout || `exit ${ghResult.status}`).trim().slice(0, 300);
		const err = new Error(`gh issue list failed: ${detail}`);
		err.suggestedCommand = "gh auth login  # then re-run board selection";
		throw err;
	}
	/** @type {unknown[]} */
	let issues;
	try {
		const parsed = /** @type {unknown} */ (JSON.parse(ghResult.stdout));
		if (!Array.isArray(parsed)) throw new TypeError("expected a JSON array");
		issues = parsed;
	} catch (err2) {
		const message = err2 instanceof Error ? err2.message : String(err2);
		throw new Error(`gh issue list returned unparseable JSON (${message}); check gh version ≥ 2.x`);
	}

	const boardIssues = filterIssuesByBoard(issues, {
		labels: requestedLabels,
		milestone: requestedMilestone,
	});
	const boardSet = new Set(boardIssues);

	const discovered = findTasks(tasksRoot);

	/** @type {BoardMatch[]} */
	const matches = [];
	/** @type {string[]} */
	const readErrors = [];
	let excludedCount = 0;
	for (const task of discovered) {
		const isPending =
			!markerExists(path.join(task.folderPath, ".DONE")) &&
			!markerExists(path.join(task.folderPath, ".SUPERSEDED"));
		if (!isPending) {
			excludedCount += 1;
			continue;
		}
		/** @type {string | null} */
		let markdown = null;
		try {
			markdown = read(task.promptPath);
		} catch (err3) {
			readErrors.push(`${task.taskId}: ${err3 instanceof Error ? err3.message : String(err3)}`);
			continue;
		}
		const missionText = extractMissionText(markdown);
		if (missionText === null) continue;
		const links = parseMissionIssueLinks(missionText);
		const linked = [...new Set([...links.closes, ...links.partial])].filter((issue) => boardSet.has(issue));
		if (linked.length > 0) matches.push({ taskId: task.taskId, issues: linked });
	}

	matches.sort((a, b) => compareTaskIds(a.taskId, b.taskId));
	return {
		taskIds: matches.map((match) => match.taskId),
		boardIssueCount: boardIssues.length,
		matches,
		excludedCount,
		readErrors,
		filters: { labels: requestedLabels, milestone: requestedMilestone },
	};
}

/**
 * Comma-separated ID list for `spine batch start` / `spine plan` (both accept
 * comma or whitespace separated IDs).
 *
 * @param {string[]} taskIds
 * @returns {string}
 */
export function formatBoardIdList(taskIds) {
	return (Array.isArray(taskIds) ? taskIds : []).join(",");
}

/**
 * Human-readable board selection output, including the explicit non-goal
 * note (selection only — no auto batch start, no always-on poller).
 *
 * @param {object} params
 * @param {{ labels: string[], milestone: string | null }} params.filters
 * @param {number} params.boardIssueCount
 * @param {string[]} params.taskIds
 * @param {string[]} [params.readErrors]
 * @returns {string}
 */
export function formatBoardSelection({ filters, boardIssueCount, taskIds, readErrors = [] }) {
	const filterParts = [];
	if (filters.labels.length > 0) filterParts.push(`label: ${filters.labels.join(", ")}`);
	if (filters.milestone !== null && filters.milestone !== "") {
		filterParts.push(`milestone: ${filters.milestone}`);
	}
	const filterLine = filterParts.length > 0 ? filterParts.join(" · ") : "(none)";

	const lines = [];
	if (taskIds.length === 0) {
		lines.push("Board selection — no match");
		lines.push(`Filters: ${filterLine}`);
		lines.push(`${boardIssueCount} open issue(s) on board → 0 pending task(s) linked.`);
		lines.push("");
		lines.push("No pending task PROMPT links the board's open issues (Mission Closes/Partial).");
	} else {
		lines.push("Board selection — GitHub → pending spine tasks");
		lines.push(`Filters: ${filterLine}`);
		lines.push(`${boardIssueCount} open issue(s) on board → ${taskIds.length} pending task(s) linked.`);
		lines.push("");
		lines.push(formatBoardIdList(taskIds));
		lines.push("");
		lines.push("→ spine batch start <ids>");
		lines.push('→ spine plan "<ids>"');
	}
	for (const readError of readErrors) {
		lines.push(`WARN unreadable PROMPT.md — ${readError}`);
	}
	lines.push("");
	lines.push("Selection only — board select never starts batches and never polls GitHub; re-run to refresh.");
	return lines.join("\n");
}

/**
 * Full board-select CLI path: resolve + format. Used by `bin/spine-plan.mjs`
 * when `--github-label` / `--milestone` are present.
 *
 * @param {object} [params]
 * @param {string} [params.projectRoot]
 * @param {string[]} [params.labels]
 * @param {string | null} [params.milestone]
 * @param {boolean} [params.printIds] Print only the raw comma-separated list.
 * @param {boolean} [params.json]
 * @param {(projectRoot: string, args: string[]) => GhRunResult} [params.runGh]
 * @param {(filePath: string) => string} [params.readTextFile]
 * @param {typeof discoverTasks} [params.discover]
 * @param {string} [params.tasksRoot] Direct tasksRoot override (skips config load; tests).
 * @param {(filePath: string) => boolean} [params.fileExists] Injectable marker probe.
 * @returns {Promise<{ output: string, selection: object }>}
 */
export async function runBoardSelect({
	projectRoot = process.cwd(),
	labels = [],
	milestone = null,
	printIds = false,
	json = false,
	runGh,
	readTextFile,
	discover,
	tasksRoot,
	fileExists,
} = {}) {
	const selection = resolveBoardTaskIds({
		projectRoot,
		labels,
		milestone,
		runGh,
		readTextFile,
		discover,
		tasksRoot,
		fileExists,
	});
	let output;
	if (printIds) {
		output = formatBoardIdList(selection.taskIds);
	} else if (json) {
		output = JSON.stringify(selection, null, 2);
	} else {
		output = formatBoardSelection(selection);
	}
	return { output, selection };
}
