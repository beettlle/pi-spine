import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { runInit } from "../../bin/spine-init.mjs";
import { archiveBatchStatePath, completeBatch, dismissBatch } from "../../src/batch/lifecycle.mjs";
import { approveIntegrateGate, openIntegrateGate } from "../../src/batch/gate.mjs";
import { loadSpineConfig } from "../../bin/spine-config.mjs";
import { integrateOrchToBase } from "../../src/batch/integrate.mjs";
import { batchHistoryPath } from "../../src/batch/state.mjs";

const FIXTURES = path.join(process.cwd(), "tests/fixtures/batch-state");

function loadFixture(name) {
	return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), "utf-8"));
}

async function createProjectFixture() {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-lifecycle-"));
	execFileSync("git", ["init"], { cwd: projectRoot, stdio: "ignore" });
	runInit(projectRoot, ["--tasks-root", "taskplane-tasks"]);
	execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["config", "user.name", "Test User"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", "init"], { cwd: projectRoot, stdio: "ignore" });
	return projectRoot;
}

function writePiBatchState(projectRoot, fixture) {
	fs.mkdirSync(path.join(projectRoot, ".pi"), { recursive: true });
	fs.writeFileSync(
		path.join(projectRoot, ".pi", "batch-state.json"),
		JSON.stringify(fixture, null, 2),
		"utf-8",
	);
}

function writeSpineBatchState(projectRoot, fixture) {
	fs.mkdirSync(path.join(projectRoot, ".spine"), { recursive: true });
	fs.writeFileSync(
		path.join(projectRoot, ".spine", "batch-state.json"),
		JSON.stringify(fixture, null, 2),
		"utf-8",
	);
}

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

test("dismiss archives batch-state before clearing active file", async () => {
	const projectRoot = await createProjectFixture();
	try {
		const fixture = loadFixture("limbo-stale-20260531T165700.json");
		// SP-786 / #303: dismiss clears spine-owned `.spine/batch-state.json` only;
		// Taskplane-owned `.pi/batch-state.json` is never modified (covered in
		// batch-state-handoff.test.mjs).
		writeSpineBatchState(projectRoot, fixture);
		const activePath = path.join(projectRoot, ".spine", "batch-state.json");

		const result = dismissBatch({ projectRoot, reason: "test" });
		assert.equal(result.ok, true);
		assert.equal(result.batchId, fixture.batchId);

		const archivePath = archiveBatchStatePath(projectRoot, fixture.batchId);
		assert.ok(fs.existsSync(archivePath), "archive must exist");
		assert.ok(!fs.existsSync(activePath), "active batch-state must be cleared");

		const archived = JSON.parse(fs.readFileSync(archivePath, "utf-8"));
		assert.equal(archived.batchId, fixture.batchId);

		const historyPath = batchHistoryPath(projectRoot);
		assert.ok(fs.existsSync(historyPath), "batch-history.json must exist");
		const history = JSON.parse(fs.readFileSync(historyPath, "utf-8"));
		assert.ok(Array.isArray(history));
		assert.equal(history.at(-1)?.batchId, fixture.batchId);
		assert.equal(history.at(-1)?.action, "dismissed");
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("complete with --detect-manual-merge succeeds when orch merged to main", async () => {
	const projectRoot = await createProjectFixture();
	try {
		const fixture = loadFixture("limbo-stale-20260531T165700.json");
		writePiBatchState(projectRoot, fixture);

		execFileSync("git", ["checkout", "-b", fixture.orchBranch], { cwd: projectRoot, stdio: "ignore" });
		fs.writeFileSync(path.join(projectRoot, "merged.txt"), "orch work", "utf-8");
		execFileSync("git", ["add", "merged.txt"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "orch lane merge"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["merge", "--no-ff", fixture.orchBranch, "-m", "merge orch"], {
			cwd: projectRoot,
			stdio: "ignore",
		});

		const result = completeBatch({ projectRoot, detectManualMerge: true });
		assert.equal(result.ok, true);
		assert.equal(result.diagnosis, "completed");

		const archivePath = archiveBatchStatePath(projectRoot, fixture.batchId);
		assert.ok(fs.existsSync(archivePath));
		assert.ok(!fs.existsSync(path.join(projectRoot, ".spine", "batch-state.json")));
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("complete refused when mergeResults succeeded but orch not on main", async () => {
	const projectRoot = await createProjectFixture();
	try {
		const fixture = loadFixture("limbo-stale-20260531T165700.json");
		const orchBranch = fixture.orchBranch;
		const batchFixture = {
			...fixture,
			phase: "completed",
			endedAt: Date.now(),
			mergeResults: [
				{
					waveIndex: 0,
					status: "succeeded",
					failedLane: null,
					failureReason: null,
					mergeCommit: "abc1234",
				},
			],
		};
		writeSpineBatchState(projectRoot, batchFixture);

		execFileSync("git", ["checkout", "-b", orchBranch], { cwd: projectRoot, stdio: "ignore" });
		fs.writeFileSync(path.join(projectRoot, "orch-only.txt"), "not on main yet", "utf-8");
		execFileSync("git", ["add", "orch-only.txt"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "orch only"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });

		const refused = completeBatch({ projectRoot });
		assert.equal(refused.ok, false);
		assert.equal(refused.failureClass, "NeedsIntegrate");
		assert.equal(refused.suggestedCommand, "spine integrate");

		const batchId = String(batchFixture.batchId ?? batchFixture.id ?? "");
		const config = loadSpineConfig(projectRoot).config;
		openIntegrateGate({ projectRoot, batchId, batchState: batchFixture, config });
		approveIntegrateGate({ projectRoot, batchId });

		const integrated = integrateOrchToBase({ projectRoot });
		assert.equal(integrated.ok, true);

		const completed = completeBatch({ projectRoot });
		assert.equal(completed.ok, true);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("dismiss refused when diagnosis is running without --force", async () => {
	const projectRoot = await createProjectFixture();
	try {
		const fixture = loadFixture("running-batch.json");
		writePiBatchState(projectRoot, fixture);

		const result = dismissBatch({ projectRoot });
		assert.equal(result.ok, false);
		assert.match(result.headline, /force/i);
		assert.ok(fs.existsSync(path.join(projectRoot, ".pi", "batch-state.json")));
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("dismiss archives the in-lock state, not the stale pre-lock snapshot", async () => {
	const projectRoot = await createProjectFixture();
	try {
		const fixture = loadFixture("limbo-stale-20260531T165700.json");
		// Newer engine save on disk; the pre-lock read is served the older copy.
		const statePath = path.join(projectRoot, ".spine", "batch-state.json");
		writeSpineBatchState(projectRoot, { ...fixture, sp792Marker: "in-lock" });
		const restore = serveStaleStateOnFirstRead(statePath, { ...fixture, sp792Marker: "pre-lock" });

		const result = dismissBatch({ projectRoot, reason: "test" });
		restore();

		assert.equal(result.ok, true);
		assert.equal(result.batchId, fixture.batchId);

		const archived = JSON.parse(
			fs.readFileSync(archiveBatchStatePath(projectRoot, fixture.batchId), "utf-8"),
		);
		assert.equal(
			archived.sp792Marker,
			"in-lock",
			"dismiss archive must hold the state as read inside the lock, not the pre-lock snapshot",
		);
		assert.ok(!fs.existsSync(statePath), "active batch-state must be cleared");

		const history = JSON.parse(fs.readFileSync(batchHistoryPath(projectRoot), "utf-8"));
		assert.equal(history.at(-1)?.action, "dismissed");
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("dismiss fails closed when the batch became active again inside the lock", async () => {
	const projectRoot = await createProjectFixture();
	try {
		const fixture = loadFixture("limbo-stale-20260531T165700.json");
		const statePath = path.join(projectRoot, ".spine", "batch-state.json");
		// A resume writer flipped the batch back to running on disk; the
		// pre-lock read is served the dismissable limbo snapshot.
		writeSpineBatchState(projectRoot, { ...fixture, phase: "running" });
		const restore = serveStaleStateOnFirstRead(statePath, fixture);

		const refused = dismissBatch({ projectRoot, reason: "test" });
		assert.equal(refused.ok, false);
		assert.equal(refused.error, "batch_state_changed_during_terminal_write");
		assert.equal(
			refused.headline,
			"Batch state changed during dismiss — re-run spine status --diagnose",
		);
		assert.ok(!fs.existsSync(archiveBatchStatePath(projectRoot, fixture.batchId)), "nothing archived");
		assert.ok(fs.existsSync(statePath), "active batch-state must survive");

		// --force skips the in-lock phase re-validation and dismisses anyway.
		const forced = dismissBatch({ projectRoot, reason: "test", force: true });
		restore();

		assert.equal(forced.ok, true);
		const archived = JSON.parse(
			fs.readFileSync(archiveBatchStatePath(projectRoot, fixture.batchId), "utf-8"),
		);
		assert.equal(archived.phase, "running", "forced dismiss archives the in-lock state");
		assert.ok(!fs.existsSync(statePath));
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("complete archives the in-lock state, not the stale pre-lock snapshot", async () => {
	const projectRoot = await createProjectFixture();
	try {
		const fixture = loadFixture("limbo-stale-20260531T165700.json");
		const statePath = path.join(projectRoot, ".spine", "batch-state.json");
		writeSpineBatchState(projectRoot, { ...fixture, sp792Marker: "in-lock" });

		execFileSync("git", ["checkout", "-b", fixture.orchBranch], { cwd: projectRoot, stdio: "ignore" });
		fs.writeFileSync(path.join(projectRoot, "merged.txt"), "orch work", "utf-8");
		execFileSync("git", ["add", "merged.txt"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "orch lane merge"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["merge", "--no-ff", fixture.orchBranch, "-m", "merge orch"], {
			cwd: projectRoot,
			stdio: "ignore",
		});

		const restore = serveStaleStateOnFirstRead(statePath, { ...fixture, sp792Marker: "pre-lock" });
		const result = completeBatch({ projectRoot, detectManualMerge: true });
		restore();

		assert.equal(result.ok, true);
		assert.equal(result.diagnosis, "completed");

		const archived = JSON.parse(
			fs.readFileSync(archiveBatchStatePath(projectRoot, fixture.batchId), "utf-8"),
		);
		assert.equal(
			archived.sp792Marker,
			"in-lock",
			"complete archive must hold the state as read inside the lock, not the pre-lock snapshot",
		);
		assert.ok(!fs.existsSync(statePath), "active batch-state must be cleared");
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("complete fails closed and archives nothing when batch id changed during complete", async () => {
	const projectRoot = await createProjectFixture();
	try {
		const fixture = loadFixture("limbo-stale-20260531T165700.json");
		const statePath = path.join(projectRoot, ".spine", "batch-state.json");
		writeSpineBatchState(projectRoot, { ...fixture, sp792Marker: "pre-lock" });

		// The stale snapshot must pass every pre-lock gate: merge orch to main
		// so `detectManualMerge` sees a manually landed batch.
		execFileSync("git", ["checkout", "-b", fixture.orchBranch], { cwd: projectRoot, stdio: "ignore" });
		fs.writeFileSync(path.join(projectRoot, "merged.txt"), "orch work", "utf-8");
		execFileSync("git", ["add", "merged.txt"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "orch lane merge"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["merge", "--no-ff", fixture.orchBranch, "-m", "merge orch"], {
			cwd: projectRoot,
			stdio: "ignore",
		});

		// A different batch took over the active state file before the lock.
		fs.writeFileSync(
			statePath,
			`${JSON.stringify({ ...fixture, batchId: "20260531T179999", phase: "running" }, null, 2)}\n`,
			"utf-8",
		);
		const stale = { ...fixture, sp792Marker: "pre-lock" };
		const restore = serveStaleStateOnFirstRead(statePath, stale);

		const result = completeBatch({ projectRoot, detectManualMerge: true });
		restore();

		assert.equal(result.ok, false);
		assert.equal(result.error, "batch_state_changed_during_terminal_write");
		assert.equal(
			result.headline,
			"Batch state changed during complete — re-run spine status --diagnose",
		);
		assert.ok(!fs.existsSync(archiveBatchStatePath(projectRoot, fixture.batchId)), "nothing archived for the stale batch");
		assert.ok(
			!fs.existsSync(archiveBatchStatePath(projectRoot, "20260531T179999")),
			"nothing archived for the newer batch either",
		);
		assert.ok(fs.existsSync(statePath), "the newer active batch-state must survive untouched");
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});
