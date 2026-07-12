// @ts-nocheck
/**
 * Rebuild batch task/segment status from append-only journal (FR-REL-01/02, PRD §11.4).
 * Structural derivation → journal-rebuild-structural.mjs (SP-584).
 * Drift / done-marker / orphan-review → journal-rebuild-drift.mjs (SP-602).
 * This file is the stable public re-export shim.
 */

export {
	BATCH_PHASE_EVENT_TYPES,
	deriveStructuralBatchStateFromJournal,
	readJournalTimeline,
	readJournalTimelineFromDisk,
	rebuildBatchStateFromDisk,
	rebuildBatchStateFromJournal,
	TASK_LIFECYCLE_EVENT_TYPES,
} from "./journal-rebuild-structural.mjs";

export {
	detectBatchStateDrift,
	detectOrphanedReviewStarted,
	journalShowsDoneInLaneTerminalArtifacts,
	laneDoneMarkerCommittedOnBranch,
	laneDoneMarkerReadyForPromote,
	normalizeTaskFolderRel,
	reconcileBatchStateDrift,
	reconcileOrphanedReviewEvents,
} from "./journal-rebuild-drift.mjs";
