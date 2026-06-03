/**
 * FR-SCHED-06: scope parsing
 *
 * Supported scope forms:
 *  - "all"
 *  - "pending" (tasks without `.DONE` marker)
 *  - explicit task IDs (e.g. "TP-008")
 *  - glob-like path patterns (e.g. "spine-tasks/TP-008-*")
 */

import path from 'node:path';
import { summarizePendingScope } from './pending.mjs';

export const TASK_ID_RE = /^[A-Z][A-Z0-9]*-\d{3,}$/;

export const NO_PENDING_TASKS_ERROR = 'No pending tasks (all discovered tasks have .DONE).';

function escapeRegexChar(ch) {
	// Escape regex meta characters.
	return /[\^$.*+?()[\]{}|]/.test(ch) ? `\${ch}` : ch;
}

function globToRegExp(pattern) {
	// Very small glob subset:
	//  - ** => .*
	//  - *  => [^/]*
	//  - ?  => [^/]
	// Everything else is treated as literal.
	const posix = String(pattern ?? '').replace(/\\/g, '/');
	let out = '^';

	for (let i = 0; i < posix.length; ) {
		const two = posix.slice(i, i + 2);
		if (two === '**') {
			out += '.*';
			i += 2;
			continue;
		}

		const ch = posix[i];
		if (ch === '*') {
			out += '[^/]*';
			i += 1;
			continue;
		}

		if (ch === '?') {
			out += '[^/]';
			i += 1;
			continue;
		}

		out += escapeRegexChar(ch);
		i += 1;
	}

	out += '$';
	return new RegExp(out);
}

function tokenizeScope(scope) {
	if (Array.isArray(scope)) return scope.map(String).filter(Boolean);
	const s = String(scope ?? '').trim();
	if (!s) return [];
	return s.split(/[\s,]+/).filter(Boolean);
}

/**
 * @param {any} scopeArg
 * @param {{ tasksRoot: string, discoveredTasks: Array<{ taskId: string, folderPath: string }> }} args
 * @returns {{ mode: 'all'|'pending'|'ids'|'glob'|'custom', taskIds: string[], excludedCount?: number }}
 */
export function parseScope(scopeArg, { tasksRoot, discoveredTasks }) {
	const allTaskIds = discoveredTasks.map((t) => t.taskId).sort();
	const tasksRootPosix = String(tasksRoot).replace(/\\/g, '/');
	const tasksRootBase = path.posix.basename(tasksRootPosix);

	if (scopeArg == null || scopeArg === 'all') {
		return { mode: 'all', taskIds: allTaskIds };
	}

	const tokens = tokenizeScope(scopeArg);
	if (tokens.length === 0) {
		return { mode: 'all', taskIds: allTaskIds };
	}

	if (tokens.length === 1 && tokens[0] === 'pending') {
		const { pendingIds, excludedCount } = summarizePendingScope(discoveredTasks, tasksRoot);
		if (pendingIds.length === 0) {
			throw new Error(NO_PENDING_TASKS_ERROR);
		}
		return { mode: 'pending', taskIds: pendingIds, excludedCount };
	}

	const selected = new Set();
	let sawGlob = false;
	let sawId = false;

	for (const token of tokens) {
		if (token === 'all') {
			return { mode: 'all', taskIds: allTaskIds };
		}

		if (token === 'pending') {
			throw new Error('Use scope "pending" alone; do not combine with other tokens.');
		}

		if (TASK_ID_RE.test(token)) {
			selected.add(token);
			sawId = true;
			continue;
		}

		sawGlob = true;
		const regex = globToRegExp(token);

		for (const discovered of discoveredTasks) {
			const abs = String(discovered.folderPath);
			const absNorm = abs.replace(/\\/g, '/');
			const rel = path.posix.normalize(path.relative(tasksRoot, abs));
			const relWithRoot = `${tasksRootBase}/${rel}`;
			// Match against absolute, relative-to-tasksRoot, and relative-with tasksRoot basename.
			if (regex.test(absNorm) || regex.test(rel) || regex.test(relWithRoot)) {
				selected.add(discovered.taskId);
			}
		}
	}

	const resolved = Array.from(selected)
		.filter((id) => allTaskIds.includes(id))
		.sort();

	if (resolved.length === 0) {
		throw new Error(`Scope did not match any discovered task(s): ${String(scopeArg)}`);
	}

	let mode = 'custom';
	if (sawGlob && !sawId) mode = 'glob';
	else if (!sawGlob && sawId) mode = 'ids';

	return { mode, taskIds: resolved };
}
