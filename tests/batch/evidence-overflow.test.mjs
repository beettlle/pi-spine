import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { runEvidenceCommand } from "../../src/batch/evidence-command.mjs";

/**
 * @param {string} source
 * @param {(projectRoot: string) => void} fn
 */
function withScript(source, fn) {
	const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "spine-evidence-overflow-"));
	try {
		fs.writeFileSync(path.join(projectRoot, "emit.cjs"), source);
		fn(projectRoot);
	} finally {
		fs.rmSync(projectRoot, { recursive: true, force: true });
	}
}

test("evidence output larger than maxBytes keeps the tail and the passing exit status", () => {
	withScript(`process.stdout.write("x".repeat(300000)); console.log("TAIL-SUMMARY");`, (projectRoot) => {
		const result = runEvidenceCommand(projectRoot, "node emit.cjs", 1024);
		assert.equal(result.ok, true, result.output.slice(0, 200));
		assert.equal(result.truncated, true);
		assert.match(result.output, /^\[evidence truncated: kept last 1024 of \d+ bytes\]/);
		assert.match(result.output, /TAIL-SUMMARY\n$/);
		assert.doesNotMatch(result.output, /ENOBUFS/);
	});
});

test("evidence overflow on a failing command still reports failure with the tail", () => {
	withScript(
		`process.stdout.write("y".repeat(300000)); console.error("FAIL-SUMMARY"); process.exit(3);`,
		(projectRoot) => {
			const result = runEvidenceCommand(projectRoot, "node emit.cjs", 1024);
			assert.equal(result.ok, false);
			assert.equal(result.truncated, true);
			assert.match(result.output, /FAIL-SUMMARY/);
			assert.match(result.output, /\[exit\] Command failed with exit code 3/);
		},
	);
});

test("small evidence output is not marked truncated", () => {
	withScript(`console.log("small");`, (projectRoot) => {
		const result = runEvidenceCommand(projectRoot, "node emit.cjs");
		assert.equal(result.ok, true);
		assert.equal(result.truncated, false);
		assert.equal(result.output, "small\n");
	});
});
