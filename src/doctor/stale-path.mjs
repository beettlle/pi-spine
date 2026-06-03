import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

/**
 * Resolve `spine` on PATH via `which` (injectable for tests).
 * @param {(cmd: string) => string | null} [which]
 * @returns {string | null} absolute path to spine binary, or null
 */
export function resolveSpineOnPath(which = defaultWhich) {
	return which("spine");
}

function defaultWhich(cmd) {
	try {
		const out = execFileSync("which", [cmd], {
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
		});
		const resolved = out.trim().split(/\r?\n/)[0]?.trim();
		return resolved || null;
	} catch {
		return null;
	}
}

/**
 * @param {string} packageRoot
 */
export function readPackageVersion(packageRoot) {
	try {
		const pkg = JSON.parse(
			fs.readFileSync(path.join(packageRoot, "package.json"), "utf-8"),
		);
		return pkg.version ?? "unknown";
	} catch {
		return "unknown";
	}
}

/**
 * Run `node spine.mjs --version` and parse package version line.
 * @param {string} spinePath
 * @param {(cmd: string, args: string[], opts?: object) => { status: number | null, stdout?: string, stderr?: string }} [spawn]
 */
export function readSpineCliVersion(spinePath, spawn = spawnSync) {
	const result = spawn(process.execPath, [spinePath, "--version"], {
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "pipe"],
		timeout: 30_000,
	});
	if (result.status !== 0) return null;
	const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
	const match = output.match(/v(\d+\.\d+\.\d+)/);
	return match?.[1] ?? null;
}

/**
 * @param {string} filePath
 * @param {(p: string) => string} [realpathFn]
 */
function safeRealpath(filePath, realpathFn = fs.realpathSync) {
	try {
		return realpathFn(filePath);
	} catch {
		return path.resolve(filePath);
	}
}

/**
 * Compare PATH `spine` with this package's bin/spine.mjs (version and mtime).
 *
 * @param {{
 *   packageRoot: string,
 *   runningSpinePath?: string,
 *   which?: (cmd: string) => string | null,
 *   spawn?: typeof spawnSync,
 *   stat?: typeof fs.statSync,
 *   realpath?: (p: string) => string,
 * }} args
 */
export function buildStalePathDoctorCheck({
	packageRoot,
	runningSpinePath,
	which,
	spawn,
	stat = fs.statSync,
	realpath = fs.realpathSync,
}) {
	const repoSpinePath = path.join(packageRoot, "bin", "spine.mjs");
	const pathSpine = resolveSpineOnPath(which);

	if (!pathSpine) {
		return {
			label: "spine on PATH",
			ok: true,
			warning: true,
			detail: "not found (use npm link, npx spine, or node bin/spine.mjs)",
			suggestedCommand: `cd ${packageRoot} && npm link`,
		};
	}

	const pathResolved = safeRealpath(pathSpine, realpath);
	const repoResolved = safeRealpath(repoSpinePath, realpath);
	const runningResolved = runningSpinePath
		? safeRealpath(runningSpinePath, realpath)
		: repoResolved;

	if (pathResolved === repoResolved || pathResolved === runningResolved) {
		return {
			label: "spine on PATH",
			ok: true,
			detail: pathSpine,
		};
	}

	let pathMtime;
	let repoMtime;
	try {
		pathMtime = stat(pathSpine).mtimeMs;
		repoMtime = stat(repoSpinePath).mtimeMs;
	} catch {
		return {
			label: "spine on PATH",
			ok: true,
			warning: true,
			detail: `PATH: ${pathSpine} (could not stat vs ${repoSpinePath})`,
			suggestedCommand: `cd ${packageRoot} && npm link`,
		};
	}

	const repoVersion = readPackageVersion(packageRoot);
	const pathVersion = readSpineCliVersion(pathSpine, spawn) ?? "unknown";
	const versionStale = pathVersion !== "unknown" && pathVersion !== repoVersion;
	const mtimeStale = pathMtime !== repoMtime;

	if (!versionStale && !mtimeStale) {
		return {
			label: "spine on PATH",
			ok: true,
			detail: `${pathSpine} (same version/mtime as package)`,
		};
	}

	const reasons = [];
	if (versionStale) reasons.push(`PATH v${pathVersion} vs package v${repoVersion}`);
	if (mtimeStale) reasons.push("binary mtime differs from checkout");

	return {
		label: "spine on PATH (stale)",
		ok: true,
		warning: true,
		detail: `${pathSpine} — ${reasons.join("; ")}`,
		suggestedCommand: `cd ${packageRoot} && npm link`,
	};
}
