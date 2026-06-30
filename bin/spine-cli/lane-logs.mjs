import { c, die } from "./shared.mjs";

/**
 * @param {string[]} args
 */
export async function handleLaneLogs(args) {
	const { runLaneLogs } = await import("../../src/cli/lane-logs.mjs");
	const result = await runLaneLogs({ projectRoot: process.cwd(), args });
	process.stdout.write(result.output ?? "");
	if (result.exitCode !== 0) process.exit(result.exitCode);
}

/**
 * @param {string[]} args
 */
export async function handleLane(args) {
	const sub = args[0];
	if (sub !== "logs") {
		die(
			`Unknown lane subcommand: ${sub ?? "(none)"}\nRun ${c.cyan}spine lane logs --lane N${c.reset} for usage.`,
		);
	}
	await handleLaneLogs(args.slice(1));
}
