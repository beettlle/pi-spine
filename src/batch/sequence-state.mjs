/**
 * Planner wave sequence runtime state (GitHub #54 Tier 2 SP-D).
 * Persists progress under `.spine/runtime/sequence/` for `--resume`.
 */

import fs from "node:fs";
import path from "node:path";
import { writeJsonAtomic } from "../fs/atomic-write.mjs";

export const SEQUENCE_STATE_VERSION = 1;
export const SEQUENCE_STATE_REL = path.join(".spine", "runtime", "sequence", "state.json");

/** @typedef {{ waveIndex: number, batchId: string|null, diagnosis: string|null }} SequenceCompletedWave */

/**
 * @param {string} projectRoot
 */
export function sequenceStatePath(projectRoot) {
	return path.join(projectRoot, SEQUENCE_STATE_REL);
}

/**
 * @param {Date} [now]
 */
export function generateSequenceId(now = new Date()) {
	const y = now.getUTCFullYear();
	const m = String(now.getUTCMonth() + 1).padStart(2, "0");
	const d = String(now.getUTCDate()).padStart(2, "0");
	const h = String(now.getUTCHours()).padStart(2, "0");
	const min = String(now.getUTCMinutes()).padStart(2, "0");
	const s = String(now.getUTCSeconds()).padStart(2, "0");
	return `seq-${y}${m}${d}T${h}${min}${s}`;
}

/**
 * @param {object} params
 * @param {string} params.scope
 * @param {number} params.fromWave
 * @param {number|null} [params.throughWave]
 */
export function createInitialSequenceState({ scope, fromWave, throughWave = null }) {
	return {
		version: SEQUENCE_STATE_VERSION,
		sequenceId: generateSequenceId(),
		scope,
		fromWave,
		throughWave,
		completedWaves: /** @type {SequenceCompletedWave[]} */ ([]),
		lastBatchId: null,
		status: "active",
		updatedAt: new Date().toISOString(),
	};
}

/**
 * @param {string} projectRoot
 * @returns {{ ok: true, state: object } | { ok: false, error: string, output?: string }}
 */
export function loadSequenceState(projectRoot) {
	const filePath = sequenceStatePath(projectRoot);
	if (!fs.existsSync(filePath)) {
		return {
			ok: false,
			error: "no_sequence_state",
			output: "No saved sequence state — start a sequence or pass --from-wave.\n",
		};
	}

	try {
		const state = JSON.parse(fs.readFileSync(filePath, "utf-8"));
		return { ok: true, state };
	} catch (err) {
		return {
			ok: false,
			error: "sequence_state_corrupt",
			output: `Sequence state is unreadable: ${err instanceof Error ? err.message : String(err)}\n`,
		};
	}
}

/**
 * @param {string} projectRoot
 * @param {object} state
 */
export function saveSequenceState(projectRoot, state) {
	const filePath = sequenceStatePath(projectRoot);
	writeJsonAtomic(filePath, {
		...state,
		version: SEQUENCE_STATE_VERSION,
		updatedAt: new Date().toISOString(),
	});
}

/**
 * @param {string} projectRoot
 */
export function clearSequenceState(projectRoot) {
	const filePath = sequenceStatePath(projectRoot);
	if (fs.existsSync(filePath)) {
		fs.unlinkSync(filePath);
	}
}

/**
 * @param {object|null|undefined} state
 */
export function resolveResumeFromWave(state) {
	const completed = state?.completedWaves ?? [];
	if (completed.length === 0) {
		return Number.isInteger(state?.fromWave) ? state.fromWave : 0;
	}
	const maxCompleted = Math.max(...completed.map((wave) => wave.waveIndex));
	return maxCompleted + 1;
}

/**
 * @param {object} state
 * @param {string} scope
 */
export function validateSequenceStateForResume(state, scope) {
	if (!state || typeof state !== "object") {
		return { ok: false, error: "no_sequence_state", output: "No saved sequence state.\n" };
	}
	if (state.status === "completed") {
		return {
			ok: false,
			error: "sequence_already_completed",
			output: "Saved sequence already completed — start a new sequence without --resume.\n",
		};
	}
	if (String(state.scope ?? "") !== String(scope)) {
		return {
			ok: false,
			error: "sequence_scope_mismatch",
			output: `Saved sequence scope is "${state.scope ?? ""}" but command scope is "${scope}".\n`,
		};
	}
	return { ok: true };
}

/**
 * @param {object} state
 * @param {SequenceCompletedWave[]} completedWaves
 * @param {string|null} lastBatchId
 * @param {"active"|"halted"|"completed"} status
 */
export function buildSequenceStateSnapshot(state, { completedWaves, lastBatchId, status }) {
	return {
		...state,
		completedWaves,
		lastBatchId,
		status,
	};
}

/**
 * @param {object} params
 * @param {number} params.waveIndex
 * @param {string} [params.error]
 * @param {string|null} [params.diagnosis]
 * @param {string|null} [params.batchId]
 * @param {SequenceCompletedWave[]} params.completedWaves
 */
export function buildSequenceHaltResult({
	waveIndex,
	error,
	diagnosis = null,
	batchId = null,
	completedWaves,
}) {
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
 * @param {string} projectRoot
 * @param {object|null} sequenceState
 * @param {SequenceCompletedWave[]} completedWaves
 * @param {object} haltParams
 * @param {object} [extra]
 */
export function haltSequenceAndPersist(projectRoot, sequenceState, completedWaves, haltParams, extra = {}) {
	const halt = { ...buildSequenceHaltResult(haltParams), ...extra };
	persistSequenceState(projectRoot, sequenceState, completedWaves, {
		lastBatchId: haltParams.batchId ?? sequenceState?.lastBatchId ?? null,
		status: "halted",
	});
	return halt;
}

/**
 * @param {string} projectRoot
 * @param {object|null} sequenceState
 * @param {SequenceCompletedWave[]} completedWaves
 * @param {string|null} [lastBatchId]
 * @param {"active"|"halted"} [status]
 */
export function persistSequenceState(
	projectRoot,
	sequenceState,
	completedWaves,
	{ lastBatchId = null, status = "active" } = {},
) {
	if (!sequenceState) return;
	saveSequenceState(
		projectRoot,
		buildSequenceStateSnapshot(sequenceState, {
			completedWaves,
			lastBatchId: lastBatchId ?? sequenceState.lastBatchId ?? null,
			status,
		}),
	);
}

/**
 * @param {string} projectRoot
 * @param {object} params
 * @param {boolean} params.resume
 * @param {string} params.scope
 * @param {number} params.fromWave
 * @param {number|null} [params.throughWave]
 * @param {boolean} params.dryRun
 */
export function prepareSequenceRunState(projectRoot, { resume, scope, fromWave, throughWave, dryRun }) {
	if (resume) {
		const loaded = loadSequenceState(projectRoot);
		if (!loaded.ok) {
			return { ok: false, error: loaded.error, output: loaded.output };
		}
		const resumeCheck = validateSequenceStateForResume(loaded.state, scope);
		if (!resumeCheck.ok) {
			return { ok: false, error: resumeCheck.error, output: resumeCheck.output };
		}
		return {
			ok: true,
			sequenceState: loaded.state,
			effectiveFromWave: resolveResumeFromWave(loaded.state),
			persistedCompletedWaves: [...(loaded.state.completedWaves ?? [])],
		};
	}

	if (dryRun) {
		return {
			ok: true,
			sequenceState: null,
			effectiveFromWave: fromWave,
			persistedCompletedWaves: [],
		};
	}

	return {
		ok: true,
		sequenceState: createInitialSequenceState({ scope, fromWave, throughWave }),
		effectiveFromWave: fromWave,
		persistedCompletedWaves: [],
	};
}

/**
 * @param {string} projectRoot
 * @param {object|null} sequenceState
 * @param {SequenceCompletedWave[]} completedWaves
 * @param {object} plan
 */
export function finalizeSequenceState(projectRoot, sequenceState, completedWaves, plan) {
	if (!sequenceState) return;

	const lastCompletedWave =
		completedWaves.length > 0 ? Math.max(...completedWaves.map((wave) => wave.waveIndex)) : -1;
	const planLastWave = (plan?.waves?.length ?? 0) - 1;
	const allPlanWavesComplete = lastCompletedWave >= planLastWave;

	if (allPlanWavesComplete) {
		clearSequenceState(projectRoot);
		return;
	}

	persistSequenceState(projectRoot, sequenceState, completedWaves, {
		lastBatchId: sequenceState.lastBatchId ?? null,
		status: "active",
	});
}
