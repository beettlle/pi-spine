import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { appendJournalEvent, readJournalEvents, recordHandoffWritten } from "../../src/batch/journal.mjs";
import {
	assembleHandoffData,
	redactHandoffSecrets,
	redactHandoffText,
	renderHandoffMarkdown,
	runSpineHandoff,
} from "../../src/cli/handoff.mjs";
import { handleNext } from "../../bin/spine-cli/batch.mjs";
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

test("assembleHandoffData returns idle shape when no active batch", async () => {
	const projectRoot = await initGitRepo("spine-handoff-idle-");
	try {
		const data = assembleHandoffData(projectRoot);
		assert.equal(data.idle, true);
		assert.equal(data.diagnosis, "idle");
		assert.equal(data.batchId, null);
		assert.equal(data.suggestedCommand, "spine preflight");
		assert.deepEqual(data.pendingTasks, []);
		assert.deepEqual(data.laneSummary, []);
		assert.deepEqual(data.journalTail, []);
		assert.ok(Array.isArray(data.restoreCommands));
		assert.ok(data.generatedAt);
		assert.ok(data.headline);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("assembleHandoffData includes reconciliation fields for active batch", async () => {
	const projectRoot = await initGitRepo("spine-handoff-active-");
	try {
		const fixture = loadFixture("running-batch.json");
		writeSpineBatchState(projectRoot, fixture);

		appendJournalEvent(projectRoot, fixture.batchId, "lane.heartbeat", {
			laneNumber: 1,
			taskId: "TP-002",
		});
		appendJournalEvent(projectRoot, fixture.batchId, "task.started", {
			taskId: "TP-002",
		});

		const data = assembleHandoffData(projectRoot);
		assert.equal(data.batchId, fixture.batchId);
		assert.equal(data.idle, false);
		assert.ok(data.diagnosis);
		assert.ok(data.headline);
		assert.ok(data.suggestedCommand);
		assert.ok(Array.isArray(data.alternatives));
		assert.ok(data.pendingTasks.length >= 1);
		assert.ok(data.pendingTasks.some((task) => task.taskId === "TP-003"));
		assert.ok(Array.isArray(data.laneSummary));
		assert.ok(Array.isArray(data.journalTail));
		assert.ok(data.journalTail.length >= 1);
		assert.ok(data.journalTail.every((entry) => entry.type && entry.timestamp));
		assert.ok(data.restoreCommands.includes(data.suggestedCommand));
		assert.ok(!JSON.stringify(data).includes("SECRET_KEY"));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("assembleHandoffData redacts secret-like payload fields in journal tail", async () => {
	const projectRoot = await initGitRepo("spine-handoff-redact-");
	try {
		const fixture = loadFixture("running-batch.json");
		writeSpineBatchState(projectRoot, fixture);

		appendJournalEvent(projectRoot, fixture.batchId, "lane.heartbeat", {
			laneNumber: 1,
			apiKey: "super-secret-value",
		});

		const data = assembleHandoffData(projectRoot);
		const serialized = JSON.stringify(data);
		assert.ok(!serialized.includes("super-secret-value"));
		assert.ok(serialized.includes("[REDACTED]") || !serialized.includes("apiKey"));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

const PAUSED_PENDING_FIXTURE = {
	batchId: "20260601T140000",
	phase: "paused",
	baseBranch: "main",
	orchBranch: "orch/spine-operator-20260601T140000",
	startedAt: 1748796000000,
	endedAt: null,
	failedTasks: 0,
	succeededTasks: 2,
	totalTasks: 4,
	mergeResults: [],
	tasks: [
		{ taskId: "TP-001", status: "succeeded", taskFolder: "TP-001-alpha", doneFileFound: true },
		{ taskId: "TP-002", status: "succeeded", taskFolder: "TP-002-beta", doneFileFound: true },
		{ taskId: "TP-003", status: "pending", taskFolder: "TP-003-gamma", doneFileFound: false },
		{ taskId: "TP-004", status: "pending", taskFolder: "TP-004-delta", doneFileFound: false },
	],
	segments: [
		{ segmentId: "TP-001::default", taskId: "TP-001", status: "succeeded" },
		{ segmentId: "TP-002::default", taskId: "TP-002", status: "succeeded" },
		{ segmentId: "TP-003::default", taskId: "TP-003", status: "pending" },
		{ segmentId: "TP-004::default", taskId: "TP-004", status: "pending" },
	],
};

/**
 * @param {string} markdown
 */
function normalizeHandoffForSnapshot(markdown) {
	return markdown.replace(
		/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g,
		"<TIMESTAMP>",
	);
}

test("paused batch handoff lists pending tasks and spine batch resume", async () => {
	const projectRoot = await initGitRepo("spine-handoff-paused-");
	try {
		writeSpineBatchState(projectRoot, PAUSED_PENDING_FIXTURE);
		appendJournalEvent(projectRoot, PAUSED_PENDING_FIXTURE.batchId, "batch.paused", {
			fromPhase: "running",
			toPhase: "paused",
		});

		const data = assembleHandoffData(projectRoot);
		assert.equal(data.diagnosis, "paused");
		assert.equal(data.suggestedCommand, "spine batch resume");
		assert.deepEqual(
			data.pendingTasks.map((task) => task.taskId),
			["TP-003", "TP-004"],
		);

		const markdown = renderHandoffMarkdown(data);
		assert.match(markdown, /## Pending tasks/);
		assert.match(markdown, /TP-003/);
		assert.match(markdown, /spine batch resume/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("renderHandoffMarkdown matches golden snapshot structure", async () => {
	const projectRoot = await initGitRepo("spine-handoff-golden-");
	const golden = fs
		.readFileSync(path.join(process.cwd(), "tests/fixtures/handoff-golden.md"), "utf-8")
		.trim();
	try {
		writeSpineBatchState(projectRoot, PAUSED_PENDING_FIXTURE);
		appendJournalEvent(projectRoot, PAUSED_PENDING_FIXTURE.batchId, "batch.paused", {
			fromPhase: "running",
			toPhase: "paused",
		});
		appendJournalEvent(projectRoot, PAUSED_PENDING_FIXTURE.batchId, "task.step_completed", {
			taskId: "TP-003",
			stepNumber: 1,
		});

		const rendered = normalizeHandoffForSnapshot(
			renderHandoffMarkdown(assembleHandoffData(projectRoot)),
		);
		assert.equal(rendered.trim(), golden);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("redactHandoffText removes KEY TOKEN and SECRET value patterns", () => {
	const payload = {
		API_KEY: "sk-live-secret",
		note: "OPENAI_API_KEY=sk-abc123",
		nested: { AUTH_TOKEN: "tok-xyz" },
	};
	const redacted = redactHandoffSecrets(payload);
	assert.equal(redacted.API_KEY, "[REDACTED]");
	assert.equal(redacted.nested.AUTH_TOKEN, "[REDACTED]");
	assert.match(String(redacted.note), /\[REDACTED\]/);
	assert.equal(redactHandoffText("export GITHUB_TOKEN=ghp_deadbeef"), "export [REDACTED]");
});

test("recordHandoffWritten appends handoff.written journal event", async () => {
	const projectRoot = await initGitRepo("spine-handoff-journal-");
	try {
		const batchId = "20260611T140000";
		writeSpineBatchState(projectRoot, PAUSED_PENDING_FIXTURE);

		recordHandoffWritten(projectRoot, batchId, {
			handoffPath: ".spine/handoff.md",
			diagnosis: "paused",
			batchId,
		});

		const events = readJournalEvents(projectRoot, batchId);
		const event = events.find((entry) => entry.type === "handoff.written");
		assert.ok(event);
		assert.equal(event.payload?.handoffPath, ".spine/handoff.md");
		assert.equal(event.payload?.diagnosis, "paused");
		assert.equal(event.payload?.batchId, batchId);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("handleNext appends handoff path hint when handoff file exists", async () => {
	const projectRoot = await initGitRepo("spine-next-handoff-");
	const originalCwd = process.cwd();
	try {
		process.chdir(projectRoot);
		writeSpineBatchState(projectRoot, PAUSED_PENDING_FIXTURE);
		fs.mkdirSync(path.join(projectRoot, ".spine"), { recursive: true });
		fs.writeFileSync(path.join(projectRoot, ".spine", "handoff.md"), "# handoff\n", "utf-8");

		const stdoutChunks = [];
		const originalWrite = process.stdout.write.bind(process.stdout);
		process.stdout.write = (chunk) => {
			stdoutChunks.push(String(chunk));
			return true;
		};

		try {
			await handleNext([]);
		} finally {
			process.stdout.write = originalWrite;
		}

		const output = stdoutChunks.join("");
		assert.match(output, /Handoff: \.spine\/handoff\.md/);
	} finally {
		process.chdir(originalCwd);
		await destroyGitRepo(projectRoot);
	}
});

test("runSpineHandoff --json writes handoff file and returns structured output", async () => {
	const projectRoot = await initGitRepo("spine-handoff-cli-");
	try {
		writeSpineBatchState(projectRoot, PAUSED_PENDING_FIXTURE);
		const { exitCode, output } = runSpineHandoff({
			projectRoot,
			args: ["--json"],
		});
		assert.equal(exitCode, 0);
		const parsed = JSON.parse(output.trim());
		assert.equal(parsed.diagnosis, "paused");
		assert.equal(parsed.handoffPath, ".spine/handoff.md");
		assert.ok(fs.existsSync(path.join(projectRoot, ".spine", "handoff.md")));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
