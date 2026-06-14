import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { mergeLaneToOrch } from "../../src/batch/engine-lanes/merge.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

function execCommit(projectRoot, message) {
	execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", message], { cwd: projectRoot, stdio: "ignore" });
}

/**
 * Reproduces cross-lane dependency artifact drift (pi-web-access batch 20260614T003849):
 * lane 2 never commits parallel.ts but carries a stale snapshot; orch advanced parallel.ts via lane 1.
 */
test("mergeLaneToOrch prefers orch for conflicts outside lane file scope", async () => {
	const projectRoot = await initGitRepo("spine-lane-merge-out-of-scope-");
	try {
		const batchId = "20260614T003849";
		const orchBranch = `orch/spine-${batchId}`;
		const lane1Branch = `task/spine-lane-1-${batchId}`;
		const lane2Branch = `task/spine-lane-2-${batchId}`;

		fs.writeFileSync(path.join(projectRoot, "parallel.ts"), "export const v = 1;\n", "utf-8");
		fs.writeFileSync(path.join(projectRoot, "index.ts"), "export {};\n", "utf-8");
		execCommit(projectRoot, "base");

		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["branch", lane1Branch, orchBranch], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["branch", lane2Branch, orchBranch], { cwd: projectRoot, stdio: "ignore" });

		execFileSync("git", ["checkout", lane1Branch], { cwd: projectRoot, stdio: "ignore" });
		fs.writeFileSync(path.join(projectRoot, "parallel.ts"), "export const v = 2;\n", "utf-8");
		execCommit(projectRoot, "lane1 parallel.ts");

		execFileSync("git", ["checkout", orchBranch], { cwd: projectRoot, stdio: "ignore" });
		execFileSync(
			"git",
			["merge", "--no-ff", lane1Branch, "-m", "merge lane1"],
			{ cwd: projectRoot, stdio: "ignore" },
		);

		execFileSync("git", ["checkout", lane2Branch], { cwd: projectRoot, stdio: "ignore" });
		fs.writeFileSync(path.join(projectRoot, "index.ts"), "import './parallel.ts';\nexport {};\n", "utf-8");
		execCommit(projectRoot, "lane2 index.ts only");

		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });

		const merge = mergeLaneToOrch({
			projectRoot,
			baseBranch: "main",
			orchBranch,
			taskBranch: lane2Branch,
			batchId,
			laneFileScopePaths: ["index.ts"],
		});

		assert.equal(merge.ok, true, merge.error);

		execFileSync("git", ["checkout", orchBranch], { cwd: projectRoot, stdio: "ignore" });
		const parallel = fs.readFileSync(path.join(projectRoot, "parallel.ts"), "utf-8");
		const index = fs.readFileSync(path.join(projectRoot, "index.ts"), "utf-8");
		assert.match(parallel, /v = 2/);
		assert.match(index, /import '\.\/parallel\.ts'/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("mergeLaneToOrch does not auto-resolve in-scope lane conflicts", async () => {
	const projectRoot = await initGitRepo("spine-lane-merge-in-scope-conflict-");
	try {
		const batchId = "20260614T003850";
		const orchBranch = `orch/spine-${batchId}`;
		const laneBranch = `task/spine-lane-2-${batchId}`;

		fs.writeFileSync(path.join(projectRoot, "index.ts"), "orch\n", "utf-8");
		execCommit(projectRoot, "base");

		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["branch", laneBranch, "main"], { cwd: projectRoot, stdio: "ignore" });

		execFileSync("git", ["checkout", orchBranch], { cwd: projectRoot, stdio: "ignore" });
		fs.writeFileSync(path.join(projectRoot, "index.ts"), "orch-v2\n", "utf-8");
		execCommit(projectRoot, "orch index");

		execFileSync("git", ["checkout", laneBranch], { cwd: projectRoot, stdio: "ignore" });
		fs.writeFileSync(path.join(projectRoot, "index.ts"), "lane-v1\n", "utf-8");
		execCommit(projectRoot, "lane index");

		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });

		const merge = mergeLaneToOrch({
			projectRoot,
			baseBranch: "main",
			orchBranch,
			taskBranch: laneBranch,
			batchId,
			laneFileScopePaths: ["index.ts"],
		});

		assert.equal(merge.ok, false);
		assert.equal(merge.failureClass, "MergeConflict");
		assert.match(merge.error, /index\.ts/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
