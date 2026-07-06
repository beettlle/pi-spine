/**
 * Static import-cycle guard for reconcile / detached-start / post-merge-limbo cluster (#83).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { findCyclePath } from "../../src/planner/cycles.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const BATCH_ROOT = path.join(REPO_ROOT, "src", "batch");

/**
 * Known post-merge-limbo ↔ reconcile cycles remaining after SP-469 slice C (shrinks in SP-432).
 * Canonical form: rotate to lexicographically smallest start, trailing repeat of first node.
 *
 * @type {ReadonlySet<string>}
 */
const ALLOWED_CLUSTER_CYCLES = new Set([
	"engine-lanes.mjs -> engine-lanes/merge.mjs -> post-merge-limbo.mjs -> resume-multi-validate.mjs -> reconcile.mjs -> resume-multi.mjs -> engine-lanes.mjs",
	"engine-lanes.mjs -> engine-lanes/merge.mjs -> post-merge-limbo.mjs -> resume-multi-validate.mjs -> retry.mjs -> reconcile.mjs -> resume-multi.mjs -> engine-lanes.mjs",
]);

/**
 * @param {string} dir
 * @returns {string[]}
 */
function listBatchMjsFiles(dir) {
	/** @type {string[]} */
	const files = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...listBatchMjsFiles(fullPath));
			continue;
		}
		if (entry.isFile() && entry.name.endsWith(".mjs")) {
			files.push(fullPath);
		}
	}
	return files;
}

/**
 * @param {string} filePath
 * @returns {string}
 */
function moduleKey(filePath) {
	return path.relative(BATCH_ROOT, filePath).split(path.sep).join("/");
}

/**
 * @param {string} filePath
 * @returns {string[]}
 */
function parseBatchRelativeImports(filePath) {
	const source = fs.readFileSync(filePath, "utf-8");
	const pattern =
		/(?:import\s+[\s\S]*?\sfrom\s+|export\s+[\s\S]*?\sfrom\s+|import\s*\(\s*)['"](\.\.?\/[^'"]+)['"]/g;
	/** @type {string[]} */
	const deps = [];
	let match = pattern.exec(source);
	while (match) {
		let specifier = match[1];
		if (!specifier.endsWith(".mjs")) {
			specifier = `${specifier}.mjs`;
		}
		const resolved = path.normalize(path.join(path.dirname(filePath), specifier));
		if (resolved.startsWith(BATCH_ROOT)) {
			deps.push(moduleKey(resolved));
		}
		match = pattern.exec(source);
	}
	return [...new Set(deps)];
}

/**
 * @param {string[]} cycle
 * @returns {string}
 */
function canonicalizeCycle(cycle) {
	const body = cycle.slice(0, -1);
	if (body.length === 0) {
		return cycle.join(" -> ");
	}
	let minIdx = 0;
	for (let i = 1; i < body.length; i++) {
		if (body[i] < body[minIdx]) {
			minIdx = i;
		}
	}
	const rotated = body.slice(minIdx).concat(body.slice(0, minIdx));
	return rotated.concat([rotated[0]]).join(" -> ");
}

/**
 * @param {Record<string, string[]>} depsByTask
 * @returns {string[]}
 */
function findAllBatchCycles(depsByTask) {
	/** @type {Set<string>} */
	const found = new Set();
	const work = structuredClone(depsByTask);
	const nodes = Object.keys(work);

	for (let attempt = 0; attempt < 500; attempt++) {
		const cycle = findCyclePath({ nodes, depsByTask: work });
		if (!cycle) {
			break;
		}
		found.add(canonicalizeCycle(cycle));
		const from = cycle.at(-2);
		const to = cycle.at(-1);
		if (!from || !to) {
			break;
		}
		work[from] = (work[from] ?? []).filter((dep) => dep !== to);
	}

	return [...found];
}

/**
 * Cycles tracked for #83 slice C shrink — post-merge-limbo still coupled to reconcile.
 *
 * @param {string} cycleKey
 * @returns {boolean}
 */
function isTrackedLimboReconcileCycle(cycleKey) {
	const modules = new Set(cycleKey.split(" -> ").slice(0, -1));
	return modules.has("post-merge-limbo.mjs") && modules.has("reconcile.mjs");
}

/** @type {Record<string, string[]>} */
const batchImportGraph = Object.fromEntries(
	listBatchMjsFiles(BATCH_ROOT).map((filePath) => [
		moduleKey(filePath),
		parseBatchRelativeImports(filePath),
	]),
);

test("post-merge-limbo imports detached-spawn leaf, not detached-start", () => {
	const limboImports = batchImportGraph["post-merge-limbo.mjs"] ?? [];
	assert.ok(
		limboImports.includes("detached-spawn.mjs"),
		"post-merge-limbo.mjs must import detached-spawn.mjs",
	);
	assert.equal(
		limboImports.includes("detached-start.mjs"),
		false,
		"post-merge-limbo.mjs must not import detached-start.mjs",
	);
});

test("detached-spawn.mjs is a batch leaf (no relative batch imports)", () => {
	const spawnImports = batchImportGraph["detached-spawn.mjs"] ?? [];
	assert.deepEqual(spawnImports, []);
});

test("no import cycle contains detached-start and post-merge-limbo together", () => {
	const allCycles = findAllBatchCycles(batchImportGraph);
	const forbidden = allCycles.filter((cycleKey) => {
		const modules = new Set(cycleKey.split(" -> ").slice(0, -1));
		return modules.has("detached-start.mjs") && modules.has("post-merge-limbo.mjs");
	});
	assert.deepEqual(
		forbidden,
		[],
		`detached-start ↔ post-merge-limbo cycles must be eliminated (SP-469): ${forbidden.join("; ")}`,
	);
});

test("no import cycle contains reconcile, detached-start, and post-merge-limbo", () => {
	const allCycles = findAllBatchCycles(batchImportGraph);
	const forbidden = allCycles.filter((cycleKey) => {
		const modules = new Set(cycleKey.split(" -> ").slice(0, -1));
		return (
			modules.has("reconcile.mjs") &&
			modules.has("detached-start.mjs") &&
			modules.has("post-merge-limbo.mjs")
		);
	});
	assert.deepEqual(
		forbidden,
		[],
		`three-way reconcile/detached-start/post-merge-limbo cycles must be eliminated: ${forbidden.join("; ")}`,
	);
});

test("post-merge-limbo reconcile cycles match allowlist (shrinks per #83 slice)", () => {
	const allCycles = findAllBatchCycles(batchImportGraph);
	const clusterCycles = allCycles.filter(isTrackedLimboReconcileCycle);
	const unexpected = clusterCycles.filter((cycleKey) => !ALLOWED_CLUSTER_CYCLES.has(cycleKey));
	assert.deepEqual(
		unexpected,
		[],
		`Unexpected cluster cycles (update allowlist only when intentionally breaking a cycle): ${unexpected.join("; ")}`,
	);
});
