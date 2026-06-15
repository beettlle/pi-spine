/**
 * Review-type-specific scope paths for reviewer Cursor rule glob matching (SP-249).
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parsePrompt } from "../tasks/packet/parse-prompt.mjs";

/**
 * Paths excluded from reviewer glob scope (runtime artifacts, not product code).
 * @param {string} filePath
 */
export function isNoiseReviewScopePath(filePath) {
	const normalized = String(filePath ?? "")
		.replace(/\\/g, "/")
		.replace(/^\.\/+/, "");

	if (normalized === ".DONE" || normalized.endsWith("/.DONE")) {
		return true;
	}
	if (normalized.includes("/.reviews/") || normalized.startsWith(".reviews/")) {
		return true;
	}
	if (normalized.includes("/.spine/runtime/") || normalized.startsWith(".spine/runtime/")) {
		return true;
	}
	return false;
}

/**
 * @param {string[]} paths
 * @returns {string[]}
 */
export function filterReviewScopeNoise(paths) {
	if (!Array.isArray(paths)) {
		return [];
	}
	const filtered = [];
	const seen = new Set();
	for (const raw of paths) {
		const trimmed = String(raw ?? "").trim();
		if (!trimmed || isNoiseReviewScopePath(trimmed)) {
			continue;
		}
		if (seen.has(trimmed)) {
			continue;
		}
		seen.add(trimmed);
		filtered.push(trimmed);
	}
	return filtered;
}

/**
 * @param {string} taskFolder
 * @returns {string[]}
 */
export function resolvePlanReviewScopePaths(taskFolder) {
	const promptPath = path.join(taskFolder, "PROMPT.md");
	if (!fs.existsSync(promptPath)) {
		return [];
	}
	const markdown = fs.readFileSync(promptPath, "utf-8");
	const parsed = parsePrompt(markdown);
	return filterReviewScopeNoise(parsed.fileScope ?? []);
}

/**
 * @param {string} worktreePath
 * @param {string} [baseline]
 * @param {(command: string, args: string[], cwd: string) => string} [runGit]
 * @returns {string[]}
 */
export function resolveCodeReviewScopePaths(worktreePath, baseline, runGit = defaultRunGit) {
	const args = baseline ? ["diff", "--name-only", `${baseline}..HEAD`] : ["diff", "--name-only"];
	try {
		const output = runGit("git", args, worktreePath);
		const paths = output
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter(Boolean);
		return filterReviewScopeNoise(paths);
	} catch {
		return [];
	}
}

/**
 * @param {string} command
 * @param {string[]} args
 * @param {string} cwd
 */
function defaultRunGit(command, args, cwd) {
	return execFileSync(command, args, {
		cwd,
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "pipe"],
	});
}

/**
 * Resolve scope paths for reviewer rule glob matching by review phase.
 *
 * @param {object} params
 * @param {string} params.worktreePath Git worktree root for code reviews
 * @param {string} [params.baseline] Baseline commit for code review diff (optional)
 * @param {"plan"|"code"|"final"} params.reviewType Review phase
 * @param {string} params.taskFolder Absolute path to task packet folder
 * @param {(command: string, args: string[], cwd: string) => string} [params.runGit] Injectable git runner for tests
 * @returns {{ scopePaths: string[] }}
 */
export function resolveReviewScopePaths({
	worktreePath,
	baseline,
	reviewType,
	taskFolder,
	runGit,
}) {
	/** @type {string[]} */
	let scopePaths;
	switch (reviewType) {
		case "plan":
			scopePaths = resolvePlanReviewScopePaths(taskFolder);
			break;
		case "code":
			scopePaths = resolveCodeReviewScopePaths(worktreePath, baseline, runGit);
			break;
		case "final":
			scopePaths = [];
			break;
		default:
			scopePaths = [];
	}
	return { scopePaths };
}
