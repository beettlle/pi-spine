#!/usr/bin/env node
/**
 * Worker runner invoked by spine engine in lane worktree.
 * --stub: create .DONE for CI / tests when pi is unavailable.
 * --pi: run `pi -p` with task PROMPT unless SPINE_WORKER_PI_AGENT=0.
 *
 * Batch context env (set by worker-host.mjs, inherited by pi child):
 *   SPINE_TASK_FOLDER   — absolute path to taskplane-tasks/TP-NNN-…/
 *   SPINE_WORKTREE      — lane git worktree root
 *   SPINE_PROJECT_ROOT  — pi-spine project root (journal + gate paths)
 *   SPINE_RULES_PROJECT_ROOT — lane worktree for rules manifest reads (SP-317)
 *   SPINE_BATCH_ID      — active batch id
 *   SPINE_TASK_ID       — e.g. TP-038
 *   SPINE_LANE_NUMBER   — 1-based lane index
 *   SPINE_LANE_ID       — optional alias (falls back to lane number in CLIs)
 *   SPINE_LANE_CORRELATION_ID — journal correlation id for this lane run
 *   SPINE_JOURNAL_ATTACH — "1" when batch journal writes are enabled
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
	assertReviewToolAvailable,
	readReviewLevel,
	resolveBatchJournalContext,
	runStepReview,
} from "../src/batch/review.mjs";
import { reportTaskProgress } from "../src/worker-tools/report-progress.mjs";
import { isCliEntrypoint } from "./spine-cli/shared.mjs";
import { loadSpineConfig } from "./spine-config.mjs";
import { buildWorkerTailPrompt, taskIdFromFolder } from "../src/batch/worker-prompt.mjs";
import { parsePrompt } from "../src/tasks/packet/parse-prompt.mjs";

function buildReviewJournal() {
	return resolveBatchJournalContext();
}

/**
 * Append worker model/thinking flags from spine-config (mirrors reviewer spawn in review.mjs).
 *
 * @param {string[]} piArgs
 * @param {object} [config]
 */
export function appendWorkerAgentModelArgs(piArgs, config = {}) {
	const workerModel = config?.agents?.worker?.model;
	const workerThinking = config?.agents?.worker?.thinking;
	if (workerModel && workerModel !== "inherit") {
		piArgs.push("--model", workerModel);
	}
	if (workerThinking && workerThinking !== "off") {
		piArgs.push("--thinking", workerThinking);
	}
}

/**
 * Build argv for `pi -p` worker spawn (exported for unit tests).
 *
 * @param {object} options
 * @param {string|null|undefined} options.worktreePath
 * @param {string} options.taskFolder
 * @param {string} options.donePath
 * @param {object} [options.spineConfig]
 * @param {ReturnType<typeof resolveBatchJournalContext>} [options.journal]
 * @returns {Promise<string[]>}
 */
export async function buildWorkerPiArgs({
	worktreePath,
	taskFolder,
	donePath,
	spineConfig = {},
	journal = buildReviewJournal(),
}) {
	const promptPath = path.join(taskFolder, "PROMPT.md");
	const workerAgentPath = worktreePath
		? path.join(worktreePath, ".spine", "agents", "worker.md")
		: null;

	const piArgs = ["-p", "--no-session"];
	if (workerAgentPath && fs.existsSync(workerAgentPath)) {
		piArgs.push("--append-system-prompt", workerAgentPath);
	}
	if (fs.existsSync(promptPath)) {
		piArgs.push(`@${promptPath}`);
	}
	appendWorkerAgentModelArgs(piArgs, spineConfig);
	const projectRoot =
		process.env.SPINE_RULES_PROJECT_ROOT || worktreePath || process.env.SPINE_PROJECT_ROOT || process.cwd();
	const taskFileScope = resolveTaskFileScope(taskFolder);
	const tailPrompt = await buildWorkerTailPrompt({
		worktreePath,
		taskFolder,
		donePath,
		taskIdHint: taskIdFromFolder(taskFolder),
		reviewLevel: readReviewLevel(taskFolder),
		includePromptInclude: false,
		config: spineConfig,
		projectRoot,
		taskFileScope,
		journal,
	});
	piArgs.push(tailPrompt);
	return piArgs;
}

/**
 * @param {string} taskFolder
 * @returns {string[]}
 */
function resolveTaskFileScope(taskFolder) {
	const envScope = process.env.SPINE_TASK_FILE_SCOPE;
	if (envScope) {
		try {
			const parsed = JSON.parse(envScope);
			if (Array.isArray(parsed)) {
				return parsed.filter((entry) => typeof entry === "string");
			}
		} catch {
			/* fall through to PROMPT parse */
		}
	}

	const promptPath = path.join(taskFolder, "PROMPT.md");
	if (!fs.existsSync(promptPath)) {
		return [];
	}
	return parsePrompt(fs.readFileSync(promptPath, "utf-8")).fileScope ?? [];
}

async function enforceStubReviewIfConfigured(taskFolder, worktreePath) {
	if (process.env.SPINE_WORKER_STUB_ENFORCE_REVIEW !== "1") return;
	if (readReviewLevel(taskFolder) <= 0) return;

	const reviewResult = await runStepReview({
		taskFolder,
		worktreePath: worktreePath || process.cwd(),
		stepNumber: Number(process.env.SPINE_WORKER_STUB_REVIEW_STEP || 1),
		reviewType: process.env.SPINE_WORKER_STUB_REVIEW_TYPE === "code" ? "code" : "plan",
		stub: true,
		journal: buildReviewJournal(),
	});

	if (!reviewResult.ok) {
		console.error(reviewResult.error ?? `review failed: ${reviewResult.verdict ?? "spawn"}`);
		process.exit(reviewResult.exitCode ?? 1);
	}
}

async function runWorkerRunner() {
	const taskFolder = process.env.SPINE_TASK_FOLDER;
	const worktreePath = process.env.SPINE_WORKTREE;
	if (!taskFolder) {
		console.error("SPINE_TASK_FOLDER required");
		process.exit(1);
	}

	const reviewGate = assertReviewToolAvailable({ taskFolder });
	if (!reviewGate.ok) {
		console.error(reviewGate.error);
		process.exit(1);
	}

	const mode = process.argv.includes("--stub") ? "stub" : "pi";

	if (mode === "stub") {
		const taskIdFromFolder = path.basename(taskFolder).match(/^([A-Z]+-\d+)/)?.[1] ?? "";
		const failTasks = String(process.env.SPINE_WORKER_STUB_FAIL_TASKS ?? "")
			.split(/[,\s]+/)
			.filter(Boolean);
		if (failTasks.includes(taskIdFromFolder)) {
			const dirtyRel = process.env.SPINE_WORKER_STUB_DIRTY_FILE;
			if (dirtyRel && worktreePath) {
				const dirtyPath = path.join(worktreePath, dirtyRel);
				fs.mkdirSync(path.dirname(dirtyPath), { recursive: true });
				fs.writeFileSync(dirtyPath, `stub dirty ${new Date().toISOString()}\n`, "utf-8");
			}
			console.error(`stub worker forced failure for ${taskIdFromFolder}`);
			process.exit(1);
		}

		if (process.env.SPINE_WORKER_STUB_SAT020 === "1") {
			const journal = buildReviewJournal();
			const laneNumber = Number(process.env.SPINE_LANE_NUMBER || 1);
			const taskId = process.env.SPINE_TASK_ID || taskIdFromFolder;
			const correlationId = process.env.SPINE_LANE_CORRELATION_ID;
			// Let the host poll once before checkpoint signals land.
			spawnSync("sleep", ["1"], { stdio: "ignore" });
			if (journal?.projectRoot && journal?.batchId && taskId) {
				for (const step of [0, 1]) {
					reportTaskProgress({
						projectRoot: journal.projectRoot,
						batchId: journal.batchId,
						taskId,
						laneNumber,
						step,
						checkboxesComplete: step + 1,
						checkboxesTotal: 2,
						correlationId,
					});
				}
			}
			// Separate poll epochs: checkpoint progress first, then file-scope activity only.
			spawnSync("sleep", ["4"], { stdio: "ignore" });
			const scopeRel = process.env.SPINE_WORKER_STUB_FILE_SCOPE;
			const postScopeMs = Number(process.env.SPINE_WORKER_STUB_SAT020_POST_SCOPE_MS || 10_000);
			const scopeBumpMs = Math.min(5_000, Math.max(0, postScopeMs));
			const postScopeRemainderMs = Math.max(0, postScopeMs - scopeBumpMs);
			if (scopeRel && worktreePath) {
				const scopePath = path.join(worktreePath, scopeRel);
				fs.mkdirSync(path.dirname(scopePath), { recursive: true });
				fs.writeFileSync(scopePath, `sat020 scope touch ${new Date().toISOString()}\n`, "utf-8");
				if (scopeBumpMs > 0) {
					spawnSync("sleep", [String(scopeBumpMs / 1000)], { stdio: "ignore" });
					// Second touch gives the host a fresh activity epoch after step_completed settles.
					fs.writeFileSync(scopePath, `sat020 scope touch ${new Date().toISOString()}\n`, "utf-8");
				}
			}
			if (postScopeRemainderMs > 0) {
				spawnSync("sleep", [String(postScopeRemainderMs / 1000)], { stdio: "ignore" });
			}
		}

		const delayMs = Number(process.env.SPINE_WORKER_STUB_DELAY_MS || 0);
		const hangMs = Number(process.env.SPINE_WORKER_STUB_HANG_MS || 0);
		if (process.env.SPINE_WORKER_STUB_OUTPUT) {
			console.error(process.env.SPINE_WORKER_STUB_OUTPUT);
		}
		if (hangMs > 0 || process.env.SPINE_WORKER_STUB_SAT020 === "1") {
			const effectiveHang =
				hangMs > 0 ? hangMs : Number(process.env.SPINE_WORKER_STUB_SAT020_HANG_MS || 25_000);
			const step = 100;
			let elapsed = 0;
			while (elapsed < effectiveHang) {
				const slice = Math.min(step, effectiveHang - elapsed);
				spawnSync("sleep", [String(slice / 1000)], { stdio: "ignore" });
				elapsed += slice;
			}
			console.error("stub worker hang finished without .DONE");
			process.exit(1);
		}

		if (delayMs > 0) {
			const dirtyRel = process.env.SPINE_WORKER_STUB_DIRTY_FILE;
			if (dirtyRel && worktreePath) {
				const dirtyPath = path.join(worktreePath, dirtyRel);
				fs.mkdirSync(path.dirname(dirtyPath), { recursive: true });
				fs.writeFileSync(dirtyPath, `stub dirty ${new Date().toISOString()}\n`, "utf-8");
			}
			spawnSync("sleep", [String(delayMs / 1000)], { stdio: "ignore" });
		}
		if (process.env.SPINE_WORKER_STUB_TOUCH === "1" && worktreePath) {
			fs.writeFileSync(
				path.join(worktreePath, "stub-worker-touch.txt"),
				`stub touch ${new Date().toISOString()}\n`,
				"utf-8",
			);
		}

		await enforceStubReviewIfConfigured(taskFolder, worktreePath);

		const donePath = path.join(taskFolder, ".DONE");
		fs.writeFileSync(
			donePath,
			`Completed: ${new Date().toISOString()}\nTask: stub\n`,
			"utf-8",
		);
		process.exit(0);
	}

	const version = spawnSync("pi", ["--version"], { encoding: "utf-8" });
	if (version.status !== 0) {
		console.error("pi not available:", version.stderr);
		process.exit(1);
	}

	const donePath = path.join(taskFolder, ".DONE");
	if (fs.existsSync(donePath)) {
		process.exit(0);
	}

	if (process.env.SPINE_WORKER_PI_AGENT === "0") {
		console.error(
			"pi worker mode requires manual agent completion (.DONE in task folder). Set SPINE_WORKER_PI_AGENT=1 to run pi -p.",
		);
		process.exit(1);
	}

	const projectRoot = process.env.SPINE_PROJECT_ROOT || worktreePath || process.cwd();
	const spineConfig = loadSpineConfig(projectRoot).config ?? {};
	const piArgs = await buildWorkerPiArgs({
		worktreePath,
		taskFolder,
		donePath,
		spineConfig,
		journal: buildReviewJournal(),
	});

	const timeoutMs = Number(process.env.SPINE_WORKER_PI_TIMEOUT_MS || 60 * 60 * 1000);
	const result = spawnSync("pi", piArgs, {
		cwd: worktreePath || process.cwd(),
		encoding: "utf-8",
		timeout: timeoutMs,
	});

	if (result.error?.code === "ETIMEDOUT") {
		console.error("pi worker timed out");
		process.exit(124);
	}

	if (result.status !== 0) {
		process.stderr.write(result.stderr ?? "");
		process.stdout.write(result.stdout ?? "");
		process.exit(result.status ?? 1);
	}

	if (!fs.existsSync(donePath)) {
		console.error("pi exited but .DONE was not created");
		process.exit(1);
	}

	process.exit(0);
}

if (isCliEntrypoint(import.meta.url)) {
	await runWorkerRunner();
}
