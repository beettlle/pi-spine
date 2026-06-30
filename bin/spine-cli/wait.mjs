import { die } from "./shared.mjs";

/**
 * @param {string[]} args
 */
export async function handleWait(args) {
	const { parseWaitArgs, runSpineWait } = await import("../../src/cli/wait.mjs");

	let parsed;
	try {
		parsed = parseWaitArgs(args);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		die(
			`${message}\nRun spine wait --until DIAG[,DIAG...] [--timeout DURATION] [--interval SEC] [--json] for usage.`,
		);
	}

	const result = await runSpineWait({
		projectRoot: process.cwd(),
		untilDiagnoses: parsed.until,
		intervalSec: parsed.intervalSec,
		timeoutMs: parsed.timeoutMs,
		json: parsed.json,
	});

	if (result.exitCode !== 0) {
		process.exit(result.exitCode);
	}
}
