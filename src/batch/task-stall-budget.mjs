/**
 * Per-task stall timeout budget from PROMPT Size (SP-088).
 */

import fs from "node:fs";
import path from "node:path";
import { resolveStallConfig } from "./heartbeat.mjs";
import { parseSizeLineFromMarkdown } from "../tasks/packet/size-line.mjs";

/** Minimum stall timeout minutes by packet size (floor for real pi work). */
export const STALL_MINUTES_BY_SIZE = Object.freeze({
	S: 90,
	M: 180,
	L: 300,
});

/**
 * @param {string} markdown
 * @returns {"S"|"M"|"L"|"XL"|null}
 */
export function parseTaskSizeFromMarkdown(markdown) {
	return parseSizeLineFromMarkdown(markdown);
}

/**
 * @param {string} taskFolder
 * @returns {"S"|"M"|"L"|"XL"|null}
 */
export function parseTaskSizeFromFolder(taskFolder) {
	const promptPath = path.join(taskFolder, "PROMPT.md");
	if (!fs.existsSync(promptPath)) return null;
	return parseTaskSizeFromMarkdown(fs.readFileSync(promptPath, "utf-8"));
}

/**
 * @param {"S"|"M"|"L"|"XL"|null} size
 * @param {object} [config]
 * @param {{ stallTimeoutMinutes?: number | null }} [contract]
 */
export function resolveTaskStallMinutes(size, config = {}, contract = {}) {
	const configured = Number(config.lanes?.stallTimeoutMinutes);
	const configMinutes = Number.isFinite(configured) && configured > 0 ? configured : 60;
	const sizeMinutes =
		size && size in STALL_MINUTES_BY_SIZE
			? STALL_MINUTES_BY_SIZE[/** @type {keyof typeof STALL_MINUTES_BY_SIZE} */ (size)]
			: null;
	const baseMinutes = sizeMinutes ? Math.max(configMinutes, sizeMinutes) : configMinutes;
	const contractMinutes = Number(contract.stallTimeoutMinutes);
	if (Number.isFinite(contractMinutes) && contractMinutes > 0) {
		return Math.max(baseMinutes, contractMinutes);
	}
	return baseMinutes;
}

/**
 * @param {object} params
 * @param {object} [params.config]
 * @param {string|null} [params.taskSize]
 * @param {{ stallTimeoutMinutes?: number | null, extendGraceOnFileScope?: boolean | null }} [params.contract]
 */
export function resolveStallConfigForTask({ config = {}, taskSize = null, contract = {} }) {
	const stallTimeoutMinutes = resolveTaskStallMinutes(taskSize, config, contract);
	const lanes = {
		...(config.lanes ?? {}),
		stallTimeoutMinutes,
	};
	if (contract.extendGraceOnFileScope === true) {
		lanes.extendGraceOnFileScope = true;
	}
	return resolveStallConfig({
		...config,
		lanes,
	});
}

/** Implicit pi subprocess cap in `spine-worker-runner.mjs` when env unset (pre-SP-202). */
export const DEFAULT_PI_WORKER_TIMEOUT_MS = 60 * 60 * 1000;

/**
 * Pi `spawnSync` timeout aligned with per-task stall budget (SP-202).
 * Honors `SPINE_WORKER_PI_TIMEOUT_MS` when set in the parent environment.
 *
 * @param {object} params
 * @param {object} [params.config]
 * @param {"S"|"M"|"L"|"XL"|null} [params.taskSize]
 * @param {{ stallTimeoutMinutes?: number | null }} [params.contract]
 */
export function resolveWorkerPiTimeoutMs({ config = {}, taskSize = null, contract = {} }) {
	const envRaw = process.env.SPINE_WORKER_PI_TIMEOUT_MS;
	if (envRaw) {
		const parsed = Number(envRaw);
		if (Number.isFinite(parsed) && parsed > 0) {
			return parsed;
		}
	}
	const stallMinutes = resolveTaskStallMinutes(taskSize, config, contract);
	return stallMinutes * 60 * 1000;
}

/**
 * Reviewer `pi` spawn timeout aligned with per-task stall budget (SP-279).
 * Honors `SPINE_REVIEW_TIMEOUT_MS` when set in the parent environment.
 *
 * @param {object} params
 * @param {object} [params.config]
 * @param {"S"|"M"|"L"|"XL"|null} [params.taskSize]
 */
export function resolveReviewSpawnTimeoutMs({ config = {}, taskSize = null }) {
	const envRaw = process.env.SPINE_REVIEW_TIMEOUT_MS;
	if (envRaw) {
		const parsed = Number(envRaw);
		if (Number.isFinite(parsed) && parsed > 0) {
			return parsed;
		}
	}
	return resolveWorkerPiTimeoutMs({ config, taskSize });
}

/** Default poll interval while awaiting reviewer artifact (SP-294). */
export const DEFAULT_REVIEW_ARTIFACT_POLL_INTERVAL_MS = 5_000;

/** Upper bound for reviewer artifact poll interval. */
export const MAX_REVIEW_ARTIFACT_POLL_INTERVAL_MS = 30_000;

/** Default mtime quiescence before honoring an on-disk review artifact. */
export const DEFAULT_REVIEW_ARTIFACT_QUIESCENCE_MS = 2_000;

/**
 * Poll interval for early reviewer artifact honor (SP-294).
 * Honors `SPINE_REVIEW_ARTIFACT_POLL_MS` when set; capped at 30s.
 *
 * @param {object} [params]
 * @param {object} [params.config]
 */
export function resolveReviewArtifactPollIntervalMs({ config = {} } = {}) {
	const envRaw = process.env.SPINE_REVIEW_ARTIFACT_POLL_MS;
	if (envRaw) {
		const parsed = Number(envRaw);
		if (Number.isFinite(parsed) && parsed > 0) {
			return Math.min(parsed, MAX_REVIEW_ARTIFACT_POLL_INTERVAL_MS);
		}
	}
	const configured = Number(config.review?.artifactPollIntervalMs);
	if (Number.isFinite(configured) && configured > 0) {
		return Math.min(configured, MAX_REVIEW_ARTIFACT_POLL_INTERVAL_MS);
	}
	return DEFAULT_REVIEW_ARTIFACT_POLL_INTERVAL_MS;
}

/**
 * Mtime quiescence window before honoring reviewer artifact (SP-294).
 * Honors `SPINE_REVIEW_ARTIFACT_QUIESCENCE_MS` when set.
 *
 * @param {object} [params]
 * @param {object} [params.config]
 */
export function resolveReviewArtifactQuiescenceMs({ config = {} } = {}) {
	const envRaw = process.env.SPINE_REVIEW_ARTIFACT_QUIESCENCE_MS;
	if (envRaw) {
		const parsed = Number(envRaw);
		if (Number.isFinite(parsed) && parsed > 0) {
			return parsed;
		}
	}
	const configured = Number(config.review?.artifactQuiescenceMs);
	if (Number.isFinite(configured) && configured > 0) {
		return configured;
	}
	return DEFAULT_REVIEW_ARTIFACT_QUIESCENCE_MS;
}
