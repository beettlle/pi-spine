/**
 * Planner wave sequence runner (GitHub #54 Tier 2 SP-C).
 * Chains separate batch starts through gate → integrate → complete per planner wave.
 */

import { loadSpineConfig } from "../config/spine-config-load.mjs";
import { runBatchPreflight, resolveTasksRoot } from "../config/spine-preflight-lib.mjs";
import { buildPlan } from "../planner/index.mjs";
import { startBatch } from "./engine.mjs";
import { startBatchDetached } from "./detached-start.mjs";
import { approveIntegrateGate, loadGateRecord } from "./gate.mjs";
import { integrateOrchToBase } from "./integrate.mjs";
import { completeBatch } from "./lifecycle.mjs";
import { reconcileBatch } from "./reconcile.mjs";
import { loadSpineBatchState } from "./state.mjs";

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
	pollIntervalMs = 250,
	timeoutMs = 120_000,
}) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const reconciliation = reconcileBatch({ projectRoot });
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
	const reconciliation = reconcileBatch({ projectRoot });
	return {
		ok: false,
		error: "timeout_waiting_for_batch",
		diagnosis: reconciliation.diagnosis ?? null,
		reconciliation,
		batchId: reconciliation.batchId ?? null,
	};
}

/**
 * @param {object} plan
 * @param {number} waveIndex
 */
export function resolveWaveTaskIds(plan, waveIndex) {
	const waves = plan?.waves ?? [];
	if (!Number.isInteger(waveIndex) || waveIndex < 0 || waveIndex >= waves.length) {
		return {
			ok: false,
			error: "wave_out_of_range",
			waveIndex,
			waveCount: waves.length,
			output: `Wave index ${waveIndex} is out of range (plan has ${waves.length} wave(s)).`,
		};
	}

	const taskIds = [...(waves[waveIndex]?.taskIds ?? [])];
	if (taskIds.length === 0) {
		return {
			ok: false,
			error: "wave_empty",
			waveIndex,
			waveCount: waves.length,
			output: `Planner wave ${waveIndex} has no tasks.`,
		};
	}

	return { ok: true, waveIndex, taskIds, waveCount: waves.length };
}

/**
 * @param {object} plan
 * @param {object} [options]
 * @param {number} [options.fromWave]
 * @param {number|null} [options.throughWave]
 */
export function resolveSequenceWaves(plan, { fromWave = 0, throughWave = null } = {}) {
	const waves = plan?.waves ?? [];
	if (waves.length === 0) {
		return { ok: false, error: "plan_has_no_waves", output: "Planner scope has no waves." };
	}

	const lastWave = throughWave ?? waves.length - 1;
	if (!Number.isInteger(fromWave) || fromWave < 0 || fromWave >= waves.length) {
		return {
			ok: false,
			error: "from_wave_out_of_range",
			fromWave,
			waveCount: waves.length,
			output: `--from-wave ${fromWave} is out of range (plan has ${waves.length} wave(s)).`,
		};
	}
	if (!Number.isInteger(lastWave) || lastWave < fromWave || lastWave >= waves.length) {
		return {
			ok: false,
			error: "through_wave_out_of_range",
			throughWave: lastWave,
			fromWave,
			waveCount: waves.length,
			output: `--through-wave ${lastWave} is invalid for plan with ${waves.length} wave(s) (from-wave=${fromWave}).`,
		};
	}

	/** @type {Array<{ waveIndex: number, taskIds: string[] }>} */
	const entries = [];
	for (let waveIndex = fromWave; waveIndex <= lastWave; waveIndex++) {
		const resolved = resolveWaveTaskIds(plan, waveIndex);
		if (!resolved.ok) return resolved;
		entries.push({ waveIndex, taskIds: resolved.taskIds });
	}

	return { ok: true, waves: entries, waveCount: waves.length, fromWave, throughWave: lastWave };
}

/**
 * @param {object} params
 * @param {number} params.waveIndex
 * @param {string[]} params.taskIds
 * @param {boolean} [params.autoApproveGate]
 */
export function buildSequenceWaveCommands({ waveIndex, taskIds, autoApproveGate = false }) {
	const taskScope = taskIds.join(" ");
	return [
		`# Wave ${waveIndex}`,
		`spine batch start ${taskScope}`,
		"spine status --diagnose  # wait for terminal batch phase",
		autoApproveGate ? "spine gate approve" : "spine gate approve  # when integrate gate is open",
		"spine integrate",
		"spine batch complete",
	];
}

/**
 * @param {object} params
 * @param {object} params.plan
 * @param {number} [params.fromWave]
 * @param {number|null} [params.throughWave]
 * @param {boolean} [params.autoApproveGate]
 */
export function buildSequenceDryRunPlan({
	plan,
	fromWave = 0,
	throughWave = null,
	autoApproveGate = false,
}) {
	const wavePlan = resolveSequenceWaves(plan, { fromWave, throughWave });
	if (!wavePlan.ok) return wavePlan;

	const commands = wavePlan.waves.flatMap((wave) =>
		buildSequenceWaveCommands({
			waveIndex: wave.waveIndex,
			taskIds: wave.taskIds,
			autoApproveGate,
		}),
	);

	return {
		ok: true,
		waves: wavePlan.waves,
		waveCount: wavePlan.waveCount,
		fromWave: wavePlan.fromWave,
		throughWave: wavePlan.throughWave,
		commands,
		output: `${commands.join("\n")}\n`,
	};
}

/**
 * @param {string} projectRoot
 * @param {string} scope
 */
export function buildSequencePlan(projectRoot, scope) {
	const configResult = loadSpineConfig(projectRoot);
	const config = configResult.config ?? {};
	const tasksRoot = resolveTasksRoot(projectRoot, configResult);
	if (!tasksRoot) {
		return { ok: false, error: "tasks_root_missing", output: "Tasks root is not configured.\n" };
	}

	return { ok: true, plan: buildPlan({ scope, config, tasksRoot }), config, tasksRoot };
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
 * @param {object} params
 * @param {number} params.waveIndex
 * @param {string} [params.error]
 * @param {string|null} [params.diagnosis]
 * @param {string|null} [params.batchId]
 * @param {Array<{ waveIndex: number, batchId: string|null, diagnosis: string|null }>} params.completedWaves
 */
function sequenceHalt({ waveIndex, error, diagnosis = null, batchId = null, completedWaves }) {
	return {
		ok: false,
		exitCode: 1,
		halted: true,
		waveIndex,
		error,
		diagnosis,
		batchId,
		completedWaves,
	};
}

/**
 * @param {object} ctx
 */
export async function runSequence(ctx) {
	const {
		projectRoot,
		plan,
		fromWave = 0,
		throughWave = null,
		attached = false,
		autoApproveGate = false,
		stopOnFailure = true,
		dryRun = false,
		skipPreflight = false,
		pollIntervalMs = 250,
		timeoutMs = 120_000,
		spineBin = null,
		startBatchFn = startBatch,
	} = ctx;

	const wavePlan = resolveSequenceWaves(plan, { fromWave, throughWave });
	if (!wavePlan.ok) {
		return { ok: false, exitCode: 1, error: wavePlan.error, output: wavePlan.output };
	}

	if (dryRun) {
		const dryPlan = buildSequenceDryRunPlan({ plan, fromWave, throughWave, autoApproveGate });
		return {
			ok: true,
			exitCode: 0,
			dryRun: true,
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
				output: preflight.output,
			};
		}
	}

	/** @type {Array<{ waveIndex: number, batchId: string|null, diagnosis: string|null }>} */
	const completedWaves = [];

	for (const wave of wavePlan.waves) {
		const taskScope = wave.taskIds.join(" ");
		let batchId = null;

		if (attached) {
			const startResult = await startBatchFn({
				projectRoot,
				scope: taskScope,
				skipPreflight: true,
			});
			if (!startResult.ok) {
				if (!stopOnFailure) continue;
				return {
					...sequenceHalt({
						waveIndex: wave.waveIndex,
						error: startResult.error ?? "batch_start_failed",
						completedWaves,
					}),
					output: startResult.output,
				};
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
				waitTerminal: true,
			});
			if (!detached.ok) {
				if (!stopOnFailure) continue;
				return {
					...sequenceHalt({
						waveIndex: wave.waveIndex,
						error: detached.result?.error ?? "batch_start_failed",
						completedWaves,
					}),
					output: detached.output,
				};
			}
			batchId = detached.result?.batchId ?? null;
		}

		const wait = attached
			? {
					ok: true,
					batchId,
					diagnosis: reconcileBatch({ projectRoot }).diagnosis ?? null,
				}
			: await waitForSequenceBatchTerminal({ projectRoot, pollIntervalMs, timeoutMs });

		if (!wait.ok || isSequenceBatchFailure(wait.diagnosis)) {
			if (!stopOnFailure) continue;
			return sequenceHalt({
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
			return {
				...sequenceHalt({
					waveIndex: wave.waveIndex,
					error: land.error ?? "land_loop_failed",
					diagnosis: land.diagnosis ?? wait.diagnosis ?? null,
					batchId: land.batchId ?? wait.batchId ?? batchId,
					completedWaves,
				}),
				step: land.step,
				headline: land.headline,
			};
		}

		completedWaves.push({
			waveIndex: wave.waveIndex,
			batchId: land.batchId ?? wait.batchId ?? batchId,
			diagnosis: wait.diagnosis ?? null,
		});
	}

	return {
		ok: true,
		exitCode: 0,
		completedWaves,
		waveCount: wavePlan.waves.length,
		output: `Sequence completed ${completedWaves.length} wave(s).\n`,
	};
}
