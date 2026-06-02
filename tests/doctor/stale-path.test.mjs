import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
	buildStalePathDoctorCheck,
	readPackageVersion,
	readSpineCliVersion,
	resolveSpineOnPath,
} from "../../src/doctor/stale-path.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("resolveSpineOnPath uses which by default", () => {
	const resolved = resolveSpineOnPath(() => "/tmp/fake-spine");
	assert.equal(resolved, "/tmp/fake-spine");
});

test("readPackageVersion reads package.json version", () => {
	assert.equal(readPackageVersion(REPO_ROOT), readPackageVersion(REPO_ROOT));
	assert.match(readPackageVersion(REPO_ROOT), /^\d+\.\d+\.\d+$/);
});

test("buildStalePathDoctorCheck warns when spine not on PATH", () => {
	const check = buildStalePathDoctorCheck({
		packageRoot: REPO_ROOT,
		which: () => null,
	});
	assert.equal(check.ok, true);
	assert.equal(check.warning, true);
	assert.match(check.detail, /not found/);
	assert.ok(check.suggestedCommand?.includes("npm link"));
});

test("buildStalePathDoctorCheck ok when PATH matches package bin", () => {
	const repoSpine = path.join(REPO_ROOT, "bin", "spine.mjs");
	const check = buildStalePathDoctorCheck({
		packageRoot: REPO_ROOT,
		runningSpinePath: repoSpine,
		which: () => repoSpine,
		realpath: (p) => path.resolve(p),
	});
	assert.equal(check.ok, true);
	assert.equal(check.warning, undefined);
	assert.equal(check.detail, repoSpine);
});

test("buildStalePathDoctorCheck warns on version mismatch", () => {
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "spine-stale-"));
	try {
		const staleBin = path.join(tmp, "stale-spine.mjs");
		fs.writeFileSync(staleBin, "#!/usr/bin/env node\n", "utf-8");
		const repoSpine = path.join(REPO_ROOT, "bin", "spine.mjs");
		const now = Date.now();
		const check = buildStalePathDoctorCheck({
			packageRoot: REPO_ROOT,
			runningSpinePath: repoSpine,
			which: () => staleBin,
			spawn: () => ({
				status: 0,
				stdout: "pi-spine v0.0.0\n",
				stderr: "",
			}),
			stat: (p) => ({
				mtimeMs: p === staleBin ? now - 1000 : now,
			}),
			realpath: (p) => path.resolve(p),
		});
		assert.equal(check.warning, true);
		assert.match(check.label, /stale/);
		assert.match(check.detail, /PATH v0\.0\.0/);
		assert.ok(check.suggestedCommand?.includes("npm link"));
	} finally {
		fs.rmSync(tmp, { recursive: true, force: true });
	}
});

test("buildStalePathDoctorCheck warns on mtime mismatch only", () => {
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "spine-stale-mtime-"));
	try {
		const staleBin = path.join(tmp, "other-spine.mjs");
		fs.writeFileSync(staleBin, "#!/usr/bin/env node\n", "utf-8");
		const repoSpine = path.join(REPO_ROOT, "bin", "spine.mjs");
		const version = readPackageVersion(REPO_ROOT);
		const now = Date.now();
		const check = buildStalePathDoctorCheck({
			packageRoot: REPO_ROOT,
			runningSpinePath: repoSpine,
			which: () => staleBin,
			spawn: () => ({
				status: 0,
				stdout: `pi-spine v${version}\n`,
				stderr: "",
			}),
			stat: (p) => ({
				mtimeMs: p === staleBin ? now - 5000 : now,
			}),
			realpath: (p) => path.resolve(p),
		});
		assert.equal(check.warning, true);
		assert.match(check.detail, /mtime differs/);
	} finally {
		fs.rmSync(tmp, { recursive: true, force: true });
	}
});

test("readSpineCliVersion parses spine --version output", () => {
	const version = readSpineCliVersion(path.join(REPO_ROOT, "bin", "spine.mjs"));
	assert.equal(version, readPackageVersion(REPO_ROOT));
});

