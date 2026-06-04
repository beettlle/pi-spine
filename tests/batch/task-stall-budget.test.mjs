import assert from "node:assert/strict";
import test from "node:test";
import {
	parseTaskSizeFromMarkdown,
	resolveStallConfigForTask,
	resolveTaskStallMinutes,
	STALL_MINUTES_BY_SIZE,
} from "../../src/batch/task-stall-budget.mjs";

test("parseTaskSizeFromMarkdown reads Size line", () => {
	const md = "# Task: SP-001 — X\n\n**Size:** M\n\n## Mission\n";
	assert.equal(parseTaskSizeFromMarkdown(md), "M");
	assert.equal(parseTaskSizeFromMarkdown("# Task: SP-002 — Y\n"), null);
});

test("resolveTaskStallMinutes uses max of config and size floor", () => {
	assert.equal(resolveTaskStallMinutes("M", { lanes: { stallTimeoutMinutes: 60 } }), STALL_MINUTES_BY_SIZE.M);
	assert.equal(resolveTaskStallMinutes("S", { lanes: { stallTimeoutMinutes: 120 } }), 120);
	assert.equal(resolveTaskStallMinutes(null, { lanes: { stallTimeoutMinutes: 90 } }), 90);
});

test("resolveStallConfigForTask applies minutes to stallTimeoutMs", () => {
	const cfg = resolveStallConfigForTask({
		config: { lanes: { stallTimeoutMinutes: 60 } },
		taskSize: "L",
	});
	assert.equal(cfg.stallTimeoutMs, STALL_MINUTES_BY_SIZE.L * 60 * 1000);
});
