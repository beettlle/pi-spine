import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
	EvidenceCommandError,
	isAllowedEvidencePathEntry,
	parseEvidenceCommandArgv,
	parseEvidenceCommandChain,
	runEvidenceCommand,
} from "../../src/batch/evidence-command.mjs";
import { buildEvidenceConfigWarnDoctorChecks } from "../../src/doctor/evidence-config-warn.mjs";

test("parseEvidenceCommandArgv accepts cargo test", () => {
	assert.deepEqual(parseEvidenceCommandArgv("cargo test"), ["cargo", "test"]);
});

test("parseEvidenceCommandArgv accepts task test", () => {
	assert.deepEqual(parseEvidenceCommandArgv("task test"), ["task", "test"]);
	assert.deepEqual(parseEvidenceCommandArgv("task test TEST_FILTER=stats"), [
		"task",
		"test",
		"TEST_FILTER=stats",
	]);
});

test("parseEvidenceCommandArgv accepts cargo/task in allowlisted && chains", () => {
	assert.deepEqual(parseEvidenceCommandChain("cargo build && cargo test"), [
		["cargo", "build"],
		["cargo", "test"],
	]);
});

test("parseEvidenceCommandArgv accepts documented PATH prefix with $HOME toolchain dir", () => {
	assert.deepEqual(parseEvidenceCommandArgv('PATH="$HOME/.cargo/bin:$PATH" cargo test'), [
		"cargo",
		"test",
	]);
});

test("parseEvidenceCommandArgv accepts PATH prefix with project-relative entry", () => {
	assert.deepEqual(parseEvidenceCommandArgv('PATH="node_modules/.bin:$PATH" npm test'), [
		"npm",
		"test",
	]);
});

test("parseEvidenceCommandChain accepts PATH prefix per chain segment", () => {
	assert.deepEqual(
		parseEvidenceCommandChain('PATH="$HOME/.cargo/bin:$PATH" cargo build && cargo test'),
		[
			["cargo", "build"],
			["cargo", "test"],
		],
	);
});

test("parseEvidenceCommandArgv rejects PATH prefix without a command", () => {
	assert.throws(
		() => parseEvidenceCommandArgv('PATH="$HOME/.cargo/bin"'),
		(err) => err instanceof EvidenceCommandError && /without a command/.test(err.message),
	);
});

test("parseEvidenceCommandArgv rejects arbitrary $VAR in PATH prefix", () => {
	assert.throws(
		() => parseEvidenceCommandArgv('PATH="$FOO/bin:$PATH" cargo test'),
		(err) => err instanceof EvidenceCommandError && /PATH prefix entry not allowed/.test(err.message),
	);
});

test("parseEvidenceCommandArgv rejects PATH prefix parent traversal", () => {
	assert.throws(
		() => parseEvidenceCommandArgv('PATH="$HOME/../evil:$PATH" cargo test'),
		(err) => err instanceof EvidenceCommandError && /PATH prefix entry not allowed/.test(err.message),
	);
	assert.throws(
		() => parseEvidenceCommandArgv('PATH="../evil/bin:$PATH" cargo test'),
		(err) => err instanceof EvidenceCommandError && /PATH prefix entry not allowed/.test(err.message),
	);
});

test("parseEvidenceCommandArgv rejects absolute PATH prefix entries", () => {
	assert.throws(
		() => parseEvidenceCommandArgv('PATH="/usr/local/bin:$PATH" cargo test'),
		(err) => err instanceof EvidenceCommandError && /PATH prefix entry not allowed/.test(err.message),
	);
});

test("parseEvidenceCommandArgv rejects PATH entries with shell metacharacters", () => {
	assert.throws(
		() => parseEvidenceCommandArgv('PATH="bin;rm -rf /:$PATH" cargo test'),
		(err) => err instanceof EvidenceCommandError && /PATH prefix entry not allowed/.test(err.message),
	);
});

test("parseEvidenceCommandArgv still rejects subshell and arbitrary $ expansion", () => {
	assert.throws(
		() => parseEvidenceCommandArgv("cargo test $(whoami)"),
		(err) => err instanceof EvidenceCommandError,
	);
	assert.throws(
		() => parseEvidenceCommandArgv("cargo test $FILTER"),
		(err) => err instanceof EvidenceCommandError && /shell variable expansion/.test(err.message),
	);
	assert.throws(
		() => parseEvidenceCommandArgv("cargo test ${FILTER}"),
		(err) => err instanceof EvidenceCommandError,
	);
});

test("isAllowedEvidencePathEntry bounded allowlist", () => {
	assert.equal(isAllowedEvidencePathEntry("$PATH"), true);
	assert.equal(isAllowedEvidencePathEntry("$HOME/.cargo/bin"), true);
	assert.equal(isAllowedEvidencePathEntry("node_modules/.bin"), true);
	assert.equal(isAllowedEvidencePathEntry(".cargo/bin"), true);
	assert.equal(isAllowedEvidencePathEntry("$FOO/bin"), false);
	assert.equal(isAllowedEvidencePathEntry("/usr/local/bin"), false);
	assert.equal(isAllowedEvidencePathEntry("../outside"), false);
	assert.equal(isAllowedEvidencePathEntry("$HOME/../outside"), false);
	assert.equal(isAllowedEvidencePathEntry(""), false);
});

test("runEvidenceCommand applies PATH prefix to exec env without a shell", () => {
	const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "spine-evidence-cargo-"));
	try {
		const toolbin = path.join(projectRoot, ".toolbin");
		fs.mkdirSync(toolbin, { recursive: true });
		const fakeCargo = path.join(toolbin, "cargo");
		fs.writeFileSync(fakeCargo, "#!/bin/sh\necho fake-cargo-ok\n", "utf-8");
		fs.chmodSync(fakeCargo, 0o755);

		const result = runEvidenceCommand(projectRoot, 'PATH=".toolbin:$PATH" cargo test');
		assert.equal(result.skipped, false);
		assert.equal(result.ok, true);
		assert.match(result.output, /fake-cargo-ok/);
	} finally {
		fs.rmSync(projectRoot, { recursive: true, force: true });
	}
});

test("runEvidenceCommand rejects unsafe PATH prefix fail-closed", () => {
	const result = runEvidenceCommand(os.tmpdir(), 'PATH="$FOO/bin" cargo test');
	assert.equal(result.skipped, false);
	assert.equal(result.ok, false);
	assert.match(result.output, /\[rejected\].*PATH prefix entry not allowed/);
});

test("doctor advisory warns when testing.test would be rejected at gate time", () => {
	const checks = buildEvidenceConfigWarnDoctorChecks({
		testing: { test: "make test", build: "", testWithCoverage: "", review: "" },
	});
	assert.equal(checks.length, 1);
	assert.equal(checks[0].ok, true);
	assert.equal(checks[0].warning, true);
	assert.match(checks[0].label, /testing\.test/);
	assert.match(checks[0].detail, /not allowed: make/);
});

test("doctor advisory warns on arbitrary $ expansion in testing.build", () => {
	const checks = buildEvidenceConfigWarnDoctorChecks({
		testing: { test: "", build: "npm run build:$TARGET", testWithCoverage: "", review: "" },
	});
	assert.equal(checks.length, 1);
	assert.equal(checks[0].warning, true);
	assert.match(checks[0].detail, /shell variable expansion/);
});

test("doctor advisory stays quiet for cargo/task and documented PATH prefix", () => {
	const checks = buildEvidenceConfigWarnDoctorChecks({
		testing: {
			test: 'PATH="$HOME/.cargo/bin:$PATH" cargo test',
			build: "task build",
			testWithCoverage: "npm run coverage:check",
			review: "",
		},
	});
	assert.deepEqual(checks, []);
});

test("doctor advisory skips empty testing commands", () => {
	const checks = buildEvidenceConfigWarnDoctorChecks({
		testing: { test: "", build: "  ", testWithCoverage: "", review: "" },
	});
	assert.deepEqual(checks, []);
});
