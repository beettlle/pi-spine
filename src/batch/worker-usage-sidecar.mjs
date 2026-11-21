/**
 * Engine-owned worker usage sidecar helpers (SP-879 / SP-881 / #380).
 *
 * Kept as a tiny leaf so heartbeat / lane-dirty-check stay under the LOC cap.
 */

/** Basename of the SP-879 worker usage sidecar (keep in sync with runner/queue). */
export const WORKER_USAGE_SIDECAR_FILENAME = "worker-usage.json";

/**
 * True when the porcelain path is the engine-owned worker usage sidecar.
 *
 * @param {string} filePath
 * @returns {boolean}
 */
export function isWorkerUsageSidecarPath(filePath) {
	if (!filePath || typeof filePath !== "string") return false;
	const normalized = filePath.replace(/\\/g, "/");
	const base = normalized.includes("/")
		? normalized.slice(normalized.lastIndexOf("/") + 1)
		: normalized;
	return base === WORKER_USAGE_SIDECAR_FILENAME;
}
