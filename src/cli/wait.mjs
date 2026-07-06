/**
 * Block until reconcile diagnosis reaches a target set (issue #46, SP-362).
 */

import { reconcileBatch } from "../batch/reconcile.mjs";
import { parseUntilDiagnoses, reconciliationMatchesUntil } from "./spine-wait.mjs";
import {
	buildWatchSnapshot,
	DEFAULT_WATCH_INTERVAL_SEC,
} from "./watch.mjs";

export {
	diagnosisMatchesUntil,
	parseUntilDiagnoses,
	reconciliationMatchesUntil,
} from "./spine-wait.mjs";

/**
 * @param {string} raw
 * @returns {number}
 */
export function parseDurationMs(raw) {
	const trimmed = String(raw).trim();
	if (trimmed.length === 0) {
		throw new Error("--timeout requires a duration (e.g. 30s, 5m, 2h, or seconds)");
	}

	if (/^\d+$/.test(trimmed)) {
		const seconds = Number(trimmed);
		if (!Number.isFinite(seconds) || seconds <= 0) {
			throw new Error("--timeout requires a positive duration");
		}
		return seconds * 1000;
	}

	const match = trimmed.match(/^(\d+(?:\.\d+)?)([smh])$/i);
	if (!match) {
		throw new Error("--timeout requires a duration like 30s, 5m, 2h, or plain seconds");
	}

	const value = Number(match[1]);
	const unit = match[2].toLowerCase();
	if (!Number.isFinite(value) || value <= 0) {
		throw new Error("--timeout requires a positive duration");
	}

	const multipliers = { s: 1000, m: 60_000, h: 3_600_000 };
	return value * multipliers[unit];
}

/**
 * @param {string[]} argv
 */
export function parseWaitArgs(argv) {
	/** @type {{ until: Set<string> | null, timeoutMs: number | null, intervalSec: number, json: boolean }} */
	const args = {
		until: null,
		timeoutMs: null,
		intervalSec: DEFAULT_WATCH_INTERVAL_SEC,
		json: false,
	};

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--until") {
			args.until = parseUntilDiagnoses(argv[++i] ?? "");
		} else if (arg === "--timeout") {
			args.timeoutMs = parseDurationMs(argv[++i] ?? "");
		} else if (arg === "--interval") {
			const raw = argv[++i];
			const value = Number(raw);
			if (!Number.isFinite(value) || value <= 0) {
				throw new Error("--interval requires a positive number of seconds");
			}
			args.intervalSec = value;
		} else if (arg === "--json") {
			args.json = true;
		} else if (arg.startsWith("-")) {
			throw new Error(`Unknown wait option: ${arg}`);
		}
	}

	if (!args.until || args.until.size === 0) {
		throw new Error("--until is required (comma-separated diagnoses)");
	}

	return args;
}

/**
 * @param {object} options
 * @param {string} options.projectRoot
 * @param {Set<string>} options.untilDiagnoses
 * @param {number} [options.intervalSec]
 * @param {number | null} [options.timeoutMs]
 * @param {boolean} [options.json]
 * @param {(ctx: { projectRoot: string }) => import("../batch/reconcile.mjs").ReconciliationResult} [options.reconcileFn]
 * @param {(ms: number) => Promise<void>} [options.sleepFn]
 * @param {() => number} [options.nowFn]
 * @param {(text: string) => void} [options.writeStdout]
 */
export async function runSpineWait(options) {
	const {
		projectRoot,
		untilDiagnoses,
		intervalSec = DEFAULT_WATCH_INTERVAL_SEC,
		timeoutMs = null,
		json = false,
		reconcileFn = reconcileBatch,
		sleepFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
		nowFn = () => Date.now(),
		writeStdout = (text) => process.stdout.write(text),
	} = options;

	const startedAt = nowFn();
	const deadline = timeoutMs != null ? startedAt + timeoutMs : null;

	/** @type {boolean} */
	let running = true;
	const onSigInt = () => {
		running = false;
	};
	process.on("SIGINT", onSigInt);

	try {
		while (running) {
			const result = reconcileFn({ projectRoot });
			const diagnosis = result.diagnosis ?? null;

			if (reconciliationMatchesUntil(result, untilDiagnoses)) {
				if (json) {
					writeStdout(`${JSON.stringify(buildWatchSnapshot(result, nowFn()))}\n`);
				}
				return { exitCode: 0, matched: true, diagnosis, timedOut: false };
			}

			if (deadline != null && nowFn() >= deadline) {
				if (json) {
					writeStdout(`${JSON.stringify(buildWatchSnapshot(result, nowFn()))}\n`);
				}
				return { exitCode: 1, matched: false, diagnosis, timedOut: true };
			}

			await sleepFn(intervalSec * 1000);
		}

		return { exitCode: 130, matched: false, diagnosis: null, timedOut: false, interrupted: true };
	} finally {
		process.off("SIGINT", onSigInt);
	}
}
