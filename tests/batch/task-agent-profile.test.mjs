/**
 * SP-834 (#355) — per-task worker profile and effective reviewer config (pure helpers).
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
	resolveReviewerModelPin,
	resolveReviewerThinkingPin,
} from "../../src/config/agent-model-resolve.mjs";
import {
	buildTaskReviewConfig,
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
		source: "agents.activeProfile",
	});
});

test("resolveTaskWorkerProfile prefers prompt.profile over the active profile", () => {
	const result = resolveTaskWorkerProfile({
		config: fixtureConfig(),
		prompt: { profile: "plain" },
	});
	assert.equal(result.profile, "plain");
	assert.equal(result.thinking, "low");
	assert.equal(result.source, "prompt.profile");
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
	assert.equal(result.source, "prompt.profile");
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
