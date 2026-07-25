// @ts-nocheck
/**
 * CLI entrypoint for `spine metrics quota`.
 *
 * Builds the SP-678 quota snapshot and either writes a timestamped JSON report
 * under `.spine/reports/` with a human summary, or emits the snapshot as JSON
 * to stdout when `--json` is requested. Secrets and prompt bodies are never
 * written because the snapshot builder already excludes them.
 *
 * `--open` writes a self-contained HTML report beside the JSON snapshot
 * (SP-680 renderer). Browser launch is left to the operator.
 */

import fs from "node:fs";
import path from "node:path";

import { buildQuotaSnapshot } from "./quota-snapshot.mjs";
import { runQuotaProbes } from "./quota-probes.mjs";
import { renderQuotaHtml, writeHtmlBesideJson } from "./quota-html.mjs";
import { loadSpineConfig } from "../config/spine-config-load.mjs";

const REPORTS_DIR = ".spine/reports";

/**
 * Format an ISO timestamp that is safe for filesystem paths.
 *
 * @param {number | string | Date} now
 * @returns {string}
 */
function formatReportFilename(now) {
	const iso = new Date(now).toISOString().replace(/[:.]/g, "-");
	return `quota-snapshot-${iso}.json`;
}

/**
 * Format a short human-readable summary of the snapshot.
 *
 * @param {import("./quota-snapshot.mjs").QuotaSnapshot} snapshot
 * @param {string | null} reportPath
 * @returns {string}
 */
function formatHumanSummary(snapshot, reportPath) {
	const pools = Object.values(snapshot.pools ?? {});
	const estimatePools = pools.filter((p) => p.source === "estimate").length;
	const absentPools = pools.filter((p) => p.source === "absent").length;
	const totalTasks = pools.reduce((sum, p) => sum + (p.usage?.taskCount ?? 0), 0);

	const lines = [
		`Quota snapshot: ${snapshot.generatedAt}`,
		`  Source: ${snapshot.snapshotSource}`,
		`  Pools: ${pools.length} (${estimatePools} with usage, ${absentPools} absent)`,
		`  Total tasks observed: ${totalTasks}`,
	];

	for (const pool of pools) {
		const usage = pool.usage;
		const parts = [`${pool.poolId}: ${usage.taskCount} tasks`];
		if (usage.durationMs > 0) parts.push(`${usage.durationMs}ms`);
		if (usage.tokensIn) parts.push(`${usage.tokensIn} in-tokens`);
		if (usage.tokensOut) parts.push(`${usage.tokensOut} out-tokens`);
		if (usage.estimatedUsd) parts.push(`$${usage.estimatedUsd.toFixed(4)} est`);
		lines.push(`  ${parts.join(", ")}`);
	}

	if (reportPath) {
		lines.push(`  Report: ${reportPath}`);
	}

	return lines.join("\n") + "\n";
}

/**
 * Run the `spine metrics quota` command.
 *
 * Optional provider probes are run before the snapshot is built so live usage
 * can enrich a pool when credentials and the probe succeed. Probes fail closed
 * to `absent` on missing credentials, network errors, or non-ok responses, so
 * the snapshot degrades to estimate/absent rather than inventing limits or
 * keys. The `authPath`/`fetch` params exist primarily for tests, which point
 * `authPath` at a fixture and inject a mocked `fetch` instead of the network.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {object} [params.config]
 * @param {string[]} [params.args]
 * @param {number | string | Date} [params.now]
 * @param {string} [params.authPath] Forwarded to `runQuotaProbes`.
 * @param {typeof globalThis.fetch} [params.fetch] Forwarded to `runQuotaProbes`.
 * @returns {Promise<{ output: string, exitCode: number, reportPath: string | null }>}
 */
export async function runQuotaReport({ projectRoot, config, args = [], now = Date.now(), metricsLines, authPath, fetch } = {}) {
	const json = args.includes("--json");
	const open = args.includes("--open");

	let resolvedConfig = config;
	if (!resolvedConfig) {
		const configResult = loadSpineConfig(projectRoot);
		if (configResult.error) {
			return {
				output: `Error: ${configResult.error.message}\n`,
				exitCode: 1,
				reportPath: null,
			};
		}
		resolvedConfig = configResult.config;
	}

	// Production path: invoke provider probes so live usage can enrich pools.
	// Adapters fail closed to "absent", so a missing/invalid auth file or network
	// error leaves the snapshot at estimate/absent without inventing limits.
	const probeOptions = {};
	if (authPath !== undefined) probeOptions.authPath = authPath;
	if (fetch !== undefined) probeOptions.fetch = fetch;
	const probeResults = await runQuotaProbes(probeOptions);

	const snapshot = buildQuotaSnapshot({ projectRoot, config: resolvedConfig, metricsLines, probeResults, now });

	if (json) {
		return {
			output: JSON.stringify(snapshot, null, 2) + "\n",
			exitCode: 0,
			reportPath: null,
		};
	}

	const reportsDir = path.join(projectRoot, REPORTS_DIR);
	if (!fs.existsSync(reportsDir)) {
		fs.mkdirSync(reportsDir, { recursive: true });
	}

	const reportPath = path.join(reportsDir, formatReportFilename(now));
	fs.writeFileSync(reportPath, JSON.stringify(snapshot, null, 2) + "\n", "utf-8");

	let summary = formatHumanSummary(snapshot, reportPath);
	if (open) {
		const htmlPath = writeHtmlBesideJson(reportPath, renderQuotaHtml(snapshot));
		summary += `  HTML: ${htmlPath}\n`;
	}

	return { output: summary, exitCode: 0, reportPath };
}
