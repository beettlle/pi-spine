import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC_ROOT = path.join(REPO_ROOT, "src");

/** Parallel lane SP-270 — remove when batch/dashboard rewires land. */
const PENDING_SP270_PREFIXES = ["src/batch/"];
const PENDING_SP270_FILES = new Set(["src/dashboard/snapshot.mjs"]);

/**
 * Preflight orchestration calls CLI doctor/plan formatters; not config-loader shims.
 * @type {Map<string, Set<string>>}
 */
const ALLOWED_BIN_IMPORTS = new Map([
	[
		"src/config/spine-preflight-lib.mjs",
		new Set(["../../bin/spine.mjs", "../../bin/spine-plan.mjs"]),
	],
]);

const IMPORT_FROM_BIN_PATTERN =
	/(?:import\s+[\s\S]*?\sfrom\s+|export\s+[\s\S]*?\sfrom\s+|import\s*\(\s*)['"]([^'"]*\/bin\/[^'"]+)['"]/g;

/**
 * @param {string} dir
 * @returns {string[]}
 */
function listSrcMjsFiles(dir) {
	/** @type {string[]} */
	const files = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...listSrcMjsFiles(fullPath));
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
 * @returns {string[]}
 */
function findBinImportSpecifiers(filePath) {
	const source = fs.readFileSync(filePath, "utf-8");
	/** @type {string[]} */
	const specifiers = [];
	for (const match of source.matchAll(IMPORT_FROM_BIN_PATTERN)) {
		specifiers.push(match[1]);
	}
	return specifiers;
}

/**
 * @param {string} repoRelativePath
 */
function isPendingSp270(repoRelativePath) {
	if (PENDING_SP270_FILES.has(repoRelativePath)) {
		return true;
	}
	return PENDING_SP270_PREFIXES.some((prefix) => repoRelativePath.startsWith(prefix));
}

/**
 * @returns {{ file: string, specifier: string }[]}
 */
export function collectSrcBinImportViolations() {
	/** @type {{ file: string, specifier: string }[]} */
	const violations = [];

	for (const absolutePath of listSrcMjsFiles(SRC_ROOT)) {
		const repoRelative = path.relative(REPO_ROOT, absolutePath).split(path.sep).join("/");
		if (isPendingSp270(repoRelative)) {
			continue;
		}

		const allowed = ALLOWED_BIN_IMPORTS.get(repoRelative);
		for (const specifier of findBinImportSpecifiers(absolutePath)) {
			if (allowed?.has(specifier)) {
				continue;
			}
			violations.push({ file: repoRelative, specifier });
		}
	}

	return violations;
}

test("src/cli and src/migrate do not import from bin/", () => {
	const violations = collectSrcBinImportViolations().filter(
		({ file }) => file.startsWith("src/cli/") || file.startsWith("src/migrate/"),
	);
	assert.deepEqual(
		violations,
		[],
		violations.map((v) => `${v.file}: ${v.specifier}`).join("\n"),
	);
});

test("src/** has no disallowed bin/ imports (SP-270 batch paths pending)", () => {
	const violations = collectSrcBinImportViolations();
	assert.deepEqual(
		violations,
		[],
		violations.map((v) => `${v.file}: ${v.specifier}`).join("\n"),
	);
});
