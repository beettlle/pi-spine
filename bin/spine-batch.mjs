import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { abortBatch } from "../src/batch/abort.mjs";
import {
	resolveDefaultResumeWaitTerminal,
	resumeBatchDetached,
	startBatchDetached,
} from "../src/batch/detached-start.mjs";
import { dismissBatch } from "../src/batch/lifecycle.mjs";
import { runBatchComplete } from "../src/cli/batch-complete.mjs";
import { forceMergeWave, startBatch } from "../src/batch/engine.mjs";
import { parseBatchStartWaveFilter } from "../src/planner/wave-scope.mjs";
import { pauseBatch } from "../src/batch/pause.mjs";
import { resumeBatch } from "../src/batch/resume.mjs";
import { retryTask, skipTask } from "../src/batch/retry.mjs";
import { reconcileBatch } from "../src/batch/reconcile.mjs";
import {
	finishAttachedBatchCli,
	formatAttachedBatchCliResult,
	runAttachedBatchEngine,
} from "../src/batch/attached-runner.mjs";
import { enforceAttachedOrphanRiskGuard } from "../src/doctor/attached-orphan-risk.mjs";
import { formatSalvageIntegrateOutput, formatSalvageListOutput, integrateSalvageableLane, listSalvageableLanes } from "../src/batch/salvage-batch.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BATCH_FLAG_VALUE_TAKERS = new Set([
	"--wave",
	"--through-wave",
	"--batch",
	"--reason",
	"--lane",
]);

/**
 * @returns {string}
 */
export function printBatchHelp() {
	return (
		"Usage: spine batch start <scope>|pause|resume|retry <taskId>|skip <taskId>|force-merge [--wave N]|salvage|abort|dismiss|complete [--batch ID] [--lane N] [--integrate] [--yes] [--reason TEXT] [--hard] [--force] [--force-superseded] [--attached] [--dry-run] [--wave N] [--through-wave N] [--skip-preflight] [--detect-manual-merge] [--json]\n" +
		"  abort --dry-run  Preview abort (reason/archive target); does not archive, journal, or clear live batch\n"
	);
}

/**
 * @param {string[]} args
 */
export function isBatchHelpRequest(args) {
	if (args.includes("--help") || args.includes("-h")) {
		return true;
	}
	if (args.length === 1 && args[0] === "help") {
		return true;
	}
	const subcommand = args.find((token) =>
		[
			"dismiss",
			"complete",
			"abort",
			"start",
			"pause",
			"resume",
			"retry",
			"skip",
			"force-merge",
			"salvage",
		].includes(token),
	);
	if (subcommand && args.includes("help")) {
		const helpIdx = args.indexOf("help");
		const subIdx = args.indexOf(subcommand);
		return helpIdx === subIdx + 1 || (subIdx < 0 && helpIdx === 0);
	}
	return false;
}

/**
 * Remove argv tokens consumed as flag values so they are not parsed as scope.
 *
 * @param {string[]} args
 */
export function stripBatchFlagValueTokens(args) {
	/** @type {Set<number>} */
	const skipIndices = new Set();
	for (let index = 0; index < args.length; index++) {
		const token = args[index];
		if (!BATCH_FLAG_VALUE_TAKERS.has(token)) {
			continue;
		}
		const valueIndex = index + 1;
		if (valueIndex < args.length && !args[valueIndex].startsWith("--")) {
			skipIndices.add(valueIndex);
		}
	}
	return args.filter((_, index) => !skipIndices.has(index));
}

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
	if (result.dryRun) {
		lines.push(`  Dry-run: true (no mutation)`);
	}
	if (result.archivePath) {
		lines.push(result.dryRun ? `  Would archive: ${result.archivePath}` : `  Archive: ${result.archivePath}`);
	}
	if (result.reason) {
		lines.push(`  Reason: ${result.reason}`);
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
export function parseBatchArgs(args) {
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

	let waveIndex = 0;
	const waveIdx = args.indexOf("--wave");
	if (waveIdx >= 0 && args[waveIdx + 1]) {
		waveIndex = Number(args[waveIdx + 1]);
	}

	let laneNumber = null;
	const laneIdx = args.indexOf("--lane");
	if (laneIdx >= 0 && args[laneIdx + 1]) {
		laneNumber = Number(args[laneIdx + 1]);
	}

	const subcommand =
		args.find(
			(t) =>
				t === "dismiss" ||
				t === "complete" ||
				t === "abort" ||
				t === "start" ||
				t === "pause" ||
				t === "resume" ||
				t === "retry" ||
				t === "skip" ||
				t === "force-merge" ||
				t === "salvage",
		) ?? null;

	let waveFilter = null;
	let waveFilterError = null;
	if (subcommand === "start") {
		const parsedWave = parseBatchStartWaveFilter(args);
		if (parsedWave.error) {
			waveFilterError = parsedWave;
		} else {
			waveFilter = parsedWave.waveFilter;
		}
	}

	const positional = stripBatchFlagValueTokens(args).filter(
		(a) => !a.startsWith("--") && a !== subcommand && a !== "help",
	);

	const dryRun = flags.has("--dry-run");
	const skipPreflight = flags.has("--skip-preflight");
	const forceSuperseded = flags.has("--force-superseded");
	const integrate = flags.has("--integrate");
	const yes = flags.has("--yes");

	return {
		json: flags.has("--json"),
		force: flags.has("--force"),
		hard: flags.has("--hard"),
		detectManualMerge: flags.has("--detect-manual-merge"),
		attached: flags.has("--attached"),
		waitTerminal: flags.has("--wait-terminal"),
		noWaitTerminal: flags.has("--no-wait-terminal"),
		dryRun,
		skipPreflight,
		forceSuperseded,
		integrate,
		yes,
		batchId,
		reason,
		waveIndex,
		laneNumber,
		waveFilter,
		waveFilterError,
		subcommand,
		taskId: subcommand === "retry" || subcommand === "skip" ? positional[0] ?? null : null,
		scope: positional.join(" ") || "all",
	};
}

/**
 * @param {object} options
 * @param {string} options.projectRoot
 * @param {string[]} options.args
 * @param {boolean} [options.deferAttachedExit] When true, skip process.exit (unit tests).
 */
export async function runSpineBatch(options) {
	const { projectRoot, args, deferAttachedExit = false } = options;
	if (isBatchHelpRequest(args)) {
		return { exitCode: 0, output: printBatchHelp() };
	}
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

	if (parsed.subcommand === "salvage") {
		if (!parsed.batchId) {
			return {
				exitCode: 1,
				output:
					"Usage: spine batch salvage --batch <batchId> --dry-run [--json]\n" +
					"       spine batch salvage --batch <batchId> --lane <n> --integrate [--yes] [--json]\n",
			};
		}

		if (parsed.integrate) {
			if (!Number.isFinite(parsed.laneNumber) || parsed.laneNumber <= 0) {
				return {
					exitCode: 1,
					output: "Usage: spine batch salvage --batch <batchId> --lane <n> --integrate [--yes] [--json]\n",
				};
			}

			const result = await integrateSalvageableLane(projectRoot, parsed.batchId, parsed.laneNumber, {
				yes: parsed.yes,
				forceIntegrate: parsed.force,
			});
			return {
				exitCode: result.exitCode ?? (result.ok ? 0 : 1),
				output: formatSalvageIntegrateOutput(result, { json: parsed.json }),
				result,
			};
		}

		if (!parsed.dryRun) {
			return {
				exitCode: 1,
				output:
					"Usage: spine batch salvage --batch <batchId> --dry-run [--json]\n" +
					"       spine batch salvage --batch <batchId> --lane <n> --integrate [--yes] [--json]\n",
			};
		}

		const result = listSalvageableLanes(projectRoot, parsed.batchId);
		return {
			exitCode: result.exitCode ?? (result.ok ? 0 : 1),
			output: formatSalvageListOutput(result, { json: parsed.json }),
			result,
		};
	}

	if (parsed.subcommand === "abort") {
		const result = abortBatch({
			projectRoot,
			batchId: parsed.batchId,
			reason: parsed.reason,
			hard: parsed.hard,
			dryRun: parsed.dryRun,
		});
		return {
			exitCode: result.exitCode ?? (result.ok ? 0 : 1),
			output: formatLifecycleHuman(result, parsed.json),
			result,
		};
	}

	if (parsed.subcommand === "complete") {
		const result = runBatchComplete({
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

	if (parsed.subcommand === "pause") {
		const result = await pauseBatch({ projectRoot });
		if (parsed.json) {
			return {
				exitCode: result.exitCode ?? (result.ok ? 0 : 1),
				output: `${JSON.stringify(result, null, 2)}\n`,
				result,
			};
		}
		return {
			exitCode: result.exitCode ?? (result.ok ? 0 : 1),
			output: result.output ?? (result.ok ? "Batch paused.\n" : "Batch pause failed.\n"),
			result,
		};
	}

	if (parsed.subcommand === "retry") {
		if (!parsed.taskId) {
			return {
				exitCode: 1,
				output: "Usage: spine batch retry <taskId> [--json]\n",
			};
		}
		const result = retryTask({ projectRoot, taskId: parsed.taskId });
		if (parsed.json) {
			return {
				exitCode: result.exitCode ?? (result.ok ? 0 : 1),
				output: `${JSON.stringify(result, null, 2)}\n`,
				result,
			};
		}
		const lines = [
			"",
			result.ok ? "Task retry" : "Task retry failed",
			"",
			result.output ?? result.error ?? "",
		];
		if (result.batchId) lines.push("", `  Batch: ${result.batchId}`);
		if (result.taskId) lines.push(`  Task: ${result.taskId}`);
		if (result.pendingSegments != null) lines.push(`  Pending segments: ${result.pendingSegments}`);
		lines.push("");
		return {
			exitCode: result.exitCode ?? (result.ok ? 0 : 1),
			output: lines.join("\n"),
			result,
		};
	}

	if (parsed.subcommand === "skip") {
		if (!parsed.taskId) {
			return {
				exitCode: 1,
				output: "Usage: spine batch skip <taskId> [--json]\n",
			};
		}
		const result = skipTask({ projectRoot, taskId: parsed.taskId });
		if (parsed.json) {
			return {
				exitCode: result.exitCode ?? (result.ok ? 0 : 1),
				output: `${JSON.stringify(result, null, 2)}\n`,
				result,
			};
		}
		const lines = [
			"",
			result.ok ? "Task skipped" : "Task skip failed",
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

	if (parsed.subcommand === "force-merge") {
		const result = forceMergeWave({ projectRoot, waveIndex: parsed.waveIndex });
		if (parsed.json) {
			return {
				exitCode: result.exitCode ?? (result.ok ? 0 : 1),
				output: `${JSON.stringify(result, null, 2)}\n`,
				result,
			};
		}
		const lines = [
			"",
			result.ok ? "Force merge requested" : "Force merge failed",
			"",
			result.output ?? result.error ?? "",
		];
		if (result.batchId) lines.push("", `  Batch: ${result.batchId}`);
		lines.push("");
		return {
			exitCode: result.exitCode ?? (result.ok ? 0 : 1),
			output: lines.join("\n"),
			result,
		};
	}

	if (parsed.subcommand === "resume") {
		if (parsed.attached) {
			const orphanGuard = enforceAttachedOrphanRiskGuard();
			if (!orphanGuard.ok) {
				return {
					exitCode: orphanGuard.exitCode ?? 1,
					output: orphanGuard.output ?? "",
					result: orphanGuard,
				};
			}
		}

		if (!parsed.attached) {
			const waitTerminal = resolveDefaultResumeWaitTerminal(
				projectRoot,
				parsed.waitTerminal,
				parsed.noWaitTerminal,
			);
			const detached = await resumeBatchDetached({
				projectRoot,
				spineBin: path.join(__dirname, "spine.mjs"),
				force: parsed.force,
				waitTerminal,
				json: parsed.json,
			});
			return {
				exitCode: detached.exitCode ?? (detached.ok ? 0 : 1),
				output: detached.output,
				result: detached.result,
			};
		}

		const result = await runAttachedBatchEngine({
			projectRoot,
			runEngine: () => resumeBatch({ projectRoot, force: parsed.force }),
		});
		const cli = formatAttachedBatchCliResult({
			projectRoot,
			operation: "resume",
			result,
			json: parsed.json,
		});
		finishAttachedBatchCli(cli, { deferExit: deferAttachedExit });
		return { ...cli, result };
	}

	if (parsed.subcommand === "start") {
		if (parsed.waveFilterError) {
			return {
				exitCode: 1,
				output: parsed.waveFilterError.output ?? "Invalid --wave flag.\n",
			};
		}

		const useAttached = parsed.attached || parsed.dryRun;
		if (parsed.attached && !parsed.dryRun) {
			const orphanGuard = enforceAttachedOrphanRiskGuard();
			if (!orphanGuard.ok) {
				return {
					exitCode: orphanGuard.exitCode ?? 1,
					output: orphanGuard.output ?? "",
					result: orphanGuard,
				};
			}
		}

		if (!useAttached) {
			const detached = await startBatchDetached({
				projectRoot,
				spineBin: path.join(__dirname, "spine.mjs"),
				scope: parsed.scope,
				skipPreflight: parsed.skipPreflight,
				forceSuperseded: parsed.forceSuperseded,
				waveFilter: parsed.waveFilter,
				waitTerminal: parsed.waitTerminal,
				json: parsed.json,
			});
			return {
				exitCode: detached.exitCode ?? (detached.ok ? 0 : 1),
				output: detached.output,
				result: detached.result,
			};
		}

		if (parsed.dryRun) {
			const result = await startBatch({
				projectRoot,
				scope: parsed.scope,
				dryRun: true,
				skipPreflight: parsed.skipPreflight,
				forceSuperseded: parsed.forceSuperseded,
				waveFilter: parsed.waveFilter,
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

		const result = await runAttachedBatchEngine({
			projectRoot,
			runEngine: () =>
				startBatch({
					projectRoot,
					scope: parsed.scope,
					dryRun: false,
					skipPreflight: parsed.skipPreflight,
					forceSuperseded: parsed.forceSuperseded,
					waveFilter: parsed.waveFilter,
				}),
		});
		const cli = formatAttachedBatchCliResult({
			projectRoot,
			operation: "start",
			result,
			json: parsed.json,
		});
		finishAttachedBatchCli(cli, { deferExit: deferAttachedExit });
		return { ...cli, result };
	}

	return {
		exitCode: 1,
		output: printBatchHelp(),
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
