import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
	extractJournalDiagnosisHints,
	readJournalEvents,
} from "../../src/batch/journal.mjs";
import { reconcileBatch } from "../../src/batch/reconcile.mjs";
import { startBatch } from "../../src/batch/engine.mjs";
import { workerOutputLogPath } from "../../src/batch/worker-output.mjs";
import { laneWorktreePath } from "../../src/batch/worktree.mjs";
import { minimalValidPromptMarkdown } from "../helpers/smoke-task-prompt.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const TASK_ID = "SAT-020";
const FILE_SCOPE = "src/sat020-health.ts";

/** Test-only lane margins: coverage instrumentation slows polls; keep headroom (SP-263/SP-257). */
const SAT020_LANE_CONFIG = {
	checkpointWarningMinutes: 0.02,
	extendGraceOnFileScope: false,
	stallTimeoutMinutes: 1.0,
	stallGraceAfterProgressMinutes: 0.8,
	heartbeatIntervalMinutes: 60,
};

/** Stub wall-clock windows sized so checkpoint_warning precedes stall_killed under coverage load. */
const SAT020_STUB_POST_SCOPE_MS = "25000";
const SAT020_STUB_HANG_MS = "50000";

function writeSat020Task(projectRoot) {
	const folder = path.join(projectRoot, "spine-tasks", `${TASK_ID}-health-endpoint`);
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		minimalValidPromptMarkdown(TASK_ID, {
			title: "Health endpoint",
			fileScope: FILE_SCOPE,
			mission: "SAT-020 stall replay fixture.",
		}),
		"utf-8",
	);
	fs.writeFileSync(
		path.join(projectRoot, "spine-tasks", "dependencies.json"),
		JSON.stringify({ version: 1, tasks: { [TASK_ID]: [] } }),
		"utf-8",
	);
	fs.mkdirSync(path.dirname(path.join(projectRoot, FILE_SCOPE)), { recursive: true });
	fs.writeFileSync(path.join(projectRoot, FILE_SCOPE), "// baseline\n", "utf-8");
}

/**
 * @param {string[]} types
 * @param {string[]} expected
 */
function assertEventOrder(types, expected) {
	let cursor = 0;
	for (const eventType of expected) {
		const idx = types.indexOf(eventType, cursor);
		assert.ok(idx >= 0, `missing ${eventType} in journal: ${types.join(", ")}`);
		cursor = idx + 1;
	}
}

test("SAT-020 replay: checkpoint_warning → stall_killed → salvage_inspection → task.failed", async () => {
	const projectRoot = await initGitRepo("sat020-int-");
	writeSat020Task(projectRoot);
	execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", "sat020 fixture"], { cwd: projectRoot, stdio: "ignore" });

	const cfgPath = path.join(projectRoot, ".spine/spine-config.json");
	const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
	cfg.lanes = {
		...cfg.lanes,
		...SAT020_LANE_CONFIG,
	};
	fs.writeFileSync(cfgPath, `${JSON.stringify(cfg, null, 2)}\n`, "utf-8");

	const prevStub = process.env.SPINE_WORKER_STUB;
	const prevSat020 = process.env.SPINE_WORKER_STUB_SAT020;
	const prevScope = process.env.SPINE_WORKER_STUB_FILE_SCOPE;
	const prevOutput = process.env.SPINE_WORKER_STUB_OUTPUT;
	const prevHang = process.env.SPINE_WORKER_STUB_SAT020_HANG_MS;
	const prevPostScope = process.env.SPINE_WORKER_STUB_SAT020_POST_SCOPE_MS;
	process.env.SPINE_WORKER_STUB = "1";
	process.env.SPINE_WORKER_STUB_SAT020 = "1";
	process.env.SPINE_WORKER_STUB_FILE_SCOPE = FILE_SCOPE;
	process.env.SPINE_WORKER_STUB_OUTPUT = "SAT-020 hung after file-scope touch";
	process.env.SPINE_WORKER_STUB_SAT020_POST_SCOPE_MS = SAT020_STUB_POST_SCOPE_MS;
	process.env.SPINE_WORKER_STUB_SAT020_HANG_MS = SAT020_STUB_HANG_MS;

	try {
		const result = await startBatch({ projectRoot, scope: TASK_ID, skipPreflight: true });
		assert.equal(result.ok, false, result.output ?? "expected stall failure");

		const events = readJournalEvents(projectRoot, result.batchId);
		const types = events.map((e) => e.type);

		assert.ok(types.filter((t) => t === "task.step_completed").length >= 2);
		assertEventOrder(types, [
			"lane.checkpoint_warning",
			"lane.stall_killed",
			"lane.salvage_inspection",
			"task.failed",
		]);

		const failed = events.find((e) => e.type === "task.failed");
		assert.equal(failed?.payload?.classification, "stall_timeout");
		assert.match(String(failed?.payload?.output ?? ""), /SAT-020 hung/);
		assert.ok(failed?.payload?.changedFileCount >= 1, "salvage count on task.failed");

		const logPath = workerOutputLogPath(projectRoot, result.batchId, 1, TASK_ID);
		assert.ok(fs.existsSync(logPath), "worker output log on disk");

		const hints = extractJournalDiagnosisHints(events);
		const stallHint = hints.find((h) => h.type === "lane.stall_killed");
		assert.ok(stallHint, "diagnose should cite stall_killed");
		assert.match(stallHint.summary, /worker-output-SAT-020\.log/);

		const salvageHint = hints.find((h) => h.type === "lane.salvage_inspection");
		assert.ok(salvageHint, "diagnose should cite salvage_inspection");
		assert.match(salvageHint.summary, /scoped file/i);

		const diagnosis = reconcileBatch({ projectRoot, verbose: true });
		assert.equal(diagnosis.diagnosis, "needs_retry");
		assert.match(diagnosis.headline, /uncommitted file/i);
		assert.match(diagnosis.suggestedCommand, /spine batch retry SAT-020/);
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		if (prevSat020 === undefined) delete process.env.SPINE_WORKER_STUB_SAT020;
		else process.env.SPINE_WORKER_STUB_SAT020 = prevSat020;
		if (prevScope === undefined) delete process.env.SPINE_WORKER_STUB_FILE_SCOPE;
		else process.env.SPINE_WORKER_STUB_FILE_SCOPE = prevScope;
		if (prevOutput === undefined) delete process.env.SPINE_WORKER_STUB_OUTPUT;
		else process.env.SPINE_WORKER_STUB_OUTPUT = prevOutput;
		if (prevHang === undefined) delete process.env.SPINE_WORKER_STUB_SAT020_HANG_MS;
		else process.env.SPINE_WORKER_STUB_SAT020_HANG_MS = prevHang;
		if (prevPostScope === undefined) delete process.env.SPINE_WORKER_STUB_SAT020_POST_SCOPE_MS;
		else process.env.SPINE_WORKER_STUB_SAT020_POST_SCOPE_MS = prevPostScope;
		await destroyGitRepo(projectRoot);
	}
});

test("regression: stub worker still requires .DONE for batch success", async () => {
	const projectRoot = await initGitRepo("sat020-done-");
	const taskId = "TP-999";
	const folder = path.join(projectRoot, "spine-tasks", `${taskId}-smoke`);
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		minimalValidPromptMarkdown(taskId, { fileScope: "README.md", mission: "Smoke." }),
		"utf-8",
	);
	fs.writeFileSync(
		path.join(projectRoot, "spine-tasks", "dependencies.json"),
		JSON.stringify({ version: 1, tasks: { [taskId]: [], [TASK_ID]: [] } }),
		"utf-8",
	);
	execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", "init"], { cwd: projectRoot, stdio: "ignore" });

	const prevStub = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	try {
		const result = await startBatch({ projectRoot, scope: taskId, skipPreflight: true });
		assert.equal(result.ok, true, result.output ?? result.error);
		const wt = laneWorktreePath(projectRoot, result.batchId, 1);
		assert.ok(
			fs.existsSync(path.join(wt, "spine-tasks", `${taskId}-smoke`, ".DONE")),
			".DONE still required",
		);
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		await destroyGitRepo(projectRoot);
	}
});
