/**
 * Sequence runtime: wait/land loop and runSequence (SP-600 / FR-SHIP-02).
 */

import { loadSpineConfig } from "../config/spine-config-load.mjs";
import {
	DEFAULT_SEQUENCE_POLL_MS,
	resolveSequencePollMs,
} from "../config/spine-config-schema.mjs";
import {
	formatPreflightHuman,
	runBatchPreflight,
} from "../config/spine-preflight-lib.mjs";
import { filterPendingTaskIds } from "../planner/pending.mjs";
import { discoverTasks } from "../tasks/packet/discover.mjs";
import { startBatch } from "./engine.mjs";
import { startBatchDetached } from "./detached-start.mjs";
import { isProcessAlive } from "../process/liveness.mjs";
import { approveIntegrateGate, loadGateRecord } from "./gate.mjs";
import { integrateOrchToBase } from "./integrate.mjs";
import { completeBatch } from "./lifecycle.mjs";
import { reconcileBatch } from "./reconcile.mjs";
import { loadSpineBatchState } from "./state.mjs";
import { validateSequenceAutoApproveGate } from "../doctor/sequence-safety.mjs";
import {
	buildSequenceSatisfiedTaskIds,
	collectWaveTaskOutcomes,
	isMergeBlockedBatchOutcome,
	planSequenceWaveTasks,
	resolveWaveAfterMergeBlocked,
} from "./sequence-waves.mjs";
import {
	buildSequenceStateSnapshot,
	finalizeSequenceState,
	haltSequenceAndPersist,
	persistSequenceState,
	prepareSequenceRunState,
} from "./sequence-state.mjs";
import {
	buildSequenceDryRunPlan,
	resolveSequenceProfile,
	resolveSequenceWaves,
	validateReleaseSequenceWaveCaps,
} from "./sequence-plan.mjs";

const WAVE_BATCH_SETTLED_DIAGNOSES = new Set([
	"completed",
	"completed_manual",
	"needs_integrate",
	"limbo_stale",
]);
const WAVE_BATCH_FAILURE_DIAGNOSES = new Set(["failed", "aborted"]);
const WAVE_BATCH_WAITING_DIAGNOSES = new Set([
	"running",
	"paused",
	"needs_retry",
	"worker_orphaned",
	"engine_orphaned",
	"state_drift",
	"needs_merge",
	"needs_replan",
]);

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isSequenceBatchSettled(diagnosis) {
	return Boolean(diagnosis && WAVE_BATCH_SETTLED_DIAGNOSES.has(diagnosis));
}

export function isSequenceBatchFailure(diagnosis) {
	return Boolean(diagnosis && WAVE_BATCH_FAILURE_DIAGNOSES.has(diagnosis));
}

export function isSequenceBatchWaiting(diagnosis) {
	return Boolean(diagnosis && WAVE_BATCH_WAITING_DIAGNOSES.has(diagnosis));
}

export async function waitForSequenceBatchTerminal({
	projectRoot,
	pollIntervalMs = DEFAULT_SEQUENCE_POLL_MS,
	timeoutMs = 120_000,
	enginePid = null,
	reconcileFn = reconcileBatch,
}) {
	const deadline = Date.now() + timeoutMs;
	let useLightReconcile = false;
	while (Date.now() < deadline || isEngineStillRunning(enginePid, projectRoot)) {
		const reconciliation = reconcileFn({ projectRoot, light: useLightReconcile });
		useLightReconcile = true;
		const diagnosis = reconciliation.diagnosis;
		if (isSequenceBatchFailure(diagnosis)) {
			return {
				ok: false,
				halted: true,
				diagnosis,
				reconciliation,
				batchId: reconciliation.batchId ?? null,
			};
		}
		if (isSequenceBatchSettled(diagnosis)) {
			return {
				ok: true,
				diagnosis,
				reconciliation,
				batchId: reconciliation.batchId ?? null,
			};
		}
		await sleep(pollIntervalMs);
	}
	const reconciliation = reconcileFn({ projectRoot });
	return {
		ok: false,
		error: "timeout_waiting_for_batch",
		diagnosis: reconciliation.diagnosis ?? null,
		reconciliation,
		batchId: reconciliation.batchId ?? null,
	};
}

/**
 * Returns true when a detached engine PID is alive or the batch phase is active,
 * preventing sequence timeout while work is still in progress.
 */
function isEngineStillRunning(enginePid, projectRoot) {
	if (enginePid && isProcessAlive(enginePid)) return true;
	const { raw } = loadSpineBatchState(projectRoot);
	const pid = raw?.enginePid ?? null;
	if (pid && isProcessAlive(pid)) return true;
	return false;
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string|null} params.batchId
 * @param {boolean} [params.autoApproveGate]
 */
export function runSequenceWaveLandLoop({ projectRoot, batchId, autoApproveGate = false }) {
	const reconciliation = reconcileBatch({ projectRoot });
	const diagnosis = reconciliation.diagnosis;
	const activeBatchId =
		batchId ?? reconciliation.batchId ?? loadSpineBatchState(projectRoot).raw?.batchId ?? null;

	if (!isSequenceBatchSettled(diagnosis)) {
		return {
			ok: false,
			step: "land_loop",
			error: "batch_not_settled",
			diagnosis,
			batchId: activeBatchId,
			headline: `Cannot land wave — batch diagnosis is ${diagnosis ?? "unknown"}`,
		};
	}

	const config = loadSpineConfig(projectRoot).config ?? {};
	const gateRequired = config.gates?.requireBeforeIntegrate !== false;
	const gate = activeBatchId ? loadGateRecord(projectRoot, activeBatchId) : null;

	if (gateRequired && gate?.status === "pending") {
		if (!autoApproveGate) {
			return {
				ok: false,
				step: "gate_approve",
				error: "gate_approval_required",
				diagnosis,
				batchId: activeBatchId,
				headline: "Integrate gate requires approval — pass autoApproveGate or approve manually",
				suggestedCommand: "spine gate approve",
			};
		}
		const approve = approveIntegrateGate({ projectRoot, batchId: activeBatchId });
		if (!approve.ok) {
			return { ok: false, step: "gate_approve", diagnosis, batchId: activeBatchId, ...approve };
		}
	}

	const integrate = integrateOrchToBase({ projectRoot, batchId: activeBatchId });
	if (!integrate.ok) {
		return { ok: false, step: "integrate", diagnosis, batchId: activeBatchId, ...integrate };
	}

	const complete = completeBatch({ projectRoot, batchId: activeBatchId });
	if (!complete.ok) {
		return { ok: false, step: "complete", diagnosis, batchId: activeBatchId, ...complete };
	}

	return {
		ok: true,
		diagnosis,
		batchId: activeBatchId,
		headline: `Wave batch ${activeBatchId} landed on main`,
	};
}

/**
 * @param {object} ctx
 */
export async function runSequence(ctx) {
	const {
		projectRoot,
		plan,
		scope = "pending",
		fromWave = 0,
		throughWave = null,
		resume = false,
		attached = false,
		autoApproveGate = false,
		force = false,
		stopOnFailure = true,
		dryRun = false,
		skipPreflight = false,
		profile: profileOverride = null,
		pollIntervalMs: pollIntervalMsOverride,
		timeoutMs = 120_000,
		spineBin = null,
		startBatchFn = startBatch,
	} = ctx;

	const sequenceProfile = resolveSequenceProfile({ scope, profile: profileOverride });

	const configResult = loadSpineConfig(projectRoot);
	const pollIntervalMs =
		pollIntervalMsOverride ??
		resolveSequencePollMs({ config: configResult.config ?? {} });

	let sequenceState = null;
	let effectiveFromWave = fromWave;
	/** @type {Array<{ waveIndex: number, batchId: string|null, diagnosis: string|null }>} */
	let persistedCompletedWaves = [];

	const prepared = prepareSequenceRunState(projectRoot, {
		resume,
		scope,
		fromWave,
		throughWave,
		dryRun,
	});
	if (!prepared.ok) {
		return { ok: false, exitCode: 1, error: prepared.error, output: prepared.output };
	}
	sequenceState = prepared.sequenceState;
	effectiveFromWave = prepared.effectiveFromWave;
	persistedCompletedWaves = prepared.persistedCompletedWaves;

	const wavePlan = resolveSequenceWaves(plan, { fromWave: effectiveFromWave, throughWave });
	if (!wavePlan.ok) {
		return { ok: false, exitCode: 1, error: wavePlan.error, output: wavePlan.output };
	}

	const autoApproveCheck = validateSequenceAutoApproveGate({
		autoApproveGate,
		force,
		profile: sequenceProfile,
	});
	if (!autoApproveCheck.ok) {
		return {
			ok: false,
			exitCode: 1,
			error: autoApproveCheck.error,
			output: autoApproveCheck.output,
			suggestedCommand: autoApproveCheck.suggestedCommand,
		};
	}

	if (sequenceProfile) {
		const capCheck = validateReleaseSequenceWaveCaps(plan, sequenceProfile);
		if (!capCheck.ok) {
			return {
				ok: false,
				exitCode: 1,
				error: capCheck.error,
				output: capCheck.output,
				violations: capCheck.violations,
			};
		}
	}

	if (dryRun) {
		const dryPlan = buildSequenceDryRunPlan({
			plan,
			fromWave: effectiveFromWave,
			throughWave,
			autoApproveGate,
			profile: sequenceProfile,
		});
		if (!dryPlan.ok) {
			return {
				ok: false,
				exitCode: 1,
				error: dryPlan.error,
				output: dryPlan.output,
				violations: dryPlan.violations,
			};
		}
		return {
			ok: true,
			exitCode: 0,
			dryRun: true,
			profile: dryPlan.profile,
			waves: dryPlan.waves,
			commands: dryPlan.commands,
			output: dryPlan.output,
		};
	}

	if (!skipPreflight) {
		const preflight = runBatchPreflight({ projectRoot, skipDoctor: false });
		if (!preflight.ok) {
			return {
				ok: false,
				exitCode: preflight.exitCode ?? 1,
				error: "preflight_failed",
				output: formatPreflightHuman(preflight),
			};
		}
	}

	if (sequenceState) {
		persistSequenceState(projectRoot, sequenceState, persistedCompletedWaves);
	}

	/** @type {Array<{ waveIndex: number, batchId: string|null, diagnosis: string|null }>} */
	const completedWaves = [...persistedCompletedWaves];

	const tasksRoot = plan?.metadata?.tasksRoot ?? null;
	const discoveredTasks = tasksRoot ? discoverTasks(tasksRoot) : [];
	const pendingTaskIds = tasksRoot ? filterPendingTaskIds(discoveredTasks, tasksRoot) : [];
	const doneOnMainTaskIds = discoveredTasks
		.map((task) => task.taskId)
		.filter((taskId) => !pendingTaskIds.includes(taskId));
	/** @type {Array<{ succeeded?: string[], skipped?: string[], failed?: string[] }>} */
	const priorMergeOutcomes = [];
	let satisfiedTaskIds = buildSequenceSatisfiedTaskIds(doneOnMainTaskIds, priorMergeOutcomes);
	let mergeBlockedWaveIndex = null;
	let sequenceHadMergeBlocked = false;
	/** @type {string[]} */
	const sequenceOutputLines = [];
	/** @type {Array<{ waveIndex: number, message: string }>} */
	const skippedWaves = [];

	/**
	 * @param {number} waveIndex
	 * @param {string[]} waveTaskIds
	 */
	function resolveRunnableWaveTasks(waveIndex, waveTaskIds) {
		if (mergeBlockedWaveIndex != null && waveIndex > mergeBlockedWaveIndex) {
			const lastOutcome = priorMergeOutcomes[priorMergeOutcomes.length - 1] ?? {};
			return resolveWaveAfterMergeBlocked({
				plan,
				waveIndex,
				waveTaskIds,
				satisfiedTaskIds,
				mergeBlockedWaveIndex,
				failedTaskIds: lastOutcome.failed ?? [],
				succeededTaskIds: lastOutcome.succeeded ?? [],
			});
		}
		return planSequenceWaveTasks({ plan, waveIndex, waveTaskIds, satisfiedTaskIds });
	}

	/**
	 * @param {number} waveIndex
	 * @param {object|null} batchState
	 * @param {string} [fallbackMessage]
	 */
	function absorbMergeBlockedWave(waveIndex, batchState, fallbackMessage = "") {
		const outcomes = collectWaveTaskOutcomes(batchState);
		priorMergeOutcomes.push(outcomes);
		satisfiedTaskIds = buildSequenceSatisfiedTaskIds(doneOnMainTaskIds, priorMergeOutcomes);
		mergeBlockedWaveIndex = waveIndex;
		sequenceHadMergeBlocked = true;
		const message =
			String(fallbackMessage ?? "").trim() ||
			String(batchState?.lastError ?? "").trim() ||
			`Wave merge blocked (§17.4 mixed-outcome policy) at wave ${waveIndex}.`;
		sequenceOutputLines.push(message);
	}

	for (const wave of wavePlan.waves) {
		const wavePlanResolution = resolveRunnableWaveTasks(wave.waveIndex, wave.taskIds);
		if (wavePlanResolution.action === "skip") {
			skippedWaves.push({
				waveIndex: wave.waveIndex,
				message: wavePlanResolution.message ?? `Sequence wave ${wave.waveIndex} skipped.`,
			});
			sequenceOutputLines.push(
				wavePlanResolution.message ?? `Sequence wave ${wave.waveIndex} skipped.`,
			);
			continue;
		}
		if (wavePlanResolution.message) {
			sequenceOutputLines.push(wavePlanResolution.message);
		} else if (wavePlanResolution.partialSkipMessage) {
			sequenceOutputLines.push(wavePlanResolution.partialSkipMessage);
		}

		const taskScope = wavePlanResolution.runnableTaskIds.join(" ");
		if (!taskScope) continue;

		let batchId = null;
		let detachedEnginePid = null;

		if (attached) {
			const startResult = await startBatchFn({
				projectRoot,
				scope: taskScope,
				skipPreflight: true,
			});
			if (!startResult.ok) {
				const reconciliation = reconcileBatch({ projectRoot });
				if (isMergeBlockedBatchOutcome({ startResult, reconciliation })) {
					absorbMergeBlockedWave(
						wave.waveIndex,
						loadSpineBatchState(projectRoot).raw,
						startResult.output ?? "",
					);
					continue;
				}
				if (!stopOnFailure) continue;
				return haltSequenceAndPersist(
					projectRoot,
					sequenceState,
					completedWaves,
					{
						waveIndex: wave.waveIndex,
						error: startResult.error ?? "batch_start_failed",
						completedWaves,
					},
					{ output: startResult.output },
				);
			}
			batchId = startResult.batchId ?? loadSpineBatchState(projectRoot).raw?.batchId ?? null;
		} else {
			if (!spineBin) {
				return {
					ok: false,
					exitCode: 1,
					error: "spine_bin_required",
					output: "Detached sequence runs require spineBin.\n",
				};
			}
			const detached = await startBatchDetached({
				projectRoot,
				spineBin,
				scope: taskScope,
				skipPreflight: true,
				waitTerminal: false,
			});
			detachedEnginePid = detached.result?.enginePid ?? null;
			if (!detached.ok) {
				const engineStartedButTimeout =
					detached.result?.status === "engine_started" &&
					detached.result?.batchId &&
					isProcessAlive(detachedEnginePid);
				if (engineStartedButTimeout) {
					batchId = detached.result.batchId;
				} else {
					if (!stopOnFailure) continue;
					return haltSequenceAndPersist(
						projectRoot,
						sequenceState,
						completedWaves,
						{
							waveIndex: wave.waveIndex,
							error: detached.result?.error ?? "batch_start_failed",
							completedWaves,
						},
						{ output: detached.output },
					);
				}
			} else {
				batchId = detached.result?.batchId ?? null;
			}
		}

		const wait = attached
			? {
					ok: true,
					batchId,
					diagnosis: reconcileBatch({ projectRoot }).diagnosis ?? null,
				}
			: await waitForSequenceBatchTerminal({ projectRoot, pollIntervalMs, timeoutMs, enginePid: detachedEnginePid ?? null });

		if (!wait.ok || isSequenceBatchFailure(wait.diagnosis)) {
			const reconciliation = wait.reconciliation ?? reconcileBatch({ projectRoot });
			if (isMergeBlockedBatchOutcome({ reconciliation })) {
				absorbMergeBlockedWave(
					wave.waveIndex,
					reconciliation.signals?.raw ?? loadSpineBatchState(projectRoot).raw,
					reconciliation.headline ?? "",
				);
				continue;
			}
			if (!stopOnFailure) continue;
			return haltSequenceAndPersist(projectRoot, sequenceState, completedWaves, {
				waveIndex: wave.waveIndex,
				error: wait.error ?? "batch_failed",
				diagnosis: wait.diagnosis ?? null,
				batchId: wait.batchId ?? batchId,
				completedWaves,
			});
		}

		const land = runSequenceWaveLandLoop({ projectRoot, batchId: wait.batchId ?? batchId, autoApproveGate });
		if (!land.ok) {
			if (!stopOnFailure) continue;
			return haltSequenceAndPersist(
				projectRoot,
				sequenceState,
				completedWaves,
				{
					waveIndex: wave.waveIndex,
					error: land.error ?? "land_loop_failed",
					diagnosis: land.diagnosis ?? wait.diagnosis ?? null,
					batchId: land.batchId ?? wait.batchId ?? batchId,
					completedWaves,
				},
				{ step: land.step, headline: land.headline },
			);
		}

		const waveResult = {
			waveIndex: wave.waveIndex,
			batchId: land.batchId ?? wait.batchId ?? batchId,
			diagnosis: wait.diagnosis ?? null,
		};
		completedWaves.push(waveResult);

		for (const taskId of wavePlanResolution.runnableTaskIds) {
			satisfiedTaskIds.add(taskId);
		}

		if (sequenceState) {
			const lastBatchId = waveResult.batchId ?? sequenceState.lastBatchId ?? null;
			sequenceState = buildSequenceStateSnapshot(sequenceState, {
				completedWaves,
				lastBatchId,
				status: "active",
			});
			persistSequenceState(projectRoot, sequenceState, completedWaves, { lastBatchId });
		}
	}

	finalizeSequenceState(projectRoot, sequenceState, completedWaves, plan);

	if (completedWaves.length > 0) {
		sequenceOutputLines.push(`Sequence completed ${completedWaves.length} wave(s).`);
	}

	const partialMergeBlocked = sequenceHadMergeBlocked && completedWaves.length < wavePlan.waves.length;

	return {
		ok: !sequenceHadMergeBlocked,
		exitCode: sequenceHadMergeBlocked ? 1 : 0,
		completedWaves,
		skippedWaves,
		mergeBlocked: sequenceHadMergeBlocked,
		partial: partialMergeBlocked,
		waveCount: wavePlan.waves.length,
		resumed: resume,
		output: `${sequenceOutputLines.join("\n")}\n`,
	};
}
