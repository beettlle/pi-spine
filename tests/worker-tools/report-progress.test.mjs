import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { runSpineReportProgress, parseReportProgressArgs } from "../../bin/spine-report-progress.mjs";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { reportTaskProgress } from "../../src/worker-tools/report-progress.mjs";

test("parseReportProgressArgs reads step and checkbox flags", () => {
	const args = parseReportProgressArgs([
		"--step",
		"2",
		"--checkboxes-complete",
		"3",
		"--checkboxes-total",
		"5",
	]);
	assert.equal(args.step, 2);
	assert.equal(args.checkboxesComplete, 3);
	assert.equal(args.checkboxesTotal, 5);
});

test("reportTaskProgress appends task.step_completed with metadata", () => {
	const projectRoot = fs.mkdtempSync(path.join(fs.realpathSync("."), "rp-"));
	const batchId = "20260602T120000";
	const events = [];

	const result = reportTaskProgress({
		projectRoot,
		batchId,
		taskId: "TP-036",
		laneNumber: 2,
		step: 1,
		checkboxesComplete: 2,
		checkboxesTotal: 4,
		correlationId: "corr-1",
		journal: {
			projectRoot,
			batchId,
			append: (_root, _id, type, options) => {
				const entry = {
					schemaVersion: 1,
					eventId: "evt-test-1",
					type,
					timestamp: new Date().toISOString(),
					batchId,
					taskId: options.taskId,
					laneId: "lane-2",
					correlationId: options.correlationId,
					payload: {
						step: options.step,
						checkboxesComplete: options.checkboxesComplete,
						checkboxesTotal: options.checkboxesTotal,
					},
				};
				events.push(entry);
				return entry;
			},
		},
	});

	assert.equal(result.ok, true);
	assert.equal(result.eventId, "evt-test-1");
	assert.equal(events.length, 1);
	assert.equal(events[0].type, "task.step_completed");
	assert.equal(events[0].taskId, "TP-036");
	assert.equal(events[0].laneId, "lane-2");
	assert.equal(events[0].payload.step, 1);
	assert.equal(events[0].payload.checkboxesComplete, 2);
	assert.equal(events[0].payload.checkboxesTotal, 4);

	fs.rmSync(projectRoot, { recursive: true, force: true });
});

test("reportTaskProgress writes journal line on disk", () => {
	const projectRoot = fs.mkdtempSync(path.join(fs.realpathSync("."), "rp-disk-"));
	const batchId = "20260602T130000";

	const result = reportTaskProgress({
		projectRoot,
		batchId,
		taskId: "TP-036",
		laneNumber: 1,
		step: 0,
		checkboxesComplete: 1,
		checkboxesTotal: 3,
	});

	assert.equal(result.ok, true);
	const events = readJournalEvents(projectRoot, batchId);
	assert.equal(events.length, 1);
	assert.equal(events[0].type, "task.step_completed");
	assert.equal(events[0].taskId, "TP-036");
	assert.equal(events[0].laneId, "lane-1");
	assert.equal(events[0].payload.step, 0);
	assert.ok(events[0].timestamp);

	fs.rmSync(projectRoot, { recursive: true, force: true });
});

test("reportTaskProgress fails closed without batch context", () => {
	const missingBatch = reportTaskProgress({
		projectRoot: "/tmp",
		batchId: "",
		taskId: "TP-036",
		step: 1,
	});
	assert.equal(missingBatch.ok, false);
	assert.match(missingBatch.error ?? "", /batch context/i);

	const missingRoot = reportTaskProgress({
		projectRoot: "",
		batchId: "20260602T120000",
		taskId: "TP-036",
		step: 1,
	});
	assert.equal(missingRoot.ok, false);
});

test("runSpineReportProgress returns non-zero when batchId missing", () => {
	const { exitCode, result } = runSpineReportProgress({
		args: ["--step", "1"],
		projectRoot: "/tmp",
		batchId: "",
		taskId: "TP-036",
	});
	assert.equal(exitCode, 1);
	assert.equal(result?.ok, false);
});
