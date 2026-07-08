/**
 * Attached batch orphan risk advisory (GitHub #163, SP-518).
 *
 * When the parent shell backgrounds or exits (SIGKILL / exit 137), an attached
 * engine is orphaned. Doctor warns in non-interactive and agent-harness contexts.
 */

/** @typedef {{ id: string, label: string }} AttachedOrphanRiskPattern */

/** @type {ReadonlyArray<{ env: string, match?: (value: string) => boolean, id: string, label: string }>} */
const AUTOMATION_ENV_PATTERNS = [
	{
		env: "SPINE_IS_WORKER",
		match: (value) => value === "1" || value === "true",
		id: "spine_worker_context",
		label: "SPINE_IS_WORKER set (lane worker session)",
	},
	{
		env: "SPINE_WORKER_RUNNER",
		match: (value) => value.trim().length > 0,
		id: "pi_worker_runner",
		label: "SPINE_WORKER_RUNNER set (pi worker harness)",
	},
	{
		env: "CI",
		match: (value) => value === "1" || value === "true" || value.length > 0,
		id: "ci_environment",
		label: "CI environment",
	},
	{ env: "GITHUB_ACTIONS", id: "github_actions", label: "GitHub Actions runner" },
	{ env: "GITLAB_CI", id: "gitlab_ci", label: "GitLab CI runner" },
	{ env: "JENKINS_URL", id: "jenkins", label: "Jenkins runner" },
	{ env: "BUILDKITE", id: "buildkite", label: "Buildkite runner" },
	{ env: "CURSOR_TRACE_ID", id: "cursor_agent_shell", label: "Cursor agent shell" },
	{ env: "CURSOR_SESSION_ID", id: "cursor_agent_shell", label: "Cursor agent shell" },
];

export const DETACHED_RESUME_SUGGESTED =
	"spine batch start|resume (omit --attached); spine wait --until completed,needs_integrate,failed,aborted --timeout 2h";

/**
 * @param {object} [options]
 * @param {boolean} [options.stdinIsTTY]
 * @param {NodeJS.ProcessEnv} [options.env]
 * @returns {{ risky: boolean, patterns: AttachedOrphanRiskPattern[] }}
 */
export function detectAttachedOrphanRiskPatterns({
	stdinIsTTY = process.stdin.isTTY === true,
	env = process.env,
} = {}) {
	/** @type {AttachedOrphanRiskPattern[]} */
	const patterns = [];
	/** @type {Set<string>} */
	const seen = new Set();

	if (!stdinIsTTY) {
		patterns.push({
			id: "non_interactive_shell",
			label: "stdin is not a TTY (background or piped shell)",
		});
		seen.add("non_interactive_shell");
	}

	for (const entry of AUTOMATION_ENV_PATTERNS) {
		const raw = env[entry.env];
		if (raw === undefined || raw === "") {
			continue;
		}
		if (entry.match && !entry.match(String(raw))) {
			continue;
		}
		if (seen.has(entry.id)) {
			continue;
		}
		seen.add(entry.id);
		patterns.push({ id: entry.id, label: entry.label });
	}

	return {
		risky: patterns.length > 0,
		patterns,
	};
}

/**
 * Fail-fast guard for `batch start|resume --attached` in risky shell contexts (SP-539 / #163).
 *
 * @param {object} [options]
 * @param {boolean} [options.stdinIsTTY]
 * @param {NodeJS.ProcessEnv} [options.env]
 */
export function enforceAttachedOrphanRiskGuard({
	stdinIsTTY = process.stdin.isTTY === true,
	env = process.env,
} = {}) {
	if (env.SPINE_ALLOW_ATTACHED_HARNESS === "1") {
		return { ok: true };
	}

	const { risky, patterns } = detectAttachedOrphanRiskPatterns({ stdinIsTTY, env });
	if (!risky) {
		return { ok: true };
	}

	const summary = patterns.map((pattern) => pattern.label).join("; ");
	return {
		ok: false,
		exitCode: 1,
		error: "attached_orphan_risk",
		output:
			`Refusing batch --attached in a risky shell context (#163).\n` +
			`${summary}\n\n` +
			`Parent shell exit orphans attached engines (exit 137). Use detached start instead:\n` +
			`  ${DETACHED_RESUME_SUGGESTED}\n`,
		patterns,
	};
}

/**
 * Doctor advisory for attached orphan risk (#163 partial mitigation).
 *
 * @param {object} [options]
 * @param {boolean} [options.stdinIsTTY]
 * @param {NodeJS.ProcessEnv} [options.env]
 */
export function buildAttachedOrphanRiskDoctorCheck({
	stdinIsTTY = process.stdin.isTTY === true,
	env = process.env,
} = {}) {
	const { risky, patterns } = detectAttachedOrphanRiskPatterns({ stdinIsTTY, env });

	if (!risky) {
		return {
			label: "batch --attached orphan risk (#163)",
			ok: true,
			detail: "interactive terminal — keep --attached in foreground for full batch duration",
		};
	}

	const summary = patterns.map((pattern) => pattern.label).join("; ");
	return {
		label: "batch --attached orphan risk (#163)",
		ok: true,
		warning: true,
		detail: `${summary} — parent shell exit orphans attached engine (exit 137)`,
		suggestedCommand: DETACHED_RESUME_SUGGESTED,
	};
}
