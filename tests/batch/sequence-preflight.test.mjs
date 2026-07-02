/**
 * SP-423 — sequence preflight .pi/ tolerance and error surfacing (issue #81).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { loadSpineConfig } from "../../bin/spine-config.mjs";
import { resolveTasksRoot } from "../../bin/spine-preflight.mjs";
import {
	checkGitClean,
	filterPiSessionDirtyPaths,
	isPiSessionMetadataPath,
	runBatchPreflight,
} from "../../src/config/spine-preflight-lib.mjs";
import { buildSequencePlan, runSequence } from "../../src/batch/sequence.mjs";
import { buildPlan } from "../../src/planner/index.mjs";
import { minimalValidPromptMarkdown } from "../helpers/smoke-task-prompt.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const TASK_ID = "SP-423";

const VALID_CONTRACT_SECTION = `## Contract

| Field | Value |
|-------|-------|
| testCommand | \`npm test\` |
`;

/**
 * @param {string} projectRoot
 */
function exposePiDirectoryToGitStatus(projectRoot) {
	const gitignorePath = path.join(projectRoot, ".gitignore");
	if (!fs.existsSync(gitignorePath)) return;
	const next = fs
		.readFileSync(gitignorePath, "utf-8")
		.split(/\r?\n/)
		.filter((line) => line.trim() !== ".pi/")
		.join("\n");
	fs.writeFileSync(gitignorePath, next.endsWith("\n") ? next : `${next}\n`, "utf-8");
}

/**
 * @param {string} projectRoot
 */
function writeSequenceFixture(projectRoot) {
	const folder = path.join(projectRoot, "spine-tasks", `${TASK_ID}-preflight`);
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		`${minimalValidPromptMarkdown(TASK_ID, {
			title: "preflight",
			fileScope: "src/sp423.txt",
			mission: "Sequence preflight fixture.",
		})}\n${VALID_CONTRACT_SECTION}`,
		"utf-8",
	);
	fs.writeFileSync(
		path.join(projectRoot, "spine-tasks", "dependencies.json"),
		JSON.stringify({ version: 1, tasks: { [TASK_ID]: [] } }, null, 2),
		"utf-8",
	);
}

test("isPiSessionMetadataPath matches .pi session roots and children", () => {
	assert.equal(isPiSessionMetadataPath(".pi"), true);
	assert.equal(isPiSessionMetadataPath(".pi/settings.json"), true);
	assert.equal(isPiSessionMetadataPath("dirty.txt"), false);
	assert.deepEqual(filterPiSessionDirtyPaths([".pi", "src/a.mjs"]), ["src/a.mjs"]);
});

test("checkGitClean ignores untracked .pi/ session metadata", async () => {
	const projectRoot = await initGitRepo("spine-seq-preflight-pi-");
	try {
		exposePiDirectoryToGitStatus(projectRoot);
		execFileSync("git", ["add", ".gitignore"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "expose .pi for test"], { cwd: projectRoot, stdio: "ignore" });
		fs.mkdirSync(path.join(projectRoot, ".pi"), { recursive: true });
		fs.writeFileSync(path.join(projectRoot, ".pi", "settings.json"), "{}\n", "utf-8");

		const result = checkGitClean({ projectRoot });
		assert.equal(result.ok, true);
		assert.match(result.message, /\.pi\/ session metadata ignored/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("checkGitClean still fails when non-.pi paths are dirty", async () => {
	const projectRoot = await initGitRepo("spine-seq-preflight-dirty-");
	try {
		exposePiDirectoryToGitStatus(projectRoot);
		execFileSync("git", ["add", ".gitignore"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "expose .pi for test"], { cwd: projectRoot, stdio: "ignore" });
		fs.mkdirSync(path.join(projectRoot, ".pi"), { recursive: true });
		fs.writeFileSync(path.join(projectRoot, ".pi", "settings.json"), "{}\n", "utf-8");
		fs.writeFileSync(path.join(projectRoot, "dirty.txt"), "x", "utf-8");

		const result = checkGitClean({ projectRoot });
		assert.equal(result.ok, false);
		assert.ok(result.details.dirtyPaths.includes("dirty.txt"));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("runSequence with only .pi/ dirty passes preflight", async () => {
	const projectRoot = await initGitRepo("spine-seq-preflight-only-pi-");
	const prevStub = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";

	try {
		writeSequenceFixture(projectRoot);
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "sequence fixture"], { cwd: projectRoot, stdio: "ignore" });

		fs.mkdirSync(path.join(projectRoot, ".pi"), { recursive: true });
		fs.writeFileSync(path.join(projectRoot, ".pi", "settings.json"), "{}\n", "utf-8");

		const config = loadSpineConfig(projectRoot);
		const tasksRoot = resolveTasksRoot(projectRoot, config);
		const plan = buildPlan({ scope: "pending", config, tasksRoot });

		const result = await runSequence({
			projectRoot,
			plan,
			attached: true,
			autoApproveGate: true,
			skipPreflight: false,
		});

		assert.equal(result.ok, true, result.output ?? result.error);
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		await destroyGitRepo(projectRoot);
	}
});

test("runSequence surfaces preflight failure on stderr-equivalent output", async () => {
	const projectRoot = await initGitRepo("spine-seq-preflight-msg-");
	try {
		writeSequenceFixture(projectRoot);
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "sequence fixture"], { cwd: projectRoot, stdio: "ignore" });

		fs.writeFileSync(path.join(projectRoot, "dirty.txt"), "x", "utf-8");

		const built = buildSequencePlan(projectRoot, "pending");
		assert.equal(built.ok, true);

		const result = await runSequence({
			projectRoot,
			plan: built.plan,
			attached: true,
			skipPreflight: false,
		});

		assert.equal(result.ok, false);
		assert.equal(result.error, "preflight_failed");
		assert.match(result.output ?? "", /git-clean/);
		assert.match(result.output ?? "", /git status/);
		assert.match(result.output ?? "", /Preflight failed/);

		const preflight = runBatchPreflight({ projectRoot, skipDoctor: true });
		const gitClean = preflight.checks.find((check) => check.id === "git-clean");
		assert.equal(gitClean?.ok, false);
		assert.match(gitClean?.message ?? "", /uncommitted change/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
