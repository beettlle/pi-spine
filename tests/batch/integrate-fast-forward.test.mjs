import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { approveIntegrateGate, openIntegrateGate } from "../../src/batch/gate.mjs";
import { loadSpineConfig } from "../../bin/spine-config.mjs";
import { integrateOrchToBase } from "../../src/batch/integrate.mjs";
import {
	isFastForwardCapableIntegrate,
	resolveRulesManifestIntegrateDrift,
} from "../../src/batch/rules-manifest-drift.mjs";
import { RULES_MANIFEST_REL_PATH } from "../../src/config/cursor-rules/discover.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const sampleRules = [
	{
		relPath: "taskplane-worker-cursor.mdc",
		spineClass: "manual",
		alwaysApply: false,
		description: "worker",
		globs: [],
		parseStatus: "ok",
	},
];

function writeRulesManifest(projectRoot, generatedAt, rules = sampleRules) {
	const manifest = {
		generatedAt,
		rulesRoot: ".cursor/rules",
		rules,
		excluded: [],
	};
	fs.mkdirSync(path.dirname(path.join(projectRoot, RULES_MANIFEST_REL_PATH)), { recursive: true });
	fs.writeFileSync(
		path.join(projectRoot, RULES_MANIFEST_REL_PATH),
		`${JSON.stringify(manifest, null, 2)}\n`,
		"utf-8",
	);
}

function execCommit(projectRoot, message) {
	execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", message], { cwd: projectRoot, stdio: "ignore" });
}

function writeSpineBatchState(projectRoot, fixture) {
	fs.mkdirSync(path.join(projectRoot, ".spine"), { recursive: true });
	fs.writeFileSync(
		path.join(projectRoot, ".spine", "batch-state.json"),
		JSON.stringify(fixture, null, 2),
		"utf-8",
	);
}

function completedBatchFixture(orchBranch, batchId = "20260702T071449") {
	return {
		batchId,
		phase: "completed",
		baseBranch: "main",
		orchBranch,
		startedAt: Date.now() - 60_000,
		endedAt: Date.now(),
		failedTasks: 0,
		succeededTasks: 3,
		totalTasks: 3,
		mergeResults: [{ waveIndex: 0, status: "succeeded", mergeCommit: "deadbeef" }],
		tasks: [
			{ taskId: "SP-406", status: "succeeded", doneFileFound: true },
			{ taskId: "SP-409", status: "succeeded", doneFileFound: true },
			{ taskId: "SP-411", status: "succeeded", doneFileFound: true },
		],
	};
}

function gitRefHasPath(projectRoot, ref, filePath) {
	try {
		execFileSync("git", ["show", `${ref}:${filePath}`], {
			cwd: projectRoot,
			stdio: ["ignore", "pipe", "pipe"],
		});
		return true;
	} catch {
		return false;
	}
}

/**
 * Batch 20260702T071449 style fixture: orch strictly ahead of main (fast-forward capable).
 */
function setupFastForwardFixture(projectRoot, batchId = "20260702T071449") {
	const orchBranch = `orch/spine-${batchId}`;

	fs.writeFileSync(path.join(projectRoot, "base.txt"), "base\n", "utf-8");
	execCommit(projectRoot, "base");
	execFileSync("git", ["checkout", "-b", orchBranch], { cwd: projectRoot, stdio: "ignore" });

	for (let index = 0; index < 3; index += 1) {
		fs.appendFileSync(path.join(projectRoot, "orch.txt"), `wave commit ${index}\n`, "utf-8");
		execCommit(projectRoot, `orch wave ${index}`);
	}

	execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });
	return { batchId, orchBranch };
}

function approveGateForIntegrate(projectRoot, fixture, batchId) {
	const config = loadSpineConfig(projectRoot).config;
	openIntegrateGate({ projectRoot, batchId, batchState: fixture, config });
	approveIntegrateGate({ projectRoot, batchId });
}

test("isFastForwardCapableIntegrate detects orch ahead of main (#93)", async () => {
	const projectRoot = await initGitRepo("spine-integrate-ff-detect-");
	try {
		const { orchBranch } = setupFastForwardFixture(projectRoot);
		assert.equal(
			isFastForwardCapableIntegrate({ projectRoot, baseBranch: "main", orchBranch }),
			true,
		);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("integrateOrchToBase fast-forwards when orch is strictly ahead (#93 batch 20260702T071449)", async () => {
	const projectRoot = await initGitRepo("spine-integrate-ff-merge-");
	const batchId = "20260702T071449";
	try {
		const { orchBranch } = setupFastForwardFixture(projectRoot, batchId);
		execFileSync("git", ["checkout", "-b", "task/spine-lane-3"], {
			cwd: projectRoot,
			stdio: "ignore",
		});

		const fixture = completedBatchFixture(orchBranch, batchId);
		writeSpineBatchState(projectRoot, fixture);
		approveGateForIntegrate(projectRoot, fixture, batchId);

		const mainBefore = execFileSync("git", ["rev-parse", "main"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();
		const orchTip = execFileSync("git", ["rev-parse", orchBranch], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();

		const dryRun = integrateOrchToBase({ projectRoot, dryRun: true });
		assert.match(dryRun.mergePlan ?? "", /fast-forward/i);

		const result = integrateOrchToBase({ projectRoot });
		assert.equal(result.ok, true, result.error ?? result.headline);
		assert.equal(result.mergeCommit, orchTip);

		const mainAfter = execFileSync("git", ["rev-parse", "main"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();
		assert.notEqual(mainBefore, mainAfter);
		assert.equal(mainAfter, orchTip);
		assert.ok(gitRefHasPath(projectRoot, "main", "orch.txt"));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("integrateOrchToBase fast-forwards with generatedAt-only rules-manifest drift on main (#93)", async () => {
	const projectRoot = await initGitRepo("spine-integrate-ff-manifest-");
	const batchId = "20260702T071449";
	try {
		writeRulesManifest(projectRoot, "2026-07-01T00:00:00.000Z");
		const { orchBranch } = setupFastForwardFixture(projectRoot, batchId);
		writeRulesManifest(projectRoot, "2026-07-02T12:00:00.000Z");

		const drift = resolveRulesManifestIntegrateDrift({
			projectRoot,
			baseBranch: "main",
			orchBranch,
			isolatedMerge: true,
		});
		assert.equal(drift.ok, true, drift.error);
		assert.equal(drift.resolved, true);

		const fixture = completedBatchFixture(orchBranch, batchId);
		writeSpineBatchState(projectRoot, fixture);
		approveGateForIntegrate(projectRoot, fixture, batchId);

		const result = integrateOrchToBase({ projectRoot });
		assert.equal(result.ok, true, result.error ?? result.headline);
		assert.ok(gitRefHasPath(projectRoot, "main", "orch.txt"));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
