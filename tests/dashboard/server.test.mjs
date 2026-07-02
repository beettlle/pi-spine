import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { formatSseDataFrame } from "../../src/dashboard/sse.mjs";
import {
	assertLoopbackHost,
	createDashboardServer,
	listenDashboardServer,
} from "../../src/dashboard/server.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

test("assertLoopbackHost throws for 0.0.0.0", () => {
	assert.throws(() => assertLoopbackHost("0.0.0.0"), /loopback only/i);
});

test("formatSseDataFrame valid data: line", () => {
	const frame = formatSseDataFrame({ ok: true });
	assert.match(frame, /^data: /);
	assert.ok(frame.endsWith("\n\n"));
	assert.doesNotThrow(() => JSON.parse(frame.slice(6).trim()));
});

test("dashboard server serves browser view-model dependency graph", async () => {
	const projectRoot = await initGitRepo("spine-dash-browser-deps-");
	const server = createDashboardServer({ projectRoot });

	try {
		const { host, port } = await listenDashboardServer({ server, port: 0 });
		const paths = ["/view.mjs", "/running-tail-state.mjs", "/lane-throughput.mjs"];

		for (const routePath of paths) {
			const status = await new Promise((resolve, reject) => {
				http
					.get(`http://${host}:${port}${routePath}`, (res) => {
						res.resume();
						res.on("end", () => resolve(res.statusCode));
					})
					.on("error", reject);
			});
			assert.equal(status, 200, routePath);
		}
	} finally {
		await new Promise((resolve) => server.close(resolve));
		await destroyGitRepo(projectRoot);
	}
});

test("dashboard server serves snapshot and one SSE frame", async () => {
	const projectRoot = await initGitRepo("spine-dash-server-");
	const server = createDashboardServer({ projectRoot, pollIntervalMs: 50_000 });

	try {
		const { host, port } = await listenDashboardServer({ server, port: 0 });

		const snapshot = await new Promise((resolve, reject) => {
			http
				.get(`http://${host}:${port}/api/snapshot`, (res) => {
					let body = "";
					res.on("data", (chunk) => {
						body += chunk;
					});
					res.on("end", () => {
						try {
							resolve(JSON.parse(body));
						} catch (err) {
							reject(err);
						}
					});
				})
				.on("error", reject);
		});

		assert.equal(snapshot.diagnosis, null);
		assert.ok(snapshot.generatedAt);

		const sseLine = await new Promise((resolve, reject) => {
			http
				.get(`http://${host}:${port}/api/events`, (res) => {
					let buffer = "";
					res.on("data", (chunk) => {
						buffer += chunk;
						const match = buffer.match(/^data: (.+)\n\n/m);
						if (match) {
							res.destroy();
							resolve(match[1]);
						}
					});
					res.on("error", reject);
				})
				.on("error", reject);
		});

		const payload = JSON.parse(sseLine);
		assert.equal(payload.diagnosis, snapshot.diagnosis);
	} finally {
		await new Promise((resolve) => server.close(resolve));
		await destroyGitRepo(projectRoot);
	}
});
