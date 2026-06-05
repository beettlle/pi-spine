import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PACKAGE_ROOT = path.resolve(__dirname, "..", "..");

export const c = {
	reset: "\x1b[0m",
	bold: "\x1b[1m",
	dim: "\x1b[2m",
	red: "\x1b[31m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	cyan: "\x1b[36m",
};

export const OK = `${c.green}✅${c.reset}`;
export const WARN = `${c.yellow}⚠️${c.reset}`;
export const FAIL = `${c.red}❌${c.reset}`;

export function die(msg) {
	console.error(`${FAIL} ${msg}`);
	process.exit(1);
}

export function getPackageVersion() {
	try {
		const pkg = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "package.json"), "utf-8"));
		return pkg.version || "unknown";
	} catch {
		return "unknown";
	}
}

export function getMinPiVersion() {
	try {
		const pkg = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "package.json"), "utf-8"));
		return pkg.pi?.minPiVersion ?? null;
	} catch {
		return null;
	}
}

/**
 * Write CLI module output and exit when the command failed.
 * @param {{ output?: string, exitCode?: number }} result
 */
export function writeCommandResult(result) {
	process.stdout.write(result.output ?? "");
	if (result.exitCode !== 0) process.exit(result.exitCode);
}

/**
 * Returns true when this module is the Node CLI entrypoint.
 * Uses fs.realpathSync so npm global bin symlinks resolve to the same file as import.meta.url.
 * Falls back to path.resolve equality when realpath throws (missing path edge case).
 * Requires Node >= 22 (see package engines).
 *
 * @param {string} importMetaUrl
 * @param {string|undefined} [argv1=process.argv[1]]
 */
export function isCliEntrypoint(importMetaUrl, argv1 = process.argv[1]) {
	if (!argv1) return false;
	const modulePath = fileURLToPath(importMetaUrl);
	try {
		return fs.realpathSync(argv1) === fs.realpathSync(modulePath);
	} catch {
		return path.resolve(argv1) === path.resolve(modulePath);
	}
}
