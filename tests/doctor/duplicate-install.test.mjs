import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
	buildCheckoutVersionSkewDoctorCheck,
	buildDuplicateInstallDoctorCheck,
	detectDuplicatePiSpineInstall,
	detectPathSpineVersionSkew,
	formatCheckoutVersionSkewRemediation,
	formatDuplicateInstallRemediation,
	readCheckoutPiSpineVersion,
	readInstalledPackageVersion,
	resolveNpmGlobalSpineRoot,
	resolvePiPrivateSpineRoot,
} from "../../src/doctor/duplicate-install.mjs";
import {
	buildPiCliResolutionDoctorCheck,
	collectPiCliSearchBases,
	resolveAuthoritativePiCliPath,
	resolvePiCliFromArgv,
	resetNpmGlobalRootCache,
} from "../../src/doctor/pi-cli-resolution.mjs";

function writePackageVersion(dir, version) {
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(
		path.join(dir, "package.json"),
		JSON.stringify({ name: "pi-spine", version }),
		"utf-8",
	);
}

test("resolvePiCliFromArgv accepts pi dist/cli.js", () => {
	const cli = "/opt/pi/@earendil-works/pi-coding-agent/dist/cli.js";
	assert.equal(
		resolvePiCliFromArgv(cli, (p) => p === cli),
		cli,
	);
	assert.equal(resolvePiCliFromArgv("/tmp/spine-doctor.mjs", () => true), null);
});

test("resolveAuthoritativePiCliPath prefers argv over search", () => {
	const argvCli = "/home/user/.nvm/versions/node/v22.0.0/lib/node_modules/@earendil-works/pi-coding-agent/dist/cli.js";
	const resolved = resolveAuthoritativePiCliPath({
		argv1: argvCli,
		exists: (p) => p === argvCli,
		env: {},
		spawn: () => ({ stdout: "/usr/local/lib/node_modules\n", status: 0 }),
	});
	assert.equal(resolved.path, argvCli);
	assert.equal(resolved.source, "argv");
});

test("resolveAuthoritativePiCliPath searches npm-global and NVM bases", () => {
	resetNpmGlobalRootCache();
	const nvmBase = "/home/user/.nvm/versions/node/v22.0.0/lib/node_modules";
	const candidate = path.join(nvmBase, "@earendil-works", "pi-coding-agent", "dist", "cli.js");
	const resolved = resolveAuthoritativePiCliPath({
		argv1: "/bin/taskplane.mjs",
		exists: (p) => p === candidate,
		env: { NVM_BIN: path.join(nvmBase.replace("/lib/node_modules", ""), "bin") },
		spawn: () => ({ stdout: "", status: 0 }),
	});
	assert.equal(resolved.path, candidate);
	assert.equal(resolved.source, "search");
});

test("collectPiCliSearchBases includes pi-private npm root", () => {
	const bases = collectPiCliSearchBases({ HOME: "/home/tester" }, () => ({
		stdout: "/global/node_modules\n",
		status: 0,
	}));
	assert.ok(bases.some((base) => base.endsWith(".pi/agent/npm/node_modules")));
});

test("buildPiCliResolutionDoctorCheck warns on PATH mismatch", () => {
	const auth = "/opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/dist/cli.js";
	const pathPi = "/usr/local/bin/pi";
	const check = buildPiCliResolutionDoctorCheck({
		argv1: auth,
		which: () => pathPi,
		exists: (p) => p === auth,
		realpath: (p) => p,
		spawn: () => ({ stdout: "", status: 0 }),
	});
	assert.equal(check.warning, true);
	assert.match(check.label, /PATH mismatch/);
	assert.match(check.detail, /PATH: \/usr\/local\/bin\/pi/);
	assert.match(check.detail, /authoritative \(argv\)/);
});

test("buildPiCliResolutionDoctorCheck ok when PATH matches argv resolution", () => {
	const auth = "/opt/pi/dist/cli.js";
	const check = buildPiCliResolutionDoctorCheck({
		argv1: auth,
		which: () => auth,
		exists: (p) => p === auth,
		realpath: (p) => p,
		spawn: () => ({ stdout: "", status: 0 }),
	});
	assert.equal(check.warning, undefined);
	assert.match(check.detail, /matches argv resolution/);
});

test("detectDuplicatePiSpineInstall reports diverged versions", () => {
	resetNpmGlobalRootCache();
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "spine-dup-"));
	try {
		const agentDir = path.join(tmp, "agent");
		const piPrivate = resolvePiPrivateSpineRoot(agentDir);
		const npmGlobal = path.join(tmp, "global", "node_modules", "pi-spine");
		writePackageVersion(piPrivate, "2.1.0");
		writePackageVersion(npmGlobal, "2.0.0");

		const assessment = detectDuplicatePiSpineInstall({
			agentDir,
			exists: (p) => fs.existsSync(p),
			spawn: () => ({ stdout: `${path.join(tmp, "global", "node_modules")}\n`, status: 0 }),
		});

		assert.equal(assessment.bothPresent, true);
		assert.equal(assessment.diverged, true);
		assert.equal(assessment.piPrivateVersion, "2.1.0");
		assert.equal(assessment.npmGlobalVersion, "2.0.0");
	} finally {
		fs.rmSync(tmp, { recursive: true, force: true });
		resetNpmGlobalRootCache();
	}
});

test("buildDuplicateInstallDoctorCheck tolerates same-version duplicates", () => {
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "spine-dup-same-"));
	try {
		const agentDir = path.join(tmp, "agent");
		const piPrivate = resolvePiPrivateSpineRoot(agentDir);
		const npmGlobal = resolveNpmGlobalSpineRoot(() => ({
			stdout: `${path.join(tmp, "global", "node_modules")}\n`,
			status: 0,
		}));
		writePackageVersion(piPrivate, "2.0.0");
		writePackageVersion(npmGlobal, "2.0.0");

		const check = buildDuplicateInstallDoctorCheck({
			agentDir,
			exists: (p) => fs.existsSync(p),
			spawn: () => ({ stdout: `${path.join(tmp, "global", "node_modules")}\n`, status: 0 }),
		});

		assert.equal(check.warning, undefined);
		assert.match(check.detail, /same version/);
	} finally {
		fs.rmSync(tmp, { recursive: true, force: true });
		resetNpmGlobalRootCache();
	}
});

test("buildDuplicateInstallDoctorCheck warns with remediation on drift", () => {
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "spine-dup-warn-"));
	try {
		const agentDir = path.join(tmp, "agent");
		const piPrivate = resolvePiPrivateSpineRoot(agentDir);
		const npmGlobal = path.join(tmp, "global", "node_modules", "pi-spine");
		writePackageVersion(piPrivate, "2.1.0");
		writePackageVersion(npmGlobal, "1.9.0");

		const check = buildDuplicateInstallDoctorCheck({
			agentDir,
			exists: (p) => fs.existsSync(p),
			spawn: () => ({ stdout: `${path.join(tmp, "global", "node_modules")}\n`, status: 0 }),
		});

		assert.equal(check.warning, true);
		assert.match(check.label, /version drift/);
		assert.match(check.detail, /Pi-private v2\.1\.0/);
		assert.match(check.detail, /npm-global v1\.9\.0/);
		assert.ok(check.suggestedCommand?.includes("npm uninstall -g pi-spine"));
	} finally {
		fs.rmSync(tmp, { recursive: true, force: true });
		resetNpmGlobalRootCache();
	}
});

test("readInstalledPackageVersion returns null for missing package", () => {
	assert.equal(readInstalledPackageVersion(null), null);
	assert.equal(readInstalledPackageVersion("/does/not/exist"), null);
});

test("formatDuplicateInstallRemediation mentions pi install", () => {
	const remediation = formatDuplicateInstallRemediation();
	assert.match(remediation, /npm uninstall -g pi-spine/);
	assert.match(remediation, /pi install npm:pi-spine/);
});

test("readCheckoutPiSpineVersion returns version only for pi-spine package.json", () => {
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "spine-checkout-ver-"));
	try {
		fs.writeFileSync(
			path.join(tmp, "package.json"),
			JSON.stringify({ name: "pi-spine", version: "2.6.0" }),
			"utf-8",
		);
		assert.equal(readCheckoutPiSpineVersion(tmp), "2.6.0");

		fs.writeFileSync(
			path.join(tmp, "package.json"),
			JSON.stringify({ name: "other-project", version: "1.0.0" }),
			"utf-8",
		);
		assert.equal(readCheckoutPiSpineVersion(tmp), null);
	} finally {
		fs.rmSync(tmp, { recursive: true, force: true });
	}
});

test("detectPathSpineVersionSkew reports skew between running CLI and checkout", () => {
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "spine-skew-"));
	try {
		const globalRoot = path.join(tmp, "global", "pi-spine");
		const checkoutRoot = path.join(tmp, "checkout");
		writePackageVersion(globalRoot, "2.4.0");
		writePackageVersion(checkoutRoot, "2.6.0");

		const assessment = detectPathSpineVersionSkew({
			runningPackageRoot: globalRoot,
			projectRoot: checkoutRoot,
			exists: (p) => fs.existsSync(p),
		});

		assert.equal(assessment.skewed, true);
		assert.equal(assessment.cliVersion, "2.4.0");
		assert.equal(assessment.checkoutVersion, "2.6.0");
	} finally {
		fs.rmSync(tmp, { recursive: true, force: true });
	}
});

test("detectPathSpineVersionSkew ok when running from checkout", () => {
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "spine-skew-same-"));
	try {
		writePackageVersion(tmp, "2.6.0");

		const assessment = detectPathSpineVersionSkew({
			runningPackageRoot: tmp,
			projectRoot: tmp,
			exists: (p) => fs.existsSync(p),
		});

		assert.equal(assessment.skewed, false);
		assert.equal(assessment.cliVersion, "2.6.0");
		assert.equal(assessment.checkoutVersion, "2.6.0");
	} finally {
		fs.rmSync(tmp, { recursive: true, force: true });
	}
});

test("buildCheckoutVersionSkewDoctorCheck warns with remediation on skew", () => {
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "spine-skew-warn-"));
	try {
		const globalRoot = path.join(tmp, "global", "pi-spine");
		const checkoutRoot = path.join(tmp, "checkout");
		writePackageVersion(globalRoot, "2.3.0");
		writePackageVersion(checkoutRoot, "2.6.0");

		const check = buildCheckoutVersionSkewDoctorCheck({
			runningPackageRoot: globalRoot,
			projectRoot: checkoutRoot,
			exists: (p) => fs.existsSync(p),
		});

		assert.equal(check.warning, true);
		assert.match(check.label, /checkout version skew/);
		assert.match(check.detail, /running v2\.3\.0 vs checkout v2\.6\.0/);
		assert.ok(check.suggestedCommand?.includes("node bin/spine.mjs"));
		assert.ok(check.suggestedCommand?.includes("npm link"));
	} finally {
		fs.rmSync(tmp, { recursive: true, force: true });
	}
});

test("formatCheckoutVersionSkewRemediation suggests node bin/spine.mjs and npm link", () => {
	const remediation = formatCheckoutVersionSkewRemediation();
	assert.match(remediation, /node bin\/spine\.mjs/);
	assert.match(remediation, /npm link/);
});

test("runDoctorChecks includes duplicate install and pi CLI resolution checks", async () => {
	const { runDoctorChecks } = await import("../../src/doctor/run-doctor-checks.mjs");
	const result = runDoctorChecks(process.cwd());
	const labels = result.checks.map((check) => check.label);
	assert.ok(labels.some((label) => label.startsWith("pi CLI resolution")));
	assert.ok(labels.some((label) => label.startsWith("pi-spine duplicate install")));
	assert.ok(labels.some((label) => label.startsWith("pi-spine checkout version skew")));
});
