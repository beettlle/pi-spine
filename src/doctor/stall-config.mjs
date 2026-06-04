/**
 * Doctor warnings for stall config when running real pi workers (SP-087).
 */

const DEFAULT_IMPLICIT_STALL_MIN = 60;
const RECOMMENDED_STALL_MIN = 120;

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
