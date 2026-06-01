#!/usr/bin/env node
/**
 * Integrate gate inspection and resolution (PRD §12, FR-GATE).
 * Usage: spine gate [approve|reject|status] [--batch ID] [--reason text] [--json]
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadBatchStateFile } from "../src/batch/reconcile.mjs";
import {
	approveIntegrateGate,
	getIntegrateGateStatus,
	rejectIntegrateGate,
} from "../src/batch/gate.mjs";

/**
 * @param {object} result
 * @param {boolean} json
 */
export function formatGateHuman(result, json = false) {
	if (json) return `${JSON.stringify(result, null, 2)}\n`;

	const lines = ["", result.ok ? "Gate" : "Gate action failed", "", `  ${result.headline}`];

	if (result.error) {
		lines.push("", `  Error: ${result.error}`);
	}
	if (result.gate) {
		lines.push(
			"",
			`  Gate ID: ${result.gate.gateId}`,
			`  Status: ${result.gate.status}`,
			`  Kind: ${result.gate.kind}`,
		);
		if (Array.isArray(result.gate.evidenceRefs) && result.gate.evidenceRefs.length > 0) {
			lines.push("", "  Evidence:");
			for (const ref of result.gate.evidenceRefs) {
				lines.push(`    • ${ref}`);
			}
		}
	}

	lines.push("", `  → ${result.suggestedCommand}`);

	if (result.alternatives?.length) {
		lines.push("", "  Alternatives:");
		for (const alt of result.alternatives) {
			lines.push(`    • ${alt}`);
		}
	}

	lines.push("");
	return lines.join("\n");
}

/**
 * @param {string} projectRoot
 * @param {string|null} batchId
 */
function resolveActiveBatchId(projectRoot, batchId) {
	if (batchId) return batchId;
	const loaded = loadBatchStateFile(projectRoot, null);
	if (!loaded.raw) return null;
	return String(loaded.raw.batchId ?? loaded.raw.id ?? "");
}

/**
 * @param {object} options
 * @param {string} options.projectRoot
 * @param {string[]} options.args
 */
export function runSpineGate(options) {
	const { projectRoot, args } = options;
	const flags = new Set(args.filter((a) => a.startsWith("--")));
	const positional = args.filter((a) => !a.startsWith("--"));
	const action = positional[0] ?? "status";

	let batchId = null;
	const batchIdx = args.indexOf("--batch");
	if (batchIdx >= 0 && args[batchIdx + 1]) {
		batchId = args[batchIdx + 1];
	}

	let reason = null;
	const reasonIdx = args.indexOf("--reason");
	if (reasonIdx >= 0 && args[reasonIdx + 1]) {
		reason = args[reasonIdx + 1];
	}

	batchId = resolveActiveBatchId(projectRoot, batchId);
	if (!batchId) {
		const result = {
			ok: false,
			exitCode: 1,
			headline: "No active batch for gate operations",
			suggestedCommand: "spine status --diagnose",
			error: "batchId required (no active batch-state.json)",
		};
		return {
			exitCode: result.exitCode,
			output: formatGateHuman(result, flags.has("--json")),
			result,
		};
	}

	let result;
	switch (action) {
		case "approve":
			result = approveIntegrateGate({ projectRoot, batchId });
			break;
		case "reject":
			result = rejectIntegrateGate({ projectRoot, batchId, reason: reason ?? undefined });
			break;
		case "status":
			result = getIntegrateGateStatus({ projectRoot, batchId });
			break;
		default:
			result = {
				ok: false,
				exitCode: 1,
				headline: `Unknown gate action: ${action}`,
				suggestedCommand: "spine gate status",
				error: "Use approve, reject, or status",
			};
	}

	return {
		exitCode: result.exitCode ?? (result.ok ? 0 : 1),
		output: formatGateHuman(result, flags.has("--json")),
		result,
	};
}

const isMainModule =
	process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMainModule) {
	const { exitCode, output } = runSpineGate({ projectRoot: process.cwd(), args: process.argv.slice(2) });
	process.stdout.write(output);
	process.exit(exitCode);
}
