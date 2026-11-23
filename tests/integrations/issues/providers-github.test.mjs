import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
	defaultRunGh,
	GH_CALL_TIMEOUT_MS,
} from "../../../src/integrations/issues/providers/github.mjs";

/** Injectable spawn stub recording calls; returns a fixed or per-call result. */
function makeSpawn(result) {
	/** @type {{ file: string, args: string[], options: object }[]} */
	const calls = [];
	/** @type {typeof import("node:child_process").spawnSync} */
	const spawn = (file, args, options) => {
		calls.push({ file, args, options });
		return typeof result === "function" ? result(file, args, options) : result;
	};
	return { calls, spawn };
}

test("GH_CALL_TIMEOUT_MS is the 30s hard timeout", () => {
	assert.equal(GH_CALL_TIMEOUT_MS, 30_000);
});

test("defaultRunGh spawns gh with array args, no shell, piped stdio, hard timeout", () => {
	const projectRoot = path.join("tmp", "proj");
	const { calls, spawn } = makeSpawn({ status: 0, stdout: "ok\n", stderr: "" });
	const run = defaultRunGh(projectRoot, ["issue", "list", "--state", "open"], { spawn });
	assert.equal(calls.length, 1);
	const call = calls[0];
	assert.equal(call.file, "gh");
	assert.deepEqual(call.args, ["issue", "list", "--state", "open"]);
	assert.equal(call.options.cwd, projectRoot);
	assert.equal(call.options.encoding, "utf-8");
	assert.deepEqual(call.options.stdio, ["ignore", "pipe", "pipe"]);
	assert.equal(call.options.timeout, GH_CALL_TIMEOUT_MS);
	assert.equal(call.options.shell, undefined);
	assert.deepEqual(run, { status: 0, stdout: "ok\n", stderr: "", error: null });
});

test("defaultRunGh maps success stdout/stderr strings through unchanged", () => {
	const { spawn } = makeSpawn({ status: 0, stdout: "line1\nline2", stderr: "warn: x" });
	const run = defaultRunGh("/root", ["auth", "status"], { spawn });
	assert.equal(run.status, 0);
	assert.equal(run.stdout, "line1\nline2");
	assert.equal(run.stderr, "warn: x");
	assert.equal(run.error, null);
});

test("defaultRunGh soft-fails: non-zero status and stderr pass through, no throw", () => {
	const { spawn } = makeSpawn({ status: 4, stdout: "", stderr: "gh: auth required" });
	const run = defaultRunGh("/root", ["issue", "view", "1"], { spawn });
	assert.equal(run.status, 4);
	assert.equal(run.stdout, "");
	assert.equal(run.stderr, "gh: auth required");
});

test("defaultRunGh maps missing-binary ENOENT to status null with error", () => {
	const enoent = Object.assign(new Error("spawn gh ENOENT"), { code: "ENOENT" });
	const { calls, spawn } = makeSpawn({ status: null, stdout: null, stderr: null, error: enoent });
	const run = defaultRunGh("/root", ["auth", "status"], { spawn });
	assert.deepEqual(calls[0].options.stdio, ["ignore", "pipe", "pipe"]);
	assert.equal(run.status, null);
	assert.equal(run.stdout, "");
	assert.equal(run.stderr, "");
	assert.equal(run.error, enoent);
});

test("defaultRunGh coerces non-string stdout/stderr to empty strings", () => {
	const { spawn } = makeSpawn({ status: 0, stdout: Buffer.from("raw"), stderr: undefined });
	const run = defaultRunGh("/root", ["issue", "list"], { spawn });
	assert.equal(run.stdout, "");
	assert.equal(run.stderr, "");
});

test("defaultRunGh maps killed-by-timeout result (null status, ETIMEDOUT error)", () => {
	const timeoutErr = Object.assign(new Error("spawn gh ETIMEDOUT"), { code: "ETIMEDOUT", killed: true });
	const { spawn } = makeSpawn({ status: null, stdout: "", stderr: "", error: timeoutErr });
	const run = defaultRunGh("/root", ["issue", "list"], { spawn });
	assert.equal(run.status, null);
	assert.equal(run.error?.code, "ETIMEDOUT");
});
