/**
 * Integrate gate FSM and persistence (PRD §12, FR-GATE, FR-INT-02).
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { loadSpineConfig } from "../config/spine-config-load.mjs";
import { writeJsonAtomic, writeTextAtomic } from "../fs/atomic-write.mjs";
import { runEvidenceCommand } from "./evidence-command.mjs";
import {
	evidenceCompletePath,
	evidenceDir,
	formatGateSummary,
	gateRecordPath,
	loadGateRecord,
	resolveTestingCommands,
} from "./gate-evidence-read.mjs";
import { appendJournalEvent, readJournalEvents, readJournalTail } from "./journal.mjs";
import { generateBatchPostMortem } from "./postmortem.mjs";
import { reconcileBatch } from "./reconcile.mjs";

export { evidenceCompletePath, evidenceDir, formatGateSummary, gateRecordPath, loadGateRecord };

/**
 * @param {string} projectRoot
 * @param {object} gate
 */
export function saveGateRecord(projectRoot, gate) {
	const filePath = gateRecordPath(projectRoot, gate.batchId);
	writeJsonAtomic(filePath, gate);
}

/**
 * @param {string} projectRoot
 * @param {string} baseBranch
 * @param {string} orchBranch
 */
function collectDiffStat(projectRoot, baseBranch, orchBranch) {
	try {
		return execFileSync("git", ["diff", "--stat", `${baseBranch}..${orchBranch}`], {
			cwd: projectRoot,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
		}).trim();
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return `(git diff --stat failed: ${message})`;
	}
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 */
function collectWorkerOutputEvidenceRefs(projectRoot, batchId) {
	const lanesDir = path.join(projectRoot, ".spine", "runtime", batchId, "lanes");
	if (!fs.existsSync(lanesDir)) return [];

	/** @type {string[]} */
	const refs = [];
	for (const laneDir of fs.readdirSync(lanesDir)) {
		if (!laneDir.startsWith("lane-")) continue;
		const lanePath = path.join(lanesDir, laneDir);
		for (const name of fs.readdirSync(lanePath)) {
			if (!name.startsWith("worker-output-") || !name.endsWith(".log")) continue;
			refs.push(path.join(".spine", "runtime", batchId, "lanes", laneDir, name));
		}
	}
	return refs.sort();
}

/**
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {string} ctx.batchId
 * @param {object|null} [ctx.batchState]
 * @param {ReturnType<typeof loadSpineConfig>["config"]} [ctx.config]
 * @param {object} ctx.reconciliation
 */
export function collectCoreEvidenceBundle(ctx) {
	const { projectRoot, batchId, batchState = null, config = null, reconciliation } = ctx;
	const dir = evidenceDir(projectRoot, batchId);
	fs.mkdirSync(dir, { recursive: true });

	/** @type {string[]} */
	const evidenceRefs = [];

	const journalTail = readJournalTail(readJournalEvents(projectRoot, batchId));
	const summary = generateBatchPostMortem(batchState, journalTail, reconciliation, projectRoot);
	writeTextAtomic(path.join(dir, "summary.md"), summary);
	evidenceRefs.push("evidence/summary.md");

	const baseBranch = batchState?.baseBranch ?? config?.baseBranch ?? "main";
	const orchBranch = batchState?.orchBranch ?? null;
	if (orchBranch) {
		const diffStat = collectDiffStat(projectRoot, baseBranch, orchBranch);
		writeTextAtomic(path.join(dir, "diff-stat.txt"), `${diffStat}\n`);
		evidenceRefs.push("evidence/diff-stat.txt");
	}

	for (const ref of collectWorkerOutputEvidenceRefs(projectRoot, batchId)) {
		evidenceRefs.push(ref);
	}

	for (const name of fs.readdirSync(dir)) {
		if (name.startsWith("salvage-") && name.endsWith(".json")) {
			evidenceRefs.push(`evidence/${name}`);
		}
	}

	return { evidenceDir: dir, evidenceRefs };
}

/**
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {string} ctx.batchId
 * @param {object|null} [ctx.batchState]
 * @param {ReturnType<typeof loadSpineConfig>["config"]} [ctx.config]
 * @param {string[]} [ctx.evidenceRefs]
 */
export function collectExtendedEvidenceBundle(ctx) {
	const { projectRoot, batchId, config = null } = ctx;
	const dir = evidenceDir(projectRoot, batchId);
	fs.mkdirSync(dir, { recursive: true });

	/** @type {string[]} */
	const evidenceRefs = [...(ctx.evidenceRefs ?? [])];

	const gates = config?.gates ?? {};
	const testing = resolveTestingCommands(config, projectRoot);
	const collectTest = gates.collectTestEvidence !== false;
	const collectBuild = gates.collectBuildEvidence === true;

	if (collectTest && testing.test) {
		const result = runEvidenceCommand(projectRoot, testing.test);
		writeTextAtomic(path.join(dir, "test-output.txt"), `${result.output}\n`);
		evidenceRefs.push("evidence/test-output.txt");
	}

	if (collectBuild && testing.build) {
		const result = runEvidenceCommand(projectRoot, testing.build);
		writeTextAtomic(path.join(dir, "build-output.txt"), `${result.output}\n`);
		evidenceRefs.push("evidence/build-output.txt");
	}

	if (testing.testWithCoverage) {
		const result = runEvidenceCommand(projectRoot, testing.testWithCoverage);
		writeTextAtomic(path.join(dir, "coverage-output.txt"), `${result.output}\n`);
		evidenceRefs.push("evidence/coverage-output.txt");
	}

	return { evidenceDir: dir, evidenceRefs };
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {string[]} evidenceRefs
 */
export function finalizeEvidenceBundleComplete(projectRoot, batchId, evidenceRefs) {
	const completePayload = `${JSON.stringify({
		completedAt: new Date().toISOString(),
		evidenceRefs,
	})}\n`;
	writeTextAtomic(evidenceCompletePath(projectRoot, batchId), completePayload);
}

/**
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {string} ctx.batchId
 * @param {object|null} [ctx.batchState]
 * @param {ReturnType<typeof loadSpineConfig>["config"]} [ctx.config]
 * @param {object} [ctx.reconciliation]
 */
export function collectEvidenceBundle(ctx) {
	const reconciliation =
		ctx.reconciliation ??
		reconcileBatch({ projectRoot: ctx.projectRoot, batchState: ctx.batchState ?? null, verbose: true });
	const core = collectCoreEvidenceBundle({ ...ctx, reconciliation });
	const extended = collectExtendedEvidenceBundle({ ...ctx, evidenceRefs: core.evidenceRefs });
	finalizeEvidenceBundleComplete(ctx.projectRoot, ctx.batchId, extended.evidenceRefs);
	return { evidenceDir: extended.evidenceDir, evidenceRefs: extended.evidenceRefs };
}

/**
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {string} ctx.batchId
 * @param {object|null} [ctx.batchState]
 * @param {ReturnType<typeof loadSpineConfig>["config"]} [ctx.config]
 */
export function openIntegrateGate(ctx) {
	const { projectRoot, batchId, batchState = null, config = null } = ctx;
	const existing = loadGateRecord(projectRoot, batchId);
	if (existing) {
		return { gate: existing, opened: false, evidenceRefs: existing.evidenceRefs ?? [] };
	}

	const reconciliation = reconcileBatch({ projectRoot, batchState, verbose: true });
	const core = collectCoreEvidenceBundle({ projectRoot, batchId, batchState, config, reconciliation });
	/** @type {string[]} */
	let evidenceRefs = [...core.evidenceRefs];

	const gate = {
		gateId: crypto.randomUUID(),
		batchId,
		kind: "integrate",
		status: "pending",
		openedAt: new Date().toISOString(),
		evidenceRefs,
		summary: formatGateSummary({ kind: "integrate", status: "pending", evidenceRefs }),
	};

	saveGateRecord(projectRoot, gate);
	appendJournalEvent(projectRoot, batchId, "gate.opened", {
		gateId: gate.gateId,
		kind: gate.kind,
		status: gate.status,
		evidenceRefs: gate.evidenceRefs,
	});

	appendJournalEvent(projectRoot, batchId, "gate.evidence_collecting", {
		stage: "extended",
	});

	/** @type {string | null} */
	let extendedError = null;
	try {
		const extended = collectExtendedEvidenceBundle({
			projectRoot,
			batchId,
			batchState,
			config,
			evidenceRefs,
		});
		evidenceRefs = extended.evidenceRefs;
		appendJournalEvent(projectRoot, batchId, "gate.evidence_completed", {
			evidenceRefCount: evidenceRefs.length,
		});
	} catch (err) {
		extendedError = err instanceof Error ? err.message : String(err);
		appendJournalEvent(projectRoot, batchId, "gate.evidence_failed", {
			message: extendedError.slice(0, 500),
		});
	}

	gate.evidenceRefs = evidenceRefs;
	gate.summary = formatGateSummary({ kind: "integrate", status: "pending", evidenceRefs: gate.evidenceRefs });
	saveGateRecord(projectRoot, gate);

	if (!extendedError) {
		finalizeEvidenceBundleComplete(projectRoot, batchId, evidenceRefs);
	}

	return { gate, opened: true, evidenceRefs: gate.evidenceRefs, extendedError };
}

/**
 * Auto-open integrate gate when batch reaches terminal success (AC-4.1).
 *
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {string} ctx.batchId
 * @param {object} ctx.batchState
 */
export function openIntegrateGateAfterBatchComplete(ctx) {
	const { projectRoot, batchId, batchState } = ctx;
	const configResult = loadSpineConfig(projectRoot);
	const config = configResult.config ?? null;

	if (batchState?.phase !== "completed") {
		return { skipped: true, reason: "batch_not_completed" };
	}

	if (!batchState?.orchBranch) {
		return { skipped: true, reason: "no_orch_branch" };
	}

	return {
		skipped: false,
		...openIntegrateGate({ projectRoot, batchId, batchState, config }),
	};
}

/**
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {string} ctx.batchId
 */
export function approveIntegrateGate(ctx) {
	const { projectRoot, batchId } = ctx;
	const gate = loadGateRecord(projectRoot, batchId);

	if (!gate) {
		return {
			ok: false,
			exitCode: 1,
			error: "No integrate gate found for this batch",
			headline: "Cannot approve — gate not opened",
			suggestedCommand: "spine status --diagnose",
		};
	}

	if (gate.status === "approved") {
		return { ok: true, exitCode: 0, gate, headline: "Integrate gate already approved", alreadyDecided: true };
	}

	if (gate.status === "rejected") {
		return {
			ok: false,
			exitCode: 1,
			error: "Gate was rejected — reopen batch evidence or start a new gate cycle",
			headline: "Cannot approve a rejected gate",
			suggestedCommand: "spine gate status",
			gate,
		};
	}

	gate.status = "approved";
	gate.decidedAt = new Date().toISOString();
	gate.decidedBy = "human";
	saveGateRecord(projectRoot, gate);

	appendJournalEvent(projectRoot, batchId, "gate.approved", {
		gateId: gate.gateId,
		kind: gate.kind,
		status: gate.status,
	});

	return {
		ok: true,
		exitCode: 0,
		gate,
		headline: "Integrate gate approved",
		suggestedCommand: "spine integrate",
		alternatives: ["/spine-integrate"],
	};
}

/**
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {string} ctx.batchId
 * @param {string} [ctx.reason]
 */
export function rejectIntegrateGate(ctx) {
	const { projectRoot, batchId, reason } = ctx;
	const gate = loadGateRecord(projectRoot, batchId);

	if (!gate) {
		return {
			ok: false,
			exitCode: 1,
			error: "No integrate gate found for this batch",
			headline: "Cannot reject — gate not opened",
			suggestedCommand: "spine status --diagnose",
		};
	}

	if (gate.status === "rejected") {
		return { ok: true, exitCode: 0, gate, headline: "Integrate gate already rejected", alreadyDecided: true };
	}

	if (gate.status === "approved") {
		return {
			ok: false,
			exitCode: 1,
			error: "Gate already approved",
			headline: "Cannot reject an approved gate",
			suggestedCommand: "spine integrate",
			gate,
		};
	}

	gate.status = "rejected";
	gate.decidedAt = new Date().toISOString();
	gate.decidedBy = "human";
	if (reason) gate.rejectionReason = reason;
	saveGateRecord(projectRoot, gate);

	appendJournalEvent(projectRoot, batchId, "gate.rejected", {
		gateId: gate.gateId,
		kind: gate.kind,
		status: gate.status,
		reason: reason ?? null,
	});

	return {
		ok: true,
		exitCode: 0,
		gate,
		headline: "Integrate gate rejected",
		suggestedCommand: "spine status --diagnose",
		alternatives: ["/spine-gate status"],
	};
}

/**
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {string} ctx.batchId
 */
export function getIntegrateGateStatus(ctx) {
	const { projectRoot, batchId } = ctx;
	const gate = loadGateRecord(projectRoot, batchId);

	if (!gate) {
		return {
			ok: true,
			exitCode: 0,
			gate: null,
			headline: "No integrate gate on record",
			suggestedCommand: "spine status --diagnose",
		};
	}

	const commands =
		gate.status === "pending"
			? { suggestedCommand: "spine gate approve", alternatives: ["spine gate reject", "/spine-gate approve"] }
			: gate.status === "approved"
				? { suggestedCommand: "spine integrate", alternatives: ["/spine-integrate"] }
				: { suggestedCommand: "spine status --diagnose", alternatives: [] };

	return {
		ok: true,
		exitCode: 0,
		gate,
		headline: formatGateSummary(gate),
		...commands,
	};
}

/**
 * Fail-closed integrate gate check (§12.4).
 *
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {string} ctx.batchId
 * @param {ReturnType<typeof loadSpineConfig>["config"]} [ctx.config]
 * @param {boolean} [ctx.forceIntegrate]
 * @param {boolean} [ctx.dryRun]
 */
export function checkIntegrateGate(ctx) {
	const { projectRoot, batchId, forceIntegrate = false, dryRun = false } = ctx;
	const config = ctx.config ?? loadSpineConfig(projectRoot).config ?? null;
	const requireGate = config?.gates?.requireBeforeIntegrate === true;

	if (!requireGate) {
		return { ok: true, required: false };
	}

	if (forceIntegrate) {
		if (process.env.SPINE_ALLOW_FORCE !== "1") {
			return {
				ok: false,
				required: true,
				exitCode: 2,
				failureClass: "GateBlocked",
				error: "Force integrate requires SPINE_ALLOW_FORCE=1",
				headline: "Force integrate blocked — set SPINE_ALLOW_FORCE=1 to bypass gate",
				suggestedCommand: "spine gate approve",
			};
		}

		if (!dryRun) {
			appendJournalEvent(projectRoot, batchId, "integrate.force_bypass", {
				env: "SPINE_ALLOW_FORCE=1",
				gateRequired: true,
			});
		}

		return { ok: true, required: true, forced: true };
	}

	const gate = loadGateRecord(projectRoot, batchId);
	if (!gate) {
		return {
			ok: false,
			required: true,
			exitCode: 2,
			failureClass: "GateBlocked",
			error: "Integrate gate not opened — approve evidence before merging",
			headline: "Integrate blocked — no gate record (run batch to completion or spine gate status)",
			suggestedCommand: "spine gate status",
			alternatives: ["/spine-gate"],
		};
	}

	if (gate.status === "approved") {
		return { ok: true, required: true, gate };
	}

	if (gate.status === "rejected") {
		return {
			ok: false,
			required: true,
			exitCode: 2,
			failureClass: "GateBlocked",
			error: gate.rejectionReason ?? "Integrate gate was rejected",
			headline: "Integrate blocked — gate rejected",
			suggestedCommand: "spine gate status",
			gate,
			alternatives: ["/spine-gate status"],
		};
	}

	return {
		ok: false,
		required: true,
		exitCode: 2,
		failureClass: "GateBlocked",
		error: "Integrate gate pending human approval",
		headline: "Integrate blocked — gate pending approval",
		suggestedCommand: "spine gate approve",
		gate,
		alternatives: ["/spine-gate approve", "spine gate reject"],
	};
}
