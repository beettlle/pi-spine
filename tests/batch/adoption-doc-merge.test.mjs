import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { mergeLaneToOrch } from "../../src/batch/engine-lanes/merge.mjs";
import { formatAdoptionDocMergeFailure } from "../../src/batch/merge/adoption-doc-merge.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const RUNBOOK_REL = "docs/adoption/operator-runbook.md";

function execCommit(projectRoot, message) {
	execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", message], { cwd: projectRoot, stdio: "ignore" });
}

function writeRunbook(projectRoot, content) {
	const abs = path.join(projectRoot, RUNBOOK_REL);
	fs.mkdirSync(path.dirname(abs), { recursive: true });
	fs.writeFileSync(abs, content, "utf-8");
}

/**
 * Reproduces GitHub #14: serial lane tasks edit disjoint sections of operator-runbook.md.
 */
test("mergeLaneToOrch auto-resolves disjoint adoption doc edits without force-merge", async () => {
	const projectRoot = await initGitRepo("spine-adoption-doc-merge-");
	try {
		const batchId = "20260619T020951";
		const orchBranch = `orch/spine-${batchId}`;
		const laneBranch = `task/spine-lane-1-${batchId}`;

		writeRunbook(
			projectRoot,
			`# Operator runbook

## Section A

| Key | Value |
|-----|-------|
| base | row |

## Section B

shared tail
`,
		);
		execCommit(projectRoot, "base runbook");

		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["branch", laneBranch, orchBranch], { cwd: projectRoot, stdio: "ignore" });

		execFileSync("git", ["checkout", orchBranch], { cwd: projectRoot, stdio: "ignore" });
		writeRunbook(
			projectRoot,
			`# Operator runbook

## Section A

| Key | Value |
|-----|-------|
| base | row |
| orch | wave-1-2 |

## Section B

shared tail
`,
		);
		execCommit(projectRoot, "orch README wave rows");

		execFileSync("git", ["checkout", laneBranch], { cwd: projectRoot, stdio: "ignore" });
		writeRunbook(
			projectRoot,
			`# Operator runbook

## Section A

| Key | Value |
|-----|-------|
| base | row |

## Section B

shared tail

## Dashboard diagnosis (SP-303)

| Signal | Meaning |
|--------|---------|
| stall | check STATUS |

## Doc index (SP-304)

See README absorption table.
`,
		);
		execCommit(projectRoot, "lane SP-303+SP-304 serial commits");

		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });

		const merge = mergeLaneToOrch({
			projectRoot,
			baseBranch: "main",
			orchBranch,
			taskBranch: laneBranch,
			batchId,
			laneFileScopePaths: [RUNBOOK_REL],
			waveIndex: 3,
		});

		assert.equal(merge.ok, true, merge.error);

		execFileSync("git", ["checkout", orchBranch], { cwd: projectRoot, stdio: "ignore" });
		const merged = fs.readFileSync(path.join(projectRoot, RUNBOOK_REL), "utf-8");
		assert.match(merged, /orch \| wave-1-2/);
		assert.match(merged, /Dashboard diagnosis \(SP-303\)/);
		assert.match(merged, /Doc index \(SP-304\)/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("mergeLaneToOrch fails adoption doc merge with recovery commands when hunks overlap", async () => {
	const projectRoot = await initGitRepo("spine-adoption-doc-conflict-");
	try {
		const batchId = "20260619T020952";
		const orchBranch = `orch/spine-${batchId}`;
		const laneBranch = `task/spine-lane-1-${batchId}`;

		writeRunbook(projectRoot, "shared\nmiddle\nend\n");
		execCommit(projectRoot, "base");

		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["branch", laneBranch, "main"], { cwd: projectRoot, stdio: "ignore" });

		execFileSync("git", ["checkout", orchBranch], { cwd: projectRoot, stdio: "ignore" });
		writeRunbook(projectRoot, "shared\norch-edit\nend\n");
		execCommit(projectRoot, "orch edit");

		execFileSync("git", ["checkout", laneBranch], { cwd: projectRoot, stdio: "ignore" });
		writeRunbook(projectRoot, "shared\nlane-edit\nend\n");
		execCommit(projectRoot, "lane edit");

		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });

		const merge = mergeLaneToOrch({
			projectRoot,
			baseBranch: "main",
			orchBranch,
			taskBranch: laneBranch,
			batchId,
			laneFileScopePaths: [RUNBOOK_REL],
			waveIndex: 3,
		});

		assert.equal(merge.ok, false);
		assert.equal(merge.failureClass, "MergeConflict");
		assert.match(merge.error, /docs\/adoption\/operator-runbook\.md/);
		assert.match(merge.error, /force-merge --wave 3/);
		assert.match(merge.error, /spine batch resume/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("formatAdoptionDocMergeFailure names file and wave recovery", () => {
	const message = formatAdoptionDocMergeFailure({
		filePath: RUNBOOK_REL,
		waveIndex: 3,
		conflictHunks: ["ours.md"],
	});
	assert.match(message, /operator-runbook\.md/);
	assert.match(message, /force-merge --wave 3/);
	assert.match(message, /Conflicting hunks: ours\.md/);
});
