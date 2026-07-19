import test from "node:test";
import assert from "node:assert/strict";
import {
	substituteMatrixVariables,
	applyMatrixRowToSteps,
} from "../../src/planner/matrix.mjs";

test("substituteMatrixVariables: replaces every {matrix.<column>} with the row value", () => {
	const out = substituteMatrixVariables("run {matrix.run_id} on {matrix.lang}", {
		run_id: "node",
		lang: "browser",
	});
	assert.strictEqual(out, "run node on browser");
});

test("substituteMatrixVariables: replaces repeated references", () => {
	const out = substituteMatrixVariables("{matrix.run_id}/{matrix.run_id}.log", {
		run_id: "a",
	});
	assert.strictEqual(out, "a/a.log");
});

test("substituteMatrixVariables: substitutes empty string values", () => {
	const out = substituteMatrixVariables("[{matrix.v}]", { v: "" });
	assert.strictEqual(out, "[]");
});

test("substituteMatrixVariables: throws on unknown column", () => {
	assert.throws(
		() => substituteMatrixVariables("{matrix.missing}", { run_id: "a" }),
		/Unknown matrix variable reference: \{matrix\.missing\}/,
	);
});

test("substituteMatrixVariables: throws on any placeholder when no row is supplied", () => {
	// Fail-loud: a leftover {matrix.X} reaching execution without a row is an error.
	assert.throws(
		() => substituteMatrixVariables("{matrix.run_id}", null),
		/Unknown matrix variable reference/,
	);
	assert.throws(
		() => substituteMatrixVariables("{matrix.run_id}", undefined),
		/Unknown matrix variable reference/,
	);
});

test("substituteMatrixVariables: leaves non-matrix text unchanged when there is no row", () => {
	// The common non-matrix case: no placeholders, no row -> verbatim.
	assert.strictEqual(substituteMatrixVariables("plain text", null), "plain text");
	assert.strictEqual(substituteMatrixVariables("plain text", undefined), "plain text");
	assert.strictEqual(substituteMatrixVariables("plain text", {}), "plain text");
});

test("substituteMatrixVariables: leaves malformed or non-matrix braces literal", () => {
	const row = { run_id: "a", "with-dash": "b" };
	// Missing closing brace.
	assert.strictEqual(substituteMatrixVariables("{matrix.run_id", row), "{matrix.run_id");
	// Empty column name.
	assert.strictEqual(substituteMatrixVariables("{matrix.}", row), "{matrix.}");
	// Column name with a space (not matched by the identifier charset).
	assert.strictEqual(substituteMatrixVariables("{matrix.run id}", row), "{matrix.run id}");
	// Brace group without the matrix. prefix.
	assert.strictEqual(substituteMatrixVariables("{run_id}", row), "{run_id}");
});

test("substituteMatrixVariables: supports dash-separated column names", () => {
	assert.strictEqual(
		substituteMatrixVariables("{matrix.with-dash}", { "with-dash": "b" }),
		"b",
	);
});

test("substituteMatrixVariables: coerces non-string values to strings", () => {
	assert.strictEqual(substituteMatrixVariables("v={matrix.n}", { n: 7 }), "v=7");
});

test("applyMatrixRowToSteps: substitutes titles and bodies", () => {
	const steps = [
		{ number: 1, title: "Run {matrix.run_id}", body: "npm test -- {matrix.run_id}" },
		{ number: 2, title: "Static step", body: "no placeholders here" },
	];
	const out = applyMatrixRowToSteps(steps, { run_id: "node" });
	assert.strictEqual(out[0].title, "Run node");
	assert.strictEqual(out[0].body, "npm test -- node");
	// Untouched step passes through structurally unchanged.
	assert.strictEqual(out[1].title, "Static step");
	assert.strictEqual(out[1].body, "no placeholders here");
	// Original array is not mutated.
	assert.strictEqual(steps[0].title, "Run {matrix.run_id}");
});

test("applyMatrixRowToSteps: returns input unchanged when no row is supplied", () => {
	const steps = [{ number: 1, title: "x", body: "y" }];
	assert.strictEqual(applyMatrixRowToSteps(steps, null), steps);
	assert.strictEqual(applyMatrixRowToSteps(steps, undefined), steps);
	assert.strictEqual(applyMatrixRowToSteps(steps, {}), steps);
});

test("applyMatrixRowToSteps: propagates unknown-column errors from step bodies", () => {
	const steps = [{ number: 1, title: "x", body: "{matrix.missing}" }];
	assert.throws(() => applyMatrixRowToSteps(steps, { run_id: "a" }), /Unknown matrix variable/);
});
