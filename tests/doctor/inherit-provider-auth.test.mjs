/**
 * SP-460 — Doctor inherit provider auth probe (GitHub #97).
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
	buildInheritProviderAuthDoctorCheck,
	isAuthErrorText,
	listModelsForProvider,
	parsePiListModelsRows,
	probeInheritProviderAuth,
	resolveModelIdForProvider,
} from "../../src/doctor/agents-model-inherit.mjs";

const LIST_MODELS_TABLE = `provider     model             context
cursor       auto              200K
kimi-coding  k2p7              262K
kimi-coding  kimi-for-coding   262K
`;

test("isAuthErrorText detects authentication failures", () => {
	assert.equal(isAuthErrorText('401 {"error":{"type":"authentication_error"}}'), true);
	assert.equal(isAuthErrorText("No API key found for openai"), true);
	assert.equal(isAuthErrorText("network timeout"), false);
});

test("parsePiListModelsRows and listModelsForProvider filter by provider", () => {
	const rows = parsePiListModelsRows(LIST_MODELS_TABLE);
	assert.equal(rows.length, 3);
	const kimiModels = listModelsForProvider(LIST_MODELS_TABLE, "kimi-coding");
	assert.deepEqual(kimiModels, [
		{ provider: "kimi-coding", id: "k2p7" },
		{ provider: "kimi-coding", id: "kimi-for-coding" },
	]);
});

test("resolveModelIdForProvider prefers defaultModel when provider matches", () => {
	const listed = [{ provider: "kimi-coding", id: "k2p7" }];
	assert.equal(resolveModelIdForProvider("kimi-coding/kimi-for-coding", "kimi-coding", listed), "kimi-for-coding");
	assert.equal(resolveModelIdForProvider(null, "kimi-coding", listed), "k2p7");
});

test("buildInheritProviderAuthDoctorCheck passes when agents pinned to cursor/auto", () => {
	const check = buildInheritProviderAuthDoctorCheck({
		config: {
			agents: {
				worker: { model: "cursor/auto" },
				reviewer: { model: "google/gemini-3.1-pro-preview" },
			},
		},
	});
	assert.equal(check.ok, true);
	assert.match(check.detail, /not applicable/i);
});

test("buildInheritProviderAuthDoctorCheck passes when inherit resolves to cursor", () => {
	const check = buildInheritProviderAuthDoctorCheck({
		config: { agents: { worker: { model: "inherit" } } },
		resolveProvider: () => "cursor",
	});
	assert.equal(check.ok, true);
	assert.match(check.detail, /cursor/i);
});

test("buildInheritProviderAuthDoctorCheck fails when probe reports 401", () => {
	/** @type {typeof import("node:child_process").spawnSync} */
	const mockSpawn = (_cmd, args) => {
		if (args.includes("--list-models")) {
			return {
				stdout: LIST_MODELS_TABLE,
				stderr: "",
				status: 0,
				error: null,
			};
		}
		return {
			stdout: "",
			stderr: '401 {"error":{"type":"authentication_error","message":"invalid key"}}',
			status: 1,
			error: null,
		};
	};

	const check = buildInheritProviderAuthDoctorCheck({
		config: { agents: { worker: { model: "inherit" } } },
		resolveProvider: () => "kimi-coding",
		probeAuth: (provider, options) =>
			probeInheritProviderAuth(provider, { ...options, spawnFn: mockSpawn }),
	});
	assert.equal(check.ok, false);
	assert.match(check.detail, /kimi-coding/i);
	assert.match(check.detail, /authentication/i);
	assert.ok(check.suggestedCommand?.includes("cursor/auto"));
});

test("buildInheritProviderAuthDoctorCheck fails when provider has no authenticated models", () => {
	/** @type {typeof import("node:child_process").spawnSync} */
	const mockSpawn = (_cmd, args) => {
		if (args.includes("--list-models")) {
			return {
				stdout: "provider  model\ncursor  auto\n",
				stderr: "",
				status: 0,
				error: null,
			};
		}
		throw new Error("probe should not run when list-models has no provider models");
	};

	const check = buildInheritProviderAuthDoctorCheck({
		config: { agents: { worker: { model: "inherit" } } },
		resolveProvider: () => "kimi-coding",
		probeAuth: (provider, options) =>
			probeInheritProviderAuth(provider, { ...options, spawnFn: mockSpawn }),
	});
	assert.equal(check.ok, false);
	assert.match(check.detail, /no authenticated models/i);
});

test("probeInheritProviderAuth succeeds when list and probe pass", () => {
	/** @type {typeof import("node:child_process").spawnSync} */
	const mockSpawn = (_cmd, args) => {
		if (args.includes("--list-models")) {
			return {
				stdout: LIST_MODELS_TABLE,
				stderr: "",
				status: 0,
				error: null,
			};
		}
		return {
			stdout: "ok",
			stderr: "",
			status: 0,
			error: null,
		};
	};

	const result = probeInheritProviderAuth("kimi-coding", { spawnFn: mockSpawn });
	assert.equal(result.ok, true);
	assert.match(result.detail, /credentials OK/i);
});
