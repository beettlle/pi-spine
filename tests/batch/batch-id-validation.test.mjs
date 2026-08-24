import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";

import {
	BATCH_ID_PATTERN,
	batchIdRejectionReason,
	generateBatchId,
	isValidBatchId,
	validateBatchId,
} from "../../src/batch/batch-id.mjs";
import { generateBatchId as generateBatchIdFromState } from "../../src/batch/state.mjs";
import {
	resolveFollowBatchId,
	runJournalFollow,
} from "../../src/cli/journal-follow.mjs";
import { runLaneLogs } from "../../src/cli/lane-logs.mjs";

test("validateBatchId accepts backward-compatible archived IDs", () => {
	// Archived timestamp IDs must keep resolving (Do NOT break existing lookups).
	for (const id of [
		"20260529T134925",
		"20260709T051755",
		"20260823T004508-a1b2",
		"b1",
		"lane_test-1.2",
	]) {
		assert.equal(validateBatchId(id), id);
		assert.equal(isValidBatchId(id), true);
		assert.equal(batchIdRejectionReason(id), null);
	}
});

test("validateBatchId rejects path traversal and unsafe input", () => {
	for (const id of [
		"",
		"..",
		"../evil",
		"a..b",
		"a/b",
		"a\\b",
		"a\0b",
		"/etc/passwd",
		"C:\\windows",
		".hidden",
		"-leading-dash",
		"white space",
		null,
		undefined,
		42,
	]) {
		assert.equal(isValidBatchId(id), false, `expected rejection: ${String(id)}`);
		assert.throws(() => validateBatchId(id), /Invalid batch ID/);
	}
});

test("validateBatchId error message names the reason", () => {
	assert.throws(() => validateBatchId("../evil"), /Invalid batch ID/);
	assert.throws(() => validateBatchId("a..b"), /path traversal/);
	assert.throws(() => validateBatchId(""), /non-empty string/);
});

test("generateBatchId appends a 4-hex suffix and matches the allowlist pattern", () => {
	const id = generateBatchId(new Date(Date.UTC(2026, 7, 23, 0, 45, 8)));
	assert.match(id, /^20260823T004508-[0-9a-f]{4}$/);
	assert.match(id, BATCH_ID_PATTERN);
});

test("generateBatchId produces distinct IDs when suffix draws are unique", () => {
	// Inject deterministic suffixes: 200 real random 4-hex draws in one UTC second
	// collide ~26% of the time (birthday bound on 2^16), which flakes under coverage.
	let counter = 0;
	const ids = new Set();
	for (let i = 0; i < 200; i += 1) {
		ids.add(
			generateBatchId(new Date(), null, () => {
				counter += 1;
				return counter.toString(16).padStart(4, "0");
			}),
		);
	}
	assert.equal(ids.size, 200);
});

test("generateBatchId random suffix yields unique ids in a small sample", () => {
	const ids = new Set();
	for (let i = 0; i < 32; i += 1) {
		ids.add(generateBatchId());
	}
	assert.ok(ids.size >= 30, `expected >=30 unique of 32, got ${ids.size}`);
});

test("state.mjs re-exports generateBatchId", () => {
	assert.equal(generateBatchIdFromState, generateBatchId);
});

test("generateBatchId loops until the runtime dir is absent", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-batch-id-"));
	try {
		const taken = "20260823T004508-aaaa";
		fs.mkdirSync(path.join(root, ".spine", "runtime", taken), { recursive: true });

		const draws = ["aaaa", "bbbb"];
		const id = generateBatchId(
			new Date(Date.UTC(2026, 7, 23, 0, 45, 8)),
			root,
			() => draws.shift() ?? "cccc",
		);
		assert.equal(id, "20260823T004508-bbbb");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("generateBatchId throws when the runtime dir never frees up", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-batch-id-"));
	try {
		fs.mkdirSync(path.join(root, ".spine", "runtime", "20260823T004508-dead"), {
			recursive: true,
		});
		assert.throws(
			() =>
				generateBatchId(new Date(Date.UTC(2026, 7, 23, 0, 45, 8)), root, () => "dead"),
			/unique batch ID/,
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("resolveFollowBatchId rejects a traversal batch ID before path joins", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-batch-id-"));
	try {
		assert.throws(() => resolveFollowBatchId(root, "../../outside"), /Invalid batch ID/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("journal follow --batch rejects traversal with a clear error", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-batch-id-"));
	try {
		const result = await runJournalFollow({
			projectRoot: root,
			args: ["--batch", "../evil"],
			follow: false,
		});
		assert.equal(result.exitCode, 1);
		assert.match(result.output, /Invalid batch ID/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("lane logs --batch rejects traversal with a clear error", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-batch-id-"));
	try {
		const result = await runLaneLogs({
			projectRoot: root,
			args: ["--batch", "..\\..\\evil", "--lane", "1"],
		});
		assert.equal(result.exitCode, 1);
		assert.match(result.output, /Invalid batch ID/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
