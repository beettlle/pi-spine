import assert from "node:assert/strict";
import fs from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { runSpineGate } from "../../bin/spine-gate.mjs";

/**
 * SP-869 (#313): `spine gate --batch` must reject unsafe IDs at the CLI
 * boundary with a clear error and a non-zero exit, in both human and JSON
 * modes, for every gate action.
 */

test("gate rejects a traversal batch ID with a clear error for every action", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-gate-batch-id-"));
	try {
		for (const action of ["status", "approve", "reject", "reopen"]) {
			const result = runSpineGate({
				projectRoot: root,
				args: [action, "--batch", "../evil", "--reason", "test"],
			});
			assert.equal(result.exitCode, 2, `expected exit 2 for ${action}`);
			assert.match(result.output, /Gate action failed/);
			assert.match(result.output, /Invalid --batch ID/);
			assert.match(result.output, /Invalid batch ID "\.\.\/evil"/);
		}
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("gate --json emits a structured error for an unsafe batch ID", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-gate-batch-id-"));
	try {
		const result = runSpineGate({
			projectRoot: root,
			args: ["status", "--batch", "..\\..\\evil", "--json"],
		});
		assert.equal(result.exitCode, 2);
		const payload = JSON.parse(result.output);
		assert.equal(payload.ok, false);
		assert.equal(payload.exitCode, 2);
		assert.equal(payload.headline, "Invalid --batch ID");
		assert.match(payload.error, /Invalid batch ID/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("gate rejects option-shaped and parseable-but-unsafe batch IDs", () => {
	const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "spine-gate-batch-id-"));
	try {
		// Option-shaped values are refused by the strict argv parser (exit 2).
		for (const id of ["--output=/tmp/pwn", "-x"]) {
			const result = runSpineGate({ projectRoot: root, args: ["status", "--batch", id] });
			assert.equal(result.exitCode, 2, `expected exit 2 for ${JSON.stringify(id)}`);
			assert.match(result.output, /Unknown option/);
		}
		// Values that parse cleanly must still be rejected by validation.
		for (const id of ["a..b", "white space", "/etc/passwd"]) {
			const result = runSpineGate({ projectRoot: root, args: ["status", "--batch", id] });
			assert.equal(result.exitCode, 2, `expected exit 2 for ${JSON.stringify(id)}`);
			assert.match(result.output, /Invalid batch ID/);
		}
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test("gate accepts a well-formed batch ID (proceeds past validation)", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-gate-batch-id-"));
	try {
		// No gate on record: the ID passes the boundary and reaches the lookup.
		const result = runSpineGate({ projectRoot: root, args: ["status", "--batch", "20260601T120000"] });
		assert.equal(result.exitCode, 0);
		assert.doesNotMatch(result.output, /Invalid batch ID/);
		assert.match(result.output, /No integrate gate on record/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
