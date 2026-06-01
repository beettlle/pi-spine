import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { runSpineStatus } from "../../bin/spine-status.mjs";
import { collectEvidenceBundle } from "../../src/batch/evidence.mjs";
import { dismissBatch } from "../../src/batch/lifecycle.mjs";
import { buildDiagnosisOutput } from "../../src/batch/diagnosis.mjs";
import {
	buildPostMortemHeadline,
	generateBatchPostMortem,
	listFailedTaskIds,
	postMortemPath,
	writeBatchPostMortem,
} from "../../src/batch/postmortem.mjs";
import { reconcileBatch } from "../../src/batch/reconcile.mjs";
import { batchHistoryPath } from "../../src/batch/state.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const FIXTURES = path.join(process.cwd(), "tests/fixtures/batch-state");

function loadFixture(name) {
	return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), "utf-8"));
}

function writePiBatchState(projectRoot, fixture) {
	fs.mkdirSync(path.join(projectRoot, ".pi"), { recursive: true });
	fs.writeFileSync(
		path.join(projectRoot, ".pi", "batch-state.json"),
		JSON.stringify(fixture, null, 2),
		"utf-8",
	);
}

test("mixed-outcome post-mortem lists failed IDs and retry hint, not smooth success", async () => {
	const projectRoot = await initGitRepo("spine-postmortem-");
	try {
		const fixture = loadFixture("needs-retry-batch.json");
		writePiBatchState(projectRoot, fixture);
		const reconciliation = reconcileBatch({ projectRoot, verbose: true });
		const md = generateBatchPostMortem(fixture, [], reconciliation, projectRoot);

		assert.match(md, /TP-002/);
		assert.match(md, /\/spine-retry-task TP-002/);
		assert.match(md, /needs_retry/i);
		assert.doesNotMatch(md, /ran smoothly/i);
		assert.doesNotMatch(md, /completed successfully/i);

		const headline = buildPostMortemHeadline(reconciliation, fixture);
		assert.match(headline, /TP-002/);
		assert.doesNotMatch(headline, /ran smoothly/i);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("false-success reconciliation headline is overridden when failures exist", () => {
	const fixture = loadFixture("needs-retry-batch.json");
	const fakeSuccess = buildDiagnosisOutput("completed", {
		batchId: fixture.batchId,
		phase: fixture.phase,
	});
	const headline = buildPostMortemHeadline(
		{ ...fakeSuccess, diagnosis: "needs_retry" },
		fixture,
	);
	assert.match(headline, /failed task TP-002/i);
	assert.doesNotMatch(headline, /completed successfully/i);
});

test("listFailedTaskIds prefers classified terminal-failure tasks", () => {
	const fixture = loadFixture("needs-retry-batch.json");
	const ids = listFailedTaskIds(fixture, {
		signals: {
			tasks: [
				{ taskId: "TP-001", classification: "terminal-success" },
				{ taskId: "TP-002", classification: "terminal-failure" },
			],
		},
	});
	assert.deepEqual(ids, ["TP-002"]);
});

test("collectEvidenceBundle summary.md is honest post-mortem markdown", async () => {
	const projectRoot = await initGitRepo("spine-postmortem-ev-");
	try {
		const fixture = loadFixture("needs-retry-batch.json");
		writePiBatchState(projectRoot, fixture);
		const { evidenceRefs } = collectEvidenceBundle({
			projectRoot,
			batchId: fixture.batchId,
			batchState: fixture,
		});
		const summaryPath = path.join(
			projectRoot,
			".spine",
			"runtime",
			fixture.batchId,
			"evidence",
			"summary.md",
		);
		const summary = fs.readFileSync(summaryPath, "utf-8");
		assert.ok(evidenceRefs.includes("evidence/summary.md"));
		assert.match(summary, /# Batch post-mortem/);
		assert.match(summary, /TP-002/);
		assert.match(summary, /\/spine-retry-task/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("dismissBatch writes post-mortem path into batch history", async () => {
	const projectRoot = await initGitRepo("spine-postmortem-dismiss-");
	try {
		const fixture = loadFixture("limbo-stale-20260531T165700.json");
		writePiBatchState(projectRoot, fixture);
		const result = dismissBatch({ projectRoot, reason: "test-postmortem" });
		assert.equal(result.ok, true);

		const relPath = `.spine/runtime/${fixture.batchId}/post-mortem.md`;
		assert.ok(fs.existsSync(path.join(projectRoot, relPath)));

		const history = JSON.parse(fs.readFileSync(batchHistoryPath(projectRoot), "utf-8"));
		assert.equal(history.at(-1)?.postMortemPath, relPath);
		assert.ok(fs.existsSync(postMortemPath(projectRoot, fixture.batchId)));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("writeBatchPostMortem persists markdown under runtime batch dir", async () => {
	const projectRoot = await initGitRepo("spine-postmortem-write-");
	try {
		const fixture = loadFixture("needs-retry-batch.json");
		const rel = writeBatchPostMortem({ projectRoot, batchState: fixture });
		assert.equal(rel, `.spine/runtime/${fixture.batchId}/post-mortem.md`);
		const content = fs.readFileSync(postMortemPath(projectRoot, fixture.batchId), "utf-8");
		assert.match(content, /Failed task IDs/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("spine status --verbose includes post-mortem section for active batch", async () => {
	const projectRoot = await initGitRepo("spine-postmortem-status-");
	try {
		const fixture = loadFixture("needs-retry-batch.json");
		writePiBatchState(projectRoot, fixture);
		const { output } = runSpineStatus({ projectRoot, diagnose: true, verbose: true });
		assert.match(output, /Post-mortem:/);
		assert.match(output, /TP-002/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
