// @ts-nocheck
/**
 * Integrate gate evidence collection (SP-432 / #83-D).
 * Split from gate.mjs to keep gate FSM under phase-23 LOC policy.
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { writeTextAtomic } from "../fs/atomic-write.mjs";
import { runEvidenceCommand } from "./evidence-command.mjs";
import {
	evidenceCompletePath,
	evidenceDir,
	resolveTestingCommands,
} from "./gate-evidence-read.mjs";
import { readJournalEvents, readJournalTail } from "./journal.mjs";
import { generateBatchPostMortem } from "./postmortem.mjs";
import { reconcileBatch } from "./reconcile.mjs";

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
 * @param {ReturnType<typeof import("../config/spine-config-load.mjs").loadSpineConfig>["config"]} [ctx.config]
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
 * @param {ReturnType<typeof import("../config/spine-config-load.mjs").loadSpineConfig>["config"]} [ctx.config]
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
 * @param {ReturnType<typeof import("../config/spine-config-load.mjs").loadSpineConfig>["config"]} [ctx.config]
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
