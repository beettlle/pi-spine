import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const projectRoot = process.cwd();
const contextPath = path.join(projectRoot, "spine-tasks/CONTEXT.md");
const depsPath = path.join(projectRoot, "spine-tasks/dependencies.json");

const PHASE59_DONE = [
	"SP-511",
	"SP-512",
	"SP-513",
	"SP-514",
	"SP-515",
	"SP-516",
	"SP-517",
	"SP-518",
	"SP-519",
	"SP-520",
];

const PHASE59_STAGED = ["SP-442", "SP-445", "SP-446", "SP-447", "SP-448", "SP-449"];

test("CONTEXT.md Phase 59 capstone tracking", () => {
	const content = fs.readFileSync(contextPath, "utf-8");
	assert.match(content, /\*\*Next Task ID:\*\* SP-521/);
	assert.match(content, /#### Phase 59 — v1.8.1 reconciliation epic \(SP-REC\)/);
	assert.match(
		content,
		/docs\/PRD-v1\.8\.1-reconciliation-handoff\.md/,
		"Phase 59 must link PRD-v1.8.1 handoff",
	);
	for (const taskId of PHASE59_DONE) {
		assert.match(
			content,
			new RegExp(`\\| ${taskId} \\|[^\\n]*\\|\\s*\\*\\*Done\\*\\*`),
			`${taskId} should be Done in Phase 59 table`,
		);
	}
	for (const taskId of PHASE59_STAGED) {
		assert.match(
			content,
			new RegExp(`\\| ${taskId} \\|[^\\n]*\\|\\s*\\*\\*Staged\\*\\*`),
			`${taskId} should remain Staged in Phase 59 table`,
		);
	}
	assert.match(content, /Phase 59 exit criteria \(handoff §10\)/);
	assert.match(content, /CONTEXT Phase 59 complete; Next Task ID → SP-521/);
});

test("dependencies.json Phase 59 edges", () => {
	const deps = JSON.parse(fs.readFileSync(depsPath, "utf-8"));
	for (const taskId of PHASE59_DONE) {
		assert.ok(deps.tasks[taskId], `missing dependencies entry for ${taskId}`);
	}
	assert.deepEqual(deps.tasks["SP-520"], [
		"SP-511",
		"SP-512",
		"SP-513",
		"SP-514",
		"SP-515",
		"SP-516",
		"SP-517",
		"SP-518",
		"SP-519",
	]);
});
