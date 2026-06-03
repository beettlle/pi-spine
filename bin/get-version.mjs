import { spawnSync } from "node:child_process";

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

export function getVersion(cmd, flag = "--version") {
	let result;
	try {
		result = spawnSync(cmd, [flag], {
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
		});
	} catch {
		return null;
	}

	if (!result || result.error || result.status !== 0) return null;

	const stdout = (result.stdout ?? "").toString().trim();
	const stderr = (result.stderr ?? "").toString().trim();
	if (stdout) return stdout;
	if (stderr) return stderr;
	return null;
}
