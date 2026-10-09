/**
 * Live-journal env isolation for tests (#328).
 *
 * Worker children (`src/batch/worker-spawn.mjs` buildWorkerChildEnv) inherit
 * SPINE_JOURNAL_ATTACH / SPINE_BATCH_ID / SPINE_PROJECT_ROOT (and friends), so
 * any process spawned inside a worker can resolve and write to the live batch
 * journal. Tests that spawn subprocesses or set worker env must strip these
 * keys (and suppress attach) to stay isolated from the live journal.
 */

/** Env keys that identify and enable a live batch journal context. */
export const LIVE_JOURNAL_ENV_KEYS = Object.freeze([
	"SPINE_JOURNAL_ATTACH",
	"SPINE_BATCH_ID",
	"SPINE_PROJECT_ROOT",
	"SPINE_TASK_ID",
	"SPINE_LANE_NUMBER",
	"SPINE_LANE_CORRELATION_ID",
]);

/**
 * Copy of `env` without live-journal keys and with attach suppressed.
 * Spawn test subprocesses with this instead of raw `process.env` so inherited
 * worker env cannot journal into a live batch (#328).
 *
 * @param {Record<string, string | undefined>} [env]
 */
export function withoutLiveJournalEnv(env = process.env) {
	const clean = { ...env };
	for (const key of LIVE_JOURNAL_ENV_KEYS) {
		delete clean[key];
	}
	clean.SPINE_SUPPRESS_JOURNAL_ATTACH = "1";
	return clean;
}
