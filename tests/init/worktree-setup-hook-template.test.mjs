import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { runInit } from "../../bin/spine-init.mjs";
import { loadSpineConfigTemplate } from "../../src/config/spine-init-constants.mjs";
import {
	buildGitignoredPubspecAssetsDoctorCheck,
	copyFlutterWorktreeSetupHookTemplate,
	extractPubspecAssetPaths,
	FLUTTER_WORKTREE_SETUP_HOOK_REL,
	FLUTTER_WORKTREE_SETUP_HOOK_TEMPLATE,
	findGitignoredPubspecAssetsOnMain,
	stripTemplateOnlyKeys,
} from "../../src/config/worktree-setup-hook.mjs";

async function initGitRepo(prefix) {
	const dir = await mkdtemp(path.join(os.tmpdir(), prefix));
	execFileSync("git", ["init", "-b", "main"], { cwd: dir, stdio: "ignore" });
	execFileSync("git", ["config", "user.email", "spine@test.local"], { cwd: dir, stdio: "ignore" });
	execFileSync("git", ["config", "user.name", "spine test"], { cwd: dir, stdio: "ignore" });
	return dir;
}

test("spine-config template documents commented worktreeSetupHook example", () => {
	const template = loadSpineConfigTemplate();
	assert.ok(template._examples);
	assert.equal(template._examples.worktreeSetupHook, FLUTTER_WORKTREE_SETUP_HOOK_REL);
	assert.match(String(template._examples._worktreeSetupHookNote), /SPINE_PROJECT_ROOT/);
	assert.equal(template.worktreeSetupHook, "");
});

test("stripTemplateOnlyKeys removes _examples from init output", () => {
	const stripped = stripTemplateOnlyKeys({
		worktreeSetupHook: "",
		_examples: { worktreeSetupHook: FLUTTER_WORKTREE_SETUP_HOOK_REL },
	});
	assert.equal(stripped.worktreeSetupHook, "");
	assert.equal(stripped._examples, undefined);
});

test("extractPubspecAssetPaths parses flutter asset entries", () => {
	const pubspec = `
name: demo
flutter:
  assets:
    - assets/bundled_skins/
    - assets/plugins/dye2.reaplugin/
    - assets/icons/app.png
`;
	const paths = extractPubspecAssetPaths(pubspec);
	assert.deepEqual(paths, [
		"assets/bundled_skins",
		"assets/plugins/dye2.reaplugin",
		"assets/icons/app.png",
	]);
});

test("runInit copies Flutter worktree setup hook template to scripts/", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-init-hook-template-"));
	try {
		const result = runInit(projectRoot, []);
		assert.equal(result.ok, true);

		const hookPath = path.join(projectRoot, FLUTTER_WORKTREE_SETUP_HOOK_REL);
		assert.ok(fs.existsSync(hookPath));
		const templateBody = fs.readFileSync(FLUTTER_WORKTREE_SETUP_HOOK_TEMPLATE, "utf-8");
		assert.equal(fs.readFileSync(hookPath, "utf-8"), templateBody);
		assert.match(templateBody, /SPINE_PROJECT_ROOT/);

		const config = JSON.parse(
			fs.readFileSync(path.join(projectRoot, ".spine", "spine-config.json"), "utf-8"),
		);
		assert.equal(config._examples, undefined);
		assert.equal(config.worktreeSetupHook, "");
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("copyFlutterWorktreeSetupHookTemplate skips existing hook without force", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-hook-copy-skip-"));
	try {
		const destPath = path.join(projectRoot, FLUTTER_WORKTREE_SETUP_HOOK_REL);
		fs.mkdirSync(path.dirname(destPath), { recursive: true });
		fs.writeFileSync(destPath, "#!/bin/sh\necho custom\n", "utf-8");

		const result = copyFlutterWorktreeSetupHookTemplate(projectRoot);
		assert.equal(result.action, "skip");
		assert.match(fs.readFileSync(destPath, "utf-8"), /custom/);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("findGitignoredPubspecAssetsOnMain detects gitignored assets present on main", async () => {
	const projectRoot = await initGitRepo("spine-pubspec-gitignored-");
	try {
		const assetDir = path.join(projectRoot, "assets", "bundled_skins");
		fs.mkdirSync(assetDir, { recursive: true });
		fs.writeFileSync(path.join(assetDir, "skin.json"), "{}", "utf-8");
		fs.writeFileSync(
			path.join(projectRoot, "pubspec.yaml"),
			"name: demo\nflutter:\n  assets:\n    - assets/bundled_skins/\n",
			"utf-8",
		);
		fs.writeFileSync(path.join(projectRoot, ".gitignore"), "assets/bundled_skins/\n", "utf-8");
		execFileSync("git", ["add", "pubspec.yaml", ".gitignore"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "seed pubspec"], { cwd: projectRoot, stdio: "ignore" });

		const assets = findGitignoredPubspecAssetsOnMain(projectRoot);
		assert.deepEqual(assets, ["assets/bundled_skins"]);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("buildGitignoredPubspecAssetsDoctorCheck warns when hook not configured", async () => {
	const projectRoot = await initGitRepo("spine-doctor-pubspec-warn-");
	try {
		const assetDir = path.join(projectRoot, "assets", "bundled_skins");
		fs.mkdirSync(assetDir, { recursive: true });
		fs.writeFileSync(path.join(assetDir, "skin.json"), "{}", "utf-8");
		fs.writeFileSync(
			path.join(projectRoot, "pubspec.yaml"),
			"name: demo\nflutter:\n  assets:\n    - assets/bundled_skins/\n",
			"utf-8",
		);
		fs.writeFileSync(path.join(projectRoot, ".gitignore"), "assets/bundled_skins/\n", "utf-8");
		execFileSync("git", ["add", "pubspec.yaml", ".gitignore"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "seed pubspec"], { cwd: projectRoot, stdio: "ignore" });

		const check = buildGitignoredPubspecAssetsDoctorCheck({
			projectRoot,
			config: { worktreeSetupHook: "" },
		});
		assert.equal(check.ok, true);
		assert.equal(check.warning, true);
		assert.match(check.detail, /worktreeSetupHook not configured/);
		assert.match(check.suggestion, /flutter-worktree-guide/);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("buildGitignoredPubspecAssetsDoctorCheck warns when lane missing gitignored assets", async () => {
	const projectRoot = await initGitRepo("spine-doctor-lane-missing-");
	try {
		const assetDir = path.join(projectRoot, "assets", "bundled_skins");
		fs.mkdirSync(assetDir, { recursive: true });
		fs.writeFileSync(path.join(assetDir, "skin.json"), "{}", "utf-8");
		fs.writeFileSync(
			path.join(projectRoot, "pubspec.yaml"),
			"name: demo\nflutter:\n  assets:\n    - assets/bundled_skins/\n",
			"utf-8",
		);
		fs.writeFileSync(path.join(projectRoot, ".gitignore"), "assets/bundled_skins/\n", "utf-8");
		execFileSync("git", ["add", "pubspec.yaml", ".gitignore"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "seed pubspec"], { cwd: projectRoot, stdio: "ignore" });

		const laneDir = path.join(projectRoot, ".worktrees", "batch-1", "lane-1");
		fs.mkdirSync(laneDir, { recursive: true });

		const check = buildGitignoredPubspecAssetsDoctorCheck({
			projectRoot,
			config: { worktreeSetupHook: FLUTTER_WORKTREE_SETUP_HOOK_REL },
		});
		assert.equal(check.ok, true);
		assert.equal(check.warning, true);
		assert.match(check.detail, /missing in lane/);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});
