/**
 * Cross-platform process liveness check (signal 0 / kill -0 equivalent).
 */

/**
 * @param {unknown} pid
 * @returns {boolean}
 */
export function isProcessAlive(pid) {
	const n = Number(pid);
	if (!Number.isFinite(n) || n <= 0) return false;
	try {
		process.kill(n, 0);
		return true;
	} catch (err) {
		if (err && typeof err === "object" && "code" in err && err.code === "EPERM") {
			return true;
		}
		return false;
	}
}
