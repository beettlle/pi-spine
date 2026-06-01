import fs from "node:fs";
import {
	loadSpineBatchState,
	resolveBatchStateFileForValidation,
	validateBatchState,
} from "../src/batch/state.mjs";

/**
 * @param {object} options
 * @param {string} options.projectRoot
 * @param {string[]} options.args
 */
export function runSpineState(options) {
	const { projectRoot, args } = options;
	const subcommand = args[0];

	if (subcommand !== "validate") {
		return {
			exitCode: 1,
			output: "Usage: spine state validate [--batch ID] [--json] [--diagnose]\n",
		};
	}

	const batchIdx = args.indexOf("--batch");
	const batchId = batchIdx >= 0 ? args[batchIdx + 1] : null;
	const json = args.includes("--json");
	const diagnose = args.includes("--diagnose");

	const resolved = resolveBatchStateFileForValidation(projectRoot, batchId);
	if (!resolved.path) {
		const message = resolved.error ?? "No batch-state file found";
		if (json) {
			return {
				exitCode: 1,
				output: `${JSON.stringify({ ok: false, error: message }, null, 2)}\n`,
			};
		}
		return {
			exitCode: 1,
			output: `❌ ${message}\n  → spine status --diagnose\n`,
		};
	}

	let raw;
	try {
		raw = JSON.parse(fs.readFileSync(resolved.path, "utf-8"));
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		if (json) {
			return {
				exitCode: 1,
				output: `${JSON.stringify({ ok: false, path: resolved.path, parseError: message }, null, 2)}\n`,
			};
		}
		return {
			exitCode: 1,
			output: `❌ Cannot parse batch state at ${resolved.path}: ${message}\n  → spine state validate --diagnose\n`,
		};
	}

	const result = validateBatchState(raw);
	const payload = {
		ok: result.ok,
		path: resolved.path,
		source: resolved.source,
		batchId: raw.batchId ?? batchId ?? null,
		errors: result.ok ? [] : result.errors,
		suggestedCommand: result.ok ? null : result.suggestedCommand,
	};

	if (json) {
		return {
			exitCode: result.ok ? 0 : 1,
			output: `${JSON.stringify(payload, null, 2)}\n`,
		};
	}

	if (result.ok) {
		return {
			exitCode: 0,
			output: `✅ Batch state valid (${resolved.source}: ${resolved.path})\n`,
		};
	}

	const lines = [
		`❌ Batch state validation failed (${resolved.path})`,
		"",
		...result.errors.map((error) => `  • ${error}`),
		"",
		`  → ${result.suggestedCommand}`,
	];

	if (diagnose) {
		const active = loadSpineBatchState(projectRoot);
		lines.push("", "  Active state snapshot:");
		lines.push(`    phase: ${String(raw.phase ?? "unknown")}`);
		lines.push(`    batchId: ${String(raw.batchId ?? "unknown")}`);
		lines.push(`    tasks: ${Array.isArray(raw.tasks) ? raw.tasks.length : 0}`);
		lines.push(`    lanes: ${Array.isArray(raw.lanes) ? raw.lanes.length : 0}`);
		if (active.parseError) {
			lines.push(`    active parse error: ${active.parseError}`);
		}
	}

	lines.push("");
	return {
		exitCode: 1,
		output: lines.join("\n"),
	};
}
