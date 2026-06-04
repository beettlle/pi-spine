import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { collectEvidenceBundle, evidenceDir } from "../../src/batch/evidence.mjs";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { reconcileBatch } from "../../src/batch/reconcile.mjs";
import {
	inspectLaneSalvage,
	recordTaskFailureSalvage,
} from "../../src/batch/salvage.mjs";
import { startBatch } from "../../src/batch/engine.mjs";
import { laneWorktreePath } from "../../src/batch/worktree.mjs";
import { minimalValidPromptMarkdown } from "../helpers/smoke-task-prompt.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

/**
 * @param {string} projectRoot
 */
function execCommit(projectRoot, message) {
	execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", message], { cwd: projectRoot, stdio: "ignore" });
}

/**
 * @param {string} projectRoot
 * @param {string} taskId
 * @param {string} fileScopePath
 */
function writeSmokeTask(projectRoot, taskId, fileScopePath) {
	const folder = path.join(projectRoot, "spine-tasks", `${taskId}-smoke`);
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		minimalValidPromptMarkdown(taskId, {
			fileScope: fileScopePath,
			mission: "Salvage inspect smoke.",
		}),
		"utf-8",
	);
}

test("inspectLaneSalvage scopes porcelain to file scope and task folder", () => {
	const worktree = fs.mkdtempSync(path.join(os.tmpdir(), "salvage-scope-"));
	const taskFolder = path.join(worktree, "spine-tasks", "TP-900-smoke");
	const scopeFile = path.join(worktree, "src", "scoped.txt");
	const outOfScope = path.join(worktree, "other.txt");

	fs.mkdirSync(path.dirname(scopeFile), { recursive: true });
	fs.mkdirSync(taskFolder, { recursive: true });
	fs.writeFileSync(scopeFile, "dirty\n", "utf-8");
	fs.writeFileSync(outOfScope, "ignore\n", "utf-8");
	fs.writeFileSync(path.join(taskFolder, "STATUS.md"), "wip\n", "utf-8");
	execFileSync("git", ["init"], { cwd: worktree, stdio: "ignore" });
	execFileSync("git", ["config", "user.email", "t@e.com"], { cwd: worktree, stdio: "ignore" });
	execFileSync("git", ["config", "user.name", "T"], { cwd: worktree, stdio: "ignore" });
	execFileSync("git", ["add", "-A"], { cwd: worktree, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", "init"], { cwd: worktree, stdio: "ignore" });
	fs.writeFileSync(scopeFile, "dirty changed\n", "utf-8");
	fs.writeFileSync(outOfScope, "also dirty\n", "utf-8");

	const inspection = inspectLaneSalvage({
		worktreePath: worktree,
		fileScopePaths: ["src/scoped.txt"],
		taskFolder,
	});
	assert.equal(inspection.changedFileCount, 1);
	assert.ok(inspection.dirtyPaths.includes("src/scoped.txt"));

	fs.writeFileSync(path.join(taskFolder, "STATUS.md"), "wip changed\n", "utf-8");
	const inspectionAfterStatus = inspectLaneSalvage({
		worktreePath: worktree,
		fileScopePaths: ["src/scoped.txt"],
		taskFolder,
	});

	assert.equal(inspectionAfterStatus.changedFileCount, 2);
	assert.ok(inspectionAfterStatus.dirtyPaths.includes("src/scoped.txt"));
	assert.ok(
		inspectionAfterStatus.dirtyPaths.some((p) => p.startsWith("spine-tasks/TP-900-smoke/")),
	);
	assert.equal(inspectionAfterStatus.salvageable, true);
	fs.rmSync(worktree, { recursive: true, force: true });
});

test("recordTaskFailureSalvage journals inspection and writes evidence without committing", async () => {
	const projectRoot = await initGitRepo("salvage-record-");
	const batchId = "testbatch001";
	const taskId = "TP-901";
	const fileScope = "src/salvage.txt";
	writeSmokeTask(projectRoot, taskId, fileScope);
	fs.mkdirSync(path.dirname(path.join(projectRoot, fileScope)), { recursive: true });
	fs.writeFileSync(path.join(projectRoot, fileScope), "base\n", "utf-8");
	execCommit(projectRoot, "task");

	const wt = laneWorktreePath(projectRoot, batchId, 1);
	fs.mkdirSync(path.dirname(wt), { recursive: true });
	execFileSync("git", ["worktree", "add", "-B", `task/spine-lane-1-${batchId}`, wt, "main"], {
		cwd: projectRoot,
		stdio: "ignore",
	});
	fs.writeFileSync(path.join(wt, fileScope), "uncommitted\n", "utf-8");

	const taskFolder = path.join(wt, "spine-tasks", `${taskId}-smoke`);
	fs.mkdirSync(taskFolder, { recursive: true });
	assert.equal(fs.existsSync(path.join(taskFolder, ".DONE")), false);

	const salvageFields = recordTaskFailureSalvage({
		projectRoot,
		batchId,
		laneNumber: 1,
		laneId: "lane-1",
		taskId,
		correlationId: "corr-1",
		worktreePath: wt,
		fileScopePaths: [fileScope],
		taskFolder,
		workerResult: { doneFound: false, classification: "stall_timeout" },
	});

	assert.equal(salvageFields.salvageable, true);
	assert.equal(salvageFields.changedFileCount, 1);

	const events = readJournalEvents(projectRoot, batchId);
	const salvageEvent = events.find((e) => e.type === "lane.salvage_inspection");
	assert.ok(salvageEvent);
	assert.equal(salvageEvent.payload.changedFileCount, 1);
	assert.match(String(salvageEvent.payload.retryCommand), /spine batch retry TP-901/);

	const evidencePath = path.join(evidenceDir(projectRoot, batchId), `salvage-${taskId}.json`);
	assert.ok(fs.existsSync(evidencePath));

	const headBefore = execFileSync("git", ["rev-parse", "HEAD"], {
		cwd: wt,
		encoding: "utf-8",
	}).trim();
	execFileSync("git", ["status", "--porcelain"], { cwd: wt, encoding: "utf-8" });
	const headAfter = execFileSync("git", ["rev-parse", "HEAD"], {
		cwd: wt,
		encoding: "utf-8",
	}).trim();
	assert.equal(headBefore, headAfter, "salvage must not create commits");
	assert.equal(fs.existsSync(path.join(taskFolder, ".DONE")), false);

	await destroyGitRepo(projectRoot);
});

test("startBatch worker failure with dirty scoped file emits salvage and diagnose hint", async () => {
	const projectRoot = await initGitRepo("salvage-stall-");
	const taskId = "TP-902";
	const fileScope = "src/stall-salvage.txt";
	writeSmokeTask(projectRoot, taskId, fileScope);
	fs.mkdirSync(path.dirname(path.join(projectRoot, fileScope)), { recursive: true });
	fs.writeFileSync(path.join(projectRoot, fileScope), "clean\n", "utf-8");
	fs.writeFileSync(
		path.join(projectRoot, "spine-tasks", "dependencies.json"),
		JSON.stringify({ version: 1, tasks: { [taskId]: [] } }),
		"utf-8",
	);
	execCommit(projectRoot, "task");

	const cfgPath = path.join(projectRoot, ".spine/spine-config.json");
	const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));

	const prevStub = process.env.SPINE_WORKER_STUB;
	const prevFail = process.env.SPINE_WORKER_STUB_FAIL_TASKS;
	const prevDirty = process.env.SPINE_WORKER_STUB_DIRTY_FILE;
	process.env.SPINE_WORKER_STUB = "1";
	process.env.SPINE_WORKER_STUB_FAIL_TASKS = taskId;
	process.env.SPINE_WORKER_STUB_DIRTY_FILE = fileScope;

	try {
		const result = await startBatch({ projectRoot, scope: taskId, skipPreflight: true });
		assert.equal(result.ok, false, result.output ?? "expected batch failure");

		const events = readJournalEvents(projectRoot, result.batchId);
		const types = events.map((e) => e.type);
		const salvageIdx = types.indexOf("lane.salvage_inspection");
		const failedIdx = types.indexOf("task.failed");
		assert.ok(salvageIdx >= 0, `missing salvage event: ${types.join(", ")}`);
		assert.ok(failedIdx > salvageIdx, "salvage_inspection must precede task.failed");

		const failed = events.find((e) => e.type === "task.failed");
		assert.equal(failed?.payload.classification, "failed");
		assert.equal(failed?.payload.salvageable, true);
		assert.ok(failed?.payload.changedFileCount >= 1);

		const diagnosis = reconcileBatch({ projectRoot, verbose: true });
		assert.equal(diagnosis.diagnosis, "needs_retry");
		assert.match(diagnosis.headline, /uncommitted file/i);
		assert.match(diagnosis.suggestedCommand, /spine batch retry TP-902/);

		const bundle = collectEvidenceBundle({
			projectRoot,
			batchId: result.batchId,
			batchState: null,
			config: cfg,
		});
		assert.ok(bundle.evidenceRefs.some((ref) => ref === `evidence/salvage-${taskId}.json`));
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		if (prevFail === undefined) delete process.env.SPINE_WORKER_STUB_FAIL_TASKS;
		else process.env.SPINE_WORKER_STUB_FAIL_TASKS = prevFail;
		if (prevDirty === undefined) delete process.env.SPINE_WORKER_STUB_DIRTY_FILE;
		else process.env.SPINE_WORKER_STUB_DIRTY_FILE = prevDirty;
		await destroyGitRepo(projectRoot);
	}
});
