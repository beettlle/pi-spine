import { spawnSync } from "node:child_process";

/**
 * @param {string} cmd
 * @returns {boolean}
 */
export function commandExists(cmd) {
	let result;
	try {
		result = spawnSync("which", [cmd], {
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
		});
	} catch {
		return false;
	}

	return Boolean(result && !result.error && result.status === 0);
}
