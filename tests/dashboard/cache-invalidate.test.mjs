import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { dismissBatch } from "../../src/batch/lifecycle.mjs";
import {
	bumpDashboardInvalidateSignal,
	consumeDashboardInvalidateSignal,
	dashboardInvalidateSignalPath,
	resetDashboardInvalidateConsumeCursor,
} from "../../src/dashboard/cache-invalidate.mjs";
import { buildDashboardSnapshot } from "../../src/dashboard/snapshot.mjs";
import { createSharedSnapshotPollHub } from "../../src/dashboard/server.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const FIXTURES = `${process.cwd()}/tests/fixtures/batch-state`;

function writeSpineBatchState(projectRoot, fixture) {
	fs.mkdirSync(`${projectRoot}/.spine`, { recursive: true });
	fs.writeFileSync(
		`${projectRoot}/.spine/batch-state.json`,
		JSON.stringify(fixture, null, 2),
		"utf-8",
	);
}

test("bumpDashboardInvalidateSignal writes signal file", async () => {
	const projectRoot = await initGitRepo("spine-dash-invalidate-bump-");
	try {
		resetDashboardInvalidateConsumeCursor();
		const signalPath = bumpDashboardInvalidateSignal(projectRoot, "batch_dismiss", "20260707T000000");
		assert.equal(signalPath, dashboardInvalidateSignalPath(projectRoot));
		assert.ok(fs.existsSync(signalPath));
		const payload = JSON.parse(fs.readFileSync(signalPath, "utf-8"));
		assert.equal(payload.reason, "batch_dismiss");
		assert.equal(payload.batchId, "20260707T000000");
		assert.equal(payload.seq, 1);
		assert.ok(Number(payload.at) > 0);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("consumeDashboardInvalidateSignal clears caches once per bump", async () => {
	const projectRoot = await initGitRepo("spine-dash-invalidate-consume-");
	try {
		resetDashboardInvalidateConsumeCursor();
		assert.equal(consumeDashboardInvalidateSignal(projectRoot), false);
		bumpDashboardInvalidateSignal(projectRoot, "batch_dismiss", "20260707T000001");
		assert.equal(consumeDashboardInvalidateSignal(projectRoot), true);
		assert.equal(consumeDashboardInvalidateSignal(projectRoot), false);
		bumpDashboardInvalidateSignal(projectRoot, "batch_dismiss", "20260707T000002");
		assert.equal(consumeDashboardInvalidateSignal(projectRoot), true);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("dismissBatch bumps dashboard invalidate signal", async () => {
	const projectRoot = await initGitRepo("spine-dash-invalidate-dismiss-");
	try {
		resetDashboardInvalidateConsumeCursor();
		const fixture = JSON.parse(
			fs.readFileSync(`${FIXTURES}/limbo-stale-20260531T165700.json`, "utf-8"),
		);
		writeSpineBatchState(projectRoot, fixture);

		const result = dismissBatch({ projectRoot, reason: "test" });
		assert.equal(result.ok, true);

		const signalPath = dashboardInvalidateSignalPath(projectRoot);
		assert.ok(fs.existsSync(signalPath));
		const payload = JSON.parse(fs.readFileSync(signalPath, "utf-8"));
		assert.equal(payload.reason, "batch_dismiss");
		assert.equal(payload.batchId, fixture.batchId);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("buildDashboardSnapshot consumes invalidate signal and returns idle after dismiss", async () => {
	const projectRoot = await initGitRepo("spine-dash-invalidate-snapshot-");
	try {
		resetDashboardInvalidateConsumeCursor();
		const fixture = JSON.parse(
			fs.readFileSync(`${FIXTURES}/limbo-stale-20260531T165700.json`, "utf-8"),
		);
		writeSpineBatchState(projectRoot, fixture);

		const before = buildDashboardSnapshot(projectRoot);
		assert.ok(before.batchId);

		dismissBatch({ projectRoot, reason: "test" });

		const after = buildDashboardSnapshot(projectRoot);
		assert.equal(after.batchId, null);
		assert.equal(after.macroPhase, "idle");
		assert.equal(after.diagnosis, null);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("shared snapshot poll hub fans out after dashboard invalidate signal", async () => {
	const projectRoot = await initGitRepo("spine-dash-invalidate-sse-");
	try {
		resetDashboardInvalidateConsumeCursor();
		let buildCalls = 0;
		const buildSnapshot = () => {
			buildCalls += 1;
			return {
				diagnosis: buildCalls === 1 ? "needs_retry" : null,
				macroPhase: buildCalls === 1 ? "failed" : "idle",
				generatedAt: `tick-${buildCalls}`,
			};
		};

		const hub = createSharedSnapshotPollHub({
			projectRoot,
			buildSnapshot,
			pollIntervalMs: 50,
		});

		const frames = [];
		const res = {
			writableEnded: false,
			write(chunk) {
				const text = String(chunk);
				const match = text.match(/^data: (.+)$/m);
				if (match) {
					frames.push(JSON.parse(match[1]));
				}
			},
		};

		const client = hub.attachSseClient(res);
		assert.equal(frames.length, 1);
		assert.equal(frames[0].macroPhase, "failed");

		bumpDashboardInvalidateSignal(projectRoot, "batch_dismiss", "20260707T195223");
		hub.refreshSharedSnapshot();

		assert.equal(frames.length, 2);
		assert.equal(frames[1].macroPhase, "idle");
		hub.detachSseClient(client);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
