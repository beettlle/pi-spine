import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import test from "node:test";

import {
	parseSettingPath,
	validateSettingValue,
} from "../../src/config/settings-fields.mjs";
import { buildSupervisorConfigDoctorCheck } from "../../src/doctor/supervisor.mjs";

test("supervisor settings paths are registered", () => {
	for (const settingPath of [
		"agents.supervisor.enabled",
		"agents.supervisor.model",
		"agents.supervisor.pollIntervalMs",
		"agents.supervisor.autoNudge",
	]) {
		const parsed = parseSettingPath(settingPath);
		assert.equal(parsed.ok, true, settingPath);
	}
});

test("agents.supervisor.enabled accepts booleans and CLI strings", () => {
	for (const [raw, expected] of [
		[true, true],
		[false, false],
		["true", true],
		["0", false],
	]) {
		const result = validateSettingValue("agents.supervisor.enabled", raw);
		assert.equal(result.ok, true, String(raw));
		if (result.ok) assert.equal(result.normalizedValue, expected);
	}
});

test("agents.supervisor.pollIntervalMs enforces minimum 1000ms", () => {
	const ok = validateSettingValue("agents.supervisor.pollIntervalMs", 30_000);
	assert.equal(ok.ok, true);
	if (ok.ok) assert.equal(ok.normalizedValue, 30_000);

	const low = validateSettingValue("agents.supervisor.pollIntervalMs", 500);
	assert.equal(low.ok, false);
	if (!low.ok) assert.match(low.error, />= 1000/);
});

test("agents.supervisor.model accepts inherit and optional empty", () => {
	const inherit = validateSettingValue("agents.supervisor.model", "inherit");
	assert.equal(inherit.ok, true);
	if (inherit.ok) assert.equal(inherit.normalizedValue, "inherit");

	const empty = validateSettingValue("agents.supervisor.model", "");
	assert.equal(empty.ok, true);
	if (empty.ok) assert.equal(empty.normalizedValue, "");
});

test("agents.supervisor.autoNudge accepts booleans", () => {
	const result = validateSettingValue("agents.supervisor.autoNudge", "false");
	assert.equal(result.ok, true);
	if (result.ok) assert.equal(result.normalizedValue, false);
});

test("buildSupervisorConfigDoctorCheck passes when disabled", () => {
	const check = buildSupervisorConfigDoctorCheck({
		config: { agents: { supervisor: { enabled: false } } },
	});
	assert.equal(check.ok, true);
	assert.match(check.detail, /disabled/i);
});

test("buildSupervisorConfigDoctorCheck fails when enabled and template missing", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-supervisor-doc-"));
	try {
		const check = buildSupervisorConfigDoctorCheck({
			projectRoot,
			config: { agents: { supervisor: { enabled: true, model: "inherit" } } },
		});
		assert.equal(check.ok, false);
		assert.match(check.detail, /supervisor\.md missing/i);
		assert.equal(check.suggestedCommand, "spine init");
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("buildSupervisorConfigDoctorCheck fails when enabled and model invalid", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-supervisor-doc-"));
	const agentDir = path.join(projectRoot, ".spine", "agents");
	try {
		fs.mkdirSync(agentDir, { recursive: true });
		await writeFile(path.join(agentDir, "supervisor.md"), "# supervisor\n", "utf-8");

		const check = buildSupervisorConfigDoctorCheck({
			projectRoot,
			config: {
				agents: { supervisor: { enabled: true, model: "not-a-valid-model-id" } },
			},
		});
		assert.equal(check.ok, false);
		assert.match(check.detail, /invalid/i);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("buildSupervisorConfigDoctorCheck passes when enabled with template and valid model", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-supervisor-doc-"));
	const agentDir = path.join(projectRoot, ".spine", "agents");
	try {
		fs.mkdirSync(agentDir, { recursive: true });
		await writeFile(path.join(agentDir, "supervisor.md"), "# supervisor\n", "utf-8");

		const check = buildSupervisorConfigDoctorCheck({
			projectRoot,
			config: {
				agents: {
					supervisor: {
						enabled: true,
						model: "cursor/auto",
						pollIntervalMs: 45_000,
					},
				},
			},
		});
		assert.equal(check.ok, true);
		assert.match(check.detail, /enabled/);
		assert.match(check.detail, /cursor\/auto/);
		assert.match(check.detail, /45000/);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});
