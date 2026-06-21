/**
 * Operator scenario fixture CLI — list, show, and materialize registry entries.
 */

import fs from "node:fs";
import path from "node:path";

import { resolveBatchStatePath } from "../../src/batch/batch-state-io.mjs";
import { journalPath } from "../../src/batch/journal.mjs";
import { saveSpineBatchState } from "../../src/batch/state.mjs";
import {
	getScenario,
	listScenarios,
	scenarioRegistryPackageRoot,
} from "../../src/fixtures/scenario-registry.mjs";
import { c, FAIL, OK, writeCommandResult } from "./shared.mjs";

const MATERIALIZE_KINDS = new Set(["incident", "stub", "adoption"]);

/**
 * @param {{ packageRoot?: string }} [options]
 */
function resolvePackageRoot(options = {}) {
	if (options.packageRoot) {
		return options.packageRoot;
	}
	if (process.env.SPINE_SCENARIO_REGISTRY_ROOT) {
		return path.resolve(process.env.SPINE_SCENARIO_REGISTRY_ROOT);
	}
	return scenarioRegistryPackageRoot();
}

/**
 * @param {string} projectRoot
 * @param {boolean} force
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function assertMaterializeAllowed(projectRoot, force) {
	const existingPath = resolveBatchStatePath(projectRoot);
	if (existingPath && !force) {
		return {
			ok: false,
			message:
				`active batch state present at ${path.relative(projectRoot, existingPath)}; ` +
				`re-run with --force to overwrite`,
		};
	}
	return { ok: true };
}

/**
 * @param {object} scenario
 * @param {string} packageRoot
 */
export function loadScenarioFixture(scenario, packageRoot) {
	if (!MATERIALIZE_KINDS.has(scenario.kind)) {
		throw new Error(`scenario kind ${scenario.kind} cannot be materialized`);
	}
	if (!scenario.fixturePath || typeof scenario.fixturePath !== "string") {
		throw new Error(`scenario ${scenario.id} has no fixturePath`);
	}

	const fixturePath = path.join(packageRoot, scenario.fixturePath);
	if (!fs.existsSync(fixturePath)) {
		throw new Error(`fixture file not found: ${scenario.fixturePath}`);
	}

	return JSON.parse(fs.readFileSync(fixturePath, "utf-8"));
}

/**
 * @param {string} projectRoot
 * @param {{ batchState: object, journalTail?: object[], meta?: { batchId?: string } }} fixture
 */
export function materializeFixtureToProject(projectRoot, fixture) {
	const batchId = fixture.meta?.batchId ?? fixture.batchState?.batchId;
	if (!batchId) {
		throw new Error("fixture is missing batchId in meta or batchState");
	}
	if (!fixture.batchState || typeof fixture.batchState !== "object") {
		throw new Error("fixture is missing batchState");
	}

	saveSpineBatchState(projectRoot, fixture.batchState, { bypassWriteGuard: true });

	const journalFile = journalPath(projectRoot, batchId);
	fs.mkdirSync(path.dirname(journalFile), { recursive: true });
	fs.writeFileSync(journalFile, "", "utf-8");
	for (const event of fixture.journalTail ?? []) {
		fs.appendFileSync(journalFile, `${JSON.stringify(event)}\n`, "utf-8");
	}

	return { batchId, batchStatePath: path.join(".spine", "batch-state.json"), journalPath: journalFile };
}

/**
 * @param {object} params
 * @param {string} [params.packageRoot]
 * @param {boolean} [params.json]
 */
export function runScenariosList({ packageRoot: packageRootOption, json = false } = {}) {
	const packageRoot = resolvePackageRoot({ packageRoot: packageRootOption });
	const scenarios = listScenarios({ packageRoot });

	if (json) {
		return {
			exitCode: 0,
			output: `${JSON.stringify({ scenarios }, null, 2)}\n`,
		};
	}

	if (scenarios.length === 0) {
		return {
			exitCode: 0,
			output: `${OK} No scenarios registered\n`,
		};
	}

	const lines = ["", `${c.bold}Scenario registry${c.reset}`, ""];
	lines.push(`  ${"ID".padEnd(28)} ${"KIND".padEnd(10)} TITLE`);
	for (const scenario of scenarios) {
		lines.push(
			`  ${String(scenario.id).padEnd(28)} ${String(scenario.kind).padEnd(10)} ${scenario.title}`,
		);
	}
	lines.push("");
	return { exitCode: 0, output: lines.join("\n") };
}

/**
 * @param {object} params
 * @param {string} params.id
 * @param {string} [params.packageRoot]
 * @param {boolean} [params.json]
 */
export function runScenariosShow({ id, packageRoot: packageRootOption, json = false }) {
	if (!id) {
		return {
			exitCode: 1,
			output: `Usage: spine scenarios show <id> [--json]\n`,
		};
	}

	const packageRoot = resolvePackageRoot({ packageRoot: packageRootOption });
	const scenario = getScenario(id, { packageRoot });
	if (!scenario) {
		return {
			exitCode: 1,
			output: `${FAIL} Unknown scenario: ${id}\n`,
		};
	}

	if (json) {
		return {
			exitCode: 0,
			output: `${JSON.stringify({ scenario }, null, 2)}\n`,
		};
	}

	const lines = [
		"",
		`${c.bold}${scenario.title}${c.reset}`,
		`  ID:          ${scenario.id}`,
		`  Kind:        ${scenario.kind}`,
	];
	if (scenario.description) lines.push(`  Description: ${scenario.description}`);
	if (scenario.fixturePath) lines.push(`  Fixture:     ${scenario.fixturePath}`);
	if (scenario.batchId) lines.push(`  Batch ID:    ${scenario.batchId}`);
	if (Array.isArray(scenario.tags) && scenario.tags.length > 0) {
		lines.push(`  Tags:        ${scenario.tags.join(", ")}`);
	}
	lines.push("");
	return { exitCode: 0, output: lines.join("\n") };
}

/**
 * @param {object} params
 * @param {string} params.id
 * @param {string} params.projectRoot
 * @param {string} [params.packageRoot]
 * @param {boolean} [params.force]
 * @param {boolean} [params.json]
 */
export function runScenariosMaterialize({
	id,
	projectRoot,
	packageRoot: packageRootOption,
	force = false,
	json = false,
}) {
	if (!id) {
		return {
			exitCode: 1,
			output: `Usage: spine scenarios materialize <id> [--target DIR] [--force] [--json]\n`,
		};
	}

	const packageRoot = resolvePackageRoot({ packageRoot: packageRootOption });
	const scenario = getScenario(id, { packageRoot });
	if (!scenario) {
		return {
			exitCode: 1,
			output: `${FAIL} Unknown scenario: ${id}\n`,
		};
	}

	const guard = assertMaterializeAllowed(projectRoot, force);
	if (!guard.ok) {
		return {
			exitCode: 1,
			output: `${FAIL} ${guard.message}\n`,
		};
	}

	try {
		const fixture = loadScenarioFixture(scenario, packageRoot);
		const result = materializeFixtureToProject(projectRoot, fixture);
		const payload = {
			scenarioId: scenario.id,
			batchId: result.batchId,
			batchStatePath: result.batchStatePath,
			journalPath: path.relative(projectRoot, result.journalPath),
		};

		if (json) {
			return {
				exitCode: 0,
				output: `${JSON.stringify(payload, null, 2)}\n`,
			};
		}

		return {
			exitCode: 0,
			output:
				`${OK} Materialized scenario ${scenario.id} (batch ${result.batchId})\n` +
				`  batch-state: ${result.batchStatePath}\n` +
				`  journal:     ${payload.journalPath}\n`,
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return {
			exitCode: 1,
			output: `${FAIL} ${message}\n`,
		};
	}
}

/**
 * @param {string[]} args
 */
export async function handleScenarios(args) {
	const json = args.includes("--json");
	const force = args.includes("--force");
	const flags = new Set(["--json", "--force", "--target"]);
	const positional = args.filter((arg) => !flags.has(arg) && !arg.startsWith("--target="));

	let targetRoot = process.cwd();
	for (let index = 0; index < args.length; index++) {
		if (args[index] === "--target") {
			targetRoot = path.resolve(args[index + 1] ?? "");
		} else if (args[index]?.startsWith("--target=")) {
			targetRoot = path.resolve(args[index].slice("--target=".length));
		}
	}

	const sub = positional[0];
	const id = positional[1];

	/** @type {{ exitCode: number, output: string }} */
	let result;
	switch (sub) {
		case "list":
			result = runScenariosList({ json });
			break;
		case "show":
			result = runScenariosShow({ id, json });
			break;
		case "materialize":
			result = runScenariosMaterialize({
				id,
				projectRoot: targetRoot,
				force,
				json,
			});
			break;
		default:
			result = {
				exitCode: 1,
				output:
					`Usage:\n` +
					`  spine scenarios list [--json]\n` +
					`  spine scenarios show <id> [--json]\n` +
					`  spine scenarios materialize <id> [--target DIR] [--force] [--json]\n`,
			};
	}

	writeCommandResult(result);
}
