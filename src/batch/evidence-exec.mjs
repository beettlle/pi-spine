/**
 * Run one validated evidence argv with stdout+stderr streamed to a temp file.
 * Pipe buffers (execFileSync maxBuffer) kill the child with ENOBUFS on large
 * test logs and lose the exit status; a file sink keeps the true exit status
 * and lets us retain only the tail, which is where test failures summarize.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

export const EVIDENCE_TIMEOUT_MS = 10 * 60 * 1000;
export const EVIDENCE_DEFAULT_MAX_BYTES = 256 * 1024;

/**
 * @param {string} filePath
 * @param {number} maxBytes
 * @returns {{ text: string, totalBytes: number, truncated: boolean }}
 */
function readFileTail(filePath, maxBytes) {
	const totalBytes = fs.statSync(filePath).size;
	if (totalBytes <= maxBytes) {
		return { text: fs.readFileSync(filePath, "utf-8"), totalBytes, truncated: false };
	}
	const fd = fs.openSync(filePath, "r");
	try {
		const buffer = Buffer.alloc(maxBytes);
		fs.readSync(fd, buffer, 0, maxBytes, totalBytes - maxBytes);
		return { text: buffer.toString("utf-8"), totalBytes, truncated: true };
	} finally {
		fs.closeSync(fd);
	}
}

/**
 * @param {object} opts
 * @param {string} opts.projectRoot
 * @param {string[]} opts.argv
 * @param {NodeJS.ProcessEnv | undefined} opts.env
 * @param {number} opts.maxBytes Tail bytes retained from combined output.
 * @param {number} [opts.timeoutMs]
 * @returns {{ ok: boolean, output: string, truncated: boolean, exitDetail: string|null }}
 */
export function runEvidenceArgvToFile({ projectRoot, argv, env, maxBytes, timeoutMs = EVIDENCE_TIMEOUT_MS }) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "spine-evidence-"));
	const outPath = path.join(dir, "output.log");
	const fd = fs.openSync(outPath, "w");
	let fdOpen = true;
	try {
		const result = spawnSync(argv[0], argv.slice(1), {
			cwd: projectRoot,
			stdio: ["ignore", fd, fd],
			timeout: timeoutMs,
			...(env ? { env } : {}),
		});
		fs.closeSync(fd);
		fdOpen = false;
		const tail = readFileTail(outPath, maxBytes);
		const marker = tail.truncated
			? `[evidence truncated: kept last ${maxBytes} of ${tail.totalBytes} bytes]\n`
			: "";
		const output = `${marker}${tail.text}`;
		if (result.error) {
			return { ok: false, output, truncated: tail.truncated, exitDetail: result.error.message };
		}
		if (result.status === 0) {
			return { ok: true, output, truncated: tail.truncated, exitDetail: null };
		}
		const exitDetail =
			result.signal !== null
				? `Command terminated by ${result.signal}: ${argv.join(" ")}`
				: `Command failed with exit code ${result.status}: ${argv.join(" ")}`;
		return { ok: false, output, truncated: tail.truncated, exitDetail };
	} finally {
		if (fdOpen) fs.closeSync(fd);
		fs.rmSync(dir, { recursive: true, force: true });
	}
}
