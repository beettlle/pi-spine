import assert from "node:assert/strict";
import test from "node:test";

import { formatPlanHuman } from "../../src/planner/format-plan.mjs";

test("formatPlanHuman shows serial lane as bullet list with titles", () => {
	const plan = {
		scope: { mode: "pending" },
		metadata: { tasksSelected: 3, tasksExcluded: 41 },
		laneConfig: { maxParallel: 3 },
		tasks: {
			"TP-044": { title: "Adoption fixture" },
			"TP-045": { title: "Coexistence guard" },
			"TP-046": { title: "Env overrides" },
		},
		waves: [
			{
				index: 1,
				taskIds: ["TP-044", "TP-045", "TP-046"],
				ticks: [{ index: 0, lanes: [["TP-044", "TP-045", "TP-046"], [], []] }],
			},
		],
	};

	const output = formatPlanHuman(plan);
	assert.match(output, /serial · 3 tasks \(overlapping file scope\)/);
	assert.match(output, /Lane 1 \(serial\):/);
	assert.match(output, /TP-044 — Adoption fixture/);
	assert.doesNotMatch(output, /Tick/);
});

test("formatPlanHuman shows parallel lanes and omits tick jargon", () => {
	const plan = {
		scope: { mode: "custom" },
		metadata: { tasksSelected: 2 },
		laneConfig: { maxParallel: 3 },
		tasks: {
			"TP-049": { title: "Runbook" },
			"TP-050": { title: "Spike" },
		},
		waves: [
			{
				index: 4,
				taskIds: ["TP-049", "TP-050"],
				ticks: [{ index: 0, lanes: [["TP-049"], ["TP-050"], []] }],
			},
		],
	};

	const output = formatPlanHuman(plan);
	assert.match(output, /2 tasks · 2 lanes in parallel/);
	assert.match(output, /Lane 1: TP-049 — Runbook/);
	assert.match(output, /Lane 2: TP-050 — Spike/);
	assert.doesNotMatch(output, /Tick/);
});

test("formatPlanHuman includes start hints for multi-wave plans", () => {
	const plan = {
		scope: { mode: "pending" },
		metadata: { tasksSelected: 2 },
		laneConfig: { maxParallel: 1 },
		tasks: {
			"TP-043": { title: "Install" },
			"TP-044": { title: "Fixture" },
		},
		waves: [
			{ index: 0, taskIds: ["TP-043"], ticks: [{ index: 0, lanes: [["TP-043"]] }] },
			{ index: 1, taskIds: ["TP-044"], ticks: [{ index: 0, lanes: [["TP-044"]] }] },
		],
	};

	const output = formatPlanHuman(plan);
	assert.match(output, /Start: spine batch start pending --wave 0/);
	assert.match(output, /Wave 1: spine batch start pending --wave 1/);
	assert.doesNotMatch(output, /Start: spine batch start TP-043/);
});
