import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { loadSpineConfig, loadSpineConfigFile } from "../../bin/spine-config.mjs";
import { runInit } from "../../bin/spine-init.mjs";
import { applyConfigDefaults } from "../../src/config/merge-defaults.mjs";
import {
	CONFIG_V2_SECTION_DEFAULTS,
	HANDOFF_DEFAULTS,
	METRICS_DEFAULTS,
	REVIEW_DEFAULTS,
} from "../../src/config/defaults.mjs";

test("CONFIG_V2_SECTION_DEFAULTS match handoff §6.2", () => {
	assert.deepEqual(REVIEW_DEFAULTS, {
		requireFinalVerdict: true,
		maxFinalAttempts: 3,
		maxCodeReviewAttempts: null,
		maxPlanReviewAttempts: null,
	});
	assert.deepEqual(HANDOFF_DEFAULTS, {
		path: ".spine/handoff.md",
		autoWriteOn: ["session_start"],
	});
	assert.deepEqual(METRICS_DEFAULTS, { enabled: true, path: ".spine/run-metrics.jsonl" });
	assert.deepEqual(CONFIG_V2_SECTION_DEFAULTS.review, REVIEW_DEFAULTS);
});

test("applyConfigDefaults merges missing v2 sections without overwriting existing keys", () => {
	const config = {
		review: { requireFinalVerdict: false },
		handoff: { path: "custom.md" },
	};
	applyConfigDefaults(config);
	assert.equal(config.review.requireFinalVerdict, false);
	assert.equal(config.review.maxFinalAttempts, 3);
	assert.equal(config.handoff.path, "custom.md");
	assert.deepEqual(config.handoff.autoWriteOn, ["session_start"]);
	assert.equal(config.metrics.enabled, true);
	assert.equal(config.metrics.path, ".spine/run-metrics.jsonl");
});

test("applyConfigDefaults keeps per-phase review caps unset so they inherit maxFinalAttempts (SP-725)", () => {
	// Existing configs that only tune maxFinalAttempts must keep identical code/plan caps.
	const config = { review: { maxFinalAttempts: 5 } };
	applyConfigDefaults(config);
	assert.equal(config.review.maxCodeReviewAttempts, null);
	assert.equal(config.review.maxPlanReviewAttempts, null);
	assert.equal(config.review.maxFinalAttempts, 5);

	// Explicit per-phase caps survive the merge untouched.
	const tuned = { review: { maxFinalAttempts: 5, maxCodeReviewAttempts: 1, maxPlanReviewAttempts: 2 } };
	applyConfigDefaults(tuned);
	assert.equal(tuned.review.maxCodeReviewAttempts, 1);
	assert.equal(tuned.review.maxPlanReviewAttempts, 2);
	assert.equal(tuned.review.maxFinalAttempts, 5);
});

test("loadSpineConfig merges defaults for legacy config missing v2 keys", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-config-v2-"));
	try {
		fs.mkdirSync(path.join(projectRoot, ".spine"), { recursive: true });
		fs.writeFileSync(
			path.join(projectRoot, ".spine", "spine-config.json"),
			JSON.stringify(
				{
					configVersion: 1,
					project: { name: "legacy", description: "" },
					paths: { tasksRoot: "spine-tasks" },
					baseBranch: "main",
					testing: { build: "npm test", test: "npm test", testWithCoverage: "" },
					agents: {
						worker: { model: "inherit", thinking: "high" },
						reviewer: { model: "inherit", thinking: "medium" },
						supervisor: { model: "inherit", thinking: "off" },
					},
					lanes: { maxParallel: 1 },
					gates: {
						requireBeforeIntegrate: true,
						collectBuildEvidence: true,
						collectTestEvidence: true,
					},
				},
				null,
				2,
			),
			"utf-8",
		);

		const loaded = loadSpineConfig(projectRoot);
		assert.equal(loaded.error, null);
		assert.equal(loaded.config.review.requireFinalVerdict, true);
		assert.equal(loaded.config.handoff.path, ".spine/handoff.md");
		assert.equal(loaded.config.metrics.enabled, true);

		const fileOnly = loadSpineConfigFile(projectRoot);
		assert.equal(fileOnly.config.review, undefined);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("init scaffold includes v2 config sections from template", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-init-v2-"));
	try {
		const result = runInit(projectRoot, ["--dry-run"]);
		assert.equal(result.ok, true);
		assert.equal(result.config.review.requireFinalVerdict, true);
		assert.equal(result.config.handoff.path, ".spine/handoff.md");
		assert.equal(result.config.metrics.path, ".spine/run-metrics.jsonl");
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});
