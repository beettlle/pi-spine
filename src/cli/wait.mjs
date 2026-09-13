/**
 * Block until reconcile diagnosis reaches a target set (issue #46, SP-362).
 *
 * Batch-scoped since #215: the wait records the batch id at start and exits with a
 * distinct `archived`/`superseded` status if another operator session integrates or
 * supersedes that batch while we are waiting — it never re-diagnoses the newly active
 * batch or re-drives land/recovery prompts for it.
 */

import fs from "node:fs";
import path from "node:path";

import { reconcileBatch } from "../batch/reconcile.mjs";
import {
	deriveWaitPseudoDiagnoses,
	diagnosisMatchesUntil,
	parseUntilDiagnoses,
	reconciliationMatchesUntil,
} from "./spine-wait.mjs";
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
 * Human duration for wait headlines (e.g. `12.0s`, `1m5s`). Returns null when the
 * elapsed value is not representable so callers can omit the suffix instead of
 * printing a garbage number (nowFn pairs are expected sane, this is defensive).
 *
 * @param {number} ms
 * @returns {string | null}
 */
function formatWaitElapsed(ms) {
	if (!Number.isFinite(ms) || ms < 0) {
		return null;
	}
	const seconds = ms / 1000;
	if (seconds < 60) {
		return `${seconds.toFixed(1)}s`;
	}
	const minutes = Math.floor(seconds / 60);
	const remainder = Math.round(seconds % 60);
	return `${minutes}m${remainder}s`;
}

/**
 * Label for what actually matched the `--until` set: the literal taxonomy diagnosis
 * when it matched, the `failed` token when the phase-based alias fired (#252), or the
 * pseudo diagnosis (e.g. gate_open) that fired. Keeps headlines honest for pseudo
 * matches where the raw diagnosis (e.g. "running") is not what woke the wait.
 *
 * @param {import("../batch/reconcile.mjs").ReconciliationResult} result
 * @param {Set<string>} untilDiagnoses
 * @returns {string}
 */
function describeMatchedDiagnosis(result, untilDiagnoses) {
	const diagnosis = result.diagnosis ?? null;
	if (diagnosisMatchesUntil(diagnosis, untilDiagnoses)) {
		return diagnosis;
	}
	if (untilDiagnoses.has("failed") && result.phase === "failed") {
		return "failed";
	}
	for (const pseudo of deriveWaitPseudoDiagnoses(result)) {
		if (untilDiagnoses.has(pseudo)) {
			return pseudo;
		}
	}
	return diagnosis ?? "matched";
}

/**
 * @param {Set<string>} untilDiagnoses
 * @returns {string}
 */
function formatUntilList(untilDiagnoses) {
	return [...untilDiagnoses].sort().join(",");
}

/**
 * @param {string | null} scopedBatchId
 * @returns {string}
 */
function formatBatchSuffix(scopedBatchId) {
	return scopedBatchId != null ? ` (batch ${scopedBatchId})` : "";
}

/**
 * Start banner for human waits (#286, SP-754). Printed once, right before the first poll
 * sleep, so the batch id captured on that poll is included when known. Instant matches
 * never see a banner — their single-line output stays exactly one line.
 *
 * @param {object} options
 * @param {Set<string>} options.untilDiagnoses
 * @param {string | null} options.batchId
 * @param {number} options.intervalSec
 * @param {number | null} options.timeoutMs
 * @returns {string}
 */
function formatWaitBanner({ untilDiagnoses, batchId, intervalSec, timeoutMs }) {
	const timeoutPart =
		timeoutMs != null
			? `timeout ${formatWaitElapsed(timeoutMs) ?? `${timeoutMs}ms`}`
			: "no timeout";
	return `Waiting for ${formatUntilList(untilDiagnoses)}${formatBatchSuffix(batchId)} — polling every ${intervalSec}s, ${timeoutPart}`;
}

/**
 * Interval-aligned liveness line (#286, SP-754). The poll loop sleeps exactly one
 * `--interval` per iteration, so one progress line per non-matching poll is aligned by
 * construction and can never spam micro-sleeps. Carries diagnosis/phase (plus wave and
 * pending-task counts when reconcile surfaces them) and elapsed so agent hosts can prove
 * the wait is alive between the start banner and the terminal headline.
 *
 * @param {import("../batch/reconcile.mjs").ReconciliationResult} result
 * @param {string | null} scopedBatchId
 * @param {number} elapsedMs
 * @returns {string}
 */
function formatWaitProgress(result, scopedBatchId, elapsedMs) {
	/** @type {string[]} */
	const parts = [result.diagnosis ?? "no diagnosis"];
	if (result.phase != null) {
		parts.push(`phase=${result.phase}`);
	}
	if (result.currentWaveIndex != null && result.waveCount != null) {
		parts.push(`wave ${result.currentWaveIndex + 1}/${result.waveCount}`);
	}
	if (result.pendingTasks != null) {
		parts.push(`pending tasks ${result.pendingTasks}`);
	}
	const elapsed = formatWaitElapsed(elapsedMs);
	if (elapsed != null) {
		parts.push(`elapsed ${elapsed}`);
	}
	return `Wait progress: ${parts.join(", ")}${formatBatchSuffix(scopedBatchId)}`;
}

/** Exit code when the waited-on batch was archived or superseded by another session (#215). */
export const WAIT_SUPERSEDED_EXIT_CODE = 2;

/**
 * Read the archived batch-state for a scoped batch id (#215). Archived batches are copied
 * to `.spine/runtime/{batchId}/archive/batch-state.json` on integrate/complete (see
 * `src/batch/lifecycle-archive.mjs`). Lets wait report the real terminal phase instead of
 * the newly active batch. Leaf read — never throws.
 *
 * @param {string} projectRoot
 * @param {string} scopedBatchId
 * @returns {{ archivedPhase: string | null, archivedAt: string | null }}
 */
function readArchivedBatchRecord(projectRoot, scopedBatchId) {
	try {
		const archivePath = path.join(
			projectRoot,
			".spine",
			"runtime",
			scopedBatchId,
			"archive",
			"batch-state.json",
		);
		if (!fs.existsSync(archivePath)) {
			return { archivedPhase: null, archivedAt: null };
		}
		const raw = JSON.parse(fs.readFileSync(archivePath, "utf-8"));
		const archivedPhase =
			raw && typeof raw === "object" && raw.phase != null ? String(raw.phase) : null;
		const archivedAt =
			raw && typeof raw === "object" && raw.endedAt != null ? String(raw.endedAt) : null;
		return { archivedPhase, archivedAt };
	} catch {
		return { archivedPhase: null, archivedAt: null };
	}
}

/**
 * Human headline for the batch-scoped supersede/archived exit (#215). Ambiguous-free: it
 * names the scoped batch and never references the new active batch's recovery state.
 */
function formatSupersededHeadline({ scopedBatchId, activeBatchId, batchScope, archive }) {
	if (batchScope === "archived") {
		const phaseSuffix = archive.archivedPhase ? ` (archived as ${archive.archivedPhase})` : "";
		return `Batch ${scopedBatchId} was archived${phaseSuffix} by another session — no longer the active batch`;
	}
	return `Batch ${scopedBatchId} was superseded by batch ${activeBatchId} — no longer the active batch`;
}

/**
 * Build the batch-scoped snapshot emitted when the waited-on batch was archived or
 * superseded (#215). Scoped to the original batch id; never reflects the new active batch.
 */
function buildSupersededSnapshot({ scopedBatchId, activeBatchId, batchScope, archive, observedAt }) {
	const snapshot = buildWatchSnapshot(
		{
			diagnosis: null,
			batchId: scopedBatchId,
			phase: archive.archivedPhase,
			macroPhase: "archived",
			macroPhaseLabel: archive.archivedPhase ? `Archived (${archive.archivedPhase})` : "Archived",
			headline: formatSupersededHeadline({ scopedBatchId, activeBatchId, batchScope, archive }),
			suggestedCommand: "spine status --diagnose",
		},
		observedAt,
	);
	snapshot.activeBatchId = activeBatchId;
	snapshot.batchScope = batchScope;
	snapshot.archivedPhase = archive.archivedPhase;
	return snapshot;
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
		writeStderr = (text) => process.stderr.write(text),
	} = options;

	const startedAt = nowFn();
	const deadline = timeoutMs != null ? startedAt + timeoutMs : null;

	/** @type {boolean} */
	let running = true;
	const onSigInt = () => {
		running = false;
	};
	process.on("SIGINT", onSigInt);

	/**
	 * Batch id this wait is scoped to (#215). Captured from the first reconcile that
	 * observes an active batch so the wait never reports on a batch another operator
	 * session integrated/superseded while we were waiting.
	 */
	let scopedBatchId = null;
	let scopedBatchIdCaptured = false;

	/**
	 * Human start banner (#286, SP-754): flipped after the first poll that continues past
	 * the match/supersede/timeout checks, so the banner is printed exactly once and only
	 * when the wait actually waits. `--json` never prints it.
	 *
	 * @type {boolean}
	 */
	let bannerPrinted = false;

	try {
		while (running) {
			const result = reconcileFn({ projectRoot });
			if (!scopedBatchIdCaptured) {
				const candidate = result.batchId ?? null;
				if (candidate != null) {
					scopedBatchId = candidate;
					scopedBatchIdCaptured = true;
				}
			}
			const diagnosis = result.diagnosis ?? null;

			// Batch-scoped guard (#215): the active batch drifted away from the one we
			// started waiting on, so another session integrated/superseded it. Exit promptly
			// with a distinct status instead of re-diagnosing the new batch and re-driving
			// land/recovery prompts for it. This check runs before the match check on
			// purpose — any match against the new batch would be a false positive.
			if (scopedBatchId != null && (result.batchId ?? null) !== scopedBatchId) {
				const activeBatchId = result.batchId ?? null;
				const batchScope = activeBatchId == null ? "archived" : "superseded";
				const archive = readArchivedBatchRecord(projectRoot, scopedBatchId);
				const observedAt = nowFn();
				if (json) {
					writeStdout(
						`${JSON.stringify(
							buildSupersededSnapshot({
								scopedBatchId,
								activeBatchId,
								batchScope,
								archive,
								observedAt,
							}),
						)}\n`,
					);
				} else {
					writeStderr(
						`${formatSupersededHeadline({ scopedBatchId, activeBatchId, batchScope, archive })}\n`,
					);
				}
				return {
					exitCode: WAIT_SUPERSEDED_EXIT_CODE,
					matched: false,
					diagnosis: null,
					timedOut: false,
					superseded: true,
					batchScope,
					batchId: scopedBatchId,
					activeBatchId,
					archivedPhase: archive.archivedPhase,
				};
			}

			if (reconciliationMatchesUntil(result, untilDiagnoses)) {
				if (json) {
					writeStdout(`${JSON.stringify(buildWatchSnapshot(result, nowFn()))}\n`);
				} else {
					// Terminal headline (#286): long waits must not look hung on success. One
					// stdout line naming what matched, the scoped batch, and elapsed time.
					const elapsed = formatWaitElapsed(nowFn() - startedAt);
					writeStdout(
						`Wait matched: ${describeMatchedDiagnosis(result, untilDiagnoses)}${formatBatchSuffix(scopedBatchId)}${elapsed != null ? ` after ${elapsed}` : ""}\n`,
					);
				}
				return {
					exitCode: 0,
					matched: true,
					diagnosis,
					timedOut: false,
					batchId: scopedBatchId,
				};
			}

			if (deadline != null && nowFn() >= deadline) {
				if (json) {
					writeStdout(`${JSON.stringify(buildWatchSnapshot(result, nowFn()))}\n`);
				} else {
					// Terminal headline (#286): stderr keeps the non-success terminal state off
					// stdout and is clearly distinct from the match line.
					const elapsed = formatWaitElapsed(nowFn() - startedAt);
					writeStderr(
						`Wait timed out${elapsed != null ? ` after ${elapsed}` : ""} waiting for ${formatUntilList(untilDiagnoses)}${formatBatchSuffix(scopedBatchId)} — last diagnosis: ${diagnosis ?? "none"}\n`,
					);
				}
				return {
					exitCode: 1,
					matched: false,
					diagnosis,
					timedOut: true,
					batchId: scopedBatchId,
				};
			}

			if (!json) {
				if (!bannerPrinted) {
					// Start banner (#286, SP-754): once, only when the wait actually continues —
					// instant matches keep their single-line output. batchId was captured above.
					bannerPrinted = true;
					writeStdout(
						`${formatWaitBanner({ untilDiagnoses, batchId: scopedBatchId, intervalSec, timeoutMs })}\n`,
					);
				} else {
					// Interval-aligned progress (#286, SP-754): one line per non-matching poll.
					writeStdout(`${formatWaitProgress(result, scopedBatchId, nowFn() - startedAt)}\n`);
				}
			}

			await sleepFn(intervalSec * 1000);
		}

		if (!json) {
			// Terminal headline (#286): SIGINT must not exit silently either.
			writeStderr(
				`Wait interrupted — exited without matching ${formatUntilList(untilDiagnoses)}${formatBatchSuffix(scopedBatchId)}\n`,
			);
		}
		return { exitCode: 130, matched: false, diagnosis: null, timedOut: false, interrupted: true };
	} finally {
		process.off("SIGINT", onSigInt);
	}
}
