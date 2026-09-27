import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { installEngineCrashHandlers } from "../../src/batch/engine-crash-guard.mjs";

const BATCH_ID = "20260927T000000";

/**
 * Minimal on-disk batch state so the guard's real batchId resolution
 * (loadSpineBatchState) finds an active batch. No git repo needed.
 */
function writeActiveBatchState(projectRoot, overrides = {}) {
	const spineDir = path.join(projectRoot, ".spine");
	fs.mkdirSync(spineDir, { recursive: true });
	const state = { batchId: BATCH_ID, phase: "running", ...overrides };
	fs.writeFileSync(path.join(spineDir, "batch-state.json"), JSON.stringify(state), "utf-8");
	return state;
}

function makeFakeDeps(overrides = {}) {
	const calls = {
		journal: [],
		markFailed: [],
		exits: [],
	};
	const deps = {
		appendJournalEvent: (projectRoot, batchId, type, payload) => {
			calls.journal.push({ projectRoot, batchId, type, payload });
			return { batchId, type };
		},
		markBatchFailed: (params) => {
			calls.markFailed.push(params);
			return true;
		},
		exit: (code) => {
			calls.exits.push(code);
		},
		now: () => 1234567890,
		...overrides,
	};
	return { deps, calls };
}

/**
 * Install the guard and grab the exact listener it added, by diffing the
 * process listener list before/after — no real crash is ever emitted.
 */
function installAndCaptureHandler(eventName, projectRoot, deps) {
	const before = process.listeners(eventName);
	const uninstall = installEngineCrashHandlers({ projectRoot, deps });
	const added = process.listeners(eventName).filter((fn) => !before.includes(fn));
	assert.equal(added.length, 1, `install adds exactly one ${eventName} listener`);
	return { uninstall, handler: added[0] };
}

function captureStderrWrites(fn) {
	const original = process.stderr.write;
	/** @type {string[]} */
	const chunks = [];
	process.stderr.write = (chunk) => {
		chunks.push(String(chunk));
		return true;
	};
	try {
		fn();
	} finally {
		process.stderr.write = original;
	}
	return chunks.join("");
}

test("uncaughtException handler journals engine.crashed, marks batch failed, exits once", () => {
	const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "spine-crash-guard-"));
	try {
		writeActiveBatchState(projectRoot);
		const { deps, calls } = makeFakeDeps();
		const { uninstall, handler } = installAndCaptureHandler("uncaughtException", projectRoot, deps);

		// Invoke the installed listener directly — never a real uncaught exception.
		const boom = new Error("boom: lane worker exploded");
		boom.stack = "Error: boom: lane worker exploded\n    at frame1\n    at frame2";
		captureStderrWrites(() => handler(boom));

		assert.equal(calls.journal.length, 1);
		assert.equal(calls.journal[0].batchId, BATCH_ID);
		assert.equal(calls.journal[0].type, "engine.crashed");
		assert.equal(calls.journal[0].payload.kind, "uncaughtException");
		assert.equal(calls.journal[0].payload.error, "boom: lane worker exploded");
		assert.equal(calls.journal[0].payload.stack, boom.stack);

		assert.equal(calls.markFailed.length, 1);
		assert.equal(calls.markFailed[0].batchId, BATCH_ID);
		assert.equal(calls.markFailed[0].message, "boom: lane worker exploded");
		assert.equal(calls.markFailed[0].endedAt, 1234567890);

		assert.deepEqual(calls.exits, [1]);
		uninstall();
	} finally {
		fs.rmSync(projectRoot, { recursive: true, force: true });
	}
});

test("unhandledRejection handler journals kind unhandledRejection", () => {
	const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "spine-crash-guard-"));
	try {
		writeActiveBatchState(projectRoot);
		const { deps, calls } = makeFakeDeps();
		const { uninstall, handler } = installAndCaptureHandler("unhandledRejection", projectRoot, deps);

		// Pass the rejection reason directly (a rejected promise here would
		// itself fire a real unhandledRejection after the test ends).
		captureStderrWrites(() => handler(new Error("rejection reason")));

		assert.equal(calls.journal.length, 1);
		assert.equal(calls.journal[0].payload.kind, "unhandledRejection");
		assert.equal(calls.journal[0].payload.error, "rejection reason");
		assert.deepEqual(calls.exits, [1]);
		uninstall();
	} finally {
		fs.rmSync(projectRoot, { recursive: true, force: true });
	}
});

test("handler runs once: a second fault is ignored (re-entrancy guard)", () => {
	const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "spine-crash-guard-"));
	try {
		writeActiveBatchState(projectRoot);
		const { deps, calls } = makeFakeDeps();
		const { uninstall, handler } = installAndCaptureHandler("uncaughtException", projectRoot, deps);

		captureStderrWrites(() => {
			handler(new Error("first crash"));
			handler(new Error("second crash"));
		});

		assert.equal(calls.journal.length, 1);
		assert.equal(calls.journal[0].payload.error, "first crash");
		assert.equal(calls.markFailed.length, 1);
		assert.deepEqual(calls.exits, [1]);
		uninstall();
	} finally {
		fs.rmSync(projectRoot, { recursive: true, force: true });
	}
});

test("uninstall removes both crash listeners", () => {
	const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "spine-crash-guard-"));
	try {
		const { deps } = makeFakeDeps();

		const beforeException = process.listeners("uncaughtException");
		const beforeRejection = process.listeners("unhandledRejection");
		const uninstall = installEngineCrashHandlers({ projectRoot, deps });

		assert.equal(
			process.listeners("uncaughtException").filter((fn) => !beforeException.includes(fn)).length,
			1,
		);
		assert.equal(
			process.listeners("unhandledRejection").filter((fn) => !beforeRejection.includes(fn)).length,
			1,
		);

		uninstall();

		assert.deepEqual(process.listeners("uncaughtException"), beforeException);
		assert.deepEqual(process.listeners("unhandledRejection"), beforeRejection);
	} finally {
		fs.rmSync(projectRoot, { recursive: true, force: true });
	}
});

test("throwing journal still exits non-zero and surfaces the original error on stderr", () => {
	const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "spine-crash-guard-"));
	try {
		writeActiveBatchState(projectRoot);
		const { deps, calls } = makeFakeDeps({
			appendJournalEvent: () => {
				throw new Error("journal disk full");
			},
		});
		const { uninstall, handler } = installAndCaptureHandler("uncaughtException", projectRoot, deps);

		const stderr = captureStderrWrites(() => handler(new Error("the original crash")));

		assert.deepEqual(calls.exits, [1], "exit(1) still called exactly once");
		assert.equal(calls.markFailed.length, 0, "mark-failed skipped after journal failure");
		assert.match(stderr, /the original crash/, "original error reaches stderr");
		assert.match(stderr, /journal disk full/, "guard failure itself is reported");
		uninstall();
	} finally {
		fs.rmSync(projectRoot, { recursive: true, force: true });
	}
});

test("throwing markBatchFailed still exits non-zero after journaling", () => {
	const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "spine-crash-guard-"));
	try {
		writeActiveBatchState(projectRoot);
		const { deps, calls } = makeFakeDeps({
			markBatchFailed: () => {
				throw new Error("state lock stuck");
			},
		});
		const { uninstall, handler } = installAndCaptureHandler("uncaughtException", projectRoot, deps);

		const stderr = captureStderrWrites(() => handler(new Error("crash before save")));

		assert.equal(calls.journal.length, 1, "journal write happened before the state save threw");
		assert.deepEqual(calls.exits, [1]);
		assert.match(stderr, /crash before save/);
		uninstall();
	} finally {
		fs.rmSync(projectRoot, { recursive: true, force: true });
	}
});

test("no active batch state: nothing journaled, still exits 1", () => {
	const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "spine-crash-guard-"));
	try {
		const { deps, calls } = makeFakeDeps();
		const { uninstall, handler } = installAndCaptureHandler("uncaughtException", projectRoot, deps);

		const stderr = captureStderrWrites(() => handler(new Error("crash without batch")));

		assert.equal(calls.journal.length, 0);
		assert.equal(calls.markFailed.length, 0);
		assert.deepEqual(calls.exits, [1]);
		assert.match(stderr, /no active batch state/);
		uninstall();
	} finally {
		fs.rmSync(projectRoot, { recursive: true, force: true });
	}
});

test("error message capped at 500 chars and stack capped at 20 lines", () => {
	const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "spine-crash-guard-"));
	try {
		writeActiveBatchState(projectRoot);
		const { deps, calls } = makeFakeDeps();
		const { uninstall, handler } = installAndCaptureHandler("uncaughtException", projectRoot, deps);

		const longMessage = "x".repeat(2000);
		const longStack = Array.from({ length: 60 }, (_, i) => `    at frame${i}`).join("\n");
		const error = new Error(longMessage);
		error.stack = `Error: ${longMessage}\n${longStack}`;
		captureStderrWrites(() => handler(error));

		const payload = calls.journal[0].payload;
		assert.equal(payload.error.length, 500);
		// Stack line 0 is the `Error: <message>` line; the 20-line window ends at frame18.
		const stackLines = payload.stack.split("\n");
		assert.equal(stackLines.length, 20);
		assert.equal(stackLines[1], "    at frame0");
		assert.equal(stackLines[19], "    at frame18");
		assert.ok(!payload.stack.includes("frame19"), "frames beyond the cap are dropped");
		uninstall();
	} finally {
		fs.rmSync(projectRoot, { recursive: true, force: true });
	}
});

test("default markBatchFailed writes failed phase, endedAt, lastError via real state I/O", () => {
	const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "spine-crash-guard-"));
	try {
		writeActiveBatchState(projectRoot, { lastError: null });

		// Real journal/state side effects except exit, against the temp projectRoot.
		/** @type {number[]} */
		const exits = [];
		const { uninstall, handler } = installAndCaptureHandler("uncaughtException", projectRoot, {
			exit: (code) => exits.push(code),
		});

		captureStderrWrites(() => handler(new Error("real io crash")));

		assert.deepEqual(exits, [1]);
		const state = JSON.parse(fs.readFileSync(path.join(projectRoot, ".spine", "batch-state.json"), "utf-8"));
		assert.equal(state.phase, "failed");
		assert.equal(typeof state.endedAt, "number");
		assert.equal(state.lastError, "real io crash");

		// Journal event landed in the real journal file for this batch.
		const journalPath = path.join(projectRoot, ".spine", "runtime", BATCH_ID, "journal", "events.jsonl");
		const events = fs.readFileSync(journalPath, "utf-8").trim().split("\n").map((line) => JSON.parse(line));
		const crashed = events.filter((event) => event.type === "engine.crashed");
		assert.equal(crashed.length, 1);
		assert.equal(crashed[0].payload.kind, "uncaughtException");
		uninstall();
	} finally {
		fs.rmSync(projectRoot, { recursive: true, force: true });
	}
});
