#!/usr/bin/env node
/**
 * Report worker step progress to the batch journal (FR-WORK-09, PRD §14.5).
 * Usage: spine report progress --step N [--checkboxes-complete N] [--checkboxes-total N]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { reportTaskProgress } from "../src/worker-tools/report-progress.mjs";

const __filename = fileURLToPath(import.meta.url);

/**
 * @param {string[]} argv
 */
export function parseReportProgressArgs(argv) {
	const args = {
		step: null,
		checkboxesComplete: undefined,
		checkboxesTotal: undefined,
		json: true,
	};
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--step") args.step = Number(argv[++i]);
		else if (arg === "--checkboxes-complete") args.checkboxesComplete = Number(argv[++i]);
		else if (arg === "--checkboxes-total") args.checkboxesTotal = Number(argv[++i]);
		else if (arg === "--no-json") args.json = false;
	}
	return args;
}

/**
 * @param {string} startPath
 */
function findProjectRoot(startPath) {
	let current = startPath;
	while (current !== path.dirname(current)) {
		if (fs.existsSync(path.join(current, ".spine", "spine-config.json"))) {
			return current;
		}
		current = path.dirname(current);
	}
	return null;
}

/**
 * @param {number | undefined} value
 */
function parseLaneNumber(value) {
	if (value == null || value === "") return undefined;
	const parsed = Number(value);
	return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * @param {object} [options]
 */
export function runSpineReportProgress(options = {}) {
	const args = parseReportProgressArgs(options.args ?? process.argv.slice(2));
	if (args.step == null || Number.isNaN(args.step)) {
		return {
			exitCode: 1,
			output:
				"Usage: spine report progress --step N [--checkboxes-complete N] [--checkboxes-total N]\n",
			result: null,
		};
	}

	const worktreePath = options.worktreePath ?? process.env.SPINE_WORKTREE ?? process.cwd();
	const projectRoot =
		options.projectRoot ?? process.env.SPINE_PROJECT_ROOT ?? findProjectRoot(worktreePath);
	const batchId = options.batchId ?? process.env.SPINE_BATCH_ID;
	const taskId = options.taskId ?? process.env.SPINE_TASK_ID;
	const laneId = options.laneId ?? process.env.SPINE_LANE_ID;
	const laneNumber =
		options.laneNumber ??
		parseLaneNumber(process.env.SPINE_LANE_NUMBER ?? process.env.SPINE_LANE_ID);
	const correlationId =
		options.correlationId ?? process.env.SPINE_LANE_CORRELATION_ID ?? undefined;

	const result = reportTaskProgress({
		projectRoot: projectRoot ?? "",
		batchId: batchId ?? "",
		taskId: taskId ?? "",
		laneNumber,
		laneId: laneId || undefined,
		step: args.step,
		checkboxesComplete: args.checkboxesComplete,
		checkboxesTotal: args.checkboxesTotal,
		correlationId,
		journal: options.journal,
	});

	const payload = {
		ok: result.ok,
		eventId: result.eventId,
		error: result.error,
	};

	let output = "";
	if (args.json) {
		output = `${JSON.stringify(payload, null, 2)}\n`;
	} else if (!result.ok) {
		output = `ERROR: ${result.error}\n`;
	} else {
		output = `OK eventId=${result.eventId}\n`;
	}

	return {
		exitCode: result.ok ? 0 : 1,
		output,
		result: payload,
	};
}

const isMainModule =
	process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isMainModule) {
	const { exitCode, output } = runSpineReportProgress({});
	process.stdout.write(output ?? "");
	process.exit(exitCode);
}
