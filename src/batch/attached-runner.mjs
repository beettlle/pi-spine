// @ts-nocheck
/**
 * Attached batch foreground runner — public facade (SP-343 / #34, SP-348 / #39).
 * Promote/exit: attached-runner-promote.mjs (SP-586).
 * Pause/resume reconcile: attached-runner-reconcile.mjs (SP-604).
 * Single resume owner / concurrent force fail-fast: enforceAttachedEngineSingleOwner (SP-660 / #207).
 */

export {
	resumeHandoffLockPath,
	tryAcquireResumeHandoffLock,
	releaseResumeHandoffLock,
	enforceAttachedEngineSingleOwner,
	reconcilePausedResumeDoneInLane,
} from "./attached-runner-reconcile.mjs";

export {
	DEFAULT_ATTACHED_MILESTONE_POLL_MS,
	ATTACHED_LAND_LOOP_MILESTONE_TYPES,
	installAttachedExitFinalizeHandlers,
	formatAttachedMilestoneLine,
	startAttachedMilestoneReporter,
	runAttachedBatchEngine,
	formatAttachedBatchCliResult,
	finishAttachedBatchCli,
	finalizeResumePostMergeLimbo,
} from "./attached-runner-promote.mjs";
