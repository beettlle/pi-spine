import { writeCommandResult } from "./shared.mjs";

/**
 * @param {string[]} args
 */
export async function handlePlan(args) {
	const json = args.includes("--json");
	const scope = args.filter((a) => !a.startsWith("--")).join(" ") || "all";
	const { runSpinePlan } = await import("../spine-plan.mjs");
	const result = await runSpinePlan({ projectRoot: process.cwd(), scope, json });
	writeCommandResult(result);
}
