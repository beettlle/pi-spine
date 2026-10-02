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

const IGNORABLE_DIR_FSYNC_CODES = new Set(["EISDIR", "EPERM", "EINVAL", "EBADF"]);

/**
 * Durability requires flushing the parent directory entry after the rename so
 * the rename itself survives a crash. Some platforms (win32, network and
 * exotic filesystems) cannot open or fsync a directory at all, so the four
 * codes that indicate that situation are tolerated; anything else is real I/O
 * trouble and propagates to the caller.
 * @param {string} dir
 */
function fsyncDirBestEffort(dir) {
	let dirFd;
	try {
		dirFd = fs.openSync(dir, "r");
	} catch (err) {
		if (IGNORABLE_DIR_FSYNC_CODES.has(/** @type {any} */ (err)?.code)) return;
		throw err;
	}
	try {
		fs.fsyncSync(dirFd);
	} catch (err) {
		if (!IGNORABLE_DIR_FSYNC_CODES.has(/** @type {any} */ (err)?.code)) throw err;
	} finally {
		fs.closeSync(dirFd);
	}
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
		// Durable temp write: fsync the file contents before the rename so the
		// data reaches disk before the entry swap makes it authoritative (#302).
		const fd = fs.openSync(tmpPath, "w");
		try {
			fs.writeSync(fd, content, null, "utf-8");
			fs.fsyncSync(fd);
		} finally {
			fs.closeSync(fd);
		}
		fs.renameSync(tmpPath, filePath);
		fsyncDirBestEffort(dir);
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
