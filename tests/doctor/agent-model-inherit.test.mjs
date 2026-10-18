import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import test from "node:test";
import { runDoctorChecks } from "../../bin/spine.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";
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

// ---------------------------------------------------------------------------
// SP-832 / #355 — effective reviewer per worker pairing
// ---------------------------------------------------------------------------

const PAIRING_CONFIG = {
	agents: {
		activeProfile: "main",
		worker: { model: "anthropic/claude-sonnet-5-5" },
		reviewer: { model: "google/gemini-2.5-pro", thinking: "medium" },
		quotaFallbackProfile: "gem4",
		escalatePolicy: { enabled: true, toProfile: "hard" },
		profiles: {
			main: { worker: { model: "anthropic/claude-sonnet-5-5" } },
			gem4: { worker: { model: "google/gemini-4-argon" } },
			hard: { worker: { model: "zai/glm-5.3-flash" } },
		},
	},
};

test("buildReviewerPerTypePinsDoctorCheck lists active, quota fallback, and escalate pairings", () => {
	const check = buildReviewerPerTypePinsDoctorCheck({
		config: {
			...PAIRING_CONFIG,
			agents: { ...PAIRING_CONFIG.agents, reviewerProfile: "rev", profiles: {
				...PAIRING_CONFIG.agents.profiles,
				rev: { reviewer: { model: "kimi-coding/k3", thinking: "high" } },
			} },
		},
	});
	assert.equal(check.ok, true);
	assert.match(check.detail, /main: worker=anthropic\/claude-sonnet-5-5 → plan=kimi-coding\/k3\/high, code=kimi-coding\/k3\/high, final=kimi-coding\/k3\/high/);
	assert.match(check.detail, /gem4: worker=google\/gemini-4-argon → plan=kimi-coding\/k3\/high/);
	assert.match(check.detail, /hard: worker=zai\/glm-5\.3-flash → plan=kimi-coding\/k3\/high/);
});

test("buildReviewerPerTypePinsDoctorCheck fails when a gemini worker is paired with a gemini reviewer", () => {
	const check = buildReviewerPerTypePinsDoctorCheck({ config: PAIRING_CONFIG });
	assert.equal(check.ok, false);
	assert.match(check.detail, /gem4: worker=google\/gemini-4-argon → plan=google\/gemini-2\.5-pro\/medium/);
	assert.match(check.detail, /gem4: plan reviewer blocked \(same_model_family\)/);
	assert.doesNotMatch(check.detail, /main: \w+ reviewer blocked/);
	assert.equal(check.suggestedCommand, "spine settings set agents.reviewerProfile <name>");
});

test("buildReviewerPerTypePinsDoctorCheck fails the active pairing when the active worker shares the reviewer family", () => {
	const check = buildReviewerPerTypePinsDoctorCheck({
		config: {
			agents: {
				worker: { model: "google/gemini-4-argon" },
				reviewer: { model: "google/gemini-2.5-pro" },
			},
		},
	});
	assert.equal(check.ok, false);
	assert.match(check.detail, /default: worker=google\/gemini-4-argon/);
});

test("buildReviewerPerTypePinsDoctorCheck reports warnings without failing", () => {
	const check = buildReviewerPerTypePinsDoctorCheck({
		config: {
			agents: {
				worker: { model: "cursor/auto" },
				reviewer: { model: "google/gemini-2.5-pro" },
				reviewerProfile: "empty",
				profiles: { empty: {} },
			},
		},
	});
	assert.equal(check.ok, true);
	assert.equal(check.warning, true);
	assert.match(check.detail, /reviewer profile "empty" has no reviewer block; falling back/);
});

test("buildReviewerPerTypePinsDoctorCheck dedupes pairings and omits unset fallback/escalate", () => {
	const check = buildReviewerPerTypePinsDoctorCheck({ config: PER_TYPE_CONFIG });
	assert.equal(check.detail.split("worker=").length - 1, 1);
});

test("runDoctorChecks (and so preflight) fails on a same-family worker/reviewer pairing", async () => {
	const projectRoot = await initGitRepo("spine-reviewer-family-");
	try {
		const configPath = path.join(projectRoot, ".spine", "spine-config.json");
		const fileConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
		fileConfig.agents = {
			worker: { model: "google/gemini-4-argon", thinking: "medium" },
			reviewer: { model: "google/gemini-2.5-pro", thinking: "medium" },
		};
		fs.writeFileSync(configPath, JSON.stringify(fileConfig, null, "\t"), "utf-8");

		const result = runDoctorChecks(projectRoot);
		const check = result.checks.find((entry) => entry.label === "reviewer model pins (per-type)");
		assert.ok(check);
		assert.equal(check.ok, false);
		assert.equal(result.ok, false);
		assert.ok(result.issueCount >= 1);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
