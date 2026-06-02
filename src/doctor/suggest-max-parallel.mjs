import os from "node:os";

const MIN_SUGGESTED = 1;
const MAX_SUGGESTED = 4;

/**
 * Physical/logical CPU count for sizing hints only.
 * Lanes are parallel agents and git worktrees — never set maxParallel = cpuCount.
 */
export function detectCpuCount() {
	return os.availableParallelism?.() ?? os.cpus().length;
}

function clamp(min, max, value) {
	return Math.min(max, Math.max(min, value));
}

/**
 * Conservative maxParallel suggestion (heuristic v1).
 * suggested = clamp(1, 4, floor(cpuCount / 2)) — do not use cpuCount as maxParallel.
 *
 * @param {number} cpuCount
 * @returns {{ suggested: number, rationale: string }}
 */
export function suggestMaxParallel(cpuCount) {
	const raw = Math.floor(cpuCount / 2);
	const suggested = clamp(MIN_SUGGESTED, MAX_SUGGESTED, raw);
	const rationale =
		"lanes are parallel agents/worktrees, not CPU threads; cap limits API cost, supervision, and merge risk";
	return { suggested, rationale };
}

/**
 * @param {{ configured: number, cpuCount: number }} args
 */
export function buildMaxParallelDoctorCheck({ configured, cpuCount }) {
	const { suggested, rationale } = suggestMaxParallel(cpuCount);
	const overParallel = configured > suggested + 1;
	const detail = `configured=${configured}, suggested=${suggested} (${cpuCount} CPU threads) — ${rationale}`;

	return {
		label: "lanes.maxParallel sizing",
		ok: true,
		warning: overParallel,
		detail,
		...(overParallel
			? {
					suggestedCommand:
						"edit .spine/spine-config.json → lanes.maxParallel (advisory only)",
				}
			: {}),
	};
}
