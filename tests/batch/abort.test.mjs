import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { abortBatch, abortSignalPath } from "../../src/batch/abort.mjs";
import { archiveBatchStatePath } from "../../src/batch/lifecycle.mjs";
import { appendJournalEvent, journalPath, readJournalEvents } from "../../src/batch/journal.mjs";
import {
	createInitialBatchState,
	defaultSegmentId,
	saveSpineBatchState,
	spineBatchStatePath,
} from "../../src/batch/state.mjs";
import { laneTaskBranch, laneWorktreePath, provisionLaneWorktree } from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

/**
 * SP-792 / #301: serve `stale` on the first read of the active batch-state
 * path and pass every later read through to the real on-disk file — exactly
 * the view a terminal write sees when a concurrent engine save lands between
 * its pre-lock read and its lock section. Returns a restore function.
 *
 * @param {string} statePath
 * @param {object} stale
 */
function serveStaleStateOnFirstRead(statePath, stale) {
	const realReadFileSync = fs.readFileSync;
	let served = false;
	fs.readFileSync = (/** @type {any[]} */ ...args) => {
		if (!served && String(args[0]) === statePath) {
			served = true;
			return `${JSON.stringify(stale, null, 2)}\n`;
		}
		return realReadFileSync(...args);
	};
	return () => {
		fs.readFileSync = realReadFileSync;
	};
}

function writeRunningBatch(projectRoot, batchId) {
	const state = createInitialBatchState({
		batchId,
		baseBranch: "main",
		orchBranch: `orch/spine-${batchId}`,
		wavePlan: [["TP-999"]],
		tasks: [
			{
				taskId: "TP-999",
				laneNumber: 1,
				status: "running",
				taskFolder: "spine-tasks/TP-999-smoke",
				startedAt: Date.now(),
				endedAt: null,
				doneFileFound: false,
				exitReason: null,
			},
		],
		lanes: [
			{
				laneNumber: 1,
				laneId: "lane-1",
				worktreePath: laneWorktreePath(projectRoot, batchId, 1),
				branch: laneTaskBranch(batchId, 1),
				taskIds: ["TP-999"],
				lastHeartbeatAt: null,
				workerPid: 999999,
			},
		],
	});
	state.phase = "running";
	saveSpineBatchState(projectRoot, state);
	return state;
}

test("abortBatch archives batch-state before clearing active file", async () => {
	const projectRoot = await initGitRepo("spine-abort-archive-");
	try {
		const batchId = "20260601T170000";
		writeRunningBatch(projectRoot, batchId);
		appendJournalEvent(projectRoot, batchId, "batch.started", { fromPhase: "planning", toPhase: "running" });

		const activePath = spineBatchStatePath(projectRoot);
		assert.ok(fs.existsSync(activePath));

		const result = abortBatch({ projectRoot, reason: "operator abort" });
		assert.equal(result.ok, true);
		assert.equal(result.batchId, batchId);

		const archivePath = archiveBatchStatePath(projectRoot, batchId);
		assert.ok(fs.existsSync(archivePath), "archive must exist before active is cleared");
		assert.ok(!fs.existsSync(activePath), "active batch-state must be cleared");

		const archived = JSON.parse(fs.readFileSync(archivePath, "utf-8"));
		assert.equal(archived.phase, "aborted");
		assert.equal(archived.batchId, batchId);
		assert.ok(Array.isArray(archived.segments));
		assert.equal(archived.segments[0]?.segmentId, defaultSegmentId("TP-999"));
		assert.equal(archived.segments[0]?.status, "aborted");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("abortBatch journals batch.aborted and preserves prior journal tail", async () => {
	const projectRoot = await initGitRepo("spine-abort-journal-");
	try {
		const batchId = "20260601T170001";
		writeRunningBatch(projectRoot, batchId);
		appendJournalEvent(projectRoot, batchId, "batch.started", { fromPhase: "planning", toPhase: "running" });
		appendJournalEvent(projectRoot, batchId, "task.started", { taskId: "TP-999" });

		const before = readJournalEvents(projectRoot, batchId);
		assert.equal(before.length, 2);

		const result = abortBatch({ projectRoot, reason: "test" });
		assert.equal(result.ok, true);

		const after = readJournalEvents(projectRoot, batchId);
		assert.equal(after.length, 3);
		assert.equal(after[0].type, "batch.started");
		assert.equal(after[1].type, "task.started");
		assert.equal(after[2].type, "batch.aborted");
		assert.equal(after[2].payload?.reason, "test");
		assert.ok(fs.existsSync(journalPath(projectRoot, batchId)));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("abortBatch completes on a journal with a torn line", async () => {
	const projectRoot = await initGitRepo("spine-abort-torn-");
	try {
		const batchId = "20260815T170700";
		writeRunningBatch(projectRoot, batchId);
		appendJournalEvent(projectRoot, batchId, "batch.started", { fromPhase: "planning", toPhase: "running" });

		// Crash mid-append: torn JSON fragment without trailing newline.
		fs.appendFileSync(journalPath(projectRoot, batchId), '{"type":"x"', "utf-8");

		const result = abortBatch({ projectRoot, reason: "torn journal abort" });
		assert.equal(result.ok, true);
		assert.equal(result.batchId, batchId);

		const activePath = spineBatchStatePath(projectRoot);
		assert.ok(!fs.existsSync(activePath), "active batch-state must be cleared");

		const after = readJournalEvents(projectRoot, batchId);
		assert.equal(after.length, 2);
		assert.equal(after[0].type, "batch.started");
		assert.equal(after[1].type, "batch.aborted");
		assert.equal(after[1].payload?.reason, "torn journal abort");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("abortBatch writes abort signal without killing on graceful abort", async () => {
	const projectRoot = await initGitRepo("spine-abort-graceful-");
	try {
		const batchId = "20260601T170002";
		writeRunningBatch(projectRoot, batchId);

		const result = abortBatch({ projectRoot, hard: false });
		assert.equal(result.ok, true);
		assert.equal(result.hard, false);

		const signalPath = abortSignalPath(projectRoot, batchId);
		assert.ok(fs.existsSync(signalPath));
		const signal = JSON.parse(fs.readFileSync(signalPath, "utf-8"));
		assert.equal(signal.hard, false);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("hard abort removes lane worktree when cleanup enabled", async () => {
	const projectRoot = await initGitRepo("spine-abort-hard-wt-");
	try {
		const batchId = "20260601T170003";
		const orchBranch = `orch/spine-${batchId}`;
		const { execFileSync } = await import("node:child_process");
		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
		provisionLaneWorktree({ projectRoot, batchId, laneNumber: 1, orchBranch });

		writeRunningBatch(projectRoot, batchId);
		const wt = laneWorktreePath(projectRoot, batchId, 1);
		assert.ok(fs.existsSync(wt));

		const result = abortBatch({ projectRoot, hard: true });
		assert.equal(result.ok, true);
		assert.equal(result.hard, true);
		assert.ok(!fs.existsSync(wt), "hard abort should remove lane worktree by default");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("hard abort keeps worktree when cleanupOnHardAbort is false", async () => {
	const projectRoot = await initGitRepo("spine-abort-hard-keep-");
	try {
		const configPath = path.join(projectRoot, ".spine", "spine-config.json");
		const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
		config.lanes = { ...config.lanes, cleanupWorktreesOnHardAbort: false };
		fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf-8");

		const batchId = "20260601T170004";
		const orchBranch = `orch/spine-${batchId}`;
		const { execFileSync } = await import("node:child_process");
		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
		provisionLaneWorktree({ projectRoot, batchId, laneNumber: 1, orchBranch });

		writeRunningBatch(projectRoot, batchId);
		const wt = laneWorktreePath(projectRoot, batchId, 1);

		const result = abortBatch({ projectRoot, hard: true });
		assert.equal(result.ok, true);
		assert.ok(fs.existsSync(wt), "worktree kept when cleanup disabled");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("abortBatch fails when no active batch", async () => {
	const projectRoot = await initGitRepo("spine-abort-none-");
	try {
		const result = abortBatch({ projectRoot });
		assert.equal(result.ok, false);
		assert.match(result.headline, /No active batch/i);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("abortBatch dry-run leaves live batch unarchived and unjournaled", async () => {
	const projectRoot = await initGitRepo("spine-abort-dry-run-");
	try {
		const batchId = "20260601T170005";
		writeRunningBatch(projectRoot, batchId);
		appendJournalEvent(projectRoot, batchId, "batch.started", { fromPhase: "planning", toPhase: "running" });

		const activePath = spineBatchStatePath(projectRoot);
		const archivePath = archiveBatchStatePath(projectRoot, batchId);
		const signalPath = abortSignalPath(projectRoot, batchId);
		const beforeJournal = readJournalEvents(projectRoot, batchId);
		assert.equal(beforeJournal.length, 1);

		const result = abortBatch({
			projectRoot,
			reason: "preview only",
			dryRun: true,
		});
		assert.equal(result.ok, true);
		assert.equal(result.dryRun, true);
		assert.equal(result.batchId, batchId);
		assert.equal(result.diagnosis, "abort_preview");
		assert.equal(result.archivePath, archivePath);
		assert.match(result.headline, /Would abort and archive/i);

		assert.ok(fs.existsSync(activePath), "active batch-state must remain");
		assert.ok(!fs.existsSync(archivePath), "archive must not be written on dry-run");
		assert.ok(!fs.existsSync(signalPath), "abort signal must not be written on dry-run");

		const afterJournal = readJournalEvents(projectRoot, batchId);
		assert.equal(afterJournal.length, 1);
		assert.equal(afterJournal[0].type, "batch.started");

		const active = JSON.parse(fs.readFileSync(activePath, "utf-8"));
		assert.equal(active.phase, "running");
		assert.equal(active.batchId, batchId);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("abortBatch without dry-run still archives after a prior dry-run", async () => {
	const projectRoot = await initGitRepo("spine-abort-dry-then-real-");
	try {
		const batchId = "20260601T170006";
		writeRunningBatch(projectRoot, batchId);

		const preview = abortBatch({ projectRoot, dryRun: true });
		assert.equal(preview.ok, true);
		assert.equal(preview.dryRun, true);

		const activePath = spineBatchStatePath(projectRoot);
		assert.ok(fs.existsSync(activePath));

		const result = abortBatch({ projectRoot, reason: "operator abort" });
		assert.equal(result.ok, true);
		assert.equal(result.dryRun, undefined);
		assert.ok(fs.existsSync(archiveBatchStatePath(projectRoot, batchId)));
		assert.ok(!fs.existsSync(activePath));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("abortBatch archives the in-lock state, not the stale pre-lock snapshot", async () => {
	const projectRoot = await initGitRepo("spine-abort-inlock-");
	try {
		const batchId = "20260601T170007";
		writeRunningBatch(projectRoot, batchId);
		appendJournalEvent(projectRoot, batchId, "batch.started", { fromPhase: "planning", toPhase: "running" });

		// Newer engine save on disk; the pre-lock read is served the older copy.
		const activePath = spineBatchStatePath(projectRoot);
		const onDisk = JSON.parse(fs.readFileSync(activePath, "utf-8"));
		onDisk.sp792Marker = "in-lock";
		fs.writeFileSync(activePath, `${JSON.stringify(onDisk, null, 2)}\n`, "utf-8");
		const stale = { ...onDisk, sp792Marker: "pre-lock" };
		const restore = serveStaleStateOnFirstRead(activePath, stale);

		const result = abortBatch({ projectRoot, reason: "archive freshest state" });
		restore();

		assert.equal(result.ok, true);
		assert.equal(result.batchId, batchId);

		const archivePath = archiveBatchStatePath(projectRoot, batchId);
		assert.ok(fs.existsSync(archivePath), "archive must exist");
		const archived = JSON.parse(fs.readFileSync(archivePath, "utf-8"));
		assert.equal(archived.phase, "aborted");
		assert.equal(
			archived.sp792Marker,
			"in-lock",
			"archive must hold the state as read inside the lock, not the pre-lock snapshot",
		);
		assert.ok(!fs.existsSync(activePath), "active batch-state must be cleared");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("abortBatch fails closed and archives nothing when batch id changed during abort", async () => {
	const projectRoot = await initGitRepo("spine-abort-id-changed-");
	try {
		const batchId = "20260601T170008";
		writeRunningBatch(projectRoot, batchId);

		// A different batch took over the active state file before the lock.
		const activePath = spineBatchStatePath(projectRoot);
		const stale = JSON.parse(fs.readFileSync(activePath, "utf-8"));
		fs.writeFileSync(
			activePath,
			`${JSON.stringify({ ...stale, batchId: "20260601T179999", phase: "running" }, null, 2)}\n`,
			"utf-8",
		);
		const restore = serveStaleStateOnFirstRead(activePath, stale);

		const result = abortBatch({ projectRoot, reason: "race" });
		restore();

		assert.equal(result.ok, false);
		assert.equal(result.error, "batch_state_changed_during_terminal_write");
		assert.equal(result.headline, "Batch state changed during abort — re-run spine status --diagnose");
		assert.equal(result.batchId, batchId);
		assert.ok(!fs.existsSync(archiveBatchStatePath(projectRoot, batchId)), "nothing archived for the stale batch");
		assert.ok(!fs.existsSync(abortSignalPath(projectRoot, batchId)), "no abort signal for the stale batch");
		assert.ok(fs.existsSync(activePath), "the newer active batch-state must survive untouched");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("abortBatch fails closed when the state file vanished before the lock", async () => {
	const projectRoot = await initGitRepo("spine-abort-vanished-");
	try {
		const batchId = "20260601T170009";
		writeRunningBatch(projectRoot, batchId);

		// The in-lock reload (second read of the state path) hits ENOENT as if
		// the active state file was removed between the pre-lock read and the lock.
		const activePath = spineBatchStatePath(projectRoot);
		const realReadFileSync = fs.readFileSync;
		let stateReads = 0;
		fs.readFileSync = (/** @type {any[]} */ ...args) => {
			if (String(args[0]) === activePath) {
				stateReads += 1;
				if (stateReads >= 2) {
					const err = /** @type {NodeJS.ErrnoException} */ (new Error("ENOENT: state vanished"));
					err.code = "ENOENT";
					throw err;
				}
			}
			return realReadFileSync(...args);
		};

		let result;
		try {
			result = abortBatch({ projectRoot, reason: "vanished" });
		} finally {
			fs.readFileSync = realReadFileSync;
		}

		assert.equal(result.ok, false);
		assert.equal(result.error, "batch_state_changed_during_terminal_write");
		assert.match(result.headline ?? "", /Batch state changed during abort/);
		assert.ok(!fs.existsSync(archiveBatchStatePath(projectRoot, batchId)), "nothing archived");
		assert.ok(!fs.existsSync(abortSignalPath(projectRoot, batchId)), "no abort signal written");
		assert.ok(fs.existsSync(activePath), "active batch-state untouched");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
