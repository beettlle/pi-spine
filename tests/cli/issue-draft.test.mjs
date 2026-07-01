import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { appendJournalEvent } from "../../src/batch/journal.mjs";
import {
	buildIssueDraftBody,
	formatIssueDraftMarkdown,
} from "../../src/cli/issue-draft.mjs";
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

test("formatIssueDraftMarkdown renders all issue checklist sections", () => {
	const body = formatIssueDraftMarkdown({
		summary: "Batch stalled on lane 2",
		environment: "- pi-spine version: 1.0.0",
		commandsRun: "- spine status --diagnose",
		diagnosis: "- **Diagnosis:** stalled",
		journalExcerpt: "- 2026-01-01T00:00:00.000Z task.started TP-001",
		expected: "Worker completes task",
		actual: "Lane heartbeat stale",
	});

	for (const heading of [
		"## Summary",
		"## Environment",
		"## Commands run",
		"## Diagnosis",
		"## Journal excerpt",
		"## Expected",
		"## Actual",
	]) {
		assert.match(body, new RegExp(heading));
	}
	assert.match(body, /Batch stalled on lane 2/);
	assert.match(body, /Worker completes task/);
});

test("formatIssueDraftMarkdown applies redaction to section content", () => {
	const body = formatIssueDraftMarkdown({
		summary: "token sk-live1234567890abcdef leaked",
		environment: "OPENAI_API_KEY=sk-test123456789",
		commandsRun: "- spine preflight",
		diagnosis: "- **Diagnosis:** idle",
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
		assert.match(draft.body, /## Diagnosis/);
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
		assert.match(draft.body, /## Diagnosis/);
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
