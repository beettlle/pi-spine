import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import test from "node:test";
import {
	buildAgentModelInheritDoctorCheck,
	buildReviewerPerTypePinsDoctorCheck,
	formatReviewerEffectivePins,
	readPiSettingsFile,
	resolvePiDefaultProvider,
	spineAgentsUseInherit,
} from "../../src/doctor/agent-model-inherit.mjs";

const PER_TYPE_CONFIG = {
	agents: {
		worker: { model: "cursor/auto", thinking: "high" },
		reviewer: {
			model: "google/gemini-3.1-pro-preview",
			thinking: "medium",
			plan: { model: "google/gemini-flash-latest", thinking: "low" },
			code: { model: "inherit", thinking: "inherit" },
		},
	},
};

test("spineAgentsUseInherit is true when worker or reviewer effective pin inherits", () => {
	assert.equal(
		spineAgentsUseInherit({ agents: { worker: { model: "inherit" }, reviewer: { model: "cursor/auto" } } }),
		true,
	);
	assert.equal(
		spineAgentsUseInherit({ agents: { worker: { model: "cursor/auto" }, reviewer: { model: "inherit" } } }),
		true,
	);
	assert.equal(
		spineAgentsUseInherit(PER_TYPE_CONFIG),
		false,
	);
	assert.equal(
		spineAgentsUseInherit({
			agents: {
				worker: { model: "cursor/auto" },
				reviewer: { model: "inherit", plan: { model: "google/gemini-flash-latest" } },
			},
		}),
		true,
	);
});

test("formatReviewerEffectivePins shows resolved per-type model and thinking", () => {
	const detail = formatReviewerEffectivePins(PER_TYPE_CONFIG);
	assert.match(detail, /plan=google\/gemini-flash-latest\/low/);
	assert.match(detail, /code=google\/gemini-3\.1-pro-preview\/medium/);
	assert.match(detail, /final=google\/gemini-3\.1-pro-preview\/medium/);
});

test("buildReviewerPerTypePinsDoctorCheck reports effective per-type pins", () => {
	const check = buildReviewerPerTypePinsDoctorCheck({ config: PER_TYPE_CONFIG });
	assert.equal(check.ok, true);
	assert.match(check.detail, /plan=google\/gemini-flash-latest\/low/);
	assert.match(check.label, /per-type/);
});

test("resolvePiDefaultProvider prefers project settings over global", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-pi-settings-"));
	const globalDir = await mkdtemp(path.join(os.tmpdir(), "spine-pi-global-"));
	const projectPiDir = path.join(projectRoot, ".pi");
	try {
		await writeFile(
			path.join(globalDir, "settings.json"),
			JSON.stringify({ defaultProvider: "cursor" }),
			"utf-8",
		);
		fs.mkdirSync(projectPiDir, { recursive: true });
		await writeFile(
			path.join(projectPiDir, "settings.json"),
			JSON.stringify({ defaultProvider: "lmstudio" }),
			"utf-8",
		);

		assert.equal(
			resolvePiDefaultProvider(projectRoot, {
				globalSettingsPath: path.join(globalDir, "settings.json"),
				projectSettingsPath: path.join(projectPiDir, "settings.json"),
			}),
			"lmstudio",
		);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
		await rm(globalDir, { recursive: true, force: true });
	}
});

test("buildAgentModelInheritDoctorCheck warns on inherit + lmstudio", () => {
	const check = buildAgentModelInheritDoctorCheck({
		config: {
			agents: {
				worker: { model: "inherit", thinking: "high" },
				reviewer: { model: "inherit", thinking: "medium" },
			},
		},
		resolveProvider: () => "lmstudio",
	});
	assert.equal(check.warning, true);
	assert.match(check.detail, /lmstudio/i);
	assert.match(check.detail, /plan=inherit\/medium/);
	assert.ok(check.suggestedCommand?.includes("agents.worker.model"));
});

test("buildAgentModelInheritDoctorCheck passes when models pinned", () => {
	const check = buildAgentModelInheritDoctorCheck({
		config: PER_TYPE_CONFIG,
		resolveProvider: () => "lmstudio",
	});
	assert.equal(check.warning, undefined);
	assert.match(check.detail, /pinned/);
	assert.match(check.detail, /plan=google\/gemini-flash-latest\/low/);
});

test("buildAgentModelInheritDoctorCheck passes when inherit but pi not lmstudio", () => {
	const check = buildAgentModelInheritDoctorCheck({
		config: { agents: { worker: { model: "inherit" } } },
		resolveProvider: () => "cursor",
	});
	assert.equal(check.warning, undefined);
	assert.match(check.detail, /cursor/);
});

test("readPiSettingsFile returns null for missing or invalid JSON", () => {
	assert.equal(readPiSettingsFile(path.join(os.tmpdir(), "nonexistent-pi-settings.json")), null);
});
