import fs from "node:fs";
import path from "node:path";
import { loadSpineConfig } from "../spine-config.mjs";
import { HANDOFF_DEFAULTS } from "../../src/config/defaults.mjs";
import { writeCommandResult } from "./shared.mjs";

/**
 * @param {string[]} args
 */
export async function handleBatch(args) {
	const { runSpineBatch } = await import("../spine-batch.mjs");
	const result = await runSpineBatch({ projectRoot: process.cwd(), args });
	writeCommandResult(result);
}

/**
 * @param {string[]} args
 */
export async function handleRun(args) {
	const { runSpineBatch } = await import("../spine-batch.mjs");
	const result = await runSpineBatch({
		projectRoot: process.cwd(),
		args: ["start", ...args],
	});
	writeCommandResult(result);
}

/**
 * @param {string[]} args
 */
export async function handleNext(args) {
	const projectRoot = process.cwd();
	const { runSpineNext } = await import("../spine-batch.mjs");
	const result = runSpineNext({ projectRoot, args });

	const configResult = loadSpineConfig(projectRoot);
	const handoffRel =
		configResult.config?.handoff?.path && typeof configResult.config.handoff.path === "string"
			? configResult.config.handoff.path
			: HANDOFF_DEFAULTS.path;
	const handoffPath = path.join(projectRoot, handoffRel);
	if (fs.existsSync(handoffPath) && !args.includes("--json")) {
		result.output = `${result.output ?? ""}\nHandoff: ${handoffRel}\n`;
	}

	writeCommandResult(result);
}
