import fs from "node:fs";
import { loadSpineConfigTemplate } from "../config/spine-init-constants.mjs";

export const DEFAULT_TASKPLANE_SOURCE_PATH = ".pi/taskplane-config.json";
export const defaultTaskplaneSourcePath = DEFAULT_TASKPLANE_SOURCE_PATH;

const MAX_PARALLEL_CAP = 8;

/**
 * @param {unknown} value
 * @returns {number}
 */
export function mapMaxParallel(value) {
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed < 1) {
		return 3;
	}
	return Math.min(Math.floor(parsed), MAX_PARALLEL_CAP);
}

/**
 * @param {string} sourcePath
 * @returns {object}
 */
export function loadTaskplaneConfig(sourcePath) {
	if (!sourcePath || typeof sourcePath !== "string") {
		throw new Error("Taskplane config source path is required.");
	}
	if (!fs.existsSync(sourcePath)) {
		throw new Error(`Taskplane config not found: ${sourcePath}`);
	}

	let parsed;
	try {
		parsed = JSON.parse(fs.readFileSync(sourcePath, "utf-8"));
	} catch (err) {
		throw new Error(`Cannot parse Taskplane config: ${err.message}`);
	}

	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		throw new Error("Taskplane config must be a JSON object.");
	}

	return parsed;
}

/**
 * @param {object} commands
 * @returns {{ build: string, test: string, testWithCoverage: string }}
 */
function mapTestingCommands(commands) {
	const unit = typeof commands?.unit === "string" ? commands.unit.trim() : "";
	const build = typeof commands?.build === "string" ? commands.build.trim() : "";
	const test =
		(typeof commands?.test === "string" ? commands.test.trim() : "") ||
		unit ||
		"";
	const testWithCoverage =
		(typeof commands?.testWithCoverage === "string" ? commands.testWithCoverage.trim() : "") ||
		(typeof commands?.coverage === "string" ? commands.coverage.trim() : "") ||
		"";

	return {
		build,
		test,
		testWithCoverage,
	};
}

/**
 * @param {object} taskplaneConfig
 * @param {{ tasksRootOverride?: string }} [options]
 * @returns {object}
 */
export function mapTaskplaneToSpine(taskplaneConfig, { tasksRootOverride } = {}) {
	const template = loadSpineConfigTemplate();
	const config = structuredClone(template);

	const taskRunner = taskplaneConfig.taskRunner ?? {};
	const orchestrator = taskplaneConfig.orchestrator?.orchestrator ?? taskplaneConfig.orchestrator ?? {};

	const tasksRoot =
		(typeof tasksRootOverride === "string" && tasksRootOverride.trim()) ||
		(typeof taskRunner.paths?.tasks === "string" && taskRunner.paths.tasks.trim()) ||
		config.paths.tasksRoot;

	config.paths.tasksRoot = tasksRoot;

	if (typeof taskRunner.project?.name === "string" && taskRunner.project.name.trim()) {
		config.project.name = taskRunner.project.name.trim();
	}
	if (typeof taskRunner.project?.description === "string") {
		config.project.description = taskRunner.project.description;
	}

	const testing = mapTestingCommands(taskRunner.testing?.commands ?? taskRunner.testing ?? {});
	config.testing.build = testing.build;
	config.testing.test = testing.test;
	config.testing.testWithCoverage = testing.testWithCoverage;

	if (orchestrator.maxLanes !== undefined) {
		config.lanes.maxParallel = mapMaxParallel(orchestrator.maxLanes);
	}

	if (Array.isArray(taskRunner.referenceDocs)) {
		config.referenceDocs = taskRunner.referenceDocs;
	}
	if (Array.isArray(taskRunner.standards)) {
		config.standards = taskRunner.standards;
	}
	if (Array.isArray(taskRunner.neverLoad)) {
		config.neverLoad = taskRunner.neverLoad;
	}

	return config;
}
