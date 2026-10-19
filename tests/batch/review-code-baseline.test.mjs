/**
 * SP-840 — engine code review diffs against the task start commit (GitHub #343).
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runCodeReviewPhase } from "../../src/batch/engine-lanes/review.mjs";
import { appendJournalEvent, readJournalEvents } from "../../src/batch/journal.mjs";
import { resolveCodeReviewScopePaths } from "../../src/batch/review-scope.mjs";
import { createInitialBatchState, saveSpineBatchState } from "../../src/batch/state.mjs";
import { laneTaskBranch, laneWorktreePath, provisionLaneWorktree } from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const TASK_ID = "SP-840";
const BATCH_ID = "20261017T120000";
const SCOPE_FILE = "src/review-baseline-fixture.txt";

/**
 * @param {string} cwd
 * @param {string} message
 */
function execCommit(cwd, message) {
	execFileSync("git", ["add", "-A"], { cwd, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", message], { cwd, stdio: "ignore" });
}

/**
 * @param {string} cwd
 */
function headSha(cwd) {
	return execFileSync("git", ["rev-parse", "HEAD"], { cwd, encoding: "utf-8" }).trim();
}

/**
 * Fake `pi` that records the review prompt (last argv) and writes an APPROVE artifact.
 *
 * @param {string} binDir
 * @param {string} recordPath
 */
function writeFakePi(binDir, recordPath) {
	fs.mkdirSync(binDir, { recursive: true });
	const script = `#!/bin/sh
for last; do :; done
printf '%s' "$last" > "${recordPath}"
out=$(printf '%s' "$last" | sed -n 's/.*Write your review to: \`\\(.*\\)\`.*/\\1/p' | head -1)
mkdir -p "$(dirname "$out")"
cat > "$out" <<'REVIEW'
## Code Review

### Verdict: APPROVE

### Summary
Fake reviewer approve.

\`\`\`json
{"verdict":"APPROVE","feedback":"ok"}
\`\`\`
REVIEW
`;
	const piPath = path.join(binDir, "pi");
	fs.writeFileSync(piPath, script, { mode: 0o755 });
}

/**
 * Provision a lane with committed step work and a clean tree.
 *
 * @param {string} projectRoot
 * @param {string} startCommitPayload value journaled as task.started `taskStartCommit`
 */
function provisionCommittedLane(projectRoot, startCommitPayload) {
	const taskFolderRel = `spine-tasks/${TASK_ID}-baseline`;
	const taskFolder = path.join(projectRoot, taskFolderRel);
	fs.mkdirSync(taskFolder, { recursive: true });
	fs.writeFileSync(
		path.join(taskFolder, "PROMPT.md"),
		`# Task: ${TASK_ID}

## Review Level: 2 (Plan + Code)

## Mission
Code review baseline fixture (#343).

## File Scope
- \`${SCOPE_FILE}\`

## Steps
### Step 2: Code review checkpoint
> **Code review checkpoint**
- [ ] verify
`,
		"utf-8",
	);
	execCommit(projectRoot, "baseline fixture");

	const orchBranch = `orch/spine-${BATCH_ID}`;
	execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
	const wt = laneWorktreePath(projectRoot, BATCH_ID, 1);
	provisionLaneWorktree({ projectRoot, batchId: BATCH_ID, laneNumber: 1, orchBranch });
	const startSha = headSha(wt);

	// Worker commits per step: the tree is clean when the engine review runs.
	fs.mkdirSync(path.dirname(path.join(wt, SCOPE_FILE)), { recursive: true });
	fs.writeFileSync(path.join(wt, SCOPE_FILE), "committed step work\n", "utf-8");
	execCommit(wt, "worker step commit");
	assert.equal(execFileSync("git", ["status", "--porcelain"], { cwd: wt, encoding: "utf-8" }), "");

	appendJournalEvent(projectRoot, BATCH_ID, "task.started", {
		taskId: TASK_ID,
		laneNumber: 1,
		laneId: "lane-1",
		taskStartCommit: startCommitPayload === "<start>" ? startSha : startCommitPayload,
	});

	const state = createInitialBatchState({
		batchId: BATCH_ID,
		baseBranch: "main",
		orchBranch,
		wavePlan: [[TASK_ID]],
		tasks: [
			{
				taskId: TASK_ID,
				laneNumber: 1,
				status: "running",
				taskFolder: taskFolderRel,
				startedAt: Date.now() - 60_000,
				endedAt: null,
				doneFileFound: true,
				exitReason: null,
				codeReviewAttempts: 0,
			},
		],
		lanes: [
			{
				laneNumber: 1,
				laneId: "lane-1",
				worktreePath: wt,
				branch: laneTaskBranch(BATCH_ID, 1),
				taskIds: [TASK_ID],
				lastHeartbeatAt: Date.now(),
			},
		],
	});
	state.phase = "running";
	saveSpineBatchState(projectRoot, state);

	return {
		state,
		lane: state.lanes[0],
		task: state.tasks[0],
		wt,
		startSha,
		taskFolderInWorktree: path.join(wt, taskFolderRel),
	};
}

/**
 * @param {string} startCommitPayload
 * @param {(ctx: { projectRoot: string, prompt: string, result: any, fixture: ReturnType<typeof provisionCommittedLane> }) => void} assertions
 */
async function withRealReviewPath(startCommitPayload, assertions) {
	const projectRoot = await initGitRepo("spine-review-baseline-");
	const binDir = fs.mkdtempSync(path.join(os.tmpdir(), "spine-fake-pi-"));
	const recordPath = path.join(binDir, "prompt.txt");
	const saved = {
		PATH: process.env.PATH,
		SPINE_WORKER_STUB: process.env.SPINE_WORKER_STUB,
		SPINE_REVIEW_STUB: process.env.SPINE_REVIEW_STUB,
		SPINE_WORKER_RUNNER: process.env.SPINE_WORKER_RUNNER,
		SPINE_TASK_FOLDER: process.env.SPINE_TASK_FOLDER,
		SPINE_REVIEW_TEST_NO_PI: process.env.SPINE_REVIEW_TEST_NO_PI,
	};
	try {
		delete process.env.SPINE_WORKER_STUB;
		delete process.env.SPINE_REVIEW_STUB;
		delete process.env.SPINE_WORKER_RUNNER;
		delete process.env.SPINE_TASK_FOLDER;
		delete process.env.SPINE_REVIEW_TEST_NO_PI;
		writeFakePi(binDir, recordPath);
		process.env.PATH = `${binDir}${path.delimiter}${saved.PATH}`;

		const fixture = provisionCommittedLane(projectRoot, startCommitPayload);
		const result = await runCodeReviewPhase({
			projectRoot,
			state: fixture.state,
			batchId: BATCH_ID,
			config: { review: { maxFinalAttempts: 1 } },
			task: fixture.task,
			lane: fixture.lane,
			taskFolderInWorktree: fixture.taskFolderInWorktree,
			wt: fixture.wt,
			taskBranch: fixture.lane.branch,
			laneCorrelationId: "corr-sp840",
			fileScopePaths: [SCOPE_FILE],
		});
		const prompt = fs.existsSync(recordPath) ? fs.readFileSync(recordPath, "utf-8") : "";
		assertions({ projectRoot, prompt, result, fixture });
	} finally {
		for (const [key, value] of Object.entries(saved)) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
		fs.rmSync(binDir, { recursive: true, force: true });
		await destroyGitRepo(projectRoot);
	}
}

test("code review of committed step work on a clean tree diffs against the task start commit", async () => {
	await withRealReviewPath("<start>", ({ projectRoot, prompt, result, fixture }) => {
		assert.equal(result.ok, true);
		assert.ok(prompt.includes(`git diff ${fixture.startSha}..HEAD`), prompt);
		assert.ok(prompt.includes(`git diff ${fixture.startSha}..HEAD --name-only`), prompt);
		assert.ok(prompt.includes(`**Baseline commit:** ${fixture.startSha}`), prompt);

		assert.deepEqual(resolveCodeReviewScopePaths(fixture.wt, fixture.startSha), [SCOPE_FILE]);
		assert.deepEqual(resolveCodeReviewScopePaths(fixture.wt), [], "no baseline sees nothing");

		const events = readJournalEvents(projectRoot, BATCH_ID);
		assert.equal(events.some((event) => event.type === "review.baseline_missing"), false);
	});
});

test("option-like task start commit is rejected and journals review.baseline_missing", async () => {
	await withRealReviewPath("--evil", ({ projectRoot, prompt, result }) => {
		assert.equal(result.ok, true);
		assert.ok(prompt.length > 0, "reviewer was spawned");
		assert.equal(prompt.includes("--evil"), false, prompt);
		assert.ok(prompt.includes("`git diff --name-only`"), "falls back to working-tree diff");

		const missing = readJournalEvents(projectRoot, BATCH_ID).filter(
			(event) => event.type === "review.baseline_missing",
		);
		assert.equal(missing.length, 1);
		assert.equal(missing[0].payload?.taskId ?? missing[0].taskId, TASK_ID);
		assert.equal(missing[0].payload?.reviewType, "code");
	});
});

test("non-hex task start commit is rejected and journals review.baseline_missing", async () => {
	await withRealReviewPath("not-a-sha;rm", ({ projectRoot, prompt }) => {
		assert.equal(prompt.includes("not-a-sha"), false, prompt);
		assert.equal(
			readJournalEvents(projectRoot, BATCH_ID).some(
				(event) => event.type === "review.baseline_missing",
			),
			true,
		);
	});
});
