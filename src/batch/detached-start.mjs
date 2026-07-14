// @ts-nocheck
/**
 * Detached batch engine spawn — default for `spine batch start` and `spine batch resume`.
 * Thin re-export shim (SP-598): spawn → detached-spawn, diagnostics → detached-diagnostics,
 * wait/run → detached-wait + detached-run.
 * Resume path holds handoff lock across spawn+wait and persists child enginePid (SP-660 / #207).
 */

export {
	buildAttachedBatchResumeArgv,
	buildAttachedBatchStartArgv,
	DETACHED_ENGINE_LOG_REL,
	detachedEngineLogPath,
	spawnDetachedBatchEngine,
} from "./detached-spawn.mjs";

export {
	collectDetachedFailureDiagnostics,
	formatDetachedBatchStartOutput,
	formatDetachedEngineOutput,
	readCurrentBatchLogTail,
} from "./detached-diagnostics.mjs";

export {
	prepareDetachedResumeEngineHandoff,
	resolveDefaultResumeWaitTerminal,
	resolveDetachedWaitTimeoutMs,
	runDetachedStartPreflight,
	waitForDetachedBatchResume,
	waitForDetachedBatchStart,
} from "./detached-wait.mjs";

export { resumeBatchDetached, startBatchDetached } from "./detached-run.mjs";
