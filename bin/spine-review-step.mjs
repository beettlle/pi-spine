#!/usr/bin/env node
/**
 * Spawn reviewer for a task step (FR-REV, spine_review_step).
 * Usage: spine review step --step N [--type plan|code] [--baseline SHA]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSpineConfig } from "./spine-config.mjs";
import { isCliEntrypoint } from "./spine-cli/shared.mjs";
import { resolveBatchJournalContext, runStepReview } from "../src/batch/review.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * @param {string[]} argv
 */
export function parseReviewStepArgs(argv) {
	const args = { step: null, type: "plan", baseline: undefined, stub: false, json: true };
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--step") args.step = Number(argv[++i]);
		else if (arg === "--type") args.type = argv[++i];
		else if (arg === "--baseline") args.baseline = argv[++i];
		else if (arg === "--stub") args.stub = true;
		else if (arg === "--no-json") args.json = false;
	}
	return args;
}

/**
 * @param {object} options
 */
export function runSpineReviewStep(options) {
	const taskFolder = options.taskFolder ?? process.env.SPINE_TASK_FOLDER;
	const worktreePath = options.worktreePath ?? process.env.SPINE_WORKTREE ?? process.cwd();
	if (!taskFolder) {
		return {
			exitCode: 1,
			output: "SPINE_TASK_FOLDER required\n",
			result: null,
		};
	}

	const args = parseReviewStepArgs(options.args ?? process.argv.slice(2));
	if (args.step == null || Number.isNaN(args.step)) {
		return {
			exitCode: 1,
			output: "Usage: spine review step --step N [--type plan|code] [--baseline SHA] [--stub]\n",
			result: null,
		};
	}

	const reviewType = args.type === "code" ? "code" : "plan";
	const projectRoot = options.projectRoot ?? process.env.SPINE_PROJECT_ROOT ?? findProjectRoot(worktreePath);
	let config = options.config ?? {};
	if (projectRoot && !options.config) {
		const loaded = loadSpineConfig(projectRoot);
		if (loaded.config) config = loaded.config;
	}

	const journal = options.journal ?? resolveBatchJournalContext();

	const result = runStepReview({
		taskFolder,
		worktreePath,
		stepNumber: args.step,
		reviewType,
		baseline: args.baseline,
		config,
		journal,
		stub: args.stub,
		projectName: config?.project?.name,
	});

	const payload = {
		verdict: result.verdict,
		feedback: result.feedback,
		artifactPath: result.artifactPath,
		reviewLevel: result.reviewLevel,
		skipped: result.skipped ?? false,
		spawnFailed: result.spawnFailed ?? false,
		error: result.error,
	};

	let output = "";
	if (args.json) {
		output = `${JSON.stringify(payload, null, 2)}\n`;
	} else if (result.spawnFailed) {
		output = `REVIEW FAILED: ${result.error}\n`;
	} else if (result.skipped) {
		output = "SKIPPED (review level does not require this review type)\n";
	} else {
		output = `${result.verdict ?? "UNKNOWN"}: ${result.feedback || ""}\n`;
	}

	return {
		exitCode: result.exitCode ?? (result.ok ? 0 : 1),
		output,
		result,
	};
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

if (isCliEntrypoint(import.meta.url)) {
	const { exitCode, output } = runSpineReviewStep({});
	process.stdout.write(output ?? "");
	process.exit(exitCode);
}
