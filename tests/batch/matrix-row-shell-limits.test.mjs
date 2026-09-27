// @ts-nocheck
/**
 * SP-783 — matrix row shell timeout and output cap (#297).
 *
 * A hung or chatty matrix row must not hold a global lane slot forever or
 * grow engine memory without bound: `runShellInDir` times out rows (killing
 * the whole process tree, reporting exit code 124 + `timedOut`) and keeps
 * only a bounded output tail (flagging `outputTruncated` with a marker).
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
	DEFAULT_MATRIX_ROW_OUTPUT_MAX_BYTES,
	DEFAULT_MATRIX_ROW_TIMEOUT_MS,
	resolveMatrixRowTimeoutOverride,
	runShellInDir,
} from "../../src/batch/engine-lanes/matrix.mjs";

const ENV_KEY = "SPINE_MATRIX_ROW_TIMEOUT_MS";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Restore an env var to its pre-test value (delete when it was unset). */
function withEnvKey(value, run) {
	const original = process.env[ENV_KEY];
	process.env[ENV_KEY] = value;
	return Promise.resolve()
		.then(run)
		.finally(() => {
			if (original === undefined) delete process.env[ENV_KEY];
			else process.env[ENV_KEY] = original;
		});
}

/** @returns {boolean} true when any process command line matches the pattern. */
function pgrepMatches(pattern) {
	const result = spawnSync("pgrep", ["-f", pattern], {
		encoding: "utf-8",
		timeout: 5_000,
	});
	return result.status === 0;
}

/** Poll until no process matches the pattern (the tree kill has landed). */
async function waitForTreeExit(pattern, timeoutMs = 5_000) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (!pgrepMatches(pattern)) return true;
		await sleep(100);
	}
	return !pgrepMatches(pattern);
}

function makeTempDir(prefix) {
	return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test("matrix row limits default to the contract timeout and the worker-output cap", () => {
	assert.equal(DEFAULT_MATRIX_ROW_TIMEOUT_MS, 600_000);
	assert.equal(DEFAULT_MATRIX_ROW_OUTPUT_MAX_BYTES, 262_144);
});

test("resolveMatrixRowTimeoutOverride accepts positive integers and ignores invalid values", () => {
	return withEnvKey(undefined, () => {
		assert.equal(resolveMatrixRowTimeoutOverride(), null, "unset env falls back");
		return withEnvKey("1500", () => {
			assert.equal(resolveMatrixRowTimeoutOverride(), 1500);
			for (const invalid of ["", "abc", "0", "-5", "12.5", "1e-3"]) {
				process.env[ENV_KEY] = invalid;
				assert.equal(
					resolveMatrixRowTimeoutOverride(),
					null,
					`invalid value ignored: ${JSON.stringify(invalid)}`,
				);
			}
		});
	});
});

test("runShellInDir kills a timed-out row's process tree and reports 124", async () => {
	const tmp = makeTempDir("spine-row-timeout-");
	try {
		const start = Date.now();
		// `sleep 97` is a grandchild (child of the /bin/sh row shell); `wait`
		// keeps the shell alive until it exits, so only a tree kill ends the row.
		const run = await runShellInDir(tmp, "sleep 97 & wait", null, { timeoutMs: 400 });
		const elapsed = Date.now() - start;

		assert.equal(run.exitCode, 124);
		assert.equal(run.timedOut, true);
		assert.match(run.output, /matrix row command timed out after 400ms/);
		assert.ok(
			elapsed < 30_000,
			`expected the tree kill to be fast, took ${elapsed}ms (sleep 97 must not complete)`,
		);
		assert.equal(
			await waitForTreeExit("sleep 97"),
			true,
			"grandchild sleep should be dead after the timeout kill",
		);
	} finally {
		fs.rmSync(tmp, { recursive: true, force: true });
	}
});

test("runShellInDir keeps only a bounded output tail and flags truncation", async () => {
	const tmp = makeTempDir("spine-row-cap-");
	try {
		const cap = 1024;
		const run = await runShellInDir(tmp, "yes 0123456789 | head -c 400000", null, {
			maxOutputBytes: cap,
		});
		assert.equal(run.exitCode, 0);
		assert.equal(run.outputTruncated, true);
		assert.match(run.output, /^\[… \d+ bytes truncated …\]\n/);
		assert.ok(
			run.output.length <= cap + 64,
			`output.length ${run.output.length} must stay at the ${cap}-byte cap plus the marker`,
		);

		const small = await runShellInDir(tmp, "echo hello", null, { maxOutputBytes: cap });
		assert.equal(small.exitCode, 0);
		assert.equal(small.outputTruncated, undefined);
		assert.equal(small.output, "hello\n");
	} finally {
		fs.rmSync(tmp, { recursive: true, force: true });
	}
});

test("runShellInDir ignores an invalid maxOutputBytes option and uses the default cap", async () => {
	const tmp = makeTempDir("spine-row-cap-default-");
	try {
		const run = await runShellInDir(tmp, "yes 0123456789 | head -c 300000", null, {
			maxOutputBytes: -5,
		});
		assert.equal(run.outputTruncated, true);
		assert.ok(run.output.length <= DEFAULT_MATRIX_ROW_OUTPUT_MAX_BYTES + 64);
	} finally {
		fs.rmSync(tmp, { recursive: true, force: true });
	}
});

test("SPINE_MATRIX_ROW_TIMEOUT_MS overrides the row timeout", async () => {
	const tmp = makeTempDir("spine-row-timeout-env-");
	try {
		await withEnvKey("500", async () => {
			const start = Date.now();
			const run = await runShellInDir(tmp, "sleep 96");
			const elapsed = Date.now() - start;
			assert.equal(run.exitCode, 124);
			assert.equal(run.timedOut, true);
			assert.match(run.output, /matrix row command timed out after 500ms/);
			assert.ok(
				elapsed < 30_000,
				`expected the env override to time the row out fast, took ${elapsed}ms`,
			);
		});
	} finally {
		fs.rmSync(tmp, { recursive: true, force: true });
	}
});
