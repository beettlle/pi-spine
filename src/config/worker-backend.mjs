/**
 * Lane worker execution backend (TP-050).
 * @see docs/adoption/create-agent-session-spike.md
 */

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/** @typedef {"subprocess" | "agentSession"} WorkerBackend */

export const WORKER_BACKENDS = Object.freeze(["subprocess", "agentSession"]);

export const DEFAULT_WORKER_BACKEND = /** @type {const} */ ("subprocess");

/** Doctor check label — subprocess is the production default (FR-SHIP-09 / SP-219). */
export const WORKER_BACKEND_DOCTOR_LABEL = "worker backend (lanes.workerBackend)";

const SUBPROCESS_DETAIL =
	"subprocess — pi -p via spine-worker-runner (production default per FR-SHIP-09)";

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
 * Doctor/preflight check for lanes.workerBackend.
 * Subprocess is the default; agentSession is opt-in and requires the pi-coding-agent peer.
 *
 * @param {object} [config]
 */
export function buildWorkerBackendDoctorCheck(config = {}) {
	const backend = resolveWorkerBackend(config);
	const configuredRaw = config.lanes?.workerBackend;

	if (backend !== "agentSession") {
		const unset = configuredRaw == null || configuredRaw === "";
		return {
			label: WORKER_BACKEND_DOCTOR_LABEL,
			ok: true,
			detail: unset ? `${SUBPROCESS_DETAIL}; config unset (falls back to default)` : SUBPROCESS_DETAIL,
		};
	}

	/** @type {string[]} */
	const issues = [];
	try {
		require.resolve("@earendil-works/pi-coding-agent");
	} catch {
		issues.push("@earendil-works/pi-coding-agent not installed");
	}

	if (issues.length === 0) {
		return {
			label: WORKER_BACKEND_DOCTOR_LABEL,
			ok: true,
			warning: true,
			detail:
				"agentSession (opt-in) — pi-coding-agent peer available; subprocess remains default until land-loop dogfood passes",
			suggestedCommand: "./scripts/stub-free-dogfood.sh --agent-session",
		};
	}

	return {
		label: WORKER_BACKEND_DOCTOR_LABEL,
		ok: false,
		detail: `agentSession (opt-in): ${issues.join("; ")}`,
		suggestedCommand: "npm install @earendil-works/pi-coding-agent",
	};
}

/** @deprecated Use buildWorkerBackendDoctorCheck */
export const buildAgentSessionDoctorCheck = buildWorkerBackendDoctorCheck;

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
