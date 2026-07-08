import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const projectRoot = process.cwd();
const contextPath = path.join(projectRoot, "spine-tasks/CONTEXT.md");
const depsPath = path.join(projectRoot, "spine-tasks/dependencies.json");

const PHASE61_DONE = [
	"SP-530",
	"SP-531",
	"SP-532",
	"SP-533",
	"SP-534",
	"SP-535",
	"SP-536",
	"SP-538",
	"SP-537",
];

test("CONTEXT.md Phase 61 capstone tracking", () => {
	const content = fs.readFileSync(contextPath, "utf-8");
	assert.match(content, /\*\*Next Task ID:\*\* SP-539/);
	assert.match(content, /### Phase 61 — v1\.10\.0 release harness \(SP-HARNESS\)/);
	assert.match(
		content,
		/docs\/PRD-v1\.10\.0-release-harness-handoff\.md/,
		"Phase 61 must link PRD-v1.10.0 handoff",
	);
	for (const taskId of PHASE61_DONE) {
		assert.match(
			content,
			new RegExp(`\\| ${taskId} \\|[^\\n]*\\|\\s*Done`),
			`${taskId} should be Done in Phase 61 table`,
		);
	}
	assert.match(content, /Phase 61 exit criteria \(handoff §10\)/);
	assert.match(content, /CONTEXT Phase 61 complete; Next Task ID → SP-539/);
});

test("dependencies.json Phase 61 edges", () => {
	const deps = JSON.parse(fs.readFileSync(depsPath, "utf-8"));
	for (const taskId of PHASE61_DONE) {
		assert.ok(deps.tasks[taskId], `missing dependencies entry for ${taskId}`);
	}
	assert.deepEqual(deps.tasks["SP-531"], ["SP-530"]);
	assert.deepEqual(deps.tasks["SP-534"], ["SP-530", "SP-531"]);
	assert.deepEqual(deps.tasks["SP-536"], ["SP-388", "SP-535"]);
	assert.ok(deps.tasks["SP-537"].includes("SP-530"));
	assert.ok(deps.tasks["SP-537"].includes("SP-538"));
});
