/**
 * Retry profile escalation decision (SP-836 / #340).
 */

/**
 * Failure classes (`task.exitReason`) that are content/contract failures: a stronger
 * profile can plausibly fix them (SP-836 / #340). Everything else — provider quota/403,
 * overload, launch, stall/orphan, `review_blocked`, reviewer spawn/provider errors — is a
 * provider/infra failure and must never escalate (#248, #329; quota uses
 * `agents.quotaFallbackProfile`).
 */
export const ESCALATION_ELIGIBLE_CLASSES = Object.freeze(["contract_failed", "review_exhausted"]);

/**
 * @param {unknown} value
 * @returns {string}
 */
function trimmedString(value) {
	return typeof value === "string" ? value.trim() : "";
}

/**
 * Decide the `task.profileOverride` for a retry (SP-836 / #340). Pure: reads the
 * failure class off the (not yet reset) task and the `agents` config.
 *
 * @param {object} params
 * @param {Record<string, any>} params.task Batch-state task row, before `resetTaskForRetry`.
 * @param {Record<string, any>|null} [params.config] Effective config.
 * @param {string|null} [params.profile] Operator `--profile` value.
 * @param {boolean} [params.noEscalate] Operator `--no-escalate`.
 * @returns {{ ok: true, profileOverride: string|null, escalation: "manual"|"auto"|null, apply: boolean }
 *   | { ok: false, error: string, output: string }}
 */
export function resolveRetryProfileOverride({ task, config = null, profile = null, noEscalate = false }) {
	const agents = config?.agents && typeof config.agents === "object" ? config.agents : {};
	const profiles = agents.profiles && typeof agents.profiles === "object" ? agents.profiles : {};
	const failureClass = trimmedString(task?.exitReason) || trimmedString(task?.classification);
	const eligible = ESCALATION_ELIGIBLE_CLASSES.includes(failureClass);
	const currentOverride = trimmedString(task?.profileOverride) || null;

	const requested = trimmedString(profile);
	if (profile != null) {
		const defined = Object.keys(profiles);
		if (requested === "" || !Object.hasOwn(profiles, requested)) {
			return {
				ok: false,
				error: "unknown_profile",
				output: `Unknown profile "${requested}". Defined profiles: ${defined.length > 0 ? defined.join(", ") : "(none)"}.\n`,
			};
		}
		if (!eligible) {
			const label = failureClass || "unknown";
			return {
				ok: false,
				error: "profile_ineligible",
				output:
					`--profile is for content/contract failures; ${label} is a provider/infra failure — ` +
					"use agents.quotaFallbackProfile or retry without --profile\n",
			};
		}
		return { ok: true, profileOverride: requested, escalation: "manual", apply: true };
	}

	const policy = agents.escalatePolicy;
	const target = trimmedString(policy?.toProfile);
	if (
		noEscalate ||
		!eligible ||
		policy?.enabled !== true ||
		target === "" ||
		!Object.hasOwn(profiles, target) ||
		currentOverride === target
	) {
		return { ok: true, profileOverride: currentOverride, escalation: null, apply: false };
	}
	return { ok: true, profileOverride: target, escalation: "auto", apply: true };
}
