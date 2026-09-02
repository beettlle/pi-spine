import test from "node:test";
import assert from "node:assert/strict";
import {
	substituteMatrixVariables,
	applyMatrixRowToSteps,
	applyMatrixRowToPrompt,
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

/**
 * Raw PROMPT.md fixture exercising every region an LLM matrix row consumes:
 * steps, the Contract table, and the File Scope section (#232).
 *
 * @param {string} taskId
 */
function llmMatrixPromptDoc(taskId) {
	return `# Task: ${taskId} — LLM matrix
**Size:** S
**Type:** llm

## Mission
Write the {matrix.region} report.

## Dependencies
**None**

## File Scope
- \`out/{matrix.run_id}.txt\`

## Matrix
| run_id | region |
|--------|--------|
| a | us-east-1 |
| b | eu-west-1 |

## Steps
### Step 1: Report for {matrix.region}

- [ ] Write out/{matrix.run_id}.txt

## Contract
| Field | Value |
|-------|-------|
| fileScopeMustChange | \`out/{matrix.run_id}.txt\` |
| testCommand | \`test -f out/{matrix.run_id}.txt\` |

## Testing
Each row writes its own report.

## Completion Criteria
- [ ] Report written

## Do NOT
- Touch other rows' outputs
`;
}

test("applyMatrixRowToPrompt: substitutes steps, contract fields, and File Scope in one pass", () => {
	const out = applyMatrixRowToPrompt(llmMatrixPromptDoc("TP-1"), {
		run_id: "a",
		region: "us-east-1",
	});
	assert.match(out, /### Step 1: Report for us-east-1/);
	assert.match(out, /- \[ \] Write out\/a\.txt/);
	assert.match(out, /fileScopeMustChange \| `out\/a\.txt`/);
	assert.match(out, /testCommand \| `test -f out\/a\.txt`/);
	assert.match(out, /- `out\/a\.txt`/);
	assert.match(out, /Write the us-east-1 report\./);
	assert.doesNotMatch(out, /\{matrix\./);
});

test("applyMatrixRowToPrompt: different rows yield different documents", () => {
	const a = applyMatrixRowToPrompt(llmMatrixPromptDoc("TP-1"), { run_id: "a", region: "us-east-1" });
	const b = applyMatrixRowToPrompt(llmMatrixPromptDoc("TP-1"), { run_id: "b", region: "eu-west-1" });
	assert.notEqual(a, b);
	assert.match(b, /### Step 1: Report for eu-west-1/);
	assert.match(b, /Write out\/b\.txt/);
	assert.doesNotMatch(b, /\{matrix\./);
	// The authored Matrix table survives substitution intact in both documents.
	assert.match(a, /\| b \| eu-west-1 \|/);
	assert.match(b, /\| a \| us-east-1 \|/);
});

test("applyMatrixRowToPrompt: returns input unchanged when no row or empty row", () => {
	const doc = llmMatrixPromptDoc("TP-1");
	assert.strictEqual(applyMatrixRowToPrompt(doc, null), doc);
	assert.strictEqual(applyMatrixRowToPrompt(doc, undefined), doc);
	assert.strictEqual(applyMatrixRowToPrompt(doc, {}), doc);
});

test("applyMatrixRowToPrompt: fails loud on unknown column references", () => {
	assert.throws(
		() => applyMatrixRowToPrompt(llmMatrixPromptDoc("TP-1"), { run_id: "a" }),
		/Unknown matrix variable reference: \{matrix\.region\}/,
	);
});

test("applyMatrixRowToPrompt: passes non-string input through unchanged", () => {
	assert.strictEqual(applyMatrixRowToPrompt(null, { run_id: "a" }), null);
	assert.strictEqual(applyMatrixRowToPrompt(undefined, { run_id: "a" }), undefined);
});
