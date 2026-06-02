import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import {
	executeSpineReportProgress,
	executeSpineRequestGate,
	registerSpineWorkerTools,
	spineReportProgressTool,
	spineRequestGateTool,
	spineReviewStepTool,
} from "../../extensions/spine/worker-tools.ts";

test("registerSpineWorkerTools registers all three PRD worker tools", () => {
	const registered = [];
	const pi = {
		registerTool(tool) {
			registered.push(tool);
		},
	};

	registerSpineWorkerTools(pi);

	assert.equal(registered.length, 3);
	assert.deepEqual(
		registered.map((t) => t.name).sort(),
		["spine_report_progress", "spine_request_gate", "spine_review_step"].sort(),
	);
	assert.equal(registered.find((t) => t.name === "spine_review_step"), spineReviewStepTool);
	assert.equal(registered.find((t) => t.name === "spine_report_progress"), spineReportProgressTool);
	assert.equal(registered.find((t) => t.name === "spine_request_gate"), spineRequestGateTool);
});

test("executeSpineReportProgress appends task.step_completed via tool handler", () => {
	const projectRoot = fs.mkdtempSync(path.join(fs.realpathSync("."), "wtrp-"));
	const batchId = "20260602T160000";
	const prev = {
		projectRoot: process.env.SPINE_PROJECT_ROOT,
		batchId: process.env.SPINE_BATCH_ID,
		taskId: process.env.SPINE_TASK_ID,
		laneNumber: process.env.SPINE_LANE_NUMBER,
	};
	process.env.SPINE_PROJECT_ROOT = projectRoot;
	process.env.SPINE_BATCH_ID = batchId;
	process.env.SPINE_TASK_ID = "TP-038";
	process.env.SPINE_LANE_NUMBER = "1";
	try {
		const result = executeSpineReportProgress({
			step: 2,
			checkboxesComplete: 3,
			checkboxesTotal: 5,
		});
		assert.equal(result.isError, false);
		assert.equal(result.details.ok, true);
		assert.ok(result.details.eventId);
		const events = readJournalEvents(projectRoot, batchId);
		assert.equal(events.length, 1);
		assert.equal(events[0].type, "task.step_completed");
		assert.equal(events[0].payload.step, 2);
	} finally {
		for (const [key, envKey] of [
			["projectRoot", "SPINE_PROJECT_ROOT"],
			["batchId", "SPINE_BATCH_ID"],
			["taskId", "SPINE_TASK_ID"],
			["laneNumber", "SPINE_LANE_NUMBER"],
		]) {
			const value = prev[key];
			if (value === undefined) delete process.env[envKey];
			else process.env[envKey] = value;
		}
		fs.rmSync(projectRoot, { recursive: true, force: true });
	}
});

test("executeSpineReportProgress fails closed without batch context", () => {
	const prev = {
		projectRoot: process.env.SPINE_PROJECT_ROOT,
		batchId: process.env.SPINE_BATCH_ID,
	};
	delete process.env.SPINE_PROJECT_ROOT;
	delete process.env.SPINE_BATCH_ID;
	try {
		const result = executeSpineReportProgress({ step: 1 });
		assert.equal(result.isError, true);
		assert.equal(result.details.ok, false);
		assert.match(result.content[0].text, /batch context/i);
	} finally {
		if (prev.projectRoot === undefined) delete process.env.SPINE_PROJECT_ROOT;
		else process.env.SPINE_PROJECT_ROOT = prev.projectRoot;
		if (prev.batchId === undefined) delete process.env.SPINE_BATCH_ID;
		else process.env.SPINE_BATCH_ID = prev.batchId;
	}
});

test("spine_request_gate tool returns structured not_supported shape", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "wt-gate-"));
	const prev = {
		projectRoot: process.env.SPINE_PROJECT_ROOT,
		batchId: process.env.SPINE_BATCH_ID,
	};
	process.env.SPINE_PROJECT_ROOT = root;
	process.env.SPINE_BATCH_ID = "20260602T170000";
	try {
		const result = await spineRequestGateTool.execute("tc-gate", { reason: "blocked" });
		assert.equal(result.isError, true);
		assert.equal(result.details.notSupported, true);
		assert.equal(result.details.suggestedCommand, "spine gate");
		const parsed = JSON.parse(result.content[0].text);
		assert.equal(parsed.notSupported, true);
		assert.equal(parsed.suggestedCommand, "spine gate");
	} finally {
		if (prev.projectRoot === undefined) delete process.env.SPINE_PROJECT_ROOT;
		else process.env.SPINE_PROJECT_ROOT = prev.projectRoot;
		if (prev.batchId === undefined) delete process.env.SPINE_BATCH_ID;
		else process.env.SPINE_BATCH_ID = prev.batchId;
		await rm(root, { recursive: true, force: true });
	}
});

test("executeSpineRequestGate fails closed without batch context", () => {
	const prev = {
		projectRoot: process.env.SPINE_PROJECT_ROOT,
		batchId: process.env.SPINE_BATCH_ID,
	};
	delete process.env.SPINE_PROJECT_ROOT;
	delete process.env.SPINE_BATCH_ID;
	try {
		const result = executeSpineRequestGate({});
		assert.equal(result.isError, true);
		assert.match(result.content[0].text, /batch context/i);
	} finally {
		if (prev.projectRoot === undefined) delete process.env.SPINE_PROJECT_ROOT;
		else process.env.SPINE_PROJECT_ROOT = prev.projectRoot;
		if (prev.batchId === undefined) delete process.env.SPINE_BATCH_ID;
		else process.env.SPINE_BATCH_ID = prev.batchId;
	}
});
