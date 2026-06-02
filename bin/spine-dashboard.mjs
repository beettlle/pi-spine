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

export { DEFAULT_DASHBOARD_HOST, DEFAULT_DASHBOARD_PORT };

/**
 * @param {"cli"|"config"|"default"} portSource
 * @returns {string}
 */
function formatPortSourceNote(portSource) {
	if (portSource === "cli") {
		return " (--port)";
	}
	if (portSource === "config") {
		return " (dashboard.port in .spine/spine-config.json)";
	}
	return " (default)";
}

/**
 * @param {string} projectRoot
 * @param {number|undefined} cliPort
 * @returns {{ port: number, portSource: "cli"|"config"|"default" }}
 */
export function resolveDashboardPortWithSource(projectRoot, cliPort) {
	if (cliPort != null && !Number.isNaN(cliPort)) {
		return { port: cliPort, portSource: "cli" };
	}

	const configResult = loadSpineConfig(projectRoot);
	const fromConfig = configResult.config?.dashboard?.port;
	if (fromConfig != null && !Number.isNaN(Number(fromConfig))) {
		return { port: Number(fromConfig), portSource: "config" };
	}

	return { port: DEFAULT_DASHBOARD_PORT, portSource: "default" };
}

/**
 * @param {string} projectRoot
 * @param {number|undefined} cliPort
 */
export function resolveDashboardPort(projectRoot, cliPort) {
	return resolveDashboardPortWithSource(projectRoot, cliPort).port;
}

/**
 * Taskplane-style operator block printed as soon as the dashboard is listening.
 *
 * @param {object} options
 * @param {string} options.url
 * @param {string} options.host
 * @param {number} options.port
 * @param {string} [options.projectRoot]
 * @param {"cli"|"config"|"default"} [options.portSource]
 * @returns {string}
 */
export function formatDashboardStartupMessage({
	url,
	host,
	port,
	portSource = "default",
}) {
	const base = url.endsWith("/") ? url.slice(0, -1) : url;
	const portNote = formatPortSourceNote(portSource);
	const browserUrl = `${base}/`;

	const lines = [
		"",
		"pi-spine dashboard",
		"",
		`  Open in browser: ${browserUrl}`,
		`  Listen:          ${host}:${port}${portNote}`,
		"",
		"  While running:   keep this terminal open; dashboard updates via SSE (~2s)",
		"",
		"  In another terminal:",
		"    spine status",
		"    spine batch start <task-id>",
		"",
		`  → Open ${browserUrl} in your browser`,
		"",
		`  API:  ${base}/api/snapshot`,
		`        ${base}/api/events`,
		"",
		"  Stop: Ctrl+C",
		"",
	];

	return lines.join("\n");
}

/**
 * Pi notify text for /spine-dashboard (background spawn).
 *
 * @param {object} options
 * @param {string} options.host
 * @param {number} options.port
 * @param {"cli"|"config"|"default"} [options.portSource]
 * @returns {string}
 */
export function formatDashboardNotifyMessage({ host, port, portSource = "default" }) {
	const browserUrl = `http://${host}:${port}/`;
	const portHint =
		portSource === "cli"
			? " · this launch used --port"
			: " · configure port in `.spine/spine-config.json` (`dashboard.port`, default 8109)";

	return `pi-spine dashboard starting in the background.

Open in browser: ${browserUrl}

CLI: \`spine dashboard\`${portHint}.`;
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
	const { port, portSource } = resolveDashboardPortWithSource(projectRoot, cliPort);

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

	process.stdout.write(
		`${formatDashboardStartupMessage({ url, host, port, projectRoot, portSource })}\n`,
	);

	await new Promise((resolve) => {
		const shutdown = () => {
			server.close(() => resolve());
		};
		process.once("SIGINT", shutdown);
		process.once("SIGTERM", shutdown);
	});

	return { exitCode: 0, output: "\nDashboard stopped.\n" };
}
