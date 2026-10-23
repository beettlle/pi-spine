#!/usr/bin/env node
/**
 * Integrate gate inspection and resolution (PRD §12, FR-GATE).
 * Usage: spine gate [approve|reject|status|reopen] [--batch ID] [--reason text] [--synthesis text] [--json]
 */

import { isCliEntrypoint } from "./spine-cli/shared.mjs";
import { parseStrictArgs, strictArgsError } from "./spine-cli/cli-args.mjs";
import { loadBatchStateFile } from "../src/batch/reconcile.mjs";
import {
	approveIntegrateGate,
	getIntegrateGateStatus,
	rejectIntegrateGate,
	reopenIntegrateGateForCompletedBatch,
} from "../src/batch/gate.mjs";

const GATE_USAGE = `
Usage: spine gate [approve|reject|status|reopen] [options]

  approve   Approve the pending integrate gate
  reject    Reject the pending integrate gate
  status    Show the integrate gate (default)
  reopen    Re-open the gate for a completed batch

Options:
  --batch ID          Target batch (default: active batch)
  --reason TEXT       Rejection reason (reject)
  --synthesis TEXT    Operator readback recorded on the gate
  --json              Machine-readable output
  --help, -h          Show this help without changing state
`;

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
		// SP-747 / #280: show the operator's synthesis readback when one was recorded.
		if (typeof result.gate.synthesis === "string" && result.gate.synthesis.trim() !== "") {
			lines.push(`  Synthesis: ${result.gate.synthesis}`);
		}
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
	const parsed = parseStrictArgs(args, { valued: ["--batch", "--reason", "--synthesis"], boolean: ["--json"] });
	const flags = parsed.flags;
	if (parsed.help) {
		return { exitCode: 0, output: GATE_USAGE, result: { ok: true, help: true } };
	}
	const usageError = strictArgsError(parsed);
	if (usageError) {
		return { exitCode: 2, output: `${usageError}\n${GATE_USAGE}`, result: { ok: false, error: usageError } };
	}
	const action = parsed.positional[0] ?? "status";
	const reason = parsed.values.get("--reason") ?? null;
	const synthesis = parsed.values.get("--synthesis") ?? null;
	const batchId = resolveActiveBatchId(projectRoot, parsed.values.get("--batch") ?? null);
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
			result = approveIntegrateGate({ projectRoot, batchId, synthesis: synthesis ?? undefined });
			break;
		case "reject":
			result = rejectIntegrateGate({
				projectRoot,
				batchId,
				reason: reason ?? undefined,
				synthesis: synthesis ?? undefined,
			});
			break;
		case "status":
			result = getIntegrateGateStatus({ projectRoot, batchId });
			break;
		case "reopen":
			// SP-740 / #275: re-open + re-approve path for completed batches after
			// stale_revision or a removed gate record.
			result = reopenIntegrateGateForCompletedBatch({ projectRoot, batchId });
			break;
		default:
			result = {
				ok: false,
				exitCode: 1,
				headline: `Unknown gate action: ${action}`,
				suggestedCommand: "spine gate status",
				error: "Use approve, reject, status, or reopen",
			};
	}

	return {
		exitCode: result.exitCode ?? (result.ok ? 0 : 1),
		output: formatGateHuman(result, flags.has("--json")),
		result,
	};
}

if (isCliEntrypoint(import.meta.url)) {
	const { exitCode, output } = runSpineGate({ projectRoot: process.cwd(), args: process.argv.slice(2) });
	process.stdout.write(output);
	process.exit(exitCode);
}
