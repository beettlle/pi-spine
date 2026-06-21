/**
 * Atomic file writes via temp file + rename (orchestration artifact persistence).
 */

import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

/**
 * @param {string} targetPath
 * @returns {string}
 */
export function makeAtomicTempPath(targetPath) {
	return `${targetPath}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
}

/**
 * @param {string} filePath
 * @param {string} content
 */
export function writeTextAtomic(filePath, content) {
	const dir = path.dirname(filePath);
	fs.mkdirSync(dir, { recursive: true });

	const tmpPath = makeAtomicTempPath(filePath);

	try {
		fs.writeFileSync(tmpPath, content, "utf-8");
		fs.renameSync(tmpPath, filePath);
	} catch (err) {
		try {
			if (fs.existsSync(tmpPath)) {
				fs.unlinkSync(tmpPath);
			}
		} catch {
			// ignore cleanup failure
		}
		throw err;
	}
}

/**
 * @param {string} filePath
 * @param {unknown} data
 */
export function writeJsonAtomic(filePath, data) {
	const content = `${JSON.stringify(data, null, 2)}\n`;
	writeTextAtomic(filePath, content);
}
