// @ts-check
/**
 * pi-spine worker host — spawn worker in lane worktree with heartbeat polling.
 */

import fs from "node:fs";
import path from "node:path";
import {
	resolveStallConfigForTask,
	resolveWorkerPiTimeoutMs,
	parseTaskSizeFromFolder,
} from "./task-stall-budget.mjs";
import { parseContract, parsePrompt } from "../tasks/packet/parse-prompt.mjs";
import { appendJournalEvent } from "./journal.mjs";
import { classifyProviderQuotaError } from "./provider-quota.mjs";
import { resolveWorkerQuotaFallbackContext } from "./engine-lanes/quota-fallback-state.mjs";
import { assertReviewToolAvailable } from "./review.mjs";
import {
	finalizeWorkerOutput,
	createWorkerLiveLogWriter,
	resolveWorkerOutputConfig,
} from "./worker-output.mjs";
import { resolveWorkerBackend } from "../config/worker-backend.mjs";
import { commandExists } from "../util/command-exists.mjs";
import {
	collectChildOutput,
	markChildPastPreflight,
	resolveWorkerLaunchScript,
	resolveWorkerPhase,
	spawnWorkerHandle,
	spawnExecutionOnlyHandle,
	terminateHungWorkerChild,
	CHILD_DONE_TIMEOUT_MS,
} from "./worker-spawn.mjs";
import {
	createWorkerPollState,
	pollWorkerUntilSettled,
} from "./worker-heartbeat.mjs";
import { terminateProcessTree } from "../process/terminate-tree.mjs";

export { buildWorkerChildEnv } from "./worker-spawn.mjs";

const DEFAULT_TIMEOUT_MS = 60 * 60 * 1000;

/**
 * Exit code the worker runner uses when the `pi` spawn hits its wall-clock
 * budget (ETIMEDOUT). Must stay in sync with bin/spine-worker-runner.mjs.
 * Engine-initiated kills surface as exit code 1 (signal → `code ?? 1` in
 * collectChildOutput), so 124 only ever originates from the runner's own
 * timeout — never from post-done or stall termination.
 */
const WORKER_TIMEOUT_EXIT_CODE = 124;

/**
 * Reclassify a plain `failed` worker exit as a provider quota/overload exit
 * when forwarded output matches a known provider payload, and journal
 * `worker.quota_exhausted` for quota-exhausted exits (#329, SP-806). Aborted,
 * stall, launch and review failures keep their meaning; overload is not
 * journaled. Callers must run this after finalizeWorkerOutput so output
 * capture still sees the original `failed` (shouldCaptureWorkerOutput matches
 * the literal) while consumers receive the provider-quota exit reason.
 *
 * @param {{ classification: string, rawOutput: string, workerModel?: string, projectRoot?: string, batchId?: string, taskId?: string, laneNumber?: number, laneCorrelationId?: string }} params
 * @returns {{ classification: string, providerQuota: import("./provider-quota.mjs").ProviderQuotaError | null }}
 */
function applyProviderQuotaClassification({ classification, rawOutput, workerModel, projectRoot, batchId, taskId, laneNumber, laneCorrelationId }) {
	if (classification !== "failed") return { classification, providerQuota: null };
	// SP-808 (#329): the caller resolves the effective model (fallback profile
	// when a hop is active) so classification and the journal tell the truth.
	const model = typeof workerModel === "string" ? workerModel : undefined;
	const providerQuota = classifyProviderQuotaError(rawOutput, model);
	if (!providerQuota) return { classification, providerQuota: null };
	if (providerQuota.kind === "quota_exhausted" && projectRoot && batchId) {
		appendJournalEvent(projectRoot, batchId, "worker.quota_exhausted", {
			taskId, laneNumber, correlationId: laneCorrelationId, poolId: providerQuota.poolId,
			providerCode: providerQuota.providerCode, httpStatus: providerQuota.httpStatus,
			resetAtRaw: providerQuota.resetAtRaw, ...(model ? { model } : {}),
		});
	}
	const reclassified = providerQuota.kind === "quota_exhausted" ? "provider_quota_exhausted" : "provider_overloaded";
	return { classification: reclassified, providerQuota };
}

/**
 * Force-terminate lane worker process trees tracked in batch state.
 * Reaps nested `pi` grandchildren, not only the tracked runner PID (SP-609 / #194).
 *
 * @param {unknown[]} lanes
 * @param {{ hard?: boolean }} [options]
 * @returns {Array<{ laneNumber: number, workerPid: number, signal: NodeJS.Signals }>}
 */
export function terminateLaneWorkers(lanes, { hard = true } = {}) {
	const signal = hard ? "SIGKILL" : "SIGTERM";
	/** @type {Array<{ laneNumber: number, workerPid: number, signal: NodeJS.Signals }>} */
	const terminated = [];
	for (const lane of lanes ?? []) {
		if (!lane || typeof lane !== "object") continue;
		const workerPid = Number(/** @type {{ workerPid?: number }} */ (lane).workerPid);
		if (!Number.isFinite(workerPid) || workerPid <= 0) continue;
		const laneNumber = Number(
			/** @type {{ laneNumber?: number }} */ (lane).laneNumber ?? 1,
		);
		const result = terminateProcessTree(workerPid, { signal });
		if (result.signaled.length === 0) continue;
		terminated.push({ laneNumber, workerPid, signal });
	}
	return terminated;
}

/** @typedef {import("./worker-spawn.mjs").WorkerPhase} WorkerPhase */

/** @typedef {import("./worker-spawn.mjs").WorkerChildHandle} WorkerChildHandle */

/**
 * @param {number} ms
 */
function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {object} params
 * @param {string} params.rawOutput
 * @param {string} params.classification
 * @param {number} params.exitCode
 * @param {string} params.mode
 * @param {boolean} params.doneFound
 * @param {string} [params.projectRoot]
 * @param {string} [params.batchId]
 * @param {number} [params.laneNumber]
 * @param {string} [params.taskId]
 * @param {string} [params.laneCorrelationId]
 * @param {object} [params.config]
 * @param {string} [params.workerModel] Effective worker model (SP-808).
 * @param {number} [params.stallDeadline]
 * @param {object} [params.signals]
 */
function buildWorkerFailureResult({
	rawOutput,
	classification,
	exitCode,
	mode,
	doneFound,
	projectRoot,
	batchId,
	laneNumber,
	taskId,
	laneCorrelationId,
	config,
	workerModel,
	stallDeadline,
	signals,
}) {
	const finalized = finalizeWorkerOutput({
		rawOutput,
		classification,
		ok: false,
		projectRoot,
		batchId,
		laneNumber,
		taskId,
		correlationId: laneCorrelationId,
		exitCode,
		stallDeadline,
		signals,
		config,
	});
	// SP-806 (#329): post-finalize reclassification (see helper doc).
	const quotaOutcome = applyProviderQuotaClassification({ classification, rawOutput, workerModel, projectRoot, batchId, taskId, laneNumber, laneCorrelationId });
	return {
		ok: false,
		exitCode,
		mode,
		output: finalized.output,
		workerOutputLogPath: finalized.logPath,
		workerOutputLogRef: finalized.logRef,
		classification: quotaOutcome.classification,
		doneFound,
		...(quotaOutcome.providerQuota ? { providerQuota: quotaOutcome.providerQuota } : {}),
	};
}

/**
 * @param {object} params
 * @param {string} params.worktreePath
 * @param {string} params.taskFolder
 * @param {string} [params.projectRoot]
 * @param {string} [params.batchId]
 * @param {number} [params.laneNumber]
 * @param {string} [params.taskId]
 * @param {string} [params.laneBranch]
 * @param {string} [params.laneCorrelationId]
 * @param {object} [params.config]
 * @param {(timestamp: number) => void} [params.onHeartbeat]
 * @param {(pid: number) => void} [params.onWorkerPid]
 * @param {string[]} [params.fileScopePaths]
 * @param {number} [params.timeoutMs]
 * @param {object} [params.workerBackendDeps] Test-only injectables for agentSession backend
 * @param {Record<string, string>} [params.extraEnv] Extra child env (matrix row identity, #229)
 */
export async function runWorker({
	worktreePath,
	taskFolder,
	projectRoot,
	batchId,
	laneNumber = 1,
	taskId,
	laneBranch,
	laneCorrelationId,
	config = {},
	onHeartbeat,
	onWorkerPid,
	fileScopePaths = [],
	timeoutMs: _timeoutMs = DEFAULT_TIMEOUT_MS,
	workerBackendDeps = {},
	extraEnv,
}) {
	const donePath = path.join(taskFolder, ".DONE");
	if (fs.existsSync(donePath)) {
		return { ok: true, exitCode: 0, mode: "already-done" };
	}

	// SP-808 (#329): sticky quota fallback — read-only load; caller extraEnv wins.
	const quotaCtx = resolveWorkerQuotaFallbackContext({ projectRoot, batchId, config, extraEnv });

	const stubExplicit =
		process.env.SPINE_WORKER_STUB === "1" || process.env.SPINE_WORKER_STUB === "true";
	// #299 (SP-801): the stub is opt-in only. The old implicit fallback
	// (missing `pi` → stub) could mark review-level-0 tasks done with no work
	// when PATH lacked `pi`; the fail-closed guard below replaces it.
	const useStub = stubExplicit;

	const workerBackend = useStub ? "subprocess" : resolveWorkerBackend(config);
	const workerMode = useStub ? "stub" : workerBackend === "agentSession" ? "agentSession" : "pi";
	const useLaunchScript = Boolean(
		projectRoot ? resolveWorkerLaunchScript(projectRoot, config) : null,
	);

	const reviewCheck = assertReviewToolAvailable({ taskFolder });
	if (!reviewCheck.ok) {
		if (projectRoot && batchId) {
			appendJournalEvent(projectRoot, batchId, "review.failed", {
				taskId,
				laneNumber,
				correlationId: laneCorrelationId,
				reviewLevel: reviewCheck.reviewLevel,
				error: reviewCheck.error,
				spawnFailed: true,
				phase: "preflight",
			});
		}
		return {
			ok: false,
			exitCode: 1,
			mode: workerMode,
			output: reviewCheck.error ?? "review tool unavailable",
			classification: "review_failed",
			doneFound: false,
		};
	}

	const taskSize = parseTaskSizeFromFolder(taskFolder);
	const promptPath = path.join(taskFolder, "PROMPT.md");
	const promptText = fs.existsSync(promptPath) ? fs.readFileSync(promptPath, "utf-8") : "";
	const parsedPrompt = promptText ? parsePrompt(promptText) : null;
	const contract = promptText ? parseContract(promptText) : { stallTimeoutMinutes: null, extendGraceOnFileScope: null, runCommand: null, testCommand: null };
	const stallConfig = resolveStallConfigForTask({ config, taskSize, contract });
	const piTimeoutMs = resolveWorkerPiTimeoutMs({ config, taskSize, contract });
	const startedAt = Date.now();

	const isExecute = parsedPrompt?.type === "execute";
	const runCommand = contract.runCommand || contract.testCommand;

	// #299 (SP-801): fail closed when the pi CLI is missing rather than silently
	// falling back to the stub. Placed after the review gate so review-tool
	// unavailability keeps its `review_failed` precedence, and scoped to
	// non-execute tasks (execute-only runs the contract command, never `pi`);
	// agentSession workers spawn in-process and never consult PATH for `pi`.
	if (!stubExplicit && !isExecute && workerBackend !== "agentSession" && !commandExists("pi")) {
		if (projectRoot && batchId) {
			appendJournalEvent(projectRoot, batchId, "worker.spawn_failed", {
				taskId,
				laneNumber,
				correlationId: laneCorrelationId,
				reason: "pi_missing",
				phase: "preflight",
			});
		}
		return {
			ok: false,
			exitCode: 1,
			mode: workerMode,
			output:
				"worker requires pi on PATH (fail closed); set SPINE_WORKER_STUB=1 only for stub runs",
			classification: "launch_failed",
			doneFound: false,
		};
	}

	const child = isExecute
		? spawnExecutionOnlyHandle({
				worktreePath,
				taskFolder,
				command: runCommand || "echo 'No runCommand or testCommand provided' && exit 1",
				projectRoot,
				batchId,
				laneNumber,
				taskId,
				laneCorrelationId,
				fileScopePaths,
				config,
			})
		: spawnWorkerHandle({
				worktreePath,
				taskFolder,
				useStub,
				timeoutMs: piTimeoutMs,
				piTimeoutMs,
				projectRoot,
				batchId,
				laneNumber,
				taskId,
				laneCorrelationId,
				fileScopePaths,
				config,
				workerBackendDeps,
				extraEnv: quotaCtx.extraEnv,
			});
	const workerChild = /** @type {WorkerChildHandle} */ (child);
	let childPastPreflight = isExecute ? true : !useLaunchScript;
	/** @type {WorkerPhase} */
	const initialWorkerPhase = isExecute ? "pi" : resolveWorkerPhase({ childPastPreflight, useStub, workerBackend });
	markChildPastPreflight(workerChild, () => {
		childPastPreflight = true;
	});
	onWorkerPid?.(workerChild.pid ?? 0);
	const outputConfig = resolveWorkerOutputConfig(config);
	const liveLogWriter = createWorkerLiveLogWriter({
		projectRoot,
		batchId,
		laneNumber,
		taskId,
		config,
	});
	const childDone = collectChildOutput(workerChild, liveLogWriter, outputConfig.maxBytes);

	const pollState = createWorkerPollState(startedAt, initialWorkerPhase);
	const pollOutcome = await pollWorkerUntilSettled({
		donePath,
		workerChild,
		childDone,
		stallConfig,
		startedAt,
		pollState,
		worktreePath,
		taskFolder,
		laneBranch,
		fileScopePaths,
		projectRoot,
		batchId,
		laneNumber,
		taskId,
		laneCorrelationId,
		useStub,
		workerBackend,
		childPastPreflight,
		onHeartbeat,
		workerMode,
		buildFailureResult: (
			/** @type {Pick<Parameters<typeof buildWorkerFailureResult>[0], "rawOutput" | "classification" | "exitCode" | "mode" | "doneFound" | "stallDeadline" | "signals">} */ partial,
		) =>
			buildWorkerFailureResult({
				...partial,
				projectRoot,
				batchId,
				laneNumber,
				taskId,
				laneCorrelationId,
				config,
				workerModel: quotaCtx.workerModel,
			}),
	});

	if (pollOutcome.kind === "failure") {
		return pollOutcome.result;
	}

	const postDoneTerminated = pollOutcome.postDoneTerminated;

	const childResult = await Promise.race([childDone, sleep(CHILD_DONE_TIMEOUT_MS).then(() => null)]);
	let exitCode, output;
	/** @type {boolean} */
	let spawnFailed = false;
	if (childResult) {
		({ exitCode, output, spawnError: spawnFailed = false } = childResult);
	} else {
		// close event didn't fire — sub-processes likely hold stdio pipes open.
		const fallback = await terminateHungWorkerChild(workerChild, childDone);
		({ exitCode, output, spawnError: spawnFailed = false } = fallback);
	}
	// SP-787 (#306): the child never spawned (EACCES/ENOENT/missing execPath).
	// Report `launch_failed` for this lane through the standard failure path so
	// the engine keeps running; no worker code ran, so .DONE cannot be honored.
	if (spawnFailed) {
		return buildWorkerFailureResult({
			rawOutput: output,
			classification: "launch_failed",
			exitCode,
			mode: workerMode,
			doneFound: fs.existsSync(donePath),
			projectRoot,
			batchId,
			laneNumber,
			taskId,
			laneCorrelationId,
			config,
		});
	}
	const doneFound = fs.existsSync(donePath);
	if (postDoneTerminated && !doneFound) {
		return buildWorkerFailureResult({
			rawOutput: output,
			classification: "failed",
			exitCode,
			mode: workerMode,
			doneFound: false,
			projectRoot,
			batchId,
			laneNumber,
			taskId,
			laneCorrelationId,
			config,
			workerModel: quotaCtx.workerModel,
		});
	}
	// SP-738 (#273): the runner exits 124 when the `pi` spawn hit its wall-clock
	// budget (ETIMEDOUT). If the agent had already written .DONE, the task is done —
	// do not classify a completed worker as timeout-failed. Post-done termination
	// already resolves via postDoneTerminated, and true stalls never reach this
	// boundary with .DONE absent (#272 keeps them failing).
	const timedOutAfterDone =
		doneFound && !postDoneTerminated && exitCode === WORKER_TIMEOUT_EXIT_CODE;
	if (timedOutAfterDone && projectRoot && batchId) {
		appendJournalEvent(projectRoot, batchId, "worker.done_after_timeout", {
			laneNumber,
			taskId,
			correlationId: laneCorrelationId,
			exitCode,
			mode: workerMode,
		});
	}
	const ok =
		doneFound && (exitCode === 0 || postDoneTerminated || timedOutAfterDone);
	let classification = ok ? "succeeded" : "failed";
	if (!ok && useLaunchScript && !childPastPreflight) {
		classification = "launch_failed";
		return buildWorkerFailureResult({
			rawOutput: output,
			classification,
			exitCode,
			mode: workerMode,
			doneFound,
			projectRoot,
			batchId,
			laneNumber,
			taskId,
			laneCorrelationId,
			config,
		});
	}

	const finalized = finalizeWorkerOutput({
		rawOutput: output,
		classification,
		ok,
		projectRoot,
		batchId,
		laneNumber,
		taskId,
		correlationId: laneCorrelationId,
		exitCode,
		config,
	});

	// SP-806 (#329): main post-spawn failure path — post-finalize
	// reclassification (see helper doc); only plain `failed` exits can match.
	const quotaOutcome = applyProviderQuotaClassification({ classification, rawOutput: output, workerModel: quotaCtx.workerModel, projectRoot, batchId, taskId, laneNumber, laneCorrelationId });
	return {
		ok,
		exitCode,
		mode: workerMode,
		output: finalized.output,
		workerOutputLogPath: finalized.logPath,
		workerOutputLogRef: finalized.logRef,
		classification: quotaOutcome.classification,
		doneFound,
		...(quotaOutcome.providerQuota ? { providerQuota: quotaOutcome.providerQuota } : {}),
	};
}
