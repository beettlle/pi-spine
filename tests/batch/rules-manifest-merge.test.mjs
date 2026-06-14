import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
	fingerprintRulesManifest,
	resolveRulesManifestGeneratedAtMerge,
	RULES_MANIFEST_REL_PATH,
} from "../../src/config/cursor-rules/discover.mjs";
import {
	mergeLaneToOrch,
	tryAutoResolveRulesManifestMergeConflict,
} from "../../src/batch/engine-lanes.mjs";
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

const altRules = [
	{
		relPath: "other-rule.mdc",
		spineClass: "always",
		alwaysApply: true,
		description: null,
		globs: [],
		parseStatus: "ok",
	},
];

function writeRulesManifest(projectRoot, generatedAt, rules) {
	const manifest = {
		generatedAt,
		rulesRoot: ".cursor/rules",
		rules,
		excluded: [],
	};
	const manifestPath = path.join(projectRoot, RULES_MANIFEST_REL_PATH);
	fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
	fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
}

function execCommit(projectRoot, message) {
	execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", message], { cwd: projectRoot, stdio: "ignore" });
}

function setupManifestMergeFixture(
	projectRoot,
	{
		orchGeneratedAt,
		laneGeneratedAt,
		orchRules = sampleRules,
		laneRules = sampleRules,
		extraConflict = false,
	},
) {
	const batchId = "20260605T213158";
	const orchBranch = `orch/spine-${batchId}`;
	const taskBranch = `task/spine-lane-1-${batchId}`;

	writeRulesManifest(projectRoot, "2026-06-05T20:00:00.000Z", sampleRules);
	execCommit(projectRoot, "base manifest");

	execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["branch", taskBranch, "main"], { cwd: projectRoot, stdio: "ignore" });

	execFileSync("git", ["checkout", orchBranch], { cwd: projectRoot, stdio: "ignore" });
	writeRulesManifest(projectRoot, orchGeneratedAt, orchRules);
	if (extraConflict) {
		fs.writeFileSync(path.join(projectRoot, "shared.txt"), "orch\n", "utf-8");
	}
	execCommit(projectRoot, "orch manifest bump");

	execFileSync("git", ["checkout", taskBranch], { cwd: projectRoot, stdio: "ignore" });
	writeRulesManifest(projectRoot, laneGeneratedAt, laneRules);
	if (extraConflict) {
		fs.writeFileSync(path.join(projectRoot, "shared.txt"), "lane\n", "utf-8");
	}
	execCommit(projectRoot, "lane manifest bump");

	execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });

	return { batchId, orchBranch, taskBranch };
}

test("resolveRulesManifestGeneratedAtMerge keeps newest generatedAt", () => {
	const left = {
		generatedAt: "2026-06-05T20:00:00.000Z",
		rulesRoot: ".cursor/rules",
		rules: sampleRules,
		excluded: [],
	};
	const right = { ...left, generatedAt: "2026-06-05T22:00:00.000Z" };
	const resolved = resolveRulesManifestGeneratedAtMerge({ ours: left, theirs: right });
	assert.equal(resolved.ok, true);
	assert.equal(resolved.manifest.generatedAt, "2026-06-05T22:00:00.000Z");
});

test("resolveRulesManifestGeneratedAtMerge fails when rules differ", () => {
	const left = {
		generatedAt: "2026-06-05T20:00:00.000Z",
		rulesRoot: ".cursor/rules",
		rules: sampleRules,
		excluded: [],
	};
	const right = { ...left, generatedAt: "2026-06-05T22:00:00.000Z", rules: altRules };
	const resolved = resolveRulesManifestGeneratedAtMerge({ ours: left, theirs: right });
	assert.equal(resolved.ok, false);
	assert.equal(resolved.failureClass, "RulesManifestMergeConflict");
});

test("fingerprintRulesManifest ignores generatedAt", () => {
	const left = {
		generatedAt: "2026-06-05T20:00:00.000Z",
		rulesRoot: ".cursor/rules",
		rules: sampleRules,
		excluded: [],
	};
	const right = { ...left, generatedAt: "2026-06-05T22:00:00.000Z" };
	assert.equal(fingerprintRulesManifest(left), fingerprintRulesManifest(right));
});

test("mergeLaneToOrch clears generatedAt-only dirty rules-manifest before merge", async () => {
	const projectRoot = await initGitRepo("spine-rules-manifest-pre-merge-drift-");
	try {
		const { batchId, orchBranch, taskBranch } = setupManifestMergeFixture(projectRoot, {
			orchGeneratedAt: "2026-06-05T21:00:00.000Z",
			laneGeneratedAt: "2026-06-05T22:30:00.000Z",
		});

		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });
		const headManifest = JSON.parse(
			fs.readFileSync(path.join(projectRoot, RULES_MANIFEST_REL_PATH), "utf-8"),
		);
		writeRulesManifest(projectRoot, "2026-06-05T23:59:59.000Z", headManifest.rules);

		const merge = mergeLaneToOrch({
			projectRoot,
			baseBranch: "main",
			orchBranch,
			taskBranch,
			batchId,
		});

		assert.equal(merge.ok, true, merge.error);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("mergeLaneToOrch auto-resolves generatedAt-only rules-manifest conflict", async () => {
	const projectRoot = await initGitRepo("spine-rules-manifest-merge-");
	try {
		const { batchId, orchBranch, taskBranch } = setupManifestMergeFixture(projectRoot, {
			orchGeneratedAt: "2026-06-05T21:00:00.000Z",
			laneGeneratedAt: "2026-06-05T22:30:00.000Z",
		});

		const merge = mergeLaneToOrch({
			projectRoot,
			baseBranch: "main",
			orchBranch,
			taskBranch,
			batchId,
		});

		assert.equal(merge.ok, true, merge.error);
		execFileSync("git", ["checkout", orchBranch], { cwd: projectRoot, stdio: "ignore" });
		const merged = JSON.parse(
			fs.readFileSync(path.join(projectRoot, RULES_MANIFEST_REL_PATH), "utf-8"),
		);
		assert.equal(merged.generatedAt, "2026-06-05T22:30:00.000Z");
		assert.deepEqual(merged.rules, sampleRules);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("mergeLaneToOrch fails loud when rules[] differ", async () => {
	const projectRoot = await initGitRepo("spine-rules-manifest-rules-diff-");
	try {
		const { batchId, orchBranch, taskBranch } = setupManifestMergeFixture(projectRoot, {
			orchGeneratedAt: "2026-06-05T21:00:00.000Z",
			laneGeneratedAt: "2026-06-05T22:30:00.000Z",
			laneRules: altRules,
		});

		const merge = mergeLaneToOrch({
			projectRoot,
			baseBranch: "main",
			orchBranch,
			taskBranch,
			batchId,
		});

		assert.equal(merge.ok, false);
		assert.equal(merge.failureClass, "RulesManifestMergeConflict");
		assert.match(merge.error, /rules\[\]/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("mergeLaneToOrch does not auto-resolve when other paths conflict", async () => {
	const projectRoot = await initGitRepo("spine-rules-manifest-multi-conflict-");
	try {
		const { batchId, orchBranch, taskBranch } = setupManifestMergeFixture(projectRoot, {
			orchGeneratedAt: "2026-06-05T21:00:00.000Z",
			laneGeneratedAt: "2026-06-05T22:30:00.000Z",
			extraConflict: true,
		});

		const merge = mergeLaneToOrch({
			projectRoot,
			baseBranch: "main",
			orchBranch,
			taskBranch,
			batchId,
		});

		assert.equal(merge.ok, false);
		assert.equal(merge.failureClass, "MergeConflict");
		assert.match(merge.error, /automatic resolution supports/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("tryAutoResolveRulesManifestMergeConflict resolves in-progress merge", async () => {
	const projectRoot = await initGitRepo("spine-rules-manifest-in-progress-");
	try {
		const { orchBranch, taskBranch } = setupManifestMergeFixture(projectRoot, {
			orchGeneratedAt: "2026-06-05T21:00:00.000Z",
			laneGeneratedAt: "2026-06-05T22:30:00.000Z",
		});

		execFileSync("git", ["checkout", orchBranch], { cwd: projectRoot, stdio: "ignore" });
		let mergeFailed = false;
		try {
			execFileSync(
				"git",
				["merge", "--no-ff", taskBranch, "-m", "conflict merge"],
				{ cwd: projectRoot, stdio: "ignore" },
			);
		} catch {
			mergeFailed = true;
		}
		assert.equal(mergeFailed, true);

		const resolved = tryAutoResolveRulesManifestMergeConflict(projectRoot);
		assert.equal(resolved.ok, true);
		assert.equal(resolved.generatedAt, "2026-06-05T22:30:00.000Z");

		execFileSync("git", ["commit", "--no-edit"], { cwd: projectRoot, stdio: "ignore" });
		const merged = JSON.parse(
			fs.readFileSync(path.join(projectRoot, RULES_MANIFEST_REL_PATH), "utf-8"),
		);
		assert.equal(merged.generatedAt, "2026-06-05T22:30:00.000Z");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
