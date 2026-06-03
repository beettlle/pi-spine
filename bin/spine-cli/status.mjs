import { writeCommandResult } from "./shared.mjs";

/**
 * @param {string[]} args
 */
export async function handleStatus(args) {
	const json = args.includes("--json");
	const diagnose = args.includes("--diagnose");
	const verbose = args.includes("--verbose");
	const { runSpineStatus } = await import("../spine-status.mjs");
	const result = runSpineStatus({
		projectRoot: process.cwd(),
		json,
		diagnose,
		verbose,
	});
	writeCommandResult(result);
}
