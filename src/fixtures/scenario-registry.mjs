/**
 * Scenario fixture registry — central catalog for incident, stub, adoption, and recipe fixtures.
 */

import fs from "node:fs";
import path from "node:path";

import { resolvePiSpineRoot } from "../config/pi-spine-root.mjs";

export const REGISTRY_SCHEMA_VERSION = 1;

/** @type {readonly string[]} */
export const SCENARIO_KINDS = Object.freeze([
	"incident",
	"stub",
	"adoption",
	"recipe",
]);

const REGISTRY_RELATIVE_PATH = path.join("tests", "fixtures", "scenarios", "registry.json");

/**
 * @param {string} [packageRoot]
 * @returns {string}
 */
export function resolveRegistryPath(packageRoot = resolvePiSpineRoot({}, process.cwd(), import.meta.url)) {
	return path.join(packageRoot, REGISTRY_RELATIVE_PATH);
}

/**
 * @param {{ packageRoot?: string }} [options]
 * @returns {{ schemaVersion: number, scenarios: object[] }}
 */
export function loadRegistry(options = {}) {
	const packageRoot =
		options.packageRoot ?? resolvePiSpineRoot({}, process.cwd(), import.meta.url);
	const registryPath = resolveRegistryPath(packageRoot);
	const raw = fs.readFileSync(registryPath, "utf-8");
	return JSON.parse(raw);
}

/**
 * @param {{ packageRoot?: string }} [options]
 * @returns {object[]}
 */
export function listScenarios(options = {}) {
	const registry = loadRegistry(options);
	return [...registry.scenarios].sort((left, right) =>
		String(left.id).localeCompare(String(right.id)),
	);
}

/**
 * @param {string} id
 * @param {{ packageRoot?: string }} [options]
 * @returns {object | null}
 */
export function getScenario(id, options = {}) {
	const registry = loadRegistry(options);
	return registry.scenarios.find((entry) => entry.id === id) ?? null;
}

/**
 * @param {unknown} value
 * @returns {value is string}
 */
function isNonEmptyString(value) {
	return typeof value === "string" && value.trim().length > 0;
}

/**
 * @param {unknown} value
 * @returns {value is string[]}
 */
function isStringArray(value) {
	return Array.isArray(value) && value.every((entry) => isNonEmptyString(entry));
}

/**
 * @param {object} scenario
 * @param {Set<string>} seenIds
 * @param {{ packageRoot: string, checkFixturePaths: boolean }} context
 * @returns {string[]}
 */
function validateScenarioEntry(scenario, seenIds, context) {
	/** @type {string[]} */
	const errors = [];

	if (!scenario || typeof scenario !== "object" || Array.isArray(scenario)) {
		return ["scenario entry must be an object"];
	}

	if (!isNonEmptyString(scenario.id)) {
		errors.push("scenario.id must be a non-empty string");
	} else if (seenIds.has(scenario.id)) {
		errors.push(`duplicate scenario id: ${scenario.id}`);
	} else {
		seenIds.add(scenario.id);
	}

	if (!isNonEmptyString(scenario.kind)) {
		errors.push("scenario.kind must be a non-empty string");
	} else if (!SCENARIO_KINDS.includes(scenario.kind)) {
		errors.push(`scenario.kind must be one of: ${SCENARIO_KINDS.join(", ")}`);
	}

	if (!isNonEmptyString(scenario.title)) {
		errors.push("scenario.title must be a non-empty string");
	}

	if (scenario.description != null && typeof scenario.description !== "string") {
		errors.push("scenario.description must be a string when set");
	}

	const requiresFixturePath = scenario.kind === "incident" || scenario.kind === "stub" || scenario.kind === "adoption";
	if (requiresFixturePath && !isNonEmptyString(scenario.fixturePath)) {
		errors.push(`scenario.fixturePath is required for kind ${scenario.kind ?? "(missing)"}`);
	}

	if (scenario.fixturePath != null && !isNonEmptyString(scenario.fixturePath)) {
		errors.push("scenario.fixturePath must be a non-empty string when set");
	}

	if (scenario.batchId != null && !isNonEmptyString(scenario.batchId)) {
		errors.push("scenario.batchId must be a non-empty string when set");
	}

	for (const field of ["tests", "docs", "relatedTasks", "tags"]) {
		if (scenario[field] != null && !isStringArray(scenario[field])) {
			errors.push(`scenario.${field} must be an array of non-empty strings when set`);
		}
	}

	if (
		context.checkFixturePaths &&
		isNonEmptyString(scenario.fixturePath) &&
		isNonEmptyString(scenario.id)
	) {
		const fixturePath = path.join(context.packageRoot, scenario.fixturePath);
		if (!fs.existsSync(fixturePath)) {
			errors.push(`scenario.fixturePath does not exist: ${scenario.fixturePath}`);
		}
	}

	return errors;
}

/**
 * @param {object} registry
 * @param {{ packageRoot?: string, checkFixturePaths?: boolean }} [options]
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateRegistry(registry, options = {}) {
	const packageRoot =
		options.packageRoot ?? resolvePiSpineRoot({}, process.cwd(), import.meta.url);
	const checkFixturePaths = options.checkFixturePaths ?? true;
	/** @type {string[]} */
	const errors = [];

	if (!registry || typeof registry !== "object" || Array.isArray(registry)) {
		return { ok: false, errors: ["registry must be an object"] };
	}

	if (registry.schemaVersion !== REGISTRY_SCHEMA_VERSION) {
		errors.push(`schemaVersion must be ${REGISTRY_SCHEMA_VERSION}`);
	}

	if (!Array.isArray(registry.scenarios)) {
		errors.push("scenarios must be an array");
		return { ok: errors.length === 0, errors };
	}

	const seenIds = new Set();
	for (const scenario of registry.scenarios) {
		const prefix = isNonEmptyString(scenario?.id) ? `scenario ${scenario.id}:` : "scenario:";
		for (const issue of validateScenarioEntry(scenario, seenIds, {
			packageRoot,
			checkFixturePaths,
		})) {
			errors.push(`${prefix} ${issue}`);
		}
	}

	return { ok: errors.length === 0, errors };
}

/**
 * Resolve package root from this module location (for tests and CLI callers).
 *
 * @returns {string}
 */
export function scenarioRegistryPackageRoot() {
	return resolvePiSpineRoot({}, process.cwd(), import.meta.url);
}
