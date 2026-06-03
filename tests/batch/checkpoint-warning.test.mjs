import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { configureGitIdentity } from "../helpers/git-fixture.mjs";
import {
	activitySignalsChanged,
	checkpointSignalsChanged,
	collectProgressSignals,
	computeStallDeadline,
	progressSignalsChanged,
	resolveScopedDirtyPaths,
	resolveStallConfig,
	shouldEmitCheckpointWarning,
} from "../../src/batch/heartbeat.mjs";
import { appendJournalEvent, extractJournalDiagnosisHints, readJournalEvents } from "../../src/batch/journal.mjs";

test("resolveStallConfig defaults checkpoint warning and no file-scope grace extension", () => {
	const cfg = resolveStallConfig({});
	assert.equal(cfg.checkpointWarningMs, 10 * 60 * 1000);
	assert.equal(cfg.extendGraceOnFileScope, false);
});

test("file-scope mtime is activity only — does not extend stall deadline by default", () => {
	const stallConfig = resolveStallConfig({
		lanes: { stallTimeoutMinutes: 60, stallGraceAfterProgressMinutes: 15 },
	});
	const startedAt = 0;
	const checkpointAt = 5 * 60 * 1000;
	const fileTouchAt = 50 * 60 * 1000;
	const stallConfigNarrow = resolveStallConfig({
		lanes: { stallTimeoutMinutes: 60, stallGraceAfterProgressMinutes: 15 },
	});
	const lateFileTouchAt = 55 * 60 * 1000;

	const deadlineWithoutFileTouch = computeStallDeadline({
		startedAt,
		lastProgressAt: checkpointAt,
		stallConfig: stallConfigNarrow,
	});
	const deadlineIfFileScopeExtendedGrace = computeStallDeadline({
		startedAt,
		lastProgressAt: lateFileTouchAt,
		stallConfig: stallConfigNarrow,
	});

	assert.equal(deadlineWithoutFileTouch, startedAt + stallConfigNarrow.stallTimeoutMs);
	assert.ok(deadlineIfFileScopeExtendedGrace > deadlineWithoutFileTouch);
	assert.equal(
		progressSignalsChanged(
			{ fileScopeMtimeMs: 1, dirtyPaths: [] },
			{ fileScopeMtimeMs: 2, dirtyPaths: [] },
		),
		false,
	);
	assert.equal(activitySignalsChanged({ fileScopeMtimeMs: 1 }, { fileScopeMtimeMs: 2 }), true);
});

test("checkpoint signals extend grace; STATUS update moves deadline", () => {
	const stallConfig = resolveStallConfig({
		lanes: { stallTimeoutMinutes: 1, stallGraceAfterProgressMinutes: 30 },
	});
	const startedAt = 0;
	const hardDeadline = startedAt + stallConfig.stallTimeoutMs;
	const lastCheckpointAt = 35 * 60 * 1000;
	const deadline = computeStallDeadline({ startedAt, lastProgressAt: lastCheckpointAt, stallConfig });
	const now = 40 * 60 * 1000;
	assert.ok(now >= hardDeadline);
	assert.ok(now < deadline);
});

test("shouldEmitCheckpointWarning after activity without checkpoint threshold", () => {
	const stallConfig = resolveStallConfig({ lanes: { checkpointWarningMinutes: 10 } });
	const signals = { fileScopeMtimeMs: Date.now(), dirtyPaths: ["src/a.txt"] };
	const lastCheckpointAt = Date.now() - 11 * 60 * 1000;

	assert.equal(
		shouldEmitCheckpointWarning({
			now: Date.now(),
			lastCheckpointAt,
			signals,
			stallConfig,
			activitySinceCheckpoint: true,
		}),
		true,
	);
	assert.equal(
		shouldEmitCheckpointWarning({
			now: Date.now(),
			lastCheckpointAt: Date.now() - 5 * 60 * 1000,
			signals,
			stallConfig,
			activitySinceCheckpoint: true,
		}),
		false,
	);
});

test("resolveScopedDirtyPaths limits porcelain to file scope and task folder", () => {
	const dir = fs.mkdtempSync(path.join(fs.realpathSync("."), "cp-warn-"));
	const taskFolder = path.join(dir, "spine-tasks", "TP-1");
	const scoped = path.join(dir, "src", "scoped.txt");
	const other = path.join(dir, "other.txt");
	fs.mkdirSync(path.dirname(scoped), { recursive: true });
	fs.mkdirSync(taskFolder, { recursive: true });
	fs.writeFileSync(scoped, "a", "utf-8");
	fs.writeFileSync(other, "b", "utf-8");
	fs.writeFileSync(path.join(taskFolder, "STATUS.md"), "s", "utf-8");

	execFileSync("git", ["init"], { cwd: dir, stdio: "ignore" });
	configureGitIdentity(dir);
	execFileSync("git", ["add", "-A"], { cwd: dir, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", "init"], { cwd: dir, stdio: "ignore" });
	fs.writeFileSync(scoped, "ab", "utf-8");
	fs.writeFileSync(other, "bc", "utf-8");

	const dirty = resolveScopedDirtyPaths(dir, ["src/scoped.txt"], taskFolder);
	assert.ok(dirty.includes("src/scoped.txt"));
	assert.ok(!dirty.includes("other.txt"));

	fs.rmSync(dir, { recursive: true, force: true });
});

test("lane.checkpoint_warning journal event and diagnose hints", () => {
	const projectRoot = fs.mkdtempSync(path.join(fs.realpathSync("."), "cp-journal-"));
	const batchId = "20260603T120000";
	try {
		appendJournalEvent(projectRoot, batchId, "lane.checkpoint_warning", {
			laneNumber: 1,
			taskId: "SAT-020",
			dirtyPaths: ["src/handler.mjs"],
			suggestion: "Commit step work and call spine_report_progress",
		});

		const events = readJournalEvents(projectRoot, batchId);
		assert.equal(events.length, 1);
		assert.equal(events[0].type, "lane.checkpoint_warning");
		assert.deepEqual(events[0].payload.dirtyPaths, ["src/handler.mjs"]);

		const hints = extractJournalDiagnosisHints(events);
		assert.ok(hints.some((h) => h.type === "lane.checkpoint_warning"));
		assert.match(hints.find((h) => h.type === "lane.checkpoint_warning").summary, /dirty:/);
	} finally {
		fs.rmSync(projectRoot, { recursive: true, force: true });
	}
});

test("extractJournalDiagnosisHints omits stale checkpoint_warning older than 30 minutes", () => {
	const staleTs = new Date(Date.now() - 31 * 60 * 1000).toISOString();
	const hints = extractJournalDiagnosisHints([
		{
			type: "lane.checkpoint_warning",
			timestamp: staleTs,
			eventId: "e1",
			payload: { dirtyPaths: ["a.txt"] },
		},
	]);
	assert.equal(hints.some((h) => h.type === "lane.checkpoint_warning"), false);
});

test("collectProgressSignals includes dirtyPaths for scoped changes", () => {
	const dir = fs.mkdtempSync(path.join(fs.realpathSync("."), "cp-signals-"));
	const taskFolder = path.join(dir, "spine-tasks", "TP-2");
	const scoped = path.join(dir, "src", "x.txt");
	fs.mkdirSync(path.dirname(scoped), { recursive: true });
	fs.mkdirSync(taskFolder, { recursive: true });
	fs.writeFileSync(scoped, "1", "utf-8");
	fs.writeFileSync(path.join(taskFolder, "STATUS.md"), "ok", "utf-8");

	execFileSync("git", ["init"], { cwd: dir, stdio: "ignore" });
	configureGitIdentity(dir);
	execFileSync("git", ["add", "-A"], { cwd: dir, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", "init"], { cwd: dir, stdio: "ignore" });
	fs.writeFileSync(scoped, "2", "utf-8");

	const signals = collectProgressSignals({
		worktreePath: dir,
		taskFolder,
		fileScopePaths: ["src/x.txt"],
	});
	assert.ok(signals.dirtyPaths.includes("src/x.txt"));
	assert.ok(checkpointSignalsChanged(null, signals) || signals.statusMtimeMs);
	assert.equal(checkpointSignalsChanged(signals, signals), false);

	fs.rmSync(dir, { recursive: true, force: true });
});
