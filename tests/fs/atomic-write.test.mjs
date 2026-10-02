import assert from "node:assert/strict";
import fs, { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { mock } from "node:test";

import {
	makeAtomicTempPath,
	writeJsonAtomic,
	writeTextAtomic,
} from "../../src/fs/atomic-write.mjs";

test("writeTextAtomic writes content and removes temp file", () => {
	const dir = mkdtempSync(path.join(os.tmpdir(), "spine-atomic-write-"));
	try {
		const targetPath = path.join(dir, "nested", "out.txt");
		writeTextAtomic(targetPath, "hello\n");

		assert.equal(fs.readFileSync(targetPath, "utf-8"), "hello\n");
		const entries = fs.readdirSync(dir, { recursive: true });
		assert.equal(entries.some((name) => String(name).includes(".tmp")), false);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("writeJsonAtomic writes pretty JSON with trailing newline", () => {
	const dir = mkdtempSync(path.join(os.tmpdir(), "spine-atomic-json-"));
	try {
		const targetPath = path.join(dir, "data.json");
		writeJsonAtomic(targetPath, { ok: true, count: 2 });

		const text = fs.readFileSync(targetPath, "utf-8");
		assert.equal(text, `${JSON.stringify({ ok: true, count: 2 }, null, 2)}\n`);
		assert.deepEqual(JSON.parse(text), { ok: true, count: 2 });
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("makeAtomicTempPath generates unique suffixes", () => {
	const targetPath = path.join(os.tmpdir(), "example.json");
	const left = makeAtomicTempPath(targetPath);
	const right = makeAtomicTempPath(targetPath);

	assert.notEqual(left, right);
	assert.ok(left.startsWith(`${targetPath}.`));
	assert.match(left, /\.tmp$/);
});

test("writeTextAtomic cleans up temp file when rename fails", () => {
	const dir = mkdtempSync(path.join(os.tmpdir(), "spine-atomic-fail-"));
	try {
		const targetPath = path.join(dir, "blocked.txt");
		fs.mkdirSync(targetPath);

		assert.throws(() => writeTextAtomic(targetPath, "content"), (err) => err instanceof Error);

		const leftovers = fs
			.readdirSync(dir, { recursive: true })
			.map(String)
			.filter((name) => name.includes(".tmp"));
		assert.equal(leftovers.length, 0);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("writeJsonAtomic cleans up temp file when write fails", (t) => {
	const dir = mkdtempSync(path.join(os.tmpdir(), "spine-atomic-write-fail-"));
	try {
		const targetPath = path.join(dir, "out.json");
		let sawTmpWrite = false;

		const writeMock = mock.method(fs, "writeSync", () => {
			sawTmpWrite = true;
			throw new Error("simulated write failure");
		});
		t.after(() => writeMock.mock.restore());

		assert.throws(() => writeJsonAtomic(targetPath, { fail: true }), /simulated write failure/);

		assert.equal(sawTmpWrite, true);
		assert.equal(fs.existsSync(targetPath), false);
		const leftovers = fs
			.readdirSync(dir, { recursive: true })
			.map(String)
			.filter((name) => name.includes(".tmp"));
		assert.equal(leftovers.length, 0);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

/**
 * Wraps fs.openSync, fs.fsyncSync, and fs.renameSync to record the durable
 * write sequence. Fds opened for `*.tmp` paths are classified as "file",
 * everything else as "dir" (only the parent directory is opened read-only).
 * Optional injected failures let tests simulate fsync errors per fd kind.
 *
 * @param {import("node:test").TestContext} t
 * @param {{ onFileSync?: Error, onDirFsync?: Error }} [failures]
 * @returns {string[]} ordered event log like ["fsync:file", "rename", "fsync:dir"]
 */
function trackDurableWriteSequence(t, failures = {}) {
	const fdKinds = new Map();
	const events = [];
	const originalOpenSync = fs.openSync;
	const originalFsyncSync = fs.fsyncSync;
	const originalRenameSync = fs.renameSync;

	const openMock = mock.method(fs, "openSync", (openedPath, flags) => {
		const fd = originalOpenSync(openedPath, flags);
		fdKinds.set(fd, String(openedPath).endsWith(".tmp") ? "file" : "dir");
		return fd;
	});
	const fsyncMock = mock.method(fs, "fsyncSync", (fd) => {
		const kind = fdKinds.get(fd) ?? "unknown";
		events.push(`fsync:${kind}`);
		if (kind === "file" && failures.onFileSync) throw failures.onFileSync;
		if (kind === "dir" && failures.onDirFsync) throw failures.onDirFsync;
		return originalFsyncSync(fd);
	});
	const renameMock = mock.method(fs, "renameSync", (from, to) => {
		events.push("rename");
		return originalRenameSync(from, to);
	});

	t.after(() => {
		openMock.mock.restore();
		fsyncMock.mock.restore();
		renameMock.mock.restore();
	});

	return events;
}

function countTmpLeftovers(dir) {
	return fs
		.readdirSync(dir, { recursive: true })
		.map(String)
		.filter((name) => name.includes(".tmp")).length;
}

test("writeJsonAtomic fsyncs the temp file before rename and the directory after", (t) => {
	const dir = mkdtempSync(path.join(os.tmpdir(), "spine-atomic-order-"));
	try {
		const events = trackDurableWriteSequence(t);
		const targetPath = path.join(dir, "nested", "out.json");

		writeJsonAtomic(targetPath, { ok: true });

		assert.deepEqual(events, ["fsync:file", "rename", "fsync:dir"]);
		assert.deepEqual(JSON.parse(fs.readFileSync(targetPath, "utf-8")), { ok: true });
		assert.equal(countTmpLeftovers(dir), 0);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("writeJsonAtomic tolerates EPERM from the directory fsync and still lands the write", (t) => {
	const dir = mkdtempSync(path.join(os.tmpdir(), "spine-atomic-dir-eperm-"));
	try {
		const events = trackDurableWriteSequence(t, {
			onDirFsync: Object.assign(new Error("simulated directory fsync EPERM"), { code: "EPERM" }),
		});
		const targetPath = path.join(dir, "data.json");

		writeJsonAtomic(targetPath, { ok: true });

		assert.deepEqual(events, ["fsync:file", "rename", "fsync:dir"]);
		assert.deepEqual(JSON.parse(fs.readFileSync(targetPath, "utf-8")), { ok: true });
		assert.equal(countTmpLeftovers(dir), 0);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("writeJsonAtomic propagates a file fsync error and leaves no temp file behind", (t) => {
	const dir = mkdtempSync(path.join(os.tmpdir(), "spine-atomic-file-eio-"));
	try {
		const events = trackDurableWriteSequence(t, {
			onFileSync: Object.assign(new Error("simulated file fsync EIO"), { code: "EIO" }),
		});
		const targetPath = path.join(dir, "out.json");

		assert.throws(() => writeJsonAtomic(targetPath, { fail: true }), /simulated file fsync EIO/);

		assert.deepEqual(events, ["fsync:file"]);
		assert.equal(fs.existsSync(targetPath), false);
		assert.equal(countTmpLeftovers(dir), 0);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});
