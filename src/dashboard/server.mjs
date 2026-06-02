/**
 * Loopback-only dashboard HTTP server (PRD §16, SEC-04).
 */

import http from "node:http";
import { buildDashboardSnapshot } from "./snapshot.mjs";
import { formatSseDataFrame, writeSseHeaders } from "./sse.mjs";

export const DEFAULT_DASHBOARD_HOST = "127.0.0.1";
export const DEFAULT_DASHBOARD_PORT = 8109;
export const DEFAULT_DASHBOARD_POLL_MS = 2000;

const PLACEHOLDER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>pi-spine dashboard</title>
</head>
<body>
  <h1>pi-spine dashboard</h1>
  <p>API: <a href="/api/snapshot">/api/snapshot</a> · SSE: <code>/api/events</code></p>
</body>
</html>`;

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
 * @param {object} options
 * @param {string} options.projectRoot
 * @param {string} [options.host]
 * @param {number} [options.port]
 * @param {number} [options.pollIntervalMs]
 */
export function createDashboardServer({
	projectRoot,
	host = DEFAULT_DASHBOARD_HOST,
	port = DEFAULT_DASHBOARD_PORT,
	pollIntervalMs = DEFAULT_DASHBOARD_POLL_MS,
}) {
	assertLoopbackHost(host);

	/** @type {import("node:http").Server} */
	const server = http.createServer((req, res) => {
		const url = new URL(req.url ?? "/", `http://${host}:${port}`);

		if (req.method === "GET" && url.pathname === "/") {
			res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
			res.end(PLACEHOLDER_HTML);
			return;
		}

		if (req.method === "GET" && url.pathname === "/api/snapshot") {
			const snapshot = buildDashboardSnapshot(projectRoot);
			res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
			res.end(JSON.stringify(snapshot));
			return;
		}

		if (req.method === "GET" && url.pathname === "/api/events") {
			writeSseHeaders(res);
			let lastSerialized = "";

			const pushSnapshot = () => {
				if (res.writableEnded) return;
				const snapshot = buildDashboardSnapshot(projectRoot);
				const serialized = JSON.stringify(snapshot);
				if (serialized !== lastSerialized) {
					lastSerialized = serialized;
					res.write(formatSseDataFrame(snapshot));
				}
			};

			pushSnapshot();
			const timer = setInterval(pushSnapshot, pollIntervalMs);
			req.on("close", () => {
				clearInterval(timer);
				if (!res.writableEnded) res.end();
			});
			return;
		}

		res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
		res.end("Not found\n");
	});

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
