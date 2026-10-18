/**
 * Per-task agent context for engine reviews (SP-834 / #355).
 *
 * Engine review spawns used the batch-wide `config` loaded at engine start. This module
 * resolves, per task, the worker profile in effect (PROMPT `**Profile:**`, quota fallback
 * hop, `agents.activeProfile`) and the reviewer chosen by `resolveEffectiveReviewer`
 * (SP-832), then hands the review phases a config whose `agents.reviewer` carries those
 * pins. `resolveTaskWorkerProfile` and `buildTaskReviewConfig` are pure;
 * `applyTaskReviewProfile` adds the I/O (PROMPT load, journal, runtime family guard).
 */

import { resolveEffectiveReviewer } from "../../config/agent-model-resolve.mjs";
import { resolvePoolId } from "../../metrics/quota-snapshot.mjs";
import { loadTaskPacket } from "../../tasks/packet/index.mjs";
import { appendJournalEvent } from "../journal.mjs";
import { saveEngineBatchState } from "../pause.mjs";
import { readReviewLevel } from "../review.mjs";
import { isReviewTypeRequired, shouldRunCodeReview, shouldRunFinalReview } from "../review-shared.mjs";
import { recomputeTaskCounters, updateSegmentForTask } from "../state.mjs";
import { recordLaneTaskMetric } from "./queue.mjs";
import { loadQuotaFallbackForWorker } from "./quota-fallback-state.mjs";

/** @type {readonly ("plan"|"code"|"final")[]} */
const REVIEW_TYPES = ["plan", "code", "final"];

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function nonEmpty(value) {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed === "" ? null : trimmed;
}

/**
 * @param {Record<string, any>} agents
 * @param {string|null} profile
 * @returns {{ model: string|null, thinking: string|null }}
 */
function pickWorkerPins(agents, profile) {
	const profiles = agents?.profiles && typeof agents.profiles === "object" ? agents.profiles : {};
	const named = profile && Object.hasOwn(profiles, profile) ? profiles[profile]?.worker : undefined;
	return {
		model: nonEmpty(named?.model) ?? nonEmpty(agents?.worker?.model),
		thinking: nonEmpty(named?.thinking) ?? nonEmpty(agents?.worker?.thinking),
	};
}

/**
 * Worker profile / model / thinking in effect for one task.
 *
 * Order: active quota fallback hop (when its `exhaustedPool` is the pool of the task's own
 * worker model), then `prompt.profile`, then `agents.activeProfile`. `model` / `thinking`
 * come from `agents.profiles[profile].worker`, falling back to `agents.worker`.
 *
 * Pure: no I/O.
 *
 * @param {object} params
 * @param {Record<string, any>} [params.config]
 * @param {{ profile?: string|null }|null} [params.prompt] Parsed PROMPT (SP-833).
 * @param {{ toProfile?: string, exhaustedPool?: string }|null} [params.quotaFallback] `state.resilience.quotaFallback`.
 * @returns {{ profile: string|null, model: string|null, thinking: string|null, source: "quota_fallback"|"prompt.profile"|"agents.activeProfile"|"none" }}
 */
export function resolveTaskWorkerProfile({ config, prompt = null, quotaFallback = null } = {}) {
	const agents = config?.agents ?? {};
	const promptProfile = nonEmpty(prompt?.profile);
	const activeProfile = nonEmpty(agents.activeProfile);
	const ownProfile = promptProfile ?? activeProfile;
	const ownSource = promptProfile ? "prompt.profile" : activeProfile ? "agents.activeProfile" : "none";

	const hopProfile = nonEmpty(quotaFallback?.toProfile);
	const hopPool = nonEmpty(quotaFallback?.exhaustedPool);
	if (hopProfile && hopPool) {
		const own = pickWorkerPins(agents, ownProfile);
		if (resolvePoolId(own.model ?? undefined) === hopPool) {
			return { profile: hopProfile, ...pickWorkerPins(agents, hopProfile), source: "quota_fallback" };
		}
	}
	return { profile: ownProfile, ...pickWorkerPins(agents, ownProfile), source: ownSource };
}

/**
 * Clone `config` with `agents.reviewer` replaced by the effective per-type reviewer pins.
 * `null` pins become `"inherit"`, which `resolveReviewerModelPin` reads back as `null`.
 *
 * Pure: no I/O, never mutates `config`.
 *
 * @param {object} params
 * @param {Record<string, any>} [params.config]
 * @param {{ reviewerProfile?: string|null }|null} [params.prompt] Parsed PROMPT (SP-833).
 * @param {{ profile?: string|null, model?: string|null }} [params.workerContext] From `resolveTaskWorkerProfile`.
 * @returns {{
 *   config: Record<string, any>,
 *   reviewer: ReturnType<typeof resolveEffectiveReviewer>,
 *   blocked: ReturnType<typeof resolveEffectiveReviewer>["blocked"],
 *   warnings: string[],
 * }}
 */
export function buildTaskReviewConfig({ config, prompt = null, workerContext = {} } = {}) {
	const base = config ?? {};
	const reviewer = resolveEffectiveReviewer(base, {
		promptReviewerProfile: prompt?.reviewerProfile ?? null,
		workerProfile: workerContext.profile ?? null,
		workerModel: workerContext.model ?? null,
	});

	/** @type {Record<string, any>} */
	let reviewConfig;
	try {
		reviewConfig = structuredClone(base);
	} catch {
		reviewConfig = { ...base, agents: { ...(base.agents ?? {}) } };
	}

	/** @type {Record<string, any>} */
	const pins = {};
	for (const reviewType of REVIEW_TYPES) {
		pins[reviewType] = {
			model: reviewer[reviewType].model ?? "inherit",
			thinking: reviewer[reviewType].thinking ?? "inherit",
		};
	}
	const common = (/** @type {"model"|"thinking"} */ key) =>
		pins.plan[key] === pins.code[key] && pins.code[key] === pins.final[key] ? pins.plan[key] : "inherit";
	const originalReviewer =
		reviewConfig.agents?.reviewer && typeof reviewConfig.agents.reviewer === "object"
			? reviewConfig.agents.reviewer
			: {};
	reviewConfig.agents = {
		...(reviewConfig.agents ?? {}),
		reviewer: { ...originalReviewer, model: common("model"), thinking: common("thinking"), ...pins },
	};

	return { config: reviewConfig, reviewer, blocked: reviewer.blocked, warnings: reviewer.warnings };
}

/**
 * @param {string} taskFolder
 * @returns {Record<string, any>|null}
 */
function loadPromptSafely(taskFolder) {
	try {
		return loadTaskPacket(taskFolder).prompt ?? null;
	} catch {
		return null;
	}
}

/**
 * Resolve the per-task review config for the engine / resume review phases, journal the
 * resolution once, and enforce the runtime family guard: a blocked review type that will
 * run fails the task (`review_blocked`) before any reviewer spawns.
 *
 * @param {Record<string, any>} params Review-phase params bag (`projectRoot`, `state`,
 *   `batchId`, `config`, `task`, `lane`, `taskFolderInWorktree`, `laneCorrelationId`).
 * @returns {Promise<{ ok: true, config: Record<string, any> } | { ok: false, error: string, output: string, reviewBlocked: true }>}
 */
export async function applyTaskReviewProfile(params) {
	const { projectRoot, state, batchId, config, task, lane, taskFolderInWorktree, laneCorrelationId } = params;
	const taskId = task?.taskId;
	if (!taskFolderInWorktree || !taskId) return { ok: true, config };

	const prompt = loadPromptSafely(taskFolderInWorktree);
	const quotaFallback =
		state?.resilience?.quotaFallback ?? loadQuotaFallbackForWorker({ projectRoot, batchId });
	const workerContext = resolveTaskWorkerProfile({ config, prompt, quotaFallback });
	const built = buildTaskReviewConfig({ config, prompt, workerContext });

	const meta = {
		taskId,
		laneNumber: lane?.laneNumber,
		laneId: lane?.laneId,
		correlationId: laneCorrelationId,
	};
	const summarize = (/** @type {"plan"|"code"|"final"} */ reviewType) => ({
		model: built.reviewer[reviewType].model,
		thinking: built.reviewer[reviewType].thinking,
		profile: built.reviewer[reviewType].profile,
		source: built.reviewer[reviewType].source,
	});
	appendJournalEvent(projectRoot, batchId, "review.reviewer_resolved", {
		...meta,
		plan: summarize("plan"),
		code: summarize("code"),
		final: summarize("final"),
		warnings: built.warnings,
	});

	const reviewLevel = readReviewLevel(taskFolderInWorktree);
	/** @type {Record<"plan"|"code"|"final", boolean>} */
	const willRun = {
		plan: isReviewTypeRequired(reviewLevel, "plan"),
		code: shouldRunCodeReview({ reviewLevel }),
		final: shouldRunFinalReview({ config, reviewLevel }),
	};
	/** @type {Array<{ reviewType: "plan"|"code"|"final", reason: string }>} */
	const blocking = [];
	for (const reviewType of REVIEW_TYPES) {
		const entry = built.blocked.find((candidate) => candidate.reviewType === reviewType);
		if (entry && willRun[reviewType]) blocking.push(entry);
	}
	if (blocking.length === 0) return { ok: true, config: built.config };

	const workerProfileLabel = workerContext.profile ?? "<workerProfile>";
	const fix =
		`set agents.profiles.${workerProfileLabel}.reviewerProfile or agents.reviewerProfile ` +
		"to a profile from another model family";
	for (const { reviewType, reason } of blocking) {
		appendJournalEvent(projectRoot, batchId, "review.blocked", {
			...meta,
			reviewType,
			reason,
			workerModel: workerContext.model,
			reviewerModel: built.reviewer[reviewType].model,
		});
	}
	const first = blocking[0];
	const exitReason = `${first.reviewType}_review_blocked`;
	const output =
		`${first.reviewType} review blocked (${first.reason}): worker "${workerContext.model ?? "inherit"}" ` +
		`and reviewer "${built.reviewer[first.reviewType].model ?? "inherit"}" cannot be paired; ${fix}`;

	task.status = "failed";
	task.endedAt = Date.now();
	task.exitReason = exitReason;
	updateSegmentForTask(state, taskId, "failed");
	recomputeTaskCounters(state);
	await saveEngineBatchState(projectRoot, state);
	appendJournalEvent(projectRoot, batchId, "task.failed", {
		...meta,
		classification: "review_blocked",
		exitCode: 1,
		output,
	});
	recordLaneTaskMetric({ projectRoot, batchId, task, config, taskFolder: taskFolderInWorktree });
	return { ok: false, error: exitReason, output, reviewBlocked: true };
}
