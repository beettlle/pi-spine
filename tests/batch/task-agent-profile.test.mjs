/**
 * SP-834 (#355) — per-task worker profile and effective reviewer config (pure helpers).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { minimalValidPromptMarkdown } from "../helpers/smoke-task-prompt.mjs";
import {
	resolveReviewerModelPin,
	resolveReviewerThinkingPin,
} from "../../src/config/agent-model-resolve.mjs";
import {
	buildTaskReviewConfig,
	prepareWorkerAttempt,
	resolveTaskWorkerProfile,
} from "../../src/batch/engine-lanes/task-agent-profile.mjs";

const GLM = "zai/glm-5.3";
const GEMINI = "google/gemini-2.5-pro";
const GEMINI_CODE = "google/gemini-3.1-pro";
const CLAUDE = "anthropic/claude-sonnet-4-5";

/** @returns {Record<string, any>} */
function fixtureConfig() {
	return {
		agents: {
			activeProfile: "hard",
			reviewerProfile: "claude-rev",
			worker: { model: GLM, thinking: "high" },
			reviewer: { model: GLM, thinking: "high" },
			profiles: {
				hard: { worker: { model: GLM, thinking: "high" }, reviewerProfile: "gemini-rev" },
				plain: { worker: { model: GLM, thinking: "low" } },
				gemini: {
					worker: { model: GEMINI, thinking: "medium" },
					reviewerProfile: "claude-rev",
				},
				"gemini-rev": {
					reviewer: {
						model: GEMINI,
						thinking: "high",
						code: { model: GEMINI_CODE, thinking: "medium" },
					},
				},
				"claude-rev": { reviewer: { model: CLAUDE, thinking: "high" } },
			},
		},
	};
}

const ZAI_HOP = { toProfile: "gemini", exhaustedPool: "zai" };

test("resolveTaskWorkerProfile defaults to agents.activeProfile pins", () => {
	const result = resolveTaskWorkerProfile({ config: fixtureConfig() });
	assert.deepEqual(result, {
		profile: "hard",
		model: GLM,
		thinking: "high",
		source: "active_profile",
	});
});

test("resolveTaskWorkerProfile prefers prompt.profile over the active profile", () => {
	const result = resolveTaskWorkerProfile({
		config: fixtureConfig(),
		prompt: { profile: "plain" },
	});
	assert.equal(result.profile, "plain");
	assert.equal(result.thinking, "low");
	assert.equal(result.source, "prompt");
});

test("resolveTaskWorkerProfile falls back to agents.worker for an undefined profile", () => {
	const result = resolveTaskWorkerProfile({
		config: fixtureConfig(),
		prompt: { profile: "ghost" },
	});
	assert.equal(result.profile, "ghost");
	assert.equal(result.model, GLM);
});

test("resolveTaskWorkerProfile applies the quota hop when its pool matches the task worker", () => {
	const result = resolveTaskWorkerProfile({
		config: fixtureConfig(),
		prompt: { profile: "plain" },
		quotaFallback: ZAI_HOP,
	});
	assert.deepEqual(result, {
		profile: "gemini",
		model: GEMINI,
		thinking: "medium",
		source: "quota_fallback",
	});
});

test("resolveTaskWorkerProfile ignores a quota hop for a different pool", () => {
	const config = fixtureConfig();
	config.agents.profiles.other = { worker: { model: "kimi-coding/k3" } };
	const result = resolveTaskWorkerProfile({
		config,
		prompt: { profile: "other" },
		quotaFallback: ZAI_HOP,
	});
	assert.equal(result.profile, "other");
	assert.equal(result.source, "prompt");
});

test("buildTaskReviewConfig: PROMPT reviewer profile wins", () => {
	const config = fixtureConfig();
	const workerContext = resolveTaskWorkerProfile({ config });
	const built = buildTaskReviewConfig({
		config,
		prompt: { reviewerProfile: "claude-rev" },
		workerContext,
	});
	for (const reviewType of ["plan", "code", "final"]) {
		assert.equal(resolveReviewerModelPin(built.config, reviewType), CLAUDE);
		assert.equal(built.reviewer[reviewType].source, "prompt.reviewerProfile");
	}
	assert.deepEqual(built.blocked, []);
});

test("buildTaskReviewConfig: worker profile reviewerProfile used when PROMPT is silent", () => {
	const config = fixtureConfig();
	const workerContext = resolveTaskWorkerProfile({ config });
	const built = buildTaskReviewConfig({ config, prompt: {}, workerContext });
	assert.equal(resolveReviewerModelPin(built.config, "plan"), GEMINI);
	assert.equal(built.reviewer.plan.source, "agents.profiles.hard.reviewerProfile");
});

test("buildTaskReviewConfig: agents.reviewerProfile is the default", () => {
	const config = fixtureConfig();
	const workerContext = resolveTaskWorkerProfile({ config, prompt: { profile: "plain" } });
	const built = buildTaskReviewConfig({ config, prompt: { profile: "plain" }, workerContext });
	assert.equal(resolveReviewerModelPin(built.config, "final"), CLAUDE);
	assert.equal(built.reviewer.final.source, "agents.reviewerProfile");
});

test("buildTaskReviewConfig: plan/code/final pins differ per review type", () => {
	const config = fixtureConfig();
	const workerContext = resolveTaskWorkerProfile({ config });
	const { config: reviewConfig } = buildTaskReviewConfig({ config, prompt: {}, workerContext });
	assert.equal(resolveReviewerModelPin(reviewConfig, "plan"), GEMINI);
	assert.equal(resolveReviewerModelPin(reviewConfig, "code"), GEMINI_CODE);
	assert.equal(resolveReviewerModelPin(reviewConfig, "final"), GEMINI);
	assert.equal(resolveReviewerThinkingPin(reviewConfig, "plan"), "high");
	assert.equal(resolveReviewerThinkingPin(reviewConfig, "code"), "medium");
	assert.equal(resolveReviewerThinkingPin(reviewConfig, "final"), "high");
});

test("buildTaskReviewConfig is pure: the input config is not mutated", () => {
	const config = fixtureConfig();
	const before = structuredClone(config);
	const workerContext = resolveTaskWorkerProfile({ config });
	const built = buildTaskReviewConfig({ config, prompt: {}, workerContext });
	assert.deepEqual(config, before);
	assert.notEqual(built.config, config);
	assert.equal(built.config.agents.worker.model, GLM);
});

test("quota hop to a Gemini worker switches the reviewer to the fallback profile's reviewerProfile", () => {
	const config = fixtureConfig();
	const before = buildTaskReviewConfig({
		config,
		prompt: {},
		workerContext: resolveTaskWorkerProfile({ config }),
	});
	assert.equal(resolveReviewerModelPin(before.config, "plan"), GEMINI);

	const workerContext = resolveTaskWorkerProfile({ config, quotaFallback: ZAI_HOP });
	assert.equal(workerContext.model, GEMINI);
	const after = buildTaskReviewConfig({ config, prompt: {}, workerContext });
	for (const reviewType of ["plan", "code", "final"]) {
		assert.equal(resolveReviewerModelPin(after.config, reviewType), CLAUDE);
		assert.equal(after.reviewer[reviewType].profile, "claude-rev");
	}
	assert.deepEqual(after.blocked, []);
});

test("same-family pairing with no alternative is reported as blocked", () => {
	const config = fixtureConfig();
	config.agents.profiles.hard.reviewerProfile = undefined;
	config.agents.reviewerProfile = undefined;
	const workerContext = resolveTaskWorkerProfile({ config });
	const built = buildTaskReviewConfig({ config, prompt: {}, workerContext });
	assert.deepEqual(
		built.blocked.map((entry) => `${entry.reviewType}:${entry.reason}`),
		["plan:same_model_family", "code:same_model_family", "final:same_model_family"],
	);
	assert.ok(built.warnings.length > 0);
});

// ---- SP-835 (#340): retry override / prompt / thinking precedence + per-attempt env ----

/** A profile on the same zai pool as `hard` / `plain`, and one on a different (kimi) pool. */
function precedenceConfig() {
	const config = fixtureConfig();
	config.agents.profiles.kimi = { worker: { model: "kimi-coding/k3", thinking: "minimal" } };
	return config;
}

test("resolveTaskWorkerProfile precedence table (profile, thinking, source)", () => {
	const config = precedenceConfig();
	/** @type {Array<[string, Record<string, any>, string, string|null, string]>} */
	const rows = [
		["active profile", {}, "hard", "high", "active_profile"],
		["prompt profile", { prompt: { profile: "plain" } }, "plain", "low", "prompt"],
		["retry override beats prompt", { prompt: { profile: "plain" }, task: { profileOverride: "gemini" } }, "gemini", "medium", "retry_override"],
		["prompt thinking beats profile thinking", { prompt: { profile: "plain", thinking: "xhigh" } }, "plain", "xhigh", "prompt"],
		["prompt thinking alone keeps the active profile", { prompt: { thinking: "low" } }, "hard", "low", "active_profile"],
		["blank prompt values are ignored", { prompt: { profile: " ", thinking: "" } }, "hard", "high", "active_profile"],
		["hop on the same pool as the active profile", { quotaFallback: ZAI_HOP }, "gemini", "medium", "quota_fallback"],
		["hop on the same pool as the prompt profile", { prompt: { profile: "plain" }, quotaFallback: ZAI_HOP }, "gemini", "medium", "quota_fallback"],
		["hop on the same pool as the retry override", { task: { profileOverride: "plain" }, quotaFallback: ZAI_HOP }, "gemini", "medium", "quota_fallback"],
		["hop for a different pool than the prompt profile", { prompt: { profile: "kimi" }, quotaFallback: ZAI_HOP }, "kimi", "minimal", "prompt"],
		["hop for a different pool than the retry override", { task: { profileOverride: "kimi" }, quotaFallback: ZAI_HOP }, "kimi", "minimal", "retry_override"],
		["prompt thinking survives a hop", { quotaFallback: ZAI_HOP, prompt: { thinking: "off" } }, "gemini", "off", "quota_fallback"],
	];
	for (const [label, input, profile, thinking, source] of rows) {
		const result = resolveTaskWorkerProfile({ config, ...input });
		assert.deepEqual(
			{ profile: result.profile, thinking: result.thinking, source: result.source },
			{ profile, thinking, source },
			label,
		);
	}
});

test("resolveTaskWorkerProfile falls back to agents.worker.thinking for a profile without thinking", () => {
	const config = fixtureConfig();
	config.agents.profiles.bare = { worker: { model: GEMINI } };
	const result = resolveTaskWorkerProfile({ config, prompt: { profile: "bare" } });
	assert.equal(result.model, GEMINI);
	assert.equal(result.thinking, "high");
});

/**
 * @param {object} options
 * @param {string} [options.promptExtras] Header lines (`**Profile:**` / `**Thinking:**`).
 * @param {Record<string, any>} [options.config]
 * @param {Record<string, any>} [options.state]
 * @param {Record<string, any>} [options.task]
 */
function runPrepare({ promptExtras = "", config = precedenceConfig(), state = {}, task = { taskId: "SP-835" } } = {}) {
	const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "spine-prepare-attempt-"));
	try {
		const taskFolder = path.join(projectRoot, "spine-tasks", "SP-835-fixture");
		fs.mkdirSync(taskFolder, { recursive: true });
		const base = minimalValidPromptMarkdown("SP-835", { fileScope: "src/a.txt" });
		fs.writeFileSync(path.join(taskFolder, "PROMPT.md"), base.replace("\n", `\n\n${promptExtras}\n`), "utf-8");
		const batchId = "20261019T000000";
		const attempt = prepareWorkerAttempt({
			projectRoot,
			state,
			batchId,
			config,
			task,
			lane: { laneNumber: 1, laneId: "lane-1" },
			taskFolderInWorktree: taskFolder,
			laneCorrelationId: "corr-1",
		});
		const events = readJournalEvents(projectRoot, batchId);
		return { attempt, task, events };
	} finally {
		fs.rmSync(projectRoot, { recursive: true, force: true });
	}
}

test("prepareWorkerAttempt: no overrides passes no env and records the active profile", () => {
	const { attempt, task, events } = runPrepare();
	assert.deepEqual(attempt.extraEnv, {});
	assert.deepEqual(attempt.startedPayload, {
		workerProfile: "hard",
		workerModel: GLM,
		workerThinking: "high",
		workerProfileSource: "active_profile",
	});
	assert.equal(task.workerProfile, "hard");
	assert.equal(task.workerThinking, "high");
	assert.equal(task.workerModel, GLM);
	assert.equal(events.length, 0);
});

test("prepareWorkerAttempt: PROMPT profile + thinking become child env overrides", () => {
	const { attempt, task } = runPrepare({ promptExtras: "**Profile:** gemini\n**Thinking:** xhigh" });
	assert.deepEqual(attempt.extraEnv, {
		SPINE_AGENT_PROFILE_OVERRIDE: "gemini",
		SPINE_WORKER_THINKING_OVERRIDE: "xhigh",
	});
	assert.equal(attempt.startedPayload.workerModel, GEMINI);
	assert.equal(attempt.startedPayload.workerThinking, "xhigh");
	assert.equal(attempt.startedPayload.workerProfileSource, "prompt");
	assert.equal(task.workerProfile, "gemini");
	assert.equal(task.workerModel, GEMINI);
});

test("prepareWorkerAttempt: thinking-only override keeps the active profile out of the env", () => {
	const { attempt } = runPrepare({ promptExtras: "**Thinking:** low" });
	assert.deepEqual(attempt.extraEnv, { SPINE_WORKER_THINKING_OVERRIDE: "low" });
});

test("prepareWorkerAttempt: task.profileOverride (retry) beats the PROMPT profile", () => {
	const { attempt } = runPrepare({
		promptExtras: "**Profile:** plain",
		task: { taskId: "SP-835", profileOverride: "gemini" },
	});
	assert.equal(attempt.extraEnv.SPINE_AGENT_PROFILE_OVERRIDE, "gemini");
	assert.equal(attempt.startedPayload.workerProfileSource, "retry_override");
});

test("prepareWorkerAttempt: an applied hop on the task's pool wins over the PROMPT profile", () => {
	const { attempt } = runPrepare({
		promptExtras: "**Profile:** plain",
		state: { resilience: { quotaFallback: ZAI_HOP } },
	});
	assert.equal(attempt.extraEnv.SPINE_AGENT_PROFILE_OVERRIDE, "gemini");
	assert.equal(attempt.startedPayload.workerProfileSource, "quota_fallback");
});

test("prepareWorkerAttempt: a sticky hop for another pool is overridden for this task's profile", () => {
	const { attempt } = runPrepare({
		promptExtras: "**Profile:** kimi",
		state: { resilience: { quotaFallback: ZAI_HOP } },
	});
	assert.equal(attempt.extraEnv.SPINE_AGENT_PROFILE_OVERRIDE, "kimi");
	assert.equal(attempt.startedPayload.workerProfileSource, "prompt");

	// Same for the active profile: it is not on the exhausted pool, so pin it against the sticky hop.
	const config = precedenceConfig();
	config.agents.activeProfile = "kimi";
	config.agents.worker = { model: "kimi-coding/k3", thinking: "minimal" };
	const active = runPrepare({ config, state: { resilience: { quotaFallback: ZAI_HOP } } });
	assert.equal(active.attempt.extraEnv.SPINE_AGENT_PROFILE_OVERRIDE, "kimi");
});

test("prepareWorkerAttempt: agentSession backend journals worker.profile_override_ignored", () => {
	const config = precedenceConfig();
	config.lanes = { workerBackend: "agentSession" };
	const withOverride = runPrepare({ config, promptExtras: "**Profile:** gemini" });
	const ignored = withOverride.events.filter((event) => event.type === "worker.profile_override_ignored");
	assert.equal(ignored.length, 1);
	assert.equal(ignored[0].payload.profile, "gemini");
	assert.equal(ignored[0].payload.backend, "agentSession");

	const without = runPrepare({ config });
	assert.equal(without.events.filter((event) => event.type === "worker.profile_override_ignored").length, 0);
});

test("prepareWorkerAttempt: a stale workerProfile/workerThinking pin is cleared when nothing resolves", () => {
	const { task } = runPrepare({
		config: { agents: {} },
		task: { taskId: "SP-835", workerProfile: "old", workerThinking: "high" },
	});
	assert.equal("workerProfile" in task, false);
	assert.equal("workerThinking" in task, false);
});
