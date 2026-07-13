// @ts-nocheck
/**
 * Detect duplicate pi-spine installs (Pi-private vs npm-global) with version drift.
 * Taskplane v0.30.2+ pattern (issue #128 / SP-559).
 */

import fs from "node:fs";
import path from "node:path";

import { resolvePiAgentDir } from "./pi-extension-conflict.mjs";
import { getNpmGlobalRoot } from "./pi-cli-resolution.mjs";

export const PI_SPINE_PACKAGE_NAME = "pi-spine";

/**
 * @param {string} [agentDir]
 */
export function resolvePiPrivateSpineRoot(agentDir = resolvePiAgentDir()) {
	return path.join(agentDir, "npm", "node_modules", PI_SPINE_PACKAGE_NAME);
}

/**
 * @param {typeof import("node:child_process").spawnSync} [spawn]
 */
export function resolveNpmGlobalSpineRoot(spawn) {
	const npmRoot = getNpmGlobalRoot(spawn);
	if (!npmRoot) return null;
	return path.join(npmRoot, PI_SPINE_PACKAGE_NAME);
}

/**
 * @param {string | null | undefined} packageRoot
 */
export function readInstalledPackageVersion(packageRoot) {
	if (!packageRoot) return null;
	const packageJsonPath = path.join(packageRoot, "package.json");
	if (!fs.existsSync(packageJsonPath)) return null;
	try {
		const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
		return String(pkg.version ?? "").trim() || null;
	} catch {
		return null;
	}
}

/**
 * @param {object} [options]
 * @param {string} [options.agentDir]
 * @param {(p: string) => boolean} [options.exists]
 * @param {typeof import("node:child_process").spawnSync} [options.spawn]
 */
export function detectDuplicatePiSpineInstall({
	agentDir = resolvePiAgentDir(),
	exists = fs.existsSync,
	spawn,
} = {}) {
	const piPrivatePath = resolvePiPrivateSpineRoot(agentDir);
	const npmGlobalPath = resolveNpmGlobalSpineRoot(spawn);

	const piPrivatePresent = exists(piPrivatePath);
	const npmGlobalPresent = npmGlobalPath ? exists(npmGlobalPath) : false;

	const piPrivateVersion = piPrivatePresent ? readInstalledPackageVersion(piPrivatePath) : null;
	const npmGlobalVersion = npmGlobalPresent ? readInstalledPackageVersion(npmGlobalPath) : null;

	const bothPresent = piPrivatePresent && npmGlobalPresent;
	const diverged =
		bothPresent &&
		piPrivateVersion != null &&
		npmGlobalVersion != null &&
		piPrivateVersion !== npmGlobalVersion;

	return {
		piPrivatePath,
		npmGlobalPath,
		piPrivatePresent,
		npmGlobalPresent,
		piPrivateVersion,
		npmGlobalVersion,
		bothPresent,
		diverged,
	};
}

/**
 * Read pi-spine version from a checkout cwd when package.json name matches.
 *
 * @param {string} projectRoot
 * @param {(p: string) => boolean} [exists]
 */
export function readCheckoutPiSpineVersion(projectRoot, exists = fs.existsSync) {
	const packageJsonPath = path.join(projectRoot, "package.json");
	if (!exists(packageJsonPath)) return null;
	try {
		const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
		if (String(pkg.name ?? "").trim() !== PI_SPINE_PACKAGE_NAME) return null;
		return String(pkg.version ?? "").trim() || null;
	} catch {
		return null;
	}
}

/**
 * Detect when the running CLI package version differs from checkout package.json (#204 / SP-648).
 *
 * @param {object} [options]
 * @param {string} [options.runningPackageRoot]
 * @param {string} [options.runningVersion]
 * @param {string} [options.projectRoot]
 * @param {(p: string) => boolean} [options.exists]
 */
export function detectPathSpineVersionSkew({
	runningPackageRoot,
	runningVersion,
	projectRoot = process.cwd(),
	exists = fs.existsSync,
} = {}) {
	const cliVersion =
		runningVersion ??
		(runningPackageRoot ? readInstalledPackageVersion(runningPackageRoot) : null);
	const checkoutVersion = readCheckoutPiSpineVersion(projectRoot, exists);
	const checkoutPresent = checkoutVersion != null;
	const skewed =
		checkoutPresent && cliVersion != null && cliVersion !== checkoutVersion;

	return {
		cliVersion,
		checkoutVersion,
		checkoutPresent,
		skewed,
		projectRoot,
	};
}

/**
 * Remediation when PATH/global CLI skews checkout dogfood (#204).
 */
export function formatCheckoutVersionSkewRemediation() {
	return "node bin/spine.mjs  # or: npm link";
}

/**
 * @param {object} [options]
 * @param {string} [options.runningPackageRoot]
 * @param {string} [options.runningVersion]
 * @param {string} [options.projectRoot]
 * @param {(p: string) => boolean} [options.exists]
 */
export function buildCheckoutVersionSkewDoctorCheck(options = {}) {
	const assessment = detectPathSpineVersionSkew(options);

	if (!assessment.checkoutPresent) {
		return {
			label: "pi-spine checkout version skew",
			ok: true,
			detail: "no pi-spine checkout package.json in cwd",
		};
	}

	if (!assessment.cliVersion) {
		return {
			label: "pi-spine checkout version skew",
			ok: true,
			detail: `checkout v${assessment.checkoutVersion} (running CLI version unknown)`,
		};
	}

	if (!assessment.skewed) {
		return {
			label: "pi-spine checkout version skew",
			ok: true,
			detail: `running and checkout both v${assessment.cliVersion}`,
		};
	}

	return {
		label: "pi-spine checkout version skew",
		ok: true,
		warning: true,
		detail: `running v${assessment.cliVersion} vs checkout v${assessment.checkoutVersion}`,
		suggestedCommand: formatCheckoutVersionSkewRemediation(),
	};
}

/**
 * Platform-aware remediation when duplicate installs diverge.
 */
export function formatDuplicateInstallRemediation() {
	const bash = "npm uninstall -g pi-spine  # then use: pi install npm:pi-spine";
	if (process.platform === "win32") {
		return `PowerShell: npm uninstall -g pi-spine | Bash: ${bash}`;
	}
	return bash;
}

/**
 * @param {object} [options]
 * @param {string} [options.agentDir]
 * @param {(p: string) => boolean} [options.exists]
 * @param {typeof import("node:child_process").spawnSync} [options.spawn]
 */
export function buildDuplicateInstallDoctorCheck(options = {}) {
	const assessment = detectDuplicatePiSpineInstall(options);

	if (!assessment.bothPresent) {
		if (assessment.piPrivatePresent) {
			return {
				label: "pi-spine duplicate install",
				ok: true,
				detail: `Pi-private only (${assessment.piPrivateVersion ?? "unknown"})`,
			};
		}
		if (assessment.npmGlobalPresent) {
			return {
				label: "pi-spine duplicate install",
				ok: true,
				detail: `npm-global only (${assessment.npmGlobalVersion ?? "unknown"})`,
			};
		}
		return {
			label: "pi-spine duplicate install",
			ok: true,
			detail: "no Pi-private or npm-global pi-spine copy detected",
		};
	}

	if (!assessment.diverged) {
		const version = assessment.piPrivateVersion ?? assessment.npmGlobalVersion ?? "unknown";
		return {
			label: "pi-spine duplicate install",
			ok: true,
			detail: `both copies present, same version v${version}`,
		};
	}

	const detail = [
		`Pi-private v${assessment.piPrivateVersion} (${assessment.piPrivatePath})`,
		`npm-global v${assessment.npmGlobalVersion} (${assessment.npmGlobalPath})`,
	].join(" — ");

	return {
		label: "pi-spine duplicate install (version drift)",
		ok: true,
		warning: true,
		detail,
		suggestedCommand: formatDuplicateInstallRemediation(),
	};
}
