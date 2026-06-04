import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
	EvidenceCommandError,
	parseEvidenceCommandArgv,
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
