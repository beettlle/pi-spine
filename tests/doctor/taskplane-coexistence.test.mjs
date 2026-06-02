import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { runBatchPreflight } from "../../bin/spine-preflight.mjs";
import { runDoctorChecks } from "../../bin/spine.mjs";
import {
	assessOrchestratorCoexistence,
	buildCoexistenceDoctorCheck,
	buildCoexistencePreflightCheck,
	classifyBatchStateSource,
	inferBatchStateSourceFromRaw,
} from "../../src/doctor/coexistence.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURES = path.join(REPO_ROOT, "tests/fixtures/batch-state");

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

function writeSpineBatchState(projectRoot, fixture) {
	fs.mkdirSync(path.join(projectRoot, ".spine"), { recursive: true });
	fs.writeFileSync(
		path.join(projectRoot, ".spine", "batch-state.json"),
		JSON.stringify(fixture, null, 2),
		"utf-8",
	);
}

test("classifyBatchStateSource uses path and content markers", () => {
	const spinePath = path.join(REPO_ROOT, ".spine", "batch-state.json");
	const piPath = path.join(REPO_ROOT, ".pi", "batch-state.json");

	assert.equal(classifyBatchStateSource(spinePath), "spine");
	assert.equal(classifyBatchStateSource(piPath), "taskplane");
	assert.equal(
		inferBatchStateSourceFromRaw({ phase: "executing", batchId: "x" }),
		"taskplane",
	);
	assert.equal(
		inferBatchStateSourceFromRaw({
			schemaVersion: 1,
			phase: "running",
			wavePlan: [],
			batchId: "x",
		}),
		"spine",
	);
});

test("assessOrchestratorCoexistence passes when no batch-state files", async () => {
	const projectRoot = await initGitRepo("spine-coexist-");
	try {
		const assessment = assessOrchestratorCoexistence({ projectRoot });
		assert.equal(assessment.ok, true);
		assert.equal(assessment.kind, "none");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("assessOrchestratorCoexistence fails on active Taskplane batch in .pi", async () => {
	const projectRoot = await initGitRepo("spine-coexist-");
	try {
		writePiBatchState(projectRoot, loadFixture("taskplane-executing.json"));

		const assessment = assessOrchestratorCoexistence({ projectRoot });
		assert.equal(assessment.ok, false);
		assert.equal(assessment.kind, "taskplane_active");
		assert.equal(assessment.suggestedCommand, "spine batch dismiss");
		assert.equal(assessment.taskplane?.source, "taskplane");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("assessOrchestratorCoexistence fails when spine and Taskplane batches both active", async () => {
	const projectRoot = await initGitRepo("spine-coexist-");
	try {
		writeSpineBatchState(projectRoot, {
			schemaVersion: 1,
			batchId: "20260602T130000",
			phase: "running",
			baseBranch: "main",
			orchBranch: "orch/spine-20260602T130000",
			startedAt: Date.now(),
			endedAt: null,
			wavePlan: [{ waveIndex: 0, taskIds: ["TP-001"] }],
			resilience: { resumeForced: false },
			tasks: [{ taskId: "TP-001", status: "running", taskFolder: "TP-001-a" }],
			segments: [],
			mergeResults: [],
		});
		writePiBatchState(projectRoot, loadFixture("taskplane-executing.json"));

		const assessment = assessOrchestratorCoexistence({ projectRoot });
		assert.equal(assessment.ok, false);
		assert.equal(assessment.kind, "dual_active");
		assert.match(assessment.message, /both active/i);
		assert.equal(assessment.spine?.source, "spine");
		assert.equal(assessment.taskplane?.source, "taskplane");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("buildCoexistencePreflightCheck blocks spine start when Taskplane batch active", async () => {
	const projectRoot = await initGitRepo("spine-coexist-");
	try {
		writePiBatchState(projectRoot, loadFixture("taskplane-executing.json"));

		const check = buildCoexistencePreflightCheck({ projectRoot });
		assert.equal(check.ok, false);
		assert.equal(check.id, "orchestrator-coexistence");
		assert.equal(check.suggestedCommand, "spine batch dismiss");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("runBatchPreflight fails with orchestrator-coexistence when Taskplane batch active", async () => {
	const projectRoot = await initGitRepo("spine-coexist-");
	try {
		writePiBatchState(projectRoot, loadFixture("taskplane-executing.json"));

		const result = runBatchPreflight({ projectRoot, skipDoctor: true });
		assert.equal(result.ok, false);
		const coexist = result.checks.find((check) => check.id === "orchestrator-coexistence");
		assert.ok(coexist);
		assert.equal(coexist.ok, false);
		assert.equal(coexist.suggestedCommand, "spine batch dismiss");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("runDoctorChecks reports mutual exclusion failure for Taskplane batch", async () => {
	const projectRoot = await initGitRepo("spine-coexist-");
	try {
		writePiBatchState(projectRoot, loadFixture("taskplane-executing.json"));

		const result = runDoctorChecks(projectRoot);
		assert.equal(result.ok, false);
		const coexist = result.checks.find(
			(check) => check.label === "Taskplane / pi-spine mutual exclusion",
		);
		assert.ok(coexist);
		assert.equal(coexist.ok, false);
		assert.equal(coexist.suggestedCommand, "spine batch dismiss");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("buildCoexistenceDoctorCheck passes when only pi-spine batch is active", async () => {
	const projectRoot = await initGitRepo("spine-coexist-");
	try {
		writeSpineBatchState(projectRoot, {
			schemaVersion: 1,
			batchId: "20260602T140000",
			phase: "running",
			baseBranch: "main",
			orchBranch: "orch/spine-20260602T140000",
			startedAt: Date.now(),
			endedAt: null,
			wavePlan: [],
			resilience: {},
			tasks: [{ taskId: "TP-001", status: "running" }],
			segments: [],
			mergeResults: [],
		});

		const check = buildCoexistenceDoctorCheck({ projectRoot });
		assert.equal(check.ok, true);
		assert.match(check.detail, /pi-spine batch only/i);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
