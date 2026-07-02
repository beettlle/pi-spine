/**
 * Lane commit and post-commit dirty validation (SP-427 / #73).
 */

import { appendJournalEvent } from "../journal.mjs";
import { commitLaneWorktree, gitPorcelain } from "../lane-commit.mjs";
import {
	resolvePostLaneCommitPorcelain,
	sanitizeOutOfScopeCoverageBeforeLaneCommit,
} from "../lane-dirty-check.mjs";
import {
	recomputeTaskCounters,
	saveSpineBatchState,
	updateSegmentForTask,
} from "../state.mjs";
import { recordLaneTaskMetric } from "./queue.mjs";

const DIRTY_AFTER_COMMIT_MESSAGE =
	"Lane worktree still has uncommitted changes after auto-commit — commit manually or fix worker output";

/**
 * @param {object} params
 * @param {string} params.worktreePath
 * @param {string} params.taskBranch
 * @param {string} params.taskId
 * @param {string} params.batchId
 * @param {string} params.taskFolder
 * @param {string} [params.projectRoot]
 * @param {string[]} [params.fileScopePaths]
 * @param {string[]} [params.ignorePatterns]
 * @param {object} params.task
 * @param {object} params.lane
 * @param {number} params.laneNumber
 * @param {string} params.laneCorrelationId
 * @param {object} params.state
 * @param {object} params.config
 * @returns {{ ok: true, laneCommit: object } | { ok: false, error: string, output?: string }}
 */
export function commitLaneAndValidateWorktree({
	worktreePath,
	taskBranch,
	taskId,
	batchId,
	taskFolder,
	projectRoot,
	fileScopePaths,
	ignorePatterns = [],
	task,
	lane,
	laneNumber,
	laneCorrelationId,
	state,
	config,
}) {
	const preCommitPorcelain = gitPorcelain(worktreePath);
	sanitizeOutOfScopeCoverageBeforeLaneCommit(worktreePath, fileScopePaths, {
		projectRoot,
		porcelain: preCommitPorcelain,
	});

	const laneCommit = commitLaneWorktree({
		worktreePath,
		taskBranch,
		taskId,
		batchId,
		taskFolder,
		projectRoot,
	});
	if (!laneCommit.ok) {
		task.status = "failed";
		task.endedAt = Date.now();
		task.exitReason = laneCommit.failureClass ?? "lane_commit_failed";
		updateSegmentForTask(state, taskId, "failed");
		recomputeTaskCounters(state);
		saveSpineBatchState(projectRoot, state);
		appendJournalEvent(projectRoot, batchId, "task.failed", {
			taskId,
			laneNumber,
			laneId: lane.laneId,
			correlationId: laneCorrelationId,
			classification: laneCommit.failureClass ?? "lane_commit_failed",
			exitCode: 1,
			output: laneCommit.error,
			gitignoredPaths: laneCommit.gitignoredPaths ?? null,
		});
		recordLaneTaskMetric({
			projectRoot,
			batchId,
			task,
			config,
			taskFolder,
		});
		return {
			ok: false,
			error: "lane_commit_failed",
			output: laneCommit.error,
		};
	}

	if (laneCommit.committed) {
		appendJournalEvent(projectRoot, batchId, "lane.committed", {
			taskId,
			laneNumber,
			commitSha: laneCommit.commitSha,
		});
	}

	const remainingDirty = resolvePostLaneCommitPorcelain(worktreePath, {
		fileScopePaths,
		ignorePatterns,
		projectRoot,
		porcelain: gitPorcelain(worktreePath),
	});
	if (remainingDirty) {
		task.status = "failed";
		task.endedAt = Date.now();
		task.exitReason = "DirtyWorktree";
		updateSegmentForTask(state, taskId, "failed");
		recomputeTaskCounters(state);
		saveSpineBatchState(projectRoot, state);
		appendJournalEvent(projectRoot, batchId, "task.failed", {
			taskId,
			laneNumber,
			laneId: lane.laneId,
			correlationId: laneCorrelationId,
			classification: "DirtyWorktree",
			exitCode: 1,
			output: DIRTY_AFTER_COMMIT_MESSAGE,
		});
		recordLaneTaskMetric({
			projectRoot,
			batchId,
			task,
			config,
			taskFolder,
		});
		return {
			ok: false,
			error: "dirty_after_lane_commit",
			output: DIRTY_AFTER_COMMIT_MESSAGE,
		};
	}

	return { ok: true, laneCommit };
}
