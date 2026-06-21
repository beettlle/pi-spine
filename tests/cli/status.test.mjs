import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { runSpineStatus } from "../../bin/spine-status.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const FIXTURES = path.join(process.cwd(), "tests/fixtures/batch-state");

function loadFixture(name) {
	return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), "utf-8"));
}

function writePiBatchState(projectRoot, fixture) {
	fs.mkdirSync(path.join(projectRoot, ".pi"), { recursive: true });
	fs.writeFileSync(
		path.join(projectRoot, ".pi", "batch-state.json"),
		JSON.stringify(fixture, null, 2),
		"utf-8",
	);
}

test("spine status prints macro phase for idle repo", async () => {
	const projectRoot = await initGitRepo("spine-status-macro-");
	try {
		const { output } = runSpineStatus({ projectRoot });
		assert.match(output, /Macro phase:\s+Idle/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("spine status prints macro phase for active batch", async () => {
	const projectRoot = await initGitRepo("spine-status-macro-");
	try {
		writePiBatchState(projectRoot, loadFixture("running-batch.json"));
		const { output } = runSpineStatus({ projectRoot });
		assert.match(output, /Macro phase:\s+Executing/);
		assert.match(output, /Diagnosis:\s+running/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("spine status --diagnose verbose signals include macroPhase", async () => {
	const projectRoot = await initGitRepo("spine-status-macro-");
	try {
		writePiBatchState(projectRoot, loadFixture("needs-retry-batch.json"));
		const { output } = runSpineStatus({ projectRoot, diagnose: true });
		assert.match(output, /Macro phase:\s+Failed/);
		assert.match(output, /"macroPhase":\s*"failed"/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("spine status --json includes macroPhase fields", async () => {
	const projectRoot = await initGitRepo("spine-status-macro-");
	try {
		writePiBatchState(projectRoot, loadFixture("running-batch.json"));
		const { output } = runSpineStatus({ projectRoot, json: true });
		const parsed = JSON.parse(output);
		assert.equal(parsed.macroPhase, "executing");
		assert.equal(parsed.macroPhaseLabel, "Executing");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
