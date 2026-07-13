import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
	EvidenceCommandError,
	isAllowedEvidenceScriptsPath,
	parseEvidenceCommandArgv,
	resolveEvidenceScriptsArgv,
	runEvidenceCommand,
} from "../../src/batch/evidence-command.mjs";

test("parseEvidenceCommandArgv accepts npm run test", () => {
	assert.deepEqual(parseEvidenceCommandArgv("npm run test"), ["npm", "run", "test"]);
});

test("parseEvidenceCommandArgv preserves quoted arguments", () => {
	assert.deepEqual(parseEvidenceCommandArgv('node -e "console.log(1)"'), [
		"node",
		"-e",
		"console.log(1)",
	]);
});

test("parseEvidenceCommandArgv rejects shell command chaining", () => {
	assert.throws(
		() => parseEvidenceCommandArgv("npm test; rm -rf /"),
		(err) => err instanceof EvidenceCommandError && /metacharacters/.test(err.message),
	);
});

test("parseEvidenceCommandArgv rejects unknown binary", () => {
	assert.throws(
		() => parseEvidenceCommandArgv("curl https://evil.example"),
		(err) => err instanceof EvidenceCommandError && /not allowed: curl/.test(err.message),
	);
});

test("parseEvidenceCommandArgv accepts project-local .venv python", () => {
	assert.deepEqual(parseEvidenceCommandArgv(".venv/bin/python -m unittest discover"), [
		".venv/bin/python",
		"-m",
		"unittest",
		"discover",
	]);
});

test("parseEvidenceCommandArgv accepts project-local venv python3", () => {
	assert.deepEqual(parseEvidenceCommandArgv("venv/bin/python3 -m pytest"), [
		"venv/bin/python3",
		"-m",
		"pytest",
	]);
});

test("parseEvidenceCommandArgv rejects bare python", () => {
	assert.throws(
		() => parseEvidenceCommandArgv("python -m unittest"),
		(err) => err instanceof EvidenceCommandError && /not allowed: python/.test(err.message),
	);
});

test("parseEvidenceCommandArgv rejects absolute python path", () => {
	assert.throws(
		() => parseEvidenceCommandArgv("/usr/bin/python -m unittest"),
		(err) => err instanceof EvidenceCommandError && /not allowed: python/.test(err.message),
	);
});

test("parseEvidenceCommandArgv rejects venv path with parent traversal", () => {
	assert.throws(
		() => parseEvidenceCommandArgv(".venv/../evil/python -m unittest"),
		(err) => err instanceof EvidenceCommandError && /not allowed: python/.test(err.message),
	);
	assert.throws(
		() => parseEvidenceCommandArgv("../../.venv/bin/python -m unittest"),
		(err) => err instanceof EvidenceCommandError && /not allowed: python/.test(err.message),
	);
});

test("parseEvidenceCommandArgv accepts scripts/ evidence path", () => {
	assert.deepEqual(parseEvidenceCommandArgv("scripts/run-gate-evidence.sh"), [
		"scripts/run-gate-evidence.sh",
	]);
	assert.deepEqual(parseEvidenceCommandArgv("./scripts/run-gate-evidence.sh --flag"), [
		"./scripts/run-gate-evidence.sh",
		"--flag",
	]);
});

test("parseEvidenceCommandArgv rejects scripts path traversal", () => {
	assert.throws(
		() => parseEvidenceCommandArgv("scripts/../outside.sh"),
		(err) => err instanceof EvidenceCommandError && /not allowed: outside.sh/.test(err.message),
	);
	assert.throws(
		() => parseEvidenceCommandArgv("./scripts/../outside.sh"),
		(err) => err instanceof EvidenceCommandError && /not allowed: outside.sh/.test(err.message),
	);
});

test("parseEvidenceCommandArgv rejects absolute scripts path", () => {
	assert.throws(
		() => parseEvidenceCommandArgv("/tmp/scripts/evil.sh"),
		(err) => err instanceof EvidenceCommandError && /not allowed: evil.sh/.test(err.message),
	);
});

test("isAllowedEvidenceScriptsPath requires scripts/ prefix", () => {
	assert.equal(isAllowedEvidenceScriptsPath("scripts/gate.sh"), true);
	assert.equal(isAllowedEvidenceScriptsPath("./scripts/gate.sh"), true);
	assert.equal(isAllowedEvidenceScriptsPath("bin/gate.sh"), false);
	assert.equal(isAllowedEvidenceScriptsPath("scripts/../gate.sh"), false);
});

test("resolveEvidenceScriptsArgv rejects symlink escape outside scripts/", async () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "spine-evidence-scripts-"));
	try {
		fs.mkdirSync(path.join(root, "scripts"), { recursive: true });
		fs.writeFileSync(path.join(root, "outside.sh"), "#!/bin/sh\necho outside\n", "utf-8");
		fs.symlinkSync(path.join(root, "outside.sh"), path.join(root, "scripts", "escape.sh"));

		assert.throws(
			() => resolveEvidenceScriptsArgv(root, ["scripts/escape.sh"]),
			(err) => err instanceof EvidenceCommandError && /symlink escapes/.test(err.message),
		);
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test("runEvidenceCommand executes validated scripts/ path without shell", () => {
	const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "spine-evidence-run-script-"));
	try {
		fs.mkdirSync(path.join(projectRoot, "scripts"), { recursive: true });
		const scriptPath = path.join(projectRoot, "scripts", "gate-evidence.sh");
		fs.writeFileSync(scriptPath, "#!/bin/sh\necho evidence-script-ok\n", "utf-8");
		fs.chmodSync(scriptPath, 0o755);

		const result = runEvidenceCommand(projectRoot, "scripts/gate-evidence.sh");
		assert.equal(result.skipped, false);
		assert.equal(result.ok, true);
		assert.match(result.output, /evidence-script-ok/);
	} finally {
		fs.rmSync(projectRoot, { recursive: true, force: true });
	}
});

test("runEvidenceCommand rejects scripts path traversal at resolve time", () => {
	const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "spine-evidence-reject-script-"));
	try {
		const result = runEvidenceCommand(projectRoot, "scripts/../outside.sh");
		assert.equal(result.skipped, false);
		assert.equal(result.ok, false);
		assert.match(result.output, /\[rejected\].*not allowed: outside.sh/);
	} finally {
		fs.rmSync(projectRoot, { recursive: true, force: true });
	}
});

test("runEvidenceCommand executes allowlisted argv without shell", () => {
	const projectRoot = os.tmpdir();
	const result = runEvidenceCommand(projectRoot, `node -e "console.log('evidence-ok')"`);

	assert.equal(result.skipped, false);
	assert.equal(result.ok, true);
	assert.match(result.output, /evidence-ok/);
});

test("runEvidenceCommand rejects malicious config strings", () => {
	const projectRoot = os.tmpdir();
	const result = runEvidenceCommand(projectRoot, "npm test; rm -rf /");

	assert.equal(result.skipped, false);
	assert.equal(result.ok, false);
	assert.match(result.output, /\[rejected\].*metacharacters/);
});

test("runEvidenceCommand skips empty command", () => {
	const result = runEvidenceCommand(os.tmpdir(), "");
	assert.equal(result.skipped, true);
	assert.equal(result.ok, false);
});

test("runEvidenceCommand rejects disallowed build binary", () => {
	const result = runEvidenceCommand(os.tmpdir(), "make install");
	assert.equal(result.skipped, false);
	assert.equal(result.ok, false);
	assert.match(result.output, /\[rejected\].*not allowed: make/);
});

test("parseEvidenceCommandArgv rejects subshell injection", () => {
	assert.throws(
		() => parseEvidenceCommandArgv("npm test $(whoami)"),
		(err) => err instanceof EvidenceCommandError,
	);
});

test("collectEvidenceBundle writes summary and .complete marker atomically", async () => {
	const fs = await import("node:fs");
	const { initGitRepo, destroyGitRepo } = await import("../helpers/git-fixture.mjs");
	const { collectEvidenceBundle, evidenceDir } = await import("../../src/batch/evidence.mjs");

	const projectRoot = await initGitRepo("spine-evidence-atomic-");
	const batchId = "20260620T120000";
	try {
		const { evidenceRefs } = collectEvidenceBundle({
			projectRoot,
			batchId,
			batchState: { batchId, phase: "completed", baseBranch: "main" },
			config: { baseBranch: "main", gates: {} },
		});

		const dir = evidenceDir(projectRoot, batchId);
		const completePath = path.join(dir, ".complete");
		assert.ok(fs.existsSync(completePath), "expected evidence/.complete marker");
		const complete = JSON.parse(fs.readFileSync(completePath, "utf-8"));
		assert.ok(complete.completedAt);
		assert.deepEqual(complete.evidenceRefs, evidenceRefs);

		const summaryPath = path.join(dir, "summary.md");
		assert.ok(fs.existsSync(summaryPath));
		assert.ok(evidenceRefs.includes("evidence/summary.md"));

		const entries = fs.readdirSync(dir, { recursive: true }).map(String);
		assert.equal(entries.some((name) => name.includes(".tmp")), false);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("collectEvidenceBundle writes rejected output for unsafe testing.test", async () => {
	const fs = await import("node:fs");
	const { initGitRepo, destroyGitRepo } = await import("../helpers/git-fixture.mjs");
	const { collectEvidenceBundle, evidenceDir } = await import("../../src/batch/evidence.mjs");

	const projectRoot = await initGitRepo("spine-evidence-reject-");
	const batchId = "20260603T120000";
	try {
		fs.mkdirSync(path.join(projectRoot, ".spine"), { recursive: true });
		fs.writeFileSync(
			path.join(projectRoot, ".spine", "spine-config.json"),
			JSON.stringify(
				{
					configVersion: 1,
					baseBranch: "main",
					testing: { test: "npm test; rm -rf /", build: "", testWithCoverage: "" },
					gates: { collectTestEvidence: true, collectBuildEvidence: false },
				},
				null,
				2,
			),
			"utf-8",
		);

		const { evidenceRefs } = collectEvidenceBundle({
			projectRoot,
			batchId,
			batchState: { batchId, phase: "completed", baseBranch: "main" },
			config: JSON.parse(fs.readFileSync(path.join(projectRoot, ".spine", "spine-config.json"), "utf-8")),
		});

		const outputPath = path.join(evidenceDir(projectRoot, batchId), "test-output.txt");
		assert.ok(fs.existsSync(outputPath));
		assert.ok(evidenceRefs.includes("evidence/test-output.txt"));
		const output = fs.readFileSync(outputPath, "utf-8");
		assert.match(output, /\[rejected\].*metacharacters/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
