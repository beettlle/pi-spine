/**
 * Documented `PATH="…"` prefix for gate evidence commands (SP-710 / #254).
 * Bounded allowlist only — no general shell variable expansion.
 */

import os from "node:os";
import path from "node:path";
import { EvidenceCommandError } from "./evidence-command-error.mjs";

/**
 * Documented `PATH="…"` segment prefix. Only the double-quoted assignment form
 * at the start of a segment is recognized; every colon-separated entry must
 * pass {@link isAllowedEvidencePathEntry}.
 */
const PATH_PREFIX_PATTERN = /^PATH="([^"]*)"(\s+|$)/;

/** Charset for a safe PATH entry (no whitespace, shell metacharacters, or `~`). */
const SAFE_PATH_ENTRY_PATTERN = /^[A-Za-z0-9._/-]+$/;

/**
 * Bounded allowlist for `PATH="…"` prefix entries:
 * - literal `$PATH` (preserve the inherited lookup path),
 * - `$HOME/<relative>` toolchain dirs such as `$HOME/.cargo/bin`,
 * - project-relative paths such as `node_modules/.bin` (resolved against the
 *   evidence cwd, never absolute and never traversing `..`).
 * Any other `$` expansion, absolute path, or parent traversal is rejected so the
 * prefix cannot widen into general shell variable expansion.
 *
 * @param {string} entry
 * @returns {boolean}
 */
export function isAllowedEvidencePathEntry(entry) {
	if (entry === "$PATH") {
		return true;
	}
	if (entry.startsWith("$HOME/")) {
		return isSafeRelativePathEntry(entry.slice("$HOME/".length));
	}
	if (entry.includes("$")) {
		return false;
	}
	return isSafeRelativePathEntry(entry);
}

/**
 * @param {string} relativePath
 * @returns {boolean}
 */
function isSafeRelativePathEntry(relativePath) {
	if (!relativePath || !SAFE_PATH_ENTRY_PATTERN.test(relativePath)) {
		return false;
	}
	if (path.posix.isAbsolute(relativePath) || /^[A-Za-z]:/.test(relativePath)) {
		return false;
	}
	return !relativePath.split("/").some((segment) => segment === "..");
}

/**
 * Split a validated `PATH="…"` prefix off the start of a chain segment.
 * Returns the raw colon-separated entries plus the remaining command text.
 *
 * @param {string} segment
 * @returns {{ pathEntries: string[], rest: string }}
 */
export function splitEvidencePathPrefix(segment) {
	const match = segment.match(PATH_PREFIX_PATTERN);
	if (!match) {
		return { pathEntries: [], rest: segment };
	}
	const pathEntries = match[1].split(":");
	for (const entry of pathEntries) {
		if (!isAllowedEvidencePathEntry(entry)) {
			throw new EvidenceCommandError(
				`evidence PATH prefix entry not allowed: ${entry}`,
			);
		}
	}
	const rest = segment.slice(match[0].length).trim();
	if (!rest) {
		throw new EvidenceCommandError("evidence PATH prefix without a command");
	}
	return { pathEntries, rest };
}

/**
 * Expand validated PATH prefix entries into concrete directories (no shell).
 * `$HOME` maps to `os.homedir()`, `$PATH` splices the inherited lookup path,
 * and project-relative entries stay relative to the evidence cwd.
 *
 * @param {string[]} entries
 * @returns {string[]}
 */
export function expandEvidencePathEntries(entries) {
	/** @type {string[]} */
	const expanded = [];
	for (const entry of entries) {
		if (entry === "$PATH") {
			if (process.env.PATH) {
				expanded.push(...process.env.PATH.split(path.delimiter).filter(Boolean));
			}
			continue;
		}
		if (entry.startsWith("$HOME/")) {
			expanded.push(path.join(os.homedir(), entry.slice("$HOME/".length)));
			continue;
		}
		expanded.push(entry);
	}
	return expanded;
}
