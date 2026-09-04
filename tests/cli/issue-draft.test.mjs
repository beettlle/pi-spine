import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { appendJournalEvent } from "../../src/batch/journal.mjs";
import {
	buildIssueDraftBody,
	formatIssueDraftMarkdown,
} from "../../src/cli/issue-draft.mjs";
import {
	resolveAssessmentReason,
	resolveBackgroundFacts,
} from "../../src/cli/handoff.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const FIXTURES = path.join(process.cwd(), "tests/fixtures/batch-state");

function loadFixture(name) {
	return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), "utf-8"));
}

function writeSpineBatchState(projectRoot, fixture) {
	fs.mkdirSync(path.join(projectRoot, ".spine"), { recursive: true });
	fs.writeFileSync(
		path.join(projectRoot, ".spine", "batch-state.json"),
		JSON.stringify(fixture, null, 2),
		"utf-8",
	);
}

test("formatIssueDraftMarkdown renders SBAR sections in order", () => {
	const body = formatIssueDraftMarkdown({
		summary: "Batch stalled on lane 2",
		environment: "- pi-spine version: 1.0.0",
		situation: "- **Diagnosis:** stalled",
		background: ["Phase: running", "Pending tasks: TP-002"],
		assessment: "Lane heartbeat stale for TP-002",
		recommendation: ["spine status --diagnose"],
		commandsRun: "- spine status --diagnose",
		journalExcerpt: "- 2026-01-01T00:00:00.000Z task.started TP-001",
		expected: "Worker completes task",
		actual: "Lane heartbeat stale",
	});

	for (const heading of [
		"## Summary",
		"## Environment",
		"## Situation",
		"## Background",
		"## Assessment",
		"## Recommendation",
		"## Commands run",
		"## Journal excerpt",
		"## Expected",
		"## Actual",
	]) {
		assert.match(body, new RegExp(heading));
	}
	assert.match(body, /Batch stalled on lane 2/);
	assert.match(body, /Worker completes task/);

	// SBAR order (#279): Situation → Background → Assessment → Recommendation.
	const positions = ["## Situation", "## Background", "## Assessment", "## Recommendation"].map(
		(heading) => body.indexOf(heading),
	);
	assert.ok(
		positions.every((position, index) => position >= 0 && (index === 0 || position > positions[index - 1])),
		`expected ordered SBAR headings, got positions ${positions.join(",")}`,
	);
});

test("formatIssueDraftMarkdown shows (none) for empty Background and Assessment", () => {
	const body = formatIssueDraftMarkdown({
		summary: "Idle repo",
		environment: "- pi-spine version: 1.0.0",
		situation: "- **Diagnosis:** idle",
		background: [],
		assessment: "",
		recommendation: [],
		commandsRun: "- spine preflight",
		journalExcerpt: "- (none)",
	});

	assert.match(body, /## Background\n\(none\)/);
	assert.match(body, /## Assessment\n\(none\)/);
	assert.match(body, /## Recommendation\n\(none\)/);
	// Expected/Actual placeholders are kept for bug drafts.
	assert.match(body, /## Expected\n\(describe expected behavior\)/);
	assert.match(body, /## Actual\n\(describe actual behavior\)/);
});

test("formatIssueDraftMarkdown applies redaction to section content", () => {
	const body = formatIssueDraftMarkdown({
		summary: "token sk-live1234567890abcdef leaked",
		environment: "OPENAI_API_KEY=sk-test123456789",
		situation: "- **Diagnosis:** idle",
		background: ["Journal hint: OPENAI_API_KEY=sk-test123456789"],
		commandsRun: "- spine preflight",
		journalExcerpt: "- (none)",
	});

	assert.ok(!body.includes("sk-live1234567890abcdef"));
	assert.ok(!body.includes("sk-test123456789"));
	assert.match(body, /\[REDACTED\]/);
});

test("buildIssueDraftBody returns title, body, and labels for idle repo", async () => {
	const projectRoot = await initGitRepo("issue-draft-idle-");
	try {
		const draft = buildIssueDraftBody({ projectRoot, issueType: "enhancement" });

		assert.ok(draft.title);
		assert.ok(draft.body);
		assert.deepEqual(draft.labels, ["enhancement"]);
		assert.match(draft.body, /## Summary/);
		assert.match(draft.body, /## Environment/);
		assert.match(draft.body, /pi-spine version:/);
		assert.match(draft.body, /## Situation/);
		assert.match(draft.body, /## Background/);
		assert.match(draft.body, /## Assessment/);
		assert.match(draft.body, /## Recommendation/);
		assert.match(draft.body, /## Journal excerpt/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("buildIssueDraftBody includes batch context and journal tail", async () => {
	const projectRoot = await initGitRepo("issue-draft-active-");
	try {
		const fixture = loadFixture("running-batch.json");
		writeSpineBatchState(projectRoot, fixture);
		appendJournalEvent(projectRoot, fixture.batchId, "task.started", {
			taskId: "TP-002",
		});

		const draft = buildIssueDraftBody({
			projectRoot,
			issueType: "question",
			batchId: fixture.batchId,
		});

		assert.deepEqual(draft.labels, ["question"]);
		assert.match(draft.body, /## Situation/);
		assert.match(draft.body, new RegExp(fixture.batchId));
		assert.match(draft.body, /task\.started/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("buildIssueDraftBody maps issueType to GitHub labels", async () => {
	const projectRoot = await initGitRepo("issue-draft-labels-");
	try {
		for (const [issueType, label] of [
			["bug", "bug"],
			["enhancement", "enhancement"],
			["question", "question"],
		]) {
			const draft = buildIssueDraftBody({ projectRoot, issueType });
			assert.deepEqual(draft.labels, [label]);
		}
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("buildIssueDraftBody derives Background from journal and phase when diagnose fields are absent", () => {
	// Simulate a diagnose packet without #278 fields (pre-SP-745 shape).
	const body = formatIssueDraftMarkdown({
		summary: "fallback check",
		environment: "- pi-spine version: 1.0.0",
		situation: "- **Diagnosis:** needs_retry",
		background: resolveBackgroundFacts({
			phase: "running",
			pendingTasks: [{ taskId: "TP-003" }],
			journalTail: [{ timestamp: "2026-01-01T00:00:00.000Z", type: "task.started", taskId: "TP-002" }],
		}),
		assessment: resolveAssessmentReason({
			diagnosis: "needs_retry",
			headline: "Batch 20260601T140000 needs a task retry",
		}),
		recommendation: ["spine batch retry TP-002"],
		commandsRun: "- spine status --diagnose",
		journalExcerpt: "- (none)",
	});

	assert.match(body, /## Background\n- Phase: running/);
	assert.match(body, /- Pending tasks: TP-003/);
	assert.match(body, /- Last journal event: task\.started TP-002/);
	assert.match(body, /## Assessment\nReconcile signals selected "needs_retry" — Batch 20260601T140000 needs a task retry/);
});

test("buildIssueDraftBody rejects invalid issueType", async () => {
	const projectRoot = await initGitRepo("issue-draft-invalid-");
	try {
		assert.throws(
			() => buildIssueDraftBody({ projectRoot, issueType: "feature" }),
			/Invalid issueType: feature/,
		);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("buildIssueDraftBody redacts sk- token patterns in title and body", async () => {
	const projectRoot = await initGitRepo("issue-draft-redact-");
	try {
		fs.mkdirSync(path.join(projectRoot, ".spine"), { recursive: true });
		fs.writeFileSync(
			path.join(projectRoot, ".spine", "spine-config.json"),
			JSON.stringify({ project: { name: "test" }, tasksRoot: "spine-tasks" }, null, 2),
			"utf-8",
		);

		const draft = buildIssueDraftBody({
			projectRoot,
			issueType: "bug",
			title: "Failure with sk-live1234567890abcdef in logs",
		});

		assert.ok(!draft.title.includes("sk-live1234567890abcdef"));
		assert.ok(!draft.body.includes("sk-live1234567890abcdef"));
		assert.match(draft.title, /\[REDACTED\]/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
