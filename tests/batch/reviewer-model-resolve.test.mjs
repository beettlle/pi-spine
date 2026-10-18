import assert from "node:assert/strict";
import test from "node:test";
import {
	resolveEffectiveReviewer,
	resolveReviewerModelPin,
	resolveReviewerThinkingPin,
} from "../../src/config/agent-model-resolve.mjs";

const FULL_CONFIG = {
	agents: {
		reviewer: {
			model: "google/gemini-3.1-pro-preview",
			thinking: "medium",
			plan: { model: "google/gemini-flash-latest", thinking: "low" },
			code: { model: "google/gemini-3.1-pro-preview", thinking: "high" },
			final: { model: "google/gemini-3.1-pro-preview", thinking: "high" },
		},
	},
};

test("resolveReviewerModelPin returns per-type override when set", () => {
	assert.equal(resolveReviewerModelPin(FULL_CONFIG, "plan"), "google/gemini-flash-latest");
	assert.equal(resolveReviewerModelPin(FULL_CONFIG, "code"), "google/gemini-3.1-pro-preview");
	assert.equal(resolveReviewerModelPin(FULL_CONFIG, "final"), "google/gemini-3.1-pro-preview");
});

test("resolveReviewerModelPin falls back to top-level when per-type block missing", () => {
	const config = {
		agents: {
			reviewer: {
				model: "google/gemini-3.1-pro-preview",
				plan: { model: "google/gemini-flash-latest" },
			},
		},
	};
	assert.equal(resolveReviewerModelPin(config, "plan"), "google/gemini-flash-latest");
	assert.equal(resolveReviewerModelPin(config, "code"), "google/gemini-3.1-pro-preview");
	assert.equal(resolveReviewerModelPin(config, "final"), "google/gemini-3.1-pro-preview");
});

test("resolveReviewerModelPin cascades per-type inherit to top-level pin", () => {
	const config = {
		agents: {
			reviewer: {
				model: "google/gemini-3.1-pro-preview",
				plan: { model: "inherit" },
			},
		},
	};
	assert.equal(resolveReviewerModelPin(config, "plan"), "google/gemini-3.1-pro-preview");
});

test("resolveReviewerModelPin returns null for top-level inherit", () => {
	const config = {
		agents: {
			reviewer: { model: "inherit", thinking: "high" },
		},
	};
	assert.equal(resolveReviewerModelPin(config, "code"), null);
});

test("resolveReviewerModelPin returns null when reviewer block absent", () => {
	assert.equal(resolveReviewerModelPin({}, "plan"), null);
	assert.equal(resolveReviewerModelPin({ agents: {} }, "code"), null);
	assert.equal(resolveReviewerModelPin(null, "final"), null);
});

test("resolveReviewerThinkingPin returns per-type override when set", () => {
	assert.equal(resolveReviewerThinkingPin(FULL_CONFIG, "plan"), "low");
	assert.equal(resolveReviewerThinkingPin(FULL_CONFIG, "code"), "high");
	assert.equal(resolveReviewerThinkingPin(FULL_CONFIG, "final"), "high");
});

test("resolveReviewerThinkingPin falls back to top-level when per-type block missing", () => {
	const config = {
		agents: {
			reviewer: {
				thinking: "medium",
				plan: { thinking: "low" },
			},
		},
	};
	assert.equal(resolveReviewerThinkingPin(config, "plan"), "low");
	assert.equal(resolveReviewerThinkingPin(config, "final"), "medium");
});

test("resolveReviewerThinkingPin cascades per-type inherit to top-level pin", () => {
	const config = {
		agents: {
			reviewer: {
				thinking: "medium",
				plan: { thinking: "inherit" },
			},
		},
	};
	assert.equal(resolveReviewerThinkingPin(config, "plan"), "medium");
});

test("resolveReviewerThinkingPin returns null for off at any level", () => {
	const perTypeOff = {
		agents: {
			reviewer: {
				thinking: "medium",
				plan: { thinking: "off" },
			},
		},
	};
	assert.equal(resolveReviewerThinkingPin(perTypeOff, "plan"), null);

	const topOff = {
		agents: {
			reviewer: { thinking: "off" },
		},
	};
	assert.equal(resolveReviewerThinkingPin(topOff, "code"), null);
});

test("resolveReviewerThinkingPin returns null when reviewer block absent", () => {
	assert.equal(resolveReviewerThinkingPin({}, "plan"), null);
	assert.equal(resolveReviewerThinkingPin({ agents: {} }, "code"), null);
});

// ---------------------------------------------------------------------------
// SP-832 / #355 — resolveEffectiveReviewer precedence + model-family guard
// ---------------------------------------------------------------------------

const PROFILE_CONFIG = {
	agents: {
		activeProfile: "gem",
		worker: { model: "google/gemini-4-argon" },
		reviewer: { model: "google/gemini-2.5-pro", thinking: "medium" },
		profiles: {
			gem: { worker: { model: "google/gemini-4-argon" }, reviewerProfile: "wprof" },
			wprof: { reviewer: { model: "zai/glm-5.3-flash", thinking: "high" } },
			shared: { reviewer: { model: "anthropic/claude-sonnet-5-5", thinking: "low" } },
			prompt: {
				reviewer: {
					model: "kimi-coding/k3",
					thinking: "off",
					code: { model: "openai/gpt-5", thinking: "high" },
				},
			},
			bare: { worker: { model: "cursor/auto" } },
			sib: { reviewer: { model: "google/gemini-flash-latest" } },
		},
		reviewerProfile: "shared",
	},
};

test("resolveEffectiveReviewer: PROMPT profile wins over worker profile, agents.reviewerProfile, agents.reviewer", () => {
	const result = resolveEffectiveReviewer(PROFILE_CONFIG, {
		promptReviewerProfile: "prompt",
		workerProfile: "gem",
		workerModel: "google/gemini-4-argon",
	});
	assert.equal(result.plan.model, "kimi-coding/k3");
	assert.equal(result.plan.thinking, null);
	assert.equal(result.plan.profile, "prompt");
	assert.match(result.plan.source, /prompt/);
	assert.equal(result.code.model, "openai/gpt-5");
	assert.equal(result.code.thinking, "high");
	assert.equal(result.final.model, "kimi-coding/k3");
	assert.deepEqual(result.blocked, []);
	assert.deepEqual(result.warnings, []);
});

test("resolveEffectiveReviewer: worker profile reviewerProfile beats agents.reviewerProfile", () => {
	const result = resolveEffectiveReviewer(PROFILE_CONFIG, {
		workerProfile: "gem",
		workerModel: "google/gemini-4-argon",
	});
	for (const type of ["plan", "code", "final"]) {
		assert.equal(result[type].model, "zai/glm-5.3-flash");
		assert.equal(result[type].thinking, "high");
		assert.equal(result[type].profile, "wprof");
	}
});

test("resolveEffectiveReviewer: agents.reviewerProfile beats agents.reviewer", () => {
	const result = resolveEffectiveReviewer(PROFILE_CONFIG, {
		workerProfile: "bare",
		workerModel: "google/gemini-4-argon",
	});
	assert.equal(result.plan.model, "anthropic/claude-sonnet-5-5");
	assert.equal(result.plan.profile, "shared");
	assert.equal(result.plan.source, "agents.reviewerProfile");
});

test("resolveEffectiveReviewer: falls through to merged agents.reviewer", () => {
	const config = { agents: { reviewer: { model: "google/gemini-2.5-pro", thinking: "medium" } } };
	const result = resolveEffectiveReviewer(config, { workerModel: "cursor/auto" });
	assert.equal(result.code.model, "google/gemini-2.5-pro");
	assert.equal(result.code.thinking, "medium");
	assert.equal(result.code.profile, null);
	assert.equal(result.code.source, "agents.reviewer");
	assert.deepEqual(result.blocked, []);
});

test("resolveEffectiveReviewer: inherit and off follow existing pin rules", () => {
	const config = {
		agents: {
			reviewer: { model: "inherit", thinking: "off", plan: { model: "cursor/auto", thinking: "inherit" } },
		},
	};
	const result = resolveEffectiveReviewer(config, {});
	assert.equal(result.plan.model, "cursor/auto");
	assert.equal(result.plan.thinking, null);
	assert.equal(result.code.model, null);
	assert.equal(result.code.thinking, null);
});

test("resolveEffectiveReviewer: named profile without reviewer block warns and falls back", () => {
	const result = resolveEffectiveReviewer(PROFILE_CONFIG, {
		promptReviewerProfile: "bare",
		workerProfile: "bare",
		workerModel: "cursor/auto",
	});
	assert.equal(result.plan.profile, "shared");
	assert.ok(result.warnings.includes('reviewer profile "bare" has no reviewer block; falling back'));
	assert.deepEqual(result.blocked, []);
});

test("resolveEffectiveReviewer: unknown named profile is blocked for every type", () => {
	const result = resolveEffectiveReviewer(PROFILE_CONFIG, {
		promptReviewerProfile: "ghost",
		workerModel: "cursor/auto",
	});
	assert.deepEqual(
		result.blocked.filter((entry) => entry.reason === "unknown_reviewer_profile").map((entry) => entry.reviewType),
		["plan", "code", "final"],
	);
});

test("resolveEffectiveReviewer: family guard skips same-family candidate and tries the next", () => {
	const result = resolveEffectiveReviewer(PROFILE_CONFIG, {
		promptReviewerProfile: "sib",
		workerProfile: "gem",
		workerModel: "google/gemini-4-argon",
	});
	assert.equal(result.plan.profile, "wprof");
	assert.equal(result.plan.model, "zai/glm-5.3-flash");
	assert.deepEqual(result.blocked, []);
	assert.ok(result.warnings.some((warning) => /shares a model family/.test(warning)));
});

test("resolveEffectiveReviewer: family guard is per review type", () => {
	const config = {
		agents: {
			reviewer: {
				model: "google/gemini-2.5-pro",
				code: { model: "anthropic/claude-sonnet-5-5" },
			},
		},
	};
	const result = resolveEffectiveReviewer(config, { workerModel: "google/gemini-4-argon" });
	assert.deepEqual(result.blocked, [
		{ reviewType: "plan", reason: "same_model_family" },
		{ reviewType: "final", reason: "same_model_family" },
	]);
	assert.equal(result.code.model, "anthropic/claude-sonnet-5-5");
	assert.equal(result.plan.model, "google/gemini-2.5-pro");
});

test("resolveEffectiveReviewer: blocks and keeps last candidate pins when none is cross-family", () => {
	const config = {
		agents: {
			reviewer: { model: "google/gemini-2.5-pro", thinking: "medium" },
			profiles: { sib: { reviewer: { model: "google/gemini-flash-latest", thinking: "low" } } },
		},
	};
	const result = resolveEffectiveReviewer(config, {
		promptReviewerProfile: "sib",
		workerModel: "google/gemini-4-argon",
	});
	assert.deepEqual(
		result.blocked.map((entry) => entry.reason),
		["same_model_family", "same_model_family", "same_model_family"],
	);
	assert.equal(result.plan.model, "google/gemini-2.5-pro");
	assert.equal(result.plan.thinking, "medium");
	assert.equal(result.plan.source, "agents.reviewer");
});

test("resolveEffectiveReviewer: unknown worker or reviewer family never blocks", () => {
	const config = { agents: { reviewer: { model: "cursor/auto" } } };
	assert.deepEqual(resolveEffectiveReviewer(config, { workerModel: "cursor/auto" }).blocked, []);
	assert.deepEqual(resolveEffectiveReviewer(config, { workerModel: null }).blocked, []);
});

test("resolveEffectiveReviewer does not mutate config and legacy pin resolvers are unchanged", () => {
	const before = structuredClone(PROFILE_CONFIG);
	resolveEffectiveReviewer(PROFILE_CONFIG, { workerProfile: "gem", workerModel: "google/gemini-4-argon" });
	assert.deepEqual(PROFILE_CONFIG, before);
	assert.equal(resolveReviewerModelPin(PROFILE_CONFIG, "plan"), "google/gemini-2.5-pro");
	assert.equal(resolveReviewerThinkingPin(PROFILE_CONFIG, "plan"), "medium");
});
