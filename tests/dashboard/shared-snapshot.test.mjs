import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import test from "node:test";
import {
	clearJournalCache,
} from "../../src/batch/journal.mjs";
import { buildDashboardSnapshot } from "../../src/dashboard/snapshot.mjs";
import {
	createDashboardServer,
	createSharedSnapshotPollHub,
	listenDashboardServer,
} from "../../src/dashboard/server.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const FIXTURES = path.join(process.cwd(), "tests/fixtures/batch-state");

function loadFixture(name) {
	return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), "utf-8"));
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
 * @param {string} host
 * @param {number} port
 * @returns {Promise<{ frames: object[], close: () => void }>}
 */
function connectSseClient(host, port) {
	return new Promise((resolve, reject) => {
		/** @type {object[]} */
		const frames = [];
		let buffer = "";

		const req = http.get(`http://${host}:${port}/api/events`, (res) => {
			res.on("data", (chunk) => {
				buffer += chunk;
				let boundary = buffer.indexOf("\n\n");
				while (boundary >= 0) {
					const block = buffer.slice(0, boundary);
					buffer = buffer.slice(boundary + 2);
					const match = block.match(/^data: (.+)$/m);
					if (match) {
						frames.push(JSON.parse(match[1]));
					}
					boundary = buffer.indexOf("\n\n");
				}
			});
			resolve({
				frames,
				close: () => {
					req.destroy();
					res.destroy();
				},
			});
		});
		req.on("error", reject);
	});
}

function wait(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

test("shared snapshot poll hub fans out one generation to multiple SSE clients", async () => {
	let buildCalls = 0;
	const buildSnapshot = () => {
		buildCalls += 1;
		return {
			diagnosis: null,
			generatedAt: `tick-${buildCalls}`,
		};
	};

	const hub = createSharedSnapshotPollHub({
		projectRoot: "/tmp/unused",
		buildSnapshot,
		pollIntervalMs: 100,
	});

	const framesA = [];
	const framesB = [];
	const resA = {
		writableEnded: false,
		write(chunk) {
			const match = String(chunk).match(/^data: (.+)\n\n$/);
			if (match) framesA.push(JSON.parse(match[1]));
		},
	};
	const resB = {
		writableEnded: false,
		write(chunk) {
			const match = String(chunk).match(/^data: (.+)\n\n$/);
			if (match) framesB.push(JSON.parse(match[1]));
		},
	};

	hub.attachSseClient(resA);
	hub.attachSseClient(resB);

	assert.equal(buildCalls, 1, "second client should reuse cached snapshot");
	assert.equal(framesA[0].snapshotGeneration, 1);
	assert.equal(framesB[0].snapshotGeneration, 1);

	await wait(50);
	assert.equal(buildCalls, 1, "no extra build before first poll tick");

	await wait(110);

	assert.equal(buildCalls, 2, "one shared build per poll tick");
	assert.equal(framesA.at(-1)?.snapshotGeneration, 2);
	assert.equal(framesB.at(-1)?.snapshotGeneration, 2);

	hub.stopPollTimer();
});

test("dashboard server builds snapshot once per poll tick for multiple SSE clients", async () => {
	const projectRoot = await initGitRepo("spine-dash-shared-snapshot-");
	let buildCalls = 0;

	const server = createDashboardServer({
		projectRoot,
		pollIntervalMs: 100,
		buildSnapshot: (root) => {
			buildCalls += 1;
			return {
				diagnosis: null,
				generatedAt: `tick-${buildCalls}`,
				projectRoot: root,
			};
		},
	});

	try {
		const { host, port } = await listenDashboardServer({ server, port: 0 });
		const clientA = await connectSseClient(host, port);
		const clientB = await connectSseClient(host, port);

		await wait(30);

		assert.equal(buildCalls, 1, "cached snapshot should serve second SSE client");
		assert.equal(clientA.frames[0].snapshotGeneration, 1);
		assert.equal(clientB.frames[0].snapshotGeneration, 1);

		await wait(120);

		assert.equal(buildCalls, 2, "one reconcile build per shared poll tick");
		assert.equal(clientA.frames.at(-1)?.snapshotGeneration, 2);
		assert.equal(clientB.frames.at(-1)?.snapshotGeneration, 2);

		clientA.close();
		clientB.close();
		if (typeof server.closeAllConnections === "function") {
			server.closeAllConnections();
		}
	} finally {
		await new Promise((resolve) => server.close(resolve));
		await destroyGitRepo(projectRoot);
	}
});

test("buildDashboardSnapshot uses journal tail from cached journal reads", async () => {
	const projectRoot = await initGitRepo("spine-dash-journal-tail-");

	try {
		const fixture = loadFixture("running-batch.json");
		writeSpineBatchState(projectRoot, fixture);
		clearJournalCache();

		const { appendJournalEvent } = await import("../../src/batch/journal.mjs");
		for (let index = 0; index < 25; index += 1) {
			appendJournalEvent(projectRoot, fixture.batchId, "task.step_completed", {
				taskId: `TP-${String(index).padStart(3, "0")}`,
				step: index,
			});
		}

		const first = buildDashboardSnapshot(projectRoot);
		const second = buildDashboardSnapshot(projectRoot);

		assert.ok(Array.isArray(first.journalTail));
		assert.ok(first.journalTail.length <= 20);
		assert.equal(first.journalTail.length, second.journalTail.length);
		assert.deepEqual(first.journalTail, second.journalTail);
	} finally {
		clearJournalCache();
		await destroyGitRepo(projectRoot);
	}
});
