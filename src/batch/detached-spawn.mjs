/**
 * Detached batch engine spawn argv builders — leaf module (SP-469 / #83-C).
 * No imports from detached-start, reconcile, or post-merge-limbo.
 */

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

export const DETACHED_ENGINE_LOG_REL = path.join(".spine", "runtime", "detached-engine.log");

/**
 * @param {string} projectRoot
 */
export function detachedEngineLogPath(projectRoot) {
	return path.join(projectRoot, DETACHED_ENGINE_LOG_REL);
}

/**
 * @param {object} params
 * @param {string} params.scope
 * @param {boolean} [params.skipPreflight]
 * @param {boolean} [params.forceSuperseded]
 * @param {number|null} [params.waveFilter]
 */
export function buildAttachedBatchStartArgv({
	scope,
	skipPreflight = false,
	forceSuperseded = false,
	waveFilter = null,
}) {
	const tokens = String(scope ?? "")
		.trim()
		.split(/\s+/)
		.filter(Boolean);
	const args = ["batch", "start", ...tokens, "--attached"];
	if (skipPreflight) args.push("--skip-preflight");
	if (forceSuperseded) args.push("--force-superseded");
	if (waveFilter != null) args.push("--wave", String(waveFilter));
	return args;
}

/**
 * @param {object} params
 * @param {boolean} [params.force]
 */
export function buildAttachedBatchResumeArgv({ force = false }) {
	const args = ["batch", "resume", "--attached"];
	if (force) args.push("--force");
	return args;
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.spineBin
 * @param {string[]} params.argv
 */
export function spawnDetachedBatchEngine({ projectRoot, spineBin, argv }) {
	const logPath = detachedEngineLogPath(projectRoot);
	fs.mkdirSync(path.dirname(logPath), { recursive: true });
	const logFd = fs.openSync(logPath, "a");
	fs.writeFileSync(
		logFd,
		`\n--- detached batch engine ${new Date().toISOString()} argv=${argv.join(" ")} ---\n`,
	);

	const child = spawn(process.execPath, [spineBin, ...argv], {
		cwd: projectRoot,
		detached: true,
		stdio: ["ignore", logFd, logFd],
		env: {
			...process.env,
			// Detached parent intentionally spawns an attached engine subprocess (#163 / SP-539).
			SPINE_ALLOW_ATTACHED_HARNESS: "1",
		},
	});
	child.unref();
	fs.closeSync(logFd);

	return { enginePid: child.pid ?? null, logPath: DETACHED_ENGINE_LOG_REL };
}
