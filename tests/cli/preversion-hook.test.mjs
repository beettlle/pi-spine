import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PACKAGE_JSON_PATH = path.join(REPO_ROOT, "package.json");
const NPM_PUBLISH_DOC_PATH = path.join(REPO_ROOT, "docs/release/npm-publish.md");

test("package.json preversion runs release:check before npm version", () => {
	const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf8"));
	assert.equal(pkg.scripts.preversion, "npm run release:check");
});

test("npm-publish documents preversion hook and dry-run escape hatch", () => {
	const doc = readFileSync(NPM_PUBLISH_DOC_PATH, "utf8");

	assert.match(doc, /preversion/);
	assert.match(doc, /npm run release:check/);
	assert.match(doc, /npm version --no-git-tag-version/);
	assert.match(
		doc,
		/preversion.*still runs|still runs.*preversion|does not skip.*preversion|preversion.*not skipped/i,
	);
});
