import { die } from "./shared.mjs";

/**
 * @param {string[]} args
 */
export async function handleWatch(args) {
	const { parseWatchArgs, runSpineWatch } = await import("../../src/cli/watch.mjs");

	let parsed;
	try {
		parsed = parseWatchArgs(args);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		die(`${message}\nRun spine watch [--interval SEC] [--json] [--once] for usage.`);
	}

	const result = await runSpineWatch({
		projectRoot: process.cwd(),
		intervalSec: parsed.intervalSec,
		json: parsed.json,
		once: parsed.once,
	});

	if (result.exitCode !== 0) {
		process.exit(result.exitCode);
	}
}
