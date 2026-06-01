import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
	collectProgressSignals,
	computeStallDeadline,
	progressSignalsChanged,
	resolveStallConfig,
} from "../../src/batch/heartbeat.mjs";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { startBatch } from "../../src/batch/engine.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

test("resolveStallConfig applies lane overrides", () => {
	const cfg = resolveStallConfig({
		lanes: {
			stallTimeoutMinutes: 30,
			stallGraceAfterProgressMinutes: 10,
			heartbeatIntervalMinutes: 5,
		},
	});
	assert.equal(cfg.stallTimeoutMs, 30 * 60 * 1000);
	assert.equal(cfg.graceAfterProgressMs, 10 * 60 * 1000);
	assert.equal(cfg.heartbeatIntervalMs, 5 * 60 * 1000);
});

test("progressSignalsChanged detects STATUS mtime updates", () => {
	const dir = fs.mkdtempSync(path.join(fs.realpathSync("."), "hb-"));
	const statusPath = path.join(dir, "STATUS.md");
	fs.writeFileSync(statusPath, "a", "utf-8");
	const first = collectProgressSignals({ worktreePath: dir, taskFolder: dir });
	assert.equal(progressSignalsChanged(null, first), true);
	fs.writeFileSync(statusPath, "ab", "utf-8");
	const second = collectProgressSignals({ worktreePath: dir, taskFolder: dir });
	assert.equal(progressSignalsChanged(first, second), true);
	fs.rmSync(dir, { recursive: true, force: true });
});

test("computeStallDeadline extends past hard timeout after progress", () => {
	const stallConfig = resolveStallConfig({
		lanes: { stallTimeoutMinutes: 1, stallGraceAfterProgressMinutes: 30 },
	});
	const startedAt = 0;
	const lastProgressAt = 30 * 60 * 1000;
	const deadline = computeStallDeadline({ startedAt, lastProgressAt, stallConfig });
	assert.equal(deadline, lastProgressAt + stallConfig.graceAfterProgressMs);
});

test("startBatch records lane.heartbeat during stub worker delay", async () => {
	const projectRoot = await initGitRepo("spine-heartbeat-");
	const prevStub = process.env.SPINE_WORKER_STUB;
	const prevDelay = process.env.SPINE_WORKER_STUB_DELAY_MS;
	process.env.SPINE_WORKER_STUB = "1";
	process.env.SPINE_WORKER_STUB_DELAY_MS = "2500";
	try {
		const cfgPath = path.join(projectRoot, ".spine/spine-config.json");
		const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
		cfg.lanes = {
			...cfg.lanes,
			heartbeatIntervalMinutes: 0.02,
			stallTimeoutMinutes: 10,
			stallGraceAfterProgressMinutes: 5,
		};
		fs.writeFileSync(cfgPath, `${JSON.stringify(cfg, null, 2)}\n`, "utf-8");

		const taskId = "TP-999";
		const folder = path.join(projectRoot, "taskplane-tasks", `${taskId}-smoke`);
		fs.mkdirSync(folder, { recursive: true });
		fs.writeFileSync(
			path.join(folder, "PROMPT.md"),
			`# Task: ${taskId} — Smoke\n\n## Mission\nSmoke.\n\n## Dependencies\n- **None**\n\n## File Scope\n- \`README.md\`\n\n## Steps\n### Step 0\n- [ ] one\n`,
			"utf-8",
		);
		fs.writeFileSync(
			path.join(projectRoot, "taskplane-tasks/dependencies.json"),
			JSON.stringify({ version: 1, tasks: { [taskId]: [] } }),
			"utf-8",
		);
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "init"], { cwd: projectRoot, stdio: "ignore" });

		const result = await startBatch({ projectRoot, scope: taskId, skipPreflight: true });
		assert.equal(result.ok, true, result.output ?? result.error);

		const events = readJournalEvents(projectRoot, result.batchId);
		const types = events.map((e) => e.type);
		assert.ok(types.includes("lane.heartbeat"), `journal types: ${types.join(", ")}`);
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		if (prevDelay === undefined) delete process.env.SPINE_WORKER_STUB_DELAY_MS;
		else process.env.SPINE_WORKER_STUB_DELAY_MS = prevDelay;
		await destroyGitRepo(projectRoot);
	}
});
