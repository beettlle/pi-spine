/**
 * Loopback-only dashboard HTTP server (PRD §16, SEC-04).
 */

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSpineConfig } from "../config/spine-config-load.mjs";
import { resolveDashboardPollMs } from "../config/spine-config-schema.mjs";
import { consumeDashboardInvalidateSignal } from "./cache-invalidate.mjs";
import { buildDashboardSnapshot } from "./snapshot.mjs";
import { formatSseDataFrame, writeSseHeaders } from "./sse.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "public");

export const DEFAULT_DASHBOARD_HOST = "127.0.0.1";
export const DEFAULT_DASHBOARD_PORT = 8109;
export const DEFAULT_DASHBOARD_POLL_MS = 2000;

/** Maximum concurrent SSE clients before new connections get 503. */
export const MAX_DASHBOARD_SSE_CLIENTS = 32;

const STATIC_ROUTES = {
	"/": { file: "index.html", contentType: "text/html; charset=utf-8" },
	"/dashboard.css": { file: "dashboard.css", contentType: "text/css; charset=utf-8" },
	"/dashboard.js": { file: "dashboard.js", contentType: "text/javascript; charset=utf-8" },
	"/view.mjs": { file: path.join("..", "view.mjs"), contentType: "text/javascript; charset=utf-8" },
	"/lane-throughput.mjs": {
		file: path.join("..", "lane-throughput.mjs"),
		contentType: "text/javascript; charset=utf-8",
	},
	"/running-tail-state.mjs": {
		file: path.join("..", "running-tail-state.mjs"),
		contentType: "text/javascript; charset=utf-8",
	},
};

/**
 * @param {string} routePath
 */
export function resolveStaticAsset(routePath) {
	const route = STATIC_ROUTES[routePath];
	if (!route) return null;
	const filePath = path.resolve(PUBLIC_DIR, route.file);
	const allowedRoot = path.resolve(__dirname);
	if (filePath !== allowedRoot && !filePath.startsWith(`${allowedRoot}${path.sep}`)) {
		return null;
	}
	return { filePath, contentType: route.contentType };
}

/**
 * @param {import("node:http").ServerResponse} res
 * @param {string} routePath
 * @returns {boolean}
 */
export function serveStaticAsset(res, routePath) {
	const asset = resolveStaticAsset(routePath);
	if (!asset || !fs.existsSync(asset.filePath)) {
		return false;
	}
	const body = fs.readFileSync(asset.filePath);
	res.writeHead(200, { "Content-Type": asset.contentType });
	res.end(body);
	return true;
}

/**
 * @param {string} host
 */
export function assertLoopbackHost(host) {
	const normalized = String(host ?? "")
		.trim()
		.toLowerCase();
	if (normalized !== "127.0.0.1" && normalized !== "localhost") {
		throw new Error(`Dashboard must bind to loopback only (got ${host})`);
	}
}

/**
 * Request-level Host allowlist (DNS-rebinding defense, #316).
 *
 * The bind host is loopback-checked separately via `assertLoopbackHost`; this
 * guards the request `Host` header, which a browser sets from the page origin
 * and cannot be overridden by attacker script. Only `127.0.0.1`, `localhost`,
 * or those hostnames with an explicit port matching the listen port are
 * allowed. Everything else — including IPv6 literals and look-alike domains —
 * is rejected (deny by default).
 *
 * @param {string | undefined} hostHeader Raw `Host` header value.
 * @param {number | undefined} listenPort Actual bound port (e.g. from `req.socket.localPort`).
 * @returns {boolean} True when the Host header is loopback-only and port-consistent.
 */
export function isAllowedRequestHost(hostHeader, listenPort) {
	const raw = String(hostHeader ?? "")
		.trim()
		.toLowerCase();
	if (raw === "") return false;

	let hostname = raw;
	let portSuffix = "";
	const portMatch = raw.match(/^(.+):(\d+)$/);
	if (portMatch) {
		hostname = portMatch[1];
		portSuffix = portMatch[2];
	}

	if (hostname.startsWith("[")) return false; // IPv6 literals are not allowlisted
	if (hostname !== "127.0.0.1" && hostname !== "localhost") return false;
	if (portSuffix === "") return true;
	return Number(portSuffix) === Number(listenPort ?? DEFAULT_DASHBOARD_PORT);
}

/**
 * @typedef {object} DashboardSseClient
 * @property {import("node:http").ServerResponse} res
 * @property {string} lastSerialized
 */

/**
 * @param {object} options
 * @param {string} options.projectRoot
 * @param {(projectRoot: string) => object} options.buildSnapshot
 * @returns {{
 *   sseClients: Set<DashboardSseClient>,
 *   hasSseCapacity: () => boolean,
 *   attachSseClient: (res: import("node:http").ServerResponse) => DashboardSseClient | null,
 *   detachSseClient: (client: DashboardSseClient) => void,
 *   refreshSharedSnapshot: () => { snapshot: object, serialized: string, generation: number },
 *   getSharedSnapshot: () => { snapshot: object | null, serialized: string, generation: number },
 *   ensurePollTimer: () => void,
 *   stopPollTimer: () => void,
 * }}
 */
export function createSharedSnapshotPollHub({
	projectRoot,
	buildSnapshot,
	pollIntervalMs,
}) {
	/** @type {Set<DashboardSseClient>} */
	const sseClients = new Set();
	/** @type {ReturnType<typeof setInterval> | null} */
	let pollTimer = null;
	let snapshotGeneration = 0;
	/** @type {object | null} */
	let lastSharedSnapshot = null;
	let lastSerialized = "";

	const getSharedSnapshot = () => ({
		snapshot: lastSharedSnapshot,
		serialized: lastSerialized,
		generation: snapshotGeneration,
	});

	const fanOutSnapshot = (snapshot, serialized) => {
		for (const client of sseClients) {
			if (client.res.writableEnded) continue;
			if (serialized === client.lastSerialized) continue;
			client.lastSerialized = serialized;
			client.res.write(formatSseDataFrame(snapshot));
		}
	};

	const refreshSharedSnapshot = () => {
		const invalidated = consumeDashboardInvalidateSignal(projectRoot);
		if (invalidated) {
			for (const client of sseClients) {
				client.lastSerialized = "";
			}
		}
		snapshotGeneration += 1;
		const snapshot = {
			...buildSnapshot(projectRoot),
			snapshotGeneration,
		};
		lastSharedSnapshot = snapshot;
		lastSerialized = JSON.stringify(snapshot);
		fanOutSnapshot(snapshot, lastSerialized);
		return { snapshot, serialized: lastSerialized, generation: snapshotGeneration };
	};

	const tick = () => {
		if (sseClients.size === 0) return;
		try {
			refreshSharedSnapshot();
		} catch {
			// Background poll: keep streaming the last good snapshot and retry on
			// the next tick instead of crashing the server (SP-870 / #316).
		}
	};

	const ensurePollTimer = () => {
		if (pollTimer) return;
		pollTimer = setInterval(tick, pollIntervalMs);
	};

	const stopPollTimer = () => {
		if (!pollTimer) return;
		clearInterval(pollTimer);
		pollTimer = null;
	};

	const hasSseCapacity = () => sseClients.size < MAX_DASHBOARD_SSE_CLIENTS;

	const attachSseClient = (res) => {
		if (!hasSseCapacity()) return null;
		const client = { res, lastSerialized: "" };
		sseClients.add(client);
		ensurePollTimer();

		if (lastSharedSnapshot && lastSerialized) {
			client.lastSerialized = lastSerialized;
			res.write(formatSseDataFrame(lastSharedSnapshot));
			return client;
		}

		const built = refreshSharedSnapshot();
		client.lastSerialized = built.serialized;
		return client;
	};

	const detachSseClient = (client) => {
		sseClients.delete(client);
		if (sseClients.size === 0) {
			stopPollTimer();
		}
	};

	return {
		sseClients,
		hasSseCapacity,
		attachSseClient,
		detachSseClient,
		refreshSharedSnapshot,
		getSharedSnapshot,
		ensurePollTimer,
		stopPollTimer,
	};
}

/**
 * @param {object} options
 * @param {string} options.projectRoot
 * @param {string} [options.host]
 * @param {number} [options.port]
 * @param {number} [options.pollIntervalMs]
 * @param {(projectRoot: string) => object} [options.buildSnapshot]
 */
export function createDashboardServer({
	projectRoot,
	host = DEFAULT_DASHBOARD_HOST,
	port = DEFAULT_DASHBOARD_PORT,
	pollIntervalMs,
	buildSnapshot = buildDashboardSnapshot,
}) {
	assertLoopbackHost(host);

	const configResult = loadSpineConfig(projectRoot);
	const resolvedPollIntervalMs =
		pollIntervalMs ??
		resolveDashboardPollMs({ config: configResult.config ?? {} });

	const pollHub = createSharedSnapshotPollHub({
		projectRoot,
		buildSnapshot,
		pollIntervalMs: resolvedPollIntervalMs,
	});

	/** @type {import("node:http").Server} */
	const server = http.createServer((req, res) => {
		if (!isAllowedRequestHost(req.headers.host, req.socket.localPort ?? port)) {
			res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
			res.end("Invalid Host header\n");
			return;
		}

		const url = new URL(req.url ?? "/", `http://${host}:${port}`);

		if (req.method === "GET" && serveStaticAsset(res, url.pathname)) {
			return;
		}

		if (req.method === "GET" && url.pathname === "/api/snapshot") {
			let snapshot;
			try {
				snapshot = buildSnapshot(projectRoot);
			} catch {
				res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
				res.end(
					JSON.stringify({ error: "snapshot_failed", message: "Snapshot build failed" }),
				);
				return;
			}
			res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
			res.end(JSON.stringify(snapshot));
			return;
		}

		if (req.method === "GET" && url.pathname === "/api/events") {
			if (!pollHub.hasSseCapacity()) {
				res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
				res.end("Too many dashboard SSE clients\n");
				return;
			}

			// Build the initial snapshot BEFORE committing SSE headers: once
			// writeHead runs, a 500 is no longer possible (ERR_HTTP_HEADERS_SENT).
			const cached = pollHub.getSharedSnapshot();
			if (!cached.snapshot) {
				try {
					pollHub.refreshSharedSnapshot();
				} catch {
					res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
					res.end("Snapshot build failed\n");
					return;
				}
			}

			try {
				writeSseHeaders(res);
				const client = pollHub.attachSseClient(res);
				if (!client) {
					// Lost a capacity slot between the check and attach; end cleanly.
					if (!res.writableEnded) res.end();
					return;
				}
				req.on("close", () => {
					pollHub.detachSseClient(client);
					if (!res.writableEnded) res.end();
				});
			} catch {
				// Headers are committed here; destroying the connection keeps the
				// server alive without corrupting the response.
				res.destroy();
			}
			return;
		}

		res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
		res.end("Not found\n");
	});

	const originalClose = server.close.bind(server);
	server.close = (...args) => {
		pollHub.stopPollTimer();
		pollHub.sseClients.clear();
		return originalClose(...args);
	};

	return server;
}

/**
 * @param {object} options
 * @param {import("node:http").Server} options.server
 * @param {string} [options.host]
 * @param {number} [options.port]
 * @returns {Promise<{ url: string, host: string, port: number }>}
 */
export function listenDashboardServer({
	server,
	host = DEFAULT_DASHBOARD_HOST,
	port = DEFAULT_DASHBOARD_PORT,
}) {
	assertLoopbackHost(host);

	return new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(port, host, () => {
			const address = server.address();
			const resolvedPort =
				typeof address === "object" && address ? address.port : port;
			resolve({
				host,
				port: resolvedPort,
				url: `http://${host === "localhost" ? "localhost" : host}:${resolvedPort}`,
			});
		});
	});
}
