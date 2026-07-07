import assert from "node:assert/strict";
import test from "node:test";

import {
	buildAttachedOrphanRiskDoctorCheck,
	detectAttachedOrphanRiskPatterns,
} from "../../bin/spine-doctor.mjs";
import { runDoctorChecks } from "../../src/doctor/run-doctor-checks.mjs";

test("detectAttachedOrphanRiskPatterns is clear for interactive terminal", () => {
	const result = detectAttachedOrphanRiskPatterns({
		stdinIsTTY: true,
		env: {},
	});

	assert.equal(result.risky, false);
	assert.deepEqual(result.patterns, []);
});

test("detectAttachedOrphanRiskPatterns flags non-interactive stdin", () => {
	const result = detectAttachedOrphanRiskPatterns({
		stdinIsTTY: false,
		env: {},
	});

	assert.equal(result.risky, true);
	assert.equal(result.patterns[0]?.id, "non_interactive_shell");
});

test("detectAttachedOrphanRiskPatterns flags spine worker and CI harnesses", () => {
	const result = detectAttachedOrphanRiskPatterns({
		stdinIsTTY: true,
		env: {
			SPINE_IS_WORKER: "1",
			SPINE_WORKER_RUNNER: "/path/to/spine-worker-runner.mjs",
			GITHUB_ACTIONS: "true",
		},
	});

	assert.equal(result.risky, true);
	assert.deepEqual(
		result.patterns.map((pattern) => pattern.id),
		["spine_worker_context", "pi_worker_runner", "github_actions"],
	);
});

test("detectAttachedOrphanRiskPatterns flags Cursor agent shells", () => {
	const result = detectAttachedOrphanRiskPatterns({
		stdinIsTTY: true,
		env: { CURSOR_TRACE_ID: "trace-abc" },
	});

	assert.equal(result.risky, true);
	assert.equal(result.patterns[0]?.id, "cursor_agent_shell");
});

test("buildAttachedOrphanRiskDoctorCheck warns with detached resume guidance", () => {
	const check = buildAttachedOrphanRiskDoctorCheck({
		stdinIsTTY: false,
		env: { CI: "true" },
	});

	assert.equal(check.ok, true);
	assert.equal(check.warning, true);
	assert.match(check.label, /#163/);
	assert.match(check.detail, /stdin is not a TTY/);
	assert.match(check.detail, /exit 137/);
	assert.match(check.suggestedCommand, /omit --attached/);
	assert.match(check.suggestedCommand, /spine wait/);
});

test("buildAttachedOrphanRiskDoctorCheck passes for interactive foreground use", () => {
	const check = buildAttachedOrphanRiskDoctorCheck({
		stdinIsTTY: true,
		env: {},
	});

	assert.equal(check.ok, true);
	assert.equal(check.warning, undefined);
	assert.match(check.detail, /interactive terminal/);
});

test("runDoctorChecks includes attached orphan risk advisory", () => {
	const prevStdinIsTTY = process.stdin.isTTY;
	const prevCi = process.env.CI;

	Object.defineProperty(process.stdin, "isTTY", {
		configurable: true,
		value: false,
	});
	process.env.CI = "true";

	try {
		const result = runDoctorChecks(process.cwd());
		const check = result.checks.find((entry) => entry.label.includes("#163"));
		assert.ok(check, "expected attached orphan risk doctor check");
		assert.equal(check.warning, true);
		assert.match(check.suggestedCommand, /spine wait/);
	} finally {
		Object.defineProperty(process.stdin, "isTTY", {
			configurable: true,
			value: prevStdinIsTTY,
		});
		if (prevCi === undefined) {
			delete process.env.CI;
		} else {
			process.env.CI = prevCi;
		}
	}
});
