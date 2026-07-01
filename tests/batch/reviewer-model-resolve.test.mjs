import assert from "node:assert/strict";
import test from "node:test";
import {
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
