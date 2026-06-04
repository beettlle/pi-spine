import { writeCommandResult } from "./shared.mjs";

/**
 * @param {string[]} args
 */
export async function handleIntegrate(args) {
	const { runSpineIntegrate } = await import("../spine-integrate.mjs");
	const result = runSpineIntegrate({ projectRoot: process.cwd(), args });
	writeCommandResult(result);
}
