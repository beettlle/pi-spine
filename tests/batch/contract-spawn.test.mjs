/**
 * Async shell runner for contract commands (SP-799 / #305).
 *
 * Proves the primitive does not block the event loop, tree-kills backgrounded
 * grandchildren on timeout, caps captured output while letting the process run
 * to completion, and resolves (never rejects) with 127 on spawn failure.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";

import {
	resolveContractShellInvocation,
	runShellCommandAsync,
} from "../../src/batch/contract-spawn.mjs";

const POSIX_ONLY = { skip: process.platform === "win32" };

/**
 * Poll until `pid` is gone or `deadlineMs` elapses.
 *
 * @param {number} pid
 * @param {number} deadlineMs
 * @returns {Promise<boolean>} true when the pid is still alive at the deadline
 */
async function pidStillAlive(pid, deadlineMs) {
	const deadline = Date.now() + deadlineMs;
	while (Date.now() < deadline) {
		try {
			process.kill(pid, 0);
			await new Promise((r) => setTimeout(r, 100));
		} catch {
			return false;
		}
	}
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

test("resolveContractShellInvocation returns $SHELL with the -c flag", () => {
	const [shell, args] = resolveContractShellInvocation("echo hi");
	assert.ok(shell.length > 0);
	assert.deepEqual(args, ["-c", "echo hi"]);
	assert.equal(resolveContractShellInvocation("x", "/custom/sh")[0], "/custom/sh");
});

test("runShellCommandAsync does not block the event loop while a command runs", async () => {
	let ticks = 0;
	const timer = setInterval(() => {
		ticks += 1;
	}, 50);
	try {
		const result = await runShellCommandAsync(process.cwd(), "sleep 1");
		assert.equal(result.exitCode, 0);
		assert.equal(result.timedOut, false);
		assert.equal(result.signal, null);
		assert.equal(result.truncated, false);
		assert.ok(result.durationMs >= 900, `durationMs ${result.durationMs} < 900`);
	} finally {
		clearInterval(timer);
	}
	// spawnSync-style blocking would advance the 50ms interval ~0 times during sleep 1.
	assert.ok(ticks >= 10, `expected >=10 interval ticks during sleep 1, got ${ticks}`);
}, POSIX_ONLY);

test("timeout tree-kills a backgrounded grandchild", async (t) => {
	const dir = await mkdtemp(path.join(os.tmpdir(), "sp799-treekill-"));
	t.after(() => rm(dir, { recursive: true, force: true }));
	const pidfile = path.join(dir, "grandchild.pid");
	const command = `sleep 30 & echo $! > ${pidfile}; wait`;

	const result = await runShellCommandAsync(dir, command, { timeoutMs: 500 });

	assert.equal(result.timedOut, true);
	assert.equal(result.exitCode, null);
	assert.equal(result.signal, "SIGTERM");
	const grandchildPid = Number(fs.readFileSync(pidfile, "utf-8").trim());
	assert.ok(grandchildPid > 0, `grandchild pid not parsed from ${pidfile}`);
	assert.equal(
		await pidStillAlive(grandchildPid, 3000),
		false,
		`grandchild ${grandchildPid} still alive 3s after timeout`,
	);
}, POSIX_ONLY);

test("output beyond maxBuffer is truncated while the process runs to completion", async () => {
	const maxBuffer = 16 * 1024;
	const command = "node -e \"process.stdout.write('a'.repeat(64 * 1024))\"";
	const result = await runShellCommandAsync(process.cwd(), command, { maxBuffer });

	assert.equal(result.truncated, true);
	assert.ok(
		Buffer.byteLength(result.stdout, "utf-8") <= maxBuffer,
		`captured ${Buffer.byteLength(result.stdout, "utf-8")} bytes > cap ${maxBuffer}`,
	);
	assert.match(result.stdout, /^a+$/);
	assert.equal(result.exitCode, 0);
	assert.equal(result.timedOut, false);
}, POSIX_ONLY);

test("spawn failure resolves with exitCode 127 instead of rejecting", async () => {
	const result = await runShellCommandAsync(process.cwd(), "echo hi", {
		shell: "/nonexistent/spine-contract-shell-799",
	});
	assert.equal(result.exitCode, 127);
	assert.equal(result.timedOut, false);
	assert.ok(
		result.stderr.length > 0,
		"spawn error message expected in stderr",
	);
});
