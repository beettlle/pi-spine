// @ts-nocheck
/**
 * Matrix sub-lane execution (SP-671 / #217).
 *
 * Because `buildPlan` does not propagate `matrix` into its `tasksById`, the
 * planner's virtual sub-lane expansion is inert in production. The engine
 * therefore drives matrix execution itself: when a task's packet declares a
 * `## Matrix` table, each row is run as an independent sub-lane in its own
 * worktree, the substituted command (execution-only or LLM worker) runs per
 * row, and the parent task aggregates the per-row outcomes.
 *
 * A matrix task succeeds only when every row succeeds; any failed row fails the
 * whole task and surfaces the failing row id. Rows respect `lanes.maxParallel`.
 */

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { batchWorktreeDir } from "../worktree.mjs";
import { loadTaskPacket } from "../../tasks/packet/index.mjs";
import {
	deriveMatrixRowId,
	substituteMatrixVariables,
} from "../../planner/matrix.mjs";
import { gitExec } from "../git-exec.mjs";
import {
	normalizeLaneWorktreeGitPaths,
	runWorktreeSetupHook,
} from "../worktree.mjs";
import { resolveWorktreeSetupHook } from "../../config/worktree-setup-hook.mjs";
import { appendJournalEvent } from "../journal.mjs";

/**
 * Read a task folder's packet and extract its matrix rows, or null when the
 * task is not a matrix task.
 *
 * @param {string} taskFolderPath Absolute path to the task folder (parent for matrix).
 * @returns {{ rows: Array<{ rowId: string, values: Record<string,string> }>, columns: string[], type: string } | null}
 */
export function loadMatrixTaskRows(taskFolderPath) {
	if (!taskFolderPath || !fs.existsSync(path.join(taskFolderPath, "PROMPT.md"))) {
		return null;
	}
	let packet;
	try {
		packet = loadTaskPacket(taskFolderPath);
	} catch {
		return null;
	}
	const prompt = packet?.prompt;
	const matrix = Array.isArray(prompt?.matrix) ? prompt.matrix : null;
	if (!matrix || matrix.length === 0) return null;
	const columns = Array.isArray(prompt.matrixColumns) ? prompt.matrixColumns : [];
	const rows = matrix.map((values) => ({
		rowId: deriveMatrixRowId(values, columns),
		values,
	}));
	return { rows, columns, type: prompt.type === "execute" ? "execute" : "llm" };
}

/**
 * Slugify a token for use in worktree dir names and git branch names.
 * Keeps it filesystem- and ref-safe: lowercase, `[a-z0-9_]+`, `_` for separators.
 *
 * @param {string} token
 * @returns {string}
 */
export function slugifyMatrixToken(token) {
	return String(token ?? "")
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "") || "row";
}

/**
 * Deterministic worktree directory name for a matrix sub-lane.
 * Matches the PROMPT example shape `lane-1-sp-669-a_shell_a`.
 *
 * @param {number} laneNumber
 * @param {string} parentTaskId
 * @param {string} rowId
 * @returns {string}
 */
export function matrixWorktreeDir(laneNumber, parentTaskId, rowId) {
	const parentSlug = slugifyMatrixToken(parentTaskId);
	const rowSlug = slugifyMatrixToken(rowId);
	return `lane-${laneNumber}-${parentSlug}-${rowSlug}`;
}

/**
 * Absolute worktree path for a matrix sub-lane, nested under the batch worktree dir.
 *
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {number} laneNumber
 * @param {string} parentTaskId
 * @param {string} rowId
 * @returns {string}
 */
export function matrixWorktreePath(projectRoot, batchId, laneNumber, parentTaskId, rowId) {
	const dir = matrixWorktreeDir(laneNumber, parentTaskId, rowId);
	return path.join(projectRoot, ".worktrees", `spine-${batchId}`, dir);
}

/**
 * Deterministic git branch name for a matrix sub-lane.
 *
 * @param {string} batchId
 * @param {number} laneNumber
 * @param {string} parentTaskId
 * @param {string} rowId
 * @returns {string}
 */
export function matrixSubLaneBranch(batchId, laneNumber, parentTaskId, rowId) {
	const parentSlug = slugifyMatrixToken(parentTaskId);
	const rowSlug = slugifyMatrixToken(rowId);
	return `task/spine-matrix-${laneNumber}-${batchId}-${parentSlug}-${rowSlug}`;
}

/**
 * Provision a dedicated worktree for a matrix sub-lane off `baseRef` (the lane
 * task branch). Reuses git-worktree provisioning + gitdir normalization so host
 * and devcontainer git both stay healthy (SP-101).
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.batchId
 * @param {number} params.laneNumber
 * @param {string} params.parentTaskId
 * @param {string} params.rowId
 * @param {string} params.baseRef Git ref the row worktree branches from.
 * @returns {{ worktreePath: string, branch: string }}
 */
export function provisionMatrixSubLaneWorktree({
	projectRoot,
	batchId,
	laneNumber,
	parentTaskId,
	rowId,
	baseRef,
}) {
	const worktreePath = matrixWorktreePath(projectRoot, batchId, laneNumber, parentTaskId, rowId);
	const branch = matrixSubLaneBranch(batchId, laneNumber, parentTaskId, rowId);
	if (fs.existsSync(worktreePath)) {
		throw new Error(`Matrix sub-lane worktree already exists: ${worktreePath}`);
	}
	fs.mkdirSync(path.dirname(worktreePath), { recursive: true });
	gitExec(projectRoot, ["worktree", "add", "-b", branch, worktreePath, baseRef]);
	normalizeLaneWorktreeGitPaths({ projectRoot, worktreePath });
	return { worktreePath, branch };
}

/**
 * Run the configured `worktreeSetupHook` for a matrix sub-lane worktree, mirroring
 * the parent-lane provision→hook sequence (SP-688 / #224).
 *
 * Each matrix row runs in its own freshly-provisioned worktree, so gitignored
 * toolchains (e.g. `.venv`) and symlinked assets that live on the main checkout
 * would be absent there — the hook links them in before the row's runCommand /
 * worker executes. Without this, rows that depend on those assets fail in ways
 * that never reproduce on a parent lane, masking the missing setup.
 *
 * Journals `matrix.sub_lane.setup_hook.*` lifecycle events. When a hook is
 * configured it runs with the same env (SPINE_PROJECT_ROOT / SPINE_WORKTREE /
 * SPINE_BATCH_ID / SPINE_LANE_NUMBER) and JSON-stdout contract as parent lanes.
 * On hook failure it rethrows so the caller surfaces the failure on the matrix
 * row (fail closed — never silently continue into runCommand). When no hook is
 * configured it is a no-op (skipped).
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.worktreePath
 * @param {string} params.batchId
 * @param {number} params.laneNumber
 * @param {string} params.taskId
 * @param {string} params.rowId
 * @param {string} [params.correlationId]
 * @param {object} [params.config]
 * @returns {{ ok: boolean, skipped?: boolean, durationMs?: number }}
 */
export function runMatrixSubLaneSetupHook({
	projectRoot,
	worktreePath,
	batchId,
	laneNumber,
	taskId,
	rowId,
	correlationId,
	config = {},
}) {
	const hookPath = resolveWorktreeSetupHook(projectRoot, config);
	if (!hookPath) {
		return { ok: true, skipped: true };
	}

	recordMatrixEvent(projectRoot, batchId, "matrix.sub_lane.setup_hook.started", {
		taskId,
		laneNumber,
		rowId,
		correlationId,
		worktreePath,
		hookPath,
	});
	try {
		const hookResult = runWorktreeSetupHook({
			projectRoot,
			worktreePath,
			batchId,
			laneNumber,
			config,
		});
		recordMatrixEvent(projectRoot, batchId, "matrix.sub_lane.setup_hook.completed", {
			taskId,
			laneNumber,
			rowId,
			correlationId,
			worktreePath,
			durationMs: hookResult.durationMs,
		});
		return { ok: true, durationMs: hookResult.durationMs };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		recordMatrixEvent(projectRoot, batchId, "matrix.sub_lane.setup_hook.failed", {
			taskId,
			laneNumber,
			rowId,
			correlationId,
			worktreePath,
			error: message,
		});
		throw err;
	}
}

/**
 * Remove a matrix sub-lane worktree and its branch. Idempotent.
 *
 * @param {string} projectRoot
 * @param {string} worktreePath
 * @param {string} [branch]
 */
export function removeMatrixSubLaneWorktree(projectRoot, worktreePath, branch) {
	if (worktreePath && fs.existsSync(worktreePath)) {
		try {
			gitExec(projectRoot, ["worktree", "remove", "--force", worktreePath], {
				throwOnError: false,
			});
		} catch {
			fs.rmSync(worktreePath, { recursive: true, force: true, maxRetries: 3 });
		}
	}
	if (branch) {
		gitExec(projectRoot, ["branch", "-D", branch], { throwOnError: false });
	}
}

/**
 * Matrix row index environment (#229). Gives row scripts Slurm/K8s-style
 * identity without string substitution: `SPINE_MATRIX_JOB_ID` is the parent
 * task id, `SPINE_MATRIX_TASK_ID` the row id, `SPINE_MATRIX_TASK_INDEX` the
 * 0-based row position, `SPINE_MATRIX_TASK_COUNT` the row count, and
 * `JOB_COMPLETION_INDEX` aliases the index for Kubernetes indexed-job scripts.
 *
 * Returns null when `rowIndex`/`rowCount` are absent so callers that do not
 * know a row's position (legacy direct calls) inject nothing at all.
 *
 * @param {object} params
 * @param {string} [params.taskId] Parent matrix task id.
 * @param {string} [params.rowId] Row id (`run_id` or derived).
 * @param {number} [params.rowIndex] 0-based position of the row in the matrix.
 * @param {number} [params.rowCount] Total number of matrix rows.
 * @returns {Record<string, string> | null}
 */
export function buildMatrixRowEnv({ taskId, rowId, rowIndex, rowCount }) {
	if (!Number.isInteger(rowIndex) || rowIndex < 0) return null;
	if (!Number.isInteger(rowCount) || rowCount < 0) return null;
	return {
		SPINE_MATRIX_JOB_ID: String(taskId ?? ""),
		SPINE_MATRIX_TASK_ID: String(rowId ?? ""),
		SPINE_MATRIX_TASK_INDEX: String(rowIndex),
		SPINE_MATRIX_TASK_COUNT: String(rowCount),
		JOB_COMPLETION_INDEX: String(rowIndex),
	};
}

/**
 * Run a shell command in a directory, resolving with exit code and combined output.
 * Uses async spawn so concurrent rows genuinely overlap (required for maxParallel).
 *
 * @param {string} cwd
 * @param {string} command
 * @param {Record<string, string> | null} [extraEnv] Extra environment variables
 *   layered over `process.env` (matrix row identity, #229). Null injects nothing.
 * @returns {Promise<{ exitCode: number, output: string }>}
 */
export function runShellInDir(cwd, command, extraEnv = null) {
	return new Promise((resolve) => {
		const child = spawn("/bin/sh", ["-c", command], {
			cwd,
			env: extraEnv ? { ...process.env, ...extraEnv } : process.env,
			stdio: ["ignore", "pipe", "pipe"],
		});
		let output = "";
		const append = (chunk) => {
			output += chunk.toString();
		};
		child.stdout?.on("data", append);
		child.stderr?.on("data", append);
		child.on("error", (err) => {
			resolve({ exitCode: 1, output: output + String(err) });
		});
		child.on("close", (code) => {
			resolve({ exitCode: code ?? 1, output });
		});
	});
}

/**
 * Global lane-slot pool (SP-697 / #228).
 *
 * First-class matrix row scheduling replaces the SP-690 nested throttle: every
 * active worker in a batch — a plain lane task or a matrix row — occupies
 * exactly one slot of a pool sized `lanes.maxParallel`. Non-matrix tasks hold
 * their slot for the whole task; a matrix parent task holds NO slot while its
 * rows run, so the rows compete for the same global pool as sibling lanes and
 * global in-flight workers can never exceed `lanes.maxParallel`.
 *
 * The slot number doubles as the row's scheduling identity: rows provision
 * their worktree/branch with it, so concurrent rows always land on distinct
 * `lane-{n}-…` worktrees with real lane diversity.
 *
 * Pools are keyed by the live batch state object (never serialized — the map
 * is module-level and state-keyed), so a resume with a fresh state object
 * starts with a fresh pool.
 *
 * @type {WeakMap<object, { max: number, inUse: Set<number>, waiters: Array<(slot: number) => void> }>}
 */
const laneSlotPools = new WeakMap();

/**
 * @param {object} state  Live batch state (pool key).
 * @param {number} maxParallel  Configured `lanes.maxParallel`.
 * @returns {{ max: number, inUse: Set<number>, waiters: Array<(slot: number) => void> }}
 */
function getLaneSlotPool(state, maxParallel) {
	let pool = laneSlotPools.get(state);
	if (!pool) {
		pool = {
			max: Math.max(1, Math.floor(Number(maxParallel) || 1)),
			inUse: new Set(),
			waiters: [],
		};
		laneSlotPools.set(state, pool);
	}
	return pool;
}

/**
 * Acquire a lane slot from the global pool, waiting until one frees up.
 * Returns the lowest free slot number in `1..maxParallel`.
 *
 * @param {object} state  Live batch state (pool key).
 * @param {number} maxParallel  Configured `lanes.maxParallel`.
 * @returns {Promise<number>} Acquired slot number; pass to `releaseLaneSlot`.
 */
export function acquireLaneSlot(state, maxParallel) {
	const pool = getLaneSlotPool(state, maxParallel);
	for (let slot = 1; slot <= pool.max; slot++) {
		if (!pool.inUse.has(slot)) {
			pool.inUse.add(slot);
			return Promise.resolve(slot);
		}
	}
	return new Promise((resolve) => {
		pool.waiters.push(resolve);
	});
}

/**
 * Release a lane slot back to the pool, waking the oldest waiter (FIFO) if any.
 *
 * @param {object} state  Live batch state (pool key).
 * @param {number} slot  Slot number previously returned by `acquireLaneSlot`.
 */
export function releaseLaneSlot(state, slot) {
	const pool = laneSlotPools.get(state);
	if (!pool || !pool.inUse.has(slot)) return;
	pool.inUse.delete(slot);
	const next = pool.waiters.shift();
	if (next) {
		pool.inUse.add(slot);
		next(slot);
	}
}

/**
 * Generic concurrency-limited map. Runs `workerFn` over `items` with at most
 * `limit` in flight. Returns per-index results and the peak concurrency observed.
 * A worker that throws yields an Error in its result slot (does not abort siblings).
 *
 * @template T, R
 * @param {T[]} items
 * @param {number} limit
 * @param {(item: T, index: number) => Promise<R>} workerFn
 * @returns {Promise<{ results: R[], peakConcurrency: number }>}
 */
export async function runConcurrent(items, limit, workerFn) {
	const effectiveLimit = Math.max(1, Math.floor(Number(limit) || 1));
	/** @type {R[]} */
	const results = new Array(items.length);
	let cursor = 0;
	let active = 0;
	let peak = 0;

	async function runOne() {
		while (cursor < items.length) {
			const index = cursor;
			cursor += 1;
			active += 1;
			if (active > peak) peak = active;
			try {
				results[index] = await workerFn(items[index], index);
			} catch (err) {
				results[index] = /** @type {R} */ (err);
			} finally {
				active -= 1;
			}
		}
	}

	const runnerCount = Math.min(effectiveLimit, items.length);
	await Promise.all(Array.from({ length: runnerCount }, () => runOne()));
	return { results, peakConcurrency: peak };
}

/**
 * Substitute `{matrix.<column>}` placeholders in a command string for a row.
 * Returns the original command when no row is supplied (defensive).
 *
 * @param {string} command
 * @param {Record<string,string>} rowValues
 * @returns {string}
 */
export function substituteRowCommand(command, rowValues) {
	if (!rowValues || Object.keys(rowValues).length === 0) return command;
	return substituteMatrixVariables(command, rowValues);
}

/**
 * Derive the aggregate outcome for a parent matrix task from its per-row results.
 *
 * @param {Array<{ rowId: string, ok: boolean }>} rowResults
 * @returns {{ ok: boolean, failedRowIds: string[] }}
 */
export function aggregateMatrixOutcomes(rowResults) {
	const failedRowIds = rowResults
		.filter((row) => row && row.ok === false)
		.map((row) => row.rowId)
		.filter(Boolean);
	return { ok: failedRowIds.length === 0, failedRowIds };
}

/**
 * Record a matrix lifecycle journal event. Thin wrapper so callers stay terse
 * and the `matrix.*` event types are centralized.
 *
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {string} type
 * @param {Record<string, unknown>} payload
 */
export function recordMatrixEvent(projectRoot, batchId, type, payload) {
	return appendJournalEvent(projectRoot, batchId, type, payload);
}

/**
 * Test whether a batch worktree dir name is a matrix sub-lane (not a plain lane).
 * Plain lanes are exactly `lane-<n>`; sub-lanes are `lane-<n>-<slug>-<slug>`.
 *
 * @param {string} name
 * @returns {boolean}
 */
export function isMatrixSubLaneWorktreeDir(name) {
	return /^lane-\d+-.+-.+$/.test(name);
}

/**
 * Remove every matrix sub-lane worktree for a batch (defensive cleanup on batch
 * failure/abort). Plain lane worktrees are left to `removeLaneWorktrees`.
 *
 * @param {string} projectRoot
 * @param {string} batchId
 */
export function removeAllMatrixSubLaneWorktrees(projectRoot, batchId) {
	const dir = batchWorktreeDir(projectRoot, batchId);
	if (!fs.existsSync(dir)) return;
	for (const entry of fs.readdirSync(dir)) {
		if (!isMatrixSubLaneWorktreeDir(entry)) continue;
		const wtPath = path.join(dir, entry);
		try {
			gitExec(projectRoot, ["worktree", "remove", "--force", wtPath], {
				throwOnError: false,
			});
		} catch {
			fs.rmSync(wtPath, { recursive: true, force: true, maxRetries: 3 });
		}
	}
}
