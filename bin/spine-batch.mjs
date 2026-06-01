import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { completeBatch, dismissBatch } from "../src/batch/lifecycle.mjs";
import { startBatch } from "../src/batch/engine.mjs";
import { reconcileBatch } from "../src/batch/reconcile.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * @param {object} result
 * @param {boolean} json
 */
export function formatLifecycleHuman(result, json = false) {
	if (json) return `${JSON.stringify(result, null, 2)}\n`;

	const lines = ["", result.ok ? "Batch lifecycle" : "Batch lifecycle failed", "", `  ${result.headline}`];

	if (result.error) {
		lines.push("", `  Error: ${result.error}`);
	}
	if (result.batchId) {
		lines.push("", `  Batch: ${result.batchId}`);
	}
	if (result.diagnosis) {
		lines.push(`  Diagnosis: ${result.diagnosis}`);
	}
	if (result.archivePath) {
		lines.push(`  Archive: ${result.archivePath}`);
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
 * @param {string[]} args
 */
function parseBatchArgs(args) {
	const flags = new Set(args.filter((a) => a.startsWith("--")));

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

	const dryRun = flags.has("--dry-run");
	const skipPreflight = flags.has("--skip-preflight");

	const subcommand =
		args.find((t) => t === "dismiss" || t === "complete" || t === "start") ?? null;

	const positional = args.filter((a) => !a.startsWith("--") && a !== subcommand);

	return {
		json: flags.has("--json"),
		force: flags.has("--force"),
		detectManualMerge: flags.has("--detect-manual-merge"),
		dryRun,
		skipPreflight,
		batchId,
		reason,
		subcommand,
		scope: positional.join(" ") || "all",
	};
}

/**
 * @param {object} options
 * @param {string} options.projectRoot
 * @param {string[]} options.args
 */
export function runSpineBatch(options) {
	const { projectRoot, args } = options;
	const parsed = parseBatchArgs(args);

	if (parsed.subcommand === "dismiss") {
		const result = dismissBatch({
			projectRoot,
			batchId: parsed.batchId,
			reason: parsed.reason,
			force: parsed.force,
		});
		return {
			exitCode: result.exitCode ?? (result.ok ? 0 : 1),
			output: formatLifecycleHuman(result, parsed.json),
			result,
		};
	}

	if (parsed.subcommand === "complete") {
		const result = completeBatch({
			projectRoot,
			batchId: parsed.batchId,
			detectManualMerge: parsed.detectManualMerge,
		});
		return {
			exitCode: result.exitCode ?? (result.ok ? 0 : 1),
			output: formatLifecycleHuman(result, parsed.json),
			result,
		};
	}

	if (parsed.subcommand === "start") {
		const result = startBatch({
			projectRoot,
			scope: parsed.scope,
			dryRun: parsed.dryRun,
			skipPreflight: parsed.skipPreflight,
		});
		if (parsed.json) {
			return {
				exitCode: result.exitCode ?? (result.ok ? 0 : 1),
				output: `${JSON.stringify(result, null, 2)}\n`,
				result,
			};
		}
		const lines = [
			"",
			result.ok ? "Batch started" : "Batch start failed",
			"",
			result.output ?? result.error ?? "",
		];
		if (result.batchId) lines.push("", `  Batch: ${result.batchId}`);
		if (result.taskId) lines.push(`  Task: ${result.taskId}`);
		lines.push("");
		return {
			exitCode: result.exitCode ?? (result.ok ? 0 : 1),
			output: lines.join("\n"),
			result,
		};
	}

	return {
		exitCode: 1,
		output:
			"Usage: spine batch start <scope>|dismiss|complete [--batch ID] [--reason TEXT] [--force] [--dry-run] [--skip-preflight] [--detect-manual-merge] [--json]\n",
	};
}

/**
 * @param {object} options
 * @param {string} options.projectRoot
 * @param {string[]} options.args
 */
export function runSpineNext(options) {
	const { projectRoot, args } = options;
	const execute = args.includes("--execute");
	const json = args.includes("--json");
	const reconciliation = reconcileBatch({ projectRoot });

	if (json) {
		return {
			exitCode: 0,
			output: `${JSON.stringify({ ...reconciliation, execute }, null, 2)}\n`,
		};
	}

	if (!execute) {
		const lines = [
			"",
			"Suggested next action (dry-run)",
			"",
			`  ${reconciliation.headline}`,
			"",
			`  → ${reconciliation.suggestedCommand}`,
			"",
			"  Run with --execute to run this command.",
			"",
		];
		return { exitCode: 0, output: lines.join("\n") };
	}

	const command = reconciliation.suggestedCommand;
	if (!command) {
		return { exitCode: 1, output: "No suggested command available.\n" };
	}

	const tokens = command.split(/\s+/).filter(Boolean);
	if (tokens[0] !== "spine") {
		return {
			exitCode: 1,
			output: `Cannot execute non-spine command automatically: ${command}\nRun it manually in your shell.\n`,
		};
	}

	const spineBin = path.join(__dirname, "spine.mjs");
	const result = spawnSync(process.execPath, [spineBin, ...tokens.slice(1)], {
		cwd: projectRoot,
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "pipe"],
	});

	const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
	return {
		exitCode: result.status ?? 1,
		output: output || `Executed: ${command}\n`,
	};
}
