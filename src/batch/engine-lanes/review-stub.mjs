// @ts-nocheck
/**
 * Engine lane review stub verdict queues (SP-728 / #262).
 *
 * Stub verdicts come from env (`SPINE_ENGINE_*_STUB_VERDICTS` comma-separated
 * queues or the singular `SPINE_ENGINE_*_STUB_VERDICT`), but the queue is
 * materialized once into an in-memory array and popped via function params —
 * `process.env` is read, never mutated. This keeps stub state safe when
 * multiple lanes run review phases in the same process.
 */

import fs from "node:fs";
import path from "node:path";
import {
	normalizeCodeVerdict,
	normalizeFinalVerdict,
} from "../review-shared.mjs";

/**
 * Whether engine reviews should use stub verdicts instead of spawning a
 * reviewer. Shared by the plan, code, and final engine review entry points.
 *
 * @param {NodeJS.ProcessEnv} [env]
 */
export function shouldUseReviewStub(env = process.env) {
	return (
		env.SPINE_REVIEW_STUB === "1" ||
		env.SPINE_REVIEW_STUB === "true" ||
		env.SPINE_WORKER_STUB === "1"
	);
}

/**
 * Create an in-memory stub verdict queue. `next()` pops the head entry while
 * entries remain, then falls back to `singleValue`, then `defaultVerdict`.
 * Every result is passed through `normalize`; unrecognized entries fall back
 * to `defaultVerdict`. Pure — no env reads or writes.
 *
 * @param {object} params
 * @param {string} [params.queueValue] Raw comma-separated queue value.
 * @param {string} [params.singleValue] Single-verdict fallback value.
 * @param {(raw: string) => string|null} params.normalize Verdict normalizer.
 * @param {string} params.defaultVerdict Fallback when nothing else resolves.
 */
export function createStubVerdictQueue({ queueValue, singleValue, normalize, defaultVerdict }) {
	const entries = String(queueValue ?? "")
		.split(",")
		.map((entry) => entry.trim())
		.filter(Boolean);
	let index = 0;
	return {
		next() {
			const raw = index < entries.length ? entries[index++] : (singleValue ?? defaultVerdict);
			return normalize(raw) ?? defaultVerdict;
		},
		get remaining() {
			return entries.length - index;
		},
	};
}

/**
 * Read a stub verdict queue from env once and return the in-memory queue.
 * Reads `env[queueEnv]` / `env[singleEnv]` a single time; subsequent pops
 * mutate only the returned queue, never `process.env`.
 *
 * @param {object} params
 * @param {string} params.queueEnv Env var holding the comma-separated queue.
 * @param {string} params.singleEnv Env var holding the single-verdict fallback.
 * @param {(raw: string) => string|null} params.normalize Verdict normalizer.
 * @param {string} params.defaultVerdict Fallback when nothing else resolves.
 * @param {NodeJS.ProcessEnv} [env]
 */
export function createStubVerdictQueueFromEnv({
	queueEnv,
	singleEnv,
	normalize,
	defaultVerdict,
	env = process.env,
}) {
	return createStubVerdictQueue({
		queueValue: env[queueEnv],
		singleValue: env[singleEnv],
		normalize,
		defaultVerdict,
	});
}

/**
 * Build the in-memory stub verdict queue for a review phase (SP-728 / #262).
 * Env is read once here; the queue is passed down via params and popped
 * in-memory — `process.env` is never mutated.
 *
 * @param {"plan"|"code"|"final"} reviewType
 */
export function createPhaseStubVerdictQueue(reviewType) {
	if (reviewType === "final") {
		return createStubVerdictQueueFromEnv({
			queueEnv: "SPINE_ENGINE_FINAL_STUB_VERDICTS",
			singleEnv: "SPINE_ENGINE_FINAL_STUB_VERDICT",
			normalize: normalizeFinalVerdict,
			defaultVerdict: "PASS",
		});
	}
	if (reviewType === "plan") {
		return createStubVerdictQueueFromEnv({
			queueEnv: "SPINE_ENGINE_PLAN_STUB_VERDICTS",
			singleEnv: "SPINE_ENGINE_PLAN_STUB_VERDICT",
			normalize: normalizeCodeVerdict,
			defaultVerdict: "APPROVE",
		});
	}
	return createStubVerdictQueueFromEnv({
		queueEnv: "SPINE_ENGINE_CODE_STUB_VERDICTS",
		singleEnv: "SPINE_ENGINE_CODE_STUB_VERDICT",
		normalize: normalizeCodeVerdict,
		defaultVerdict: "APPROVE",
	});
}

/**
 * Write a stub review artifact markdown body (verdict heading + JSON block).
 *
 * @param {object} params
 * @param {string} params.artifactPath
 * @param {string} params.title Artifact heading, e.g. "Final Review".
 * @param {string} params.verdict
 * @param {string} params.feedback
 */
export function writeStubReviewArtifact({ artifactPath, title, verdict, feedback }) {
	fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
	const body = [
		`## ${title}`,
		"",
		`### Verdict: ${verdict}`,
		"",
		"### Summary",
		feedback,
		"",
		"```json",
		JSON.stringify({ verdict, feedback }, null, 2),
		"```",
		"",
	].join("\n");
	fs.writeFileSync(artifactPath, body, "utf-8");
}
