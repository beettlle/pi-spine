import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { formatSseDataFrame } from "../../src/dashboard/sse.mjs";
import {
	MAX_DASHBOARD_SSE_CLIENTS,
	assertLoopbackHost,
	createDashboardServer,
	createSharedSnapshotPollHub,
	isAllowedRequestHost,
	listenDashboardServer,
} from "../../src/dashboard/server.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

test("assertLoopbackHost throws for 0.0.0.0", () => {
	assert.throws(() => assertLoopbackHost("0.0.0.0"), /loopback only/i);
});

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * HTTP GET with an explicit Host header (SP-870 allowlist tests).
 *
 * @param {string} host
 * @param {number} port
 * @param {string} routePath
 * @param {string} hostHeader
 * @returns {Promise<{ status: number | undefined, body: string }>}
 */
function requestWithHost(host, port, routePath, hostHeader) {
	return new Promise((resolve, reject) => {
		http
			.get(
				{ host, port, path: routePath, headers: { Host: hostHeader } },
				(res) => {
					let body = "";
					res.on("data", (chunk) => {
						body += chunk;
					});
					res.on("end", () => resolve({ status: res.statusCode, body }));
				},
			)
			.on("error", reject);
	});
}

/**
 * Open an SSE connection and resolve once the first frame arrived.
 *
 * @param {string} host
 * @param {number} port
 * @returns {Promise<{ destroy: () => void }>}
 */
function connectSseFirstFrame(host, port) {
	return new Promise((resolve, reject) => {
		const req = http.get(`http://${host}:${port}/api/events`, (res) => {
			let buffer = "";
			res.on("data", (chunk) => {
				buffer += chunk;
				if (buffer.includes("\n\n")) {
					resolve({
						destroy: () => {
							res.destroy();
							req.destroy();
						},
					});
				}
			});
			res.on("error", () => {});
		});
		req.on("error", reject);
	});
}

test("isAllowedRequestHost allows loopback hosts with matching or absent port", () => {
	assert.equal(isAllowedRequestHost("127.0.0.1", 8109), true);
	assert.equal(isAllowedRequestHost("localhost", 8109), true);
	assert.equal(isAllowedRequestHost("127.0.0.1:8109", 8109), true);
	assert.equal(isAllowedRequestHost("localhost:8109", 8109), true);
	assert.equal(isAllowedRequestHost("LOCALHOST:8109", 8109), true);
	assert.equal(isAllowedRequestHost("127.0.0.1", 0), true);
});

test("isAllowedRequestHost rejects rebinding and malformed Host headers", () => {
	assert.equal(isAllowedRequestHost("evil.example.com", 8109), false);
	assert.equal(isAllowedRequestHost("evil.example.com:8109", 8109), false);
	assert.equal(isAllowedRequestHost("localhost.evil.com", 8109), false);
	assert.equal(isAllowedRequestHost("127.0.0.1:9999", 8109), false);
	assert.equal(isAllowedRequestHost("[::1]:8109", 8109), false);
	assert.equal(isAllowedRequestHost("", 8109), false);
	assert.equal(isAllowedRequestHost(undefined, 8109), false);
});

test("dashboard server rejects non-allowlisted Host headers with 400", async () => {
	const projectRoot = await initGitRepo("spine-dash-host-allowlist-");
	const server = createDashboardServer({ projectRoot, pollIntervalMs: 50_000 });

	try {
		const { host, port } = await listenDashboardServer({ server, port: 0 });

		for (const routePath of ["/api/snapshot", "/api/events", "/dashboard.css"]) {
			const evil = await requestWithHost(host, port, routePath, "evil.example.com");
			assert.equal(evil.status, 400, routePath);
			assert.match(evil.body, /invalid host/i, routePath);
		}

		const wrongPort = await requestWithHost(
			host,
			port,
			"/api/snapshot",
			`127.0.0.1:${port + 1}`,
		);
		assert.equal(wrongPort.status, 400);

		const matchingIp = await requestWithHost(
			host,
			port,
			"/api/snapshot",
			`127.0.0.1:${port}`,
		);
		assert.equal(matchingIp.status, 200);

		const matchingName = await requestWithHost(
			host,
			port,
			"/api/snapshot",
			`localhost:${port}`,
		);
		assert.equal(matchingName.status, 200);

		const bareName = await requestWithHost(host, port, "/api/snapshot", "localhost");
		assert.equal(bareName.status, 200);
	} finally {
		await new Promise((resolve) => server.close(resolve));
		await destroyGitRepo(projectRoot);
	}
});

test("dashboard server /api/snapshot uses the injected buildSnapshot", async () => {
	const projectRoot = await initGitRepo("spine-dash-injected-builder-");
	let buildCalls = 0;
	const server = createDashboardServer({
		projectRoot,
		pollIntervalMs: 50_000,
		buildSnapshot: () => {
			buildCalls += 1;
			return { diagnosis: null, generatedAt: `injected-${buildCalls}`, marker: "sp870" };
		},
	});

	try {
		const { host, port } = await listenDashboardServer({ server, port: 0 });
		const snapshot = await requestWithHost(host, port, "/api/snapshot", `127.0.0.1:${port}`);

		assert.equal(snapshot.status, 200);
		const payload = JSON.parse(snapshot.body);
		assert.equal(payload.marker, "sp870");
		assert.equal(payload.generatedAt, "injected-1");
		assert.equal(buildCalls, 1);
	} finally {
		await new Promise((resolve) => server.close(resolve));
		await destroyGitRepo(projectRoot);
	}
});

test("dashboard server returns 500 on throwing buildSnapshot and stays alive", async () => {
	const projectRoot = await initGitRepo("spine-dash-throwing-builder-");
	const server = createDashboardServer({
		projectRoot,
		pollIntervalMs: 50_000,
		buildSnapshot: () => {
			throw new Error("boom");
		},
	});

	try {
		const { host, port } = await listenDashboardServer({ server, port: 0 });
		const hostHeader = `127.0.0.1:${port}`;

		const firstSnapshot = await requestWithHost(host, port, "/api/snapshot", hostHeader);
		assert.equal(firstSnapshot.status, 500);
		const errorPayload = JSON.parse(firstSnapshot.body);
		assert.equal(errorPayload.error, "snapshot_failed");

		const events = await requestWithHost(host, port, "/api/events", hostHeader);
		assert.equal(events.status, 500);
		assert.match(events.body, /snapshot build failed/i);

		const secondSnapshot = await requestWithHost(host, port, "/api/snapshot", hostHeader);
		assert.equal(secondSnapshot.status, 500, "server must still respond after failures");
	} finally {
		await new Promise((resolve) => server.close(resolve));
		await destroyGitRepo(projectRoot);
	}
});

test("dashboard server poll tick survives throwing buildSnapshot", async () => {
	const projectRoot = await initGitRepo("spine-dash-tick-throw-");
	let buildCalls = 0;
	const server = createDashboardServer({
		projectRoot,
		pollIntervalMs: 25,
		buildSnapshot: () => {
			buildCalls += 1;
			if (buildCalls > 1) throw new Error("tick boom");
			return { diagnosis: null, generatedAt: "first-ok" };
		},
	});

	try {
		const { host, port } = await listenDashboardServer({ server, port: 0 });

		const client = await connectSseFirstFrame(host, port);
		assert.equal(buildCalls, 1, "first attach builds the initial snapshot");

		await wait(120); // several poll ticks with a throwing builder

		const after = await requestWithHost(
			host,
			port,
			"/api/snapshot",
			`127.0.0.1:${port}`,
		);
		assert.equal(after.status, 500, "server must stay alive after throwing ticks");
		assert.ok(buildCalls > 1, "at least one throwing tick should have fired");

		client.destroy();
		await wait(50);
	} finally {
		if (typeof server.closeAllConnections === "function") {
			server.closeAllConnections();
		}
		await new Promise((resolve) => server.close(resolve));
		await destroyGitRepo(projectRoot);
	}
});

test("shared snapshot poll hub refuses SSE clients beyond MAX_DASHBOARD_SSE_CLIENTS", () => {
	const hub = createSharedSnapshotPollHub({
		projectRoot: "/tmp/unused",
		buildSnapshot: () => ({ diagnosis: null, generatedAt: "cap-hub" }),
		pollIntervalMs: 50_000,
	});

	/** @type {{ writableEnded: boolean, write: (chunk: string) => void }[]} */
	const fakeClients = [];
	try {
		assert.equal(hub.hasSseCapacity(), true);
		for (let index = 0; index < MAX_DASHBOARD_SSE_CLIENTS; index += 1) {
			const fake = { writableEnded: false, write: () => {} };
			fakeClients.push(fake);
			assert.ok(hub.attachSseClient(fake), `client ${index + 1} should attach`);
		}

		assert.equal(hub.sseClients.size, MAX_DASHBOARD_SSE_CLIENTS);
		assert.equal(hub.hasSseCapacity(), false);
		assert.equal(hub.attachSseClient({ writableEnded: false, write: () => {} }), null);
	} finally {
		for (const client of fakeClients) {
			hub.detachSseClient(client);
		}
		hub.stopPollTimer();
	}
});

test("dashboard server answers 503 when SSE clients exceed the cap", async () => {
	const projectRoot = await initGitRepo("spine-dash-sse-cap-");
	const server = createDashboardServer({ projectRoot, pollIntervalMs: 50_000 });

	/** @type {import("node:http").IncomingMessage[]} */
	const openResponses = [];
	try {
		const { host, port } = await listenDashboardServer({ server, port: 0 });

		const outcomes = await Promise.all(
			Array.from({ length: MAX_DASHBOARD_SSE_CLIENTS + 1 }, () => {
				return new Promise((resolve, reject) => {
					const req = http.get(`http://${host}:${port}/api/events`, (res) => {
						openResponses.push(res);
						res.on("error", () => {});
						let sawFrame = false;
						let settled = false;
						/** @returns {void} */
						const settle = () => {
							if (settled) return;
							settled = true;
							resolve({ status: res.statusCode, sawFrame });
						};
						let buffer = "";
						res.on("data", (chunk) => {
							buffer += chunk;
							if (buffer.includes("data: ")) {
								sawFrame = true;
								settle();
							}
						});
						res.on("end", settle); // 503 path ends without a frame
					});
					req.on("error", reject);
				});
			}),
			);

		const accepted = outcomes.filter((outcome) => outcome.status === 200);
		const refused = outcomes.filter((outcome) => outcome.status === 503);
		assert.equal(accepted.length, MAX_DASHBOARD_SSE_CLIENTS);
		assert.equal(refused.length, 1);
		assert.ok(accepted.every((outcome) => outcome.sawFrame));
	} finally {
		for (const res of openResponses) {
			res.destroy();
		}
		await wait(50);
		if (typeof server.closeAllConnections === "function") {
			server.closeAllConnections();
		}
		await new Promise((resolve) => server.close(resolve));
		await destroyGitRepo(projectRoot);
	}
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
