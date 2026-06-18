import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC_ROOT = path.join(REPO_ROOT, "src");

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
 * @returns {{ file: string, specifier: string }[]}
 */
export function collectSrcBinImportViolations() {
	/** @type {{ file: string, specifier: string }[]} */
	const violations = [];

	for (const absolutePath of listSrcMjsFiles(SRC_ROOT)) {
		const repoRelative = path.relative(REPO_ROOT, absolutePath).split(path.sep).join("/");
		for (const specifier of findBinImportSpecifiers(absolutePath)) {
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

test("src/** has no bin/ imports", () => {
	const violations = collectSrcBinImportViolations();
	assert.deepEqual(
		violations,
		[],
		violations.map((v) => `${v.file}: ${v.specifier}`).join("\n"),
	);
});
