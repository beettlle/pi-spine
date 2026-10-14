/**
 * SP-822 — context-rewriting pi extension hook doctor check.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
	buildPiContextHookDoctorCheck,
	collectPiContextHookFindings,
	isTrustedReviewerExtensionIsolation,
	MAX_PI_EXTENSION_ENTRIES_PER_PACKAGE,
	MAX_PI_EXTENSION_SOURCE_BYTES,
	PI_CONTEXT_HOOK_NAMES,
	scanPiExtensionSourceForContextHooks,
} from "../../src/doctor/pi-extension-hooks.mjs";
import { runDoctorChecks } from "../../src/doctor/run-doctor-checks.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const HOOK_EXTENSION_SOURCE = `
export function context(messages) { return messages; }
pi.on("before_provider_request", (event) => event);
export function context_with_system(messages) { return messages; }
`;

/**
 * Install a fake pi package whose extension entries declare context hooks.
 *
 * @param {object} options
 * @param {string} options.agentDir Fake PI agent dir (npm packages resolve here).
 * @param {string[]} options.sources Package source strings for settings.json.
 * @param {string[]} options.entrySources Extension entry file contents.
 * @param {string} [options.packageName]
 * @returns {string} package dir
 */
function installFakePackage({ agentDir, sources, entrySources, packageName = "fake-hooks-pkg" }) {
	const packageDir = path.join(agentDir, "npm", "node_modules", packageName);
	fs.mkdirSync(packageDir, { recursive: true });
	fs.writeFileSync(
		path.join(packageDir, "package.json"),
		JSON.stringify({
			name: packageName,
			pi: { extensions: entrySources.map((_, index) => `./ext-${index}.mjs`) },
		}),
		"utf-8",
	);
	entrySources.forEach((source, index) => {
		fs.writeFileSync(path.join(packageDir, `ext-${index}.mjs`), source, "utf-8");
	});
	fs.mkdirSync(agentDir, { recursive: true });
	fs.writeFileSync(
		path.join(agentDir, "settings.json"),
		JSON.stringify({ packages: sources }),
		"utf-8",
	);
	return packageDir;
}

test("scanPiExtensionSourceForContextHooks detects exported context handler", () => {
	assert.deepEqual(
		scanPiExtensionSourceForContextHooks("export function context(messages) {}"),
		["context"],
	);
	assert.deepEqual(
		scanPiExtensionSourceForContextHooks("export async function context (messages) {}"),
		["context"],
	);
	assert.deepEqual(
		scanPiExtensionSourceForContextHooks("export const context = (messages) => messages;"),
		["context"],
	);
});

test("scanPiExtensionSourceForContextHooks ignores non-exported context identifiers", () => {
	assert.deepEqual(
		scanPiExtensionSourceForContextHooks(`
			const context = buildContext();
			function render(context) {}
			pi.on("session", (ctx) => ctx.context);
		`),
		[],
	);
});

test("scanPiExtensionSourceForContextHooks detects hook identifiers", () => {
	assert.deepEqual(
		scanPiExtensionSourceForContextHooks(HOOK_EXTENSION_SOURCE),
		["context", "context_with_system", "before_provider_request"],
	);
	assert.deepEqual(
		scanPiExtensionSourceForContextHooks('pi.on("before_provider_request", handler);'),
		["before_provider_request"],
	);
	assert.deepEqual(
		scanPiExtensionSourceForContextHooks("export const context_with_system = fn;"),
		["context_with_system"],
	);
});

test("scanPiExtensionSourceForContextHooks returns canonical order and empty default", () => {
	const mixed = scanPiExtensionSourceForContextHooks(HOOK_EXTENSION_SOURCE);
	assert.deepEqual(mixed, PI_CONTEXT_HOOK_NAMES);
	assert.deepEqual(scanPiExtensionSourceForContextHooks(""), []);
	assert.deepEqual(scanPiExtensionSourceForContextHooks(undefined), []);
});

test("collectPiContextHookFindings flags npm package extensions with hooks", () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "spine-hooks-npm-"));
	const agentDir = path.join(root, "agent");
	installFakePackage({
		agentDir,
		sources: ["npm:fake-hooks-pkg"],
		entrySources: [HOOK_EXTENSION_SOURCE],
	});

	const { findings, packagesScanned } = collectPiContextHookFindings({
		projectRoot: root,
		agentDir,
	});
	assert.equal(packagesScanned, 1);
	assert.equal(findings.length, 1);
	assert.equal(findings[0].source, "npm:fake-hooks-pkg");
	assert.equal(findings[0].packageName, "fake-hooks-pkg");
	assert.equal(findings[0].extension, "./ext-0.mjs");
	assert.deepEqual(findings[0].hooks, ["context", "context_with_system", "before_provider_request"]);
	fs.rmSync(root, { recursive: true, force: true });
});

test("collectPiContextHookFindings scans project settings and dedupes packages", () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "spine-hooks-proj-"));
	const agentDir = path.join(root, "agent");
	installFakePackage({
		agentDir,
		sources: ["npm:fake-hooks-pkg"],
		entrySources: ["export function context(m) { return m; }"],
	});
	fs.mkdirSync(path.join(root, ".pi"), { recursive: true });
	fs.writeFileSync(
		path.join(root, ".pi", "settings.json"),
		JSON.stringify({ packages: ["npm:fake-hooks-pkg"] }),
		"utf-8",
	);

	const { findings, packagesScanned } = collectPiContextHookFindings({
		projectRoot: root,
		agentDir,
	});
	assert.equal(packagesScanned, 1, "same package listed twice must be scanned once");
	assert.equal(findings.length, 1);
	fs.rmSync(root, { recursive: true, force: true });
});

test("collectPiContextHookFindings skips packages without extension entries", () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "spine-hooks-clean-"));
	const agentDir = path.join(root, "agent");
	const packageDir = path.join(agentDir, "npm", "node_modules", "plain-pkg");
	fs.mkdirSync(packageDir, { recursive: true });
	fs.writeFileSync(
		path.join(packageDir, "package.json"),
		JSON.stringify({ name: "plain-pkg" }),
		"utf-8",
	);
	fs.mkdirSync(agentDir, { recursive: true });
	fs.writeFileSync(
		path.join(agentDir, "settings.json"),
		JSON.stringify({ packages: ["npm:plain-pkg"] }),
		"utf-8",
	);

	const { findings, packagesScanned } = collectPiContextHookFindings({
		projectRoot: root,
		agentDir,
	});
	assert.equal(packagesScanned, 0);
	assert.equal(findings.length, 0);
	fs.rmSync(root, { recursive: true, force: true });
});

test("collectPiContextHookFindings caps extension entries per package", () => {
	assert.equal(MAX_PI_EXTENSION_ENTRIES_PER_PACKAGE, 16);
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "spine-hooks-cap-"));
	const agentDir = path.join(root, "agent");
	const entrySources = Array.from(
		{ length: MAX_PI_EXTENSION_ENTRIES_PER_PACKAGE + 4 },
		(_, index) => (index >= MAX_PI_EXTENSION_ENTRIES_PER_PACKAGE
			? "export function context(m) { return m; }"
			: "export const benign = 1;"),
	);
	installFakePackage({ agentDir, sources: ["npm:fake-hooks-pkg"], entrySources });

	const { findings } = collectPiContextHookFindings({ projectRoot: root, agentDir });
	assert.equal(findings.length, 0, "hook entries beyond the cap must not be scanned");
	fs.rmSync(root, { recursive: true, force: true });
});

test("collectPiContextHookFindings truncates oversized entry files", () => {
	assert.equal(MAX_PI_EXTENSION_SOURCE_BYTES, 512 * 1024);
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "spine-hooks-big-"));
	const agentDir = path.join(root, "agent");
	const filler = "// pad\n".repeat(MAX_PI_EXTENSION_SOURCE_BYTES / 6 + 1);
	const oversized = filler + "export function context(m) { return m; }";
	assert.ok(oversized.length > MAX_PI_EXTENSION_SOURCE_BYTES);
	installFakePackage({
		agentDir,
		sources: ["npm:fake-hooks-pkg"],
		entrySources: [oversized, "export function context(m) { return m; }"],
	});

	const { findings } = collectPiContextHookFindings({ projectRoot: root, agentDir });
	assert.equal(findings.length, 1, "only the within-bounds entry is flagged");
	assert.equal(findings[0].extension, "./ext-1.mjs");
	fs.rmSync(root, { recursive: true, force: true });
});

test("buildPiContextHookDoctorCheck warns with suggestedCommand by default", () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "spine-hooks-warn-"));
	const agentDir = path.join(root, "agent");
	installFakePackage({
		agentDir,
		sources: ["npm:fake-hooks-pkg"],
		entrySources: [HOOK_EXTENSION_SOURCE],
	});

	const check = buildPiContextHookDoctorCheck({ projectRoot: root, agentDir });
	assert.equal(check.ok, true, "advisory check never hard-fails");
	assert.equal(check.warning, true);
	assert.match(check.detail, /fake-hooks-pkg register context-rewriting hook\(s\)/);
	assert.match(check.detail, /before_provider_request/);
	assert.match(check.detail, /reviewers load user extensions by default/);
	assert.equal(
		check.suggestedCommand,
		"spine settings set reviewers.piExtensionIsolation trusted",
	);
	fs.rmSync(root, { recursive: true, force: true });
});

test("buildPiContextHookDoctorCheck stays clean without hook packages", () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "spine-hooks-none-"));
	const agentDir = path.join(root, "agent");
	fs.mkdirSync(agentDir, { recursive: true });
	fs.writeFileSync(
		path.join(agentDir, "settings.json"),
		JSON.stringify({ packages: ["npm:pi-lmstudio"] }),
		"utf-8",
	);

	const check = buildPiContextHookDoctorCheck({ projectRoot: root, agentDir });
	assert.equal(check.ok, true);
	assert.equal(check.warning, undefined);
	assert.match(check.detail, /no context-rewriting hooks found in 0 installed pi package/);
	fs.rmSync(root, { recursive: true, force: true });
});

test("buildPiContextHookDoctorCheck trusted config acknowledges exposure", () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "spine-hooks-trust-"));
	const agentDir = path.join(root, "agent");
	installFakePackage({
		agentDir,
		sources: ["npm:fake-hooks-pkg"],
		entrySources: [HOOK_EXTENSION_SOURCE],
	});

	const check = buildPiContextHookDoctorCheck({
		projectRoot: root,
		agentDir,
		config: { reviewers: { piExtensionIsolation: "trusted" } },
	});
	assert.equal(check.ok, true);
	assert.equal(check.warning, undefined);
	assert.equal(check.suggestedCommand, undefined);
	assert.match(check.detail, /reviewers\.piExtensionIsolation=trusted acknowledges/);
	fs.rmSync(root, { recursive: true, force: true });
});

test("isTrustedReviewerExtensionIsolation accepts only the trusted value", () => {
	assert.equal(isTrustedReviewerExtensionIsolation(null), false);
	assert.equal(isTrustedReviewerExtensionIsolation(undefined), false);
	assert.equal(isTrustedReviewerExtensionIsolation({}), false);
	assert.equal(
		isTrustedReviewerExtensionIsolation({ reviewers: { piExtensionIsolation: "paranoid" } }),
		false,
	);
	assert.equal(
		isTrustedReviewerExtensionIsolation({ reviewers: { piExtensionIsolation: "trusted" } }),
		true,
	);
});

test("runDoctorChecks lists the context hook check", async () => {
	const projectRoot = await initGitRepo("spine-hooks-doctor-");
	const prevAgentDir = process.env.PI_AGENT_DIR;
	const agentDir = path.join(os.tmpdir(), `spine-hooks-agent-${Date.now()}`);
	process.env.PI_AGENT_DIR = agentDir;
	try {
		installFakePackage({
			agentDir,
			sources: ["npm:fake-hooks-pkg"],
			entrySources: [HOOK_EXTENSION_SOURCE],
		});

		const result = runDoctorChecks(projectRoot);
		const check = result.checks.find(
			(entry) => entry.label === "pi context-rewriting extension hooks",
		);
		assert.ok(check, "context hook check expected in doctor output");
		assert.equal(check.ok, true);
		assert.equal(check.warning, true);
		assert.match(check.detail, /fake-hooks-pkg/);
	} finally {
		if (prevAgentDir === undefined) delete process.env.PI_AGENT_DIR;
		else process.env.PI_AGENT_DIR = prevAgentDir;
		fs.rmSync(agentDir, { recursive: true, force: true });
		await destroyGitRepo(projectRoot);
	}
});
