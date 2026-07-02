/**
 * Materialize batch 20260630T212050 post-merge limbo fixture (SP-377, GitHub #59).
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { journalPath } from "../../src/batch/journal.mjs";
import { saveSpineBatchState } from "../../src/batch/state.mjs";

const FIXTURE_DIR = path.join(
	path.dirname(fileURLToPath(import.meta.url)),
	"../fixtures/batch-20260630T212050",
);

export const BATCH_20260630T212050_ID = "20260630T212050";

const ORPHAN_FIXTURE_PATH = path.join(FIXTURE_DIR, "orphan-after-merge.json");

/**
 * @returns {{ meta: object, batchState: object, journalTail: object[] }}
 */
export function loadBatch20260630OrphanFixture() {
	return JSON.parse(fs.readFileSync(ORPHAN_FIXTURE_PATH, "utf-8"));
}

/**
 * @param {string} projectRoot
 * @param {{ enginePid?: number }} [options]
 */
export function materializeBatch20260630OrphanFixture(projectRoot, options = {}) {
	const fixture = loadBatch20260630OrphanFixture();
	const batchId = fixture.meta?.batchId ?? BATCH_20260630T212050_ID;
	const state = structuredClone(fixture.batchState);
	const enginePid = options.enginePid ?? state.resilience?.enginePid ?? process.pid;
	state.resilience = { ...(state.resilience ?? {}), enginePid };
	saveSpineBatchState(projectRoot, state);

	const journalFile = journalPath(projectRoot, batchId);
	fs.mkdirSync(path.dirname(journalFile), { recursive: true });
	for (const event of fixture.journalTail ?? []) {
		fs.appendFileSync(journalFile, `${JSON.stringify(event)}\n`, "utf-8");
	}

	const orchBranch = String(state.orchBranch ?? `orch/spine-${batchId}`);
	execFileSync("git", ["checkout", "-b", orchBranch], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "--allow-empty", "-m", "orch head"], {
		cwd: projectRoot,
		stdio: "ignore",
	});
	execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });

	return { state, orchBranch, batchId };
}
