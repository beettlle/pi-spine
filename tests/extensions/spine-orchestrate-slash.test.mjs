import assert from "node:assert/strict";
import test from "node:test";

import {
	formatOrchestratePrompt,
	parseSpineOrchestrateArgs,
} from "../../extensions/spine/slash-commands.ts";
import {
	commitPendingTasks,
	createSlashContext,
	ensureDependenciesJson,
	withGitProject,
	writeMinimalTask,
} from "./slash-harness.mjs";

function seedCommittedTask(projectRoot, taskId) {
	writeMinimalTask(projectRoot, taskId);
	ensureDependenciesJson(projectRoot);
	commitPendingTasks(projectRoot);
}

test("parseSpineOrchestrateArgs defaults to pending scope and wave 0", () => {
	assert.deepEqual(parseSpineOrchestrateArgs(""), { scope: "pending", fromWave: 0 });
	assert.deepEqual(parseSpineOrchestrateArgs("all"), { scope: "all", fromWave: 0 });
	assert.deepEqual(parseSpineOrchestrateArgs("pending --from-wave 2"), {
		scope: "pending",
		fromWave: 2,
	});
});

test("formatOrchestratePrompt includes wave tasks, outer loop, and skill link", () => {
	const prompt = formatOrchestratePrompt(
		{
			scope: { mode: "pending" },
			waves: [
				{ index: 0, taskIds: ["TP-001", "TP-002"] },
				{ index: 1, taskIds: ["TP-003"] },
			],
			tasks: {
				"TP-001": { title: "First" },
				"TP-002": { title: "Second" },
				"TP-003": { title: "Third" },
			},
		},
		{ scope: "pending", fromWave: 0 },
	);

	assert.match(prompt, /Wave 0 · 2 task\(s\)/);
	assert.match(prompt, /TP-001 — First/);
	assert.match(prompt, /TP-003 — Third/);
	assert.match(prompt, /Outer loop/i);
	assert.match(prompt, /spine batch start pending --wave W/);
	assert.doesNotMatch(prompt, /spine batch start pending --wave W --attached/);
	assert.match(prompt, /\/skill:spine-orchestrate-waves/);
	assert.match(prompt, /docs\/adoption\/agent-orchestrated-waves\.md/);
});

test("formatOrchestratePrompt states no auto gate approve or integrate", () => {
	const prompt = formatOrchestratePrompt(
		{
			waves: [{ index: 0, taskIds: ["TP-010"] }],
			tasks: { "TP-010": { title: "Smoke" } },
		},
		{ scope: "pending", fromWave: 0 },
	);

	assert.match(prompt, /NOT auto-run by \/spine-orchestrate/);
	assert.match(prompt, /does NOT auto-approve gates or auto-integrate/);
	assert.doesNotMatch(prompt, /spine gate approve\s*$/m);
});

test("formatOrchestratePrompt respects --from-wave filter", () => {
	const prompt = formatOrchestratePrompt(
		{
			waves: [
				{ index: 0, taskIds: ["TP-001"] },
				{ index: 1, taskIds: ["TP-002"] },
			],
			tasks: {
				"TP-001": { title: "Wave zero" },
				"TP-002": { title: "Wave one" },
			},
		},
		{ scope: "pending", fromWave: 1 },
	);

	assert.match(prompt, /starting at wave 1/);
	assert.match(prompt, /Next wave: 1 · TP-002 — Wave one/);
	assert.doesNotMatch(prompt, /TP-001 — Wave zero/);
});

test("formatOrchestratePrompt reports empty plan guidance", () => {
	const prompt = formatOrchestratePrompt(
		{
			waves: [],
			metadata: { tasksExcluded: 3 },
		},
		{ scope: "pending", fromWave: 0 },
	);

	assert.match(prompt, /0 wave\(s\)/);
	assert.match(prompt, /spine plan all/);
});

test("/spine-orchestrate emits structured prompt from spine plan", async () => {
	const { handlers, notifications, ctx } = createSlashContext();
	await withGitProject(async (projectRoot) => {
		writeMinimalTask(projectRoot, "TP-050");
		writeMinimalTask(projectRoot, "TP-051");
		ensureDependenciesJson(projectRoot, { "TP-051": ["TP-050"] });
		commitPendingTasks(projectRoot);

		await handlers.get("spine-orchestrate")("pending", ctx);
		assert.equal(notifications.length, 1);
		assert.equal(
			notifications[0].level,
			"info",
			`expected info prompt; got ${notifications[0].level}: ${notifications[0].message}`,
		);
		assert.match(notifications[0].message, /Spine multi-wave orchestration/);
		assert.match(notifications[0].message, /Outer loop/i);
		assert.match(notifications[0].message, /does NOT auto-approve gates or auto-integrate/);
		assert.match(notifications[0].message, /spine-orchestrate-waves/);
	});
});

test("/spine-orchestrate does not invoke gate or integrate CLI", async () => {
	const { handlers, notifications, ctx } = createSlashContext();
	await withGitProject(async (projectRoot) => {
		seedCommittedTask(projectRoot, "TP-060");

		await handlers.get("spine-orchestrate")("pending", ctx);
		assert.equal(notifications.length, 1);
		assert.equal(
			notifications[0].level,
			"info",
			`expected info prompt; got ${notifications[0].level}: ${notifications[0].message}`,
		);
		const message = notifications[0].message;
		assert.match(message, /gate approve.*NOT auto-run/i);
		assert.doesNotMatch(message, /^spine gate approve$/m);
		assert.doesNotMatch(message, /^spine integrate$/m);
	});
});

test("/spine-orchestrate fails when preflight fails", async () => {
	const { handlers, notifications, ctx } = createSlashContext();
	await withGitProject(async () => {
		await handlers.get("spine-orchestrate")("pending", ctx);
		assert.equal(notifications.length, 1);
		assert.equal(notifications[0].level, "error");
		assert.match(notifications[0].message, /preflight failed/i);
	});
});
