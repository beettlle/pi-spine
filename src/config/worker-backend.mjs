/**
 * Lane worker execution backend (TP-050).
 * @see docs/adoption/create-agent-session-spike.md
 */

/** @typedef {"subprocess" | "agentSession"} WorkerBackend */

export const WORKER_BACKENDS = Object.freeze(["subprocess", "agentSession"]);

export const DEFAULT_WORKER_BACKEND = /** @type {const} */ ("subprocess");

/**
 * @param {unknown} value
 * @returns {value is WorkerBackend}
 */
export function isWorkerBackend(value) {
	return typeof value === "string" && WORKER_BACKENDS.includes(value);
}

/**
 * Resolve effective worker backend from spine config.
 * Missing or invalid values fall back to subprocess (safe default).
 *
 * @param {object} [config]
 * @returns {WorkerBackend}
 */
export function resolveWorkerBackend(config = {}) {
	const raw = config.lanes?.workerBackend;
	if (raw == null || raw === "") {
		return DEFAULT_WORKER_BACKEND;
	}
	if (isWorkerBackend(raw)) {
		return raw;
	}
	return DEFAULT_WORKER_BACKEND;
}

/**
 * Validate optional lanes.workerBackend for spine-config schema.
 *
 * @param {object} config
 * @returns {{ code: string, message: string, suggestedCommand: string } | null}
 */
export function validateWorkerBackendConfig(config) {
	const raw = config.lanes?.workerBackend;
	if (raw == null || raw === "") {
		return null;
	}
	if (isWorkerBackend(raw)) {
		return null;
	}
	return {
		code: "CONFIG_WORKER_BACKEND_INVALID",
		message: `lanes.workerBackend must be one of: ${WORKER_BACKENDS.join(", ")}`,
		suggestedCommand: "spine settings set lanes.workerBackend subprocess",
	};
}
