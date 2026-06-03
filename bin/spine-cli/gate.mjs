import { writeCommandResult } from "./shared.mjs";

/**
 * @param {string[]} args
 */
export async function handleGate(args) {
	const { runSpineGate } = await import("../spine-gate.mjs");
	const result = runSpineGate({ projectRoot: process.cwd(), args });
	writeCommandResult(result);
}
