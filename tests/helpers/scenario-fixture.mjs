/**
 * Shared scenario fixture loader and materializer for batch regression tests.
 */

import fs from "node:fs";
import path from "node:path";

import { journalPath } from "../../src/batch/journal.mjs";
import { saveSpineBatchState } from "../../src/batch/state.mjs";
import { getScenario, scenarioRegistryPackageRoot } from "../../src/fixtures/scenario-registry.mjs";

/**
 * @param {string} id
 * @param {{ packageRoot?: string }} [options]
 * @returns {object}
 */
export function loadScenario(id, options = {}) {
	const packageRoot = options.packageRoot ?? scenarioRegistryPackageRoot();
	const scenario = getScenario(id, { packageRoot });
	if (!scenario) {
		throw new Error(`unknown scenario: ${id}`);
	}
	if (typeof scenario.fixturePath !== "string" || scenario.fixturePath.trim().length === 0) {
		throw new Error(`scenario ${id} has no fixturePath`);
	}
	const fixturePath = path.join(packageRoot, scenario.fixturePath);
	return JSON.parse(fs.readFileSync(fixturePath, "utf-8"));
}

/**
 * @param {object} fixture
 * @returns {object[]}
 */
function journalEventsForFixture(fixture) {
	return fixture.journalTail ?? fixture.journalEvents ?? [];
}

/**
 * @param {string} projectRoot
 * @param {string} id
 * @param {{ packageRoot?: string }} [options]
 * @returns {string} batchId
 */
export function materializeScenario(projectRoot, id, options = {}) {
	const fixture = loadScenario(id, options);
	const batchId = fixture.meta?.batchId ?? fixture.batchId ?? fixture.batchState.batchId;
	saveSpineBatchState(projectRoot, fixture.batchState);

	const journalFile = journalPath(projectRoot, batchId);
	fs.mkdirSync(path.dirname(journalFile), { recursive: true });
	for (const event of journalEventsForFixture(fixture)) {
		fs.appendFileSync(journalFile, `${JSON.stringify(event)}\n`, "utf-8");
	}
	return batchId;
}
