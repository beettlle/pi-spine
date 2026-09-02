// @ts-nocheck
/**
 * Salvage --integrate gate open path (#274).
 * Extracted from salvage-batch-integrate.mjs to keep that module under the 500 LOC cap.
 */

import fs from "node:fs";
import path from "node:path";
import { writeJsonAtomic } from "../fs/atomic-write.mjs";
import {
	evidenceDir,
	loadGateRecord,
	maybeAutoApproveIntegrateGate,
	openIntegrateGate,
} from "./gate.mjs";
import { gitExec } from "./git-exec.mjs";
import { archiveBatchStatePath } from "./lifecycle.mjs";
import { appendJournalEvent } from "./journal.mjs";
import { loadBatchStateFile } from "./reconcile.mjs";

/**
 * Load archived seed state (or matching live state) for a finished batch.
 * Mirrors the seed resolution used by salvage-batch-list.mjs.
 *
 * @param {string} projectRoot
 * @param {string} batchId
 * @returns {object|null}
 */
function loadSalvageBatchSeed(projectRoot, batchId) {
	const archivePath = archiveBatchStatePath(projectRoot, batchId);
	if (fs.existsSync(archivePath)) {
		try {
			return JSON.parse(fs.readFileSync(archivePath, "utf-8"));
		} catch {
			return null;
		}
	}

	const loaded = loadBatchStateFile(projectRoot);
	if (loaded.raw && String(loaded.raw.batchId ?? loaded.raw.id ?? "") === batchId) {
		return loaded.raw;
	}

	return null;
}

/**
 * True only when the gate check failed solely on a missing gate record (#274).
 * Pending / rejected / stale-revision gates keep their existing blocked paths.
 *
 * @param {{ ok?: boolean, gate?: object|null, blockers?: Array<{ code?: string }> }} gateCheck
 */
export function gateBlockedOnMissingGate(gateCheck) {
	return (
		gateCheck.gate == null &&
		Array.isArray(gateCheck.blockers) &&
		gateCheck.blockers.some((blocker) => blocker?.code === "missing_gate")
	);
}

/**
 * Best-effort rev-parse of a branch tip SHA for salvage evidence.
 *
 * @param {string} projectRoot
 * @param {string} ref
 * @returns {string|null}
 */
function resolveTipSha(projectRoot, ref) {
	try {
		return gitExec(projectRoot, ["rev-parse", "--verify", `${ref}^{commit}`], { projectRoot }) || null;
	} catch {
		return null;
	}
}

/**
 * Write salvage inspection evidence into the gate evidence dir.
 * `collectCoreEvidenceBundle` picks up `salvage-*.json` files as gate evidence refs.
 *
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {object} snapshot
 * @returns {string} evidence ref
 */
function writeSalvageGateEvidence(projectRoot, batchId, snapshot) {
	const dir = evidenceDir(projectRoot, batchId);
	fs.mkdirSync(dir, { recursive: true });
	writeJsonAtomic(path.join(dir, "salvage-inspect.json"), {
		...snapshot,
		inspectedAt: new Date().toISOString(),
		source: "batch salvage --integrate",
	});
	return "evidence/salvage-inspect.json";
}

/**
 * Open a fresh integrate gate from salvage inspection evidence (#274).
 *
 * A batch that failed before the merge phase never journaled `gate.opened`, so
 * salvage --integrate used to dead-end on "no gate record". When the lane is
 * verified salvageable (terminal-success tasks, commits ahead — established by
 * `listSalvageableLanes` before this runs), open the gate here with salvage
 * evidence plus the current orch tip pin. Approval posture still applies: the
 * fresh gate stays pending unless config explicitly opts in to auto-approve.
 *
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {object} ctx
 * @param {object} ctx.lane
 * @param {string} ctx.baseBranch
 * @param {string} ctx.taskBranch
 * @param {number} ctx.commitsAhead
 * @param {object|null} ctx.config
 * @returns {{ ok: true, opened: boolean, gate: object, evidenceRefs: string[] } | { ok: false, error: string }}
 */
export function openGateFromSalvageEvidence(projectRoot, batchId, ctx) {
	const { lane, baseBranch, taskBranch, commitsAhead, config } = ctx;

	// Fail closed when salvage evidence is insufficient to justify a gate.
	if (!lane || !Array.isArray(lane.salvageableTasks) || lane.salvageableTasks.length === 0) {
		return { ok: false, error: "salvage_evidence_insufficient" };
	}
	if (!Number.isFinite(commitsAhead) || commitsAhead <= 0) {
		return { ok: false, error: "salvage_commits_ahead_required" };
	}

	/** @type {string[]} */
	const salvageEvidenceRefs = [];
	try {
		salvageEvidenceRefs.push(
			writeSalvageGateEvidence(projectRoot, batchId, {
				batchId,
				laneNumber: lane.laneNumber,
				taskBranch,
				baseBranch,
				commitsAhead,
				salvageableTasks: lane.salvageableTasks,
				excludedTasks: lane.excludedTasks ?? [],
				diffStat: lane.diffStat ?? null,
				baseTip: resolveTipSha(projectRoot, baseBranch),
				laneTip: resolveTipSha(projectRoot, taskBranch),
			}),
		);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return { ok: false, error: `salvage_evidence_write_failed: ${message}` };
	}

	const batchState = loadSalvageBatchSeed(projectRoot, batchId);
	try {
		const opened = openIntegrateGate({ projectRoot, batchId, batchState, config });
		const gate = loadGateRecord(projectRoot, batchId);
		if (!gate || !Array.isArray(gate.evidenceRefs) || gate.evidenceRefs.length === 0) {
			return { ok: false, error: "gate_open_verification_failed" };
		}

		// Respect approval posture — auto-approves only when config opts in.
		maybeAutoApproveIntegrateGate({ projectRoot, batchId, config });

		appendJournalEvent(projectRoot, batchId, "batch.salvage_gate_opened", {
			laneNumber: lane.laneNumber,
			taskBranch,
			baseBranch,
			commitsAhead,
			gateId: gate.gateId,
			gateAlreadyOpen: opened.opened !== true,
			salvageEvidenceRefs,
		});

		return {
			ok: true,
			opened: opened.opened === true,
			gate: loadGateRecord(projectRoot, batchId) ?? gate,
			evidenceRefs: gate.evidenceRefs,
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return { ok: false, error: `gate_open_failed: ${message}` };
	}
}
