// @ts-nocheck
/**
 * Reconstruct batch-state from batch-meta + runtime artifacts (SP-620 / FR-REL240-04 / #126).
 */

import fs from "node:fs";
import path from "node:path";
import { BATCH_META_FILENAME, batchMetaPath } from "./batch-meta.mjs";
import { appendJournalEvent, readJournalEvents } from "./journal.mjs";
import { rebuildBatchStateFromJournal } from "./journal-rebuild.mjs";
import { computePendingTasks, findResumableWave } from "./resume-validation.mjs";
import { createInitialBatchState, clearBatchEnginePid, saveSpineBatchState } from "./state.mjs";
import { loadSpineBatchState } from "./state-io.mjs";
import { laneTaskBranch, laneWorktreePath } from "./worktree.mjs";

/**
 * @param {string} projectRoot
 */
function runtimeRoot(projectRoot) {
	return path.join(projectRoot, ".spine", "runtime");
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 */
function archiveBatchStatePath(projectRoot, batchId) {
	return path.join(runtimeRoot(projectRoot), String(batchId), "archive", "batch-state.json");
}

/**
 * @param {unknown} value
 * @returns {string[][]}
 */
function normalizeWavePlan(value) {
	if (!Array.isArray(value)) return [];
	return value.map((wave) => (Array.isArray(wave) ? wave.map((id) => String(id)) : []));
}

/**
 * Fail-closed when journal-derived waves disagree with persisted meta topology.
 *
 * @param {string[][]} metaPlan
 * @param {string[][]} journalPlan
 */
export function wavePlansConflict(metaPlan, journalPlan) {
	const meta = normalizeWavePlan(metaPlan).filter((wave) => wave.length > 0);
	const journal = normalizeWavePlan(journalPlan).filter((wave) => wave.length > 0);
	if (meta.length === 0 || journal.length === 0) return false;
	if (meta.length !== journal.length) return true;
	for (let i = 0; i < meta.length; i++) {
		const a = [...meta[i]].sort();
		const b = [...journal[i]].sort();
		if (a.length !== b.length) return true;
		for (let j = 0; j < a.length; j++) {
			if (a[j] !== b[j]) return true;
		}
	}
	return false;
}

/**
 * @param {string} projectRoot
 * @returns {{ batchId: string, path: string }[]}
 */
export function listBatchMetaArtifacts(projectRoot) {
	const root = runtimeRoot(projectRoot);
	if (!fs.existsSync(root)) return [];
	/** @type {{ batchId: string, path: string }[]} */
	const found = [];
	for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		const filePath = path.join(root, entry.name, BATCH_META_FILENAME);
		if (fs.existsSync(filePath)) {
			found.push({ batchId: entry.name, path: filePath });
		}
	}
	return found.sort((a, b) => a.batchId.localeCompare(b.batchId));
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 * @returns {{ ok: true, meta: object, path: string } | { ok: false, error: string, output: string }}
 */
export function loadBatchMetaRuntimeArtifact(projectRoot, batchId) {
	const resolvedBatchId = String(batchId ?? "").trim();
	if (!resolvedBatchId) {
		return {
			ok: false,
			error: "batch_meta_missing",
			output:
				"Cannot reconstruct batch state: batchId is required to load batch-meta.json.\n" +
				"  → Inspect .spine/runtime/*/batch-meta.json then spine batch resume --force\n",
		};
	}

	const filePath = batchMetaPath(projectRoot, resolvedBatchId);
	if (!fs.existsSync(filePath)) {
		return {
			ok: false,
			error: "batch_meta_missing",
			output:
				`Cannot reconstruct batch state: missing ${path.relative(projectRoot, filePath)}.\n` +
				"  → Force-resume requires surviving batch-meta from batch start (SP-619).\n",
		};
	}

	try {
		const meta = JSON.parse(fs.readFileSync(filePath, "utf-8"));
		if (!meta || typeof meta !== "object") {
			return {
				ok: false,
				error: "batch_meta_corrupt",
				output: `Cannot reconstruct batch state: corrupt batch-meta at ${filePath}\n`,
			};
		}
		const wavePlan = normalizeWavePlan(meta.wavePlan);
		if (wavePlan.length < 1 || wavePlan.every((wave) => wave.length < 1)) {
			return {
				ok: false,
				error: "batch_meta_ambiguous",
				output:
					`Cannot reconstruct batch state: batch-meta for ${resolvedBatchId} has empty wavePlan.\n` +
					"  → Prefer a clear error over guessing the wave topology.\n",
			};
		}
		return {
			ok: true,
			meta: { ...meta, batchId: String(meta.batchId ?? resolvedBatchId), wavePlan },
			path: filePath,
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return {
			ok: false,
			error: "batch_meta_corrupt",
			output: `Cannot reconstruct batch state: failed to parse batch-meta (${message})\n`,
		};
	}
}

/**
 * @param {string} projectRoot
 * @param {object} meta
 */
function seedStateFromBatchMeta(projectRoot, meta) {
	const batchId = String(meta.batchId);
	const wavePlan = normalizeWavePlan(meta.wavePlan);
	const taskIds = [...new Set(wavePlan.flat())];
	const tasks = taskIds.map((taskId) => ({
		taskId,
		laneNumber: 1,
		status: "pending",
		taskFolder: null,
		startedAt: null,
		endedAt: null,
		doneFileFound: false,
		exitReason: null,
	}));
	const lanes = [
		{
			laneNumber: 1,
			laneId: "lane-1",
			worktreePath: laneWorktreePath(projectRoot, batchId, 1),
			branch: laneTaskBranch(batchId, 1),
			taskIds: [...taskIds],
			lastHeartbeatAt: null,
		},
	];
	const state = createInitialBatchState({
		batchId,
		baseBranch: String(meta.baseBranch ?? "main") || "main",
		orchBranch: String(meta.orchBranch ?? "") || `orch/spine-${batchId}`,
		wavePlan,
		tasks,
		lanes,
	});
	state.phase = "failed";
	state.totalWaves = Number(meta.totalWaves ?? wavePlan.length) || wavePlan.length;
	return state;
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 */
function loadArchiveSeed(projectRoot, batchId) {
	const archivePath = archiveBatchStatePath(projectRoot, batchId);
	if (!fs.existsSync(archivePath)) return null;
	try {
		const raw = JSON.parse(fs.readFileSync(archivePath, "utf-8"));
		return raw && typeof raw === "object" ? raw : null;
	} catch {
		return null;
	}
}

/**
 * Rebuild usable batch-state from batch-meta + journal/archive artifacts (FR-REL240-04).
 *
 * @param {string} projectRoot
 * @param {{ batchId?: string }} [options]
 */
export function reconstructBatchStateFromRuntime(projectRoot, options = {}) {
	const requestedBatchId = String(options.batchId ?? "").trim();
	let batchId = requestedBatchId;

	if (!batchId) {
		const candidates = listBatchMetaArtifacts(projectRoot);
		if (candidates.length < 1) {
			return {
				ok: false,
				exitCode: 1,
				error: "batch_meta_missing",
				output:
					"Cannot reconstruct batch state: no .spine/runtime/*/batch-meta.json found.\n" +
					"  → Live batch-state is missing/corrupt and survival meta is absent.\n",
			};
		}
		if (candidates.length > 1) {
			const ids = candidates.map((entry) => entry.batchId).join(", ");
			return {
				ok: false,
				exitCode: 1,
				error: "batch_meta_ambiguous",
				output:
					`Cannot reconstruct batch state: multiple batch-meta artifacts (${ids}).\n` +
					"  → Refuse to guess which wave/batch to resume; remove stale runtime dirs or specify the batch.\n",
			};
		}
		batchId = candidates[0].batchId;
	}

	const loadedMeta = loadBatchMetaRuntimeArtifact(projectRoot, batchId);
	if (!loadedMeta.ok) {
		return { ...loadedMeta, exitCode: 1 };
	}

	const meta = loadedMeta.meta;
	const archiveSeed = loadArchiveSeed(projectRoot, batchId);
	const metaSeed = seedStateFromBatchMeta(projectRoot, meta);
	const seed =
		archiveSeed && normalizeWavePlan(archiveSeed.wavePlan).length > 0
			? {
					...metaSeed,
					...archiveSeed,
					batchId,
					baseBranch: String(archiveSeed.baseBranch ?? metaSeed.baseBranch),
					orchBranch: String(archiveSeed.orchBranch ?? metaSeed.orchBranch),
					wavePlan:
						normalizeWavePlan(archiveSeed.wavePlan).length > 0
							? normalizeWavePlan(archiveSeed.wavePlan)
							: metaSeed.wavePlan,
				}
			: metaSeed;

	if (wavePlansConflict(meta.wavePlan, seed.wavePlan)) {
		return {
			ok: false,
			exitCode: 1,
			error: "batch_meta_wave_conflict",
			output:
				`Cannot reconstruct batch state: archive wavePlan conflicts with batch-meta for ${batchId}.\n` +
				"  → Prefer a clear error over silently resuming the wrong wave.\n",
		};
	}

	const events = readJournalEvents(projectRoot, batchId);
	const rebuilt = rebuildBatchStateFromJournal(seed, events);

	if (wavePlansConflict(meta.wavePlan, rebuilt.wavePlan)) {
		return {
			ok: false,
			exitCode: 1,
			error: "batch_meta_wave_conflict",
			output:
				`Cannot reconstruct batch state: journal topology conflicts with batch-meta for ${batchId}.\n` +
				"  → Prefer a clear error over silently resuming the wrong wave.\n",
		};
	}

	// Meta is the survival source of truth for wave topology.
	rebuilt.wavePlan = normalizeWavePlan(meta.wavePlan);
	rebuilt.totalWaves = Number(meta.totalWaves ?? rebuilt.wavePlan.length) || rebuilt.wavePlan.length;
	rebuilt.batchId = batchId;
	rebuilt.baseBranch = String(meta.baseBranch || rebuilt.baseBranch || "main");
	rebuilt.orchBranch = String(meta.orchBranch || rebuilt.orchBranch || `orch/spine-${batchId}`);

	const phase = String(rebuilt.phase ?? "");
	if (phase === "completed") {
		return {
			ok: false,
			exitCode: 1,
			error: "batch_already_completed",
			output:
				`Cannot reconstruct batch ${batchId} for resume: journal indicates completed.\n` +
				"  → Use spine batch dismiss / integrate / salvage as appropriate.\n",
		};
	}
	// Force-resume reconstruct must land in a force-resumable phase. Journal rebuild
	// often yields "running" without a live engine; remap so --force can continue.
	if (phase === "aborted" || phase === "planning" || phase === "running") {
		rebuilt.phase = "failed";
		rebuilt.endedAt = null;
	}

	clearBatchEnginePid(rebuilt);
	const priorResilience =
		rebuilt.resilience && typeof rebuilt.resilience === "object" ? rebuilt.resilience : {};
	rebuilt.resilience = {
		resumeForced: true,
		retryCountByScope: priorResilience.retryCountByScope ?? {},
		lastFailureClass: priorResilience.lastFailureClass ?? null,
		repairHistory: Array.isArray(priorResilience.repairHistory)
			? priorResilience.repairHistory
			: [],
		...(priorResilience.forceMergedWaves
			? { forceMergedWaves: priorResilience.forceMergedWaves }
			: {}),
	};
	rebuilt.currentWaveIndex = findResumableWave(rebuilt, computePendingTasks(rebuilt));
	rebuilt.updatedAt = Date.now();

	return {
		ok: true,
		exitCode: 0,
		batchId,
		state: rebuilt,
		meta,
		metaPath: loadedMeta.path,
		reconstructedFrom: events.length > 0 ? "batch-meta+journal" : "batch-meta",
	};
}

/**
 * When force-resume sees missing/corrupt live state, reconstruct and persist it.
 *
 * @param {string} projectRoot
 * @param {{ force?: boolean, batchId?: string }} [options]
 */
export function ensureForceResumeBatchState(projectRoot, options = {}) {
	const force = Boolean(options.force);
	const loaded = loadSpineBatchState(projectRoot);
	if (loaded.raw) {
		return { ok: true, attempted: false, state: loaded.raw, path: loaded.path };
	}

	if (!force) {
		return {
			ok: false,
			attempted: false,
			exitCode: 1,
			error: "no_active_batch",
			output: "No active pi-spine batch.\n",
		};
	}

	const reason = loaded.parseError ? "corrupt" : "missing";
	const reconstructed = reconstructBatchStateFromRuntime(projectRoot, {
		batchId: options.batchId,
	});
	if (!reconstructed.ok) {
		return {
			...reconstructed,
			attempted: true,
			reason,
		};
	}

	if (!reconstructed.state) {
		return {
			ok: false,
			attempted: true,
			exitCode: 1,
			error: "batch_meta_reconstruct_failed",
			reason,
			output: "Failed to reconstruct batch state from batch-meta.\n",
		};
	}

	const saved = saveSpineBatchState(projectRoot, reconstructed.state, { bypassWriteGuard: true });
	appendJournalEvent(projectRoot, reconstructed.batchId, "batch.state_reconstructed", {
		reason,
		source: reconstructed.reconstructedFrom ?? "batch-meta",
		resumeForced: true,
	});
	return {
		ok: true,
		attempted: true,
		reason,
		batchId: reconstructed.batchId,
		state: saved,
		path: loadSpineBatchState(projectRoot).path,
		reconstructedFrom: reconstructed.reconstructedFrom,
		output:
			`Reconstructed batch-state for ${reconstructed.batchId} from ${reconstructed.reconstructedFrom} ` +
			`(live state was ${reason}).\n`,
	};
}
