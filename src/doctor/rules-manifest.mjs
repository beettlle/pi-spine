/**
 * Doctor warnings for committed `.spine/rules-manifest.json` (SP-093).
 */

import fs from "node:fs";
import path from "node:path";

import {
	discoverCursorRules,
	loadRulesManifest,
	RULES_MANIFEST_REL_PATH,
} from "../config/cursor-rules/discover.mjs";
import { loadRulesProfile } from "../config/cursor-rules/profile.mjs";

export const RULES_MANIFEST_MISSING = "RULES_MANIFEST_MISSING";
export const RULES_MANIFEST_STALE = "RULES_MANIFEST_STALE";

/**
 * @param {import("../config/cursor-rules/discover.mjs").CursorRulesManifest} manifest
 */
export function rulesManifestSummary(manifest) {
	return {
		rules: manifest.rules.length,
		excluded: manifest.excluded.length,
		warnings: manifest.warnings?.length ?? 0,
	};
}

/**
 * Stable fingerprint for stale comparison (ignores `generatedAt`).
 *
 * @param {import("../config/cursor-rules/discover.mjs").CursorRulesManifest} manifest
 */
export function fingerprintRulesManifest(manifest) {
	const payload = {
		rulesRoot: manifest.rulesRoot,
		rules: [...manifest.rules]
			.map((rule) => ({
				relPath: rule.relPath,
				spineClass: rule.spineClass,
				alwaysApply: rule.alwaysApply,
				description: rule.description,
				globs: rule.globs,
				parseStatus: rule.parseStatus,
				warnings: rule.warnings ?? [],
			}))
			.sort((left, right) => left.relPath.localeCompare(right.relPath)),
		excluded: [...manifest.excluded]
			.map((entry) => ({
				relPath: entry.relPath,
				reason: entry.reason,
				spineClass: entry.spineClass,
			}))
			.sort((left, right) => left.relPath.localeCompare(right.relPath)),
		warnings: manifest.warnings ?? [],
	};
	return JSON.stringify(payload);
}

/**
 * @param {string} projectRoot
 * @param {object} [deps]
 * @param {typeof discoverCursorRules} [deps.discoverCursorRules]
 * @param {typeof loadRulesManifest} [deps.loadRulesManifest]
 * @param {typeof loadRulesProfile} [deps.loadRulesProfile]
 */
export function evaluateRulesManifestState(
	projectRoot,
	{
		discoverCursorRules: discoverFn = discoverCursorRules,
		loadRulesManifest: loadFn = loadRulesManifest,
		loadRulesProfile: loadProfileFn = loadRulesProfile,
	} = {},
) {
	const manifestPath = path.join(projectRoot, RULES_MANIFEST_REL_PATH);
	if (!fs.existsSync(manifestPath)) {
		return {
			missing: true,
			stale: false,
			manifest: null,
			manifestPath: RULES_MANIFEST_REL_PATH,
		};
	}

	const committed = loadFn(projectRoot);
	const profileResult = loadProfileFn(projectRoot);
	if (!profileResult.ok) {
		return {
			missing: false,
			stale: false,
			manifest: committed,
			profileError: profileResult.error,
		};
	}

	const fresh = discoverFn({
		projectRoot,
		profile: profileResult.profile,
		writeManifest: false,
	});
	const stale =
		committed != null &&
		fresh.manifest != null &&
		fingerprintRulesManifest(committed) !== fingerprintRulesManifest(fresh.manifest);

	return {
		missing: false,
		stale,
		manifest: committed,
		freshManifest: fresh.manifest,
	};
}

/**
 * @param {string} projectRoot
 */
export function buildRulesManifestDoctorCheck(projectRoot) {
	const state = evaluateRulesManifestState(projectRoot);

	if (state.profileError) {
		return {
			label: ".spine/rules-manifest.json fresh",
			ok: true,
			warning: true,
			code: state.profileError.code,
			detail: state.profileError.message,
			suggestedCommand: "fix .spine/rules-profile.json",
		};
	}

	if (state.missing) {
		return {
			label: ".spine/rules-manifest.json present",
			ok: true,
			warning: true,
			code: RULES_MANIFEST_MISSING,
			detail: "missing — commit manifest after discovery",
			suggestedCommand: "spine rules sync",
		};
	}

	if (state.stale) {
		const onDisk = state.manifest ? rulesManifestSummary(state.manifest) : { rules: 0, excluded: 0 };
		const fresh = state.freshManifest ? rulesManifestSummary(state.freshManifest) : onDisk;
		return {
			label: ".spine/rules-manifest.json fresh",
			ok: true,
			warning: true,
			code: RULES_MANIFEST_STALE,
			detail: `stale (on disk: ${onDisk.rules} rules; rescan: ${fresh.rules} rules)`,
			suggestedCommand: "spine rules sync",
		};
	}

	const summary = state.manifest ? rulesManifestSummary(state.manifest) : { rules: 0, excluded: 0 };
	return {
		label: ".spine/rules-manifest.json fresh",
		ok: true,
		detail: `${summary.rules} rules, ${summary.excluded} excluded`,
	};
}
