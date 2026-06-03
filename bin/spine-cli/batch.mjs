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
	const { runSpineNext } = await import("../spine-batch.mjs");
	const result = runSpineNext({ projectRoot: process.cwd(), args });
	writeCommandResult(result);
}
