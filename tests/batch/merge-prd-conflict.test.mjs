import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { mergeLaneToOrch } from "../../src/batch/engine-lanes/merge.mjs";
import {
	formatPrdDocMergeFailure,
	PRD_DOC_REL_PATH,
} from "../../src/batch/merge/adoption-doc-merge.mjs";
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

function execCommit(projectRoot, message) {
	execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", message], { cwd: projectRoot, stdio: "ignore" });
}

function writePrd(projectRoot, content) {
	const abs = path.join(projectRoot, PRD_DOC_REL_PATH);
	fs.mkdirSync(path.dirname(abs), { recursive: true });
	fs.writeFileSync(abs, content, "utf-8");
}

function writeRulesManifest(projectRoot, generatedAt) {
	const manifest = {
		generatedAt,
		rulesRoot: ".cursor/rules",
		rules: sampleRules,
		excluded: [],
	};
	const manifestPath = path.join(projectRoot, RULES_MANIFEST_REL_PATH);
	fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
	fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
}

/**
 * Reproduces GitHub #37: SP-137 merge-origin-main leaves additive docs/PRD.md edits
 * that overlap orch wave updates; disjoint hunks should auto-merge into orch.
 */
test("mergeLaneToOrch auto-resolves additive docs/PRD.md after origin/main merge task", async () => {
	const projectRoot = await initGitRepo("spine-prd-merge-");
	try {
		const batchId = "20260628T062636";
		const orchBranch = `orch/spine-${batchId}`;
		const laneBranch = `task/spine-lane-4-${batchId}`;

		writePrd(
			projectRoot,
			`# PRD

## Release history

| Version | Notes |
|---------|-------|
| v1.0.0 | initial |

## Shared tail
`,
		);
		writeRulesManifest(projectRoot, "2026-06-28T06:00:00.000Z");
		execCommit(projectRoot, "base prd + manifest");

		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["branch", laneBranch, orchBranch], { cwd: projectRoot, stdio: "ignore" });

		execFileSync("git", ["checkout", orchBranch], { cwd: projectRoot, stdio: "ignore" });
		writePrd(
			projectRoot,
			`# PRD

## Release history

| Version | Notes |
|---------|-------|
| v1.0.0 | initial |
| v1.1.0 | orch wave SP-136 |

## Shared tail
`,
		);
		writeRulesManifest(projectRoot, "2026-06-28T06:30:00.000Z");
		execCommit(projectRoot, "orch release-recovery wave");

		execFileSync("git", ["checkout", laneBranch], { cwd: projectRoot, stdio: "ignore" });
		writePrd(
			projectRoot,
			`# PRD

## Release history

| Version | Notes |
|---------|-------|
| v1.0.0 | initial |

## Phase 20 handoff (SP-137)

Merged origin/main; see docs/PRD-v2.0-implementation-handoff.md.

## Shared tail
`,
		);
		writeRulesManifest(projectRoot, "2026-06-28T06:45:00.000Z");
		execCommit(projectRoot, "lane merge origin/main + SP-137");

		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });

		const merge = mergeLaneToOrch({
			projectRoot,
			baseBranch: "main",
			orchBranch,
			taskBranch: laneBranch,
			batchId,
			laneFileScopePaths: [PRD_DOC_REL_PATH, RULES_MANIFEST_REL_PATH],
			waveIndex: 1,
		});

		assert.equal(merge.ok, true, merge.error);

		execFileSync("git", ["checkout", orchBranch], { cwd: projectRoot, stdio: "ignore" });
		const mergedPrd = fs.readFileSync(path.join(projectRoot, PRD_DOC_REL_PATH), "utf-8");
		assert.match(mergedPrd, /orch wave SP-136/);
		assert.match(mergedPrd, /Phase 20 handoff \(SP-137\)/);
		assert.match(mergedPrd, /Merged origin\/main/);

		const mergedManifest = JSON.parse(
			fs.readFileSync(path.join(projectRoot, RULES_MANIFEST_REL_PATH), "utf-8"),
		);
		assert.equal(mergedManifest.generatedAt, "2026-06-28T06:45:00.000Z");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("mergeLaneToOrch fails PRD merge with recovery commands when hunks overlap", async () => {
	const projectRoot = await initGitRepo("spine-prd-conflict-");
	try {
		const batchId = "20260628T062637";
		const orchBranch = `orch/spine-${batchId}`;
		const laneBranch = `task/spine-lane-4-${batchId}`;

		writePrd(projectRoot, "shared\nmiddle\nend\n");
		execCommit(projectRoot, "base prd");

		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["branch", laneBranch, "main"], { cwd: projectRoot, stdio: "ignore" });

		execFileSync("git", ["checkout", orchBranch], { cwd: projectRoot, stdio: "ignore" });
		writePrd(projectRoot, "shared\norch-edit\nend\n");
		execCommit(projectRoot, "orch edit");

		execFileSync("git", ["checkout", laneBranch], { cwd: projectRoot, stdio: "ignore" });
		writePrd(projectRoot, "shared\nlane-edit\nend\n");
		execCommit(projectRoot, "lane edit");

		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });

		const merge = mergeLaneToOrch({
			projectRoot,
			baseBranch: "main",
			orchBranch,
			taskBranch: laneBranch,
			batchId,
			laneFileScopePaths: [PRD_DOC_REL_PATH],
			waveIndex: 1,
		});

		assert.equal(merge.ok, false);
		assert.equal(merge.failureClass, "MergeConflict");
		assert.match(merge.error, /docs\/PRD\.md/);
		assert.match(merge.error, /release-recovery PRD hunks could not be auto-merged safely/);
		assert.match(merge.error, /force-merge --wave 1/);
		assert.match(merge.error, /spine batch resume/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("formatPrdDocMergeFailure names file and wave recovery", () => {
	const message = formatPrdDocMergeFailure({
		filePath: PRD_DOC_REL_PATH,
		waveIndex: 1,
		conflictHunks: ["ours.md"],
	});
	assert.match(message, /docs\/PRD\.md/);
	assert.match(message, /force-merge --wave 1/);
	assert.match(message, /Conflicting hunks: ours\.md/);
});
