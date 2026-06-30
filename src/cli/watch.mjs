/**
 * Foreground poll loop over reconcileBatch (issue #44, SP-360).
 */

import { reconcileBatch } from "../batch/reconcile.mjs";

export const DEFAULT_WATCH_INTERVAL_SEC = 5;

const PROGRESS_FIELD_NAMES = [
	"succeededTasks",
	"pendingTasks",
	"totalTasks",
	"currentWaveIndex",
	"waveCount",
];

/**
 * @param {string[]} argv
 */
export function parseWatchArgs(argv) {
	/** @type {{ intervalSec: number, json: boolean, once: boolean }} */
	const args = {
		intervalSec: DEFAULT_WATCH_INTERVAL_SEC,
		json: false,
		once: false,
	};

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--interval") {
			const raw = argv[++i];
			const value = Number(raw);
			if (!Number.isFinite(value) || value <= 0) {
				throw new Error("--interval requires a positive number of seconds");
			}
			args.intervalSec = value;
		} else if (arg === "--json") {
			args.json = true;
		} else if (arg === "--once") {
			args.once = true;
		} else if (arg.startsWith("-")) {
			throw new Error(`Unknown watch option: ${arg}`);
		}
	}

	return args;
}

/**
 * @param {import("../batch/reconcile.mjs").ReconciliationResult & Record<string, unknown>} reconcileResult
 */
export function formatWatchHumanLine(reconcileResult) {
	const diagnosis = reconcileResult.diagnosis ?? "idle";
	const batchId = reconcileResult.batchId ?? "—";
	const macroPhase =
		reconcileResult.macroPhaseLabel ?? reconcileResult.macroPhase ?? "—";
	const headline = reconcileResult.headline ?? "";
	return `${diagnosis} | ${batchId} | ${macroPhase} | ${headline}`;
}

/**
 * Stable NDJSON snapshot for `spine watch --json`.
 *
 * @param {import("../batch/reconcile.mjs").ReconciliationResult & Record<string, unknown>} reconcileResult
 * @param {number} [observedAt]
 */
export function buildWatchSnapshot(reconcileResult, observedAt = Date.now()) {
	/** @type {Record<string, unknown>} */
	const snapshot = {
		observedAt,
		diagnosis: reconcileResult.diagnosis ?? null,
		batchId: reconcileResult.batchId ?? null,
		phase: reconcileResult.phase ?? null,
		macroPhase: reconcileResult.macroPhase ?? null,
		macroPhaseLabel: reconcileResult.macroPhaseLabel ?? null,
		headline: reconcileResult.headline,
		suggestedCommand: reconcileResult.suggestedCommand,
	};

	if (reconcileResult.progress != null && typeof reconcileResult.progress === "object") {
		snapshot.progress = reconcileResult.progress;
	} else {
		/** @type {Record<string, unknown>} */
		const progress = {};
		for (const field of PROGRESS_FIELD_NAMES) {
			if (reconcileResult[field] != null) {
				progress[field] = reconcileResult[field];
			}
		}
		if (Object.keys(progress).length > 0) {
			snapshot.progress = progress;
		}
	}

	return snapshot;
}

/**
 * @param {object} options
 * @param {string} options.projectRoot
 * @param {number} [options.intervalSec]
 * @param {boolean} [options.json]
 * @param {boolean} [options.once]
 * @param {(ctx: { projectRoot: string }) => import("../batch/reconcile.mjs").ReconciliationResult} [options.reconcileFn]
 * @param {(ms: number) => Promise<void>} [options.sleepFn]
 * @param {() => number} [options.nowFn]
 * @param {(text: string) => void} [options.writeStdout]
 * @param {boolean} [options.isTTY]
 */
export async function runSpineWatch(options) {
	const {
		projectRoot,
		intervalSec = DEFAULT_WATCH_INTERVAL_SEC,
		json = false,
		once = false,
		reconcileFn = reconcileBatch,
		sleepFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
		nowFn = () => Date.now(),
		writeStdout = (text) => process.stdout.write(text),
		isTTY = process.stdout.isTTY,
	} = options;

	let running = true;
	const onSigInt = () => {
		running = false;
	};
	process.on("SIGINT", onSigInt);

	try {
		do {
			const result = reconcileFn({ projectRoot });
			const snapshot = buildWatchSnapshot(result, nowFn());

			if (json) {
				writeStdout(`${JSON.stringify(snapshot)}\n`);
			} else {
				const line = formatWatchHumanLine(result);
				if (isTTY && !once) {
					writeStdout(`\r\x1b[K${line}`);
				} else {
					writeStdout(`${line}\n`);
				}
			}

			if (once || !running) {
				break;
			}

			await sleepFn(intervalSec * 1000);
		} while (running);

		if (!json && isTTY && !once) {
			writeStdout("\n");
		}

		return { exitCode: 0 };
	} finally {
		process.off("SIGINT", onSigInt);
	}
}
