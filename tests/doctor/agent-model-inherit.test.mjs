import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import test from "node:test";
import {
	buildAgentModelInheritDoctorCheck,
	readPiSettingsFile,
	resolvePiDefaultProvider,
	spineAgentsUseInherit,
} from "../../src/doctor/agent-model-inherit.mjs";

test("spineAgentsUseInherit is true when worker or reviewer uses inherit", () => {
	assert.equal(
		spineAgentsUseInherit({ agents: { worker: { model: "inherit" }, reviewer: { model: "cursor/auto" } } }),
		true,
	);
	assert.equal(
		spineAgentsUseInherit({ agents: { worker: { model: "cursor/auto" }, reviewer: { model: "inherit" } } }),
		true,
	);
	assert.equal(
		spineAgentsUseInherit({ agents: { worker: { model: "cursor/auto" }, reviewer: { model: "cursor/auto" } } }),
		false,
	);
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
	assert.ok(check.suggestedCommand?.includes("agents.worker.model"));
});

test("buildAgentModelInheritDoctorCheck passes when models pinned", () => {
	const check = buildAgentModelInheritDoctorCheck({
		config: {
			agents: {
				worker: { model: "cursor/auto", thinking: "high" },
				reviewer: { model: "cursor/auto", thinking: "medium" },
			},
		},
		resolveProvider: () => "lmstudio",
	});
	assert.equal(check.warning, undefined);
	assert.match(check.detail, /pinned|inherit not used/);
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
