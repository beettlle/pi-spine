/**
 * FR-WORK-05: tiered worker context from spine-config referenceDocs/standards.
 */

import fs from "node:fs";
import path from "node:path";

/** Default injected standards for pi-spine / JS-CLI projects (matches bootstrap checklist). */
export const DEFAULT_SPINE_INIT_STANDARDS = [
	".cursor/rules/javascript-3-development-standards.mdc",
	".cursor/rules/general-llm-anti-patterns.mdc",
	".cursor/rules/critical-rules-quick-reference.mdc",
	".cursor/rules/taskplane-task-authoring.mdc",
	".cursor/rules/taskplane-worker-cursor.mdc",
];

export const DEFAULT_WORKER_CONTEXT_BYTE_CAP = 32_768;

/**
 * @param {unknown} value
 * @returns {string[]|null}
 */
export function normalizeContextPathList(value) {
	if (value == null) return [];
	if (!Array.isArray(value)) return null;
	const paths = [];
	for (const entry of value) {
		if (typeof entry !== "string" || !entry.trim()) {
			return null;
		}
		paths.push(entry.trim().replace(/\\/g, "/"));
	}
	return paths;
}

/**
 * @param {string} projectRoot
 * @param {string} relPath
 */
export function resolveContextDocPath(projectRoot, relPath) {
	const normalized = relPath.replace(/\\/g, "/").replace(/^\.\/+/, "");
	if (path.isAbsolute(normalized)) {
		return { ok: false, error: "absolute paths are not allowed in worker context lists" };
	}
	if (normalized.includes("..")) {
		return { ok: false, error: "path traversal is not allowed in worker context lists" };
	}

	const absPath = path.resolve(projectRoot, normalized);
	const rel = path.relative(projectRoot, absPath);
	if (rel.startsWith("..") || path.isAbsolute(rel)) {
		return { ok: false, error: `path escapes project root: ${relPath}` };
	}

	return { ok: true, absPath, relPath: rel.replace(/\\/g, "/") };
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string[]} params.paths
 * @param {Set<string>} [params.neverLoad]
 * @param {number} [params.byteCap]
 */
export function loadContextDocEntries({ projectRoot, paths, neverLoad = new Set(), byteCap = DEFAULT_WORKER_CONTEXT_BYTE_CAP }) {
	/** @type {{ relPath: string, content: string }[]} */
	const loaded = [];
	let totalBytes = 0;
	/** @type {string[]} */
	const skipped = [];

	for (const relPath of paths) {
		if (neverLoad.has(relPath)) {
			skipped.push(relPath);
			continue;
		}

		const resolved = resolveContextDocPath(projectRoot, relPath);
		if (!resolved.ok) {
			return { ok: false, error: resolved.error, relPath };
		}

		if (!fs.existsSync(resolved.absPath) || !fs.statSync(resolved.absPath).isFile()) {
			skipped.push(relPath);
			continue;
		}

		const content = fs.readFileSync(resolved.absPath, "utf-8");
		const size = Buffer.byteLength(content, "utf-8");
		if (totalBytes + size > byteCap) {
			return {
				ok: true,
				entries: loaded,
				truncated: true,
				skipped: [...skipped, relPath, "...remaining paths omitted (byte cap)"],
				bytesUsed: totalBytes,
				byteCap,
			};
		}

		loaded.push({ relPath: resolved.relPath, content });
		totalBytes += size;
	}

	return {
		ok: true,
		entries: loaded,
		truncated: false,
		skipped,
		bytesUsed: totalBytes,
		byteCap,
	};
}

/**
 * @param {object} [config]
 * @param {string} [projectRoot]
 * @param {number} [byteCap]
 */
export function buildWorkerContext(config = {}, projectRoot = process.cwd(), byteCap = DEFAULT_WORKER_CONTEXT_BYTE_CAP) {
	const neverLoad = new Set(normalizeContextPathList(config.neverLoad) ?? []);
	const referenceDocs = normalizeContextPathList(config.referenceDocs) ?? [];
	const standards = normalizeContextPathList(config.standards) ?? [];
	const orderedPaths = [...referenceDocs, ...standards];

	if (orderedPaths.length === 0) {
		return { text: "", entries: [], truncated: false, skipped: [], bytesUsed: 0, byteCap };
	}

	const result = loadContextDocEntries({ projectRoot, paths: orderedPaths, neverLoad, byteCap });
	if (!result.ok) {
		return {
			text: "",
			entries: [],
			truncated: false,
			skipped: [],
			bytesUsed: 0,
			byteCap,
			error: result.error,
			blockedPath: result.relPath,
		};
	}

	const parts = result.entries.map(
		(entry) => `--- ${entry.relPath} ---\n${entry.content.trim()}\n`,
	);
	const text = parts.length > 0 ? `\n\n## Project standards & reference\n\n${parts.join("\n")}` : "";

	return {
		text,
		entries: result.entries,
		truncated: result.truncated,
		skipped: result.skipped,
		bytesUsed: result.bytesUsed,
		byteCap: result.byteCap,
	};
}

/**
 * @param {object} config
 * @returns {{ code: string, message: string, suggestedCommand: string } | null}
 */
export function validateWorkerContextConfig(config) {
	for (const [field, label] of [
		["referenceDocs", "referenceDocs"],
		["standards", "standards"],
		["neverLoad", "neverLoad"],
	]) {
		if (config[field] == null) continue;
		const normalized = normalizeContextPathList(config[field]);
		if (normalized === null) {
			return {
				code: "CONFIG_WORKER_CONTEXT_INVALID",
				message: `${label} must be an array of non-empty strings`,
				suggestedCommand: "spine settings set",
			};
		}
	}
	return null;
}
