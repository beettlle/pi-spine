// @ts-nocheck
/**
 * Re-review diagnosis for review-infrastructure failures with done lane work
 * (SP-821 / partial #334). For plan, code, and final reviews: spawn failure,
 * timeout, and provider error all mean no verdict was produced. When the lane
 * work is done, diagnose recommends re-running the review (`spine batch
 * retry`), never `salvage --integrate` (which would land code no reviewer
 * saw). This reverses the SP-762 pending_lane_land mapping (#291) for plan
 * review and extends the same semantics to code/final and provider errors.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { deriveDiagnosis } from "../../src/batch/reconcile-diagnosis.mjs";
import { buildHeadline } from "../../src/batch/diagnosis.mjs";
import { buildSuggestedCommand } from "../../src/batch/diagnosis-suggested-command.mjs";
import { buildAlternatives } from "../../src/batch/diagnosis-alternatives.mjs";
import { REVIEW_INFRASTRUCTURE_EXIT_REASONS } from "../../src/batch/diagnosis-review-infra.mjs";

const BATCH_ID = "20261014T120000";
const TASK_ID = "SP-821";

/**
 * Failed task with done lane work and a review-infrastructure exit reason.
 *
 * @param {object} [overrides]
 */
function reviewInfraSignals(overrides = {}) {
	return {
		phase: "running",
		endedAt: null,
		failedTasks: 1,
		allTasksTerminalSuccess: false,
		hasRunningTasks: false,
		hasPendingTasks: false,
		hasFailedTasks: true,
		hasSegmentDrift: false,
		failedTaskId: TASK_ID,
		mergeResultsEmpty: true,
		git: { orchBranchExists: false, orchMergedToBase: false },
		orphanRunning: null,
		tasks: [
			{
				taskId: TASK_ID,
				laneNumber: 1,
				status: "failed",
				classification: "terminal-failure",
				doneInLane: true,
				doneOnMain: false,
				doneFileFound: false,
				exitReason: overrides.exitReason,
			},
		],
		journalEvents: [],
	};
}

/**
 * Terminal-success pending-lane signals (done in lane, not yet on main) with
 * orch merged — the `done_in_lane_terminal` salvage-candidate shape.
 *
 * @param {string|null} exitReason
 */
function pendingLaneSignals(exitReason) {
	return {
		phase: "failed",
		endedAt: null,
		failedTasks: 0,
		allTasksTerminalSuccess: true,
		hasRunningTasks: false,
		hasPendingTasks: false,
		hasFailedTasks: false,
		hasSegmentDrift: false,
		failedTaskId: null,
		mergeResultsEmpty: true,
		git: { orchBranchExists: true, orchMergedToBase: true },
		orphanRunning: null,
		tasks: [
			{
				taskId: TASK_ID,
				laneNumber: 1,
				status: "done",
				classification: "terminal-success",
				doneInLane: true,
				doneOnMain: false,
				doneFileFound: false,
				exitReason,
			},
		],
		journalEvents: [],
	};
}

test("review-infrastructure set covers plan/code/final × spawn_failed/timeout/provider_error", () => {
	for (const reviewType of ["plan", "code", "final"]) {
		for (const failure of ["spawn_failed", "timeout", "provider_error"]) {
			assert.ok(
				REVIEW_INFRASTRUCTURE_EXIT_REASONS.has(`${reviewType}_review_${failure}`),
				`${reviewType}_review_${failure} should be a review-infra reason`,
			);
		}
	}
	assert.equal(REVIEW_INFRASTRUCTURE_EXIT_REASONS.size, 9);
});

test("done lane work + review-infra exit reason → needs_retry, retry command, re-review headline", () => {
	for (const exitReason of REVIEW_INFRASTRUCTURE_EXIT_REASONS) {
		const derived = deriveDiagnosis(reviewInfraSignals({ exitReason }));
		assert.equal(derived.diagnosis, "needs_retry", exitReason);
		assert.equal(derived.failedTaskId, TASK_ID, exitReason);

		const ctx = {
			batchId: BATCH_ID,
			failedTaskId: TASK_ID,
			exitReason,
		};
		const headline = buildHeadline("needs_retry", ctx);
		assert.match(headline, /re-run the review/, exitReason);
		assert.ok(headline.includes("lane work is done"), exitReason);
		assert.ok(headline.includes(TASK_ID), exitReason);
		assert.doesNotMatch(headline, /salvage/, exitReason);

		const command = buildSuggestedCommand("needs_retry", ctx);
		assert.equal(command, `spine batch retry ${TASK_ID}`, exitReason);

		const alternatives = buildAlternatives("needs_retry", { ...ctx });
		assert.equal(
			alternatives.some(
				(entry) =>
					typeof entry === "string" &&
					entry.includes(`spine batch salvage --batch ${BATCH_ID} --dry-run`) &&
					entry.includes("lands unreviewed work"),
			),
			true,
			`${exitReason}: alternatives should keep salvage dry-run labeled as landing unreviewed work`,
		);
	}
});

test("provider-error headline names the review type and points at spine doctor", () => {
	const headline = buildHeadline("needs_retry", {
		batchId: BATCH_ID,
		failedTaskId: TASK_ID,
		exitReason: "code_review_provider_error",
	});
	assert.match(headline, /code review hit a provider error/);
	assert.match(headline, /re-run the review/);
	assert.match(headline, /run spine doctor/);

	// Non-provider reasons must not send the operator to spine doctor.
	const spawnHeadline = buildHeadline("needs_retry", {
		batchId: BATCH_ID,
		failedTaskId: TASK_ID,
		exitReason: "final_review_spawn_failed",
	});
	assert.match(spawnHeadline, /final review produced no verdict/);
	assert.doesNotMatch(spawnHeadline, /spine doctor/);
});

test("timeout headline names the review type without the old SPINE_REVIEW_TIMEOUT_MS copy", () => {
	const headline = buildHeadline("needs_retry", {
		batchId: BATCH_ID,
		failedTaskId: TASK_ID,
		exitReason: "plan_review_timeout",
	});
	assert.match(headline, /plan review produced no verdict for task SP-821/);
	assert.doesNotMatch(headline, /SPINE_REVIEW_TIMEOUT_MS/);
	assert.doesNotMatch(headline, /retry or increase/);
});

test("pending-lane task with contract_failed exit reason still gets pending_lane_land", () => {
	const derived = deriveDiagnosis(pendingLaneSignals("contract_failed"));
	assert.equal(derived.diagnosis, "pending_lane_land");
	assert.equal(derived.failedTaskId, TASK_ID);
});

test("pending-lane task with no failure exit reason still gets pending_lane_land", () => {
	const derived = deriveDiagnosis(pendingLaneSignals(null));
	assert.equal(derived.diagnosis, "pending_lane_land");
});
