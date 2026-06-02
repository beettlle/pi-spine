#!/usr/bin/env node
/**
 * pi-spine dashboard CLI (PRD §16).
 * Usage: spine dashboard [--json] [--port N] [--host 127.0.0.1]
 */

import { loadSpineConfig } from "./spine-config.mjs";
import { buildDashboardSnapshot } from "../src/dashboard/snapshot.mjs";
import {
	assertLoopbackHost,
	createDashboardServer,
	DEFAULT_DASHBOARD_HOST,
	DEFAULT_DASHBOARD_PORT,
	listenDashboardServer,
} from "../src/dashboard/server.mjs";

/**
 * @param {string} projectRoot
 * @param {number|undefined} cliPort
 */
export function resolveDashboardPort(projectRoot, cliPort) {
	if (cliPort != null && !Number.isNaN(cliPort)) {
		return cliPort;
	}

	const configResult = loadSpineConfig(projectRoot);
	const fromConfig = configResult.config?.dashboard?.port;
	if (fromConfig != null && !Number.isNaN(Number(fromConfig))) {
		return Number(fromConfig);
	}

	return DEFAULT_DASHBOARD_PORT;
}

/**
 * @param {object} options
 * @param {string} options.projectRoot
 * @param {string[]} [options.args]
 */
export async function runSpineDashboard({ projectRoot, args = [] }) {
	const json = args.includes("--json");
	const hostIdx = args.indexOf("--host");
	const portIdx = args.indexOf("--port");

	const host =
		hostIdx >= 0 && args[hostIdx + 1] ? String(args[hostIdx + 1]) : DEFAULT_DASHBOARD_HOST;
	const cliPort =
		portIdx >= 0 && args[portIdx + 1] ? Number(args[portIdx + 1]) : undefined;
	const port = resolveDashboardPort(projectRoot, cliPort);

	try {
		assertLoopbackHost(host);
	} catch (err) {
		return {
			exitCode: 1,
			output: `${err instanceof Error ? err.message : String(err)}\n`,
		};
	}

	if (json) {
		const snapshot = buildDashboardSnapshot(projectRoot);
		return {
			exitCode: 0,
			output: `${JSON.stringify(snapshot, null, 2)}\n`,
		};
	}

	const server = createDashboardServer({ projectRoot, host, port });
	const { url } = await listenDashboardServer({ server, host, port });

	const lines = [
		"",
		"pi-spine dashboard",
		"",
		`  URL: ${url}`,
		`  Snapshot: ${url}/api/snapshot`,
		`  Events:   ${url}/api/events`,
		"",
		"  Press Ctrl+C to stop.",
		"",
	];

	await new Promise((resolve) => {
		const shutdown = () => {
			server.close(() => resolve());
		};
		process.once("SIGINT", shutdown);
		process.once("SIGTERM", shutdown);
	});

	return { exitCode: 0, output: lines.join("\n") };
}
