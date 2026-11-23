/**
 * Opt-in GitHub issue sync on land (SP-887 / #383).
 *
 * After a successful integrate (`.DONE` tasks on the batch base), comment on
 * and close issues referenced by task Mission `Closes #N` / `Partial #N`
 * links (format per #147). Strictly opt-in via `integrations.issues.syncOnLand`
 * (default off); every failure path is soft — integrate results never change
 * because `gh` is missing, unauthenticated, or a single issue call fails.
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { parseMissionIssueLinks } from "./mission-issue-links.mjs";
import { commandExists } from "../../util/command-exists.mjs";
import { appendJournalEvent } from "../../batch/journal.mjs";
import { resolveTasksRootPath } from "../../config/env-overrides.mjs";

/** Terminal-success statuses whose `.DONE` landed work on the batch base. */
const DONE_ON_BASE_STATUSES = new Set(["completed", "succeeded"]);

/** Hard timeout per `gh` call so a hung CLI cannot stall the integrate path. */
const GH_CALL_TIMEOUT_MS = 30_000;

/** Directory (relative to projectRoot) for temp comment body files. */
const BODY_DIR = path.join(".spine", "github-sync");

/**
 * @typedef {import("./mission-issue-links.mjs").MissionIssueLinks} MissionIssueLinks
 */

/**
 * @typedef {object} GhRunResult
 * @property {number | null} status
 * @property {string} [stdout]
 * @property {string} [stderr]
 * @property {Error | null} [error]
 */

/**
 * Resolve the opt-in flag (forge-neutral `integrations.issues` since SP-890/#387;
 * legacy `integrations.github` is rejected at config validation). Missing/invalid
 * config disables sync (default off).
 *
 * @param {Record<string, any> | null | undefined} config Effective spine config.
 * @returns {boolean} True only when `integrations.issues.syncOnLand === true`.
 */
export function resolveIssueSyncOnLandConfig(config) {
	return config?.integrations?.issues?.syncOnLand === true;
}

/**
 * Tasks whose `.DONE` is on the batch base after a successful integrate:
 * terminal-success tasks only (`completed`/`succeeded`; `skipped` lands no
 * work, so its Mission issues must not be closed). Returns `{taskId,
 * taskFolder}` pairs for PROMPT lookup.
 *
 * @param {{ tasks?: Array<{ taskId?: unknown, status?: unknown, taskFolder?: unknown }> } | null | undefined} batch Parsed batch state.
 * @returns {Array<{ taskId: string, taskFolder: string | null }>}
 */
export function collectDoneOnBaseTasks(batch) {
	const tasks = Array.isArray(batch?.tasks) ? batch.tasks : [];
	/** @type {Array<{ taskId: string, taskFolder: string | null }>} */
	const done = [];
	for (const task of tasks) {
		if (!task || typeof task !== "object") continue;
		const status = String(task.status ?? "").toLowerCase();
		const taskId = String(task.taskId ?? "").trim();
		if (!DONE_ON_BASE_STATUSES.has(status) || taskId === "") continue;
		const taskFolder = task.taskFolder ? String(task.taskFolder) : null;
		done.push({ taskId, taskFolder });
	}
	return done;
}

/**
 * Default `gh` runner: array-args spawn (no shell), piped output, hard timeout.
 *
 * @param {string} projectRoot
 * @param {string[]} args
 * @returns {GhRunResult}
 */
function defaultRunGh(projectRoot, args) {
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
 * @param {string} filePath
 * @returns {string}
 */
function defaultReadTextFile(filePath) {
	return fs.readFileSync(filePath, "utf-8");
}

/**
 * Parse issue links from every `.DONE`-on-base task's PROMPT Mission.
 *
 * @param {object} params
 * @param {string} params.tasksRoot Resolved tasks root (absolute).
 * @param {Array<{ taskId: string, taskFolder: string | null }>} params.tasks DONE-on-base tasks.
 * @param {(filePath: string) => string} [params.readTextFile] Injectable reader.
 * @returns {{ links: Array<{ taskId: string, issue: number, action: "close"|"comment" }>, readErrors: string[] }}
 */
export function collectIssueLinksFromTasks({ tasksRoot, tasks, readTextFile = defaultReadTextFile }) {
	const read = readTextFile ?? defaultReadTextFile;
	/** @type {Array<{ taskId: string, issue: number, action: "close"|"comment" }>} */
	const links = [];
	/** @type {string[]} */
	const readErrors = [];
	for (const task of tasks) {
		const folder = task.taskFolder ?? task.taskId;
		const promptPath = path.join(tasksRoot, folder, "PROMPT.md");
		/** @type {string | null} */
		let markdown = null;
		try {
			markdown = read(promptPath);
		} catch (err) {
			readErrors.push(
				`${task.taskId}: ${err instanceof Error ? err.message : String(err)}`,
			);
			continue;
		}
		const missionMatch = /^## Mission\s*\n([\s\S]*?)(?=^## |\s*$)/m.exec(markdown);
		const missionText = missionMatch ? missionMatch[1] : markdown;
		const parsed = /** @type {MissionIssueLinks} */ (parseMissionIssueLinks(missionText));
		for (const issue of parsed.closes) {
			links.push({ taskId: task.taskId, issue, action: "close" });
		}
		for (const issue of parsed.partial) {
			links.push({ taskId: task.taskId, issue, action: "comment" });
		}
	}
	return { links, readErrors };
}

/**
 * Build the land-comment body for one issue.
 *
 * @param {object} params
 * @param {string} params.taskId
 * @param {string} params.batchId
 * @param {string | null} params.mergeCommit
 * @param {"close"|"comment"} params.action
 * @returns {string}
 */
export function buildLandCommentBody({ taskId, batchId, mergeCommit, action }) {
	const commitLine = mergeCommit ? `- Merge commit: \`${mergeCommit}\`\n` : "";
	if (action === "close") {
		return [
			`Landed on \`main\` by **${taskId}** (batch \`${batchId}\`).`,
			"",
			commitLine +
				"- Closed automatically by spine (`integrations.issues.syncOnLand`).",
			"",
		].join("\n");
	}
	return [
		`Partially addressed on \`main\` by **${taskId}** (batch \`${batchId}\`) — issue left open.`,
		"",
		commitLine +
			"- Commented automatically by spine (`integrations.issues.syncOnLand`).",
		"",
	].join("\n");
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.batchId
 * @param {number} params.issue
 * @param {string} params.body
 * @returns {{ filePath: string, cleanup: () => void }}
 */
function writeCommentBodyFile({ projectRoot, batchId, issue, body }) {
	const dir = path.join(projectRoot, BODY_DIR);
	fs.mkdirSync(dir, { recursive: true });
	const filePath = path.join(dir, `${batchId}-issue-${issue}.md`);
	fs.writeFileSync(filePath, body, "utf-8");
	return {
		filePath,
		cleanup: () => {
			try {
				fs.unlinkSync(filePath);
			} catch {
				// Best-effort cleanup of the temp body file.
			}
		},
	};
}

/** @typedef {(projectRoot: string, batchId: string, type: string, payload?: Record<string, unknown>) => void} JournalAppendFn */

/**
 * Integrate entry point (#383): resolve the `.DONE`-on-base task set and
 * tasksRoot from batch state + effective config, then run the sync. Best-effort
 * only — never throws into the integrate success path; internal errors journal
 * as `github.issue_sync_failed` instead of failing the integrate.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.batchId
 * @param {object} params.batch Parsed batch state.
 * @param {Record<string, any> | null | undefined} params.config Effective spine config (null → sync disabled).
 * @param {string | null} [params.mergeCommit] Integrate merge commit.
 * @param {boolean} [params.noGithubSync] `--no-github-sync` escape hatch.
 * @param {(projectRoot: string, args: string[]) => GhRunResult} [params.runGh] Injectable gh runner.
 * @param {(cmd: string) => boolean} [params.ghPresent] Injectable gh probe.
 * @param {JournalAppendFn} [params.journalAppend] Injectable journal appender.
 * @param {(filePath: string) => string} [params.readTextFile] Injectable PROMPT reader.
 * @returns {object | null} Sync summary, or null when the sync crashed internally.
 */
export function syncIssuesAfterIntegrate({
	projectRoot,
	batchId,
	batch,
	config,
	mergeCommit = null,
	noGithubSync = false,
	runGh,
	ghPresent,
	journalAppend,
	readTextFile,
}) {
	try {
		return syncIssuesOnLand({
			projectRoot,
			batchId,
			doneTasks: collectDoneOnBaseTasks(batch),
			tasksRoot: config ? resolveTasksRootPath(projectRoot, config) : null,
			config,
			mergeCommit,
			noGithubSync,
			runGh,
			ghPresent,
			journalAppend,
			readTextFile,
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		try {
			const journal = journalAppend ?? appendJournalEvent;
			journal(projectRoot, batchId, "github.issue_sync_failed", {
				reason: "internal_error",
				error: message.slice(0, 500),
				hint: "spine status --diagnose",
			});
		} catch {
			// Journal append must never mask the integrate success path.
		}
		return null;
	}
}

/**
 * Sync GitHub issues for tasks whose `.DONE` landed on the batch base.
 * Never throws and never signals integrate failure: every problem degrades to
 * a journal event plus a `hint` the CLI can surface.
 *
 * @param {object} params
 * @param {string} params.projectRoot Project root (gh cwd, journal root).
 * @param {string} params.batchId Active batch id.
 * @param {Array<{ taskId: string, taskFolder?: string | null }>} params.doneTasks `.DONE`-on-base tasks.
 * @param {string | null} params.tasksRoot Resolved tasks root (null → skip).
 * @param {Record<string, any> | null | undefined} params.config Effective config.
 * @param {string | null} [params.mergeCommit] Integrate merge commit.
 * @param {boolean} [params.dryRun] Plan only — no gh calls, no journal.
 * @param {boolean} [params.noGithubSync] `--no-github-sync` escape hatch.
 * @param {(projectRoot: string, args: string[]) => GhRunResult} [params.runGh] Injectable gh runner.
 * @param {(cmd: string) => boolean} [params.ghPresent] Injectable gh probe.
 * @param {JournalAppendFn} [params.journalAppend] Injectable journal appender.
 * @param {(filePath: string) => string} [params.readTextFile] Injectable PROMPT reader.
 * @returns {{
 *   ok: boolean,
 *   skipped: boolean,
 *   softFailed: boolean,
 *   dryRun?: boolean,
 *   reason: string | null,
 *   hint: string | null,
 *   synced: Array<{ taskId: string, issue: number, action: string, closed: boolean }>,
 *   failures: Array<{ taskId: string, issue: number, action: string, error: string }>,
 *   planned: Array<{ taskId: string, issue: number, action: string }>,
 * }}
 */
export function syncIssuesOnLand({
	projectRoot,
	batchId,
	doneTasks,
	tasksRoot,
	config,
	mergeCommit = null,
	dryRun = false,
	noGithubSync = false,
	runGh,
	ghPresent,
	journalAppend,
	readTextFile,
}) {
	const run = runGh ?? ((/** @type {string} */ root, /** @type {string[]} */ args) => defaultRunGh(root, args));
	const present = ghPresent ?? commandExists;
	const journal = journalAppend ?? appendJournalEvent;
	const read = readTextFile ?? defaultReadTextFile;

	/** @type {Array<{ taskId: string, issue: number, action: string }>} */
	const planned = [];
	/** @type {Array<{ taskId: string, issue: number, action: string, closed: boolean }>} */
	const synced = [];
	/** @type {Array<{ taskId: string, issue: number, action: string, error: string }>} */
	const failures = [];

	const skip = (/** @type {string} */ reason, /** @type {string | null} */ hint = null) => ({
		ok: true,
		skipped: true,
		softFailed: false,
		reason,
		hint,
		synced,
		failures,
		planned,
	});

	if (noGithubSync) {
		return skip("no_github_sync_flag");
	}
	if (!resolveIssueSyncOnLandConfig(config)) {
		return skip("sync_disabled");
	}
	if (!tasksRoot) {
		return skip("no_tasks_root", "Set paths.tasksRoot in spine-config.json");
	}

	let collection;
	try {
		collection = collectIssueLinksFromTasks({
			tasksRoot,
			tasks: doneTasks.map((task) => ({
				taskId: task.taskId,
				taskFolder: task.taskFolder ?? null,
			})),
			readTextFile: read,
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		journal(projectRoot, batchId, "github.issue_sync_failed", {
			reason: "parse_error",
			error: message.slice(0, 500),
			hint: "spine status --diagnose",
		});
		return skip("parse_error");
	}
	planned.push(...collection.links);
	for (const readError of collection.readErrors) {
		journal(projectRoot, batchId, "github.issue_sync_failed", {
			reason: "prompt_unreadable",
			error: readError.slice(0, 500),
			hint: "spine status --diagnose",
		});
	}
	if (planned.length === 0) {
		return collection.readErrors.length > 0 ? skip("prompt_unreadable") : skip("no_issue_links");
	}

	if (dryRun) {
		return {
			ok: true,
			skipped: false,
			softFailed: false,
			dryRun: true,
			reason: null,
			hint: null,
			synced,
			failures,
			planned: [...planned],
		};
	}

	if (!present("gh")) {
		journal(projectRoot, batchId, "github.issue_sync_failed", {
			reason: "gh_missing",
			hint: "Install GitHub CLI (https://cli.github.com/) or disable integrations.issues.syncOnLand",
		});
		return skip("gh_missing", "Install GitHub CLI (https://cli.github.com/) or disable integrations.issues.syncOnLand");
	}

	const auth = run(projectRoot, ["auth", "status"]);
	if ((auth.status ?? 1) !== 0) {
		const stderr = (auth.stderr ?? "").trim().slice(0, 500);
		journal(projectRoot, batchId, "github.issue_sync_failed", {
			reason: "gh_auth",
			error: stderr,
			hint: "Run `gh auth login`, then re-run `spine integrate` (or close manually per the release-operator runbook §4.3c)",
		});
		return skip("gh_auth", "Run `gh auth login`, then re-run `spine integrate` (or close manually per the release-operator runbook §4.3c)");
	}

	for (const link of planned) {
		const { taskId, issue, action } = link;
		const body = buildLandCommentBody({ taskId, batchId, mergeCommit, action: /** @type {"close"|"comment"} */ (action) });
		let bodyFile = null;
		try {
			bodyFile = writeCommentBodyFile({ projectRoot, batchId, issue, body });
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			failures.push({ taskId, issue, action, error: message });
			journal(projectRoot, batchId, "github.issue_sync_failed", {
				issue,
				action,
				taskId,
				reason: "body_write_failed",
				error: message.slice(0, 500),
			});
			continue;
		}

		const comment = run(projectRoot, ["issue", "comment", String(issue), "--body-file", bodyFile.filePath]);
		if ((comment.status ?? 1) !== 0) {
			const stderr = (comment.stderr ?? comment.stdout ?? "").trim().slice(0, 500) || "gh issue comment failed";
			failures.push({ taskId, issue, action, error: stderr });
			journal(projectRoot, batchId, "github.issue_sync_failed", {
				issue,
				action,
				taskId,
				reason: "comment_failed",
				error: stderr,
				hint: "spine status --diagnose",
			});
			bodyFile.cleanup();
			continue;
		}

		let closed = false;
		if (action === "close") {
			const close = run(projectRoot, ["issue", "close", String(issue), "--reason", "completed"]);
			if ((close.status ?? 1) !== 0) {
				const stderr = (close.stderr ?? close.stdout ?? "").trim().slice(0, 500) || "gh issue close failed";
				failures.push({ taskId, issue, action, error: stderr });
				journal(projectRoot, batchId, "github.issue_sync_failed", {
					issue,
					action,
					taskId,
					reason: "close_failed",
					error: stderr,
					hint: `gh issue close ${issue} --reason completed`,
				});
				bodyFile.cleanup();
				continue;
			}
			closed = true;
		}
		bodyFile.cleanup();
		synced.push({ taskId, issue, action, closed });
		journal(projectRoot, batchId, "github.issue_synced", {
			issue,
			action,
			taskId,
			closed,
			mergeCommit,
		});
	}

	return {
		ok: true,
		skipped: false,
		softFailed: failures.length > 0 && synced.length === 0,
		reason: null,
		hint: null,
		synced,
		failures,
		planned: [...planned],
	};
}
