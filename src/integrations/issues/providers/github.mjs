/**
 * Default GitHub provider for opt-in issue sync on land (#387, SP-892).
 *
 * Holds the `gh` CLI runner extracted from
 * `src/integrations/github/sync-on-land.mjs`: array-args spawn (no shell),
 * piped output, hard timeout, and the `{ status, stdout, stderr, error }`
 * result shape. Sync callers keep the soft-fail contract — a missing,
 * hung, or failing `gh` never throws from here; the caller inspects the
 * result. Future non-github providers live alongside this module.
 */

import { spawnSync } from "node:child_process";

/** Hard timeout per `gh` call so a hung CLI cannot stall the integrate path. */
export const GH_CALL_TIMEOUT_MS = 30_000;

/**
 * @typedef {object} GhRunResult
 * @property {number | null} status
 * @property {string} [stdout]
 * @property {string} [stderr]
 * @property {Error | null} [error]
 */

/**
 * Default `gh` runner: array-args spawn (no shell), piped output, hard timeout.
 *
 * @param {string} projectRoot
 * @param {string[]} args
 * @param {object} [deps]
 * @param {typeof import("node:child_process").spawnSync} [deps.spawn] Injectable spawn (tests stub this).
 * @returns {GhRunResult}
 */
export function defaultRunGh(projectRoot, args, { spawn = spawnSync } = {}) {
	const result = spawn("gh", args, {
		cwd: projectRoot,
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "pipe"],
		timeout: GH_CALL_TIMEOUT_MS,
	});
	return {
		status: result.status ?? null,
		stdout: typeof result.stdout === "string" ? result.stdout : "",
		stderr: typeof result.stderr === "string" ? result.stderr : "",
		error: result.error ?? null,
	};
}
