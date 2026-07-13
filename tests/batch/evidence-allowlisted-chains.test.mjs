import assert from "node:assert/strict";
import os from "node:os";
import test from "node:test";
import {
	EvidenceCommandError,
	parseEvidenceCommandChain,
	runEvidenceCommand,
} from "../../src/batch/evidence-command.mjs";

test("parseEvidenceCommandChain accepts npm run typecheck && npm test", () => {
	assert.deepEqual(parseEvidenceCommandChain("npm run typecheck && npm test"), [
		["npm", "run", "typecheck"],
		["npm", "test"],
	]);
});

test("parseEvidenceCommandChain accepts multi-segment allowlisted chain", () => {
	assert.deepEqual(parseEvidenceCommandChain("node -e \"1\" && npm test && npx --version"), [
		["node", "-e", "1"],
		["npm", "test"],
		["npx", "--version"],
	]);
});

test("parseEvidenceCommandChain rejects pipe", () => {
	assert.throws(
		() => parseEvidenceCommandChain("npm test | tee out.txt"),
		(err) => err instanceof EvidenceCommandError && /metacharacters/.test(err.message),
	);
});

test("parseEvidenceCommandChain rejects semicolon", () => {
	assert.throws(
		() => parseEvidenceCommandChain("npm test; rm -rf /"),
		(err) => err instanceof EvidenceCommandError && /metacharacters/.test(err.message),
	);
});

test("parseEvidenceCommandChain rejects redirect", () => {
	assert.throws(
		() => parseEvidenceCommandChain("npm test > out.txt"),
		(err) => err instanceof EvidenceCommandError && /metacharacters/.test(err.message),
	);
});

test("parseEvidenceCommandChain rejects $VAR expansion", () => {
	assert.throws(
		() => parseEvidenceCommandChain("npm test && npm run $VAR"),
		(err) => err instanceof EvidenceCommandError && /variable expansion/.test(err.message),
	);
});

test("parseEvidenceCommandChain rejects lone background &", () => {
	assert.throws(
		() => parseEvidenceCommandChain("npm test & npm run build"),
		(err) => err instanceof EvidenceCommandError && /metacharacters/.test(err.message),
	);
});

test("parseEvidenceCommandChain rejects empty chain segment", () => {
	assert.throws(
		() => parseEvidenceCommandChain("npm test &&"),
		(err) => err instanceof EvidenceCommandError && /empty evidence command chain segment/.test(err.message),
	);
});

test("parseEvidenceCommandChain rejects non-allowlisted segment executable", () => {
	assert.throws(
		() => parseEvidenceCommandChain("npm test && curl https://evil.example"),
		(err) => err instanceof EvidenceCommandError && /not allowed: curl/.test(err.message),
	);
});

test("parseEvidenceCommandChain rejects scripts/ in multi-segment chain", () => {
	assert.throws(
		() => parseEvidenceCommandChain("scripts/gate.sh && npm test"),
		(err) => err instanceof EvidenceCommandError && /not allowed: gate.sh/.test(err.message),
	);
});

test("runEvidenceCommand executes allowlisted && chain fail-closed", () => {
	const projectRoot = os.tmpdir();
	const ok = runEvidenceCommand(
		projectRoot,
		`node -e "console.log('seg-a')" && node -e "console.log('seg-b')"`,
	);
	assert.equal(ok.skipped, false);
	assert.equal(ok.ok, true);
	assert.match(ok.output, /seg-a/);
	assert.match(ok.output, /seg-b/);

	const failed = runEvidenceCommand(
		projectRoot,
		`node -e "process.exit(1)" && node -e "console.log('should-not-run')"`,
	);
	assert.equal(failed.skipped, false);
	assert.equal(failed.ok, false);
	assert.doesNotMatch(failed.output, /should-not-run/);
});
