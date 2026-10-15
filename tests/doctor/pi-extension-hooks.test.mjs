/**
 * SP-822 — context-rewriting pi extension hook doctor check.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
	buildContextHookExtensionDoctorCheck,
	findContextRewritingExtensions,
	MAX_PI_EXTENSION_ENTRIES_PER_PACKAGE,
	MAX_PI_EXTENSION_SOURCE_BYTES,
	MAX_PI_PACKAGES_SCANNED,
	PI_CONTEXT_HOOK_NAMES,
	scanPiExtensionSourceForContextHooks,
} from "../../src/doctor/pi-extension-hooks.mjs";
import { runDoctorChecks } from "../../src/doctor/run-doctor-checks.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const HOOK_EXTENSION_SOURCE = `
pi.on("context", (event) => event);
pi.on("before_provider_request", (event) => event);
pi.on('context_with_system', (event) => event);
`;

/**
 * Install a fake pi package and declare it in the agent settings.json.
 *
 * @param {object} options
 * @param {string} options.agentDir Fake PI agent dir (npm packages resolve here).
 * @param {string[]} options.sources Package source strings for settings.json.
 * @param {Array<{ entry: string, source: string }>} options.files Files to
 *   write inside the package (entry is relative to the package root).
 * @param {object | null} [options.manifest] package.json contents; pass null
 *   to omit the manifest entirely. Defaults to a manifest whose
 *   `pi.extensions` lists every file entry.
 * @param {string} [options.packageName]
 * @returns {string} package dir
 */
function installFakePackage({
	agentDir,
	sources,
	files,
	manifest,
	packageName = "fake-hooks-pkg",
}) {
	const packageDir = path.join(agentDir, "npm", "node_modules", packageName);
	fs.mkdirSync(packageDir, { recursive: true });
	if (manifest !== null) {
		const resolved = manifest ?? {
			name: packageName,
			pi: { extensions: files.map((file) => `./${file.entry}`) },
		};
		fs.writeFileSync(
			path.join(packageDir, "package.json"),
			JSON.stringify(resolved),
			"utf-8",
		);
	}
	for (const file of files) {
		const filePath = path.join(packageDir, file.entry);
		fs.mkdirSync(path.dirname(filePath), { recursive: true });
		fs.writeFileSync(filePath, file.source, "utf-8");
	}
	fs.mkdirSync(agentDir, { recursive: true });
	fs.writeFileSync(
		path.join(agentDir, "settings.json"),
		JSON.stringify({ packages: sources }),
		"utf-8",
	);
	return packageDir;
}

/** @param {string} root */
function cleanup(root) {
	fs.rmSync(root, { recursive: true, force: true });
}

test("scanPiExtensionSourceForContextHooks detects pi.on hook registrations", () => {
	assert.deepEqual(scanPiExtensionSourceForContextHooks('pi.on("context", handler);'), [
		"context",
	]);
	assert.deepEqual(scanPiExtensionSourceForContextHooks("pi.on('context', handler);"), [
		"context",
	]);
	assert.deepEqual(
		scanPiExtensionSourceForContextHooks('pi.on( "context_with_system" , handler);'),
		["context_with_system"],
	);
	assert.deepEqual(
		scanPiExtensionSourceForContextHooks('agent.on("before_provider_request", handler);'),
		["before_provider_request"],
	);
});

test("scanPiExtensionSourceForContextHooks ignores non-hook identifiers", () => {
	assert.deepEqual(
		scanPiExtensionSourceForContextHooks(`
			const context = buildContext();
			function render(context) {}
			pi.on("tool_call", (event) => event);
			pi.on("session", (ctx) => ctx.context);
		`),
		[],
	);
});

test("scanPiExtensionSourceForContextHooks returns canonical order and empty default", () => {
	const mixed = scanPiExtensionSourceForContextHooks(HOOK_EXTENSION_SOURCE);
	assert.deepEqual(mixed, PI_CONTEXT_HOOK_NAMES);
	assert.deepEqual(scanPiExtensionSourceForContextHooks(""), []);
	assert.deepEqual(scanPiExtensionSourceForContextHooks(undefined), []);
});

test("findContextRewritingExtensions flags manifest entry with pi.on('context')", () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "spine-hooks-npm-"));
	const agentDir = path.join(root, "agent");
	installFakePackage({
		agentDir,
		sources: ["npm:fake-hooks-pkg"],
		files: [{ entry: "src/ext.ts", source: 'pi.on("context", (event) => event);' }],
		manifest: { name: "fake-hooks-pkg", pi: { extensions: ["./src/ext.ts"] } },
	});

	const { packages, packagesScanned, skipped } = findContextRewritingExtensions({
		projectRoot: root,
		agentDir,
	});
	assert.equal(packagesScanned, 1);
	assert.equal(packages.length, 1);
	assert.equal(packages[0].source, "npm:fake-hooks-pkg");
	assert.deepEqual(packages[0].hooks, ["context"]);
	assert.deepEqual(skipped, []);
	cleanup(root);
});

test("findContextRewritingExtensions falls back to extensions/ when no manifest list", () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "spine-hooks-fallback-"));
	const agentDir = path.join(root, "agent");
	installFakePackage({
		agentDir,
		sources: ["npm:no-manifest-hooks"],
		packageName: "no-manifest-hooks",
		manifest: { name: "no-manifest-hooks" },
		files: [
			{
				entry: "extensions/index.js",
				source: 'pi.on("before_provider_request", (event) => event);',
			},
		],
	});

	const { packages } = findContextRewritingExtensions({ projectRoot: root, agentDir });
	assert.equal(packages.length, 1);
	assert.equal(packages[0].source, "npm:no-manifest-hooks");
	assert.deepEqual(packages[0].hooks, ["before_provider_request"]);
	cleanup(root);
});

test("findContextRewritingExtensions falls back to root index files", () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "spine-hooks-index-"));
	const agentDir = path.join(root, "agent");
	installFakePackage({
		agentDir,
		sources: ["npm:root-index-hooks"],
		packageName: "root-index-hooks",
		manifest: null,
		files: [{ entry: "index.mjs", source: "pi.on('context', (event) => event);" }],
	});

	const { packages } = findContextRewritingExtensions({ projectRoot: root, agentDir });
	assert.equal(packages.length, 1);
	assert.deepEqual(packages[0].hooks, ["context"]);
	cleanup(root);
});

test("findContextRewritingExtensions ignores packages with only non-context hooks", () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "spine-hooks-tool-"));
	const agentDir = path.join(root, "agent");
	installFakePackage({
		agentDir,
		sources: ["npm:tool-only-pkg"],
		packageName: "tool-only-pkg",
		files: [{ entry: "ext.mjs", source: 'pi.on("tool_call", (event) => event);' }],
	});

	const { packages, packagesScanned } = findContextRewritingExtensions({
		projectRoot: root,
		agentDir,
	});
	assert.equal(packagesScanned, 1);
	assert.equal(packages.length, 0);
	cleanup(root);
});

test("findContextRewritingExtensions skips missing package dirs without throwing", () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "spine-hooks-missing-"));
	const agentDir = path.join(root, "agent");
	fs.mkdirSync(agentDir, { recursive: true });
	fs.writeFileSync(
		path.join(agentDir, "settings.json"),
		JSON.stringify({ packages: ["npm:does-not-exist"] }),
		"utf-8",
	);

	const { packages, packagesScanned, skipped } = findContextRewritingExtensions({
		projectRoot: root,
		agentDir,
	});
	assert.equal(packagesScanned, 0);
	assert.equal(packages.length, 0);
	assert.equal(skipped.length, 1);
	assert.equal(skipped[0].source, "npm:does-not-exist");
	cleanup(root);
});

test("findContextRewritingExtensions scans project settings and dedupes packages", () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "spine-hooks-proj-"));
	const agentDir = path.join(root, "agent");
	installFakePackage({
		agentDir,
		sources: ["npm:fake-hooks-pkg"],
		files: [{ entry: "ext.mjs", source: 'pi.on("context", (event) => event);' }],
	});
	fs.mkdirSync(path.join(root, ".pi"), { recursive: true });
	fs.writeFileSync(
		path.join(root, ".pi", "settings.json"),
		JSON.stringify({ packages: ["npm:fake-hooks-pkg"] }),
		"utf-8",
	);

	const { packages, packagesScanned } = findContextRewritingExtensions({
		projectRoot: root,
		agentDir,
	});
	assert.equal(packagesScanned, 1, "same package listed twice must be scanned once");
	assert.equal(packages.length, 1);
	cleanup(root);
});

test("findContextRewritingExtensions scans packages without extension entries without flagging", () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "spine-hooks-clean-"));
	const agentDir = path.join(root, "agent");
	installFakePackage({
		agentDir,
		sources: ["npm:plain-pkg"],
		packageName: "plain-pkg",
		manifest: { name: "plain-pkg" },
		files: [{ entry: "README.md", source: "# plain" }],
	});

	const { packages, packagesScanned } = findContextRewritingExtensions({
		projectRoot: root,
		agentDir,
	});
	assert.equal(packagesScanned, 1);
	assert.equal(packages.length, 0);
	cleanup(root);
});

test("findContextRewritingExtensions caps extension entries per package", () => {
	assert.equal(MAX_PI_EXTENSION_ENTRIES_PER_PACKAGE, 20);
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "spine-hooks-cap-"));
	const agentDir = path.join(root, "agent");
	const files = Array.from(
		{ length: MAX_PI_EXTENSION_ENTRIES_PER_PACKAGE + 4 },
		(_, index) => ({
			entry: `ext-${index}.mjs`,
			source: index >= MAX_PI_EXTENSION_ENTRIES_PER_PACKAGE
				? 'pi.on("context", (event) => event);'
				: "export const benign = 1;",
		}),
	);
	installFakePackage({ agentDir, sources: ["npm:fake-hooks-pkg"], files });

	const { packages } = findContextRewritingExtensions({ projectRoot: root, agentDir });
	assert.equal(packages.length, 0, "hook entries beyond the cap must not be scanned");
	cleanup(root);
});

test("findContextRewritingExtensions caps scanned packages", () => {
	assert.equal(MAX_PI_PACKAGES_SCANNED, 50);
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "spine-hooks-pcap-"));
	const agentDir = path.join(root, "agent");
	const sources = [];
	for (let index = 0; index < MAX_PI_PACKAGES_SCANNED + 2; index++) {
		const packageName = `bulk-pkg-${index}`;
		sources.push(`npm:${packageName}`);
		installFakePackage({
			agentDir,
			sources,
			packageName,
			files: [{ entry: "ext.mjs", source: "export const benign = 1;" }],
		});
	}

	const { packagesScanned, skipped } = findContextRewritingExtensions({
		projectRoot: root,
		agentDir,
	});
	assert.equal(packagesScanned, MAX_PI_PACKAGES_SCANNED);
	assert.equal(skipped.length, 2, "packages beyond the cap must be skipped");
	cleanup(root);
});

test("findContextRewritingExtensions truncates oversized entry files", () => {
	assert.equal(MAX_PI_EXTENSION_SOURCE_BYTES, 512 * 1024);
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "spine-hooks-big-"));
	const agentDir = path.join(root, "agent");
	const filler = "// pad\n".repeat(MAX_PI_EXTENSION_SOURCE_BYTES / 6 + 1);
	const oversized = filler + 'pi.on("context", (event) => event);';
	assert.ok(oversized.length > MAX_PI_EXTENSION_SOURCE_BYTES);
	installFakePackage({
		agentDir,
		sources: ["npm:fake-hooks-pkg"],
		files: [
			{ entry: "ext-0.mjs", source: oversized },
			{ entry: "ext-1.mjs", source: 'pi.on("context", (event) => event);' },
		],
	});

	const { packages } = findContextRewritingExtensions({ projectRoot: root, agentDir });
	assert.equal(packages.length, 1, "only the within-bounds entry is flagged");
	assert.deepEqual(packages[0].hooks, ["context"]);
	cleanup(root);
});

test("findContextRewritingExtensions skips entries escaping the package directory", () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "spine-hooks-trav-"));
	const agentDir = path.join(root, "agent");
	const outsideFile = path.join(root, "outside.mjs");
	fs.writeFileSync(outsideFile, 'pi.on("context", (event) => event);', "utf-8");
	installFakePackage({
		agentDir,
		sources: ["npm:traversal-pkg"],
		packageName: "traversal-pkg",
		manifest: { name: "traversal-pkg", pi: { extensions: ["../../../outside.mjs"] } },
		files: [],
	});

	const { packages, skipped } = findContextRewritingExtensions({
		projectRoot: root,
		agentDir,
	});
	assert.equal(packages.length, 0, "entries outside the package dir must not be read");
	assert.equal(skipped.length, 1);
	assert.match(skipped[0].reason, /escapes package directory/);
	cleanup(root);
});

test("buildContextHookExtensionDoctorCheck warns when reviewers load user extensions", () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "spine-hooks-warn-"));
	const agentDir = path.join(root, "agent");
	installFakePackage({
		agentDir,
		sources: ["npm:fake-hooks-pkg"],
		files: [{ entry: "ext.mjs", source: HOOK_EXTENSION_SOURCE }],
	});

	const check = buildContextHookExtensionDoctorCheck({
		projectRoot: root,
		agentDir,
		config: { agents: { reviewer: { loadUserExtensions: true } } },
	});
	assert.equal(check.label, "pi extensions rewriting reviewer context");
	assert.equal(check.ok, true, "advisory check never hard-fails");
	assert.equal(check.warning, true);
	assert.match(check.detail, /fake-hooks-pkg/);
	assert.match(check.detail, /before_provider_request/);
	assert.match(check.detail, /agents\.reviewer\.loadUserExtensions=true/);
	assert.equal(
		check.suggestedCommand,
		"spine settings set agents.reviewer.loadUserExtensions false",
	);
	cleanup(root);
});

test("buildContextHookExtensionDoctorCheck stays advisory-only by default config", () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "spine-hooks-iso-"));
	const agentDir = path.join(root, "agent");
	installFakePackage({
		agentDir,
		sources: ["npm:fake-hooks-pkg"],
		files: [{ entry: "ext.mjs", source: HOOK_EXTENSION_SOURCE }],
	});

	for (const config of [undefined, {}, { agents: { reviewer: {} } }]) {
		const check = buildContextHookExtensionDoctorCheck({
			projectRoot: root,
			agentDir,
			config,
		});
		assert.equal(check.ok, true);
		assert.equal(check.warning, undefined, "isolated reviewers must not warn");
		assert.equal(check.suggestedCommand, undefined);
		assert.match(check.detail, /1 package\(s\) register context hooks/);
		assert.match(check.detail, /reviewers isolated \(pi -ne\)/);
	}
	cleanup(root);
});

test("buildContextHookExtensionDoctorCheck stays clean without hook packages", () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "spine-hooks-none-"));
	const agentDir = path.join(root, "agent");
	fs.mkdirSync(agentDir, { recursive: true });
	fs.writeFileSync(
		path.join(agentDir, "settings.json"),
		JSON.stringify({ packages: ["npm:not-installed"] }),
		"utf-8",
	);

	const check = buildContextHookExtensionDoctorCheck({ projectRoot: root, agentDir });
	assert.equal(check.ok, true);
	assert.equal(check.warning, undefined);
	assert.match(check.detail, /no context-rewriting hooks found in 0 installed pi package/);
	cleanup(root);
});

test("runDoctorChecks lists the context hook check after extension-conflict", async () => {
	const projectRoot = await initGitRepo("spine-hooks-doctor-");
	const prevAgentDir = process.env.PI_AGENT_DIR;
	const agentDir = fs.mkdtempSync(path.join(os.tmpdir(), "spine-hooks-agent-"));
	process.env.PI_AGENT_DIR = agentDir;
	try {
		installFakePackage({
			agentDir,
			sources: ["npm:fake-hooks-pkg"],
			files: [{ entry: "ext.mjs", source: HOOK_EXTENSION_SOURCE }],
		});

		const result = runDoctorChecks(projectRoot);
		const index = result.checks.findIndex(
			(entry) => entry.label === "pi extensions rewriting reviewer context",
		);
		assert.ok(index >= 0, "context hook check expected in doctor output");
		const conflictIndex = result.checks.findIndex(
			(entry) => entry.label === "pi-web-access extension conflict",
		);
		assert.ok(
			conflictIndex >= 0 && index === conflictIndex + 1,
			"check must be pushed right after the extension-conflict check",
		);
		const check = result.checks[index];
		assert.equal(check.ok, true);
		assert.equal(check.warning, undefined, "default config keeps reviewers isolated");
		assert.match(check.detail, /fake-hooks-pkg/);
		assert.match(check.detail, /reviewers isolated \(pi -ne\)/);
	} finally {
		if (prevAgentDir === undefined) delete process.env.PI_AGENT_DIR;
		else process.env.PI_AGENT_DIR = prevAgentDir;
		cleanup(agentDir);
		await destroyGitRepo(projectRoot);
	}
});
