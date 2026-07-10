/**
 * Sequence planning: release profile, wave resolution, dry-run builders (SP-582 / FR-SHIP-02).
 */

import { loadSpineConfig } from "../config/spine-config-load.mjs";
import { resolveTasksRoot } from "../config/spine-preflight-lib.mjs";
import { buildPlan } from "../planner/index.mjs";
import { resolveWaveTaskIds } from "../planner/wave-scope.mjs";

/** Release sequence profile (FR-STA-25 / SP-536). See docs/release/manifest-v1.10.0-example.md. */
export const SEQUENCE_RELEASE_PROFILE = {
	id: "release",
	/** Max parallel tasks per planner wave (release-profiles.md minor). */
	maxTasksPerWave: 4,
	/** Operator-only pause points between waves; sequence does not auto-approve these. */
	gateOnlyPausePoints: ["gate_approve"],
	/** Dry-run prints the wave land loop without starting batches. */
	dryRunSupported: true,
	manifestDocPath: "docs/release/manifest-v1.10.0-example.md",
};

/**
 * @param {string|null|undefined} scope
 * @returns {boolean}
 */
export function isReleaseSequenceScope(scope) {
	const normalized = String(scope ?? "").trim();
	return normalized.includes(",");
}

/**
 * @param {object} [params]
 * @param {string|null|undefined} [params.scope]
 * @param {string|null|undefined} [params.profile]
 * @returns {typeof SEQUENCE_RELEASE_PROFILE|null}
 */
export function resolveSequenceProfile({ scope, profile = null } = {}) {
	const normalized = String(profile ?? "")
		.trim()
		.toLowerCase();
	if (normalized === "release") {
		return SEQUENCE_RELEASE_PROFILE;
	}
	if (isReleaseSequenceScope(scope)) {
		return SEQUENCE_RELEASE_PROFILE;
	}
	return null;
}

/**
 * @param {object} plan
 * @param {typeof SEQUENCE_RELEASE_PROFILE} [profile]
 */
export function validateReleaseSequenceWaveCaps(plan, profile = SEQUENCE_RELEASE_PROFILE) {
	const waves = plan?.waves ?? [];
	/** @type {Array<{ waveIndex: number, taskCount: number }>} */
	const violations = [];

	for (const wave of waves) {
		const waveIndex = wave.waveIndex ?? wave.index ?? 0;
		const taskCount = Array.isArray(wave.taskIds) ? wave.taskIds.length : 0;
		if (taskCount > profile.maxTasksPerWave) {
			violations.push({ waveIndex, taskCount });
		}
	}

	if (violations.length === 0) {
		return { ok: true };
	}

	const lines = [
		`Release sequence profile wave cap exceeded (max ${profile.maxTasksPerWave} tasks per wave):`,
	];
	for (const { waveIndex, taskCount } of violations) {
		lines.push(`  Wave ${waveIndex}: ${taskCount} tasks`);
	}
	lines.push(`See ${profile.manifestDocPath} and release-profiles.md to split waves.`);

	return {
		ok: false,
		error: "release_wave_cap_exceeded",
		violations,
		output: `${lines.join("\n")}\n`,
	};
}

/**
 * @param {typeof SEQUENCE_RELEASE_PROFILE} profile
 */
export function buildReleaseSequenceDryRunHeader(profile = SEQUENCE_RELEASE_PROFILE) {
	const pausePoints = profile.gateOnlyPausePoints.join(", ");
	return [
		`# Release sequence profile (${profile.id})`,
		`# Manifest: ${profile.manifestDocPath}`,
		`# Operator pause points: ${pausePoints} (per wave; publish approval is manual)`,
		`# Wave cap: max ${profile.maxTasksPerWave} tasks per wave`,
	];
}

/**
 * @param {object} plan
 * @param {object} [options]
 * @param {number} [options.fromWave]
 * @param {number|null} [options.throughWave]
 */
export function resolveSequenceWaves(plan, { fromWave = 0, throughWave = null } = {}) {
	const waves = plan?.waves ?? [];
	if (waves.length === 0) {
		return { ok: false, error: "plan_has_no_waves", output: "Planner scope has no waves." };
	}

	const lastWave = throughWave ?? waves.length - 1;
	if (!Number.isInteger(fromWave) || fromWave < 0 || fromWave >= waves.length) {
		return {
			ok: false,
			error: "from_wave_out_of_range",
			fromWave,
			waveCount: waves.length,
			output: `--from-wave ${fromWave} is out of range (plan has ${waves.length} wave(s)).`,
		};
	}
	if (!Number.isInteger(lastWave) || lastWave < fromWave || lastWave >= waves.length) {
		return {
			ok: false,
			error: "through_wave_out_of_range",
			throughWave: lastWave,
			fromWave,
			waveCount: waves.length,
			output: `--through-wave ${lastWave} is invalid for plan with ${waves.length} wave(s) (from-wave=${fromWave}).`,
		};
	}

	/** @type {Array<{ waveIndex: number, taskIds: string[] }>} */
	const entries = [];
	for (let waveIndex = fromWave; waveIndex <= lastWave; waveIndex++) {
		const resolved = resolveWaveTaskIds(plan, waveIndex);
		if (!resolved.ok) return resolved;
		entries.push({ waveIndex, taskIds: resolved.taskIds });
	}

	return { ok: true, waves: entries, waveCount: waves.length, fromWave, throughWave: lastWave };
}

/**
 * @param {object} params
 * @param {number} params.waveIndex
 * @param {string[]} params.taskIds
 * @param {boolean} [params.autoApproveGate]
 * @param {typeof SEQUENCE_RELEASE_PROFILE|null} [params.profile]
 */
export function buildSequenceWaveCommands({
	waveIndex,
	taskIds,
	autoApproveGate = false,
	profile = null,
}) {
	const taskScope = taskIds.join(" ");
	const gateOnly =
		profile?.gateOnlyPausePoints?.includes("gate_approve") && !autoApproveGate;
	const gateLine = autoApproveGate
		? "spine gate approve"
		: gateOnly
			? "spine gate approve  # GATE-ONLY: operator approval required (release profile)"
			: "spine gate approve  # when integrate gate is open";
	return [
		`# Wave ${waveIndex}`,
		`spine batch start ${taskScope}`,
		"spine status --diagnose  # wait for terminal batch phase",
		gateLine,
		"spine integrate",
		"spine batch complete",
	];
}

/**
 * @param {object} params
 * @param {object} params.plan
 * @param {number} [params.fromWave]
 * @param {number|null} [params.throughWave]
 * @param {boolean} [params.autoApproveGate]
 * @param {typeof SEQUENCE_RELEASE_PROFILE|null} [params.profile]
 */
export function buildSequenceDryRunPlan({
	plan,
	fromWave = 0,
	throughWave = null,
	autoApproveGate = false,
	profile = null,
}) {
	const wavePlan = resolveSequenceWaves(plan, { fromWave, throughWave });
	if (!wavePlan.ok) return wavePlan;

	if (profile) {
		const capCheck = validateReleaseSequenceWaveCaps(plan, profile);
		if (!capCheck.ok) return capCheck;
	}

	const waveCommands = wavePlan.waves.flatMap((wave) =>
		buildSequenceWaveCommands({
			waveIndex: wave.waveIndex,
			taskIds: wave.taskIds,
			autoApproveGate,
			profile,
		}),
	);
	const header = profile ? buildReleaseSequenceDryRunHeader(profile) : [];
	const commands = [...header, ...waveCommands];

	return {
		ok: true,
		profile: profile?.id ?? null,
		waves: wavePlan.waves,
		waveCount: wavePlan.waveCount,
		fromWave: wavePlan.fromWave,
		throughWave: wavePlan.throughWave,
		commands,
		output: `${commands.join("\n")}\n`,
	};
}

/**
 * @param {string} projectRoot
 * @param {string} scope
 */
export function buildSequencePlan(projectRoot, scope) {
	const configResult = loadSpineConfig(projectRoot);
	const config = configResult.config ?? {};
	const tasksRoot = resolveTasksRoot(projectRoot, configResult);
	if (!tasksRoot) {
		return { ok: false, error: "tasks_root_missing", output: "Tasks root is not configured.\n" };
	}

	return { ok: true, plan: buildPlan({ scope, config, tasksRoot }), config, tasksRoot };
}
