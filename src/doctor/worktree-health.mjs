// @ts-nocheck
/**
 * Doctor checks for lane worktree / devcontainer health (FR-REL-11, SP-101–105).
 */

import fs from "node:fs";
import path from "node:path";
import { ensureDefaultPiSpineRootEnv } from "../config/pi-spine-root.mjs";

/**
 * @param {string} gitFilePath
 * @returns {string|null}
 */
function readGitdirPointer(gitFilePath) {
	if (!fs.existsSync(gitFilePath)) return null;
	const content = fs.readFileSync(gitFilePath, "utf-8").trim();
	const match = content.match(/^gitdir:\s*(.+)$/m);
	return match ? match[1].trim() : null;
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {object} [params.config]
 */
export function buildWorktreeHealthDoctorCheck({ projectRoot, config = {} }) {
	const worktreesRoot = path.join(projectRoot, ".worktrees");
	if (!fs.existsSync(worktreesRoot)) {
		return {
			label: "lane worktree health",
			ok: true,
			detail: "no .worktrees/ yet",
		};
	}

	/** @type {string[]} */
	const issues = [];
	const entries = fs.readdirSync(worktreesRoot, { withFileTypes: true });
	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		const batchDir = path.join(worktreesRoot, entry.name);
		const laneDirs = fs.readdirSync(batchDir, { withFileTypes: true });
		for (const lane of laneDirs) {
			if (!lane.isDirectory() || !lane.name.startsWith("lane-")) continue;
			const gitFile = path.join(batchDir, lane.name, ".git");
			const gitdir = readGitdirPointer(gitFile);
			if (gitdir && path.isAbsolute(gitdir)) {
				issues.push(`${entry.name}/${lane.name}: absolute gitdir`);
			}
		}
	}

	const hook = config.worktreeSetupHook;
	const hookConfigured = typeof hook === "string" && hook.trim().length > 0;
	// CLI defaults unset PI_SPINE_ROOT to cwd (SP-643); apply here so doctor
	// library callers get the same behavior without requiring bin/spine.mjs.
	ensureDefaultPiSpineRootEnv();
	if (!process.env.PI_SPINE_ROOT && hookConfigured) {
		issues.push("PI_SPINE_ROOT unset with worktreeSetupHook configured");
	}

	if (issues.length === 0) {
		return {
			label: "lane worktree health",
			ok: true,
			detail: "relative gitdir pointers; PI_SPINE_ROOT ok",
		};
	}

	return {
		label: "lane worktree health",
		ok: false,
		detail: issues.slice(0, 3).join("; "),
		suggestion: "spine doctor; see docs/incidents/20260605-lane-worktree-devcontainer.md",
	};
}
