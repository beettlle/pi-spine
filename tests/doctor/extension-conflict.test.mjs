/**
 * SP-450 — pi-web-access extension conflict doctor (GitHub #104).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
	buildPiExtensionConflictDoctorCheck,
	detectPiWebAccessExtensionConflict,
	isPiExtensionConflictOutput,
	isPiWebAccessPackageSource,
	readPiPackageSources,
	resolvePiPackageSourcePath,
	shouldWorkerUsePiNoExtensions,
} from "../../src/doctor/pi-extension-conflict.mjs";

test("isPiWebAccessPackageSource matches npm and path entries", () => {
	assert.equal(isPiWebAccessPackageSource("npm:pi-web-access"), true);
	assert.equal(isPiWebAccessPackageSource("../../github/pi-web-access"), true);
	assert.equal(isPiWebAccessPackageSource("npm:pi-lmstudio"), false);
});

test("detectPiWebAccessExtensionConflict flags npm plus local checkout", () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "spine-ext-conflict-"));
	const agentDir = path.join(root, "agent");
	const npmPkg = path.join(agentDir, "npm", "node_modules", "pi-web-access");
	const localPkg = path.join(root, "pi-web-access");
	fs.mkdirSync(npmPkg, { recursive: true });
	fs.mkdirSync(localPkg, { recursive: true });
	fs.writeFileSync(path.join(agentDir, "settings.json"), JSON.stringify({
		packages: ["npm:pi-web-access", path.relative(agentDir, localPkg)],
	}), "utf-8");

	const assessment = detectPiWebAccessExtensionConflict({ projectRoot: root, agentDir });
	assert.equal(assessment.conflict, true);
	assert.ok(assessment.sources.length >= 2);
});

test("detectPiWebAccessExtensionConflict ok with single source", () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "spine-ext-single-"));
	const agentDir = path.join(root, "agent");
	fs.mkdirSync(agentDir, { recursive: true });
	fs.writeFileSync(path.join(agentDir, "settings.json"), JSON.stringify({
		packages: ["npm:pi-lmstudio"],
	}), "utf-8");

	const assessment = detectPiWebAccessExtensionConflict({ projectRoot: root, agentDir });
	assert.equal(assessment.conflict, false);
});

test("buildPiExtensionConflictDoctorCheck warns with actionable command", () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "spine-ext-doctor-"));
	const agentDir = path.join(root, "agent");
	const npmPkg = path.join(agentDir, "npm", "node_modules", "pi-web-access");
	const localPkg = path.join(root, "pi-web-access");
	fs.mkdirSync(npmPkg, { recursive: true });
	fs.mkdirSync(localPkg, { recursive: true });
	fs.writeFileSync(path.join(agentDir, "settings.json"), JSON.stringify({
		packages: ["npm:pi-web-access", path.relative(agentDir, localPkg)],
	}), "utf-8");

	const check = buildPiExtensionConflictDoctorCheck({ projectRoot: root, agentDir });
	assert.equal(check.warning, true);
	assert.match(check.detail, /duplicate pi-web-access/i);
	assert.match(check.detail, /pi -ne when this conflict is detected/i);
	assert.ok(check.suggestedCommand?.includes("pi remove"));
});

test("shouldWorkerUsePiNoExtensions mirrors conflict assessment", () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "spine-ext-should-ne-"));
	const agentDir = path.join(root, "agent");
	fs.mkdirSync(agentDir, { recursive: true });
	fs.writeFileSync(path.join(agentDir, "settings.json"), JSON.stringify({
		packages: ["npm:pi-lmstudio"],
	}), "utf-8");
	assert.equal(shouldWorkerUsePiNoExtensions({ projectRoot: root, agentDir }), false);

	const npmPkg = path.join(agentDir, "npm", "node_modules", "pi-web-access");
	const localPkg = path.join(root, "pi-web-access");
	fs.mkdirSync(npmPkg, { recursive: true });
	fs.mkdirSync(localPkg, { recursive: true });
	fs.writeFileSync(path.join(agentDir, "settings.json"), JSON.stringify({
		packages: ["npm:pi-web-access", path.relative(agentDir, localPkg)],
	}), "utf-8");
	assert.equal(shouldWorkerUsePiNoExtensions({ projectRoot: root, agentDir }), true);
});

test("isPiExtensionConflictOutput detects worker spawn conflict text", () => {
	const sample =
		'Error: Failed to load extension "...": Tool "web_search" conflicts with /tmp/pi-web-access/index.ts';
	assert.equal(isPiExtensionConflictOutput(sample), true);
	assert.equal(isPiExtensionConflictOutput("pi worker timed out"), false);
});

test("resolvePiPackageSourcePath resolves npm and relative entries", () => {
	const agentDir = "/tmp/agent";
	assert.equal(
		resolvePiPackageSourcePath("npm:pi-web-access", agentDir, agentDir),
		path.join(agentDir, "npm", "node_modules", "pi-web-access"),
	);
	assert.equal(
		resolvePiPackageSourcePath("../pi-web-access", agentDir, agentDir),
		path.resolve(agentDir, "../pi-web-access"),
	);
});

test("readPiPackageSources returns empty for missing settings", () => {
	assert.deepEqual(readPiPackageSources(path.join(os.tmpdir(), "missing-settings.json")), []);
});
