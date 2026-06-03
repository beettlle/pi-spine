import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
	getStepProgress,
	listIncompleteSteps,
	parseStatus,
} from "../../src/tasks/packet/index.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_ROOT = path.join(__dirname, "../../test/fixtures/taskplane");

test("parseStatus mirrors step numbers and checkbox state", () => {
	const markdown = fs.readFileSync(
		path.join(FIXTURES_ROOT, "FX-001-simple-fix/STATUS.md"),
		"utf-8",
	);
	const status = parseStatus(markdown);

	assert.equal(status.header["Current Step"], "Step 1: Implement");
	assert.equal(status.steps.length, 3);
	assert.equal(status.steps[0].statusKind, "complete");
	assert.equal(status.steps[0].checkboxes[0].checked, true);
	assert.equal(status.steps[1].statusKind, "in-progress");
	assert.equal(status.steps[1].checkboxes[0].checked, false);
});

test("getStepProgress aggregates checkbox completion", () => {
	const markdown = fs.readFileSync(
		path.join(FIXTURES_ROOT, "FX-003-large-planner/STATUS.md"),
		"utf-8",
	);
	const progress = getStepProgress(parseStatus(markdown));

	assert.equal(progress.total, 7);
	assert.equal(progress.completed, 0);
	assert.equal(progress.percent, 0);
});

test("listIncompleteSteps returns unchecked items per step", () => {
	const markdown = fs.readFileSync(
		path.join(FIXTURES_ROOT, "FX-001-simple-fix/STATUS.md"),
		"utf-8",
	);
	const incomplete = listIncompleteSteps(parseStatus(markdown));

	assert.equal(incomplete.length, 2);
	assert.equal(incomplete[0].number, 1);
	assert.equal(incomplete[0].unchecked[0].text, "Write code");
});
