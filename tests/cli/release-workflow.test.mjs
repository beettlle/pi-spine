import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const SKILL_PATH = path.join(REPO_ROOT, "skills/spine-release-operator/SKILL.md");
const RELEASE_WORKFLOW_PATH = path.join(REPO_ROOT, ".github/workflows/release.yml");
const NPM_PUBLISH_DOC_PATH = path.join(REPO_ROOT, "docs/release/npm-publish.md");

test("release-operator skill documents pre-tag CI gate before tag push", () => {
	const skill = fs.readFileSync(SKILL_PATH, "utf-8");

	assert.match(skill, /Pre-tag CI gate \(HARD STOP — blocking\)/);
	assert.match(skill, /gh run list --workflow ci\.yml --commit "\$COMMIT"/);
	assert.match(skill, /gh run watch --exit-status <run-id>/);
	assert.match(skill, /Fail closed/);
	assert.match(skill, /Release-safe CI profile/);
	assert.match(skill, /#156/);
	assert.match(skill, /Do not `npm version` or `git push --tags`/);
});

test("release.yml ci_gate fails closed on red CI with release-safe profile messaging", () => {
	const workflow = fs.readFileSync(RELEASE_WORKFLOW_PATH, "utf-8");

	assert.match(workflow, /id: ci_gate/);
	assert.match(workflow, /run\.name === "CI"/);
	assert.match(workflow, /conclusion === "failure"/);
	assert.match(workflow, /release-safe profile/);
	assert.match(workflow, /core\.setFailed/);
	assert.match(workflow, /Fix CI on main before publishing this tag/);
});

test("npm-publish pre-publish checklist includes CI gate on release commit", () => {
	const doc = fs.readFileSync(NPM_PUBLISH_DOC_PATH, "utf-8");

	assert.match(doc, /CI workflow green on release commit/);
	assert.match(doc, /gh run list --workflow ci\.yml --commit "\$COMMIT"/);
	assert.match(doc, /Fail closed if no successful CI run/);
	assert.match(doc, /release-safe profile/);
});
