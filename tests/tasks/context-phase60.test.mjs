import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const projectRoot = process.cwd();
const contextPath = path.join(projectRoot, "spine-tasks/CONTEXT.md");
const depsPath = path.join(projectRoot, "spine-tasks/dependencies.json");

const PHASE60_DONE = [
	"SP-522",
	"SP-523",
	"SP-524",
	"SP-525",
	"SP-526",
	"SP-527",
	"SP-528",
	"SP-529",
];

test("CONTEXT.md Phase 60 capstone tracking", () => {
	const content = fs.readFileSync(contextPath, "utf-8");
	assert.match(content, /### Phase 60 — v1\.9\.0 contract guardrails \(SP-CTR\)/);
	assert.match(
		content,
		/docs\/PRD-v1\.9\.0-contract-guardrails-handoff\.md/,
		"Phase 60 must link PRD-v1.9.0 handoff",
	);
	for (const taskId of PHASE60_DONE) {
		assert.match(
			content,
			new RegExp(`\\| ${taskId} \\|[^\\n]*\\|\\s*Done`),
			`${taskId} should be Done in Phase 60 table`,
		);
	}
	assert.match(content, /Phase 60 exit criteria \(handoff §10\)/);
	assert.match(content, /CONTEXT Phase 60 complete; Next Task ID → SP-530/);
});

test("dependencies.json Phase 60 edges", () => {
	const deps = JSON.parse(fs.readFileSync(depsPath, "utf-8"));
	for (const taskId of PHASE60_DONE) {
		assert.ok(deps.tasks[taskId], `missing dependencies entry for ${taskId}`);
	}
	assert.deepEqual(deps.tasks["SP-523"], ["SP-522"]);
	assert.deepEqual(deps.tasks["SP-526"], ["SP-478"]);
	assert.deepEqual(deps.tasks["SP-527"], ["SP-373"]);
	assert.ok(deps.tasks["SP-529"].includes("SP-522"));
	assert.ok(deps.tasks["SP-529"].includes("SP-528"));
});
