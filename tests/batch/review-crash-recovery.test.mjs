/**
 * SP-484 — review crash recovery: orphaned review.started detection,
 * reconciliation via on-disk artifacts, and relaxed attempt guard.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import {
	detectOrphanedReviewStarted,
	reconcileOrphanedReviewEvents,
} from "../../src/batch/journal-rebuild.mjs";
import { findCompletedCodeReview } from "../../src/batch/review.mjs";

/**
 * Write a minimal journal file with the given events.
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {object[]} events
 */
function writeJournal(projectRoot, batchId, events) {
	const journalDir = path.join(projectRoot, ".spine", "runtime", batchId, "journal");
	fs.mkdirSync(journalDir, { recursive: true });
	const journalFile = path.join(journalDir, "events.jsonl");
	const lines = events.map((event) => JSON.stringify(event)).join("\n") + "\n";
	fs.writeFileSync(journalFile, lines, "utf-8");
}

/**
 * Write a review artifact with a given verdict.
 */
function writeReviewArtifact(artifactPath, verdict, reviewType = "code") {
	fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
	const label = reviewType === "final" ? "Final" : "Code";
	const body = [
		`## ${label} Review`,
		"",
		`### Verdict: ${verdict}`,
		"",
		"### Summary",
		`Stub review returned ${verdict}.`,
		"",
		"```json",
		JSON.stringify({ verdict, feedback: `Stub ${verdict}` }, null, 2),
		"```",
		"",
	].join("\n");
	fs.writeFileSync(artifactPath, body, "utf-8");
}

test("detectOrphanedReviewStarted finds orphaned review.started with no matching review.completed", () => {
	const events = [
		{
			type: "task.started",
			taskId: "SP-100",
			payload: {},
		},
		{
			type: "review.started",
			taskId: "SP-100",
			payload: { reviewType: "code", artifactPath: "/tmp/art.md" },
		},
	];

	const orphaned = detectOrphanedReviewStarted(events);
	assert.equal(orphaned.length, 1);
	assert.equal(orphaned[0].taskId, "SP-100");
});

test("detectOrphanedReviewStarted returns empty when review.completed exists", () => {
	const events = [
		{
			type: "review.started",
			taskId: "SP-100",
			payload: { reviewType: "code", artifactPath: "/tmp/art.md" },
		},
		{
			type: "review.completed",
			taskId: "SP-100",
			payload: { reviewType: "code", verdict: "APPROVE" },
		},
	];

	const orphaned = detectOrphanedReviewStarted(events);
	assert.equal(orphaned.length, 0);
});

test("detectOrphanedReviewStarted distinguishes code and final review types", () => {
	const events = [
		{
			type: "review.started",
			taskId: "SP-100",
			payload: { reviewType: "code", artifactPath: "/tmp/code.md" },
		},
		{
			type: "review.started",
			taskId: "SP-100",
			payload: { reviewType: "final", artifactPath: "/tmp/final.md" },
		},
		{
			type: "review.completed",
			taskId: "SP-100",
			payload: { reviewType: "code", verdict: "APPROVE" },
		},
	];

	const orphaned = detectOrphanedReviewStarted(events);
	assert.equal(orphaned.length, 1);
	assert.equal(orphaned[0].payload.reviewType, "final");
});

test("reconcileOrphanedReviewEvents synthesizes completion when APPROVE artifact on disk", async () => {
	const tmpDir = await mkdtemp(path.join(os.tmpdir(), "sp484-"));
	try {
		const batchId = "20260703T231119";
		const artifactPath = path.join(tmpDir, "spine-tasks", "SP-100", ".reviews", "3-20260703T200000.md");
		writeReviewArtifact(artifactPath, "APPROVE", "code");

		writeJournal(tmpDir, batchId, [
			{
				schemaVersion: 1,
				type: "task.started",
				taskId: "SP-100",
				batchId,
				payload: {},
			},
			{
				schemaVersion: 1,
				type: "review.started",
				taskId: "SP-100",
				batchId,
				payload: {
					reviewType: "code",
					artifactPath,
					laneNumber: 1,
					stepNumber: 3,
					reviewLevel: 2,
				},
			},
		]);

		const events = readJournalEvents(tmpDir, batchId);
		const result = reconcileOrphanedReviewEvents({
			projectRoot: tmpDir,
			batchId,
			events,
		});

		assert.equal(result.synthesized.length, 1);
		assert.equal(result.synthesized[0].taskId, "SP-100");
		assert.equal(result.synthesized[0].verdict, "APPROVE");
		assert.equal(result.synthesized[0].reviewType, "code");

		const updatedEvents = readJournalEvents(tmpDir, batchId);
		const reviewCompleted = updatedEvents.find(
			(e) => e.type === "review.completed" && e.payload?.synthesized === true,
		);
		assert.ok(reviewCompleted, "review.completed event should be synthesized");
		assert.equal(reviewCompleted.payload.verdict, "APPROVE");
		assert.equal(reviewCompleted.payload.synthesizeReason, "orphaned_review_crash_recovery");

		const taskCompleted = updatedEvents.find(
			(e) => e.type === "task.completed" && e.payload?.synthesized === true,
		);
		assert.ok(taskCompleted, "task.completed event should be synthesized");
		assert.equal(taskCompleted.taskId, "SP-100");
		assert.equal(taskCompleted.payload.synthesizeReason, "orphaned_review_crash_recovery");
	} finally {
		await rm(tmpDir, { recursive: true, force: true });
	}
});

test("reconcileOrphanedReviewEvents does NOT synthesize when no artifact on disk", async () => {
	const tmpDir = await mkdtemp(path.join(os.tmpdir(), "sp484-"));
	try {
		const batchId = "20260703T231119";
		const artifactPath = path.join(tmpDir, "spine-tasks", "SP-100", ".reviews", "3-20260703T200000.md");

		writeJournal(tmpDir, batchId, [
			{
				schemaVersion: 1,
				type: "review.started",
				taskId: "SP-100",
				batchId,
				payload: {
					reviewType: "code",
					artifactPath,
					laneNumber: 1,
				},
			},
		]);

		const events = readJournalEvents(tmpDir, batchId);
		const result = reconcileOrphanedReviewEvents({
			projectRoot: tmpDir,
			batchId,
			events,
		});

		assert.equal(result.synthesized.length, 0, "should not synthesize without artifact on disk");

		const updatedEvents = readJournalEvents(tmpDir, batchId);
		const synthesizedEvent = updatedEvents.find(
			(e) => e.payload?.synthesized === true,
		);
		assert.equal(synthesizedEvent, undefined, "no synthesized events should exist");
	} finally {
		await rm(tmpDir, { recursive: true, force: true });
	}
});

test("reconcileOrphanedReviewEvents does NOT synthesize for REVISE verdict", async () => {
	const tmpDir = await mkdtemp(path.join(os.tmpdir(), "sp484-"));
	try {
		const batchId = "20260703T231119";
		const artifactPath = path.join(tmpDir, "spine-tasks", "SP-100", ".reviews", "3-20260703T200000.md");
		writeReviewArtifact(artifactPath, "REVISE", "code");

		writeJournal(tmpDir, batchId, [
			{
				schemaVersion: 1,
				type: "review.started",
				taskId: "SP-100",
				batchId,
				payload: {
					reviewType: "code",
					artifactPath,
					laneNumber: 1,
				},
			},
		]);

		const events = readJournalEvents(tmpDir, batchId);
		const result = reconcileOrphanedReviewEvents({
			projectRoot: tmpDir,
			batchId,
			events,
		});

		assert.equal(result.synthesized.length, 0, "REVISE should not be auto-reconciled");
	} finally {
		await rm(tmpDir, { recursive: true, force: true });
	}
});

test("findCompletedCodeReview honors artifact at attempt > 0", async () => {
	const tmpDir = await mkdtemp(path.join(os.tmpdir(), "sp484-"));
	try {
		const taskFolder = path.join(tmpDir, "spine-tasks", "SP-200");
		fs.mkdirSync(taskFolder, { recursive: true });

		fs.writeFileSync(
			path.join(taskFolder, "PROMPT.md"),
			[
				"# Task: SP-200",
				"",
				"## Review Level: 2 (Plan and Code)",
				"",
				"## Steps",
				"### Step 1: Work",
				"- [ ] implement",
				"",
				"### Step 2: Testing",
				"> **Code review checkpoint**",
				"- [ ] test",
				"",
			].join("\n"),
			"utf-8",
		);

		const stepNumber = 2;
		const artifactPath = path.join(taskFolder, ".reviews", `${stepNumber}-20260703T200000.md`);
		writeReviewArtifact(artifactPath, "APPROVE", "code");

		const journalEvents = [
			{
				type: "review.completed",
				taskId: "SP-200",
				payload: { reviewType: "code", verdict: "APPROVE", artifactPath },
			},
		];

		const result = findCompletedCodeReview({
			taskFolder,
			journalEvents,
			taskId: "SP-200",
		});

		assert.ok(result, "should find completed code review");
		assert.equal(result.verdict, "APPROVE");
	} finally {
		await rm(tmpDir, { recursive: true, force: true });
	}
});

test("normal review flow (no crash) still works correctly", () => {
	const events = [
		{
			type: "review.started",
			taskId: "SP-300",
			payload: { reviewType: "code", artifactPath: "/tmp/art.md" },
		},
		{
			type: "review.completed",
			taskId: "SP-300",
			payload: { reviewType: "code", verdict: "APPROVE" },
		},
		{
			type: "task.completed",
			taskId: "SP-300",
			payload: { exitReason: "done" },
		},
	];

	const orphaned = detectOrphanedReviewStarted(events);
	assert.equal(orphaned.length, 0, "normal flow should have no orphaned reviews");
});

test("reconcileOrphanedReviewEvents handles final review with PASS verdict", async () => {
	const tmpDir = await mkdtemp(path.join(os.tmpdir(), "sp484-"));
	try {
		const batchId = "20260703T231119";
		const artifactPath = path.join(tmpDir, "spine-tasks", "SP-400", ".reviews", "final-20260703T200000.md");
		writeReviewArtifact(artifactPath, "PASS", "final");

		writeJournal(tmpDir, batchId, [
			{
				schemaVersion: 1,
				type: "review.started",
				taskId: "SP-400",
				batchId,
				payload: {
					reviewType: "final",
					artifactPath,
					laneNumber: 1,
					reviewLevel: 1,
				},
			},
		]);

		const events = readJournalEvents(tmpDir, batchId);
		const result = reconcileOrphanedReviewEvents({
			projectRoot: tmpDir,
			batchId,
			events,
		});

		assert.equal(result.synthesized.length, 1);
		assert.equal(result.synthesized[0].verdict, "PASS");
		assert.equal(result.synthesized[0].reviewType, "final");
	} finally {
		await rm(tmpDir, { recursive: true, force: true });
	}
});
