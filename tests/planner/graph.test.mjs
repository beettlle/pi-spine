import assert from "node:assert/strict";
import test from "node:test";

import { buildGraph, topoWaves } from "../../src/planner/graph.mjs";
import { findCyclePath } from "../../src/planner/cycles.mjs";

test("topoWaves groups tasks into deterministic dependency waves", () => {
	// A and B have no deps; C depends on both; D depends on C.
	const depsByTask = {
		A: [],
		B: [],
		C: ["A", "B"],
		D: ["C"],
	};

	const graph = buildGraph(depsByTask);
	const { waves, remainingWithDeps } = topoWaves(graph);

	assert.deepEqual(remainingWithDeps, []);
	assert.deepEqual(waves, [["A", "B"], ["C"], ["D"]]);
});

test("buildGraph includes nodes that only appear as dependencies", () => {
	const depsByTask = {
		"TP-100": ["TP-999"],
	};
	const graph = buildGraph(depsByTask);
	assert.deepEqual(graph.nodes, ["TP-100", "TP-999"]);
	assert.deepEqual(graph.depsByTask["TP-999"], []);
});

test("findCyclePath returns a closed cycle path", () => {
	const depsByTask = {
		A: ["B"],
		B: ["C"],
		C: ["A"],
	};
	const graph = buildGraph(depsByTask);
	const cycle = findCyclePath(graph);
	assert.ok(cycle);
	assert.equal(cycle[0], cycle[cycle.length - 1]);
	assert.equal(new Set(cycle.slice(0, -1)).size, 3);
});
