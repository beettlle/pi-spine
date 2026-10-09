/**
 * SP-813 / GitHub #328 — the engine must never honor a journaled review
 * verdict it cannot trust (foreign stub verdicts, artifacts outside the task
 * folder), and contract verification must run before a final-review honor.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { appendJournalEvent, readJournalEvents } from "../../src/batch/journal.mjs";
import { runFinalReviewPhase, runPlanReviewPhase } from "../../src/batch/engine-lanes/review.mjs";
import {
	findCompletedCodeReview,
	findCompletedFinalReview,
} from "../../src/batch/review.mjs";
import { isHonorableReviewEvent } from "../../src/batch/review-artifacts.mjs";
import {
	createInitialBatchState,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";
import { laneTaskBranch, laneWorktreePath, provisionLaneWorktree } from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const STUB_ENV_KEYS = ["SPINE_WORKER_STUB", "SPINE_REVIEW_STUB"];

function snapshotStubEnv() {
	return Object.fromEntries(STUB_ENV_KEYS.map((key) => [key, process.env[key]]));
}

function restoreStubEnv(prev) {
	for (const key of STUB_ENV_KEYS) {
		if (prev[key] === undefined) delete process.env[key];
		else process.env[key] = prev[key];
	}
}

/** Force live-batch mode (no engine review stubs) for the test's duration. */
function enterLiveMode() {
	const prev = snapshotStubEnv();
	delete process.env.SPINE_WORKER_STUB;
	delete process.env.SPINE_REVIEW_STUB;
	return prev;
}

function execCommit(cwd, message) {
	execFileSync("git", ["add", "-A"], { cwd, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", message], { cwd, stdio: "ignore" });
}

/**
 * @param {string} projectRoot
 * @param {object} options
 */
function writeGuardTask(
	projectRoot,
	{
		taskId,
		suffix,
		reviewLevel = 1,
		reviewHeadingExtra = "",
		contract = true,
	},
) {
	const folder = path.join(projectRoot, "spine-tasks", `${taskId}-${suffix}`);
	fs.mkdirSync(folder, { recursive: true });
	const contractSection = contract
		? `\n## Contract\n\n| Field | Value |\n|-------|-------|\n| testCommand | \`true\` |\n`
		: "";
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		`# Task: ${taskId} — Honor guard test

## Review Level: ${reviewLevel} (${reviewHeadingExtra || "Plan"})

## Mission
Honor only trustworthy review verdicts.

## Dependencies
- **None**

## File Scope
- \`src/${taskId}-guard.txt\`
${contractSection}
## Steps
### Step 1: Work
${reviewHeadingExtra === "Plan and Code" ? "> **Plan-review checkpoint**\n" : ""}- [ ] work

### Step 2: Testing & Verification
- [ ] run tests

## Completion Criteria
- [ ] done

## Do NOT
- touch unrelated files
`,
		"utf-8",
	);
	return { folder, taskFolderRel: `spine-tasks/${taskId}-${suffix}` };
}

/**
 * @param {string} projectRoot
 * @param {object} params
 */
async function provisionGuardLane(projectRoot, { batchId, taskId, taskFolderRel }) {
	const orchBranch = `orch/spine-${batchId}`;
	execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
	const wt = laneWorktreePath(projectRoot, batchId, 1);
	provisionLaneWorktree({ projectRoot, batchId, laneNumber: 1, orchBranch });

	const state = createInitialBatchState({
		batchId,
		baseBranch: "main",
		orchBranch,
		wavePlan: [[taskId]],
		tasks: [
			{
				taskId,
				laneNumber: 1,
				status: "running",
				taskFolder: taskFolderRel,
				startedAt: Date.now() - 60_000,
				endedAt: null,
				doneFileFound: true,
				exitReason: null,
				finalAttempts: 0,
				planReviewAttempts: 0,
			},
		],
		lanes: [
			{
				laneNumber: 1,
				laneId: "lane-1",
				worktreePath: wt,
				branch: laneTaskBranch(batchId, 1),
				taskIds: [taskId],
				lastHeartbeatAt: Date.now(),
			},
		],
	});
	state.phase = "running";
	saveSpineBatchState(projectRoot, state);
	return {
		state,
		wt,
		lane: state.lanes[0],
		task: state.tasks[0],
		taskFolderInWorktree: path.join(wt, taskFolderRel),
	};
}

/** Foreign temp tree mimicking the #328 leaked fixture (/tmp-adjacent, outside any lane worktree). */
function makeForeignArtifactDir(taskId = "TP-777-review") {
	const foreignRoot = fs.mkdtempSync(path.join(os.tmpdir(), "spine-review-final-cli-"));
	const foreignReviews = path.join(foreignRoot, "spine-tasks", taskId, ".reviews");
	fs.mkdirSync(foreignReviews, { recursive: true });
	const foreignArtifact = path.join(foreignReviews, "final-20260928T153225.md");
	fs.writeFileSync(foreignArtifact, "### Verdict: PASS\n", "utf-8");
	return { foreignRoot, foreignArtifact };
}

function writeFinalPassArtifact(taskFolder) {
	const reviewsDir = path.join(taskFolder, ".reviews");
	fs.mkdirSync(reviewsDir, { recursive: true });
	const artifactPath = path.join(reviewsDir, "final-20261009T010101.md");
	fs.writeFileSync(
		artifactPath,
		"### Verdict: PASS\n```json\n{\"verdict\":\"PASS\",\"feedback\":\"lane artifact pass\"}\n```\n",
		"utf-8",
	);
	return artifactPath;
}

function writePlanApproveArtifact(taskFolder, stepNumber) {
	const reviewsDir = path.join(taskFolder, ".reviews");
	fs.mkdirSync(reviewsDir, { recursive: true });
	const artifactPath = path.join(reviewsDir, `${stepNumber}-20261009T010101.md`);
	fs.writeFileSync(
		artifactPath,
		"### Verdict: APPROVE\n```json\n{\"verdict\":\"APPROVE\",\"feedback\":\"lane plan approve\"}\n```\n",
		"utf-8",
	);
	return artifactPath;
}

test("isHonorableReviewEvent rejects stub verdict in live batch and foreign absolute artifacts", () => {
	const prev = enterLiveMode();
	const root = fs.mkdtempSync(path.join(import.meta.dirname, "guard-predicate-"));
	const taskFolder = path.join(root, "spine-tasks", "TP-guard");
	const inFolderArtifact = path.join(taskFolder, ".reviews", "final-1.md");
	try {
		const { foreignArtifact } = makeForeignArtifactDir();

		const stubEvent = {
			type: "review.completed",
			taskId: "TP-guard",
			payload: { reviewType: "final", verdict: "PASS", artifactPath: foreignArtifact, stub: true },
		};
		assert.deepEqual(isHonorableReviewEvent(stubEvent, { taskFolder }), {
			ok: false,
			reason: "stub_verdict_in_live_batch",
		});

		const foreignNoStub = {
			type: "review.completed",
			taskId: "TP-guard",
			payload: { reviewType: "final", verdict: "PASS", artifactPath: foreignArtifact },
		};
		assert.deepEqual(isHonorableReviewEvent(foreignNoStub, { taskFolder }), {
			ok: false,
			reason: "artifact_outside_task_folder",
		});

		// Absolute artifact inside the task folder stays honorable.
		const inFolderEvent = {
			type: "review.completed",
			taskId: "TP-guard",
			payload: { reviewType: "final", verdict: "PASS", artifactPath: inFolderArtifact },
		};
		assert.deepEqual(isHonorableReviewEvent(inFolderEvent, { taskFolder }), { ok: true });

		// Legit spawn-timeout honor journals stub+honored in real batches.
		const honoredStubEvent = {
			type: "review.completed",
			taskId: "TP-guard",
			payload: {
				reviewType: "final",
				verdict: "PASS",
				artifactPath: inFolderArtifact,
				stub: true,
				honored: true,
				honorReason: "spawn_timeout_with_done",
			},
		};
		assert.deepEqual(isHonorableReviewEvent(honoredStubEvent, { taskFolder }), { ok: true });

		// Relative worker-journal paths resolve against the worktree and honor.
		const relativeEvent = {
			type: "review.completed",
			taskId: "TP-guard",
			payload: {
				reviewType: "final",
				verdict: "PASS",
				artifactPath: "spine-tasks/TP-guard/.reviews/final-1.md",
			},
		};
		assert.deepEqual(
			isHonorableReviewEvent(relativeEvent, { taskFolder, worktreePath: root }),
			{ ok: true },
		);

		// Stub mode keeps stub verdicts honorable (engine computes and passes it);
		// the foreign-path rule still applies, so use an in-folder artifact here.
		assert.deepEqual(
			isHonorableReviewEvent(
				{
					type: "review.completed",
					taskId: "TP-guard",
					payload: { reviewType: "final", verdict: "PASS", artifactPath: inFolderArtifact, stub: true },
				},
				{ taskFolder, stubMode: true },
			),
			{ ok: true },
		);
		assert.deepEqual(
			isHonorableReviewEvent(stubEvent, { taskFolder, stubMode: true }),
			{ ok: false, reason: "artifact_outside_task_folder" },
		);
	} finally {
		restoreStubEnv(prev);
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test("findCompletedFinalReview skips untrusted journal events in live mode", () => {
	const prev = enterLiveMode();
	const root = fs.mkdtempSync(path.join(import.meta.dirname, "guard-final-finder-"));
	const taskFolder = path.join(root, "spine-tasks", "TP-guard-final");
	fs.mkdirSync(taskFolder, { recursive: true });
	try {
		const { foreignArtifact } = makeForeignArtifactDir();
		const rejected = [];
		const events = [
			{
				type: "review.completed",
				taskId: "TP-guard-final",
				payload: {
					reviewType: "final",
					verdict: "PASS",
					feedback: "foreign stub leaked",
					artifactPath: foreignArtifact,
					stub: true,
				},
			},
		];
		const honored = findCompletedFinalReview({
			taskFolder,
			journalEvents: events,
			taskId: "TP-guard-final",
			onReject: (event, reason) => rejected.push({ event, reason }),
		});
		assert.equal(honored, null);
		assert.equal(rejected.length, 1);
		assert.equal(rejected[0].reason, "stub_verdict_in_live_batch");
	} finally {
		restoreStubEnv(prev);
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test("findCompletedFinalReview honors spawn-timeout honored stub event in live mode", () => {
	const prev = enterLiveMode();
	const root = fs.mkdtempSync(path.join(import.meta.dirname, "guard-honored-stub-"));
	const taskFolder = path.join(root, "spine-tasks", "TP-guard-honored");
	fs.mkdirSync(taskFolder, { recursive: true });
	try {
		const artifactPath = writeFinalPassArtifact(taskFolder);
		const honored = findCompletedFinalReview({
			taskFolder,
			journalEvents: [
				{
					type: "review.completed",
					taskId: "TP-guard-honored",
					payload: {
						reviewType: "final",
						verdict: "PASS",
						feedback: "spawn timeout honored",
						artifactPath,
						stub: true,
						honored: true,
						honorReason: "spawn_timeout_with_done",
					},
				},
			],
			taskId: "TP-guard-honored",
		});
		assert.equal(honored?.verdict, "PASS");
		assert.equal(honored?.source, "journal");
	} finally {
		restoreStubEnv(prev);
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test("findCompletedFinalReview honors stub verdicts when batch runs in stub mode", () => {
	const root = fs.mkdtempSync(path.join(import.meta.dirname, "guard-stub-mode-"));
	const taskFolder = path.join(root, "spine-tasks", "TP-guard-stub");
	fs.mkdirSync(taskFolder, { recursive: true });
	try {
		const artifactPath = writeFinalPassArtifact(taskFolder);
		const stubEvent = {
			type: "review.completed",
			taskId: "TP-guard-stub",
			payload: { reviewType: "final", verdict: "PASS", artifactPath, stub: true },
		};
		// Explicit stubMode (engine passes it) and env-derived default both honor.
		const viaParam = findCompletedFinalReview({
			taskFolder,
			journalEvents: [stubEvent],
			taskId: "TP-guard-stub",
			stubMode: true,
		});
		assert.equal(viaParam?.verdict, "PASS");
		assert.equal(viaParam?.source, "journal");

		const prev = snapshotStubEnv();
		process.env.SPINE_WORKER_STUB = "1";
		try {
			const viaEnv = findCompletedFinalReview({
				taskFolder,
				journalEvents: [stubEvent],
				taskId: "TP-guard-stub",
			});
			assert.equal(viaEnv?.verdict, "PASS");
		} finally {
			restoreStubEnv(prev);
		}
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test("findCompletedCodeReview applies the same honor guard", () => {
	const prev = enterLiveMode();
	const root = fs.mkdtempSync(path.join(import.meta.dirname, "guard-code-finder-"));
	const taskFolder = path.join(root, "spine-tasks", "TP-guard-code");
	fs.mkdirSync(taskFolder, { recursive: true });
	try {
		const { foreignArtifact } = makeForeignArtifactDir("TP-888-review");
		const events = [
			{
				type: "review.completed",
				taskId: "TP-guard-code",
				payload: {
					reviewType: "code",
					verdict: "APPROVE",
					feedback: "foreign stub code verdict",
					artifactPath: foreignArtifact,
					stub: true,
				},
			},
		];
		const rejected = [];
		const honored = findCompletedCodeReview({
			taskFolder,
			journalEvents: events,
			taskId: "TP-guard-code",
			onReject: (event, reason) => rejected.push({ event, reason }),
		});
		assert.equal(honored, null);
		assert.equal(rejected.length, 1);
		assert.equal(rejected[0].reason, "stub_verdict_in_live_batch");

		// A trustworthy later event still honors after an untrusted one is skipped.
		const inFolderArtifact = path.join(taskFolder, ".reviews", "2-20261009T010102.md");
		fs.mkdirSync(path.join(taskFolder, ".reviews"), { recursive: true });
		fs.writeFileSync(
			inFolderArtifact,
			"### Verdict: APPROVE\n```json\n{\"verdict\":\"APPROVE\",\"feedback\":\"worker code approve\"}\n```\n",
			"utf-8",
		);
		const trusted = findCompletedCodeReview({
			taskFolder,
			journalEvents: [
				...events,
				{
					type: "review.completed",
					taskId: "TP-guard-code",
					payload: {
						reviewType: "code",
						verdict: "APPROVE",
						feedback: "worker code approve",
						artifactPath: inFolderArtifact,
					},
				},
			],
			taskId: "TP-guard-code",
		});
		assert.equal(trusted?.verdict, "APPROVE");
		assert.equal(trusted?.source, "journal");
	} finally {
		restoreStubEnv(prev);
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test("runFinalReviewPhase rejects foreign stub verdict, journals honor_rejected once, verifies contract before honor (#328)", async () => {
	const projectRoot = await initGitRepo("spine-honor-guard-final-");
	const prev = enterLiveMode();
	const { foreignRoot, foreignArtifact } = makeForeignArtifactDir();
	try {
		const batchId = "20261009T010101";
		const taskId = "TP-328";
		writeGuardTask(projectRoot, { taskId, suffix: "honor-guard", reviewLevel: 1 });
		execCommit(projectRoot, "honor guard fixture");

		const { state, lane, task, wt, taskFolderInWorktree } = await provisionGuardLane(projectRoot, {
			batchId,
			taskId,
			taskFolderRel: `spine-tasks/${taskId}-honor-guard`,
		});

		writeFinalPassArtifact(taskFolderInWorktree);

		// The #328 leak: a worker's contract test wrote a stub final PASS under
		// the real task and lane IDs with an artifact in a foreign temp tree.
		appendJournalEvent(projectRoot, batchId, "review.completed", {
			taskId,
			laneNumber: 1,
			laneId: "lane-1",
			correlationId: "corr-foreign-leak",
			reviewType: "final",
			reviewLevel: 2,
			stepNumber: 1,
			verdict: "PASS",
			feedback: "Stub reviewer passed final verdict.",
			artifactPath: foreignArtifact,
			stub: true,
		});

		const runPhase = () =>
			runFinalReviewPhase({
				projectRoot,
				state,
				batchId,
				config: {},
				task,
				lane,
				taskFolderInWorktree,
				wt,
				taskBranch: lane.branch,
				laneCorrelationId: "corr-honor-guard",
				fileScopePaths: [`src/${taskId}-guard.txt`],
				baseBranch: "main",
			});

		const result = await runPhase();
		assert.equal(result.ok, true, JSON.stringify(result));
		assert.equal(result.honored, true);

		const events = readJournalEvents(projectRoot, batchId);
		const verdictEvent = events.find(
			(event) =>
				event.type === "task.verdict_recorded" &&
				event.taskId === taskId &&
				event.payload?.reviewType === "final" &&
				event.payload?.honored === true,
		);
		assert.ok(verdictEvent, "honored final verdict must be journaled");
		assert.equal(verdictEvent.payload?.honorSource, "artifact");

		const rejectedEvents = events.filter((event) => event.type === "review.honor_rejected");
		assert.equal(rejectedEvents.length, 1);
		assert.equal(rejectedEvents[0].taskId, taskId);
		assert.equal(rejectedEvents[0].payload?.reviewType, "final");
		assert.equal(rejectedEvents[0].payload?.reason, "stub_verdict_in_live_batch");
		assert.equal(rejectedEvents[0].payload?.artifactPath, foreignArtifact);

		const contractIndex = events.findIndex(
			(event) => event.type === "contract.verified" && event.taskId === taskId,
		);
		assert.ok(contractIndex >= 0, "contract.verified must be journaled");
		assert.equal(events[contractIndex].payload?.ok, true);
		const verdictIndex = events.findIndex(
			(event) =>
				event.type === "task.verdict_recorded" &&
				event.taskId === taskId &&
				event.payload?.reviewType === "final" &&
				event.payload?.honored === true,
		);
		assert.ok(verdictIndex > contractIndex, "contract.verified must precede the honored verdict");
		assert.ok(
			events.findIndex((event) => event.type === "review.honor_rejected") < verdictIndex,
			"rejection must precede the honored verdict",
		);

		// Re-entry (retry/resume rescan) must not journal another rejection.
		const second = await runPhase();
		assert.equal(second.ok, true);
		assert.equal(
			readJournalEvents(projectRoot, batchId).filter(
				(event) => event.type === "review.honor_rejected",
			).length,
			1,
		);
	} finally {
		restoreStubEnv(prev);
		fs.rmSync(foreignRoot, { recursive: true, force: true });
		await destroyGitRepo(projectRoot);
	}
});

test("runFinalReviewPhase fails the task when contract verification fails before honor", async () => {
	const projectRoot = await initGitRepo("spine-honor-guard-contract-");
	const prev = enterLiveMode();
	try {
		const batchId = "20261009T010102";
		const taskId = "TP-328b";
		const { folder } = writeGuardTask(projectRoot, {
			taskId,
			suffix: "honor-guard-contract",
			reviewLevel: 1,
		});
		// Failing contract: even an honorable verdict must not complete the task.
		fs.writeFileSync(
			path.join(folder, "PROMPT.md"),
			fs
				.readFileSync(path.join(folder, "PROMPT.md"), "utf-8")
				.replace("testCommand | `true`", "testCommand | `false`"),
			"utf-8",
		);
		execCommit(projectRoot, "honor guard contract fixture");

		const { state, lane, task, wt, taskFolderInWorktree } = await provisionGuardLane(projectRoot, {
			batchId,
			taskId,
			taskFolderRel: `spine-tasks/${taskId}-honor-guard-contract`,
		});

		writeFinalPassArtifact(taskFolderInWorktree);

		const result = await runFinalReviewPhase({
			projectRoot,
			state,
			batchId,
			config: {},
			task,
			lane,
			taskFolderInWorktree,
			wt,
			taskBranch: lane.branch,
			laneCorrelationId: "corr-honor-guard-contract",
			fileScopePaths: [`src/${taskId}-guard.txt`],
			baseBranch: "main",
		});
		assert.equal(result.ok, false);
		assert.equal(result.exitReason, "contract_failed");

		const events = readJournalEvents(projectRoot, batchId);
		assert.ok(
			events.some((event) => event.type === "contract.verified" && event.payload?.ok === false),
		);
		assert.equal(
			events.some(
				(event) =>
					event.type === "task.verdict_recorded" &&
					event.taskId === taskId &&
					event.payload?.reviewType === "final",
			),
			false,
			"no final verdict may be recorded when the contract fails",
		);
	} finally {
		restoreStubEnv(prev);
		await destroyGitRepo(projectRoot);
	}
});

test("runPlanReviewPhase applies the honor guard and honors an in-folder plan artifact", async () => {
	const projectRoot = await initGitRepo("spine-honor-guard-plan-");
	const prev = enterLiveMode();
	const { foreignRoot, foreignArtifact } = makeForeignArtifactDir("TP-999-review");
	try {
		const batchId = "20261009T010103";
		const taskId = "TP-328c";
		writeGuardTask(projectRoot, {
			taskId,
			suffix: "honor-guard-plan",
			reviewLevel: 2,
			reviewHeadingExtra: "Plan and Code",
			contract: false,
		});
		execCommit(projectRoot, "honor guard plan fixture");

		const { state, lane, task, wt, taskFolderInWorktree } = await provisionGuardLane(projectRoot, {
			batchId,
			taskId,
			taskFolderRel: `spine-tasks/${taskId}-honor-guard-plan`,
		});

		writePlanApproveArtifact(taskFolderInWorktree, 1);

		appendJournalEvent(projectRoot, batchId, "review.completed", {
			taskId,
			laneNumber: 1,
			laneId: "lane-1",
			correlationId: "corr-foreign-plan-leak",
			reviewType: "plan",
			reviewLevel: 2,
			stepNumber: 1,
			verdict: "APPROVE",
			feedback: "Stub reviewer approved.",
			artifactPath: foreignArtifact,
			stub: true,
		});

		const result = await runPlanReviewPhase({
			projectRoot,
			state,
			batchId,
			config: {},
			task,
			lane,
			taskFolderInWorktree,
			wt,
			taskBranch: lane.branch,
			laneCorrelationId: "corr-honor-guard-plan",
			fileScopePaths: [`src/${taskId}-guard.txt`],
		});
		assert.equal(result.ok, true, JSON.stringify(result));
		assert.equal(result.honored, true);

		const events = readJournalEvents(projectRoot, batchId);
		const verdictEvent = events.find(
			(event) =>
				event.type === "task.verdict_recorded" &&
				event.taskId === taskId &&
				event.payload?.reviewType === "plan" &&
				event.payload?.honored === true,
		);
		assert.ok(verdictEvent, "honored plan verdict must be journaled");
		assert.equal(verdictEvent.payload?.honorSource, "artifact");

		const rejected = events.filter((event) => event.type === "review.honor_rejected");
		assert.equal(rejected.length, 1);
		assert.equal(rejected[0].payload?.reviewType, "plan");
		assert.equal(rejected[0].payload?.reason, "stub_verdict_in_live_batch");
	} finally {
		restoreStubEnv(prev);
		fs.rmSync(foreignRoot, { recursive: true, force: true });
		await destroyGitRepo(projectRoot);
	}
});
