/**
 * Doctor warnings for stall config when running real pi workers (SP-087).
 */

import {
	DEFAULT_PI_WORKER_TIMEOUT_MS,
	resolveTaskStallMinutes,
} from "../batch/task-stall-budget.mjs";

const DEFAULT_IMPLICIT_STALL_MIN = 60;
const RECOMMENDED_STALL_MIN = 120;
const RUNNER_IMPLICIT_PI_TIMEOUT_MIN = DEFAULT_PI_WORKER_TIMEOUT_MS / 60_000;

/**
 * @returns {boolean}
 */
export function isStubWorkerMode() {
	const stub = process.env.SPINE_WORKER_STUB;
	return stub === "1" || stub === "true";
}

/**
 * @param {object} [config]
 */
export function resolveConfiguredStallMinutes(config = {}) {
	const raw = Number(config.lanes?.stallTimeoutMinutes);
	return Number.isFinite(raw) && raw > 0 ? raw : null;
}

/**
 * @param {object} params
 * @param {object} [params.config]
 */
export function buildStallConfigDoctorCheck({ config = {} }) {
	if (isStubWorkerMode()) {
		return {
			label: "lanes.stallTimeoutMinutes (real pi)",
			ok: true,
			detail: "SPINE_WORKER_STUB set — stall defaults not required",
		};
	}

	const configured = resolveConfiguredStallMinutes(config);
	if (configured === null) {
		return {
			label: "lanes.stallTimeoutMinutes (real pi)",
			ok: true,
			warning: true,
			detail: `unset (implicit ${DEFAULT_IMPLICIT_STALL_MIN}m) — set ≥${RECOMMENDED_STALL_MIN} for long pi tasks`,
			suggestedCommand: "spine settings set lanes.stallTimeoutMinutes 120",
		};
	}

	if (configured <= DEFAULT_IMPLICIT_STALL_MIN) {
		return {
			label: "lanes.stallTimeoutMinutes (real pi)",
			ok: true,
			warning: true,
			detail: `${configured}m is low for M/L tasks — recommend ≥${RECOMMENDED_STALL_MIN}`,
			suggestedCommand: "spine settings set lanes.stallTimeoutMinutes 120",
		};
	}

	return {
		label: "lanes.stallTimeoutMinutes (real pi)",
		ok: true,
		detail: `${configured}m`,
	};
}

/**
 * @param {object} params
 * @param {object} [params.config]
 */
export function buildPiWorkerTimeoutDoctorCheck({ config = {} }) {
	if (isStubWorkerMode()) {
		return {
			label: "pi worker timeout (real pi)",
			ok: true,
			detail: "SPINE_WORKER_STUB set — pi subprocess timeout not used",
		};
	}

	if (process.env.SPINE_WORKER_PI_TIMEOUT_MS) {
		const minutes = Math.round(Number(process.env.SPINE_WORKER_PI_TIMEOUT_MS) / 60_000);
		return {
			label: "pi worker timeout (real pi)",
			ok: true,
			detail: `SPINE_WORKER_PI_TIMEOUT_MS override (${minutes}m)`,
		};
	}

	const configured = resolveConfiguredStallMinutes(config) ?? DEFAULT_IMPLICIT_STALL_MIN;
	const mFloorMinutes = resolveTaskStallMinutes("M", config);
	if (mFloorMinutes > RUNNER_IMPLICIT_PI_TIMEOUT_MIN) {
		return {
			label: "pi worker timeout (real pi)",
			ok: true,
			detail: `follows stall budget (M tasks ≥${mFloorMinutes}m; configured ${configured}m)`,
		};
	}

	return {
		label: "pi worker timeout (real pi)",
		ok: true,
		detail: `aligned with stall budget (≥${configured}m)`,
	};
}
