/**
 * SP-452 — Orchestrator poll interval defaults (GitHub #98).
 */

import assert from "node:assert/strict";
import test from "node:test";

import { validateSpineConfig } from "../../bin/spine-config.mjs";
import {
	DEFAULT_ATTACHED_MILESTONE_POLL_MS,
	DEFAULT_DASHBOARD_POLL_MS,
	DEFAULT_SEQUENCE_POLL_MS,
	resolveAttachedMilestonePollMs,
	resolveDashboardPollMs,
	resolveSequencePollMs,
	validateOrchestratorConfig,
} from "../../src/config/spine-config-schema.mjs";
import { waitForSequenceBatchTerminal } from "../../src/batch/sequence.mjs";

const BASE_CONFIG = {
	configVersion: 1,
	project: { name: "p", description: "" },
	paths: { tasksRoot: "tasks" },
	baseBranch: "main",
	testing: { build: "", test: "", testWithCoverage: "" },
	agents: {
		worker: { model: "inherit", thinking: "high" },
		reviewer: { model: "inherit", thinking: "medium" },
		supervisor: { model: "inherit", thinking: "off" },
	},
	lanes: { maxParallel: 1 },
	gates: { requireBeforeIntegrate: true, collectBuildEvidence: true, collectTestEvidence: true },
};

test("resolveAttachedMilestonePollMs defaults to 2000ms when config omitted", () => {
	assert.equal(resolveAttachedMilestonePollMs(), DEFAULT_ATTACHED_MILESTONE_POLL_MS);
	assert.equal(resolveAttachedMilestonePollMs({ config: {} }), 2_000);
});

test("resolveSequencePollMs defaults to 5000ms when config omitted", () => {
	assert.equal(resolveSequencePollMs(), DEFAULT_SEQUENCE_POLL_MS);
	assert.equal(resolveSequencePollMs({ config: {} }), 5_000);
});

test("resolveDashboardPollMs defaults to 2000ms when config omitted", () => {
	assert.equal(resolveDashboardPollMs(), DEFAULT_DASHBOARD_POLL_MS);
	assert.equal(resolveDashboardPollMs({ config: {} }), 2_000);
});

test("resolveAttachedMilestonePollMs honors orchestrator.attachedMilestonePollMs override", () => {
	assert.equal(
		resolveAttachedMilestonePollMs({ config: { orchestrator: { attachedMilestonePollMs: 750 } } }),
		750,
	);
});

test("resolveSequencePollMs honors orchestrator.sequencePollMs override", () => {
	assert.equal(resolveSequencePollMs({ config: { orchestrator: { sequencePollMs: 3_000 } } }), 3_000);
});

test("resolveDashboardPollMs honors orchestrator.dashboardPollMs override", () => {
	assert.equal(
		resolveDashboardPollMs({ config: { orchestrator: { dashboardPollMs: 4_000 } } }),
		4_000,
	);
});

test("validateOrchestratorConfig rejects invalid poll values", () => {
	assert.equal(validateOrchestratorConfig({ orchestrator: { attachedMilestonePollMs: 0 } })?.code, "CONFIG_ORCHESTRATOR_INVALID");
	assert.equal(validateOrchestratorConfig({ orchestrator: { sequencePollMs: -1 } })?.code, "CONFIG_ORCHESTRATOR_INVALID");
	assert.equal(validateOrchestratorConfig({ orchestrator: { dashboardPollMs: 1.5 } })?.code, "CONFIG_ORCHESTRATOR_INVALID");
	assert.equal(validateOrchestratorConfig({ orchestrator: "bad" })?.code, "CONFIG_ORCHESTRATOR_INVALID");
});

test("validateSpineConfig accepts orchestrator poll overrides", () => {
	const config = {
		...BASE_CONFIG,
		orchestrator: {
			attachedMilestonePollMs: 1500,
			sequencePollMs: 4000,
			dashboardPollMs: 2500,
		},
	};
	assert.equal(validateSpineConfig(config), null);
});

test("waitForSequenceBatchTerminal uses 5000ms default poll interval", () => {
	assert.equal(waitForSequenceBatchTerminal.length, 1);
	assert.equal(DEFAULT_SEQUENCE_POLL_MS, 5_000);
});
