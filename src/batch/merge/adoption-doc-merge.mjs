/**
 * Safe auto-merge for additive conflicts in docs/adoption/* during lane→orch wave merge.
 * @see GitHub #14 — serial README wave tasks overlapping operator-runbook.md
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { gitExec } from "../git-exec.mjs";

export const ADOPTION_DOC_PREFIX = "docs/adoption/";

/**
 * @param {string} filePath
 */
export function isAdoptionDocPath(filePath) {
	const normalized = String(filePath ?? "").replace(/\\/g, "/");
	return normalized.startsWith(ADOPTION_DOC_PREFIX);
}

/**
 * @param {string} projectRoot
 * @param {string} filePath
 * @param {1 | 2 | 3} stage
 */
function readMergeStageContent(projectRoot, filePath, stage) {
	const output = gitExec(
		projectRoot,
		["show", `:${stage}:${filePath}`],
		{ throwOnError: false, projectRoot },
	);
	if (output == null) {
		return null;
	}
	return output;
}

/**
 * @param {string} ours
 * @param {string} base
 * @param {string} theirs
 */
function runGitMergeFile(ours, base, theirs) {
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "spine-adoption-merge-"));
	const oursPath = path.join(tempDir, "ours");
	const basePath = path.join(tempDir, "base");
	const theirsPath = path.join(tempDir, "theirs");
	try {
		fs.writeFileSync(oursPath, ours, "utf-8");
		fs.writeFileSync(basePath, base, "utf-8");
		fs.writeFileSync(theirsPath, theirs, "utf-8");
		let merged = "";
		let exitCode = 0;
		try {
			merged = execFileSync("git", ["merge-file", "-p", oursPath, basePath, theirsPath], {
				encoding: "utf-8",
				stdio: ["ignore", "pipe", "pipe"],
			});
		} catch (err) {
			const execErr = /** @type {NodeJS.ErrnoException & { status?: number, stdout?: string }} */ (err);
			exitCode = Number(execErr.status ?? 1);
			merged = String(execErr.stdout ?? "");
		}
		return { exitCode, merged };
	} finally {
		fs.rmSync(tempDir, { recursive: true, force: true });
	}
}

/**
 * @param {string} merged
 * @returns {string[]}
 */
function extractConflictHunkLabels(merged) {
	const labels = [];
	const pattern = /^<<<<<<< (.+)$/gm;
	for (const match of merged.matchAll(pattern)) {
		if (match[1]) labels.push(match[1].trim());
	}
	return labels;
}

/**
 * @param {object} params
 * @param {string} params.filePath
 * @param {number} [params.waveIndex]
 * @param {string[]} [params.conflictHunks]
 */
export function formatAdoptionDocMergeFailure({ filePath, waveIndex, conflictHunks = [] }) {
	const lines = [
		`merge conflict on ${filePath} — adoption doc hunks could not be auto-merged safely`,
	];
	if (conflictHunks.length > 0) {
		lines.push(`Conflicting hunks: ${conflictHunks.join(", ")}`);
	}
	lines.push(
		"Recovery: resolve conflicts in the lane worktree, commit on the lane branch, then `spine batch resume`",
	);
	if (waveIndex != null && Number.isFinite(waveIndex)) {
		lines.push(
			`Mixed-outcome override only: \`spine batch force-merge --wave ${waveIndex}\` then \`spine batch resume --force\``,
		);
	}
	lines.push(
		"Manual merge path: docs/adoption/operator-runbook.md § Lane merge conflicts; design: docs/design/integrate-conflict-recovery.md",
	);
	return lines.join("\n");
}

/**
 * Attempt 3-way merge for docs/adoption/* using git merge-file (non-overlapping additive edits).
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.filePath
 * @param {number} [params.waveIndex]
 */
export function tryResolveAdoptionDocMergeConflict({ projectRoot, filePath, waveIndex }) {
	if (!isAdoptionDocPath(filePath)) {
		return { ok: false, reason: "not_adoption_doc" };
	}

	const base = readMergeStageContent(projectRoot, filePath, 1);
	const ours = readMergeStageContent(projectRoot, filePath, 2);
	const theirs = readMergeStageContent(projectRoot, filePath, 3);
	if (base == null || ours == null || theirs == null) {
		return {
			ok: false,
			failureClass: "MergeConflict",
			error: formatAdoptionDocMergeFailure({
				filePath,
				waveIndex,
				conflictHunks: ["missing merge stages"],
			}),
		};
	}

	const { exitCode, merged } = runGitMergeFile(ours, base, theirs);
	if (exitCode !== 0) {
		const conflictHunks = extractConflictHunkLabels(merged);
		return {
			ok: false,
			failureClass: "MergeConflict",
			error: formatAdoptionDocMergeFailure({ filePath, waveIndex, conflictHunks }),
			conflictHunks,
		};
	}

	const absPath = path.join(projectRoot, filePath);
	fs.mkdirSync(path.dirname(absPath), { recursive: true });
	fs.writeFileSync(absPath, merged, "utf-8");
	gitExec(projectRoot, ["add", "--", filePath], { projectRoot });
	return {
		ok: true,
		autoResolved: true,
		strategy: "adoption_doc_merge_file",
		filePath,
	};
}
