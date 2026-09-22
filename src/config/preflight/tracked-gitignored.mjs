import { execFileSync } from "node:child_process";

const TRACKED_GITIGNORED_CHECK_ID = "tracked-gitignored";
const TRACKED_GITIGNORED_LABEL = "tracked gitignored paths";
const PREVIEW_LIMIT = 3;

/**
 * @typedef {object} TrackedGitignoredPathsResult
 * @property {string[]} paths Tracked paths that also match ignore patterns.
 * @property {string | null} error Non-null when the git query itself failed.
 */

/**
 * @typedef {object} TrackedGitignoredPreflightCheck
 * @property {"tracked-gitignored"} id
 * @property {true} ok Always advisory — this check never blocks preflight (#289).
 * @property {string} message
 * @property {true} [warning]
 * @property {{ paths: string[] }} [details]
 * @property {string} [suggestedCommand]
 */

/**
 * @typedef {object} TrackedGitignoredDoctorCheck
 * @property {"tracked gitignored paths"} label
 * @property {true} ok Always advisory — this check never increments issueCount (#289).
 * @property {true} [warning]
 * @property {string} detail
 * @property {string} [suggestedCommand]
 */

/**
 * @param {"tracked-gitignored"} id
 * @param {true} ok
 * @param {string} message
 * @param {Partial<Omit<TrackedGitignoredPreflightCheck, "id" | "ok" | "message">>} [extra]
 * @returns {TrackedGitignoredPreflightCheck}
 */
function makeCheck(id, ok, message, extra = {}) {
	return { id, ok, message, ...extra };
}

/**
 * List tracked files that also match .gitignore / exclude patterns (issue #289).
 *
 * Bare `git ls-files -i` is fatal on supported git versions ("ls-files -i must
 * be used with either -o or -c"), so `-c` is passed explicitly: the signal we
 * want is exactly "tracked AND ignore-matched". Files that were committed
 * before being ignored keep mutating in lane worktrees and can fail
 * DirtyWorktree after a PASS.
 *
 * @param {string} projectRoot
 * @returns {TrackedGitignoredPathsResult}
 */
export function listTrackedGitignoredPaths(projectRoot) {
	try {
		const output = execFileSync(
			"git",
			["ls-files", "-i", "-c", "--exclude-standard"],
			{
				cwd: projectRoot,
				encoding: "utf-8",
				stdio: ["ignore", "pipe", "pipe"],
				timeout: 5000,
			},
		).trim();
		const paths = output
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter(Boolean);
		return { paths, error: null };
	} catch (err) {
		return {
			paths: [],
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

/**
 * Bounded remediation command: untrack while keeping the working copy, letting
 * .gitignore keep it out of future commits (#289).
 *
 * @param {string[]} paths
 * @returns {string}
 */
export function trackedGitignoredRemediation(paths) {
	return `git rm -r --cached -- ${paths.slice(0, PREVIEW_LIMIT).join(" ")}`;
}

/**
 * @param {string[]} paths
 * @returns {string}
 */
function previewWithSuffix(paths) {
	const preview = paths.slice(0, PREVIEW_LIMIT).join(", ");
	const suffix =
		paths.length > PREVIEW_LIMIT ? ` +${paths.length - PREVIEW_LIMIT} more` : "";
	return `${preview}${suffix}`;
}

/**
 * Advisory preflight check (#289): warn when tracked paths also match
 * .gitignore. Non-blocking by default — operators may track such paths on
 * purpose, so the check never fails; it only suggests the untrack remediation.
 *
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @returns {TrackedGitignoredPreflightCheck}
 */
export function checkTrackedGitignoredWarn(ctx) {
	const { projectRoot } = ctx;
	const { paths, error } = listTrackedGitignoredPaths(projectRoot);

	if (error) {
		return makeCheck(
			TRACKED_GITIGNORED_CHECK_ID,
			true,
			`tracked gitignored check skipped: ${error}`,
		);
	}
	if (paths.length === 0) {
		return makeCheck(
			TRACKED_GITIGNORED_CHECK_ID,
			true,
			"no tracked files match .gitignore",
		);
	}

	return makeCheck(
		TRACKED_GITIGNORED_CHECK_ID,
		true,
		`${paths.length} tracked file(s) also match .gitignore (${previewWithSuffix(paths)}) — they mutate outside version control and can fail DirtyWorktree after PASS; untrack but keep working copies, relying on .gitignore`,
		{
			warning: true,
			details: { paths },
			suggestedCommand: trackedGitignoredRemediation(paths),
		},
	);
}

/**
 * Doctor advisory (#289) — same signal as checkTrackedGitignoredWarn, shaped
 * for doctor output ({label, ok, warning, detail, suggestedCommand}).
 *
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @returns {TrackedGitignoredDoctorCheck}
 */
export function buildTrackedGitignoredDoctorCheck(ctx) {
	const { projectRoot } = ctx;
	const { paths, error } = listTrackedGitignoredPaths(projectRoot);

	if (error) {
		return {
			label: TRACKED_GITIGNORED_LABEL,
			ok: true,
			detail: `skipped: ${error}`,
		};
	}
	if (paths.length === 0) {
		return {
			label: TRACKED_GITIGNORED_LABEL,
			ok: true,
			detail: "none",
		};
	}

	return {
		label: TRACKED_GITIGNORED_LABEL,
		ok: true,
		warning: true,
		detail:
			`${paths.length} tracked file(s) also match .gitignore (${previewWithSuffix(paths)}) — ` +
			"untrack but keep working copies, relying on .gitignore",
		suggestedCommand: trackedGitignoredRemediation(paths),
	};
}
