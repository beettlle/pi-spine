import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import {
	collectCoreEvidenceBundle,
	collectExtendedEvidenceBundle,
	evidenceCompletePath,
	evidenceDir,
	isEvidenceBundleComplete,
} from "../../src/batch/evidence.mjs";
import { gateRecordPath, loadGateRecord, openIntegrateGate } from "../../src/batch/gate.mjs";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const BATCH_ID = "20260701T170610";

function completedFixture(batchId, orchBranch) {
	return {
		batchId,
		phase: "completed",
		baseBranch: "main",
		orchBranch,
		startedAt: Date.now() - 60_000,
		endedAt: Date.now(),
		failedTasks: 0,
		succeededTasks: 1,
		totalTasks: 1,
		mergeResults: [{ waveIndex: 0, status: "succeeded" }],
		tasks: [{ taskId: "SP-402", status: "succeeded", taskFolder: "spine-tasks/SP-402", doneFileFound: true }],
	};
}

function createOrchWithWork(projectRoot, orchBranch) {
	execFileSync("git", ["checkout", "-b", orchBranch], { cwd: projectRoot, stdio: "ignore" });
	fs.writeFileSync(path.join(projectRoot, "orch-work.txt"), "lane merge landed on orch", "utf-8");
	execFileSync("git", ["add", "orch-work.txt"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", "orch work"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });
}

test("collectCoreEvidenceBundle writes summary without complete marker", async () => {
	const projectRoot = await initGitRepo("spine-evidence-core-");
	try {
		const { evidenceRefs } = collectCoreEvidenceBundle({
			projectRoot,
			batchId: BATCH_ID,
			batchState: { batchId: BATCH_ID, phase: "completed", baseBranch: "main" },
			config: { baseBranch: "main", gates: {} },
		});

		assert.ok(evidenceRefs.includes("evidence/summary.md"));
		assert.equal(isEvidenceBundleComplete(projectRoot, BATCH_ID), false);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("openIntegrateGate persists gate before extended evidence and journals milestones", async () => {
	const projectRoot = await initGitRepo("spine-gate-two-phase-");
	const orchBranch = `orch/spine-${BATCH_ID}`;
	try {
		createOrchWithWork(projectRoot, orchBranch);
		fs.mkdirSync(path.join(projectRoot, ".spine"), { recursive: true });
		fs.writeFileSync(
			path.join(projectRoot, ".spine", "spine-config.json"),
			JSON.stringify(
				{
					configVersion: 1,
					baseBranch: "main",
					testing: {
						test: `node -e "console.log('evidence-test-ok')"`,
						build: "",
						testWithCoverage: "",
					},
					gates: { collectTestEvidence: true, collectBuildEvidence: false },
				},
				null,
				2,
			),
			"utf-8",
		);

		const fixture = completedFixture(BATCH_ID, orchBranch);
		const config = JSON.parse(
			fs.readFileSync(path.join(projectRoot, ".spine", "spine-config.json"), "utf-8"),
		);

		const opened = openIntegrateGate({
			projectRoot,
			batchId: BATCH_ID,
			batchState: fixture,
			config,
		});

		assert.equal(opened.opened, true);
		assert.ok(fs.existsSync(gateRecordPath(projectRoot, BATCH_ID)));
		assert.ok(opened.evidenceRefs.includes("evidence/test-output.txt"));
		assert.equal(isEvidenceBundleComplete(projectRoot, BATCH_ID), true);

		const events = readJournalEvents(projectRoot, BATCH_ID);
		assert.ok(events.some((event) => event.type === "gate.opened"));
		assert.ok(events.some((event) => event.type === "gate.evidence_collecting"));
		assert.ok(events.some((event) => event.type === "gate.evidence_completed"));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("openIntegrateGate keeps gate when extended evidence command fails", async () => {
	const projectRoot = await initGitRepo("spine-gate-ext-fail-");
	const orchBranch = `orch/spine-${BATCH_ID}`;
	try {
		createOrchWithWork(projectRoot, orchBranch);
		fs.mkdirSync(path.join(projectRoot, ".spine"), { recursive: true });
		fs.writeFileSync(
			path.join(projectRoot, ".spine", "spine-config.json"),
			JSON.stringify(
				{
					configVersion: 1,
					baseBranch: "main",
					testing: {
						test: "npm test; rm -rf /",
						build: "",
						testWithCoverage: "",
					},
					gates: { collectTestEvidence: true, collectBuildEvidence: false },
				},
				null,
				2,
			),
			"utf-8",
		);

		const fixture = completedFixture(BATCH_ID, orchBranch);
		const config = JSON.parse(
			fs.readFileSync(path.join(projectRoot, ".spine", "spine-config.json"), "utf-8"),
		);

		const opened = openIntegrateGate({
			projectRoot,
			batchId: BATCH_ID,
			batchState: fixture,
			config,
		});

		assert.equal(opened.opened, true);
		const gate = loadGateRecord(projectRoot, BATCH_ID);
		assert.ok(gate);
		assert.ok(gate.evidenceRefs.includes("evidence/summary.md"));
		assert.ok(gate.evidenceRefs.includes("evidence/test-output.txt"));
		assert.equal(isEvidenceBundleComplete(projectRoot, BATCH_ID), true);

		const testOutput = fs.readFileSync(
			path.join(evidenceDir(projectRoot, BATCH_ID), "test-output.txt"),
			"utf-8",
		);
		assert.match(testOutput, /\[rejected\]/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("collectExtendedEvidenceBundle appends to existing refs", async () => {
	const projectRoot = await initGitRepo("spine-evidence-ext-");
	try {
		const core = collectCoreEvidenceBundle({
			projectRoot,
			batchId: BATCH_ID,
			batchState: { batchId: BATCH_ID, phase: "completed", baseBranch: "main" },
			config: { baseBranch: "main", gates: { collectTestEvidence: false } },
		});
		const extended = collectExtendedEvidenceBundle({
			projectRoot,
			batchId: BATCH_ID,
			batchState: { batchId: BATCH_ID, phase: "completed", baseBranch: "main" },
			config: {
				baseBranch: "main",
				testing: { test: "", build: "", testWithCoverage: "" },
				gates: { collectTestEvidence: false },
			},
			evidenceRefs: core.evidenceRefs,
		});
		assert.ok(extended.evidenceRefs.includes("evidence/summary.md"));
		assert.equal(isEvidenceBundleComplete(projectRoot, BATCH_ID), false);
		assert.equal(fs.existsSync(evidenceCompletePath(projectRoot, BATCH_ID)), false);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
