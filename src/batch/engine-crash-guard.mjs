/**
 * Attached-engine crash guard (SP-788 / #306 item 5).
 *
 * Registers `uncaughtException` / `unhandledRejection` listeners for the
 * duration of one attached engine run only. On a crash the guard journals
 * `engine.crashed`, marks the batch failed, and exits non-zero — the journal
 * and batch-state must never be left on a `running` orphan after a crash.
 *
 * All side effects are injectable via `deps` so tests never touch real
 * process exit or real crash paths.
 */

import { appendJournalEvent } from "./journal.mjs";
import { loadSpineBatchState, saveSpineBatchState } from "./state.mjs";

/** Same cap `failBatchFromEngineError` applies to `lastError` in batch state. */
const ERROR_MESSAGE_CAP = 500;
/** Keep the head of the stack: frames near the throw site are the useful ones. */
const STACK_LINE_CAP = 20;

/**
 * Resolve the active batch id from batch-state.json, or null when absent.
 *
 * @param {string} projectRoot
 * @returns {string|null}
 */
function resolveActiveBatchId(projectRoot) {
	const loaded = loadSpineBatchState(projectRoot);
	const batchId = loaded.raw?.batchId;
	return typeof batchId === "string" && batchId ? batchId : null;
}

/**
 * Cap an error message to the journal-friendly length.
 *
 * @param {unknown} error
 * @returns {string}
 */
function crashMessage(error) {
	const message = error instanceof Error ? error.message : String(error);
	return message.slice(0, ERROR_MESSAGE_CAP);
}

/**
 * First ~20 lines of the error stack (empty for non-Error throws).
 *
 * @param {unknown} error
 * @returns {string}
 */
function crashStack(error) {
	const stack = error instanceof Error && typeof error.stack === "string" ? error.stack : "";
	return stack.split("\n").slice(0, STACK_LINE_CAP).join("\n");
}

/**
 * Real mark-failed: same terminal fields as the failed paths in resume.mjs
 * (`phase = "failed"`, `endedAt`, `lastError`) persisted via saveSpineBatchState.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.batchId
 * @param {string} params.message
 * @param {number} [params.endedAt]
 * @returns {boolean} false when there is no on-disk batch state to fail
 */
function defaultMarkBatchFailed({ projectRoot, batchId, message, endedAt }) {
	const loaded = loadSpineBatchState(projectRoot);
	if (!loaded.raw) return false;
	loaded.raw.phase = "failed";
	loaded.raw.endedAt = typeof endedAt === "number" ? endedAt : Date.now();
	loaded.raw.lastError = String(message).slice(0, ERROR_MESSAGE_CAP);
	saveSpineBatchState(projectRoot, loaded.raw);
	return true;
}

/**
 * Install process-level crash handlers for one attached engine run.
 *
 * The handlers run once (re-entrancy guarded): journal `engine.crashed`,
 * mark the batch failed, then exit non-zero. If journaling or the state
 * save itself throws, the original error still reaches stderr and the
 * process still exits non-zero — a crash guard must never swallow a crash.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {object} [params.deps] Injectable side effects (all optional).
 * @param {(projectRoot: string, batchId: string, type: string, payload: object) => unknown} [params.deps.appendJournalEvent]
 * @param {(params: { projectRoot: string, batchId: string, message: string, endedAt?: number }) => boolean} [params.deps.markBatchFailed]
 * @param {(code?: number) => void} [params.deps.exit]
 * @param {() => number} [params.deps.now]
 * @returns {() => void} Uninstall — removes both listeners.
 */
export function installEngineCrashHandlers({ projectRoot, deps = {} }) {
	const {
		appendJournalEvent: appendEvent = appendJournalEvent,
		markBatchFailed = defaultMarkBatchFailed,
		exit = (code) => process.exit(code),
		now = () => Date.now(),
	} = deps ?? {};

	/** Guard against a second fault firing while the first is being journaled. */
	let handling = false;

	const handle = (kind, error) => {
		if (handling) return;
		handling = true;

		const message = crashMessage(error);
		try {
			const batchId = resolveActiveBatchId(projectRoot);
			if (batchId) {
				appendEvent(projectRoot, batchId, "engine.crashed", {
					kind,
					error: message,
					stack: crashStack(error),
				});
				markBatchFailed({ projectRoot, batchId, message, endedAt: now() });
			} else {
				process.stderr.write("[spine] engine crashed but no active batch state found; nothing to journal\n");
			}
		} catch (guardError) {
			// Never swallow: the original crash must surface even if the
			// journal write or the state save is what failed.
			const guardMessage = guardError instanceof Error ? guardError.message : String(guardError);
			process.stderr.write(`[spine] engine crash guard failed: ${guardMessage}\n`);
		}
		process.stderr.write(`[spine] engine crashed (${kind}): ${message}\n`);
		exit(1);
	};

	const onUncaughtException = (error) => handle("uncaughtException", error);
	const onUnhandledRejection = (reason) => handle("unhandledRejection", reason);
	process.on("uncaughtException", onUncaughtException);
	process.on("unhandledRejection", onUnhandledRejection);

	return function uninstall() {
		process.removeListener("uncaughtException", onUncaughtException);
		process.removeListener("unhandledRejection", onUnhandledRejection);
	};
}
