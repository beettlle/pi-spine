import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import {
	buildCommitBoundaryHint,
	buildDoneCheckpointHint,
	buildReviewLevelHint,
	buildWorkerTailPrompt,
	taskIdFromFolder,
	WORKER_TOOLS_HINT,
} from "../../src/batch/worker-prompt.mjs";

test("buildReviewLevelHint delegates code and final review to engine", () => {
	const hint = buildReviewLevelHint(2);
	assert.match(hint, /plan review only/i);
	assert.match(hint, /type plan/i);
	assert.match(hint, /batch engine runs those after \.DONE/i);
	assert.match(hint, /exit immediately/i);
	assert.doesNotMatch(hint, /type=code|--type code/i);
	assert.equal(buildReviewLevelHint(0), "");
	const level1 = buildReviewLevelHint(1);
	assert.match(level1, /final review after \.DONE/i);
});

test("buildCommitBoundaryHint uses SP-064 feat(taskId) convention", () => {
	const hint = buildCommitBoundaryHint("SP-067");
	assert.match(hint, /feat\(SP-067\): complete Step N/);
});

test("buildDoneCheckpointHint references done path and uncommitted failure", () => {
	const donePath = "/tmp/task/.DONE";
	const hint = buildDoneCheckpointHint(donePath);
	assert.match(hint, new RegExp(donePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
	assert.match(hint, /uncommitted changes without \.DONE fail/);
});

test("buildWorkerTailPrompt includes tools hint and task id from folder", async () => {
	const taskFolder = path.join(os.tmpdir(), "spine-tasks", "TP-100-smoke");
	const prompt = await buildWorkerTailPrompt({
		worktreePath: "/wt",
		taskFolder,
		donePath: path.join(taskFolder, ".DONE"),
		reviewLevel: 1,
		includePromptInclude: false,
	});
	assert.ok(prompt.includes(WORKER_TOOLS_HINT));
	assert.match(prompt, /feat\(TP-100\): complete Step N/);
	assert.match(prompt, /spine review step/i);
	assert.equal(taskIdFromFolder(taskFolder), "TP-100");
});

test("buildWorkerTailPrompt appends worker agent and PROMPT when present", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-worker-prompt-"));
	try {
		const worktreePath = path.join(root, "wt");
		const taskFolder = path.join(root, "spine-tasks", "SP-067-runner-hint-dedup");
		const agentPath = path.join(worktreePath, ".spine", "agents", "worker.md");
		const promptPath = path.join(taskFolder, "PROMPT.md");
		fs.mkdirSync(path.dirname(agentPath), { recursive: true });
		fs.mkdirSync(taskFolder, { recursive: true });
		fs.writeFileSync(agentPath, "# worker\n", "utf-8");
		fs.writeFileSync(promptPath, "# Task\n", "utf-8");

		const tail = await buildWorkerTailPrompt({
			worktreePath,
			taskFolder,
			donePath: path.join(taskFolder, ".DONE"),
			reviewLevel: 0,
			includePromptInclude: true,
		});

		assert.match(tail, new RegExp(`@${agentPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
		assert.match(tail, new RegExp(`@${promptPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
