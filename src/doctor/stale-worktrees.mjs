/**
 * Doctor check for leftover `.worktrees/spine-<batchId>/` dirs (issue #26, SP-351).
 */

import fs from "node:fs";
import path from "node:path";

import { TERMINAL_BATCH_PHASES } from "../batch/state.mjs";

const SPINE_WORKTREE_DIR_PATTERN = /^spine-(.+)$/;

/**
 * Batch ID from `.spine/batch-state.json` when the batch is not terminal.
 *
 * @param {string} projectRoot
 * @returns {string|null}
 */
export function resolveInProgressSpineBatchId(projectRoot) {
	const statePath = path.join(projectRoot, ".spine", "batch-state.json");
	if (!fs.existsSync(statePath)) return null;

	try {
		const raw = JSON.parse(fs.readFileSync(statePath, "utf-8"));
		const batchId = String(raw.batchId ?? raw.id ?? "").trim();
		if (!batchId) return null;

		const phase = String(raw.phase ?? raw.status ?? "").toLowerCase();
		if (TERMINAL_BATCH_PHASES.has(phase)) return null;

		return batchId;
	} catch {
		return null;
	}
}

/**
 * List `.worktrees/spine-<batchId>/` directories with no matching in-progress batch.
 *
 * @param {string} projectRoot
 * @param {string|null} [activeBatchId]
 * @returns {string[]} batch IDs (not full paths)
 */
export function listStaleSpineWorktreeBatchIds(projectRoot, activeBatchId = null) {
	const worktreesRoot = path.join(projectRoot, ".worktrees");
	if (!fs.existsSync(worktreesRoot)) return [];

	/** @type {string[]} */
	const stale = [];
	const entries = fs.readdirSync(worktreesRoot, { withFileTypes: true });
	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		const match = SPINE_WORKTREE_DIR_PATTERN.exec(entry.name);
		if (!match) continue;

		const batchId = match[1].trim();
		if (!batchId) continue;
		if (activeBatchId && batchId === activeBatchId) continue;

		stale.push(batchId);
	}

	stale.sort();
	return stale;
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string|null} [params.activeBatchId]
 * @param {(root: string) => string|null} [params.resolveActiveBatchId]
 */
export function buildStaleWorktreesDoctorCheck({
	projectRoot,
	activeBatchId,
	resolveActiveBatchId = resolveInProgressSpineBatchId,
}) {
	const inProgressBatchId =
		activeBatchId === undefined ? resolveActiveBatchId(projectRoot) : activeBatchId;
	const staleBatchIds = listStaleSpineWorktreeBatchIds(projectRoot, inProgressBatchId);

	if (staleBatchIds.length === 0) {
		return {
			label: "stale worktrees",
			ok: true,
			detail: inProgressBatchId
				? `none (active batch ${inProgressBatchId})`
				: "none",
		};
	}

	const preview = staleBatchIds.slice(0, 3).map((id) => `spine-${id}`).join(", ");
	const suffix = staleBatchIds.length > 3 ? ` (+${staleBatchIds.length - 3} more)` : "";

	return {
		label: "stale worktrees",
		ok: true,
		warning: true,
		detail: `${staleBatchIds.length} leftover batch dir(s): ${preview}${suffix}`,
		suggestedCommand:
			"After spine batch complete/dismiss, lane worktrees auto-clean (lanes.cleanupWorktreesOnComplete). Remove legacy dirs: git worktree remove --force .worktrees/spine-<batchId>/lane-N; rm -rf .worktrees/spine-<batchId>",
	};
}
