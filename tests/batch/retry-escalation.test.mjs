import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { runSpineBatch } from "../../bin/spine-batch.mjs";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import {
	ESCALATION_ELIGIBLE_CLASSES,
	resolveRetryProfileOverride,
	retryTask,
} from "../../src/batch/retry.mjs";
import {
	createInitialBatchState,
	loadSpineBatchState,
	saveSpineBatchState,
	updateSegmentForTask,
} from "../../src/batch/state.mjs";
import { laneTaskBranch, laneWorktreePath } from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const BATCH_ID = "20260601T180000";
const TASK_ID = "TP-836";

function writeFailedBatch(projectRoot, { exitReason, profileOverride } = {}) {
	const state = createInitialBatchState({
		batchId: BATCH_ID,
		baseBranch: "main",
		orchBranch: `orch/spine-${BATCH_ID}`,
		wavePlan: [[TASK_ID]],
		tasks: [
			{
				taskId: TASK_ID,
				laneNumber: 1,
				status: "failed",
				taskFolder: `spine-tasks/${TASK_ID}-smoke`,
				startedAt: Date.now() - 60_000,
				endedAt: Date.now(),
				doneFileFound: false,
				exitReason,
				...(profileOverride ? { profileOverride } : {}),
			},
		],
		lanes: [
			{
				laneNumber: 1,
				laneId: "lane-1",
				worktreePath: laneWorktreePath(projectRoot, BATCH_ID, 1),
				branch: laneTaskBranch(BATCH_ID, 1),
				taskIds: [TASK_ID],
				lastHeartbeatAt: null,
			},
		],
	});
	state.phase = "failed";
	state.failedTasks = 1;
	updateSegmentForTask(state, TASK_ID, "failed");
	saveSpineBatchState(projectRoot, state);
}

function writeAgentsConfig(projectRoot, { escalatePolicy } = {}) {
	const configPath = path.join(projectRoot, ".spine", "spine-config.json");
	const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
	config.agents = {
		...config.agents,
		profiles: {
			cheap: { worker: { model: "cheap-model" } },
			strong: { worker: { model: "strong-model" } },
		},
		...(escalatePolicy ? { escalatePolicy } : {}),
	};
	fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
}

function retryEvent(projectRoot) {
	return readJournalEvents(projectRoot, BATCH_ID).find((event) => event.type === "task.retry_requested");
}

function savedTask(projectRoot) {
	return loadSpineBatchState(projectRoot).raw?.tasks[0];
}

async function withFixture(options, fn) {
	const projectRoot = await initGitRepo("spine-retry-escalation-");
	try {
		writeAgentsConfig(projectRoot, options);
		await fn(projectRoot);
	} finally {
		await destroyGitRepo(projectRoot);
	}
}

const AUTO = { escalatePolicy: { enabled: true, toProfile: "strong" } };

test("eligible classes are content/contract failures only", () => {
	assert.deepEqual([...ESCALATION_ELIGIBLE_CLASSES], ["contract_failed", "review_exhausted"]);
});

test("--profile on contract_failed sets profileOverride and journals manual escalation", async () => {
	await withFixture({}, async (projectRoot) => {
		writeFailedBatch(projectRoot, { exitReason: "contract_failed" });
		const result = retryTask({ projectRoot, taskId: TASK_ID, profile: "strong" });
		assert.equal(result.ok, true, result.output ?? result.error);
		assert.equal(result.profileOverride, "strong");
		assert.equal(result.escalation, "manual");

		const task = savedTask(projectRoot);
		assert.equal(task.profileOverride, "strong");
		assert.equal(task.status, "pending");
		assert.equal(task.exitReason, null);

		const payload = retryEvent(projectRoot)?.payload;
		assert.equal(payload?.profileOverride, "strong");
		assert.equal(payload?.escalation, "manual");
	});
});

test("--profile on provider_quota_exhausted errors and leaves the task failed", async () => {
	await withFixture({}, async (projectRoot) => {
		writeFailedBatch(projectRoot, { exitReason: "provider_quota_exhausted" });
		const result = retryTask({ projectRoot, taskId: TASK_ID, profile: "strong" });
		assert.equal(result.ok, false);
		assert.equal(result.exitCode, 1);
		assert.equal(result.error, "profile_ineligible");
		assert.equal(
			result.output,
			"--profile is for content/contract failures; provider_quota_exhausted is a provider/infra failure — " +
				"use agents.quotaFallbackProfile or retry without --profile\n",
		);
		const task = savedTask(projectRoot);
		assert.equal(task.status, "failed");
		assert.equal(task.profileOverride, undefined);
		assert.equal(retryEvent(projectRoot), undefined);
	});
});

test("--profile with an unknown profile errors and lists defined profiles", async () => {
	await withFixture({}, async (projectRoot) => {
		writeFailedBatch(projectRoot, { exitReason: "contract_failed" });
		const result = retryTask({ projectRoot, taskId: TASK_ID, profile: "nope" });
		assert.equal(result.ok, false);
		assert.equal(result.error, "unknown_profile");
		assert.match(result.output, /Unknown profile "nope"/);
		assert.match(result.output, /cheap, strong/);
		assert.equal(savedTask(projectRoot).status, "failed");
	});
});

test("auto escalation applies on review_exhausted and contract_failed when enabled", async () => {
	for (const exitReason of ["review_exhausted", "contract_failed"]) {
		await withFixture(AUTO, async (projectRoot) => {
			writeFailedBatch(projectRoot, { exitReason });
			const result = retryTask({ projectRoot, taskId: TASK_ID });
			assert.equal(result.ok, true, result.output ?? result.error);
			assert.equal(savedTask(projectRoot).profileOverride, "strong");
			const payload = retryEvent(projectRoot)?.payload;
			assert.equal(payload?.profileOverride, "strong");
			assert.equal(payload?.escalation, "auto");
		});
	}
});

test("auto escalation does not apply when the policy is disabled, absent or has no target", async () => {
	const policies = [
		{ escalatePolicy: { enabled: false, toProfile: "strong" } },
		{ escalatePolicy: { toProfile: "strong" } },
		{ escalatePolicy: { enabled: true } },
		{},
	];
	for (const options of policies) {
		await withFixture(options, async (projectRoot) => {
			writeFailedBatch(projectRoot, { exitReason: "review_exhausted" });
			const result = retryTask({ projectRoot, taskId: TASK_ID });
			assert.equal(result.ok, true, result.output ?? result.error);
			assert.equal(savedTask(projectRoot).profileOverride, undefined);
			const payload = retryEvent(projectRoot)?.payload;
			assert.equal(payload?.profileOverride, null);
			assert.equal(payload?.escalation, null);
		});
	}
});

test("auto escalation never applies to provider/infra failure classes", async () => {
	const classes = [
		"provider_quota_exhausted",
		"provider_overloaded",
		"launch_failed",
		"review_blocked",
		"worker_failed",
		"stalled",
		"orphaned",
		"plan_review_blocked",
		null,
	];
	for (const exitReason of classes) {
		await withFixture(AUTO, async (projectRoot) => {
			writeFailedBatch(projectRoot, { exitReason });
			const result = retryTask({ projectRoot, taskId: TASK_ID });
			assert.equal(result.ok, true, result.output ?? result.error);
			assert.equal(savedTask(projectRoot).profileOverride, undefined, String(exitReason));
			assert.equal(retryEvent(projectRoot)?.payload?.escalation, null, String(exitReason));
		});
	}
});

test("--no-escalate skips auto escalation for one retry", async () => {
	await withFixture(AUTO, async (projectRoot) => {
		writeFailedBatch(projectRoot, { exitReason: "review_exhausted" });
		const result = retryTask({ projectRoot, taskId: TASK_ID, noEscalate: true });
		assert.equal(result.ok, true, result.output ?? result.error);
		assert.equal(savedTask(projectRoot).profileOverride, undefined);
		assert.equal(retryEvent(projectRoot)?.payload?.escalation, null);
	});
});

test("auto escalation is a no-op when the override is already the target", async () => {
	await withFixture(AUTO, async (projectRoot) => {
		writeFailedBatch(projectRoot, { exitReason: "review_exhausted", profileOverride: "strong" });
		const result = retryTask({ projectRoot, taskId: TASK_ID });
		assert.equal(result.ok, true, result.output ?? result.error);
		assert.equal(savedTask(projectRoot).profileOverride, "strong");
		const payload = retryEvent(projectRoot)?.payload;
		assert.equal(payload?.profileOverride, "strong");
		assert.equal(payload?.escalation, null);
	});
});

test("retry preserves an existing profileOverride when nothing escalates", async () => {
	await withFixture({}, async (projectRoot) => {
		writeFailedBatch(projectRoot, { exitReason: "worker_failed", profileOverride: "cheap" });
		const result = retryTask({ projectRoot, taskId: TASK_ID });
		assert.equal(result.ok, true, result.output ?? result.error);
		assert.equal(savedTask(projectRoot).profileOverride, "cheap");
		assert.equal(retryEvent(projectRoot)?.payload?.profileOverride, "cheap");
	});
});

test("resolveRetryProfileOverride falls back to task.classification and rejects blank --profile", () => {
	const config = { agents: { profiles: { strong: {} } } };
	const viaClassification = resolveRetryProfileOverride({
		task: { classification: "contract_failed" },
		config,
		profile: "strong",
	});
	assert.equal(viaClassification.ok, true);
	const blank = resolveRetryProfileOverride({ task: { exitReason: "contract_failed" }, config, profile: " " });
	assert.equal(blank.ok, false);
	assert.equal(blank.error, "unknown_profile");
});

test("spine batch retry --profile parses the flag and keeps the task id positional", async () => {
	await withFixture({}, async (projectRoot) => {
		writeFailedBatch(projectRoot, { exitReason: "contract_failed" });
		const result = await runSpineBatch({
			projectRoot,
			args: ["retry", "--profile", "strong", TASK_ID, "--json"],
		});
		assert.equal(result.exitCode, 0, result.output);
		assert.equal(JSON.parse(result.output).profileOverride, "strong");
		assert.equal(savedTask(projectRoot).profileOverride, "strong");
	});
});

test("spine batch retry --profile on an ineligible class exits 1", async () => {
	await withFixture({}, async (projectRoot) => {
		writeFailedBatch(projectRoot, { exitReason: "launch_failed" });
		const result = await runSpineBatch({ projectRoot, args: ["retry", TASK_ID, "--profile", "strong"] });
		assert.equal(result.exitCode, 1);
		assert.match(result.output, /--profile is for content\/contract failures; launch_failed is a provider\/infra failure/);
	});
});

test("spine batch retry --profile without a value or on a matrix row exits 1", async () => {
	await withFixture({}, async (projectRoot) => {
		writeFailedBatch(projectRoot, { exitReason: "contract_failed" });
		const missing = await runSpineBatch({ projectRoot, args: ["retry", TASK_ID, "--profile"] });
		assert.equal(missing.exitCode, 1);
		assert.match(missing.output, /--profile <name>/);
		const row = await runSpineBatch({ projectRoot, args: ["retry", `${TASK_ID}[r1]`, "--profile", "strong"] });
		assert.equal(row.exitCode, 1);
		assert.match(row.output, /whole-task retry/);
		assert.equal(savedTask(projectRoot).status, "failed");
	});
});

test("spine batch retry --no-escalate skips auto escalation", async () => {
	await withFixture(AUTO, async (projectRoot) => {
		writeFailedBatch(projectRoot, { exitReason: "review_exhausted" });
		const result = await runSpineBatch({ projectRoot, args: ["retry", TASK_ID, "--no-escalate"] });
		assert.equal(result.exitCode, 0, result.output);
		assert.equal(savedTask(projectRoot).profileOverride, undefined);
	});
});
