import assert from "node:assert/strict";
import fs, { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

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

test("writeJsonAtomic cleans up temp file when write fails", () => {
	const dir = mkdtempSync(path.join(os.tmpdir(), "spine-atomic-write-fail-"));
	try {
		const targetPath = path.join(dir, "out.json");
		const originalWrite = fs.writeFileSync;
		let sawTmpPath = false;

		fs.writeFileSync = (filePath, ...args) => {
			if (String(filePath).includes(".tmp")) {
				sawTmpPath = true;
				throw new Error("simulated write failure");
			}
			return originalWrite(filePath, ...args);
		};

		try {
			assert.throws(() => writeJsonAtomic(targetPath, { fail: true }), /simulated write failure/);
		} finally {
			fs.writeFileSync = originalWrite;
		}

		assert.equal(sawTmpPath, true);
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
