import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
	FLUTTER_BUILD_DIR,
	isFlutterAnalyzeTestCompoundCommand,
	isUnscopedFlutterAnalyzeCommand,
	isUnscopedFlutterAnalyzeSegment,
	sanitizeFlutterBuildBeforeAnalyze,
	shouldCleanFlutterBuildBeforeAnalyze,
} from "../../src/batch/lane-dirty-check.mjs";
import {
	prepareContractVerifyEnvironment,
	verifyContract,
} from "../../src/batch/contract-verify.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

function createPollutedFlutterBuild(worktreePath) {
	const pollution = path.join(
		worktreePath,
		"build",
		"ios",
		"SourcePackages",
		"pollution.dart",
	);
	fs.mkdirSync(path.dirname(pollution), { recursive: true });
	fs.writeFileSync(pollution, "// stale SourcePackages artifact\n", "utf-8");
	return pollution;
}

/**
 * Stub `flutter` on PATH so verifyContract integration tests do not require the SDK.
 * FR-STA-13 / #174: ubuntu-latest CI has no Flutter; scoped lane tests passed on macOS
 * but full `coverage:check` failed until this stub ran before shelling out to `flutter analyze`.
 */
function installFlutterStubOnPath(projectRoot) {
	const stubBin = path.join(projectRoot, ".spine-flutter-stub-bin");
	fs.mkdirSync(stubBin, { recursive: true });
	const flutterStub = path.join(stubBin, "flutter");
	fs.writeFileSync(flutterStub, "#!/usr/bin/env bash\nexit 0\n", { mode: 0o755 });
	const previousPath = process.env.PATH;
	process.env.PATH = `${stubBin}${path.delimiter}${previousPath}`;
	return () => {
		process.env.PATH = previousPath;
		fs.rmSync(stubBin, { recursive: true, force: true });
	};
}

test("isUnscopedFlutterAnalyzeSegment detects bare and compound analyze commands", () => {
	assert.equal(isUnscopedFlutterAnalyzeSegment("flutter analyze"), true);
	assert.equal(isUnscopedFlutterAnalyzeSegment("flutter analyze --no-fatal-infos"), true);
	assert.equal(isUnscopedFlutterAnalyzeSegment("flutter analyze lib test"), false);
	assert.equal(isUnscopedFlutterAnalyzeSegment("flutter test"), false);
});

test("isUnscopedFlutterAnalyzeCommand handles compound shell commands", () => {
	assert.equal(isUnscopedFlutterAnalyzeCommand("flutter analyze"), true);
	assert.equal(isUnscopedFlutterAnalyzeCommand("flutter analyze && flutter test"), true);
	assert.equal(isUnscopedFlutterAnalyzeCommand("flutter analyze lib test && flutter test"), false);
	assert.equal(isUnscopedFlutterAnalyzeCommand("flutter test"), false);
});

test("isFlutterAnalyzeTestCompoundCommand matches analyze plus test", () => {
	assert.equal(isFlutterAnalyzeTestCompoundCommand("flutter analyze && flutter test"), true);
	assert.equal(isFlutterAnalyzeTestCompoundCommand("flutter analyze lib test && flutter test"), true);
	assert.equal(isFlutterAnalyzeTestCompoundCommand("flutter analyze"), false);
});

test("shouldCleanFlutterBuildBeforeAnalyze respects config opt-out", () => {
	const command = "flutter analyze && flutter test";
	assert.equal(shouldCleanFlutterBuildBeforeAnalyze(command), true);
	assert.equal(
		shouldCleanFlutterBuildBeforeAnalyze(command, { contract: { flutterAnalyzerHygiene: false } }),
		false,
	);
});

test("sanitizeFlutterBuildBeforeAnalyze removes polluted build directory", async () => {
	const projectRoot = await initGitRepo("spine-flutter-build-clean-");
	try {
		const pollution = createPollutedFlutterBuild(projectRoot);
		assert.ok(fs.existsSync(pollution));

		const result = sanitizeFlutterBuildBeforeAnalyze(projectRoot);
		assert.equal(result.cleaned, true);
		assert.equal(result.buildDir, FLUTTER_BUILD_DIR);
		assert.equal(fs.existsSync(pollution), false);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("sanitizeFlutterBuildBeforeAnalyze is no-op when build is absent", async () => {
	const projectRoot = await initGitRepo("spine-flutter-build-absent-");
	try {
		const result = sanitizeFlutterBuildBeforeAnalyze(projectRoot);
		assert.equal(result.cleaned, false);
		assert.equal(result.reason, "no_build_dir");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("prepareContractVerifyEnvironment removes polluted build for compound analyze command", async () => {
	const projectRoot = await initGitRepo("spine-flutter-prep-env-");
	try {
		const pollution = createPollutedFlutterBuild(projectRoot);
		const env = prepareContractVerifyEnvironment(projectRoot, {
			testCommand: "flutter analyze && flutter test",
		});

		assert.equal(env.hygieneApplied, true);
		assert.equal(env.cleaned, true);
		assert.equal(fs.existsSync(pollution), false);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("polluted build does not fail verify after hygiene", async () => {
	const projectRoot = await initGitRepo("spine-flutter-verify-hygiene-");
	try {
		const pollution = createPollutedFlutterBuild(projectRoot);
		const checkCommand = "test ! -e build/ios/SourcePackages/pollution.dart";

		const beforeHygiene = verifyContract(
			projectRoot,
			{ testCommand: checkCommand },
			{ contract: { testRetries: 0 } },
		);
		assert.equal(beforeHygiene.ok, false);

		prepareContractVerifyEnvironment(projectRoot, {
			testCommand: "flutter analyze && flutter test",
		});
		assert.equal(fs.existsSync(pollution), false);

		const afterHygiene = verifyContract(
			projectRoot,
			{ testCommand: checkCommand },
			{ contract: { testRetries: 0 } },
		);
		assert.equal(afterHygiene.ok, true);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("verifyContract cleans polluted build before unscoped flutter analyze testCommand", async () => {
	const projectRoot = await initGitRepo("spine-flutter-verify-auto-");
	const restorePath = installFlutterStubOnPath(projectRoot);
	try {
		const pollution = createPollutedFlutterBuild(projectRoot);
		const result = verifyContract(
			projectRoot,
			{
				testCommand:
					"flutter analyze && test ! -e build/ios/SourcePackages/pollution.dart",
			},
			{ contract: { testRetries: 0 } },
		);

		assert.equal(fs.existsSync(pollution), false);
		assert.equal(result.ok, true);
		assert.equal(result.checks[0].field, "testCommand");
	} finally {
		restorePath();
		await destroyGitRepo(projectRoot);
	}
});
